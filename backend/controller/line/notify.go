package line

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/Tawunchai/openvas/config"
	"github.com/Tawunchai/openvas/entity"
	"github.com/asaskevich/govalidator"
	"github.com/gin-gonic/gin"
)

type CreateAppNotificationInput struct {
	Name            string `json:"name" binding:"required"`
	SendID          string `json:"send_id" binding:"required"`
	Alert           bool   `json:"alert"`
	IsGroup         bool   `json:"is_group"`
	AppLineMasterID uint   `json:"app_line_master_id" binding:"required"`
}

type UpdateAppNotificationInput struct {
	Name            *string `json:"name"`
	SendID          *string `json:"send_id"`
	Alert           *bool   `json:"alert"`
	IsGroup         *bool   `json:"is_group"`
	AppLineMasterID *uint   `json:"app_line_master_id"`
}

type AppNotificationResponse struct {
	ID              uint   `json:"id"`
	Name            string `json:"name"`
	SendID          string `json:"send_id"`
	Alert           bool   `json:"alert"`
	IsGroup         bool   `json:"is_group"`
	AppLineMasterID uint   `json:"app_line_master_id"`
}

func mapAppNotificationResponse(n entity.AppNotification) AppNotificationResponse {
	return AppNotificationResponse{
		ID:              n.ID,
		Name:            n.Name,
		SendID:          n.SendID,
		Alert:           n.Alert,
		IsGroup:         n.IsGroup,
		AppLineMasterID: n.AppLineMasterID,
	}
}

func CreateAppNotification(c *gin.Context) {
	var input CreateAppNotificationInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	db := config.DB()

	var lineMaster entity.AppLineMaster
	if err := db.First(&lineMaster, input.AppLineMasterID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "app line master not found"})
		return
	}

	appNotification := entity.AppNotification{
		Name:            strings.TrimSpace(input.Name),
		SendID:          strings.TrimSpace(input.SendID),
		Alert:           input.Alert,
		IsGroup:         input.IsGroup,
		AppLineMasterID: input.AppLineMasterID,
	}

	if ok, err := govalidator.ValidateStruct(appNotification); !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := db.Create(&appNotification).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if err := db.Preload("AppLineMaster").First(&appNotification, appNotification.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "create success but failed to reload notification"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "create app notification success",
		"data":    mapAppNotificationResponse(appNotification),
	})
}

func ListAppNotification(c *gin.Context) {
	var notifications []entity.AppNotification

	db := config.DB()
	result := db.Preload("AppLineMaster").Find(&notifications)
	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": result.Error.Error()})
		return
	}

	response := make([]AppNotificationResponse, 0, len(notifications))
	for _, n := range notifications {
		response = append(response, mapAppNotificationResponse(n))
	}

	c.JSON(http.StatusOK, response)
}

func UpdateAppNotificationByID(c *gin.Context) {
	id := c.Param("id")

	nid, err := strconv.ParseUint(id, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid app notification id"})
		return
	}

	var input UpdateAppNotificationInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	db := config.DB()

	var appNotification entity.AppNotification
	if err := db.First(&appNotification, uint(nid)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "app notification not found"})
		return
	}

	if input.Name == nil &&
		input.SendID == nil &&
		input.Alert == nil &&
		input.IsGroup == nil &&
		input.AppLineMasterID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no fields to update"})
		return
	}

	updatedNotification := appNotification

	if input.Name != nil {
		updatedNotification.Name = strings.TrimSpace(*input.Name)
	}

	if input.SendID != nil {
		updatedNotification.SendID = strings.TrimSpace(*input.SendID)
	}

	if input.Alert != nil {
		updatedNotification.Alert = *input.Alert
	}

	if input.IsGroup != nil {
		updatedNotification.IsGroup = *input.IsGroup
	}

	if input.AppLineMasterID != nil {
		var lineMaster entity.AppLineMaster
		if err := db.First(&lineMaster, *input.AppLineMasterID).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "app line master not found"})
			return
		}
		updatedNotification.AppLineMasterID = *input.AppLineMasterID
	}

	if ok, err := govalidator.ValidateStruct(updatedNotification); !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{}

	if input.Name != nil {
		updates["name"] = updatedNotification.Name
	}

	if input.SendID != nil {
		updates["send_id"] = updatedNotification.SendID
	}

	if input.Alert != nil {
		updates["alert"] = updatedNotification.Alert
	}

	if input.IsGroup != nil {
		updates["is_group"] = updatedNotification.IsGroup
	}

	if input.AppLineMasterID != nil {
		updates["app_line_master_id"] = updatedNotification.AppLineMasterID
	}

	if err := db.Model(&appNotification).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if err := db.Preload("AppLineMaster").First(&appNotification, appNotification.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "update app notification success",
		"data":    mapAppNotificationResponse(appNotification),
	})
}

