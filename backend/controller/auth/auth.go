package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha1"
	"encoding/base32"
	"encoding/binary"
	"errors"
	"fmt"
	"log"
	"math"
	"math/big"
	"net/http"
	"net/smtp"
	"strconv"
	"strings"
	"time"

	"github.com/Tawunchai/openvas/audit"
	"github.com/Tawunchai/openvas/config"
	"github.com/Tawunchai/openvas/controller/passwordpolicy"
	"github.com/Tawunchai/openvas/entity"
	"github.com/Tawunchai/openvas/permission"
	"github.com/Tawunchai/openvas/services"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ── Service-setting keys ──────────────────────────────────────────────────────

const (
	keyFA2Enabled  = "argus_2fa_enabled"
	keyOTPLogin    = "argus_otp_login"
	keyOTPRegister = "argus_otp_register"
	keyOTPReset    = "argus_otp_reset_password"
	keyTOTPEnabled = "argus_totp_enabled"
	keyMaintenance = "argus_maintenance_mode"
)

// getServiceSetting reads a key from SystemConfig; returns defaultVal when missing.
func getServiceSetting(db *gorm.DB, key, defaultVal string) string {
	var cfg entity.SystemConfig
	if err := db.Where("key = ?", key).First(&cfg).Error; err != nil {
		return defaultVal
	}
	return cfg.Value
}

// loginOTPEnabled returns true when both 2FA master toggle and login-OTP are on.
func loginOTPEnabled(db *gorm.DB) bool {
	if getServiceSetting(db, keyFA2Enabled, "false") != "true" {
		return false
	}
	// default for login OTP is "true" (matches frontend `!== "false"` default)
	return getServiceSetting(db, keyOTPLogin, "true") != "false"
}

// registerOTPEnabled reports whether OTP is required for registration.
func registerOTPEnabled(db *gorm.DB) bool {
	return getServiceSetting(db, keyFA2Enabled, "false") == "true" &&
		getServiceSetting(db, keyOTPRegister, "false") == "true"
}

// resetOTPEnabled reports whether OTP is required for password reset.
func resetOTPEnabled(db *gorm.DB) bool {
	return getServiceSetting(db, keyFA2Enabled, "false") == "true" &&
		getServiceSetting(db, keyOTPReset, "false") == "true"
}

// totpServiceEnabled returns true when both 2FA master toggle AND TOTP service are on.
func totpServiceEnabled(db *gorm.DB) bool {
	return getServiceSetting(db, keyFA2Enabled, "false") == "true" &&
		getServiceSetting(db, keyTOTPEnabled, "false") == "true"
}

// maskEmail hides most of the local part, e.g. "admin@example.com" → "a***@example.com"
func maskEmail(email string) string {
	parts := strings.SplitN(email, "@", 2)
	if len(parts) != 2 || len(parts[0]) == 0 {
		return email
	}
	local := parts[0]
	visible := string(local[0])
	return visible + "***@" + parts[1]
}

// generateOTPCode returns a random 6-digit code.
func generateOTPCode() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

// sendLoginOTPEmail delivers the OTP to the user's email address.
func sendLoginOTPEmail(db *gorm.DB, toEmail, code string) error {
	var sendMail entity.SendEmail
	if err := db.First(&sendMail).Error; err != nil {
		return fmt.Errorf("email config not found")
	}
	from := sendMail.Email
	pass := sendMail.PassApp
	subject := "Subject: Login Verification Code\r\n"
	body := fmt.Sprintf(
		"Your login verification code is: %s\r\n\r\nThis code expires in 5 minutes.\r\n",
		code,
	)
	msg := []byte(subject + "\r\n" + body)
	return smtp.SendMail(
		"smtp.gmail.com:587",
		smtp.PlainAuth("", from, pass, "smtp.gmail.com"),
		from,
		[]string{toEmail},
		msg,
	)
}

// ── login-OTP pending cookie ──────────────────────────────────────────────────

