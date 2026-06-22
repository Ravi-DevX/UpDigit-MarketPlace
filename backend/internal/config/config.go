package config

import (
	"fmt"
	"strings"
	"time"

	"github.com/spf13/viper"
)

type Config struct {
	Port      string
	AppEnv    string
	AppSecret string

	DBHost     string
	DBPort     int
	DBName     string
	DBUser     string
	DBPassword string
	DBSSLMode  string

	RedisHost     string
	RedisPort     int
	RedisPassword string
	RedisDB       int

	JWTAccessSecret  string
	JWTRefreshSecret string
	JWTAccessTTL     time.Duration
	JWTRefreshTTL    time.Duration

	StorageProvider   string
	R2AccountID       string
	R2AccessKeyID     string
	R2SecretAccessKey string
	R2BucketName      string
	R2S3Endpoint      string
	R2PublicURL       string
	S3Region          string
	S3AccessKeyID     string
	S3SecretAccessKey string
	S3BucketName      string
	S3Endpoint        string

	EmailProvider        string
	ResendAPIKey         string
	SMTPHost             string
	SMTPPort             int
	SMTPUser             string
	SMTPPass             string
	EmailFrom            string
	StripeSecretKey      string
	StripeWebhook        string
	PaypalClientID       string
	PaypalSecret         string
	PaypalEnv            string
	TebexHeadlessEnabled bool
	TebexPublicToken     string
	TebexPrivateKey      string
	TebexHeadlessAPIURL  string
	TebexCurrency        string

	PlatformFeePercent    float64
	FrontendURL           string
	BackendURL            string
	DGENClientID          string
	DGENClientSecret      string
	DGENRedirectURI       string
	DGENIssuer            string
	DGENAuthorizeURL      string
	DGENEmbedAuthorizeURL string
	DGENTokenURL          string
	DGENUserInfoURL       string
}

