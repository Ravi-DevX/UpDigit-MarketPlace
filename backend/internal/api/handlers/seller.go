package handlers

import (
	"net/http"
	"slices"
	"strings"

	"marketplace/backend/internal/api/middleware"
	"marketplace/backend/internal/auth"
	"marketplace/backend/internal/models"
	"marketplace/backend/internal/repository"

	"github.com/gin-gonic/gin"
)

type sellerApplyRequest struct {
	ShopName string `json:"shop_name" validate:"required,min=3,max=100"`
	ShopSlug string `json:"shop_slug" validate:"required,min=3,max=100"`
	Website  string `json:"shop_description"`
}

type payoutRequest struct {
	Amount float64 `json:"amount" validate:"required"`
	Method string  `json:"method" validate:"required"`
}

func (h *Handler) RegisterSellerRoutes(router *gin.RouterGroup) {
	router.GET("/seller/dashboard", h.sellerDashboard)
	router.GET("/seller/settings", h.sellerSettings)
	router.PUT("/seller/settings", h.sellerUpdateSettings)
	router.GET("/seller/products", h.sellerProducts)
	router.GET("/seller/products/:slug", h.sellerProductDetail)
	router.GET("/seller/orders", h.sellerOrders)
	router.GET("/seller/analytics", h.sellerAnalytics)
	router.GET("/seller/earnings", h.sellerEarnings)
	router.POST("/seller/payout/request", h.sellerRequestPayout)
	router.GET("/seller/coupons", h.sellerListCoupons)
	router.POST("/seller/coupons", h.sellerCreateCoupon)
	router.PUT("/seller/coupons/:id", h.sellerUpdateCoupon)
	router.DELETE("/seller/coupons/:id", h.sellerDeleteCoupon)
	router.GET("/seller/webhooks", h.sellerListWebhooks)
	router.POST("/seller/webhooks", h.sellerCreateWebhook)
	router.DELETE("/seller/webhooks/:id", h.sellerDeleteWebhook)
}

func (h *Handler) sellerProductDetail(c *gin.Context) {
	product, err := h.Repo.GetProductBySlug(c, c.Param("slug"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "product not found"})
		return
	}
	if !h.ensureCanManageProduct(c, product.ID) {
		return
	}
	product.Description = sanitizeDescription(product.Description)
	h.enrichProductDetail(c, &product)
	c.JSON(http.StatusOK, product)
}

func (h *Handler) RegisterSellerApplyRoute(router *gin.RouterGroup) {
	router.GET("/seller/application", h.sellerApplication)
	router.POST("/seller/apply", h.sellerApply)
}

func (h *Handler) sellerApplication(c *gin.Context) {
	userID := middleware.AuthUserID(c)
	profile, err := h.Repo.GetSellerProfileByUserID(c, userID)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"status": "none", "profile": nil})
		return
	}
	if profile.Approved {
		user, err := h.Repo.GetUserByID(c, userID)
		if err == nil && user.Role != "admin" && user.Role != "staff" && user.Role != "seller" {
			if err := h.Repo.UpdateUserRole(c, userID, "seller"); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "could not promote seller"})
				return
			}
		}
		c.JSON(http.StatusOK, gin.H{"status": "approved", "profile": profile})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "pending", "profile": profile})
}

func (h *Handler) sellerApply(c *gin.Context) {
	var req sellerApplyRequest
	if err := c.ShouldBindJSON(&req); err != nil || auth.ValidateTokenPayload(&req) != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	userID := middleware.AuthUserID(c)
	existing, err := h.Repo.GetSellerProfileByUserID(c, userID)
	if err == nil {
		if existing.Approved {
			user, err := h.Repo.GetUserByID(c, userID)
			if err == nil && user.Role != "admin" && user.Role != "staff" && user.Role != "seller" {
				if err := h.Repo.UpdateUserRole(c, userID, "seller"); err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "could not promote seller"})
					return
				}
			}
			c.JSON(http.StatusOK, gin.H{"status": "approved", "profile": existing})
			return
		}
		c.JSON(http.StatusAccepted, gin.H{"status": "pending", "profile": existing})
		return
	}
	profile := &models.SellerProfile{
		UserID:          userID,
		ShopName:        req.ShopName,
		ShopSlug:        strings.ToLower(req.ShopSlug),
		ShopDescription: &req.Website,
		PayoutMethod:    nil,
		TotalSales:      0,
		TotalRevenue:    0,
	}
	if err := h.Repo.CreateSellerProfile(c, profile); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not apply"})
		return
	}
	created, err := h.Repo.GetSellerProfileByUserID(c, userID)
	if err != nil {
		c.JSON(http.StatusCreated, gin.H{"status": "pending", "profile": profile})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"status": "pending", "profile": created})
}

