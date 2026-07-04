package auditlog

import (
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/Tawunchai/openvas/config"
	"github.com/Tawunchai/openvas/entity"
	"github.com/Tawunchai/openvas/services"
	"github.com/gin-gonic/gin"
)

// auditLogRetentionKey mirrors the same-named constant in
// controller/setting/handler.go (kept as a separate local declaration, not a
// cross-package import — same pattern as every other SystemConfig key in
// this codebase).
const auditLogRetentionKey = "audit_log_retention_days"

// getAuditLogRetentionDays reads the configured retention window from
// SystemConfig. 0 (unset, empty, or invalid) means "retain forever" —
// unlike the disposable LINE notification history (hard 6-month
// auto-cleanup), audit log entries are accountability/compliance records,
// so automatic deletion is opt-in: an admin must explicitly set a positive
// number of days via PUT /settings before anything ever gets deleted.
func getAuditLogRetentionDays() int {
	db := config.DB()
	var cfg entity.SystemConfig
	if err := db.Where("key = ?", auditLogRetentionKey).First(&cfg).Error; err != nil {
		return 0
	}
	days, err := strconv.Atoi(strings.TrimSpace(cfg.Value))
	if err != nil || days <= 0 {
		return 0
	}
	return days
}

func deleteOldAuditLogs() (int64, error) {
	days := getAuditLogRetentionDays()
	if days <= 0 {
		return 0, nil
	}
	db := config.DB()
	cutoff := time.Now().AddDate(0, 0, -days)
	result := db.Unscoped().Where("created_at < ?", cutoff).Delete(&entity.AuditLog{})
	if result.Error != nil {
		return 0, result.Error
	}
	return result.RowsAffected, nil
}

// StartAuditLogAutoCleanup runs a background goroutine that prunes audit log
// entries older than the configured retention window. It's a no-op every run
// until an admin sets audit_log_retention_days to a positive value. Fires
// once at startup then every 24 hours after that.
func StartAuditLogAutoCleanup() {
	log.Println("✅ AuditLog auto-cleanup scheduler started (daily; no-op unless audit_log_retention_days is set)")

	runCleanup := func(label string) {
		n, err := deleteOldAuditLogs()
		if err != nil {
			log.Printf("⚠️ AuditLog auto-cleanup [%s] error: %v\n", label, err)
			return
		}
		if n > 0 {
			log.Printf("🗑️  AuditLog auto-cleanup [%s]: deleted %d record(s) beyond the configured retention window\n", label, n)
		}
	}

	runCleanup("startup")

	ticker := time.NewTicker(24 * time.Hour)
	defer ticker.Stop()
	for range ticker.C {
		runCleanup("daily")
	}
}

// TriggerAuditLogCleanup handles POST /audit-logs/cleanup — lets an admin
// run the retention prune on demand instead of waiting for the next daily
// tick. Gated by user_management (not audit_log, which is view-only by
// design) since pruning history is a system-policy action, not a normal
// audit-log read.
func TriggerAuditLogCleanup(c *gin.Context) {
	days := getAuditLogRetentionDays()
	if days <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "audit_log_retention_days is not configured (or is 0) — set it via /settings first"})
		return
	}
	deleted, err := deleteOldAuditLogs()
	if err != nil {
		services.RespondInternalError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"message":        "cleanup completed",
		"deleted_count":  deleted,
		"retention_days": days,
	})
}
