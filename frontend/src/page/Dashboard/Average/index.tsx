import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FiShield,
  FiChevronDown,
  FiSearch,
  FiCheck,
  FiTarget,
  FiAlertTriangle,
} from "react-icons/fi";
import { ListAssetRisk, type AssetRiskDTO } from "../../../services";
import { useLanguage } from "../../../contexts/LanguageContext";
import type { TranslationKey } from "../../../locales";

// ─── Types ───────────────────────────────────────────────────────────────────

type TargetOption = { key: string; label: string; task_name: string; host: string };

// ─── Helpers ─────────────────────────────────────────────────────────────────

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const fmtNumber = (n: number) => (Number.isFinite(n) ? n.toLocaleString() : "0");
const fmtRisk = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : "0.00");
const getHost = (item: any) =>
  String(item?.host ?? item?.host_ip ?? item?.ip ?? item?.target_ip ?? item?.ip_host ?? item?.asset_ip ?? item?.target_host ?? item?.target ?? "").trim() || "-";
const getName = (item: any) => String(item?.task_name ?? "").trim() || "Unknown";
const getKey = (t: string, h: string) => `${t.trim() || "-"}__${h.trim() || "-"}`;
const getLabel = (t: string, h: string) => `${t.trim() || "-"} - ${h.trim() || "-"}`;

// CVSS v3 standard thresholds
type TFn = (key: TranslationKey, vars?: Record<string, string | number>) => string;

const riskTone = (risk: number, t: TFn) => {
  if (risk >= 9.0)
    return {
      label: t("severity.critical"), statusLabel: t("dashboard.riskCritical"),
      dot: "bg-red-500",
      text: "text-red-600 dark:text-red-400",
      chip: "bg-red-50 border-red-200 text-red-600 dark:bg-red-500/10 dark:border-red-400/20 dark:text-red-300",
      color: "#ef4444",
      cvssRange: "9.0 – 10.0",
    };
  if (risk >= 7.0)
    return {
      label: t("severity.high"), statusLabel: t("dashboard.riskHigh"),
      dot: "bg-orange-500",
      text: "text-orange-600 dark:text-orange-400",
      chip: "bg-orange-50 border-orange-200 text-orange-600 dark:bg-orange-500/10 dark:border-orange-400/20 dark:text-orange-300",
      color: "#f97316",
      cvssRange: "7.0 – 8.9",
    };
  if (risk >= 4.0)
    return {
      label: t("severity.medium"), statusLabel: t("dashboard.riskMedium"),
      dot: "bg-yellow-500",
      text: "text-yellow-600 dark:text-yellow-400",
      chip: "bg-yellow-50 border-yellow-200 text-yellow-700 dark:bg-yellow-500/10 dark:border-yellow-400/20 dark:text-yellow-300",
      color: "#eab308",
      cvssRange: "4.0 – 6.9",
    };
  if (risk > 0)
    return {
      label: t("severity.low"), statusLabel: t("dashboard.riskLow"),
      dot: "bg-green-500",
      text: "text-green-600 dark:text-green-400",
      chip: "bg-green-50 border-green-200 text-green-700 dark:bg-green-500/10 dark:border-green-400/20 dark:text-green-300",
      color: "#22c55e",
      cvssRange: "0.1 – 3.9",
    };
  return {
    label: t("severity.info"), statusLabel: t("dashboard.riskNone"),
    dot: "bg-blue-500",
    text: "text-blue-600 dark:text-blue-400",
    chip: "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-500/10 dark:border-blue-400/20 dark:text-blue-300",
    color: "#3b82f6",
    cvssRange: "0.0",
  };
};

// ─── Gauge SVG ───────────────────────────────────────────────────────────────
//
// 5 CVSS-proportional segments on a 0–10 arc.
// Info gets a minimum visible slit (0–0.5) so it renders.
// Needle angle = 180° + (score/10) × 180°
// (180° = left/None edge, 270° = top/Medium, 360° = right/Critical edge)

