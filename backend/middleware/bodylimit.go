package middlewares

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// MaxRequestBodyBytes caps incoming request bodies (JSON payloads, multipart
// file uploads) so a single request can't force the server to buffer an
// unbounded amount of data into memory. The frontend already caps file
// uploads (port lists, SSH keys, certs, profile pictures) at 5MB; this is
// the server-side backstop so a direct API call can't bypass that limit.
const MaxRequestBodyBytes = 20 << 20 // 20MB

// LimitRequestBody rejects request bodies larger than MaxRequestBodyBytes.
// http.MaxBytesReader makes the body's Read calls start failing once the
// limit is exceeded, so oversized uploads surface as a bind/read error in
// the handler instead of ever being fully read into memory.
func LimitRequestBody() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, MaxRequestBodyBytes)
		c.Next()
	}
}