func DeleteAppNotificationByID(c *gin.Context) {
	id := c.Param("id")

	nid, err := strconv.ParseUint(id, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid app notification id"})
		return
	}

	db := config.DB()

	var appNotification entity.AppNotification
	if err := db.First(&appNotification, uint(nid)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "app notification not found"})
		return
	}

	if err := db.Delete(&appNotification).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "app notification deleted successfully"})
}

type LineWebhookRequest struct {
	Destination string             `json:"destination"`
	Events      []LineWebhookEvent `json:"events"`
}

type LineWebhookEvent struct {
	Type       string             `json:"type"`
	Message    LineWebhookMessage `json:"message"`
	Source     LineWebhookSource  `json:"source"`
	Timestamp  int64              `json:"timestamp"`
	Mode       string             `json:"mode"`
	ReplyToken string             `json:"replyToken"`
}

type LineWebhookMessage struct {
	Type string `json:"type"`
	ID   string `json:"id"`
	Text string `json:"text"`
}

type LineWebhookSource struct {
	Type    string `json:"type"`
	UserID  string `json:"userId"`
	GroupID string `json:"groupId"`
	RoomID  string `json:"roomId"`
}

type LinePushRequest struct {
	To       string            `json:"to"`
	Messages []LinePushMessage `json:"messages"`
}

type LinePushMessage struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

func sendLinePushMessage(channelToken string, to string, message string) error {
	payload := LinePushRequest{
		To: to,
		Messages: []LinePushMessage{
			{
				Type: "text",
				Text: message,
			},
		},
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", "https://api.line.me/v2/bot/message/push", bytes.NewBuffer(jsonData))
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+channelToken)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("line push failed: status=%d, body=%s", resp.StatusCode, string(body))
	}

	return nil
}

func CreateAppNotificationByLine(c *gin.Context) {
	var input LineWebhookRequest
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	if len(input.Events) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "no events found",
		})
		return
	}

	event := input.Events[0]

	if strings.TrimSpace(event.Type) != "message" {
		c.JSON(http.StatusOK, gin.H{
			"message": "event is not message, skipped",
		})
		return
	}

	if strings.TrimSpace(event.Message.Type) != "text" {
		c.JSON(http.StatusOK, gin.H{
			"message": "message is not text, skipped",
		})
		return
	}

	name := strings.TrimSpace(event.Message.Text)
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "message text is required",
		})
		return
	}

	sendID := ""
	isGroup := false
	sourceType := ""

	if event.Source.GroupID != "" {
		sendID = event.Source.GroupID
		isGroup = true
		sourceType = "group"
	} else if event.Source.RoomID != "" {
		sendID = event.Source.RoomID
		isGroup = true
		sourceType = "room"
	} else if event.Source.UserID != "" {
		sendID = event.Source.UserID
		isGroup = false
		sourceType = "user"
	} else {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "send id not found from line source",
		})
		return
	}

	db := config.DB()

	var existingNotification entity.AppNotification
	if err := db.Preload("AppLineMaster").Where("send_id = ?", sendID).First(&existingNotification).Error; err == nil {
		c.JSON(http.StatusOK, gin.H{
			"message":     "send_id already exists, old source",
			"source_type": sourceType,
			"data":        existingNotification,
		})
		return
	}

	var lineMaster entity.AppLineMaster
	if err := db.Order("id asc").First(&lineMaster).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "AppLineMaster not found",
		})
		return
	}

	notification := entity.AppNotification{
		Name:            name,
		SendID:          sendID,
		Alert:           true,
		IsGroup:         isGroup,
		AppLineMasterID: lineMaster.ID,
	}

	if ok, err := govalidator.ValidateStruct(notification); !ok {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	if err := db.Create(&notification).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	if err := db.Preload("AppLineMaster").First(&notification, notification.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "create success but failed to reload notification",
		})
		return
	}

	welcomeMessage := "Welcome to Network Alerts"
	if err := sendLinePushMessage(lineMaster.Token, sendID, welcomeMessage); err != nil {
		c.JSON(http.StatusCreated, gin.H{
			"message":       "create app notification success, but failed to send welcome message",
			"source_type":   sourceType,
			"line_push_err": err.Error(),
			"data":          notification,
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":     "create app notification by line success",
		"source_type": sourceType,
		"data":        notification,
	})
}