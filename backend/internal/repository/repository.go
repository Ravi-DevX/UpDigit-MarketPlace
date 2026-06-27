package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"marketplace/backend/internal/models"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNotFound    = errors.New("not found")
	ErrNoRows      = errors.New("no rows")
	ErrConflict    = errors.New("resource conflict")
	ErrUnavailable = errors.New("unavailable")
)

type Repo struct {
	pool *pgxpool.Pool
}

func NewRepo(pool *pgxpool.Pool) *Repo {
	return &Repo{pool: pool}
}

func isUniqueViolation(err error) bool {
	return err != nil && strings.Contains(err.Error(), "duplicate key")
}

type ListProductsFilter struct {
	CategoryID       *string
	CategoryIDs      []string
	SellerID         *string
	Search           string
	Limit            int
	Offset           int
	Sort             string
	Status           string
	MinPrice         *float64
	MaxPrice         *float64
	DiscoverableOnly bool
}

func (r *Repo) CreateUser(ctx context.Context, u *models.User) error {
	q := `
		INSERT INTO users (username, email, password_hash, role)
		VALUES ($1, $2, $3, COALESCE(NULLIF($4, ''), 'buyer'))
		RETURNING id, created_at, updated_at
	`
	row := r.pool.QueryRow(ctx, q, u.Username, u.Email, u.PasswordHash, u.Role)
	if err := row.Scan(&u.ID, &u.CreatedAt, &u.UpdatedAt); err != nil {
		if strings.Contains(err.Error(), "duplicate key") {
			return ErrConflict
		}
		return err
	}
	return nil
}

func (r *Repo) GetUserByUsername(ctx context.Context, username string) (models.User, error) {
	var u models.User
	err := r.pool.QueryRow(ctx, `
		SELECT id, COALESCE(external_id, ''), username, display_name, email, password_hash, role, is_verified, is_banned,
		       avatar_url, profile_banner_url, bio, website_url, discord_tag, balance, created_at, updated_at
		FROM users
		WHERE username = $1
	`, username).Scan(
		&u.ID, &u.ExternalID, &u.Username, &u.DisplayName, &u.Email, &u.PasswordHash, &u.Role, &u.IsVerified, &u.IsBanned,
		&u.AvatarURL, &u.ProfileBannerURL, &u.Bio, &u.WebsiteURL, &u.DiscordTag, &u.Balance, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		return u, ErrNotFound
	}
	return u, nil
}

func (r *Repo) GetUserByUsernameOrEmail(ctx context.Context, identifier string) (models.User, error) {
	q := `
		SELECT u.id, COALESCE(u.external_id, ''), u.username, u.display_name, u.email, u.password_hash, u.role, u.is_verified, u.is_banned,
		       u.avatar_url, u.profile_banner_url, u.bio, u.website_url, u.discord_tag, u.balance, u.created_at, u.updated_at
		FROM users u
		LEFT JOIN seller_profiles sp ON sp.user_id=u.id
		WHERE u.username = $1 OR u.email = $1 OR sp.shop_slug = $1
		ORDER BY CASE WHEN u.username = $1 THEN 0 WHEN sp.shop_slug = $1 THEN 1 ELSE 2 END
		LIMIT 1
	`
	var u models.User
	err := r.pool.QueryRow(ctx, q, identifier).Scan(
		&u.ID, &u.ExternalID, &u.Username, &u.DisplayName, &u.Email, &u.PasswordHash, &u.Role, &u.IsVerified, &u.IsBanned,
		&u.AvatarURL, &u.ProfileBannerURL, &u.Bio, &u.WebsiteURL, &u.DiscordTag, &u.Balance, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		return u, ErrNotFound
	}
	return u, nil
}

func (r *Repo) GetUserByID(ctx context.Context, id string) (models.User, error) {
	q := `
		SELECT id, COALESCE(external_id, ''), username, display_name, email, password_hash, role, is_verified, is_banned,
		       avatar_url, profile_banner_url, bio, website_url, discord_tag, balance, created_at, updated_at
		FROM users
		WHERE id = $1
	`
	var u models.User
	err := r.pool.QueryRow(ctx, q, id).Scan(
		&u.ID, &u.ExternalID, &u.Username, &u.DisplayName, &u.Email, &u.PasswordHash, &u.Role, &u.IsVerified, &u.IsBanned,
		&u.AvatarURL, &u.ProfileBannerURL, &u.Bio, &u.WebsiteURL, &u.DiscordTag, &u.Balance, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		return u, ErrNotFound
	}
	return u, nil
}

func (r *Repo) GetUserByExternalID(ctx context.Context, externalID string) (models.User, error) {
	var u models.User
	err := r.pool.QueryRow(ctx, `
		SELECT id, COALESCE(external_id, ''), username, display_name, email, password_hash, role, is_verified, is_banned,
		       avatar_url, profile_banner_url, bio, website_url, discord_tag, balance, created_at, updated_at
		FROM users
		WHERE external_id = $1
	`, externalID).Scan(
		&u.ID, &u.ExternalID, &u.Username, &u.DisplayName, &u.Email, &u.PasswordHash, &u.Role, &u.IsVerified, &u.IsBanned,
		&u.AvatarURL, &u.ProfileBannerURL, &u.Bio, &u.WebsiteURL, &u.DiscordTag, &u.Balance, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		return u, ErrNotFound
	}
	return u, nil
}

func (r *Repo) UpsertUserByExternalID(ctx context.Context, externalID, username, displayName, email, avatarURL string, emailVerified bool) (models.User, error) {
	var u models.User
	query := `
		INSERT INTO users (external_id, username, display_name, email, avatar_url, role, password_hash, is_verified)
		VALUES ($1, $2, $3, $4, $5, 'client', '', $6)
		ON CONFLICT (external_id)
		DO UPDATE SET
			username = EXCLUDED.username,
			display_name = EXCLUDED.display_name,
			email = EXCLUDED.email,
			avatar_url = COALESCE(users.avatar_url, EXCLUDED.avatar_url),
			is_verified = users.is_verified OR EXCLUDED.is_verified,
			updated_at = now()
		RETURNING id, COALESCE(external_id, ''), username, display_name, email, password_hash, role, is_verified, is_banned,
			avatar_url, profile_banner_url, bio, website_url, discord_tag, balance, created_at, updated_at
	`
	err := r.pool.QueryRow(ctx, query, externalID, username, nullableString(displayName), email, nullableString(avatarURL), emailVerified).
		Scan(&u.ID, &u.ExternalID, &u.Username, &u.DisplayName, &u.Email, &u.PasswordHash, &u.Role, &u.IsVerified, &u.IsBanned,
			&u.AvatarURL, &u.ProfileBannerURL, &u.Bio, &u.WebsiteURL, &u.DiscordTag, &u.Balance, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return u, err
	}
	return u, nil
}

func nullableString(value string) *string {
	v := strings.TrimSpace(value)
	if v == "" {
		return nil
	}
	return &v
}

func (r *Repo) UpdateUser(ctx context.Context, u models.User) error {
	q := `
		UPDATE users
		SET username=$1, email=$2, role=$3, avatar_url=$4, profile_banner_url=$5, bio=$6, website_url=$7, discord_tag=$8
		WHERE id=$9
	`
	cmd, err := r.pool.Exec(ctx, q, u.Username, u.Email, u.Role, u.AvatarURL, u.ProfileBannerURL, u.Bio, u.WebsiteURL, u.DiscordTag, u.ID)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate key") {
			return ErrConflict
		}
		return err
	}
	if cmd.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Repo) UpdatePassword(ctx context.Context, id, newPasswordHash string) error {
	cmd, err := r.pool.Exec(ctx, `UPDATE users SET password_hash=$1 WHERE id=$2`, newPasswordHash, id)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate key") {
			return ErrConflict
		}
		return err
	}
	if cmd.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Repo) DeleteUser(ctx context.Context, id string) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM users WHERE id=$1`, id)
	return err
}

func (r *Repo) UpsertVerificationToken(ctx context.Context, userID, token string, expiresAt time.Time) error {
	q := `INSERT INTO platform_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`
	_, err := r.pool.Exec(ctx, q, "verify:"+userID, token+"|"+expiresAt.Format(time.RFC3339))
	return err
}

func (r *Repo) GetSetting(ctx context.Context, key string) (string, error) {
	var value string
	err := r.pool.QueryRow(ctx, `SELECT value FROM platform_settings WHERE key = $1`, key).Scan(&value)
	if err != nil {
		return "", ErrNotFound
	}
	return value, nil
}

func (r *Repo) SetSetting(ctx context.Context, key, value string) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO platform_settings (key, value)
		VALUES ($1, $2)
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
	`, key, value)
	return err
}

func (r *Repo) GetPlatformFeePercent(ctx context.Context) (float64, error) {
	val, err := r.GetSetting(ctx, "platform_fee_percent")
	if err != nil {
		if err == ErrNotFound {
			return 10, nil
		}
		return 0, err
	}
	parsed, err := strconv.ParseFloat(val, 64)
	if err != nil {
		return 0, ErrUnavailable
	}
	return parsed, nil
}

func (r *Repo) SetPlatformFeePercent(ctx context.Context, percent float64) error {
	return r.SetSetting(ctx, "platform_fee_percent", fmt.Sprintf("%0.2f", percent))
}

func (r *Repo) CreateCategory(ctx context.Context, c *models.Category) error {
	q := `
		INSERT INTO categories (parent_id, name, slug, description, icon_url, sort_order, is_active, minimum_price, publishing_config)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, created_at
	`
	return r.pool.QueryRow(ctx, q, c.ParentID, c.Name, c.Slug, c.Description, c.IconURL, c.SortOrder, c.IsActive, c.MinimumPrice, c.PublishingConfig).
		Scan(&c.ID, &c.CreatedAt)
}

func (r *Repo) UpdateCategory(ctx context.Context, c models.Category) error {
	q := `
		UPDATE categories
		SET parent_id=$1, name=$2, slug=$3, description=$4, icon_url=$5, sort_order=$6, is_active=$7,
		    minimum_price=$8, publishing_config=$9
		WHERE id=$10
	`
	cmd, err := r.pool.Exec(ctx, q, c.ParentID, c.Name, c.Slug, c.Description, c.IconURL, c.SortOrder, c.IsActive, c.MinimumPrice, c.PublishingConfig, c.ID)
	if err != nil {
		return err
	}
	if cmd.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Repo) DeleteCategory(ctx context.Context, id string) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM categories WHERE id=$1`, id)
	return err
}

func (r *Repo) ListCategoriesTree(ctx context.Context) ([]models.Category, error) {
	rows, err := r.pool.Query(ctx, `
		WITH RECURSIVE tree AS (
			SELECT id, parent_id, name, slug, description, icon_url, sort_order, is_active, minimum_price, publishing_config, created_at, 0 AS depth
			FROM categories
			WHERE parent_id IS NULL
			UNION ALL
			SELECT c.id, c.parent_id, c.name, c.slug, c.description, c.icon_url, c.sort_order, c.is_active, c.minimum_price, c.publishing_config, c.created_at, t.depth + 1
			FROM categories c
			JOIN tree t ON c.parent_id = t.id
		)
		SELECT id, parent_id, name, slug, description, icon_url, sort_order, is_active, minimum_price, publishing_config, created_at, depth
		FROM tree
		ORDER BY depth, sort_order, name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make(map[string]*models.Category)
	var ordered []*models.Category
	for rows.Next() {
		var c models.Category
		var pid *string
		var created time.Time
		var depth int
		if err := rows.Scan(&c.ID, &pid, &c.Name, &c.Slug, &c.Description, &c.IconURL, &c.SortOrder, &c.IsActive, &c.MinimumPrice, &c.PublishingConfig, &created, &depth); err != nil {
			return nil, err
		}
		c.ParentID = pid
		c.CreatedAt = created
		items[c.ID] = &c
		ordered = append(ordered, &c)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	for i := len(ordered) - 1; i >= 0; i-- {
		node := ordered[i]
		if node.ParentID == nil || *node.ParentID == "" {
			continue
		}
		parent, ok := items[*node.ParentID]
		if ok {
			parent.Children = append([]models.Category{*node}, parent.Children...)
		}
	}

	roots := []models.Category{}
	for _, node := range ordered {
		if node.ParentID == nil || *node.ParentID == "" {
			roots = append(roots, *node)
		}
	}
	return roots, nil
}

func (r *Repo) GetCategory(ctx context.Context, id string) (models.Category, error) {
	var c models.Category
	err := r.pool.QueryRow(ctx,
		`SELECT id, parent_id, name, slug, description, icon_url, sort_order, is_active, minimum_price, publishing_config, created_at
		 FROM categories WHERE id=$1`, id).
		Scan(&c.ID, &c.ParentID, &c.Name, &c.Slug, &c.Description, &c.IconURL, &c.SortOrder, &c.IsActive, &c.MinimumPrice, &c.PublishingConfig, &c.CreatedAt)
	if err != nil {
		return c, ErrNotFound
	}
	return c, nil
}

func (r *Repo) GetCategoryBySlug(ctx context.Context, slug string) (models.Category, error) {
	var c models.Category
	err := r.pool.QueryRow(ctx,
		`SELECT id, parent_id, name, slug, description, icon_url, sort_order, is_active, minimum_price, publishing_config, created_at
		 FROM categories WHERE slug=$1`, slug).
		Scan(&c.ID, &c.ParentID, &c.Name, &c.Slug, &c.Description, &c.IconURL, &c.SortOrder, &c.IsActive, &c.MinimumPrice, &c.PublishingConfig, &c.CreatedAt)
	if err != nil {
		return c, ErrNotFound
	}
	return c, nil
}

