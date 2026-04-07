import React, { useEffect, useMemo, useState } from "react";
import { MdOutlineReportProblem } from "react-icons/md";
import {
  FiAlertOctagon,
  FiAlertTriangle,
  FiMinusCircle,
  FiShield,
  FiInfo,
} from "react-icons/fi";
import {
  ListTaskVulnSummaryForReport,
  type TaskVulnSummaryForReportResponse,
} from "../../../services/report";

type SeverityLevel =
  | "total"
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "info";

type MetricItem = {
  id: number;
  label: string;
  value: string | number;
  hint: string;
  icon: React.ReactNode;
  iconWrapClass: string;
  labelClass: string;
  level: SeverityLevel;
};

type ReportKPIProps = {
  onReady?: (ready: boolean) => void;
};

const levelBadgeClassMap: Record<SeverityLevel, string> = {
  total: "border-slate-700 bg-slate-700 text-white",
  critical: "border-rose-700 bg-rose-700 text-white",
  high: "border-orange-600 bg-orange-600 text-white",
  medium: "border-amber-500 bg-amber-500 text-white",
  low: "border-emerald-600 bg-emerald-600 text-white",
  info: "border-sky-600 bg-sky-600 text-white",
};

const levelTextMap: Record<SeverityLevel, string> = {
  total: "TOTAL FINDINGS",
  critical: "CRITICAL",
  high: "HIGH",
  medium: "MEDIUM",
  low: "LOW",
  info: "INFO",
};

const readTaskIDsFromQuery = (): { mode: "all" | "filtered"; ids: string[] } => {
  if (typeof window === "undefined") {
    return { mode: "all", ids: [] };
  }

  const searchParams = new URLSearchParams(window.location.search);
  const raw = (searchParams.get("task_id") || "").trim();

  if (!raw || raw.toUpperCase() === "ALL") {
    return { mode: "all", ids: [] };
  }

  const ids = raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "");

  if (ids.length === 0) {
    return { mode: "all", ids: [] };
  }

  return { mode: "filtered", ids };
};

