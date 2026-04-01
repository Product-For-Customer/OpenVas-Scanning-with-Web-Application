import React, { useEffect, useMemo, useRef, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import {
  FiShield,
  FiChevronDown,
  FiSearch,
  FiCheck,
  FiX,
} from "react-icons/fi";
import {
  ListTaskVulnSummary,
  type TaskVulnSummaryDTO,
} from "../../../services";

type SeverityKey = "Critical" | "High" | "Medium" | "Low" | "Info";

type SeverityItem = {
  name: SeverityKey;
  value: number;
  color: string;
};

type TargetOption = {
  key: string;
  label: string;
};

const COLORS: Record<SeverityKey, string> = {
  Critical: "#ef4444",
  High: "#f97316",
  Medium: "#eab308",
  Low: "#22c55e",
  Info: "#3b82f6",
};

const CARD_HEIGHT_CLASS = "min-h-[560px] xl:min-h-[620px]";

const formatPercent = (percent: number) => `${(percent * 100).toFixed(2)}%`;

type CustomTooltipProps = {
  active?: boolean;
  payload?: Array<{ payload?: SeverityItem }>;
  total: number;
};

const CustomTooltip: React.FC<CustomTooltipProps> = ({
  active,
  payload,
  total,
}) => {
  if (!active || !payload || payload.length === 0) return null;

  const item = payload[0]?.payload as SeverityItem | undefined;
  if (!item) return null;

  const percent = total > 0 ? item.value / total : 0;

  return (
    <div
      className="rounded-2xl px-2.5 py-2 shadow-2xl text-white text-[10.5px] font-semibold border border-white/10 backdrop-blur-sm"
      style={{
        background: `linear-gradient(135deg, ${item.color}, ${item.color}dd)`,
        minWidth: 150,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate">{item.name}</span>
        <span className="tabular-nums">{item.value.toLocaleString()}</span>
      </div>
      <div className="mt-1 text-[10px] font-medium text-white/90">
        {formatPercent(percent)} of total findings
      </div>
    </div>
  );
};

const DeliveryAnalysis: React.FC = () => {
  const [rows, setRows] = useState<TaskVulnSummaryDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const [openTargetQuery, setOpenTargetQuery] = useState(false);
  const [targetQuerySearch, setTargetQuerySearch] = useState("");
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);

  const targetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        const res = await ListTaskVulnSummary();
        if (!alive) return;
        setRows(Array.isArray(res) ? res : []);
      } catch (error) {
        console.error("Failed to load vulnerability summary:", error);
        if (!alive) return;
        setRows([]);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (!targetRef.current) return;
      if (!targetRef.current.contains(e.target as Node)) {
        setOpenTargetQuery(false);
      }
    };

    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const targetOptions = useMemo<TargetOption[]>(() => {
    const names = rows
      .map((r) => ({
        key: String(r.task_name ?? "").trim(),
        label: String(r.task_name ?? "").trim(),
      }))
      .filter((r) => r.key !== "");

    const uniqueMap = new Map<string, TargetOption>();

    for (const item of names) {
      if (!uniqueMap.has(item.key)) {
        uniqueMap.set(item.key, item);
      }
    }

    return Array.from(uniqueMap.values());
  }, [rows]);

  const filteredTargetOptions = useMemo(() => {
    const keyword = targetQuerySearch.trim().toLowerCase();
    if (!keyword) return targetOptions;

    return targetOptions.filter((opt) =>
      opt.label.toLowerCase().includes(keyword)
    );
  }, [targetOptions, targetQuerySearch]);

  const filteredRows = useMemo(() => {
    if (selectedTargets.length === 0) return rows;
    return rows.filter((r) =>
      selectedTargets.includes(String(r.task_name ?? "").trim())
    );
  }, [rows, selectedTargets]);

  const totals = useMemo(() => {
    let critical = 0;
    let high = 0;
    let medium = 0;
    let low = 0;
    let info = 0;

    for (const r of filteredRows) {
      critical += Number(r.critical || 0);
      high += Number(r.high || 0);
      medium += Number(r.medium || 0);
      low += Number(r.low || 0);
      info += Number(r.info || 0);
    }

    return { critical, high, medium, low, info };
  }, [filteredRows]);

  const data = useMemo<SeverityItem[]>(() => {
    const items: SeverityItem[] = [
      { name: "Critical", value: totals.critical, color: COLORS.Critical },
      { name: "High", value: totals.high, color: COLORS.High },
      { name: "Medium", value: totals.medium, color: COLORS.Medium },
      { name: "Low", value: totals.low, color: COLORS.Low },
      { name: "Info", value: totals.info, color: COLORS.Info },
    ];

    const nonZero = items.filter((i) => i.value > 0);
    return nonZero.length > 0 ? nonZero : items;
  }, [totals]);

  const total = useMemo(() => {
    return data.reduce((sum, d) => sum + d.value, 0);
  }, [data]);

  const targetButtonLabel = useMemo(() => {
    if (selectedTargets.length === 0) return "Target Query";
    if (selectedTargets.length === 1) return selectedTargets[0];
    return `${selectedTargets.length} targets selected`;
  }, [selectedTargets]);

  const toggleTarget = (key: string) => {
    setSelectedTargets((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    );
  };

  const handleSelectAllVisibleTargets = () => {
    const visibleKeys = filteredTargetOptions.map((x) => x.key);

    setSelectedTargets((prev) => {
      const prevSet = new Set(prev);
      const allVisibleSelected = visibleKeys.every((key) => prevSet.has(key));

      if (allVisibleSelected) {
        return prev.filter((key) => !visibleKeys.includes(key));
      }

      return Array.from(new Set([...prev, ...visibleKeys]));
    });
  };

  const clearAllTargets = () => {
    setSelectedTargets([]);
  };

  const allVisibleTargetsSelected =
    filteredTargetOptions.length > 0 &&
    filteredTargetOptions.every((opt) => selectedTargets.includes(opt.key));

  return (
    <section
      className={[
        "relative w-full overflow-hidden rounded-[18px] p-2.5 sm:p-3 md:p-3.5",
        "bg-white border border-slate-200/80 shadow-[0_10px_26px_-20px_rgba(15,23,42,0.18)]",
        "dark:bg-[#08111f]/95 dark:border-white/10 dark:shadow-none",
        "h-full flex flex-col",
        CARD_HEIGHT_CLASS,
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-10 -right-6 h-24 w-24 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute -bottom-10 -left-6 h-24 w-24 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]">
          <div
            className="h-full w-full"
            style={{
              backgroundImage: `
                linear-gradient(to right, currentColor 1px, transparent 1px),
                linear-gradient(to bottom, currentColor 1px, transparent 1px)
              `,
              backgroundSize: "22px 22px",
            }}
          />
        </div>
      </div>

      <div className="relative z-10 flex h-full flex-col">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <div
                className={[
                  "inline-flex items-center gap-1.5 rounded-full px-2 py-1",
                  "bg-cyan-50 text-cyan-700 border border-cyan-200/80",
                  "dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-400/20",
                ].join(" ")}
              >
                <FiShield className="text-[10px]" />
                <span className="text-[9.5px] font-semibold tracking-wide">
                  Total Vulnerability
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="text-[14px] sm:text-[15px] font-semibold text-[#1f2240] dark:text-white/90 whitespace-nowrap">
                Vulnerability Distribution
              </h3>
              <p className="text-[10px] sm:text-[10.5px] text-slate-500 dark:text-white/55 whitespace-nowrap">
                Severity overview from imported scan results
              </p>
            </div>
          </div>

          <div className="flex items-start gap-1 shrink-0">
            <div className="relative" ref={targetRef}>
              <button
                type="button"
                onClick={() => setOpenTargetQuery((prev) => !prev)}
                className={[
                  "h-9 rounded-xl px-3 flex items-center gap-2 border transition min-w-27.5 sm:min-w-32.5",
                  "bg-white border-gray-200 text-slate-700 hover:border-cyan-200 hover:bg-cyan-50/60",
                  "dark:bg-white/5 dark:border-white/10 dark:text-white/75 dark:hover:bg-white/10",
                ].join(" ")}
              >
                <FiShield className="text-[12px]" />
                <span className="text-[10.5px] font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                  {targetButtonLabel}
                </span>
                <FiChevronDown
                  className={`ml-auto text-[12px] transition-transform ${
                    openTargetQuery ? "rotate-180" : ""
                  }`}
                />
              </button>

              {openTargetQuery && (
                <div
                  className={[
                    "absolute right-0 z-30 mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl",
                    "border border-gray-200 bg-white shadow-xl",
                    "dark:border-white/10 dark:bg-[#0B1220] dark:shadow-none",
                  ].join(" ")}
                >
                  <div className="border-b border-gray-100 p-2.5 dark:border-white/10">
                    <div
                      className={[
                        "flex items-center gap-2 rounded-xl border px-2.5",
                        "border-gray-200/80 bg-gray-50",
                        "dark:border-white/10 dark:bg-white/5",
                      ].join(" ")}
                    >
                      <FiSearch className="shrink-0 text-[11px] text-gray-400 dark:text-white/40" />
                      <input
                        value={targetQuerySearch}
                        onChange={(e) => setTargetQuerySearch(e.target.value)}
                        placeholder="Search target"
                        className="h-8 w-full bg-transparent text-[11px] text-gray-700 outline-none placeholder:text-gray-400 dark:text-white/80 dark:placeholder:text-white/35"
                      />
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={handleSelectAllVisibleTargets}
                        className="text-[10.5px] font-medium text-cyan-600 hover:text-cyan-700 dark:text-cyan-300 dark:hover:text-cyan-200"
                      >
                        {allVisibleTargetsSelected
                          ? "Unselect visible"
                          : "Select visible"}
                      </button>

                      <button
                        type="button"
                        onClick={clearAllTargets}
                        className="text-[10.5px] font-medium text-gray-500 hover:text-gray-700 dark:text-white/50 dark:hover:text-white/75"
                      >
                        Clear all
                      </button>
                    </div>
                  </div>

                  <div className="max-h-56 overflow-y-auto p-2">
                    {filteredTargetOptions.length === 0 ? (
                      <div className="px-3 py-6 text-center text-[11px] text-gray-500 dark:text-white/50">
                        No matching target
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {filteredTargetOptions.map((opt) => {
                          const checked = selectedTargets.includes(opt.key);

                          return (
                            <button
                              key={opt.key}
                              type="button"
                              onClick={() => toggleTarget(opt.key)}
                              className={[
                                "w-full flex items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition",
                                checked
                                  ? "bg-cyan-50 border border-cyan-200 dark:bg-cyan-500/10 dark:border-cyan-400/20"
                                  : "border border-transparent hover:bg-gray-50 dark:hover:bg-white/5",
                              ].join(" ")}
                            >
                              <span
                                className={[
                                  "mt-0.5 h-4 w-4 rounded-md border flex items-center justify-center shrink-0 transition",
                                  checked
                                    ? "bg-cyan-500 border-cyan-500 text-white"
                                    : "bg-white border-gray-300 text-transparent dark:bg-white/5 dark:border-white/20",
                                ].join(" ")}
                              >
                                <FiCheck className="text-[10px]" />
                              </span>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="h-2 w-2 rounded-full bg-cyan-500" />
                                  <span className="text-[11px] font-medium text-gray-700 dark:text-white/80 truncate">
                                    {opt.label}
                                  </span>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {selectedTargets.length > 0 && (
              <button
                type="button"
                onClick={clearAllTargets}
                className={[
                  "h-9 w-9 rounded-xl border flex items-center justify-center transition",
                  "bg-white border-gray-200 text-slate-500 hover:text-red-500 hover:border-red-200 hover:bg-red-50/60",
                  "dark:bg-white/5 dark:border-white/10 dark:text-white/55 dark:hover:text-red-300 dark:hover:bg-red-500/10",
                ].join(" ")}
                aria-label="Clear filters"
              >
                <FiX className="text-[12px]" />
              </button>
            )}
          </div>
        </div>

        <div
          className={[
            "mt-3 rounded-2xl px-3 py-2 flex flex-wrap items-center gap-2",
            "bg-slate-50 border border-slate-200/80",
            "dark:bg-white/4 dark:border-white/10",
          ].join(" ")}
        >
          <div className="inline-flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-500" />
            </span>
            <span className="text-[10px] font-medium text-slate-700 dark:text-white/75">
              Scanner Telemetry Active
            </span>
          </div>

          <div className="hidden sm:block h-3 w-px bg-slate-200 dark:bg-white/10" />

          <div className="text-[10px] text-slate-500 dark:text-white/50">
            {selectedTargets.length === 0
              ? "Severity distribution across the latest imported scan results"
              : `Severity distribution for ${selectedTargets.length} selected target${
                  selectedTargets.length > 1 ? "s" : ""
                }`}
          </div>
        </div>

        <div className="mt-2.5 flex-1 flex flex-col">
          <div className="relative h-65 sm:h-72.5 md:h-77.5">
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400/10 blur-2xl dark:bg-cyan-400/10" />

            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div
                className={[
                  "rounded-full h-24 w-24 sm:h-26 sm:w-26 flex flex-col items-center justify-center text-center",
                  "bg-white/90 border border-slate-200 shadow-sm",
                  "dark:bg-[#0b1728]/80 dark:border-white/10 dark:shadow-none backdrop-blur-md",
                ].join(" ")}
              >
                <div className="text-[18px] sm:text-[20px] font-semibold text-slate-900 dark:text-white/90 tabular-nums leading-none">
                  {loading ? "." : total.toLocaleString()}
                </div>
                <div className="mt-1 text-[9.5px] sm:text-[10px] text-slate-500 dark:text-white/55">
                  Total
                </div>
              </div>
            </div>

            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip
                  content={(props: any) => (
                    <CustomTooltip {...props} total={total} />
                  )}
                  cursor={false}
                />
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="56%"
                  outerRadius="94%"
                  paddingAngle={2}
                  stroke="rgba(255,255,255,0.95)"
                  strokeWidth={2.5}
                  isAnimationActive
                  animationDuration={800}
                >
                  {data.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-2.5">
            <div
              className={[
                "rounded-2xl px-3 py-2.5",
                "bg-white border border-gray-200/80",
                "dark:bg-white/5 dark:border-white/10",
              ].join(" ")}
            >
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                {(["Critical", "High", "Medium"] as SeverityKey[]).map((k) => {
                  const item = data.find((d) => d.name === k) || {
                    name: k,
                    value: 0,
                    color: COLORS[k],
                  };
                  const p = total > 0 ? item.value / total : 0;

                  return (
                    <div key={k} className="flex items-center gap-1.5">
                      <span
                        className="h-3 w-3 rounded-sm"
                        style={{ background: COLORS[k] }}
                      />
                      <span className="text-[10.5px] font-medium text-[#1f2240] dark:text-white/85">
                        {k}
                      </span>
                      <span className="text-[10px] text-gray-500 dark:text-white/55 tabular-nums">
                        {loading ? "..." : item.value.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-gray-400 dark:text-white/40 tabular-nums">
                        {loading ? "" : `(${formatPercent(p)})`}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                {(["Low", "Info"] as SeverityKey[]).map((k) => {
                  const item = data.find((d) => d.name === k) || {
                    name: k,
                    value: 0,
                    color: COLORS[k],
                  };
                  const p = total > 0 ? item.value / total : 0;

                  return (
                    <div key={k} className="flex items-center gap-1.5">
                      <span
                        className="h-3 w-3 rounded-sm"
                        style={{ background: COLORS[k] }}
                      />
                      <span className="text-[10.5px] font-medium text-[#1f2240] dark:text-white/85">
                        {k}
                      </span>
                      <span className="text-[10px] text-gray-500 dark:text-white/55 tabular-nums">
                        {loading ? "..." : item.value.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-gray-400 dark:text-white/40 tabular-nums">
                        {loading ? "" : `(${formatPercent(p)})`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DeliveryAnalysis;