package auth

import (
	"errors"
	"fmt"
	"math/rand"
	"net/http"
	"net/smtp"
	"strings"
	"time"

	"github.com/Tawunchai/openvas/config"
	"github.com/Tawunchai/openvas/dto"
	"github.com/Tawunchai/openvas/entity"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

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

func Login(c *gin.Context) {
	var input dto.LoginInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	db := config.DB()

	var user entity.AppUser
	err := db.Preload("AppRole").
		Where("LOWER(email) = LOWER(?)", input.Email).
		First(&user).Error
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "invalid email or password",
		})
		return
	}

	if !config.CheckPasswordHash(input.Password, user.Password) {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "invalid email or password",
		})
		return
	}

	roleName := ""
	if user.AppRole != nil {
		roleName = user.AppRole.Role
	}

	token, err := config.GenerateJWT(user.ID, user.Email, roleName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to generate token",
		})
		return
	}

	setAuthCookie(c, token)

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

	response := dto.MeResponse{
		ID:        user.ID,
		Email:     user.Email,
		FirstName: user.FirstName,
		LastName:  user.LastName,
		Profile:   user.Profile,
		Phone:     user.PhoneNumber,
		Location:  user.Location,
		Position:  user.Position,
		Role:      roleName,
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

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": result.Error.Error(),
		})
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
	PhoneNumber string `json:"phone_number" binding:"required"`
	Location    string `json:"location" binding:"required"`
	Position    string `json:"position" binding:"required"`
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

	db := config.DB()

	// 1) ตรวจสอบ email ซ้ำก่อน
	var existing entity.AppUser
	err := db.Where("email = ?", req.Email).First(&existing).Error
	if err == nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "email already exists",
		})
		return
	}
	if err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "failed to check existing email",
			})
			return
		}
	}

	// 2) หา OTP ตาม email และ code
	if err := db.Where("email = ? AND code = ?", req.Email, req.OTP).First(&otpRecord).Error; err != nil {
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

	// 5) hash password
	hashedPassword, err := config.HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to hash password",
		})
		return
	}

	// 6) เริ่ม transaction
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

	// 7) สร้าง user หลัง OTP ถูกต้องเท่านั้น
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
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "create user failed",
		})
		return
	}

	// 8) อัปเดตสถานะ OTP เป็น verified
	otpRecord.Verified = true
	if err := tx.Save(&otpRecord).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "อัปเดตสถานะ OTP ไม่สำเร็จ",
		})
		return
	}

	// 9) commit
	if err := tx.Commit().Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "บันทึกข้อมูลไม่สำเร็จ",
		})
		return
	}

	// preload role ถ้าต้องการ
	db.Preload("AppRole").First(&user, user.ID)

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

	rand.Seed(time.Now().UnixNano())
	otp := fmt.Sprintf("%06d", rand.Intn(1000000))
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
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "ส่ง OTP ไม่สำเร็จ",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "ส่ง OTP ไปยังอีเมลแล้ว",
	})
}