func (r *Repo) GetCategoryDescendantIDs(ctx context.Context, id string) ([]string, error) {
	rows, err := r.pool.Query(ctx, `
		WITH RECURSIVE tree AS (
			SELECT id
			FROM categories
			WHERE id::text = $1
			UNION ALL
			SELECT c.id
			FROM categories c
			JOIN tree t ON c.parent_id = t.id
		)
		SELECT id::text
		FROM tree
	`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	ids := []string{}
	for rows.Next() {
		var nextID string
		if err := rows.Scan(&nextID); err != nil {
			return nil, err
		}
		ids = append(ids, nextID)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(ids) == 0 {
		return nil, ErrNotFound
	}
	return ids, nil
}

func (r *Repo) ListProducts(ctx context.Context, filter ListProductsFilter) ([]models.Product, int, error) {
	var args []any
	whereClauses := []string{"TRUE"}
	param := 1

	if len(filter.CategoryIDs) > 0 {
		placeholders := make([]string, 0, len(filter.CategoryIDs))
		for _, id := range filter.CategoryIDs {
			id = strings.TrimSpace(id)
			if id == "" {
				continue
			}
			placeholders = append(placeholders, fmt.Sprintf("$%d", param))
			args = append(args, id)
			param++
		}
		if len(placeholders) > 0 {
			whereClauses = append(whereClauses, fmt.Sprintf("category_id::text IN (%s)", strings.Join(placeholders, ",")))
		}
	} else if filter.CategoryID != nil {
		whereClauses = append(whereClauses, fmt.Sprintf("category_id::text=$%d", param))
		args = append(args, *filter.CategoryID)
		param++
	}
	if filter.SellerID != nil {
		whereClauses = append(whereClauses, fmt.Sprintf("seller_id=$%d", param))
		args = append(args, *filter.SellerID)
		param++
	}
	if filter.Search != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("(title ILIKE $%d OR slug ILIKE $%d OR public_id::text ILIKE $%d OR short_description ILIKE $%d OR description ILIKE $%d)", param, param, param, param, param))
		args = append(args, "%"+filter.Search+"%")
		param++
	}
	if filter.Status != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("status=$%d", param))
		args = append(args, filter.Status)
		param++
	}
	if filter.DiscoverableOnly {
		whereClauses = append(whereClauses, "COALESCE(metadata->>'visibility', 'published') = 'published'")
	}
	if filter.MinPrice != nil {
		whereClauses = append(whereClauses, fmt.Sprintf("price >= $%d", param))
		args = append(args, *filter.MinPrice)
		param++
	}
	if filter.MaxPrice != nil {
		whereClauses = append(whereClauses, fmt.Sprintf("price <= $%d", param))
		args = append(args, *filter.MaxPrice)
		param++
	}

	whereSQL := strings.Join(whereClauses, " AND ")
	sortSQL := "created_at DESC"
	switch filter.Sort {
	case "newest":
		sortSQL = "created_at DESC"
	case "downloaded":
		sortSQL = "total_downloads DESC"
	case "rated":
		sortSQL = "average_rating DESC"
	case "price_low":
		sortSQL = "price ASC"
	case "price_high":
		sortSQL = "price DESC"
	}

	countQuery := `SELECT COUNT(*) FROM products WHERE ` + whereSQL
	var total int
	if err := r.pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	limit := 20
	if filter.Limit > 0 {
		limit = filter.Limit
	}
	offset := filter.Offset

	query := fmt.Sprintf(`
		SELECT id, public_id, seller_id, category_id, title, slug, short_description, description, price, status,
		       thumbnail_url, banner_url, demo_url, source_url, tags, version, supported_versions,
		       total_downloads, total_sales, average_rating, review_count, is_featured, is_exclusive,
		       bump_expires_at, metadata, created_at, updated_at
		FROM products
		WHERE %s
		ORDER BY %s
		LIMIT %d OFFSET %d
	`, whereSQL, sortSQL, limit, offset)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	products := []models.Product{}
	for rows.Next() {
		var p models.Product
		var catID *string
		var desc *string
		var thumb, banner, demo, source, version *string
		var tags, versions []string
		var metadata map[string]any
		var bump *time.Time
		if err := rows.Scan(
			&p.ID, &p.PublicID, &p.SellerID, &catID, &p.Title, &p.Slug, &desc, &p.Description,
			&p.Price, &p.Status, &thumb, &banner, &demo, &source, &tags, &version, &versions,
			&p.TotalDownloads, &p.TotalSales, &p.AverageRating, &p.ReviewCount, &p.IsFeatured,
			&p.IsExclusive, &bump, &metadata, &p.CreatedAt, &p.UpdatedAt,
		); err != nil {
			return nil, 0, err
		}
		p.CategoryID = catID
		p.ShortDescription = desc
		p.ThumbnailURL = thumb
		p.BannerURL = banner
		p.DemoURL = demo
		p.SourceURL = source
		p.Version = version
		p.BumpExpiresAt = bump
		p.Metadata = metadata
		products = append(products, p)
	}
	return products, total, nil
}

func (r *Repo) GetProductBySlug(ctx context.Context, slug string) (models.Product, error) {
	var p models.Product
	var catID *string
	var desc, thumb, banner, demo, source, version *string
	var tags, versions []string
	var metadata map[string]any
	var bump *time.Time
	baseQuery := `
		SELECT id, public_id, seller_id, category_id, title, slug, short_description, description, price, status,
		       thumbnail_url, banner_url, demo_url, source_url, tags, version, supported_versions,
		       total_downloads, total_sales, average_rating, review_count, is_featured, is_exclusive,
		       bump_expires_at, metadata, created_at, updated_at
		FROM products
		WHERE %s
	`
	scan := func(where string, arg any) error {
		return r.pool.QueryRow(ctx, fmt.Sprintf(baseQuery, where), arg).Scan(
			&p.ID, &p.PublicID, &p.SellerID, &catID, &p.Title, &p.Slug, &desc, &p.Description,
			&p.Price, &p.Status, &thumb, &banner, &demo, &source, &tags, &version, &versions,
			&p.TotalDownloads, &p.TotalSales, &p.AverageRating, &p.ReviewCount, &p.IsFeatured,
			&p.IsExclusive, &bump, &metadata, &p.CreatedAt, &p.UpdatedAt,
		)
	}
	err := scan("slug=$1", slug)
	if err != nil {
		publicID, ok := productPublicIDFromSlug(slug)
		if ok && scan("public_id=$1", publicID) == nil {
			err = nil
		} else {
			err = scan("id=(SELECT product_id FROM product_slug_aliases WHERE slug=$1)", slug)
		}
	}
	if err != nil {
		return p, ErrNotFound
	}
	p.CategoryID = catID
	p.ShortDescription = desc
	p.ThumbnailURL = thumb
	p.BannerURL = banner
	p.DemoURL = demo
	p.SourceURL = source
	p.Version = version
	p.BumpExpiresAt = bump
	p.Metadata = metadata
	p.SupportedVersions = versions
	return p, nil
}

func productPublicIDFromSlug(value string) (int64, bool) {
	parts := strings.Split(strings.Trim(value, "-"), "-")
	if len(parts) == 0 {
		return 0, false
	}
	candidates := []string{parts[len(parts)-1]}
	if len(parts) > 1 {
		candidates = append(candidates, parts[0])
	}
	for _, candidate := range candidates {
		if len(candidate) < 6 {
			continue
		}
		publicID, err := strconv.ParseInt(candidate, 10, 64)
		if err == nil && publicID > 0 {
			return publicID, true
		}
	}
	return 0, false
}

func (r *Repo) NextProductPublicID(ctx context.Context) (int64, error) {
	var publicID int64
	if err := r.pool.QueryRow(ctx, `SELECT nextval('product_public_id_seq')`).Scan(&publicID); err != nil {
		return 0, err
	}
	return publicID, nil
}

func (r *Repo) CreateProduct(ctx context.Context, p *models.Product, sellerID string) error {
	if p.Slug == "" {
		p.Slug = strings.ToLower(strings.ReplaceAll(p.Title, " ", "-"))
	}
	query := `
		INSERT INTO products (public_id, seller_id, category_id, title, slug, short_description, description, price, status,
		                     thumbnail_url, banner_url, demo_url, source_url, tags, version, supported_versions, metadata)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
		RETURNING id, public_id, created_at, updated_at
	`
	err := r.pool.QueryRow(ctx, query,
		p.PublicID, sellerID, p.CategoryID, p.Title, p.Slug, p.ShortDescription, p.Description, p.Price, p.Status,
		p.ThumbnailURL, p.BannerURL, p.DemoURL, p.SourceURL, p.Tags, p.Version, p.SupportedVersions, p.Metadata,
	).Scan(&p.ID, &p.PublicID, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate key") {
			return ErrConflict
		}
		return err
	}
	p.SellerID = sellerID
	return nil
}

func (r *Repo) UpdateProduct(ctx context.Context, p models.Product, role string, userID string) error {
	query := `
		WITH previous_slug AS (
			SELECT id, slug FROM products
			WHERE id=$18 AND ($19 = 'admin' OR seller_id=$20) AND slug <> $3
		), stored_alias AS (
			INSERT INTO product_slug_aliases (product_id, slug)
			SELECT id, slug FROM previous_slug
			ON CONFLICT (slug) DO NOTHING
		)
		UPDATE products
		SET category_id=$1,title=$2,slug=$3,short_description=$4,description=$5,price=$6,status=$7,
		    thumbnail_url=$8,banner_url=$9,demo_url=$10,source_url=$11,tags=$12,version=$13,
		    supported_versions=$14,is_featured=$15,is_exclusive=$16,metadata=$17,updated_at=now()
		WHERE id=$18 AND ($19 = 'admin' OR seller_id=$20)
	`
	cmd, err := r.pool.Exec(ctx, query,
		p.CategoryID, p.Title, p.Slug, p.ShortDescription, p.Description, p.Price, p.Status,
		p.ThumbnailURL, p.BannerURL, p.DemoURL, p.SourceURL, p.Tags, p.Version,
		p.SupportedVersions, p.IsFeatured, p.IsExclusive, p.Metadata, p.ID, role, userID,
	)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate key") {
			return ErrConflict
		}
		return err
	}
	if cmd.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Repo) DeleteProduct(ctx context.Context, id, role, userID string) error {
	cmd, err := r.pool.Exec(ctx, `
		DELETE FROM products
		WHERE id=$1 AND ($2 = 'admin' OR seller_id=$3)
	`, id, role, userID)
	if err != nil {
		return err
	}
	if cmd.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Repo) EnsureSellerOwnsProduct(ctx context.Context, sellerID, productID string) error {
	var exists string
	err := r.pool.QueryRow(ctx, `SELECT id FROM products WHERE id=$1 AND seller_id=$2`, productID, sellerID).Scan(&exists)
	if err != nil {
		return ErrNotFound
	}
	return nil
}

func (r *Repo) IncrementProductDownloads(ctx context.Context, productID string) error {
	_, err := r.pool.Exec(ctx, `UPDATE products SET total_downloads = total_downloads + 1 WHERE id=$1`, productID)
	return err
}

func (r *Repo) CreateReview(ctx context.Context, review *models.Review) error {
	q := `
		INSERT INTO reviews (product_id, user_id, order_id, rating, title, body, is_verified_purchase)
		VALUES ($1,$2,$3,$4,$5,$6,$7)
		RETURNING id, created_at, updated_at
	`
	err := r.pool.QueryRow(ctx, q, review.ProductID, review.UserID, review.OrderID, review.Rating, review.Title, review.Body, review.IsVerifiedPurchase).
		Scan(&review.ID, &review.CreatedAt, &review.UpdatedAt)
	if err != nil && strings.Contains(err.Error(), "duplicate key") {
		return ErrConflict
	}
	return err
}
func (r *Repo) UpdateReview(ctx context.Context, review models.Review) error {
	q := `
		UPDATE reviews
		SET rating=$1, title=$2, body=$3, updated_at=now()
		WHERE id=$4 AND user_id=$5
	`
	cmd, err := r.pool.Exec(ctx, q, review.Rating, review.Title, review.Body, review.ID, review.UserID)
	if err != nil {
		return err
	}
	if cmd.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Repo) DeleteReview(ctx context.Context, reviewID, userID string, isAdmin bool) error {
	q := `DELETE FROM reviews WHERE id=$1`
	if !isAdmin {
		q += ` AND user_id=$2`
		_, err := r.pool.Exec(ctx, q, reviewID, userID)
		return err
	}
	_, err := r.pool.Exec(ctx, q, reviewID)
	return err
}

func (r *Repo) RecalculateProductRating(ctx context.Context, productID string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE products
		SET average_rating = COALESCE((
			SELECT ROUND(AVG(rating)::numeric, 2) FROM reviews WHERE product_id=$1 AND NOT is_hidden
		), 0),
		review_count = (
			SELECT COUNT(*) FROM reviews WHERE product_id=$1 AND NOT is_hidden
		)
		WHERE id=$1
	`, productID)
	return err
}

func (r *Repo) ReplyReview(ctx context.Context, reviewID, reply string) error {
	cmd, err := r.pool.Exec(ctx, `UPDATE reviews SET seller_reply=$1 WHERE id=$2`, reply, reviewID)
	if err != nil {
		return err
	}
	if cmd.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Repo) SetUserVerified(ctx context.Context, userID string) error {
	_, err := r.pool.Exec(ctx, `UPDATE users SET is_verified=true WHERE id=$1`, userID)
	return err
}

func (r *Repo) ListProductVersions(ctx context.Context, productID string) ([]models.ProductVersion, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, product_id, version_tag, update_title, changelog, file_key, file_name, file_size, file_checksum, is_latest, is_update_posted, download_count, created_at
		FROM product_versions
		WHERE product_id=$1
		ORDER BY created_at DESC
	`, productID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var versions []models.ProductVersion
	for rows.Next() {
		var v models.ProductVersion
		if err := rows.Scan(&v.ID, &v.ProductID, &v.VersionTag, &v.UpdateTitle, &v.Changelog, &v.FileKey, &v.FileName, &v.FileSize, &v.FileChecksum, &v.IsLatest, &v.IsUpdatePosted, &v.DownloadCount, &v.CreatedAt); err != nil {
			return nil, err
		}
		versions = append(versions, v)
	}
	return versions, nil
}

func (r *Repo) CreateProductVersion(ctx context.Context, v *models.ProductVersion) error {
	if v.IsLatest {
		_, err := r.pool.Exec(ctx, `UPDATE product_versions SET is_latest = false WHERE product_id=$1`, v.ProductID)
		if err != nil {
			return err
		}
	}
	return r.pool.QueryRow(ctx, `
		INSERT INTO product_versions (product_id, version_tag, update_title, changelog, file_key, file_name, file_size, file_checksum, is_latest, is_update_posted)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
		RETURNING id, created_at
	`, v.ProductID, v.VersionTag, v.UpdateTitle, v.Changelog, v.FileKey, v.FileName, v.FileSize, v.FileChecksum, v.IsLatest, v.IsUpdatePosted).Scan(&v.ID, &v.CreatedAt)
}

func (r *Repo) GetProductVersionArtifactForProduct(ctx context.Context, productID, versionID string) (string, string, bool, error) {
	var key, fileName string
	var isLatest bool
	if err := r.pool.QueryRow(ctx, `
		SELECT file_key, file_name, is_latest
		FROM product_versions
		WHERE id=$1 AND product_id=$2
	`, versionID, productID).Scan(&key, &fileName, &isLatest); err != nil {
		return "", "", false, ErrNotFound
	}
	return key, fileName, isLatest, nil
}

func (r *Repo) IncrementProductVersionDownloads(ctx context.Context, versionID string) error {
	_, err := r.pool.Exec(ctx, `UPDATE product_versions SET download_count=download_count+1 WHERE id=$1`, versionID)
	return err
}

