package models

import (
	"time"
)

type User struct {
	ID               string    `json:"id"`
	ExternalID       string    `json:"external_id"`
	Username         string    `json:"username"`
	DisplayName      *string   `json:"display_name"`
	Email            string    `json:"email"`
	PasswordHash     string    `json:"-"`
	Role             string    `json:"role"`
	IsVerified       bool      `json:"is_verified"`
	IsBanned         bool      `json:"is_banned"`
	AvatarURL        *string   `json:"avatar_url"`
	ProfileBannerURL *string   `json:"profile_banner_url"`
	Bio              *string   `json:"bio"`
	WebsiteURL       *string   `json:"website_url"`
	DiscordTag       *string   `json:"discord_tag"`
	Balance          float64   `json:"balance"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

type SellerProfile struct {
	ID              string         `json:"id"`
	UserID          string         `json:"user_id"`
	ShopName        string         `json:"shop_name"`
	ShopSlug        string         `json:"shop_slug"`
	ShopDescription *string        `json:"shop_description"`
	ShopBannerURL   *string        `json:"shop_banner_url"`
	TotalSales      int            `json:"total_sales"`
	TotalRevenue    float64        `json:"total_revenue"`
	PayoutMethod    *string        `json:"payout_method"`
	PayoutDetails   map[string]any `json:"payout_details"`
	Approved        bool           `json:"approved"`
	CreatedAt       time.Time      `json:"created_at"`
}

type Category struct {
	ID               string         `json:"id"`
	ParentID         *string        `json:"parent_id"`
	Name             string         `json:"name"`
	Slug             string         `json:"slug"`
	Description      *string        `json:"description"`
	IconURL          *string        `json:"icon_url"`
	SortOrder        int            `json:"sort_order"`
	IsActive         bool           `json:"is_active"`
	MinimumPrice     float64        `json:"minimum_price"`
	PublishingConfig map[string]any `json:"publishing_config"`
	CreatedAt        time.Time      `json:"created_at"`
	Children         []Category     `json:"children,omitempty"`
}

type ProductSeller struct {
	ID            string         `json:"id"`
	Username      string         `json:"username"`
	DisplayName   *string        `json:"display_name"`
	AvatarURL     *string        `json:"avatar_url"`
	SellerProfile *SellerProfile `json:"seller_profile,omitempty"`
}

type Product struct {
	ID                string         `json:"id"`
	PublicID          int64          `json:"public_id"`
	SellerID          string         `json:"seller_id"`
	CategoryID        *string        `json:"category_id"`
	Title             string         `json:"title"`
	Slug              string         `json:"slug"`
	ShortDescription  *string        `json:"short_description"`
	Description       string         `json:"description"`
	Price             float64        `json:"price"`
	Status            string         `json:"status"`
	ThumbnailURL      *string        `json:"thumbnail_url"`
	BannerURL         *string        `json:"banner_url"`
	DemoURL           *string        `json:"demo_url"`
	SourceURL         *string        `json:"source_url"`
	Tags              []string       `json:"tags"`
	Version           *string        `json:"version"`
	SupportedVersions []string       `json:"supported_versions"`
	TotalDownloads    int            `json:"total_downloads"`
	TotalSales        int            `json:"total_sales"`
	AverageRating     float64        `json:"average_rating"`
	ReviewCount       int            `json:"review_count"`
	IsFeatured        bool           `json:"is_featured"`
	IsExclusive       bool           `json:"is_exclusive"`
	BumpExpiresAt     *time.Time     `json:"bump_expires_at"`
	Metadata          map[string]any `json:"metadata"`
	Seller            *ProductSeller `json:"seller,omitempty"`
	Category          *Category      `json:"category,omitempty"`
	CreatedAt         time.Time      `json:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at"`
}

type ProductVersion struct {
	ID             string    `json:"id"`
	ProductID      string    `json:"product_id"`
	VersionTag     string    `json:"version_tag"`
	UpdateTitle    *string   `json:"update_title"`
	Changelog      *string   `json:"changelog"`
	FileKey        string    `json:"file_key"`
	FileName       string    `json:"file_name"`
	FileSize       *int64    `json:"file_size"`
	FileChecksum   *string   `json:"file_checksum"`
	IsLatest       bool      `json:"is_latest"`
	IsUpdatePosted bool      `json:"is_update_posted"`
	DownloadCount  int64     `json:"download_count"`
	CreatedAt      time.Time `json:"created_at"`
}

