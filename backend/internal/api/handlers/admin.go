package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"marketplace/backend/internal/api/middleware"
	"marketplace/backend/internal/models"

	"github.com/gin-gonic/gin"
)

type adminRoleDefinition struct {
	Key         string   `json:"key"`
	Label       string   `json:"label"`
	Description string   `json:"description"`
	Permissions []string `json:"permissions"`
	System      bool     `json:"system"`
}

var siteSettingDefaults = map[string]string{
	"site_name":               "UpDigit",
	"site_tagline":            "Marketplace",
	"site_description":        "Marketplace for digital builders",
	"site_logo_url":           "",
	"support_email":           "support@updigit.net",
	"seo_default_title":       "UpDigit Marketplace",
	"seo_default_description": "Dark marketplace for digital products, plugins, scripts and game assets.",
	"announcement_text":       "",
}

func defaultAdminRoleDefinitions() []adminRoleDefinition {
	return []adminRoleDefinition{
		{
			Key:         "admin",
			Label:       "Admin",
			Description: "Full marketplace operations, user management, moderation, analytics, and settings access.",
			Permissions: []string{"admin.access", "users.manage", "products.moderate", "orders.manage", "settings.manage"},
			System:      true,
		},
		{
			Key:         "staff",
			Label:       "Staff",
			Description: "Operational support role for moderation, reports, and customer support workflows.",
			Permissions: []string{"products.moderate", "reports.manage", "orders.view"},
			System:      true,
		},
		{
			Key:         "client",
			Label:       "Client",
			Description: "Buyer account with purchase, license, wishlist, and profile access.",
			Permissions: []string{"purchases.manage", "profile.manage", "wishlist.manage"},
			System:      true,
		},
		{
			Key:         "member",
			Label:       "Member",
			Description: "Default community member account with public profile and marketplace browsing access.",
			Permissions: []string{"profile.manage", "marketplace.browse"},
			System:      true,
		},
	}
}

func (h *Handler) RegisterPublicSettingsRoutes(router *gin.RouterGroup) {
	router.GET("/settings/public", h.publicSettings)
}

func (h *Handler) RegisterAdminRoutes(router *gin.RouterGroup) {
	router.GET("/admin/categories", h.adminListCategories)
	router.GET("/admin/users", h.adminListUsers)
	router.GET("/admin/users/:id", h.adminGetUser)
	router.PUT("/admin/users/:id/ban", h.adminBanUser)
	router.PUT("/admin/users/:id/unban", h.adminUnbanUser)
	router.PUT("/admin/users/:id/role", h.adminSetUserRole)

	router.GET("/admin/products", h.adminListProducts)
	router.PUT("/admin/products/:id/approve", h.adminApproveProduct(true))
	router.PUT("/admin/products/:id/reject", h.adminApproveProduct(false))
	router.PUT("/admin/products/:id/feature", h.adminSetProductFeatured)
	router.PUT("/admin/products/:id/tebex-package", h.adminSetProductTebexPackage)

	router.GET("/admin/orders", h.adminListOrders)
	router.POST("/admin/orders/:id/refund", h.adminRefundOrder)

	router.GET("/admin/sellers/applications", h.adminSellerApplications)
	router.PUT("/admin/sellers/:id/approve", h.adminApproveSeller)
	router.PUT("/admin/sellers/:id/reject", h.adminRejectSeller)

	router.GET("/admin/payouts", h.adminPayouts)
	router.PUT("/admin/payouts/:id/approve", h.adminUpdatePayoutStatus("approved"))
	router.PUT("/admin/payouts/:id/reject", h.adminUpdatePayoutStatus("rejected"))

	router.GET("/admin/reports", h.adminListReports)
	router.PUT("/admin/reports/:id/resolve", h.adminUpdateReport("resolved"))
	router.PUT("/admin/reports/:id/dismiss", h.adminUpdateReport("dismissed"))

	router.GET("/admin/coupons", h.adminListCoupons)
	router.POST("/admin/coupons", h.adminCreateCoupon)
	router.PUT("/admin/coupons/:id", h.adminUpdateCoupon)
	router.DELETE("/admin/coupons/:id", h.adminDeleteCoupon)

	router.GET("/admin/tickets/config", h.adminTicketConfig)
	router.POST("/admin/tickets/categories", h.adminSaveTicketCategory)
	router.PUT("/admin/tickets/categories/:id", h.adminSaveTicketCategory)
	router.DELETE("/admin/tickets/categories/:id", h.adminDeleteTicketCategory)
	router.POST("/admin/tickets/statuses", h.adminSaveTicketStatus)
	router.PUT("/admin/tickets/statuses/:id", h.adminSaveTicketStatus)
	router.DELETE("/admin/tickets/statuses/:id", h.adminDeleteTicketStatus)
	router.POST("/admin/tickets/priorities", h.adminSaveTicketPriority)
	router.PUT("/admin/tickets/priorities/:id", h.adminSaveTicketPriority)
	router.DELETE("/admin/tickets/priorities/:id", h.adminDeleteTicketPriority)
	router.POST("/admin/tickets/features", h.adminSaveTicketFeature)
	router.PUT("/admin/tickets/features/:id", h.adminSaveTicketFeature)
	router.DELETE("/admin/tickets/features/:id", h.adminDeleteTicketFeature)

	router.GET("/admin/settings", h.adminGetSettings)
	router.PUT("/admin/settings", h.adminUpdateSetting)

	router.GET("/admin/analytics/overview", h.adminGetOverview)
	router.GET("/admin/analytics/revenue", h.adminGetRevenueSeries)
	router.GET("/admin/analytics/products", h.adminGetTopProducts)

	router.GET("/admin/audit-logs", h.adminAuditLogs)
}

