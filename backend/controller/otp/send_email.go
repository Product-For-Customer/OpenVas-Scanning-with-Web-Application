package otp

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/Tawunchai/openvas/config"
	"github.com/Tawunchai/openvas/entity"
	"github.com/gin-gonic/gin"
)

type SendEmailResponse struct {
	ID         uint   `json:"id"`
	Email      string `json:"email"`
	HasPassApp bool   `json:"has_pass_app"`
	AppUserID  uint   `json:"app_user_id"`
}

type UpdateSendEmailInput struct {
	Email   string `json:"email"`
	PassApp string `json:"pass_app"`
}

// mapSendEmailResponse deliberately never includes the raw Gmail App Password —
// it used to (`PassApp` field), meaning any user_management-permitted session
// received this real SMTP credential in plaintext just by loading the Service
// settings page, whether or not they ever clicked "show password". Callers
// that need to let an admin change it use UpdateSendEmailByID, which already
// supports "leave blank to keep the current one" (see its PassApp check below).
func mapSendEmailResponse(s entity.SendEmail) SendEmailResponse {
	return SendEmailResponse{
		ID:         s.ID,
		Email:      s.Email,
		HasPassApp: strings.TrimSpace(s.PassApp) != "",
		AppUserID:  s.AppUserID,
	}
}

func getLoginAppUserID(c *gin.Context) (uint, bool) {
	userIDValue, exists := c.Get("user_id")
	if !exists {
		return 0, false
	}

	switch v := userIDValue.(type) {
	case uint:
		if v == 0 {
			return 0, false
		}
		return v, true

	case int:
		if v <= 0 {
			return 0, false
		}
		return uint(v), true

	case float64:
		if v <= 0 {
			return 0, false
		}
		return uint(v), true

	default:
		return 0, false
	}
}

// GET /send-emails
func ListSendEmail(c *gin.Context) {
	var sendEmails []entity.SendEmail

	db := config.DB()

	results := db.Preload("AppUser").Find(&sendEmails)
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
	loginAppUserID, ok := getLoginAppUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "unauthorized: user not found in context",
		})
		return
	}

	idParam := c.Param("id")

	id, err := strconv.Atoi(idParam)
	if err != nil || id <= 0 {
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

	var appUser entity.AppUser
	if err := db.First(&appUser, loginAppUserID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "login app user not found",
		})
		return
	}

	updateData := map[string]interface{}{}

	if strings.TrimSpace(input.Email) != "" {
		updateData["email"] = strings.TrimSpace(input.Email)
	}

	if strings.TrimSpace(input.PassApp) != "" {
		updateData["pass_app"] = strings.TrimSpace(input.PassApp)
	}

	updateData["app_user_id"] = loginAppUserID

	if len(updateData) == 1 {
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

	if err := db.Preload("AppUser").First(&sendEmail, id).Error; err != nil {
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
