package automation

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/Tawunchai/openvas/config"
	"github.com/Tawunchai/openvas/entity"
	"github.com/gin-gonic/gin"
)

type FeedUpdateRequest struct {
	TriggeredBy string `json:"triggered_by"`
	Source      string `json:"source"`
	Force       bool   `json:"force"`
}

type FeedUpdateStatus struct {
	IsRunning   bool      `json:"is_running"`
	LastStatus  string    `json:"last_status"`
	LastMessage string    `json:"last_message"`
	LastRunAt   time.Time `json:"last_run_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	LastOutput  string    `json:"last_output,omitempty"`
	ResultType  string    `json:"result_type,omitempty"`
	Updated     bool      `json:"updated"`
}

var feedUpdateMu sync.Mutex
var isFeedUpdating bool

var feedStatus = FeedUpdateStatus{
	IsRunning:   false,
	LastStatus:  "idle",
	LastMessage: "server started",
	LastRunAt:   time.Time{},
	UpdatedAt:   time.Now(),
	ResultType:  "idle",
	Updated:     false,
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

func buildFeedLineMessage(resultType string, message string, output string) string {
	title, emoji := getFeedLineTitle(resultType)
	statusText := humanizeFeedLineStatus(resultType)
	summary := summarizeFeedOutput(resultType, message, output)

	if strings.TrimSpace(summary) == "" {
		summary = "ระบบดำเนินการอัปเดต Feed เรียบร้อยแล้ว"
	}

	var b strings.Builder
	b.WriteString(fmt.Sprintf("%s %s", emoji, title))
	b.WriteString("\n")
	b.WriteString("สถานะ: " + statusText)
	b.WriteString("\n")
	b.WriteString("รายละเอียด: " + summary)

	return b.String()
}

func getFeedLineTitle(resultType string) (string, string) {
	switch resultType {
	case "server_error":
		return "ระบบอัปเดต Feed ยังไม่พร้อมใช้งานครับ", "⚠️"
	case "unauthorized":
		return "ไม่สามารถอัปเดต Feed ได้ครับ", "⛔"
	case "already_running":
		return "ระบบกำลังอัปเดต Feed อยู่ครับ", "⏳"
	case "timeout":
		return "การอัปเดต Feed ใช้เวลานานเกินไปครับ", "⌛"
	case "updated":
		return "อัปเดต Feed ของ OpenVAS สำเร็จแล้วครับ", "✅"
	case "no_update":
		return "ตรวจสอบ Feed ของ OpenVAS แล้วครับ", "📭"
	case "failed":
		return "อัปเดต Feed ของ OpenVAS ไม่สำเร็จครับ", "❌"
	default:
		return "แจ้งเตือนสถานะ Feed ของ OpenVAS ครับ", "ℹ️"
	}
}

func humanizeFeedLineStatus(resultType string) string {
	switch resultType {
	case "server_error":
		return "ตั้งค่าระบบไม่สมบูรณ์"
	case "unauthorized":
		return "ไม่ได้รับอนุญาต"
	case "already_running":
		return "กำลังทำงาน"
	case "timeout":
		return "หมดเวลา"
	case "updated":
		return "อัปเดตแล้ว"
	case "no_update":
		return "ไม่มีข้อมูลใหม่"
	case "failed":
		return "ไม่สำเร็จ"
	default:
		return "ไม่ทราบสถานะ"
	}
}

func notifyFeedUpdateToAllNotifications(resultType string, message string, output string) {
	lineMessage := buildFeedLineMessage(resultType, message, output)

	if err := sendLinePushToAllNotifications(lineMessage); err != nil {
		log.Println("⚠️ sendLinePushToAllNotifications error:", err)
	}
}

func TriggerFeedUpdateHandler(c *gin.Context) {
	requiredToken := os.Getenv("AUTOMATION_TOKEN")
	gotToken := c.GetHeader("X-Automation-Token")

	var req FeedUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		req = FeedUpdateRequest{
			TriggeredBy: "unknown",
			Source:      "unknown",
			Force:       false,
		}
	}

	if strings.TrimSpace(req.TriggeredBy) == "" {
		req.TriggeredBy = "unknown"
	}
	if strings.TrimSpace(req.Source) == "" {
		req.Source = "unknown"
	}

	// =========================
	// SERVER ERROR
	// =========================
	if requiredToken == "" {
		now := time.Now()
		errMsg := "AUTOMATION_TOKEN is not configured in backend environment"

		feedUpdateMu.Lock()
		feedStatus.IsRunning = false
		feedStatus.LastStatus = "server_error"
		feedStatus.LastMessage = errMsg
		feedStatus.LastRunAt = now
		feedStatus.UpdatedAt = now
		feedStatus.ResultType = "server_error"
		feedStatus.Updated = false
		feedUpdateMu.Unlock()

		saveFeedUpdateHistory(
			"Server Error",
			"Feed Update - Server Error",
			buildFeedHistoryDescription(
				"server_error",
				req.TriggeredBy,
				req.Source,
				req.Force,
				errMsg,
				"",
			),
		)

		notifyFeedUpdateToAllNotifications(
			"server_error",
			errMsg,
			"",
		)

		c.JSON(http.StatusInternalServerError, gin.H{
			"success":      false,
			"updated":      false,
			"result_type":  "server_error",
			"message":      errMsg,
			"error":        errMsg,
			"triggered_by": req.TriggeredBy,
			"source":       req.Source,
			"force":        req.Force,
			"at":           now.Format(time.RFC3339),
		})
		return
	}

	// =========================
	// UNAUTHORIZED
	// =========================
	if gotToken == "" || gotToken != requiredToken {
		now := time.Now()
		errMsg := "invalid automation token"

		feedUpdateMu.Lock()
		feedStatus.IsRunning = false
		feedStatus.LastStatus = "unauthorized"
		feedStatus.LastMessage = errMsg
		feedStatus.LastRunAt = now
		feedStatus.UpdatedAt = now
		feedStatus.ResultType = "unauthorized"
		feedStatus.Updated = false
		feedUpdateMu.Unlock()

		saveFeedUpdateHistory(
			"Unauthorized",
			"Feed Update - Unauthorized",
			buildFeedHistoryDescription(
				"unauthorized",
				req.TriggeredBy,
				req.Source,
				req.Force,
				errMsg,
				"",
			),
		)

		notifyFeedUpdateToAllNotifications(
			"unauthorized",
			errMsg,
			"",
		)

		c.JSON(http.StatusUnauthorized, gin.H{
			"success":      false,
			"updated":      false,
			"result_type":  "unauthorized",
			"message":      errMsg,
			"error":        errMsg,
			"triggered_by": req.TriggeredBy,
			"source":       req.Source,
			"force":        req.Force,
			"at":           now.Format(time.RFC3339),
		})
		return
	}

	// =========================
	// ALREADY RUNNING
	// =========================
	feedUpdateMu.Lock()
	if isFeedUpdating {
		now := time.Now()
		errMsg := "feed update is already running"

		feedStatus.IsRunning = true
		feedStatus.LastStatus = "busy"
		feedStatus.LastMessage = errMsg
		feedStatus.ResultType = "already_running"
		feedStatus.Updated = false
		feedStatus.UpdatedAt = now
		feedUpdateMu.Unlock()

		saveFeedUpdateHistory(
			"Already Running",
			"Feed Update - Already Running",
			buildFeedHistoryDescription(
				"already_running",
				req.TriggeredBy,
				req.Source,
				req.Force,
				errMsg,
				"",
			),
		)

		notifyFeedUpdateToAllNotifications(
			"already_running",
			errMsg,
			"",
		)

		c.JSON(http.StatusConflict, gin.H{
			"success":      false,
			"updated":      false,
			"result_type":  "already_running",
			"message":      errMsg,
			"error":        errMsg,
			"triggered_by": req.TriggeredBy,
			"source":       req.Source,
			"force":        req.Force,
			"at":           now.Format(time.RFC3339),
		})
		return
	}

	now := time.Now()
	isFeedUpdating = true
	feedStatus.IsRunning = true
	feedStatus.LastStatus = "running"
	feedStatus.LastMessage = "feed update started"
	feedStatus.LastRunAt = now
	feedStatus.UpdatedAt = now
	feedStatus.LastOutput = ""
	feedStatus.ResultType = "running"
	feedStatus.Updated = false
	feedUpdateMu.Unlock()

	defer func() {
		feedUpdateMu.Lock()
		isFeedUpdating = false
		feedStatus.IsRunning = false
		feedStatus.UpdatedAt = time.Now()
		feedUpdateMu.Unlock()
	}()

	// =========================
	// RUN SCRIPT
	// =========================
	scriptPath := "/app/scripts/update-feed.sh"

	ctx, cancel := context.WithTimeout(context.Background(), 125*time.Minute)
	defer cancel()

	cmd := exec.CommandContext(ctx, "bash", scriptPath)
	cmd.Env = append(
		os.Environ(),
		"OPENVAS_COMPOSE_WORKDIR="+getEnv("OPENVAS_COMPOSE_WORKDIR", "/workspace"),
		fmt.Sprintf("FEED_FORCE_UPDATE=%t", req.Force),
	)

	var stdout bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()

	combinedOutput := stdout.String()
	if stderr.Len() > 0 {
		if combinedOutput != "" {
			combinedOutput += "\n"
		}
		combinedOutput += stderr.String()
	}

	const maxOutput = 12000
	if len(combinedOutput) > maxOutput {
		combinedOutput = combinedOutput[len(combinedOutput)-maxOutput:]
	}

	parsedResultType, parsedUpdated := parseFeedUpdateResult(combinedOutput)

	feedUpdateMu.Lock()
	defer feedUpdateMu.Unlock()

	// =========================
	// TIMEOUT
	// =========================
	if ctx.Err() == context.DeadlineExceeded {
		now := time.Now()
		errMsg := "feed update timeout"

		feedStatus.LastStatus = "timeout"
		feedStatus.LastMessage = errMsg
		feedStatus.LastOutput = combinedOutput
		feedStatus.ResultType = "timeout"
		feedStatus.Updated = false
		feedStatus.UpdatedAt = now

		saveFeedUpdateHistory(
			"Timeout",
			"Feed Update - Timeout",
			buildFeedHistoryDescription(
				"timeout",
				req.TriggeredBy,
				req.Source,
				req.Force,
				errMsg,
				combinedOutput,
			),
		)

		notifyFeedUpdateToAllNotifications(
			"timeout",
			errMsg,
			combinedOutput,
		)

		c.JSON(http.StatusGatewayTimeout, gin.H{
			"success":      false,
			"updated":      false,
			"result_type":  "timeout",
			"message":      errMsg,
			"error":        errMsg,
			"triggered_by": req.TriggeredBy,
			"source":       req.Source,
			"force":        req.Force,
			"at":           now.Format(time.RFC3339),
			"output":       combinedOutput,
		})
		return
	}

	// =========================
	// FAILED
	// =========================
	if err != nil {
		now := time.Now()
		errMsg := "feed update failed"

		if parsedResultType == "" {
			parsedResultType = "failed"
		}

		feedStatus.LastStatus = "failed"
		feedStatus.LastMessage = errMsg + ": " + err.Error()
		feedStatus.LastOutput = combinedOutput
		feedStatus.ResultType = parsedResultType
		feedStatus.Updated = false
		feedStatus.UpdatedAt = now

		saveFeedUpdateHistory(
			"Update Failed",
			"Feed Update - Failed",
			buildFeedHistoryDescription(
				parsedResultType,
				req.TriggeredBy,
				req.Source,
				req.Force,
				err.Error(),
				combinedOutput,
			),
		)

		notifyFeedUpdateToAllNotifications(
			parsedResultType,
			err.Error(),
			combinedOutput,
		)

		c.JSON(http.StatusInternalServerError, gin.H{
			"success":      false,
			"updated":      false,
			"result_type":  parsedResultType,
			"message":      errMsg,
			"error":        errMsg,
			"detail":       err.Error(),
			"triggered_by": req.TriggeredBy,
			"source":       req.Source,
			"force":        req.Force,
			"at":           now.Format(time.RFC3339),
			"output":       combinedOutput,
		})
		return
	}

	// =========================
	// SUCCESS PATH
	// =========================
	now = time.Now()
	feedStatus.LastStatus = "success"
	feedStatus.LastOutput = combinedOutput
	feedStatus.ResultType = parsedResultType
	feedStatus.Updated = parsedUpdated
	feedStatus.UpdatedAt = now

	switch parsedResultType {
	case "no_update":
		successMsg := "no new feed updates found"

		feedStatus.LastMessage = successMsg

		saveFeedUpdateHistory(
			"No Update",
			"Feed Update - No Update",
			buildFeedHistoryDescription(
				"no_update",
				req.TriggeredBy,
				req.Source,
				req.Force,
				successMsg,
				combinedOutput,
			),
		)

		c.JSON(http.StatusOK, gin.H{
			"success":      true,
			"updated":      false,
			"result_type":  "no_update",
			"message":      successMsg,
			"triggered_by": req.TriggeredBy,
			"source":       req.Source,
			"force":        req.Force,
			"at":           now.Format(time.RFC3339),
			"output":       combinedOutput,
		})
		return

	case "updated":
		successMsg := "feed update completed successfully"

		feedStatus.LastMessage = successMsg

		saveFeedUpdateHistory(
			"Update Completed",
			"Feed Update - Update Completed",
			buildFeedHistoryDescription(
				"updated",
				req.TriggeredBy,
				req.Source,
				req.Force,
				successMsg,
				combinedOutput,
			),
		)

		notifyFeedUpdateToAllNotifications(
			"updated",
			successMsg,
			combinedOutput,
		)

		c.JSON(http.StatusOK, gin.H{
			"success":      true,
			"updated":      true,
			"result_type":  "updated",
			"message":      successMsg,
			"triggered_by": req.TriggeredBy,
			"source":       req.Source,
			"force":        req.Force,
			"at":           now.Format(time.RFC3339),
			"output":       combinedOutput,
		})
		return

	default:
		successMsg := "no new feed updates found"

		feedStatus.LastMessage = "feed update finished with unknown result"

		saveFeedUpdateHistory(
			"No Update",
			"Feed Update - No Update",
			buildFeedHistoryDescription(
				"no_update",
				req.TriggeredBy,
				req.Source,
				req.Force,
				successMsg,
				combinedOutput,
			),
		)

		c.JSON(http.StatusOK, gin.H{
			"success":      true,
			"updated":      false,
			"result_type":  "no_update",
			"message":      successMsg,
			"triggered_by": req.TriggeredBy,
			"source":       req.Source,
			"force":        req.Force,
			"at":           now.Format(time.RFC3339),
			"output":       combinedOutput,
		})
		return
	}
}

func parseFeedUpdateResult(output string) (resultType string, updated bool) {
	lower := strings.ToLower(output)

	if strings.Contains(lower, "result_type=failed") {
		return "failed", false
	}
	if strings.Contains(lower, "result_type=no_update") {
		return "no_update", false
	}
	if strings.Contains(lower, "result_type=updated") {
		return "updated", true
	}

	if strings.Contains(lower, "error:") ||
		strings.Contains(lower, "failed to pull") ||
		strings.Contains(lower, "docker compose up failed") ||
		strings.Contains(lower, "failed to recreate feed/data services") {
		return "failed", false
	}

	if strings.Contains(lower, "downloaded newer image") {
		return "updated", true
	}

	if strings.Contains(lower, "no new feed updates found") ||
		strings.Contains(lower, "image is up to date") ||
		strings.Contains(lower, "up to date") {
		return "no_update", false
	}

	return "no_update", false
}

func saveFeedUpdateHistory(statusName string, subject string, description string) {
	db := config.DB()
	if db == nil {
		fmt.Printf("saveFeedUpdateHistory error: database connection is nil\n")
		return
	}

	var status entity.AppStatusNotify
	if err := db.Where("status = ?", statusName).First(&status).Error; err != nil {
		fmt.Printf("saveFeedUpdateHistory error: cannot find AppStatusNotify '%s': %v\n", statusName, err)
		return
	}

	history := entity.AppHistoryNotify{
		Subject:           subject,
		Description:       description,
		DateTime:          time.Now(),
		AppStatusNotifyID: &status.ID,
	}

	if err := db.Create(&history).Error; err != nil {
		fmt.Printf("saveFeedUpdateHistory error: cannot create AppHistoryNotify: %v\n", err)
		return
	}
}

func buildFeedHistoryDescription(resultType, triggeredBy, source string, force bool, message string, output string) string {
	var b strings.Builder

	summary := summarizeFeedOutput(resultType, message, output)

	b.WriteString("Feed update event")
	b.WriteString("\n")
	b.WriteString("Status: " + humanizeFeedResultType(resultType))
	b.WriteString("\n")
	b.WriteString("Triggered By: " + safeString(triggeredBy))
	b.WriteString("\n")
	b.WriteString("Source: " + safeString(source))
	b.WriteString("\n")
	b.WriteString(fmt.Sprintf("Force: %t", force))
	b.WriteString("\n")
	b.WriteString("Summary: " + summary)

	return b.String()
}

func summarizeFeedOutput(resultType, message, output string) string {
	output = strings.TrimSpace(output)
	lower := strings.ToLower(output)
	msg := strings.TrimSpace(message)

	switch resultType {
	case "server_error":
		return "ระบบยังไม่ได้ตั้งค่า AUTOMATION_TOKEN สำหรับ Automation"

	case "unauthorized":
		return "Token สำหรับ Automation ไม่ถูกต้อง ระบบจึงไม่ดำเนินการต่อ"

	case "already_running":
		return "มีการอัปเดต Feed กำลังทำงานอยู่ กรุณารอให้เสร็จก่อน"

	case "timeout":
		services := extractFailedServices(output)
		if len(services) > 0 {
			return fmt.Sprintf(
				"ใช้เวลานานเกินไปขณะอัปเดตบริการ: %s",
				strings.Join(services, ", "),
			)
		}
		return "การอัปเดต Feed ใช้เวลานานเกินกว่าที่กำหนด"

	case "updated":
		images := extractUpdatedImages(output)
		if len(images) > 0 {
			return fmt.Sprintf(
				"อัปเดตข้อมูล Feed เรียบร้อยแล้ว (%d รายการ)",
				len(images),
			)
		}
		return "อัปเดตข้อมูล Feed เรียบร้อยแล้ว"

	case "no_update":
		return "ตรวจสอบแล้ว ไม่มีข้อมูล Feed ใหม่"

	case "failed":
		failure := detectFailureReason(lower, msg)
		services := extractFailedServices(output)

		if len(services) > 0 && failure != "" {
			return fmt.Sprintf(
				"ไม่สามารถอัปเดตบริการ %s ได้: %s",
				strings.Join(services, ", "),
				failure,
			)
		}

		if len(services) > 0 {
			return fmt.Sprintf(
				"ไม่สามารถอัปเดตบริการ %s ได้",
				strings.Join(services, ", "),
			)
		}

		if failure != "" {
			return failure
		}

		if msg != "" {
			return cleanSentence(msg)
		}

		return "ระบบไม่สามารถอัปเดต Feed ได้ในขณะนี้"

	default:
		if msg != "" {
			return cleanSentence(msg)
		}
		return "ระบบดำเนินการอัปเดต Feed เรียบร้อยแล้ว"
	}
}

func humanizeFeedResultType(resultType string) string {
	switch resultType {
	case "server_error":
		return "Server Error"
	case "unauthorized":
		return "Unauthorized"
	case "already_running":
		return "Already Running"
	case "timeout":
		return "Timeout"
	case "updated":
		return "Updated"
	case "no_update":
		return "No Update"
	case "failed":
		return "Failed"
	default:
		return "Unknown"
	}
}

func detectFailureReason(lowerOutput, message string) string {
	switch {
	case strings.Contains(lowerOutput, "502 bad gateway"):
		return "Registry ของ Greenbone ตอบกลับเป็น 502 Bad Gateway"
	case strings.Contains(lowerOutput, "401 unauthorized"):
		return "ยืนยันตัวตนกับ Registry ไม่สำเร็จ"
	case strings.Contains(lowerOutput, "403 forbidden"):
		return "ไม่มีสิทธิ์เข้าถึง Registry"
	case strings.Contains(lowerOutput, "context deadline exceeded"):
		return "การทำงานใช้เวลานานเกินกำหนด"
	case strings.Contains(lowerOutput, "failed to resolve reference"):
		return "ไม่สามารถตรวจสอบ Image จาก Registry ได้"
	case strings.Contains(lowerOutput, "failed to pull image"):
		return "ไม่สามารถดาวน์โหลด Image จาก Registry ได้"
	case strings.Contains(lowerOutput, "docker compose up failed"):
		return "สั่งงาน Docker Compose ไม่สำเร็จ"
	case strings.Contains(lowerOutput, "network is unreachable"):
		return "ไม่สามารถเชื่อมต่อเครือข่ายได้"
	case strings.Contains(lowerOutput, "no such host"):
		return "ไม่สามารถค้นหา Host ของ Registry ได้"
	}

	if strings.TrimSpace(message) != "" {
		return cleanSentence(message)
	}

	return ""
}

func extractFailedServices(output string) []string {
	serviceMap := map[string]struct{}{}

	quotedServiceRe := regexp.MustCompile(`service '([^']+)'`)
	matches := quotedServiceRe.FindAllStringSubmatch(output, -1)
	for _, m := range matches {
		if len(m) > 1 {
			service := strings.TrimSpace(m[1])
			if service != "" {
				serviceMap[service] = struct{}{}
			}
		}
	}

	lineServiceRe := regexp.MustCompile(`(?i)service:\s*([a-zA-Z0-9._-]+)`)
	matches = lineServiceRe.FindAllStringSubmatch(output, -1)
	for _, m := range matches {
		if len(m) > 1 {
			service := strings.TrimSpace(m[1])
			if service != "" {
				serviceMap[service] = struct{}{}
			}
		}
	}

	var services []string
	for service := range serviceMap {
		services = append(services, service)
	}
	sort.Strings(services)

	if len(services) > 5 {
		services = services[:5]
	}

	return services
}

