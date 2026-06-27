package handlers

import (
	"errors"
	"net/http"
	"strings"
	"unicode"

	"marketplace/backend/internal/api/middleware"
	"marketplace/backend/internal/auth"
	"marketplace/backend/internal/models"
	"marketplace/backend/internal/repository"

	"github.com/gin-gonic/gin"
)

type createTicketRequest struct {
	Title      string  `json:"title"`
	Body       string  `json:"body"`
	CategoryID *string `json:"category_id"`
	PriorityID *string `json:"priority_id"`
	ProductID  *string `json:"product_id"`
	OrderID    *string `json:"order_id"`
}

type replyTicketRequest struct {
	Body string `json:"body"`
}

type updateTicketStatusRequest struct {
	Status string `json:"status"`
}

type assignTicketRequest struct {
	AssigneeID *string `json:"assignee_id"`
}

type adminTicketCategoryRequest struct {
	ParentID          *string `json:"parent_id"`
	Name              string  `json:"name"`
	Slug              string  `json:"slug"`
	Description       *string `json:"description"`
	SortOrder         int     `json:"sort_order"`
	IsActive          *bool   `json:"is_active"`
	AllowCustomerOpen *bool   `json:"allow_customer_open"`
}

type adminTicketStatusRequest struct {
	Slug                  string  `json:"slug"`
	Name                  string  `json:"name"`
	IsClosed              *bool   `json:"is_closed"`
	StatusOnCustomerReply *string `json:"status_on_customer_reply"`
	StatusOnStaffReply    *string `json:"status_on_staff_reply"`
	IncludeInCounts       *bool   `json:"include_in_counts"`
	SortOrder             int     `json:"sort_order"`
}

type adminTicketPriorityRequest struct {
	Slug      string `json:"slug"`
	Name      string `json:"name"`
	SortOrder int    `json:"sort_order"`
	IsActive  *bool  `json:"is_active"`
}

type adminTicketFeatureRequest struct {
	FeatureType string         `json:"feature_type"`
	Title       string         `json:"title"`
	Slug        string         `json:"slug"`
	Body        *string        `json:"body"`
	Config      map[string]any `json:"config"`
	SortOrder   int            `json:"sort_order"`
	IsActive    *bool          `json:"is_active"`
}

func (h *Handler) RegisterTicketRoutes(router *gin.RouterGroup) {
	router.GET("/tickets/meta", h.ticketMeta)
	router.GET("/tickets", h.listTickets)
	router.POST("/tickets", h.createTicket)
	router.GET("/tickets/:id", h.getTicket)
	router.POST("/tickets/:id/messages", h.replyTicket)
	router.PUT("/tickets/:id/read", h.markTicketRead)
	router.PUT("/tickets/:id/status", h.updateTicketStatus)
	router.PUT("/tickets/:id/assign", h.assignTicket)
}

func (h *Handler) ticketMeta(c *gin.Context) {
	categories, err := h.Repo.ListSupportTicketCategories(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load ticket categories"})
		return
	}
	statuses, err := h.Repo.ListSupportTicketStatuses(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load ticket statuses"})
		return
	}
	priorities, err := h.Repo.ListSupportTicketPriorities(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load ticket priorities"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"categories": categories, "statuses": statuses, "priorities": priorities})
}

func (h *Handler) adminTicketConfig(c *gin.Context) {
	categories, err := h.Repo.ListAdminSupportTicketCategories(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load ticket categories"})
		return
	}
	statuses, err := h.Repo.ListSupportTicketStatuses(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load ticket statuses"})
		return
	}
	priorities, err := h.Repo.ListAdminSupportTicketPriorities(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load ticket priorities"})
		return
	}
	features, err := h.Repo.ListSupportTicketFeatureConfigs(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load ticket feature configuration"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"categories": categories, "statuses": statuses, "priorities": priorities, "features": features})
}

func (h *Handler) adminSaveTicketCategory(c *gin.Context) {
	var req adminTicketCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil || auth.ValidateTokenPayload(&req) != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	name := strings.TrimSpace(req.Name)
	slug := ticketConfigSlug(req.Slug, name)
	if len(name) < 2 || len(name) > 120 || slug == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "category name and slug are required"})
		return
	}
	category := models.SupportTicketCategory{
		ID:                strings.TrimSpace(c.Param("id")),
		ParentID:          cleanOptionalString(req.ParentID),
		Name:              name,
		Slug:              slug,
		Description:       cleanOptionalString(req.Description),
		SortOrder:         req.SortOrder,
		IsActive:          boolWithDefault(req.IsActive, true),
		AllowCustomerOpen: boolWithDefault(req.AllowCustomerOpen, true),
	}
	if category.ParentID != nil && *category.ParentID == category.ID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "category cannot be its own parent"})
		return
	}
	if err := h.Repo.SaveSupportTicketCategory(c, &category); err != nil {
		adminTicketConfigError(c, err, "could not save ticket category")
		return
	}
	_ = h.recordAdminAction(c, "ticket.category.save", "support_ticket_category", category.ID, map[string]any{"slug": category.Slug})
	c.Status(http.StatusNoContent)
}

