package database

import (
	"context"
	"fmt"
	"strconv"

	"marketplace/backend/internal/config"

	"github.com/jackc/pgx/v5/pgxpool"
)

func Connect(cfg *config.Config) (*pgxpool.Pool, error) {
	conn := fmt.Sprintf(
		"postgres://%s:%s@%s:%d/%s?sslmode=%s",
		cfg.DBUser,
		cfg.DBPassword,
		cfg.DBHost,
		cfg.DBPort,
		cfg.DBName,
		cfg.DBSSLMode,
	)

	pool, err := pgxpool.New(context.Background(), conn)
	if err != nil {
		return nil, err
	}

	return pool, nil
}

func DSNFromConfig(cfg *config.Config) string {
	dbPort := strconv.Itoa(cfg.DBPort)
	sslMode := cfg.DBSSLMode
	return fmt.Sprintf(
		"postgres://%s:%s@%s:%s/%s?sslmode=%s",
		cfg.DBUser,
		cfg.DBPassword,
		cfg.DBHost,
		dbPort,
		cfg.DBName,
		sslMode,
	)
}
