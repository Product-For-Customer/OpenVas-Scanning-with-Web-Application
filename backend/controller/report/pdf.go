package report

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/Tawunchai/openvas/config"
	"github.com/Tawunchai/openvas/entity"
	"github.com/chromedp/cdproto/page"
	"github.com/chromedp/chromedp"
	"github.com/gin-gonic/gin"
)

const (
	fixedCaptureURL = "http://frontend/capture" // เปลี่ยนด้วยใน docker-compose.yml ถ้าจำเป็น
	fixedPublicBase  = "https://postdiphtherial-unperishable-carolyn.ngrok-free.dev"
	fixedReportsDir  = "./tmp/reports"
	defaultPDFPrefix = "report_capture"

	defaultPaperW  = 8.27
	defaultPaperH  = 11.69
	defaultMargin  = 0.2
	defaultWindowW = int64(1440)
	defaultWindowH = int64(2600)

	defaultWaitBefore   = 1200 * time.Millisecond
	defaultReadyTimeout = 90 * time.Second

	// fallback เดิม: ยังใช้ได้กรณีไม่ส่ง app_notification_id มา
	fixedLineChannelAccessToken = "G4crCc/2gMnvX+hZErxIhg7WcI0ML+MRLlAj086lTtrdL7VYURieWPRXKd6/9Zl8RxcaME5vQ3I1BW82d1/ZYezvWklVMUk+EGGfXRmI4jwtA28iaHU8MkneAGQSibyr/yp0eetvASPPtplCXWrb7gdB04t89/1O/w1cDnyilFU="
	fixedLineUserID             = "U3af93a2f92b1048757172584d47571c8"
)

type linePushRequest struct {
	To       string        `json:"to"`
	Messages []lineMessage `json:"messages"`
}

type lineMessage struct {
	Type string `json:"type"`
	Text string `json:"text,omitempty"`
}

type sendPDFToLineResponse struct {
	Message               string   `json:"message"`
	FilePath              string   `json:"file_path,omitempty"`
	PublicURL             string   `json:"public_url,omitempty"`
	SentNotificationIDs   []uint   `json:"sent_notification_ids,omitempty"`
	SentTargets           []string `json:"sent_targets,omitempty"`
	FailedNotificationIDs []uint   `json:"failed_notification_ids,omitempty"`
	FailedTargets         []string `json:"failed_targets,omitempty"`
}

func ensureReportsDir() error {
	return os.MkdirAll(fixedReportsDir, 0755)
}

func sanitizeBaseName(name string) string {
	name = filepath.Base(strings.TrimSpace(name))
	name = strings.ReplaceAll(name, "\\", "")
	name = strings.ReplaceAll(name, "/", "")
	if name == "" || name == "." {
		return ""
	}
	return name
}

func buildPublicPDFURL(filePath string) string {
	base := strings.TrimRight(fixedPublicBase, "/")
	fileName := filepath.Base(filePath)
	return fmt.Sprintf("%s/public/reports/%s", base, fileName)
}

func waitForFrontendReady() chromedp.Action {
	return chromedp.ActionFunc(func(ctx context.Context) error {
		deadline := time.Now().Add(defaultReadyTimeout)

		for {
			var ready string
			err := chromedp.Evaluate(`
				(() => {
					const el = document.querySelector('#capture-root');
					if (!el) return '';
					return el.getAttribute('data-report-ready') || '';
				})()
			`, &ready).Do(ctx)
			if err != nil {
				return fmt.Errorf("evaluate capture readiness failed: %w", err)
			}

			if ready == "true" {
				return nil
			}

			if time.Now().After(deadline) {
				var execReady string
				var topReady string

				_ = chromedp.Evaluate(`
					(() => {
						const el = document.querySelector('#capture-root');
						if (!el) return '';
						return el.getAttribute('data-executive-ready') || '';
					})()
				`, &execReady).Do(ctx)

				_ = chromedp.Evaluate(`
					(() => {
						const el = document.querySelector('#capture-root');
						if (!el) return '';
						return el.getAttribute('data-top-device-ready') || '';
					})()
				`, &topReady).Do(ctx)

				return fmt.Errorf(
					"frontend report not ready before timeout (data-report-ready=%q, data-executive-ready=%q, data-top-device-ready=%q)",
					ready,
					execReady,
					topReady,
				)
			}

			time.Sleep(300 * time.Millisecond)
		}
	})
}

