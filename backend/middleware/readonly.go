package middlewares

import (
	"log"
	"net/http"
	"strconv"

	"github.com/Tawunchai/openvas/permission"
	"github.com/gin-gonic/gin"
)

// selfServiceOpenPaths — endpoints any authenticated role may always call,
// regardless of their permission matrix. These act on the logged-in
// account only (resolved from the JWT inside the handler, no :id param to
// spoof), so no category/ownership check is needed.
var selfServiceOpenPaths = map[string]bool{
	"/auth/me":             true, // session bootstrap — every authenticated user needs this
	"/auth/totp/status":    true, // read own TOTP status
	"/auth/totp/init":      true, // start own TOTP setup
	"/auth/totp/verify":    true, // confirm own TOTP setup
	"/auth/totp":           true, // disable own TOTP (DELETE)
	"/email-phone-numbers": true, // any authenticated user's own Account page needs this for its duplicate email/phone check
}

// selfServiceOwnIDPaths — write endpoints any role may call ONLY when the
// :id route param matches their own user_id (editing another account by ID
// is still gated by the user_management category).
var selfServiceOwnIDPaths = map[string]bool{
	"/update-users/:id": true, // update own profile (name/avatar/password)
}

// EnforcePermissions replaces the old hardcoded-role allowlist with a
// dynamic per-role permission matrix (see backend/permission). Self-service
// paths above are exempt for every role. Everything else is looked up via
// permission.RouteCategory: GET/HEAD/OPTIONS need CanView on that category,
// any other method needs CanManage. A route not present in RouteCategory is
// a default-deny (logged loudly — it means a new endpoint was added without
// being categorized, not a legitimate access decision).
func EnforcePermissions() gin.HandlerFunc {
	return func(c *gin.Context) {
		routePath := c.FullPath()

		if selfServiceOpenPaths[routePath] {
			c.Next()
			return
		}

		if selfServiceOwnIDPaths[routePath] {
			ownID := strconv.FormatUint(uint64(c.GetUint("user_id")), 10)
			if c.Param("id") == ownID {
				c.Next()
				return
			}
			// Not own ID — falls through to the normal category check below,
			// so an admin-like role can still manage other users' accounts.
		}

		category, ok := permission.RouteCategory[routePath]
		if !ok {
			log.Printf("⚠️ permission: route %q has no category mapping — defaulting to deny", routePath)
			c.JSON(http.StatusForbidden, gin.H{"error": "this action is not permitted for your role"})
			c.Abort()
			return
		}

		needManage := true
		switch c.Request.Method {
		case http.MethodGet, http.MethodHead, http.MethodOptions:
			needManage = false
		}

		roleID := c.GetUint("user_role_id")
		if !permission.Has(roleID, category, needManage) {
			c.JSON(http.StatusForbidden, gin.H{"error": "this action is not permitted for your role"})
			c.Abort()
			return
		}

		c.Next()
	}
}
