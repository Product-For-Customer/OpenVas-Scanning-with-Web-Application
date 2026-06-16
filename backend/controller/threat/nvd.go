package threat

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/Tawunchai/openvas/config"
	"github.com/Tawunchai/openvas/entity"
	"github.com/gin-gonic/gin"
)

const (
	nvdBaseURL       = "https://services.nvd.nist.gov/rest/json/cves/2.0"
	nvdCacheMaxDays  = 30
	nvdFetchTimeout  = 20 * time.Second
	nvdRateLimitWait = 7 * time.Second // conservative: 5 req/30s without key
)

var nvdRateMu sync.Mutex
var nvdLastFetch time.Time

// ===========================
// NVD API v2 JSON structures
// ===========================

type nvdAPIResponse struct {
	TotalResults    int              `json:"totalResults"`
	Vulnerabilities []nvdCVEWrapper  `json:"vulnerabilities"`
}

type nvdCVEWrapper struct {
	CVE nvdCVEData `json:"cve"`
}

type nvdCVEData struct {
	ID           string             `json:"id"`
	Published    string             `json:"published"`
	LastModified string             `json:"lastModified"`
	VulnStatus   string             `json:"vulnStatus"`
	Descriptions []nvdDescription   `json:"descriptions"`
	Metrics      nvdMetrics         `json:"metrics"`
	Weaknesses   []nvdWeakness      `json:"weaknesses"`
	References   []nvdReference     `json:"references"`
}

type nvdDescription struct {
	Lang  string `json:"lang"`
	Value string `json:"value"`
}

type nvdMetrics struct {
	CVSSMetricV31 []nvdCVSSMetricV31 `json:"cvssMetricV31"`
	CVSSMetricV30 []nvdCVSSMetricV30 `json:"cvssMetricV30"`
	CVSSMetricV2  []nvdCVSSMetricV2  `json:"cvssMetricV2"`
}

type nvdCVSSMetricV31 struct {
	Type     string       `json:"type"`
	CVSSData nvdCVSSData  `json:"cvssData"`
}

type nvdCVSSMetricV30 struct {
	Type     string       `json:"type"`
	CVSSData nvdCVSSData  `json:"cvssData"`
}

type nvdCVSSMetricV2 struct {
	Type     string       `json:"type"`
	CVSSData nvdCVSSDataV2 `json:"cvssData"`
}

type nvdCVSSData struct {
	Version      string  `json:"version"`
	VectorString string  `json:"vectorString"`
	BaseScore    float64 `json:"baseScore"`
	BaseSeverity string  `json:"baseSeverity"`
}

type nvdCVSSDataV2 struct {
	Version      string  `json:"version"`
	VectorString string  `json:"vectorString"`
	BaseScore    float64 `json:"baseScore"`
}

type nvdWeakness struct {
	Description []nvdDescription `json:"description"`
}

type nvdReference struct {
	URL    string `json:"url"`
	Source string `json:"source"`
}

// ===========================
// Response DTO
// ===========================

type NVDCVEDetailDTO struct {
	CVEID        string   `json:"cve_id"`
	CVSSScore    float64  `json:"cvss_score"`
	CVSSVector   string   `json:"cvss_vector"`
	CVSSSeverity string   `json:"cvss_severity"`
	CVSSVersion  string   `json:"cvss_version"`
	Description  string   `json:"description"`
	PublishedAt  string   `json:"published_at"`
	ModifiedAt   string   `json:"modified_at"`
	VulnStatus   string   `json:"vuln_status"`
	CWE          string   `json:"cwe"`
	References   []string `json:"references"`
	FromCache    bool     `json:"from_cache"`
}

type CVEEnrichDTO struct {
	CVEID string           `json:"cve_id"`
	NVD   *NVDCVEDetailDTO `json:"nvd"`
	KEV   *KEVEntryDTO     `json:"kev"`
}

// ===========================
// NVD Fetch + Cache
// ===========================

