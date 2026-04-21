package otp

import (
	"fmt"
	"math/rand"
	"net/http"
	"net/smtp"
	"strconv"
	"strings"
	"time"

	"github.com/Tawunchai/openvas/config"
	"github.com/Tawunchai/openvas/entity"
	"github.com/gin-gonic/gin"
)

type SendOTPRequest struct {
	Email string `json:"email" binding:"required,email"`
}

func SendOTP(c *gin.Context) {
	var req SendOTPRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กรุณากรอก email ให้ถูกต้อง"})
		return
	}

	db := config.DB()

	// ✅ เช็กก่อนว่ามี email นี้ในระบบไหม
	var user entity.AppUser
	if err := db.Where("email = ?", req.Email).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบอีเมลนี้ในระบบ"})
		return
	}

	otp := fmt.Sprintf("%06d", rand.Intn(1000000))
	expires := time.Now().Add(5 * time.Minute).Unix()

	// ลบ OTP เดิมก่อน
	db.Where("email = ?", req.Email).Delete(&entity.OTP{})

	// สร้าง OTP ใหม่
	if err := db.Create(&entity.OTP{
		Email:     req.Email,
		Code:      otp,
		ExpiresAt: expires,
		Verified:  false,
	}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "บันทึก OTP ไม่สำเร็จ"})
		return
	}

	// ดึงข้อมูล email สำหรับส่ง
	var sendMail entity.SendEmail
	if err := db.First(&sendMail).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่พบข้อมูลอีเมลสำหรับส่ง OTP"})
		return
	}

	from := sendMail.Email
	pass := sendMail.PassApp
	to := []string{req.Email}

	subject := "Subject: OTP Reset Password\r\n"
	body := fmt.Sprintf(
		"เรียนผู้ใช้งาน,\r\n\r\nรหัส OTP ของคุณคือ: %s\r\n\r\nรหัสนี้มีอายุ 5 นาที\r\n\r\n",
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ส่ง OTP ไม่สำเร็จ"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "ส่ง OTP ไปยังอีเมลแล้ว"})
}

type VerifyOTPRequest struct {
	Email       string `json:"email" binding:"required,email"`
	OTP         string `json:"otp" binding:"required,len=6"`
	NewPassword string `json:"new_password" binding:"required,min=8"`
}

func VerifyOTPAddUpdatePassword(c *gin.Context) {
	var req VerifyOTPRequest
	var otp entity.OTP
	var user entity.AppUser

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ข้อมูลไม่ถูกต้อง"})
		return
	}

	db := config.DB()

	// หา OTP
	if err := db.Where("email = ? AND code = ?", req.Email, req.OTP).First(&otp).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "OTP ไม่ถูกต้อง"})
		return
	}

	if otp.Verified {
		c.JSON(http.StatusBadRequest, gin.H{"error": "OTP นี้ถูกยืนยันไปแล้ว"})
		return
	}

	if time.Now().Unix() > otp.ExpiresAt {
		c.JSON(http.StatusBadRequest, gin.H{"error": "OTP หมดอายุแล้ว"})
		return
	}

	// หา user จาก email
	if err := db.Where("email = ?", req.Email).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบบัญชีผู้ใช้นี้ในระบบ"})
		return
	}

	// hash password ใหม่
	hashedPassword, err := config.HashPassword(req.NewPassword)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถเข้ารหัสรหัสผ่านได้"})
		return
	}

	// transaction กันข้อมูลครึ่ง ๆ กลาง ๆ
	tx := db.Begin()
	if tx.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถเริ่ม transaction ได้"})
		return
	}

	// mark otp verified
	otp.Verified = true
	if err := tx.Save(&otp).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "อัปเดตสถานะ OTP ไม่สำเร็จ"})
		return
	}

	// update password
	user.Password = hashedPassword
	if err := tx.Save(&user).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "อัปเดตรหัสผ่านไม่สำเร็จ"})
		return
	}

	// ลบ OTP ของ email นี้ทั้งหมดทิ้งหลังใช้งานสำเร็จ
	if err := tx.Where("email = ?", req.Email).Delete(&entity.OTP{}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ล้าง OTP ไม่สำเร็จ"})
		return
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "บันทึกข้อมูลไม่สำเร็จ"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "ยืนยัน OTP และเปลี่ยนรหัสผ่านสำเร็จ",
	})
}

type SendEmailResponse struct {
	ID      uint   `json:"id"`
	Email   string `json:"email"`
	PassApp string `json:"pass_app"`
}

type UpdateSendEmailInput struct {
	Email   string `json:"email"`
	PassApp string `json:"pass_app"`
}

func mapSendEmailResponse(s entity.SendEmail) SendEmailResponse {
	return SendEmailResponse{
		ID:      s.ID,
		Email:   s.Email,
		PassApp: s.PassApp,
	}
}

// GET /send-emails
func ListSendEmail(c *gin.Context) {
	var sendEmails []entity.SendEmail

	db := config.DB()
	results := db.Find(&sendEmails)

	if results.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": results.Error.Error(),
		})
		return
	}

	response := make([]SendEmailResponse, 0, len(sendEmails))
	for _, item := range sendEmails {
		response = append(response, mapSendEmailResponse(item))
	}

	c.JSON(http.StatusOK, response)
}

// PUT /send-email/:id
func UpdateSendEmailByID(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.Atoi(idParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid id",
		})
		return
	}

	var input UpdateSendEmailInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	db := config.DB()

	var sendEmail entity.SendEmail
	if err := db.First(&sendEmail, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "send email record not found",
		})
		return
	}

	updateData := map[string]interface{}{}

	if strings.TrimSpace(input.Email) != "" {
		updateData["email"] = input.Email
	}
	if strings.TrimSpace(input.PassApp) != "" {
		updateData["pass_app"] = input.PassApp
	}

	if len(updateData) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "no data to update",
		})
		return
	}

	if err := db.Model(&sendEmail).Updates(updateData).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to update send email",
		})
		return
	}

	if err := db.First(&sendEmail, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to fetch updated send email",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "update send email successfully",
		"data":    mapSendEmailResponse(sendEmail),
	})
}