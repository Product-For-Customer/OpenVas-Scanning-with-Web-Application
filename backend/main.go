package main

import (
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/Tawunchai/openvas/config"
	"github.com/Tawunchai/openvas/controller/auth"
	"github.com/Tawunchai/openvas/controller/automation"
	"github.com/Tawunchai/openvas/controller/compliance"
	"github.com/Tawunchai/openvas/controller/diagram"
	"github.com/Tawunchai/openvas/controller/passwordpolicy"
	"github.com/Tawunchai/openvas/controller/gmp"
	"github.com/Tawunchai/openvas/controller/host"
	"github.com/Tawunchai/openvas/controller/line"
	"github.com/Tawunchai/openvas/controller/location"
	"github.com/Tawunchai/openvas/controller/otp"
	"github.com/Tawunchai/openvas/controller/report"
	"github.com/Tawunchai/openvas/controller/risk"
	"github.com/Tawunchai/openvas/controller/threat"
	"github.com/Tawunchai/openvas/controller/user"
	"github.com/Tawunchai/openvas/controller/vulnerability"
	middlewares "github.com/Tawunchai/openvas/middleware"
	"github.com/gin-gonic/gin"
)

func main() {
	config.ConnectDB() // เชื่อมต่อฐานข้อมูล
	config.SetupDatabase() // สร้างตารางและข้อมูลเริ่มต้น
	config.SeedDatabase() // เติมข้อมูลเริ่มต้นเพิ่มเติม

	go line.StartLineStatusListener()
	go automation.StartDailyFeedUpdateScheduler()
	go threat.StartKEVSyncScheduler() // เริ่ม scheduler ซิงค์ CISA KEV catalog ทุกวัน
	go risk.StartEPSSSyncScheduler()
	middlewares.StartRateLimitCleanup()

	port := os.Getenv("PORT")
	if port == "" {
		port = "9000"
	}

	r := gin.Default()
	r.Use(CORSMiddleware())
	r.Use(middlewares.RateLimiter())

	r.GET("/", func(c *gin.Context) {
		c.String(http.StatusOK, "API RUNNING... PORT: %s", port)
	})

	// ==== Public Auth Routes ====
	r.POST("/auth/login", auth.Login) // ใช้สำหรับเข้าสู่ระบบด้วย email และ password
	r.POST("/send-otp-signup", auth.SendOTPForSignUp) // ใช้สำหรับส่ง OTP เมื่อผู้ใช้ต้องการสมัครสมาชิกใหม่
	r.POST("/verify-otp-signup", auth.VerifyOTPSignUp) // ใช้สำหรับตรวจสอบ OTP และสร้างบัญชีผู้ใช้ใหม่เมื่อสมัครสมาชิก
	r.POST("/check-user-email", auth.CheckUserEmail) // ใช้สำหรับตรวจสอบว่ามีผู้ใช้ที่ลงทะเบียนด้วยอีเมลนี้แล้วหรือไม่ (สำหรับการต้องการเปลี่ยนรหัสผ่าน)
	r.POST("/send-otp", otp.SendOTP) // ใช้สำหรับส่ง OTP เมื่อผู้ใช้ต้องการเปลี่ยนรหัสผ่าน
	r.POST("/verify-otp-password", otp.VerifyOTPAddUpdatePassword) // ใช้สำหรับตรวจสอบ OTP และอัปเดตรหัสผ่านใหม่เมื่อผู้ใช้ต้องการเปลี่ยนรหัสผ่าน
	r.POST("/auth/logout", auth.Logout) // ใช้สำหรับออกจากระบบโดยการลบคุกกี้ auth_token
	r.GET("/email-phone-numbers", user.ListEmailAndPhoneNumber) // ใช้สำหรับดึงรายชื่ออีเมลและหมายเลขโทรศัพท์ของผู้ใช้ทั้งหมด

	// เปิดให้รูปที่แคปไว้เข้าถึงผ่าน URL
	r.Static("/public/reports", "./tmp/reports")

	// ===== Public Routes =====
	r.POST("/automation/feed/update", automation.TriggerFeedUpdateHandler)
	r.POST("/line/webhook/notification", line.CreateAppNotificationByLine)

	//==== Report Data for Frontend =====
	r.GET("/summary-vulnerability-report", vulnerability.ListTaskVulnSummary)
	r.GET("/critical-report", report.ListCriticalForReport)
	r.GET("/devices/risk-report", report.ListDeviceRiskForReport)
	r.GET("/target-differ-report", report.ListTargetDiffer)
	r.GET("/report/vulnerability-month", report.ListDataForReportVulnerabilityMonth)
	r.GET("/download-pdf", report.DownloadPDF)
	r.GET("/send-pdf-to-line", report.SendPDFToLine)
	r.GET("/app-report", report.ListAppReport)
	r.GET("/reports/all/:task_id", vulnerability.ListALLReportByTaskID)

	// ===== Protected Routes =====
	authorized := r.Group("")
	authorized.Use(middlewares.Authorizes())
	{
		authorized.GET("/auth/me", auth.Me)

		// ===== Protected Routes for Vulnerability Management Authorization =====
		authorized.GET("/tasks/status", vulnerability.ListStatus) // complete
		authorized.GET("/vulnerabilities/list", vulnerability.ListVulnerability) // complete
		authorized.GET("/assets/risk", vulnerability.ListAssetRisk) // complete
		authorized.GET("/devices/risk", vulnerability.ListDeviceRisk) // complete
		authorized.GET("/vulnerabilities/detail/by-name", vulnerability.ListVulnerabilityDetailByName) //complete
		authorized.GET("/vulnerabilities/:task_id", vulnerability.ListVulnerabilityByTaskID) // complete
		authorized.GET("/target-differ", vulnerability.ListTargetDiffer) // complete
		authorized.GET("/vulnerabilities/level/:level", vulnerability.ListVulnerabilityByLevel) // complete
		authorized.GET("/all-targets", vulnerability.ListALLTarget) // complete

		// ===== Location =====
		authorized.GET("/locations", location.ListLocation) // complete
		authorized.GET("/locations/:id", location.ListLocationByID)  // complete
		authorized.POST("/create-locations", location.CreateLocation) // complete
		authorized.PATCH("/update-locations/:id", location.UpdateLocationByID) // complete
		authorized.DELETE("/delete-locations/:id", location.DeleteLocationByID) // complete

		// ===== Protected Routes for Line Notify History Authorization =====
		authorized.GET("/history-notifies", line.ListHistoryNotify) // complete
		authorized.DELETE("/delete-history-notifies", line.DeleteHistoryNotifyByIDs) // complete

		// ===== Protected Routes for User Management Authorization =====
		authorized.GET("/users", user.ListUser) // complete
		authorized.GET("/users/:id", user.ListUserByID) // complete
		authorized.PATCH("/update-users/:id", user.UpdateUserByID) // complete
		authorized.DELETE("/delete-users/:id", user.DeleteUserByID) // complete
		authorized.POST("/create-users", user.CreateUser) // complete
		authorized.GET("/roles", user.ListRoles) // complete
		authorized.PATCH("/admin/users/:id", user.UpdateUserIDByAdmin) // complete

		// ===== Protected Routes for OTP Management Authorization =====
		authorized.GET("/send-emails", otp.ListSendEmail) // complete
		authorized.PUT("/send-email/:id", otp.UpdateSendEmailByID) // complete

		// ===== Protected Routes for Line Master Authorization =====
		authorized.GET("/app-line-masters", line.ListAppLineMaster) // complete
		authorized.POST("/create-app-line-masters", line.CreateAppLineMaster) // complete 
		authorized.PATCH("/update-app-line-masters/:id", line.UpdateAppLineMasterByID) // complete
		authorized.DELETE("/delete-app-line-masters/:id", line.DeleteAppLineMasterByID) // complete
		authorized.POST("/line/test-notify", line.TestLineNotifyByAppNotificationID) // complete

		// ===== Protected Routes for Line Notifications Authorization =====
		authorized.GET("/app-notifications", line.ListAppNotification) // complete
		authorized.POST("/create-app-notifications", line.CreateAppNotification) // complete
		authorized.PATCH("/update-app-notifications/:id", line.UpdateAppNotificationByID) // complete
		authorized.DELETE("/delete-app-notifications/:id", line.DeleteAppNotificationByID) // complete

		// ===== Report Management =====
		authorized.PUT("/app-report/:id", report.UpdateAppReportByID) // complete

		// ===== Diagram Management =====
		authorized.GET("/diagrams", diagram.ListDiagrams) 
		authorized.GET("/diagrams/:id", diagram.ListDiagramByID) 
		authorized.POST("/create-diagrams", diagram.CreateDiagram) 
		authorized.PATCH("/update-diagrams/:id", diagram.UpdateDiagramByID) 
		authorized.DELETE("/delete-diagrams/:id", diagram.DeleteDiagramByID) 

		// ===== Diagram Node Management =====
		authorized.GET("/diagram-nodes", diagram.ListAppDiagramNodes)
		authorized.GET("/diagram-nodes/:id", diagram.ListAppDiagramNodeByID)
		authorized.POST("/create-diagram-nodes", diagram.CreateAppDiagramNode)
		authorized.PATCH("/update-diagram-nodes/:id", diagram.UpdateAppDiagramNodeByID)
		authorized.DELETE("/delete-diagram-nodes/:id", diagram.DeleteAppDiagramNodeByID)

		// ===== Threat Intelligence (KEV + NVD) =====
		authorized.GET("/threats/kev", threat.ListKEVCatalog)
		authorized.GET("/threats/kev/check", threat.CheckKEVByCVEIDs)
		authorized.GET("/threats/kev/summary", threat.GetKEVSummary)
		authorized.GET("/threats/kev/status", threat.GetKEVSyncStatus)
		authorized.POST("/threats/kev/sync", threat.TriggerKEVSync)
		authorized.GET("/threats/cve/enrich", threat.EnrichCVEs)

		// ===== GMP Scan Management =====
		authorized.GET("/gmp/status", gmp.GetGMPStatus)
		authorized.GET("/gmp/tasks", gmp.ListGMPTasks)
		authorized.POST("/gmp/tasks", gmp.CreateGMPTask)
		authorized.POST("/gmp/tasks/:id/start", gmp.StartGMPTask)
		authorized.POST("/gmp/tasks/:id/stop", gmp.StopGMPTask)
		authorized.DELETE("/gmp/tasks/:id", gmp.DeleteGMPTask)
		authorized.GET("/gmp/targets", gmp.ListGMPTargets)
		authorized.POST("/gmp/targets", gmp.CreateGMPTarget)
		authorized.DELETE("/gmp/targets/:id", gmp.DeleteGMPTarget)
		authorized.GET("/gmp/scanners", gmp.ListGMPScanners)
		authorized.GET("/gmp/configs", gmp.ListGMPConfigs)

		// ===== Risk Score Engine =====
		authorized.GET("/risk/summary", risk.GetRiskSummary)
		authorized.GET("/risk/epss/status", risk.GetEPSSStatus)
		authorized.POST("/risk/epss/sync", risk.TriggerEPSSSync)
		authorized.GET("/risk/asset-criticality", risk.ListAssetCriticality)
		authorized.GET("/risk/asset-criticality/:id", risk.GetAssetCriticality)
		authorized.POST("/risk/asset-criticality", risk.CreateAssetCriticality)
		authorized.PATCH("/risk/asset-criticality/:id", risk.UpdateAssetCriticality)
		authorized.DELETE("/risk/asset-criticality/:id", risk.DeleteAssetCriticality)

		// ===== Compliance Framework =====
		authorized.GET("/compliance/report", compliance.GetComplianceReport)
		authorized.GET("/compliance/violations", compliance.GetComplianceViolations)

		// ===== Password Policy =====
		authorized.GET("/password-policy", passwordpolicy.GetPolicy)
		authorized.PATCH("/password-policy", passwordpolicy.UpdatePolicy)

		// ===== Vulnerability Delta Enhanced =====
		authorized.GET("/vulnerabilities/delta/enhanced", vulnerability.ListVulnerabilityDelta)

		// ===== Host 360° Summary =====
		authorized.GET("/host/:ip/summary", host.GetHostSummary)
		authorized.GET("/vulnerabilities/sla-breaches", host.GetSLABreaches)
		authorized.GET("/attack-surface/matrix", host.GetAttackSurfaceMatrix)

	}

	log.Printf("✅ Server starting on port %s\n", port)

	if err := r.Run(":" + port); err != nil {
		log.Fatalf("❌ Failed to run server: %v", err)
	}
}

func CORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")

		allowedOrigins := map[string]bool{
			"http://localhost:5173": true,
			"http://frontend":       true,
		}

		envOrigins := os.Getenv("CORS_ALLOWED_ORIGINS")
		if envOrigins != "" {
			for _, item := range strings.Split(envOrigins, ",") {
				trimmedOrigin := strings.TrimSpace(item)
				if trimmedOrigin != "" {
					allowedOrigins[trimmedOrigin] = true
				}
			}
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