func (r *Repo) DeleteProductVersion(ctx context.Context, productID, versionID string) error {
	cmd, err := r.pool.Exec(ctx, `DELETE FROM product_versions WHERE id=$1 AND product_id=$2`, versionID, productID)
	if err != nil {
		return err
	}
	if cmd.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Repo) AddProductMedia(ctx context.Context, media *models.ProductMedia) error {
	return r.pool.QueryRow(ctx, `
		INSERT INTO product_media (product_id, media_url, media_type, sort_order)
		VALUES ($1, $2, $3, $4)
		RETURNING id, created_at
	`, media.ProductID, media.MediaURL, media.MediaType, media.SortOrder).Scan(&media.ID, &media.CreatedAt)
}

func (r *Repo) ListProductMedia(ctx context.Context, productID string) ([]models.ProductMedia, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, product_id, media_url, media_type, sort_order, created_at
		FROM product_media
		WHERE product_id=$1
		ORDER BY sort_order, created_at
	`, productID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	media := []models.ProductMedia{}
	for rows.Next() {
		var item models.ProductMedia
		if err := rows.Scan(&item.ID, &item.ProductID, &item.MediaURL, &item.MediaType, &item.SortOrder, &item.CreatedAt); err != nil {
			return nil, err
		}
		media = append(media, item)
	}
	return media, rows.Err()
}

func (r *Repo) CountProductMediaByType(ctx context.Context, productID, mediaType string) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM product_media WHERE product_id=$1 AND media_type=$2`, productID, mediaType).Scan(&count)
	return count, err
}

func (r *Repo) DeleteProductMedia(ctx context.Context, productID, mediaID string) error {
	cmd, err := r.pool.Exec(ctx, `
		DELETE FROM product_media WHERE id=$1 AND product_id=$2
	`, mediaID, productID)
	if err != nil {
		return err
	}
	if cmd.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Repo) ListProductsBySeller(ctx context.Context, sellerID string, filters ListProductsFilter) ([]models.Product, int, error) {
	filters.SellerID = &sellerID
	return r.ListProducts(ctx, filters)
}

func (r *Repo) AddToCart(ctx context.Context, userID, productID string) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO cart_items (user_id, product_id)
		VALUES ($1,$2)
		ON CONFLICT (user_id, product_id) DO NOTHING
	`, userID, productID)
	return err
}

func (r *Repo) RemoveFromCart(ctx context.Context, userID, productID string) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM cart_items WHERE user_id=$1 AND product_id=$2`, userID, productID)
	return err
}

func (r *Repo) ListCart(ctx context.Context, userID string) ([]models.CartItem, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, user_id, product_id, added_at
		FROM cart_items
		WHERE user_id=$1
		ORDER BY added_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []models.CartItem
	for rows.Next() {
		var item models.CartItem
		if err := rows.Scan(&item.ID, &item.UserID, &item.ProductID, &item.AddedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, nil
}

func (r *Repo) AddToWishlist(ctx context.Context, userID, productID string) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO wishlist_items (user_id, product_id)
		VALUES ($1,$2)
		ON CONFLICT (user_id, product_id) DO NOTHING
	`, userID, productID)
	return err
}

func (r *Repo) RemoveFromWishlist(ctx context.Context, userID, productID string) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM wishlist_items WHERE user_id=$1 AND product_id=$2`, userID, productID)
	return err
}

func (r *Repo) ListWishlist(ctx context.Context, userID string) ([]models.WishlistItem, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, user_id, product_id, added_at
		FROM wishlist_items
		WHERE user_id=$1
		ORDER BY added_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []models.WishlistItem
	for rows.Next() {
		var item models.WishlistItem
		if err := rows.Scan(&item.ID, &item.UserID, &item.ProductID, &item.AddedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, nil
}

func (r *Repo) CreateDownloadToken(ctx context.Context, token string, orderID, versionID *string, expiresAt time.Time, ip string) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO download_tokens (token, order_id, product_version_id, expires_at, ip_address, used)
		VALUES ($1,$2,$3,$4,$5,false)
	`, token, *orderID, versionID, expiresAt, ip)
	return err
}

func (r *Repo) DeleteExpiredDownloadTokens(ctx context.Context) (int64, error) {
	cmd, err := r.pool.Exec(ctx, `DELETE FROM download_tokens WHERE expires_at < NOW()`)
	if err != nil {
		return 0, err
	}
	return cmd.RowsAffected(), nil
}

func (r *Repo) CreateDownloadTokenForOrder(ctx context.Context, orderID, productVersionID string, ttl time.Duration, ip string) (models.DownloadToken, error) {
	var tokenVal string
	var id string
	var created time.Time
	var pv *string
	if productVersionID == "" {
		pv = nil
	} else {
		pv = &productVersionID
	}
	expiresAt := time.Now().Add(ttl)
	tokenVal = "dt_" + uuid.NewString()
	row := r.pool.QueryRow(ctx, `
		INSERT INTO download_tokens (token, order_id, product_version_id, expires_at, used, ip_address)
		VALUES ($1,$2,$3,$4,false,$5)
		RETURNING id, created_at
	`, tokenVal, orderID, pv, expiresAt, ip)
	if err := row.Scan(&id, &created); err != nil {
		return models.DownloadToken{}, err
	}
	return models.DownloadToken{
		ID:               id,
		OrderID:          orderID,
		Token:            tokenVal,
		ProductVersionID: pv,
		ExpiresAt:        expiresAt,
		Used:             false,
		IPAddress:        &ip,
		CreatedAt:        created,
	}, nil
}

func (r *Repo) GetLatestProductVersionID(ctx context.Context, productID string) (string, error) {
	var versionID string
	err := r.pool.QueryRow(ctx, `
		SELECT id
		FROM product_versions
		WHERE product_id=$1
		ORDER BY created_at DESC
		LIMIT 1
	`, productID).Scan(&versionID)
	if err != nil {
		return "", ErrNotFound
	}
	return versionID, nil
}

func (r *Repo) GetProductByID(ctx context.Context, id string) (models.Product, error) {
	var p models.Product
	var catID *string
	var desc, thumb, banner, demo, source, version *string
	var tags, versions []string
	var metadata map[string]any
	var bump *time.Time
	err := r.pool.QueryRow(ctx, `
		SELECT id, public_id, seller_id, category_id, title, slug, short_description, description, price, status,
		       thumbnail_url, banner_url, demo_url, source_url, tags, version, supported_versions,
		       total_downloads, total_sales, average_rating, review_count, is_featured, is_exclusive,
		       bump_expires_at, metadata, created_at, updated_at
		FROM products
		WHERE id=$1
	`, id).Scan(
		&p.ID, &p.PublicID, &p.SellerID, &catID, &p.Title, &p.Slug, &desc, &p.Description,
		&p.Price, &p.Status, &thumb, &banner, &demo, &source, &tags, &version, &versions,
		&p.TotalDownloads, &p.TotalSales, &p.AverageRating, &p.ReviewCount, &p.IsFeatured,
		&p.IsExclusive, &bump, &metadata, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		return p, ErrNotFound
	}
	p.CategoryID = catID
	p.ShortDescription = desc
	p.ThumbnailURL = thumb
	p.BannerURL = banner
	p.DemoURL = demo
	p.SourceURL = source
	p.Version = version
	p.BumpExpiresAt = bump
	p.Metadata = metadata
	p.SupportedVersions = versions
	return p, nil
}

func (r *Repo) CompleteOrder(ctx context.Context, orderID, paymentMethod, paymentID string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE orders
		SET status='completed', payment_method=$1, payment_id=$2
		WHERE id=$3
	`, paymentMethod, paymentID, orderID)
	return err
}

func (r *Repo) SetPendingOrderPayment(ctx context.Context, orderID, buyerID, paymentMethod, paymentID string) error {
	result, err := r.pool.Exec(ctx, `
		UPDATE orders
		SET payment_method=$1, payment_id=$2
		WHERE id=$3 AND buyer_id=$4 AND status='pending'
	`, paymentMethod, paymentID, orderID, buyerID)
	if err != nil {
		return err
	}
	if result.RowsAffected() != 1 {
		return ErrConflict
	}
	return nil
}

func (r *Repo) UpdatePendingOrderPricing(ctx context.Context, orderID, buyerID string, amount, platformFee, sellerEarnings float64, currency string) error {
	result, err := r.pool.Exec(ctx, `
		UPDATE orders
		SET amount=$1, platform_fee=$2, seller_earnings=$3, currency=$4
		WHERE id=$5 AND buyer_id=$6 AND status='pending'
	`, amount, platformFee, sellerEarnings, currency, orderID, buyerID)
	if err != nil {
		return err
	}
	if result.RowsAffected() != 1 {
		return ErrConflict
	}
	return nil
}

func (r *Repo) SetProductTebexPackage(ctx context.Context, productID string, packageID *int64) error {
	result, err := r.pool.Exec(ctx, `
		UPDATE products
		SET metadata = CASE
			WHEN $2::bigint IS NULL THEN COALESCE(metadata, '{}'::jsonb) - 'tebex_package_id'
			ELSE jsonb_set(COALESCE(metadata, '{}'::jsonb), '{tebex_package_id}', to_jsonb($2::bigint), true)
		END,
		updated_at=now()
		WHERE id=$1
	`, productID, packageID)
	if err != nil {
		return err
	}
	if result.RowsAffected() != 1 {
		return ErrNotFound
	}
	return nil
}

func (r *Repo) CompletePendingOrder(ctx context.Context, orderID, buyerID, paymentMethod, paymentID, license string) (bool, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var sellerID, productID, status string
	var sellerEarnings float64
	var storedPaymentID *string
	if err := tx.QueryRow(ctx, `
		SELECT seller_id, product_id, seller_earnings, status, payment_id
		FROM orders
		WHERE id=$1 AND buyer_id=$2
		FOR UPDATE
	`, orderID, buyerID).Scan(&sellerID, &productID, &sellerEarnings, &status, &storedPaymentID); err != nil {
		return false, ErrNotFound
	}
	if status == "completed" {
		return false, nil
	}
	if status != "pending" || storedPaymentID == nil || *storedPaymentID == "" {
		return false, ErrConflict
	}

	result, err := tx.Exec(ctx, `
		UPDATE orders
		SET status='completed', payment_method=$1, payment_id=$2, license_key=$3
		WHERE id=$4 AND status='pending'
	`, paymentMethod, paymentID, license, orderID)
	if err != nil || result.RowsAffected() != 1 {
		if err != nil {
			return false, err
		}
		return false, ErrConflict
	}
	if _, err := tx.Exec(ctx, `UPDATE users SET balance=balance+$1 WHERE id=$2`, sellerEarnings, sellerID); err != nil {
		return false, err
	}
	if _, err := tx.Exec(ctx, `UPDATE products SET total_sales=total_sales+1 WHERE id=$1`, productID); err != nil {
		return false, err
	}
	if err := tx.Commit(ctx); err != nil {
		return false, err
	}
	return true, nil
}

func (r *Repo) ApplySellerEarnings(ctx context.Context, sellerID string, amount float64) error {
	_, err := r.pool.Exec(ctx, `UPDATE users SET balance = balance + $1 WHERE id=$2`, amount, sellerID)
	return err
}

func (r *Repo) GetProductVersionFileKey(ctx context.Context, versionID string) (string, error) {
	var key string
	if err := r.pool.QueryRow(ctx, `SELECT file_key FROM product_versions WHERE id=$1`, versionID).Scan(&key); err != nil {
		return "", ErrNotFound
	}
	return key, nil
}

func (r *Repo) GetProductVersionArtifact(ctx context.Context, versionID string) (string, string, error) {
	var key, fileName string
	if err := r.pool.QueryRow(ctx, `SELECT file_key, file_name FROM product_versions WHERE id=$1`, versionID).Scan(&key, &fileName); err != nil {
		return "", "", ErrNotFound
	}
	return key, fileName, nil
}

func (r *Repo) GetDownloadArtifactByToken(ctx context.Context, token string) (string, string, string, string, error) {
	var key, fileName, productID, versionID string
	err := r.pool.QueryRow(ctx, `
		SELECT pv.file_key, pv.file_name, o.product_id, pv.id
		FROM download_tokens dt
		JOIN orders o ON o.id=dt.order_id
		JOIN product_versions pv ON pv.id=dt.product_version_id
		WHERE dt.token=$1 AND dt.expires_at > now() AND dt.used=false AND o.status='completed'
	`, token).Scan(&key, &fileName, &productID, &versionID)
	if err != nil {
		return "", "", "", "", ErrNotFound
	}
	return key, fileName, productID, versionID, nil
}

func (r *Repo) MarkDownloadTokenUsed(ctx context.Context, token string) error {
	result, err := r.pool.Exec(ctx, `
		WITH used_token AS (
			UPDATE download_tokens
			SET used=true
			WHERE token=$1 AND used=false
			RETURNING order_id
		)
		UPDATE orders
		SET first_downloaded_at=COALESCE(first_downloaded_at, now())
		WHERE id IN (SELECT order_id FROM used_token)
	`, token)
	if err != nil {
		return err
	}
	if result.RowsAffected() != 1 {
		return ErrNotFound
	}
	return nil
}

func (r *Repo) SetOrderLicense(ctx context.Context, orderID, license string) error {
	_, err := r.pool.Exec(ctx, `UPDATE orders SET license_key=$1 WHERE id=$2`, license, orderID)
	return err
}

func (r *Repo) MarkOrderNotificationSeen(ctx context.Context, userID string, notificationID string) error {
	_, err := r.pool.Exec(ctx, `UPDATE notifications SET is_read=true WHERE id=$1 AND user_id=$2`, notificationID, userID)
	return err
}

