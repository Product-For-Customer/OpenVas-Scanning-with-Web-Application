import React, { useEffect, useMemo, useState } from "react";
import {
  FiAlertTriangle,
  FiClock,
  FiCpu,
  FiFileText,
  FiShield,
  FiTool,
  FiInfo,
} from "react-icons/fi";
import { ListCriticalForReport } from "../../../services/report";

type HighlightTone = "good" | "warning" | "critical" | "neutral";

type CriticalForReportDTO = {
  task_id: string;
  task_name: string;
  ip: string;
  vulnerability_id: string;
  vulnerability_name: string;
  detected_date: string;
  severity: number;
  cve_list: string;
  summary: string;
  impact: string;
  affected: string;
  insight: string;
  solution: string;
  solution_type: string;
};

type HighlightItem = {
  id: number;
  title: string;
  target?: string;
  ip?: string;
  detectedDate?: string;
  detectedDays?: number;
  cveList?: string;
  summary?: string;
  impact?: string;
  affected?: string;
  insight?: string;
  solution?: string;
  solutionType?: string;
  tone?: HighlightTone;
  severity?: number;
};

type ExecutiveHighlightsProps = {
  onReady?: (ready: boolean) => void;
};

type SectionBlock = {
  key: "summary" | "insight" | "impact" | "affected" | "solution";
  title: string;
  content: string;
  icon: React.ReactNode;
  containerClassName: string;
  titleClassName: string;
  extra?: React.ReactNode;
};

const toneStyle: Record<HighlightTone, string> = {
  good: "bg-emerald-700 text-white border-emerald-700",
  warning: "bg-amber-600 text-white border-amber-400",
  critical: "bg-rose-700 text-white border-rose-700",
  neutral: "bg-slate-700 text-white border-slate-700",
};

const toneLabel: Record<HighlightTone, string> = {
  good: "Improved",
  warning: "Attention",
  critical: "Critical",
  neutral: "Observation",
};

const normalizeText = (value?: string | null) => {
  const text = value?.trim();
  if (!text) return "";
  if (text.toLowerCase() === "n/a") return "";
  if (text.toLowerCase() === "null") return "";
  if (text.toLowerCase() === "undefined") return "";
  return text;
};