func (h *Handler) adminListUsers(c *gin.Context) {
	users, err := h.Repo.ListAdminUsers(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load users"})
		return
	}
	c.JSON(http.StatusOK, users)
}

func (h *Handler) adminGetUser(c *gin.Context) {
	user, err := h.Repo.GetUserByID(c, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	c.JSON(http.StatusOK, user)
}

func (h *Handler) adminBanUser(c *gin.Context) {
	if err := h.Repo.BanUser(c, c.Param("id"), true); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not ban user"})
		return
	}
	_ = h.recordAdminAction(c, "user.ban", "user", c.Param("id"), map[string]any{"action": "ban"})
	c.Status(http.StatusNoContent)
}

func (h *Handler) adminUnbanUser(c *gin.Context) {
	if err := h.Repo.BanUser(c, c.Param("id"), false); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not unban user"})
		return
	}
	_ = h.recordAdminAction(c, "user.unban", "user", c.Param("id"), map[string]any{"action": "unban"})
	c.Status(http.StatusNoContent)
}

func (h *Handler) adminSetUserRole(c *gin.Context) {
	var payload struct {
		Role string `json:"role"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	if payload.Role == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "role required"})
		return
	}
	if err := h.Repo.UpdateUserRole(c, c.Param("id"), payload.Role); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update role"})
		return
	}
	_ = h.recordAdminAction(c, "user.role_update", "user", c.Param("id"), map[string]any{"role": payload.Role})
	c.Status(http.StatusNoContent)
}

func (h *Handler) adminListProducts(c *gin.Context) {
	products, err := h.Repo.ListProductsForAdmin(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load products"})
		return
	}
	c.JSON(http.StatusOK, products)
}

func (h *Handler) adminApproveProduct(approved bool) gin.HandlerFunc {
	return func(c *gin.Context) {
		product, err := h.Repo.GetProductByID(c, c.Param("id"))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "product not found"})
			return
		}
		if err := h.Repo.ApproveProduct(c, c.Param("id"), approved); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update product"})
			return
		}

		action := "product.reject"
		if approved {
			action = "product.approve"
		}
		_ = h.recordAdminAction(c, action, "product", c.Param("id"), map[string]any{"approved": approved})
		link := "/seller/products/" + product.Slug + "/edit"
		title := "Product needs changes"
		body := product.Title + " was not approved. Review the listing and submit it again when it is ready."
		notificationType := "product_rejected"
		if approved {
			title = "Product approved"
			body = product.Title + " has been approved and is now available according to its visibility setting."
			notificationType = "product_approved"
			if productVisibility(product.Metadata) != "unpublished" {
				link = "/products/" + product.Slug
			}
		}
		_ = h.Repo.AddNotification(c, &models.Notification{UserID: product.SellerID, Type: notificationType, Title: title, Body: &body, Link: &link})

		if approved {
			c.JSON(http.StatusOK, gin.H{"status": "approved"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "rejected"})
	}
}

func (h *Handler) adminSetProductFeatured(c *gin.Context) {
	var payload struct {
		Featured bool `json:"featured"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	if err := h.Repo.SetProductFeatured(c, c.Param("id"), payload.Featured); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update feature status"})
		return
	}
	_ = h.recordAdminAction(c, "product.featured", "product", c.Param("id"), map[string]any{"featured": payload.Featured})
	c.Status(http.StatusNoContent)
}

