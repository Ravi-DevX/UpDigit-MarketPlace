package handlers

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"mime"
	"net/http"
	"net/url"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"marketplace/backend/internal/api/middleware"
	"marketplace/backend/internal/auth"
	"marketplace/backend/internal/models"
	"marketplace/backend/internal/repository"

	"github.com/gin-gonic/gin"
)

type productRequest struct {
	CategoryID        *string        `json:"category_id"`
	Title             string         `json:"title" validate:"required,min=3,max=200"`
	Slug              *string        `json:"slug"`
	ShortDescription  *string        `json:"short_description"`
	Description       string         `json:"description" validate:"required"`
	Price             float64        `json:"price" validate:"gte=0"`
	Status            string         `json:"status"`
	ThumbnailURL      *string        `json:"thumbnail_url"`
	BannerURL         *string        `json:"banner_url"`
	DemoURL           *string        `json:"demo_url"`
	SourceURL         *string        `json:"source_url"`
	Tags              []string       `json:"tags"`
	Version           *string        `json:"version"`
	SupportedVersions []string       `json:"supported_versions"`
	IsFeatured        bool           `json:"is_featured"`
	IsExclusive       bool           `json:"is_exclusive"`
	Metadata          map[string]any `json:"metadata"`
}

func (h *Handler) RegisterProductRoutes(public, protected *gin.RouterGroup) {
	public.GET("/products", h.listProducts)
	public.GET("/products/featured", h.getFeaturedProducts)
	public.GET("/products/bumped", h.getBumpedProducts)
	public.GET("/products/trending", h.getTrendingProducts)
	public.GET("/products/new", h.getNewProducts)
	public.GET("/products/free", h.getFreeProducts)
	public.GET("/products/:slug", h.getProductBySlug)
	public.GET("/products/:slug/media", h.listProductMedia)
	public.GET("/products/:slug/download", h.downloadFreeProduct)
	public.GET("/products/:slug/download/file", h.streamFreeProduct)

	protected.POST("/products", middleware.RequireAnyRole("seller", "admin"), h.createProduct)
	protected.PUT("/products/:slug", middleware.RequireAnyRole("seller", "admin"), h.updateProduct)
	protected.DELETE("/products/:slug", middleware.RequireAnyRole("seller", "admin"), h.deleteProduct)
	protected.POST("/products/:slug/bump", middleware.RequireAnyRole("seller", "admin"), h.bumpProduct)
	public.GET("/products/:slug/versions", h.listProductVersions)

	protected.POST("/products/:slug/versions", middleware.RequireAnyRole("seller", "admin"), h.addProductVersion)
	protected.GET("/products/:slug/versions/:vid/download", middleware.RequireAnyRole("seller", "admin"), h.downloadProductVersion)
	protected.DELETE("/products/:slug/versions/:vid", middleware.RequireAnyRole("seller", "admin"), h.deleteProductVersion)

	protected.POST("/products/:slug/media", middleware.RequireAnyRole("seller", "admin"), h.addProductMedia)
	protected.DELETE("/products/:slug/media/:mid", middleware.RequireAnyRole("seller", "admin"), h.deleteProductMedia)
	protected.GET("/products/:slug/owner-download", middleware.RequireAnyRole("seller", "admin"), h.streamOwnerProduct)
}

func (h *Handler) RegisterSearchRoutes(router *gin.RouterGroup) {
	router.GET("/search", h.searchProducts)
	router.GET("/search/suggestions", h.searchSuggestions)
}

