import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ReferenceLine,
  LabelList,
} from "recharts";
import { MdTrendingUp, MdTrendingDown } from "react-icons/md";
import {
  FiActivity,
  FiAlertCircle,
  FiRefreshCw,
  FiShield,
  FiBarChart2,
  FiChevronDown,
  FiCheck,
  FiSearch,
  FiX,
} from "react-icons/fi";
import { ListTargetDiffer, type TargetDifferDTO } from "../../../services";

type SortType = "Latest Updated" | "Highest Latest Risk" | "Biggest Change";

type ChartRow = {
  host: string;
  task_name: string;
  asset_label: string;
  axis_key: string;
  latest_task_id: string;
  latest_risk_score: number;
  previous_risk_score: number;
  diff_risk_score: number;
  latest_total: number;
  previous_total: number;
  previous_version_status: string;
  latest_creation_time: number | null;
  previous_creation_time: number | null;
};

type FilterOption = {
  key: string;
  label: string;
};

const SORT_OPTIONS: SortType[] = [
  "Latest Updated",
  "Highest Latest Risk",
  "Biggest Change",
];

const COLORS = {
  previous: "#8B7CFF",
  latestStable: "#39C6F4",
  latestUp: "#FF6B88",
  gridLight: "#E8ECF3",
  gridDark: "rgba(255,255,255,0.10)",
  axisLight: "#667085",
  axisDark: "rgba(255,255,255,0.72)",
  axisSubtleDark: "rgba(255,255,255,0.48)",
  avgLineLight: "#94A3B8",
  avgLineDark: "rgba(255,255,255,0.30)",
};

const formatRisk = (value: number) => Number(value || 0).toFixed(2);

const shortenTaskName = (taskName: string) => {
  if (!taskName) return "-";
  if (taskName.length <= 16) return taskName;
  return `${taskName.slice(0, 16)}...`;
};

