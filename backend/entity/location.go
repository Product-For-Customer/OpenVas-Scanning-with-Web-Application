package entity

import "gorm.io/gorm"

type AppLocation struct {
	gorm.Model

	Location   string  `json:"location" valid:"required~Location is required"`
	Latitude   float64 `json:"latitude" valid:"required~Latitude is required"`
	Longtitude float64 `json:"longtitude" valid:"required~Longtitude is required"`

	TaskID string `json:"task_id" gorm:"type:varchar(255);not null;index" valid:"required~TaskID is required"`

	AppUserID uint     `json:"app_user_id" gorm:"not null;index" valid:"required~AppUserID is required"`
	AppUser   *AppUser `json:"app_user" gorm:"foreignKey:AppUserID" valid:"-"`
}