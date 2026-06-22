package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"time"

	"marketplace/backend/internal/config"
	"marketplace/backend/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type Claims struct {
	UserID   string `json:"uid"`
	Role     string `json:"role"`
	Username string `json:"username"`
	jwt.RegisteredClaims
}

type Tokens struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
}

type ctxKey string

var userContextKey ctxKey = "auth_user"

func CurrentUser(c *gin.Context) (models.User, bool) {
	userValue, exists := c.Get(string(userContextKey))
	if !exists {
		return models.User{}, false
	}
	user, ok := userValue.(models.User)
	return user, ok
}

func SetCurrentUser(c *gin.Context, user models.User) {
	c.Set(string(userContextKey), user)
}

func HashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}

func CheckPassword(hash, password string) error {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
}

func generateRandomToken(length int) (string, error) {
	buf := make([]byte, length)
	_, err := rand.Read(buf)
	if err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

func GenerateCSRFToken() (string, error) {
	return generateRandomToken(32)
}

func GenerateAccessToken(cfg *config.Config, user models.User) (string, error) {
	now := time.Now()
	claims := Claims{
		UserID:   user.ID,
		Role:     user.Role,
		Username: user.Username,
		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(cfg.JWTAccessTTL)),
			Subject:   user.ID,
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(cfg.JWTAccessSecret))
}

func GenerateRefreshToken(cfg *config.Config) (string, error) {
	return generateRandomToken(64)
}

func VerifyAccessToken(cfg *config.Config, tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if token.Method.Alg() != jwt.SigningMethodHS256.Name {
			return nil, fmt.Errorf("unexpected jwt signing method: %s", token.Header["alg"])
		}
		return []byte(cfg.JWTAccessSecret), nil
	})
	if err != nil {
		return nil, err
	}
	if !token.Valid {
		return nil, errors.New("invalid token")
	}

	claims, ok := token.Claims.(*Claims)
	if !ok {
		return nil, errors.New("invalid token claims")
	}
	return claims, nil
}

var Validate = validator.New()

func ValidateTokenPayload(payload any) error {
	return Validate.Struct(payload)
}

func CSRFKey(userID string) string {
	return "csrf:" + userID
}

func RateLimitKey(ip string) string {
	return "rl:" + ip
}

func ContextUserID(ctx context.Context) string {
	if ctx == nil {
		return ""
	}
	c, ok := ctx.Value(userContextKey).(string)
	if !ok {
		return ""
	}
	return c
}
