package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

const webhookQueueKey = "jobs:webhook"

type webhookQueueJob struct {
	DeliveryID string      `json:"delivery_id"`
	Event      string      `json:"event"`
	URL        string      `json:"url"`
	Secret     string      `json:"secret"`
	Payload    interface{} `json:"payload"`
	Attempts   int         `json:"attempts"`
}

func (h *Handler) enqueueWebhookEvent(ctx context.Context, sellerID, event string, payload interface{}) {
	sellerID = strings.TrimSpace(sellerID)
	event = strings.TrimSpace(event)
	if sellerID == "" || event == "" || h.Redis == nil {
		return
	}
	if payload == nil {
		payload = map[string]any{}
	}
	if _, err := json.Marshal(payload); err != nil {
		return
	}

	webhooks, err := h.Repo.ListActiveWebhooksByEvent(ctx, sellerID, event)
	if err != nil || len(webhooks) == 0 {
		return
	}

	for _, webhook := range webhooks {
		job := webhookQueueJob{
			DeliveryID: fmt.Sprintf("%d-%s", time.Now().UnixNano(), event),
			Event:      event,
			URL:        webhook.URL,
			Secret:     webhook.Secret,
			Payload:    payload,
		}
		raw, err := json.Marshal(job)
		if err != nil {
			continue
		}
		_ = h.Redis.RPush(ctx, webhookQueueKey, string(raw)).Err()
	}
}
