// Package permission resolves what an AppRole is allowed to View/Manage per
// category. Lives outside backend/services deliberately, same reasoning as
// backend/audit: backend/config already imports backend/services, so this
// package importing config back is fine as long as config never imports
// permission — only middleware and controllers do.
package permission

import (
	"sync"
	"time"

	"github.com/Tawunchai/openvas/config"
	"github.com/Tawunchai/openvas/entity"
)

type CategoryPerm struct {
	View   bool `json:"view"`
	Manage bool `json:"manage"`
}

const cacheTTL = 10 * time.Second

var (
	cacheMu  sync.RWMutex
	cache    = map[uint]map[string]CategoryPerm{}
	cachedAt = map[uint]time.Time{}
)

// InvalidateCache drops all cached permission lookups. Call this after any
// write to AppRole/AppRolePermission (role create/update/delete).
func InvalidateCache() {
	cacheMu.Lock()
	defer cacheMu.Unlock()
	cache = map[uint]map[string]CategoryPerm{}
	cachedAt = map[uint]time.Time{}
}

// GetPermissions returns the full category->{view,manage} map for a role,
// cached briefly since it's looked up on every authenticated request.
func GetPermissions(roleID uint) map[string]CategoryPerm {
	cacheMu.RLock()
	if perms, ok := cache[roleID]; ok && time.Since(cachedAt[roleID]) < cacheTTL {
		cacheMu.RUnlock()
		return perms
	}
	cacheMu.RUnlock()

	perms := map[string]CategoryPerm{}
	var rows []entity.AppRolePermission
	config.DB().Where("app_role_id = ?", roleID).Find(&rows)
	for _, r := range rows {
		perms[r.Category] = CategoryPerm{View: r.CanView, Manage: r.CanManage}
	}

	cacheMu.Lock()
	cache[roleID] = perms
	cachedAt[roleID] = time.Now()
	cacheMu.Unlock()

	return perms
}

// Has reports whether roleID can View (needManage=false) or Manage
// (needManage=true) the given category.
func Has(roleID uint, category string, needManage bool) bool {
	p, ok := GetPermissions(roleID)[category]
	if !ok {
		return false
	}
	if needManage {
		return p.Manage
	}
	return p.View
}
