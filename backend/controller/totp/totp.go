package totp

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha1"
	"encoding/base32"
	"encoding/binary"
	"fmt"
	"math"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/Tawunchai/openvas/config"
	"github.com/Tawunchai/openvas/entity"
	"github.com/gin-gonic/gin"
)

// ── TOTP core (RFC 6238 — standard lib only) ─────────────────────────────────

func generateSecret() (string, error) {
	b := make([]byte, 20) // 160-bit key
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(b), nil
}

func computeHOTP(secret string, counter uint64) (string, error) {
	key, err := base32.StdEncoding.WithPadding(base32.NoPadding).DecodeString(
		strings.ToUpper(secret),
	)
	if err != nil {
		return "", fmt.Errorf("invalid totp secret: %w", err)
	}

	buf := make([]byte, 8)
	binary.BigEndian.PutUint64(buf, counter)

	mac := hmac.New(sha1.New, key)
	mac.Write(buf)
	h := mac.Sum(nil)

	offset := h[len(h)-1] & 0x0f
	code := int(binary.BigEndian.Uint32(h[offset:offset+4]) & 0x7fffffff)
	return fmt.Sprintf("%06d", code%int(math.Pow10(6))), nil
}

func verifyTOTPCode(secret, code string) bool {
	now := time.Now().Unix()
	// check ±1 window (30 sec each) to handle clock skew
	for delta := int64(-1); delta <= 1; delta++ {
		counter := uint64((now + delta*30) / 30)
		expected, err := computeHOTP(secret, counter)
		if err != nil {
			continue
		}
		// constant-time compare
		if hmac.Equal([]byte(expected), []byte(strings.TrimSpace(code))) {
			return true
		}
	}
	return false
}

func buildOTPAuthURI(secret, issuer, account string) string {
	return fmt.Sprintf(
		"otpauth://totp/%s:%s?secret=%s&issuer=%s&algorithm=SHA1&digits=6&period=30",
		url.PathEscape(issuer),
		url.PathEscape(account),
		url.QueryEscape(secret),
		url.QueryEscape(issuer),
	)
}

// ── helpers ───────────────────────────────────────────────────────────────────

func getUserFromCtx(c *gin.Context) (*entity.AppUser, bool) {
	raw, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return nil, false
	}
	userID, ok := raw.(uint)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid user session"})
		return nil, false
	}

	db := config.DB()
	var user entity.AppUser
	if err := db.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return nil, false
	}
	return &user, true
}

// ── Handlers ──────────────────────────────────────────────────────────────────

// GET /auth/totp/status
func GetTOTPStatus(c *gin.Context) {
	user, ok := getUserFromCtx(c)
	if !ok {
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"is_enabled":    user.TOTPEnabled,
		"is_configured": user.TOTPSecret != "",
	})
}

// POST /auth/totp/init  — generate secret + return otpauth URI
func InitTOTPSetup(c *gin.Context) {
	user, ok := getUserFromCtx(c)
	if !ok {
		return
	}

	secret, err := generateSecret()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate TOTP secret"})
		return
	}

	// Store secret tentatively (not yet enabled until verified)
	db := config.DB()
	if err := db.Model(user).Updates(map[string]any{
		"totp_secret":  secret,
		"totp_enabled": false,
	}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to store TOTP secret"})
		return
	}

	issuer := "Argus"
	otpURI := buildOTPAuthURI(secret, issuer, user.Email)

	c.JSON(http.StatusOK, gin.H{
		"secret":  secret,
		"otp_uri": otpURI,
		"issuer":  issuer,
		"account": user.Email,
	})
}

// POST /auth/totp/verify  — verify 6-digit code and enable TOTP
type VerifyRequest struct {
	Code string `json:"code" binding:"required"`
}

func VerifyTOTPSetup(c *gin.Context) {
	user, ok := getUserFromCtx(c)
	if !ok {
		return
	}

	var req VerifyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "code is required"})
		return
	}

	if user.TOTPSecret == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "TOTP not initialized, call /auth/totp/init first"})
		return
	}

	if !verifyTOTPCode(user.TOTPSecret, req.Code) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid or expired code"})
		return
	}

	db := config.DB()
	if err := db.Model(user).Update("totp_enabled", true).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to enable TOTP"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "TOTP enabled successfully"})
}

// DELETE /auth/totp  — disable TOTP and clear secret
func DisableTOTP(c *gin.Context) {
	user, ok := getUserFromCtx(c)
	if !ok {
		return
	}

	db := config.DB()
	if err := db.Model(user).Updates(map[string]any{
		"totp_secret":  "",
		"totp_enabled": false,
	}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to disable TOTP"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "TOTP disabled"})
}
