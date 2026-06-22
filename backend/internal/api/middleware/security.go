package middleware

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"strings"
	"time"

	"marketplace/backend/internal/config"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

func SecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("X-XSS-Protection", "1; mode=block")
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
		c.Header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		c.Header("Content-Security-Policy", "default-src 'self'; img-src 'self' data: https:; script-src 'self'; style-src 'self'; frame-ancestors 'none';")
		if gin.Mode() == gin.ReleaseMode {
			c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")
		}
		c.Next()
	}
}

func allowedOrigins(cfg *config.Config) []string {
	origins := map[string]struct{}{}

	for _, origin := range []string{strings.TrimSpace(cfg.FrontendURL), "http://localhost:3000", "http://127.0.0.1:3000"} {
		if origin == "" {
			continue
		}
		if _, ok := origins[origin]; !ok {
			origins[origin] = struct{}{}
		}
	}

	result := make([]string, 0, len(origins))
	for origin := range origins {
		result = append(result, origin)
	}

	if cfg.AppEnv != "production" {
		if len(result) == 0 {
			result = []string{"http://localhost:3000", "http://127.0.0.1:3000"}
		}
		return result
	}

	if cfg.FrontendURL != "" && cfg.FrontendURL != "http://localhost:3000" && cfg.FrontendURL != "http://127.0.0.1:3000" {
		return []string{cfg.FrontendURL}
	}
	return []string{"https://updigit.net", "https://www.updigit.net"}
}

func CORS(cfg *config.Config) gin.HandlerFunc {
	allowOrigin := allowedOrigins(cfg)
	return cors.New(cors.Config{
		AllowOrigins:     allowOrigin,
		AllowMethods:     []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete, http.MethodOptions},
		AllowHeaders:     []string{"Origin", "Authorization", "Content-Type", "X-CSRF-Token", "X-Requested-With"},
		ExposeHeaders:    []string{"Content-Length", "Content-Disposition", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           12 * 60 * 60,
	})
}

func RateLimitMiddleware(redisClient *redis.Client, authenticated bool, authWindowPrefix string) gin.HandlerFunc {
	limit := int64(100)
	window := time.Minute
	if authenticated {
		limit = 500
	}
	if authWindowPrefix == "auth" {
		limit = 30
	}
	return func(c *gin.Context) {
		clientIP := ClientIP(c)
		if parsed := net.ParseIP(clientIP); parsed != nil && parsed.IsLoopback() {
			c.Next()
			return
		}

		ctx := context.Background()
		scope := strings.TrimSpace(authWindowPrefix)
		if scope == "" {
			scope = "ip"
		}
		key := "rl:" + scope + ":" + clientIP
		if authenticated {
			if userID := AuthUserID(c); userID != "" {
				key = "rl:user:" + userID
			}
		}
		now := time.Now().UnixNano()
		windowStart := now - int64(window/time.Nanosecond)
		pipe := redisClient.TxPipeline()
		pipe.ZRemRangeByScore(ctx, key, "0", fmt.Sprintf("%d", windowStart))
		pipe.ZAdd(ctx, key, redis.Z{Score: float64(now), Member: now})
		pipe.ZCard(ctx, key)
		pipe.Expire(ctx, key, window)
		cmds, err := pipe.Exec(ctx)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "rate limit unavailable"})
			return
		}
		count := cmds[2].(*redis.IntCmd).Val()
		if count > limit {
			c.Header("Retry-After", "60")
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "rate limit exceeded"})
			return
		}
		c.Next()
	}
}