type ProductMedia struct {
	ID        string    `json:"id"`
	ProductID string    `json:"product_id"`
	MediaURL  string    `json:"media_url"`
	MediaType string    `json:"media_type"`
	SortOrder int       `json:"sort_order"`
	CreatedAt time.Time `json:"created_at"`
}

type Order struct {
	ID                string     `json:"id"`
	BuyerID           string     `json:"buyer_id"`
	ProductID         string     `json:"product_id"`
	ProductVersionID  *string    `json:"product_version_id"`
	SellerID          string     `json:"seller_id"`
	Amount            float64    `json:"amount"`
	PlatformFee       float64    `json:"platform_fee"`
	SellerEarnings    float64    `json:"seller_earnings"`
	Currency          string     `json:"currency"`
	PaymentMethod     *string    `json:"payment_method"`
	PaymentID         *string    `json:"payment_id"`
	Status            string     `json:"status"`
	LicenseKey        *string    `json:"license_key"`
	FirstDownloadedAt *time.Time `json:"first_downloaded_at"`
	CreatedAt         time.Time  `json:"created_at"`
}

type ProductEntitlement struct {
	Purchased  bool   `json:"purchased"`
	OrderID    string `json:"order_id,omitempty"`
	Downloaded bool   `json:"downloaded"`
	Reviewed   bool   `json:"reviewed"`
	CanReview  bool   `json:"can_review"`
}

type DownloadToken struct {
	ID               string    `json:"id"`
	OrderID          string    `json:"order_id"`
	Token            string    `json:"token"`
	ProductVersionID *string   `json:"product_version_id"`
	ExpiresAt        time.Time `json:"expires_at"`
	Used             bool      `json:"used"`
	IPAddress        *string   `json:"ip_address"`
	CreatedAt        time.Time `json:"created_at"`
}

type Review struct {
	ID                 string      `json:"id"`
	ProductID          string      `json:"product_id"`
	UserID             string      `json:"user_id"`
	OrderID            *string     `json:"order_id"`
	Rating             int         `json:"rating"`
	Title              *string     `json:"title"`
	Body               *string     `json:"body"`
	IsVerifiedPurchase bool        `json:"is_verified_purchase"`
	IsHidden           bool        `json:"is_hidden"`
	SellerReply        *string     `json:"seller_reply"`
	CreatedAt          time.Time   `json:"created_at"`
	UpdatedAt          time.Time   `json:"updated_at"`
	User               *ReviewUser `json:"user,omitempty"`
}

type ReviewUser struct {
	ID        string  `json:"id"`
	Username  string  `json:"username"`
	AvatarURL *string `json:"avatar_url"`
}

type CartItem struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	ProductID string    `json:"product_id"`
	AddedAt   time.Time `json:"added_at"`
}

type WishlistItem struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	ProductID string    `json:"product_id"`
	AddedAt   time.Time `json:"added_at"`
}

type Coupon struct {
	ID            string     `json:"id"`
	SellerID      *string    `json:"seller_id"`
	Code          string     `json:"code"`
	DiscountType  string     `json:"discount_type"`
	DiscountValue float64    `json:"discount_value"`
	MaxUses       *int       `json:"max_uses"`
	UsesCount     int        `json:"uses_count"`
	ProductID     *string    `json:"product_id"`
	ExpiresAt     *time.Time `json:"expires_at"`
	IsActive      bool       `json:"is_active"`
	CreatedAt     time.Time  `json:"created_at"`
}

type Notification struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Type      string    `json:"type"`
	Title     string    `json:"title"`
	Body      *string   `json:"body"`
	Link      *string   `json:"link"`
	IsRead    bool      `json:"is_read"`
	CreatedAt time.Time `json:"created_at"`
}

