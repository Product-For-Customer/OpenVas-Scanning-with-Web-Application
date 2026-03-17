package entity

import "gorm.io/gorm"

type AppTarget struct {
	gorm.Model
	Name       string  `json:"name" valid:"required~Name is required"`
	IpHost     string  `json:"ip_host" valid:"required~IpHost is required"`
	MacAddress string `json:"mac_address" valid:"-"`

	AppLocation []AppLocation `gorm:"foreignKey:AppTargetID" json:"app_location" valid:"-"`
}