const formatUnixThai = (unix?: number | null) => {
  if (!unix) return "-";
  const date = new Date(unix * 1000);
  return new Intl.DateTimeFormat("th-TH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const isDarkMode = () => {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
};

const CustomTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartRow }>;
}) => {
  if (!active || !payload || payload.length === 0) return null;

  const item = payload[0]?.payload;
  if (!item) return null;

  const diff = item.diff_risk_score ?? 0;
  const isUp = diff > 0;
  const isDown = diff < 0;

  return (
    <div className="min-w-62.5 max-w-[320px] rounded-[18px] border border-gray-200/90 bg-white/96 px-3 py-2.5 shadow-[0_14px_32px_rgba(15,23,42,0.14)] backdrop-blur dark:border-white/10 dark:bg-[#0B1220]/96 dark:shadow-[0_14px_28px_rgba(0,0,0,0.32)]">
      <div className="mb-2">
        <p className="text-[13px] font-semibold text-[#1f2240] dark:text-white/92 wrap-break-word">
          {item.task_name || "Unknown Task"}
        </p>
        <p className="mt-0.5 text-[11px] text-gray-500 dark:text-white/45 break-all">
          Host: {item.host || "-"}
        </p>
      </div>

      <div className="space-y-1.5 text-[11px]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[#8B7CFF]">Previous Risk</span>
          <span className="font-semibold text-[#1f2240] dark:text-white/92">
            {formatRisk(item.previous_risk_score)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className={isUp ? "text-[#FF6B88]" : "text-[#39C6F4]"}>
            Latest Risk
          </span>
          <span className="font-semibold text-[#1f2240] dark:text-white/92">
            {formatRisk(item.latest_risk_score)}
          </span>
        </div>

        <div className="h-px bg-gray-200 dark:bg-white/10" />

        <div className="grid grid-cols-1 gap-1.5">
          <div className="flex items-center justify-between gap-3 text-gray-600 dark:text-white/68">
            <span>Task Name</span>
            <span className="font-medium text-right wrap-break-word">
              {item.task_name || "-"}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 text-gray-600 dark:text-white/68">
            <span>Host</span>
            <span className="font-medium text-right break-all">
              {item.host || "-"}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 text-gray-600 dark:text-white/68">
            <span>Latest Total</span>
            <span className="font-semibold text-right text-[#1f2240] dark:text-white/90">
              {item.latest_total ?? 0}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 text-gray-600 dark:text-white/68">
            <span>Previous Total</span>
            <span className="font-semibold text-right text-[#1f2240] dark:text-white/90">
              {item.previous_total ?? 0}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 text-gray-600 dark:text-white/68">
            <span>Latest Time</span>
            <span className="font-medium text-right">
              {formatUnixThai(item.latest_creation_time)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 text-gray-600 dark:text-white/68">
            <span>Previous Time</span>
            <span className="font-medium text-right">
              {formatUnixThai(item.previous_creation_time)}
            </span>
          </div>
        </div>

        <div className="pt-1">
          <span
            className={[
              "inline-flex items-center gap-1 rounded-xl px-2 py-1 text-[10px] font-semibold",
              isUp
                ? "bg-rose-100 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300"
                : isDown
                ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-400/15 dark:text-cyan-300"
                : "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-white/70",
            ].join(" ")}
          >
            {isUp ? (
              <MdTrendingUp className="text-[13px]" />
            ) : isDown ? (
              <MdTrendingDown className="text-[13px]" />
            ) : null}
            Risk Change: {diff > 0 ? "+" : ""}
            {formatRisk(diff)}
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
}) => {
  const { x = 0, y = 0, payload } = props;
  const rawValue = String(payload?.value || "");
  const dark = isDarkMode();

  const label = rawValue.includes("__AXIS__")
    ? rawValue.split("__AXIS__")[0]
    : rawValue;

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={12}
        textAnchor="middle"
        fill={dark ? COLORS.axisSubtleDark : COLORS.axisLight}
        fontSize={11}
        fontWeight={600}
      >
        {label}
      </text>
    </g>
  );
};

const CustomLegend = () => {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2.5 sm:gap-3">
      <div className="inline-flex items-center gap-2 rounded-full border border-violet-200/70 bg-violet-50 px-2.5 py-1 dark:border-violet-400/15 dark:bg-violet-400/10">
        <span className="inline-block h-2 w-2 rounded-full bg-[#8B7CFF]" />
        <span className="text-[11px] font-medium text-violet-700 dark:text-violet-300">
          Previous Risk
        </span>
      </div>

      <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/70 bg-cyan-50 px-2.5 py-1 dark:border-cyan-400/15 dark:bg-cyan-400/10">
        <span className="inline-block h-2 w-2 rounded-full bg-[#39C6F4]" />
        <span className="text-[11px] font-medium text-cyan-700 dark:text-cyan-300">
          Latest Risk
        </span>
      </div>

      <div className="inline-flex items-center gap-2 rounded-full border border-rose-200/70 bg-rose-50 px-2.5 py-1 dark:border-rose-400/15 dark:bg-rose-400/10">
        <span className="inline-block h-2 w-2 rounded-full bg-[#FF6B88]" />
        <span className="text-[11px] font-medium text-rose-700 dark:text-rose-300">
          Latest Risk Increased
        </span>
      </div>
    </div>
  );
};

