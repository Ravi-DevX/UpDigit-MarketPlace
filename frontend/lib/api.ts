import axios, { AxiosError } from "axios";
import { AxiosRequestConfig } from "axios";
import { useAuthStore } from "@/store/auth";
import {
  AdminSettings,
  AuditLog,
  Category,
  Conversation,
  ConversationMessage,
  Coupon,
  Order,
  MarketplaceNotification,
  PayoutRequest,
  Product,
  ProductEntitlement,
  ProductMedia,
  ProductVersion,
  ProductSalesStat,
  PublicSiteSettings,
  Report,
  RevenuePoint,
  Review,
  SellerAnalyticsPayload,
  SellerDashboardPayload,
  SellerEarningsPayload,
  SellerProfile,
  StatsPayload,
  SupportTicket,
  SupportTicketCategory,
  SupportTicketFeatureConfig,
  SupportTicketMessage,
  SupportTicketPriority,
  SupportTicketStatus,
  User,
  Webhook,
} from "@/types/marketplace";

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export type CreateProductInput = {
  title: string;
  slug?: string;
  description: string;
  price: number;
  short_description?: string;
  category_id?: string;
  thumbnail_url?: string;
  banner_url?: string;
  demo_url?: string;
  source_url?: string;
  tags?: string[];
  version?: string;
  supported_versions?: string[];
  status?: "draft" | "pending" | "approved" | "rejected";
  is_featured?: boolean;
  is_exclusive?: boolean;
  metadata?: Record<string, unknown>;
};

export type UpdateSellerSettingsInput = {
  shop_name: string;
  shop_slug: string;
  shop_description?: string | null;
  shop_banner_url?: string | null;
  payout_method?: string | null;
  payout_details?: Record<string, unknown>;
};

export type CategoryInput = {
  parent_id?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  icon_url?: string | null;
  sort_order?: number;
  is_active: boolean;
  minimum_price?: number;
  publishing_config?: Record<string, unknown>;
};

export type CouponInput = {
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  max_uses?: number | null;
  product_id?: string | null;
  expires_at?: string | null;
  is_active: boolean;
};

export type SellerApplyInput = {
  shop_name: string;
  shop_slug: string;
  shop_description?: string;
};

export type SellerApplicationStatus = {
  status: "none" | "pending" | "approved";
  profile: SellerProfile | null;
};

export type UpdateMeInput = {
  username: string;
  email: string;
  bio?: string | null;
  website_url?: string | null;
  discord_tag?: string | null;
};

export type DgenCallbackResponse = {
  access_token: string;
  csrf_token?: string | null;
  next?: string | null;
  user?: User | null;
};

export type DgenEmbedSession = {
  authorization_url: string;
  state: string;
  parent_origin: string;
  auth_origin: string;
  expires_in: number;
};

export type CartProductItem = {
  id: string;
  product_id: string;
  added_at: string;
  product: Product;
};

export type TebexCheckoutSession = {
  id: string;
  amount: number;
  discount: number;
  status: string;
  provider: "tebex";
  payment_type: "tebex";
  ident: string;
  checkout_url: string;
};

function unwrapPayload<T>(payload: ApiResponse<T> | T): T {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as ApiResponse<T>).data;
  }
  return payload as T;
}

function isCSRFError(message: unknown): boolean {
  if (typeof message !== "string") {
    return false;
  }
  const normalized = message.toLowerCase();
  return normalized.includes("csrf") || normalized.includes("x-csrf") || normalized.includes("forbidden");
}

function extractArray<T>(payload: unknown, fallbackKeys: string[] = []): T[] {
  if (!payload) {
    return [];
  }
  if (Array.isArray(payload)) {
    return payload as T[];
  }
  if (typeof payload !== "object") {
    return [];
  }

  const candidate = payload as Record<string, unknown>;
  const keys = fallbackKeys.length > 0 ? fallbackKeys : ["data", "products", "items", "payload", "results", "reviews", "versions", "categories"];

  for (const key of keys) {
    const value = candidate[key];
    if (Array.isArray(value)) {
      return value as T[];
    }
  }

  if (Array.isArray((candidate.data as Record<string, unknown>)?.data)) {
    return ((candidate.data as Record<string, unknown>).data as T[]) ?? [];
  }

  return [];
}

