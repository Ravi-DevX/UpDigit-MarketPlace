package payment

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type TebexClient struct {
	PublicToken string
	PrivateKey  string
	BaseURL     string
	HTTPClient  *http.Client
}

type TebexPackage struct {
	ID         int64   `json:"id"`
	Name       string  `json:"name"`
	Type       string  `json:"type"`
	BasePrice  float64 `json:"base_price"`
	TotalPrice float64 `json:"total_price"`
	Currency   string  `json:"currency"`
}

type TebexCreateBasketRequest struct {
	CompleteURL          string         `json:"complete_url"`
	CancelURL            string         `json:"cancel_url"`
	Custom               map[string]any `json:"custom"`
	CompleteAutoRedirect bool           `json:"complete_auto_redirect"`
	IPAddress            string         `json:"ip_address,omitempty"`
}

type TebexAddPackageRequest struct {
	PackageID int64          `json:"package_id"`
	Quantity  int            `json:"quantity"`
	Custom    map[string]any `json:"custom,omitempty"`
}

type TebexBasketLinks struct {
	Checkout string `json:"checkout"`
	Payment  string `json:"payment"`
}

func (links *TebexBasketLinks) UnmarshalJSON(data []byte) error {
	raw := bytes.TrimSpace(data)
	if len(raw) == 0 || bytes.Equal(raw, []byte("null")) {
		return nil
	}
	if raw[0] == '[' {
		var entries []json.RawMessage
		if err := json.Unmarshal(raw, &entries); err != nil {
			return err
		}
		if len(entries) == 0 {
			return nil
		}
		return json.Unmarshal(entries[0], links)
	}
	type basketLinks TebexBasketLinks
	return json.Unmarshal(raw, (*basketLinks)(links))
}

type TebexBasketPackage struct {
	ID        int64 `json:"id"`
	PackageID int64 `json:"package_id"`
	Qty       int   `json:"qty"`
}

type TebexBasket struct {
	ID                   any                  `json:"id"`
	Ident                string               `json:"ident"`
	Complete             bool                 `json:"complete"`
	Email                string               `json:"email"`
	Username             string               `json:"username"`
	BasePrice            float64              `json:"base_price"`
	SalesTax             float64              `json:"sales_tax"`
	TotalPrice           float64              `json:"total_price"`
	Currency             string               `json:"currency"`
	Custom               map[string]any       `json:"custom"`
	Packages             []TebexBasketPackage `json:"packages"`
	Links                TebexBasketLinks     `json:"links"`
	CompleteAutoRedirect bool                 `json:"complete_auto_redirect"`
}

type TebexAPIError struct {
	Status int
	Type   string `json:"type"`
	Title  string `json:"title"`
	Detail string `json:"detail"`
}

func (e *TebexAPIError) Error() string {
	detail := strings.TrimSpace(e.Detail)
	if detail == "" {
		detail = strings.TrimSpace(e.Title)
	}
	if detail == "" {
		detail = http.StatusText(e.Status)
	}
	return fmt.Sprintf("tebex headless api: status=%d detail=%s", e.Status, detail)
}

func (c *TebexClient) FetchPackage(ctx context.Context, packageID int64) (TebexPackage, error) {
	if packageID <= 0 {
		return TebexPackage{}, fmt.Errorf("valid tebex package identifier is required")
	}
	raw, err := c.do(ctx, http.MethodGet, c.accountPath("/packages/"+fmt.Sprint(packageID)), nil)
	if err != nil {
		return TebexPackage{}, err
	}
	data, err := unwrapData(raw)
	if err != nil {
		return TebexPackage{}, err
	}
	var packages []TebexPackage
	if err := json.Unmarshal(data, &packages); err == nil {
		if len(packages) == 0 {
			return TebexPackage{}, fmt.Errorf("tebex package was not returned")
		}
		return packages[0], nil
	}
	var pkg TebexPackage
	if err := json.Unmarshal(data, &pkg); err != nil {
		return TebexPackage{}, err
	}
	if pkg.ID == 0 {
		return TebexPackage{}, fmt.Errorf("tebex package was not returned")
	}
	return pkg, nil
}

func (c *TebexClient) CreateBasket(ctx context.Context, request TebexCreateBasketRequest) (TebexBasket, error) {
	raw, err := c.do(ctx, http.MethodPost, c.accountPath("/baskets"), request)
	if err != nil {
		return TebexBasket{}, err
	}
	return decodeBasket(raw)
}

