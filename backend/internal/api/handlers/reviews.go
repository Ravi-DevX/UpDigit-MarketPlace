package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"marketplace/backend/internal/api/middleware"
	"marketplace/backend/internal/auth"
	"marketplace/backend/internal/models"
	"marketplace/backend/internal/repository"
)

type createReviewRequest struct {
	OrderID *string `json:"order_id"`
	Rating  int     `json:"rating" validate:"required,min=1,max=5"`
	Title   string  `json:"title"`
	Body    string  `json:"body" validate:"required,min=20,max=5000"`
}

func (h *Handler) RegisterReviewRoutes(public, authGroup *gin.RouterGroup) {
	public.GET("/products/:slug/reviews", h.listReviews)
	authGroup.GET("/products/:slug/entitlement", h.getProductEntitlement)
	authGroup.POST("/products/:slug/reviews", h.createReview)
	authGroup.PUT("/products/:slug/reviews/:rid", h.updateReview)
	authGroup.DELETE("/products/:slug/reviews/:rid", h.deleteReview)
	authGroup.POST("/products/:slug/reviews/:rid/reply", h.sellerReplyReview)
}

func (h *Handler) getProductEntitlement(c *gin.Context) {
	product, ok := h.getProductFromSlugParam(c, "slug")
	if !ok {
		return
	}
	entitlement, err := h.Repo.GetProductEntitlement(c, middleware.AuthUserID(c), product.ID)
	if err != nil {
		c.JSON(http.StatusOK, models.ProductEntitlement{})
		return
	}
	c.JSON(http.StatusOK, entitlement)
}

func (h *Handler) listReviews(c *gin.Context) {
	product, ok := h.getProductFromSlugParam(c, "slug")
	if !ok {
		return
	}
	reviews, err := h.Repo.ListReviews(c, product.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load reviews"})
		return
	}
	c.JSON(http.StatusOK, reviews)
}

func (h *Handler) createReview(c *gin.Context) {
	var req createReviewRequest
	if err := c.ShouldBindJSON(&req); err != nil || auth.ValidateTokenPayload(&req) != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	userID := middleware.AuthUserID(c)
	product, ok := h.getProductFromSlugParam(c, "slug")
	if !ok {
		return
	}
	req.Title = strings.TrimSpace(req.Title)
	req.Body = strings.TrimSpace(req.Body)
	if len(req.Body) < 20 || len(req.Body) > 5000 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "review must be between 20 and 5000 characters"})
		return
	}
	entitlement, err := h.Repo.GetProductEntitlement(c, userID, product.ID)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "purchase required to review this product"})
		return
	}
	if !entitlement.Downloaded {
		c.JSON(http.StatusForbidden, gin.H{"error": "download the product before posting a review"})
		return
	}
	if entitlement.Reviewed {
		c.JSON(http.StatusConflict, gin.H{"error": "you have already reviewed this product"})
		return
	}
	review := &models.Review{
		ProductID:          product.ID,
		UserID:             userID,
		OrderID:            &entitlement.OrderID,
		Rating:             req.Rating,
		Title:              &req.Title,
		Body:               &req.Body,
		IsVerifiedPurchase: true,
	}
	if req.OrderID != nil {
		if *req.OrderID != entitlement.OrderID {
			c.JSON(http.StatusBadRequest, gin.H{"error": "order does not match verified purchase"})
			return
		}
	}
	if err := h.Repo.CreateReview(c, review); err != nil {
		if err == repository.ErrConflict {
			c.JSON(http.StatusConflict, gin.H{"error": "you have already reviewed this product"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create review"})
		return
	}
	_ = h.Repo.RecalculateProductRating(c, review.ProductID)
	productRecord, err := h.Repo.GetProductByID(c, review.ProductID)
	if err == nil {
		h.enqueueWebhookEvent(c, productRecord.SellerID, "review", map[string]any{
			"review_id":  review.ID,
			"product_id": review.ProductID,
			"user_id":    review.UserID,
			"order_id":   review.OrderID,
			"rating":     review.Rating,
			"title":      review.Title,
			"body":       review.Body,
		})
	}
	c.JSON(http.StatusCreated, review)
}

func (h *Handler) updateReview(c *gin.Context) {
	var req createReviewRequest
	if err := c.ShouldBindJSON(&req); err != nil || auth.ValidateTokenPayload(&req) != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	product, ok := h.getProductFromSlugParam(c, "slug")
	if !ok {
		return
	}
	req.Title = strings.TrimSpace(req.Title)
	req.Body = strings.TrimSpace(req.Body)
	if len(req.Body) < 20 || len(req.Body) > 5000 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "review must be between 20 and 5000 characters"})
		return
	}
	userID := middleware.AuthUserID(c)
	review := models.Review{
		ID:        c.Param("rid"),
		ProductID: product.ID,
		UserID:    userID,
		Rating:    req.Rating,
		Title:     &req.Title,
		Body:      &req.Body,
	}
	if err := h.Repo.UpdateReview(c, review); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "review not found"})
		return
	}
	_ = h.Repo.RecalculateProductRating(c, review.ProductID)
	c.JSON(http.StatusOK, review)
}

func (h *Handler) deleteReview(c *gin.Context) {
	userID := middleware.AuthUserID(c)
	role := middleware.AuthRole(c)
	isAdmin := role == "admin"
	if err := h.Repo.DeleteReview(c, c.Param("rid"), userID, isAdmin); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "review not found"})
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Handler) sellerReplyReview(c *gin.Context) {
	reviewID := c.Param("rid")
	var payload struct {
		Reply string `json:"reply"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	// Seller auth is validated by route middleware.
	if strings.TrimSpace(payload.Reply) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "reply required"})
		return
	}
	sellerID := middleware.AuthUserID(c)
	reviewSellerID, err := h.Repo.GetReviewProductSeller(c, c.Param("rid"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "review not found"})
		return
	}
	if reviewSellerID != sellerID {
		c.JSON(http.StatusForbidden, gin.H{"error": "not authorized for this review"})
		return
	}
	if err := h.Repo.ReplyReview(c, reviewID, payload.Reply); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "review not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "reply recorded"})
}