func setLoginOTPCookie(c *gin.Context, userID uint, email, code string) error {
	token, err := services.GenerateLoginOTPToken(userID, email, code)
	if err != nil {
		return err
	}
	secure := isHTTPSRequest(c)
	sameSite := http.SameSiteLaxMode
	if secure {
		sameSite = http.SameSiteNoneMode
	}
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "login_otp_pending",
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		Secure:   secure,
		SameSite: sameSite,
		MaxAge:   5 * 60,
	})
	return nil
}

func clearLoginOTPCookie(c *gin.Context) {
	secure := isHTTPSRequest(c)
	sameSite := http.SameSiteLaxMode
	if secure {
		sameSite = http.SameSiteNoneMode
	}
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "login_otp_pending",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   secure,
		SameSite: sameSite,
		MaxAge:   -1,
		Expires:  time.Unix(0, 0),
	})
}

type LoginInput struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
}

type MeResponse struct {
	ID          uint                              `json:"id"`
	Email       string                            `json:"email"`
	FirstName   string                            `json:"first_name"`
	LastName    string                            `json:"last_name"`
	Profile     string                            `json:"profile"`
	Phone       string                            `json:"phone_number"`
	Location    string                            `json:"location"`
	Position    string                            `json:"position"`
	Role        string                            `json:"role"`
	RoleID      uint                              `json:"role_id"`
	Permissions map[string]permission.CategoryPerm `json:"permissions"`
}

type SignUpInput struct {
	Email       string `json:"email" binding:"required,email"`
	Password    string `json:"password" binding:"required,min=8"`
	FirstName   string `json:"first_name" binding:"required"`
	LastName    string `json:"last_name" binding:"required"`
	PhoneNumber string `json:"phone_number" binding:"required"`
	Location    string `json:"location" binding:"required"`
	Position    string `json:"position" binding:"required"`
}

type UserResponse struct {
	ID          uint   `json:"id"`
	Email       string `json:"email"`
	FirstName   string `json:"first_name"`
	LastName    string `json:"last_name"`
	Profile     string `json:"profile"`
	PhoneNumber string `json:"phone_number"`
	Location    string `json:"location"`
	Position    string `json:"position"`
	Role        string `json:"role"`
}

func isHTTPSRequest(c *gin.Context) bool {
	// รองรับ reverse proxy / vercel / ngrok
	if c.Request.TLS != nil {
		return true
	}

	if strings.EqualFold(c.GetHeader("X-Forwarded-Proto"), "https") {
		return true
	}

	origin := c.GetHeader("Origin")
	return strings.HasPrefix(origin, "https://")
}

func setAuthCookie(c *gin.Context, token string) {
	secure := isHTTPSRequest(c)

	sameSiteMode := http.SameSiteLaxMode
	if secure {
		// ถ้า frontend กับ backend คนละ site และวิ่งผ่าน https
		// ต้องใช้ None เพื่อให้ browser ส่ง cookie ข้าม site ได้
		sameSiteMode = http.SameSiteNoneMode
	}

	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "auth_token",
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		Secure:   secure,
		SameSite: sameSiteMode,
		MaxAge:   60 * 60 * 24, // 1 day
	})
}

func clearAuthCookie(c *gin.Context) {
	secure := isHTTPSRequest(c)

	sameSiteMode := http.SameSiteLaxMode
	if secure {
		sameSiteMode = http.SameSiteNoneMode
	}

	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "auth_token",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   secure,
		SameSite: sameSiteMode,
		MaxAge:   -1,
		Expires:  time.Unix(0, 0),
	})
}

func setPendingTOTPCookie(c *gin.Context, userID uint, email string) error {
	token, err := services.GeneratePendingTOTPToken(userID, email)
	if err != nil {
		return err
	}
	secure := isHTTPSRequest(c)
	sameSiteMode := http.SameSiteLaxMode
	if secure {
		sameSiteMode = http.SameSiteNoneMode
	}
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "totp_pending",
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		Secure:   secure,
		SameSite: sameSiteMode,
		MaxAge:   5 * 60, // 5 minutes
	})
	return nil
}