func (r *Repo) ListNotifications(ctx context.Context, userID string) ([]models.Notification, error) {
	rows, err := r.pool.Query(ctx, `SELECT id,user_id,type,title,body,link,is_read,created_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.Notification
	for rows.Next() {
		var n models.Notification
		if err := rows.Scan(&n.ID, &n.UserID, &n.Type, &n.Title, &n.Body, &n.Link, &n.IsRead, &n.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, n)
	}
	return out, nil
}

func (r *Repo) MarkAllNotificationsRead(ctx context.Context, userID string) error {
	_, err := r.pool.Exec(ctx, `UPDATE notifications SET is_read=true WHERE user_id=$1`, userID)
	return err
}

func (r *Repo) AddNotification(ctx context.Context, n *models.Notification) error {
	return r.pool.QueryRow(ctx, `
		INSERT INTO notifications (user_id, type, title, body, link)
		VALUES ($1,$2,$3,$4,$5)
		RETURNING id, created_at
	`, n.UserID, n.Type, n.Title, n.Body, n.Link).Scan(&n.ID, &n.CreatedAt)
}

func (r *Repo) CreateReport(ctx context.Context, rprt models.Report) (string, error) {
	var id string
	err := r.pool.QueryRow(ctx, `
		INSERT INTO reports (reporter_id, target_type, target_id, reason, details)
		VALUES ($1,$2,$3,$4,$5)
		RETURNING id
	`, rprt.ReporterID, rprt.TargetType, rprt.TargetID, rprt.Reason, rprt.Details).Scan(&id)
	return id, err
}

func (r *Repo) OrderBelongsToUser(ctx context.Context, orderID, buyerID string) (string, string, string, error) {
	var status string
	var productID string
	var sellerID string
	err := r.pool.QueryRow(ctx, `SELECT status, product_id, seller_id FROM orders WHERE id=$1 AND buyer_id=$2`, orderID, buyerID).Scan(&status, &productID, &sellerID)
	return status, productID, sellerID, err
}

func (r *Repo) GetOrderForUserProduct(ctx context.Context, userID, productID string) (models.Order, error) {
	var order models.Order
	var pv, paymentMethod, paymentID, license *string
	err := r.pool.QueryRow(ctx, `
		SELECT id,buyer_id,product_id,product_version_id,seller_id,amount,platform_fee,seller_earnings,currency,payment_method,payment_id,status,license_key,created_at
		FROM orders
		WHERE buyer_id=$1 AND product_id=$2 AND status='completed'
		ORDER BY created_at DESC
		LIMIT 1
	`, userID, productID).Scan(
		&order.ID, &order.BuyerID, &order.ProductID, &pv, &order.SellerID, &order.Amount,
		&order.PlatformFee, &order.SellerEarnings, &order.Currency, &paymentMethod, &paymentID,
		&order.Status, &license, &order.CreatedAt,
	)
	if err != nil {
		return order, ErrNotFound
	}
	order.ProductVersionID = pv
	order.PaymentMethod = paymentMethod
	order.PaymentID = paymentID
	order.LicenseKey = license
	return order, nil
}

func (r *Repo) GetProductEntitlement(ctx context.Context, userID, productID string) (models.ProductEntitlement, error) {
	var entitlement models.ProductEntitlement
	err := r.pool.QueryRow(ctx, `
		SELECT o.id,
		       o.first_downloaded_at IS NOT NULL,
		       EXISTS (
				SELECT 1 FROM reviews r
				WHERE r.product_id=o.product_id AND r.user_id=o.buyer_id
		       )
		FROM orders o
		WHERE o.buyer_id=$1 AND o.product_id=$2 AND o.status='completed'
		ORDER BY o.created_at DESC
		LIMIT 1
	`, userID, productID).Scan(&entitlement.OrderID, &entitlement.Downloaded, &entitlement.Reviewed)
	if err != nil {
		return entitlement, ErrNotFound
	}
	entitlement.Purchased = true
	entitlement.CanReview = entitlement.Downloaded && !entitlement.Reviewed
	return entitlement, nil
}

func (r *Repo) CreateOrder(ctx context.Context, order *models.Order) (string, error) {
	err := r.pool.QueryRow(ctx, `
		INSERT INTO orders (buyer_id, product_id, product_version_id, seller_id, amount, platform_fee, seller_earnings, currency, payment_method, payment_id, status, license_key)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
		RETURNING id
	`, order.BuyerID, order.ProductID, order.ProductVersionID, order.SellerID, order.Amount, order.PlatformFee, order.SellerEarnings, order.Currency, order.PaymentMethod, order.PaymentID, order.Status, order.LicenseKey).
		Scan(&order.ID)
	return order.ID, err
}

func (r *Repo) GetOrder(ctx context.Context, orderID string) (models.Order, error) {
	var order models.Order
	var pv *string
	var paymentMethod, paymentID, license *string
	err := r.pool.QueryRow(ctx, `
		SELECT id,buyer_id,product_id,product_version_id,seller_id,amount,platform_fee,seller_earnings,currency,payment_method,payment_id,status,license_key,created_at
		FROM orders WHERE id=$1
	`, orderID).Scan(&order.ID, &order.BuyerID, &order.ProductID, &pv, &order.SellerID, &order.Amount, &order.PlatformFee, &order.SellerEarnings, &order.Currency, &paymentMethod, &paymentID, &order.Status, &license, &order.CreatedAt)
	if err != nil {
		return order, ErrNotFound
	}
	order.ProductVersionID = pv
	order.PaymentMethod = paymentMethod
	order.PaymentID = paymentID
	order.LicenseKey = license
	return order, nil
}

func (r *Repo) ListOrdersByBuyer(ctx context.Context, buyerID string) ([]models.Order, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id,buyer_id,product_id,product_version_id,seller_id,amount,platform_fee,seller_earnings,currency,payment_method,payment_id,status,license_key,created_at
		FROM orders
		WHERE buyer_id=$1 AND status IN ('completed', 'refunded')
		ORDER BY created_at DESC
	`, buyerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var orders []models.Order
	for rows.Next() {
		var order models.Order
		var pv, paymentMethod, paymentID, license *string
		if err := rows.Scan(&order.ID, &order.BuyerID, &order.ProductID, &pv, &order.SellerID, &order.Amount, &order.PlatformFee, &order.SellerEarnings, &order.Currency, &paymentMethod, &paymentID, &order.Status, &license, &order.CreatedAt); err != nil {
			return nil, err
		}
		order.ProductVersionID = pv
		order.PaymentMethod = paymentMethod
		order.PaymentID = paymentID
		order.LicenseKey = license
		orders = append(orders, order)
	}
	return orders, nil
}

func (r *Repo) ListPendingOrdersForBuyerProduct(ctx context.Context, buyerID, productID string) ([]models.Order, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id,buyer_id,product_id,product_version_id,seller_id,amount,platform_fee,seller_earnings,currency,payment_method,payment_id,status,license_key,created_at
		FROM orders
		WHERE buyer_id=$1 AND product_id=$2 AND status='pending' AND payment_method='tebex_headless' AND payment_id IS NOT NULL
		ORDER BY created_at DESC
	`, buyerID, productID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var orders []models.Order
	for rows.Next() {
		var order models.Order
		var pv, paymentMethod, paymentID, license *string
		if err := rows.Scan(&order.ID, &order.BuyerID, &order.ProductID, &pv, &order.SellerID, &order.Amount, &order.PlatformFee, &order.SellerEarnings, &order.Currency, &paymentMethod, &paymentID, &order.Status, &license, &order.CreatedAt); err != nil {
			return nil, err
		}
		order.ProductVersionID = pv
		order.PaymentMethod = paymentMethod
		order.PaymentID = paymentID
		order.LicenseKey = license
		orders = append(orders, order)
	}
	return orders, rows.Err()
}

func (r *Repo) AddAuditLog(ctx context.Context, log models.AuditLog) error {
	details := log.Details
	if details == nil {
		details = map[string]any{}
	}
	detailsJSON, err := json.Marshal(details)
	if err != nil {
		return err
	}
	_, err = r.pool.Exec(ctx, `
		INSERT INTO audit_logs (admin_id, action, target_type, target_id, details, ip_address)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, log.AdminID, log.Action, log.TargetType, log.TargetID, string(detailsJSON), log.IPAddress)
	return err
}

func (r *Repo) ListReviews(ctx context.Context, productID string) ([]models.Review, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT
			r.id, r.product_id, r.user_id, r.order_id, r.rating, r.title, r.body,
			r.is_verified_purchase, r.is_hidden, r.seller_reply, r.created_at, r.updated_at,
			u.id, u.username, u.avatar_url
		FROM reviews r
		JOIN users u ON u.id = r.user_id
		WHERE product_id=$1 AND NOT is_hidden
		ORDER BY created_at DESC
	`, productID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var reviews []models.Review
	for rows.Next() {
		var rev models.Review
		var reviewUser models.ReviewUser
		if err := rows.Scan(&rev.ID, &rev.ProductID, &rev.UserID, &rev.OrderID, &rev.Rating, &rev.Title, &rev.Body,
			&rev.IsVerifiedPurchase, &rev.IsHidden, &rev.SellerReply, &rev.CreatedAt, &rev.UpdatedAt,
			&reviewUser.ID, &reviewUser.Username, &reviewUser.AvatarURL); err != nil {
			return nil, err
		}
		rev.User = &reviewUser
		reviews = append(reviews, rev)
	}
	return reviews, nil
}

func (r *Repo) GetReviewProductSeller(ctx context.Context, reviewID string) (string, error) {
	var sellerID string
	err := r.pool.QueryRow(ctx, `
		SELECT p.seller_id
		FROM reviews rv
		JOIN products p ON p.id = rv.product_id
		WHERE rv.id = $1
	`, reviewID).Scan(&sellerID)
	if err != nil {
		return "", ErrNotFound
	}
	return sellerID, nil
}

func (r *Repo) GetProductByVersion(ctx context.Context, versionID string) (models.Product, error) {
	var p models.Product
	var catID *string
	var desc, thumb, banner, demo, source, version *string
	var tags, versions []string
	var metadata map[string]any
	var bump *time.Time
	err := r.pool.QueryRow(ctx, `
		SELECT p.id,p.public_id,p.seller_id,p.category_id,p.title,p.slug,p.short_description,p.description,p.price,p.status,
		       p.thumbnail_url,p.banner_url,p.demo_url,p.source_url,p.tags,p.version,p.supported_versions,
		       p.total_downloads,p.total_sales,p.average_rating,p.review_count,p.is_featured,p.is_exclusive,
		       p.bump_expires_at,p.metadata,p.created_at,p.updated_at
		FROM products p
		JOIN product_versions v ON v.product_id = p.id
		WHERE v.id = $1
	`, versionID).Scan(&p.ID, &p.PublicID, &p.SellerID, &catID, &p.Title, &p.Slug, &desc, &p.Description, &p.Price, &p.Status,
		&thumb, &banner, &demo, &source, &tags, &version, &versions,
		&p.TotalDownloads, &p.TotalSales, &p.AverageRating, &p.ReviewCount, &p.IsFeatured, &p.IsExclusive,
		&bump, &metadata, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		return p, ErrNotFound
	}
	p.CategoryID = catID
	p.ShortDescription = desc
	p.ThumbnailURL = thumb
	p.BannerURL = banner
	p.DemoURL = demo
	p.SourceURL = source
	p.Version = version
	p.BumpExpiresAt = bump
	p.Metadata = metadata
	p.SupportedVersions = versions
	return p, nil
}

func (r *Repo) BumpProduct(ctx context.Context, productID string, until time.Time) error {
	_, err := r.pool.Exec(ctx, `UPDATE products SET bump_expires_at=$1 WHERE id=$2`, until, productID)
	return err
}

func (r *Repo) CreateSellerProfile(ctx context.Context, sp *models.SellerProfile) error {
	return r.pool.QueryRow(ctx, `
		INSERT INTO seller_profiles (user_id, shop_name, shop_slug, shop_description, shop_banner_url, payout_method, payout_details)
		VALUES ($1,$2,$3,$4,$5,$6,$7)
		RETURNING id, created_at
	`, sp.UserID, sp.ShopName, sp.ShopSlug, sp.ShopDescription, sp.ShopBannerURL, sp.PayoutMethod, sp.PayoutDetails).
		Scan(&sp.ID, &sp.CreatedAt)
}

func (r *Repo) UpsertSellerProfile(ctx context.Context, sp models.SellerProfile) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE seller_profiles
		SET shop_name=$1, shop_slug=$2, shop_description=$3, shop_banner_url=$4, payout_method=$5, payout_details=$6
		WHERE user_id=$7
	`, sp.ShopName, sp.ShopSlug, sp.ShopDescription, sp.ShopBannerURL, sp.PayoutMethod, sp.PayoutDetails, sp.UserID)
	return err
}

func (r *Repo) GetSellerProfileByUserID(ctx context.Context, userID string) (models.SellerProfile, error) {
	var p models.SellerProfile
	err := r.pool.QueryRow(ctx, `
		SELECT id,user_id,shop_name,shop_slug,shop_description,shop_banner_url,total_sales,total_revenue,payout_method,payout_details,approved,created_at
		FROM seller_profiles
		WHERE user_id=$1
	`, userID).Scan(&p.ID, &p.UserID, &p.ShopName, &p.ShopSlug, &p.ShopDescription, &p.ShopBannerURL,
		&p.TotalSales, &p.TotalRevenue, &p.PayoutMethod, &p.PayoutDetails, &p.Approved, &p.CreatedAt)
	if err != nil {
		return p, ErrNotFound
	}
	return p, nil
}

func (r *Repo) GetSellerProfile(ctx context.Context, id string) (models.SellerProfile, error) {
	var p models.SellerProfile
	err := r.pool.QueryRow(ctx, `
		SELECT id,user_id,shop_name,shop_slug,shop_description,shop_banner_url,total_sales,total_revenue,payout_method,payout_details,approved,created_at
		FROM seller_profiles
		WHERE id=$1
	`, id).Scan(&p.ID, &p.UserID, &p.ShopName, &p.ShopSlug, &p.ShopDescription, &p.ShopBannerURL,
		&p.TotalSales, &p.TotalRevenue, &p.PayoutMethod, &p.PayoutDetails, &p.Approved, &p.CreatedAt)
	if err != nil {
		return p, ErrNotFound
	}
	return p, nil
}

func (r *Repo) ListSellerCoupons(ctx context.Context, sellerID string) ([]models.Coupon, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id,seller_id,code,discount_type,discount_value,max_uses,uses_count,product_id,expires_at,is_active,created_at
		FROM coupons
		WHERE seller_id=$1 OR seller_id IS NULL
		ORDER BY created_at DESC
	`, sellerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.Coupon
	for rows.Next() {
		var c models.Coupon
		if err := rows.Scan(&c.ID, &c.SellerID, &c.Code, &c.DiscountType, &c.DiscountValue, &c.MaxUses, &c.UsesCount, &c.ProductID, &c.ExpiresAt, &c.IsActive, &c.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, nil
}

func (r *Repo) ListCoupons(ctx context.Context) ([]models.Coupon, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id,seller_id,code,discount_type,discount_value,max_uses,uses_count,product_id,expires_at,is_active,created_at
		FROM coupons
		ORDER BY created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.Coupon
	for rows.Next() {
		var c models.Coupon
		if err := rows.Scan(&c.ID, &c.SellerID, &c.Code, &c.DiscountType, &c.DiscountValue, &c.MaxUses, &c.UsesCount, &c.ProductID, &c.ExpiresAt, &c.IsActive, &c.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, nil
}

func (r *Repo) GetCouponByCode(ctx context.Context, code string) (models.Coupon, error) {
	var c models.Coupon
	err := r.pool.QueryRow(ctx, `
		SELECT id,seller_id,code,discount_type,discount_value,max_uses,uses_count,product_id,expires_at,is_active,created_at
		FROM coupons
		WHERE code=$1
	`, strings.ToUpper(strings.TrimSpace(code))).Scan(&c.ID, &c.SellerID, &c.Code, &c.DiscountType, &c.DiscountValue,
		&c.MaxUses, &c.UsesCount, &c.ProductID, &c.ExpiresAt, &c.IsActive, &c.CreatedAt)
	if err != nil {
		return c, ErrNotFound
	}
	return c, nil
}

func (r *Repo) ConsumeCoupon(ctx context.Context, couponID string) error {
	var used int
	err := r.pool.QueryRow(ctx, `
		UPDATE coupons
		SET uses_count = uses_count + 1
		WHERE id=$1
			AND is_active = true
			AND (max_uses IS NULL OR uses_count < max_uses)
			AND (expires_at IS NULL OR expires_at > NOW())
		RETURNING uses_count
	`, couponID).Scan(&used)
	if err != nil {
		return ErrNotFound
	}
	_ = used
	return nil
}

func (r *Repo) CreateCoupon(ctx context.Context, coupon *models.Coupon) error {
	return r.pool.QueryRow(ctx, `
		INSERT INTO coupons (seller_id, code, discount_type, discount_value, max_uses, product_id, expires_at, is_active)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
		RETURNING id, created_at
	`, coupon.SellerID, coupon.Code, coupon.DiscountType, coupon.DiscountValue, coupon.MaxUses, coupon.ProductID, coupon.ExpiresAt, coupon.IsActive).
		Scan(&coupon.ID, &coupon.CreatedAt)
}

func (r *Repo) UpdateCoupon(ctx context.Context, coupon *models.Coupon) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE coupons
		SET code=$1, discount_type=$2, discount_value=$3, max_uses=$4, product_id=$5, expires_at=$6, is_active=$7
		WHERE id=$8
	`, coupon.Code, coupon.DiscountType, coupon.DiscountValue, coupon.MaxUses, coupon.ProductID, coupon.ExpiresAt, coupon.IsActive, coupon.ID)
	return err
}