function isLocalApiHost(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

function isProductionAppHost(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const host = window.location.hostname;
  return host.endsWith("updigit.net");
}

function normalizeArrayPayload<T>(payload: unknown, fallbackKeys: string[] = []): T[] {
  return extractArray<T>(payload, fallbackKeys);
}

function parseClaimsFromJwtClaims(payload: Record<string, unknown>): {
  id?: string;
  role?: string;
  username?: string;
} {
  const rawId = (payload.uid as string) || (payload.user_id as string) || (payload.sub as string);
  const rawRole = payload.role as string;
  const rawUsername = payload.username as string;

  return {
    id: typeof rawId === "string" ? rawId : undefined,
    role: typeof rawRole === "string" ? rawRole : undefined,
    username: typeof rawUsername === "string" ? rawUsername : undefined,
  };
}

function resolveApiBase(): string {
  if (typeof window === "undefined") {
    return process.env.INTERNAL_API_URL?.trim() || "http://127.0.0.1:8080/api/v1";
  }

  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();

  const isLocalDevelopment = process.env.NODE_ENV !== "production" || isLocalApiHost();
  if (isLocalDevelopment) {
    if (configured && (configured.includes("localhost") || configured.includes("127.0.0.1"))) {
      return configured;
    }
    if (!isProductionAppHost() || isLocalApiHost()) {
      return "http://localhost:8080/api/v1";
    }
    return configured ?? "https://api.updigit.net/api/v1";
  }

  return configured || "https://api.updigit.net/api/v1";
}

const API_BASE = resolveApiBase();
let refreshPromise: Promise<string | null> | null = null;

export function getApiBase() {
  return API_BASE;
}

export function normalizeAuthUser(payload: unknown): User | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  if ("data" in (payload as Record<string, unknown>)) {
    const nested = (payload as Record<string, unknown>).data as Record<string, unknown> | null;
    if (nested && typeof nested === "object") {
      if ("user" in nested && nested.user && typeof nested.user === "object") {
        return nested.user as User;
      }
      if ("id" in nested && "username" in nested) {
        return nested as unknown as User;
      }
    }
  }
  if ("user" in (payload as Record<string, unknown>)) {
    const direct = payload as Record<string, unknown>;
    if (direct.user && typeof direct.user === "object") {
      return direct.user as User;
    }
  }
  return payload as User;
}

export function parseJwtClaims(token: string): { id?: string; role?: string; username?: string } | null {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const base = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = base.padEnd(base.length + ((4 - (base.length % 4)) % 4), "=");
  try {
    const decoded = atob(padded);
    return parseClaimsFromJwtClaims(JSON.parse(decoded) as Record<string, unknown>);
  } catch {
    return null;
  }
}

const CSRF_COOKIE_NAME = "csrf_token";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  if (!cookie) {
    return null;
  }
  return decodeURIComponent(cookie.slice(name.length + 1));
}

function readStateCsrf(): string | null {
  const tokenFromStore = useAuthStore.getState().csrfToken;
  if (tokenFromStore) {
    return tokenFromStore;
  }
  return getCookie(CSRF_COOKIE_NAME);
}

export const apiClient = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  timeout: 18_000,
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  const method = (config.method ?? "get").toUpperCase();
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const csrf = readStateCsrf();
    if (csrf) {
      config.headers = config.headers ?? {};
      config.headers["X-CSRF-Token"] = csrf;
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status;
    const original = error.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined;
    const requestURL = original?.url ?? "";
    const errorMessage =
      (error.response?.data as { error?: unknown } | undefined)?.error ??
      (error.response?.data as { message?: unknown } | undefined)?.message;
    const isAuthSessionEndpoint =
      requestURL.includes("/auth/refresh") ||
      requestURL.includes("/auth/callback") ||
      requestURL.includes("/auth/login");

    const shouldRefresh =
      (status === 401 || (status === 403 && isCSRFError(errorMessage))) &&
      original &&
      !original._retry &&
      !isAuthSessionEndpoint;

    if (shouldRefresh) {
      original._retry = true;
      try {
        const token = await refreshSession();
        if (token) {
          original.headers = original.headers ?? {};
          original.headers.Authorization = `Bearer ${token}`;
          return apiClient.request(original);
        }
        clearAuthState();
      } catch {
        clearAuthState();
      }
    }
    return Promise.reject(error);
  },
);

function toQuery(params: Record<string, unknown>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => query.append(key, String(item)));
      continue;
    }
    query.set(key, String(value));
  }
  return query.toString();
}

export type ProductListParams = {
  page?: number;
  limit?: number;
  sort?: string;
  search?: string;
  category?: string;
  tags?: string;
  price_min?: string;
  price_max?: string;
};

export async function fetchProducts(params: ProductListParams = {}): Promise<Product[]> {
  const query = toQuery({
    page: params.page,
    limit: params.limit ?? 12,
    sort: params.sort,
    search: params.search,
    category: params.category,
    tags: params.tags,
    price_min: params.price_min,
    price_max: params.price_max,
  });
  const { data } = await apiClient.get<ApiResponse<Product[]>>(`/products${query ? `?${query}` : ""}`);
  return normalizeArrayPayload<Product>(unwrapPayload(data));
}

export async function fetchFeaturedProducts(): Promise<Product[]> {
  const { data } = await apiClient.get<ApiResponse<Product[]>>("/products/featured");
  return normalizeArrayPayload<Product>(unwrapPayload(data));
}

export async function fetchTrendingProducts(): Promise<Product[]> {
  const { data } = await apiClient.get<ApiResponse<Product[]>>("/products/trending");
  return normalizeArrayPayload<Product>(unwrapPayload(data));
}

export async function fetchNewProducts(): Promise<Product[]> {
  const { data } = await apiClient.get<ApiResponse<Product[]>>("/products/new");
  return normalizeArrayPayload<Product>(unwrapPayload(data));
}

