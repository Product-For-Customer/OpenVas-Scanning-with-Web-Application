package report

import (
	"net/http"
	"strings"
	"time"

	"github.com/Tawunchai/openvas/config"
	"github.com/gin-gonic/gin"
)

type CriticalForReportDTO struct {
	TaskID            string    `json:"task_id"`
	TaskName          string    `json:"task_name"`
	IP                string    `json:"ip"`
	VulnerabilityID   string    `json:"vulnerability_id"`
	VulnerabilityName string    `json:"vulnerability_name"`
	DetectedDate      time.Time `json:"detected_date"`
	Severity          float64   `json:"severity"`
	CVEList           string    `json:"cve_list"`
	Summary           string    `json:"summary"`
	Impact            string    `json:"impact"`
	Affected          string    `json:"affected"`
	Insight           string    `json:"insight"`
	Solution          string    `json:"solution"`
	SolutionType      string    `json:"solution_type"`
}

// GET /critical-report
// Optional query:
//   - task_id=3
//   - task_id=3,4,5
//   - limit=50
func ListCriticalForReport(c *gin.Context) {
	db := config.DB()

	taskIDRaw := strings.TrimSpace(c.Query("task_id"))
	limit := strings.TrimSpace(c.DefaultQuery("limit", "50"))

	query := `
WITH ParsedTaskIDs AS (
    SELECT DISTINCT BTRIM(value) AS task_id
    FROM unnest(string_to_array($1, ',')) AS value
    WHERE BTRIM(value) <> ''
),

FilteredTasks AS (
    SELECT
        t.id::text AS task_id,
        t.name AS task_name
    FROM public.tasks t
    WHERE (
        $1 = ''
        OR t.id::text IN (SELECT task_id FROM ParsedTaskIDs)
    )
),

LatestReportPerTask AS (
    SELECT DISTINCT ON (rp.task)
        rp.task::text AS task_id,
        rp.id AS report_id,
        rp.creation_time
    FROM public.reports rp
    JOIN FilteredTasks ft
      ON ft.task_id = rp.task::text
    ORDER BY rp.task, rp.creation_time DESC
),

Fact AS (
    SELECT
        ft.task_id,
        ft.task_name,
        COALESCE(NULLIF(BTRIM(r.host), ''), 'N/A') AS ip,
        r.nvt AS nvt_oid,
        lr.creation_time AS report_creation_time,

        ROUND(COALESCE(r.severity, 0)::numeric, 2)::float8 AS severity,

        COALESCE(NULLIF(BTRIM(n.name), ''), r.nvt::text, 'N/A') AS vulnerability_name,

        NULLIF(BTRIM(n.summary), '') AS summary,
        NULLIF(BTRIM(n.impact), '') AS impact,
        NULLIF(BTRIM(n.affected), '') AS affected,
        NULLIF(BTRIM(n.insight), '') AS insight,

        NULLIF(BTRIM(n.solution), '') AS solution,
        NULLIF(BTRIM(n.solution_type), '') AS solution_type,

        NULLIF(BTRIM(n.tag), '') AS tag_text

    FROM public.results r
    JOIN LatestReportPerTask lr
      ON r.report = lr.report_id
    JOIN FilteredTasks ft
      ON ft.task_id = lr.task_id
    LEFT JOIN public.nvts n
      ON n.oid = r.nvt
    WHERE r.nvt IS NOT NULL
      AND COALESCE(r.severity, 0) >= 9.0
),

Agg AS (
    SELECT
        f.task_id,
        f.task_name,
        MAX(f.ip) AS ip,
        f.nvt_oid,

        MAX(f.vulnerability_name) AS vulnerability_name,
        ROUND(MAX(f.severity)::numeric, 2)::float8 AS severity,

        MAX(f.summary) AS summary,
        MAX(f.impact) AS impact,
        MAX(f.affected) AS affected,
        MAX(f.insight) AS insight,

        MAX(f.solution) AS solution,
        MAX(f.solution_type) AS solution_type,

        MAX(f.tag_text) AS tag_text,
        MAX(f.report_creation_time) AS report_creation_time
    FROM Fact f
    GROUP BY f.task_id, f.task_name, f.nvt_oid
),

TagParsed AS (
    SELECT
        a.*,
        NULLIF((regexp_match(COALESCE(a.tag_text, ''), '(^|[|;])summary=([^|;]+)'))[2], '') AS tag_summary,
        NULLIF((regexp_match(COALESCE(a.tag_text, ''), '(^|[|;])impact=([^|;]+)'))[2], '') AS tag_impact,
        NULLIF((regexp_match(COALESCE(a.tag_text, ''), '(^|[|;])affected=([^|;]+)'))[2], '') AS tag_affected,
        NULLIF((regexp_match(COALESCE(a.tag_text, ''), '(^|[|;])insight=([^|;]+)'))[2], '') AS tag_insight,
        NULLIF((regexp_match(COALESCE(a.tag_text, ''), '(^|[|;])solution=([^|;]+)'))[2], '') AS tag_solution,
        NULLIF((regexp_match(COALESCE(a.tag_text, ''), '(^|[|;])solution_type=([^|;]+)'))[2], '') AS tag_solution_type
    FROM Agg a
),

DistinctCVERefs AS (
    SELECT DISTINCT
        vr.vt_oid AS nvt_oid,
        UPPER(BTRIM(vr.ref_id)) AS cve_id
    FROM public.vt_refs vr
    WHERE LOWER(BTRIM(vr.type)) = 'cve'
      AND vr.ref_id IS NOT NULL
      AND BTRIM(vr.ref_id) <> ''
      AND UPPER(BTRIM(vr.ref_id)) ~ '^CVE-\d{4}-\d+$'
),

RankedCVERefs AS (
    SELECT
        d.nvt_oid,
        d.cve_id,
        ROW_NUMBER() OVER (
            PARTITION BY d.nvt_oid
            ORDER BY d.cve_id
        ) AS rn
    FROM DistinctCVERefs d
),

CVEListPerNVT AS (
    SELECT
        r.nvt_oid,
        STRING_AGG(r.cve_id, ', ' ORDER BY r.cve_id) AS cve_list
    FROM RankedCVERefs r
    WHERE r.rn <= 10
    GROUP BY r.nvt_oid
)

SELECT
    tp.task_id,
    tp.task_name,
    tp.ip,
    tp.nvt_oid::text AS vulnerability_id,
    tp.vulnerability_name,

    (
        to_timestamp(tp.report_creation_time)
        AT TIME ZONE 'UTC'
        AT TIME ZONE 'Asia/Bangkok'
    ) AS detected_date,

    tp.severity,
    COALESCE(ca.cve_list, 'N/A') AS cve_list,

    COALESCE(tp.summary, tp.tag_summary, 'N/A') AS summary,
    COALESCE(tp.impact, tp.tag_impact, 'N/A') AS impact,
    COALESCE(tp.affected, tp.tag_affected, 'N/A') AS affected,
    COALESCE(tp.insight, tp.tag_insight, 'N/A') AS insight,
    COALESCE(tp.solution, tp.tag_solution, 'N/A') AS solution,
    COALESCE(tp.solution_type, tp.tag_solution_type, 'N/A') AS solution_type

FROM TagParsed tp
LEFT JOIN CVEListPerNVT ca
  ON ca.nvt_oid = tp.nvt_oid
ORDER BY
    tp.severity DESC,
    tp.task_name ASC,
    tp.vulnerability_name ASC
LIMIT COALESCE(NULLIF($2, '')::int, 50);
`

	var out []CriticalForReportDTO
	if err := db.Raw(query, taskIDRaw, limit).Scan(&out).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "failed to load critical findings for report",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  out,
		"count": len(out),
	})
}