func generatePDFFromCapturePage(captureURL string) (string, error) {
	if err := ensureReportsDir(); err != nil {
		return "", fmt.Errorf("create reports dir failed: %w", err)
	}

	fileName := fmt.Sprintf("%s_%s.pdf", defaultPDFPrefix, time.Now().Format("20060102_150405"))
	filePath := filepath.Join(fixedReportsDir, fileName)

	ctx, cancel := chromedp.NewContext(context.Background())
	defer cancel()

	timeoutCtx, timeoutCancel := context.WithTimeout(ctx, 180*time.Second)
	defer timeoutCancel()

	var pdfBuf []byte

	err := chromedp.Run(timeoutCtx,
		chromedp.EmulateViewport(defaultWindowW, defaultWindowH),
		chromedp.Navigate(captureURL),

		chromedp.WaitReady("body", chromedp.ByQuery),
		chromedp.WaitVisible("#capture-root", chromedp.ByQuery),

		waitForFrontendReady(),
		chromedp.Sleep(defaultWaitBefore),

		chromedp.ActionFunc(func(ctx context.Context) error {
			buf, _, err := page.PrintToPDF().
				WithPrintBackground(true).
				WithPaperWidth(defaultPaperW).
				WithPaperHeight(defaultPaperH).
				WithMarginTop(defaultMargin).
				WithMarginBottom(defaultMargin).
				WithMarginLeft(defaultMargin).
				WithMarginRight(defaultMargin).
				WithPreferCSSPageSize(true).
				Do(ctx)
			if err != nil {
				return err
			}
			pdfBuf = buf
			return nil
		}),
	)
	if err != nil {
		return "", fmt.Errorf("capture PDF failed (url=%s): %w", captureURL, err)
	}

	if len(pdfBuf) == 0 {
		return "", fmt.Errorf("generated PDF is empty")
	}

	if err := os.WriteFile(filePath, pdfBuf, 0644); err != nil {
		return "", fmt.Errorf("save PDF failed: %w", err)
	}

	return filePath, nil
}

func fileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}

func resolvePDFPathFromQuery(pdfQuery string) (string, error) {
	pdfQuery = strings.TrimSpace(pdfQuery)
	if pdfQuery == "" {
		return "", fmt.Errorf("empty pdf path")
	}

	if fileExists(pdfQuery) {
		return pdfQuery, nil
	}

	baseName := sanitizeBaseName(pdfQuery)
	if baseName == "" {
		return "", fmt.Errorf("invalid pdf path")
	}

	candidate := filepath.Join(fixedReportsDir, baseName)
	if fileExists(candidate) {
		return candidate, nil
	}

	return "", fmt.Errorf("pdf file not found")
}

func parseAppNotificationIDs(raw string) ([]uint, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return []uint{}, nil
	}

	parts := strings.Split(raw, ",")
	seen := make(map[uint]bool)
	ids := make([]uint, 0, len(parts))

	for _, part := range parts {
		s := strings.TrimSpace(part)
		if s == "" {
			continue
		}

		n, err := strconv.ParseUint(s, 10, 64)
		if err != nil {
			return nil, fmt.Errorf("invalid app_notification_id: %s", s)
		}
		if n == 0 {
			return nil, fmt.Errorf("invalid app_notification_id: %s", s)
		}

		id := uint(n)
		if seen[id] {
			continue
		}
		seen[id] = true
		ids = append(ids, id)
	}

	return ids, nil
}

