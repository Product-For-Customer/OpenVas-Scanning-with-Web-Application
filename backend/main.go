package main

import (
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/Tawunchai/openvas/config"
	"github.com/Tawunchai/openvas/controller/auditlog"
	"github.com/Tawunchai/openvas/controller/auth"
	"github.com/Tawunchai/openvas/controller/automation"
	"github.com/Tawunchai/openvas/controller/compliance"
	"github.com/Tawunchai/openvas/controller/diagram"
	"github.com/Tawunchai/openvas/controller/discovery"
	"github.com/Tawunchai/openvas/controller/passwordpolicy"
	"github.com/Tawunchai/openvas/controller/gmp"
	"github.com/Tawunchai/openvas/controller/host"
	"github.com/Tawunchai/openvas/controller/line"
	"github.com/Tawunchai/openvas/controller/location"
	"github.com/Tawunchai/openvas/controller/otp"
	"github.com/Tawunchai/openvas/controller/report"
	"github.com/Tawunchai/openvas/controller/risk"
	"github.com/Tawunchai/openvas/controller/role"
	"github.com/Tawunchai/openvas/controller/schedule"
	"github.com/Tawunchai/openvas/controller/setting"
	"github.com/Tawunchai/openvas/controller/threat"
	totpctrl "github.com/Tawunchai/openvas/controller/totp"
	"github.com/Tawunchai/openvas/controller/feedschedule"
	"github.com/Tawunchai/openvas/controller/user"
	"github.com/Tawunchai/openvas/controller/vulnerability"
	"github.com/Tawunchai/openvas/controller/webscan"
	middlewares "github.com/Tawunchai/openvas/middleware"
	"github.com/Tawunchai/openvas/services"
	"github.com/gin-gonic/gin"
)