// comparision

type TargetDifferResponse struct {
	Host                  string   `json:"host"`
	TaskName              string   `json:"task_name"`
	LatestTaskID          string   `json:"latest_task_id"`
	LatestReportID        int64    `json:"latest_report_id"`
	LatestCreationTime    *int64   `json:"latest_creation_time"`
	LatestTotal           int      `json:"latest_total"`
	LatestCritical        int      `json:"latest_critical"`
	LatestHigh            int      `json:"latest_high"`
	LatestMedium          int      `json:"latest_medium"`
	LatestLow             int      `json:"latest_low"`
	LatestInfo            int      `json:"latest_info"`
	LatestRiskScore       float64  `json:"latest_risk_score"`
	PreviousTaskID        *string  `json:"previous_task_id"`
	PreviousReportID      *int64   `json:"previous_report_id"`
	PreviousCreationTime  *int64   `json:"previous_creation_time"`
	PreviousTotal         *int     `json:"previous_total"`
	PreviousCritical      *int     `json:"previous_critical"`
	PreviousHigh          *int     `json:"previous_high"`
	PreviousMedium        *int     `json:"previous_medium"`
	PreviousLow           *int     `json:"previous_low"`
	PreviousInfo          *int     `json:"previous_info"`
	PreviousRiskScore     *float64 `json:"previous_risk_score"`
	PreviousVersionStatus string   `json:"previous_version_status"`
	DiffTotal             *int     `json:"diff_total"`
	DiffCritical          *int     `json:"diff_critical"`
	DiffHigh              *int     `json:"diff_high"`
	DiffMedium            *int     `json:"diff_medium"`
	DiffLow               *int     `json:"diff_low"`
	DiffInfo              *int     `json:"diff_info"`
	DiffRiskScore         *float64 `json:"diff_risk_score"`
}