func (h *Handler) adminSetProductTebexPackage(c *gin.Context) {
	var payload struct {
		PackageID json.RawMessage `json:"package_id"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil || len(payload.PackageID) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "package_id is required"})
		return
	}
	product, err := h.Repo.GetProductByID(c, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "product not found"})
		return
	}
	if strings.TrimSpace(string(payload.PackageID)) == "null" {
		if err := h.Repo.SetProductTebexPackage(c, product.ID, nil); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not remove Tebex package mapping"})
			return
		}
		_ = h.recordAdminAction(c, "product.tebex_package_unlinked", "product", product.ID, map[string]any{})
		c.Status(http.StatusNoContent)
		return
	}
	var packageID int64
	if err := json.Unmarshal(payload.PackageID, &packageID); err != nil || packageID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "package_id must be a positive integer"})
		return
	}
	if !h.Config.TebexHeadlessEnabled || strings.TrimSpace(h.Config.TebexPublicToken) == "" || strings.TrimSpace(h.Config.TebexPrivateKey) == "" {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Tebex Headless checkout is not configured"})
		return
	}
	tebexClient := h.tebexClient()
	pkg, err := tebexClient.FetchPackage(c, packageID)
	if err != nil {
		c.JSON(tebexErrorStatus(err), gin.H{"error": tebexErrorMessage(err)})
		return
	}
	if !strings.EqualFold(pkg.Type, "single") {
		c.JSON(http.StatusConflict, gin.H{"error": "only one-time Tebex packages can be linked"})
		return
	}
	if !strings.EqualFold(pkg.Currency, h.Config.TebexCurrency) {
		c.JSON(http.StatusConflict, gin.H{"error": "the Tebex package currency does not match this marketplace"})
		return
	}
	if !moneyEqual(pkg.BasePrice, product.Price) {
		c.JSON(http.StatusConflict, gin.H{"error": "the Tebex package base price does not match this product"})
		return
	}
	if err := h.Repo.SetProductTebexPackage(c, product.ID, &packageID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not save Tebex package mapping"})
		return
	}
	_ = h.recordAdminAction(c, "product.tebex_package_linked", "product", product.ID, map[string]any{"package_id": packageID})
	c.JSON(http.StatusOK, gin.H{"package": pkg})
}

func (h *Handler) adminListOrders(c *gin.Context) {
	rows, err := h.Repo.ListAdminOrders(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load orders"})
		return
	}
	c.JSON(http.StatusOK, rows)
}

func (h *Handler) adminRefundOrder(c *gin.Context) {
	orderID := c.Param("id")
	order, err := h.Repo.GetOrder(c, orderID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "order not found"})
		return
	}
	if order.Status != "completed" {
		c.JSON(http.StatusConflict, gin.H{"error": "only completed orders can be refunded"})
		return
	}
	if order.PaymentMethod != nil && strings.HasPrefix(*order.PaymentMethod, "tebex") {
		c.JSON(http.StatusNotImplemented, gin.H{"error": "Tebex refunds are disabled during checkout testing; refund through Tebex before changing this order"})
		return
	}
	if err := h.Repo.ApplySellerEarnings(c, order.SellerID, -order.SellerEarnings); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not adjust seller balance"})
		return
	}
	if err := h.Repo.UpdateOrderStatus(c, order.ID, "refunded"); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not refund order"})
		return
	}
	_ = h.recordAdminAction(c, "order.refund", "order", orderID, map[string]any{"order_id": orderID, "product_id": order.ProductID})
	buyerBody := "Your order was refunded."
	buyerLink := "/dashboard/purchases"
	_ = h.Repo.AddNotification(c, &models.Notification{UserID: order.BuyerID, Type: "order_refunded", Title: "Order refunded", Body: &buyerBody, Link: &buyerLink})
	sellerBody := "A product order was refunded and the earnings adjustment has been applied."
	sellerLink := "/seller/orders"
	_ = h.Repo.AddNotification(c, &models.Notification{UserID: order.SellerID, Type: "sale_refunded", Title: "Sale refunded", Body: &sellerBody, Link: &sellerLink})
	c.JSON(http.StatusOK, gin.H{"message": "refunded"})
}

func (h *Handler) adminSellerApplications(c *gin.Context) {
	profiles, err := h.Repo.ListSellerApplications(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load seller applications"})
		return
	}
	c.JSON(http.StatusOK, profiles)
}

func (h *Handler) adminApproveSeller(c *gin.Context) {
	profile, err := h.Repo.GetSellerProfile(c, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "seller application not found"})
		return
	}
	if err := h.Repo.UpdateSellerApproved(c, profile.ID, true); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not approve seller"})
		return
	}
	user, err := h.Repo.GetUserByID(c, profile.UserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load seller user"})
		return
	}
	if user.Role != "admin" && user.Role != "staff" && user.Role != "seller" {
		if err := h.Repo.UpdateUserRole(c, profile.UserID, "seller"); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not promote seller"})
			return
		}
	}
	_ = h.recordAdminAction(c, "seller.approve", "seller_profile", profile.ID, map[string]any{"approved": true, "user_id": profile.UserID})
	body := "Your seller application was approved. You can now manage products from Seller Studio."
	link := "/seller"
	_ = h.Repo.AddNotification(c, &models.Notification{UserID: profile.UserID, Type: "seller_approved", Title: "Seller application approved", Body: &body, Link: &link})
	c.Status(http.StatusNoContent)
}

func (h *Handler) adminRejectSeller(c *gin.Context) {
	profile, err := h.Repo.GetSellerProfile(c, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "seller application not found"})
		return
	}
	if err := h.Repo.UpdateSellerApproved(c, profile.ID, false); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not reject seller"})
		return
	}
	_ = h.recordAdminAction(c, "seller.reject", "seller_profile", c.Param("id"), map[string]any{"approved": false})
	body := "Your seller application was not approved. You can update your seller details and contact support for more information."
	link := "/seller/apply"
	_ = h.Repo.AddNotification(c, &models.Notification{UserID: profile.UserID, Type: "seller_rejected", Title: "Seller application update", Body: &body, Link: &link})
	c.Status(http.StatusNoContent)
}

func (h *Handler) adminPayouts(c *gin.Context) {
	payouts, err := h.Repo.ListPayoutRequests(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load payouts"})
		return
	}
	c.JSON(http.StatusOK, payouts)
}

func (h *Handler) adminUpdatePayoutStatus(status string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if err := h.Repo.UpdatePayoutRequestStatus(c, c.Param("id"), status, middleware.AuthUserID(c)); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update payout"})
			return
		}
		_ = h.recordAdminAction(c, "payout."+status, "payout_request", c.Param("id"), map[string]any{"status": status})
		c.Status(http.StatusNoContent)
	}
}

func (h *Handler) adminListReports(c *gin.Context) {
	reports, err := h.Repo.ListReports(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load reports"})
		return
	}
	c.JSON(http.StatusOK, reports)
}

func (h *Handler) adminUpdateReport(status string) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		if err := h.Repo.UpdateReportStatus(c, id, status); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update report"})
			return
		}

		adminID := middleware.AuthUserID(c)
		_ = h.Repo.UpdateReportResolvedBy(c, id, adminID)
		_ = h.recordAdminAction(c, "report."+status, "report", id, map[string]any{"status": status})
		c.Status(http.StatusNoContent)
	}
}

func (h *Handler) adminListCoupons(c *gin.Context) {
	coupons, err := h.Repo.ListCoupons(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load coupons"})
		return
	}
	c.JSON(http.StatusOK, coupons)
}

func (h *Handler) adminCreateCoupon(c *gin.Context) {
	var req models.Coupon
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	req.SellerID = nil
	if !normalizeAdminCoupon(&req) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid coupon payload"})
		return
	}
	if err := h.Repo.CreateCoupon(c, &req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create coupon"})
		return
	}
	_ = h.recordAdminAction(c, "coupon.create", "coupon", req.ID, map[string]any{"code": req.Code})
	c.JSON(http.StatusCreated, req)
}

func (h *Handler) adminUpdateCoupon(c *gin.Context) {
	var req models.Coupon
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	req.ID = c.Param("id")
	req.SellerID = nil
	if !normalizeAdminCoupon(&req) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid coupon payload"})
		return
	}
	if err := h.Repo.UpdateCoupon(c, &req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update coupon"})
		return
	}
	_ = h.recordAdminAction(c, "coupon.update", "coupon", req.ID, map[string]any{"code": req.Code})
	c.JSON(http.StatusOK, req)
}

func (h *Handler) adminDeleteCoupon(c *gin.Context) {
	if err := h.Repo.DeleteCoupon(c, c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not delete coupon"})
		return
	}
	_ = h.recordAdminAction(c, "coupon.delete", "coupon", c.Param("id"), map[string]any{"deleted": true})
	c.Status(http.StatusNoContent)
}

func normalizeAdminCoupon(coupon *models.Coupon) bool {
	coupon.Code = strings.ToUpper(strings.TrimSpace(coupon.Code))
	coupon.DiscountType = strings.ToLower(strings.TrimSpace(coupon.DiscountType))
	if coupon.Code == "" || coupon.DiscountType == "" || coupon.DiscountValue < 0 {
		return false
	}
	if coupon.DiscountType != "percentage" && coupon.DiscountType != "fixed" {
		return false
	}
	if coupon.DiscountType == "percentage" && coupon.DiscountValue > 100 {
		return false
	}
	return true
}

func (h *Handler) adminGetSettings(c *gin.Context) {
	fee, err := h.Repo.GetPlatformFeePercent(c)
	if err == nil {
		h.Config.PlatformFeePercent = fee
	}
	roles := defaultAdminRoleDefinitions()
	if raw, err := h.Repo.GetSetting(c, "roles"); err == nil {
		var saved []adminRoleDefinition
		if json.Unmarshal([]byte(raw), &saved) == nil && len(saved) > 0 {
			roles = saved
		}
	}
	settings := map[string]any{}
	settings["platform_fee_percent"] = h.Config.PlatformFeePercent
	settings["roles"] = roles
	settings["theme_config"] = h.settingJSONObject(c, "theme_config")
	for key, fallback := range siteSettingDefaults {
		settings[key] = h.settingString(c, key, fallback)
	}
	c.JSON(http.StatusOK, settings)
}

func (h *Handler) adminUpdateSetting(c *gin.Context) {
	var payload struct {
		Key   string `json:"key"`
		Value any    `json:"value"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil || payload.Key == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	if payload.Key == "platform_fee_percent" {
		if v, ok := payload.Value.(float64); ok {
			if v < 0 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "platform fee must be non-negative"})
				return
			}
			h.Config.PlatformFeePercent = v
			if err := h.Repo.SetPlatformFeePercent(c, v); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "could not save setting"})
				return
			}
			_ = h.recordAdminAction(c, "settings.update", "setting", payload.Key, map[string]any{"key": payload.Key, "value": payload.Value})
			c.Status(http.StatusNoContent)
			return
		}

		if s, ok := payload.Value.(string); ok {
			parsed, err := strconv.ParseFloat(strings.TrimSpace(s), 64)
			if err != nil || parsed < 0 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid platform_fee_percent"})
				return
			}
			h.Config.PlatformFeePercent = parsed
			if err := h.Repo.SetPlatformFeePercent(c, parsed); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "could not save setting"})
				return
			}
			_ = h.recordAdminAction(c, "settings.update", "setting", payload.Key, map[string]any{"key": payload.Key, "value": parsed})
			c.Status(http.StatusNoContent)
			return
		}

		c.JSON(http.StatusBadRequest, gin.H{"error": "platform_fee_percent must be a number"})
		return
	}
	if payload.Key == "roles" {
		raw, err := json.Marshal(payload.Value)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid roles payload"})
			return
		}
		var roles []adminRoleDefinition
		if err := json.Unmarshal(raw, &roles); err != nil || len(roles) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "roles must be a non-empty array"})
			return
		}
		for _, role := range roles {
			if strings.TrimSpace(role.Key) == "" || strings.TrimSpace(role.Label) == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "role key and label are required"})
				return
			}
		}
		if err := h.Repo.SetSetting(c, "roles", string(raw)); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not save roles"})
			return
		}
		_ = h.recordAdminAction(c, "settings.roles_update", "setting", nil, map[string]any{"count": len(roles)})
		c.Status(http.StatusNoContent)
		return
	}
	if payload.Key == "theme_config" {
		raw, err := json.Marshal(payload.Value)
		if err != nil || len(raw) > 32*1024 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid or oversized theme configuration"})
			return
		}
		var theme map[string]any
		if err := json.Unmarshal(raw, &theme); err != nil || theme == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "theme_config must be an object"})
			return
		}
		if err := h.Repo.SetSetting(c, "theme_config", string(raw)); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not save theme"})
			return
		}
		_ = h.recordAdminAction(c, "settings.theme_update", "setting", nil, map[string]any{"version": theme["version"]})
		c.Status(http.StatusNoContent)
		return
	}
	if _, ok := siteSettingDefaults[payload.Key]; ok {
		value, ok := payload.Value.(string)
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "site setting value must be a string"})
			return
		}
		value = strings.TrimSpace(value)
		if len(value) > 500 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "site setting value is too long"})
			return
		}
		if err := h.Repo.SetSetting(c, payload.Key, value); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not save setting"})
			return
		}
		_ = h.recordAdminAction(c, "settings.update", "setting", payload.Key, map[string]any{"key": payload.Key, "value": value})
		c.Status(http.StatusNoContent)
		return
	}

	c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported setting key"})
}