type AuditLog struct {
	ID         string         `json:"id"`
	AdminID    *string        `json:"admin_id"`
	Action     string         `json:"action"`
	TargetType *string        `json:"target_type"`
	TargetID   *string        `json:"target_id"`
	Details    map[string]any `json:"details"`
	IPAddress  *string        `json:"ip_address"`
	CreatedAt  time.Time      `json:"created_at"`
}

type AdminOverview struct {
	TotalUsers        int64   `json:"total_users"`
	NewUsersToday     int64   `json:"new_users_today"`
	TotalProducts     int64   `json:"total_products"`
	PendingProducts   int64   `json:"pending_products"`
	TotalOrders       int64   `json:"total_orders"`
	CompletedOrders   int64   `json:"completed_orders"`
	TotalRevenue      float64 `json:"total_revenue"`
	RevenueToday      float64 `json:"revenue_today"`
	UniqueBuyersToday int64   `json:"unique_buyers_today"`
	ActiveSellers     int64   `json:"active_sellers"`
}

type RevenuePoint struct {
	Period time.Time `json:"period"`
	Amount float64   `json:"amount"`
	Count  int64     `json:"count"`
}

type ProductSalesStat struct {
	ID              string  `json:"id"`
	Title           string  `json:"title"`
	SellerID        string  `json:"seller_id"`
	SellerUsername  string  `json:"seller_username"`
	Revenue         float64 `json:"revenue"`
	Downloads       int64   `json:"downloads"`
	OrdersCompleted int64   `json:"orders_completed"`
}

type Report struct {
	ID         string    `json:"id"`
	ReporterID *string   `json:"reporter_id"`
	TargetType string    `json:"target_type"`
	TargetID   string    `json:"target_id"`
	Reason     string    `json:"reason"`
	Details    *string   `json:"details"`
	Status     string    `json:"status"`
	ResolvedBy *string   `json:"resolved_by"`
	CreatedAt  time.Time `json:"created_at"`
}

type PayoutRequest struct {
	ID          string     `json:"id"`
	SellerID    string     `json:"seller_id"`
	Amount      float64    `json:"amount"`
	Method      string     `json:"method"`
	Status      string     `json:"status"`
	Notes       *string    `json:"notes"`
	ProcessedBy *string    `json:"processed_by"`
	CreatedAt   time.Time  `json:"created_at"`
	ProcessedAt *time.Time `json:"processed_at"`
}

type Webhook struct {
	ID        string    `json:"id"`
	SellerID  string    `json:"seller_id"`
	URL       string    `json:"url"`
	Secret    string    `json:"secret"`
	Events    []string  `json:"events"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
}

type ConversationParticipant struct {
	UserID      string     `json:"user_id"`
	Username    string     `json:"username"`
	DisplayName *string    `json:"display_name"`
	AvatarURL   *string    `json:"avatar_url"`
	Role        string     `json:"role"`
	IsUnread    bool       `json:"is_unread"`
	LastReadAt  *time.Time `json:"last_read_at"`
	LeftAt      *time.Time `json:"left_at,omitempty"`
}

type Conversation struct {
	ID               string                    `json:"id"`
	Title            string                    `json:"title"`
	CreatorID        string                    `json:"creator_id"`
	IsOpen           bool                      `json:"is_open"`
	ContextType      *string                   `json:"context_type"`
	ContextID        *string                   `json:"context_id"`
	IsUnread         bool                      `json:"is_unread"`
	ParticipantCount int                       `json:"participant_count"`
	MessageCount     int                       `json:"message_count"`
	LastMessageAt    time.Time                 `json:"last_message_at"`
	CreatedAt        time.Time                 `json:"created_at"`
	UpdatedAt        time.Time                 `json:"updated_at"`
	Participants     []ConversationParticipant `json:"participants,omitempty"`
	LastMessage      *ConversationMessage      `json:"last_message,omitempty"`
}

type ConversationMessage struct {
	ID             string     `json:"id"`
	ConversationID string     `json:"conversation_id"`
	UserID         *string    `json:"user_id"`
	Username       *string    `json:"username"`
	DisplayName    *string    `json:"display_name"`
	AvatarURL      *string    `json:"avatar_url"`
	Body           string     `json:"body"`
	IsSystem       bool       `json:"is_system"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
	DeletedAt      *time.Time `json:"deleted_at,omitempty"`
}

