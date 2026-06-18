package threat

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/Tawunchai/openvas/config"
	"github.com/Tawunchai/openvas/entity"
	"github.com/gin-gonic/gin"
)

const (
	kevCatalogURL  = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"
	kevSyncTimeout = 60 * time.Second
)

var (
	kevSyncMu      sync.Mutex
	kevSyncing     bool
	kevLastSyncAt  time.Time
	kevLastSyncErr string
)

// ===========================
// CISA KEV JSON structures
// ===========================

type cisaKEVResponse struct {
	Title            string            `json:"title"`
	CatalogVersion   string            `json:"catalogVersion"`
	DateReleased     string            `json:"dateReleased"`
	Count            int               `json:"count"`
	Vulnerabilities  []cisaKEVEntry    `json:"vulnerabilities"`
}

type cisaKEVEntry struct {
	CVEID                      string `json:"cveID"`
	VendorProject              string `json:"vendorProject"`
	Product                    string `json:"product"`
	VulnerabilityName          string `json:"vulnerabilityName"`
	DateAdded                  string `json:"dateAdded"`
	ShortDescription           string `json:"shortDescription"`
	RequiredAction             string `json:"requiredAction"`
	DueDate                    string `json:"dueDate"`
	KnownRansomwareCampaignUse string `json:"knownRansomwareCampaignUse"`
	Notes                      string `json:"notes"`
}

// ===========================
// Response DTOs
// ===========================

type KEVEntryDTO struct {
	CVEID                      string  `json:"cve_id"`
	VendorProject              string  `json:"vendor_project"`
	Product                    string  `json:"product"`
	VulnerabilityName          string  `json:"vulnerability_name"`
	DateAdded                  string  `json:"date_added"`
	ShortDescription           string  `json:"short_description"`
	RequiredAction             string  `json:"required_action"`
	DueDate                    *string `json:"due_date"`
	KnownRansomwareCampaignUse string  `json:"known_ransomware_campaign_use"`
	Notes                      string  `json:"notes"`
	IsRansomwareRelated        bool    `json:"is_ransomware_related"`
}

type KEVSummaryDTO struct {
	TotalKEVCatalog    int          `json:"total_kev_catalog"`
	TotalKEVInScans    int          `json:"total_kev_in_scans"`
	RansomwareRelated  int          `json:"ransomware_related"`
	LastSyncedAt       string       `json:"last_synced_at"`
	LastSyncStatus     string       `json:"last_sync_status"`
	KEVByHost          []KEVByHost  `json:"kev_by_host"`
}

type KEVByHost struct {
	HostIP    string        `json:"host_ip"`
	TaskName  string        `json:"task_name"`
	KEVCount  int           `json:"kev_count"`
	CVEList   []KEVEntryDTO `json:"cve_list"`
}

type KEVSyncStatusDTO struct {
	IsSyncing  bool   `json:"is_syncing"`
	LastSyncAt string `json:"last_sync_at"`
	LastError  string `json:"last_error"`
	Total      int64  `json:"total"`
}

// ===========================
// Core Sync Logic
// ===========================

