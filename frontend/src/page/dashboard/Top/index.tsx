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

type TargetOption = {
  key: string;
  label: string;
};

const CARD_HEIGHT_CLASS = "min-h-[560px] xl:min-h-[620px]";

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

const formatNumber = (n: number) => {
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString();
};

const formatRisk = (n: number) => {
  if (!Number.isFinite(n)) return "0.00";
  return n.toFixed(2);
};

const getRiskTone = (risk: number) => {
  if (risk >= 8) {
    return {
      label: "Critical",
      dot: "bg-red-500",
      text: "text-red-600 dark:text-red-300",
      chip:
        "bg-red-50 border-red-200 text-red-600 dark:bg-red-500/10 dark:border-red-400/20 dark:text-red-300",
      gauge: "#ef4444",
      glow: "bg-red-400/10",
    };
  }

  if (risk >= 6) {
    return {
      label: "High",
      dot: "bg-orange-500",
      text: "text-orange-600 dark:text-orange-300",
      chip:
        "bg-orange-50 border-orange-200 text-orange-600 dark:bg-orange-500/10 dark:border-orange-400/20 dark:text-orange-300",
      gauge: "#f97316",
      glow: "bg-orange-400/10",
    };
  }

  if (risk >= 4) {
    return {
      label: "Medium",
      dot: "bg-yellow-500",
      text: "text-yellow-600 dark:text-yellow-300",
      chip:
        "bg-yellow-50 border-yellow-200 text-yellow-700 dark:bg-yellow-500/10 dark:border-yellow-400/20 dark:text-yellow-300",
      gauge: "#eab308",
      glow: "bg-yellow-400/10",
    };
  }

  if (risk > 0) {
    return {
      label: "Low",
      dot: "bg-green-500",
      text: "text-green-600 dark:text-green-300",
      chip:
        "bg-green-50 border-green-200 text-green-700 dark:bg-green-500/10 dark:border-green-400/20 dark:text-green-300",
      gauge: "#22c55e",
      glow: "bg-green-400/10",
    };
  }

  return {
    label: "Info",
    dot: "bg-blue-500",
    text: "text-blue-600 dark:text-blue-300",
    chip:
      "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-500/10 dark:border-blue-400/20 dark:text-blue-300",
    gauge: "#3b82f6",
    glow: "bg-blue-400/10",
  };
};