func (r *Repo) DeleteCoupon(ctx context.Context, id string) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM coupons WHERE id=$1`, id)
	return err
}

func (r *Repo) ListOrdersBySeller(ctx context.Context, sellerID string) ([]models.Order, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id,buyer_id,product_id,product_version_id,seller_id,amount,platform_fee,seller_earnings,currency,payment_method,payment_id,status,license_key,created_at
		FROM orders WHERE seller_id=$1 AND status IN ('completed', 'refunded') ORDER BY created_at DESC
	`, sellerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var orders []models.Order
	for rows.Next() {
		var order models.Order
		var pv, pm, pid *string
		if err := rows.Scan(&order.ID, &order.BuyerID, &order.ProductID, &pv, &order.SellerID, &order.Amount, &order.PlatformFee, &order.SellerEarnings,
			&order.Currency, &pm, &pid, &order.Status, &order.LicenseKey, &order.CreatedAt); err != nil {
			return nil, err
		}
		order.ProductVersionID = pv
		order.PaymentMethod = pm
		order.PaymentID = pid
		orders = append(orders, order)
	}
	return orders, nil
}

func (r *Repo) CreatePayoutRequest(ctx context.Context, pr *models.PayoutRequest) error {
	return r.pool.QueryRow(ctx, `
		INSERT INTO payout_requests (seller_id, amount, method, notes, status)
		VALUES ($1,$2,$3,$4,'pending')
		RETURNING id, created_at
	`, pr.SellerID, pr.Amount, pr.Method, pr.Notes).Scan(&pr.ID, &pr.CreatedAt)
}

func (r *Repo) ListSellerWebhooks(ctx context.Context, sellerID string) ([]models.Webhook, error) {
	rows, err := r.pool.Query(ctx, `SELECT id,seller_id,url,secret,events,is_active,created_at FROM webhooks WHERE seller_id=$1`, sellerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.Webhook
	for rows.Next() {
		var w models.Webhook
		if err := rows.Scan(&w.ID, &w.SellerID, &w.URL, &w.Secret, &w.Events, &w.IsActive, &w.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, w)
	}
	return out, nil
}

func (r *Repo) ListActiveWebhooksByEvent(ctx context.Context, sellerID, event string) ([]models.Webhook, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id,seller_id,url,secret,events,is_active,created_at
		FROM webhooks
		WHERE seller_id=$1 AND is_active=true AND $2 = ANY(events)
	`, sellerID, event)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []models.Webhook
	for rows.Next() {
		var w models.Webhook
		if err := rows.Scan(&w.ID, &w.SellerID, &w.URL, &w.Secret, &w.Events, &w.IsActive, &w.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, w)
	}
	return out, nil
}

func (r *Repo) CreateWebhook(ctx context.Context, webhook *models.Webhook) error {
	return r.pool.QueryRow(ctx, `
		INSERT INTO webhooks (seller_id,url,secret,events,is_active)
		VALUES ($1,$2,$3,$4,true)
		RETURNING id, created_at
	`, webhook.SellerID, webhook.URL, webhook.Secret, webhook.Events).Scan(&webhook.ID, &webhook.CreatedAt)
}

func (r *Repo) DeleteWebhook(ctx context.Context, sellerID, webhookID string) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM webhooks WHERE id=$1 AND seller_id=$2`, webhookID, sellerID)
	return err
}

func (r *Repo) ListConversations(ctx context.Context, userID string) ([]models.Conversation, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT c.id,c.title,c.creator_id,c.is_open,c.context_type,c.context_id,
		       cp.is_unread,
		       (SELECT COUNT(*) FROM conversation_participants p WHERE p.conversation_id=c.id AND p.left_at IS NULL)::INT,
		       (SELECT COUNT(*) FROM conversation_messages m WHERE m.conversation_id=c.id AND m.deleted_at IS NULL)::INT,
		       c.last_message_at,c.created_at,c.updated_at,
		       lm.id,lm.user_id,u.username,u.display_name,u.avatar_url,lm.body,lm.is_system,lm.created_at,lm.updated_at,lm.deleted_at
		FROM conversation_participants cp
		JOIN conversations c ON c.id=cp.conversation_id
		LEFT JOIN LATERAL (
			SELECT *
			FROM conversation_messages
			WHERE conversation_id=c.id AND deleted_at IS NULL
			ORDER BY created_at DESC
			LIMIT 1
		) lm ON true
		LEFT JOIN users u ON u.id=lm.user_id
		WHERE cp.user_id=$1 AND cp.left_at IS NULL
		ORDER BY c.last_message_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var conversations []models.Conversation
	for rows.Next() {
		var conversation models.Conversation
		var last models.ConversationMessage
		var lastID, lastBody *string
		if err := rows.Scan(
			&conversation.ID, &conversation.Title, &conversation.CreatorID, &conversation.IsOpen, &conversation.ContextType, &conversation.ContextID,
			&conversation.IsUnread, &conversation.ParticipantCount, &conversation.MessageCount,
			&conversation.LastMessageAt, &conversation.CreatedAt, &conversation.UpdatedAt,
			&lastID, &last.UserID, &last.Username, &last.DisplayName, &last.AvatarURL, &lastBody, &last.IsSystem, &last.CreatedAt, &last.UpdatedAt, &last.DeletedAt,
		); err != nil {
			return nil, err
		}
		if lastID != nil && lastBody != nil {
			last.ID = *lastID
			last.ConversationID = conversation.ID
			last.Body = *lastBody
			conversation.LastMessage = &last
		}
		conversations = append(conversations, conversation)
	}
	return conversations, rows.Err()
}

func (r *Repo) GetConversation(ctx context.Context, conversationID, userID string) (models.Conversation, error) {
	var conversation models.Conversation
	err := r.pool.QueryRow(ctx, `
		SELECT c.id,c.title,c.creator_id,c.is_open,c.context_type,c.context_id,
		       cp.is_unread,
		       (SELECT COUNT(*) FROM conversation_participants p WHERE p.conversation_id=c.id AND p.left_at IS NULL)::INT,
		       (SELECT COUNT(*) FROM conversation_messages m WHERE m.conversation_id=c.id AND m.deleted_at IS NULL)::INT,
		       c.last_message_at,c.created_at,c.updated_at
		FROM conversations c
		JOIN conversation_participants cp ON cp.conversation_id=c.id AND cp.user_id=$2 AND cp.left_at IS NULL
		WHERE c.id=$1
	`, conversationID, userID).Scan(
		&conversation.ID, &conversation.Title, &conversation.CreatorID, &conversation.IsOpen, &conversation.ContextType, &conversation.ContextID,
		&conversation.IsUnread, &conversation.ParticipantCount, &conversation.MessageCount,
		&conversation.LastMessageAt, &conversation.CreatedAt, &conversation.UpdatedAt,
	)
	if err != nil {
		return conversation, ErrNotFound
	}

	participants, err := r.ListConversationParticipants(ctx, conversationID)
	if err != nil {
		return conversation, err
	}
	messages, err := r.ListConversationMessages(ctx, conversationID, userID)
	if err != nil {
		return conversation, err
	}
	conversation.Participants = participants
	if len(messages) > 0 {
		conversation.LastMessage = &messages[len(messages)-1]
	}
	return conversation, nil
}

func (r *Repo) ListConversationParticipants(ctx context.Context, conversationID string) ([]models.ConversationParticipant, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT u.id,u.username,u.display_name,u.avatar_url,cp.role,cp.is_unread,cp.last_read_at,cp.left_at
		FROM conversation_participants cp
		JOIN users u ON u.id=cp.user_id
		WHERE cp.conversation_id=$1
		ORDER BY cp.created_at ASC
	`, conversationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var participants []models.ConversationParticipant
	for rows.Next() {
		var participant models.ConversationParticipant
		if err := rows.Scan(&participant.UserID, &participant.Username, &participant.DisplayName, &participant.AvatarURL, &participant.Role, &participant.IsUnread, &participant.LastReadAt, &participant.LeftAt); err != nil {
			return nil, err
		}
		participants = append(participants, participant)
	}
	return participants, rows.Err()
}

func (r *Repo) ListConversationMessages(ctx context.Context, conversationID, userID string) ([]models.ConversationMessage, error) {
	var allowed bool
	if err := r.pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM conversation_participants
			WHERE conversation_id=$1 AND user_id=$2 AND left_at IS NULL
		)
	`, conversationID, userID).Scan(&allowed); err != nil || !allowed {
		return nil, ErrNotFound
	}
	rows, err := r.pool.Query(ctx, `
		SELECT m.id,m.conversation_id,m.user_id,u.username,u.display_name,u.avatar_url,m.body,m.is_system,m.created_at,m.updated_at,m.deleted_at
		FROM conversation_messages m
		LEFT JOIN users u ON u.id=m.user_id
		WHERE m.conversation_id=$1 AND m.deleted_at IS NULL
		ORDER BY m.created_at ASC
	`, conversationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var messages []models.ConversationMessage
	for rows.Next() {
		var message models.ConversationMessage
		if err := rows.Scan(&message.ID, &message.ConversationID, &message.UserID, &message.Username, &message.DisplayName, &message.AvatarURL, &message.Body, &message.IsSystem, &message.CreatedAt, &message.UpdatedAt, &message.DeletedAt); err != nil {
			return nil, err
		}
		messages = append(messages, message)
	}
	return messages, rows.Err()
}