func (h *Handler) searchProducts(c *gin.Context) {
	filter := repository.ListProductsFilter{
		Limit:            24,
		Offset:           0,
		Status:           "approved",
		Sort:             strings.TrimSpace(c.Query("sort")),
		DiscoverableOnly: true,
	}
	if c.Query("page") != "" {
		var page int
		_, _ = fmt.Sscanf(c.Query("page"), "%d", &page)
		if page > 1 {
			filter.Offset = (page - 1) * filter.Limit
		}
	}
	if c.Query("limit") != "" {
		var limit int
		_, _ = fmt.Sscanf(c.Query("limit"), "%d", &limit)
		if limit > 0 && limit <= 100 {
			filter.Limit = limit
		}
	}
	filter.Search = strings.TrimSpace(c.Query("q"))
	if category := strings.TrimSpace(c.Query("category")); category != "" {
		h.applyProductCategoryFilter(c, &filter, category)
	}
	if min := strings.TrimSpace(c.Query("price_min")); min != "" {
		var minPrice float64
		_, _ = fmt.Sscanf(min, "%f", &minPrice)
		filter.MinPrice = &minPrice
	}
	if max := strings.TrimSpace(c.Query("price_max")); max != "" {
		var maxPrice float64
		_, _ = fmt.Sscanf(max, "%f", &maxPrice)
		filter.MaxPrice = &maxPrice
	}
	if filter.Sort == "" {
		filter.Sort = "newest"
	}
	products, total, err := h.Repo.ListProducts(c, filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not run search"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"total":    total,
		"products": products,
	})
}

