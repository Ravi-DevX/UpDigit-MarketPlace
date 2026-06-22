package middleware

import (
	"context"
	"errors"
	"net"
	"net/http"
	"strings"
	"time"

	"marketplace/backend/internal/auth"
	"marketplace/backend/internal/config"
	"marketplace/backend/internal/repository"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

const (
	ctxUserID   = "userID"
	ctxUserRole = "userRole"
	ctxUserName = "username"
)

func AuthMiddleware(cfg *config.Config, redisClient *redis.Client, repo *repository.Repo) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "authorization header required"})
			return
		}
		if !strings.HasPrefix(authHeader, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token format"})
			return
		}
		token := strings.TrimPrefix(authHeader, "Bearer ")
		claims, err := auth.VerifyAccessToken(cfg, token)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid access token"})
			return
		}

		userID := strings.TrimSpace(claims.UserID)
		if userID == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid user identifier"})
			return
		}

		if repo != nil {
			user, err := repo.GetUserByID(c, userID)
			if err != nil {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
				return
			}
			if user.IsBanned {
				c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "account banned"})
				return
			}
			claims.Role = user.Role
			c.Set(ctxUserID, user.ID)
			c.Set(ctxUserRole, user.Role)
			c.Set(ctxUserName, user.Username)
			c.Next()
			return
		}

		c.Set(ctxUserID, claims.UserID)
		c.Set(ctxUserRole, claims.Role)
		c.Set(ctxUserName, claims.Username)
		c.Next()
	}
}

func RequireRole(role string) gin.HandlerFunc {
	return func(c *gin.Context) {
		roleValue, exists := c.Get(ctxUserRole)
		if !exists {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
			return
		}
		current, ok := roleValue.(string)
		if !ok || current != role {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "insufficient permissions"})
			return
		}
		c.Next()
	}
}

func RequireAnyRole(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		current, _ := c.Get(ctxUserRole)
		currentRole, ok := current.(string)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
			return
		}
		for _, role := range roles {
			if currentRole == role {
				c.Next()
				return
			}
		}
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "insufficient permissions"})
	}
}

func AuthUserID(c *gin.Context) string {
	v, ok := c.Get(ctxUserID)
	if !ok {
		return ""
	}
	userID, ok := v.(string)
	if !ok {
		return ""
	}
	return userID
}

func AuthRole(c *gin.Context) string {
	v, ok := c.Get(ctxUserRole)
	if !ok {
		return ""
	}
	role, ok := v.(string)
	if !ok {
		return ""
	}
	return role
}

func CSRFProtection(redisClient *redis.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		method := c.Request.Method
		if method == http.MethodGet || method == http.MethodHead || method == http.MethodOptions {
			c.Next()
			return
		}
		userID := AuthUserID(c)
		if userID == "" {
			c.Next()
			return
		}

		token := c.GetHeader("X-CSRF-Token")
		if token == "" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "csrf token required"})
			return
		}
		stored := redisClient.Get(context.Background(), auth.CSRFKey(userID)).Val()
		if token != stored || stored == "" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "invalid csrf token"})
			return
		}
		c.Next()
	}
}

func requireRemoteIP(ip string) string {
	if ip == "" {
		return "unknown"
	}
	if parsed := net.ParseIP(strings.TrimSpace(strings.Split(ip, ":")[0])); parsed != nil {
		return parsed.String()
	}
	return ip
}

func forwardedHeaderIP(value string) string {
	for _, part := range strings.Split(value, ",") {
		candidate := strings.TrimSpace(part)
		if candidate == "" {
			continue
		}
		if parsed := net.ParseIP(strings.Split(candidate, ":")[0]); parsed != nil {
			return parsed.String()
		}
	}
	return ""
}

func withIP(c *gin.Context) string {
	for _, header := range []string{"CF-Connecting-IP", "X-Real-IP", "X-Forwarded-For"} {
		if ip := forwardedHeaderIP(c.GetHeader(header)); ip != "" {
			return ip
		}
	}
	ip := c.ClientIP()
	return requireRemoteIP(ip)
}

func ClientIP(c *gin.Context) string {
	return withIP(c)
}

func getLoginLockKey(identifier string) string {
	return "login-lock:" + identifier
}

func EnsureNotLocked(ctx context.Context, redisClient *redis.Client, key string) error {
	v, err := redisClient.Get(ctx, getLoginLockKey(key)).Int64()
	if err == nil && v > 0 {
		return errors.New("account locked")
	}
	if err != nil && err != redis.Nil {
		return err
	}
	return nil
}

func RegisterLoginFailure(ctx context.Context, redisClient *redis.Client, key string) (int64, error) {
	attemptsKey := "login-attempts:" + key
	count, err := redisClient.Incr(ctx, attemptsKey).Result()
	if err != nil {
		return 0, err
	}
	_ = redisClient.Expire(ctx, attemptsKey, 15*time.Minute)
	if count >= 5 {
		_ = redisClient.Set(ctx, getLoginLockKey(key), "1", 15*time.Minute).Err()
	}
	return count, nil
}

func ResetLoginAttempts(ctx context.Context, redisClient *redis.Client, key string) error {
	return redisClient.Del(ctx, "login-attempts:"+key, getLoginLockKey(key)).Err()
}