func clearPendingTOTPCookie(c *gin.Context) {
	secure := isHTTPSRequest(c)
	sameSiteMode := http.SameSiteLaxMode
	if secure {
		sameSiteMode = http.SameSiteNoneMode
	}
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "totp_pending",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   secure,
		SameSite: sameSiteMode,
		MaxAge:   -1,
		Expires:  time.Unix(0, 0),
	})
}

func Login(c *gin.Context) {
	var input LoginInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	if locked, secondsRemaining := services.IsAccountLocked("login", input.Email); locked {
		c.JSON(http.StatusTooManyRequests, gin.H{
			"error":             "too many failed login attempts, please try again later",
			"seconds_remaining": secondsRemaining,
		})
		return
	}

	db := config.DB()

	var user entity.AppUser
	err := db.Preload("AppRole").
		Where("LOWER(email) = LOWER(?)", input.Email).
		First(&user).Error
	if err != nil {
		services.RecordAccountFailure("login", input.Email)
		audit.LogAs(c, 0, input.Email, "", "auth.login_failed", "user", "", "no account with this email")
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "invalid email or password",
		})
		return
	}

	if !services.CheckPasswordHash(input.Password, user.Password) {
		services.RecordAccountFailure("login", input.Email)
		audit.LogAs(c, user.ID, user.Email, "", "auth.login_failed", "user", strconv.FormatUint(uint64(user.ID), 10), "wrong password")
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "invalid email or password",
		})
		return
	}

	services.ResetAccountAttempts("login", input.Email)

	roleName := ""
	if user.AppRole != nil {
		roleName = user.AppRole.Role
	}

	// ── Maintenance mode gate (after credential check so admin can still log in) ──
	if strings.ToLower(roleName) != "admin" && getServiceSetting(db, keyMaintenance, "false") == "true" {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "system is under maintenance"})
		return
	}

	// Priority 1: user-level TOTP — only when TOTP service is globally enabled
	if totpServiceEnabled(db) && user.TOTPEnabled {
		if err := setPendingTOTPCookie(c, user.ID, user.Email); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to initiate TOTP challenge"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"require_totp": true})
		return
	}

	// Priority 2: service-level Login OTP (email verification)
	if loginOTPEnabled(db) {
		code, err := generateOTPCode()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate OTP"})
			return
		}
		// Email failure must block the login — silently falling through would bypass 2FA
		if err := sendLoginOTPEmail(db, user.Email, code); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "ไม่สามารถส่ง OTP ได้ กรุณาลองใหม่หรือติดต่อผู้ดูแลระบบ"})
			return
		}
		if err := setLoginOTPCookie(c, user.ID, user.Email, code); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to initiate email OTP"})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"require_email_otp": true,
			"masked_email":      maskEmail(user.Email),
		})
		return
	}

	token, err := services.GenerateJWT(user.ID, user.Email, roleName, user.AppRoleID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	setAuthCookie(c, token)
	audit.LogAs(c, user.ID, user.Email, roleName, "auth.login_success", "user", strconv.FormatUint(uint64(user.ID), 10), "direct login")
	c.JSON(http.StatusOK, gin.H{
		"message": "login success",
		"user": gin.H{
			"id":         user.ID,
			"email":      user.Email,
			"first_name": user.FirstName,
			"last_name":  user.LastName,
			"role":       roleName,
		},
	})
}