func (h *Handler) searchSuggestions(c *gin.Context) {
	query := strings.TrimSpace(c.Query("q"))
	if query == "" {
		c.JSON(http.StatusOK, gin.H{"items": []string{}})
		return
	}
	filter := repository.ListProductsFilter{
		Status:           "approved",
		Limit:            10,
		Sort:             "newest",
		Search:           query,
		DiscoverableOnly: true,
	}
	products, _, err := h.Repo.ListProducts(c, filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load suggestions"})
		return
	}
	items := make([]string, 0, minInt(len(products), 10))
	for _, p := range products {
		items = append(items, p.Title)
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

func (h *Handler) listProducts(c *gin.Context) {
	filter := repository.ListProductsFilter{
		Limit:            24,
		Offset:           0,
		Sort:             c.Query("sort"),
		Status:           "approved",
		DiscoverableOnly: true,
	}
	if v := strings.TrimSpace(c.Query("page")); v != "" {
		var page int
		fmt.Sscanf(v, "%d", &page)
		if page > 1 {
			filter.Offset = (page - 1) * filter.Limit
		}
	}
	if v := strings.TrimSpace(c.Query("limit")); v != "" {
		var lim int
		fmt.Sscanf(v, "%d", &lim)
		if lim > 0 && lim <= 100 {
			filter.Limit = lim
		}
	}
	if cat := strings.TrimSpace(c.Query("category")); cat != "" {
		h.applyProductCategoryFilter(c, &filter, cat)
	}
	filter.Search = strings.TrimSpace(c.Query("search"))
	if min := strings.TrimSpace(c.Query("price_min")); min != "" {
		var p float64
		_, err := fmt.Sscanf(min, "%f", &p)
		if err == nil {
			filter.MinPrice = &p
		}
	}
	if max := strings.TrimSpace(c.Query("price_max")); max != "" {
		var p float64
		_, err := fmt.Sscanf(max, "%f", &p)
		if err == nil {
			filter.MaxPrice = &p
		}
	}
	if filter.Sort == "" {
		filter.Sort = "newest"
	}
	products, total, err := h.Repo.ListProducts(c, filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load products"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"total":    total,
		"products": products,
	})
}

func (h *Handler) applyProductCategoryFilter(c *gin.Context, filter *repository.ListProductsFilter, value string) {
	category := strings.TrimSpace(value)
	if category == "" {
		return
	}

	if record, err := h.Repo.GetCategoryBySlug(c, category); err == nil {
		if ids, err := h.Repo.GetCategoryDescendantIDs(c, record.ID); err == nil && len(ids) > 0 {
			filter.CategoryIDs = ids
			return
		}
		filter.CategoryIDs = []string{record.ID}
		return
	}

	if ids, err := h.Repo.GetCategoryDescendantIDs(c, category); err == nil && len(ids) > 0 {
		filter.CategoryIDs = ids
		return
	}

	filter.CategoryID = &category
}

func (h *Handler) getFeaturedProducts(c *gin.Context) {
	filter := repository.ListProductsFilter{
		Status:           "approved",
		Limit:            12,
		Sort:             "newest",
		DiscoverableOnly: true,
	}
	products, total, err := h.Repo.ListProducts(c, filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load featured products"})
		return
	}
	var featured []models.Product
	for _, p := range products {
		if p.IsFeatured {
			featured = append(featured, p)
		}
	}
	c.JSON(http.StatusOK, gin.H{"total": total, "products": featured})
}

func (h *Handler) getBumpedProducts(c *gin.Context) {
	filter := repository.ListProductsFilter{
		Status:           "approved",
		Limit:            50,
		Sort:             "newest",
		DiscoverableOnly: true,
	}
	products, total, err := h.Repo.ListProducts(c, filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load bumped products"})
		return
	}
	bumped := make([]models.Product, 0, len(products))
	for _, product := range products {
		if product.BumpExpiresAt != nil {
			bumped = append(bumped, product)
		}
	}
	c.JSON(http.StatusOK, gin.H{"total": total, "products": bumped})
}

func (h *Handler) getTrendingProducts(c *gin.Context) {
	filter := repository.ListProductsFilter{
		Status:           "approved",
		Limit:            12,
		Sort:             "downloaded",
		DiscoverableOnly: true,
	}
	products, total, err := h.Repo.ListProducts(c, filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load trending products"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"total": total, "products": products})
}

func (h *Handler) getNewProducts(c *gin.Context) {
	filter := repository.ListProductsFilter{
		Status:           "approved",
		Limit:            12,
		Sort:             "newest",
		DiscoverableOnly: true,
	}
	products, total, err := h.Repo.ListProducts(c, filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load new products"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"total": total, "products": products})
}

func (h *Handler) getFreeProducts(c *gin.Context) {
	free := 0.0
	filter := repository.ListProductsFilter{
		Status:           "approved",
		Limit:            12,
		Sort:             "newest",
		MaxPrice:         &free,
		DiscoverableOnly: true,
	}
	products, total, err := h.Repo.ListProducts(c, filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load free products"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"total": total, "products": products})
}

func (h *Handler) getProductBySlug(c *gin.Context) {
	slug := c.Param("slug")
	product, err := h.Repo.GetProductBySlug(c, slug)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "product not found"})
		return
	}
	if !productIsPubliclyAccessible(product.Status, product.Metadata) {
		c.JSON(http.StatusNotFound, gin.H{"error": "product not found"})
		return
	}
	product.Description = sanitizeDescription(product.Description)
	h.enrichProductDetail(c, &product)
	c.JSON(http.StatusOK, product)
}

func (h *Handler) enrichProductDetail(c *gin.Context, product *models.Product) {
	if user, err := h.Repo.GetUserByID(c, product.SellerID); err == nil {
		seller := &models.ProductSeller{
			ID:          user.ID,
			Username:    user.Username,
			DisplayName: user.DisplayName,
			AvatarURL:   user.AvatarURL,
		}
		if profile, err := h.Repo.GetSellerProfileByUserID(c, user.ID); err == nil {
			seller.SellerProfile = &profile
		}
		product.Seller = seller
	}
	if product.CategoryID != nil {
		if category, err := h.Repo.GetCategory(c, *product.CategoryID); err == nil {
			product.Category = &category
		}
	}
}

func (h *Handler) validateProductCategoryPrice(c *gin.Context, categoryID *string, price float64) bool {
	if categoryID == nil || strings.TrimSpace(*categoryID) == "" {
		return true
	}
	category, err := h.Repo.GetCategory(c, *categoryID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid category"})
		return false
	}
	if price > 0 && category.MinimumPrice > 0 && price < category.MinimumPrice {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":         fmt.Sprintf("minimum paid price for %s is $%.2f", category.Name, category.MinimumPrice),
			"minimum_price": category.MinimumPrice,
		})
		return false
	}
	return true
}