func fetchNVDForCVE(cveID string) (*entity.AppNVDCache, error) {
	// Rate limiting
	nvdRateMu.Lock()
	elapsed := time.Since(nvdLastFetch)
	if elapsed < nvdRateLimitWait {
		time.Sleep(nvdRateLimitWait - elapsed)
	}
	nvdLastFetch = time.Now()
	nvdRateMu.Unlock()

	url := fmt.Sprintf("%s?cveId=%s", nvdBaseURL, cveID)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("nvd request create error: %w", err)
	}

	nvdAPIKey := strings.TrimSpace(os.Getenv("NVD_API_KEY"))
	if nvdAPIKey != "" {
		req.Header.Set("apiKey", nvdAPIKey)
	}

	client := &http.Client{Timeout: nvdFetchTimeout}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("nvd fetch error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, nil
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("nvd bad status: %s", resp.Status)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("nvd read body error: %w", err)
	}

	var apiResp nvdAPIResponse
	if err := json.Unmarshal(body, &apiResp); err != nil {
		return nil, fmt.Errorf("nvd json parse error: %w", err)
	}

	if apiResp.TotalResults == 0 || len(apiResp.Vulnerabilities) == 0 {
		return nil, nil
	}

	cve := apiResp.Vulnerabilities[0].CVE
	cache := buildNVDCache(cveID, cve)
	return cache, nil
}

func buildNVDCache(cveID string, cve nvdCVEData) *entity.AppNVDCache {
	cache := &entity.AppNVDCache{
		CVEID:      cveID,
		VulnStatus: cve.VulnStatus,
		FetchedAt:  time.Now(),
	}

	// Description (English)
	for _, d := range cve.Descriptions {
		if d.Lang == "en" {
			cache.Description = d.Value
			break
		}
	}

	// CVSS v3.1 (preferred)
	if len(cve.Metrics.CVSSMetricV31) > 0 {
		m := cve.Metrics.CVSSMetricV31[0]
		cache.CVSSScore = m.CVSSData.BaseScore
		cache.CVSSVector = m.CVSSData.VectorString
		cache.CVSSSeverity = m.CVSSData.BaseSeverity
	} else if len(cve.Metrics.CVSSMetricV30) > 0 {
		m := cve.Metrics.CVSSMetricV30[0]
		cache.CVSSScore = m.CVSSData.BaseScore
		cache.CVSSVector = m.CVSSData.VectorString
		cache.CVSSSeverity = m.CVSSData.BaseSeverity
	} else if len(cve.Metrics.CVSSMetricV2) > 0 {
		m := cve.Metrics.CVSSMetricV2[0]
		cache.CVSSScore = m.CVSSData.BaseScore
		cache.CVSSVector = m.CVSSData.VectorString
		cache.CVSSSeverity = scoreToCVSSSeverity(m.CVSSData.BaseScore)
	}

	// CWE
	cwes := make([]string, 0)
	for _, w := range cve.Weaknesses {
		for _, d := range w.Description {
			if d.Value != "" && d.Value != "NVD-CWE-Other" && d.Value != "NVD-CWE-noinfo" {
				cwes = append(cwes, d.Value)
			}
		}
	}
	cache.CWE = strings.Join(unique(cwes), ", ")

	// References
	refs := make([]string, 0, len(cve.References))
	for _, r := range cve.References {
		if r.URL != "" {
			refs = append(refs, r.URL)
		}
	}
	if refsJSON, err := json.Marshal(refs); err == nil {
		cache.References = string(refsJSON)
	}

	// Dates
	if t, err := time.Parse("2006-01-02T15:04:05.000", cve.Published); err == nil {
		cache.PublishedAt = &t
	} else if t, err := time.Parse(time.RFC3339, cve.Published); err == nil {
		cache.PublishedAt = &t
	}
	if t, err := time.Parse("2006-01-02T15:04:05.000", cve.LastModified); err == nil {
		cache.ModifiedAt = &t
	} else if t, err := time.Parse(time.RFC3339, cve.LastModified); err == nil {
		cache.ModifiedAt = &t
	}

	return cache
}

func scoreToCVSSSeverity(score float64) string {
	switch {
	case score >= 9.0:
		return "CRITICAL"
	case score >= 7.0:
		return "HIGH"
	case score >= 4.0:
		return "MEDIUM"
	case score > 0:
		return "LOW"
	default:
		return "NONE"
	}
}

