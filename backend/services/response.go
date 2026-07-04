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
	RespondError(c, http.StatusInternalServerError, err)
}

// RespondError is RespondInternalError with a caller-chosen status code, for
// call sites that need to preserve an existing non-500 status (e.g. 503 when
// a downstream service like gvmd is unreachable) while still stripping the
// raw error string from the response body.
func RespondError(c *gin.Context, status int, err error) {
	log.Printf("[%d] %s %s: %v", status, c.Request.Method, c.Request.URL.Path, err)
	c.JSON(status, gin.H{"error": "internal server error"})
}