func extractUpdatedImages(output string) []string {
	imageMap := map[string]struct{}{}
	lines := strings.Split(output, "\n")

	for _, line := range lines {
		lower := strings.ToLower(line)
		if strings.Contains(lower, "downloaded newer image") {
			parts := strings.Fields(strings.TrimSpace(line))
			if len(parts) > 0 {
				image := parts[0]
				image = shortImageName(image)
				if image != "" {
					imageMap[image] = struct{}{}
				}
			}
		}
	}

	var images []string
	for image := range imageMap {
		images = append(images, image)
	}
	sort.Strings(images)

	if len(images) > 5 {
		images = images[:5]
	}

	return images
}

func shortImageName(image string) string {
	image = strings.TrimSpace(image)
	image = strings.Trim(image, `"'`)

	if image == "" {
		return ""
	}

	parts := strings.Split(image, "/")
	if len(parts) == 0 {
		return image
	}

	last := parts[len(parts)-1]
	last = strings.TrimSpace(last)
	if last == "" {
		return image
	}

	return last
}

func cleanSentence(s string) string {
	s = strings.TrimSpace(s)
	s = strings.ReplaceAll(s, "\n", " ")
	s = regexp.MustCompile(`\s+`).ReplaceAllString(s, " ")
	return s
}

func safeString(v string) string {
	if strings.TrimSpace(v) == "" {
		return "unknown"
	}
	return v
}