func (r *Repo) CreateConversation(ctx context.Context, creatorID, title, body string, recipientIDs []string, contextType *string, contextID *string) (models.Conversation, error) {
	seen := map[string]bool{creatorID: true}
	participants := []string{creatorID}
	for _, recipientID := range recipientIDs {
		recipientID = strings.TrimSpace(recipientID)
		if recipientID == "" || seen[recipientID] {
			continue
		}
		seen[recipientID] = true
		participants = append(participants, recipientID)
	}
	if len(participants) < 2 {
		return models.Conversation{}, ErrUnavailable
	}

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return models.Conversation{}, err
	}
	defer tx.Rollback(ctx)

	var conversationID string
	if err := tx.QueryRow(ctx, `
		INSERT INTO conversations (title, creator_id, context_type, context_id)
		VALUES ($1,$2,$3,$4)
		RETURNING id
	`, title, creatorID, contextType, contextID).Scan(&conversationID); err != nil {
		return models.Conversation{}, err
	}

	for _, participantID := range participants {
		role := "participant"
		unread := true
		var lastReadAt *time.Time
		if participantID == creatorID {
			role = "creator"
			unread = false
			now := time.Now().UTC()
			lastReadAt = &now
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO conversation_participants (conversation_id, user_id, role, is_unread, last_read_at)
			VALUES ($1,$2,$3,$4,$5)
		`, conversationID, participantID, role, unread, lastReadAt); err != nil {
			return models.Conversation{}, err
		}
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO conversation_messages (conversation_id, user_id, body)
		VALUES ($1,$2,$3)
	`, conversationID, creatorID, body); err != nil {
		return models.Conversation{}, err
	}

	if _, err := tx.Exec(ctx, `
		UPDATE conversations
		SET last_message_at=now(), updated_at=now()
		WHERE id=$1
	`, conversationID); err != nil {
		return models.Conversation{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return models.Conversation{}, err
	}
	return r.GetConversation(ctx, conversationID, creatorID)
}

func (r *Repo) AddConversationMessage(ctx context.Context, conversationID, userID, body string) (models.ConversationMessage, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return models.ConversationMessage{}, err
	}
	defer tx.Rollback(ctx)

	var isOpen bool
	if err := tx.QueryRow(ctx, `
		SELECT c.is_open
		FROM conversations c
		JOIN conversation_participants cp ON cp.conversation_id=c.id AND cp.user_id=$2 AND cp.left_at IS NULL
		WHERE c.id=$1
	`, conversationID, userID).Scan(&isOpen); err != nil {
		return models.ConversationMessage{}, ErrNotFound
	}
	if !isOpen {
		return models.ConversationMessage{}, ErrUnavailable
	}

	var message models.ConversationMessage
	err = tx.QueryRow(ctx, `
		INSERT INTO conversation_messages (conversation_id, user_id, body)
		VALUES ($1,$2,$3)
		RETURNING id, conversation_id, user_id, body, is_system, created_at, updated_at, deleted_at
	`, conversationID, userID, body).Scan(&message.ID, &message.ConversationID, &message.UserID, &message.Body, &message.IsSystem, &message.CreatedAt, &message.UpdatedAt, &message.DeletedAt)
	if err != nil {
		return models.ConversationMessage{}, err
	}
	if _, err := tx.Exec(ctx, `UPDATE conversations SET last_message_at=$1, updated_at=$1 WHERE id=$2`, message.CreatedAt, conversationID); err != nil {
		return models.ConversationMessage{}, err
	}
	if _, err := tx.Exec(ctx, `
		UPDATE conversation_participants
		SET is_unread = user_id <> $2,
		    last_read_at = CASE WHEN user_id=$2 THEN $3 ELSE last_read_at END,
		    left_at = NULL
		WHERE conversation_id=$1
	`, conversationID, userID, message.CreatedAt); err != nil {
		return models.ConversationMessage{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return models.ConversationMessage{}, err
	}
	return message, nil
}

func (r *Repo) MarkConversationRead(ctx context.Context, conversationID, userID string) error {
	cmd, err := r.pool.Exec(ctx, `
		UPDATE conversation_participants
		SET is_unread=false, last_read_at=now()
		WHERE conversation_id=$1 AND user_id=$2 AND left_at IS NULL
	`, conversationID, userID)
	if err != nil {
		return err
	}
	if cmd.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Repo) LeaveConversation(ctx context.Context, conversationID, userID string) error {
	cmd, err := r.pool.Exec(ctx, `
		UPDATE conversation_participants
		SET is_unread=false, left_at=now()
		WHERE conversation_id=$1 AND user_id=$2 AND left_at IS NULL
	`, conversationID, userID)
	if err != nil {
		return err
	}
	if cmd.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Repo) SetConversationOpen(ctx context.Context, conversationID string, open bool) error {
	cmd, err := r.pool.Exec(ctx, `UPDATE conversations SET is_open=$1, updated_at=now() WHERE id=$2`, open, conversationID)
	if err != nil {
		return err
	}
	if cmd.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Repo) ListUsersByRoles(ctx context.Context, roles []string) ([]models.User, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, COALESCE(external_id, ''), username, display_name, email, password_hash, role, is_verified, is_banned,
		       avatar_url, profile_banner_url, bio, website_url, discord_tag, balance, created_at, updated_at
		FROM users
		WHERE role = ANY($1) AND is_banned=false
	`, roles)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var users []models.User
	for rows.Next() {
		var user models.User
		if err := rows.Scan(
			&user.ID, &user.ExternalID, &user.Username, &user.DisplayName, &user.Email, &user.PasswordHash, &user.Role, &user.IsVerified, &user.IsBanned,
			&user.AvatarURL, &user.ProfileBannerURL, &user.Bio, &user.WebsiteURL, &user.DiscordTag, &user.Balance, &user.CreatedAt, &user.UpdatedAt,
		); err != nil {
			return nil, err
		}
		users = append(users, user)
	}
	return users, rows.Err()
}

type ListSupportTicketsFilter struct {
	UserID     string
	Role       string
	Scope      string
	StatusSlug string
}

func isSupportStaffRole(role string) bool {
	return role == "admin" || role == "staff"
}

func (r *Repo) ListSupportTicketCategories(ctx context.Context) ([]models.SupportTicketCategory, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id,parent_id,name,slug,description,sort_order,is_active,allow_customer_open,created_at
		FROM support_ticket_categories
		WHERE is_active=true
		ORDER BY COALESCE(parent_id,id),sort_order,name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var categories []models.SupportTicketCategory
	for rows.Next() {
		var category models.SupportTicketCategory
		if err := rows.Scan(&category.ID, &category.ParentID, &category.Name, &category.Slug, &category.Description, &category.SortOrder, &category.IsActive, &category.AllowCustomerOpen, &category.CreatedAt); err != nil {
			return nil, err
		}
		categories = append(categories, category)
	}
	return categories, rows.Err()
}

func (r *Repo) ListAdminSupportTicketCategories(ctx context.Context) ([]models.SupportTicketCategory, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id,parent_id,name,slug,description,sort_order,is_active,allow_customer_open,created_at
		FROM support_ticket_categories
		ORDER BY COALESCE(parent_id,id),sort_order,name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var categories []models.SupportTicketCategory
	for rows.Next() {
		var category models.SupportTicketCategory
		if err := rows.Scan(&category.ID, &category.ParentID, &category.Name, &category.Slug, &category.Description, &category.SortOrder, &category.IsActive, &category.AllowCustomerOpen, &category.CreatedAt); err != nil {
			return nil, err
		}
		categories = append(categories, category)
	}
	return categories, rows.Err()
}

func (r *Repo) ListSupportTicketStatuses(ctx context.Context) ([]models.SupportTicketStatus, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id,slug,name,is_closed,status_on_customer_reply,status_on_staff_reply,include_in_counts,sort_order,created_at
		FROM support_ticket_statuses
		ORDER BY sort_order,name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var statuses []models.SupportTicketStatus
	for rows.Next() {
		var status models.SupportTicketStatus
		if err := rows.Scan(&status.ID, &status.Slug, &status.Name, &status.IsClosed, &status.StatusOnCustomerReply, &status.StatusOnStaffReply, &status.IncludeInCounts, &status.SortOrder, &status.CreatedAt); err != nil {
			return nil, err
		}
		statuses = append(statuses, status)
	}
	return statuses, rows.Err()
}

func (r *Repo) ListSupportTicketPriorities(ctx context.Context) ([]models.SupportTicketPriority, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id,slug,name,sort_order,is_active,created_at
		FROM support_ticket_priorities
		WHERE is_active=true
		ORDER BY sort_order,name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var priorities []models.SupportTicketPriority
	for rows.Next() {
		var priority models.SupportTicketPriority
		if err := rows.Scan(&priority.ID, &priority.Slug, &priority.Name, &priority.SortOrder, &priority.IsActive, &priority.CreatedAt); err != nil {
			return nil, err
		}
		priorities = append(priorities, priority)
	}
	return priorities, rows.Err()
}

func (r *Repo) ListAdminSupportTicketPriorities(ctx context.Context) ([]models.SupportTicketPriority, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id,slug,name,sort_order,is_active,created_at
		FROM support_ticket_priorities
		ORDER BY sort_order,name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var priorities []models.SupportTicketPriority
	for rows.Next() {
		var priority models.SupportTicketPriority
		if err := rows.Scan(&priority.ID, &priority.Slug, &priority.Name, &priority.SortOrder, &priority.IsActive, &priority.CreatedAt); err != nil {
			return nil, err
		}
		priorities = append(priorities, priority)
	}
	return priorities, rows.Err()
}

func (r *Repo) SaveSupportTicketCategory(ctx context.Context, category *models.SupportTicketCategory) error {
	if category.ID == "" {
		err := r.pool.QueryRow(ctx, `
			INSERT INTO support_ticket_categories (parent_id,name,slug,description,sort_order,is_active,allow_customer_open)
			VALUES ($1,$2,$3,$4,$5,$6,$7)
			RETURNING id,created_at
		`, category.ParentID, category.Name, category.Slug, category.Description, category.SortOrder, category.IsActive, category.AllowCustomerOpen).Scan(&category.ID, &category.CreatedAt)
		if err != nil {
			if isUniqueViolation(err) {
				return ErrConflict
			}
			return err
		}
		return nil
	}
	tag, err := r.pool.Exec(ctx, `
		UPDATE support_ticket_categories
		SET parent_id=$2,name=$3,slug=$4,description=$5,sort_order=$6,is_active=$7,allow_customer_open=$8
		WHERE id=$1
	`, category.ID, category.ParentID, category.Name, category.Slug, category.Description, category.SortOrder, category.IsActive, category.AllowCustomerOpen)
	if err != nil {
		if isUniqueViolation(err) {
			return ErrConflict
		}
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Repo) SaveSupportTicketStatus(ctx context.Context, status *models.SupportTicketStatus) error {
	if status.ID == "" {
		err := r.pool.QueryRow(ctx, `
			INSERT INTO support_ticket_statuses (slug,name,is_closed,status_on_customer_reply,status_on_staff_reply,include_in_counts,sort_order)
			VALUES ($1,$2,$3,$4,$5,$6,$7)
			RETURNING id,created_at
		`, status.Slug, status.Name, status.IsClosed, status.StatusOnCustomerReply, status.StatusOnStaffReply, status.IncludeInCounts, status.SortOrder).Scan(&status.ID, &status.CreatedAt)
		if err != nil {
			if isUniqueViolation(err) {
				return ErrConflict
			}
			return err
		}
		return nil
	}
	tag, err := r.pool.Exec(ctx, `
		UPDATE support_ticket_statuses
		SET slug=$2,name=$3,is_closed=$4,status_on_customer_reply=$5,status_on_staff_reply=$6,include_in_counts=$7,sort_order=$8
		WHERE id=$1
	`, status.ID, status.Slug, status.Name, status.IsClosed, status.StatusOnCustomerReply, status.StatusOnStaffReply, status.IncludeInCounts, status.SortOrder)
	if err != nil {
		if isUniqueViolation(err) {
			return ErrConflict
		}
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Repo) SaveSupportTicketPriority(ctx context.Context, priority *models.SupportTicketPriority) error {
	if priority.ID == "" {
		err := r.pool.QueryRow(ctx, `
			INSERT INTO support_ticket_priorities (slug,name,sort_order,is_active)
			VALUES ($1,$2,$3,$4)
			RETURNING id,created_at
		`, priority.Slug, priority.Name, priority.SortOrder, priority.IsActive).Scan(&priority.ID, &priority.CreatedAt)
		if err != nil {
			if isUniqueViolation(err) {
				return ErrConflict
			}
			return err
		}
		return nil
	}
	tag, err := r.pool.Exec(ctx, `
		UPDATE support_ticket_priorities
		SET slug=$2,name=$3,sort_order=$4,is_active=$5
		WHERE id=$1
	`, priority.ID, priority.Slug, priority.Name, priority.SortOrder, priority.IsActive)
	if err != nil {
		if isUniqueViolation(err) {
			return ErrConflict
		}
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Repo) DeleteSupportTicketConfig(ctx context.Context, kind, id string) error {
	var sql string
	switch kind {
	case "category":
		sql = "DELETE FROM support_ticket_categories WHERE id=$1"
	case "status":
		sql = "DELETE FROM support_ticket_statuses WHERE id=$1"
	case "priority":
		sql = "DELETE FROM support_ticket_priorities WHERE id=$1"
	default:
		return ErrNotFound
	}
	tag, err := r.pool.Exec(ctx, sql, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Repo) ListSupportTicketFeatureConfigs(ctx context.Context) ([]models.SupportTicketFeatureConfig, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id,feature_type,title,slug,body,config,is_active,sort_order,created_at,updated_at
		FROM support_ticket_feature_configs
		ORDER BY feature_type,sort_order,title
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []models.SupportTicketFeatureConfig
	for rows.Next() {
		var item models.SupportTicketFeatureConfig
		var configBytes []byte
		if err := rows.Scan(&item.ID, &item.FeatureType, &item.Title, &item.Slug, &item.Body, &configBytes, &item.IsActive, &item.SortOrder, &item.CreatedAt, &item.UpdatedAt); err != nil {
			return nil, err
		}
		if len(configBytes) > 0 {
			_ = json.Unmarshal(configBytes, &item.Config)
		}
		if item.Config == nil {
			item.Config = map[string]any{}
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *Repo) SaveSupportTicketFeatureConfig(ctx context.Context, item *models.SupportTicketFeatureConfig) error {
	configBytes, err := json.Marshal(item.Config)
	if err != nil {
		return err
	}
	if item.ID == "" {
		err := r.pool.QueryRow(ctx, `
			INSERT INTO support_ticket_feature_configs (feature_type,title,slug,body,config,is_active,sort_order)
			VALUES ($1,$2,$3,$4,$5,$6,$7)
			RETURNING id,created_at,updated_at
		`, item.FeatureType, item.Title, item.Slug, item.Body, configBytes, item.IsActive, item.SortOrder).Scan(&item.ID, &item.CreatedAt, &item.UpdatedAt)
		if err != nil {
			if isUniqueViolation(err) {
				return ErrConflict
			}
			return err
		}
		return nil
	}
	tag, err := r.pool.Exec(ctx, `
		UPDATE support_ticket_feature_configs
		SET feature_type=$2,title=$3,slug=$4,body=$5,config=$6,is_active=$7,sort_order=$8,updated_at=now()
		WHERE id=$1
	`, item.ID, item.FeatureType, item.Title, item.Slug, item.Body, configBytes, item.IsActive, item.SortOrder)
	if err != nil {
		if isUniqueViolation(err) {
			return ErrConflict
		}
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Repo) DeleteSupportTicketFeatureConfig(ctx context.Context, id string) error {
	tag, err := r.pool.Exec(ctx, `DELETE FROM support_ticket_feature_configs WHERE id=$1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Repo) ListSupportTickets(ctx context.Context, filter ListSupportTicketsFilter) ([]models.SupportTicket, error) {
	args := []any{filter.UserID}
	where := []string{"1=1"}
	if !isSupportStaffRole(filter.Role) || filter.Scope != "all" {
		where = append(where, `EXISTS (
			SELECT 1 FROM support_ticket_participants access
			WHERE access.ticket_id=t.id AND access.user_id=$1 AND access.left_at IS NULL
		)`)
	}
	if strings.TrimSpace(filter.StatusSlug) != "" {
		args = append(args, strings.TrimSpace(filter.StatusSlug))
		where = append(where, fmt.Sprintf("s.slug=$%d", len(args)))
	}
	query := fmt.Sprintf(`
		SELECT t.id,t.ticket_ref,t.title,t.user_id,t.category_id,t.status_id,t.priority_id,t.assigned_user_id,t.product_id,t.order_id,
		       t.is_locked,t.first_message_id,t.last_message_id,t.last_message_at,t.last_message_user_id,t.reply_count,t.closed_at,t.created_at,t.updated_at,
		       COALESCE(me.is_unread,false),
		       c.id,c.parent_id,COALESCE(c.name,''),COALESCE(c.slug,''),c.description,COALESCE(c.sort_order,0),COALESCE(c.is_active,false),COALESCE(c.allow_customer_open,false),COALESCE(c.created_at,now()),
		       s.id,COALESCE(s.slug,''),COALESCE(s.name,''),COALESCE(s.is_closed,false),s.status_on_customer_reply,s.status_on_staff_reply,COALESCE(s.include_in_counts,false),COALESCE(s.sort_order,0),COALESCE(s.created_at,now()),
		       p.id,COALESCE(p.slug,''),COALESCE(p.name,''),COALESCE(p.sort_order,0),COALESCE(p.is_active,false),COALESCE(p.created_at,now()),
		       lm.id,COALESCE(lm.ticket_id::text,''),lm.user_id,lu.username,lu.display_name,lu.avatar_url,COALESCE(lm.body,''),COALESCE(lm.is_system,false),COALESCE(lm.created_at,now()),COALESCE(lm.updated_at,now()),lm.deleted_at
		FROM support_tickets t
		LEFT JOIN support_ticket_participants me ON me.ticket_id=t.id AND me.user_id=$1
		LEFT JOIN support_ticket_categories c ON c.id=t.category_id
		LEFT JOIN support_ticket_statuses s ON s.id=t.status_id
		LEFT JOIN support_ticket_priorities p ON p.id=t.priority_id
		LEFT JOIN support_ticket_messages lm ON lm.id=t.last_message_id
		LEFT JOIN users lu ON lu.id=lm.user_id
		WHERE %s
		ORDER BY t.last_message_at DESC,t.created_at DESC
	`, strings.Join(where, " AND "))
	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var tickets []models.SupportTicket
	for rows.Next() {
		ticket, err := scanSupportTicket(rows)
		if err != nil {
			return nil, err
		}
		tickets = append(tickets, ticket)
	}
	return tickets, rows.Err()
}

func (r *Repo) GetSupportTicket(ctx context.Context, ticketID, userID, role string) (models.SupportTicket, error) {
	var allowed bool
	if isSupportStaffRole(role) {
		allowed = true
	} else if err := r.pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM support_ticket_participants
			WHERE ticket_id=$1 AND user_id=$2 AND left_at IS NULL
		)
	`, ticketID, userID).Scan(&allowed); err != nil || !allowed {
		return models.SupportTicket{}, ErrNotFound
	}
	row := r.pool.QueryRow(ctx, `
		SELECT t.id,t.ticket_ref,t.title,t.user_id,t.category_id,t.status_id,t.priority_id,t.assigned_user_id,t.product_id,t.order_id,
		       t.is_locked,t.first_message_id,t.last_message_id,t.last_message_at,t.last_message_user_id,t.reply_count,t.closed_at,t.created_at,t.updated_at,
		       COALESCE(me.is_unread,false),
		       c.id,c.parent_id,COALESCE(c.name,''),COALESCE(c.slug,''),c.description,COALESCE(c.sort_order,0),COALESCE(c.is_active,false),COALESCE(c.allow_customer_open,false),COALESCE(c.created_at,now()),
		       s.id,COALESCE(s.slug,''),COALESCE(s.name,''),COALESCE(s.is_closed,false),s.status_on_customer_reply,s.status_on_staff_reply,COALESCE(s.include_in_counts,false),COALESCE(s.sort_order,0),COALESCE(s.created_at,now()),
		       p.id,COALESCE(p.slug,''),COALESCE(p.name,''),COALESCE(p.sort_order,0),COALESCE(p.is_active,false),COALESCE(p.created_at,now()),
		       lm.id,COALESCE(lm.ticket_id::text,''),lm.user_id,lu.username,lu.display_name,lu.avatar_url,COALESCE(lm.body,''),COALESCE(lm.is_system,false),COALESCE(lm.created_at,now()),COALESCE(lm.updated_at,now()),lm.deleted_at
		FROM support_tickets t
		LEFT JOIN support_ticket_participants me ON me.ticket_id=t.id AND me.user_id=$2
		LEFT JOIN support_ticket_categories c ON c.id=t.category_id
		LEFT JOIN support_ticket_statuses s ON s.id=t.status_id
		LEFT JOIN support_ticket_priorities p ON p.id=t.priority_id
		LEFT JOIN support_ticket_messages lm ON lm.id=t.last_message_id
		LEFT JOIN users lu ON lu.id=lm.user_id
		WHERE t.id=$1
	`, ticketID, userID)
	ticket, err := scanSupportTicket(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ticket, ErrNotFound
		}
		return ticket, err
	}
	participants, err := r.ListSupportTicketParticipants(ctx, ticket.ID)
	if err != nil {
		return ticket, err
	}
	ticket.Participants = participants
	return ticket, nil
}

func scanSupportTicket(row pgx.Row) (models.SupportTicket, error) {
	var ticket models.SupportTicket
	var category models.SupportTicketCategory
	var status models.SupportTicketStatus
	var priority models.SupportTicketPriority
	var last models.SupportTicketMessage
	var categoryID, statusID, priorityID, lastID *string
	if err := row.Scan(
		&ticket.ID, &ticket.TicketRef, &ticket.Title, &ticket.UserID, &ticket.CategoryID, &ticket.StatusID, &ticket.PriorityID, &ticket.AssignedUserID, &ticket.ProductID, &ticket.OrderID,
		&ticket.IsLocked, &ticket.FirstMessageID, &ticket.LastMessageID, &ticket.LastMessageAt, &ticket.LastMessageUserID, &ticket.ReplyCount, &ticket.ClosedAt, &ticket.CreatedAt, &ticket.UpdatedAt,
		&ticket.IsUnread,
		&categoryID, &category.ParentID, &category.Name, &category.Slug, &category.Description, &category.SortOrder, &category.IsActive, &category.AllowCustomerOpen, &category.CreatedAt,
		&statusID, &status.Slug, &status.Name, &status.IsClosed, &status.StatusOnCustomerReply, &status.StatusOnStaffReply, &status.IncludeInCounts, &status.SortOrder, &status.CreatedAt,
		&priorityID, &priority.Slug, &priority.Name, &priority.SortOrder, &priority.IsActive, &priority.CreatedAt,
		&lastID, &last.TicketID, &last.UserID, &last.Username, &last.DisplayName, &last.AvatarURL, &last.Body, &last.IsSystem, &last.CreatedAt, &last.UpdatedAt, &last.DeletedAt,
	); err != nil {
		return ticket, err
	}
	if categoryID != nil {
		category.ID = *categoryID
		ticket.Category = &category
	}
	if statusID != nil {
		status.ID = *statusID
		ticket.Status = &status
	}
	if priorityID != nil {
		priority.ID = *priorityID
		ticket.Priority = &priority
	}
	if lastID != nil {
		last.ID = *lastID
		ticket.LastMessage = &last
	}
	return ticket, nil
}

func (r *Repo) ListSupportTicketParticipants(ctx context.Context, ticketID string) ([]models.SupportTicketParticipant, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT p.user_id,u.username,u.display_name,u.avatar_url,p.role,p.is_unread,p.last_read_at,p.left_at
		FROM support_ticket_participants p
		JOIN users u ON u.id=p.user_id
		WHERE p.ticket_id=$1
		ORDER BY p.created_at,u.username
	`, ticketID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var participants []models.SupportTicketParticipant
	for rows.Next() {
		var participant models.SupportTicketParticipant
		if err := rows.Scan(&participant.UserID, &participant.Username, &participant.DisplayName, &participant.AvatarURL, &participant.Role, &participant.IsUnread, &participant.LastReadAt, &participant.LeftAt); err != nil {
			return nil, err
		}
		participants = append(participants, participant)
	}
	return participants, rows.Err()
}

