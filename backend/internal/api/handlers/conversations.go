package handlers

import (
	"errors"
	"net/http"
	"strings"

	"marketplace/backend/internal/api/middleware"
	"marketplace/backend/internal/auth"
	"marketplace/backend/internal/models"
	"marketplace/backend/internal/repository"

	"github.com/gin-gonic/gin"
)

type createConversationRequest struct {
	Title        string   `json:"title"`
	Body         string   `json:"body"`
	RecipientIDs []string `json:"recipient_ids"`
	ContextType  *string  `json:"context_type"`
	ContextID    *string  `json:"context_id"`
}

type replyConversationRequest struct {
	Body string `json:"body"`
}

func (h *Handler) RegisterConversationRoutes(router *gin.RouterGroup) {
	router.GET("/conversations", h.listConversations)
	router.POST("/conversations", h.createConversation)
	router.GET("/conversations/:id", h.getConversation)
	router.POST("/conversations/:id/messages", h.replyConversation)
	router.PUT("/conversations/:id/read", h.markConversationRead)
	router.POST("/conversations/:id/leave", h.leaveConversation)
}

func (h *Handler) listConversations(c *gin.Context) {
	conversations, err := h.Repo.ListConversations(c, middleware.AuthUserID(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load conversations"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"conversations": conversations})
}

func (h *Handler) createConversation(c *gin.Context) {
	var req createConversationRequest
	if err := c.ShouldBindJSON(&req); err != nil || auth.ValidateTokenPayload(&req) != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	req.Title = strings.TrimSpace(req.Title)
	req.Body = strings.TrimSpace(req.Body)
	if len(req.Title) < 3 || len(req.Title) > 200 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "title must be 3-200 characters"})
		return
	}
	if len(req.Body) < 1 || len(req.Body) > 10000 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "message must be 1-10000 characters"})
		return
	}
	creatorID := middleware.AuthUserID(c)
	conversation, err := h.Repo.CreateConversation(c, creatorID, req.Title, req.Body, req.RecipientIDs, cleanOptionalString(req.ContextType), cleanOptionalString(req.ContextID))
	if err != nil {
		if errors.Is(err, repository.ErrUnavailable) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "add at least one recipient"})
			return
		}
		if errors.Is(err, repository.ErrConflict) {
			c.JSON(http.StatusConflict, gin.H{"error": "conversation already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create conversation"})
		return
	}
	h.notifyConversationParticipants(c, conversation, creatorID, "conversation_started", "New conversation")
	c.JSON(http.StatusCreated, conversation)
}

func (h *Handler) getConversation(c *gin.Context) {
	userID := middleware.AuthUserID(c)
	conversation, err := h.Repo.GetConversation(c, c.Param("id"), userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "conversation not found"})
		return
	}
	messages, err := h.Repo.ListConversationMessages(c, conversation.ID, userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "conversation not found"})
		return
	}
	_ = h.Repo.MarkConversationRead(c, conversation.ID, userID)
	c.JSON(http.StatusOK, gin.H{"conversation": conversation, "messages": messages})
}

func (h *Handler) replyConversation(c *gin.Context) {
	var req replyConversationRequest
	if err := c.ShouldBindJSON(&req); err != nil || auth.ValidateTokenPayload(&req) != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	body := strings.TrimSpace(req.Body)
	if len(body) < 1 || len(body) > 10000 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "message must be 1-10000 characters"})
		return
	}
	userID := middleware.AuthUserID(c)
	message, err := h.Repo.AddConversationMessage(c, c.Param("id"), userID, body)
	if err != nil {
		if errors.Is(err, repository.ErrUnavailable) {
			c.JSON(http.StatusConflict, gin.H{"error": "conversation is closed"})
			return
		}
		c.JSON(http.StatusNotFound, gin.H{"error": "conversation not found"})
		return
	}
	conversation, err := h.Repo.GetConversation(c, c.Param("id"), userID)
	if err == nil {
		h.notifyConversationParticipants(c, conversation, userID, "conversation_reply", "New conversation reply")
	}
	c.JSON(http.StatusCreated, message)
}

func (h *Handler) markConversationRead(c *gin.Context) {
	if err := h.Repo.MarkConversationRead(c, c.Param("id"), middleware.AuthUserID(c)); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "conversation not found"})
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Handler) leaveConversation(c *gin.Context) {
	if err := h.Repo.LeaveConversation(c, c.Param("id"), middleware.AuthUserID(c)); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "conversation not found"})
		return
	}
	c.Status(http.StatusNoContent)
}

func cleanOptionalString(value *string) *string {
	if value == nil {
		return nil
	}
	clean := strings.TrimSpace(*value)
	if clean == "" {
		return nil
	}
	return &clean
}

func (h *Handler) notifyConversationParticipants(c *gin.Context, conversation models.Conversation, actorID string, notificationType string, title string) {
	link := "/dashboard/conversations/" + conversation.ID
	body := conversation.Title
	for _, participant := range conversation.Participants {
		if participant.UserID == actorID || participant.LeftAt != nil {
			continue
		}
		_ = h.Repo.AddNotification(c, &models.Notification{
			UserID: participant.UserID,
			Type:   notificationType,
			Title:  title,
			Body:   &body,
			Link:   &link,
		})
	}
}
