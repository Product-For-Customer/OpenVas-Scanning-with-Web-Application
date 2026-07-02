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