export async function fetchFreeProducts(): Promise<Product[]> {
  const { data } = await apiClient.get<ApiResponse<Product[]>>("/products/free");
  return normalizeArrayPayload<Product>(unwrapPayload(data));
}

export async function fetchBumpedProducts(): Promise<Product[]> {
  const { data } = await apiClient.get<ApiResponse<Product[]>>("/products/bumped");
  return normalizeArrayPayload<Product>(unwrapPayload(data));
}

export async function fetchProductBySlug(slug: string): Promise<Product> {
  const { data } = await apiClient.get<ApiResponse<Product>>(`/products/${slug}`);
  return unwrapPayload(data);
}

export async function fetchSellerProductBySlug(slug: string): Promise<Product> {
  const { data } = await apiClient.get<ApiResponse<Product>>(`/seller/products/${slug}`);
  return unwrapPayload(data);
}

export async function fetchProductVersions(slug: string): Promise<ProductVersion[]> {
  const response = await apiClient.get<ApiResponse<{ versions: ProductVersion[] }>>(
    `/products/${slug}/versions`,
  );
  const payload = unwrapPayload(response.data);
  const nested = (payload as { versions?: ProductVersion[] }).versions;
  if (Array.isArray(nested)) {
    return nested;
  }
  return normalizeArrayPayload<ProductVersion>(payload);
}

export async function fetchProductReviews(slug: string): Promise<Review[]> {
  const { data } = await apiClient.get<ApiResponse<Review[]>>(`/products/${slug}/reviews`);
  return normalizeArrayPayload<Review>(unwrapPayload(data));
}

export async function fetchProductEntitlement(slug: string): Promise<ProductEntitlement> {
  const { data } = await apiClient.get<ApiResponse<ProductEntitlement>>(`/products/${slug}/entitlement`);
  return unwrapPayload(data);
}

export async function createProductReview(
  slug: string,
  input: { rating: number; body: string; order_id: string },
): Promise<Review> {
  const { data } = await apiClient.post<ApiResponse<Review>>(`/products/${slug}/reviews`, input);
  return unwrapPayload(data);
}

export async function downloadFreeProduct(slug: string): Promise<{ download_url: string; expires_at: string }> {
  const { data } = await apiClient.get<ApiResponse<{ download_url: string; expires_at: string }>>(`/products/${slug}/download`);
  return unwrapPayload(data);
}

export async function fetchCategories(): Promise<Category[]> {
  const { data } = await apiClient.get<ApiResponse<Category[]>>("/categories");
  return normalizeArrayPayload<Category>(unwrapPayload(data), ["data", "categories", "items", "payload"]);
}

export async function fetchCategoryBySlug(slug: string): Promise<Category> {
  const { data } = await apiClient.get<ApiResponse<Category>>(`/categories/${slug}`);
  return unwrapPayload(data);
}

export async function fetchUserByUsername(username: string): Promise<User> {
  const response = await apiClient.get<ApiResponse<{ user: User }>>(`/users/${username}`);
  const payload = unwrapPayload(response.data);
  if (payload && typeof payload === "object" && "user" in (payload as Record<string, unknown>)) {
    return (payload as { user: User }).user;
  }
  return payload as unknown as User;
}

export async function fetchSellerProducts(
  username: string,
  params: { search?: string; category?: string; sort?: string; page?: number; limit?: number } = {},
): Promise<Product[]> {
  const { data } = await apiClient.get<ApiResponse<Product[]>>(`/users/${username}/products`, { params });
  return normalizeArrayPayload<Product>(unwrapPayload(data));
}

export async function fetchSellerDashboardProducts(): Promise<Product[]> {
  const { data } = await apiClient.get<ApiResponse<Product[]>>("/seller/products");
  return normalizeArrayPayload<Product>(unwrapPayload(data));
}

export async function fetchSellerDashboard(): Promise<SellerDashboardPayload> {
  const { data } = await apiClient.get<ApiResponse<SellerDashboardPayload>>("/seller/dashboard");
  return unwrapPayload(data);
}

export async function fetchSellerOrders(): Promise<Order[]> {
  const { data } = await apiClient.get<ApiResponse<Order[]>>("/seller/orders");
  return normalizeArrayPayload<Order>(unwrapPayload(data), ["data", "orders", "items", "payload"]);
}

export async function fetchSellerAnalytics(): Promise<SellerAnalyticsPayload> {
  const { data } = await apiClient.get<ApiResponse<SellerAnalyticsPayload>>("/seller/analytics");
  return unwrapPayload(data);
}

export async function fetchSellerEarnings(): Promise<SellerEarningsPayload> {
  const { data } = await apiClient.get<ApiResponse<SellerEarningsPayload>>("/seller/earnings");
  return unwrapPayload(data);
}

export async function fetchSellerSettings(): Promise<SellerProfile> {
  const { data } = await apiClient.get<ApiResponse<SellerProfile>>("/seller/settings");
  return unwrapPayload(data);
}

export async function updateSellerSettings(input: UpdateSellerSettingsInput): Promise<SellerProfile> {
  const { data } = await apiClient.put<ApiResponse<SellerProfile>>("/seller/settings", input);
  return unwrapPayload(data);
}