const GAUGE_SEGS = [
  // from/to map directly to the 0–10 CVSS score axis
  { key: "info",     labelKey: "severity.info",     from: 0,    to: 0.5,  color: "#3b82f6" }, // min-visible slit
  { key: "low",      labelKey: "severity.low",      from: 0.5,  to: 4.0,  color: "#22c55e" }, // 0.1–3.9
  { key: "medium",   labelKey: "severity.medium",   from: 4.0,  to: 7.0,  color: "#eab308" }, // 4.0–6.9
  { key: "high",     labelKey: "severity.high",     from: 7.0,  to: 9.0,  color: "#f97316" }, // 7.0–8.9
  { key: "critical", labelKey: "severity.critical", from: 9.0,  to: 10.0, color: "#ef4444" }, // 9.0–10.0
] as const;

const GCX = 150, GCY = 148;         // pivot center in SVG units
const ROUT = 120, RIN = 78;         // outer / inner radius
const SEG_GAP = 1.8;                // degrees gap between segments
const LABEL_R = ROUT + 18;          // label orbit radius

const scoreToAngle = (s: number): number => 180 + (s / 10) * 180;

const pt = (angleDeg: number, r: number) => ({
  x: GCX + r * Math.cos((angleDeg * Math.PI) / 180),
  y: GCY + r * Math.sin((angleDeg * Math.PI) / 180),
});

const segPath = (fromScore: number, toScore: number): string => {
  const a1 = scoreToAngle(fromScore) + SEG_GAP / 2;
  const a2 = scoreToAngle(toScore)   - SEG_GAP / 2;
  const o1 = pt(a1, ROUT), o2 = pt(a2, ROUT);
  const i1 = pt(a1, RIN),  i2 = pt(a2, RIN);
  const large = a2 - a1 > 180 ? 1 : 0;
  const f = (n: number) => n.toFixed(3);
  return [
    `M ${f(o1.x)} ${f(o1.y)}`,
    `A ${ROUT} ${ROUT} 0 ${large} 1 ${f(o2.x)} ${f(o2.y)}`,
    `L ${f(i2.x)} ${f(i2.y)}`,
    `A ${RIN} ${RIN} 0 ${large} 0 ${f(i1.x)} ${f(i1.y)}`,
    `Z`,
  ].join(" ");
};

interface GaugeProps { score: number; loading?: boolean }

const RiskGaugeChart: React.FC<GaugeProps> = ({ score, loading = false }) => {
  const { t } = useLanguage();
  const safe     = clamp(score, 0, 10);
  const rotation = scoreToAngle(safe) - 270; // base needle points at 270° (top)
  const NEEDLE_LEN = ROUT - 12;
  const f = (n: number) => n.toFixed(2);

  return (
    <svg viewBox="0 0 300 158" className="w-full" style={{ overflow: "visible" }}>
      <defs>
        <filter id="needle-drop" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="2.5" floodOpacity="0.28" />
        </filter>
      </defs>

      {/* Colored CVSS segments */}
      {GAUGE_SEGS.map(seg => (
        <path
          key={seg.key}
          d={segPath(seg.from, seg.to)}
          fill={loading ? "rgba(148,163,184,0.18)" : seg.color}
        />
      ))}

      {/* Outer labels */}
      {GAUGE_SEGS.map(seg => {
        const mid = (seg.from + seg.to) / 2;
        const pos = pt(scoreToAngle(mid), LABEL_R);
        const label = t(seg.labelKey);
        const words = label.split(" ");
        return (
          <text
            key={`lbl-${seg.key}`}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="7.2"
            fontWeight="700"
            letterSpacing="0.5"
            fill={loading ? "rgba(148,163,184,0.45)" : seg.color}
            style={{ fontFamily: "inherit" }}
          >
            {words.length === 1 ? (
              <tspan x={f(pos.x)} y={f(pos.y)}>{label.toUpperCase()}</tspan>
            ) : (
              <>
                <tspan x={f(pos.x)} y={f(pos.y - 4.5)}>{words[0].toUpperCase()}</tspan>
                <tspan x={f(pos.x)} dy="9.5">{words[1].toUpperCase()}</tspan>
              </>
            )}
          </text>
        );
      })}

      {/* Needle */}
      {!loading && (
        <g transform={`rotate(${f(rotation)}, ${GCX}, ${GCY})`}>
          <polygon
            points={`${GCX},${GCY - NEEDLE_LEN} ${GCX - 4.5},${GCY + 9} ${GCX + 4.5},${GCY + 9}`}
            className="fill-slate-800 dark:fill-slate-100"
            filter="url(#needle-drop)"
          />
        </g>
      )}

      {/* Pivot */}
      <circle cx={GCX} cy={GCY} r={10} className="fill-slate-800 dark:fill-slate-100" />
      <circle cx={GCX} cy={GCY} r={5}  className="fill-white dark:fill-[#0d0b1a]" />
    </svg>
  );
};

