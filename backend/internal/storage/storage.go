package storage

import (
	"context"
	"fmt"
	"io"
	"strings"
	"time"

	"marketplace/backend/internal/config"
)

type StorageProvider interface {
	Upload(ctx context.Context, key string, file io.Reader, contentType string, size int64) (string, error)
	GetSignedURL(ctx context.Context, key string, expiry time.Duration) (string, error)
	Delete(ctx context.Context, key string) error
	GetPublicURL(key string) string
}

func NewStorage(cfg *config.Config) (StorageProvider, error) {
	provider := strings.ToLower(cfg.StorageProvider)
	switch provider {
	case "s3":
		return NewS3Provider(cfg)
	case "r2", "":
		return NewR2Provider(cfg)
	default:
		return nil, fmt.Errorf("unknown STORAGE_PROVIDER: %s", cfg.StorageProvider)
	}
}