func main() {
	// Fail fast at boot instead of crashing mid-request on first login —
	// GetJWTSecret() itself log.Fatal()s if JWT_SECRET is unset.
	services.GetJWTSecret()
	gmp.RequireGVMCredentials() // logs a warning (does not block startup) if still using gvmd's default admin/admin credentials
	webscan.RequireZAPAPIKey()  // logs a warning (does not block startup) if the ZAP scanner API key is unset

	config.ConnectDB()     // เชื่อมต่อฐานข้อมูล
	config.SetupDatabase() // สร้างตารางและข้อมูลเริ่มต้น
	config.SeedDatabase()  // เติมข้อมูลเริ่มต้นเพิ่มเติม
	setting.InitTimezoneCache() // โหลด timezone จาก DB เข้า memory cache

	go line.StartLineStatusListener()
	go line.StartHistoryNotifyAutoCleanup()
	go auditlog.StartAuditLogAutoCleanup()
	go automation.StartDailyFeedUpdateScheduler()
	go threat.StartKEVSyncScheduler() // เริ่ม scheduler ซิงค์ CISA KEV catalog ทุกวัน
	go risk.StartEPSSSyncScheduler()
	go schedule.StartAutoScanScheduler()       // เริ่ม auto scan scheduler ตรวจทุก 1 นาที
	go feedschedule.StartFeedUpdateScheduler() // เริ่ม feed update scheduler ที่ config ได้
	go report.StartReportCleanupScheduler()    // ลบไฟล์ PDF ที่ generate ไว้ชั่วคราวเมื่อเก่าเกินไป
	go report.StartReportDigestScheduler()     // ส่งรายงานสรุปอัตโนมัติ (email/LINE) ตามเวลาที่ตั้งไว้
	middlewares.StartRateLimitCleanup()
	services.StartOTPLockoutCleanup()
	services.StartAccountLockoutCleanup()

	port := os.Getenv("PORT")
	if port == "" {
		port = "9000"
	}

	r := gin.Default()

	// ── Trusted proxy configuration ─────────────────────────────────────────
	// By default gin trusts ALL proxies, meaning it derives the client IP from
	// the attacker-controllable X-Forwarded-For / X-Real-IP headers. Because
	// the backend is published directly (see docker-compose: "9000:9000") with
	// no reverse proxy in front, a caller can spoof those headers to get a
	// fresh per-IP rate-limit window on every request — defeating the auth
	// brute-force protection. We therefore trust NO proxy by default, so
	// c.ClientIP() falls back to the real TCP peer address. When you DO deploy
	// behind a trusted reverse proxy, list its address(es) in TRUSTED_PROXIES
	// (comma-separated) so forwarded-for parsing is re-enabled only for it.
	if tp := strings.TrimSpace(os.Getenv("TRUSTED_PROXIES")); tp != "" {
		var proxies []string
		for _, p := range strings.Split(tp, ",") {
			if p = strings.TrimSpace(p); p != "" {
				proxies = append(proxies, p)
			}
		}
		if err := r.SetTrustedProxies(proxies); err != nil {
			log.Fatalf("❌ invalid TRUSTED_PROXIES: %v", err)
		}
		log.Printf("🔒 Trusting forwarded headers only from: %v", proxies)
	} else {
		// Trust none: X-Forwarded-For / X-Real-IP are ignored and the real
		// TCP peer is used as the client IP for rate limiting.
		if err := r.SetTrustedProxies(nil); err != nil {
			log.Fatalf("❌ failed to disable trusted proxies: %v", err)
		}
	}

	r.MaxMultipartMemory = middlewares.MaxRequestBodyBytes
	r.Use(CORSMiddleware())
	r.Use(middlewares.LimitRequestBody())
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
	r.POST("/auth/totp/verify-login",       auth.VerifyTOTPLoginHandler)      // PUBLIC: TOTP verify after password login
	r.POST("/auth/verify-email-otp",         auth.VerifyEmailLoginOTPHandler)  // PUBLIC: email OTP verify after password login
	r.GET("/auth/service-settings",          auth.GetServiceSettingsHandler)   // PUBLIC: OTP service flags for auth page
	r.POST("/auth/direct-signup",            auth.DirectSignUpHandler)         // PUBLIC: register without OTP
	r.POST("/auth/direct-reset-password",    auth.DirectResetPasswordHandler)  // PUBLIC: reset password without OTP
	r.GET("/settings",                       setting.GetSettings)              // PUBLIC: app settings (timezone, etc.)
	r.GET("/maintenance/status",             setting.GetMaintenanceStatus)     // PUBLIC: polled for the auto-logout countdown modal
	r.GET("/password-policy",                passwordpolicy.GetPolicy)         // PUBLIC: rules shown live on Register/Reset Password forms
	r.POST("/check-email-available", user.CheckEmailAvailable) // PUBLIC: returns {available:bool} for ONE email at a time — replaces the old bulk /existing-emails dump; used by Register's pre-session duplicate-email check

	// Generated report PDFs. This MUST stay public because LINE's servers fetch
	// the file from this URL when a report is pushed to a LINE chat (they have
	// no session). The exposure is bounded three ways: filenames carry an
	// unguessable 64-bit crypto-random suffix (see report.randomFileSuffix), so
	// the URL is effectively a bearer capability that can't be brute-forced;
	// files are auto-deleted after 2h (StartReportCleanupScheduler); and the
	// headers below tell proxies/CDNs not to cache and search engines not to
	// index a URL that happens to leak (e.g. via the ngrok tunnel or LINE logs).
	// Directory listing is off (gin.Static uses Dir(root,false)).
	reportsFS := r.Group("/public/reports")
	reportsFS.Use(func(c *gin.Context) {
		c.Header("Cache-Control", "no-store, private, max-age=0")
		c.Header("X-Robots-Tag", "noindex, nofollow")
		c.Header("X-Content-Type-Options", "nosniff")
		c.Next()
	})
	reportsFS.StaticFS("/", gin.Dir("./tmp/reports", false))

	// ===== Public Routes =====
	r.POST("/automation/feed/update", automation.TriggerFeedUpdateHandler)
	r.POST("/line/webhook/notification", line.CreateAppNotificationByLine)

	//==== Report Data for Frontend =====
	// CaptureOrAuth: these must stay reachable by the headless PDF-capture page
	// (which has no login session), but no longer by a truly anonymous caller —
	// see report.CaptureOrAuth for the session-or-capture-token gate.
	r.GET("/summary-vulnerability-report", report.CaptureOrAuth(), vulnerability.ListTaskVulnSummary)
	r.GET("/critical-report", report.CaptureOrAuth(), report.ListCriticalForReport)
	r.GET("/devices/risk-report", report.CaptureOrAuth(), report.ListDeviceRiskForReport)
	r.GET("/target-differ-report", report.CaptureOrAuth(), report.ListTargetDiffer)
	r.GET("/report/vulnerability-month", report.CaptureOrAuth(), report.ListDataForReportVulnerabilityMonth)
	r.GET("/download-pdf", report.DownloadPDF)
	r.GET("/app-report", report.ListAppReport)
	r.GET("/reports/all/:task_id", report.CaptureOrAuth(), vulnerability.ListALLReportByTaskID)

	// ===== Protected Routes =====
	authorized := r.Group("")
	authorized.Use(middlewares.Authorizes())
	authorized.Use(middlewares.EnforcePermissions())
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
		authorized.GET("/history-notifies", line.ListHistoryNotify)                   // complete
		authorized.DELETE("/delete-history-notifies", line.DeleteHistoryNotifyByIDs)  // complete
		authorized.POST("/history-notifies/cleanup", line.TriggerHistoryNotifyCleanup) // manual 6-month cleanup

		// Any authenticated user (not just user_management roles) needs this for
		// their own Account page's duplicate email/phone check — see
		// selfServiceOpenPaths in middleware/readonly.go.
		authorized.GET("/email-phone-numbers", user.ListEmailAndPhoneNumber)

		// ===== Protected Routes for User Management Authorization =====
		authorized.GET("/users", user.ListUser) // complete
		authorized.GET("/users/:id", user.ListUserByID) // complete
		authorized.PATCH("/update-users/:id", user.UpdateUserByID) // complete
		authorized.DELETE("/delete-users/:id", user.DeleteUserByID) // complete
		authorized.POST("/create-users", user.CreateUser) // complete
		authorized.GET("/roles", user.ListRoles) // complete
		authorized.PATCH("/admin/users/:id", user.UpdateUserIDByAdmin) // complete

		// ===== Dynamic Role & Permission Management =====
		authorized.GET("/permission-categories", role.ListPermissionCategories)
		authorized.GET("/roles/:id", role.GetRole)
		authorized.POST("/roles", role.CreateRole)
		authorized.PATCH("/roles/:id", role.UpdateRole)
		authorized.DELETE("/roles/:id", role.DeleteRole)

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

		// ===== Auto-Report Digest (scheduled report → email/LINE) =====
		authorized.GET("/report-digests", report.ListDigestSchedules)
		authorized.POST("/report-digests", report.CreateDigestSchedule)
		authorized.PATCH("/report-digests/:id", report.UpdateDigestSchedule)
		authorized.DELETE("/report-digests/:id", report.DeleteDigestSchedule)
		authorized.POST("/report-digests/:id/run", report.RunDigestNow)

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
		authorized.GET("/gmp/feeds", gmp.GetGMPFeeds)
		// Trash / Recycle Bin
		authorized.GET("/gmp/trash",                     gmp.GetGMPTrash)
		authorized.POST("/gmp/trash/restore/:id",        gmp.RestoreGMPTrash)
		authorized.DELETE("/gmp/trash",                  gmp.EmptyGMPTrash)
		authorized.DELETE("/gmp/trash/task/:id",         gmp.DeleteGMPTrashTask)
		authorized.DELETE("/gmp/trash/target/:id",       gmp.DeleteGMPTrashTarget)
		authorized.DELETE("/gmp/trash/credential/:id",   gmp.DeleteGMPTrashCredential)
		authorized.DELETE("/gmp/trash/portlist/:id",     gmp.DeleteGMPTrashPortList)

		// Port Lists
		authorized.GET("/gmp/port-lists", gmp.ListGMPPortLists)
		authorized.POST("/gmp/port-lists", gmp.CreateGMPPortList)
		authorized.POST("/gmp/port-lists/import", gmp.ImportGMPPortList)
		authorized.PATCH("/gmp/port-lists/:id", gmp.UpdateGMPPortList)
		authorized.DELETE("/gmp/port-lists/:id", gmp.DeleteGMPPortList)
			authorized.GET("/gmp/port-lists/:id", gmp.GetGMPPortListDetail)
			authorized.POST("/gmp/port-lists/:id/ranges", gmp.CreateGMPPortRange)
			authorized.DELETE("/gmp/port-lists/:id/ranges/:range_id", gmp.DeleteGMPPortRange)
		// Credentials
		authorized.GET("/gmp/credentials", gmp.ListGMPCredentials)
		authorized.POST("/gmp/credentials", gmp.CreateGMPCredential)
		authorized.PATCH("/gmp/credentials/:id", gmp.UpdateGMPCredential)
		authorized.DELETE("/gmp/credentials/:id", gmp.DeleteGMPCredential)
			authorized.GET("/gmp/tasks", gmp.ListGMPTasks)
			authorized.POST("/gmp/tasks", gmp.CreateGMPTask)
			authorized.POST("/gmp/tasks/:id/start", gmp.StartGMPTask)
			authorized.POST("/gmp/tasks/:id/stop", gmp.StopGMPTask)
			authorized.PATCH("/gmp/tasks/:id", gmp.UpdateGMPTask)
			authorized.DELETE("/gmp/tasks/:id", gmp.DeleteGMPTask)
		authorized.GET("/gmp/targets", gmp.ListGMPTargets)
		authorized.POST("/gmp/targets", gmp.CreateGMPTarget)
		authorized.PATCH("/gmp/targets/:id", gmp.UpdateGMPTarget)
		authorized.DELETE("/gmp/targets/:id", gmp.DeleteGMPTarget)
		authorized.GET("/gmp/scanners", gmp.ListGMPScanners)
		authorized.GET("/gmp/configs", gmp.ListGMPConfigs)

		// ===== App Settings (timezone, etc.) =====
		// GET /settings is public (registered above); PUT is protected
		authorized.PUT("/settings", setting.UpdateSetting)

		// ===== Auto Scan Schedule =====
		authorized.GET("/scan-schedules", schedule.ListSchedules)
		authorized.POST("/scan-schedules", schedule.CreateSchedule)
		authorized.PATCH("/scan-schedules/:id", schedule.UpdateSchedule)
		authorized.DELETE("/scan-schedules/:id", schedule.DeleteSchedule)

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
		authorized.GET("/compliance/control-vulns", compliance.GetControlVulnerabilities)

		// ===== Send PDF to Email / LINE =====
		// Both are interactive admin actions from the Report page (never called
		// by the headless PDF-capture flow), so a normal session is required —
		// send-pdf-to-line used to be fully public, letting anyone spam an
		// arbitrary app_notification_id with an unauthenticated GET request.
		// POST (not GET): these have real side effects (send an email / push to
		// LINE), so they must not be triggerable by a crafted <img>/link that a
		// logged-in admin merely loads (CSRF-via-GET). Task ids stay as query
		// params, which the handlers already read via c.Query.
		authorized.POST("/send-pdf-to-email", report.SendPDFToEmail)
		authorized.POST("/send-pdf-to-line", report.SendPDFToLine)

		// ===== Feed Update Schedules (configurable) =====
		authorized.GET("/feed-schedules", feedschedule.ListSchedules)
		authorized.PUT("/feed-schedules/:feed_type", feedschedule.UpdateSchedule)
		authorized.POST("/feed-schedules/:feed_type/trigger", feedschedule.TriggerFeedNow)

		// ===== Network Asset Discovery (Nmap) =====
		authorized.POST("/discovery/trigger", discovery.TriggerDiscoveryScanHandler)
		authorized.GET("/discovery/status", discovery.GetDiscoveryScanStatusHandler)
		authorized.GET("/discovery/hosts", discovery.ListDiscoveredHosts)
		authorized.PATCH("/discovery/hosts/:id/acknowledge", discovery.AcknowledgeDiscoveredHost)

		// ===== Web Application Scanning (OWASP ZAP) =====
		authorized.GET("/webscan/targets", webscan.ListWebScanTargets)
		authorized.POST("/webscan/targets", webscan.CreateWebScanTarget)
		authorized.PATCH("/webscan/targets/:id", webscan.UpdateWebScanTarget)
		authorized.DELETE("/webscan/targets/:id", webscan.DeleteWebScanTarget)
		authorized.POST("/webscan/targets/:id/scan", webscan.TriggerWebScan)
		authorized.GET("/webscan/status", webscan.GetWebScanStatus)
		authorized.POST("/webscan/stop", webscan.StopWebScan)
		authorized.GET("/webscan/results", webscan.ListWebScanResults)
		authorized.DELETE("/webscan/results/:id", webscan.DeleteWebScanResult)
		authorized.GET("/webscan/results/:id/findings", webscan.ListWebScanFindings)
		// B-2 HTTP security-header + TLS grade, B-3 tech fingerprint + EOL —
		// on-demand, in-process checks against an existing web scan target.
		authorized.GET("/webscan/targets/:id/http-audit", webscan.HTTPAudit)
		authorized.GET("/webscan/targets/:id/fingerprint", webscan.Fingerprint)

		// ===== TOTP (Authenticator App) =====
		authorized.GET("/auth/totp/status", totpctrl.GetTOTPStatus)
		authorized.POST("/auth/totp/init",   totpctrl.InitTOTPSetup)
		authorized.POST("/auth/totp/verify", totpctrl.VerifyTOTPSetup)
		authorized.DELETE("/auth/totp",      totpctrl.DisableTOTP)

		// ===== Password Policy =====
		// GET is registered publicly above (r.GET) so the Register/Reset
		// Password pages can read it while unauthenticated.
		authorized.PATCH("/password-policy", passwordpolicy.UpdatePolicy)

		// ===== Vulnerability Delta Enhanced =====
		authorized.GET("/vulnerabilities/delta/enhanced", vulnerability.ListVulnerabilityDelta)

		// ===== Host 360° Summary =====
		authorized.GET("/host/:ip/summary", host.GetHostSummary)
		authorized.GET("/vulnerabilities/sla-breaches", host.GetSLABreaches)
		authorized.GET("/attack-surface/matrix", host.GetAttackSurfaceMatrix)

		// ===== Audit Log (admin + auditor, checked inside handler) =====
		authorized.GET("/audit-logs", auditlog.ListAuditLogs)
		authorized.POST("/audit-logs/cleanup", auditlog.TriggerAuditLogCleanup)

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
			"Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With, X-Automation-Token, X-Capture-Token, ngrok-skip-browser-warning",
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