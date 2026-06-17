package entity

import (
	"time"

	"gorm.io/gorm"
)

type AppAPIKey struct {
	ID          uint           `gorm:"primaryKey;autoIncrement" json:"id"`
	Name        string         `gorm:"column:name;not null" json:"name"`
	KeyHash     string         `gorm:"column:key_hash;uniqueIndex;not null" json:"-"`
	KeyPrefix   string         `gorm:"column:key_prefix" json:"key_prefix"`
	Description string         `gorm:"column:description;type:text" json:"description"`
	AppUserID   uint           `gorm:"column:app_user_id;index" json:"app_user_id"`
	LastUsedAt  *time.Time     `gorm:"column:last_used_at" json:"last_used_at"`
	ExpiresAt   *time.Time     `gorm:"column:expires_at" json:"expires_at"`
	IsActive    bool           `gorm:"column:is_active;default:true" json:"is_active"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

type AppAuditLog struct {
	ID         uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID     *uint     `gorm:"column:user_id;index" json:"user_id"`
	UserEmail  string    `gorm:"column:user_email" json:"user_email"`
	Action     string    `gorm:"column:action;index" json:"action"`
	Resource   string    `gorm:"column:resource;index" json:"resource"`
	ResourceID string    `gorm:"column:resource_id" json:"resource_id"`
	Method     string    `gorm:"column:method" json:"method"`
	Endpoint   string    `gorm:"column:endpoint" json:"endpoint"`
	IPAddress  string    `gorm:"column:ip_address" json:"ip_address"`
	UserAgent  string    `gorm:"column:user_agent" json:"user_agent"`
	StatusCode int       `gorm:"column:status_code" json:"status_code"`
	Details    string    `gorm:"column:details;type:text" json:"details"`
	CreatedAt  time.Time `gorm:"index" json:"created_at"`
}