func (h *Handler) adminSaveTicketStatus(c *gin.Context) {
	var req adminTicketStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil || auth.ValidateTokenPayload(&req) != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	name := strings.TrimSpace(req.Name)
	slug := ticketConfigSlug(req.Slug, name)
	if len(name) < 2 || len(name) > 80 || slug == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "status name and slug are required"})
		return
	}
	status := models.SupportTicketStatus{
		ID:                    strings.TrimSpace(c.Param("id")),
		Slug:                  slug,
		Name:                  name,
		IsClosed:              boolWithDefault(req.IsClosed, false),
		StatusOnCustomerReply: cleanOptionalString(req.StatusOnCustomerReply),
		StatusOnStaffReply:    cleanOptionalString(req.StatusOnStaffReply),
		IncludeInCounts:       boolWithDefault(req.IncludeInCounts, true),
		SortOrder:             req.SortOrder,
	}
	if err := h.Repo.SaveSupportTicketStatus(c, &status); err != nil {
		adminTicketConfigError(c, err, "could not save ticket status")
		return
	}
	_ = h.recordAdminAction(c, "ticket.status.save", "support_ticket_status", status.ID, map[string]any{"slug": status.Slug})
	c.Status(http.StatusNoContent)
}

func (h *Handler) adminSaveTicketPriority(c *gin.Context) {
	var req adminTicketPriorityRequest
	if err := c.ShouldBindJSON(&req); err != nil || auth.ValidateTokenPayload(&req) != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	name := strings.TrimSpace(req.Name)
	slug := ticketConfigSlug(req.Slug, name)
	if len(name) < 2 || len(name) > 80 || slug == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "priority name and slug are required"})
		return
	}
	priority := models.SupportTicketPriority{
		ID:        strings.TrimSpace(c.Param("id")),
		Slug:      slug,
		Name:      name,
		SortOrder: req.SortOrder,
		IsActive:  boolWithDefault(req.IsActive, true),
	}
	if err := h.Repo.SaveSupportTicketPriority(c, &priority); err != nil {
		adminTicketConfigError(c, err, "could not save ticket priority")
		return
	}
	_ = h.recordAdminAction(c, "ticket.priority.save", "support_ticket_priority", priority.ID, map[string]any{"slug": priority.Slug})
	c.Status(http.StatusNoContent)
}

func (h *Handler) adminDeleteTicketCategory(c *gin.Context) {
	h.adminDeleteTicketConfig(c, "category", "support_ticket_category")
}

func (h *Handler) adminDeleteTicketStatus(c *gin.Context) {
	h.adminDeleteTicketConfig(c, "status", "support_ticket_status")
}

func (h *Handler) adminDeleteTicketPriority(c *gin.Context) {
	h.adminDeleteTicketConfig(c, "priority", "support_ticket_priority")
}

func (h *Handler) adminSaveTicketFeature(c *gin.Context) {
	var req adminTicketFeatureRequest
	if err := c.ShouldBindJSON(&req); err != nil || auth.ValidateTokenPayload(&req) != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	featureType := ticketConfigSlug(req.FeatureType, req.FeatureType)
	title := strings.TrimSpace(req.Title)
	slug := ticketConfigSlug(req.Slug, title)
	if !validTicketFeatureType(featureType) || len(title) < 2 || len(title) > 140 || slug == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "feature type, title, and slug are required"})
		return
	}
	config := req.Config
	if config == nil {
		config = map[string]any{}
	}
	item := models.SupportTicketFeatureConfig{
		ID:          strings.TrimSpace(c.Param("id")),
		FeatureType: featureType,
		Title:       title,
		Slug:        slug,
		Body:        cleanOptionalString(req.Body),
		Config:      config,
		SortOrder:   req.SortOrder,
		IsActive:    boolWithDefault(req.IsActive, true),
	}
	if err := h.Repo.SaveSupportTicketFeatureConfig(c, &item); err != nil {
		adminTicketConfigError(c, err, "could not save ticket feature")
		return
	}
	_ = h.recordAdminAction(c, "ticket.feature.save", "support_ticket_feature_config", item.ID, map[string]any{"feature_type": item.FeatureType, "slug": item.Slug})
	c.Status(http.StatusNoContent)
}