func ListTargetDiffer(c *gin.Context) {
	db := config.DB()
	taskIDRaw := strings.TrimSpace(c.Query("task_id"))

	query := `
WITH ParsedTaskIDs AS (
    SELECT DISTINCT BTRIM(value) AS task_id
    FROM unnest(string_to_array($1, ',')) AS value
    WHERE BTRIM(value) <> ''
),

FilteredTasks AS (
    SELECT
        t.id::text AS task_id,
        COALESCE(NULLIF(BTRIM(t.name), ''), 'N/A') AS task_name
    FROM public.tasks t
    WHERE (
        $1 = ''
        OR t.id::text IN (SELECT task_id FROM ParsedTaskIDs)
    )
),

BaseResult AS (
    SELECT
        COALESCE(NULLIF(BTRIM(r.host), ''), 'N/A') AS host,
        rp.id AS report_id,
        rp.task::text AS task_id,
        rp.creation_time,
        ft.task_name,
        COALESCE(r.severity, 0) AS severity
    FROM public.results r
    JOIN public.reports rp
      ON rp.id = r.report
    JOIN FilteredTasks ft
      ON ft.task_id = rp.task::text
    WHERE r.report IS NOT NULL
),

SummaryPerSnapshot AS (
    SELECT
        br.host,
        br.task_name,
        br.task_id,
        br.report_id,
        br.creation_time,

        COUNT(*)::int AS total,

        COALESCE(SUM(CASE WHEN br.severity >= 9 THEN 1 ELSE 0 END), 0)::int AS critical,
        COALESCE(SUM(CASE WHEN br.severity >= 7 AND br.severity < 9 THEN 1 ELSE 0 END), 0)::int AS high,
        COALESCE(SUM(CASE WHEN br.severity >= 4 AND br.severity < 7 THEN 1 ELSE 0 END), 0)::int AS medium,
        COALESCE(SUM(CASE WHEN br.severity > 0 AND br.severity < 4 THEN 1 ELSE 0 END), 0)::int AS low,
        COALESCE(SUM(CASE WHEN br.severity = 0 THEN 1 ELSE 0 END), 0)::int AS info,

        COALESCE(
            ROUND(
                AVG(
                    CASE
                        WHEN br.severity > 0 THEN br.severity
                        ELSE NULL
                    END
                )::numeric,
                2
            ),
            0
        )::float8 AS risk_score
    FROM BaseResult br
    GROUP BY
        br.host,
        br.task_name,
        br.task_id,
        br.report_id,
        br.creation_time
),

RankedSnapshots AS (
    SELECT
        sps.*,
        ROW_NUMBER() OVER (
            PARTITION BY sps.host
            ORDER BY sps.creation_time DESC, sps.report_id DESC
        ) AS rn
    FROM SummaryPerSnapshot sps
),

LatestVersion AS (
    SELECT
        host,
        task_name,
        task_id,
        report_id,
        creation_time,
        total,
        critical,
        high,
        medium,
        low,
        info,
        risk_score
    FROM RankedSnapshots
    WHERE rn = 1
),

PreviousVersion AS (
    SELECT
        host,
        task_name,
        task_id,
        report_id,
        creation_time,
        total,
        critical,
        high,
        medium,
        low,
        info,
        risk_score
    FROM RankedSnapshots
    WHERE rn = 2
)

SELECT
    lv.host,
    lv.task_name,

    lv.task_id AS latest_task_id,
    lv.report_id AS latest_report_id,
    lv.creation_time AS latest_creation_time,
    lv.total AS latest_total,
    lv.critical AS latest_critical,
    lv.high AS latest_high,
    lv.medium AS latest_medium,
    lv.low AS latest_low,
    lv.info AS latest_info,
    lv.risk_score AS latest_risk_score,

    pv.task_id AS previous_task_id,
    pv.report_id AS previous_report_id,
    pv.creation_time AS previous_creation_time,
    pv.total AS previous_total,
    pv.critical AS previous_critical,
    pv.high AS previous_high,
    pv.medium AS previous_medium,
    pv.low AS previous_low,
    pv.info AS previous_info,
    pv.risk_score AS previous_risk_score,

    CASE
        WHEN pv.report_id IS NULL THEN 'ไม่มี version ก่อนหน้า'
        ELSE 'มี version ก่อนหน้า'
    END AS previous_version_status,

    CASE
        WHEN pv.report_id IS NULL THEN NULL
        ELSE (lv.total - pv.total)
    END AS diff_total,

    CASE
        WHEN pv.report_id IS NULL THEN NULL
        ELSE (lv.critical - pv.critical)
    END AS diff_critical,

    CASE
        WHEN pv.report_id IS NULL THEN NULL
        ELSE (lv.high - pv.high)
    END AS diff_high,

    CASE
        WHEN pv.report_id IS NULL THEN NULL
        ELSE (lv.medium - pv.medium)
    END AS diff_medium,

    CASE
        WHEN pv.report_id IS NULL THEN NULL
        ELSE (lv.low - pv.low)
    END AS diff_low,

    CASE
        WHEN pv.report_id IS NULL THEN NULL
        ELSE (lv.info - pv.info)
    END AS diff_info,

    CASE
        WHEN pv.report_id IS NULL THEN NULL
        ELSE ROUND((lv.risk_score - pv.risk_score)::numeric, 2)::float8
    END AS diff_risk_score

FROM LatestVersion lv
LEFT JOIN PreviousVersion pv
  ON lv.host = pv.host
ORDER BY
    lv.creation_time DESC NULLS LAST,
    lv.host ASC,
    lv.task_name ASC;
`

	var results []TargetDifferResponse
	if err := db.Raw(query, taskIDRaw).Scan(&results).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":  "failed to list target differ",
			"detail": err.Error(),
		})
		return
	}

	if results == nil {
		results = make([]TargetDifferResponse, 0)
	}

	c.JSON(http.StatusOK, gin.H{
		"data": results,
	})
}