func (h *Handler) sellerSettings(c *gin.Context) {
	userID := middleware.AuthUserID(c)
	profile, err := h.Repo.GetSellerProfileByUserID(c, userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "seller profile not found"})
		return
	}
	c.JSON(http.StatusOK, profile)
}

func (h *Handler) sellerUpdateSettings(c *gin.Context) {
	userID := middleware.AuthUserID(c)
	var req struct {
		ShopName        string         `json:"shop_name" validate:"required,min=3,max=100"`
		ShopSlug        string         `json:"shop_slug" validate:"required,min=3,max=100"`
		ShopDescription *string        `json:"shop_description"`
		ShopBannerURL   *string        `json:"shop_banner_url"`
		PayoutMethod    *string        `json:"payout_method"`
		PayoutDetails   map[string]any `json:"payout_details"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || auth.ValidateTokenPayload(&req) != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	profile, err := h.Repo.GetSellerProfileByUserID(c, userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "seller profile not found"})
		return
	}
	profile.ShopName = strings.TrimSpace(req.ShopName)
	profile.ShopSlug = strings.ToLower(strings.TrimSpace(req.ShopSlug))
	profile.ShopDescription = req.ShopDescription
	profile.ShopBannerURL = req.ShopBannerURL
	profile.PayoutMethod = req.PayoutMethod
	profile.PayoutDetails = req.PayoutDetails
	if err := h.Repo.UpsertSellerProfile(c, profile); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update seller settings"})
		return
	}
	updated, err := h.Repo.GetSellerProfileByUserID(c, userID)
	if err != nil {
		c.JSON(http.StatusOK, profile)
		return
	}
	c.JSON(http.StatusOK, updated)
}

func (h *Handler) sellerDashboard(c *gin.Context) {
	userID := middleware.AuthUserID(c)
	products, total, err := h.Repo.ListProducts(c, repository.ListProductsFilter{SellerID: &userID, Limit: 100, Offset: 0, Sort: "newest"})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "dashboard unavailable"})
		return
	}
	orders, _ := h.Repo.ListOrdersBySeller(c, userID)
	var revenue float64
	var completed int
	for _, order := range orders {
		if order.Status == "completed" {
			completed++
			revenue += order.SellerEarnings
		}
	}
	c.JSON(http.StatusOK, gin.H{
		"products":         total,
		"recent_products":  products,
		"orders":           len(orders),
		"completed_orders": completed,
		"revenue":          revenue,
	})
}

func (h *Handler) sellerProducts(c *gin.Context) {
	userID := middleware.AuthUserID(c)
	products, total, err := h.Repo.ListProducts(c, repository.ListProductsFilter{SellerID: &userID, Limit: 100, Offset: 0, Sort: c.Query("sort")})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load products"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"total": total, "products": products})
}

func (h *Handler) sellerOrders(c *gin.Context) {
	userID := middleware.AuthUserID(c)
	orders, err := h.Repo.ListOrdersBySeller(c, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load orders"})
		return
	}
	c.JSON(http.StatusOK, orders)
}

func (h *Handler) sellerAnalytics(c *gin.Context) {
	userID := middleware.AuthUserID(c)
	orders, err := h.Repo.ListOrdersBySeller(c, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load analytics"})
		return
	}
	type revenuePoint struct {
		Period  string  `json:"period"`
		Revenue float64 `json:"revenue"`
		Orders  int     `json:"orders"`
	}
	seriesMap := make(map[string]*revenuePoint)
	var revenue float64
	var completed int
	for _, order := range orders {
		if order.Status != "completed" {
			continue
		}
		completed++
		revenue += order.SellerEarnings
		period := order.CreatedAt.UTC().Format("2006-01-02")
		point := seriesMap[period]
		if point == nil {
			point = &revenuePoint{Period: period}
			seriesMap[period] = point
		}
		point.Revenue += order.SellerEarnings
		point.Orders++
	}
	series := make([]revenuePoint, 0, len(seriesMap))
	for _, point := range seriesMap {
		series = append(series, *point)
	}
	slices.SortFunc(series, func(a, b revenuePoint) int {
		return strings.Compare(a.Period, b.Period)
	})
	c.JSON(http.StatusOK, gin.H{
		"total_orders":     len(orders),
		"completed_orders": completed,
		"revenue":          revenue,
		"series":           series,
	})
}

func (h *Handler) sellerEarnings(c *gin.Context) {
	userID := middleware.AuthUserID(c)
	user, err := h.Repo.GetUserByID(c, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load earnings"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"balance": user.Balance, "currency": "USD"})
}

func (h *Handler) sellerRequestPayout(c *gin.Context) {
	var req payoutRequest
	if err := c.ShouldBindJSON(&req); err != nil || auth.ValidateTokenPayload(&req) != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	req.Method = strings.TrimSpace(req.Method)
	if req.Amount <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "amount must be positive"})
		return
	}
	userID := middleware.AuthUserID(c)
	pr := models.PayoutRequest{
		SellerID: userID,
		Amount:   req.Amount,
		Method:   req.Method,
	}
	if err := h.Repo.CreatePayoutRequest(c, &pr); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create payout request"})
		return
	}
	c.JSON(http.StatusCreated, pr)
}

func (h *Handler) sellerListCoupons(c *gin.Context) {
	userID := middleware.AuthUserID(c)
	coupons, err := h.Repo.ListSellerCoupons(c, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load coupons"})
		return
	}
	c.JSON(http.StatusOK, coupons)
}

func (h *Handler) sellerCreateCoupon(c *gin.Context) {
	userID := middleware.AuthUserID(c)
	var req models.Coupon
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	req.SellerID = &userID
	if err := h.Repo.CreateCoupon(c, &req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create coupon"})
		return
	}
	c.JSON(http.StatusCreated, req)
}

func (h *Handler) sellerUpdateCoupon(c *gin.Context) {
	var req models.Coupon
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	req.ID = c.Param("id")
	if err := h.Repo.UpdateCoupon(c, &req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update coupon"})
		return
	}
	c.JSON(http.StatusOK, req)
}

func (h *Handler) sellerDeleteCoupon(c *gin.Context) {
	if err := h.Repo.DeleteCoupon(c, c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not delete coupon"})
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Handler) sellerListWebhooks(c *gin.Context) {
	userID := middleware.AuthUserID(c)
	webhooks, err := h.Repo.ListSellerWebhooks(c, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load webhooks"})
		return
	}
	c.JSON(http.StatusOK, webhooks)
}

func (h *Handler) sellerCreateWebhook(c *gin.Context) {
	userID := middleware.AuthUserID(c)
	var req struct {
		URL    string   `json:"url" validate:"required,url"`
		Secret string   `json:"secret"`
		Events []string `json:"events"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || auth.ValidateTokenPayload(&req) != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	validEvents := map[string]struct{}{
		"purchase": {},
		"review":   {},
		"refund":   {},
	}
	var normalized []string
	for _, event := range req.Events {
		event = strings.ToLower(strings.TrimSpace(event))
		if event == "" {
			continue
		}
		if _, ok := validEvents[event]; !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid webhook event"})
			return
		}
		normalized = append(normalized, event)
	}
	if len(normalized) == 0 {
		normalized = []string{"purchase"}
	}
	slices.Sort(normalized)
	req.Events = normalized
	w := models.Webhook{SellerID: userID, URL: req.URL, Secret: req.Secret, Events: req.Events}
	if err := h.Repo.CreateWebhook(c, &w); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create webhook"})
		return
	}
	c.JSON(http.StatusCreated, w)
}

func (h *Handler) sellerDeleteWebhook(c *gin.Context) {
	userID := middleware.AuthUserID(c)
	if err := h.Repo.DeleteWebhook(c, userID, c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not delete webhook"})
		return
	}
	c.Status(http.StatusNoContent)
}
