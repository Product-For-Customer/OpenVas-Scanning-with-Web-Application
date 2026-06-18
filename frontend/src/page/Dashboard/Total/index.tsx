import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FiAlertTriangle,
  FiChevronDown,
  FiChevronRight,
  FiSearch,
  FiCheck,
  FiShield,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import type { VulnerabilityLevelDTO } from "../../../services";
import { useLanguage } from "../../../contexts/LanguageContext";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type VulnRow = {
  id: string;
  vulnerability_id: string;
  task_id: string;
  task_name: string;
  host_ip: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  title: string;
  count: number;
  detected_time: string;
  vulnerability_family: string;
};

type FilterOption = {
  key: VulnRow["severity"];
  label: VulnRow["severity"];
};

interface Props {
  vulnerabilityData?: VulnerabilityLevelDTO[];
  loading?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const SEVERITY_COLOR: Record<VulnRow["severity"], string> = {
  CRITICAL: "#ef4444",
  HIGH:     "#f97316",
  MEDIUM:   "#eab308",
  LOW:      "#22c55e",
  INFO:     "#3b82f6",
};

const SEVERITY_BADGE: Record<VulnRow["severity"], string> = {
  CRITICAL: "bg-red-500 text-white",
  HIGH:     "bg-orange-500 text-white",
  MEDIUM:   "bg-yellow-400 text-white",
  LOW:      "bg-green-500 text-white",
  INFO:     "bg-blue-500 text-white",
};

const SEVERITY_RANK: Record<VulnRow["severity"], number> = {
  CRITICAL: 1, HIGH: 2, MEDIUM: 3, LOW: 4, INFO: 5,
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const toSeverity = (level: VulnerabilityLevelDTO["level"]): VulnRow["severity"] => {
  switch (level) {
    case "Critical": return "CRITICAL";
    case "High":     return "HIGH";
    case "Medium":   return "MEDIUM";
    case "Low":      return "LOW";
    default:         return "INFO";
  }
};

const toOriginalLevel = (s: VulnRow["severity"]): "Critical" | "High" | "Medium" | "Low" | "Info" => {
  switch (s) {
    case "CRITICAL": return "Critical";
    case "HIGH":     return "High";
    case "MEDIUM":   return "Medium";
    case "LOW":      return "Low";
    default:         return "Info";
  }
};

const formatDateTime = (value?: string): string => {
  const raw = String(value ?? "").trim();
  if (!raw) return "-";

  let d: Date | null = null;
  if (/^\d+$/.test(raw)) {
    const num = Number(raw);
    d = new Date(num < 1e12 ? num * 1000 : num);
  } else {
    d = new Date(raw);
    if (Number.isNaN(d.getTime())) d = new Date(raw.replace(" ", "T"));
  }
  if (!d || Number.isNaN(d.getTime())) return raw;

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "short", year: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(d.getTime() + 7 * 60 * 60 * 1000));
};

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

const TopVulnerability: React.FC<Props> = ({
  vulnerabilityData = [],
  loading = false,
}) => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [openFilter, setOpenFilter] = useState(false);
  const [filterSearch, setFilterSearch] = useState("");
  const [selectedLevels, setSelectedLevels] = useState<VulnRow["severity"][]>([]);
  const filterRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setOpenFilter(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Derive rows ───────────────────────────────────────────

  const mergedRows = useMemo<VulnRow[]>(() => {
    const map = new Map<string, {
      vulnerability_id: string; task_id: string; task_name: string; host_ip: string;
      title: string; count: number; topSeverity: VulnRow["severity"];
      detected_time: string; vulnerability_family: string;
    }>();

    for (const item of vulnerabilityData) {
      const title = String(item?.vulnerability_name ?? "").trim();
      if (!title) continue;

      const key   = title.toLowerCase();
      const sev   = toSeverity(item.level);
      const cnt   = Number(item.total ?? 0);
      const prev  = map.get(key);

      if (!prev) {
        map.set(key, {
          vulnerability_id: String(item?.vulnerability_id ?? ""),
          task_id:   String(item?.task_id   ?? ""),
          task_name: String((item as any)?.task_name ?? ""),
          host_ip:   String(item?.host_ip   ?? ""),
          title,
          count: cnt,
          topSeverity: sev,
          detected_time: String(item?.detected_time ?? ""),
          vulnerability_family: String(item?.vulnerability_family ?? "-"),
        });
      } else {
        prev.count += cnt;
        if (SEVERITY_RANK[sev] < SEVERITY_RANK[prev.topSeverity]) prev.topSeverity = sev;
      }
    }

    return Array.from(map.entries())
      .map(([key, v]) => ({ id: key, ...v, severity: v.topSeverity }))
      .sort((a, b) => {
        const d = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
        return d !== 0 ? d : b.count !== a.count ? b.count - a.count : a.title.localeCompare(b.title);
      });
  }, [vulnerabilityData]);

  const levelOptions = useMemo<FilterOption[]>(
    () => (["CRITICAL","HIGH","MEDIUM","LOW","INFO"] as VulnRow["severity"][]).map(k => ({ key: k, label: k })),
    []
  );

  const filteredOptions = useMemo(() => {
    const kw = filterSearch.trim().toLowerCase();
    return kw ? levelOptions.filter(o => o.label.toLowerCase().includes(kw)) : levelOptions;
  }, [levelOptions, filterSearch]);

  const rows = useMemo(() => {
    if (selectedLevels.length === 0) return mergedRows;
    return mergedRows.filter(r => selectedLevels.includes(r.severity));
  }, [mergedRows, selectedLevels]);

  const totalCount = useMemo(() => rows.reduce((s, r) => s + r.count, 0), [rows]);
  const criticalCount = useMemo(() => rows.filter(r => r.severity === "CRITICAL").length, [rows]);

  const filterButtonLabel =
    selectedLevels.length === 0 ? t("dashboard.levelFilter") :
    selectedLevels.length === 1 ? selectedLevels[0] :
    `${selectedLevels.length} levels`;

  const allVisible = filteredOptions.length > 0 && filteredOptions.every(o => selectedLevels.includes(o.key));

  const toggleLevel = (key: VulnRow["severity"]) =>
    setSelectedLevels(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  const handleSelectAll = () => {
    const keys = filteredOptions.map(o => o.key);
    setSelectedLevels(prev => allVisible ? prev.filter(k => !keys.includes(k)) : Array.from(new Set([...prev, ...keys])));
  };

  const handleNavigate = (row: VulnRow) => {
    navigate("/admin/vulnerability-detail", {
      state: {
        vulnerability_id: row.vulnerability_id, task_id: row.task_id,
        task_name: row.task_name, host_ip: row.host_ip,
        vulnerability_family: row.vulnerability_family,
        vulnerability_name: row.title,
        level: toOriginalLevel(row.severity),
        total: row.count, detected_time: row.detected_time,
      },
    });
  };

  return (
    <section className="flex h-full min-h-140 w-full flex-col rounded-xl border border-slate-200/70 bg-white p-4 dark:border-white/8 dark:bg-[#0d0b1a]/80 sm:p-5 xl:min-h-155">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-[13px] font-semibold text-slate-700 dark:text-white/80">
            {t("dashboard.totalVulnerability")}
          </h2>
          <span className="rounded-full border border-slate-200/70 bg-slate-50 px-2.5 py-0.5 text-[10.5px] font-medium text-slate-500 dark:border-white/8 dark:bg-white/5 dark:text-white/40">
            {loading ? t("common.loadingShort") : `${totalCount.toLocaleString()} ${t("common.findings")}`}
          </span>
          {!loading && criticalCount > 0 && (
            <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-[10.5px] font-medium text-red-600 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
              {criticalCount} {t("dashboard.critical")}
            </span>
          )}
        </div>

        {/* Level filter */}
        <div className="relative shrink-0" ref={filterRef}>
          <button
            type="button"
            onClick={() => setOpenFilter(p => !p)}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200/70 bg-white px-3 text-[10.5px] font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/8"
          >
            <FiShield className="text-[11px]" />
            <span className="max-w-28 truncate">{filterButtonLabel}</span>
            <FiChevronDown className={`text-[11px] transition-transform ${openFilter ? "rotate-180" : ""}`} />
          </button>

          {openFilter && (
            <div className="absolute right-0 z-30 mt-1.5 w-52 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xl dark:border-white/10 dark:bg-[#0d0b1a]">
              <div className="border-b border-slate-100 p-2.5 dark:border-white/8">
                <div className="flex items-center gap-2 rounded-lg border border-slate-200/70 bg-slate-50 px-2.5 dark:border-white/8 dark:bg-white/5">
                  <FiSearch className="shrink-0 text-[11px] text-slate-400 dark:text-white/35" />
                  <input
                    value={filterSearch}
                    onChange={e => setFilterSearch(e.target.value)}
                    placeholder={t("dashboard.searchLevel")}
                    className="h-8 w-full bg-transparent text-[11px] text-slate-700 outline-none placeholder:text-slate-400 dark:text-white/75 dark:placeholder:text-white/30"
                  />
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <button type="button" onClick={handleSelectAll} className="text-[10px] font-medium text-blue-500 hover:text-blue-600 dark:text-blue-400">
                    {allVisible ? t("common.unselectAll") : t("common.selectAll")}
                  </button>
                  <button type="button" onClick={() => setSelectedLevels([])} className="text-[10px] font-medium text-slate-400 hover:text-slate-600 dark:text-white/35">
                    {t("common.clear")}
                  </button>
                </div>
              </div>
              <div className="max-h-52 overflow-y-auto p-2">
                {filteredOptions.length === 0 ? (
                  <p className="py-4 text-center text-[11px] text-slate-400">{t("common.noResults")}</p>
                ) : (
                  <div className="space-y-0.5">
                    {filteredOptions.map(opt => {
                      const checked = selectedLevels.includes(opt.key);
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => toggleLevel(opt.key)}
                          className={["flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition", checked ? "bg-blue-50 dark:bg-blue-500/10" : "hover:bg-slate-50 dark:hover:bg-white/5"].join(" ")}
                        >
                          <span className={["flex h-4 w-4 shrink-0 items-center justify-center rounded border transition", checked ? "border-blue-500 bg-blue-500 text-white" : "border-slate-300 bg-white text-transparent dark:border-white/20 dark:bg-white/5"].join(" ")}>
                            <FiCheck className="text-[9px]" />
                          </span>
                          <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: SEVERITY_COLOR[opt.key] }} />
                          <span className="text-[11px] text-slate-700 dark:text-white/75">{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Status bar ── */}
      <p className="mt-3 text-[11px] text-slate-400 dark:text-white/30">
        {loading
          ? t("dashboard.syncingThreatFeed")
          : rows.length === 0
          ? t("dashboard.noVulnerabilitiesDetected")
          : `${t("dashboard.latestQueue")} · ${rows.length.toLocaleString()} ${t("dashboard.entries")}`}
      </p>

      {/* ── List ── */}
      <div className="mt-3 flex-1">
        {loading ? (
          <div className="flex h-102.5 items-center justify-center rounded-xl border border-dashed border-slate-200 text-[11px] text-slate-400 dark:border-white/8 dark:text-white/30 sm:h-110 xl:h-115">
            {t("common.loading")}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex h-102.5 items-center justify-center rounded-xl border border-dashed border-slate-200 text-[11px] text-slate-400 dark:border-white/8 dark:text-white/30 sm:h-110 xl:h-115">
            {t("dashboard.noVulnerabilityData")}
          </div>
        ) : (
          <div className="h-102.5 overflow-y-auto space-y-1.5 pr-0.5 sm:h-110 xl:h-115">
            {rows.map(row => (
              <button
                key={row.id}
                type="button"
                onClick={() => handleNavigate(row)}
                className="group flex w-full items-center gap-2 rounded-xl border border-slate-200/70 bg-white px-2.5 py-2 text-left transition hover:border-slate-300 hover:shadow-sm dark:border-white/8 dark:bg-white/3 dark:hover:bg-white/5"
              >
                {/* Severity dot + badge */}
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: SEVERITY_COLOR[row.severity] }} />
                  <span className={`rounded px-1.5 py-0.5 text-[8px] font-bold tracking-wide ${SEVERITY_BADGE[row.severity]}`}>
                    {row.severity}
                  </span>
                </div>

                {/* Title + meta */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[10.5px] font-medium text-slate-800 dark:text-white/85">{row.title}</p>
                  <p className="mt-0.5 truncate text-[9px] text-slate-400 dark:text-white/35">
                    {formatDateTime(row.detected_time)} · {row.vulnerability_family}
                  </p>
                </div>

                {/* Count + arrow */}
                <div className="flex shrink-0 items-center gap-1">
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-1 text-[9px] font-semibold text-slate-600 dark:border-white/8 dark:bg-white/5 dark:text-white/60">
                    {row.count}
                  </span>
                  <FiChevronRight className="text-[10px] text-slate-300 dark:text-white/20 group-hover:text-slate-500 dark:group-hover:text-white/45" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Legend row ── */}
      {!loading && rows.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3 dark:border-white/8">
          {(["CRITICAL","HIGH","MEDIUM","LOW","INFO"] as VulnRow["severity"][]).map(k => {
            const cnt = mergedRows.filter(r => r.severity === k).length;
            return (
              <div key={k} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: SEVERITY_COLOR[k] }} />
                <span className="text-[10px] text-slate-500 dark:text-white/40">{k.charAt(0) + k.slice(1).toLowerCase()}</span>
                <span className="text-[10px] font-semibold text-slate-700 dark:text-white/65">{cnt}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Suppress unused import warning */}
      {false && <FiAlertTriangle />}
    </section>
  );
};

export default TopVulnerability;
