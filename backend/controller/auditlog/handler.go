package auditlog

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/Tawunchai/openvas/config"
	"github.com/Tawunchai/openvas/entity"
	"github.com/Tawunchai/openvas/permission"
	"github.com/Tawunchai/openvas/services"
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
	// A malformed "from"/"to" used to be silently ignored (falling through to
	// an unfiltered query) instead of telling the caller their filter didn't
	// apply — now rejected with 400 so the caller knows to fix the value
	// rather than unknowingly getting broader results than they filtered for.
	if fromRaw := strings.TrimSpace(c.Query("from")); fromRaw != "" {
		from, err := time.Parse(time.RFC3339, fromRaw)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid 'from' date, expected RFC3339"})
			return
		}
		db = db.Where("created_at >= ?", from)
	}
	if toRaw := strings.TrimSpace(c.Query("to")); toRaw != "" {
		to, err := time.Parse(time.RFC3339, toRaw)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid 'to' date, expected RFC3339"})
			return
		}
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
	if err := db.Count(&total).Error; err != nil {
		services.RespondInternalError(c, err)
		return
	}

	var logs []entity.AuditLog
	if err := db.Order("created_at desc").
		Limit(pageSize).
		Offset((page - 1) * pageSize).
		Find(&logs).Error; err != nil {
		services.RespondInternalError(c, err)
		return
	}

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