// ─── Component ───────────────────────────────────────────────────────────────

const AverageVulnerability: React.FC = () => {
  const { t } = useLanguage();
  const [data, setData]       = useState<AssetRiskDTO[] | null>(null);
  const [loading, setLoading] = useState(true);

  const [openFilter, setOpenFilter]         = useState(false);
  const [filterSearch, setFilterSearch]     = useState("");
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const filterRef = useRef<HTMLDivElement | null>(null);

  const hasFetchedRef = useRef(false);
  const isFetchingRef = useRef(false);
  const isMountedRef  = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    const fetchData = async () => {
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
    void fetchData();
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node))
        setOpenFilter(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Derived ──────────────────────────────────────────────────────────────

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
    const avgRisk   = taskCount > 0
      ? filteredData.reduce((s, i) => s + (Number(i.risk_score) || 0), 0) / taskCount
      : 0;
    const maxRisk = filteredData.reduce((m, i) => Math.max(m, Number(i.risk_score) || 0), 0);
    return { taskCount, avgRisk, maxRisk };
  }, [filteredData]);

  const tone    = useMemo(() => riskTone(summary.avgRisk, t), [summary.avgRisk, t]);
  const maxTone = useMemo(() => riskTone(summary.maxRisk, t), [summary.maxRisk, t]);

  const allVisible =
    filteredTargetOptions.length > 0 &&
    filteredTargetOptions.every(o => selectedTargets.includes(o.key));

  const filterButtonLabel =
    selectedTargets.length === 0 ? t("dashboard.targetQuery") :
    selectedTargets.length === 1 ? t("dashboard.oneSelected") :
    t("dashboard.nSelected", { n: selectedTargets.length });

  const toggleTarget = (key: string) =>
    setSelectedTargets(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );

  const handleSelectAll = () => {
    const keys = filteredTargetOptions.map(o => o.key);
    setSelectedTargets(prev =>
      allVisible
        ? prev.filter(k => !keys.includes(k))
        : Array.from(new Set([...prev, ...keys]))
    );
  };

  return (
    <section className="flex h-full min-h-140 w-full flex-col rounded-xl border border-slate-200/70 bg-white p-4 dark:border-white/8 dark:bg-[#0d0b1a]/80 sm:p-5 xl:min-h-155">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-[13px] font-bold text-slate-800 dark:text-white/90">
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
                  <p className="py-5 text-center text-[11px] text-slate-400 dark:text-white/35">
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
                          <span className={[
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition",
                            checked
                              ? "border-blue-500 bg-blue-500 text-white"
                              : "border-slate-300 bg-white text-transparent dark:border-white/20 dark:bg-white/5",
                          ].join(" ")}>
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

      {/* ── Subtext ── */}
      <p className="mt-3 text-[11px] text-slate-400 dark:text-white/30">
        {selectedTargets.length === 0
          ? t("dashboard.riskDistributionAll")
          : t("dashboard.riskDistributionSelected").replace("{n}", String(selectedTargets.length))}
      </p>

      {/* ── Main content card ── */}
      <div className="mt-3 flex flex-1 flex-col">
        <div className="flex flex-1 flex-col rounded-xl border border-slate-200/70 bg-slate-50/50 px-3 py-3 dark:border-white/8 dark:bg-white/3">

          {/* Range label */}
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">
              {t("dashboard.range")} {t("dashboard.cvssRatingScoreSuffix")}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-white/45">0.00 – 10.00</p>
          </div>

          {/* ── Gauge centered (flex-1 fills remaining space) ── */}
          <div className="flex flex-1 flex-col items-center justify-center py-2">

            {/* SVG gauge */}
            <div className="w-full px-1">
              <RiskGaugeChart score={summary.avgRisk} loading={loading} />
            </div>

            {/* Score + status */}
            <div className="mt-1 text-center">
              <p className={`text-[36px] font-bold leading-none tracking-tight sm:text-[40px] ${tone.text}`}>
                {loading ? "—" : fmtRisk(summary.avgRisk)}
              </p>
              <p className="mt-1 text-[10px] text-slate-500 dark:text-white/40">
                {t("dashboard.averageRiskScore")}
                {!loading && (
                  <span className="ml-1" style={{ color: tone.color }}>
                    ({tone.cvssRange})
                  </span>
                )}
              </p>
              <p
                className="mt-2 text-[11px] font-bold tracking-[0.14em]"
                style={{ color: loading ? "#94a3b8" : tone.color }}
              >
                {loading ? "· · ·" : tone.statusLabel}
              </p>
            </div>

          </div>

          {/* ── Divider ── */}
          <div className="my-1 border-t border-slate-200/70 dark:border-white/8" />

          {/* ── Stat cards pinned to bottom ── */}
          <div className="grid grid-cols-2 gap-3 pt-2">

            {/* Targets */}
            <div className="relative overflow-hidden rounded-xl border border-slate-200/70 bg-white px-3.5 py-3 shadow-sm dark:border-white/8 dark:bg-white/4">
              <div className="absolute inset-x-0 top-0 h-0.75 rounded-t-xl bg-blue-500" />
              <div className="mb-2 flex items-center gap-1.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-50 dark:bg-blue-500/12">
                  <FiTarget className="text-[11px] text-blue-500" />
                </span>
                <p className="text-[10.5px] font-medium text-slate-500 dark:text-white/45">
                  {t("dashboard.targets")}
                </p>
              </div>
              <p className="text-[26px] font-bold leading-none tracking-tight text-slate-900 dark:text-white">
                {loading ? "—" : fmtNumber(summary.taskCount)}
              </p>
              <p className="mt-1 text-[9px] text-slate-400 dark:text-white/30">
                {loading ? "" : t("dashboard.totalAssets")}
              </p>
            </div>

            {/* Highest Risk */}
            <div className="relative overflow-hidden rounded-xl border border-slate-200/70 bg-white px-3.5 py-3 shadow-sm dark:border-white/8 dark:bg-white/4">
              <div
                className="absolute inset-x-0 top-0 h-0.75 rounded-t-xl"
                style={{ backgroundColor: loading ? "#94a3b8" : maxTone.color }}
              />
              <div className="mb-2 flex items-center gap-1.5">
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-md"
                  style={{ backgroundColor: loading ? "rgba(148,163,184,0.12)" : `${maxTone.color}1e` }}
                >
                  <FiAlertTriangle
                    className="text-[11px]"
                    style={{ color: loading ? "#94a3b8" : maxTone.color }}
                  />
                </span>
                <p className="text-[10.5px] font-medium text-slate-500 dark:text-white/45">
                  {t("dashboard.highestRisk")}
                </p>
              </div>
              <p
                className="text-[26px] font-bold leading-none tracking-tight"
                style={{ color: loading ? "#94a3b8" : maxTone.color }}
              >
                {loading ? "—" : fmtRisk(summary.maxRisk)}
              </p>
              <p className="mt-1 text-[9px] text-slate-400 dark:text-white/30">
                {loading ? "" : `${maxTone.label} · ${maxTone.cvssRange}`}
              </p>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
};

export default AverageVulnerability;
