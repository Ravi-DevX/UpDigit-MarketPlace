package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"marketplace/backend/internal/api/middleware"
	"marketplace/backend/internal/auth"
	"marketplace/backend/internal/models"
	"marketplace/backend/internal/payment"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type checkoutCreateRequest struct {
	ProductID      string `json:"product_id" validate:"required,uuid"`
	ProductVersion string `json:"product_version_id"`
	CouponCode     string `json:"coupon_code"`
}

type tebexVerifyRequest struct {
	OrderID string `json:"order_id" validate:"required,uuid"`
}

func (h *Handler) RegisterOrderRoutes(authenticated, public *gin.RouterGroup) {
	authenticated.POST("/checkout/create", h.createCheckout)
	authenticated.POST("/checkout/confirm", h.deprecatedCheckoutConfirm)
	authenticated.POST("/checkout/tebex/verify", h.verifyTebexCheckout)
	authenticated.GET("/orders", h.listOrders)
	authenticated.GET("/orders/:id", h.getOrder)
	authenticated.GET("/orders/:id/download", h.getOrderDownload)
	public.GET("/downloads/:token", h.streamOrderDownload)
	public.POST("/stripe/webhook", h.stripeWebhook)
	public.POST("/paypal/webhook", h.paypalWebhook)
}