func SyncKEVCatalog() error {
	kevSyncMu.Lock()
	if kevSyncing {
		kevSyncMu.Unlock()
		return fmt.Errorf("kev sync already running")
	}
	kevSyncing = true
	kevLastSyncErr = ""
	kevSyncMu.Unlock()

	defer func() {
		kevSyncMu.Lock()
		kevSyncing = false
		kevLastSyncAt = time.Now()
		kevSyncMu.Unlock()
	}()

	log.Println("🔄 KEV: fetching CISA catalog...")

	client := &http.Client{Timeout: kevSyncTimeout}
	resp, err := client.Get(kevCatalogURL)
	if err != nil {
		msg := fmt.Sprintf("KEV fetch error: %v", err)
		log.Println("❌", msg)
		kevSyncMu.Lock()
		kevLastSyncErr = msg
		kevSyncMu.Unlock()
		return fmt.Errorf("%s", msg)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		msg := fmt.Sprintf("KEV fetch bad status: %s", resp.Status)
		log.Println("❌", msg)
		kevSyncMu.Lock()
		kevLastSyncErr = msg
		kevSyncMu.Unlock()
		return fmt.Errorf("%s", msg)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		msg := fmt.Sprintf("KEV read body error: %v", err)
		log.Println("❌", msg)
		kevSyncMu.Lock()
		kevLastSyncErr = msg
		kevSyncMu.Unlock()
		return fmt.Errorf("%s", msg)
	}

	var catalog cisaKEVResponse
	if err := json.Unmarshal(body, &catalog); err != nil {
		msg := fmt.Sprintf("KEV JSON parse error: %v", err)
		log.Println("❌", msg)
		kevSyncMu.Lock()
		kevLastSyncErr = msg
		kevSyncMu.Unlock()
		return fmt.Errorf("%s", msg)
	}

	db := config.DB()
	if db == nil {
		return fmt.Errorf("KEV sync: database is nil")
	}

	now := time.Now()
	batchSize := 200
	total := len(catalog.Vulnerabilities)

	for i := 0; i < total; i += batchSize {
		end := i + batchSize
		if end > total {
			end = total
		}

		batch := make([]entity.AppKEVCache, 0, end-i)
		for _, v := range catalog.Vulnerabilities[i:end] {
			entry := entity.AppKEVCache{
				CVEID:                      strings.TrimSpace(v.CVEID),
				VendorProject:              strings.TrimSpace(v.VendorProject),
				Product:                    strings.TrimSpace(v.Product),
				VulnerabilityName:          strings.TrimSpace(v.VulnerabilityName),
				ShortDescription:           strings.TrimSpace(v.ShortDescription),
				RequiredAction:             strings.TrimSpace(v.RequiredAction),
				KnownRansomwareCampaignUse: strings.TrimSpace(v.KnownRansomwareCampaignUse),
				Notes:                      strings.TrimSpace(v.Notes),
				LastSyncedAt:               now,
			}

			if t, err := time.Parse("2006-01-02", strings.TrimSpace(v.DateAdded)); err == nil {
				entry.DateAdded = t
			}

			if strings.TrimSpace(v.DueDate) != "" {
				if t, err := time.Parse("2006-01-02", strings.TrimSpace(v.DueDate)); err == nil {
					entry.DueDate = &t
				}
			}

			if entry.CVEID != "" {
				batch = append(batch, entry)
			}
		}

		if len(batch) > 0 {
			if err := db.Save(&batch).Error; err != nil {
				log.Printf("⚠️ KEV upsert batch error (i=%d): %v\n", i, err)
			}
		}
	}

	log.Printf("✅ KEV sync complete: %d entries upserted\n", total)
	return nil
}

// StartKEVSyncScheduler รัน sync KEV ทุกวันตี 3
func StartKEVSyncScheduler() {
	log.Println("🕑 KEV sync scheduler started")

	// Sync ครั้งแรกตอน startup (ไม่ต้องรอ)
	go func() {
		time.Sleep(10 * time.Second)
		if err := SyncKEVCatalog(); err != nil {
			log.Printf("⚠️ initial KEV sync error: %v\n", err)
		}
	}()

	location := time.FixedZone("Asia/Bangkok", 7*60*60)
	for {
		now := time.Now().In(location)
		next := time.Date(now.Year(), now.Month(), now.Day(), 3, 0, 0, 0, location)
		if !next.After(now) {
			next = next.Add(24 * time.Hour)
		}

		time.Sleep(time.Until(next))

		if err := SyncKEVCatalog(); err != nil {
			log.Printf("⚠️ scheduled KEV sync error: %v\n", err)
		}
	}
}

// ===========================
// Helper: convert entity → DTO
// ===========================

func entityToKEVDTO(e entity.AppKEVCache) KEVEntryDTO {
	dto := KEVEntryDTO{
		CVEID:                      e.CVEID,
		VendorProject:              e.VendorProject,
		Product:                    e.Product,
		VulnerabilityName:          e.VulnerabilityName,
		DateAdded:                  e.DateAdded.Format("2006-01-02"),
		ShortDescription:           e.ShortDescription,
		RequiredAction:             e.RequiredAction,
		KnownRansomwareCampaignUse: e.KnownRansomwareCampaignUse,
		Notes:                      e.Notes,
		IsRansomwareRelated:        strings.EqualFold(strings.TrimSpace(e.KnownRansomwareCampaignUse), "Known"),
	}
	if e.DueDate != nil {
		s := e.DueDate.Format("2006-01-02")
		dto.DueDate = &s
	}
	return dto
}

// ===========================
// Gin Handlers
// ===========================

// GET /threats/kev - คืน KEV catalog ทั้งหมด (พร้อม filter)
func ListKEVCatalog(c *gin.Context) {
	db := config.DB()
	if db == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database unavailable"})
		return
	}

	search := strings.TrimSpace(c.Query("search"))
	ransomwareOnly := c.Query("ransomware_only") == "true"

	query := db.Model(&entity.AppKEVCache{})

	if search != "" {
		like := "%" + search + "%"
		query = query.Where(
			"cve_id ILIKE ? OR vulnerability_name ILIKE ? OR vendor_project ILIKE ? OR product ILIKE ?",
			like, like, like, like,
		)
	}

	if ransomwareOnly {
		query = query.Where("LOWER(known_ransomware_campaign_use) = 'known'")
	}

	var entries []entity.AppKEVCache
	if err := query.Order("date_added DESC").Find(&entries).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	dtos := make([]KEVEntryDTO, 0, len(entries))
	for _, e := range entries {
		dtos = append(dtos, entityToKEVDTO(e))
	}

	c.JSON(http.StatusOK, dtos)
}