func (h *Handler) createProduct(c *gin.Context) {
	var req productRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	if err := auth.ValidateTokenPayload(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	sellerID := middleware.AuthUserID(c)
	if !h.validateProductCategoryPrice(c, req.CategoryID, req.Price) {
		return
	}
	raw := strings.TrimSpace(req.Description)
	sanitized := sanitizeDescription(raw)
	if sanitized == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "description required"})
		return
	}
	publicID, err := h.Repo.NextProductPublicID(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "product ID generation failed"})
		return
	}
	slugBase := normalizeProductSlug(req.Title)
	if req.Slug != nil && strings.TrimSpace(*req.Slug) != "" {
		slugBase = normalizeProductSlug(*req.Slug)
		if slugBase == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid slug"})
			return
		}
	}
	role := middleware.AuthRole(c)
	status := "draft"
	if role == "admin" {
		status = normalizedProductStatus(req.Status, "draft")
	} else if req.Status == "pending" {
		status = "pending"
	}
	product := &models.Product{
		PublicID:          publicID,
		SellerID:          sellerID,
		CategoryID:        req.CategoryID,
		Title:             req.Title,
		Slug:              canonicalProductSlug(slugBase, publicID),
		ShortDescription:  req.ShortDescription,
		Description:       sanitized,
		Price:             req.Price,
		Status:            status,
		ThumbnailURL:      req.ThumbnailURL,
		BannerURL:         req.BannerURL,
		DemoURL:           req.DemoURL,
		SourceURL:         req.SourceURL,
		Tags:              req.Tags,
		Version:           req.Version,
		SupportedVersions: req.SupportedVersions,
		IsFeatured:        req.IsFeatured,
		IsExclusive:       req.IsExclusive,
		Metadata:          productMetadataWithReserved(req.Metadata, nil),
	}
	if err := h.Repo.CreateProduct(c, product, sellerID); err != nil {
		if err == repository.ErrConflict {
			c.JSON(http.StatusConflict, gin.H{"error": "slug exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create product"})
		return
	}
	c.JSON(http.StatusCreated, product)
}

func (h *Handler) updateProduct(c *gin.Context) {
	productRecord, ok := h.getProductFromSlugParam(c, "slug")
	if !ok {
		return
	}
	var req productRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	if err := auth.ValidateTokenPayload(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if !h.validateProductCategoryPrice(c, req.CategoryID, req.Price) {
		return
	}
	role := middleware.AuthRole(c)
	existingMetadata := productRecord.Metadata
	if !moneyEqual(req.Price, productRecord.Price) {
		existingMetadata = nil
	}
	product := models.Product{
		ID:                productRecord.ID,
		PublicID:          productRecord.PublicID,
		CategoryID:        req.CategoryID,
		Title:             req.Title,
		Slug:              canonicalProductSlug(normalizeProductSlug(req.Title), productRecord.PublicID),
		ShortDescription:  req.ShortDescription,
		Description:       sanitizeDescription(req.Description),
		Price:             req.Price,
		Status:            resolvedProductStatus(productRecord.Status, req.Status, role),
		ThumbnailURL:      req.ThumbnailURL,
		BannerURL:         req.BannerURL,
		DemoURL:           req.DemoURL,
		SourceURL:         req.SourceURL,
		Tags:              req.Tags,
		Version:           req.Version,
		SupportedVersions: req.SupportedVersions,
		IsFeatured:        req.IsFeatured,
		IsExclusive:       req.IsExclusive,
		Metadata:          productMetadataWithReserved(req.Metadata, existingMetadata),
	}
	if req.Slug != nil && strings.TrimSpace(*req.Slug) != "" {
		product.Slug = canonicalProductSlug(normalizeProductSlug(*req.Slug), productRecord.PublicID)
	}
	if product.Slug == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid slug"})
		return
	}
	if err := h.Repo.UpdateProduct(c, product, role, middleware.AuthUserID(c)); err != nil {
		if err == repository.ErrConflict {
			c.JSON(http.StatusConflict, gin.H{"error": "slug exists"})
			return
		}
		if err == repository.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "product not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update product"})
		return
	}
	c.JSON(http.StatusOK, product)
}