export async function createProduct(input: CreateProductInput): Promise<Product> {
  const { data } = await apiClient.post<ApiResponse<Product>>("/products", input);
  return unwrapPayload(data);
}

export async function updateProduct(slug: string, input: CreateProductInput): Promise<Product> {
  const { data } = await apiClient.put<ApiResponse<Product>>(`/products/${slug}`, input);
  return unwrapPayload(data);
}

export async function deleteProduct(slug: string): Promise<void> {
  await apiClient.delete(`/products/${slug}`);
}

export async function addToCart(productId: string): Promise<void> {
  await apiClient.post(`/cart/${productId}`);
}

export async function fetchCart(): Promise<CartProductItem[]> {
  const { data } = await apiClient.get<ApiResponse<CartProductItem[]>>("/cart");
  return normalizeArrayPayload<CartProductItem>(unwrapPayload(data), ["data", "items", "payload"]);
}

export async function removeFromCart(productId: string): Promise<void> {
  await apiClient.delete(`/cart/${productId}`);
}

export async function createTebexCheckout(productId: string, couponCode?: string): Promise<TebexCheckoutSession> {
  const { data } = await apiClient.post<ApiResponse<TebexCheckoutSession>>("/checkout/create", {
    product_id: productId,
    coupon_code: couponCode?.trim() || undefined,
  });
  return unwrapPayload(data);
}

export async function verifyTebexCheckout(orderId: string): Promise<Order> {
  const { data } = await apiClient.post<ApiResponse<{ order: Order }>>("/checkout/tebex/verify", {
    order_id: orderId,
  });
  const payload = unwrapPayload(data);
  return payload.order;
}

export async function uploadProductMedia(
  slug: string,
  file: File,
  mediaType: "cover" | "gallery" | "description" | "image" = "image",
  onProgress?: (progress: number) => void,
): Promise<ProductMedia> {
  const formData = new FormData();
  formData.set("media", file);
  formData.set("media_type", mediaType);
  const { data } = await apiClient.post<ApiResponse<ProductMedia>>(`/products/${slug}/media`, formData, {
    timeout: 120_000,
    onUploadProgress: (event) => {
      if (event.total && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    },
  });
  return unwrapPayload(data);
}

export async function fetchProductMedia(slug: string): Promise<ProductMedia[]> {
  const { data } = await apiClient.get<ApiResponse<ProductMedia[]>>(`/products/${slug}/media`);
  return normalizeArrayPayload<ProductMedia>(unwrapPayload(data), ["data", "media", "items", "payload"]);
}

export async function deleteProductMedia(slug: string, mediaId: string): Promise<void> {
  await apiClient.delete(`/products/${slug}/media/${mediaId}`);
}

export async function downloadOwnerProduct(slug: string): Promise<{ blob: Blob; fileName: string }> {
  const response = await apiClient.get<Blob>(`/products/${slug}/owner-download`, { responseType: "blob", timeout: 120_000 });
  const disposition = String(response.headers["content-disposition"] || "");
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plain = disposition.match(/filename="?([^";]+)"?/i)?.[1];
  return {
    blob: response.data,
    fileName: encoded ? decodeURIComponent(encoded) : plain || slug,
  };
}

export async function downloadProductVersion(slug: string, versionId: string): Promise<{ blob: Blob; fileName: string }> {
  const response = await apiClient.get<Blob>(`/products/${slug}/versions/${versionId}/download`, { responseType: "blob", timeout: 120_000 });
  const disposition = String(response.headers["content-disposition"] || "");
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plain = disposition.match(/filename="?([^";]+)"?/i)?.[1];
  return {
    blob: response.data,
    fileName: encoded ? decodeURIComponent(encoded) : plain || `${slug}-${versionId}`,
  };
}

export async function deleteProductVersion(slug: string, versionId: string): Promise<void> {
  await apiClient.delete(`/products/${slug}/versions/${versionId}`);
}

export async function uploadProductVersion(
  slug: string,
  input: { version_tag: string; post_update?: boolean; update_title?: string; changelog?: string; file: File },
  onProgress?: (progress: number) => void,
): Promise<{ version: ProductVersion; url?: string }> {
  const formData = new FormData();
  formData.set("version_tag", input.version_tag);
  formData.set("post_update", String(input.post_update ?? true));
  formData.set("update_title", input.update_title ?? "");
  formData.set("changelog", input.changelog ?? "");
  formData.set("file", input.file);
  const { data } = await apiClient.post<ApiResponse<{ version: ProductVersion; url?: string }>>(
    `/products/${slug}/versions`,
    formData,
    {
      timeout: 120_000,
      onUploadProgress: (event) => {
        if (event.total && onProgress) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      },
    },
  );
  return unwrapPayload(data);
}

export async function fetchSellerCoupons(): Promise<Coupon[]> {
  const { data } = await apiClient.get<ApiResponse<Coupon[]>>("/seller/coupons");
  return normalizeArrayPayload<Coupon>(unwrapPayload(data), ["data", "coupons", "items", "payload"]);
}

