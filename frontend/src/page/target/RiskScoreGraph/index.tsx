import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  FiActivity,
  FiChevronDown,
  FiAlertCircle,
  FiCheck,
  FiSearch,
  FiArrowRight,
  FiBarChart2,
} from "react-icons/fi";
import { ListTargetDiffer, type TargetDifferDTO } from "../../../services";

type Row = {
  label: string;
  axisKey: string;
  date: string;
  host: string;
  taskName: string;

  latestTaskID: string;
  previousTaskID: string;

  latestDetectedTime: number | null;
  previousDetectedTime: number | null;

  latestTotal: number;
  previousTotal: number;

  riskScore: number;
  threatLevel: number;
};

type FilterOption = {
  key: string;
  label: string;
};

const pad2 = (n: number) => String(n).padStart(2, "0");

const formatDateToYMD = (date: Date) => {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  return `${y}-${m}-${d}`;
};

const formatUnixToYMD = (unix?: number | null) => {
  if (!unix) return "";
  return formatDateToYMD(new Date(unix * 1000));
};

const formatUnixToDateTime = (unix?: number | null) => {
  if (!unix) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(unix * 1000));
};

const clamp = (num: number, min: number, max: number) =>
  Math.max(min, Math.min(num, max));

const shortenTaskName = (taskName: string) => {
  if (!taskName) return "-";
  if (taskName.length <= 16) return taskName;
  return `${taskName.slice(0, 16)}...`;
};

const isDarkMode = () => {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
};

type CustomTooltipProps = {
  active?: boolean;
  payload?: Array<{ payload: Row }>;
  coordinate?: { x?: number; y?: number };
  viewBox?: { x?: number; y?: number; width?: number; height?: number };
};

const CustomTooltip: React.FC<CustomTooltipProps> = ({
  active,
  payload,
  coordinate,
  viewBox,
}) => {
  if (!active || !payload || !payload.length) return null;

  const row = payload?.[0]?.payload;
  if (!row) return null;

  const tooltipWidth = 304;
  const gap = 14;
  const raiseY = 112;

  const currentX = Number(coordinate?.x ?? 0);
  const chartLeft = Number(viewBox?.x ?? 0);
  const chartWidth = Number(viewBox?.width ?? 0);
  const chartRight = chartLeft + chartWidth;

  const wouldOverflowRight = currentX + tooltipWidth + gap > chartRight;
  const wouldOverflowLeft = currentX - tooltipWidth - gap < chartLeft;

  let tooltipTransform = `translate(${gap}px, -${raiseY}px)`;

  if (wouldOverflowRight && !wouldOverflowLeft) {
    tooltipTransform = `translate(calc(-100% - ${gap}px), -${raiseY}px)`;
  } else if (wouldOverflowLeft) {
    tooltipTransform = `translate(${gap}px, -${raiseY}px)`;
  }

  return (
    <div
      style={{ transform: tooltipTransform }}
      className="min-w-64 max-w-76 rounded-[22px] border border-gray-200 bg-white px-4 py-3 shadow-[0_16px_40px_rgba(15,23,42,0.14)] dark:border-white/10 dark:bg-[#0B1220] dark:shadow-[0_18px_38px_rgba(0,0,0,0.34)]"
    >
      <div className="mb-2.5">
        <p className="wrap-wrap-break-word text-[12px] font-semibold text-[#1f2240] dark:text-white/92">
          {row.taskName || "-"}
        </p>
        <p className="mt-1 break-all text-[10.5px] text-gray-500 dark:text-white/45">
          Host: {row.host || "-"}
        </p>
      </div>

      <div className="space-y-2 text-[11px]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[#8b5cf6]">Latest Risk:</span>
          <span className="tabular-nums font-semibold text-[#1f2240] dark:text-white/90">
            {row.riskScore.toFixed(2)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-[#38bdf8]">Previous Risk:</span>
          <span className="tabular-nums font-semibold text-[#1f2240] dark:text-white/90">
            {row.threatLevel.toFixed(2)}
          </span>
        </div>

        <div className="h-px bg-gray-200 dark:bg-white/10" />

        <div className="flex items-center justify-between gap-3">
          <span className="text-gray-500 dark:text-white/55">
            Latest Total Vulnerability:
          </span>
          <span className="font-semibold text-[#1f2240] dark:text-white/90">
            {row.latestTotal}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-gray-500 dark:text-white/55">
            Previous Total Vulnerability:
          </span>
          <span className="font-semibold text-[#1f2240] dark:text-white/90">
            {row.previousTotal}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-gray-500 dark:text-white/55">
            Latest Detected Time:
          </span>
          <span className="text-right font-medium text-[#1f2240] dark:text-white/90">
            {formatUnixToDateTime(row.latestDetectedTime)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-gray-500 dark:text-white/55">
            Previous Detected Time:
          </span>
          <span className="text-right font-medium text-[#1f2240] dark:text-white/90">
            {formatUnixToDateTime(row.previousDetectedTime)}
          </span>
        </div>
      </div>
    </div>
  );
};

const CustomXAxisTick = (props: {
  x?: number;
  y?: number;
  payload?: { value?: string };
  index?: number;
  visibleIndexes?: number[];
}) => {
  const { x = 0, y = 0, payload, index = 0, visibleIndexes = [] } = props;
  const rawValue = String(payload?.value || "");
  const dark = isDarkMode();

  if (!visibleIndexes.includes(index)) return null;

  const label = rawValue.includes("__AXIS__")
    ? rawValue.split("__AXIS__")[0]
    : rawValue;

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={14}
        textAnchor="middle"
        fill={dark ? "rgba(255,255,255,0.48)" : "#5b6170"}
        fontSize={11}
        fontWeight={600}
      >
        {label}
      </text>
    </g>
  );
};

const useIsSmall = () => {
  const [isSmall, setIsSmall] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const onChange = () => setIsSmall(mq.matches);
    onChange();

    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    }

    mq.addListener(onChange);
    return () => mq.removeListener(onChange);
  }, []);

  return isSmall;
};