// GET /threats/kev/check?cve_ids=CVE-xxx,CVE-yyy - ตรวจสอบ CVE list ว่าอยู่ใน KEV ไหม
func CheckKEVByCVEIDs(c *gin.Context) {
	db := config.DB()
	if db == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database unavailable"})
		return
	}

	cveIDsRaw := strings.TrimSpace(c.Query("cve_ids"))
	if cveIDsRaw == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cve_ids query param required"})
		return
	}

	cveIDs := make([]string, 0)
	for _, id := range strings.Split(cveIDsRaw, ",") {
		if trimmed := strings.TrimSpace(strings.ToUpper(id)); trimmed != "" {
			cveIDs = append(cveIDs, trimmed)
		}
	}

	if len(cveIDs) == 0 {
		c.JSON(http.StatusOK, gin.H{})
		return
	}

	var entries []entity.AppKEVCache
	if err := db.Where("cve_id IN ?", cveIDs).Find(&entries).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	result := make(map[string]*KEVEntryDTO, len(entries))
	for _, e := range entries {
		dto := entityToKEVDTO(e)
		result[e.CVEID] = &dto
	}

	// CVE ที่ไม่อยู่ใน KEV ให้ return nil
	for _, id := range cveIDs {
		if _, ok := result[id]; !ok {
			result[id] = nil
		}
	}

	c.JSON(http.StatusOK, result)
}

// GET /threats/kev/summary - สรุป KEV ที่พบในข้อมูล scan
func GetKEVSummary(c *gin.Context) {
	db := config.DB()
	if db == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database unavailable"})
		return
	}

	// นับ total KEV catalog
	var totalKEV int64
	db.Model(&entity.AppKEVCache{}).Count(&totalKEV)

	var ransomwareCount int64
	db.Model(&entity.AppKEVCache{}).
		Where("LOWER(known_ransomware_campaign_use) = 'known'").
		Count(&ransomwareCount)

	// หา CVE list จาก scan results (จาก vt_refs ใน gvmd database)
	type CVEHostRow struct {
		CVEID    string `gorm:"column:cve_id"`
		HostIP   string `gorm:"column:host_ip"`
		TaskName string `gorm:"column:task_name"`
	}

	cveQuery := `
WITH LatestReports AS (
  SELECT DISTINCT ON (rp.task)
    rp.task AS task_id,
    rp.id AS report_id
  FROM public.reports rp
  ORDER BY rp.task, rp.creation_time DESC, rp.id DESC
)
SELECT DISTINCT
  UPPER(BTRIM(vr.ref_id)) AS cve_id,
  COALESCE(r.host, '') AS host_ip,
  COALESCE(t.name, '') AS task_name
FROM public.results r
JOIN LatestReports lr ON r.report = lr.report_id
JOIN public.vt_refs vr ON vr.vt_oid = r.nvt
LEFT JOIN public.tasks t ON t.id = lr.task_id
WHERE LOWER(BTRIM(vr.type)) = 'cve'
  AND vr.ref_id IS NOT NULL
  AND BTRIM(vr.ref_id) <> ''
  AND UPPER(BTRIM(vr.ref_id)) ~ '^CVE-[0-9]{4}-[0-9]+$'
  AND r.host IS NOT NULL
  AND BTRIM(r.host) <> ''
`

	var cveRows []CVEHostRow
	if err := db.Raw(cveQuery).Scan(&cveRows).Error; err != nil {
		// ถ้า query ล้มเหลว (เช่นยังไม่มีข้อมูล) ให้คืนค่า summary เปล่า
		log.Printf("⚠️ KEV summary query error: %v\n", err)
		c.JSON(http.StatusOK, KEVSummaryDTO{
			TotalKEVCatalog:   int(totalKEV),
			TotalKEVInScans:   0,
			RansomwareRelated: int(ransomwareCount),
			LastSyncedAt:      kevLastSyncAt.Format(time.RFC3339),
			LastSyncStatus:    getKEVSyncStatus(),
			KEVByHost:         []KEVByHost{},
		})
		return
	}

	// เก็บ CVE IDs ที่พบใน scans
	allCVEIDs := make([]string, 0)
	cveToHosts := make(map[string][]CVEHostRow)
	for _, row := range cveRows {
		allCVEIDs = append(allCVEIDs, row.CVEID)
		cveToHosts[row.CVEID] = append(cveToHosts[row.CVEID], row)
	}

	if len(allCVEIDs) == 0 {
		c.JSON(http.StatusOK, KEVSummaryDTO{
			TotalKEVCatalog:   int(totalKEV),
			TotalKEVInScans:   0,
			RansomwareRelated: int(ransomwareCount),
			LastSyncedAt:      kevLastSyncAt.Format(time.RFC3339),
			LastSyncStatus:    getKEVSyncStatus(),
			KEVByHost:         []KEVByHost{},
		})
		return
	}

	// หา KEV entries ที่ match กับ CVE IDs ที่พบ
	var kevMatches []entity.AppKEVCache
	if err := db.Where("cve_id IN ?", unique(allCVEIDs)).Find(&kevMatches).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	kevMap := make(map[string]entity.AppKEVCache)
	for _, k := range kevMatches {
		kevMap[k.CVEID] = k
	}

	// สร้าง KEVByHost
	hostMap := make(map[string]*KEVByHost)
	totalKEVInScans := 0
	uniqueKEVCVEs := make(map[string]bool)

	for cveID, hosts := range cveToHosts {
		kev, ok := kevMap[cveID]
		if !ok {
			continue
		}
		uniqueKEVCVEs[cveID] = true
		dto := entityToKEVDTO(kev)

		for _, h := range hosts {
			key := h.HostIP + "|" + h.TaskName
			if _, exists := hostMap[key]; !exists {
				hostMap[key] = &KEVByHost{
					HostIP:   h.HostIP,
					TaskName: h.TaskName,
					CVEList:  []KEVEntryDTO{},
				}
			}
			hostMap[key].CVEList = append(hostMap[key].CVEList, dto)
		}
	}

	totalKEVInScans = len(uniqueKEVCVEs)

	byHostList := make([]KEVByHost, 0, len(hostMap))
	for _, h := range hostMap {
		h.KEVCount = len(h.CVEList)
		byHostList = append(byHostList, *h)
	}

	sort.Slice(byHostList, func(i, j int) bool {
		return byHostList[i].KEVCount > byHostList[j].KEVCount
	})

	lastSync := ""
	if !kevLastSyncAt.IsZero() {
		lastSync = kevLastSyncAt.Format(time.RFC3339)
	}

	c.JSON(http.StatusOK, KEVSummaryDTO{
		TotalKEVCatalog:   int(totalKEV),
		TotalKEVInScans:   totalKEVInScans,
		RansomwareRelated: int(ransomwareCount),
		LastSyncedAt:      lastSync,
		LastSyncStatus:    getKEVSyncStatus(),
		KEVByHost:         byHostList,
	})
}

