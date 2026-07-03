package services

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

// RespondInternalError logs the real error server-side (method, path, full
// error) and returns a generic message to the caller, so internal details —
// SQL fragments, connection strings, stack traces — never reach the client.
func RespondInternalError(c *gin.Context, err error) {
	log.Printf("[500] %s %s: %v", c.Request.Method, c.Request.URL.Path, err)
	c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
}
