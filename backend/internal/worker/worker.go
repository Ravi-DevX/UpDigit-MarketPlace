package worker

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"context"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"marketplace/backend/internal/repository"

	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog"
)

type Manager struct {
	ctx    context.Context
	cancel context.CancelFunc
}

const webhookQueueKey = "jobs:webhook"

func Start(ctx context.Context, log zerolog.Logger, repo *repository.Repo, redisClient *redis.Client) *Manager {
	runCtx, cancel := context.WithCancel(ctx)
	m := &Manager{ctx: runCtx, cancel: cancel}

	go runDownloadTokenCleanup(log, runCtx, repo)
	go runEmailWorker(log, runCtx, redisClient)
	go runWebhookDispatcher(log, runCtx, redisClient)

	return m
}

func (m *Manager) Stop() {
	if m == nil {
		return
	}
	m.cancel()
}

func runDownloadTokenCleanup(log zerolog.Logger, ctx context.Context, repo *repository.Repo) {
	ticker := time.NewTicker(60 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if repo == nil {
				continue
			}
			if _, err := repo.DeleteExpiredDownloadTokens(ctx); err != nil {
				log.Error().Err(err).Msg("download token cleanup failed")
			} else {
				log.Info().Msg("download token cleanup completed")
			}
		}
	}
}

func runEmailWorker(log zerolog.Logger, ctx context.Context, client *redis.Client) {
	if client == nil {
		log.Warn().Msg("email worker disabled: redis client is missing")
		return
	}
	for {
		select {
		case <-ctx.Done():
			return
		default:
			raw, err := client.BRPop(ctx, 5*time.Second, "jobs:email").Result()
			if err != nil {
				if errors.Is(err, redis.Nil) {
					continue
				}
				log.Error().Err(err).Msg("email worker pop failed")
				time.Sleep(2 * time.Second)
				continue
			}
			if len(raw) < 2 {
				continue
			}
			log.Info().Str("event", raw[1]).Msg("email job queued")
		}
	}
}

func runWebhookDispatcher(log zerolog.Logger, ctx context.Context, redisClient *redis.Client) {
	if redisClient == nil {
		log.Warn().Msg("webhook dispatcher disabled: missing dependencies")
		return
	}
	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		raw, err := redisClient.BRPop(ctx, 5*time.Second, webhookQueueKey).Result()
		if err != nil {
			if errors.Is(err, redis.Nil) {
				continue
			}
			log.Error().Err(err).Msg("webhook worker pop failed")
			time.Sleep(2 * time.Second)
			continue
		}
		if len(raw) < 2 {
			continue
		}

		var job webhookQueueJob
		if err := json.Unmarshal([]byte(raw[1]), &job); err != nil {
			log.Warn().Err(err).Msg("invalid webhook job payload")
			continue
		}
		if job.URL == "" || job.Event == "" {
			log.Warn().Str("delivery_id", job.DeliveryID).Msg("skipping malformed webhook job")
			continue
		}
		if err := deliverWebhook(log, redisClient, ctx, job); err != nil {
			log.Error().Err(err).Msg("webhook delivery failed and will retry")
		}
	}
}

type webhookQueueJob struct {
	DeliveryID string      `json:"delivery_id"`
	Event      string      `json:"event"`
	URL        string      `json:"url"`
	Secret     string      `json:"secret"`
	Payload    interface{} `json:"payload"`
	Attempts   int         `json:"attempts"`
}

func deliverWebhook(log zerolog.Logger, redisClient *redis.Client, ctx context.Context, job webhookQueueJob) error {
	body := map[string]any{
		"event":   job.Event,
		"payload": job.Payload,
	}
	rawBody, err := json.Marshal(body)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, job.URL, bytes.NewReader(rawBody))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if job.Secret != "" {
		signature := signWebhookPayload(job.Secret, rawBody)
		req.Header.Set("X-Marketplace-Signature", "sha256="+signature)
	}
	req.Header.Set("X-Marketplace-Event", job.Event)
	if job.DeliveryID != "" {
		req.Header.Set("X-Marketplace-Delivery", job.DeliveryID)
	}

	httpClient := &http.Client{Timeout: 10 * time.Second}
	resp, err := httpClient.Do(req)
	if err != nil {
		return scheduleWebhookRetry(log, redisClient, ctx, job, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		err = fmt.Errorf("webhook response status=%d body=%s", resp.StatusCode, strings.TrimSpace(string(body)))
		return scheduleWebhookRetry(log, redisClient, ctx, job, err)
	}

	return nil
}

func signWebhookPayload(secret string, payload []byte) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	return hex.EncodeToString(mac.Sum(nil))
}

func scheduleWebhookRetry(log zerolog.Logger, redisClient *redis.Client, ctx context.Context, job webhookQueueJob, originalErr error) error {
	const maxAttempts = 3
	job.Attempts++
	if job.Attempts > maxAttempts {
		log.Error().Err(originalErr).Str("delivery_id", job.DeliveryID).Str("event", job.Event).Msg("webhook delivery dropped after max attempts")
		return originalErr
	}

	raw, err := json.Marshal(job)
	if err != nil {
		return originalErr
	}
	delay := time.Duration(1<<uint(job.Attempts)) * time.Second
	timer := time.NewTimer(delay)
	select {
	case <-ctx.Done():
		timer.Stop()
		return ctx.Err()
	case <-timer.C:
	}
	return redisClient.RPush(context.Background(), webhookQueueKey, string(raw)).Err()
}