func (c *TebexClient) AddPackage(ctx context.Context, ident string, packageID int64, custom map[string]any) (TebexBasket, error) {
	ident, err := validIdent(ident)
	if err != nil {
		return TebexBasket{}, err
	}
	if packageID <= 0 {
		return TebexBasket{}, fmt.Errorf("valid tebex package identifier is required")
	}
	raw, err := c.do(ctx, http.MethodPost, "/baskets/"+url.PathEscape(ident)+"/packages", TebexAddPackageRequest{
		PackageID: packageID,
		Quantity:  1,
		Custom:    custom,
	})
	if err != nil {
		return TebexBasket{}, err
	}
	return decodeBasket(raw)
}

func (c *TebexClient) ApplyCoupon(ctx context.Context, ident, code string) (TebexBasket, error) {
	ident, err := validIdent(ident)
	if err != nil {
		return TebexBasket{}, err
	}
	code = strings.TrimSpace(code)
	if code == "" {
		return TebexBasket{}, fmt.Errorf("coupon code is required")
	}
	raw, err := c.do(ctx, http.MethodPost, c.accountPath("/baskets/"+url.PathEscape(ident)+"/coupons"), map[string]string{"coupon_code": code})
	if err != nil {
		return TebexBasket{}, err
	}
	return decodeBasket(raw)
}

func (c *TebexClient) FetchBasket(ctx context.Context, ident string) (TebexBasket, error) {
	ident, err := validIdent(ident)
	if err != nil {
		return TebexBasket{}, err
	}
	raw, err := c.do(ctx, http.MethodGet, c.accountPath("/baskets/"+url.PathEscape(ident)), nil)
	if err != nil {
		return TebexBasket{}, err
	}
	return decodeBasket(raw)
}

func (c *TebexClient) accountPath(suffix string) string {
	return "/accounts/" + url.PathEscape(strings.TrimSpace(c.PublicToken)) + suffix
}

func (c *TebexClient) do(ctx context.Context, method, path string, requestBody any) ([]byte, error) {
	if strings.TrimSpace(c.PublicToken) == "" || strings.TrimSpace(c.PrivateKey) == "" {
		return nil, fmt.Errorf("tebex headless credentials are not configured")
	}
	baseURL := strings.TrimRight(strings.TrimSpace(c.BaseURL), "/")
	if baseURL == "" {
		baseURL = "https://headless.tebex.io/api"
	}

	var body io.Reader
	if requestBody != nil {
		encoded, err := json.Marshal(requestBody)
		if err != nil {
			return nil, err
		}
		body = bytes.NewReader(encoded)
	}
	req, err := http.NewRequestWithContext(ctx, method, baseURL+path, body)
	if err != nil {
		return nil, err
	}
	req.SetBasicAuth(c.PublicToken, c.PrivateKey)
	req.Header.Set("Accept", "application/json")
	if requestBody != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	response, err := c.httpClient().Do(req)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(response.Body, 2<<20))
	if err != nil {
		return nil, err
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		apiError := &TebexAPIError{Status: response.StatusCode}
		_ = json.Unmarshal(raw, apiError)
		return nil, apiError
	}
	return raw, nil
}

func decodeBasket(raw []byte) (TebexBasket, error) {
	data, err := unwrapData(raw)
	if err != nil {
		return TebexBasket{}, err
	}
	var basket TebexBasket
	if err := json.Unmarshal(data, &basket); err != nil {
		return TebexBasket{}, err
	}
	if strings.TrimSpace(basket.Ident) == "" {
		return TebexBasket{}, fmt.Errorf("tebex returned an empty basket identifier")
	}
	return basket, nil
}

func unwrapData(raw []byte) ([]byte, error) {
	if len(bytes.TrimSpace(raw)) == 0 {
		return nil, fmt.Errorf("tebex returned an empty response")
	}
	var wrapper struct {
		Data json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(raw, &wrapper); err == nil && len(bytes.TrimSpace(wrapper.Data)) > 0 && string(bytes.TrimSpace(wrapper.Data)) != "null" {
		return wrapper.Data, nil
	}
	return raw, nil
}

func validIdent(ident string) (string, error) {
	ident = strings.TrimSpace(ident)
	if ident == "" || strings.ContainsAny(ident, "/?#") {
		return "", fmt.Errorf("valid tebex basket identifier is required")
	}
	return ident, nil
}

func (c *TebexClient) httpClient() *http.Client {
	if c.HTTPClient != nil {
		return c.HTTPClient
	}
	return &http.Client{Timeout: 15 * time.Second}
}
