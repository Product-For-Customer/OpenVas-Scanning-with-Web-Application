package role

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/Tawunchai/openvas/audit"
	"github.com/Tawunchai/openvas/config"
	"github.com/Tawunchai/openvas/entity"
	"github.com/Tawunchai/openvas/permission"
	"github.com/gin-gonic/gin"
)

type PermissionInput struct {
	Category  string `json:"category" binding:"required"`
	CanView   bool   `json:"can_view"`
	CanManage bool   `json:"can_manage"`
}

type RoleDetailDTO struct {
	ID          uint                               `json:"id"`
	Role        string                             `json:"role"`
	IsBuiltIn   bool                               `json:"is_built_in"`
	UserCount   int64                              `json:"user_count"`
	Permissions map[string]permission.CategoryPerm `json:"permissions"`
}

// ── helpers ───────────────────────────────────────────────────────────────

func buildDetailDTO(role entity.AppRole, userCount int64) RoleDetailDTO {
	return RoleDetailDTO{
		ID:          role.ID,
		Role:        role.Role,
		IsBuiltIn:   role.IsBuiltIn,
		UserCount:   userCount,
		Permissions: permission.GetPermissions(role.ID),
	}
}

// validatePermissions rejects unknown category keys and normalizes CanManage
// to false for categories that don't support it (dashboard/audit_log).
func validatePermissions(input []PermissionInput) ([]PermissionInput, error) {
	seen := map[string]bool{}
	out := make([]PermissionInput, 0, len(input))
	for _, p := range input {
		if !entity.IsValidCategory(p.Category) {
			return nil, fmt.Errorf("unknown permission category %q", p.Category)
		}
		if seen[p.Category] {
			continue // ignore duplicate rows for the same category
		}
		seen[p.Category] = true
		for _, cat := range entity.PermissionCategories {
			if cat.Key == p.Category && !cat.SupportsManage {
				p.CanManage = false
			}
		}
		out = append(out, p)
	}
	return out, nil
}

// isAdminLockGuard reports whether this update would strip user_management
// manage access from the built-in Admin role — the one guard that prevents
// the system from ending up with zero roles able to manage users/roles.
func isAdminLockGuard(role entity.AppRole, perms []PermissionInput) bool {
	if !role.IsBuiltIn || !strings.EqualFold(role.Role, "admin") {
		return false
	}
	for _, p := range perms {
		if p.Category == "user_management" && !p.CanManage {
			return true
		}
	}
	return true // user_management row omitted entirely also strips manage access
}

// ── Handlers ──────────────────────────────────────────────────────────────

// GET /permission-categories
func ListPermissionCategories(c *gin.Context) {
	c.JSON(http.StatusOK, entity.PermissionCategories)
}

// GET /roles/:id — role detail + its full permission matrix + assigned user count
func GetRole(c *gin.Context) {
	db := config.DB()
	id := c.Param("id")

	var role entity.AppRole
	if err := db.First(&role, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "role not found"})
		return
	}

	var userCount int64
	db.Model(&entity.AppUser{}).Where("app_role_id = ?", role.ID).Count(&userCount)

	c.JSON(http.StatusOK, buildDetailDTO(role, userCount))
}

type CreateRoleInput struct {
	Role        string            `json:"role" binding:"required"`
	Permissions []PermissionInput `json:"permissions"`
}

// POST /roles — create a new custom role with its permission matrix
func CreateRole(c *gin.Context) {
	var input CreateRoleInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	input.Role = strings.TrimSpace(input.Role)
	if input.Role == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "role name is required"})
		return
	}

	perms, err := validatePermissions(input.Permissions)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	db := config.DB()

	var existing entity.AppRole
	if err := db.Where("LOWER(role) = LOWER(?)", input.Role).First(&existing).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "a role with this name already exists"})
		return
	}

	role := entity.AppRole{Role: input.Role, IsBuiltIn: false}
	if err := db.Create(&role).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create role"})
		return
	}

	for _, p := range perms {
		db.Create(&entity.AppRolePermission{
			AppRoleID: role.ID, Category: p.Category, CanView: p.CanView, CanManage: p.CanManage,
		})
	}
	permission.InvalidateCache()

	audit.Log(c, "role.created", "role", strconv.FormatUint(uint64(role.ID), 10), fmt.Sprintf("created role %q", role.Role))

	var userCount int64
	c.JSON(http.StatusCreated, buildDetailDTO(role, userCount))
}

type UpdateRoleInput struct {
	Role        *string           `json:"role"`
	Permissions []PermissionInput `json:"permissions"`
}

// PATCH /roles/:id — rename and/or replace the permission matrix
func UpdateRole(c *gin.Context) {
	db := config.DB()
	id := c.Param("id")

	var role entity.AppRole
	if err := db.First(&role, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "role not found"})
		return
	}

	var input UpdateRoleInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	perms, err := validatePermissions(input.Permissions)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if input.Permissions != nil && isAdminLockGuard(role, perms) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot remove User & Role Management access from the built-in Admin role — this would lock everyone out of role management"})
		return
	}

	oldName := role.Role
	if input.Role != nil {
		newName := strings.TrimSpace(*input.Role)
		if newName == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "role name cannot be empty"})
			return
		}
		var existing entity.AppRole
		if err := db.Where("LOWER(role) = LOWER(?) AND id <> ?", newName, role.ID).First(&existing).Error; err == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "a role with this name already exists"})
			return
		}
		role.Role = newName
		db.Save(&role)
	}

	if input.Permissions != nil {
		db.Where("app_role_id = ?", role.ID).Delete(&entity.AppRolePermission{})
		for _, p := range perms {
			db.Create(&entity.AppRolePermission{
				AppRoleID: role.ID, Category: p.Category, CanView: p.CanView, CanManage: p.CanManage,
			})
		}
	}
	permission.InvalidateCache()

	audit.Log(c, "role.updated", "role", strconv.FormatUint(uint64(role.ID), 10), fmt.Sprintf("updated role %q (was %q)", role.Role, oldName))

	var userCount int64
	db.Model(&entity.AppUser{}).Where("app_role_id = ?", role.ID).Count(&userCount)
	c.JSON(http.StatusOK, buildDetailDTO(role, userCount))
}

// DELETE /roles/:id — blocked if built-in or if any user is still assigned
func DeleteRole(c *gin.Context) {
	db := config.DB()
	id := c.Param("id")

	var role entity.AppRole
	if err := db.First(&role, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "role not found"})
		return
	}

	if role.IsBuiltIn {
		c.JSON(http.StatusBadRequest, gin.H{"error": "built-in roles cannot be deleted, only edited"})
		return
	}

	var userCount int64
	db.Model(&entity.AppUser{}).Where("app_role_id = ?", role.ID).Count(&userCount)
	if userCount > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("cannot delete: %d user(s) are still assigned to this role", userCount)})
		return
	}

	db.Where("app_role_id = ?", role.ID).Delete(&entity.AppRolePermission{})
	if err := db.Delete(&role).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete role"})
		return
	}
	permission.InvalidateCache()

	audit.Log(c, "role.deleted", "role", strconv.FormatUint(uint64(role.ID), 10), fmt.Sprintf("deleted role %q", role.Role))

	c.JSON(http.StatusOK, gin.H{"message": "role deleted"})
}