func getEnv(key, fallback string) string {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	return v
}

func StartDailyFeedUpdateScheduler() {
	tzName := strings.TrimSpace(os.Getenv("TZ"))
	if tzName == "" {
		tzName = "Asia/Bangkok"
	}

	location, err := time.LoadLocation(tzName)
	if err != nil {
		log.Printf("⚠️ cannot load TZ=%s, fallback to Asia/Bangkok: %v\n", tzName, err)
		location = time.FixedZone("Asia/Bangkok", 7*60*60)
	}

	log.Printf("🕑 Daily feed update scheduler started with TZ=%s\n", tzName)

	for {
		now := time.Now().In(location)

		nextRun := time.Date(
			now.Year(),
			now.Month(),
			now.Day(),
			2,
			0,
			0,
			0,
			location,
		)

		if !nextRun.After(now) {
			nextRun = nextRun.Add(24 * time.Hour)
		}

		waitDuration := time.Until(nextRun)

		log.Printf(
			"🕑 Next daily feed update: %s, wait=%s\n",
			nextRun.Format("2006-01-02 15:04:05 MST"),
			waitDuration.String(),
		)

		timer := time.NewTimer(waitDuration)
		<-timer.C

		runDailyFeedUpdateRequest()
	}
}

func runDailyFeedUpdateRequest() {
	requiredToken := strings.TrimSpace(os.Getenv("AUTOMATION_TOKEN"))
	if requiredToken == "" {
		log.Println("⚠️ daily feed update skipped: AUTOMATION_TOKEN is empty")
		return
	}

	port := getEnv("PORT", "9000")
	updateURL := fmt.Sprintf("http://127.0.0.1:%s/automation/feed/update", port)

	payload := FeedUpdateRequest{
		TriggeredBy: "system",
		Source:      "daily_2am_scheduler",
		Force:       false,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		log.Println("❌ daily feed update marshal error:", err)
		return
	}

	req, err := http.NewRequest(http.MethodPost, updateURL, bytes.NewBuffer(jsonData))
	if err != nil {
		log.Println("❌ daily feed update request create error:", err)
		return
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Automation-Token", requiredToken)

	client := &http.Client{
		Timeout: 130 * time.Minute,
	}

	log.Println("🕑 daily feed update started by scheduler:", updateURL)

	resp, err := client.Do(req)
	if err != nil {
		log.Println("❌ daily feed update request error:", err)
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		log.Printf(
			"❌ daily feed update failed: status=%s response=%s\n",
			resp.Status,
			string(body),
		)
		return
	}

	log.Printf(
		"✅ daily feed update finished: status=%s response=%s\n",
		resp.Status,
		string(body),
	)
}