const safeNumber = (value: unknown): number => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const ReportKPI: React.FC<ReportKPIProps> = ({ onReady }) => {
  const [rows, setRows] = useState<TaskVulnSummaryForReportResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [queryTaskIDs, setQueryTaskIDs] = useState<string[]>([]);
  const [taskMode, setTaskMode] = useState<"all" | "filtered">("all");

  useEffect(() => {
    const parsed = readTaskIDsFromQuery();
    setQueryTaskIDs(parsed.ids);
    setTaskMode(parsed.mode);
  }, []);

  useEffect(() => {
    let alive = true;

    onReady?.(false);

    const loadData = async () => {
      try {
        setLoading(true);

        const response = await ListTaskVulnSummaryForReport();

        if (!alive) return;
        setRows(Array.isArray(response) ? response : []);
      } catch (error) {
        console.error("Failed to load task vulnerability summary:", error);

        if (!alive) return;
        setRows([]);
      } finally {
        if (!alive) return;
        setLoading(false);
        onReady?.(true);
      }
    };

    loadData();

    return () => {
      alive = false;
    };
  }, [onReady]);

  const filteredRows = useMemo(() => {
    if (taskMode === "all") {
      return rows;
    }

    if (queryTaskIDs.length === 0) {
      return rows;
    }

    const selected = new Set(queryTaskIDs.map((id) => String(id).trim()));

    return rows.filter((row) => selected.has(String(row.task_id).trim()));
  }, [rows, queryTaskIDs, taskMode]);

  const summary = useMemo(() => {
    let critical = 0;
    let high = 0;
    let medium = 0;
    let low = 0;
    let info = 0;

    for (const row of filteredRows) {
      critical += safeNumber(row.critical);
      high += safeNumber(row.high);
      medium += safeNumber(row.medium);
      low += safeNumber(row.low);
      info += safeNumber(row.info);
    }

    const total = critical + high + medium + low + info;

    return {
      total,
      critical,
      high,
      medium,
      low,
      info,
      taskCount: filteredRows.length,
    };
  }, [filteredRows]);

  const items: MetricItem[] = useMemo(
    () => [
      {
        id: 1,
        label: "Total Findings",
        value: loading ? "..." : summary.total.toLocaleString(),
        hint:
          taskMode === "all"
            ? "Total findings identified across all scanned devices"
            : `Total findings identified across ${summary.taskCount.toLocaleString()} selected device task(s)`,
        icon: <MdOutlineReportProblem className="text-[13px]" />,
        iconWrapClass: "bg-slate-100 text-slate-700",
        labelClass: "text-slate-700",
        level: "total",
      },
      {
        id: 2,
        label: "Critical",
        value: loading ? "..." : summary.critical.toLocaleString(),
        hint: "Critical vulnerabilities requiring immediate remediation",
        icon: <FiAlertOctagon className="text-[12px]" />,
        iconWrapClass: "bg-rose-50 text-rose-700",
        labelClass: "text-rose-700",
        level: "critical",
      },
      {
        id: 3,
        label: "High",
        value: loading ? "..." : summary.high.toLocaleString(),
        hint: "High-risk vulnerabilities with significant impact potential",
        icon: <FiAlertTriangle className="text-[12px]" />,
        iconWrapClass: "bg-orange-50 text-orange-700",
        labelClass: "text-orange-700",
        level: "high",
      },
      {
        id: 4,
        label: "Medium",
        value: loading ? "..." : summary.medium.toLocaleString(),
        hint: "Medium-severity findings that should be addressed in due course",
        icon: <FiInfo className="text-[12px]" />,
        iconWrapClass: "bg-amber-50 text-amber-700",
        labelClass: "text-amber-700",
        level: "medium",
      },
      {
        id: 5,
        label: "Low",
        value: loading ? "..." : summary.low.toLocaleString(),
        hint: "Low-severity findings with limited immediate impact",
        icon: <FiMinusCircle className="text-[12px]" />,
        iconWrapClass: "bg-emerald-50 text-emerald-700",
        labelClass: "text-emerald-700",
        level: "low",
      },
      {
        id: 6,
        label: "Info",
        value: loading ? "..." : summary.info.toLocaleString(),
        hint: "Informational observations and security-related notices",
        icon: <FiShield className="text-[12px]" />,
        iconWrapClass: "bg-sky-50 text-sky-700",
        labelClass: "text-sky-700",
        level: "info",
      },
    ],
    [loading, summary, taskMode]
  );

  return (
    <section className="border border-slate-300 bg-white">
      <div className="border-b border-slate-300 px-5 py-3.5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-normal text-slate-500">
              Security Risk Summary
            </p>
            <h3 className="mt-1 text-[15px] font-bold leading-tight text-slate-900">
              Vulnerability Severity Overview
            </h3>
          </div>

          <div className="text-right text-[9.5px] leading-[1.45] text-slate-500">
            {taskMode === "all"
              ? "Consolidated findings by severity level"
              : `Filtered by ${summary.taskCount.toLocaleString()} selected task(s)`}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3">
        {items.map((item, index) => {
          const isLastColumn = index % 3 === 2;
          const isLastRow = index >= items.length - 3;

          return (
            <div
              key={item.id}
              className={[
                "min-h-28 bg-white px-4 py-3",
                !isLastColumn ? "border-r border-slate-300" : "",
                !isLastRow ? "border-b border-slate-300" : "",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={[
                      "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                      item.iconWrapClass,
                    ].join(" ")}
                  >
                    {item.icon}
                  </span>

                  <span
                    className={[
                      "inline-flex shrink-0 items-center border px-2 py-0.75 text-[10px] font-extrabold uppercase tracking-[0.12em] leading-none",
                      levelBadgeClassMap[item.level],
                    ].join(" ")}
                  >
                    {levelTextMap[item.level]}
                  </span>
                </div>
              </div>

              <p className="mt-3 text-[18px] font-bold leading-none text-slate-900">
                {item.value}
              </p>

              <p className="mt-2 text-[9.5px] leading-[1.45] text-slate-600">
                {item.hint}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default ReportKPI;