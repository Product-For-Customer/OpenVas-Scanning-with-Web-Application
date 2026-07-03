package middlewares

import (
	"net/http"
	"strconv"
	"time"

	"github.com/Tawunchai/openvas/config"
	"github.com/Tawunchai/openvas/entity"
	"github.com/Tawunchai/openvas/permission"
	"github.com/Tawunchai/openvas/services"
	"github.com/gin-gonic/gin"
)

func Authorizes() gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenString, err := c.Cookie("auth_token")
		if err != nil || tokenString == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "unauthorized: missing auth cookie",
			})
			c.Abort()
			return
		}

		claims, err := services.ParseJWT(tokenString)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "unauthorized: invalid or expired token",
			})
			c.Abort()
			return
		}

		c.Set("user_id", claims.UserID)
		c.Set("user_email", claims.Email)
		c.Set("user_role", claims.Role)
		c.Set("user_role_id", claims.RoleID)

		// ── Maintenance mode check ──────────────────────────────────────────
		// Roles with user_management.manage bypass entirely (the closest
		// dynamic equivalent of "is an admin-tier role"). Everyone else is
		// blocked only after the grace period (60s) that starts when
		// maintenance mode is turned on, giving the frontend countdown modal
		// time to auto-logout gracefully.
		if !permission.Has(claims.RoleID, "user_management", true) {
			db := config.DB()
			var cfg entity.SystemConfig
			if err := db.Where("key = ?", "argus_maintenance_mode").First(&cfg).Error; err == nil && cfg.Value == "true" {
				blocked := true

				var activeCfg entity.SystemConfig
				if err := db.Where("key = ?", "argus_maintenance_active_at").First(&activeCfg).Error; err == nil {
					if activeAt, parseErr := strconv.ParseInt(activeCfg.Value, 10, 64); parseErr == nil {
						if time.Now().Unix() < activeAt {
							blocked = false // still within the grace period
						}
					}
				}

				if blocked {
					c.JSON(http.StatusServiceUnavailable, gin.H{"error": "system is under maintenance"})
					c.Abort()
					return
				}
			}
		}

		c.Next()
	}
}