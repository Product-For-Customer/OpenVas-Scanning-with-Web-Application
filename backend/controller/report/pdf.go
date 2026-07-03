package report

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/Tawunchai/openvas/config"
	"github.com/Tawunchai/openvas/entity"
	"github.com/Tawunchai/openvas/services"
	"github.com/asaskevich/govalidator"
	"github.com/chromedp/cdproto/page"
	"github.com/chromedp/chromedp"
	"github.com/gin-gonic/gin"
)

const (
	fixedReportsDir  = "./tmp/reports"
	defaultPDFPrefix = "report_capture"

	defaultPaperW  = 8.27
	defaultPaperH  = 11.69
	defaultMargin  = 0.2
	defaultWindowW = int64(1440)
	defaultWindowH = int64(2600)

	defaultWaitBefore   = 1200 * time.Millisecond
	defaultReadyTimeout = 45 * time.Second
	defaultPDFTimeout   = 120 * time.Second
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
	base := strings.TrimRight(os.Getenv("PATH_API_URL"), "/")
	fileName := filepath.Base(filePath)
	return fmt.Sprintf("%s/public/reports/%s", base, fileName)
}

func getCaptureBaseURL() string {
	u := strings.TrimSpace(os.Getenv("FRONTEND_CAPTURE_URL"))
	if u != "" {
		return u
	}
	return "http://frontend/capture"
}

func buildCaptureURL(taskIDs []string) string {
	baseURL := getCaptureBaseURL()

	if len(taskIDs) == 0 {
		return baseURL
	}

	parsedURL, err := url.Parse(baseURL)
	if err != nil {
		return baseURL
	}

	query := parsedURL.Query()
	query.Set("task_id", strings.Join(taskIDs, ","))
	parsedURL.RawQuery = query.Encode()

	return parsedURL.String()
}

func parseTaskIDs(raw string) []string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return []string{}
	}

	parts := strings.Split(raw, ",")
	seen := make(map[string]bool)
	result := make([]string, 0, len(parts))

	for _, part := range parts {
		id := strings.TrimSpace(part)
		if id == "" {
			continue
		}

		if seen[id] {
			continue
		}

		seen[id] = true
		result = append(result, id)
	}

	return result
}