// VerifyEmailLoginOTPHandler — PUBLIC. Reads the login_otp_pending cookie,
// verifies the submitted code, then grants the real auth session.
func VerifyEmailLoginOTPHandler(c *gin.Context) {
	pendingToken, err := c.Cookie("login_otp_pending")
	if err != nil || pendingToken == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "OTP session expired, please log in again"})
		return
	}

	claims, err := services.ParseLoginOTPToken(pendingToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "OTP session invalid or expired"})
		return
	}

	if locked, secondsRemaining := services.IsOTPLocked(claims.Email); locked {
		c.JSON(http.StatusTooManyRequests, gin.H{
			"error":             "too many failed OTP attempts, please try again later",
			"seconds_remaining": secondsRemaining,
		})
		return
	}

	var req struct {
		Code string `json:"code" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "code is required"})
		return
	}

	if strings.TrimSpace(req.Code) != claims.OTPCode {
		services.RecordOTPFailure(claims.Email)
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid or expired OTP code"})
		return
	}

	services.ResetOTPAttempts(claims.Email)

	db := config.DB()
	var user entity.AppUser
	if err := db.Preload("AppRole").First(&user, claims.UserID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
		return
	}

	roleName := ""
	if user.AppRole != nil {
		roleName = user.AppRole.Role
	}

	token, err := services.GenerateJWT(user.ID, user.Email, roleName, user.AppRoleID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	clearLoginOTPCookie(c)
	setAuthCookie(c, token)
	audit.LogAs(c, user.ID, user.Email, roleName, "auth.login_success", "user", strconv.FormatUint(uint64(user.ID), 10), "login via email OTP")
	c.JSON(http.StatusOK, gin.H{
		"message": "login success",
		"user": gin.H{
			"id":         user.ID,
			"email":      user.Email,
			"first_name": user.FirstName,
			"last_name":  user.LastName,
			"role":       roleName,
		},
	})
}

// GetServiceSettingsHandler — PUBLIC. Returns OTP/TOTP service flags for the auth page.
func GetServiceSettingsHandler(c *gin.Context) {
	db := config.DB()
	c.JSON(http.StatusOK, gin.H{
		"login_otp":    loginOTPEnabled(db),
		"register_otp": registerOTPEnabled(db),
		"reset_otp":    resetOTPEnabled(db),
		"totp_enabled": totpServiceEnabled(db),
	})
}

// DirectSignUpHandler — PUBLIC. Creates an account WITHOUT OTP verification
// (used when admin has disabled Register OTP in service settings).
type DirectSignUpInput struct {
	Email       string `json:"email"        binding:"required,email"`
	Password    string `json:"password"     binding:"required,min=8"`
	FirstName   string `json:"first_name"   binding:"required"`
	LastName    string `json:"last_name"    binding:"required"`
	// PhoneNumber/Location/Position ไม่บังคับ — ฟอร์ม Register ไม่ได้เก็บข้อมูลนี้
	// (ผู้ใช้สามารถกรอกเพิ่มทีหลังในหน้า Profile)
	PhoneNumber string `json:"phone_number"`
	Location    string `json:"location"`
	Position    string `json:"position"`
}

func DirectSignUpHandler(c *gin.Context) {
	db := config.DB()

	// Respect the setting — if register OTP is on, reject this shortcut
	if registerOTPEnabled(db) {
		c.JSON(http.StatusForbidden, gin.H{"error": "register OTP is required"})
		return
	}

	var req DirectSignUpInput
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check duplicate email — case-insensitively, matching how Login looks
	// users up, so "Foo@x.com" is correctly treated as a duplicate of an
	// existing "foo@x.com" instead of slipping through this check only to
	// fail confusingly against the DB's own case-insensitive unique index.
	var existing entity.AppUser
	if err := db.Where("LOWER(email) = LOWER(?)", req.Email).First(&existing).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "email already exists"})
		return
	}

	// Validate password policy
	if err := passwordpolicy.ValidatePassword(db, req.Password); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	hashed, err := services.HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to hash password"})
		return
	}

	// Look up the "User" role by name rather than assuming its ID — matches
	// CreateUser's default-role lookup, so this doesn't break if role seeding
	// order ever changes.
	var defaultRole entity.AppRole
	if err := db.Where("LOWER(role) = ?", "user").First(&defaultRole).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "default user role not found"})
		return
	}

	user := entity.AppUser{
		Email:       req.Email,
		Password:    hashed,
		FirstName:   req.FirstName,
		LastName:    req.LastName,
		PhoneNumber: req.PhoneNumber,
		Location:    req.Location,
		Position:    req.Position,
		AppRoleID:   defaultRole.ID,
	}
	if err := db.Create(&user).Error; err != nil {
		// A concurrent signup for the same email between the check above and
		// this write is now caught by the DB's unique index rather than
		// silently creating a duplicate account — surface it as the same
		// friendly message instead of a generic 500.
		if strings.Contains(strings.ToLower(err.Error()), "duplicate") || strings.Contains(strings.ToLower(err.Error()), "unique") {
			c.JSON(http.StatusBadRequest, gin.H{"error": "email already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create user"})
		return
	}
	audit.LogAs(c, user.ID, user.Email, "", "auth.direct_signup", "user", strconv.FormatUint(uint64(user.ID), 10), "self-registered without OTP")
	c.JSON(http.StatusOK, gin.H{"message": "สมัครสมาชิกสำเร็จ"})
}

// DirectResetPasswordHandler — PUBLIC. Resets password WITHOUT OTP
// (used when admin has disabled Reset Password OTP in service settings).
type DirectResetPasswordInput struct {
	Email       string `json:"email"        binding:"required,email"`
	NewPassword string `json:"new_password" binding:"required,min=8"`
}

func DirectResetPasswordHandler(c *gin.Context) {
	db := config.DB()

	// Respect the setting — if reset OTP is on, reject this shortcut
	if resetOTPEnabled(db) {
		c.JSON(http.StatusForbidden, gin.H{"error": "reset OTP is required"})
		return
	}

	var req DirectResetPasswordInput
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// This endpoint resets a password knowing only the account's email — no
	// OTP/code proves the caller owns the mailbox (that's the whole point of
	// the "direct" shortcut, gated behind the reset-OTP-disabled setting
	// above). Without any other proof of ownership, a per-account cooldown is
	// the only thing standing between "know an email" and "control the
	// account" for repeat/automated attempts, so it's enforced tightly here
	// rather than just relying on the shared per-IP RateLimiter.
	if locked, secondsRemaining := services.IsAccountLocked("direct-reset-password", req.Email); locked {
		c.JSON(http.StatusTooManyRequests, gin.H{
			"error":             "too many password reset attempts for this account, please try again later",
			"seconds_remaining": secondsRemaining,
		})
		return
	}
	services.RecordAccountFailure("direct-reset-password", req.Email)

	var user entity.AppUser
	notFound := db.Where("email = ?", req.Email).First(&user).Error != nil

	if err := passwordpolicy.ValidatePassword(db, req.NewPassword); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Return 200 even when email is not found to prevent email enumeration.
	// Only perform the actual reset when the account exists.
	if !notFound {
		hashed, err := services.HashPassword(req.NewPassword)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to hash password"})
			return
		}
		if err := db.Model(&user).Update("password", hashed).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update password"})
			return
		}
		audit.LogAs(c, user.ID, user.Email, "", "auth.direct_password_reset", "user", strconv.FormatUint(uint64(user.ID), 10), "password reset without OTP")
	}
	c.JSON(http.StatusOK, gin.H{"message": "เปลี่ยนรหัสผ่านสำเร็จ"})
}

// verifyTOTPCode is an RFC 6238 ±1 window checker (mirrors the one in the totp package).
func verifyTOTPCode(secret, code string) bool {
	key, err := base32.StdEncoding.WithPadding(base32.NoPadding).DecodeString(strings.ToUpper(secret))
	if err != nil {
		return false
	}
	now := time.Now().Unix()
	buf := make([]byte, 8)
	for delta := int64(-1); delta <= 1; delta++ {
		counter := uint64((now + delta*30) / 30)
		binary.BigEndian.PutUint64(buf, counter)
		mac := hmac.New(sha1.New, key)
		mac.Write(buf)
		h := mac.Sum(nil)
		offset := h[len(h)-1] & 0x0f
		otp := int(binary.BigEndian.Uint32(h[offset:offset+4])&0x7fffffff) % int(math.Pow10(6))
		if hmac.Equal([]byte(fmt.Sprintf("%06d", otp)), []byte(strings.TrimSpace(code))) {
			return true
		}
	}
	return false
}

// VerifyTOTPLoginHandler is a PUBLIC endpoint — no auth middleware.
// It reads the totp_pending cookie, verifies the TOTP code, then issues the real auth cookie.
func VerifyTOTPLoginHandler(c *gin.Context) {
	pendingToken, err := c.Cookie("totp_pending")
	if err != nil || pendingToken == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "TOTP session expired, please log in again"})
		return
	}

	claims, err := services.ParsePendingTOTPToken(pendingToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "TOTP session invalid or expired, please log in again"})
		return
	}

	var req struct {
		Code string `json:"code" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "code is required"})
		return
	}

	db := config.DB()
	var user entity.AppUser
	if err := db.Preload("AppRole").First(&user, claims.UserID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
		return
	}

	if !user.TOTPEnabled || user.TOTPSecret == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "TOTP is not enabled for this account"})
		return
	}

	if locked, secondsRemaining := services.IsAccountLocked("totp-login", user.Email); locked {
		c.JSON(http.StatusTooManyRequests, gin.H{
			"error":             "too many failed TOTP attempts, please try again later",
			"seconds_remaining": secondsRemaining,
		})
		return
	}

	if !verifyTOTPCode(user.TOTPSecret, req.Code) {
		services.RecordAccountFailure("totp-login", user.Email)
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid or expired TOTP code"})
		return
	}
	services.ResetAccountAttempts("totp-login", user.Email)

	roleName := ""
	if user.AppRole != nil {
		roleName = user.AppRole.Role
	}

	token, err := services.GenerateJWT(user.ID, user.Email, roleName, user.AppRoleID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	clearPendingTOTPCookie(c)
	setAuthCookie(c, token)
	audit.LogAs(c, user.ID, user.Email, roleName, "auth.login_success", "user", strconv.FormatUint(uint64(user.ID), 10), "login via TOTP")

	c.JSON(http.StatusOK, gin.H{
		"message": "login success",
		"user": gin.H{
			"id":         user.ID,
			"email":      user.Email,
			"first_name": user.FirstName,
			"last_name":  user.LastName,
			"role":       roleName,
		},
	})
}