func productMetadataWithReserved(requested, existing map[string]any) map[string]any {
	metadata := make(map[string]any, len(requested)+1)
	for key, value := range requested {
		if key != "tebex_package_id" {
			metadata[key] = value
		}
	}
	if packageID, ok := existing["tebex_package_id"]; ok {
		metadata["tebex_package_id"] = packageID
	}
	return metadata
}

func normalizedProductStatus(requested, fallback string) string {
	switch requested {
	case "draft", "pending", "approved", "rejected":
		return requested
	default:
		return fallback
	}
}

func resolvedProductStatus(current, requested, role string) string {
	current = normalizedProductStatus(current, "draft")
	if role == "admin" {
		return normalizedProductStatus(requested, current)
	}
	if current == "approved" || current == "pending" {
		return current
	}
	if requested == "pending" {
		return "pending"
	}
	return current
}

func (h *Handler) deleteProduct(c *gin.Context) {
	product, ok := h.getProductFromSlugParam(c, "slug")
	if !ok {
		return
	}
	role := middleware.AuthRole(c)
	userID := middleware.AuthUserID(c)
	if err := h.Repo.DeleteProduct(c, product.ID, role, userID); err != nil {
		if err == repository.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "product not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not delete product"})
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Handler) bumpProduct(c *gin.Context) {
	product, ok := h.getProductFromSlugParam(c, "slug")
	if !ok {
		return
	}
	expires := time.Now().UTC().Add(24 * time.Hour)
	err := h.Repo.BumpProduct(c, product.ID, expires)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not bump product"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"bump_expires_at": expires})
}

func (h *Handler) listProductVersions(c *gin.Context) {
	product, ok := h.getProductFromSlugParam(c, "slug")
	if !ok {
		return
	}
	versions, err := h.Repo.ListProductVersions(c, product.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load versions"})
		return
	}
	for index := range versions {
		if versions[index].Changelog != nil {
			sanitized := sanitizeDescription(*versions[index].Changelog)
			versions[index].Changelog = &sanitized
		}
	}
	c.JSON(http.StatusOK, versions)
}

func (h *Handler) addProductVersion(c *gin.Context) {
	product, ok := h.getProductFromSlugParam(c, "slug")
	if !ok {
		return
	}
	if !h.ensureCanManageProduct(c, product.ID) {
		return
	}
	versionTag := c.PostForm("version_tag")
	updateTitle := strings.TrimSpace(c.PostForm("update_title"))
	changelog := sanitizeDescription(c.PostForm("changelog"))
	postUpdate := true
	if rawPostUpdate := strings.TrimSpace(c.PostForm("post_update")); rawPostUpdate != "" {
		parsed, err := strconv.ParseBool(rawPostUpdate)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid post_update value"})
			return
		}
		postUpdate = parsed
	}
	if strings.TrimSpace(versionTag) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "version_tag required"})
		return
	}
	if len([]rune(updateTitle)) > 100 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "update title must be 100 characters or fewer"})
		return
	}
	if postUpdate && updateTitle == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "update title required when posting an update"})
		return
	}
	if !postUpdate {
		updateTitle = ""
		changelog = ""
	}
	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file required"})
		return
	}
	if fileHeader.Size > 2*1024*1024*1024 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file too large"})
		return
	}
	f, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid file"})
		return
	}
	defer f.Close()
	mimeType, err := detectFileMagic(f)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid file"})
		return
	}
	if !isAllowedArtifactMime(mimeType) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported file type"})
		return
	}
	if _, err := f.Seek(0, io.SeekStart); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid file"})
		return
	}
	hash := sha256.New()
	if _, err := io.CopyN(hash, f, fileHeader.Size); err != nil && err != io.EOF {
		c.JSON(http.StatusBadRequest, gin.H{"error": "could not checksum file"})
		return
	}
	sum := hex.EncodeToString(hash.Sum(nil))
	if _, err := f.Seek(0, io.SeekStart); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid file"})
		return
	}
	seqID := time.Now().UnixNano()
	key := fmt.Sprintf("products/%s/versions/%s-%d", product.ID, versionTag, seqID)
	publicURL, err := h.Storage.Upload(c, key, f, mimeType, fileHeader.Size)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "upload failed"})
		return
	}
	v := &models.ProductVersion{
		ProductID:      product.ID,
		VersionTag:     versionTag,
		UpdateTitle:    nil,
		Changelog:      &changelog,
		FileKey:        key,
		FileName:       fileHeader.Filename,
		FileSize:       &fileHeader.Size,
		FileChecksum:   &sum,
		IsLatest:       true,
		IsUpdatePosted: postUpdate,
	}
	if updateTitle != "" {
		v.UpdateTitle = &updateTitle
	}
	if err := h.Repo.CreateProductVersion(c, v); err != nil {
		_ = h.Storage.Delete(c, key)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not save version"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"version": v, "url": publicURL})
}