export async function createSellerCoupon(input: Partial<Coupon>): Promise<Coupon> {
  const { data } = await apiClient.post<ApiResponse<Coupon>>("/seller/coupons", input);
  return unwrapPayload(data);
}

export async function fetchSellerWebhooks(): Promise<Webhook[]> {
  const { data } = await apiClient.get<ApiResponse<Webhook[]>>("/seller/webhooks");
  return normalizeArrayPayload<Webhook>(unwrapPayload(data), ["data", "webhooks", "items", "payload"]);
}

export async function createSellerWebhook(input: { url: string; secret?: string; events: string[] }): Promise<Webhook> {
  const { data } = await apiClient.post<ApiResponse<Webhook>>("/seller/webhooks", input);
  return unwrapPayload(data);
}

export async function fetchPlatformStats(): Promise<StatsPayload> {
  const { data } = await apiClient.get<ApiResponse<StatsPayload>>("/admin/analytics/overview");
  return unwrapPayload(data);
}

export async function fetchAdminRevenueSeries(params?: { from?: string; to?: string; group_by?: "day" | "week" | "month" }): Promise<RevenuePoint[]> {
  const { data } = await apiClient.get<ApiResponse<RevenuePoint[]>>("/admin/analytics/revenue", { params });
  return normalizeArrayPayload<RevenuePoint>(unwrapPayload(data), ["data", "series", "items", "payload"]);
}

export async function fetchAdminTopProducts(limit = 10): Promise<ProductSalesStat[]> {
  const { data } = await apiClient.get<ApiResponse<ProductSalesStat[]>>("/admin/analytics/products", { params: { limit } });
  return normalizeArrayPayload<ProductSalesStat>(unwrapPayload(data), ["data", "products", "items", "payload"]);
}

export async function fetchAdminUsers(): Promise<User[]> {
  const { data } = await apiClient.get<ApiResponse<User[]>>("/admin/users");
  return normalizeArrayPayload<User>(unwrapPayload(data), ["data", "users", "items", "payload"]);
}

export async function fetchAdminUser(id: string): Promise<User> {
  const { data } = await apiClient.get<ApiResponse<User>>(`/admin/users/${id}`);
  return unwrapPayload(data);
}

export async function setAdminUserBanned(id: string, banned: boolean): Promise<void> {
  await apiClient.put(`/admin/users/${id}/${banned ? "ban" : "unban"}`);
}

export async function setAdminUserRole(id: string, role: User["role"]): Promise<void> {
  await apiClient.put(`/admin/users/${id}/role`, { role });
}

export async function fetchAdminProducts(): Promise<Product[]> {
  const { data } = await apiClient.get<ApiResponse<Product[]>>("/admin/products");
  return normalizeArrayPayload<Product>(unwrapPayload(data), ["data", "products", "items", "payload"]);
}

export async function approveAdminProduct(id: string): Promise<void> {
  await apiClient.put(`/admin/products/${id}/approve`);
}

export async function rejectAdminProduct(id: string): Promise<void> {
  await apiClient.put(`/admin/products/${id}/reject`);
}

export async function setAdminProductFeatured(id: string, featured: boolean): Promise<void> {
  await apiClient.put(`/admin/products/${id}/feature`, { featured });
}

export async function setAdminProductTebexPackage(id: string, packageId: number | null): Promise<void> {
  await apiClient.put(`/admin/products/${id}/tebex-package`, { package_id: packageId });
}

export async function fetchAdminOrders(): Promise<Order[]> {
  const { data } = await apiClient.get<ApiResponse<Order[]>>("/admin/orders");
  return normalizeArrayPayload<Order>(unwrapPayload(data), ["data", "orders", "items", "payload"]);
}

export async function refundAdminOrder(id: string): Promise<void> {
  await apiClient.post(`/admin/orders/${id}/refund`);
}

export async function fetchAdminSellerApplications(): Promise<SellerProfile[]> {
  const { data } = await apiClient.get<ApiResponse<SellerProfile[]>>("/admin/sellers/applications");
  return normalizeArrayPayload<SellerProfile>(unwrapPayload(data), ["data", "sellers", "items", "payload"]);
}

export async function approveAdminSeller(id: string): Promise<void> {
  await apiClient.put(`/admin/sellers/${id}/approve`);
}

export async function rejectAdminSeller(id: string): Promise<void> {
  await apiClient.put(`/admin/sellers/${id}/reject`);
}

export async function fetchAdminPayouts(): Promise<PayoutRequest[]> {
  const { data } = await apiClient.get<ApiResponse<PayoutRequest[]>>("/admin/payouts");
  return normalizeArrayPayload<PayoutRequest>(unwrapPayload(data), ["data", "payouts", "items", "payload"]);
}

export async function approveAdminPayout(id: string): Promise<void> {
  await apiClient.put(`/admin/payouts/${id}/approve`);
}

export async function rejectAdminPayout(id: string): Promise<void> {
  await apiClient.put(`/admin/payouts/${id}/reject`);
}