func (h *Handler) createCheckout(c *gin.Context) {
	if !h.Config.TebexHeadlessEnabled || strings.TrimSpace(h.Config.TebexPublicToken) == "" || strings.TrimSpace(h.Config.TebexPrivateKey) == "" {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Tebex Headless checkout is not configured"})
		return
	}
	var req checkoutCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil || auth.ValidateTokenPayload(&req) != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	buyerID := middleware.AuthUserID(c)
	user, err := h.Repo.GetUserByID(c, buyerID)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "email verification required"})
		return
	}
	dgenEmailVerified := user.ExternalID != "" && user.Email != "" && !strings.HasSuffix(strings.ToLower(user.Email), "@users.dgen.local")
	if !user.IsVerified && !dgenEmailVerified {
		c.JSON(http.StatusForbidden, gin.H{"error": "email verification required"})
		return
	}
	if strings.TrimSpace(user.Email) == "" || strings.HasSuffix(strings.ToLower(user.Email), "@users.dgen.local") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "a verified email address is required for Tebex checkout"})
		return
	}

	product, err := h.Repo.GetProductByID(c, req.ProductID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "product not found"})
		return
	}
	if !productIsPubliclyAccessible(strings.ToLower(product.Status), product.Metadata) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "product not available"})
		return
	}
	if product.SellerID == buyerID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "you cannot purchase your own product"})
		return
	}
	if product.Price <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "free products do not require checkout"})
		return
	}
	if purchased, err := h.Repo.GetOrderForUserProduct(c, buyerID, product.ID); err == nil {
		_ = h.Repo.RemoveFromCart(c, buyerID, product.ID)
		c.JSON(http.StatusOK, tebexCheckoutSession(purchased, payment.TebexBasket{}, 0))
		return
	}
	tebexClient := h.tebexClient()
	pendingOrders, err := h.Repo.ListPendingOrdersForBuyerProduct(c, buyerID, product.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not check pending Tebex orders"})
		return
	}
	for _, pendingOrder := range pendingOrders {
		if pendingOrder.PaymentID == nil {
			continue
		}
		basket, fetchErr := tebexClient.FetchBasket(c, *pendingOrder.PaymentID)
		if fetchErr != nil || !tebexBasketMatchesOrder(basket, pendingOrder) {
			continue
		}
		if basket.Complete {
			completedOrder, _, completeErr := h.completeTebexOrder(c, pendingOrder, tebexPaymentReference(basket))
			if completeErr != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "could not reconcile completed Tebex payment"})
				return
			}
			c.JSON(http.StatusOK, tebexCheckoutSession(completedOrder, basket, roundTwoDecimals(product.Price-completedOrder.Amount)))
			return
		}
		c.JSON(http.StatusOK, tebexCheckoutSession(pendingOrder, basket, roundTwoDecimals(product.Price-pendingOrder.Amount)))
		return
	}
	packageID, ok := productTebexPackageID(product.Metadata)
	if !ok {
		c.JSON(http.StatusConflict, gin.H{"error": "this product is not linked to a Tebex package"})
		return
	}
	tebexPackage, err := tebexClient.FetchPackage(c, packageID)
	if err != nil {
		c.JSON(tebexErrorStatus(err), gin.H{"error": tebexErrorMessage(err)})
		return
	}
	currency := strings.ToUpper(strings.TrimSpace(h.Config.TebexCurrency))
	if !strings.EqualFold(tebexPackage.Type, "single") {
		c.JSON(http.StatusConflict, gin.H{"error": "subscription packages are not supported for marketplace orders"})
		return
	}
	if !strings.EqualFold(tebexPackage.Currency, currency) {
		c.JSON(http.StatusConflict, gin.H{"error": "the Tebex package currency does not match this marketplace"})
		return
	}
	if !moneyEqual(tebexPackage.BasePrice, product.Price) {
		c.JSON(http.StatusConflict, gin.H{"error": "the Tebex package price does not match this product"})
		return
	}

	platformFeePercent := h.Config.PlatformFeePercent
	feeConfig, err := h.Repo.GetPlatformFeePercent(c)
	if err == nil {
		platformFeePercent = feeConfig
		h.Config.PlatformFeePercent = feeConfig
	}
	platformFee := roundTwoDecimals(product.Price * (platformFeePercent / 100))
	order := models.Order{
		BuyerID:          buyerID,
		ProductID:        product.ID,
		SellerID:         product.SellerID,
		Amount:           product.Price,
		PlatformFee:      platformFee,
		SellerEarnings:   roundTwoDecimals(product.Price - platformFee),
		Currency:         currency,
		Status:           "pending",
		ProductVersionID: nil,
	}
	if req.ProductVersion != "" {
		order.ProductVersionID = &req.ProductVersion
	}
	orderID, err := h.Repo.CreateOrder(c, &order)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create order"})
		return
	}
	order.ID = orderID
	cancelURL := strings.TrimRight(h.Config.FrontendURL, "/") + "/cart"
	completeURL := strings.TrimRight(h.Config.FrontendURL, "/") + "/dashboard/purchases?tebex_order=" + url.QueryEscape(orderID)
	custom := map[string]any{
		"order_id":         orderID,
		"buyer_id":         buyerID,
		"product_id":       product.ID,
		"tebex_package_id": packageID,
		"listed_amount":    fmt.Sprintf("%.2f", product.Price),
		"currency":         currency,
	}
	tebexBasket, err := tebexClient.CreateBasket(c, payment.TebexCreateBasketRequest{
		CompleteURL:          completeURL,
		CancelURL:            cancelURL,
		CompleteAutoRedirect: true,
		IPAddress:            customerIPv4(middleware.ClientIP(c)),
		Custom:               custom,
	})
	if err != nil {
		_ = h.Repo.UpdateOrderStatus(c, orderID, "payment_failed")
		if h.Logger != nil {
			h.Logger.Warn().Err(err).Str("order_id", orderID).Msg("tebex checkout creation failed")
		}
		c.JSON(tebexErrorStatus(err), gin.H{"error": tebexErrorMessage(err)})
		return
	}
	tebexBasket, err = tebexClient.AddPackage(c, tebexBasket.Ident, packageID, custom)
	if err == nil && strings.TrimSpace(req.CouponCode) != "" {
		tebexBasket, err = tebexClient.ApplyCoupon(c, tebexBasket.Ident, req.CouponCode)
	}
	if err == nil {
		tebexBasket, err = tebexClient.FetchBasket(c, tebexBasket.Ident)
	}
	if err != nil {
		_ = h.Repo.UpdateOrderStatus(c, orderID, "payment_failed")
		if h.Logger != nil {
			h.Logger.Warn().Err(err).Str("order_id", orderID).Msg("tebex headless basket setup failed")
		}
		c.JSON(tebexErrorStatus(err), gin.H{"error": tebexErrorMessage(err)})
		return
	}
	if !strings.EqualFold(tebexBasket.Currency, currency) || tebexBasket.BasePrice <= 0 || tebexBasket.BasePrice > product.Price+0.009 {
		_ = h.Repo.UpdateOrderStatus(c, orderID, "payment_failed")
		c.JSON(http.StatusConflict, gin.H{"error": "Tebex returned invalid basket pricing"})
		return
	}
	finalAmount := roundTwoDecimals(tebexBasket.BasePrice)
	discountAmount := roundTwoDecimals(product.Price - finalAmount)
	platformFee = roundTwoDecimals(finalAmount * (platformFeePercent / 100))
	order.Amount = finalAmount
	order.PlatformFee = platformFee
	order.SellerEarnings = roundTwoDecimals(finalAmount - platformFee)
	if err := h.Repo.UpdatePendingOrderPricing(c, orderID, buyerID, order.Amount, order.PlatformFee, order.SellerEarnings, currency); err != nil {
		_ = h.Repo.UpdateOrderStatus(c, orderID, "payment_failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not store Tebex basket pricing"})
		return
	}
	if err := h.Repo.SetPendingOrderPayment(c, orderID, buyerID, "tebex_headless", tebexBasket.Ident); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not attach Tebex basket to order"})
		return
	}
	checkoutURL := strings.TrimSpace(tebexBasket.Links.Checkout)
	if !validTebexCheckoutURL(checkoutURL) {
		checkoutURL = "https://pay.tebex.io/" + url.PathEscape(tebexBasket.Ident)
	}
	response := tebexCheckoutSession(order, tebexBasket, discountAmount)
	response["checkout_url"] = checkoutURL
	if strings.TrimSpace(req.CouponCode) != "" {
		response["coupon_code"] = strings.TrimSpace(req.CouponCode)
	}
	c.JSON(http.StatusCreated, response)
}

