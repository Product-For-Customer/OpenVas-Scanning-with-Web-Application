// Package audit records high-risk actions (role changes, user/target/schedule
// deletion, settings/LINE-master changes) to the AuditLog table.
//
// Lives outside backend/services deliberately: backend/config already imports
// backend/services (for JWT secret handling), so services importing config
// back would create an import cycle. audit imports config directly and is
// only ever imported by controllers, so no cycle exists.
package audit

import (
	"log"

	"github.com/Tawunchai/openvas/config"
	"github.com/Tawunchai/openvas/entity"
	"github.com/gin-gonic/gin"
)

// Log records one audit entry using the actor identity attached to the
// request context by the auth middleware. Best-effort: a failure to write
// the log entry is reported server-side but never aborts the caller's request.
func Log(c *gin.Context, action, targetType, targetID, detail string) {
	LogAs(c, c.GetUint("user_id"), c.GetString("user_email"), c.GetString("user_role"), action, targetType, targetID, detail)
}

// LogAs records one audit entry with an explicit actor, for routes that run
// before (or without) an authenticated session — e.g. login attempts, where
// the attempted email is known but no JWT-derived context exists yet.
func LogAs(c *gin.Context, actorID uint, actorEmail, actorRole, action, targetType, targetID, detail string) {
	entry := entity.AuditLog{
		ActorID:    actorID,
		ActorEmail: actorEmail,
		ActorRole:  actorRole,
		Action:     action,
		TargetType: targetType,
		TargetID:   targetID,
		Detail:     detail,
		IPAddress:  c.ClientIP(),
	}

	if err := config.DB().Create(&entry).Error; err != nil {
		log.Printf("⚠️ audit.Log failed to write entry (action=%s): %v", action, err)
	}
}
