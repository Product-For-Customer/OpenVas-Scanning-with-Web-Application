package services

import (
	"log"
	"os"
	"strconv"
	"time"
)

func envInt(key string, fallback int) int {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}

	n, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}

	return n
}

func StartCaptureReportScheduler() {
	hour := envInt("REPORT_SCHEDULE_HOUR", 2)
	minute := envInt("REPORT_SCHEDULE_MINUTE", 0)

	go func() {
		for {
			now := time.Now()
			nextRun := time.Date(
				now.Year(),
				now.Month(),
				now.Day(),
				hour,
				minute,
				0,
				0,
				now.Location(),
			)

			if !nextRun.After(now) {
				nextRun = nextRun.Add(24 * time.Hour)
			}

			waitDuration := time.Until(nextRun)
			log.Printf("[mixed-report] next run at %s (in %s)", nextRun.Format(time.RFC3339), waitDuration)

			time.Sleep(waitDuration)

			log.Println("[mixed-report] started")

			result, err := GenerateMixedReportFiles()
			if err != nil {
				log.Printf("[mixed-report] generate files failed: %v", err)
				time.Sleep(2 * time.Second)
				continue
			}

			pngPublicURL, err := BuildReportPublicURL(result.PNGPath)
			if err != nil {
				log.Printf("[mixed-report] build png public url failed: %v", err)
				time.Sleep(2 * time.Second)
				continue
			}

			pdfPublicURL, err := BuildReportPublicURL(result.PDFPath)
			if err != nil {
				log.Printf("[mixed-report] build pdf public url failed: %v", err)
				time.Sleep(2 * time.Second)
				continue
			}

			if err := SendReportToLINE(result.PNGPath, pngPublicURL, result.PDFPath, pdfPublicURL); err != nil {
				log.Printf("[mixed-report] line send failed: %v", err)
				time.Sleep(2 * time.Second)
				continue
			}

			log.Printf("[mixed-report] success: png=%s pdf=%s", result.PNGPath, result.PDFPath)
			time.Sleep(2 * time.Second)
		}
	}()
}