func pushLineTextMessageToTarget(token string, to string, text string) error {
	if strings.TrimSpace(token) == "" {
		return fmt.Errorf("line token is empty")
	}

	if strings.TrimSpace(to) == "" {
		return fmt.Errorf("line send target is empty")
	}

	if strings.TrimSpace(text) == "" {
		return fmt.Errorf("text message is empty")
	}

	payload := linePushRequest{
		To: to,
		Messages: []lineMessage{
			{
				Type: "text",
				Text: text,
			},
		},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal line payload failed: %w", err)
	}

	req, err := http.NewRequest("POST", "https://api.line.me/v2/bot/message/push", bytes.NewBuffer(body))
	if err != nil {
		return fmt.Errorf("create line request failed: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("send line push failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var respBody bytes.Buffer
		_, _ = respBody.ReadFrom(resp.Body)
		return fmt.Errorf("line push failed: status=%d body=%s", resp.StatusCode, respBody.String())
	}

	return nil
}

// fallback เดิม: ใช้กรณีไม่ได้ส่ง app_notification_id มา
func pushLineTextMessage(text string) error {
	if strings.TrimSpace(fixedLineChannelAccessToken) == "" {
		return fmt.Errorf("fixedLineChannelAccessToken is empty")
	}

	if strings.TrimSpace(fixedLineUserID) == "" {
		return fmt.Errorf("fixedLineUserID is empty")
	}

	return pushLineTextMessageToTarget(fixedLineChannelAccessToken, fixedLineUserID, text)
}

func listAppNotificationsByIDs(ids []uint) ([]entity.AppNotification, error) {
	if len(ids) == 0 {
		return []entity.AppNotification{}, nil
	}

	db := config.DB()

	var notifications []entity.AppNotification
	if err := db.
		Preload("AppLineMaster").
		Where("id IN ?", ids).
		Find(&notifications).Error; err != nil {
		return nil, err
	}

	return notifications, nil
}

func sortNotificationsByRequestedIDs(items []entity.AppNotification, requestedIDs []uint) []entity.AppNotification {
	if len(items) == 0 || len(requestedIDs) == 0 {
		return items
	}

	indexMap := make(map[uint]int, len(requestedIDs))
	for i, id := range requestedIDs {
		indexMap[id] = i
	}

	result := make([]entity.AppNotification, 0, len(items))
	for _, reqID := range requestedIDs {
		for _, item := range items {
			if item.ID == reqID {
				result = append(result, item)
				break
			}
		}
	}

	return result
}

// ========================================================
// GET /report/send-pdf-to-line
//
// รองรับ:
// - /report/send-pdf-to-line
// - /report/send-pdf-to-line?pdf=report_capture_20260401_123000.pdf
// - /report/send-pdf-to-line?app_notification_id=1,2,3
// - /report/send-pdf-to-line?pdf=report_capture_xxx.pdf&app_notification_id=1,2,3
// - /report/send-pdf-to-line?app_notification_ids=1,2,3
//
// สำคัญ:
// - PDF จะถูก generate/resolve "เพียง 1 ครั้ง"
// - แล้วใช้ filePath/publicURL เดิม ส่งให้ทุก AppNotificationID
// ========================================================
func SendPDFToLine(c *gin.Context) {
	pdfQuery := strings.TrimSpace(c.Query("pdf"))

	rawIDs := strings.TrimSpace(c.Query("app_notification_id"))
	if rawIDs == "" {
		rawIDs = strings.TrimSpace(c.Query("app_notification_ids"))
	}

	requestedIDs, err := parseAppNotificationIDs(rawIDs)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("parse app_notification_id failed: %v", err),
		})
		return
	}

	var (
		filePath  string
		publicURL string
	)

	// ===== สร้าง/resolve PDF แค่ครั้งเดียว =====
	if pdfQuery != "" {
		filePath, err = resolvePDFPathFromQuery(pdfQuery)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": fmt.Sprintf("resolve pdf path failed: %v", err),
			})
			return
		}
	} else {
		filePath, err = generatePDFFromCapturePage(fixedCaptureURL)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": fmt.Sprintf("generate pdf failed: %v", err),
			})
			return
		}
	}

	publicURL = buildPublicPDFURL(filePath)

	msg := fmt.Sprintf(
		"รายงาน PDF พร้อมแล้ว\n\nไฟล์: %s\nลิงก์: %s",
		filepath.Base(filePath),
		publicURL,
	)

	// ===== กรณีเดิม: ไม่ส่ง app_notification_id มา =====
	if len(requestedIDs) == 0 {
		if err := pushLineTextMessage(msg); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": fmt.Sprintf("send line message failed: %v", err),
			})
			return
		}

		c.JSON(http.StatusOK, sendPDFToLineResponse{
			Message:   "PDF generated/sent to LINE successfully",
			FilePath:  filePath,
			PublicURL: publicURL,
		})
		return
	}

	// ===== กรณีส่งหลาย AppNotificationID มา =====
	notifications, err := listAppNotificationsByIDs(requestedIDs)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("load app notifications failed: %v", err),
		})
		return
	}

	if len(notifications) == 0 {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "no app notifications found for provided IDs",
		})
		return
	}

	notifications = sortNotificationsByRequestedIDs(notifications, requestedIDs)

	foundMap := make(map[uint]bool, len(notifications))
	for _, item := range notifications {
		foundMap[item.ID] = true
	}

	var notFoundIDs []uint
	for _, id := range requestedIDs {
		if !foundMap[id] {
			notFoundIDs = append(notFoundIDs, id)
		}
	}

	sentIDs := make([]uint, 0, len(notifications))
	sentTargets := make([]string, 0, len(notifications))
	failedIDs := make([]uint, 0)
	failedTargets := make([]string, 0)

	for _, item := range notifications {
		if !item.Alert {
			failedIDs = append(failedIDs, item.ID)
			failedTargets = append(
				failedTargets,
				fmt.Sprintf("id=%d: alert is off", item.ID),
			)
			continue
		}

		sendID := strings.TrimSpace(item.SendID)
		if sendID == "" {
			failedIDs = append(failedIDs, item.ID)
			failedTargets = append(failedTargets, fmt.Sprintf("id=%d: empty SendID", item.ID))
			continue
		}

		if item.AppLineMaster == nil {
			failedIDs = append(failedIDs, item.ID)
			failedTargets = append(failedTargets, fmt.Sprintf("id=%d: AppLineMaster not found", item.ID))
			continue
		}

		token := strings.TrimSpace(item.AppLineMaster.Token)
		if token == "" {
			failedIDs = append(failedIDs, item.ID)
			failedTargets = append(failedTargets, fmt.Sprintf("id=%d: empty AppLineMaster.Token", item.ID))
			continue
		}

		if err := pushLineTextMessageToTarget(token, sendID, msg); err != nil {
			failedIDs = append(failedIDs, item.ID)
			failedTargets = append(failedTargets, fmt.Sprintf("id=%d send_id=%s error=%v", item.ID, sendID, err))
			continue
		}

		sentIDs = append(sentIDs, item.ID)
		sentTargets = append(sentTargets, sendID)
	}

	for _, id := range notFoundIDs {
		failedIDs = append(failedIDs, id)
		failedTargets = append(failedTargets, fmt.Sprintf("id=%d: not found", id))
	}

	if len(sentIDs) == 0 {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":                   "send line message failed for all requested app notifications",
			"file_path":               filePath,
			"public_url":              publicURL,
			"failed_notification_ids": failedIDs,
			"failed_targets":          failedTargets,
		})
		return
	}

	message := "PDF generated/sent to LINE successfully"
	if len(failedIDs) > 0 {
		message = "PDF generated and sent to some LINE targets successfully"
	}

	c.JSON(http.StatusOK, sendPDFToLineResponse{
		Message:               message,
		FilePath:              filePath,
		PublicURL:             publicURL,
		SentNotificationIDs:   sentIDs,
		SentTargets:           sentTargets,
		FailedNotificationIDs: failedIDs,
		FailedTargets:         failedTargets,
	})
}

