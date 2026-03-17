package report

import (
	"net/http"

	"github.com/Tawunchai/openvas/services"
	"github.com/gin-gonic/gin"
)

func TriggerCaptureAndSendReport(c *gin.Context) {
	result, err := services.GenerateMixedReportFiles()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "generate report files failed",
			"details": err.Error(),
		})
		return
	}

	pngPublicURL, err := services.BuildReportPublicURL(result.PNGPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":    "build png public url failed",
			"details":  err.Error(),
			"png_path": result.PNGPath,
		})
		return
	}

	pdfPublicURL, err := services.BuildReportPublicURL(result.PDFPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":    "build pdf public url failed",
			"details":  err.Error(),
			"pdf_path": result.PDFPath,
		})
		return
	}

	if err := services.SendReportToLINE(result.PNGPath, pngPublicURL, result.PDFPath, pdfPublicURL); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "line send failed",
			"details": err.Error(),
			"files": gin.H{
				"png_path": result.PNGPath,
				"pdf_path": result.PDFPath,
			},
			"urls": gin.H{
				"png_url": pngPublicURL,
				"pdf_url": pdfPublicURL,
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "generate report and line send success",
		"files": gin.H{
			"png_path": result.PNGPath,
			"pdf_path": result.PDFPath,
		},
		"urls": gin.H{
			"png_url": pngPublicURL,
			"pdf_url": pdfPublicURL,
		},
	})
}