func (h *Handler) deprecatedCheckoutConfirm(c *gin.Context) {
	c.JSON(http.StatusGone, gin.H{"error": "payment confirmation must be verified by the payment provider"})
}

func (h *Handler) verifyTebexCheckout(c *gin.Context) {
	if !h.Config.TebexHeadlessEnabled || strings.TrimSpace(h.Config.TebexPublicToken) == "" || strings.TrimSpace(h.Config.TebexPrivateKey) == "" {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Tebex Headless checkout is not configured"})
		return
	}
	var req tebexVerifyRequest
	if err := c.ShouldBindJSON(&req); err != nil || auth.ValidateTokenPayload(&req) != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	buyerID := middleware.AuthUserID(c)
	order, err := h.Repo.GetOrder(c, req.OrderID)
	if err != nil || order.BuyerID != buyerID {
		c.JSON(http.StatusNotFound, gin.H{"error": "order not found"})
		return
	}
	if order.Status == "completed" {
		c.JSON(http.StatusOK, gin.H{"order": order})
		return
	}
	if order.Status != "pending" || order.PaymentMethod == nil || *order.PaymentMethod != "tebex_headless" || order.PaymentID == nil || *order.PaymentID == "" {
		c.JSON(http.StatusConflict, gin.H{"error": "order is not awaiting Tebex payment"})
		return
	}
	tebexClient := h.tebexClient()
	basket, err := tebexClient.FetchBasket(c, *order.PaymentID)
	if err != nil {
		if h.Logger != nil {
			h.Logger.Warn().Err(err).Str("order_id", order.ID).Msg("tebex basket verification failed")
		}
		c.JSON(tebexErrorStatus(err), gin.H{"error": tebexErrorMessage(err)})
		return
	}
	if !tebexBasketMatchesOrder(basket, order) {
		c.JSON(http.StatusConflict, gin.H{"error": "Tebex basket does not match this order"})
		return
	}
	if !basket.Complete {
		c.JSON(http.StatusConflict, gin.H{"error": "Tebex payment is not complete"})
		return
	}
	if !strings.EqualFold(basket.Currency, order.Currency) {
		c.JSON(http.StatusConflict, gin.H{"error": "Tebex payment currency does not match this order"})
		return
	}
	paymentReference := tebexPaymentReference(basket)
	order, _, err = h.completeTebexOrder(c, order, paymentReference)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not complete order"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"order": order})
}

