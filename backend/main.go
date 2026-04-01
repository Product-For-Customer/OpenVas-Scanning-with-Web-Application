package main

import (
	"log"
	"net/http"

	"github.com/Tawunchai/openvas/config"
	"github.com/Tawunchai/openvas/controller/auth"
	"github.com/Tawunchai/openvas/controller/automation"
	"github.com/Tawunchai/openvas/controller/line"
	"github.com/Tawunchai/openvas/controller/location"
	"github.com/Tawunchai/openvas/controller/otp"
	"github.com/Tawunchai/openvas/controller/own"
	"github.com/Tawunchai/openvas/controller/report"
	"github.com/Tawunchai/openvas/controller/user"
	"github.com/Tawunchai/openvas/controller/vulnerability"
	middlewares "github.com/Tawunchai/openvas/middleware"
	"github.com/gin-gonic/gin"
)

const PORT = "9000"

func main() {
	config.ConnectDB()
	config.SetupDatabase()
	config.SeedDatabase()

	go line.StartLineStatusListener()

	r := gin.Default()
	r.Use(CORSMiddleware())

	r.GET("/", func(c *gin.Context) {
		c.String(http.StatusOK, "API RUNNING... PORT: %s", PORT)
	})

	// ===== Public Auth Routes =====
	r.POST("/auth/login", auth.Login)
	r.POST("/send-otp-signup", auth.SendOTPForSignUp)
	r.POST("/verify-otp-signup", auth.VerifyOTPSignUp)
	r.POST("/check-user-email", auth.CheckUserEmail)
	r.POST("/send-otp", otp.SendOTP)
	r.POST("/verify-otp-password", otp.VerifyOTPAddUpdatePassword)
	r.POST("/auth/logout", auth.Logout)

	// เปิดให้รูปที่แคปไว้เข้าถึงผ่าน URL
	r.Static("/public/reports", "./tmp/reports")
	// ==== Report Capture =====
	r.GET("/automation/report/test-send", report.TriggerCaptureAndSendReport)

	// ===== Public Routes =====
	r.GET("/line/test", line.TestSendLineHandler)
	r.POST("/automation/feed/update", automation.TriggerFeedUpdateHandler)
	r.GET("/automation/feed/status", automation.GetFeedUpdateStatusHandler)
	r.GET("/api/report", report.GetReportCSVSourceHandler)
	r.POST("/line/webhook/notification", line.CreateAppNotificationByLine)

	//==== Report Data for Frontend =====
	r.GET("/summary-vulnerability-report", vulnerability.ListTaskVulnSummary)
	r.GET("/critical-report", report.ListCriticalForReport)
	r.GET("/devices/risk-report", vulnerability.ListDeviceRisk)
	r.GET("/target-differ-report", vulnerability.ListTargetDiffer)
	r.GET("/download-pdf", report.DownloadPDF)
	r.GET("/send-pdf-to-line", report.SendPDFToLine)
	r.GET("/app-report", report.ListAppReport)

	// ===== Protected Routes =====
	authorized := r.Group("")
	authorized.Use(middlewares.Authorizes())
	{
		authorized.GET("/auth/me", auth.Me)

		// ===== Protected Routes for Vulnerability Management Authorization =====
		authorized.GET("/tasks/status", vulnerability.ListStatus)                                      // complete
		authorized.GET("/vulnerabilities/list", vulnerability.ListVulnerability)                       // complete
		authorized.GET("/assets/risk", vulnerability.ListAssetRisk)                                    // complete
		authorized.GET("/devices/risk", vulnerability.ListDeviceRisk)                                  // complete
		authorized.GET("/vulnerabilities/detail/by-name", vulnerability.ListVulnerabilityDetailByName) // complete
		authorized.GET("/vulnerabilities/:task_id", vulnerability.ListVulnerabilityByTaskID)           // complete
		authorized.GET("/target-differ", vulnerability.ListTargetDiffer)
		authorized.GET("/vulnerabilities/level/:level", vulnerability.ListVulnerabilityByLevel)
		authorized.GET("/tasks/summary-vulnerability", vulnerability.ListTaskVulnSummary)

		// ===== Location =====
		authorized.GET("/locations", location.ListLocation)
		authorized.GET("/locations/:id", location.ListLocationByID)
		authorized.POST("/create-locations", location.CreateLocation)
		authorized.PATCH("/update-locations/:id", location.UpdateLocationByID)
		authorized.DELETE("/delete-locations/:id", location.DeleteLocationByID)

		// ===== Protected Routes for Line Notify History Authorization =====
		authorized.GET("/history-notifies", line.ListHistoryNotify)
		authorized.DELETE("/delete-history-notifies", line.DeleteHistoryNotifyByIDs)

		// ===== Protected Routes for User Management Authorization =====
		authorized.GET("/users", user.ListUser)
		authorized.GET("/users/:id", user.ListUserByID)
		authorized.PATCH("/update-users/:id", user.UpdateUserByID)
		authorized.DELETE("/delete-users/:id", user.DeleteUserByID)
		authorized.POST("/create-users", user.CreateUser)
		authorized.GET("/roles", user.ListRoles)
		authorized.PATCH("/admin/users/:id", user.UpdateUserIDByAdmin)

		// ===== Protected Routes for OTP Management Authorization =====
		authorized.GET("/send-emails", otp.ListSendEmail)
		authorized.PUT("/send-email/:id", otp.UpdateSendEmailByID)

		// ===== Protected Routes for Line Master Authorization =====
		authorized.GET("/app-line-masters", line.ListAppLineMaster)
		authorized.POST("/create-app-line-masters", line.CreateAppLineMaster)
		authorized.PATCH("/update-app-line-masters/:id", line.UpdateAppLineMasterByID)
		authorized.DELETE("/delete-app-line-masters/:id", line.DeleteAppLineMasterByID)
		authorized.POST("/line/test-notify", line.TestLineNotifyByAppNotificationID)

		// ===== Protected Routes for Line Notifications Authorization =====
		authorized.GET("/app-notifications", line.ListAppNotification)
		authorized.POST("/create-app-notifications", line.CreateAppNotification)
		authorized.PATCH("/update-app-notifications/:id", line.UpdateAppNotificationByID)
		authorized.DELETE("/delete-app-notifications/:id", line.DeleteAppNotificationByID)

		// ===== Own =====
		authorized.GET("/owns/user/:id", own.ListOwnByUserID)
		authorized.GET("/owns/tasks", own.ListTaskIDForOwn)
		authorized.POST("/create-owns", own.CreateOwn)
		authorized.DELETE("/delete-owns/:id", own.DeleteOwnByID)
		authorized.GET("/owns/task/:task_id", own.ListTaskByTaskID)

		// ===== Report Management =====
		authorized.PUT("/app-report/:id", report.UpdateAppReportByID)
	}

	log.Printf("✅ Server starting on port %s\n", PORT)

	if err := r.Run(":" + PORT); err != nil {
		log.Fatalf("❌ Failed to run server: %v", err)
	}
}

func CORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")

		allowedOrigins := map[string]bool{
			"http://localhost:5174":           true,
			"http://127.0.0.1:5174":           true,
			"http://localhost:5173":           true,
			"http://127.0.0.1:5173":           true,
			"http://localhost:3000":           true,
			"http://127.0.0.1:3000":           true,
			"http://frontend":                 true,
			"https://openvaswebv1.vercel.app": true,
		}

		if allowedOrigins[origin] {
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
		}

		c.Writer.Header().Set("Vary", "Origin")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set(
			"Access-Control-Allow-Headers",
			"Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With, X-Automation-Token, ngrok-skip-browser-warning",
		)
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE, PATCH")
		c.Writer.Header().Set("Access-Control-Max-Age", "86400")

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}
