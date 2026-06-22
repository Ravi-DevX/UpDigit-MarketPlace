import type { ThemeConfig } from "@/lib/theme";

export type Role = "admin" | "staff" | "seller" | "client" | "member" | "buyer";

export interface User {
  id: string;
  external_id?: string;
  username: string;
  display_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  profile_banner_url?: string | null;
  role: Role;
  is_verified?: boolean;
  bio?: string | null;
  website_url?: string | null;
  discord_tag?: string | null;
  is_banned?: boolean;
  balance?: number;
  created_at?: string;
  updated_at?: string;
}

export interface SellerProfile {
  id: string;
  user_id: string;
  shop_name: string;
  shop_slug: string;
  shop_description?: string | null;
  shop_banner_url?: string | null;
  total_sales?: number;
  total_revenue?: number;
  payout_method?: string | null;
  payout_details?: Record<string, unknown> | null;
  approved?: boolean;
  created_at?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  icon_url?: string | null;
  sort_order?: number;
  is_active?: boolean;
  minimum_price?: number;
  publishing_config?: Record<string, unknown> | null;
  parent_id?: string | null;
  created_at?: string;
  children?: Category[];
}

export interface Product {
  id: string;
  public_id?: number;
  slug: string;
  title: string;
  short_description?: string | null;
  description?: string | null;
  price: number;
  status?: string;
  is_free?: boolean;
  thumbnail_url?: string | null;
  banner_url?: string | null;
  demo_url?: string | null;
  source_url?: string | null;
  total_downloads: number;
  total_sales: number;
  average_rating: number;
  review_count: number;
  is_featured: boolean;
  is_exclusive: boolean;
  updated_at: string;
  created_at: string;
  seller_id: string;
  category_id?: string | null;
  tags?: string[] | null;
  version?: string | null;
  supported_versions?: string[] | null;
  version_count?: number;
  metadata?: Record<string, unknown> | null;
  seller?: {
    id: string;
    username: string;
    avatar_url?: string | null;
    seller_profile?: SellerProfile | null;
  };
  category?: Category | null;
}

export interface ProductVersion {
  id: string;
  product_id?: string;
  version_tag: string;
  update_title?: string | null;
  changelog?: string | null;
  file_name: string;
  file_size?: number | null;
  file_checksum?: string | null;
  is_latest?: boolean;
  is_update_posted?: boolean;
  download_count?: number;
  created_at: string;
}

export interface ProductMedia {
  id: string;
  product_id: string;
  media_url: string;
  media_type: string;
  sort_order: number;
  created_at: string;
}

export interface Order {
  id: string;
  buyer_id: string;
  product_id: string;
  product_version_id?: string | null;
  seller_id: string;
  amount: number;
  platform_fee: number;
  seller_earnings: number;
  currency: string;
  payment_method?: string | null;
  payment_id?: string | null;
  status: string;
  license_key?: string | null;
  created_at: string;
}

export interface ProductEntitlement {
  purchased: boolean;
  order_id?: string;
  downloaded: boolean;
  reviewed: boolean;
  can_review: boolean;
}

export interface MarketplaceNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  is_read: boolean;
  created_at: string;
}

export interface SellerDashboardPayload {
  products: number;
  recent_products?: Product[];
  orders: number;
  completed_orders?: number;
  revenue?: number;
}

export interface SellerAnalyticsPayload {
  total_orders: number;
  completed_orders?: number;
  revenue?: number;
  series?: Array<{
    period: string;
    revenue: number;
    orders: number;
  }>;
}

export interface SellerEarningsPayload {
  balance: number;
  currency: string;
}

export interface Coupon {
  id: string;
  seller_id?: string | null;
  code: string;
  discount_type: string;
  discount_value: number;
  max_uses?: number | null;
  uses_count: number;
  product_id?: string | null;
  expires_at?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface PayoutRequest {
  id: string;
  seller_id: string;
  amount: number;
  method: string;
  status: string;
  notes?: string | null;
  processed_by?: string | null;
  created_at: string;
  processed_at?: string | null;
}

export interface Report {
  id: string;
  reporter_id?: string | null;
  target_type: string;
  target_id: string;
  reason: string;
  details?: string | null;
  status: string;
  resolved_by?: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  admin_id?: string | null;
  action: string;
  target_type?: string | null;
  target_id?: string | null;
  details?: Record<string, unknown> | null;
  ip_address?: string | null;
  created_at: string;
}

export interface RevenuePoint {
  period: string;
  amount: number;
  count: number;
}

export interface ProductSalesStat {
  id: string;
  title: string;
  seller_id: string;
  seller_username: string;
  revenue: number;
  downloads: number;
  orders_completed: number;
}

export interface AdminSettings {
  platform_fee_percent: number;
  roles?: AdminRole[];
  theme_config?: ThemeConfig;
  site_name?: string;
  site_tagline?: string;
  site_description?: string;
  site_logo_url?: string;
  support_email?: string;
  seo_default_title?: string;
  seo_default_description?: string;
  announcement_text?: string;
}

export interface PublicSiteSettings {
  site_name: string;
  site_tagline: string;
  site_description: string;
  site_logo_url: string;
  support_email: string;
  seo_default_title: string;
  seo_default_description: string;
  announcement_text: string;
  tebex_checkout_enabled?: boolean;
  theme_config?: ThemeConfig;
}

export interface AdminRole {
  key: Role | string;
  label: string;
  description?: string;
  permissions: string[];
  system?: boolean;
}

export interface Webhook {
  id: string;
  seller_id: string;
  url: string;
  secret?: string;
  events: string[];
  is_active: boolean;
  created_at: string;
}

export interface Review {
  id: string;
  user_id?: string;
  rating: number;
  title?: string | null;
  body?: string | null;
  is_verified_purchase: boolean;
  created_at: string;
  user?: {
    id: string;
    username: string;
    avatar_url?: string | null;
  };
  seller_reply?: string | null;
}

export interface ApiEnvelope<T> {
  data: T;
}

export interface StatsPayload {
  total_products: number;
  total_downloads: number;
  total_sellers: number;
  total_users?: number;
  new_users_today?: number;
  pending_products?: number;
  total_orders?: number;
  completed_orders?: number;
  total_revenue?: number;
  revenue_today?: number;
  unique_buyers_today?: number;
  active_sellers?: number;
}