const AverageEnrollment: React.FC = () => {
  const [sortBy, setSortBy] = useState<SortType>("Latest Updated");
  const [loading, setLoading] = useState<boolean>(true); //@ts-ignore
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [rows, setRows] = useState<TargetDifferDTO[]>([]);

  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const [sortOpen, setSortOpen] = useState(false);
  const sortDropdownRef = useRef<HTMLDivElement | null>(null);

  const fetchData = async (mode: "initial" | "refresh" = "initial") => {
    try {
      if (mode === "initial") setLoading(true);
      if (mode === "refresh") setRefreshing(true);

      const res = await ListTargetDiffer();
      console.log(res);
      setRows(Array.isArray(res) ? res : []);
    } catch (error) {
      console.error("fetch target differ error:", error);
      setRows([]);
    } finally {
      if (mode === "initial") setLoading(false);
      if (mode === "refresh") setRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchData("initial");
  }, []);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }

      if (
        sortDropdownRef.current &&
        !sortDropdownRef.current.contains(e.target as Node)
      ) {
        setSortOpen(false);
      }
    };

    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const mappedRows = useMemo<ChartRow[]>(() => {
    return rows.map((item, index) => {
      const taskName = item.task_name || "-";
      const host = item.host || "-";

      return {
        host,
        task_name: taskName,
        asset_label: shortenTaskName(taskName),
        axis_key: `${shortenTaskName(taskName)}__AXIS__${host}__${index}`,
        latest_task_id:
          item.latest_task_id !== null && item.latest_task_id !== undefined
            ? String(item.latest_task_id)
            : "-",
        latest_risk_score: Number(item.latest_risk_score ?? 0),
        previous_risk_score: Number(item.previous_risk_score ?? 0),
        diff_risk_score: Number(item.diff_risk_score ?? 0),
        latest_total: Number(item.latest_total ?? 0),
        previous_total: Number(item.previous_total ?? 0),
        previous_version_status: item.previous_version_status || "-",
        latest_creation_time: item.latest_creation_time ?? null,
        previous_creation_time: item.previous_creation_time ?? null,
      };
    });
  }, [rows]);

  const filterOptions = useMemo<FilterOption[]>(() => {
    const seen = new Set<string>();
    const options: FilterOption[] = [];

    for (const row of mappedRows) {
      const key = `${row.task_name}__${row.host}`;
      if (seen.has(key)) continue;
      seen.add(key);

      options.push({
        key,
        label: `${row.task_name || "-"} - ${row.host || "-"}`,
      });
    }

    options.sort((a, b) => a.label.localeCompare(b.label));
    return options;
  }, [mappedRows]);

  const filteredOptions = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) return filterOptions;

    return filterOptions.filter((opt) =>
      opt.label.toLowerCase().includes(keyword)
    );
  }, [filterOptions, searchQuery]);

  const filteredMappedRows = useMemo(() => {
    if (selectedKeys.length === 0) return mappedRows;

    const selectedSet = new Set(selectedKeys);
    return mappedRows.filter((row) =>
      selectedSet.has(`${row.task_name}__${row.host}`)
    );
  }, [mappedRows, selectedKeys]);

  const chartData = useMemo<ChartRow[]>(() => {
    const sorted = [...filteredMappedRows];

    if (sortBy === "Highest Latest Risk") {
      sorted.sort((a, b) => b.latest_risk_score - a.latest_risk_score);
    } else if (sortBy === "Biggest Change") {
      sorted.sort(
        (a, b) =>
          Math.abs(b.diff_risk_score || 0) - Math.abs(a.diff_risk_score || 0)
      );
    } else {
      sorted.sort(
        (a, b) => (b.latest_creation_time || 0) - (a.latest_creation_time || 0)
      );
    }

    return sorted.slice(0, 12);
  }, [filteredMappedRows, sortBy]);

  const summary = useMemo(() => {
    const totalAssets = filteredMappedRows.length;
    const avgLatestRisk =
      totalAssets > 0
        ? filteredMappedRows.reduce(
            (sum, item) => sum + Number(item.latest_risk_score || 0),
            0
          ) / totalAssets
        : 0;

    const increasedCount = filteredMappedRows.filter(
      (item) => Number(item.diff_risk_score || 0) > 0
    ).length;

    const decreasedCount = filteredMappedRows.filter(
      (item) => Number(item.diff_risk_score || 0) < 0
    ).length;

    return {
      totalAssets,
      avgLatestRisk,
      increasedCount,
      decreasedCount,
    };
  }, [filteredMappedRows]);

  const maxRisk = useMemo(() => {
    const values = chartData.flatMap((item) => [
      item.latest_risk_score || 0,
      item.previous_risk_score || 0,
    ]);
    const rawMax = Math.max(...values, 0);
    return Math.max(6, Math.ceil(rawMax + 1));
  }, [chartData]);

  const yTicks = useMemo(() => {
    const step = maxRisk <= 6 ? 1 : Math.ceil(maxRisk / 5);
    const ticks: number[] = [];
    for (let i = 0; i <= maxRisk; i += step) {
      ticks.push(i);
    }
    if (ticks[ticks.length - 1] !== maxRisk) ticks.push(maxRisk);
    return ticks;
  }, [maxRisk]);

  const selectedCount = selectedKeys.length;

  const dropdownButtonLabel = useMemo(() => {
    if (selectedCount === 0) return "Filter Device";
    if (selectedCount === 1) {
      const found = filterOptions.find((x) => x.key === selectedKeys[0]);
      return found?.label || "1 selected";
    }
    return `${selectedCount} selected`;
  }, [selectedCount, filterOptions, selectedKeys]);

  const toggleSelect = (key: string) => {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    );
  };

  const handleSelectAllVisible = () => {
    const visibleKeys = filteredOptions.map((x) => x.key);

    setSelectedKeys((prev) => {
      const prevSet = new Set(prev);
      const allVisibleSelected = visibleKeys.every((key) => prevSet.has(key));

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

  const sortButtonLabel = sortBy;

  return (
    <section
      className={[
        "relative overflow-hidden rounded-[22px] p-3 sm:p-4 md:p-4.5 h-full w-full flex flex-col",
        "bg-white border border-gray-200/80 shadow-[0_10px_24px_rgba(15,23,42,0.05)]",
        "dark:bg-[#081120] dark:border-white/10 dark:ring-1 dark:ring-cyan-400/10 dark:shadow-[0_14px_40px_rgba(0,0,0,0.24)]",
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[22px]">
        <div className="absolute -top-14 right-0 h-32 w-32 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-28 w-28 rounded-full bg-violet-400/10 blur-3xl" />
      </div>

      <div className="relative z-10">
        <div className="mb-4 flex flex-col gap-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-linear-to-br from-cyan-500 via-sky-500 to-violet-500 text-white shadow-sm">
                  <FiBarChart2 className="text-[15px]" />
                </div>

                <div className="min-w-0">
                  <h2 className="text-[17px] font-semibold tracking-tight text-[#1f2240] dark:text-white/92 sm:text-[19px]">
                    Target Risk Comparison
                  </h2>
                  <p className="text-[11px] text-gray-500 dark:text-white/55 sm:text-[12px]">
                    เปรียบเทียบ Previous Risk Score กับ Latest Risk Score ของแต่ละ target โดยใช้ Task Name เป็นแกนหลัก
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start xl:items-center">
              <div className="relative min-w-full sm:min-w-72.5" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setOpen((prev) => !prev)}
                  className={[
                    "w-full min-h-9 px-3.5 rounded-2xl inline-flex items-center justify-between gap-3 transition text-left",
                    "bg-white border border-gray-200/80 text-[12px] font-medium text-gray-600 hover:bg-gray-50",
                    "dark:bg-white/6 dark:border-white/10 dark:text-white/75 dark:hover:bg-white/10",
                  ].join(" ")}
                >
                  <span className="truncate">{dropdownButtonLabel}</span>

                  <div className="flex items-center gap-2 shrink-0">
                    {selectedCount > 0 && (
                      <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[10px] font-semibold bg-cyan-50 text-cyan-700 border border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-400/20">
                        {selectedCount}
                      </span>
                    )}

                    <FiChevronDown
                      className={`text-[13px] text-gray-400 dark:text-white/45 transition-transform ${
                        open ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </button>

                {open && (
                  <div className="absolute right-0 mt-2 w-full rounded-[22px] border border-gray-200 bg-white shadow-xl overflow-hidden z-30 dark:border-white/10 dark:bg-[#0B1220] dark:shadow-[0_18px_44px_rgba(0,0,0,0.28)]">
                    <div className="p-2.5 border-b border-gray-100 dark:border-white/10">
                      <div
                        className={[
                          "flex items-center gap-2 rounded-2xl px-3 h-9",
                          "bg-slate-50 border border-slate-200/80",
                          "dark:bg-white/5 dark:border-white/10",
                        ].join(" ")}
                      >
                        <FiSearch className="text-gray-400 dark:text-white/40 shrink-0 text-[13px]" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search task name or host..."
                          className="w-full bg-transparent outline-none text-[12px] text-gray-700 placeholder:text-gray-400 dark:text-white/80 dark:placeholder:text-white/30"
                        />
                        {searchQuery.trim() !== "" && (
                          <button
                            type="button"
                            onClick={() => setSearchQuery("")}
                            className="text-gray-400 hover:text-gray-600 dark:text-white/35 dark:hover:text-white/70"
                            aria-label="Clear search"
                          >
                            <FiX className="text-[13px]" />
                          </button>
                        )}
                      </div>

                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={handleSelectAllVisible}
                          className="text-[11px] font-medium text-cyan-600 hover:text-cyan-700 dark:text-cyan-300 dark:hover:text-cyan-200"
                        >
                          {allVisibleSelected ? "Unselect visible" : "Select visible"}
                        </button>

                        <button
                          type="button"
                          onClick={clearAllSelections}
                          className="text-[11px] font-medium text-gray-500 hover:text-gray-700 dark:text-white/50 dark:hover:text-white/75"
                        >
                          Clear all
                        </button>
                      </div>
                    </div>

                    <div className="max-h-62 overflow-y-auto overscroll-contain p-2 pr-1">
                      {filteredOptions.length === 0 ? (
                        <div className="px-3 py-7 text-center text-[12px] text-gray-500 dark:text-white/50">
                          No matching task / host
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {filteredOptions.map((opt) => {
                            const checked = selectedKeys.includes(opt.key);

                            return (
                              <button
                                key={opt.key}
                                type="button"
                                onClick={() => toggleSelect(opt.key)}
                                className={[
                                  "w-full flex items-start gap-3 rounded-2xl px-3 py-2.5 text-left transition",
                                  checked
                                    ? "bg-cyan-50 border border-cyan-200 dark:bg-cyan-500/10 dark:border-cyan-400/20"
                                    : "border border-transparent hover:bg-gray-50 dark:hover:bg-white/5",
                                ].join(" ")}
                              >
                                <span
                                  className={[
                                    "mt-0.5 h-4.5 w-4.5 rounded-md border flex items-center justify-center shrink-0 transition",
                                    checked
                                      ? "bg-cyan-500 border-cyan-500 text-white"
                                      : "bg-white border-gray-300 text-transparent dark:bg-white/5 dark:border-white/20",
                                  ].join(" ")}
                                >
                                  <FiCheck className="text-[10px]" />
                                </span>

                                <span className="min-w-0 flex-1">
                                  <span className="block text-[12px] font-medium text-gray-700 dark:text-white/80 wrap-break-word">
                                    {opt.label}
                                  </span>
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

              <div
                className="relative min-w-full sm:min-w-62.5"
                ref={sortDropdownRef}
              >
                <button
                  type="button"
                  onClick={() => setSortOpen((prev) => !prev)}
                  className={[
                    "w-full min-h-9 px-3.5 rounded-2xl inline-flex items-center justify-between gap-3 transition text-left",
                    "bg-white border border-gray-200/80 text-[12px] font-medium text-gray-600 hover:bg-gray-50",
                    "dark:bg-white/6 dark:border-white/10 dark:text-white/75 dark:hover:bg-white/10",
                  ].join(" ")}
                >
                  <span className="truncate">{sortButtonLabel}</span>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[10px] font-semibold bg-violet-50 text-violet-700 border border-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-400/20">
                      Sort
                    </span>

                    <FiChevronDown
                      className={`text-[13px] text-gray-400 dark:text-white/45 transition-transform ${
                        sortOpen ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </button>

                {sortOpen && (
                  <div className="absolute right-0 mt-2 w-full rounded-[22px] border border-gray-200 bg-white shadow-xl overflow-hidden z-30 dark:border-white/10 dark:bg-[#0B1220] dark:shadow-[0_18px_44px_rgba(0,0,0,0.28)]">
                    <div className="border-b border-gray-100 px-3 py-2.5 dark:border-white/10">
                      <p className="text-[11px] font-semibold text-gray-500 dark:text-white/45">
                        Sort By
                      </p>
                    </div>

                    <div className="p-2 space-y-1">
                      {SORT_OPTIONS.map((option) => {
                        const checked = sortBy === option;

                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => {
                              setSortBy(option);
                              setSortOpen(false);
                            }}
                            className={[
                              "w-full flex items-start gap-3 rounded-2xl px-3 py-2.5 text-left transition",
                              checked
                                ? "bg-violet-50 border border-violet-200 dark:bg-violet-500/10 dark:border-violet-400/20"
                                : "border border-transparent hover:bg-gray-50 dark:hover:bg-white/5",
                            ].join(" ")}
                          >
                            <span
                              className={[
                                "mt-0.5 h-4.5 w-4.5 rounded-md border flex items-center justify-center shrink-0 transition",
                                checked
                                  ? "bg-violet-500 border-violet-500 text-white"
                                  : "bg-white border-gray-300 text-transparent dark:bg-white/5 dark:border-white/20",
                              ].join(" ")}
                            >
                              <FiCheck className="text-[10px]" />
                            </span>

                            <span className="min-w-0 flex-1">
                              <span className="block text-[12px] font-medium text-gray-700 dark:text-white/80 wrap-break-word">
                                {option}
                              </span>
                              <span className="mt-0.5 block text-[10px] text-gray-400 dark:text-white/35">
                                {option === "Latest Updated"
                                  ? "เรียงตามเวลาล่าสุด"
                                  : option === "Highest Latest Risk"
                                  ? "เรียงตาม latest risk สูงสุด"
                                  : "เรียงตามความเปลี่ยนแปลงมากที่สุด"}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div
            className={[
              "rounded-[18px] px-3.5 py-2.5 flex flex-wrap items-center gap-2.5",
              "bg-slate-50 border border-slate-200/80",
              "dark:bg-white/4 dark:border-white/10",
            ].join(" ")}
          >
            <div className="inline-flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-500" />
              </span>
              <span className="text-[11px] font-medium text-slate-700 dark:text-white/75">
                Risk comparison telemetry active
              </span>
            </div>

            <div className="hidden sm:block h-4 w-px bg-slate-200 dark:bg-white/10" />

            <div className="inline-flex items-center gap-2 text-[11px] text-slate-500 dark:text-white/50">
              <FiActivity className="text-cyan-500 text-[12px]" />
              Previous vs Latest risk score by task and host
            </div>

            {selectedCount > 0 && (
              <>
                <div className="hidden sm:block h-4 w-px bg-slate-200 dark:bg-white/10" />
                <div className="inline-flex items-center gap-2 text-[11px] text-cyan-700 dark:text-cyan-300">
                  <span className="inline-flex h-1.5 w-1.5 rounded-full bg-cyan-500" />
                  Filtered by {selectedCount} selected target{selectedCount > 1 ? "s" : ""}
                </div>
              </>
            )}

            <div className="hidden sm:block h-4 w-px bg-slate-200 dark:bg-white/10" />

            <div className="inline-flex items-center gap-2 text-[11px] text-violet-700 dark:text-violet-300">
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-violet-500" />
              Sort: {sortBy}
            </div>
          </div>
        </div>

        <div className="mb-4 mt-4 grid grid-cols-2 gap-2.5 xl:grid-cols-4">
          <div className="rounded-[18px] border border-gray-200/80 bg-linear-to-br from-white to-slate-50 p-3 dark:border-white/10 dark:bg-linear-to-br dark:from-white/8 dark:to-white/4">
            <p className="text-[9px] uppercase tracking-[0.14em] text-gray-400 dark:text-white/38">
              Targets
            </p>
            <p className="mt-1 text-[18px] font-semibold text-[#1f2240] dark:text-white/92">
              {summary.totalAssets}
            </p>
          </div>

          <div className="rounded-[18px] border border-gray-200/80 bg-linear-to-br from-white to-cyan-50/40 p-3 dark:border-white/10 dark:bg-linear-to-br dark:from-cyan-400/10 dark:to-sky-500/5">
            <p className="text-[9px] uppercase tracking-[0.14em] text-gray-400 dark:text-white/38">
              Avg Latest Risk
            </p>
            <p className="mt-1 text-[18px] font-semibold text-[#1f2240] dark:text-white/92">
              {formatRisk(summary.avgLatestRisk)}
            </p>
          </div>

          <div className="rounded-[18px] border border-gray-200/80 bg-linear-to-br from-white to-rose-50/40 p-3 dark:border-white/10 dark:bg-linear-to-br dark:from-rose-400/10 dark:to-rose-500/5">
            <p className="text-[9px] uppercase tracking-[0.14em] text-gray-400 dark:text-white/38">
              Risk Increased
            </p>
            <p className="mt-1 text-[18px] font-semibold text-rose-600 dark:text-rose-300">
              {summary.increasedCount}
            </p>
          </div>

          <div className="rounded-[18px] border border-gray-200/80 bg-linear-to-br from-white to-sky-50/40 p-3 dark:border-white/10 dark:bg-linear-to-br dark:from-cyan-400/10 dark:to-cyan-500/5">
            <p className="text-[9px] uppercase tracking-[0.14em] text-gray-400 dark:text-white/38">
              Risk Decreased
            </p>
            <p className="mt-1 text-[18px] font-semibold text-cyan-600 dark:text-cyan-300">
              {summary.decreasedCount}
            </p>
          </div>
        </div>

        <CustomLegend />

        <div
          className={[
            "rounded-[22px] border p-2.5 sm:p-3",
            "border-gray-200/70 bg-linear-to-b from-[#fcfdff] to-[#f7faff]",
            "dark:border-white/10 dark:bg-linear-to-b dark:from-[#0B1220] dark:to-[#0E1830]",
          ].join(" ")}
        >
          <div className="h-80 sm:h-95 lg:h-105">
            {loading ? (
              <div className="grid h-full w-full place-items-center rounded-[18px] border border-dashed border-gray-200 bg-white/50 dark:border-white/10 dark:bg-white/5">
                <div className="flex items-center gap-2.5 text-gray-500 dark:text-white/60">
                  <FiRefreshCw className="animate-spin text-base" />
                  <span className="text-[12px] font-medium">
                    Loading target differ data...
                  </span>
                </div>
              </div>
            ) : chartData.length === 0 ? (
              <div className="grid h-full w-full place-items-center rounded-[18px] border border-dashed border-gray-200 bg-white/50 dark:border-white/10 dark:bg-white/5">
                <div className="text-center">
                  <div className="mx-auto mb-2.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-400/10 dark:text-amber-300">
                    <FiAlertCircle className="text-[18px]" />
                  </div>
                  <p className="text-[12px] font-semibold text-[#1f2240] dark:text-white/92">
                    No target differ data
                  </p>
                  <p className="mt-1 text-[10px] text-gray-500 dark:text-white/50">
                    ยังไม่มีข้อมูลเปรียบเทียบ latest / previous
                  </p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 14, right: 8, left: -16, bottom: 6 }}
                  barCategoryGap="14%"
                  barGap={3}
                >
                  <CartesianGrid
                    stroke={isDarkMode() ? COLORS.gridDark : COLORS.gridLight}
                    strokeDasharray="3 3"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="axis_key"
                    tick={<CustomXAxisTick />}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    height={42}
                  />

                  <YAxis
                    tick={{
                      fill: isDarkMode() ? COLORS.axisDark : COLORS.axisLight,
                      fontSize: 11,
                    }}
                    axisLine={false}
                    tickLine={false}
                    width={38}
                    domain={[0, maxRisk]}
                    ticks={yTicks}
                  />

                  <Tooltip
                    content={<CustomTooltip />}
                    cursor={{
                      fill: isDarkMode()
                        ? "rgba(255,255,255,0.04)"
                        : "rgba(148,163,184,0.08)",
                    }}
                  />

                  <ReferenceLine
                    y={Number(summary.avgLatestRisk.toFixed(2))}
                    stroke={isDarkMode() ? COLORS.avgLineDark : COLORS.avgLineLight}
                    strokeDasharray="5 5"
                    ifOverflow="extendDomain"
                  />

                  <Bar
                    dataKey="previous_risk_score"
                    name="Previous Risk Score"
                    radius={[8, 8, 0, 0]}
                    maxBarSize={26}
                  >
                    <LabelList
                      dataKey="previous_risk_score"
                      position="top"
                      formatter={(value) => formatRisk(Number(value ?? 0))}
                      style={{
                        fill: isDarkMode() ? "rgba(255,255,255,0.68)" : "#6B7280",
                        fontSize: 10,
                        fontWeight: 600,
                      }}
                    />
                    {chartData.map((_, index) => (
                      <Cell key={`prev-${index}`} fill={COLORS.previous} />
                    ))}
                  </Bar>

                  <Bar
                    dataKey="latest_risk_score"
                    name="Latest Risk Score"
                    radius={[8, 8, 0, 0]}
                    maxBarSize={26}
                  >
                    <LabelList
                      dataKey="latest_risk_score"
                      position="top"
                      formatter={(value) => formatRisk(Number(value ?? 0))}
                      style={{
                        fill: isDarkMode() ? "rgba(255,255,255,0.86)" : "#475467",
                        fontSize: 10,
                        fontWeight: 700,
                      }}
                    />
                    {chartData.map((row, index) => {
                      const diff = row.diff_risk_score ?? 0;
                      const color = diff > 0 ? COLORS.latestUp : COLORS.latestStable;
                      return <Cell key={`latest-${index}`} fill={color} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[10.5px] text-gray-500 dark:text-white/50">
          <div className="inline-flex items-center gap-1.5 rounded-xl bg-gray-50 px-2.5 py-1.5 dark:bg-white/6">
            <FiActivity className="text-[12px]" />
            X = Task Name
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-xl bg-gray-50 px-2.5 py-1.5 dark:bg-white/6">
            <FiShield className="text-[12px]" />
            Y = Average Severity (Risk Score)
          </div>
        </div>
      </div>
    </section>
  );
};

export default AverageEnrollment;