func (h *Handler) downloadProductVersion(c *gin.Context) {
	product, ok := h.getProductFromSlugParam(c, "slug")
	if !ok {
		return
	}
	if !h.ensureCanManageProduct(c, product.ID) {
		return
	}
	key, fileName, _, err := h.Repo.GetProductVersionArtifactForProduct(c, product.ID, c.Param("vid"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "version not found"})
		return
	}
	h.streamArtifact(c, key, fileName, product.ID)
}

func (h *Handler) deleteProductVersion(c *gin.Context) {
	product, ok := h.getProductFromSlugParam(c, "slug")
	if !ok {
		return
	}
	versionID := c.Param("vid")
	if !h.ensureCanManageProduct(c, product.ID) {
		return
	}
	key, _, isLatest, err := h.Repo.GetProductVersionArtifactForProduct(c, product.ID, versionID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "version not found"})
		return
	}
	if isLatest {
		c.JSON(http.StatusConflict, gin.H{"error": "latest version cannot be deleted"})
		return
	}
	if err := h.Storage.Delete(c, key); err != nil {
		h.Logger.Error().Err(err).Str("product_id", product.ID).Str("version_id", versionID).Msg("version artifact delete failed")
		c.JSON(http.StatusBadGateway, gin.H{"error": "could not delete version file"})
		return
	}
	if err := h.Repo.DeleteProductVersion(c, product.ID, versionID); err != nil {
		if err == repository.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "version not found"})
			return
		}
		h.Logger.Error().Err(err).Str("product_id", product.ID).Str("version_id", versionID).Msg("version database delete failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "version file deleted but history cleanup failed"})
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Handler) addProductMedia(c *gin.Context) {
	product, ok := h.getProductFromSlugParam(c, "slug")
	if !ok {
		return
	}
	if !h.ensureCanManageProduct(c, product.ID) {
		return
	}
	fileHeader, err := c.FormFile("media")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "media file required"})
		return
	}
	if fileHeader.Size > 10*1024*1024 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "media file too large"})
		return
	}
	mediaType := strings.TrimSpace(strings.ToLower(c.PostForm("media_type")))
	allowedMediaTypes := map[string]bool{"cover": true, "gallery": true, "description": true, "image": true}
	if !allowedMediaTypes[mediaType] {
		mediaType = "image"
	}
	if mediaType == "gallery" {
		count, err := h.Repo.CountProductMediaByType(c, product.ID, "gallery")
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not check gallery"})
			return
		}
		if count >= 15 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "gallery supports up to 15 images"})
			return
		}
	}
	f, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid media"})
		return
	}
	defer f.Close()
	mimeType, err := detectFileMagic(f)
	if err != nil || !isAllowedImageMime(mimeType) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid media type"})
		return
	}
	maxDimension := 2560
	if mediaType == "description" {
		maxDimension = 1920
	}
	optimized, optimizedMIME, extension, err := optimizeProductImage(f, mimeType, maxDimension)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "could not process media"})
		return
	}
	key := fmt.Sprintf("products/%s/media/%d%s", product.ID, time.Now().UnixNano(), extension)
	publicURL, err := h.Storage.Upload(c, key, bytes.NewReader(optimized), optimizedMIME, int64(len(optimized)))
	if err != nil {
		h.Logger.Error().Err(err).Str("product_id", product.ID).Str("content_type", optimizedMIME).Msg("product media upload failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "upload failed"})
		return
	}
	media := &models.ProductMedia{
		ProductID: product.ID,
		MediaURL:  publicURL,
		MediaType: mediaType,
		SortOrder: 0,
	}
	if err := h.Repo.AddProductMedia(c, media); err != nil {
		h.Logger.Error().Err(err).Str("product_id", product.ID).Msg("product media database insert failed")
		_ = h.Storage.Delete(c, key)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save media"})
		return
	}
	c.JSON(http.StatusCreated, media)
}

