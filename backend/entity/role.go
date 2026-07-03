package entity

import "gorm.io/gorm"

type AppRole struct {
	gorm.Model
	Role string `valid:"required~Role is required"`
	// IsBuiltIn marks the 4 originally-seeded roles (Admin/User/Operator/Auditor).
	// Their name and permissions stay fully editable, but they cannot be deleted,
	// so the system can never end up with zero usable roles.
	IsBuiltIn bool `gorm:"default:false" valid:"-"`

	AppUser           []AppUser           `gorm:"foreignKey:AppRoleID" valid:"-"`
	AppRolePermission []AppRolePermission `gorm:"foreignKey:AppRoleID" valid:"-"`
}
