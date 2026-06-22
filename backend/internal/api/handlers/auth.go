package handlers

import (
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"marketplace/backend/internal/api/middleware"
	"marketplace/backend/internal/auth"

	"github.com/gin-gonic/gin"
)

const (
	dgenStatePrefix      = "oauth_state:"
	refreshTokenPrefix   = "refresh:"
	refreshGracePrefix   = "refresh_grace:"
	refreshGraceTTL      = 30 * time.Second
	dgenCallbackFailBase = "dgen-callback"
)

func (h *Handler) RegisterAuthRoutes(router gin.IRoutes) {
	router.GET("/login", h.dgenLogin)
	router.GET("/embed-session", h.dgenEmbedSession)
	router.GET("/callback", h.dgenCallback)
	router.POST("/logout", h.logout)
	router.POST("/refresh", h.refresh)
}

func (h *Handler) dgenLogin(c *gin.Context) {
	client := h.dgenClient()
	state, err := h.createDGENState(c, c.Query("next"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to initialize login"})
		return
	}

	c.Redirect(http.StatusFound, client.BuildAuthURL(state))
}

func (h *Handler) dgenEmbedSession(c *gin.Context) {
	state, err := h.createDGENState(c, c.Query("next"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to initialize login"})
		return
	}

	parentOrigin, err := configuredOrigin(h.Config.FrontendURL)
	if err != nil {
		_ = h.Redis.Del(c, dgenStatePrefix+state).Err()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "embedded login is not configured"})
		return
	}
	client := h.dgenClient()
	authorizationURL, err := client.BuildEmbeddedAuthURL(state, parentOrigin, c.Query("bg_color"))
	if err != nil {
		_ = h.Redis.Del(c, dgenStatePrefix+state).Err()
		if h.Logger != nil {
			h.Logger.Error().Err(err).Msg("dgen embedded login configuration is invalid")
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "embedded login is not configured"})
		return
	}
	authOrigin, err := configuredOrigin(client.EmbedAuthorizeURL)
	if err != nil {
		_ = h.Redis.Del(c, dgenStatePrefix+state).Err()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "embedded login is not configured"})
		return
	}

	c.Header("Cache-Control", "no-store")
	c.JSON(http.StatusOK, gin.H{
		"authorization_url": authorizationURL,
		"state":             state,
		"parent_origin":     parentOrigin,
		"auth_origin":       authOrigin,
		"expires_in":        600,
	})
}

func (h *Handler) createDGENState(c *gin.Context, next string) (string, error) {
	state, err := auth.RandomState()
	if err != nil {
		return "", err
	}
	stateValue, err := auth.NewDGENOAuthState(next)
	if err != nil {
		return "", err
	}

	if err := h.Redis.Set(c, dgenStatePrefix+state, stateValue, 10*time.Minute).Err(); err != nil {
		return "", err
	}
	return state, nil
}

func configuredOrigin(raw string) (string, error) {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" {
		return "", fmt.Errorf("invalid origin")
	}
	return parsed.Scheme + "://" + parsed.Host, nil
}