func (h *Handler) listProductMedia(c *gin.Context) {
	product, ok := h.getProductFromSlugParam(c, "slug")
	if !ok {
		return
	}
	media, err := h.Repo.ListProductMedia(c, product.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load product media"})
		return
	}
	c.JSON(http.StatusOK, media)
}

func (h *Handler) deleteProductMedia(c *gin.Context) {
	product, ok := h.getProductFromSlugParam(c, "slug")
	if !ok {
		return
	}
	if !h.ensureCanManageProduct(c, product.ID) {
		return
	}
	if err := h.Repo.DeleteProductMedia(c, product.ID, c.Param("mid")); err == repository.ErrNotFound {
		c.JSON(http.StatusNotFound, gin.H{"error": "media not found"})
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Handler) downloadFreeProduct(c *gin.Context) {
	product, ok := h.getProductFromSlugParam(c, "slug")
	if !ok {
		return
	}
	if !productIsPubliclyAccessible(product.Status, product.Metadata) {
		c.JSON(http.StatusNotFound, gin.H{"error": "product not available"})
		return
	}
	if product.Price > 0 {
		c.JSON(http.StatusPaymentRequired, gin.H{"error": "license purchase required"})
		return
	}
	versionID, err := h.Repo.GetLatestProductVersionID(c, product.ID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no product version available"})
		return
	}
	_, _, err = h.Repo.GetProductVersionArtifact(c, versionID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "download artifact not found"})
		return
	}
	downloadURL := strings.TrimSuffix(h.Config.BackendURL, "/") + "/api/v1/products/" + url.PathEscape(product.Slug) + "/download/file"
	c.JSON(http.StatusOK, gin.H{
		"download_url": downloadURL,
		"expires_at":   time.Now().UTC().Add(15 * time.Minute),
	})
}

func (h *Handler) streamFreeProduct(c *gin.Context) {
	product, ok := h.getProductFromSlugParam(c, "slug")
	if !ok {
		return
	}
	if !productIsPubliclyAccessible(product.Status, product.Metadata) || product.Price > 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "product not available"})
		return
	}
	versionID, err := h.Repo.GetLatestProductVersionID(c, product.ID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "no product version available"})
		return
	}
	key, fileName, err := h.Repo.GetProductVersionArtifact(c, versionID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "download artifact not found"})
		return
	}
	if !h.streamArtifact(c, key, fileName, product.ID) {
		return
	}
	_ = h.Repo.IncrementProductDownloads(c, product.ID)
	_ = h.Repo.IncrementProductVersionDownloads(c, versionID)
}

