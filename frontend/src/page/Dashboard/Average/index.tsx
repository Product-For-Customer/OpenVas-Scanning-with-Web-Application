import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from "recharts";
import {
  FiShield,
  FiChevronDown,
  FiSearch,
  FiCheck,
} from "react-icons/fi";
import { ListAssetRisk, type AssetRiskDTO } from "../../../services";
import { useLanguage } from "../../../contexts/LanguageContext";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type TargetOption = {
  key: string;
  label: string;
  task_name: string;
  host: string;
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const clamp       = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const fmtNumber   = (n: number) => Number.isFinite(n) ? n.toLocaleString() : "0";
const fmtRisk     = (n: number) => Number.isFinite(n) ? n.toFixed(2) : "0.00";

const getHost   = (item: any) => String(item?.host ?? item?.host_ip ?? item?.ip ?? item?.target_ip ?? item?.ip_host ?? item?.asset_ip ?? item?.target_host ?? item?.target ?? "").trim() || "-";
const getName   = (item: any) => String(item?.task_name ?? "").trim() || "Unknown";
const getKey    = (t: string, h: string) => `${t.trim() || "-"}__${h.trim() || "-"}`;
const getLabel  = (t: string, h: string) => `${t.trim() || "-"} - ${h.trim() || "-"}`;

const riskTone = (risk: number) => {
  if (risk >= 8) return { label: "Critical", dot: "bg-red-500",    text: "text-red-600 dark:text-red-300",    chip: "bg-red-50 border-red-200 text-red-600 dark:bg-red-500/10 dark:border-red-400/20 dark:text-red-300",    gauge: "#ef4444" };
  if (risk >= 6) return { label: "High",     dot: "bg-orange-500", text: "text-orange-600 dark:text-orange-300", chip: "bg-orange-50 border-orange-200 text-orange-600 dark:bg-orange-500/10 dark:border-orange-400/20 dark:text-orange-300", gauge: "#f97316" };
  if (risk >= 4) return { label: "Medium",   dot: "bg-yellow-500", text: "text-yellow-600 dark:text-yellow-300", chip: "bg-yellow-50 border-yellow-200 text-yellow-700 dark:bg-yellow-500/10 dark:border-yellow-400/20 dark:text-yellow-300", gauge: "#eab308" };
  if (risk > 0)  return { label: "Low",      dot: "bg-green-500",  text: "text-green-600 dark:text-green-300",  chip: "bg-green-50 border-green-200 text-green-700 dark:bg-green-500/10 dark:border-green-400/20 dark:text-green-300",  gauge: "#22c55e" };
  return               { label: "Info",      dot: "bg-blue-500",   text: "text-blue-600 dark:text-blue-300",   chip: "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-500/10 dark:border-blue-400/20 dark:text-blue-300",   gauge: "#3b82f6" };
};

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

const AverageVulnerability: React.FC = () => {
  const { t } = useLanguage();
  const [data, setData]     = useState<AssetRiskDTO[] | null>(null);
  const [loading, setLoading] = useState(true);

  const [openFilter, setOpenFilter]     = useState(false);
  const [filterSearch, setFilterSearch] = useState("");
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const filterRef = useRef<HTMLDivElement | null>(null);

  const hasFetchedRef  = useRef(false);
  const isFetchingRef  = useRef(false);
  const isMountedRef   = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    const fetch = async () => {
      if (isFetchingRef.current) return;
      try {
        isFetchingRef.current = true;
        if (isMountedRef.current) setLoading(true);
        const res = await ListAssetRisk();
        if (!isMountedRef.current) return;
        setData(Array.isArray(res) ? res : []);
      } catch {
        if (isMountedRef.current) setData([]);
      } finally {
        if (isMountedRef.current) setLoading(false);
        isFetchingRef.current = false;
      }
    };
    void fetch();
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setOpenFilter(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Derived ──────────────────────────────────────────────

  const targetOptions = useMemo<TargetOption[]>(() => {
    const list = Array.isArray(data) ? data : [];
    const seen = new Set<string>();
    const opts: TargetOption[] = [];
    for (const item of list) {
      const taskName = getName(item);
      const host     = getHost(item);
      const key      = getKey(taskName, host);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      opts.push({ key, label: getLabel(taskName, host), task_name: taskName, host });
    }
    return opts.sort((a, b) => a.label.localeCompare(b.label));
  }, [data]);

  const filteredTargetOptions = useMemo(() => {
    const kw = filterSearch.trim().toLowerCase();
    return kw ? targetOptions.filter(o => o.label.toLowerCase().includes(kw)) : targetOptions;
  }, [targetOptions, filterSearch]);

  const filteredData = useMemo(() => {
    const list = Array.isArray(data) ? data : [];
    if (selectedTargets.length === 0) return list;
    const set = new Set(selectedTargets);
    return list.filter(item => set.has(getKey(getName(item), getHost(item))));
  }, [data, selectedTargets]);

  const summary = useMemo(() => {
    const taskCount = filteredData.length;
    const avgRisk   = taskCount > 0 ? filteredData.reduce((s, i) => s + (Number(i.risk_score) || 0), 0) / taskCount : 0;
    const maxRisk   = filteredData.reduce((m, i) => Math.max(m, Number(i.risk_score) || 0), 0);
    return { taskCount, avgRisk, maxRisk };
  }, [filteredData]);

  const tone      = useMemo(() => riskTone(summary.avgRisk), [summary.avgRisk]);
  const gaugeData = useMemo(() => [{ name: "Average Risk", value: clamp(summary.avgRisk, 0, 10), fill: tone.gauge }], [summary.avgRisk, tone.gauge]);

  const allVisible = filteredTargetOptions.length > 0 && filteredTargetOptions.every(o => selectedTargets.includes(o.key));

  const filterButtonLabel =
    selectedTargets.length === 0 ? t("dashboard.targetQuery") :
    selectedTargets.length === 1 ? "1 selected" :
    `${selectedTargets.length} selected`;

  const toggleTarget  = (key: string) =>
    setSelectedTargets(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  const handleSelectAll = () => {
    const keys = filteredTargetOptions.map(o => o.key);
    setSelectedTargets(prev => allVisible ? prev.filter(k => !keys.includes(k)) : Array.from(new Set([...prev, ...keys])));
  };

  return (
    <section className="flex h-full min-h-140 w-full flex-col rounded-xl border border-slate-200/70 bg-white p-4 dark:border-white/8 dark:bg-[#0d0b1a]/80 sm:p-5 xl:min-h-155">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-[13px] font-semibold text-slate-700 dark:text-white/80">
            {t("dashboard.averageRiskOverview")}
          </h2>
          {!loading && (
            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10.5px] font-semibold ${tone.chip}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
              {tone.label}
            </span>
          )}
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

      {/* ── Sub text ── */}
      <p className="mt-3 text-[11px] text-slate-400 dark:text-white/30">
        {selectedTargets.length === 0
          ? t("dashboard.riskDistributionAll")
          : t("dashboard.riskDistributionSelected").replace("{n}", String(selectedTargets.length))}
      </p>

      {/* ── Gauge + stats ── */}
      <div className="mt-3 flex flex-1 flex-col">
        <div className="flex-1 rounded-xl border border-slate-200/70 bg-slate-50/50 px-4 py-3 dark:border-white/8 dark:bg-white/3">
          <div className="flex h-full flex-col">

            {/* Range header */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">{t("dashboard.range")}</p>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-white/45">0.00 – 10.00</p>
              </div>
            </div>

            {/* Radial gauge */}
            <div className="relative mt-2 min-h-56 flex-1 sm:min-h-64">
              {/* Centre value */}
              <div className="pointer-events-none absolute left-1/2 top-[50%] z-10 -translate-x-1/2 -translate-y-1/2 text-center">
                <div className={`text-[34px] font-bold leading-none tracking-tight ${tone.text} sm:text-[40px]`}>
                  {loading ? "—" : fmtRisk(summary.avgRisk)}
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500 dark:text-white/45">{t("dashboard.averageRiskScore")}</p>
              </div>

              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  data={gaugeData}
                  startAngle={205}
                  endAngle={-25}
                  innerRadius="68%"
                  outerRadius="100%"
                  barSize={18}
                >
                  <PolarAngleAxis type="number" domain={[0, 10]} tick={false} />
                  <RadialBar
                    background={{ fill: "rgba(148,163,184,0.12)" }}
                    dataKey="value"
                    cornerRadius={999}
                  />
                </RadialBarChart>
              </ResponsiveContainer>

              {/* Min / Max labels */}
              <div className="pointer-events-none absolute inset-x-4 bottom-2 flex items-center justify-between text-[10px] text-slate-400 dark:text-white/30 sm:text-[11px]">
                <span>0</span>
                <span>10</span>
              </div>
            </div>

            {/* Mini stat cards */}
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200/70 bg-white px-4 py-3 dark:border-white/8 dark:bg-white/4">
                <p className="text-[11px] font-medium tracking-wide text-slate-500 dark:text-white/45">{t("dashboard.targets")}</p>
                <p className="mt-2 text-[22px] font-bold leading-none tracking-tight text-slate-900 dark:text-white">
                  {loading ? t("common.loadingShort") : fmtNumber(summary.taskCount)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200/70 bg-white px-4 py-3 dark:border-white/8 dark:bg-white/4">
                <p className="text-[11px] font-medium tracking-wide text-slate-500 dark:text-white/45">{t("dashboard.highestRisk")}</p>
                <p className="mt-2 text-[22px] font-bold leading-none tracking-tight text-slate-900 dark:text-white">
                  {loading ? t("common.loadingShort") : fmtRisk(summary.maxRisk)}
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
};

export default AverageVulnerability;
