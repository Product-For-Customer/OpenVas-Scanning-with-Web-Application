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
  gradFrom: string;
  gradTo: string;
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
// Per-severity danger decorations (SVG art, white on gradient)
// ─────────────────────────────────────────────────────────────

const getSeverityDeco = (title: SeverityKey): React.ReactNode => {
  switch (title) {
    // Critical — virus particle (spiky ball = biohazard/pathogen)
    case "Critical":
      return (
        <svg viewBox="0 0 100 100" fill="none" aria-hidden>
          <circle cx="50" cy="50" r="17" fill="white" />
          {/* Cardinal spikes */}
          <line x1="50" y1="33" x2="50" y2="16" stroke="white" strokeWidth="5.5" strokeLinecap="round" />
          <line x1="50" y1="67" x2="50" y2="84" stroke="white" strokeWidth="5.5" strokeLinecap="round" />
          <line x1="33" y1="50" x2="16" y2="50" stroke="white" strokeWidth="5.5" strokeLinecap="round" />
          <line x1="67" y1="50" x2="84" y2="50" stroke="white" strokeWidth="5.5" strokeLinecap="round" />
          {/* Diagonal spikes */}
          <line x1="38" y1="38" x2="27" y2="27" stroke="white" strokeWidth="5.5" strokeLinecap="round" />
          <line x1="62" y1="38" x2="73" y2="27" stroke="white" strokeWidth="5.5" strokeLinecap="round" />
          <line x1="38" y1="62" x2="27" y2="73" stroke="white" strokeWidth="5.5" strokeLinecap="round" />
          <line x1="62" y1="62" x2="73" y2="73" stroke="white" strokeWidth="5.5" strokeLinecap="round" />
          {/* Tip balls */}
          <circle cx="50" cy="12" r="4.5" fill="white" />
          <circle cx="50" cy="88" r="4.5" fill="white" />
          <circle cx="12" cy="50" r="4.5" fill="white" />
          <circle cx="88" cy="50" r="4.5" fill="white" />
          <circle cx="23" cy="23" r="4.5" fill="white" />
          <circle cx="77" cy="23" r="4.5" fill="white" />
          <circle cx="23" cy="77" r="4.5" fill="white" />
          <circle cx="77" cy="77" r="4.5" fill="white" />
        </svg>
      );

    // High — remote-controlled botnet: an attacker's console broadcasting
    // a signal down to a row of hijacked devices (deliberately a top-to-
    // bottom broadcast layout, not a radial burst, so it reads distinctly
    // from the Critical virus icon)
    case "High":
      return (
        <svg viewBox="0 0 100 100" fill="white" aria-hidden>
          {/* Attacker's remote console */}
          <rect x="32" y="8" width="36" height="24" rx="4" />
          <rect x="44" y="32" width="12" height="6" />
          <rect x="37" y="38" width="26" height="4" rx="2" />

          {/* Broadcast signal arcs beaming down to the botnet */}
          <path d="M40 50 Q50 57 60 50" stroke="white" strokeWidth="4" strokeLinecap="round" fill="none" />
          <path d="M31 58 Q50 71 69 58" stroke="white" strokeWidth="4" strokeLinecap="round" fill="none" />

          {/* Hijacked devices in a row, each still tethered to the signal */}
          <line x1="21" y1="74" x2="21" y2="80" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
          <line x1="50" y1="74" x2="50" y2="80" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
          <line x1="79" y1="74" x2="79" y2="80" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
          <rect x="10" y="80" width="22" height="14" rx="2.5" />
          <rect x="39" y="80" width="22" height="14" rx="2.5" />
          <rect x="68" y="80" width="22" height="14" rx="2.5" />
        </svg>
      );

    // Medium — warning triangle with circuit traces
    case "Medium":
      return (
        <svg viewBox="0 0 100 100" fill="none" stroke="white" strokeLinecap="round" aria-hidden>
          <polygon points="50,8 93,83 7,83" strokeWidth="5.5" strokeLinejoin="round" />
          <line x1="50" y1="34" x2="50" y2="60" strokeWidth="5.5" />
          <circle cx="50" cy="72" r="4.5" fill="white" stroke="none" />
          {/* Corner circuit traces */}
          <polyline points="7,83 0,93 15,93" strokeWidth="2.5" />
          <circle cx="15" cy="93" r="3" fill="white" stroke="none" />
          <polyline points="93,83 100,93 85,93" strokeWidth="2.5" />
          <circle cx="85" cy="93" r="3" fill="white" stroke="none" />
          <line x1="50" y1="83" x2="50" y2="97" strokeWidth="2.5" />
          <circle cx="50" cy="97" r="3" fill="white" stroke="none" />
        </svg>
      );

    // Low — bug / insect
    case "Low":
      return (
        <svg viewBox="0 0 100 100" fill="none" stroke="white" strokeLinecap="round" aria-hidden>
          {/* Body */}
          <ellipse cx="50" cy="63" rx="16" ry="24" strokeWidth="4.5" />
          {/* Head */}
          <circle cx="50" cy="33" r="15" strokeWidth="4.5" />
          {/* Antennae */}
          <line x1="43" y1="20" x2="31" y2="6" strokeWidth="3" />
          <line x1="57" y1="20" x2="69" y2="6" strokeWidth="3" />
          <circle cx="31" cy="6"  r="4" fill="white" stroke="none" />
          <circle cx="69" cy="6"  r="4" fill="white" stroke="none" />
          {/* Legs (3 pairs) */}
          <line x1="34" y1="54" x2="15" y2="44" strokeWidth="3" />
          <line x1="34" y1="63" x2="13" y2="63" strokeWidth="3" />
          <line x1="34" y1="72" x2="15" y2="82" strokeWidth="3" />
          <line x1="66" y1="54" x2="85" y2="44" strokeWidth="3" />
          <line x1="66" y1="63" x2="87" y2="63" strokeWidth="3" />
          <line x1="66" y1="72" x2="85" y2="82" strokeWidth="3" />
        </svg>
      );

    // Info — radar sweep
    case "Info":
      return (
        <svg viewBox="0 0 100 100" fill="none" stroke="white" aria-hidden>
          <circle cx="50" cy="50" r="46" strokeWidth="1.5" strokeDasharray="9 5" />
          <circle cx="50" cy="50" r="34" strokeWidth="1.5" strokeDasharray="6 4" />
          <circle cx="50" cy="50" r="22" strokeWidth="2" />
          <circle cx="50" cy="50" r="5.5" fill="white" stroke="none" />
          {/* Crosshairs */}
          <line x1="50" y1="4"  x2="50" y2="96" strokeWidth="1" strokeDasharray="3 4" />
          <line x1="4"  y1="50" x2="96" y2="50" strokeWidth="1" strokeDasharray="3 4" />
          {/* Sweep sector */}
          <path d="M50 50 L96 50 A46 46 0 0 1 71.5 89.5Z" fill="white" fillOpacity="0.22" stroke="none" />
        </svg>
      );

    default:
      return null;
  }
};

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
  { id: 1, title: "Critical", icon: <FiAlertOctagon />,  color: "#ef4444", rgb: "239,68,68",   gradFrom: "#ff6b7a", gradTo: "#c2182e", cvssRange: "9.0 – 10.0" },
  { id: 2, title: "High",     icon: <FiAlertTriangle />, color: "#f97316", rgb: "249,115,22",  gradFrom: "#ffaa40", gradTo: "#d46200", cvssRange: "7.0 – 8.9"  },
  { id: 3, title: "Medium",   icon: <FiInfo />,           color: "#d97706", rgb: "217,119,6",   gradFrom: "#ffc840", gradTo: "#c07a00", cvssRange: "4.0 – 6.9"  },
  { id: 4, title: "Low",      icon: <FiMinusCircle />,    color: "#16a34a", rgb: "22,163,74",   gradFrom: "#4ecb71", gradTo: "#1a8c3a", cvssRange: "0.1 – 3.9"  },
  { id: 5, title: "Info",     icon: <FiShield />,         color: "#2563eb", rgb: "37,99,235",   gradFrom: "#56aaff", gradTo: "#1460c8", cvssRange: "0.0"        },
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
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-white px-4 py-3.5 shadow-sm dark:border-white/8 dark:bg-[#0d0b1a]/80">

        {/* Left — icon badge + title + findings + subtitle */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-indigo-50 to-slate-50 ring-1 ring-slate-200/80 dark:from-indigo-500/10 dark:to-white/4 dark:ring-white/8">
            <FiLayers className="text-base text-indigo-500 dark:text-indigo-400" />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[14px] font-bold tracking-tight text-slate-800 dark:text-white/90">
                {t("dashboard.overallSeverity")}
              </h2>

              {loading ? (
                <span className="h-5 w-20 animate-pulse rounded-full bg-slate-100 dark:bg-white/8" />
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white px-2.5 py-0.5 text-[10px] font-semibold text-slate-600 shadow-sm dark:border-white/8 dark:bg-white/5 dark:text-white/50">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400 dark:bg-white/35" />
                  {totals.totalAll.toLocaleString()} {t("common.findings")}
                </span>
              )}
            </div>

            <p className="mt-0.5 text-[10px] text-slate-400 dark:text-white/30">
              CVSS v3 Severity Distribution
              {selectedTargets.length > 0 && (
                <> · <span className="font-medium text-slate-500 dark:text-white/45">{selectedScopeLabel}</span></>
              )}
            </p>
          </div>
        </div>

        {/* Right — clear + filter button */}
        <div className="flex items-center gap-2">
          {selectedTargets.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="flex h-7 items-center rounded-lg border border-slate-200/70 px-2.5 text-[10px] font-medium text-slate-500 transition hover:border-slate-300 hover:text-slate-700 dark:border-white/8 dark:text-white/35 dark:hover:border-white/15 dark:hover:text-white/55"
            >
              {t("common.clear")}
            </button>
          )}

          <div className="relative" ref={targetRef}>
            <button
              type="button"
              onClick={() => setOpenTargetQuery(p => !p)}
              className={[
                "flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[10.5px] font-medium shadow-sm transition",
                selectedTargets.length > 0
                  ? "border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-400/25 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/15"
                  : "border-slate-200/70 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/8",
              ].join(" ")}
            >
              <FiShield className="text-[11px]" />
              <span className="max-w-36 truncate">{targetButtonLabel}</span>
              {selectedTargets.length > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-500 px-1 text-[9px] font-bold text-white">
                  {selectedTargets.length}
                </span>
              )}
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
              className="group relative overflow-hidden rounded-3xl text-left shadow-md transition-all duration-200 hover:-translate-y-1.5 hover:shadow-xl active:scale-[0.98]"
              style={{ background: `linear-gradient(145deg, ${card.gradFrom}, ${card.gradTo})` }}
            >
              {/* ── Danger-level decoration ── */}
              <div className="pointer-events-none absolute -bottom-3 -right-3 h-24 w-24 opacity-[0.16] transition-opacity duration-300 group-hover:opacity-[0.30]" aria-hidden>
                {getSeverityDeco(card.title)}
              </div>

              {/* ── Content ── */}
              <div className="relative flex flex-col p-4">

                {/* Row 1 — icon circle + count badge */}
                <div className="mb-3 flex items-start justify-between">
                  {/* Icon circle */}
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/25 text-white text-[20px] ring-1 ring-white/20 transition-transform duration-200 group-hover:scale-105">
                    {card.icon}
                  </div>
                  {/* Count badge (like "Ranking" in reference) */}
                  <div className="flex min-w-11.5 flex-col items-center rounded-2xl bg-white/20 px-2 pt-2 pb-1.5 text-center ring-1 ring-white/15 backdrop-blur-sm">
                    <p className="text-[20px] font-black leading-none text-white">
                      {loading ? "—" : rawNumber.toLocaleString()}
                    </p>
                    <p className="mt-0.5 text-[7px] font-semibold uppercase tracking-widest text-white/55">
                      found
                    </p>
                  </div>
                </div>

                {/* Row 2 — title + CVSS */}
                <p className="text-[13.5px] font-extrabold leading-tight tracking-wide text-white">
                  {card.title}
                </p>
                <p className="mb-4 text-[10px] text-white/55">
                  CVSS {card.cvssRange}
                </p>

                {/* Row 3 — stats */}
                <div className="mb-2.5 flex items-center gap-3">
                  <div>
                    <p className="text-[13px] font-bold leading-none text-white">
                      {loading ? "—" : rawNumber.toLocaleString()}
                    </p>
                    <p className="mt-0.5 text-[8px] uppercase tracking-wider text-white/45">
                      Total
                    </p>
                  </div>
                  {totals.totalAll > 0 && (
                    <>
                      <span className="h-5 w-px bg-white/20" />
                      <div>
                        <p className="text-[13px] font-bold leading-none text-white">
                          {loading ? "—" : `${pct.toFixed(1)}%`}
                        </p>
                        <p className="mt-0.5 text-[8px] uppercase tracking-wider text-white/45">
                          Share
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {/* Row 4 — progress bar */}
                <div className="h-1 w-full overflow-hidden rounded-full bg-white/20">
                  <div
                    className="h-full rounded-full bg-white/65 transition-all duration-700"
                    style={{ width: `${Math.min(pct, 100)}%` }}
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
