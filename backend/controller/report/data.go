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
//   - limit=50
func ListCriticalForReport(c *gin.Context) {
	db := config.DB()

	taskID := strings.TrimSpace(c.Query("task_id"))
	limit := strings.TrimSpace(c.DefaultQuery("limit", "50"))

	query := `
WITH FilteredTasks AS (
    SELECT
        t.id::text AS task_id,
        t.name AS task_name
    FROM public.tasks t
    WHERE ($1 = '' OR t.id::text = $1)
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
	if err := db.Raw(query, taskID, limit).Scan(&out).Error; err != nil {
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