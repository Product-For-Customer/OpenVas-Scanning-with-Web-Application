package security

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"strconv"
	"time"

	"github.com/Tawunchai/openvas/config"
	"github.com/Tawunchai/openvas/entity"
	"github.com/gin-gonic/gin"
)

// ===========================
// API Key Management
// ===========================

func generateAPIKey() (plainKey, keyHash, prefix string, err error) {
	b := make([]byte, 32)
	if _, err = rand.Read(b); err != nil {
		return
	}
	plainKey = "argus_" + hex.EncodeToString(b)
	prefix = plainKey[:12]
	h := sha256.Sum256([]byte(plainKey))
	keyHash = hex.EncodeToString(h[:])
	return
}

func ListAPIKeys(c *gin.Context) {
	db := config.DB()
	var keys []entity.AppAPIKey
	db.Order("created_at DESC").Find(&keys)
	c.JSON(http.StatusOK, gin.H{"data": keys})
}

type createKeyInput struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	AppUserID   uint   `json:"app_user_id"`
}

func CreateAPIKey(c *gin.Context) {
	var input createKeyInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	plain, hash, prefix, err := generateAPIKey()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate key"})
		return
	}

	key := entity.AppAPIKey{
		Name:        input.Name,
		KeyHash:     hash,
		KeyPrefix:   prefix,
		Description: input.Description,
		AppUserID:   input.AppUserID,
		IsActive:    true,
	}

	db := config.DB()
	if err := db.Create(&key).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Return plain key ONCE — not stored
	c.JSON(http.StatusCreated, gin.H{
		"data":      key,
		"plain_key": plain,
		"message":   "Save this key — it will not be shown again.",
	})
}

func RevokeAPIKey(c *gin.Context) {
	db := config.DB()
	id := c.Param("id")
	if err := db.Model(&entity.AppAPIKey{}).Where("id = ?", id).Update("is_active", false).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "API key revoked"})
}

func DeleteAPIKey(c *gin.Context) {
	db := config.DB()
	id := c.Param("id")
	if err := db.Delete(&entity.AppAPIKey{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// ===========================
// Audit Log
// ===========================

func ListAuditLogs(c *gin.Context) {
	db := config.DB()

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	action := c.Query("action")
	email := c.Query("email")
	resource := c.Query("resource")

	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 200 {
		limit = 50
	}
	offset := (page - 1) * limit

	q := db.Model(&entity.AppAuditLog{})
	if action != "" {
		q = q.Where("action = ?", action)
	}
	if email != "" {
		q = q.Where("user_email ILIKE ?", "%"+email+"%")
	}
	if resource != "" {
		q = q.Where("resource ILIKE ?", "%"+resource+"%")
	}

	var total int64
	q.Count(&total)

	var logs []entity.AppAuditLog
	q.Order("created_at DESC").Limit(limit).Offset(offset).Find(&logs)

	c.JSON(http.StatusOK, gin.H{
		"data":  logs,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

func GetRateLimitStatus(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status": "active",
		"limits": gin.H{
			"general_api":    "120 req/min per IP",
			"auth_endpoints": "10 req/min per IP",
			"pdf_generation": "10 req/hour per IP",
		},
		"checked_at": time.Now().Format(time.RFC3339),
	})
}

func DeleteAuditLogs(c *gin.Context) {
	db := config.DB()
	// Delete logs older than 90 days
	cutoff := time.Now().AddDate(0, -3, 0)
	result := db.Where("created_at < ?", cutoff).Delete(&entity.AppAuditLog{})
	c.JSON(http.StatusOK, gin.H{
		"deleted": result.RowsAffected,
		"message": "Audit logs older than 90 days deleted",
	})
}
