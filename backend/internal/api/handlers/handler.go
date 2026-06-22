package handlers

import (
	"marketplace/backend/internal/config"
	"marketplace/backend/internal/repository"
	"marketplace/backend/internal/storage"

	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog"
)

type Handler struct {
	Config        *config.Config
	Repo          *repository.Repo
	Redis         *redis.Client
	Storage       storage.StorageProvider
	Logger        *zerolog.Logger
}

func NewHandler(cfg *config.Config, r *repository.Repo, rc *redis.Client, storage storage.StorageProvider, logger *zerolog.Logger) *Handler {
	return &Handler{
		Config:  cfg,
		Repo:    r,
		Redis:   rc,
		Storage: storage,
		Logger:  logger,
	}
}