func (h *Handler) dgenCallback(c *gin.Context) {
	c.Header("Cache-Control", "no-store")
	clientIP := middleware.ClientIP(c)
	if err := h.checkDGENLock(c, clientIP); err != nil {
		h.respondDGENCallbackError(c, http.StatusTooManyRequests, err.Error())
		return
	}

	if oauthError := strings.TrimSpace(c.Query("error")); oauthError != "" {
		h.recordDGENFailure(c, clientIP)
		description := strings.TrimSpace(c.Query("error_description"))
		if description != "" {
			oauthError = oauthError + ": " + description
		}
		h.respondDGENCallbackError(c, http.StatusUnauthorized, oauthError)
		return
	}

	state := c.Query("state")
	code := c.Query("code")
	if state == "" || code == "" {
		h.recordDGENFailure(c, clientIP)
		h.respondDGENCallbackError(c, http.StatusBadRequest, "state and code are required")
		return
	}

	rawState, err := h.Redis.Get(c, dgenStatePrefix+state).Result()
	if err != nil || rawState == "" {
		h.recordDGENFailure(c, clientIP)
		h.respondDGENCallbackError(c, http.StatusUnauthorized, "invalid state")
		return
	}
	statePayload := auth.ParseDGENOAuthState(rawState)

	client := h.dgenClient()
	dgenToken, err := client.ExchangeCode(c, code)
	if err != nil {
		if h.Logger != nil {
			h.Logger.Warn().Err(err).Msg("dgen token exchange failed")
		}
		if shouldRecordDGENTokenFailure(err) {
			h.recordDGENFailure(c, clientIP)
		}
		h.respondDGENCallbackError(c, http.StatusUnauthorized, dgenTokenExchangeMessage(err))
		return
	}
	_ = h.Redis.Del(c, dgenStatePrefix+state).Err()

	userInfo, err := client.FetchUserInfo(c, dgenToken)
	if err != nil {
		if h.Logger != nil {
			h.Logger.Warn().Err(err).Msg("dgen userinfo fetch failed")
		}
		h.recordDGENFailure(c, clientIP)
		h.respondDGENCallbackError(c, http.StatusUnauthorized, "failed to fetch user")
		return
	}

	user, err := client.UpsertUser(c, h.Repo, userInfo)
	if err != nil {
		if h.Logger != nil {
			h.Logger.Error().Err(err).Str("dgen_subject", userInfo.Subject()).Msg("dgen user upsert failed")
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not upsert user"})
		return
	}

	if user.IsBanned {
		h.respondDGENCallbackError(c, http.StatusForbidden, "account is banned")
		return
	}

	accessToken, err := auth.GenerateAccessToken(h.Config, *user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "token generation failed"})
		return
	}
	refreshToken, err := auth.GenerateRefreshToken(h.Config)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "token generation failed"})
		return
	}

	key := refreshTokenPrefix + refreshToken
	if err := h.Redis.Set(c, key, user.ID+"|"+user.Role, h.Config.JWTRefreshTTL).Err(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "session store failed"})
		return
	}
	csrfToken, err := h.issueAndStoreCSRFToken(c, user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "csrf setup failed"})
		return
	}
	if err := middleware.ResetLoginAttempts(c, h.Redis, h.dgenFailKey(clientIP)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to reset session state"})
		return
	}

	h.setRefreshCookie(c, refreshToken)
	if h.wantsJSON(c) {
		c.JSON(http.StatusOK, gin.H{
			"access_token": accessToken,
			"csrf_token":   csrfToken,
			"next":         statePayload.Next,
			"user":         user,
		})
		return
	}

	c.Redirect(http.StatusFound, h.frontendAuthCallbackURL(accessToken, csrfToken, statePayload.Next))
}

func (h *Handler) logout(c *gin.Context) {
	refresh, err := c.Cookie("refresh_token")
	if err == nil && refresh != "" {
		stored, getErr := h.Redis.Get(c, refreshTokenPrefix+refresh).Result()
		if getErr != nil || stored == "" {
			stored, getErr = h.Redis.Get(c, refreshGracePrefix+refresh).Result()
		}
		_ = h.Redis.Del(c, refreshTokenPrefix+refresh, refreshGracePrefix+refresh).Err()
		if getErr == nil && stored != "" {
			parts := strings.SplitN(stored, "|", 2)
			if len(parts) > 0 && parts[0] != "" {
				_ = h.Redis.Del(c, auth.CSRFKey(parts[0])).Err()
			}
		}
	}
	c.SetCookie("csrf_token", "", -1, "/", "", h.Config.AppEnv == "production", false)
	h.clearRefreshCookie(c)
	c.Status(http.StatusOK)
}

func (h *Handler) refresh(c *gin.Context) {
	refresh, err := c.Cookie("refresh_token")
	if err != nil || refresh == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "refresh token missing"})
		return
	}

	stored, err := h.Redis.Get(c, refreshTokenPrefix+refresh).Result()
	fromGrace := false
	if err != nil || stored == "" {
		stored, err = h.Redis.Get(c, refreshGracePrefix+refresh).Result()
		fromGrace = true
		if err != nil || stored == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "refresh token invalid"})
			return
		}
	}
	if !fromGrace {
		_ = h.Redis.Set(c, refreshGracePrefix+refresh, stored, refreshGraceTTL).Err()
		_ = h.Redis.Del(c, refreshTokenPrefix+refresh).Err()
	}

	var userID string
	var role string
	parts := strings.SplitN(stored, "|", 2)
	if len(parts) == 2 {
		userID, role = parts[0], parts[1]
	} else {
		userID = stored
	}

	user, err := h.Repo.GetUserByID(c, userID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
		return
	}
	if user.IsBanned {
		c.JSON(http.StatusForbidden, gin.H{"error": "account is banned"})
		return
	}
	if user.Role == "" {
		user.Role = role
	}

	newAccess, err := auth.GenerateAccessToken(h.Config, user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "token generation failed"})
		return
	}
	newRefresh, err := auth.GenerateRefreshToken(h.Config)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "token generation failed"})
		return
	}
	csrfToken, err := h.issueAndStoreCSRFToken(c, user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "csrf setup failed"})
		return
	}
	if err := h.Redis.Set(c, refreshTokenPrefix+newRefresh, user.ID+"|"+user.Role, h.Config.JWTRefreshTTL).Err(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "token storage failed"})
		return
	}

	h.setRefreshCookie(c, newRefresh)
	c.JSON(http.StatusOK, gin.H{"access_token": newAccess, "csrf_token": csrfToken})
}

