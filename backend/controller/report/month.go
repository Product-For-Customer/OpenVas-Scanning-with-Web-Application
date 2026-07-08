package report

import (
	"net/http"
	"sort"
	"strconv"
	"strings"

	"github.com/Tawunchai/openvas/config"
	"github.com/Tawunchai/openvas/controller/setting"
	"github.com/Tawunchai/openvas/manage"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type ReportVulnerabilityMonthDTO struct {
	TaskID        string  `json:"task_id"`
	TaskName      string  `json:"task_name"`
	IP            string  `json:"ip"`
	Month         string  `json:"month"`
	MonthNo       int     `json:"month_no"`
	Vulnerability int     `json:"vulnerability"`
	RiskScore     float64 `json:"risk_score"`
}

type ReportManageLimitTaskIDDTO struct {
	TaskID string `gorm:"column:task_id"`
}

func normalizeReportTaskIDForManageLimit(taskID string) string {
	taskID = strings.TrimSpace(taskID)

	if taskID == "" {
		return ""
	}

	taskIDNumber, err := strconv.ParseInt(taskID, 10, 64)
	if err == nil {
		return strconv.FormatInt(taskIDNumber, 10)
	}

	return taskID
}

func compareReportTaskIDForManageLimit(a string, b string) int {
	a = normalizeReportTaskIDForManageLimit(a)
	b = normalizeReportTaskIDForManageLimit(b)

	if a == "" && b == "" {
		return 0
	}

	if a == "" {
		return 1
	}

	if b == "" {
		return -1
	}

	aNumber, aErr := strconv.ParseInt(a, 10, 64)
	bNumber, bErr := strconv.ParseInt(b, 10, 64)

	if aErr == nil && bErr == nil {
		if aNumber < bNumber {
			return -1
		}

		if aNumber > bNumber {
			return 1
		}

		return 0
	}

	return strings.Compare(a, b)
}

// FindReportManageLimitTaskIDs
//
// ใช้หา task_id กลุ่มแรกตามค่า TargetLimit ใน manage.go
//
// ตัวอย่าง:
// manage.TargetLimit = 5
// public.tasks มี task_id = 2, 3, 4, 5, 6, 7
// function นี้จะคืนค่า = 2, 3, 4, 5, 6
func FindReportManageLimitTaskIDs(db *gorm.DB) ([]string, error) {
	targetLimit := manage.GetTargetLimit()

	if targetLimit <= 0 {
		return make([]string, 0), nil
	}

	query := `
SELECT
  t.id::text AS task_id
FROM public.tasks t
WHERE t.id IS NOT NULL
ORDER BY
  t.id ASC
LIMIT ?;
`

	rows := make([]ReportManageLimitTaskIDDTO, 0)

	if err := db.Raw(query, targetLimit).Scan(&rows).Error; err != nil {
		return nil, err
	}

	taskIDs := make([]string, 0, len(rows))
	seen := make(map[string]bool)

	for _, row := range rows {
		taskID := normalizeReportTaskIDForManageLimit(row.TaskID)

		if taskID == "" {
			continue
		}

		if seen[taskID] {
			continue
		}

		seen[taskID] = true
		taskIDs = append(taskIDs, taskID)
	}

	sort.SliceStable(taskIDs, func(i int, j int) bool {
		return compareReportTaskIDForManageLimit(taskIDs[i], taskIDs[j]) < 0
	})

	return taskIDs, nil
}

func BuildReportManageLimitTaskIDSet(db *gorm.DB) (map[string]bool, error) {
	taskIDs, err := FindReportManageLimitTaskIDs(db)
	if err != nil {
		return nil, err
	}

	allowedTaskIDs := make(map[string]bool)

	for _, taskID := range taskIDs {
		cleanTaskID := normalizeReportTaskIDForManageLimit(taskID)

		if cleanTaskID == "" {
			continue
		}

		allowedTaskIDs[cleanTaskID] = true
	}

	return allowedTaskIDs, nil
}

func sortReportVulnerabilityMonthByManageLogic(out []ReportVulnerabilityMonthDTO) {
	sort.SliceStable(out, func(i int, j int) bool {
		if out[i].MonthNo != out[j].MonthNo {
			return out[i].MonthNo < out[j].MonthNo
		}

		taskCompare := compareReportTaskIDForManageLimit(out[i].TaskID, out[j].TaskID)
		if taskCompare != 0 {
			return taskCompare < 0
		}

		ipCompare := strings.Compare(out[i].IP, out[j].IP)
		if ipCompare != 0 {
			return ipCompare < 0
		}

		return strings.Compare(out[i].TaskName, out[j].TaskName) < 0
	})
}

func limitReportVulnerabilityMonthByManageLimit(
	out []ReportVulnerabilityMonthDTO,
	allowedTaskIDs map[string]bool,
) []ReportVulnerabilityMonthDTO {
	limited := make([]ReportVulnerabilityMonthDTO, 0, len(out))

	for _, item := range out {
		taskID := normalizeReportTaskIDForManageLimit(item.TaskID)

		if allowedTaskIDs[taskID] {
			limited = append(limited, item)
		}
	}

	sortReportVulnerabilityMonthByManageLogic(limited)

	return limited
}

func ListDataForReportVulnerabilityMonth(c *gin.Context) {
	db := config.DB()

	allowedTaskIDs, err := BuildReportManageLimitTaskIDSet(db)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   err.Error(),
			"message": "failed to find manage target limit task ids",
		})
		return
	}

	if len(allowedTaskIDs) == 0 {
		c.JSON(http.StatusOK, make([]ReportVulnerabilityMonthDTO, 0))
		return
	}

	query := `
WITH
-- =========================================================
-- 1) หา latest report ต่อ host + task_name
-- =========================================================
LatestReportPerHostTask AS (
  SELECT DISTINCT ON (r.host, COALESCE(t.name, ''))
    r.host AS host_ip,
    rp.id AS report_id,
    rp.task AS task_id,
    COALESCE(t.name, '') AS task_name,
    rp.creation_time
  FROM public.results r
  JOIN public.reports rp
    ON rp.id = r.report
  LEFT JOIN public.tasks t
    ON t.id = rp.task
  WHERE r.host IS NOT NULL
    AND BTRIM(r.host) <> ''
  ORDER BY
    r.host,
    COALESCE(t.name, ''),
    rp.creation_time DESC,
    rp.id DESC
),

-- =========================================================
-- 2) fact ของ latest snapshot ต่อ asset
--    ไม่นำ severity ติดลบมาคิด
-- =========================================================
ResultFact AS (
  SELECT
    lrht.task_id::text AS task_id,
    lrht.task_name,
    lrht.host_ip,
    lrht.creation_time,
    COALESCE(r.severity, 0) AS severity
  FROM LatestReportPerHostTask lrht
  JOIN public.results r
    ON r.report = lrht.report_id
   AND r.host = lrht.host_ip
   AND COALESCE(r.severity, 0) >= 0
),

-- =========================================================
-- 3) aggregate ต่อ asset
--    vulnerability = จำนวน findings ทั้งหมดของ asset นั้น
--    risk_score = AVG(severity > 0) ของ asset นั้น
-- =========================================================
AssetAgg AS (
  SELECT
    rf.task_id,
    rf.task_name,
    rf.host_ip,
    rf.creation_time,

    COUNT(*)::int AS vulnerability,

    COALESCE(
      ROUND(
        AVG(
          CASE
            WHEN rf.severity > 0 THEN rf.severity
            ELSE NULL
          END
        )::numeric,
        2
      ),
      0
    )::float8 AS risk_score

  FROM ResultFact rf
  GROUP BY
    rf.task_id,
    rf.task_name,
    rf.host_ip,
    rf.creation_time
)

SELECT
  aa.task_id,
  aa.task_name,
  aa.host_ip AS ip,

  TO_CHAR(
    (
      to_timestamp(aa.creation_time)
      AT TIME ZONE 'Asia/Bangkok'
    ),
    'Mon'
  ) AS month,

  EXTRACT(
    MONTH FROM (
      to_timestamp(aa.creation_time)
      AT TIME ZONE 'Asia/Bangkok'
    )
  )::int AS month_no,

  aa.vulnerability,
  aa.risk_score

FROM AssetAgg aa
ORDER BY
  month_no ASC,
  aa.task_id ASC,
  aa.task_name ASC,
  aa.host_ip ASC;
`

	out := make([]ReportVulnerabilityMonthDTO, 0)
	query = strings.ReplaceAll(query, "'Asia/Bangkok'", "'"+setting.AppTimezoneSQL()+"'")
	if err := db.Raw(query).Scan(&out).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	if out == nil {
		out = make([]ReportVulnerabilityMonthDTO, 0)
	}

	out = limitReportVulnerabilityMonthByManageLimit(out, allowedTaskIDs)

	c.JSON(http.StatusOK, out)
}