func getNVDFromCacheOrFetch(cveID string) (*entity.AppNVDCache, bool, error) {
	db := config.DB()
	if db == nil {
		return nil, false, fmt.Errorf("database unavailable")
	}

	var cached entity.AppNVDCache
	result := db.First(&cached, "cve_id = ?", cveID)

	if result.Error == nil {
		// Check cache age
		if time.Since(cached.FetchedAt) < time.Duration(nvdCacheMaxDays)*24*time.Hour {
			return &cached, true, nil
		}
	}

	// Fetch from NVD
	fetched, err := fetchNVDForCVE(cveID)
	if err != nil {
		log.Printf("⚠️ NVD fetch error for %s: %v\n", cveID, err)
		// Return cached even if stale when fetch fails
		if result.Error == nil {
			return &cached, true, nil
		}
		return nil, false, err
	}

	if fetched == nil {
		return nil, false, nil
	}

	// Upsert cache
	if saveErr := db.Save(fetched).Error; saveErr != nil {
		log.Printf("⚠️ NVD cache save error for %s: %v\n", cveID, saveErr)
	}

	return fetched, false, nil
}

func nvdCacheToDTO(cache *entity.AppNVDCache) *NVDCVEDetailDTO {
	if cache == nil {
		return nil
	}

	dto := &NVDCVEDetailDTO{
		CVEID:        cache.CVEID,
		CVSSScore:    cache.CVSSScore,
		CVSSVector:   cache.CVSSVector,
		CVSSSeverity: strings.ToUpper(cache.CVSSSeverity),
		Description:  cache.Description,
		VulnStatus:   cache.VulnStatus,
		CWE:          cache.CWE,
		References:   []string{},
		FromCache:    true,
	}

	// Detect CVSS version from vector string
	if strings.HasPrefix(cache.CVSSVector, "CVSS:3.1") {
		dto.CVSSVersion = "3.1"
	} else if strings.HasPrefix(cache.CVSSVector, "CVSS:3.0") {
		dto.CVSSVersion = "3.0"
	} else if strings.HasPrefix(cache.CVSSVector, "CVSS:2.0") || strings.Contains(cache.CVSSVector, "AV:") {
		dto.CVSSVersion = "2.0"
	} else {
		dto.CVSSVersion = "unknown"
	}

	if cache.PublishedAt != nil {
		dto.PublishedAt = cache.PublishedAt.Format("2006-01-02")
	}
	if cache.ModifiedAt != nil {
		dto.ModifiedAt = cache.ModifiedAt.Format("2006-01-02")
	}

	if cache.References != "" {
		var refs []string
		if err := json.Unmarshal([]byte(cache.References), &refs); err == nil {
			dto.References = refs
		}
	}

	return dto
}

// ===========================
// Gin Handler: CVE Enrichment
// ===========================

// GET /threats/cve/enrich?cve_ids=CVE-xxx,CVE-yyy
// คืน NVD detail + KEV status ของแต่ละ CVE
func EnrichCVEs(c *gin.Context) {
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
		if trimmed := strings.TrimSpace(strings.ToUpper(id)); trimmed != "" && strings.HasPrefix(trimmed, "CVE-") {
			cveIDs = append(cveIDs, trimmed)
		}
	}

	if len(cveIDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no valid CVE IDs provided"})
		return
	}

	// Limit per request
	if len(cveIDs) > 20 {
		cveIDs = cveIDs[:20]
	}

	// Fetch KEV data for all CVEs at once
	var kevEntries []entity.AppKEVCache
	db.Where("cve_id IN ?", cveIDs).Find(&kevEntries)
	kevMap := make(map[string]entity.AppKEVCache)
	for _, k := range kevEntries {
		kevMap[k.CVEID] = k
	}

	// Build result
	result := make(map[string]*CVEEnrichDTO, len(cveIDs))

	for _, cveID := range cveIDs {
		dto := &CVEEnrichDTO{CVEID: cveID}

		// NVD
		nvdCache, _, err := getNVDFromCacheOrFetch(cveID)
		if err != nil {
			log.Printf("⚠️ enrich NVD error for %s: %v\n", cveID, err)
		}
		if nvdCache != nil {
			dto.NVD = nvdCacheToDTO(nvdCache)
		}

		// KEV
		if kev, ok := kevMap[cveID]; ok {
			kevDTO := entityToKEVDTO(kev)
			dto.KEV = &kevDTO
		}

		result[cveID] = dto
	}

	c.JSON(http.StatusOK, result)
}