func (h *Handler) dgenClient() auth.DGENClient {
	return auth.DGENClient{
		ClientID:          h.Config.DGENClientID,
		ClientSecret:      h.Config.DGENClientSecret,
		RedirectURI:       h.Config.DGENRedirectURI,
		AuthorizeURL:      h.Config.DGENAuthorizeURL,
		EmbedAuthorizeURL: h.Config.DGENEmbedAuthorizeURL,
		TokenURL:          h.Config.DGENTokenURL,
		UserInfoURL:       h.Config.DGENUserInfoURL,
	}
}

func (h *Handler) wantsJSON(c *gin.Context) bool {
	accept := strings.ToLower(c.GetHeader("Accept"))
	return strings.Contains(accept, "application/json") || strings.EqualFold(c.GetHeader("X-Requested-With"), "XMLHttpRequest")
}

func dgenTokenExchangeMessage(err error) string {
	var tokenErr *auth.DGENTokenError
	if !errors.As(err, &tokenErr) {
		return "DGEN authentication service could not be reached"
	}
	switch tokenErr.OAuthError {
	case "invalid_client":
		return "DGEN rejected client credentials"
	case "invalid_grant":
		return "DGEN authorization code expired"
	case "invalid_request":
		return "DGEN rejected token request"
	default:
		return "DGEN token exchange failed"
	}
}

func shouldRecordDGENTokenFailure(err error) bool {
	var tokenErr *auth.DGENTokenError
	if !errors.As(err, &tokenErr) {
		return true
	}
	return tokenErr.OAuthError != "invalid_client"
}

func (h *Handler) frontendAuthCallbackURL(accessToken, csrfToken, next string) string {
	base, err := url.Parse(strings.TrimRight(h.Config.FrontendURL, "/") + "/auth/callback")
	if err != nil {
		return fmt.Sprintf("%s/auth/callback?token=%s&csrf=%s", strings.TrimRight(h.Config.FrontendURL, "/"), url.QueryEscape(accessToken), url.QueryEscape(csrfToken))
	}
	query := base.Query()
	query.Set("token", accessToken)
	query.Set("csrf", csrfToken)
	if safeNext := auth.SafeFrontendPath(next); safeNext != "/dashboard" {
		query.Set("next", safeNext)
	}
	base.RawQuery = query.Encode()
	return base.String()
}

func (h *Handler) frontendLoginURL(message string) string {
	base, err := url.Parse(strings.TrimRight(h.Config.FrontendURL, "/") + "/login")
	if err != nil {
		return strings.TrimRight(h.Config.FrontendURL, "/") + "/login"
	}
	query := base.Query()
	query.Set("error", message)
	base.RawQuery = query.Encode()
	return base.String()
}

func (h *Handler) respondDGENCallbackError(c *gin.Context, status int, message string) {
	if h.wantsJSON(c) {
		c.JSON(status, gin.H{"error": message})
		return
	}
	c.Redirect(http.StatusFound, h.frontendLoginURL(message))
}

func (h *Handler) dgenFailKey(ip string) string {
	return dgenCallbackFailBase + ":" + ip
}

func (h *Handler) checkDGENLock(c *gin.Context, ip string) error {
	return middleware.EnsureNotLocked(c, h.Redis, h.dgenFailKey(ip))
}

func (h *Handler) recordDGENFailure(c *gin.Context, ip string) {
	key := h.dgenFailKey(ip)
	_, _ = middleware.RegisterLoginFailure(c, h.Redis, key)
}

func (h *Handler) setRefreshCookie(c *gin.Context, refresh string) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(
		"refresh_token",
		refresh,
		int(h.Config.JWTRefreshTTL.Seconds()),
		"/api/v1/auth",
		"",
		h.Config.AppEnv == "production",
		true,
	)
}

func (h *Handler) clearRefreshCookie(c *gin.Context) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie("refresh_token", "", -1, "/api/v1/auth", "", h.Config.AppEnv == "production", true)
}

func (h *Handler) issueAndStoreCSRFToken(c *gin.Context, userID string) (string, error) {
	token, err := auth.GenerateCSRFToken()
	if err != nil {
		return "", err
	}
	if err := h.Redis.Set(c, auth.CSRFKey(userID), token, h.Config.JWTRefreshTTL).Err(); err != nil {
		return "", err
	}
	c.SetCookie(
		"csrf_token",
		token,
		int(h.Config.JWTRefreshTTL.Seconds()),
		"/",
		"",
		h.Config.AppEnv == "production",
		false,
	)
	return token, nil
}