func (h *Handler) publicSettings(c *gin.Context) {
	settings := map[string]any{}
	for key, fallback := range siteSettingDefaults {
		settings[key] = h.settingString(c, key, fallback)
	}
	settings["theme_config"] = h.settingJSONObject(c, "theme_config")
	settings["tebex_checkout_enabled"] = h.Config.TebexHeadlessEnabled && strings.TrimSpace(h.Config.TebexPublicToken) != "" && strings.TrimSpace(h.Config.TebexPrivateKey) != ""
	c.JSON(http.StatusOK, settings)
}

func (h *Handler) settingJSONObject(c *gin.Context, key string) map[string]any {
	value, err := h.Repo.GetSetting(c, key)
	if err != nil {
		return map[string]any{}
	}
	var result map[string]any
	if json.Unmarshal([]byte(value), &result) != nil || result == nil {
		return map[string]any{}
	}
	return result
}

func (h *Handler) settingString(c *gin.Context, key string, fallback string) string {
	value, err := h.Repo.GetSetting(c, key)
	if err != nil {
		return fallback
	}
	return value
}

func (h *Handler) adminListCategories(c *gin.Context) {
	categories, err := h.Repo.ListCategoriesTree(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load categories"})
		return
	}
	c.JSON(http.StatusOK, categories)
}