const truncateText = (value?: string | null, maxLength = 400) => {
  const text = normalizeText(value);
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}....`;
};

const getToneFromSeverity = (severity?: number): HighlightTone => {
  if (typeof severity !== "number" || Number.isNaN(severity)) return "critical";
  if (severity >= 9) return "critical";
  if (severity >= 7) return "warning";
  if (severity >= 4) return "neutral";
  return "good";
};

const sortBySeverityDesc = (
  a: CriticalForReportDTO,
  b: CriticalForReportDTO
): number => {
  const severityDiff = (b.severity || 0) - (a.severity || 0);
  if (severityDiff !== 0) return severityDiff;

  return (a.vulnerability_name || "").localeCompare(
    b.vulnerability_name || "",
    undefined,
    { sensitivity: "base" }
  );
};

const getDetectedDays = (detectedDate?: string): number | undefined => {
  if (!detectedDate) return undefined;

  const detected = new Date(detectedDate);
  if (Number.isNaN(detected.getTime())) return undefined;

  const now = new Date();
  const diffMs = now.getTime() - detected.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return diffDays < 0 ? 0 : diffDays;
};

const formatDetectedDate = (detectedDate?: string): string => {
  if (!detectedDate) return "";

  const date = new Date(detectedDate);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
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

const ExecutiveHighlights: React.FC<ExecutiveHighlightsProps> = ({
  onReady,
}) => {
  const [rows, setRows] = useState<CriticalForReportDTO[]>([]);
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

        const response =
          taskMode === "all"
            ? await ListCriticalForReport(undefined, 50)
            : await ListCriticalForReport(queryTaskIDs, 50);

        if (!alive) return;

        if (Array.isArray(response)) {
          setRows(response as CriticalForReportDTO[]);
        } else {
          setRows([]);
        }
      } catch (error) {
        console.error("Failed to load critical report:", error);

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
  }, [onReady, taskMode, queryTaskIDs]);

  const items: HighlightItem[] = useMemo(() => {
    return [...rows]
      .sort(sortBySeverityDesc)
      .map((item, index) => {
        const severity = typeof item.severity === "number" ? item.severity : 0;

        return {
          id: index + 1,
          title:
            normalizeText(item.vulnerability_name) || "Unknown Vulnerability",
          target: normalizeText(item.task_name),
          ip: normalizeText(item.ip),
          detectedDate: normalizeText(item.detected_date),
          detectedDays: getDetectedDays(item.detected_date),
          cveList: normalizeText(item.cve_list),
          summary: truncateText(item.summary, 400),
          impact: truncateText(item.impact, 400),
          affected: truncateText(item.affected, 400),
          insight: truncateText(item.insight, 400),
          solution: truncateText(item.solution, 400),
          solutionType: normalizeText(item.solution_type),
          severity,
          tone: getToneFromSeverity(severity),
        };
      });
  }, [rows]);

  if (loading) {
    return (
      <section className="border border-slate-300 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[8.5px] font-semibold uppercase tracking-normal text-slate-500">
                Management Summary
              </p>
              <h3 className="mt-1 text-[15px] font-bold leading-[1.2] text-slate-900">
                Key Critical Findings at a Glance
              </h3>
              <p className="mt-1 text-[10px] leading-[1.6] text-slate-600">
                Highlighting the most critical vulnerabilities detected in the
                latest scan, including business impact, affected scope, and
                recommended remediation actions.
              </p>
            </div>

            <div className="text-right">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-400 bg-amber-500 px-3.5 py-2 text-[10.5px] font-extrabold leading-none text-white shadow-sm">
                <FiAlertTriangle className="text-[12px]" />
                Remediate within 48 hours
              </span>
            </div>
          </div>
        </div>

        <div className="px-5 py-5">
          <div className="space-y-3">
            <div className="h-4 w-56 animate-pulse rounded bg-slate-200" />
            <div className="h-16 w-full animate-pulse rounded bg-slate-100" />
            <div className="h-16 w-full animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="border border-slate-300 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[8.5px] font-semibold uppercase tracking-normal text-slate-500">
                Management Summary
              </p>
              <h3 className="mt-1 text-[15px] font-bold leading-[1.2] text-slate-900">
                Key Critical Findings at a Glance
              </h3>
              <p className="mt-1 text-[10px] leading-[1.6] text-slate-600">
                Highlighting the most critical vulnerabilities detected in the
                latest scan, including business impact, affected scope, and
                recommended remediation actions.
              </p>
            </div>

            <div className="text-right">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-400 bg-amber-500 px-3.5 py-2 text-[10.5px] font-extrabold leading-none text-white shadow-sm">
                <FiAlertTriangle className="text-[12px]" />
                Remediate within 48 hours
              </span>
            </div>
          </div>
        </div>

        <div className="px-5 py-5">
          <div className="text-[11px] text-slate-500">No Data</div>
        </div>
      </section>
    );
  }

  return (
    <section className="border border-slate-300 bg-white">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[8.5px] font-semibold uppercase tracking-normal text-slate-500">
              Management Summary
            </p>
            <h3 className="mt-1 text-[15px] font-bold leading-[1.2] text-slate-900">
              Key Critical Findings at a Glance
            </h3>
            <p className="mt-1 text-[10px] leading-[1.6] text-slate-600">
              Highlighting the most critical vulnerabilities detected in the
              latest scan, including business impact, affected scope, and
              recommended remediation actions.
            </p>
          </div>

          <div className="text-right">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-400 bg-amber-500 px-3.5 py-2 text-[10.5px] font-extrabold leading-none text-white shadow-sm">
              <FiAlertTriangle className="text-[12px]" />
              Remediate within 48 hours
            </span>
          </div>
        </div>
      </div>

      <div className="divide-y divide-slate-200">
        {items.map((item) => {
          const tone = item.tone || "critical";

          const sectionBlocks: SectionBlock[] = [];

          if (item.summary) {
            sectionBlocks.push({
              key: "summary",
              title: "Summary",
              content: item.summary,
              icon: <FiFileText className="text-[13px] text-slate-500" />,
              containerClassName: "border border-slate-200 bg-white px-4 py-3.5",
              titleClassName: "text-[10.5px] font-semibold text-slate-900",
            });
          }

          if (item.insight) {
            sectionBlocks.push({
              key: "insight",
              title: "Insight",
              content: item.insight,
              icon: <FiShield className="text-[13px] text-slate-500" />,
              containerClassName:
                "border border-slate-200 bg-slate-50 px-4 py-3.5",
              titleClassName: "text-[10.5px] font-semibold text-slate-900",
            });
          }

          if (item.impact) {
            sectionBlocks.push({
              key: "impact",
              title: "Impact",
              content: item.impact,
              icon: <FiAlertTriangle className="text-[13px] text-slate-500" />,
              containerClassName:
                "border border-slate-200 bg-slate-50 px-4 py-3.5",
              titleClassName: "text-[10.5px] font-semibold text-slate-900",
            });
          }

          if (item.affected) {
            sectionBlocks.push({
              key: "affected",
              title: "Affected Scope",
              content: item.affected,
              icon: <FiInfo className="text-[13px] text-slate-500" />,
              containerClassName: "border border-slate-200 bg-white px-4 py-3.5",
              titleClassName: "text-[10.5px] font-semibold text-slate-900",
            });
          }

          if (item.solution) {
            sectionBlocks.push({
              key: "solution",
              title: "Recommended Solution",
              content: item.solution,
              icon: <FiTool className="text-[13px] text-emerald-700" />,
              containerClassName:
                "border border-emerald-200 bg-emerald-50 px-4 py-3.5",
              titleClassName: "text-[10.5px] font-semibold text-slate-900",
              extra: item.solutionType ? (
                <span className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[8.5px] font-semibold uppercase tracking-[0.08em] text-emerald-800">
                  {item.solutionType}
                </span>
              ) : undefined,
            });
          }

          return (
            <div
              key={item.id}
              className="px-5 py-4"
              style={{
                breakInside: "avoid-page",
                pageBreakInside: "avoid",
              }}
            >
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-50 text-rose-700">
                        <FiAlertTriangle className="text-[15px]" />
                      </span>

                      <h4 className="text-[13.5px] font-semibold leading-[1.45] text-slate-900">
                        {item.title}
                      </h4>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <span
                      className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-[8.5px] font-semibold uppercase tracking-[0.12em] ${toneStyle[tone]}`}
                    >
                      <FiAlertTriangle className="text-[10px]" />
                      {toneLabel[tone]}
                    </span>
                  </div>
                </div>

                {(item.target ||
                  item.ip ||
                  item.cveList ||
                  item.detectedDate ||
                  typeof item.detectedDays === "number") && (
                  <div className="flex flex-wrap gap-2.5">
                    {item.target && (
                      <div className="inline-flex items-center gap-2 border border-slate-200 bg-slate-50 px-3 py-2 text-[10.5px] text-slate-700">
                        <FiCpu className="text-[12px] text-slate-500" />
                        <span>
                          <span className="font-semibold text-slate-900">
                            Device:
                          </span>{" "}
                          {item.target}
                        </span>
                      </div>
                    )}

                    {item.ip && (
                      <div className="inline-flex items-center gap-2 border border-slate-200 bg-slate-50 px-3 py-2 text-[10.5px] text-slate-700">
                        <FiShield className="text-[12px] text-slate-500" />
                        <span>
                          <span className="font-semibold text-slate-900">
                            IP:
                          </span>{" "}
                          {item.ip}
                        </span>
                      </div>
                    )}

                    {item.detectedDate && (
                      <div className="inline-flex items-center gap-2 border border-slate-200 bg-slate-50 px-3 py-2 text-[10.5px] text-slate-700">
                        <FiClock className="text-[12px] text-slate-500" />
                        <span>
                          <span className="font-semibold text-slate-900">
                            Detected:
                          </span>{" "}
                          {formatDetectedDate(item.detectedDate)}
                        </span>
                      </div>
                    )}

                    {typeof item.detectedDays === "number" && (
                      <div className="inline-flex items-center gap-2 border border-rose-200 bg-rose-50 px-3 py-2 text-[10.5px] text-rose-700">
                        <FiClock className="text-[12px]" />
                        <span>
                          <span className="font-semibold">Exposed for:</span>{" "}
                          {item.detectedDays} day
                          {item.detectedDays !== 1 ? "s" : ""}
                        </span>
                      </div>
                    )}

                    {item.cveList && (
                      <div className="inline-flex items-center gap-2 border border-slate-200 bg-slate-50 px-3 py-2 text-[10.5px] text-slate-700">
                        <FiFileText className="text-[12px] text-slate-500" />
                        <span>
                          <span className="font-semibold text-slate-900">
                            CVE:
                          </span>{" "}
                          {item.cveList}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {sectionBlocks.length > 0 && (
                  <div className="grid grid-cols-1 gap-3">
                    {sectionBlocks.map((section, sectionIndex) => (
                      <div
                        key={section.key}
                        className={section.containerClassName}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          {section.icon}
                          <p className={section.titleClassName}>
                            {sectionIndex + 1}. {section.title}
                          </p>
                          {section.extra}
                        </div>

                        <p className="mt-2 text-[11px] leading-[1.75] text-slate-700">
                          {section.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default ExecutiveHighlights;