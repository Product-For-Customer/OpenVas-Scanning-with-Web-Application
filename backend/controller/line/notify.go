package line

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/Tawunchai/openvas/config"
	"github.com/Tawunchai/openvas/entity"
	"github.com/asaskevich/govalidator"
	"github.com/gin-gonic/gin"
)

const (
	lineRiskInputTimeout      = 2 * time.Minute
	lineRiskCooldownDuration = 2 * time.Minute
	lineMaxInvalidRiskInput  = 3
	lineMaxMessageLength     = 4300
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

type LineConversationState struct {
	NotificationID   uint
	SendID           string
	WaitingRiskLimit bool
	InvalidCount     int
	CooldownUntil    time.Time
	ExpiresAt        time.Time
	UpdatedAt        time.Time
}

var (
	lineStateMu sync.Mutex
	lineStates  = map[string]*LineConversationState{}
)

type TargetStatusLineRow struct {
	TaskName string `json:"task_name"`
	Status   string `json:"status"`
}

type TargetRiskLineRow struct {
	TaskName  string  `json:"task_name"`
	IPAddress string  `json:"ip_address"`
	RiskScore float64 `json:"risk_score"`
}

type CriticalVulnerabilityLineRow struct {
	TaskName          string  `json:"task_name"`
	IPAddress         string  `json:"ip_address"`
	VulnerabilityName string  `json:"vulnerability_name"`
	Total             int     `json:"total"`
	Severity          float64 `json:"severity"`
}

func sendLinePushMessage(channelToken string, to string, message string) error {
	message = strings.TrimSpace(message)
	if message == "" {
		return nil
	}

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

func getLineMasterDisplayName(lineMaster *entity.AppLineMaster) string {
	if lineMaster == nil {
		return "Auto Bot"
	}

	lineMasterName := strings.TrimSpace(lineMaster.Name)
	if lineMasterName == "" {
		lineMasterName = "Auto Bot"
	}

	return lineMasterName
}

func appendLineServiceFooter(message string, lineMaster *entity.AppLineMaster) string {
	message = strings.TrimSpace(message)
	lineMasterName := getLineMasterDisplayName(lineMaster)

	if message == "" {
		return fmt.Sprintf("ขอบคุณที่ใช้บริการ %s ครับผม 🙏", lineMasterName)
	}

	return fmt.Sprintf("%s\n\nขอบคุณที่ใช้บริการ %s ครับผม 🙏", message, lineMasterName)
}

func buildAppNotificationWelcomeMessage(notification entity.AppNotification, lineMaster *entity.AppLineMaster) string {
	displayName := strings.TrimSpace(notification.Name)
	if displayName == "" {
		displayName = "ผู้ใช้งาน"
	}

	lineMasterName := getLineMasterDisplayName(lineMaster)

	return fmt.Sprintf(`สวัสดี %s 👋
ผมคือ %s

ขอบคุณที่เชื่อมต่อกับระบบแจ้งเตือนอัตโนมัติผ่าน LINE

Auto Bot จะช่วยแจ้งสถานะการสแกน Target บนเครือข่าย รายงานการอัปเดตของระบบอัตโนมัติ และส่งรายงานสรุปผลการสแกนให้คุณทราบผ่าน LINE

การแจ้งเตือนที่คุณจะได้รับ ได้แก่
🔹 สถานะการเริ่มสแกน
🔹 สถานะกำลังสแกน
🔹 สถานะสแกนเสร็จสิ้น
🔹 สถานะ Automation Update
🔹 การส่งรายงานสรุปผลการสแกน

คุณสามารถส่งเลขเพื่อใช้งานคำสั่งด่วนได้ดังนี้
1️⃣ เช็คสถานะโดยรวมของ Target
2️⃣ เช็ค Target Risk Score (เรียงจากคะเเนนความเสี่ยงสูงสุดไปต่ำสุด)
3️⃣ เช็คช่องโหว่ระดับ Critical
❔ ส่ง ? เพื่อทวนคำสั่งด่วนอีกครั้ง

เมื่อมีเหตุการณ์สำคัญ ระบบจะแจ้งเตือนให้คุณทราบทันที ✅`, displayName, lineMasterName)
}

func buildLineCommandMenuMessage() string {
	return `นี่คือการทวนคำสั่งด่วนที่สามารถใช้งานได้ครับ

คุณสามารถส่งเลขเพื่อใช้งานคำสั่งด่วนได้ดังนี้
1️⃣ เช็คสถานะโดยรวมของ Target
2️⃣ เช็ค Target Risk Score (เรียงจากคะเเนนความเสี่ยงสูงสุดไปต่ำสุด)
3️⃣ เช็คช่องโหว่ระดับ Critical

หากต้องการดูคำสั่งอีกครั้ง สามารถส่ง ? ได้ครับ`
}

func getOrCreateLineState(notification entity.AppNotification) *LineConversationState {
	lineStateMu.Lock()
	defer lineStateMu.Unlock()

	key := strings.TrimSpace(notification.SendID)
	state, ok := lineStates[key]
	if !ok {
		state = &LineConversationState{
			NotificationID: notification.ID,
			SendID:         key,
			UpdatedAt:      time.Now(),
		}
		lineStates[key] = state
		return state
	}

	state.NotificationID = notification.ID
	state.SendID = key
	state.UpdatedAt = time.Now()

	return state
}

func resetLineState(sendID string) {
	lineStateMu.Lock()
	defer lineStateMu.Unlock()

	key := strings.TrimSpace(sendID)
	delete(lineStates, key)
}

func expireWaitingRiskLimitIfActive(sendID string, notificationID uint, expiresAt time.Time) bool {
	lineStateMu.Lock()
	defer lineStateMu.Unlock()

	key := strings.TrimSpace(sendID)
	state, ok := lineStates[key]
	if !ok {
		return false
	}

	if state.NotificationID != notificationID {
		return false
	}

	if !state.WaitingRiskLimit {
		return false
	}

	if state.ExpiresAt.IsZero() {
		return false
	}

	if state.ExpiresAt.UnixNano() != expiresAt.UnixNano() {
		return false
	}

	now := time.Now()
	if now.Before(state.ExpiresAt) {
		return false
	}

	state.WaitingRiskLimit = false
	state.InvalidCount = 0
	state.ExpiresAt = time.Time{}
	state.CooldownUntil = now.Add(lineRiskCooldownDuration)
	state.UpdatedAt = now

	return true
}

func startRiskLimitTimeoutTimer(notification entity.AppNotification, channelToken string, expiresAt time.Time) {
	sendID := strings.TrimSpace(notification.SendID)
	notificationID := notification.ID

	if sendID == "" || strings.TrimSpace(channelToken) == "" {
		return
	}

	waitDuration := time.Until(expiresAt)
	if waitDuration <= 0 {
		waitDuration = time.Second
	}

	go func() {
		timer := time.NewTimer(waitDuration)
		defer timer.Stop()

		<-timer.C

		shouldNotify := expireWaitingRiskLimitIfActive(sendID, notificationID, expiresAt)
		if !shouldNotify {
			return
		}

		_ = sendLinePushMessage(channelToken, sendID, buildRiskLimitTimeoutMessage())
	}()
}

func setWaitingRiskLimit(notification entity.AppNotification, channelToken string) {
	lineStateMu.Lock()

	now := time.Now()
	key := strings.TrimSpace(notification.SendID)
	expiresAt := now.Add(lineRiskInputTimeout)

	lineStates[key] = &LineConversationState{
		NotificationID:   notification.ID,
		SendID:           key,
		WaitingRiskLimit: true,
		InvalidCount:     0,
		CooldownUntil:    time.Time{},
		ExpiresAt:        expiresAt,
		UpdatedAt:        now,
	}

	lineStateMu.Unlock()

	startRiskLimitTimeoutTimer(notification, channelToken, expiresAt)
}

func addInvalidRiskInput(notification entity.AppNotification) (int, bool) {
	lineStateMu.Lock()
	defer lineStateMu.Unlock()

	now := time.Now()
	key := strings.TrimSpace(notification.SendID)

	state, ok := lineStates[key]
	if !ok {
		state = &LineConversationState{
			NotificationID:   notification.ID,
			SendID:           key,
			WaitingRiskLimit: true,
			InvalidCount:     0,
			ExpiresAt:        now.Add(lineRiskInputTimeout),
			UpdatedAt:        now,
		}
		lineStates[key] = state
	}

	state.InvalidCount++
	state.UpdatedAt = now

	if state.InvalidCount >= lineMaxInvalidRiskInput {
		state.WaitingRiskLimit = false
		state.InvalidCount = 0
		state.ExpiresAt = time.Time{}
		state.CooldownUntil = now.Add(lineRiskCooldownDuration)
		return lineMaxInvalidRiskInput, true
	}

	return state.InvalidCount, false
}

func isLineStateCoolingDown(state *LineConversationState) (bool, time.Duration) {
	if state == nil {
		return false, 0
	}

	if state.CooldownUntil.IsZero() {
		return false, 0
	}

	now := time.Now()
	if now.After(state.CooldownUntil) {
		return false, 0
	}

	return true, state.CooldownUntil.Sub(now)
}

func isRiskLimitInputExpired(state *LineConversationState) bool {
	if state == nil {
		return false
	}

	if !state.WaitingRiskLimit {
		return false
	}

	if state.ExpiresAt.IsZero() {
		return false
	}

	return time.Now().After(state.ExpiresAt)
}

func buildRiskLimitTimeoutMessage() string {
	minutes := int(lineRiskInputTimeout.Minutes())
	if minutes <= 0 {
		minutes = 1
	}

	cooldownMinutes := int(lineRiskCooldownDuration.Minutes())
	if cooldownMinutes <= 0 {
		cooldownMinutes = 1
	}

	return fmt.Sprintf(`คำขอเช็ค Target Risk Score หมดเวลาแล้วครับ

ระบบได้ยกเลิกคำขอเดิมแล้ว เนื่องจากไม่มีการระบุจำนวน Target ภายใน %d นาที

กรุณาเริ่มร้องขอใหม่อีกครั้งในอีก %d นาทีครับ`, minutes, cooldownMinutes)
}

func buildRiskInputLockedMessage() string {
	minutes := int(lineRiskCooldownDuration.Minutes())
	if minutes <= 0 {
		minutes = 1
	}

	return fmt.Sprintf(`กรอกข้อมูลไม่ถูกต้องครบ %d ครั้งแล้วครับ

ระบบได้ยกเลิกคำขอเดิมแล้ว

กรุณาเริ่มร้องขอใหม่อีกครั้งในอีก %d นาทีครับ`, lineMaxInvalidRiskInput, minutes)
}

func normalizeLineText(text string) string {
	return strings.TrimSpace(text)
}

func getLineSendIDAndSourceType(event LineWebhookEvent) (string, bool, string) {
	if strings.TrimSpace(event.Source.GroupID) != "" {
		return strings.TrimSpace(event.Source.GroupID), true, "group"
	}

	if strings.TrimSpace(event.Source.RoomID) != "" {
		return strings.TrimSpace(event.Source.RoomID), true, "room"
	}

	if strings.TrimSpace(event.Source.UserID) != "" {
		return strings.TrimSpace(event.Source.UserID), false, "user"
	}

	return "", false, ""
}

func statusTextAndEmoji(status string) (string, string) {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "done":
		return "Done", "✅"
	case "running":
		return "Running", "🟢"
	case "new":
		return "New", "🆕"
	case "stopped":
		return "Stopped", "🛑"
	default:
		return "New", "🆕"
	}
}

func buildTargetStatusMessage(lineMaster *entity.AppLineMaster) string {
	db := config.DB()

	var rows []TargetStatusLineRow

	query := `
		WITH LatestReports AS (
			SELECT DISTINCT ON (rp.task)
				rp.task AS task_id,
				rp.id AS report_id,
				rp.creation_time AS last_report_at_unix
			FROM public.reports rp
			ORDER BY rp.task, rp.creation_time DESC, rp.id DESC
		),

		TaskBase AS (
			SELECT
				t.id AS task_id,
				COALESCE(NULLIF(t.name, ''), 'Unknown Target') AS task_name,

				CASE
					WHEN lr.report_id IS NULL THEN 'New'

					WHEN LOWER(run_status_name(t.run_status)) LIKE '%run%' THEN 'Running'

					WHEN LOWER(run_status_name(t.run_status)) LIKE '%stop%' THEN 'Stopped'
					WHEN LOWER(run_status_name(t.run_status)) LIKE '%interrupt%' THEN 'Stopped'
					WHEN LOWER(run_status_name(t.run_status)) LIKE '%pause%' THEN 'Stopped'

					WHEN LOWER(run_status_name(t.run_status)) LIKE '%request%' THEN 'New'
					WHEN LOWER(run_status_name(t.run_status)) LIKE '%new%' THEN 'New'
					WHEN LOWER(run_status_name(t.run_status)) LIKE '%queued%' THEN 'New'
					WHEN LOWER(run_status_name(t.run_status)) LIKE '%requested%' THEN 'New'

					WHEN LOWER(run_status_name(t.run_status)) LIKE '%done%' THEN 'Done'
					WHEN LOWER(run_status_name(t.run_status)) LIKE '%finished%' THEN 'Done'

					ELSE 'Done'
				END AS status

			FROM public.tasks t
			LEFT JOIN LatestReports lr ON lr.task_id = t.id
		)

		SELECT
			task_name,
			status
		FROM TaskBase
		ORDER BY task_name ASC
	`

	if err := db.Raw(query).Scan(&rows).Error; err != nil {
		return fmt.Sprintf("ขออภัยครับ ไม่สามารถดึงข้อมูลสถานะ Target ได้ในขณะนี้\n\nรายละเอียด: %s", err.Error())
	}

	if len(rows) == 0 {
		return appendLineServiceFooter("ยังไม่มี Target ในระบบครับ", lineMaster)
	}

	var b strings.Builder
	b.WriteString("สถานะโดยรวมของ Target บนระบบครับ\n\n")

	for i, row := range rows {
		statusText, emoji := statusTextAndEmoji(row.Status)

		taskName := strings.TrimSpace(row.TaskName)
		if taskName == "" {
			taskName = "Unknown Target"
		}

		b.WriteString(fmt.Sprintf("%d. %s : %s %s\n", i+1, taskName, statusText, emoji))

		if b.Len() >= lineMaxMessageLength {
			b.WriteString("\nแสดงผลบางส่วนเท่านั้น เนื่องจากข้อมูลมีจำนวนมากครับ")
			break
		}
	}

	return appendLineServiceFooter(b.String(), lineMaster)
}

func countTargetRiskRows() (int, error) {
	db := config.DB()

	var total int64

	query := `
		WITH latest_report_per_host_task AS (
			SELECT DISTINCT ON (r.task, res.host)
				r.task AS task_id,
				COALESCE(NULLIF(t.name, ''), 'Unknown Target') AS task_name,
				COALESCE(NULLIF(res.host, ''), 'Unknown IP') AS ip_address,
				r.id AS report_id,
				r.creation_time
			FROM public.reports r
			INNER JOIN public.tasks t ON t.id = r.task
			INNER JOIN public.results res ON res.report = r.id
			WHERE COALESCE(res.host, '') <> ''
			ORDER BY r.task, res.host, r.creation_time DESC, r.id DESC
		)
		SELECT COUNT(*) AS total
		FROM latest_report_per_host_task
	`

	if err := db.Raw(query).Scan(&total).Error; err != nil {
		return 0, err
	}

	return int(total), nil
}

func buildAskRiskLimitMessage() string {
	total, err := countTargetRiskRows()
	if err != nil {
		return fmt.Sprintf("ขออภัยครับ ไม่สามารถตรวจสอบจำนวน Target ได้ในขณะนี้\n\nรายละเอียด: %s", err.Error())
	}

	if total == 0 {
		return "ยังไม่มีข้อมูล Target Risk Score ในระบบครับ"
	}

	minutes := int(lineRiskInputTimeout.Minutes())
	if minutes <= 0 {
		minutes = 1
	}

	return fmt.Sprintf(`ต้องการทราบ Target Risk Score กี่ Target ครับ

ปัจจุบันท่านมี Target ในระบบทั้งหมด %d Target

กรุณากรอกเป็นตัวเลข เช่น 5, 10 หรือ %d ครับ

หมายเหตุ: คำขอนี้จะหมดเวลาภายใน %d นาที หากยังไม่ระบุจำนวน Target`, total, total, minutes)
}

func buildTargetRiskScoreMessage(limit int, lineMaster *entity.AppLineMaster) string {
	db := config.DB()

	var rows []TargetRiskLineRow

	query := `
		WITH latest_report_per_host_task AS (
			SELECT DISTINCT ON (r.task, res.host)
				r.task AS task_id,
				COALESCE(NULLIF(t.name, ''), 'Unknown Target') AS task_name,
				COALESCE(NULLIF(res.host, ''), 'Unknown IP') AS ip_address,
				r.id AS report_id,
				r.creation_time
			FROM public.reports r
			INNER JOIN public.tasks t ON t.id = r.task
			INNER JOIN public.results res ON res.report = r.id
			WHERE COALESCE(res.host, '') <> ''
			ORDER BY r.task, res.host, r.creation_time DESC, r.id DESC
		),
		risk_score_rows AS (
			SELECT
				lr.task_name,
				lr.ip_address,
				COALESCE(ROUND(AVG(CASE WHEN COALESCE(res.severity, 0) > 0 THEN res.severity END)::numeric, 2), 0) AS risk_score
			FROM latest_report_per_host_task lr
			INNER JOIN public.results res
				ON res.report = lr.report_id
				AND COALESCE(res.host, '') = lr.ip_address
			WHERE COALESCE(res.severity, 0) >= 0
			GROUP BY lr.task_name, lr.ip_address
		)
		SELECT
			task_name,
			ip_address,
			risk_score
		FROM risk_score_rows
		ORDER BY risk_score DESC, task_name ASC, ip_address ASC
		LIMIT ?
	`

	if err := db.Raw(query, limit).Scan(&rows).Error; err != nil {
		return fmt.Sprintf("ขออภัยครับ ไม่สามารถดึงข้อมูล Target Risk Score ได้ในขณะนี้\n\nรายละเอียด: %s", err.Error())
	}

	if len(rows) == 0 {
		return appendLineServiceFooter("ยังไม่มีข้อมูล Target Risk Score ในระบบครับ", lineMaster)
	}

	var b strings.Builder
	b.WriteString(fmt.Sprintf("Target Risk Score จำนวน %d Target ครับ\n\n", len(rows)))

	for i, row := range rows {
		taskName := strings.TrimSpace(row.TaskName)
		if taskName == "" {
			taskName = "Unknown Target"
		}

		ip := strings.TrimSpace(row.IPAddress)
		if ip == "" {
			ip = "Unknown IP"
		}

		b.WriteString(fmt.Sprintf("%d. %s\n", i+1, taskName))
		b.WriteString(fmt.Sprintf("IP : %s\n", ip))
		b.WriteString(fmt.Sprintf("Risk Score : %.2f\n\n", row.RiskScore))

		if b.Len() >= lineMaxMessageLength {
			b.WriteString("แสดงผลบางส่วนเท่านั้น เนื่องจากข้อมูลมีจำนวนมากครับ")
			break
		}
	}

	return appendLineServiceFooter(b.String(), lineMaster)
}

func buildCriticalVulnerabilityMessage(lineMaster *entity.AppLineMaster) string {
	db := config.DB()

	var rows []CriticalVulnerabilityLineRow

	query := `
		WITH LatestReportPerHostTask AS (
			SELECT DISTINCT ON (r.host, COALESCE(t.name, ''))
				r.host AS host_ip,
				rp.id AS report_id,
				rp.task AS task_id,
				COALESCE(t.name, '') AS task_name,
				rp.creation_time
			FROM public.results r
			JOIN public.reports rp
				ON rp.id = r.report
			LEFT JOIN public.tasks t
				ON t.id = rp.task
			WHERE r.host IS NOT NULL
				AND BTRIM(r.host) <> ''
			ORDER BY
				r.host,
				COALESCE(t.name, ''),
				rp.creation_time DESC,
				rp.id DESC
		),

		CriticalVulnAgg AS (
			SELECT
				lrht.task_name,
				lrht.host_ip,
				COALESCE(NULLIF(BTRIM(n.name), ''), 'Unknown Vulnerability') AS vulnerability_name,
				MAX(COALESCE(r.severity, 0))::float8 AS severity,
				COUNT(*)::int AS total
			FROM LatestReportPerHostTask lrht
			JOIN public.results r
				ON r.report = lrht.report_id
				AND r.host = lrht.host_ip
				AND COALESCE(r.severity, 0) >= 9
			LEFT JOIN public.nvts n
				ON n.uuid = r.nvt
			GROUP BY
				lrht.task_name,
				lrht.host_ip,
				COALESCE(NULLIF(BTRIM(n.name), ''), 'Unknown Vulnerability')
		)

		SELECT
			COALESCE(NULLIF(BTRIM(task_name), ''), 'Unknown Target') AS task_name,
			COALESCE(NULLIF(BTRIM(host_ip), ''), 'Unknown IP') AS ip_address,
			COALESCE(NULLIF(BTRIM(vulnerability_name), ''), 'Unknown Vulnerability') AS vulnerability_name,
			total,
			severity
		FROM CriticalVulnAgg
		WHERE vulnerability_name <> ''
		ORDER BY
			severity DESC,
			total DESC,
			task_name ASC,
			ip_address ASC,
			vulnerability_name ASC
		LIMIT 50
	`

	if err := db.Raw(query).Scan(&rows).Error; err != nil {
		return fmt.Sprintf("ขออภัยครับ ไม่สามารถดึงข้อมูลช่องโหว่ระดับ Critical ได้ในขณะนี้\n\nรายละเอียด: %s", err.Error())
	}

	if len(rows) == 0 {
		return appendLineServiceFooter("ขณะนี้ยังไม่พบช่องโหว่ระดับ Critical ในระบบครับ ✅", lineMaster)
	}

	var b strings.Builder
	b.WriteString("ช่องโหว่ระดับ Critical ที่ตรวจพบครับ ⚠️\n\n")

	for i, row := range rows {
		taskName := strings.TrimSpace(row.TaskName)
		if taskName == "" {
			taskName = "Unknown Target"
		}

		ip := strings.TrimSpace(row.IPAddress)
		if ip == "" {
			ip = "Unknown IP"
		}

		vulnName := strings.TrimSpace(row.VulnerabilityName)
		if vulnName == "" {
			vulnName = "Unknown Vulnerability"
		}

		b.WriteString(fmt.Sprintf("%d. %s - %s\n", i+1, taskName, ip))
		b.WriteString(fmt.Sprintf("• %s\n", vulnName))
		b.WriteString(fmt.Sprintf("• Total: %d\n", row.Total))
		b.WriteString(fmt.Sprintf("• Severity: %.2f\n\n", row.Severity))

		if b.Len() >= lineMaxMessageLength {
			b.WriteString("แสดงผลบางส่วนเท่านั้น เนื่องจากข้อมูลมีจำนวนมากครับ")
			break
		}
	}

	return appendLineServiceFooter(b.String(), lineMaster)
}

func handleRiskLimitInput(notification entity.AppNotification, lineMaster *entity.AppLineMaster, text string) string {
	total, err := countTargetRiskRows()
	if err != nil {
		resetLineState(notification.SendID)
		return fmt.Sprintf("ขออภัยครับ ไม่สามารถตรวจสอบจำนวน Target ได้ในขณะนี้\n\nรายละเอียด: %s", err.Error())
	}

	if total == 0 {
		resetLineState(notification.SendID)
		return "ยังไม่มีข้อมูล Target Risk Score ในระบบครับ"
	}

	limit, err := strconv.Atoi(text)
	if err != nil {
		invalidCount, locked := addInvalidRiskInput(notification)
		if locked {
			return buildRiskInputLockedMessage()
		}

		return fmt.Sprintf(`กรุณากรอกเป็นตัวเลขอีกครั้งครับ

ตัวอย่าง: 5, 10 หรือ %d

ท่านยังสามารถกรอกใหม่ได้อีก %d ครั้ง`, total, lineMaxInvalidRiskInput-invalidCount)
	}

	if limit <= 0 {
		invalidCount, locked := addInvalidRiskInput(notification)
		if locked {
			return buildRiskInputLockedMessage()
		}

		return fmt.Sprintf(`กรุณากรอกจำนวน Target มากกว่า 0 ครับ

ปัจจุบันท่านมี Target ในระบบทั้งหมด %d Target

ท่านยังสามารถกรอกใหม่ได้อีก %d ครั้ง`, total, lineMaxInvalidRiskInput-invalidCount)
	}

	if limit > total {
		invalidCount, locked := addInvalidRiskInput(notification)
		if locked {
			return fmt.Sprintf(`กรอกข้อมูลไม่ถูกต้องครบ %d ครั้งแล้วครับ

ปัจจุบันท่านมี Target ในระบบทั้งหมด %d Target

ระบบได้ยกเลิกคำขอเดิมแล้ว

กรุณาเริ่มร้องขอใหม่อีกครั้งในอีก %d นาทีครับ`, lineMaxInvalidRiskInput, total, int(lineRiskCooldownDuration.Minutes()))
		}

		return fmt.Sprintf(`จำนวนที่กรอกเกินจำนวน Target ที่มีอยู่ครับ

ปัจจุบันท่านมี Target ในระบบทั้งหมด %d Target

กรุณากรอกตัวเลขไม่เกิน %d ครับ

ท่านยังสามารถกรอกใหม่ได้อีก %d ครั้ง`, total, total, lineMaxInvalidRiskInput-invalidCount)
	}

	resetLineState(notification.SendID)
	return buildTargetRiskScoreMessage(limit, lineMaster)
}

func handleExistingLineCommand(notification entity.AppNotification, lineMaster *entity.AppLineMaster, text string) string {
	text = normalizeLineText(text)

	state := getOrCreateLineState(notification)

	if coolingDown, remaining := isLineStateCoolingDown(state); coolingDown {
		seconds := int(remaining.Seconds())
		if seconds < 1 {
			seconds = 1
		}

		return fmt.Sprintf(`ขณะนี้ระบบพักคำขอชั่วคราวครับ

คำขอเดิมถูกยกเลิกแล้ว

กรุณาเริ่มร้องขอใหม่อีกครั้งในอีกประมาณ %d วินาที

หลังครบเวลาแล้ว กรุณาส่งเลข 2 เพื่อเริ่มคำขอ Target Risk Score ใหม่ครับ`, seconds)
	}

	if !state.CooldownUntil.IsZero() && time.Now().After(state.CooldownUntil) {
		resetLineState(notification.SendID)
		state = getOrCreateLineState(notification)
	}

	if isRiskLimitInputExpired(state) {
		resetLineState(notification.SendID)
		return buildRiskLimitTimeoutMessage()
	}

	if state.WaitingRiskLimit {
		return handleRiskLimitInput(notification, lineMaster, text)
	}

	switch text {
	case "1":
		resetLineState(notification.SendID)
		return buildTargetStatusMessage(lineMaster)

	case "2":
		total, err := countTargetRiskRows()
		if err != nil {
			resetLineState(notification.SendID)
			return fmt.Sprintf("ขออภัยครับ ไม่สามารถตรวจสอบจำนวน Target ได้ในขณะนี้\n\nรายละเอียด: %s", err.Error())
		}

		if total == 0 {
			resetLineState(notification.SendID)
			return "ยังไม่มีข้อมูล Target Risk Score ในระบบครับ"
		}

		channelToken := ""
		if lineMaster != nil {
			channelToken = lineMaster.Token
		}

		setWaitingRiskLimit(notification, channelToken)
		return buildAskRiskLimitMessage()

	case "3":
		resetLineState(notification.SendID)
		return buildCriticalVulnerabilityMessage(lineMaster)

	case "?", "？":
		resetLineState(notification.SendID)
		return buildLineCommandMenuMessage()

	default:
		resetLineState(notification.SendID)
		return ""
	}
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

	messageText := strings.TrimSpace(event.Message.Text)
	if messageText == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "message text is required",
		})
		return
	}

	sendID, isGroup, sourceType := getLineSendIDAndSourceType(event)
	if sendID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "send id not found from line source",
		})
		return
	}

	db := config.DB()

	var existingNotification entity.AppNotification
	if err := db.Preload("AppLineMaster").Where("send_id = ?", sendID).First(&existingNotification).Error; err == nil {
		lineMaster := existingNotification.AppLineMaster
		if lineMaster == nil || lineMaster.ID == 0 {
			var loadedLineMaster entity.AppLineMaster
			if err := db.First(&loadedLineMaster, existingNotification.AppLineMasterID).Error; err != nil {
				c.JSON(http.StatusNotFound, gin.H{
					"error": "AppLineMaster not found",
				})
				return
			}
			lineMaster = &loadedLineMaster
		}

		replyMessage := handleExistingLineCommand(existingNotification, lineMaster, messageText)

		if strings.TrimSpace(replyMessage) == "" {
			c.JSON(http.StatusOK, gin.H{
				"message":      "unsupported line command ignored",
				"source_type":  sourceType,
				"data":         existingNotification,
			})
			return
		}

		if err := sendLinePushMessage(lineMaster.Token, sendID, replyMessage); err != nil {
			c.JSON(http.StatusOK, gin.H{
				"message":       "command handled, but failed to send line message",
				"source_type":   sourceType,
				"line_push_err": err.Error(),
				"reply_message": replyMessage,
				"data":          existingNotification,
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message":       "line command handled successfully",
			"source_type":   sourceType,
			"reply_message": replyMessage,
			"data":          existingNotification,
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
		Name:            messageText,
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

	welcomeMessage := buildAppNotificationWelcomeMessage(notification, &lineMaster)

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
		"message":         "create app notification by line success",
		"source_type":     sourceType,
		"welcome_message": welcomeMessage,
		"data":            notification,
	})
}