func (h *Handler) adminDeleteTicketFeature(c *gin.Context) {
	id := strings.TrimSpace(c.Param("id"))
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id is required"})
		return
	}
	if err := h.Repo.DeleteSupportTicketFeatureConfig(c, id); err != nil {
		adminTicketConfigError(c, err, "could not delete ticket feature")
		return
	}
	_ = h.recordAdminAction(c, "ticket.feature.delete", "support_ticket_feature_config", id, nil)
	c.Status(http.StatusNoContent)
}

func (h *Handler) adminDeleteTicketConfig(c *gin.Context, kind, targetType string) {
	id := strings.TrimSpace(c.Param("id"))
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id is required"})
		return
	}
	if err := h.Repo.DeleteSupportTicketConfig(c, kind, id); err != nil {
		adminTicketConfigError(c, err, "could not delete ticket config")
		return
	}
	_ = h.recordAdminAction(c, "ticket."+kind+".delete", targetType, id, nil)
	c.Status(http.StatusNoContent)
}

func adminTicketConfigError(c *gin.Context, err error, fallback string) {
	if errors.Is(err, repository.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "ticket config not found"})
		return
	}
	if errors.Is(err, repository.ErrConflict) || strings.Contains(err.Error(), "violates foreign key") {
		c.JSON(http.StatusConflict, gin.H{"error": "ticket config conflicts with existing data"})
		return
	}
	c.JSON(http.StatusInternalServerError, gin.H{"error": fallback})
}

func boolWithDefault(value *bool, fallback bool) bool {
	if value == nil {
		return fallback
	}
	return *value
}

func ticketConfigSlug(input, fallback string) string {
	source := strings.ToLower(strings.TrimSpace(input))
	if source == "" {
		source = strings.ToLower(strings.TrimSpace(fallback))
	}
	var builder strings.Builder
	lastDash := false
	for _, r := range source {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			builder.WriteRune(r)
			lastDash = false
		case r == '-' || r == '_' || unicode.IsSpace(r):
			if builder.Len() > 0 && !lastDash {
				builder.WriteByte('-')
				lastDash = true
			}
		}
	}
	return strings.Trim(builder.String(), "-")
}

func validTicketFeatureType(featureType string) bool {
	switch featureType {
	case "prefix", "property", "custom-field", "canned-response", "escalation", "banned-email", "kb-category", "kb-article", "business-hours", "option", "workflow", "channel", "sla":
		return true
	default:
		return false
	}
}

func (h *Handler) listTickets(c *gin.Context) {
	tickets, err := h.Repo.ListSupportTickets(c, repository.ListSupportTicketsFilter{
		UserID:     middleware.AuthUserID(c),
		Role:       middleware.AuthRole(c),
		Scope:      strings.TrimSpace(c.Query("scope")),
		StatusSlug: strings.TrimSpace(c.Query("status")),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load tickets"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"tickets": tickets})
}

func (h *Handler) createTicket(c *gin.Context) {
	var req createTicketRequest
	if err := c.ShouldBindJSON(&req); err != nil || auth.ValidateTokenPayload(&req) != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	title := strings.TrimSpace(req.Title)
	body := strings.TrimSpace(req.Body)
	if len(title) < 5 || len(title) > 220 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "title must be 5-220 characters"})
		return
	}
	if len(body) < 10 || len(body) > 20000 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "message must be 10-20000 characters"})
		return
	}
	userID := middleware.AuthUserID(c)
	ticket, err := h.Repo.CreateSupportTicket(c, userID, title, body, cleanOptionalString(req.CategoryID), cleanOptionalString(req.PriorityID), cleanOptionalString(req.ProductID), cleanOptionalString(req.OrderID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create ticket"})
		return
	}
	h.notifyTicketParticipants(c, ticket, userID, "ticket_created", "Support ticket opened")
	h.notifySupportStaff(c, ticket, userID, "ticket_created", "New support ticket")
	c.JSON(http.StatusCreated, ticket)
}

func (h *Handler) getTicket(c *gin.Context) {
	userID := middleware.AuthUserID(c)
	role := middleware.AuthRole(c)
	ticket, err := h.Repo.GetSupportTicket(c, c.Param("id"), userID, role)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ticket not found"})
		return
	}
	messages, err := h.Repo.ListSupportTicketMessages(c, ticket.ID, userID, role)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ticket not found"})
		return
	}
	_ = h.Repo.MarkSupportTicketRead(c, ticket.ID, userID, role)
	c.JSON(http.StatusOK, gin.H{"ticket": ticket, "messages": messages})
}

