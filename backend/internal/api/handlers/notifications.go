package handlers

import (
	"net/http"

	"marketplace/backend/internal/auth"
	"marketplace/backend/internal/api/middleware"
	"marketplace/backend/internal/models"

	"github.com/gin-gonic/gin"
)

func (h *Handler) RegisterNotificationRoutes(router *gin.RouterGroup) {
	router.GET("/notifications", h.listNotifications)
	router.PUT("/notifications/read-all", h.readAllNotifications)
	router.PUT("/notifications/:id/read", h.readNotification)
}

func (h *Handler) listNotifications(c *gin.Context) {
	userID := middleware.AuthUserID(c)
	items, err := h.Repo.ListNotifications(c, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load notifications"})
		return
	}
	c.JSON(http.StatusOK, items)
}

func (h *Handler) readNotification(c *gin.Context) {
	userID := middleware.AuthUserID(c)
	if err := h.Repo.MarkOrderNotificationSeen(c, userID, c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not mark notification"})
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Handler) readAllNotifications(c *gin.Context) {
	userID := middleware.AuthUserID(c)
	if err := h.Repo.MarkAllNotificationsRead(c, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not mark notifications"})
		return
	}
	c.Status(http.StatusNoContent)
}

type reportRequest struct {
	TargetType string `json:"target_type" validate:"required"`
	TargetID   string `json:"target_id" validate:"required"`
	Reason     string `json:"reason" validate:"required"`
	Details    string `json:"details"`
}

func (h *Handler) RegisterReportRoutes(router *gin.RouterGroup) {
	router.POST("/reports", h.createReport)
}

func (h *Handler) createReport(c *gin.Context) {
	var req reportRequest
	if err := c.ShouldBindJSON(&req); err != nil || auth.ValidateTokenPayload(&req) != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	userID := middleware.AuthUserID(c)
	report := models.Report{
		ReporterID: &userID,
		TargetType: req.TargetType,
		TargetID:   req.TargetID,
		Reason:     req.Reason,
	}
	if req.Details != "" {
		d := req.Details
		report.Details = &d
	}
	id, err := h.Repo.CreateReport(c, report)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not submit report"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"id": id})
}