func (h *Handler) completeTebexOrder(c *gin.Context, order models.Order, paymentReference string) (models.Order, bool, error) {
	if strings.TrimSpace(paymentReference) == "" {
		return order, false, fmt.Errorf("tebex payment reference is required")
	}
	license := genLicenseKey()
	completed, err := h.Repo.CompletePendingOrder(c, order.ID, order.BuyerID, "tebex_headless", paymentReference, license)
	if err != nil {
		return order, false, err
	}
	if completed {
		_ = h.Repo.RemoveFromCart(c, order.BuyerID, order.ProductID)
		if product, productErr := h.Repo.GetProductByID(c, order.ProductID); productErr == nil {
			buyerBody := "Your purchase of " + product.Title + " is complete and ready to download."
			buyerLink := "/dashboard/purchases"
			_ = h.Repo.AddNotification(c, &models.Notification{UserID: order.BuyerID, Type: "purchase_completed", Title: "Purchase complete", Body: &buyerBody, Link: &buyerLink})
			sellerBody := "A customer purchased " + product.Title + "."
			sellerLink := "/seller/orders"
			_ = h.Repo.AddNotification(c, &models.Notification{UserID: order.SellerID, Type: "product_sale", Title: "New product sale", Body: &sellerBody, Link: &sellerLink})
		}
		h.enqueueWebhookEvent(c, order.SellerID, "purchase", map[string]any{
			"order_id":       order.ID,
			"buyer_id":       order.BuyerID,
			"seller_id":      order.SellerID,
			"product_id":     order.ProductID,
			"amount":         order.Amount,
			"currency":       order.Currency,
			"payment_method": "tebex_headless",
			"payment_id":     paymentReference,
		})
	}
	order, err = h.Repo.GetOrder(c, order.ID)
	if err != nil {
		return order, completed, err
	}
	return order, completed, nil
}

func tebexCheckoutSession(order models.Order, basket payment.TebexBasket, discount float64) gin.H {
	return gin.H{
		"id":              order.ID,
		"amount":          order.Amount,
		"discount":        discount,
		"status":          order.Status,
		"seller_earnings": order.SellerEarnings,
		"payment_type":    "tebex",
		"provider":        "tebex",
		"ident":           basket.Ident,
		"checkout_url":    basket.Links.Checkout,
	}
}

func (h *Handler) tebexClient() payment.TebexClient {
	return payment.TebexClient{PublicToken: h.Config.TebexPublicToken, PrivateKey: h.Config.TebexPrivateKey, BaseURL: h.Config.TebexHeadlessAPIURL}
}

func validTebexCheckoutURL(raw string) bool {
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Scheme != "https" {
		return false
	}
	host := strings.ToLower(parsed.Hostname())
	return host == "checkout.tebex.io" || host == "pay.tebex.io"
}

func tebexBasketMatchesOrder(basket payment.TebexBasket, order models.Order) bool {
	if basket.Ident == "" || order.PaymentID == nil || basket.Ident != *order.PaymentID {
		return false
	}
	stringValue := func(key string) string { return strings.TrimSpace(fmt.Sprint(basket.Custom[key])) }
	if stringValue("order_id") != order.ID || stringValue("buyer_id") != order.BuyerID || stringValue("product_id") != order.ProductID {
		return false
	}
	if !strings.EqualFold(stringValue("currency"), order.Currency) || !strings.EqualFold(basket.Currency, order.Currency) || !moneyEqual(basket.BasePrice, order.Amount) {
		return false
	}
	return true
}

func productTebexPackageID(metadata map[string]any) (int64, bool) {
	value, ok := metadata["tebex_package_id"]
	if !ok {
		return 0, false
	}
	var id int64
	switch typed := value.(type) {
	case int64:
		id = typed
	case int:
		id = int64(typed)
	case float64:
		if typed != math.Trunc(typed) {
			return 0, false
		}
		id = int64(typed)
	case json.Number:
		id, _ = typed.Int64()
	case string:
		id, _ = strconv.ParseInt(strings.TrimSpace(typed), 10, 64)
	}
	return id, id > 0
}

func customerIPv4(raw string) string {
	ip := net.ParseIP(strings.TrimSpace(raw))
	if ip == nil || ip.To4() == nil {
		return ""
	}
	return ip.To4().String()
}

func moneyEqual(left, right float64) bool {
	return math.Abs(roundTwoDecimals(left)-roundTwoDecimals(right)) < 0.001
}

func tebexTransactionID(paymentURL string) string {
	parsed, err := url.Parse(strings.TrimSpace(paymentURL))
	if err != nil || parsed.Scheme != "https" || strings.ToLower(parsed.Hostname()) != "checkout.tebex.io" {
		return ""
	}
	parts := strings.Split(strings.Trim(parsed.Path, "/"), "/")
	for index := 0; index+1 < len(parts); index++ {
		if parts[index] == "payments" && strings.HasPrefix(parts[index+1], "tbx-") {
			return parts[index+1]
		}
	}
	return ""
}

