package middlewares

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

// selfServiceOpenPaths — write endpoints the "user" role may always call.
// These act on the logged-in account only (resolved from the JWT inside the
// handler, no :id param to spoof), so no ownership check is needed.
var selfServiceOpenPaths = map[string]bool{
	"/auth/totp/init":   true, // start own TOTP setup
	"/auth/totp/verify": true, // confirm own TOTP setup
	"/auth/totp":        true, // disable own TOTP (DELETE)
}

// selfServiceOwnIDPaths — write endpoints the "user" role may call ONLY when
// the :id route param matches their own user_id (editing another account by
// ID is still blocked).
var selfServiceOwnIDPaths = map[string]bool{
	"/update-users/:id": true, // update own profile (name/avatar/password)
}

// operatorAllowedPaths — write endpoints the "operator" role may call on ANY
// resource (not just their own), scoped to GMP scan management: targets,
// tasks, credentials, port lists, the trash/recycle bin, and auto-scan
// schedules. Everything else (users, roles, settings, LINE, password policy)
// stays admin-only.
var operatorAllowedPaths = map[string]bool{
	"/gmp/targets":                         true,
	"/gmp/targets/:id":                     true,
	"/gmp/tasks":                           true,
	"/gmp/tasks/:id":                       true,
	"/gmp/tasks/:id/start":                 true,
	"/gmp/tasks/:id/stop":                  true,
	"/gmp/port-lists":                      true,
	"/gmp/port-lists/import":               true,
	"/gmp/port-lists/:id":                  true,
	"/gmp/port-lists/:id/ranges":           true,
	"/gmp/port-lists/:id/ranges/:range_id": true,
	"/gmp/credentials":                     true,
	"/gmp/credentials/:id":                 true,
	"/gmp/trash":                           true,
	"/gmp/trash/restore/:id":               true,
	"/gmp/trash/task/:id":                  true,
	"/gmp/trash/target/:id":                true,
	"/gmp/trash/credential/:id":            true,
	"/gmp/trash/portlist/:id":              true,
	"/scan-schedules":                      true,
	"/scan-schedules/:id":                  true,
}

// RestrictReadOnlyUsers enforces an explicit per-role allow-list for every
// write (non-GET) request. "admin" passes everything. "operator" additionally
// passes the GMP scan-management paths above. Every other role (including
// "user", "auditor", and any future role) only gets the small self-service
// allowlist below — anything not explicitly allowed is a 403 by default, so
// adding a new role can never silently grant unrestricted write access.
func RestrictReadOnlyUsers() gin.HandlerFunc {
	return func(c *gin.Context) {
		switch c.Request.Method {
		case http.MethodGet, http.MethodHead, http.MethodOptions:
			c.Next()
			return
		}

		role := strings.ToLower(c.GetString("user_role"))
		if role == "admin" {
			c.Next()
			return
		}

		routePath := c.FullPath()

		if role == "operator" && operatorAllowedPaths[routePath] {
			c.Next()
			return
		}

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
		}

		c.JSON(http.StatusForbidden, gin.H{
			"error": "read-only account: this action is not permitted for your role",
		})
		c.Abort()
	}
}
