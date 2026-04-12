package entity

import "gorm.io/gorm"

type AppNotification struct {
	gorm.Model
	Name    string `json:"name" valid:"required~Name is required"`
	SendID  string `json:"send_id" valid:"required~SendID is required"`
	Alert   bool   `json:"alert"`
	IsGroup bool   `json:"is_group"`

	AppLineMasterID uint           `json:"app_line_master_id" valid:"required~AppLineMasterID is required"`
	AppLineMaster   *AppLineMaster `gorm:"foreignKey:AppLineMasterID" valid:"-"`
}