func Me(c *gin.Context) {
	userIDValue, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	userID, ok := userIDValue.(uint)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid user id in context"})
		return
	}

	db := config.DB()

	var user entity.AppUser
	err := db.Preload("AppRole").First(&user, userID).Error
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
		return
	}

	roleName := ""
	if user.AppRole != nil {
		roleName = user.AppRole.Role
	}

	response := MeResponse{
		ID:          user.ID,
		Email:       user.Email,
		FirstName:   user.FirstName,
		LastName:    user.LastName,
		Profile:     user.Profile,
		Phone:       user.PhoneNumber,
		Location:    user.Location,
		Position:    user.Position,
		Role:        roleName,
		RoleID:      user.AppRoleID,
		Permissions: permission.GetPermissions(user.AppRoleID),
	}

	c.JSON(http.StatusOK, response)
}

func Logout(c *gin.Context) {
	clearAuthCookie(c)
	c.JSON(http.StatusOK, gin.H{
		"message": "logout success",
	})
}

type CheckEmailRequest struct {
	Email string `json:"email" binding:"required,email"`
}

func CheckUserEmail(c *gin.Context) {
	var req CheckEmailRequest
	var user entity.AppUser

	// รับค่า JSON
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "กรุณากรอก email ให้ถูกต้อง",
		})
		return
	}

	db := config.DB()

	// เช็กว่ามี email นี้ในระบบไหม
	result := db.Where("email = ?", req.Email).First(&user)

	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"exists": false,
				"error":  "ไม่พบอีเมลนี้ในระบบ",
			})
			return
		}

		services.RespondInternalError(c, result.Error)
		return
	}

	// เจอ email ในระบบ
	c.JSON(http.StatusOK, gin.H{
		"exists":  true,
		"message": "พบอีเมลในระบบ",
	})
}