type SupportTicketCategory struct {
	ID                string    `json:"id"`
	ParentID          *string   `json:"parent_id"`
	Name              string    `json:"name"`
	Slug              string    `json:"slug"`
	Description       *string   `json:"description"`
	SortOrder         int       `json:"sort_order"`
	IsActive          bool      `json:"is_active"`
	AllowCustomerOpen bool      `json:"allow_customer_open"`
	CreatedAt         time.Time `json:"created_at"`
}

type SupportTicketStatus struct {
	ID                    string    `json:"id"`
	Slug                  string    `json:"slug"`
	Name                  string    `json:"name"`
	IsClosed              bool      `json:"is_closed"`
	StatusOnCustomerReply *string   `json:"status_on_customer_reply"`
	StatusOnStaffReply    *string   `json:"status_on_staff_reply"`
	IncludeInCounts       bool      `json:"include_in_counts"`
	SortOrder             int       `json:"sort_order"`
	CreatedAt             time.Time `json:"created_at"`
}

type SupportTicketPriority struct {
	ID        string    `json:"id"`
	Slug      string    `json:"slug"`
	Name      string    `json:"name"`
	SortOrder int       `json:"sort_order"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
}

type SupportTicketFeatureConfig struct {
	ID          string         `json:"id"`
	FeatureType string         `json:"feature_type"`
	Title       string         `json:"title"`
	Slug        string         `json:"slug"`
	Body        *string        `json:"body"`
	Config      map[string]any `json:"config"`
	IsActive    bool           `json:"is_active"`
	SortOrder   int            `json:"sort_order"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
}

type SupportTicketParticipant struct {
	UserID      string     `json:"user_id"`
	Username    string     `json:"username"`
	DisplayName *string    `json:"display_name"`
	AvatarURL   *string    `json:"avatar_url"`
	Role        string     `json:"role"`
	IsUnread    bool       `json:"is_unread"`
	LastReadAt  *time.Time `json:"last_read_at"`
	LeftAt      *time.Time `json:"left_at,omitempty"`
}

type SupportTicket struct {
	ID                string                     `json:"id"`
	TicketRef         string                     `json:"ticket_ref"`
	Title             string                     `json:"title"`
	UserID            *string                    `json:"user_id"`
	CategoryID        *string                    `json:"category_id"`
	StatusID          *string                    `json:"status_id"`
	PriorityID        *string                    `json:"priority_id"`
	AssignedUserID    *string                    `json:"assigned_user_id"`
	ProductID         *string                    `json:"product_id"`
	OrderID           *string                    `json:"order_id"`
	IsLocked          bool                       `json:"is_locked"`
	FirstMessageID    *string                    `json:"first_message_id"`
	LastMessageID     *string                    `json:"last_message_id"`
	LastMessageAt     time.Time                  `json:"last_message_at"`
	LastMessageUserID *string                    `json:"last_message_user_id"`
	ReplyCount        int                        `json:"reply_count"`
	ClosedAt          *time.Time                 `json:"closed_at"`
	CreatedAt         time.Time                  `json:"created_at"`
	UpdatedAt         time.Time                  `json:"updated_at"`
	IsUnread          bool                       `json:"is_unread"`
	Category          *SupportTicketCategory     `json:"category,omitempty"`
	Status            *SupportTicketStatus       `json:"status,omitempty"`
	Priority          *SupportTicketPriority     `json:"priority,omitempty"`
	Participants      []SupportTicketParticipant `json:"participants,omitempty"`
	LastMessage       *SupportTicketMessage      `json:"last_message,omitempty"`
}

type SupportTicketMessage struct {
	ID          string     `json:"id"`
	TicketID    string     `json:"ticket_id"`
	UserID      *string    `json:"user_id"`
	Username    *string    `json:"username"`
	DisplayName *string    `json:"display_name"`
	AvatarURL   *string    `json:"avatar_url"`
	Body        string     `json:"body"`
	IsSystem    bool       `json:"is_system"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
	DeletedAt   *time.Time `json:"deleted_at,omitempty"`
}
