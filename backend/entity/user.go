package entity

import "gorm.io/gorm"

type AppUser struct {
	gorm.Model
	Email       string `valid:"required~Email is required,email~Email is invalid"`
	Password    string `valid:"required~Password is required,minstringlength(8)~Password must be at least 8 characters"`
	FirstName   string `valid:"required~FirstName is required"`
	LastName    string `valid:"required~LastName is required"`
	Profile     string `gorm:"type:text" valid:"-"`
	PhoneNumber string `valid:"-"`
	Location    string `valid:"-"`
	Position    string `valid:"-"`

	SendEmail      []SendEmail      `gorm:"foreignKey:AppUserID" valid:"-"`
	AppDiagram     []AppDiagram     `gorm:"foreignKey:AppUserID" valid:"-"`
	AppDiagramNode []AppDiagramNode `gorm:"foreignKey:AppUserID" valid:"-"`
	AppLineMaster  []AppLineMaster  `gorm:"foreignKey:AppUserID" valid:"-"`
	AppNotification []AppNotification `gorm:"foreignKey:AppUserID" valid:"-"`
	AppLocation    []AppLocation    `gorm:"foreignKey:AppUserID" valid:"-"`

	AppRoleID uint     `valid:"-"`
	AppRole   *AppRole `gorm:"foreignKey:AppRoleID" valid:"-"`

	// TOTP (Authenticator App)
	TOTPSecret   string `gorm:"column:totp_secret"   valid:"-"`
	TOTPEnabled  bool   `gorm:"column:totp_enabled;default:false" valid:"-"`
}