const TopPerforming: React.FC = () => {
  const [data, setData] = useState<AssetRiskDTO[] | null>(null);
  const [loading, setLoading] = useState(true);

  const [openTargetQuery, setOpenTargetQuery] = useState(false);
  const [targetQuerySearch, setTargetQuerySearch] = useState("");
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);

  const targetRef = useRef<HTMLDivElement | null>(null);

  const hasFetchedRef = useRef(false);
  const isFetchingRef = useRef(false);
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    const fetchAssetRisk = async () => {
      if (isFetchingRef.current) return;

      try {
        isFetchingRef.current = true;

        if (isMountedRef.current) {
          setLoading(true);
        }

        const res = await ListAssetRisk();

        if (!isMountedRef.current) return;

        setData(Array.isArray(res) ? res : []);
      } catch (error) {
        console.error("Failed to load asset risk:", error);

        if (!isMountedRef.current) return;

        setData([]);
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
        isFetchingRef.current = false;
      }
    };

    void fetchAssetRisk();
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
    const list = Array.isArray(data) ? data : [];

    const names = list
      .map((item) => ({
        key: String((item as any).task_name ?? "").trim(),
        label: String((item as any).task_name ?? "").trim(),
      }))
      .filter((item) => item.key !== "");

    const uniqueMap = new Map<string, TargetOption>();

    for (const item of names) {
      if (!uniqueMap.has(item.key)) {
        uniqueMap.set(item.key, item);
      }
    }

    return Array.from(uniqueMap.values());
  }, [data]);

  const filteredTargetOptions = useMemo(() => {
    const keyword = targetQuerySearch.trim().toLowerCase();
    if (!keyword) return targetOptions;

    return targetOptions.filter((opt) =>
      opt.label.toLowerCase().includes(keyword)
    );
  }, [targetOptions, targetQuerySearch]);

  const filteredData = useMemo(() => {
    const list = Array.isArray(data) ? data : [];
    if (selectedTargets.length === 0) return list;

    return list.filter((item) =>
      selectedTargets.includes(String((item as any).task_name ?? "").trim())
    );
  }, [data, selectedTargets]);

  const summary = useMemo(() => {
    const list = filteredData;

    const taskCount = list.length;

    const avgRisk =
      taskCount > 0
        ? list.reduce((sum, item) => sum + (Number(item.risk_score) || 0), 0) /
          taskCount
        : 0;

    const maxRisk = list.reduce(
      (max, item) => Math.max(max, Number(item.risk_score) || 0),
      0
    );

    return {
      taskCount,
      avgRisk,
      maxRisk,
    };
  }, [filteredData]);

  const tone = useMemo(() => getRiskTone(summary.avgRisk), [summary.avgRisk]);

  const gaugeData = useMemo(() => {
    return [
      {
        name: "Average Risk",
        value: clamp(summary.avgRisk, 0, 10),
        fill: tone.gauge,
      },
    ];
  }, [summary.avgRisk, tone.gauge]);

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
        "dark:bg-white/5 dark:border-white/10 dark:ring-1 dark:ring-white/10 dark:shadow-none",
        "h-full flex flex-col",
        CARD_HEIGHT_CLASS,
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-12 -right-8 h-24 w-24 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute -bottom-12 -left-8 h-24 w-24 rounded-full bg-violet-500/10 blur-3xl" />
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
                  Risk Score
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="whitespace-nowrap text-[14px] font-semibold text-[#1f2240] dark:text-white/90 sm:text-[15px]">
                Average Risk Overview
              </h3>
              <p className="whitespace-nowrap text-[10px] text-slate-500 dark:text-white/55 sm:text-[10.5px]">
                Live risk summary from imported asset results
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-start gap-1">
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
                <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[10.5px] font-medium">
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
                                  <span className="truncate text-[11px] font-medium text-gray-700 dark:text-white/80">
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
            <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
            <span className="text-[10px] font-medium text-slate-700 dark:text-white/75">
              Current Average Severity
            </span>
          </div>

          <div className="hidden h-3 w-px bg-slate-200 dark:bg-white/10 sm:block" />

          <div className="text-[10px] text-slate-500 dark:text-white/50">
            {selectedTargets.length === 0
              ? "Risk distribution across all imported targets"
              : `Risk distribution for ${selectedTargets.length} selected target${
                  selectedTargets.length > 1 ? "s" : ""
                }`}
          </div>
        </div>

        <div className="mt-2.5 flex flex-1 flex-col">
          <div
            className={[
              "flex-1 rounded-2xl px-3 py-3",
              "bg-white border border-gray-200/80",
              "dark:bg-white/5 dark:border-white/10",
            ].join(" ")}
          >
            <div className="flex h-full flex-col">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400 dark:text-white/40">
                    Range
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-white/50">
                    Min 0.00 • Max 10.00
                  </p>
                </div>

                <span
                  className={[
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold border",
                    tone.chip,
                  ].join(" ")}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                  {tone.label}
                </span>
              </div>

              <div className="relative min-h-65 flex-1 sm:min-h-72.5 md:min-h-77.5">
                <div className="pointer-events-none absolute left-1/2 top-[52%] z-10 -translate-x-1/2 -translate-y-1/2 text-center">
                  <div
                    className={`text-[32px] font-semibold leading-none ${tone.text} sm:text-[38px]`}
                  >
                    {loading ? "." : formatRisk(summary.avgRisk)}
                  </div>
                  <div className="mt-2 text-[11px] text-gray-500 dark:text-white/50 sm:text-[12px]">
                    Average Risk Score
                  </div>
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

                <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center justify-between text-[10px] text-gray-400 dark:text-white/40 sm:text-[11px]">
                  <span>0</span>
                  <span>10</span>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div
                  className={[
                    "rounded-2xl px-4 py-3",
                    "bg-slate-50 border border-slate-200/80",
                    "dark:bg-white/4 dark:border-white/10",
                  ].join(" ")}
                >
                  <p className="text-[10px] text-gray-400 dark:text-white/40">
                    Targets
                  </p>
                  <p className="mt-1 text-[14px] font-semibold text-[#1f2240] dark:text-white/85 sm:text-[15px]">
                    {loading ? "..." : formatNumber(summary.taskCount)}
                  </p>
                </div>

                <div
                  className={[
                    "rounded-2xl px-4 py-3",
                    "bg-slate-50 border border-slate-200/80",
                    "dark:bg-white/4 dark:border-white/10",
                  ].join(" ")}
                >
                  <p className="text-[10px] text-gray-400 dark:text-white/40">
                    Highest Risk
                  </p>
                  <p className="mt-1 text-[14px] font-semibold text-[#1f2240] dark:text-white/85 sm:text-[15px]">
                    {loading ? "..." : formatRisk(summary.maxRisk)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TopPerforming;