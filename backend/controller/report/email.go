package report

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/smtp"
	"net/textproto"
	"os"
	"strings"
	"time"

	"github.com/Tawunchai/openvas/config"
	"github.com/Tawunchai/openvas/entity"
	"github.com/gin-gonic/gin"
)

// ─── helper: send email with PDF attachment ──────────────────────────────────

func sendEmailWithPDFAttachment(from, pass, to, fileName string, pdfBytes []byte) error {
	smtpHost := "smtp.gmail.com"
	smtpAddr := smtpHost + ":587"

	buf := &bytes.Buffer{}
	mw := multipart.NewWriter(buf)

	// Plain-text body
	tp, _ := mw.CreatePart(textproto.MIMEHeader{
		"Content-Type": {"text/plain; charset=utf-8"},
	})
	tp.Write([]byte(fmt.Sprintf(
		"เรียนผู้ใช้งาน,\r\n\r\nกรุณาดูไฟล์แนบรายงาน Network Vulnerability Assessment Report\r\n\r\nGenerated: %s\r\n\r\nขอบคุณ\r\nArgus Security Platform\r\n",
		time.Now().Format("2 Jan 2006 15:04"),
	)))

	// PDF attachment
	ap, _ := mw.CreatePart(textproto.MIMEHeader{
		"Content-Type":              {fmt.Sprintf(`application/pdf; name="%s"`, fileName)},
		"Content-Transfer-Encoding": {"base64"},
		"Content-Disposition":       {fmt.Sprintf(`attachment; filename="%s"`, fileName)},
	})
	enc := base64.StdEncoding.EncodeToString(pdfBytes)
	// wrap at 76 chars per RFC 2045
	for i := 0; i < len(enc); i += 76 {
		end := i + 76
		if end > len(enc) {
			end = len(enc)
		}
		ap.Write([]byte(enc[i:end] + "\r\n"))
	}

	mw.Close()

	header := fmt.Sprintf(
		"From: %s\r\nTo: %s\r\nSubject: [Argus] Network Vulnerability Assessment Report\r\n"+
			"MIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary=\"%s\"\r\n\r\n",
		from, to, mw.Boundary(),
	)

	raw := []byte(header + buf.String())

	return smtp.SendMail(
		smtpAddr,
		smtp.PlainAuth("", from, pass, smtpHost),
		from,
		[]string{to},
		raw,
	)
}

// ─── GET /send-pdf-to-email (protected) ─────────────────────────────────────

// SendPDFToEmail generates the report PDF and sends it to the current user's email.
func SendPDFToEmail(c *gin.Context) {
	// 1. Get current user email from JWT context
	rawEmail, exists := c.Get("user_email")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	userEmail, _ := rawEmail.(string)
	if strings.TrimSpace(userEmail) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user email not found in session"})
		return
	}

	// 2. Read task_id filter (optional)
	taskIDRaw := strings.TrimSpace(c.Query("task_id"))
	taskIDs := parseTaskIDs(taskIDRaw)

	// 3. Generate PDF (reuses generatePDFFromCapturePage which handles chromedp)
	captureURL := buildCaptureURL(taskIDs)
	filePath, err := generatePDFFromCapturePage(captureURL)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate PDF: " + err.Error()})
		return
	}
	defer os.Remove(filePath) // clean up temp file

	// 4. Read generated PDF bytes
	pdfBytes, err := os.ReadFile(filePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read generated PDF"})
		return
	}

	fileName := fmt.Sprintf("argus_report_%s.pdf", time.Now().Format("20060102_150405"))

	// 5. Get SMTP credentials from DB
	db := config.DB()
	var sendMail entity.SendEmail
	if err := db.First(&sendMail).Error; err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "email not configured — please set up email in Service settings"})
		return
	}
	if strings.TrimSpace(sendMail.Email) == "" || strings.TrimSpace(sendMail.PassApp) == "" {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "email credentials incomplete"})
		return
	}

	// 6. Send email with PDF attachment
	if err := sendEmailWithPDFAttachment(sendMail.Email, sendMail.PassApp, userEmail, fileName, pdfBytes); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to send email: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Report sent to %s", userEmail),
		"email":   userEmail,
	})
}
