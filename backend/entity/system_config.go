package entity

import "gorm.io/gorm"

type SystemConfig struct {
	gorm.Model
	Key   string `gorm:"uniqueIndex;not null"`
	Value string `gorm:"not null;default:''"`
}
