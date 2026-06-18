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
// Micro-components (Example-Web-Application style)
// ─────────────────────────────────────────────────────────────

const Pulse: React.FC = () => (
  <span className="inline-block h-9 w-14 animate-pulse rounded-lg bg-slate-100 dark:bg-white/10" />
);

const SubPulse: React.FC = () => (
  <span className="inline-block h-3.5 w-32 animate-pulse rounded bg-slate-100 dark:bg-white/10" />
);

const Bar: React.FC<{ pct: number; color: string }> = ({ pct, color }) => (
  <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/8">
    <div
      className="h-full rounded-full transition-all duration-700"
      style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
    />
  </div>
);

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const getTargetHost = (item: any) => {
  const host =
    item?.host ??
    item?.host_ip ??
    item?.ip ??
    item?.target_ip ??
    item?.ip_host ??
    item?.asset_ip ??
    item?.target_host ??
    item?.target ??
    "";
  return String(host).trim() || "-";
};

const getTargetKey   = (t: string, h: string) => `${t.trim() || "-"}__${h.trim() || "-"}`;
const getTargetLabel = (t: string, h: string) => `${t.trim() || "-"} - ${h.trim() || "-"}`;

// ─────────────────────────────────────────────────────────────
// Card definitions (static — no styling logic)
// ─────────────────────────────────────────────────────────────

const CARDS: CardDef[] = [
  { id: 1, title: "Critical", icon: <FiAlertOctagon />, color: "#ef4444" },
  { id: 2, title: "High",     icon: <FiAlertTriangle />, color: "#f97316" },
  { id: 3, title: "Medium",   icon: <FiInfo />,          color: "#eab308" },
  { id: 4, title: "Low",      icon: <FiMinusCircle />,   color: "#22c55e" },
  { id: 5, title: "Info",     icon: <FiShield />,        color: "#3b82f6" },
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

  const [openTargetQuery, setOpenTargetQuery]   = useState(false);
  const [targetQuerySearch, setTargetQuerySearch] = useState("");
  const [selectedTargets, setSelectedTargets]   = useState<string[]>([]);

  const targetRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (targetRef.current && !targetRef.current.contains(e.target as Node)) {
        setOpenTargetQuery(false);
      }
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
        map.set(key, { task_id: taskID, task_name: taskName, host, target_key: key, target_label: label, critical: 0, high: 0, medium: 0, low: 0, info: 0 });
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
      key: o.key, label: o.label, task_id: o.task_id, task_name: o.task_name, host: o.host, host_ip: o.host,
    }));
  }, [selectedTargetOptions]);

  const totals = useMemo(() => {
    let critical = 0, high = 0, medium = 0, low = 0, info = 0;
    for (const r of filteredRows) {
      critical += r.critical;
      high     += r.high;
      medium   += r.medium;
      low      += r.low;
      info     += r.info;
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
        scopeTask: selectedTargets.length > 0 ? selectedTaskNames : "all",
        task_id:      selectedTaskIDs.length   === 1 ? selectedTaskIDs[0]   : undefined,
        task_ids:     selectedTaskIDs.length   >  0  ? selectedTaskIDs      : undefined,
        task_names:   selectedTaskNames.length >  0  ? selectedTaskNames    : undefined,
        target_keys:  selectedTargets.length   >  0  ? selectedTargets      : undefined,
        target_hosts: selectedTargetHosts.length > 0 ? selectedTargetHosts  : undefined,
        target_pairs: selectedTargetPairs.length > 0 ? selectedTargetPairs  : undefined,
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

        {/* Left: title + finding count */}
        <div className="flex items-center gap-2.5">
          <h2 className="text-[13px] font-semibold text-slate-700 dark:text-white/80">
            {t("dashboard.overallSeverity")}
          </h2>
          <span className="rounded-full border border-slate-200/70 bg-slate-50 px-2.5 py-0.5 text-[10.5px] font-medium text-slate-500 dark:border-white/8 dark:bg-white/5 dark:text-white/40">
            {loading ? t("common.loadingShort") : `${totals.totalAll.toLocaleString()} findings`}
          </span>
        </div>

        {/* Right: scope label + filter button */}
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

            {/* Dropdown */}
            {openTargetQuery && (
              <div className="absolute right-0 z-50 mt-1.5 w-72 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xl dark:border-white/10 dark:bg-[#0d0b1a]">

                {/* Search + controls */}
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

                {/* Options list */}
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
                              checked
                                ? "bg-blue-50 dark:bg-blue-500/10"
                                : "hover:bg-slate-50 dark:hover:bg-white/5",
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

          return (
            <button
              key={card.id}
              type="button"
              onClick={() => handleNavigateByLevel(card.title)}
              className="rounded-xl border border-slate-200/70 bg-white px-5 py-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-white/8 dark:bg-[#0d0b1a]/80"
            >
              {/* Label + Icon */}
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium tracking-wide text-slate-500 dark:text-white/45">
                  {card.title}
                </p>
                <span style={{ color: card.color }} className="text-[15px] opacity-75">
                  {card.icon}
                </span>
              </div>

              {/* Value */}
              <p className="mt-3 text-[34px] font-bold leading-none tracking-tight text-slate-900 dark:text-white">
                {loading ? <Pulse /> : rawNumber.toLocaleString()}
              </p>

              {/* Sub */}
              <p className="mt-2 text-[11px] text-slate-400 dark:text-white/35">
                {loading ? <SubPulse /> : makeSubtitle(rawNumber)}
              </p>

              {/* Bar */}
              <Bar pct={percent(rawNumber)} color={card.color} />
            </button>
          );
        })}
      </div>

    </div>
  );
};

export default OverallSeverity;
