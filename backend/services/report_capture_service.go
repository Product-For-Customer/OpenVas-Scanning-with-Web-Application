package services

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/chromedp/cdproto/page"
	"github.com/chromedp/chromedp"
)

type ReportFilesResult struct {
	PNGPath string `json:"png_path"`
	PDFPath string `json:"pdf_path"`
}

func GenerateFrontendReportFiles() (*ReportFilesResult, error) {
	targetURL := os.Getenv("FRONTEND_CAPTURE_URL")
	if targetURL == "" {
		targetURL = "http://frontend/capture"
	}

	outputDir := os.Getenv("REPORT_OUTPUT_DIR")
	if outputDir == "" {
		outputDir = "./tmp/reports"
	}

	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return nil, fmt.Errorf("create output dir failed: %w", err)
	}

	chromePath := os.Getenv("CHROME_PATH")

	timestamp := time.Now().Format("2006-01-02_15-04-05")
	pngPath := filepath.Join(outputDir, fmt.Sprintf("capture-report-%s.png", timestamp))
	pdfPath := filepath.Join(outputDir, fmt.Sprintf("capture-report-%s.pdf", timestamp))

	opts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.Flag("headless", true),
		chromedp.Flag("disable-gpu", true),
		chromedp.Flag("hide-scrollbars", true),
		chromedp.Flag("no-sandbox", true),
		chromedp.Flag("disable-dev-shm-usage", true),
		chromedp.WindowSize(1600, 900),
	)

	if chromePath != "" {
		opts = append(opts, chromedp.ExecPath(chromePath))
	}

	allocCtx, cancel := chromedp.NewExecAllocator(context.Background(), opts...)
	defer cancel()

	ctx, cancel := chromedp.NewContext(allocCtx)
	defer cancel()

	ctx, cancel = context.WithTimeout(ctx, 360*time.Second)
	defer cancel()

	var pngBuf []byte
	var pdfBuf []byte

	err := chromedp.Run(ctx,
		chromedp.Navigate(targetURL),
		chromedp.WaitVisible(`#capture-root`, chromedp.ByID),
		chromedp.Sleep(2*time.Second),

		// PNG
		chromedp.FullScreenshot(&pngBuf, 95),

		// PDF
		chromedp.ActionFunc(func(ctx context.Context) error {
			buf, _, err := page.PrintToPDF().
				WithPrintBackground(true).
				WithLandscape(false).
				WithPaperWidth(8.27).   // A4 width (inch)
				WithPaperHeight(11.69). // A4 height (inch)
				WithMarginTop(0.4).
				WithMarginBottom(0.4).
				WithMarginLeft(0.3).
				WithMarginRight(0.3).
				Do(ctx)
			if err != nil {
				return err
			}
			pdfBuf = buf
			return nil
		}),
	)
	if err != nil {
		return nil, fmt.Errorf("generate report files failed (url=%s): %w", targetURL, err)
	}

	if err := os.WriteFile(pngPath, pngBuf, 0644); err != nil {
		return nil, fmt.Errorf("write png file failed: %w", err)
	}

	if err := os.WriteFile(pdfPath, pdfBuf, 0644); err != nil {
		return nil, fmt.Errorf("write pdf file failed: %w", err)
	}

	return &ReportFilesResult{
		PNGPath: pngPath,
		PDFPath: pdfPath,
	}, nil
}