type VerifyOTPSignUpInput struct {
	Email       string `json:"email" binding:"required,email"`
	OTP         string `json:"otp" binding:"required,len=6"`
	Password    string `json:"password" binding:"required,min=8"`
	FirstName   string `json:"first_name" binding:"required"`
	LastName    string `json:"last_name" binding:"required"`
	// PhoneNumber/Location/Position ไม่บังคับ — ฟอร์ม Register ไม่ได้เก็บข้อมูลนี้
	// (ผู้ใช้สามารถกรอกเพิ่มทีหลังในหน้า Profile)
	PhoneNumber string `json:"phone_number"`
	Location    string `json:"location"`
	Position    string `json:"position"`
}

func mapUserResponse(u entity.AppUser) UserResponse {
	role := ""
	if u.AppRole != nil {
		role = u.AppRole.Role
	}

	return UserResponse{
		ID:          u.ID,
		Email:       u.Email,
		FirstName:   u.FirstName,
		LastName:    u.LastName,
		Profile:     u.Profile,
		PhoneNumber: u.PhoneNumber,
		Location:    u.Location,
		Position:    u.Position,
		Role:        role,
	}
}

func VerifyOTPSignUp(c *gin.Context) {
	var req VerifyOTPSignUpInput
	var otpRecord entity.OTP

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "ข้อมูลไม่ถูกต้อง",
		})
		return
	}

	if locked, secondsRemaining := services.IsOTPLocked(req.Email); locked {
		c.JSON(http.StatusTooManyRequests, gin.H{
			"error":             "พยายามยืนยัน OTP ผิดหลายครั้งเกินไป กรุณาลองใหม่ภายหลัง",
			"seconds_remaining": secondsRemaining,
		})
		return
	}

	db := config.DB()

	// 1) ตรวจสอบ email ซ้ำก่อน (case-insensitive ให้ตรงกับตอน Login)
	var existing entity.AppUser
	err := db.Where("LOWER(email) = LOWER(?)", req.Email).First(&existing).Error

	switch {
	case err == nil:
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "email already exists",
		})
		return

	case errors.Is(err, gorm.ErrRecordNotFound):
		// ไม่พบ email นี้ในระบบ = สมัครต่อได้
		// ไม่ต้อง return

	default:
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to check existing email",
		})
		return
	}

	// 2) หา OTP ตาม email และ code
	if err := db.Where("email = ? AND code = ?", req.Email, req.OTP).First(&otpRecord).Error; err != nil {
		services.RecordOTPFailure(req.Email)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "OTP ไม่ถูกต้อง",
		})
		return
	}

	// 3) ตรวจสอบว่า OTP ถูกใช้ไปแล้วหรือยัง
	if otpRecord.Verified {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "OTP นี้ถูกยืนยันไปแล้ว",
		})
		return
	}

	// 4) ตรวจสอบว่า OTP หมดอายุหรือยัง
	if time.Now().Unix() > otpRecord.ExpiresAt {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "OTP หมดอายุแล้ว",
		})
		return
	}

	// 5) ตรวจสอบรหัสผ่านตาม password policy
	if err := passwordpolicy.ValidatePassword(db, req.Password); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 6) hash password
	hashedPassword, err := services.HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to hash password",
		})
		return
	}

	// 7) เริ่ม transaction
	tx := db.Begin()
	if tx.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "ไม่สามารถเริ่ม transaction ได้",
		})
		return
	}

	// กันลืม rollback
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "เกิดข้อผิดพลาดภายในระบบ",
			})
		}
	}()

	// 8) สร้าง user หลัง OTP ถูกต้องเท่านั้น
	// ปรับ AppRoleID ตามระบบของคุณ
	user := entity.AppUser{
		Email:       req.Email,
		Password:    hashedPassword,
		FirstName:   req.FirstName,
		LastName:    req.LastName,
		PhoneNumber: req.PhoneNumber,
		Location:    req.Location,
		Position:    req.Position,
		AppRoleID:   2, // ปรับตาม role ผู้ใช้ทั่วไปในระบบของคุณ
	}

	if err := tx.Create(&user).Error; err != nil {
		tx.Rollback()
		if strings.Contains(strings.ToLower(err.Error()), "duplicate") || strings.Contains(strings.ToLower(err.Error()), "unique") {
			c.JSON(http.StatusBadRequest, gin.H{"error": "email already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "create user failed",
		})
		return
	}

	// 9) อัปเดตสถานะ OTP เป็น verified
	otpRecord.Verified = true
	if err := tx.Save(&otpRecord).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "อัปเดตสถานะ OTP ไม่สำเร็จ",
		})
		return
	}

	// 10) commit
	if err := tx.Commit().Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "บันทึกข้อมูลไม่สำเร็จ",
		})
		return
	}

	// preload role ถ้าต้องการ
	db.Preload("AppRole").First(&user, user.ID)

	services.ResetOTPAttempts(req.Email)

	c.JSON(http.StatusOK, gin.H{
		"message": "สมัครสมาชิกสำเร็จ",
		"data":    mapUserResponse(user),
	})
}

