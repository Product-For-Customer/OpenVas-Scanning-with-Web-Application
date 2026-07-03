package auditlog

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/Tawunchai/openvas/config"
	"github.com/Tawunchai/openvas/entity"
	"github.com/Tawunchai/openvas/permission"
	"github.com/gin-gonic/gin"
)

type AuditLogResponse struct {
	ID         uint   `json:"id"`
	ActorID    uint   `json:"actor_id"`
	ActorEmail string `json:"actor_email"`
	ActorRole  string `json:"actor_role"`
	Action     string `json:"action"`
	TargetType string `json:"target_type"`
	TargetID   string `json:"target_id"`
	Detail     string `json:"detail"`
	IPAddress  string `json:"ip_address"`
	CreatedAt  string `json:"created_at"`
}

func mapAuditLogResponse(a entity.AuditLog) AuditLogResponse {
	return AuditLogResponse{
		ID:         a.ID,
		ActorID:    a.ActorID,
		ActorEmail: a.ActorEmail,
		ActorRole:  a.ActorRole,
		Action:     a.Action,
		TargetType: a.TargetType,
		TargetID:   a.TargetID,
		Detail:     a.Detail,
		IPAddress:  a.IPAddress,
		CreatedAt:  a.CreatedAt.Format(time.RFC3339),
	}
}

// ListAuditLogs godoc
// GET /audit-logs — requires audit_log view permission (also enforced by the
// EnforcePermissions middleware for this route; kept here too as
// defense-in-depth since this endpoint exposes cross-account activity).
// Query params: action, actor_id, from (RFC3339), to (RFC3339), page, page_size
func ListAuditLogs(c *gin.Context) {
	if !permission.Has(c.GetUint("user_role_id"), "audit_log", false) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Audit Log access required"})
		return
	}

	db := config.DB().Model(&entity.AuditLog{})

	if action := strings.TrimSpace(c.Query("action")); action != "" {
		db = db.Where("action = ?", action)
	}
	if actorID := strings.TrimSpace(c.Query("actor_id")); actorID != "" {
		db = db.Where("actor_id = ?", actorID)
	}
	if from, err := time.Parse(time.RFC3339, c.Query("from")); err == nil {
		db = db.Where("created_at >= ?", from)
	}
	if to, err := time.Parse(time.RFC3339, c.Query("to")); err == nil {
		db = db.Where("created_at <= ?", to)
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	if page < 1 {
		page = 1
	}
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "50"))
	if pageSize < 1 || pageSize > 200 {
		pageSize = 50
	}

	var total int64
	db.Count(&total)

	var logs []entity.AuditLog
	db.Order("created_at desc").
		Limit(pageSize).
		Offset((page - 1) * pageSize).
		Find(&logs)

	response := make([]AuditLogResponse, 0, len(logs))
	for _, l := range logs {
		response = append(response, mapAuditLogResponse(l))
	}

	c.JSON(http.StatusOK, gin.H{
		"data":      response,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}