export async function fetchAdminReports(): Promise<Report[]> {
  const { data } = await apiClient.get<ApiResponse<Report[]>>("/admin/reports");
  return normalizeArrayPayload<Report>(unwrapPayload(data), ["data", "reports", "items", "payload"]);
}

export async function resolveAdminReport(id: string): Promise<void> {
  await apiClient.put(`/admin/reports/${id}/resolve`);
}

export async function dismissAdminReport(id: string): Promise<void> {
  await apiClient.put(`/admin/reports/${id}/dismiss`);
}

export async function fetchAdminCoupons(): Promise<Coupon[]> {
  const { data } = await apiClient.get<ApiResponse<Coupon[]>>("/admin/coupons");
  return normalizeArrayPayload<Coupon>(unwrapPayload(data), ["data", "coupons", "items", "payload"]);
}

export async function createAdminCoupon(input: CouponInput): Promise<Coupon> {
  const { data } = await apiClient.post<ApiResponse<Coupon>>("/admin/coupons", input);
  return unwrapPayload(data);
}

export async function updateAdminCoupon(id: string, input: CouponInput): Promise<Coupon> {
  const { data } = await apiClient.put<ApiResponse<Coupon>>(`/admin/coupons/${id}`, input);
  return unwrapPayload(data);
}

export async function deleteAdminCoupon(id: string): Promise<void> {
  await apiClient.delete(`/admin/coupons/${id}`);
}

export async function fetchAdminCategories(): Promise<Category[]> {
  const { data } = await apiClient.get<ApiResponse<Category[]>>("/admin/categories");
  return normalizeArrayPayload<Category>(unwrapPayload(data), ["data", "categories", "items", "payload"]);
}

export async function createAdminCategory(input: CategoryInput): Promise<Category> {
  const { data } = await apiClient.post<ApiResponse<Category>>("/categories", input);
  return unwrapPayload(data);
}

export async function updateAdminCategory(id: string, input: CategoryInput): Promise<Category> {
  const { data } = await apiClient.put<ApiResponse<Category>>(`/categories/${id}`, input);
  return unwrapPayload(data);
}

export async function deleteAdminCategory(id: string): Promise<void> {
  await apiClient.delete(`/categories/${id}`);
}

export async function fetchAdminSettings(): Promise<AdminSettings> {
  const { data } = await apiClient.get<ApiResponse<AdminSettings>>("/admin/settings");
  return unwrapPayload(data);
}

export async function updateAdminSetting(key: keyof AdminSettings, value: AdminSettings[typeof key]): Promise<void> {
  await apiClient.put("/admin/settings", { key, value });
}

export async function fetchPublicSettings(): Promise<PublicSiteSettings> {
  const { data } = await apiClient.get<ApiResponse<PublicSiteSettings>>("/settings/public");
  return unwrapPayload(data);
}

export async function fetchAdminAuditLogs(): Promise<AuditLog[]> {
  const { data } = await apiClient.get<ApiResponse<AuditLog[]>>("/admin/audit-logs");
  return normalizeArrayPayload<AuditLog>(unwrapPayload(data), ["data", "logs", "items", "payload"]);
}

export async function fetchMe(): Promise<User> {
  const { data } = await apiClient.get<ApiResponse<User>>("/users/me");
  return normalizeAuthUser(data) ?? unwrapPayload(data);
}

export async function updateMe(input: UpdateMeInput): Promise<User> {
  const { data } = await apiClient.put<ApiResponse<User>>("/users/me", input);
  return normalizeAuthUser(data) ?? unwrapPayload(data);
}

export async function uploadAvatar(file: File, onProgress?: (progress: number) => void): Promise<{ avatar_url: string }> {
  const formData = new FormData();
  formData.set("avatar", file);
  const { data } = await apiClient.put<ApiResponse<{ avatar_url: string }>>("/users/me/avatar", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (event) => {
      if (event.total && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    },
  });
  return unwrapPayload(data);
}