func (h *Handler) streamOwnerProduct(c *gin.Context) {
	product, ok := h.getProductFromSlugParam(c, "slug")
	if !ok {
		return
	}
	if !h.ensureCanManageProduct(c, product.ID) {
		return
	}
	versionID, err := h.Repo.GetLatestProductVersionID(c, product.ID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "no product version available"})
		return
	}
	key, fileName, err := h.Repo.GetProductVersionArtifact(c, versionID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "download artifact not found"})
		return
	}
	h.streamArtifact(c, key, fileName, product.ID)
}

func (h *Handler) streamArtifact(c *gin.Context, key, fileName, productID string) bool {
	artifactURL, err := h.Storage.GetSignedURL(c, key, 15*time.Minute)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not prepare download"})
		return false
	}
	req, err := http.NewRequestWithContext(c, http.MethodGet, artifactURL, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not prepare download"})
		return false
	}
	response, err := http.DefaultClient.Do(req)
	if err != nil {
		h.Logger.Error().Err(err).Str("product_id", productID).Msg("artifact download failed")
		c.JSON(http.StatusBadGateway, gin.H{"error": "artifact storage unavailable"})
		return false
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		h.Logger.Error().Int("status", response.StatusCode).Str("product_id", productID).Msg("artifact storage rejected download")
		c.JSON(http.StatusBadGateway, gin.H{"error": "artifact storage rejected download"})
		return false
	}
	disposition := mime.FormatMediaType("attachment", map[string]string{"filename": fileName})
	c.Header("Content-Disposition", disposition)
	contentType := mime.TypeByExtension(strings.ToLower(filepath.Ext(fileName)))
	if strings.EqualFold(filepath.Ext(fileName), ".jar") {
		contentType = "application/java-archive"
	}
	if contentType == "" {
		contentType = response.Header.Get("Content-Type")
	}
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	c.Header("Content-Type", contentType)
	if response.ContentLength >= 0 {
		c.Header("Content-Length", fmt.Sprintf("%d", response.ContentLength))
	}
	c.Status(http.StatusOK)
	if _, err := io.Copy(c.Writer, response.Body); err != nil {
		h.Logger.Warn().Err(err).Str("product_id", productID).Msg("artifact response interrupted")
		return false
	}
	return true
}

func (h *Handler) ensureCanManageProduct(c *gin.Context, productID string) bool {
	if middleware.AuthRole(c) == "admin" {
		return true
	}
	if err := h.Repo.EnsureSellerOwnsProduct(c, middleware.AuthUserID(c), productID); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "not authorized for this product"})
		return false
	}
	return true
}

func (h *Handler) getProductFromSlugParam(c *gin.Context, paramName string) (*models.Product, bool) {
	slug := c.Param(paramName)
	product, err := h.Repo.GetProductBySlug(c, slug)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "product not found"})
		return nil, false
	}
	return &product, true
}

func normalizeProductSlug(value string) string {
	var builder strings.Builder
	lastWasDash := false
	for _, r := range strings.ToLower(strings.TrimSpace(value)) {
		switch {
		case r >= 'a' && r <= 'z':
			builder.WriteRune(r)
			lastWasDash = false
		case r >= '0' && r <= '9':
			builder.WriteRune(r)
			lastWasDash = false
		default:
			if builder.Len() > 0 && !lastWasDash {
				builder.WriteByte('-')
				lastWasDash = true
			}
		}
	}
	slug := strings.Trim(builder.String(), "-")
	if len(slug) > 64 {
		slug = strings.Trim(slug[:64], "-")
	}
	return slug
}

func canonicalProductSlug(base string, publicID int64) string {
	base = normalizeProductSlug(base)
	if base == "" {
		base = "product"
	}
	suffix := fmt.Sprintf("-%d", publicID)
	base = strings.TrimSuffix(base, suffix)
	base = strings.Trim(base, "-")
	if base == "" {
		base = "product"
	}
	return base + suffix
}
