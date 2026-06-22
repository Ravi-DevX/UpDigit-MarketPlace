package handlers

import (
	"net/http"
	"strings"
	"time"

	"marketplace/backend/internal/api/middleware"
	"marketplace/backend/internal/models"

	"github.com/gin-gonic/gin"
)

func (h *Handler) RegisterCartWishlistRoutes(router *gin.RouterGroup) {
	router.GET("/cart", h.listCart)
	router.POST("/cart/apply-coupon", h.applyCouponToCart)
	router.POST("/cart/:product_id", h.addToCart)
	router.DELETE("/cart/:product_id", h.removeFromCart)

	router.GET("/wishlist", h.listWishlist)
	router.POST("/wishlist/:product_id", h.addToWishlist)
	router.DELETE("/wishlist/:product_id", h.removeFromWishlist)
}

func (h *Handler) listCart(c *gin.Context) {
	userID := middleware.AuthUserID(c)
	items, err := h.Repo.ListCart(c, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load cart"})
		return
	}
	response := make([]gin.H, 0, len(items))
	for _, item := range items {
		product, err := h.Repo.GetProductByID(c, item.ProductID)
		if err != nil || !productIsPubliclyAccessible(product.Status, product.Metadata) {
			continue
		}
		response = append(response, gin.H{
			"id":         item.ID,
			"product_id": item.ProductID,
			"added_at":   item.AddedAt,
			"product":    product,
		})
	}
	c.JSON(http.StatusOK, response)
}

func (h *Handler) addToCart(c *gin.Context) {
	userID := middleware.AuthUserID(c)
	productID := c.Param("product_id")
	product, err := h.Repo.GetProductByID(c, productID)
	if err != nil || !productIsPubliclyAccessible(product.Status, product.Metadata) {
		c.JSON(http.StatusNotFound, gin.H{"error": "product not available"})
		return
	}
	if err := h.Repo.AddToCart(c, userID, productID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not add to cart"})
		return
	}
	c.Status(http.StatusCreated)
}

func (h *Handler) removeFromCart(c *gin.Context) {
	userID := middleware.AuthUserID(c)
	productID := c.Param("product_id")
	if err := h.Repo.RemoveFromCart(c, userID, productID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not remove from cart"})
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Handler) applyCouponToCart(c *gin.Context) {
	type request struct {
		Code      string `json:"code"`
		ProductID string `json:"product_id"`
	}
	var req request
	if err := c.ShouldBindJSON(&req); err != nil || req.Code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	req.Code = strings.ToUpper(strings.TrimSpace(req.Code))
	coupon, err := h.Repo.GetCouponByCode(c, req.Code)
	if err != nil || !coupon.IsActive {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid coupon"})
		return
	}
	if coupon.ExpiresAt != nil && coupon.ExpiresAt.Before(time.Now().UTC()) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "coupon expired"})
		return
	}
	if coupon.MaxUses != nil && coupon.UsesCount >= *coupon.MaxUses {
		c.JSON(http.StatusBadRequest, gin.H{"error": "coupon usage exceeded"})
		return
	}
	if coupon.ProductID != nil && req.ProductID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "product-specific coupon requires product_id"})
		return
	}
	if req.ProductID != "" {
		product, err := h.Repo.GetProductByID(c, req.ProductID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "product not found"})
			return
		}
		if coupon.ProductID != nil && *coupon.ProductID != product.ID {
			c.JSON(http.StatusBadRequest, gin.H{"error": "coupon not valid for this product"})
			return
		}
		if coupon.SellerID != nil && *coupon.SellerID != product.SellerID {
			c.JSON(http.StatusBadRequest, gin.H{"error": "coupon not valid for this seller"})
			return
		}
		discount := calcDiscount(coupon, product.Price)
		cartTotal := product.Price
		if err := h.Repo.ConsumeCoupon(c, coupon.ID); err != nil {
			c.JSON(http.StatusConflict, gin.H{"error": "coupon cannot be used right now"})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"product_id":  product.ID,
			"subtotal":    cartTotal,
			"discount":    discount,
			"final_total": roundTwoDecimals(maxFloat(cartTotal-discount, 0)),
			"coupon":      coupon.Code,
		})
		return
	}
	cart, err := h.Repo.ListCart(c, middleware.AuthUserID(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load cart"})
		return
	}
	if len(cart) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cart is empty"})
		return
	}
	var subtotal float64
	for _, item := range cart {
		p, err := h.Repo.GetProductByID(c, item.ProductID)
		if err != nil {
			continue
		}
		subtotal += p.Price
	}
	discount := calcDiscount(coupon, subtotal)
	if err := h.Repo.ConsumeCoupon(c, coupon.ID); err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "coupon cannot be used right now"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"subtotal":    subtotal,
		"discount":    discount,
		"final_total": roundTwoDecimals(maxFloat(subtotal-discount, 0)),
		"coupon":      coupon.Code,
	})
}

func maxFloat(left float64, right float64) float64 {
	if left > right {
		return left
	}
	return right
}

func calcDiscount(coupon models.Coupon, total float64) float64 {
	if coupon.DiscountType == "percentage" {
		return roundTwoDecimals(total * (coupon.DiscountValue / 100))
	}
	return roundTwoDecimals(coupon.DiscountValue)
}

func (h *Handler) listWishlist(c *gin.Context) {
	userID := middleware.AuthUserID(c)
	items, err := h.Repo.ListWishlist(c, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load wishlist"})
		return
	}
	c.JSON(http.StatusOK, items)
}

func (h *Handler) addToWishlist(c *gin.Context) {
	userID := middleware.AuthUserID(c)
	productID := c.Param("product_id")
	if err := h.Repo.AddToWishlist(c, userID, productID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not add to wishlist"})
		return
	}
	c.Status(http.StatusCreated)
}

func (h *Handler) removeFromWishlist(c *gin.Context) {
	userID := middleware.AuthUserID(c)
	productID := c.Param("product_id")
	if err := h.Repo.RemoveFromWishlist(c, userID, productID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not remove from wishlist"})
		return
	}
	c.Status(http.StatusNoContent)
}
