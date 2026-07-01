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

// RestrictReadOnlyUsers enforces that the "user" role is GET-only across the
// API. Everything else (POST/PUT/PATCH/DELETE) is rejected with 403, except
// a small allowlist of self-service account actions above. The "admin" role
// is unaffected.
func RestrictReadOnlyUsers() gin.HandlerFunc {
	return func(c *gin.Context) {
		switch c.Request.Method {
		case http.MethodGet, http.MethodHead, http.MethodOptions:
			c.Next()
			return
		}

		role := strings.ToLower(c.GetString("user_role"))
		if role != "user" {
			c.Next()
			return
		}

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
		}

		c.JSON(http.StatusForbidden, gin.H{
			"error": "read-only account: this action is not permitted for your role",
		})
		c.Abort()
	}
}
