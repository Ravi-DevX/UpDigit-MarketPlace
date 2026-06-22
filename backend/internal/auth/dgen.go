package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"marketplace/backend/internal/models"
	"marketplace/backend/internal/repository"
)

const dgenOAuthScope = "openid profile email username"

var usernameReplacer = regexp.MustCompile(`[^a-z0-9_.-]+`)
var dgenEmbedColor = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

type DGENClient struct {
	ClientID          string
	ClientSecret      string
	RedirectURI       string
	AuthorizeURL      string
	EmbedAuthorizeURL string
	TokenURL          string
	UserInfoURL       string
	HTTPClient        *http.Client
}

type DGENUserInfo struct {
	Sub               string `json:"sub"`
	ID                string `json:"id"`
	UserID            string `json:"user_id"`
	Username          string `json:"username"`
	PreferredUsername string `json:"preferred_username"`
	Name              string `json:"name"`
	Nickname          string `json:"nickname"`
	Avatar            string `json:"avatar"`
	AvatarURL         string `json:"avatar_url"`
	Picture           string `json:"picture"`
	Email             string `json:"email"`
}

func (c *DGENClient) BuildAuthURL(state string) string {
	query := url.Values{
		"client_id":     {c.ClientID},
		"redirect_uri":  {c.RedirectURI},
		"response_type": {"code"},
		"scope":         {dgenOAuthScope},
		"state":         {state},
	}
	return c.AuthorizeURL + "?" + strings.ReplaceAll(query.Encode(), "+", "%20")
}

func (c *DGENClient) BuildEmbeddedAuthURL(state, parentOrigin, backgroundColor string) (string, error) {
	state = strings.TrimSpace(state)
	if state == "" {
		return "", fmt.Errorf("oauth state is required")
	}
	if strings.TrimSpace(c.ClientID) == "" {
		return "", fmt.Errorf("dgen client id is required")
	}
	endpoint := strings.TrimSpace(c.EmbedAuthorizeURL)
	if endpoint == "" {
		return "", fmt.Errorf("dgen embedded authorize url is required")
	}

	parent, err := url.Parse(strings.TrimSpace(parentOrigin))
	if err != nil || parent.Scheme == "" || parent.Host == "" || parent.Path != "" {
		return "", fmt.Errorf("valid parent origin is required")
	}
	redirect, err := url.Parse(strings.TrimSpace(c.RedirectURI))
	if err != nil || redirect.Scheme == "" || redirect.Host == "" {
		return "", fmt.Errorf("valid dgen redirect uri is required")
	}
	if !strings.EqualFold(redirect.Scheme, parent.Scheme) || !strings.EqualFold(redirect.Host, parent.Host) {
		return "", fmt.Errorf("dgen redirect uri origin must match parent origin")
	}

	query := url.Values{
		"client_id":     {c.ClientID},
		"redirect_uri":  {c.RedirectURI},
		"response_type": {"code"},
		"scope":         {dgenOAuthScope},
		"state":         {state},
		"parent_origin": {parent.Scheme + "://" + parent.Host},
	}
	if dgenEmbedColor.MatchString(backgroundColor) {
		query.Set("bg_color", backgroundColor)
	}
	return endpoint + "?" + strings.ReplaceAll(query.Encode(), "+", "%20"), nil
}

type DGENOAuthState struct {
	Next string `json:"next,omitempty"`
}

func NewDGENOAuthState(next string) (string, error) {
	payload := DGENOAuthState{Next: SafeFrontendPath(next)}
	encoded, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	return string(encoded), nil
}

func ParseDGENOAuthState(raw string) DGENOAuthState {
	if raw == "" || raw == "pending" {
		return DGENOAuthState{Next: "/dashboard"}
	}
	var payload DGENOAuthState
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		return DGENOAuthState{Next: "/dashboard"}
	}
	payload.Next = SafeFrontendPath(payload.Next)
	return payload
}

