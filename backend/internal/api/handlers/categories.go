package handlers

import (
	"net/http"
	"strings"

	"marketplace/backend/internal/models"

	"github.com/gin-gonic/gin"
)

type categoryRequest struct {
	ParentID         *string        `json:"parent_id"`
	Name             string         `json:"name" validate:"required,min=2,max=100"`
	Slug             string         `json:"slug" validate:"required,min=2,max=100"`
	Description      *string        `json:"description"`
	IconURL          *string        `json:"icon_url"`
	SortOrder        int            `json:"sort_order"`
	IsActive         bool           `json:"is_active"`
	MinimumPrice     float64        `json:"minimum_price"`
	PublishingConfig map[string]any `json:"publishing_config"`
}

func (h *Handler) RegisterCategoryRoutes(public, admin *gin.RouterGroup) {
	public.GET("/categories", h.listCategories)
	public.GET("/categories/:slug", h.getCategoryBySlug)
	admin.POST("/categories", h.createCategory)
	admin.PUT("/categories/:id", h.updateCategory)
	admin.DELETE("/categories/:id", h.deleteCategory)
}

func (h *Handler) listCategories(c *gin.Context) {
	categories, err := h.Repo.ListCategoriesTree(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load categories"})
		return
	}
	c.JSON(http.StatusOK, categories)
}

func (h *Handler) getCategoryBySlug(c *gin.Context) {
	category, err := h.Repo.GetCategoryBySlug(c, c.Param("slug"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "category not found"})
		return
	}
	c.JSON(http.StatusOK, category)
}

func (h *Handler) createCategory(c *gin.Context) {
	var req categoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	if req.MinimumPrice < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "minimum price cannot be negative"})
		return
	}
	if req.PublishingConfig == nil {
		req.PublishingConfig = map[string]any{}
	}
	req.Slug = strings.TrimSpace(strings.ToLower(req.Slug))
	cat := &models.Category{
		ParentID:         req.ParentID,
		Name:             strings.TrimSpace(req.Name),
		Slug:             req.Slug,
		Description:      req.Description,
		IconURL:          req.IconURL,
		SortOrder:        req.SortOrder,
		IsActive:         req.IsActive,
		MinimumPrice:     req.MinimumPrice,
		PublishingConfig: req.PublishingConfig,
	}
	if err := h.Repo.CreateCategory(c, cat); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create category"})
		return
	}
	c.JSON(http.StatusCreated, cat)
}

func (h *Handler) updateCategory(c *gin.Context) {
	var req categoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	if req.MinimumPrice < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "minimum price cannot be negative"})
		return
	}
	if req.PublishingConfig == nil {
		req.PublishingConfig = map[string]any{}
	}
	categoryID := c.Param("id")
	_, err := h.Repo.GetCategory(c, categoryID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "category not found"})
		return
	}
	cat := models.Category{
		ID:               categoryID,
		ParentID:         req.ParentID,
		Name:             req.Name,
		Slug:             strings.ToLower(req.Slug),
		Description:      req.Description,
		IconURL:          req.IconURL,
		SortOrder:        req.SortOrder,
		IsActive:         req.IsActive,
		MinimumPrice:     req.MinimumPrice,
		PublishingConfig: req.PublishingConfig,
	}
	if err := h.Repo.UpdateCategory(c, cat); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update category"})
		return
	}
	c.JSON(http.StatusOK, cat)
}

func (h *Handler) deleteCategory(c *gin.Context) {
	if err := h.Repo.DeleteCategory(c, c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not delete category"})
		return
	}
	c.Status(http.StatusNoContent)
}
