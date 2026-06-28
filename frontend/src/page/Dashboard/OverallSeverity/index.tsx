import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FiAlertOctagon,
  FiAlertTriangle,
  FiInfo,
  FiMinusCircle,
  FiShield,
  FiChevronDown,
  FiSearch,
  FiCheck,
  FiLayers,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import type { VulnerabilityLevelDTO } from "../../../services";
import { useLanguage } from "../../../contexts/LanguageContext";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type SeverityKey = "Critical" | "High" | "Medium" | "Low" | "Info";

type CardDef = {
  id: number;
  title: SeverityKey;
  icon: React.ReactNode;
  color: string;
  rgb: string;
  cvssRange: string;
};

type TargetOption = {
  key: string;
  label: string;
  task_id: string;
  task_name: string;
  host: string;
};

type SummaryRow = {
  task_id: string;
  task_name: string;
  host: string;
  target_key: string;
  target_label: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
};

interface Props {
  vulnerabilityData?: VulnerabilityLevelDTO[];
  loading?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Skeleton helpers
// ─────────────────────────────────────────────────────────────

const Pulse: React.FC = () => (
  <span className="inline-block h-9 w-14 animate-pulse rounded-lg bg-slate-100 dark:bg-white/10" />
);
const SubPulse: React.FC = () => (
  <span className="inline-block h-3 w-20 animate-pulse rounded bg-slate-100 dark:bg-white/10" />
);

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const getTargetHost = (item: any) => {
  const host =
    item?.host ?? item?.host_ip ?? item?.ip ?? item?.target_ip ??
    item?.ip_host ?? item?.asset_ip ?? item?.target_host ?? item?.target ?? "";
  return String(host).trim() || "-";
};

const getTargetKey   = (t: string, h: string) => `${t.trim() || "-"}__${h.trim() || "-"}`;
const getTargetLabel = (t: string, h: string) => `${t.trim() || "-"} - ${h.trim() || "-"}`;

// ─────────────────────────────────────────────────────────────
// Card definitions — CVSS v3.1 score ranges (official)
// ─────────────────────────────────────────────────────────────

const CARDS: CardDef[] = [
  { id: 1, title: "Critical", icon: <FiAlertOctagon />, color: "#ef4444", rgb: "239,68,68",  cvssRange: "9.0 – 10.0" },
  { id: 2, title: "High",     icon: <FiAlertTriangle />, color: "#f97316", rgb: "249,115,22", cvssRange: "7.0 – 8.9"  },
  { id: 3, title: "Medium",   icon: <FiInfo />,           color: "#eab308", rgb: "234,179,8",  cvssRange: "4.0 – 6.9"  },
  { id: 4, title: "Low",      icon: <FiMinusCircle />,    color: "#22c55e", rgb: "34,197,94",  cvssRange: "0.1 – 3.9"  },
  { id: 5, title: "Info",     icon: <FiShield />,         color: "#3b82f6", rgb: "59,130,246", cvssRange: "0.0"         },
];

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

const OverallSeverity: React.FC<Props> = ({
  vulnerabilityData = [],
  loading = false,
}) => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [openTargetQuery, setOpenTargetQuery]     = useState(false);
  const [targetQuerySearch, setTargetQuerySearch] = useState("");
  const [selectedTargets, setSelectedTargets]     = useState<string[]>([]);

