package middlewares

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/Tawunchai/openvas/config"
	"github.com/Tawunchai/openvas/entity"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v4"
)

type responseRecorder struct {
	gin.ResponseWriter
	status int
}

func (r *responseRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

func (r *responseRecorder) Write(b []byte) (int, error) {
	return r.ResponseWriter.Write(b)
}

func extractUserFromJWT(c *gin.Context) (uint, string) {
	tokenStr, err := c.Cookie("auth_token")
	if err != nil || tokenStr == "" {
		return 0, "anonymous"
	}

	token, _, parseErr := new(jwt.Parser).ParseUnverified(tokenStr, jwt.MapClaims{})
	if parseErr != nil {
		return 0, "anonymous"
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return 0, "anonymous"
	}

	email, _ := claims["email"].(string)
	if email == "" {
		email, _ = claims["sub"].(string)
	}

	var uid uint
	if idVal, exists := claims["user_id"]; exists {
		switch v := idVal.(type) {
		case float64:
			uid = uint(v)
		case json.Number:
			n, _ := v.Float64()
			uid = uint(n)
		}
	}

	return uid, email
}

func actionFromMethod(method string) string {
	switch method {
	case "POST":
		return "CREATE"
	case "PUT", "PATCH":
		return "UPDATE"
	case "DELETE":
		return "DELETE"
	default:
		return "READ"
	}
}

func safeBodySnippet(c *gin.Context) string {
	if c.Request.Body == nil {
		return ""
	}
	bodyBytes, err := io.ReadAll(io.LimitReader(c.Request.Body, 512))
	if err != nil {
		return ""
	}
	c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))

	body := string(bodyBytes)
	// Redact sensitive fields
	for _, field := range []string{"password", "pass", "token", "secret", "key"} {
		body = redactField(body, field)
	}
	if len(body) > 256 {
		body = body[:256] + "..."
	}
	return body
}

func redactField(body, field string) string {
	lower := strings.ToLower(body)
	idx := strings.Index(lower, fmt.Sprintf(`"%s"`, field))
	if idx < 0 {
		return body
	}
	// Simple redaction — replace value after key with "***"
	colonIdx := strings.Index(body[idx:], ":")
	if colonIdx < 0 {
		return body
	}
	start := idx + colonIdx + 1
	end := start
	for end < len(body) && body[end] != ',' && body[end] != '}' {
		end++
	}
	if end > start {
		return body[:start] + `"***"` + body[end:]
	}
	return body
}

func resourceFromPath(path string) string {
	parts := strings.Split(strings.TrimPrefix(path, "/"), "/")
	if len(parts) > 0 {
		return parts[0]
	}
	return path
}

// AuditLogger logs all non-GET (write) requests to app_audit_logs.
func AuditLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Only log write operations
		if c.Request.Method == "GET" || c.Request.Method == "OPTIONS" {
			c.Next()
			return
		}

		start := time.Now()
		recorder := &responseRecorder{ResponseWriter: c.Writer, status: 200}
		c.Writer = recorder

		bodySnippet := safeBodySnippet(c)

		c.Next()

		uid, email := extractUserFromJWT(c)
		var uidPtr *uint
		if uid > 0 {
			uidPtr = &uid
		}

		log := entity.AppAuditLog{
			UserID:     uidPtr,
			UserEmail:  email,
			Action:     actionFromMethod(c.Request.Method),
			Resource:   resourceFromPath(c.FullPath()),
			ResourceID: c.Param("id"),
			Method:     c.Request.Method,
			Endpoint:   c.FullPath(),
			IPAddress:  c.ClientIP(),
			UserAgent:  c.Request.UserAgent(),
			StatusCode: recorder.status,
			Details:    bodySnippet,
			CreatedAt:  start,
		}

		db := config.DB()
		if db != nil {
			_ = db.Create(&log).Error
		}
	}
}