func LoadConfig(path string) (*Config, error) {
	viper.SetConfigFile(path + "/.env")
	viper.SetConfigType("env")
	_ = viper.ReadInConfig()

	viper.SetDefault("PORT", "8080")
	viper.SetDefault("APP_ENV", "development")
	viper.SetDefault("DB_HOST", "localhost")
	viper.SetDefault("DB_PORT", 5432)
	viper.SetDefault("DB_NAME", "marketplace_db")
	viper.SetDefault("DB_USER", "postgres")
	viper.SetDefault("DB_SSL_MODE", "disable")
	viper.SetDefault("REDIS_PORT", 6379)
	viper.SetDefault("REDIS_DB", 0)
	viper.SetDefault("JWT_ACCESS_EXPIRY", "15m")
	viper.SetDefault("JWT_REFRESH_EXPIRY", "168h")
	viper.SetDefault("STORAGE_PROVIDER", "r2")
	viper.SetDefault("PLATFORM_FEE_PERCENT", "10")
	viper.SetDefault("EMAIL_PROVIDER", "resend")
	viper.SetDefault("SMTP_PORT", "587")
	viper.SetDefault("PAYPAL_ENV", "sandbox")
	viper.SetDefault("TEBEX_HEADLESS_ENABLED", false)
	viper.SetDefault("TEBEX_HEADLESS_API_URL", "https://headless.tebex.io/api")
	viper.SetDefault("TEBEX_CURRENCY", "USD")
	viper.SetDefault("FRONTEND_URL", "http://localhost:3000")
	viper.SetDefault("BACKEND_URL", "http://localhost:8080")
	viper.SetDefault("DGEN_REDIRECT_URI", "http://localhost:3000/auth/callback")
	viper.SetDefault("DGEN_AUTHORIZE_URL", "https://auth.dgenx.net/authorize")
	viper.SetDefault("DGEN_EMBED_AUTHORIZE_URL", "https://auth.dgenx.net/embed/authorize")
	viper.SetDefault("DGEN_TOKEN_URL", "https://auth.dgenx.net/api/token")
	viper.SetDefault("DGEN_USERINFO_URL", "https://auth.dgenx.net/api/user")

	viper.AutomaticEnv()

	cfg := &Config{
		Port:                  viper.GetString("PORT"),
		AppEnv:                viper.GetString("APP_ENV"),
		AppSecret:             viper.GetString("APP_SECRET"),
		DBHost:                viper.GetString("DB_HOST"),
		DBPort:                viper.GetInt("DB_PORT"),
		DBName:                viper.GetString("DB_NAME"),
		DBUser:                viper.GetString("DB_USER"),
		DBPassword:            viper.GetString("DB_PASSWORD"),
		DBSSLMode:             viper.GetString("DB_SSL_MODE"),
		RedisHost:             viper.GetString("REDIS_HOST"),
		RedisPort:             viper.GetInt("REDIS_PORT"),
		RedisPassword:         viper.GetString("REDIS_PASSWORD"),
		RedisDB:               viper.GetInt("REDIS_DB"),
		JWTAccessSecret:       viper.GetString("JWT_ACCESS_SECRET"),
		JWTRefreshSecret:      viper.GetString("JWT_REFRESH_SECRET"),
		StorageProvider:       viper.GetString("STORAGE_PROVIDER"),
		R2AccountID:           viper.GetString("R2_ACCOUNT_ID"),
		R2AccessKeyID:         viper.GetString("R2_ACCESS_KEY_ID"),
		R2SecretAccessKey:     viper.GetString("R2_SECRET_ACCESS_KEY"),
		R2BucketName:          viper.GetString("R2_BUCKET_NAME"),
		R2S3Endpoint:          viper.GetString("R2_S3_ENDPOINT"),
		R2PublicURL:           viper.GetString("R2_PUBLIC_URL"),
		S3Region:              viper.GetString("S3_REGION"),
		S3AccessKeyID:         viper.GetString("S3_ACCESS_KEY_ID"),
		S3SecretAccessKey:     viper.GetString("S3_SECRET_ACCESS_KEY"),
		S3BucketName:          viper.GetString("S3_BUCKET_NAME"),
		S3Endpoint:            viper.GetString("S3_ENDPOINT"),
		EmailProvider:         viper.GetString("EMAIL_PROVIDER"),
		ResendAPIKey:          viper.GetString("RESEND_API_KEY"),
		SMTPHost:              viper.GetString("SMTP_HOST"),
		SMTPPort:              viper.GetInt("SMTP_PORT"),
		SMTPUser:              viper.GetString("SMTP_USER"),
		SMTPPass:              viper.GetString("SMTP_PASS"),
		EmailFrom:             viper.GetString("EMAIL_FROM"),
		StripeSecretKey:       viper.GetString("STRIPE_SECRET_KEY"),
		StripeWebhook:         viper.GetString("STRIPE_WEBHOOK_SECRET"),
		PaypalClientID:        viper.GetString("PAYPAL_CLIENT_ID"),
		PaypalSecret:          viper.GetString("PAYPAL_CLIENT_SECRET"),
		PaypalEnv:             viper.GetString("PAYPAL_ENV"),
		TebexHeadlessEnabled:  viper.GetBool("TEBEX_HEADLESS_ENABLED"),
		TebexPublicToken:      viper.GetString("TEBEX_PUBLIC_TOKEN"),
		TebexPrivateKey:       viper.GetString("TEBEX_PRIVATE_KEY"),
		TebexHeadlessAPIURL:   viper.GetString("TEBEX_HEADLESS_API_URL"),
		TebexCurrency:         strings.ToUpper(strings.TrimSpace(viper.GetString("TEBEX_CURRENCY"))),
		PlatformFeePercent:    viper.GetFloat64("PLATFORM_FEE_PERCENT"),
		FrontendURL:           viper.GetString("FRONTEND_URL"),
		BackendURL:            viper.GetString("BACKEND_URL"),
		DGENClientID:          viper.GetString("DGEN_CLIENT_ID"),
		DGENClientSecret:      viper.GetString("DGEN_CLIENT_SECRET"),
		DGENRedirectURI:       viper.GetString("DGEN_REDIRECT_URI"),
		DGENIssuer:            viper.GetString("DGEN_ISSUER"),
		DGENAuthorizeURL:      viper.GetString("DGEN_AUTHORIZE_URL"),
		DGENEmbedAuthorizeURL: viper.GetString("DGEN_EMBED_AUTHORIZE_URL"),
		DGENTokenURL:          viper.GetString("DGEN_TOKEN_URL"),
		DGENUserInfoURL:       viper.GetString("DGEN_USERINFO_URL"),
	}

	accessTTL, err := time.ParseDuration(viper.GetString("JWT_ACCESS_EXPIRY"))
	if err != nil {
		return nil, fmt.Errorf("invalid JWT_ACCESS_EXPIRY: %w", err)
	}
	refreshTTL, err := time.ParseDuration(viper.GetString("JWT_REFRESH_EXPIRY"))
	if err != nil {
		return nil, fmt.Errorf("invalid JWT_REFRESH_EXPIRY: %w", err)
	}
	cfg.JWTAccessTTL = accessTTL
	cfg.JWTRefreshTTL = refreshTTL
	if cfg.AppEnv == "development" {
		if strings.TrimSpace(cfg.FrontendURL) == "" {
			cfg.FrontendURL = "http://localhost:3000"
		}
		if strings.TrimSpace(cfg.BackendURL) == "" {
			cfg.BackendURL = "http://localhost:8080"
		}
		if strings.TrimSpace(cfg.DGENRedirectURI) == "" {
			cfg.DGENRedirectURI = "http://localhost:3000/auth/callback"
		}
	}

	return cfg, nil
}