func tebexPaymentReference(basket payment.TebexBasket) string {
	if transactionID := tebexTransactionID(basket.Links.Payment); transactionID != "" {
		return transactionID
	}
	if strings.TrimSpace(basket.Ident) == "" {
		return ""
	}
	return "tebex-basket:" + basket.Ident
}

func tebexErrorStatus(err error) int {
	var apiError *payment.TebexAPIError
	if !errors.As(err, &apiError) {
		return http.StatusBadGateway
	}
	if apiError.Status == http.StatusUnauthorized || apiError.Status == http.StatusForbidden {
		return http.StatusServiceUnavailable
	}
	if apiError.Status >= 400 && apiError.Status < 500 {
		return http.StatusBadRequest
	}
	return http.StatusBadGateway
}

func tebexErrorMessage(err error) string {
	var apiError *payment.TebexAPIError
	if errors.As(err, &apiError) && strings.TrimSpace(apiError.Detail) != "" {
		return "Tebex checkout rejected the request: " + apiError.Detail
	}
	return "Tebex checkout is temporarily unavailable"
}

func (h *Handler) listOrders(c *gin.Context) {
	buyerID := middleware.AuthUserID(c)
	orders, err := h.Repo.ListOrdersByBuyer(c, buyerID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load orders"})
		return
	}
	c.JSON(http.StatusOK, orders)
}

func (h *Handler) getOrder(c *gin.Context) {
	buyerID := middleware.AuthUserID(c)
	order, err := h.Repo.GetOrder(c, c.Param("id"))
	if err != nil || order.BuyerID != buyerID {
		c.JSON(http.StatusNotFound, gin.H{"error": "order not found"})
		return
	}
	c.JSON(http.StatusOK, order)
}

func (h *Handler) getOrderDownload(c *gin.Context) {
	orderID := c.Param("id")
	buyerID := middleware.AuthUserID(c)
	status, _, _, err := h.Repo.OrderBelongsToUser(c, orderID, buyerID)
	if err != nil || status != "completed" {
		c.JSON(http.StatusForbidden, gin.H{"error": "download unavailable"})
		return
	}
	order, err := h.Repo.GetOrder(c, orderID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "order not found"})
		return
	}
	versionID := ""
	if order.ProductVersionID != nil {
		versionID = *order.ProductVersionID
	}
	if versionID == "" {
		vID, err := h.Repo.GetLatestProductVersionID(c, order.ProductID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no product version available"})
			return
		}
		versionID = vID
	}
	ip := c.ClientIP()
	token, err := h.Repo.CreateDownloadTokenForOrder(c, orderID, versionID, 15*time.Minute, ip)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create download token"})
		return
	}
	_, _, err = h.Repo.GetProductVersionArtifact(c, versionID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "download artifact not found"})
		return
	}
	downloadURL := strings.TrimSuffix(h.Config.BackendURL, "/") + "/api/v1/downloads/" + url.PathEscape(token.Token)
	c.JSON(http.StatusOK, gin.H{
		"download_url":   downloadURL,
		"download_token": token.Token,
		"expires_at":     token.ExpiresAt,
	})
}

func (h *Handler) streamOrderDownload(c *gin.Context) {
	token := c.Param("token")
	key, fileName, productID, versionID, err := h.Repo.GetDownloadArtifactByToken(c, token)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "download link expired or already used"})
		return
	}
	if !h.streamArtifact(c, key, fileName, productID) {
		return
	}
	_ = h.Repo.MarkDownloadTokenUsed(c, token)
	_ = h.Repo.IncrementProductDownloads(c, productID)
	_ = h.Repo.IncrementProductVersionDownloads(c, versionID)
}

func (h *Handler) stripeWebhook(c *gin.Context) {
	var payload map[string]any
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid webhook"})
		return
	}
	// In production verify stripe signature header and persist event ID for idempotency.
	c.JSON(http.StatusOK, gin.H{"message": "ok"})
}

func (h *Handler) paypalWebhook(c *gin.Context) {
	var payload map[string]any
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid webhook"})
		return
	}
	// In production verify paypal webhook signature header.
	c.JSON(http.StatusOK, gin.H{"message": "ok"})
}

func roundTwoDecimals(v float64) float64 {
	return float64(int64(v*100+0.5)) / 100
}

func genLicenseKey() string {
	return "LC-" + strings.ToUpper(uuid.NewString()[:18])
}