func getChromePath() string {
	path := strings.TrimSpace(os.Getenv("CHROME_PATH"))
	if path != "" {
		return path
	}
	return "/usr/bin/chromium"
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

	chromePath := getChromePath()

	allocOpts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.ExecPath(chromePath),
		chromedp.Flag("headless", true),
		chromedp.Flag("no-sandbox", true),
		chromedp.Flag("disable-setuid-sandbox", true),
		chromedp.Flag("disable-dev-shm-usage", true),
		chromedp.Flag("disable-gpu", true),
		chromedp.Flag("hide-scrollbars", true),
		chromedp.Flag("mute-audio", true),
		chromedp.WindowSize(int(defaultWindowW), int(defaultWindowH)),
	)

	allocCtx, allocCancel := chromedp.NewExecAllocator(context.Background(), allocOpts...)
	defer allocCancel()

	ctx, cancel := chromedp.NewContext(allocCtx)
	defer cancel()

	timeoutCtx, timeoutCancel := context.WithTimeout(ctx, defaultPDFTimeout)
	defer timeoutCancel()

	var pdfBuf []byte

	log.Printf("[capture] start pdf capture: url=%s chrome=%s", captureURL, chromePath)

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
		return "", fmt.Errorf("capture PDF failed (url=%s, chrome=%s): %w", captureURL, chromePath, err)
	}

	if len(pdfBuf) == 0 {
		return "", fmt.Errorf("generated PDF is empty")
	}

	if err := os.WriteFile(filePath, pdfBuf, 0644); err != nil {
		return "", fmt.Errorf("save PDF failed: %w", err)
	}

	log.Printf("[capture] pdf saved: %s", filePath)
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
// ========================================================
func SendPDFToLine(c *gin.Context) {
	pdfQuery := strings.TrimSpace(c.Query("pdf"))
	taskIDs := parseTaskIDs(c.Query("task_id"))

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
		filePath   string
		publicURL  string
		captureURL string
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
		captureURL = buildCaptureURL(taskIDs)
		filePath, err = generatePDFFromCapturePage(captureURL)
		if err != nil {
			services.RespondInternalError(c, err)
			return
		}
	}

	publicURL = buildPublicPDFURL(filePath)

	msg := fmt.Sprintf(
		"📄 สร้างรายงาน PDF สำเร็จแล้วครับ\n\nไฟล์รายงาน: %s\nเปิดรายงานได้ที่:\n%s",
		filepath.Base(filePath),
		publicURL,
	)

	if len(requestedIDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":      "app_notification_id is required",
			"file_path":  filePath,
			"public_url": publicURL,
		})
		return
	}

	items, err := listAppNotificationsByIDs(requestedIDs)
	if err != nil {
		services.RespondInternalError(c, err)
		return
	}

	items = sortNotificationsByRequestedIDs(items, requestedIDs)

	foundMap := make(map[uint]struct{}, len(items))
	for _, item := range items {
		foundMap[item.ID] = struct{}{}
	}

	notFoundIDs := make([]uint, 0)
	for _, requestedID := range requestedIDs {
		if _, ok := foundMap[requestedID]; !ok {
			notFoundIDs = append(notFoundIDs, requestedID)
		}
	}

	sentIDs := make([]uint, 0)
	sentTargets := make([]string, 0)
	failedIDs := make([]uint, 0)
	failedTargets := make([]string, 0)

	for _, item := range items {
		if !item.Alert {
			failedIDs = append(failedIDs, item.ID)
			failedTargets = append(failedTargets, fmt.Sprintf("id=%d: alert disabled", item.ID))
			continue
		}

		sendID := strings.TrimSpace(item.SendID)
		if sendID == "" {
			failedIDs = append(failedIDs, item.ID)
			failedTargets = append(failedTargets, fmt.Sprintf("id=%d: send_id is empty", item.ID))
			continue
		}

		if item.AppLineMaster.ID == 0 {
			failedIDs = append(failedIDs, item.ID)
			failedTargets = append(failedTargets, fmt.Sprintf("id=%d: app_line_master not found", item.ID))
			continue
		}

		token := strings.TrimSpace(item.AppLineMaster.Token)
		if token == "" {
			failedIDs = append(failedIDs, item.ID)
			failedTargets = append(failedTargets, fmt.Sprintf("id=%d: line token is empty", item.ID))
			continue
		}

		if err := pushLineTextMessageToTarget(token, sendID, msg); err != nil {
			failedIDs = append(failedIDs, item.ID)
			failedTargets = append(failedTargets, fmt.Sprintf("id=%d: %v", item.ID, err))
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
// ========================================================
func DownloadPDF(c *gin.Context) {
	pdfQuery := strings.TrimSpace(c.Query("pdf"))
	taskIDs := parseTaskIDs(c.Query("task_id"))

	var (
		filePath   string
		captureURL string
		err        error
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
		captureURL = buildCaptureURL(taskIDs)
		filePath, err = generatePDFFromCapturePage(captureURL)
		if err != nil {
			services.RespondInternalError(c, err)
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
	Logo        *string `json:"logo"`
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

	if input.CompanyName == nil && input.Logo == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no fields to update"})
		return
	}

	updatedReport := report

	if input.CompanyName != nil {
		updatedReport.CompanyName = strings.TrimSpace(*input.CompanyName)
	}

	if input.Logo != nil {
		updatedReport.Logo = strings.TrimSpace(*input.Logo)
	}

	if ok, err := govalidator.ValidateStruct(updatedReport); !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{}

	if input.CompanyName != nil {
		updates["company_name"] = updatedReport.CompanyName
	}

	if input.Logo != nil {
		updates["logo"] = updatedReport.Logo
	}

	tx := db.Model(&entity.AppReport{}).
		Where("id = ?", report.ID).
		Updates(updates)

	if tx.Error != nil {
		services.RespondInternalError(c, tx.Error)
		return
	}

	var refreshed entity.AppReport
	if err := db.First(&refreshed, report.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to reload updated app report"})
		return
	}

	c.JSON(http.StatusOK, mapAppReportResponse(refreshed))
}