export async function uploadProfileBanner(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<{ profile_banner_url: string }> {
  const formData = new FormData();
  formData.set("banner", file);
  const { data } = await apiClient.put<ApiResponse<{ profile_banner_url: string }>>("/users/me/banner", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (event) => {
      if (event.total && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    },
  });
  return unwrapPayload(data);
}

export async function deleteMe(): Promise<void> {
  await apiClient.delete("/users/me");
  clearAuthState();
}

export async function fetchOrders(): Promise<Order[]> {
  const { data } = await apiClient.get<ApiResponse<Order[]>>("/orders");
  return normalizeArrayPayload<Order>(unwrapPayload(data), ["data", "orders", "items", "payload"]);
}

export async function fetchNotifications(): Promise<MarketplaceNotification[]> {
  const { data } = await apiClient.get<ApiResponse<MarketplaceNotification[]>>("/notifications");
  return normalizeArrayPayload<MarketplaceNotification>(unwrapPayload(data), ["data", "notifications", "items", "payload"]);
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiClient.put(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiClient.put("/notifications/read-all");
}

export async function fetchConversations(): Promise<Conversation[]> {
  const { data } = await apiClient.get<ApiResponse<Conversation[]>>("/conversations");
  return normalizeArrayPayload<Conversation>(unwrapPayload(data), ["data", "conversations", "items", "payload"]);
}

export async function fetchConversation(id: string): Promise<{ conversation: Conversation; messages: ConversationMessage[] }> {
  const { data } = await apiClient.get<ApiResponse<{ conversation: Conversation; messages: ConversationMessage[] }>>(`/conversations/${id}`);
  return unwrapPayload(data);
}

export async function createConversation(input: {
  title: string;
  body: string;
  recipient_ids: string[];
  context_type?: string | null;
  context_id?: string | null;
}): Promise<Conversation> {
  const { data } = await apiClient.post<ApiResponse<Conversation>>("/conversations", input);
  return unwrapPayload(data);
}

export async function replyConversation(id: string, body: string): Promise<ConversationMessage> {
  const { data } = await apiClient.post<ApiResponse<ConversationMessage>>(`/conversations/${id}/messages`, { body });
  return unwrapPayload(data);
}

export async function markConversationRead(id: string): Promise<void> {
  await apiClient.put(`/conversations/${id}/read`);
}

export async function leaveConversation(id: string): Promise<void> {
  await apiClient.post(`/conversations/${id}/leave`);
}

export async function fetchTicketMeta(): Promise<{
  categories: SupportTicketCategory[];
  statuses: SupportTicketStatus[];
  priorities: SupportTicketPriority[];
}> {
  const { data } = await apiClient.get<ApiResponse<{ categories: SupportTicketCategory[]; statuses: SupportTicketStatus[]; priorities: SupportTicketPriority[] }>>("/tickets/meta");
  return unwrapPayload(data);
}

export async function fetchAdminTicketConfig(): Promise<{
  categories: SupportTicketCategory[];
  statuses: SupportTicketStatus[];
  priorities: SupportTicketPriority[];
  features: SupportTicketFeatureConfig[];
}> {
  const { data } = await apiClient.get<
    ApiResponse<{ categories: SupportTicketCategory[]; statuses: SupportTicketStatus[]; priorities: SupportTicketPriority[]; features: SupportTicketFeatureConfig[] }>
  >("/admin/tickets/config");
  return unwrapPayload(data);
}

export async function saveAdminTicketCategory(
  input: Partial<SupportTicketCategory> & { name: string; slug?: string },
): Promise<void> {
  const payload = {
    parent_id: input.parent_id || null,
    name: input.name,
    slug: input.slug || input.name,
    description: input.description || null,
    sort_order: input.sort_order ?? 0,
    is_active: input.is_active ?? true,
    allow_customer_open: input.allow_customer_open ?? true,
  };
  if (input.id) {
    await apiClient.put(`/admin/tickets/categories/${input.id}`, payload);
    return;
  }
  await apiClient.post("/admin/tickets/categories", payload);
}

export async function deleteAdminTicketCategory(id: string): Promise<void> {
  await apiClient.delete(`/admin/tickets/categories/${id}`);
}

export async function saveAdminTicketStatus(
  input: Partial<SupportTicketStatus> & { name: string; slug?: string },
): Promise<void> {
  const payload = {
    name: input.name,
    slug: input.slug || input.name,
    is_closed: input.is_closed ?? false,
    status_on_customer_reply: input.status_on_customer_reply || null,
    status_on_staff_reply: input.status_on_staff_reply || null,
    include_in_counts: input.include_in_counts ?? true,
    sort_order: input.sort_order ?? 0,
  };
  if (input.id) {
    await apiClient.put(`/admin/tickets/statuses/${input.id}`, payload);
    return;
  }
  await apiClient.post("/admin/tickets/statuses", payload);
}

export async function deleteAdminTicketStatus(id: string): Promise<void> {
  await apiClient.delete(`/admin/tickets/statuses/${id}`);
}

export async function saveAdminTicketPriority(
  input: Partial<SupportTicketPriority> & { name: string; slug?: string },
): Promise<void> {
  const payload = {
    name: input.name,
    slug: input.slug || input.name,
    sort_order: input.sort_order ?? 0,
    is_active: input.is_active ?? true,
  };
  if (input.id) {
    await apiClient.put(`/admin/tickets/priorities/${input.id}`, payload);
    return;
  }
  await apiClient.post("/admin/tickets/priorities", payload);
}

export async function deleteAdminTicketPriority(id: string): Promise<void> {
  await apiClient.delete(`/admin/tickets/priorities/${id}`);
}

export async function saveAdminTicketFeature(
  input: Partial<SupportTicketFeatureConfig> & { feature_type: string; title: string; slug?: string },
): Promise<void> {
  const payload = {
    feature_type: input.feature_type,
    title: input.title,
    slug: input.slug || input.title,
    body: input.body || null,
    config: input.config || {},
    sort_order: input.sort_order ?? 0,
    is_active: input.is_active ?? true,
  };
  if (input.id) {
    await apiClient.put(`/admin/tickets/features/${input.id}`, payload);
    return;
  }
  await apiClient.post("/admin/tickets/features", payload);
}

export async function deleteAdminTicketFeature(id: string): Promise<void> {
  await apiClient.delete(`/admin/tickets/features/${id}`);
}

export async function fetchTickets(params: { scope?: "all"; status?: string } = {}): Promise<SupportTicket[]> {
  const { data } = await apiClient.get<ApiResponse<SupportTicket[]>>("/tickets", { params });
  return normalizeArrayPayload<SupportTicket>(unwrapPayload(data), ["data", "tickets", "items", "payload"]);
}

export async function fetchTicket(id: string): Promise<{ ticket: SupportTicket; messages: SupportTicketMessage[] }> {
  const { data } = await apiClient.get<ApiResponse<{ ticket: SupportTicket; messages: SupportTicketMessage[] }>>(`/tickets/${id}`);
  return unwrapPayload(data);
}

export async function createTicket(input: {
  title: string;
  body: string;
  category_id?: string | null;
  priority_id?: string | null;
  product_id?: string | null;
  order_id?: string | null;
}): Promise<SupportTicket> {
  const { data } = await apiClient.post<ApiResponse<SupportTicket>>("/tickets", input);
  return unwrapPayload(data);
}

export async function replyTicket(id: string, body: string): Promise<SupportTicketMessage> {
  const { data } = await apiClient.post<ApiResponse<SupportTicketMessage>>(`/tickets/${id}/messages`, { body });
  return unwrapPayload(data);
}

export async function updateTicketStatus(id: string, status: string): Promise<SupportTicket> {
  const { data } = await apiClient.put<ApiResponse<SupportTicket>>(`/tickets/${id}/status`, { status });
  return unwrapPayload(data);
}

export async function markTicketRead(id: string): Promise<void> {
  await apiClient.put(`/tickets/${id}/read`);
}

export async function fetchOrderDownload(id: string): Promise<{ download_url: string; download_token: string; expires_at: string }> {
  const { data } = await apiClient.get<ApiResponse<{ download_url: string; download_token: string; expires_at: string }>>(`/orders/${id}/download`);
  return unwrapPayload(data);
}

export async function fetchSearchSuggestions(query: string): Promise<string[]> {
  const { data } = await apiClient.get<ApiResponse<string[]>>("/search/suggestions", {
    params: { q: query },
  });
  return extractArray<string>(unwrapPayload(data));
}

export async function refreshSession(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const { data } = await apiClient.post<ApiResponse<{ access_token: string }>>("/auth/refresh");
      const payload = unwrapPayload(data) as { access_token?: string; csrf_token?: string };
      if (!payload.access_token) {
        return null;
      }
      const csrfToken = typeof payload.csrf_token === "string" && payload.csrf_token ? payload.csrf_token : null;
      setAuthToken(payload.access_token, undefined, csrfToken);
      return payload.access_token;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export function setAuthToken(token: string, fallbackUser?: User, csrfToken?: string | null) {
  const state = useAuthStore.getState();
  const nextCsrf = csrfToken ?? state.csrfToken;
  if (fallbackUser !== undefined || state.user) {
    state.setAuth(fallbackUser ?? state.user, token, nextCsrf);
    return;
  }
  state.setToken(token, nextCsrf);
}

export function clearAuthState() {
  useAuthStore.getState().clearAuth();
}

function safeFrontendPath(path?: string | null): string | null {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.startsWith("/auth/callback")) {
    return null;
  }
  return path;
}

export async function exchangeDgenCallback(code: string, state: string): Promise<DgenCallbackResponse> {
  const { data } = await apiClient.get<DgenCallbackResponse>("/auth/callback", {
    params: { code, state },
    headers: { Accept: "application/json" },
  });
  return data;
}

export async function createDgenEmbedSession(
  next?: string | null,
  backgroundColor?: string,
): Promise<DgenEmbedSession> {
  const { data } = await apiClient.get<DgenEmbedSession>("/auth/embed-session", {
    params: {
      ...(safeFrontendPath(next) ? { next: safeFrontendPath(next) } : {}),
      ...(backgroundColor ? { bg_color: backgroundColor } : {}),
    },
    headers: { Accept: "application/json" },
  });
  return data;
}

export function requestDgenLogin(next?: string | null) {
  const target = new URL("/login", window.location.origin);
  const safeNext = safeFrontendPath(next);
  if (safeNext) {
    target.searchParams.set("next", safeNext);
  }
  window.location.href = target.toString();
}

export function requestDgenRedirectLogin(next?: string | null) {
  const target = new URL(`${API_BASE}/auth/login`);
  const safeNext = safeFrontendPath(next);
  if (safeNext) {
    target.searchParams.set("next", safeNext);
  }
  window.location.href = target.toString();
}

export async function requestLogout() {
  await apiClient.post("/auth/logout");
  clearAuthState();
}

export async function fetchSellerApplication(): Promise<SellerApplicationStatus> {
  const { data } = await apiClient.get<ApiResponse<SellerApplicationStatus>>("/seller/application");
  return unwrapPayload(data);
}

export async function applySeller(input: SellerApplyInput): Promise<SellerApplicationStatus> {
  const { data } = await apiClient.post<ApiResponse<SellerApplicationStatus>>("/seller/apply", input);
  return unwrapPayload(data);
}
