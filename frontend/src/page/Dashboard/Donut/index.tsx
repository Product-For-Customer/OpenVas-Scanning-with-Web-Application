import React, { useEffect, useMemo, useRef, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import {
  FiShield,
  FiChevronDown,
  FiSearch,
  FiCheck,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import type { VulnerabilityLevelDTO } from "../../../services";
import { useLanguage } from "../../../contexts/LanguageContext";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type SeverityKey = "Critical" | "High" | "Medium" | "Low" | "Info";

type SeverityItem = {
  name: SeverityKey;
  value: number;
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
// Constants
// ─────────────────────────────────────────────────────────────

const COLORS: Record<SeverityKey, string> = {
  Critical: "#ef4444",
  High:     "#f97316",
  Medium:   "#eab308",
  Low:      "#22c55e",
  Info:     "#3b82f6",
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const getTargetHost = (item: any) =>
  String(item?.host ?? item?.host_ip ?? item?.ip ?? item?.target_ip ?? item?.ip_host ?? item?.asset_ip ?? item?.target_host ?? item?.target ?? "").trim() || "-";

const getTargetKey   = (t: string, h: string) => `${t.trim() || "-"}__${h.trim() || "-"}`;
const getTargetLabel = (t: string, h: string) => `${t.trim() || "-"} - ${h.trim() || "-"}`;
const formatPercent  = (p: number) => `${(p * 100).toFixed(1)}%`;

// ─────────────────────────────────────────────────────────────
// Tooltip
// ─────────────────────────────────────────────────────────────

const CustomTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ payload?: SeverityItem }>;
  total: number;
}> = ({ active, payload, total }) => {
  if (!active || !payload?.length) return null;
  const item = payload[0]?.payload as SeverityItem | undefined;
  if (!item) return null;
  const pct = total > 0 ? item.value / total : 0;
  return (
    <div
      className="rounded-xl px-3 py-2 text-[10.5px] font-semibold text-white shadow-xl"
      style={{ background: item.color, minWidth: 140 }}
    >
      <div className="flex items-center justify-between gap-2">
        <span>{item.name}</span>
        <span className="tabular-nums">{item.value.toLocaleString()}</span>
      </div>
      <p className="mt-0.5 text-[10px] text-white/85">{formatPercent(pct)} of findings</p>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

const DonutVulnerability: React.FC<Props> = ({
  vulnerabilityData = [],
  loading = false,
}) => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [openFilter, setOpenFilter] = useState(false);
  const [filterSearch, setFilterSearch] = useState("");
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const filterRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setOpenFilter(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Rows ──────────────────────────────────────────────────

  const rows = useMemo<SummaryRow[]>(() => {
    const map = new Map<string, SummaryRow>();
    for (const item of vulnerabilityData) {
      const taskName = String((item as any)?.task_name ?? "").trim() || "Unknown";
      const taskID   = String((item as any)?.task_id   ?? "").trim();
      const host     = getTargetHost(item);
      const key      = getTargetKey(taskName, host);
      const label    = getTargetLabel(taskName, host);
      if (!map.has(key)) map.set(key, { task_id: taskID, task_name: taskName, host, target_key: key, target_label: label, critical: 0, high: 0, medium: 0, low: 0, info: 0 });
      const row = map.get(key)!;
      const n = Number(item?.total ?? 0);
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
    const kw = filterSearch.trim().toLowerCase();
    return kw ? targetOptions.filter(o => o.label.toLowerCase().includes(kw)) : targetOptions;
  }, [targetOptions, filterSearch]);

  const selectedTargetOptions = useMemo(() => {
    const set = new Set(selectedTargets);
    return targetOptions.filter(o => set.has(o.key));
  }, [targetOptions, selectedTargets]);

  const filteredRows = useMemo(() => {
    if (selectedTargets.length === 0) return rows;
    const set = new Set(selectedTargets);
    return rows.filter(r => set.has(r.target_key));
  }, [rows, selectedTargets]);

  const selectedTaskIDs = useMemo(() => {
    if (selectedTargets.length === 0) return [];
    return Array.from(new Set(filteredRows.map(r => r.task_id).filter(Boolean)));
  }, [filteredRows, selectedTargets.length]);

  const selectedTargetLabels  = useMemo(() => selectedTargetOptions.map(o => o.label), [selectedTargetOptions]);
  const selectedTargetHosts   = useMemo(() => [...new Set(selectedTargetOptions.map(o => o.host).filter(Boolean))], [selectedTargetOptions]);
  const selectedTargetPairs   = useMemo(() => selectedTargetOptions.map(o => ({ key: o.key, label: o.label, task_id: o.task_id, task_name: o.task_name, host: o.host })), [selectedTargetOptions]);

  const totals = useMemo(() => {
    let critical = 0, high = 0, medium = 0, low = 0, info = 0;
    for (const r of filteredRows) { critical += r.critical; high += r.high; medium += r.medium; low += r.low; info += r.info; }
    return { critical, high, medium, low, info };
  }, [filteredRows]);

  const data = useMemo<SeverityItem[]>(() => {
    const items: SeverityItem[] = [
      { name: "Critical", value: totals.critical, color: COLORS.Critical },
      { name: "High",     value: totals.high,     color: COLORS.High },
      { name: "Medium",   value: totals.medium,   color: COLORS.Medium },
      { name: "Low",      value: totals.low,       color: COLORS.Low },
      { name: "Info",     value: totals.info,      color: COLORS.Info },
    ];
    const nonZero = items.filter(i => i.value > 0);
    return nonZero.length > 0 ? nonZero : items;
  }, [totals]);

  const total = useMemo(() => data.reduce((s, d) => s + d.value, 0), [data]);

  const allVisible = filteredTargetOptions.length > 0 && filteredTargetOptions.every(o => selectedTargets.includes(o.key));

  const filterButtonLabel =
    selectedTargets.length === 0 ? t("dashboard.targetQuery") :
    selectedTargets.length === 1 ? "1 selected" :
    `${selectedTargets.length} selected`;

  const toggleTarget = (key: string) =>
    setSelectedTargets(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  const handleSelectAll = () => {
    const keys = filteredTargetOptions.map(o => o.key);
    setSelectedTargets(prev => allVisible ? prev.filter(k => !keys.includes(k)) : Array.from(new Set([...prev, ...keys])));
  };

  const handleNavigateByLevel = (level: SeverityKey) => {
    navigate("/admin/vulnerability-by-level", {
      state: {
        level,
        scopeTask: selectedTargets.length > 0 ? selectedTargetLabels : "all",
        task_id:      selectedTaskIDs.length === 1 ? selectedTaskIDs[0] : undefined,
        task_ids:     selectedTaskIDs.length  >  0 ? selectedTaskIDs    : undefined,
        target_keys:  selectedTargets.length  >  0 ? selectedTargets    : undefined,
        target_labels: selectedTargetLabels.length > 0 ? selectedTargetLabels : undefined,
        target_hosts:  selectedTargetHosts.length  > 0 ? selectedTargetHosts  : undefined,
        target_pairs:  selectedTargetPairs.length  > 0 ? selectedTargetPairs  : undefined,
      },
    });
  };

  return (
    <section className="flex h-full min-h-140 w-full flex-col rounded-xl border border-slate-200/70 bg-white p-4 dark:border-white/8 dark:bg-[#0d0b1a]/80 sm:p-5 xl:min-h-155">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-[13px] font-semibold text-slate-700 dark:text-white/80">
            {t("dashboard.vulnerabilityDistribution")}
          </h2>
          <span className="rounded-full border border-slate-200/70 bg-slate-50 px-2.5 py-0.5 text-[10.5px] font-medium text-slate-500 dark:border-white/8 dark:bg-white/5 dark:text-white/40">
            {loading ? t("common.loadingShort") : `${total.toLocaleString()} ${t("common.total")}`}
          </span>
        </div>

        {/* Target filter */}
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
            <div className="absolute right-0 z-30 mt-1.5 w-64 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xl dark:border-white/10 dark:bg-[#0d0b1a]">
              <div className="border-b border-slate-100 p-2.5 dark:border-white/8">
                <div className="flex items-center gap-2 rounded-lg border border-slate-200/70 bg-slate-50 px-2.5 dark:border-white/8 dark:bg-white/5">
                  <FiSearch className="shrink-0 text-[11px] text-slate-400 dark:text-white/35" />
                  <input
                    value={filterSearch}
                    onChange={e => setFilterSearch(e.target.value)}
                    placeholder={t("dashboard.searchTarget")}
                    className="h-8 w-full bg-transparent text-[11px] text-slate-700 outline-none placeholder:text-slate-400 dark:text-white/75 dark:placeholder:text-white/30"
                  />
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <button type="button" onClick={handleSelectAll} className="text-[10px] font-medium text-blue-500 hover:text-blue-600 dark:text-blue-400">
                    {allVisible ? t("common.unselectAll") : t("common.selectAll")}
                  </button>
                  <button type="button" onClick={() => setSelectedTargets([])} className="text-[10px] font-medium text-slate-400 hover:text-slate-600 dark:text-white/35">
                    {t("common.clear")}
                  </button>
                </div>
              </div>
              <div className="max-h-56 overflow-y-auto p-2">
                {filteredTargetOptions.length === 0 ? (
                  <p className="py-5 text-center text-[11px] text-slate-400 dark:text-white/35">{t("common.noResults")}</p>
                ) : (
                  <div className="space-y-0.5">
                    {filteredTargetOptions.map(opt => {
                      const checked = selectedTargets.includes(opt.key);
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => toggleTarget(opt.key)}
                          className={["flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition", checked ? "bg-blue-50 dark:bg-blue-500/10" : "hover:bg-slate-50 dark:hover:bg-white/5"].join(" ")}
                        >
                          <span className={["flex h-4 w-4 shrink-0 items-center justify-center rounded border transition", checked ? "border-blue-500 bg-blue-500 text-white" : "border-slate-300 bg-white text-transparent dark:border-white/20 dark:bg-white/5"].join(" ")}>
                            <FiCheck className="text-[9px]" />
                          </span>
                          <span className="truncate text-[11px] text-slate-700 dark:text-white/75">{opt.label}</span>
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

      {/* ── Donut chart ── */}
      <div className="mt-4 flex flex-1 flex-col">
        <div className="flex flex-1 items-center justify-center">
          <div className="relative mx-auto h-64 w-full max-w-64 sm:h-72 sm:max-w-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="62%"
                  outerRadius="86%"
                  paddingAngle={3}
                  stroke="rgba(255,255,255,0.95)"
                  strokeWidth={2}
                  onClick={entry => entry?.name && handleNavigateByLevel(entry.name as SeverityKey)}
                  cursor="pointer"
                >
                  {data.map(entry => (
                    <Cell key={entry.name} fill={entry.color} style={{ cursor: "pointer" }} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip total={total} />} />
              </PieChart>
            </ResponsiveContainer>

            {/* Centre label */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400 dark:text-white/35">{t("common.total").toUpperCase()}</span>
              <span className="mt-1 text-[28px] font-bold leading-none tracking-tight text-slate-900 dark:text-white sm:text-[32px]">
                {loading ? "…" : total.toLocaleString()}
              </span>
              <span className="mt-1 text-[10px] text-slate-500 dark:text-white/40">{t("common.findings")}</span>
            </div>
          </div>
        </div>

        {/* ── Legend ── */}
        <div className="mt-3 rounded-xl border border-slate-200/70 bg-slate-50 px-4 py-3 dark:border-white/8 dark:bg-white/3">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            {(["Critical","High","Medium","Low","Info"] as SeverityKey[]).map(k => {
              const item = data.find(d => d.name === k) ?? { name: k, value: 0, color: COLORS[k] };
              const pct  = total > 0 ? item.value / total : 0;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => handleNavigateByLevel(k)}
                  className="flex items-center gap-1.5 transition hover:opacity-75"
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: COLORS[k] }} />
                  <span className="text-[10.5px] font-medium text-slate-700 dark:text-white/80">{k}</span>
                  <span className="text-[10px] tabular-nums text-slate-500 dark:text-white/45">
                    {loading ? "…" : item.value.toLocaleString()}
                  </span>
                  <span className="text-[10px] tabular-nums text-slate-400 dark:text-white/30">
                    {loading ? "" : `(${formatPercent(pct)})`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default DonutVulnerability;