// GET /threats/kev/status - สถานะการ sync
func GetKEVSyncStatus(c *gin.Context) {
	db := config.DB()
	var total int64
	if db != nil {
		db.Model(&entity.AppKEVCache{}).Count(&total)
	}

	kevSyncMu.Lock()
	isSyncing := kevSyncing
	lastAt := kevLastSyncAt
	lastErr := kevLastSyncErr
	kevSyncMu.Unlock()

	lastAtStr := ""
	if !lastAt.IsZero() {
		lastAtStr = lastAt.Format(time.RFC3339)
	}

	c.JSON(http.StatusOK, KEVSyncStatusDTO{
		IsSyncing:  isSyncing,
		LastSyncAt: lastAtStr,
		LastError:  lastErr,
		Total:      total,
	})
}

// POST /threats/kev/sync - trigger sync manual
func TriggerKEVSync(c *gin.Context) {
	kevSyncMu.Lock()
	if kevSyncing {
		kevSyncMu.Unlock()
		c.JSON(http.StatusConflict, gin.H{"message": "sync already running"})
		return
	}
	kevSyncMu.Unlock()

	go func() {
		if err := SyncKEVCatalog(); err != nil {
			log.Printf("⚠️ manual KEV sync error: %v\n", err)
		}
	}()

	c.JSON(http.StatusOK, gin.H{"message": "kev sync started"})
}

// ===========================
// Helpers
// ===========================

func getKEVSyncStatus() string {
	kevSyncMu.Lock()
	defer kevSyncMu.Unlock()
	if kevSyncing {
		return "syncing"
	}
	if kevLastSyncErr != "" {
		return "error"
	}
	if kevLastSyncAt.IsZero() {
		return "not_synced"
	}
	return "ok"
}

func unique(ss []string) []string {
	seen := make(map[string]bool)
	out := make([]string, 0, len(ss))
	for _, s := range ss {
		if !seen[s] {
			seen[s] = true
			out = append(out, s)
		}
	}
	return out
}