func (r *Repo) ListSupportTicketMessages(ctx context.Context, ticketID, userID, role string) ([]models.SupportTicketMessage, error) {
	if !isSupportStaffRole(role) {
		var allowed bool
		if err := r.pool.QueryRow(ctx, `
			SELECT EXISTS (
				SELECT 1 FROM support_ticket_participants
				WHERE ticket_id=$1 AND user_id=$2 AND left_at IS NULL
			)
		`, ticketID, userID).Scan(&allowed); err != nil || !allowed {
			return nil, ErrNotFound
		}
	}
	rows, err := r.pool.Query(ctx, `
		SELECT m.id,m.ticket_id,m.user_id,u.username,u.display_name,u.avatar_url,m.body,m.is_system,m.created_at,m.updated_at,m.deleted_at
		FROM support_ticket_messages m
		LEFT JOIN users u ON u.id=m.user_id
		WHERE m.ticket_id=$1 AND m.deleted_at IS NULL
		ORDER BY m.created_at,m.id
	`, ticketID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var messages []models.SupportTicketMessage
	for rows.Next() {
		var message models.SupportTicketMessage
		if err := rows.Scan(&message.ID, &message.TicketID, &message.UserID, &message.Username, &message.DisplayName, &message.AvatarURL, &message.Body, &message.IsSystem, &message.CreatedAt, &message.UpdatedAt, &message.DeletedAt); err != nil {
			return nil, err
		}
		messages = append(messages, message)
	}
	return messages, rows.Err()
}

func (r *Repo) CreateSupportTicket(ctx context.Context, userID, title, body string, categoryID, priorityID, productID, orderID *string) (models.SupportTicket, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return models.SupportTicket{}, err
	}
	defer tx.Rollback(ctx)

	if categoryID == nil {
		var defaultCategoryID string
		if err := tx.QueryRow(ctx, `SELECT id FROM support_ticket_categories WHERE slug='marketplace-support'`).Scan(&defaultCategoryID); err != nil {
			return models.SupportTicket{}, err
		}
		categoryID = &defaultCategoryID
	}
	if priorityID == nil {
		var defaultPriorityID string
		if err := tx.QueryRow(ctx, `SELECT id FROM support_ticket_priorities WHERE slug='normal'`).Scan(&defaultPriorityID); err != nil {
			return models.SupportTicket{}, err
		}
		priorityID = &defaultPriorityID
	}
	var statusID string
	if err := tx.QueryRow(ctx, `SELECT id FROM support_ticket_statuses WHERE slug='waiting_on_staff'`).Scan(&statusID); err != nil {
		return models.SupportTicket{}, err
	}
	var ticketID string
	ref := strings.ToUpper(strings.ReplaceAll(uuid.NewString()[:8], "-", ""))
	if err := tx.QueryRow(ctx, `
		INSERT INTO support_tickets (ticket_ref,title,user_id,category_id,status_id,priority_id,product_id,order_id,last_message_user_id)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$3)
		RETURNING id
	`, ref, title, userID, categoryID, statusID, priorityID, productID, orderID).Scan(&ticketID); err != nil {
		return models.SupportTicket{}, err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO support_ticket_participants (ticket_id,user_id,role,is_unread,last_read_at)
		VALUES ($1,$2,'starter',false,now())
	`, ticketID, userID); err != nil {
		return models.SupportTicket{}, err
	}
	if productID != nil {
		var sellerID string
		if err := tx.QueryRow(ctx, `SELECT seller_id FROM products WHERE id=$1`, *productID).Scan(&sellerID); err == nil && sellerID != "" && sellerID != userID {
			if _, err := tx.Exec(ctx, `
				INSERT INTO support_ticket_participants (ticket_id,user_id,role,is_unread)
				VALUES ($1,$2,'seller',true)
				ON CONFLICT (ticket_id,user_id) DO NOTHING
			`, ticketID, sellerID); err != nil {
				return models.SupportTicket{}, err
			}
		}
	}
	var messageID string
	var messageAt time.Time
	if err := tx.QueryRow(ctx, `
		INSERT INTO support_ticket_messages (ticket_id,user_id,body)
		VALUES ($1,$2,$3)
		RETURNING id,created_at
	`, ticketID, userID, body).Scan(&messageID, &messageAt); err != nil {
		return models.SupportTicket{}, err
	}
	if _, err := tx.Exec(ctx, `
		UPDATE support_tickets
		SET first_message_id=$1,last_message_id=$1,last_message_at=$2,last_message_user_id=$3,updated_at=$2
		WHERE id=$4
	`, messageID, messageAt, userID, ticketID); err != nil {
		return models.SupportTicket{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return models.SupportTicket{}, err
	}
	return r.GetSupportTicket(ctx, ticketID, userID, "buyer")
}

func (r *Repo) AddSupportTicketMessage(ctx context.Context, ticketID, userID, role, body string) (models.SupportTicketMessage, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return models.SupportTicketMessage{}, err
	}
	defer tx.Rollback(ctx)

	var isLocked bool
	var isClosed bool
	var customerNext *string
	var staffNext *string
	err = tx.QueryRow(ctx, `
		SELECT t.is_locked,COALESCE(s.is_closed,false),s.status_on_customer_reply,s.status_on_staff_reply
		FROM support_tickets t
		LEFT JOIN support_ticket_statuses s ON s.id=t.status_id
		WHERE t.id=$1
		FOR UPDATE OF t
	`, ticketID).Scan(&isLocked, &isClosed, &customerNext, &staffNext)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return models.SupportTicketMessage{}, ErrNotFound
		}
		return models.SupportTicketMessage{}, err
	}
	if !isSupportStaffRole(role) {
		var allowed bool
		if err := tx.QueryRow(ctx, `
			SELECT EXISTS (
				SELECT 1 FROM support_ticket_participants
				WHERE ticket_id=$1 AND user_id=$2 AND left_at IS NULL
			)
		`, ticketID, userID).Scan(&allowed); err != nil || !allowed {
			return models.SupportTicketMessage{}, ErrNotFound
		}
	}
	if isLocked || isClosed {
		return models.SupportTicketMessage{}, ErrUnavailable
	}
	var message models.SupportTicketMessage
	if err := tx.QueryRow(ctx, `
		INSERT INTO support_ticket_messages (ticket_id,user_id,body)
		VALUES ($1,$2,$3)
		RETURNING id,ticket_id,user_id,body,is_system,created_at,updated_at,deleted_at
	`, ticketID, userID, body).Scan(&message.ID, &message.TicketID, &message.UserID, &message.Body, &message.IsSystem, &message.CreatedAt, &message.UpdatedAt, &message.DeletedAt); err != nil {
		return models.SupportTicketMessage{}, err
	}
	nextSlug := customerNext
	if isSupportStaffRole(role) || role == "seller" {
		nextSlug = staffNext
	}
	var nextStatusID *string
	if nextSlug != nil && strings.TrimSpace(*nextSlug) != "" {
		var selectedStatusID string
		if err := tx.QueryRow(ctx, `SELECT id FROM support_ticket_statuses WHERE slug=$1`, strings.TrimSpace(*nextSlug)).Scan(&selectedStatusID); err == nil {
			nextStatusID = &selectedStatusID
		}
	}
	if nextStatusID != nil {
		if _, err := tx.Exec(ctx, `
			UPDATE support_tickets
			SET last_message_id=$1,last_message_at=$2,last_message_user_id=$3,reply_count=reply_count+1,status_id=$4,closed_at=NULL,updated_at=$2
			WHERE id=$5
		`, message.ID, message.CreatedAt, userID, *nextStatusID, ticketID); err != nil {
			return models.SupportTicketMessage{}, err
		}
	} else if _, err := tx.Exec(ctx, `
		UPDATE support_tickets
		SET last_message_id=$1,last_message_at=$2,last_message_user_id=$3,reply_count=reply_count+1,updated_at=$2
		WHERE id=$4
	`, message.ID, message.CreatedAt, userID, ticketID); err != nil {
		return models.SupportTicketMessage{}, err
	}
	if _, err := tx.Exec(ctx, `
		UPDATE support_ticket_participants
		SET is_unread=true
		WHERE ticket_id=$1 AND user_id<>$2 AND left_at IS NULL
	`, ticketID, userID); err != nil {
		return models.SupportTicketMessage{}, err
	}
	if isSupportStaffRole(role) {
		if _, err := tx.Exec(ctx, `
			INSERT INTO support_ticket_participants (ticket_id,user_id,role,is_unread,last_read_at)
			VALUES ($1,$2,'staff',false,now())
			ON CONFLICT (ticket_id,user_id) DO UPDATE SET role='staff',left_at=NULL,last_read_at=now(),is_unread=false
		`, ticketID, userID); err != nil {
			return models.SupportTicketMessage{}, err
		}
	} else {
		if _, err := tx.Exec(ctx, `
			UPDATE support_ticket_participants
			SET is_unread=false,last_read_at=now(),left_at=NULL
			WHERE ticket_id=$1 AND user_id=$2
		`, ticketID, userID); err != nil {
			return models.SupportTicketMessage{}, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return models.SupportTicketMessage{}, err
	}
	user, err := r.GetUserByID(ctx, userID)
	if err == nil {
		message.Username = &user.Username
		message.DisplayName = user.DisplayName
		message.AvatarURL = user.AvatarURL
	}
	return message, nil
}

func (r *Repo) MarkSupportTicketRead(ctx context.Context, ticketID, userID, role string) error {
	cmd, err := r.pool.Exec(ctx, `
		UPDATE support_ticket_participants
		SET is_unread=false,last_read_at=now()
		WHERE ticket_id=$1 AND user_id=$2 AND left_at IS NULL
	`, ticketID, userID)
	if err != nil {
		return err
	}
	if cmd.RowsAffected() == 0 {
		if isSupportStaffRole(role) {
			var exists bool
			if err := r.pool.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM support_tickets WHERE id=$1)`, ticketID).Scan(&exists); err != nil {
				return err
			}
			if exists {
				_, err := r.pool.Exec(ctx, `
					INSERT INTO support_ticket_participants (ticket_id,user_id,role,is_unread,last_read_at)
					VALUES ($1,$2,'staff',false,now())
					ON CONFLICT (ticket_id,user_id) DO UPDATE SET is_unread=false,last_read_at=now(),left_at=NULL
				`, ticketID, userID)
				return err
			}
		}
		return ErrNotFound
	}
	return nil
}

