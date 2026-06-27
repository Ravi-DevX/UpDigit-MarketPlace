package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"marketplace/backend/internal/api/handlers"
	"marketplace/backend/internal/api/middleware"
	"marketplace/backend/internal/config"
	"marketplace/backend/internal/database"
	"marketplace/backend/internal/repository"
	"marketplace/backend/internal/storage"
	"marketplace/backend/internal/worker"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func main() {
	zerolog.TimeFieldFormat = time.RFC3339
	cfg, err := config.LoadConfig(".")
	if err != nil {
		log.Fatal().Err(err).Msg("failed to load config")
	}

	db, err := database.Connect(cfg)
	if err != nil {
		log.Fatal().Err(err).Msg("database connect failed")
	}
	defer db.Close()

	redisClient, err := database.ConnectRedis(cfg)
	if err != nil {
		log.Fatal().Err(err).Msg("redis connect failed")
	}
	defer redisClient.Close()

	store, err := storage.NewStorage(cfg)
	if err != nil {
		log.Fatal().Err(err).Msg("storage init failed")
	}

	if cfg.AppEnv == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	repo := repository.NewRepo(db)
	if err := repo.EnsureMarketplaceCategories(context.Background()); err != nil {
		log.Fatal().Err(err).Msg("category seed failed")
	}
	logger := log.Logger
	h := handlers.NewHandler(cfg, repo, redisClient, store, &logger)

	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(middleware.SecurityHeaders())
	router.Use(middleware.CORS(cfg))

	api := router.Group("/api/v1")
	public := api.Group("")
	public.Use(middleware.RateLimitMiddleware(redisClient, false, "public"))

	authRoutes := api.Group("/auth")
	authRoutes.Use(middleware.RateLimitMiddleware(redisClient, false, "auth"))
	h.RegisterAuthRoutes(authRoutes)

	// Authenticated routes
	secured := api.Group("")
	secured.Use(middleware.AuthMiddleware(cfg, redisClient, repo))
	secured.Use(middleware.RateLimitMiddleware(redisClient, true, ""))
	secured.Use(middleware.CSRFProtection(redisClient))

	// Publicly readable endpoints (with auth optional in handlers).
	h.RegisterProductRoutes(public, secured)
	h.RegisterOrderRoutes(secured, public)
	h.RegisterSearchRoutes(public)
	h.RegisterPublicSettingsRoutes(public)
	h.RegisterReviewRoutes(public, secured)
	h.RegisterCartWishlistRoutes(secured)
	h.RegisterNotificationRoutes(secured)
	h.RegisterReportRoutes(secured)
	h.RegisterUserRoutes(public, secured)
	h.RegisterConversationRoutes(secured)
	h.RegisterTicketRoutes(secured)

	// Seller/admin restricted endpoints
	admin := api.Group("")
	admin.Use(middleware.AuthMiddleware(cfg, redisClient, repo))
	admin.Use(middleware.RequireRole("admin"))
	admin.Use(middleware.RateLimitMiddleware(redisClient, true, ""))
	admin.Use(middleware.CSRFProtection(redisClient))

	sellerApply := api.Group("")
	sellerApply.Use(middleware.AuthMiddleware(cfg, redisClient, repo))
	sellerApply.Use(middleware.RateLimitMiddleware(redisClient, true, ""))
	sellerApply.Use(middleware.CSRFProtection(redisClient))
	h.RegisterSellerApplyRoute(sellerApply)

	seller := api.Group("")
	seller.Use(middleware.AuthMiddleware(cfg, redisClient, repo))
	seller.Use(middleware.RequireAnyRole("seller", "admin"))
	seller.Use(middleware.RateLimitMiddleware(redisClient, true, ""))
	seller.Use(middleware.CSRFProtection(redisClient))
	h.RegisterSellerRoutes(seller)

	h.RegisterCategoryRoutes(public, admin)
	h.RegisterAdminRoutes(admin)

	srv := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: router,
	}

	serverErr := make(chan error, 1)
	appCtx, cancelAll := context.WithCancel(context.Background())
	workers := worker.Start(appCtx, logger, repo, redisClient)

	go func() {
		log.Info().Str("addr", srv.Addr).Msg("starting server")
		serverErr <- srv.ListenAndServe()
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	select {
	case sig := <-quit:
		log.Info().Str("signal", sig.String()).Msg("shutdown signal received")
	case err := <-serverErr:
		if err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("server exited with error")
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	workers.Stop()
	cancelAll()
	if err := srv.Shutdown(ctx); err != nil {
		log.Error().Err(err).Msg("server shutdown failed")
	}
}