func SafeFrontendPath(next string) string {
	next = strings.TrimSpace(next)
	if next == "" {
		return "/dashboard"
	}
	if strings.HasPrefix(next, "//") || strings.ContainsAny(next, "\r\n") {
		return "/dashboard"
	}
	parsed, err := url.Parse(next)
	if err != nil || parsed.IsAbs() || parsed.Host != "" || !strings.HasPrefix(parsed.Path, "/") {
		return "/dashboard"
	}
	if parsed.Path == "/auth/callback" || strings.HasPrefix(parsed.Path, "/auth/callback/") {
		return "/dashboard"
	}
	return parsed.String()
}

type dgenTokenResponse struct {
	AccessToken      string `json:"access_token"`
	TokenType        string `json:"token_type"`
	ExpiresIn        int    `json:"expires_in"`
	RefreshToken     string `json:"refresh_token"`
	IDToken          string `json:"id_token"`
	Error            string `json:"error"`
	ErrorDescription string `json:"error_description"`
}

type DGENTokenError struct {
	StatusCode  int
	OAuthError  string
	Description string
}

func (e *DGENTokenError) Error() string {
	if e.OAuthError != "" || e.Description != "" {
		return fmt.Sprintf("token exchange failed: status=%d error=%s description=%s", e.StatusCode, e.OAuthError, e.Description)
	}
	return fmt.Sprintf("token exchange failed: status=%d", e.StatusCode)
}

func (c *DGENClient) ExchangeCode(ctx context.Context, code string) (string, error) {
	payload, err := c.exchangeCode(ctx, code)
	if err != nil {
		return "", err
	}
	return payload.AccessToken, nil
}

func (c *DGENClient) exchangeCode(ctx context.Context, code string) (*dgenTokenResponse, error) {
	if err := c.validateOAuthConfig(); err != nil {
		return nil, err
	}
	code = strings.TrimSpace(code)
	if code == "" {
		return nil, fmt.Errorf("authorization code is required")
	}

	body := url.Values{
		"client_id":     {c.ClientID},
		"client_secret": {c.ClientSecret},
		"code":          {code},
		"grant_type":    {"authorization_code"},
		"redirect_uri":  {c.RedirectURI},
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.TokenURL, strings.NewReader(body.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient().Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var payload dgenTokenResponse
	decodeErr := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&payload)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, &DGENTokenError{
			StatusCode:  resp.StatusCode,
			OAuthError:  payload.Error,
			Description: payload.ErrorDescription,
		}
	}
	if decodeErr != nil {
		return nil, decodeErr
	}
	if payload.AccessToken == "" {
		return nil, fmt.Errorf("token exchange returned empty access token")
	}
	return &payload, nil
}

func (c *DGENClient) FetchUserInfo(ctx context.Context, accessToken string) (*DGENUserInfo, error) {
	if strings.TrimSpace(c.UserInfoURL) == "" {
		return nil, fmt.Errorf("dgen userinfo url is required")
	}
	accessToken = strings.TrimSpace(accessToken)
	if accessToken == "" {
		return nil, fmt.Errorf("access token is required")
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.UserInfoURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient().Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("userinfo request failed: status=%d", resp.StatusCode)
	}

	info, err := decodeDGENUserInfo(resp.Body)
	if err != nil {
		return nil, err
	}
	if info.Subject() == "" {
		return nil, fmt.Errorf("userinfo missing subject")
	}
	return info, nil
}