type SendOTPForSignUpRequest struct {
	Email string `json:"email" binding:"required,email"`
}

func SendOTPForSignUp(c *gin.Context) {
	var req SendOTPForSignUpRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "กรุณากรอก email ให้ถูกต้อง",
		})
		return
	}

	db := config.DB()

	n, randErr := rand.Int(rand.Reader, big.NewInt(1000000))
	if randErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "สร้าง OTP ไม่สำเร็จ"})
		return
	}
	otp := fmt.Sprintf("%06d", n.Int64())
	expires := time.Now().Add(5 * time.Minute).Unix()

	// ลบ OTP เดิมของ email นี้ก่อน
	if err := db.Where("email = ?", req.Email).Delete(&entity.OTP{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "ลบ OTP เดิมไม่สำเร็จ",
		})
		return
	}

	// สร้าง OTP ใหม่
	newOTP := entity.OTP{
		Email:     req.Email,
		Code:      otp,
		ExpiresAt: expires,
		Verified:  false,
	}

	if err := db.Create(&newOTP).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "บันทึก OTP ไม่สำเร็จ",
		})
		return
	}

	// ดึงข้อมูล email สำหรับใช้ส่ง OTP
	var sendMail entity.SendEmail
	if err := db.First(&sendMail).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "ไม่พบข้อมูลอีเมลสำหรับส่ง OTP",
		})
		return
	}

	from := sendMail.Email
	pass := sendMail.PassApp
	to := []string{req.Email}

	subject := "Subject: OTP Sign Up Verification\r\n"
	body := fmt.Sprintf(
		"เรียนผู้ใช้งาน,\r\n\r\nรหัส OTP สำหรับสมัครสมาชิกของคุณคือ: %s\r\n\r\nรหัสนี้มีอายุ 5 นาที\r\n\r\n",
		otp,
	)

	msg := []byte(subject + "\r\n" + body)

	err := smtp.SendMail(
		"smtp.gmail.com:587",
		smtp.PlainAuth("", from, pass, "smtp.gmail.com"),
		from,
		to,
		msg,
	)
	if err != nil {
		log.Printf("⚠️ SendOTPForSignUp: smtp.SendMail failed (from=%q): %v\n", from, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "ส่ง OTP ไม่สำเร็จ",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "ส่ง OTP ไปยังอีเมลแล้ว",
	})
}