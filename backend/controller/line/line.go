package line

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/Tawunchai/openvas/config"
	"github.com/Tawunchai/openvas/entity"
	"github.com/Tawunchai/openvas/manage"
	"github.com/asaskevich/govalidator"
	_ "github.com/lib/pq"
	"github.com/lib/pq"
	"gorm.io/gorm"
)

// =====================================================
// ENV Helpers
// =====================================================

func getPGConnString() string {
	dsn := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if dsn != "" {
		return dsn
	}

	return "host=pg-gvm port=5432 user=pbi password=Pbi12345 dbname=gvmd sslmode=disable"
}

// =====================================================
// LINE Status Manage Limit Helpers
// =====================================================

type LineStatusManageLimitTaskIDDTO struct {
	TaskID string `gorm:"column:task_id"`
}

func normalizeLineStatusTaskIDForManageLimit(taskID string) string {
	taskID = strings.TrimSpace(taskID)

	if taskID == "" {
		return ""
	}

	taskIDNumber, err := strconv.ParseInt(taskID, 10, 64)
	if err == nil {
		return strconv.FormatInt(taskIDNumber, 10)
	}

	taskIDFloat, floatErr := strconv.ParseFloat(taskID, 64)
	if floatErr == nil {
		taskIDInt := int64(taskIDFloat)
		if taskIDFloat == float64(taskIDInt) {
			return strconv.FormatInt(taskIDInt, 10)
		}
	}

	return taskID
}

func compareLineStatusTaskIDForManageLimit(a string, b string) int {
	a = normalizeLineStatusTaskIDForManageLimit(a)
	b = normalizeLineStatusTaskIDForManageLimit(b)

	if a == "" && b == "" {
		return 0
	}

	if a == "" {
		return 1
	}

	if b == "" {
		return -1
	}

	aNumber, aErr := strconv.ParseInt(a, 10, 64)
	bNumber, bErr := strconv.ParseInt(b, 10, 64)

	if aErr == nil && bErr == nil {
		if aNumber < bNumber {
			return -1
		}

		if aNumber > bNumber {
			return 1
		}

		return 0
	}

	return strings.Compare(a, b)
}

// FindLineStatusManageLimitTaskIDs
//
// ใช้หา task_id กลุ่มแรกตามค่า TargetLimit ใน manage.go
//
// ตัวอย่าง:
// manage.TargetLimit = 5
// public.tasks มี task_id = 2, 3, 4, 5, 6, 7
// function นี้จะคืนค่า = 2, 3, 4, 5, 6
func FindLineStatusManageLimitTaskIDs(db *gorm.DB) ([]string, error) {
	targetLimit := manage.GetTargetLimit()

	if targetLimit <= 0 {
		return make([]string, 0), nil
	}

	query := `
SELECT
  t.id::text AS task_id
FROM public.tasks t
WHERE t.id IS NOT NULL
ORDER BY
  t.id ASC
LIMIT ?;
`

	rows := make([]LineStatusManageLimitTaskIDDTO, 0)

	if err := db.Raw(query, targetLimit).Scan(&rows).Error; err != nil {
		return nil, err
	}

	taskIDs := make([]string, 0, len(rows))
	seen := make(map[string]bool)

	for _, row := range rows {
		taskID := normalizeLineStatusTaskIDForManageLimit(row.TaskID)

		if taskID == "" {
			continue
		}

		if seen[taskID] {
			continue
		}

		seen[taskID] = true
		taskIDs = append(taskIDs, taskID)
	}

	sort.SliceStable(taskIDs, func(i int, j int) bool {
		return compareLineStatusTaskIDForManageLimit(taskIDs[i], taskIDs[j]) < 0
	})

	return taskIDs, nil
}

func BuildLineStatusManageLimitTaskIDSet(db *gorm.DB) (map[string]bool, error) {
	taskIDs, err := FindLineStatusManageLimitTaskIDs(db)
	if err != nil {
		return nil, err
	}

	allowedTaskIDs := make(map[string]bool)

	for _, taskID := range taskIDs {
		cleanTaskID := normalizeLineStatusTaskIDForManageLimit(taskID)

		if cleanTaskID == "" {
			continue
		}

		allowedTaskIDs[cleanTaskID] = true
	}

	return allowedTaskIDs, nil
}