  const targetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (targetRef.current && !targetRef.current.contains(e.target as Node))
        setOpenTargetQuery(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Derived data ──────────────────────────────────────────

  const rows = useMemo<SummaryRow[]>(() => {
    const map = new Map<string, SummaryRow>();
    for (const item of vulnerabilityData) {
      const taskName = String((item as any)?.task_name ?? "").trim() || "Unknown";
      const taskID   = String((item as any)?.task_id   ?? "").trim();
      const host     = getTargetHost(item);
      const key      = getTargetKey(taskName, host);
      const label    = getTargetLabel(taskName, host);
      if (!map.has(key)) {
        map.set(key, {
          task_id: taskID, task_name: taskName, host,
          target_key: key, target_label: label,
          critical: 0, high: 0, medium: 0, low: 0, info: 0,
        });
      }
      const row = map.get(key)!;
      const n   = Number(item?.total ?? 0);
      switch (item?.level) {
        case "Critical": row.critical += n; break;
        case "High":     row.high     += n; break;
        case "Medium":   row.medium   += n; break;
        case "Low":      row.low      += n; break;
        default:         row.info     += n;
      }
    }
    return Array.from(map.values());
  }, [vulnerabilityData]);

  const targetOptions = useMemo<TargetOption[]>(() => {
    const seen = new Set<string>();
    const opts: TargetOption[] = [];
    for (const r of rows) {
      if (!r.target_key || seen.has(r.target_key)) continue;
      seen.add(r.target_key);
      opts.push({ key: r.target_key, label: r.target_label, task_id: r.task_id, task_name: r.task_name, host: r.host });
    }
    return opts.sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);

  const filteredTargetOptions = useMemo(() => {
    const kw = targetQuerySearch.trim().toLowerCase();
    return kw ? targetOptions.filter(o => o.label.toLowerCase().includes(kw)) : targetOptions;
  }, [targetOptions, targetQuerySearch]);

  const filteredRows = useMemo(() => {
    if (selectedTargets.length === 0) return rows;
    const set = new Set(selectedTargets);
    return rows.filter(r => set.has(r.target_key));
  }, [rows, selectedTargets]);

  const selectedTargetOptions = useMemo(() => {
    const set = new Set(selectedTargets);
    return targetOptions.filter(o => set.has(o.key));
  }, [targetOptions, selectedTargets]);

  const selectedTaskIDs = useMemo(() => {
    if (selectedTargets.length === 0) return [];
    return Array.from(new Set(filteredRows.map(r => r.task_id).filter(Boolean)));
  }, [filteredRows, selectedTargets.length]);

  const selectedTaskNames = useMemo(() => {
    if (selectedTargets.length === 0) return [];
    return Array.from(new Set(selectedTargetOptions.map(o => o.task_name).filter(Boolean)));
  }, [selectedTargetOptions, selectedTargets.length]);

  const selectedTargetHosts = useMemo(() => {
    if (selectedTargets.length === 0) return [];
    return Array.from(new Set(selectedTargetOptions.map(o => o.host).filter(Boolean)));
  }, [selectedTargetOptions, selectedTargets.length]);

  const selectedTargetPairs = useMemo(() => {
    return selectedTargetOptions.map(o => ({
      key: o.key, label: o.label, task_id: o.task_id,
      task_name: o.task_name, host: o.host, host_ip: o.host,
    }));
  }, [selectedTargetOptions]);

  const totals = useMemo(() => {
    let critical = 0, high = 0, medium = 0, low = 0, info = 0;
    for (const r of filteredRows) {
      critical += r.critical; high += r.high;
      medium   += r.medium;   low  += r.low; info += r.info;
    }
    return { totalAll: critical + high + medium + low + info, critical, high, medium, low, info };
  }, [filteredRows]);

  const percent = (n: number) =>
    totals.totalAll ? Number(((n / totals.totalAll) * 100).toFixed(2)) : 0;

  const makeSubtitle = (n: number) => {
    if (loading) return "";
    if (!totals.totalAll) return t("dashboard.noFindings");
    return `${percent(n).toFixed(1)}${t("dashboard.ofTotalFindings")}`;
  };

  // ── Filter helpers ────────────────────────────────────────

  const allVisibleSelected =
    filteredTargetOptions.length > 0 &&
    filteredTargetOptions.every(o => selectedTargets.includes(o.key));

  const targetButtonLabel =
    selectedTargets.length === 0 ? t("dashboard.targetQuery") :
    selectedTargets.length === 1 ? (selectedTargetOptions[0]?.label ?? "1 selected") :
    `${selectedTargets.length} selected`;

  const selectedScopeLabel =
    selectedTargets.length === 0 ? "All Targets" :
    selectedTargets.length === 1 ? (selectedTargetOptions[0]?.label ?? "1 selected") :
    `${selectedTargets.length} targets selected`;

  const toggleTarget = (key: string) =>
    setSelectedTargets(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );

  const handleSelectAll = () => {
    const keys = filteredTargetOptions.map(o => o.key);
    setSelectedTargets(prev =>
      allVisibleSelected
        ? prev.filter(k => !keys.includes(k))
        : Array.from(new Set([...prev, ...keys]))
    );
  };

  const clearAll = () => setSelectedTargets([]);

  // ── Navigation ────────────────────────────────────────────

  const handleNavigateByLevel = (level: SeverityKey) => {
    navigate("/admin/vulnerability-by-level", {
      state: {
        level,
        scopeTask:    selectedTargets.length > 0 ? selectedTaskNames : "all",
        task_id:      selectedTaskIDs.length   === 1 ? selectedTaskIDs[0]  : undefined,
        task_ids:     selectedTaskIDs.length   >  0  ? selectedTaskIDs     : undefined,
        task_names:   selectedTaskNames.length >  0  ? selectedTaskNames   : undefined,
        target_keys:  selectedTargets.length   >  0  ? selectedTargets     : undefined,
        target_hosts: selectedTargetHosts.length > 0 ? selectedTargetHosts : undefined,
        target_pairs: selectedTargetPairs.length > 0 ? selectedTargetPairs : undefined,
      },
    });
  };

  // ─────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h2 className="text-[13px] font-semibold text-slate-700 dark:text-white/80">
            {t("dashboard.overallSeverity")}
          </h2>
          <span className="rounded-full border border-slate-200/70 bg-slate-50 px-2.5 py-0.5 text-[10.5px] font-medium text-slate-500 dark:border-white/8 dark:bg-white/5 dark:text-white/40">
            {loading ? t("common.loadingShort") : `${totals.totalAll.toLocaleString()} findings`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {selectedTargets.length > 0 && (
            <span className="flex items-center gap-1.5 text-[10.5px] text-slate-400 dark:text-white/30">
              <FiLayers className="shrink-0" />
              <span className="max-w-48 truncate">{selectedScopeLabel}</span>
            </span>
          )}

          <div className="relative" ref={targetRef}>
            <button
              type="button"
              onClick={() => setOpenTargetQuery(p => !p)}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200/70 bg-white px-3 text-[10.5px] font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/8"
            >
              <FiShield className="text-[11px]" />
              <span className="max-w-36 truncate">{targetButtonLabel}</span>
              <FiChevronDown
                className={`ml-0.5 text-[11px] transition-transform ${openTargetQuery ? "rotate-180" : ""}`}
              />
            </button>

            {openTargetQuery && (
              <div className="absolute right-0 z-50 mt-1.5 w-72 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xl dark:border-white/10 dark:bg-[#0d0b1a]">
                <div className="border-b border-slate-100 p-2.5 dark:border-white/8">
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200/70 bg-slate-50 px-2.5 dark:border-white/8 dark:bg-white/5">
                    <FiSearch className="shrink-0 text-[11px] text-slate-400 dark:text-white/35" />
                    <input
                      type="text"
                      value={targetQuerySearch}
                      onChange={e => setTargetQuerySearch(e.target.value)}
                      placeholder={t("dashboard.searchTarget")}
                      className="h-8 w-full bg-transparent text-[11px] text-slate-700 outline-none placeholder:text-slate-400 dark:text-white/75 dark:placeholder:text-white/30"
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="text-[10px] font-medium text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      {allVisibleSelected ? t("common.unselectAll") : t("common.selectAll")}
                    </button>
                    <button
                      type="button"
                      onClick={clearAll}
                      className="text-[10px] font-medium text-slate-400 hover:text-slate-600 dark:text-white/35 dark:hover:text-white/55"
                    >
                      {t("common.clear")}
                    </button>
                  </div>
                </div>

                <div className="max-h-56 overflow-y-auto p-2">
                  {filteredTargetOptions.length === 0 ? (
                    <p className="py-6 text-center text-[11px] text-slate-400 dark:text-white/35">
                      {t("common.noResults")}
                    </p>
                  ) : (
                    <div className="space-y-0.5">
                      {filteredTargetOptions.map(opt => {
                        const checked = selectedTargets.includes(opt.key);
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => toggleTarget(opt.key)}
                            className={[
                              "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition",
                              checked ? "bg-blue-50 dark:bg-blue-500/10" : "hover:bg-slate-50 dark:hover:bg-white/5",
                            ].join(" ")}
                          >
                            <span
                              className={[
                                "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition",
                                checked
                                  ? "border-blue-500 bg-blue-500 text-white"
                                  : "border-slate-300 bg-white text-transparent dark:border-white/20 dark:bg-white/5",
                              ].join(" ")}
                            >
                              <FiCheck className="text-[9px]" />
                            </span>
                            <span className="truncate text-[11px] text-slate-700 dark:text-white/75">
                              {opt.label}
                            </span>
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
      </div>

      {/* ── Cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {CARDS.map(card => {
          const rawNumber =
            card.title === "Critical" ? totals.critical :
            card.title === "High"     ? totals.high     :
            card.title === "Medium"   ? totals.medium   :
            card.title === "Low"      ? totals.low      :
            totals.info;

          const pct = percent(rawNumber);

          return (
            <button
              key={card.id}
              type="button"
              onClick={() => handleNavigateByLevel(card.title)}
              className="group relative overflow-hidden rounded-xl border border-slate-200/60 bg-white text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-white/6 dark:bg-white/3"
            >
              {/* ── Left accent strip (replaces inline border-left) ── */}
              <span
                className="absolute left-0 top-0 h-full w-[3.5px]"
                style={{ backgroundColor: card.color }}
                aria-hidden
              />

              {/* ── Soft radial glow top-right ── */}
              <div
                className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full blur-2xl transition-opacity duration-300"
                style={{ backgroundColor: card.color, opacity: 0.07 }}
                aria-hidden
              />

              {/* ── Large icon watermark bottom-right ── */}
              <div
                className="pointer-events-none absolute -bottom-2 -right-1 text-[62px] leading-none transition-opacity duration-300 group-hover:opacity-[0.09]"
                style={{ color: card.color, opacity: 0.045 }}
                aria-hidden
              >
                {card.icon}
              </div>

              {/* ── Content ── */}
              <div className="relative pl-5 pr-4 pb-4 pt-4">

                {/* Row 1 — title + icon badge */}
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10.5px] font-semibold uppercase tracking-widest text-slate-500 dark:text-white/45">
                    {card.title}
                  </p>
                  <span
                    className="flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-lg text-[13px] transition-transform duration-200 group-hover:scale-110"
                    style={{ color: card.color, background: `rgba(${card.rgb},0.13)` }}
                  >
                    {card.icon}
                  </span>
                </div>

                {/* Row 2 — CVSS range */}
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="text-[9px] font-medium text-slate-400 dark:text-white/25">CVSS</span>
                  <span
                    className="rounded-full px-2 py-px text-[9.5px] font-semibold tabular-nums"
                    style={{ color: card.color, background: `rgba(${card.rgb},0.10)` }}
                  >
                    {card.cvssRange}
                  </span>
                </div>

                {/* Row 3 — number */}
                <p className="mt-3 text-[34px] font-bold leading-none tracking-tight text-slate-900 dark:text-white">
                  {loading ? <Pulse /> : rawNumber.toLocaleString()}
                </p>

                {/* Row 4 — divider */}
                <div className="my-3 h-px w-full bg-slate-100 dark:bg-white/6" />

                {/* Row 5 — subtitle + % */}
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[10.5px] text-slate-400 dark:text-white/30">
                    {loading ? <SubPulse /> : makeSubtitle(rawNumber)}
                  </p>
                  {!loading && totals.totalAll > 0 && (
                    <span
                      className="shrink-0 text-[10.5px] font-semibold tabular-nums"
                      style={{ color: card.color }}
                    >
                      {pct.toFixed(1)}%
                    </span>
                  )}
                </div>

                {/* Row 6 — progress bar */}
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/7">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: card.color }}
                  />
                </div>

              </div>
            </button>
          );
        })}
      </div>

    </div>
  );
};

export default OverallSeverity;
