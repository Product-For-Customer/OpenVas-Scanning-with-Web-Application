package entity

import "gorm.io/gorm"

type AppUser struct {
	gorm.Model
	Email       string `valid:"required~Email is required,email~Email is invalid"`
	Password    string `valid:"required~Password is required,minstringlength(8)~Password must be at least 8 characters"`
	FirstName   string `valid:"required~FirstName is required"`
	LastName    string `valid:"required~LastName is required"`
	Profile     string `gorm:"type:text" valid:"required~Profile is required"`
	PhoneNumber string `valid:"required~PhoneNumber is required"`
	Location    string `valid:"required~Location is required"`
	Position    string `valid:"required~Position is required"`

	AppRoleID uint     `valid:"required~AppRoleID is required"`
	AppRole   *AppRole `gorm:"foreignKey:AppRoleID" valid:"-"`
}