func (h *Handler) adminGetOverview(c *gin.Context) {
	overview, err := h.Repo.AdminOverview(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load analytics overview"})
		return
	}
	c.JSON(http.StatusOK, overview)
}

func (h *Handler) adminGetRevenueSeries(c *gin.Context) {
	groupBy := c.Query("group_by")
	if groupBy == "" {
		groupBy = "day"
	}
	periodFrom, _ := time.Parse(time.RFC3339, c.Query("from"))
	if periodFrom.IsZero() {
		periodFrom = time.Now().UTC().AddDate(0, 0, -30)
	}
	periodTo := time.Now().UTC()
	if raw := c.Query("to"); raw != "" {
		if parsed, err := time.Parse(time.RFC3339, raw); err == nil {
			periodTo = parsed
		}
	}
	series, err := h.Repo.AdminRevenueSeries(c, periodFrom, periodTo, groupBy)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load revenue series"})
		return
	}
	c.JSON(http.StatusOK, series)
}

func (h *Handler) adminGetTopProducts(c *gin.Context) {
	limit := int64(10)
	if raw := c.Query("limit"); strings.TrimSpace(raw) != "" {
		parsed, err := strconv.ParseInt(raw, 10, 64)
		if err == nil && parsed > 0 {
			limit = parsed
		}
	}
	products, err := h.Repo.TopProductsByRevenue(c, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load top products"})
		return
	}
	c.JSON(http.StatusOK, products)
}

func (h *Handler) recordAdminAction(c *gin.Context, action string, targetType string, targetID any, details map[string]any) error {
	adminID := middleware.AuthUserID(c)
	log := models.AuditLog{
		AdminID:    &adminID,
		Action:     action,
		TargetType: &targetType,
		Details:    details,
		IPAddress:  nil,
	}
	switch value := targetID.(type) {
	case string:
		target := value
		log.TargetID = &target
	case *string:
		if value != nil {
			log.TargetID = value
		}
	}
	if ip := middleware.ClientIP(c); ip != "" {
		log.IPAddress = &ip
	}
	return h.Repo.AddAuditLog(c, log)
}

func (h *Handler) adminAuditLogs(c *gin.Context) {
	logs, err := h.Repo.ListAuditLogs(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load audit logs"})
		return
	}
	c.JSON(http.StatusOK, logs)
}
