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
	"github.com/Tawunchai/openvas/services"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// replacePermissions replaces every AppRolePermission row for a role. Must be
// called with a transaction handle (tx) so it composes atomically with
// whatever else the caller does (role rename, role creation) — a failure
// here must roll back everything else in the same request, not leave the
// role half-updated.
//
// Must use Unscoped() for the delete: AppRolePermission embeds gorm.Model,
// so a plain Delete() only soft-deletes (sets deleted_at) — the row still
// physically exists and still occupies the (app_role_id, category) unique
// index, so the very next Create() for the same category fails with a
// unique-constraint violation. That failure was previously never checked, so
// it failed silently and left the role with zero active permissions — this
// was the "editing permissions doesn't save" bug.
func replacePermissions(tx *gorm.DB, roleID uint, perms []PermissionInput) error {
	if err := tx.Unscoped().Where("app_role_id = ?", roleID).Delete(&entity.AppRolePermission{}).Error; err != nil {
		return fmt.Errorf("failed to clear existing permissions: %w", err)
	}
	for _, p := range perms {
		row := entity.AppRolePermission{AppRoleID: roleID, Category: p.Category, CanView: p.CanView, CanManage: p.CanManage}
		if err := tx.Create(&row).Error; err != nil {
			return fmt.Errorf("failed to save permission for category %q: %w", p.Category, err)
		}
	}
	return nil
}

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

// validatePermissions rejects unknown category keys and normalizes CanManage:
// forced to false for categories that don't support it at all (audit_log),
// and forced to equal CanView for categories where Manage mirrors View
// (dashboard) — never trusted from the request body in either case.
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
			if cat.Key != p.Category {
				continue
			}
			switch {
			case !cat.SupportsManage:
				p.CanManage = false
			case cat.ManageMirrorsView:
				p.CanManage = p.CanView
			}
		}
		out = append(out, p)
	}
	return out, nil
}

// isProtectedRole reports whether role is one of the 2 core roles that must
// always exist — Admin (so someone can always administer the system) and
// User (the default fallback role new self-registered accounts get). These
// can never be deleted, regardless of how many users are assigned to them.
// Operator/Auditor are also seeded as IsBuiltIn defaults but are NOT
// protected — like any custom role, they're deletable once unused.
func isProtectedRole(role entity.AppRole) bool {
	name := strings.ToLower(strings.TrimSpace(role.Role))
	return name == "admin" || name == "user"
}

// isAdminRole reports whether role is specifically the built-in Admin role —
// the one role that always has full access and whose permissions can never
// be edited away from that (unlike User, which is protected from deletion
// but otherwise editable normally).
func isAdminRole(role entity.AppRole) bool {
	return role.IsBuiltIn && strings.EqualFold(role.Role, "admin")
}

// adminPermissionsLocked reports whether perms would leave the Admin role
// with anything less than full View+Manage access on every category. Any
// category that's missing entirely (omitted from perms) also counts as
// "less than full access" since the frontend always submits the complete
// matrix — an omission can only mean tampering with the request.
func adminPermissionsLocked(perms []PermissionInput) bool {
	byCategory := make(map[string]PermissionInput, len(perms))
	for _, p := range perms {
		byCategory[p.Category] = p
	}
	for _, cat := range entity.PermissionCategories {
		p, ok := byCategory[cat.Key]
		if !ok || !p.CanView {
			return true
		}
		if cat.SupportsManage && !p.CanManage {
			return true
		}
	}
	return false
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
	if err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&role).Error; err != nil {
			return fmt.Errorf("failed to create role: %w", err)
		}
		return replacePermissions(tx, role.ID, perms)
	}); err != nil {
		services.RespondInternalError(c, err)
		return
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

	if input.Permissions != nil && isAdminRole(role) && adminPermissionsLocked(perms) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "the Admin role always has full access — its permissions cannot be changed"})
		return
	}

	oldName := role.Role
	newName := oldName
	if input.Role != nil {
		newName = strings.TrimSpace(*input.Role)
		if newName == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "role name cannot be empty"})
			return
		}
		var existing entity.AppRole
		if err := db.Where("LOWER(role) = LOWER(?) AND id <> ?", newName, role.ID).First(&existing).Error; err == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "a role with this name already exists"})
			return
		}
	}

	// Rename + permission replacement happen in one transaction so a failure
	// in either step can never leave the role half-updated (e.g. renamed but
	// with its permissions wiped, or vice versa).
	if err := db.Transaction(func(tx *gorm.DB) error {
		if input.Role != nil {
			role.Role = newName
			if err := tx.Save(&role).Error; err != nil {
				return fmt.Errorf("failed to rename role: %w", err)
			}
		}
		if input.Permissions != nil {
			if err := replacePermissions(tx, role.ID, perms); err != nil {
				return err
			}
		}
		return nil
	}); err != nil {
		services.RespondInternalError(c, err)
		return
	}
	permission.InvalidateCache()

	audit.Log(c, "role.updated", "role", strconv.FormatUint(uint64(role.ID), 10), fmt.Sprintf("updated role %q (was %q)", role.Role, oldName))

	var userCount int64
	db.Model(&entity.AppUser{}).Where("app_role_id = ?", role.ID).Count(&userCount)
	c.JSON(http.StatusOK, buildDetailDTO(role, userCount))
}

// DELETE /roles/:id — blocked if protected (Admin/User) or if any user is
// still assigned to it. Built-in-but-not-protected roles (Operator/Auditor)
// are deletable like any custom role once unused.
func DeleteRole(c *gin.Context) {
	db := config.DB()
	id := c.Param("id")

	var role entity.AppRole
	if err := db.First(&role, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "role not found"})
		return
	}

	if isProtectedRole(role) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "the Admin and User roles are protected by the system and can never be deleted"})
		return
	}

	var userCount int64
	db.Model(&entity.AppUser{}).Where("app_role_id = ?", role.ID).Count(&userCount)
	if userCount > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("cannot delete: %d user(s) are still assigned to this role", userCount)})
		return
	}

	// Hard-delete the permission rows (Unscoped) — a soft-delete would leave
	// them occupying the (app_role_id, category) unique index, which would
	// break re-creating a role with the same name later (see replacePermissions).
	if err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Unscoped().Where("app_role_id = ?", role.ID).Delete(&entity.AppRolePermission{}).Error; err != nil {
			return err
		}
		return tx.Delete(&role).Error
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete role"})
		return
	}
	permission.InvalidateCache()

	audit.Log(c, "role.deleted", "role", strconv.FormatUint(uint64(role.ID), 10), fmt.Sprintf("deleted role %q", role.Role))

	c.JSON(http.StatusOK, gin.H{"message": "role deleted"})
}