// device risk report

type DeviceRiskDTO struct {
	TaskID             string  `json:"task_id"`
	TaskName           string  `json:"task_name"`
	IPAddress          string  `json:"ip_address"`
	FirmwareVersion    string  `json:"firmware_version"`
	RiskScore          float64 `json:"risk_score"`
	VulnerabilityTotal int     `json:"vulnerability_total"`
}

// GET /devices/risk-report
//
// Logic:
// - ถ้าไม่ส่ง task_id = แสดงทั้งหมด
// - ถ้าส่ง task_id=1 หรือ 1,2,3 = กรองเฉพาะ task นั้น
// - ใช้ ip_host + task_name เป็น asset identity
// - หา latest report ต่อ ip_host + task_name
// - ใช้เฉพาะ results ของ host นั้นใน report นั้นจริง ๆ
// - VulnerabilityTotal = จำนวน findings ทั้งหมด
// - RiskScore = AVG(severity) เฉพาะ severity > 0
func ListDeviceRiskForReport(c *gin.Context) {
	db := config.DB()
	taskIDRaw := strings.TrimSpace(c.Query("task_id"))

	query := `
WITH
ParsedTaskIDs AS (
  SELECT DISTINCT BTRIM(value) AS task_id
  FROM unnest(string_to_array($1, ',')) AS value
  WHERE BTRIM(value) <> ''
),

FilteredTasks AS (
  SELECT
    t.id::text AS task_id,
    COALESCE(t.name, '') AS task_name
  FROM public.tasks t
  WHERE (
    $1 = ''
    OR t.id::text IN (SELECT task_id FROM ParsedTaskIDs)
  )
),

-- =========================================================
-- 1) หา latest report ต่อ host + task_name
-- =========================================================
LatestReportPerHostTask AS (
  SELECT DISTINCT ON (r.host, COALESCE(ft.task_name, ''))
    r.host AS ip_address,
    rp.id AS report_id,
    rp.task::text AS task_id,
    COALESCE(ft.task_name, '') AS task_name,
    rp.creation_time
  FROM public.results r
  JOIN public.reports rp
    ON rp.id = r.report
  JOIN FilteredTasks ft
    ON ft.task_id = rp.task::text
  WHERE r.host IS NOT NULL
    AND BTRIM(r.host) <> ''
  ORDER BY
    r.host,
    COALESCE(ft.task_name, ''),
    rp.creation_time DESC,
    rp.id DESC
),

-- =========================================================
-- 2) latest results ของ host นั้นใน report นั้นจริง ๆ
--    ใช้ COALESCE(severity, 0) เพื่อให้ NULL ถูกนับเป็น Info
-- =========================================================
LatestResults AS (
  SELECT
    r.*,
    lrht.task_id,
    lrht.task_name,
    lrht.creation_time,
    COALESCE(r.severity, 0) AS severity_value
  FROM public.results r
  JOIN LatestReportPerHostTask lrht
    ON r.report = lrht.report_id
   AND r.host = lrht.ip_address
  WHERE r.host IS NOT NULL
    AND BTRIM(r.host) <> ''
),

-- =========================================================
-- 3) ดึง task name + firmware/os info ต่อ host + task_name
-- =========================================================
DeviceInfo AS (
  SELECT
    lr.host AS ip_address,
    lr.task_id,
    lr.task_name,

    MAX(
      CASE
        WHEN lr.nvt::text = '1.3.6.1.4.1.25623.1.0.103416'
        THEN lr.description
      END
    ) AS snmp_text,

    MAX(
      CASE
        WHEN lr.nvt::text = '1.3.6.1.4.1.25623.1.0.10219'
        THEN lr.description
      END
    ) AS os_val

  FROM LatestResults lr
  GROUP BY
    lr.host,
    lr.task_id,
    lr.task_name
),

-- =========================================================
-- 4) fact สำหรับ aggregate final
-- =========================================================
RiskAgg AS (
  SELECT
    lr.host AS ip_address,
    lr.task_id,
    lr.task_name,

    COUNT(*)::int AS vulnerability_total,

    COALESCE(
      ROUND(
        AVG(
          CASE
            WHEN lr.severity_value > 0 THEN lr.severity_value
            ELSE NULL
          END
        )::numeric,
        2
      ),
      0
    )::float8 AS risk_score

  FROM LatestResults lr
  GROUP BY
    lr.host,
    lr.task_id,
    lr.task_name
)

SELECT
  COALESCE(d.task_id, '') AS task_id,
  d.task_name,
  d.ip_address,

  COALESCE(
    NULLIF(
      TRIM(
        SPLIT_PART(
          SPLIT_PART(
            d.snmp_text,
            'System Description (OID: 1.3.6.1.2.1.1.1.0) :',
            2
          ),
          chr(10),
          1
        )
      ),
      ''
    ),
    NULLIF(BTRIM(d.os_val), ''),
    'Unknown Device'
  ) AS firmware_version,

  COALESCE(ra.risk_score, 0)::float8 AS risk_score,
  COALESCE(ra.vulnerability_total, 0)::int AS vulnerability_total

FROM DeviceInfo d
LEFT JOIN RiskAgg ra
  ON ra.ip_address = d.ip_address
 AND ra.task_id = d.task_id
 AND ra.task_name = d.task_name
ORDER BY
  risk_score DESC,
  vulnerability_total DESC,
  task_name ASC,
  ip_address ASC;
`

	out := make([]DeviceRiskDTO, 0)
	if err := db.Raw(query, taskIDRaw).Scan(&out).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	if out == nil {
		out = make([]DeviceRiskDTO, 0)
	}

	c.JSON(http.StatusOK, gin.H{
		"data": out,
	})
}