func extractTaskIDFromScanNotifyPayload(rawPayload string) string {
	var data map[string]interface{}
	if err := json.Unmarshal([]byte(rawPayload), &data); err != nil {
		return ""
	}

	value, ok := data["task_id"]
	if !ok || value == nil {
		return ""
	}

	switch v := value.(type) {
	case string:
		return normalizeLineStatusTaskIDForManageLimit(v)
	case float64:
		taskIDInt := int64(v)
		if v == float64(taskIDInt) {
			return normalizeLineStatusTaskIDForManageLimit(strconv.FormatInt(taskIDInt, 10))
		}
		return normalizeLineStatusTaskIDForManageLimit(fmt.Sprintf("%v", v))
	case int:
		return normalizeLineStatusTaskIDForManageLimit(strconv.Itoa(v))
	case int64:
		return normalizeLineStatusTaskIDForManageLimit(strconv.FormatInt(v, 10))
	case json.Number:
		return normalizeLineStatusTaskIDForManageLimit(v.String())
	default:
		return normalizeLineStatusTaskIDForManageLimit(fmt.Sprintf("%v", v))
	}
}

func isScanNotifyTaskIDInLineStatusManageLimit(rawPayload string) (bool, string, error) {
	db := config.DB()
	if db == nil {
		return false, "", fmt.Errorf("database connection is nil")
	}

	taskID := extractTaskIDFromScanNotifyPayload(rawPayload)
	if taskID == "" {
		return false, "", nil
	}

	allowedTaskIDs, err := BuildLineStatusManageLimitTaskIDSet(db)
	if err != nil {
		return false, taskID, err
	}

	return allowedTaskIDs[taskID], taskID, nil
}

// =====================================================
// LINE Push API
// =====================================================

type lineTextMessage struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

type linePushRequest struct {
	To       string            `json:"to"`
	Messages []lineTextMessage `json:"messages"`
}

