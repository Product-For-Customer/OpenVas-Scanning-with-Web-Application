package passwordpolicy

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/Tawunchai/openvas/config"
	"github.com/Tawunchai/openvas/entity"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// PasswordPolicy holds the current policy values.
type PasswordPolicy struct {
	MinLength        int  `json:"min_length"`
	RequireUppercase bool `json:"require_uppercase"`
	RequireNumber    bool `json:"require_number"`
	RequireSpecial   bool `json:"require_special"`
	ExpiryDays       int  `json:"expiry_days"`
}

func getConfig(db *gorm.DB, key, fallback string) string {
	var cfg entity.SystemConfig
	if err := db.Where("key = ?", key).First(&cfg).Error; err != nil {
		return fallback
	}
	return strings.TrimSpace(cfg.Value)
}

func upsertConfig(db *gorm.DB, key, value string) {
	var cfg entity.SystemConfig
	if err := db.Where("key = ?", key).First(&cfg).Error; err != nil {
		db.Create(&entity.SystemConfig{Key: key, Value: value})
	} else {
		db.Model(&cfg).Update("value", value)
	}
}

func boolVal(s string) bool { return s == "true" || s == "1" }
func boolStr(b bool) string {
	if b { return "true" }
	return "false"
}

func GetCurrentPolicy(db *gorm.DB) PasswordPolicy {
	minLen, _ := strconv.Atoi(getConfig(db, "password_min_length", "8"))
	if minLen < 6 { minLen = 6 }

	expiry, _ := strconv.Atoi(getConfig(db, "password_expiry_days", "0"))
	if expiry < 0 { expiry = 0 }

	return PasswordPolicy{
		MinLength:        minLen,
		RequireUppercase: boolVal(getConfig(db, "password_require_uppercase", "false")),
		RequireNumber:    boolVal(getConfig(db, "password_require_number", "false")),
		RequireSpecial:   boolVal(getConfig(db, "password_require_special", "false")),
		ExpiryDays:       expiry,
	}
}

// GET /password-policy
func GetPolicy(c *gin.Context) {
	db := config.DB()
	c.JSON(http.StatusOK, GetCurrentPolicy(db))
}

type UpdateInput struct {
	MinLength        *int  `json:"min_length"`
	RequireUppercase *bool `json:"require_uppercase"`
	RequireNumber    *bool `json:"require_number"`
	RequireSpecial   *bool `json:"require_special"`
	ExpiryDays       *int  `json:"expiry_days"`
}

// PATCH /password-policy  (admin only)
func UpdatePolicy(c *gin.Context) {
	role, _ := c.Get("user_role")
	if strings.ToLower(strings.TrimSpace(role.(string))) != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "admin access required"})
		return
	}

	var input UpdateInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	db := config.DB()

	if input.MinLength != nil {
		v := *input.MinLength
		if v < 6 { v = 6 }
		if v > 128 { v = 128 }
		upsertConfig(db, "password_min_length", strconv.Itoa(v))
	}
	if input.RequireUppercase != nil { upsertConfig(db, "password_require_uppercase", boolStr(*input.RequireUppercase)) }
	if input.RequireNumber    != nil { upsertConfig(db, "password_require_number",    boolStr(*input.RequireNumber))    }
	if input.RequireSpecial   != nil { upsertConfig(db, "password_require_special",   boolStr(*input.RequireSpecial))   }
	if input.ExpiryDays != nil {
		v := *input.ExpiryDays
		if v < 0 { v = 0 }
		upsertConfig(db, "password_expiry_days", strconv.Itoa(v))
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "policy updated",
		"data":    GetCurrentPolicy(db),
	})
}
