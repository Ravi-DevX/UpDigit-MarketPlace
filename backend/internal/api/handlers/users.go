package handlers

import (
	"bytes"
	"fmt"
	"net/http"
	"strings"
	"time"

	"marketplace/backend/internal/api/middleware"
	"marketplace/backend/internal/auth"
	"marketplace/backend/internal/repository"

	"github.com/gin-gonic/gin"
)

type updateMeRequest struct {
	Username   string  `json:"username" validate:"required,min=3,max=50"`
	Email      string  `json:"email" validate:"required,email"`
	Bio        *string `json:"bio"`
	WebsiteURL *string `json:"website_url"`
	DiscordTag *string `json:"discord_tag"`
}

type updatePasswordRequest struct {
	Password string `json:"password" validate:"required,min=8"`
}

func (h *Handler) RegisterUserRoutes(public, secure *gin.RouterGroup) {
	public.GET("/users/:username", h.getUserByUsername)
	public.GET("/users/:username/products", h.getUserProducts)

	secure.GET("/users/me", h.getMe)
	secure.PUT("/users/me", h.updateMe)
	secure.PUT("/users/me/avatar", h.uploadAvatar)
	secure.PUT("/users/me/banner", h.uploadProfileBanner)
	secure.PUT("/users/me/password", h.changePassword)
	secure.DELETE("/users/me", h.deleteMe)
}

func (h *Handler) getMe(c *gin.Context) {
	userID := middleware.AuthUserID(c)
	user, err := h.Repo.GetUserByID(c, userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	c.JSON(http.StatusOK, user)
}

func (h *Handler) updateMe(c *gin.Context) {
	userID := middleware.AuthUserID(c)
	var req updateMeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	if err := auth.ValidateTokenPayload(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	user, err := h.Repo.GetUserByID(c, userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	user.Username = req.Username
	user.Email = strings.ToLower(req.Email)
	user.Bio = req.Bio
	user.WebsiteURL = req.WebsiteURL
	user.DiscordTag = req.DiscordTag
	if err := h.Repo.UpdateUser(c, user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update profile"})
		return
	}
	c.JSON(http.StatusOK, user)
}

func (h *Handler) uploadAvatar(c *gin.Context) {
	publicURL, ok := h.uploadUserProfileImage(c, "avatar", 3*1024*1024, "avatars")
	if !ok {
		return
	}
	userID := middleware.AuthUserID(c)
	user, err := h.Repo.GetUserByID(c, userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	user.AvatarURL = &publicURL
	if err := h.Repo.UpdateUser(c, user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save avatar"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"avatar_url": publicURL})
}

func (h *Handler) uploadProfileBanner(c *gin.Context) {
	publicURL, ok := h.uploadUserProfileImage(c, "banner", 8*1024*1024, "profile-banners")
	if !ok {
		return
	}
	userID := middleware.AuthUserID(c)
	user, err := h.Repo.GetUserByID(c, userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	user.ProfileBannerURL = &publicURL
	if err := h.Repo.UpdateUser(c, user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save banner"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"profile_banner_url": publicURL})
}

func (h *Handler) uploadUserProfileImage(c *gin.Context, fieldName string, maxBytes int64, folder string) (string, bool) {
	userID := middleware.AuthUserID(c)
	fileHeader, err := c.FormFile(fieldName)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fieldName + " file required"})
		return "", false
	}
	if fileHeader.Size > maxBytes {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file too large"})
		return "", false
	}
	f, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid file"})
		return "", false
	}
	defer f.Close()

	mimeType, err := detectFileMagic(f)
	if err != nil || !isAllowedImageMime(mimeType) {
		c.JSON(http.StatusBadRequest, gin.H{"error": fieldName + " must be an image"})
		return "", false
	}

	maxDimension := 512
	if fieldName == "banner" {
		maxDimension = 2560
	}
	optimized, optimizedMIME, extension, err := optimizeProductImage(f, mimeType, maxDimension)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "could not process " + fieldName})
		return "", false
	}
	key := fmt.Sprintf("%s/%s-%d%s", folder, userID, time.Now().UnixNano(), extension)
	publicURL, err := h.Storage.Upload(c, key, bytes.NewReader(optimized), optimizedMIME, int64(len(optimized)))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "upload failed"})
		return "", false
	}
	return publicURL, true
}

func (h *Handler) changePassword(c *gin.Context) {
	userID := middleware.AuthUserID(c)
	var req struct {
		CurrentPassword string `json:"current_password" validate:"required,min=8"`
		NewPassword     string `json:"new_password" validate:"required,min=8"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	if err := auth.ValidateTokenPayload(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	user, err := h.Repo.GetUserByID(c, userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	if err := auth.CheckPassword(user.PasswordHash, req.CurrentPassword); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "current password incorrect"})
		return
	}
	newHash, err := auth.HashPassword(req.NewPassword)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not hash password"})
		return
	}
	if err := h.Repo.UpdatePassword(c, userID, newHash); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update password"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "password updated"})
}

func (h *Handler) deleteMe(c *gin.Context) {
	userID := middleware.AuthUserID(c)
	if err := h.Repo.DeleteUser(c, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not delete account"})
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Handler) getUserByUsername(c *gin.Context) {
	username := c.Param("username")
	user, err := h.Repo.GetUserByUsernameOrEmail(c, username)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	user.PasswordHash = ""
	c.JSON(http.StatusOK, user)
}

func (h *Handler) getUserProducts(c *gin.Context) {
	username := c.Param("username")
	user, err := h.Repo.GetUserByUsernameOrEmail(c, username)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	filter := repository.ListProductsFilter{
		Status:           "approved",
		Limit:            100,
		Offset:           0,
		Sort:             strings.TrimSpace(c.Query("sort")),
		DiscoverableOnly: true,
	}
	if filter.Sort == "" {
		filter.Sort = "newest"
	}
	if v := strings.TrimSpace(c.Query("page")); v != "" {
		var page int
		fmt.Sscanf(v, "%d", &page)
		if page > 1 {
			filter.Offset = (page - 1) * filter.Limit
		}
	}
	if v := strings.TrimSpace(c.Query("limit")); v != "" {
		var limit int
		fmt.Sscanf(v, "%d", &limit)
		if limit > 0 && limit <= 100 {
			filter.Limit = limit
		}
	}
	filter.Search = strings.TrimSpace(c.Query("search"))
	if filter.Search == "" {
		filter.Search = strings.TrimSpace(c.Query("q"))
	}
	if category := strings.TrimSpace(c.Query("category")); category != "" && category != "all" {
		if found, err := h.Repo.GetCategoryBySlug(c, category); err == nil {
			filter.CategoryID = &found.ID
		} else if found, err := h.Repo.GetCategory(c, category); err == nil {
			filter.CategoryID = &found.ID
		}
	}
	filter.SellerID = &user.ID
	products, total, err := h.Repo.ListProducts(c, filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load products"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"total": total, "products": products})
}

func imageExtFromMime(mimeType string) string {
	switch mimeType {
	case "image/png":
		return "png"
	case "image/jpeg":
		return "jpg"
	case "image/webp":
		return "webp"
	case "image/gif":
		return "gif"
	default:
		return "jpg"
	}
}