func (h *Handler) replyTicket(c *gin.Context) {
	var req replyTicketRequest
	if err := c.ShouldBindJSON(&req); err != nil || auth.ValidateTokenPayload(&req) != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	body := strings.TrimSpace(req.Body)
	if len(body) < 1 || len(body) > 20000 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "message must be 1-20000 characters"})
		return
	}
	userID := middleware.AuthUserID(c)
	role := middleware.AuthRole(c)
	message, err := h.Repo.AddSupportTicketMessage(c, c.Param("id"), userID, role, body)
	if err != nil {
		if errors.Is(err, repository.ErrUnavailable) {
			c.JSON(http.StatusConflict, gin.H{"error": "ticket is closed or locked"})
			return
		}
		c.JSON(http.StatusNotFound, gin.H{"error": "ticket not found"})
		return
	}
	if ticket, err := h.Repo.GetSupportTicket(c, c.Param("id"), userID, role); err == nil {
		h.notifyTicketParticipants(c, ticket, userID, "ticket_reply", "New ticket reply")
		if !supportStaffRole(role) {
			h.notifySupportStaff(c, ticket, userID, "ticket_reply", "Ticket needs attention")
		}
	}
	c.JSON(http.StatusCreated, message)
}

func (h *Handler) markTicketRead(c *gin.Context) {
	if err := h.Repo.MarkSupportTicketRead(c, c.Param("id"), middleware.AuthUserID(c), middleware.AuthRole(c)); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ticket not found"})
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Handler) updateTicketStatus(c *gin.Context) {
	var req updateTicketStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil || auth.ValidateTokenPayload(&req) != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	status := strings.TrimSpace(req.Status)
	if status == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "status is required"})
		return
	}
	role := middleware.AuthRole(c)
	if !supportStaffRole(role) && status != "resolved" && status != "closed" && status != "open" {
		c.JSON(http.StatusForbidden, gin.H{"error": "insufficient permissions"})
		return
	}
	userID := middleware.AuthUserID(c)
	if !supportStaffRole(role) {
		if _, err := h.Repo.GetSupportTicket(c, c.Param("id"), userID, role); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "ticket not found"})
			return
		}
	}
	ticket, err := h.Repo.UpdateSupportTicketStatus(c, c.Param("id"), status, userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ticket or status not found"})
		return
	}
	h.notifyTicketParticipants(c, ticket, userID, "ticket_status", "Ticket status updated")
	c.JSON(http.StatusOK, ticket)
}

func (h *Handler) assignTicket(c *gin.Context) {
	if !supportStaffRole(middleware.AuthRole(c)) {
		c.JSON(http.StatusForbidden, gin.H{"error": "insufficient permissions"})
		return
	}
	var req assignTicketRequest
	if err := c.ShouldBindJSON(&req); err != nil || auth.ValidateTokenPayload(&req) != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	assigneeID := ""
	if req.AssigneeID != nil {
		assigneeID = strings.TrimSpace(*req.AssigneeID)
	}
	ticket, err := h.Repo.AssignSupportTicket(c, c.Param("id"), assigneeID, middleware.AuthUserID(c))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ticket or assignee not found"})
		return
	}
	h.notifyTicketParticipants(c, ticket, middleware.AuthUserID(c), "ticket_assigned", "Ticket assignment updated")
	c.JSON(http.StatusOK, ticket)
}

func supportStaffRole(role string) bool {
	return role == "admin" || role == "staff"
}

func (h *Handler) notifyTicketParticipants(c *gin.Context, ticket models.SupportTicket, actorID string, notificationType string, title string) {
	link := "/dashboard/tickets/" + ticket.ID
	body := ticket.TicketRef + ": " + ticket.Title
	for _, participant := range ticket.Participants {
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

func (h *Handler) notifySupportStaff(c *gin.Context, ticket models.SupportTicket, actorID string, notificationType string, title string) {
	users, err := h.Repo.ListUsersByRoles(c, []string{"admin", "staff"})
	if err != nil {
		return
	}
	link := "/dashboard/tickets/" + ticket.ID
	body := ticket.TicketRef + ": " + ticket.Title
	for _, user := range users {
		if user.ID == actorID {
			continue
		}
		_ = h.Repo.AddNotification(c, &models.Notification{
			UserID: user.ID,
			Type:   notificationType,
			Title:  title,
			Body:   &body,
			Link:   &link,
		})
	}
}