const RiskScoreGraph: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [rawData, setRawData] = useState<TargetDifferDTO[]>([]);
  const [queryOpen, setQueryOpen] = useState(false);
  const [querySearch, setQuerySearch] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  const isSmall = useIsSmall();
  const queryDropdownRef = useRef<HTMLDivElement | null>(null);

  const hasFetchedRef = useRef(false);
  const isFetchingRef = useRef(false);
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchData = async () => {
    if (isFetchingRef.current) return;

    try {
      isFetchingRef.current = true;

      if (isMountedRef.current) {
        setLoading(true);
      }

      const res = await ListTargetDiffer();

      if (!isMountedRef.current) return;

      setRawData(Array.isArray(res) ? res : []);
    } catch (error) {
      console.error("fetch target differ error:", error);

      if (!isMountedRef.current) return;

      setRawData([]);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
      isFetchingRef.current = false;
    }
  };

  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    void fetchData();
  }, []);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (
        queryDropdownRef.current &&
        !queryDropdownRef.current.contains(e.target as Node)
      ) {
        setQueryOpen(false);
      }
    };

    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const mappedRows = useMemo<Row[]>(() => {
    return rawData
      .map((item, index) => {
        const taskName = item.task_name || "-";
        const host = item.host || "-";
        const shortLabel = shortenTaskName(taskName);

        return {
          label: shortLabel,
          axisKey: `${shortLabel}__AXIS__${host}__${index}`,
          date: formatUnixToYMD(item.latest_creation_time),
          host,
          taskName,

          latestTaskID:
            item.latest_task_id !== null && item.latest_task_id !== undefined
              ? String(item.latest_task_id)
              : "-",
          previousTaskID:
            item.previous_task_id !== null &&
            item.previous_task_id !== undefined
              ? String(item.previous_task_id)
              : "-",

          latestDetectedTime: item.latest_creation_time ?? null,
          previousDetectedTime: item.previous_creation_time ?? null,

          latestTotal: Number(item.latest_total ?? 0),
          previousTotal: Number(item.previous_total ?? 0),

          riskScore: clamp(Number(item.latest_risk_score ?? 0), 0, 10),
          threatLevel: clamp(Number(item.previous_risk_score ?? 0), 0, 10),
        };
      })
      .sort((a, b) => (b.latestDetectedTime || 0) - (a.latestDetectedTime || 0));
  }, [rawData]);

  const filterOptions = useMemo<FilterOption[]>(() => {
    const seen = new Set<string>();
    const options: FilterOption[] = [];

    for (const row of mappedRows) {
      const key = `${row.taskName}__${row.host}`;
      if (seen.has(key)) continue;
      seen.add(key);

      options.push({
        key,
        label: `${row.taskName || "-"} - ${row.host || "-"}`,
      });
    }

    options.sort((a, b) => a.label.localeCompare(b.label));
    return options;
  }, [mappedRows]);

  const filteredOptions = useMemo(() => {
    const keyword = querySearch.trim().toLowerCase();
    if (!keyword) return filterOptions;

    return filterOptions.filter((opt) =>
      opt.label.toLowerCase().includes(keyword)
    );
  }, [filterOptions, querySearch]);

  const data = useMemo<Row[]>(() => {
    if (selectedKeys.length === 0) return mappedRows;

    const selectedSet = new Set(selectedKeys);
    return mappedRows.filter((row) =>
      selectedSet.has(`${row.taskName}__${row.host}`)
    );
  }, [mappedRows, selectedKeys]);

  const visibleTickIndexes = useMemo(() => {
    const n = data.length;

    if (n <= 0) return [] as number[];
    if (n <= 3) return Array.from({ length: n }, (_, i) => i);
    if (n === 4) return [1, 2, 3];

    const clampIndex = (value: number) => Math.max(1, Math.min(n - 2, value));

    const indexes = [
      clampIndex(Math.round((n - 1) * 0.2)),
      clampIndex(Math.round((n - 1) * 0.5)),
      clampIndex(Math.round((n - 1) * 0.8)),
    ];

    return Array.from(new Set(indexes)).sort((a, b) => a - b);
  }, [data.length]);

  const selectedCount = selectedKeys.length;

  const toggleSelect = (key: string) => {
    setSelectedKeys((prev) =>
      prev.includes(key)
        ? prev.filter((item) => item !== key)
        : [...prev, key]
    );
  };

  const handleSelectAllVisible = () => {
    const visibleKeys = filteredOptions.map((x) => x.key);

    setSelectedKeys((prev) => {
      const prevSet = new Set(prev);
      const allVisibleSelected =
        visibleKeys.length > 0 && visibleKeys.every((key) => prevSet.has(key));

      if (allVisibleSelected) {
        return prev.filter((key) => !visibleKeys.includes(key));
      }

      const merged = new Set([...prev, ...visibleKeys]);
      return Array.from(merged);
    });
  };

  const clearAllSelections = () => {
    setSelectedKeys([]);
  };

  const allVisibleSelected =
    filteredOptions.length > 0 &&
    filteredOptions.every((opt) => selectedKeys.includes(opt.key));

  const description =
    "Compare latest risk against previous risk for selected targets";

  return (
    <section
      className={[
        "relative flex h-full flex-col overflow-hidden rounded-[22px] border p-3 shadow-sm sm:p-4 md:p-4",
        "border-gray-200/80 bg-white",
        "dark:border-white/10 dark:bg-white/5 dark:ring-1 dark:ring-white/10 dark:shadow-none",
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-14 -right-10 h-32 w-32 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute -bottom-14 -left-10 h-32 w-32 rounded-full bg-violet-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 flex h-full flex-col">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/80 bg-cyan-50 px-2.5 py-1.5 text-[10px] sm:text-[11px] font-semibold text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-300">
                  <FiActivity className="text-[12px]" />
                  Risk Score Graph
                </div>
              </div>

              <h3 className="text-[15px] md:text-[16px] font-semibold tracking-tight text-[#111827] dark:text-white">
                Risk score comparison by target
              </h3>

              <p className="mt-1 overflow-x-auto whitespace-nowrap text-[10px] md:text-[11px] leading-5 text-slate-500 dark:text-white/55">
                {description}
              </p>
            </div>

            <div className="flex w-full flex-col gap-2.5 lg:w-auto lg:min-w-58 xl:min-w-65">
              <div
                className="relative min-w-full sm:min-w-56 md:min-w-0 lg:min-w-58 xl:min-w-60"
                ref={queryDropdownRef}
              >
                <button
                  type="button"
                  onClick={() => setQueryOpen((prev) => !prev)}
                  className={[
                    "inline-flex min-h-9 w-full items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-left transition",
                    "border-gray-200 bg-white text-[11px] md:text-[12px] font-semibold text-slate-700 shadow-sm hover:bg-gray-50",
                    "dark:border-white/10 dark:bg-[#0B1220] dark:text-white/80 dark:hover:bg-white/10",
                  ].join(" ")}
                >
                  <span className="truncate">Target Filter</span>

                  <FiChevronDown
                    className={`shrink-0 text-[13px] text-gray-400 transition-transform dark:text-white/45 ${
                      queryOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {queryOpen && (
                  <div className="absolute right-0 z-50 mt-2 w-full overflow-hidden rounded-[20px] border border-gray-200 bg-white shadow-[0_16px_36px_rgba(15,23,42,0.10)] dark:border-white/10 dark:bg-[#0B1220] dark:shadow-[0_16px_32px_rgba(0,0,0,0.24)]">
                    <div className="p-3">
                      <div
                        className={[
                          "flex h-9 items-center gap-2 rounded-[14px] border px-3",
                          "border-slate-200 bg-slate-50",
                          "dark:border-white/10 dark:bg-white/5",
                        ].join(" ")}
                      >
                        <FiSearch className="shrink-0 text-[14px] text-gray-400 dark:text-white/40" />
                        <input
                          type="text"
                          value={querySearch}
                          onChange={(e) => setQuerySearch(e.target.value)}
                          placeholder="Search target name or host..."
                          className="w-full bg-transparent text-[12px] text-gray-700 outline-none placeholder:text-gray-400 dark:text-white/80 dark:placeholder:text-white/30"
                        />
                      </div>

                      <div className="mt-2.5 flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={handleSelectAllVisible}
                          className="text-[11px] font-semibold text-sky-500 transition hover:text-sky-600 dark:text-sky-300 dark:hover:text-sky-200"
                        >
                          {allVisibleSelected ? "Unselect visible" : "Select visible"}
                        </button>

                        <button
                          type="button"
                          onClick={clearAllSelections}
                          className="text-[11px] font-semibold text-slate-500 transition hover:text-slate-700 dark:text-white/45 dark:hover:text-white/75"
                        >
                          Clear all
                        </button>
                      </div>
                    </div>

                    <div className="max-h-52.5 overflow-y-auto px-2.5 pb-2.5">
                      {filteredOptions.length > 0 ? (
                        <div className="space-y-0.5">
                          {filteredOptions.map((opt) => {
                            const checked = selectedKeys.includes(opt.key);

                            return (
                              <button
                                key={opt.key}
                                type="button"
                                onClick={() => toggleSelect(opt.key)}
                                className={[
                                  "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left transition",
                                  checked
                                    ? "bg-slate-50 dark:bg-white/5"
                                    : "bg-transparent hover:bg-slate-50 dark:hover:bg-white/5",
                                ].join(" ")}
                              >
                                <span
                                  className={[
                                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-[7px] border transition",
                                    checked
                                      ? "border-sky-500 bg-sky-500 text-white"
                                      : "border-gray-300 bg-white text-transparent dark:border-white/20 dark:bg-transparent",
                                  ].join(" ")}
                                >
                                  <FiCheck className="text-[11px]" />
                                </span>

                                <span className="min-w-0 truncate text-[12px] font-semibold text-slate-600 dark:text-white/80">
                                  {opt.label}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center px-3 py-6 text-center text-[11px] text-slate-500 dark:text-white/45">
                          No target found
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              className={[
                "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[9px] md:text-[10px] font-medium",
                "border-violet-200/70 bg-violet-50 text-violet-700",
                "dark:border-violet-400/20 dark:bg-violet-400/10 dark:text-violet-300",
              ].join(" ")}
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-violet-500" />
              Previous Risk
            </div>

            <div
              className={[
                "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[9px] md:text-[10px] font-medium",
                "border-cyan-200/70 bg-cyan-50 text-cyan-700",
                "dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-300",
              ].join(" ")}
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-500" />
              Latest Risk
            </div>

            {selectedCount > 0 && (
              <div
                className={[
                  "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[9px] md:text-[10px] font-medium",
                  "border-emerald-200/70 bg-emerald-50 text-emerald-700",
                  "dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300",
                ].join(" ")}
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Filtered by {selectedCount} selected target
                {selectedCount > 1 ? "s" : ""}
              </div>
            )}
          </div>
        </div>

        <div className="mt-3.5 h-72 sm:h-80 md:h-95 lg:flex-1 lg:min-h-90">
          {loading ? (
            <div
              className={[
                "flex h-full items-center justify-center rounded-[18px] border px-4 text-center",
                "border-dashed border-gray-200 bg-slate-50",
                "dark:border-white/10 dark:bg-white/4",
              ].join(" ")}
            >
              <div>
                <span className="text-[12px] font-medium text-slate-500 dark:text-white/60">
                  Loading risk score data...
                </span>
              </div>
            </div>
          ) : data.length > 0 ? (
            <div
              className={[
                "h-full rounded-2xl border p-2 sm:p-2.5",
                "border-gray-200/70 bg-linear-to-b from-[#fcfdff] to-[#f7faff]",
                "dark:border-white/10 dark:bg-linear-to-b dark:from-[#0B1220] dark:to-[#0E1830]",
              ].join(" ")}
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={data}
                  margin={{
                    top: 8,
                    right: 6,
                    left: isSmall ? 2 : 10,
                    bottom: 28,
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="5 5"
                    vertical={false}
                    stroke="#ececf1"
                    className="dark:opacity-30"
                  />

                  <XAxis
                    dataKey="axisKey"
                    interval={0}
                    minTickGap={8}
                    tick={<CustomXAxisTick visibleIndexes={visibleTickIndexes} />}
                    axisLine={false}
                    tickLine={false}
                    height={42}
                  />

                  <YAxis
                    tick={{
                      fill: isDarkMode() ? "rgba(255,255,255,0.72)" : "#5b6170",
                      fontSize: 11,
                    }}
                    axisLine={false}
                    tickLine={false}
                    width={36}
                    domain={[0, 10]}
                    ticks={[0, 2, 4, 6, 8, 10]}
                  />

                  <Tooltip
                    content={<CustomTooltip />}
                    shared={false}
                    offset={10}
                    allowEscapeViewBox={{ x: true, y: true }}
                    wrapperStyle={{
                      pointerEvents: "none",
                    }}
                    cursor={{
                      stroke: isDarkMode()
                        ? "rgba(255,255,255,0.10)"
                        : "rgba(148,163,184,0.35)",
                      strokeWidth: 1,
                    }}
                  />

                  <defs>
                    <linearGradient
                      id="riskScoreGraphThreatFill"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.18} />
                      <stop offset="60%" stopColor="#38bdf8" stopOpacity={0.08} />
                      <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>

                  <Area
                    type="monotone"
                    dataKey="threatLevel"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    fill="url(#riskScoreGraphThreatFill)"
                    dot={false}
                    activeDot={{
                      r: 4.5,
                      stroke: "#8b5cf6",
                      strokeWidth: 2,
                      fill: "#ffffff",
                    }}
                  />

                  <Line
                    type="monotone"
                    dataKey="riskScore"
                    stroke="#38bdf8"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{
                      r: 4.5,
                      stroke: "#38bdf8",
                      strokeWidth: 2,
                      fill: "#ffffff",
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div
              className={[
                "flex h-full items-center justify-center rounded-[18px] border px-4 text-center",
                "border-dashed border-gray-200 bg-slate-50",
                "dark:border-white/10 dark:bg-white/4",
              ].join(" ")}
            >
              <div>
                <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-400/10 dark:text-amber-300">
                  <FiAlertCircle className="text-[15px]" />
                </div>
                <p className="text-[10px] font-semibold text-slate-700 dark:text-white/85">
                  No data is available for the selected targets.
                </p>
                <p className="mt-1 text-[9.5px] text-slate-500 dark:text-white/50">
                  Please choose a different target filter and try again.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-row flex-wrap items-center justify-center gap-2 text-center">
          <div
            className={[
              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5",
              "border-cyan-200/80 bg-cyan-50 text-cyan-700",
              "dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-300",
            ].join(" ")}
          >
            <FiBarChart2 className="text-[13px]" />
            <span className="text-[10px] md:text-[11px] font-semibold">
              Y Axis = Risk Score
            </span>
          </div>

          <div
            className={[
              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5",
              "border-violet-200/80 bg-violet-50 text-violet-700",
              "dark:border-violet-400/20 dark:bg-violet-400/10 dark:text-violet-300",
            ].join(" ")}
          >
            <FiArrowRight className="text-[13px]" />
            <span className="text-[10px] md:text-[11px] font-semibold">
              X Axis = Target
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default RiskScoreGraph;