// ========================================================
// GET /report/download-pdf
// ใช้การ capture แบบเดียวกับ SendPDFToLine
// แต่ response กลับเป็นไฟล์ PDF ให้ browser โหลดลงเครื่อง
// ========================================================
func DownloadPDF(c *gin.Context) {
	pdfQuery := strings.TrimSpace(c.Query("pdf"))

	var (
		filePath string
		err      error
	)

	if pdfQuery != "" {
		filePath, err = resolvePDFPathFromQuery(pdfQuery)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": fmt.Sprintf("resolve pdf path failed: %v", err),
			})
			return
		}
	} else {
		filePath, err = generatePDFFromCapturePage(fixedCaptureURL)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": fmt.Sprintf("generate pdf failed: %v", err),
			})
			return
		}
	}

	fileName := filepath.Base(filePath)

	c.Header("Content-Description", "File Transfer")
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, fileName))
	c.Header("Content-Transfer-Encoding", "binary")
	c.Header("Cache-Control", "no-cache, no-store, must-revalidate")
	c.Header("Pragma", "no-cache")
	c.Header("Expires", "0")

	c.File(filePath)
}

// ========================================================
// report PDF Change
// ========================================================

type AppReportResponse struct {
	ID          uint   `json:"id"`
	CompanyName string `json:"company_name"`
	Logo        string `json:"logo"`
	CreatedAt   string `json:"created_at"`
	UpdatedAt   string `json:"updated_at"`
}

type UpdateAppReportInput struct {
	CompanyName *string `json:"company_name"`
	Logo        *string `json:"logo"` // รองรับ base64
}

func mapAppReportResponse(report entity.AppReport) AppReportResponse {
	return AppReportResponse{
		ID:          report.ID,
		CompanyName: report.CompanyName,
		Logo:        report.Logo,
		CreatedAt:   report.CreatedAt.Format("2006-01-02 15:04:05"),
		UpdatedAt:   report.UpdatedAt.Format("2006-01-02 15:04:05"),
	}
}

// GET /app-report
// ดึงแค่ตัวแรกตัวเดียว
func ListAppReport(c *gin.Context) {
	var report entity.AppReport

	db := config.DB()
	result := db.First(&report)

	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "app report not found"})
		return
	}

	c.JSON(http.StatusOK, mapAppReportResponse(report))
}

// PUT /app-report/:id
func UpdateAppReportByID(c *gin.Context) {
	id := c.Param("id")

	rid, err := strconv.ParseUint(id, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid app report id"})
		return
	}

	var input UpdateAppReportInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	db := config.DB()

	var report entity.AppReport
	if err := db.First(&report, uint(rid)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "app report not found"})
		return
	}

	if input.CompanyName != nil {
		report.CompanyName = *input.CompanyName
	}

	if input.Logo != nil {
		report.Logo = *input.Logo
	}

	if err := db.Save(&report).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	db.First(&report, report.ID)

	c.JSON(http.StatusOK, mapAppReportResponse(report))
}