func sendLinePushTo(channelToken string, to string, message string) error {
	if strings.TrimSpace(channelToken) == "" {
		return fmt.Errorf("LINE token is empty")
	}
	if strings.TrimSpace(to) == "" {
		return fmt.Errorf("LINE destination is empty")
	}

	url := "https://api.line.me/v2/bot/message/push"

	payload := linePushRequest{
		To: to,
		Messages: []lineTextMessage{
			{
				Type: "text",
				Text: message,
			},
		},
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("line marshal error: %w", err)
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("line request create error: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+channelToken)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("line send error: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("line send failed: status=%s response=%s", resp.Status, string(body))
	}

	log.Println("✅ LINE Sent:", resp.Status, "To:", to, "Response:", string(body))
	return nil
}

func sendLinePushToAllNotifications(message string) error {
	db := config.DB()
	if db == nil {
		return fmt.Errorf("database connection is nil")
	}

	var notifications []entity.AppNotification
	if err := db.
		Preload("AppLineMaster").
		Where("alert = ?", true).
		Find(&notifications).Error; err != nil {
		return fmt.Errorf("failed to query AppNotification: %w", err)
	}

	if len(notifications) == 0 {
		log.Println("ℹ️ no AppNotification with alert = true")
		return nil
	}

	var failed []string
	successCount := 0

	for _, notify := range notifications {
		sendID := strings.TrimSpace(notify.SendID)
		if sendID == "" {
			log.Printf("⚠️ skip notification id=%d because send_id is empty\n", notify.ID)
			failed = append(failed, fmt.Sprintf("id=%d send_id empty", notify.ID))
			continue
		}

		if notify.AppLineMaster == nil {
			log.Printf("⚠️ skip notification id=%d because AppLineMaster is nil\n", notify.ID)
			failed = append(failed, fmt.Sprintf("id=%d no AppLineMaster", notify.ID))
			continue
		}

		token := strings.TrimSpace(notify.AppLineMaster.Token)
		if token == "" {
			log.Printf("⚠️ skip notification id=%d because token is empty\n", notify.ID)
			failed = append(failed, fmt.Sprintf("id=%d token empty", notify.ID))
			continue
		}

		if err := sendLinePushTo(token, sendID, message); err != nil {
			log.Printf("❌ sendLinePushTo failed id=%d send_id=%s error=%v\n", notify.ID, sendID, err)
			failed = append(failed, fmt.Sprintf("id=%d send_id=%s err=%v", notify.ID, sendID, err))
			continue
		}

		successCount++
	}

	log.Printf("✅ LINE notify done: success=%d failed=%d\n", successCount, len(failed))

	if len(failed) > 0 {
		return fmt.Errorf("some notifications failed: %s", strings.Join(failed, " | "))
	}

	return nil
}

// BroadcastText pushes a plain-text message to every LINE recipient that has
// alerts enabled, reusing the exact fan-out the built-in status alerts use.
// Exported so other features — e.g. the remediation lifecycle engine announcing
// verified-closed / reopened / SLA-breach events — can notify through the same
// channel without duplicating recipient/token handling. Best-effort by nature:
// callers typically ignore the error (a missing recipient shouldn't fail a scan
// reconciliation).
func BroadcastText(message string) error {
	return sendLinePushToAllNotifications(message)
}

// =====================================================
// PostgreSQL Ready Wait (for pq listener)
// =====================================================

func waitPGReadyForListener(connStr string) {
	for {
		db, err := sql.Open("postgres", connStr)
		if err == nil {
			db.SetConnMaxLifetime(0)
			db.SetMaxOpenConns(1)
			db.SetMaxIdleConns(1)

			if err2 := db.Ping(); err2 == nil {
				_ = db.Close()
				log.Println("✅ PostgreSQL ready for LINE listener")
				return
			}
			_ = db.Close()
		}

		log.Println("⏳ PostgreSQL not ready for LINE listener... retry in 2s")
		time.Sleep(2 * time.Second)
	}
}

// =====================================================
// Scan Notify Payload / Formatting
// =====================================================

func fallbackStatusFromChannel(ch string) string {
	switch ch {
	case "scan_started":
		return "Running"
	case "scan_stopped":
		return "Stopped"
	case "scan_done":
		return "Done"
	default:
		return "Unknown"
	}
}

func humanizeChannelTitle(channel string) string {
	switch channel {
	case "scan_started":
		return "OpenVAS Scan Started"
	case "scan_stopped":
		return "OpenVAS Scan Stopped"
	case "scan_done":
		return "OpenVAS Scan Done"
	default:
		return "OpenVAS Scan Update"
	}
}

func displayScanStatusText(channel string, statusText string) string {
	normalized := strings.ToLower(strings.TrimSpace(statusText))

	switch channel {
	case "scan_started":
		return "กำลังสแกน"
	case "scan_stopped":
		return "หยุดการสแกนแล้ว"
	case "scan_done":
		return "เสร็จสิ้น"
	}

	switch normalized {
	case "running":
		return "กำลังสแกน"
	case "stopped":
		return "หยุดการสแกนแล้ว"
	case "done":
		return "เสร็จสิ้น"
	case "unknown":
		return "ไม่ทราบสถานะ"
	default:
		if strings.TrimSpace(statusText) == "" {
			return "ไม่ทราบสถานะ"
		}
		return strings.TrimSpace(statusText)
	}
}

func buildScanStatusLineMessage(channel string, rawPayload string) (string, error) {
	var data map[string]interface{}
	if err := json.Unmarshal([]byte(rawPayload), &data); err != nil {
		return "", fmt.Errorf("json parse error: %w", err)
	}

	taskName, _ := data["task_name"].(string)
	if strings.TrimSpace(taskName) == "" {
		taskName = "Unknown"
	}

	statusText, ok := data["status"].(string)
	if !ok || strings.TrimSpace(statusText) == "" {
		statusText = fallbackStatusFromChannel(channel)
	}

	emoji := "ℹ️"
	title := "อัปเดตสถานะการสแกน OpenVAS"

	switch channel {
	case "scan_started":
		emoji = "🚀"
		title = "เริ่มสแกน OpenVAS แล้ว"
	case "scan_stopped":
		emoji = "🛑"
		title = "หยุดการสแกน OpenVAS แล้ว"
	case "scan_done":
		emoji = "✅"
		title = "สแกน OpenVAS เสร็จสิ้นแล้ว"
	}

	displayStatus := displayScanStatusText(channel, statusText)

	msg := fmt.Sprintf(
		"%s %s\nTarget: %s\nสถานะ: %s",
		emoji,
		title,
		taskName,
		displayStatus,
	)

	return msg, nil
}

// =====================================================
// Save AppHistoryNotify for Status Notification
// =====================================================

func saveScanStatusHistory(subject string, description string) {
	db := config.DB()
	if db == nil {
		log.Println("saveScanStatusHistory error: database connection is nil")
		return
	}

	var status entity.AppStatusNotify
	if err := db.Where("status = ?", "Status Notification").First(&status).Error; err != nil {
		log.Println("saveScanStatusHistory error: cannot find AppStatusNotify 'Status Notification':", err)
		return
	}

	history := entity.AppHistoryNotify{
		Subject:           strings.TrimSpace(subject),
		DateTime:          time.Now(),
		Description:       strings.TrimSpace(description),
		AppStatusNotifyID: &status.ID,
	}

	if ok, err := govalidator.ValidateStruct(history); !ok {
		log.Println("saveScanStatusHistory validation error:", err)
		return
	}

	if err := db.Create(&history).Error; err != nil {
		log.Println("saveScanStatusHistory error: cannot create AppHistoryNotify:", err)
		return
	}

	log.Println("✅ AppHistoryNotify saved for Status Notification")
}

func buildScanHistoryDescription(channel string, rawPayload string) string {
	var data map[string]interface{}
	if err := json.Unmarshal([]byte(rawPayload), &data); err != nil {
		return fmt.Sprintf(
			"Scan status event\nStatus: %s\nSummary: received notification but payload could not be parsed\nRaw Payload: %s",
			fallbackStatusFromChannel(channel),
			strings.TrimSpace(rawPayload),
		)
	}

	taskName, _ := data["task_name"].(string)
	if strings.TrimSpace(taskName) == "" {
		taskName = "Unknown"
	}

	statusText, _ := data["status"].(string)
	if strings.TrimSpace(statusText) == "" {
		statusText = fallbackStatusFromChannel(channel)
	}

	taskID := ""
	if v, ok := data["task_id"]; ok && v != nil {
		taskID = fmt.Sprintf("%v", v)
	}
	if strings.TrimSpace(taskID) == "" {
		taskID = "Unknown"
	}

	reportID := ""
	if v, ok := data["report_id"]; ok && v != nil {
		reportID = fmt.Sprintf("%v", v)
	}
	if strings.TrimSpace(reportID) == "" {
		reportID = "Unknown"
	}

	source := channel
	if strings.TrimSpace(source) == "" {
		source = "unknown"
	}

	var b strings.Builder
	b.WriteString("Scan status event")
	b.WriteString("\n")
	b.WriteString("Title: " + humanizeChannelTitle(channel))
	b.WriteString("\n")
	b.WriteString("Task: " + taskName)
	b.WriteString("\n")
	b.WriteString("Task ID: " + taskID)
	b.WriteString("\n")
	b.WriteString("Report ID: " + reportID)
	b.WriteString("\n")
	b.WriteString("Status: " + statusText)
	b.WriteString("\n")
	b.WriteString("Source: " + source)
	b.WriteString("\n")
	b.WriteString("Summary: system received scan status notification from PostgreSQL listener")

	return b.String()
}

func buildScanHistorySubject(channel string) string {
	switch channel {
	case "scan_started":
		return "Scan Status - Running"
	case "scan_stopped":
		return "Scan Status - Stopped"
	case "scan_done":
		return "Scan Status - Done"
	default:
		return "Scan Status - Unknown"
	}
}

// =====================================================
// Public Function: Start background PG LISTEN -> LINE
// เรียกจาก main.go ด้วย go line.StartLineStatusListener()
// =====================================================

func StartLineStatusListener() {
	log.SetFlags(log.LstdFlags | log.Lmicroseconds)

	connStr := getPGConnString()
	waitPGReadyForListener(connStr)

	eventCallback := func(ev pq.ListenerEventType, err error) {
		if err != nil {
			log.Println("⚠️ PG Listener event:", ev, "error:", err)
			return
		}
		log.Println("PG Listener event:", ev)
	}

	listener := pq.NewListener(connStr, 5*time.Second, 30*time.Second, eventCallback)

	if err := listener.Listen("scan_started"); err != nil {
		log.Println("❌ LISTEN scan_started failed:", err)
		return
	}
	if err := listener.Listen("scan_stopped"); err != nil {
		log.Println("❌ LISTEN scan_stopped failed:", err)
		return
	}
	if err := listener.Listen("scan_done"); err != nil {
		log.Println("❌ LISTEN scan_done failed:", err)
		return
	}

	log.Println("✅ LISTEN scan_started / scan_stopped / scan_done OK")
	log.Println("✅ Waiting for scan events...")

	for {
		select {
		case n := <-listener.Notify:
			if n == nil {
				continue
			}

			log.Println("📩 Notify received channel:", n.Channel, "payload:", n.Extra)

			isAllowed, taskID, err := isScanNotifyTaskIDInLineStatusManageLimit(n.Extra)
			if err != nil {
				log.Println("⚠️ manage target limit check error:", err)
				continue
			}

			if !isAllowed {
				if strings.TrimSpace(taskID) == "" {
					log.Println("ℹ️ skip scan notification because task_id is empty or missing from payload")
				} else {
					log.Println("ℹ️ skip scan notification because task_id is outside manage target limit:", taskID)
				}
				continue
			}

			// 1) บันทึกลง AppHistoryNotify ก่อน
			subject := buildScanHistorySubject(n.Channel)
			description := buildScanHistoryDescription(n.Channel, n.Extra)
			saveScanStatusHistory(subject, description)

			// 2) ส่ง LINE ให้ทุกคนใน AppNotification ที่ Alert = true
			message, err := buildScanStatusLineMessage(n.Channel, n.Extra)
			if err != nil {
				log.Println("❌ buildScanStatusLineMessage error:", err, "raw:", n.Extra)
				continue
			}

			if err := sendLinePushToAllNotifications(message); err != nil {
				log.Println("⚠️ sendLinePushToAllNotifications error:", err)
				continue
			}

		case <-time.After(60 * time.Second):
			if err := listener.Ping(); err != nil {
				log.Println("⚠️ listener.Ping error:", err)
			}
		}
	}
}