func (r *Repo) UpdateSupportTicketStatus(ctx context.Context, ticketID, statusSlug, actorID string) (models.SupportTicket, error) {
	var statusID string
	var closed bool
	if err := r.pool.QueryRow(ctx, `SELECT id,is_closed FROM support_ticket_statuses WHERE slug=$1`, statusSlug).Scan(&statusID, &closed); err != nil {
		return models.SupportTicket{}, ErrNotFound
	}
	cmd, err := r.pool.Exec(ctx, `
		UPDATE support_tickets
		SET status_id=$1,closed_at=CASE WHEN $2 THEN now() ELSE NULL END,updated_at=now()
		WHERE id=$3
	`, statusID, closed, ticketID)
	if err != nil {
		return models.SupportTicket{}, err
	}
	if cmd.RowsAffected() == 0 {
		return models.SupportTicket{}, ErrNotFound
	}
	return r.GetSupportTicket(ctx, ticketID, actorID, "admin")
}

func (r *Repo) AssignSupportTicket(ctx context.Context, ticketID, assigneeID, actorID string) (models.SupportTicket, error) {
	if strings.TrimSpace(assigneeID) == "" {
		_, err := r.pool.Exec(ctx, `UPDATE support_tickets SET assigned_user_id=NULL,updated_at=now() WHERE id=$1`, ticketID)
		if err != nil {
			return models.SupportTicket{}, err
		}
		return r.GetSupportTicket(ctx, ticketID, actorID, "admin")
	}
	if _, err := r.GetUserByID(ctx, assigneeID); err != nil {
		return models.SupportTicket{}, ErrNotFound
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return models.SupportTicket{}, err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `UPDATE support_tickets SET assigned_user_id=$1,updated_at=now() WHERE id=$2`, assigneeID, ticketID); err != nil {
		return models.SupportTicket{}, err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO support_ticket_participants (ticket_id,user_id,role,is_unread)
		VALUES ($1,$2,'staff',true)
		ON CONFLICT (ticket_id,user_id) DO UPDATE SET role='staff',left_at=NULL,is_unread=true
	`, ticketID, assigneeID); err != nil {
		return models.SupportTicket{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return models.SupportTicket{}, err
	}
	return r.GetSupportTicket(ctx, ticketID, actorID, "admin")
}

func (r *Repo) ListReports(ctx context.Context) ([]models.Report, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, reporter_id, target_type, target_id, reason, details, status, resolved_by, created_at
		FROM reports
		ORDER BY created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.Report
	for rows.Next() {
		var report models.Report
		if err := rows.Scan(&report.ID, &report.ReporterID, &report.TargetType, &report.TargetID, &report.Reason, &report.Details, &report.Status, &report.ResolvedBy, &report.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, report)
	}
	return out, nil
}

func (r *Repo) UpdateReportStatus(ctx context.Context, id, status string) error {
	_, err := r.pool.Exec(ctx, `UPDATE reports SET status=$1 WHERE id=$2`, status, id)
	return err
}

func (r *Repo) UpdateReportResolvedBy(ctx context.Context, id, adminID string) error {
	_, err := r.pool.Exec(ctx, `UPDATE reports SET resolved_by=$1 WHERE id=$2`, adminID, id)
	return err
}

func (r *Repo) ListAdminUsers(ctx context.Context) ([]models.User, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, username, email, role, is_verified, is_banned, avatar_url, profile_banner_url, bio, website_url, discord_tag, balance, created_at, updated_at
		FROM users
		ORDER BY created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var users []models.User
	for rows.Next() {
		var u models.User
		if err := rows.Scan(&u.ID, &u.Username, &u.Email, &u.Role, &u.IsVerified, &u.IsBanned, &u.AvatarURL, &u.ProfileBannerURL, &u.Bio, &u.WebsiteURL, &u.DiscordTag, &u.Balance, &u.CreatedAt, &u.UpdatedAt); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, nil
}

func (r *Repo) UpdateUserRole(ctx context.Context, id, role string) error {
	_, err := r.pool.Exec(ctx, `UPDATE users SET role=$1 WHERE id=$2`, role, id)
	return err
}

func (r *Repo) BanUser(ctx context.Context, id string, banned bool) error {
	_, err := r.pool.Exec(ctx, `UPDATE users SET is_banned=$1 WHERE id=$2`, banned, id)
	return err
}

func (r *Repo) ApproveProduct(ctx context.Context, id string, approved bool) error {
	status := "rejected"
	if approved {
		status = "approved"
	}
	_, err := r.pool.Exec(ctx, `UPDATE products SET status=$1 WHERE id=$2`, status, id)
	return err
}

func (r *Repo) ListProductsForAdmin(ctx context.Context) ([]models.Product, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, public_id, seller_id, category_id, title, slug, short_description, description, price, status,
		       thumbnail_url, banner_url, demo_url, source_url, tags, version, supported_versions,
		       total_downloads, total_sales, average_rating, review_count, is_featured, is_exclusive,
		       bump_expires_at, metadata, created_at, updated_at
		FROM products
		ORDER BY created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var products []models.Product
	for rows.Next() {
		var p models.Product
		var catID *string
		var desc, thumb, banner, demo, source, version *string
		var tags, versions []string
		var metadata map[string]any
		var bump *time.Time
		if err := rows.Scan(&p.ID, &p.PublicID, &p.SellerID, &catID, &p.Title, &p.Slug, &desc, &p.Description, &p.Price, &p.Status,
			&thumb, &banner, &demo, &source, &tags, &version, &versions, &p.TotalDownloads, &p.TotalSales, &p.AverageRating,
			&p.ReviewCount, &p.IsFeatured, &p.IsExclusive, &bump, &metadata, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		p.CategoryID = catID
		p.ShortDescription = desc
		p.ThumbnailURL = thumb
		p.BannerURL = banner
		p.DemoURL = demo
		p.SourceURL = source
		p.Version = version
		p.BumpExpiresAt = bump
		p.Metadata = metadata
		p.SupportedVersions = versions
		products = append(products, p)
	}
	return products, nil
}

func (r *Repo) SetProductFeatured(ctx context.Context, id string, featured bool) error {
	_, err := r.pool.Exec(ctx, `UPDATE products SET is_featured=$1 WHERE id=$2`, featured, id)
	return err
}

func (r *Repo) ListPayoutRequests(ctx context.Context) ([]models.PayoutRequest, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id,seller_id,amount,method,status,notes,processed_by,created_at,processed_at
		FROM payout_requests ORDER BY created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.PayoutRequest
	for rows.Next() {
		var pr models.PayoutRequest
		if err := rows.Scan(&pr.ID, &pr.SellerID, &pr.Amount, &pr.Method, &pr.Status, &pr.Notes, &pr.ProcessedBy, &pr.CreatedAt, &pr.ProcessedAt); err != nil {
			return nil, err
		}
		out = append(out, pr)
	}
	return out, nil
}

func (r *Repo) ListAuditLogs(ctx context.Context) ([]models.AuditLog, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, admin_id, action, target_type, target_id, details, ip_address, created_at
		FROM audit_logs ORDER BY created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.AuditLog
	for rows.Next() {
		var log models.AuditLog
		if err := rows.Scan(&log.ID, &log.AdminID, &log.Action, &log.TargetType, &log.TargetID, &log.Details, &log.IPAddress, &log.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, log)
	}
	return out, nil
}

func (r *Repo) ListAdminOrders(ctx context.Context) ([]models.Order, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id,buyer_id,product_id,product_version_id,seller_id,amount,platform_fee,seller_earnings,currency,payment_method,payment_id,status,license_key,created_at
		FROM orders ORDER BY created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.Order
	for rows.Next() {
		var order models.Order
		var pv, pm, pid *string
		if err := rows.Scan(&order.ID, &order.BuyerID, &order.ProductID, &pv, &order.SellerID, &order.Amount, &order.PlatformFee,
			&order.SellerEarnings, &order.Currency, &pm, &pid, &order.Status, &order.LicenseKey, &order.CreatedAt); err != nil {
			return nil, err
		}
		order.ProductVersionID = pv
		order.PaymentMethod = pm
		order.PaymentID = pid
		out = append(out, order)
	}
	return out, nil
}

func (r *Repo) ListSellerApplications(ctx context.Context) ([]models.SellerProfile, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id,user_id,shop_name,shop_slug,shop_description,shop_banner_url,total_sales,total_revenue,payout_method,payout_details,approved,created_at
		FROM seller_profiles
		WHERE approved=false
		ORDER BY created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var profiles []models.SellerProfile
	for rows.Next() {
		var p models.SellerProfile
		if err := rows.Scan(&p.ID, &p.UserID, &p.ShopName, &p.ShopSlug, &p.ShopDescription, &p.ShopBannerURL, &p.TotalSales, &p.TotalRevenue, &p.PayoutMethod, &p.PayoutDetails, &p.Approved, &p.CreatedAt); err != nil {
			return nil, err
		}
		profiles = append(profiles, p)
	}
	return profiles, nil
}

func (r *Repo) UpdateSellerApproved(ctx context.Context, sellerProfileID string, approved bool) error {
	_, err := r.pool.Exec(ctx, `UPDATE seller_profiles SET approved=$1 WHERE id=$2`, approved, sellerProfileID)
	return err
}

func (r *Repo) SetUserRole(ctx context.Context, userID, role string) error {
	_, err := r.pool.Exec(ctx, `UPDATE users SET role=$1 WHERE id=$2`, role, userID)
	return err
}

func (r *Repo) UpdateOrderStatus(ctx context.Context, orderID, status string) error {
	_, err := r.pool.Exec(ctx, `UPDATE orders SET status=$1 WHERE id=$2`, status, orderID)
	return err
}

func (r *Repo) UpdatePayoutRequestStatus(ctx context.Context, payoutID, status string, processedBy string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE payout_requests
		SET status=$1, processed_by=$2, processed_at=now()
		WHERE id=$3
	`, status, processedBy, payoutID)
	return err
}

func (r *Repo) AdminOverview(ctx context.Context) (models.AdminOverview, error) {
	var out models.AdminOverview
	if err := r.pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM users
	`).Scan(&out.TotalUsers); err != nil {
		return out, err
	}
	if err := r.pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM users WHERE created_at >= DATE_TRUNC('day', NOW())
	`).Scan(&out.NewUsersToday); err != nil {
		return out, err
	}
	if err := r.pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM products
	`).Scan(&out.TotalProducts); err != nil {
		return out, err
	}
	if err := r.pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM products WHERE status='pending'
	`).Scan(&out.PendingProducts); err != nil {
		return out, err
	}
	if err := r.pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM orders
	`).Scan(&out.TotalOrders); err != nil {
		return out, err
	}
	if err := r.pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM orders WHERE status='completed'
	`).Scan(&out.CompletedOrders); err != nil {
		return out, err
	}
	if err := r.pool.QueryRow(ctx, `
		SELECT COALESCE(SUM(amount), 0) FROM orders WHERE status='completed'
	`).Scan(&out.TotalRevenue); err != nil {
		return out, err
	}
	if err := r.pool.QueryRow(ctx, `
		SELECT COALESCE(SUM(amount), 0) FROM orders WHERE status='completed' AND created_at >= DATE_TRUNC('day', NOW())
	`).Scan(&out.RevenueToday); err != nil {
		return out, err
	}
	if err := r.pool.QueryRow(ctx, `
		SELECT COUNT(DISTINCT buyer_id) FROM orders WHERE status='completed' AND created_at >= DATE_TRUNC('day', NOW())
	`).Scan(&out.UniqueBuyersToday); err != nil {
		return out, err
	}
	if err := r.pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM seller_profiles WHERE approved=true
	`).Scan(&out.ActiveSellers); err != nil {
		return out, err
	}
	return out, nil
}

func (r *Repo) AdminRevenueSeries(ctx context.Context, from time.Time, to time.Time, groupBy string) ([]models.RevenuePoint, error) {
	period := "day"
	if groupBy == "week" || groupBy == "month" {
		period = groupBy
	}
	groupExpr := fmt.Sprintf("date_trunc('%s', created_at)", period)
	rows, err := r.pool.Query(ctx, fmt.Sprintf(`
		SELECT %s AS period, COALESCE(SUM(amount), 0) AS amount, COUNT(*)::INT8 AS count
		FROM orders
		WHERE status='completed' AND created_at BETWEEN $1 AND $2
		GROUP BY period
		ORDER BY period DESC
	`, groupExpr), from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.RevenuePoint
	for rows.Next() {
		var p models.RevenuePoint
		var count int64
		if err := rows.Scan(&p.Period, &p.Amount, &count); err != nil {
			return nil, err
		}
		p.Count = count
		out = append(out, p)
	}
	return out, nil
}

func (r *Repo) TopProductsByRevenue(ctx context.Context, limit int64) ([]models.ProductSalesStat, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT p.id, p.title, p.seller_id, u.username, COALESCE(SUM(o.amount), 0), COUNT(o.id)::INT8
		FROM products p
		JOIN orders o ON o.product_id = p.id
		JOIN users u ON u.id = p.seller_id
		WHERE o.status='completed'
		GROUP BY p.id, p.title, p.seller_id, u.username
		ORDER BY COALESCE(SUM(o.amount), 0) DESC
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.ProductSalesStat
	for rows.Next() {
		var stat models.ProductSalesStat
		var orders int64
		if err := rows.Scan(&stat.ID, &stat.Title, &stat.SellerID, &stat.SellerUsername, &stat.Revenue, &orders); err != nil {
			return nil, err
		}
		stat.OrdersCompleted = orders
		stat.Downloads = 0
		out = append(out, stat)
	}
	return out, nil
}