func (c *DGENClient) UpsertUser(ctx context.Context, repo *repository.Repo, info *DGENUserInfo) (*models.User, error) {
	externalID := info.Subject()
	if externalID == "" {
		return nil, fmt.Errorf("dgen subject is required")
	}

	displayName := strings.TrimSpace(info.Name)
	if displayName == "" {
		displayName = strings.TrimSpace(info.Nickname)
	}
	if displayName == "" {
		displayName = strings.TrimSpace(info.username())
	}

	avatar := strings.TrimSpace(info.avatarURL())
	email := strings.ToLower(strings.TrimSpace(info.Email))
	emailVerified := email != ""
	if email == "" {
		email = fallbackDGENEmail(externalID)
	}

	username := normalizeDGENUsername(info.username(), externalID)
	user, err := repo.UpsertUserByExternalID(ctx, externalID, username, displayName, email, avatar, emailVerified)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (c *DGENClient) validateOAuthConfig() error {
	if strings.TrimSpace(c.ClientID) == "" {
		return fmt.Errorf("dgen client id is required")
	}
	if strings.TrimSpace(c.ClientSecret) == "" {
		return fmt.Errorf("dgen client secret is required")
	}
	if strings.TrimSpace(c.RedirectURI) == "" {
		return fmt.Errorf("dgen redirect uri is required")
	}
	if strings.TrimSpace(c.TokenURL) == "" {
		return fmt.Errorf("dgen token url is required")
	}
	return nil
}

func (c *DGENClient) httpClient() *http.Client {
	if c.HTTPClient != nil {
		return c.HTTPClient
	}
	return &http.Client{Timeout: 10 * time.Second}
}

func decodeDGENUserInfo(reader io.Reader) (*DGENUserInfo, error) {
	var raw map[string]json.RawMessage
	if err := json.NewDecoder(io.LimitReader(reader, 1<<20)).Decode(&raw); err != nil {
		return nil, err
	}

	info := decodeDGENUserInfoObject(raw)
	if info.Subject() == "" {
		for _, key := range []string{"data", "user", "profile"} {
			nestedRaw, ok := raw[key]
			if !ok {
				continue
			}
			var nested map[string]json.RawMessage
			if err := json.Unmarshal(nestedRaw, &nested); err != nil {
				continue
			}
			nestedInfo := decodeDGENUserInfoObject(nested)
			if nestedInfo.Subject() != "" {
				info = nestedInfo
				break
			}
		}
	}
	return &info, nil
}

func decodeDGENUserInfoObject(raw map[string]json.RawMessage) DGENUserInfo {
	var info DGENUserInfo
	payload, err := json.Marshal(raw)
	if err != nil {
		return info
	}
	_ = json.Unmarshal(payload, &info)
	return info
}

func (i *DGENUserInfo) Subject() string {
	for _, candidate := range []string{i.Sub, i.ID, i.UserID} {
		if trimmed := strings.TrimSpace(candidate); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func (i *DGENUserInfo) username() string {
	for _, candidate := range []string{i.Username, i.PreferredUsername, i.Nickname, i.Name} {
		if trimmed := strings.TrimSpace(candidate); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func (i *DGENUserInfo) avatarURL() string {
	for _, candidate := range []string{i.Avatar, i.AvatarURL, i.Picture} {
		if trimmed := strings.TrimSpace(candidate); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func normalizeDGENUsername(username, externalID string) string {
	candidate := strings.ToLower(strings.TrimSpace(username))
	candidate = usernameReplacer.ReplaceAllString(candidate, "_")
	candidate = strings.Trim(candidate, "._-")
	if len(candidate) > 50 {
		candidate = candidate[:50]
		candidate = strings.Trim(candidate, "._-")
	}
	if len(candidate) >= 3 {
		return candidate
	}

	fallback := "dgen_" + shortDGENHash(externalID, 12)
	if len(fallback) > 50 {
		return fallback[:50]
	}
	return fallback
}

func fallbackDGENEmail(externalID string) string {
	return "dgen-" + shortDGENHash(externalID, 24) + "@users.dgen.local"
}

func shortDGENHash(value string, size int) string {
	sum := sha256.Sum256([]byte(strings.TrimSpace(value)))
	encoded := hex.EncodeToString(sum[:])
	if size <= 0 || size > len(encoded) {
		return encoded
	}
	return encoded[:size]
}

func GenerateHexRandom(size int) (string, error) {
	if size <= 0 {
		return "", nil
	}
	buf := make([]byte, size)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

func RandomState() (string, error) {
	return GenerateHexRandom(32)
}
