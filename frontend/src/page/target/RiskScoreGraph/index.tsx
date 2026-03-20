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
  FiShield,
  FiActivity,
  FiChevronDown,
  FiCalendar,
  FiRefreshCw,
  FiAlertCircle,
  FiCheck,
  FiSearch,
  FiX,
} from "react-icons/fi";
import { ListTargetDiffer, type TargetDifferDTO } from "../../../services";

type RangeKey =
  | "Today"
  | "This Week"
  | "This Month"
  | "This Year"
  | "Custom Range";

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

const getStartOfWeek = (date: Date) => {
  const copied = new Date(date);
  const day = copied.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copied.setDate(copied.getDate() + diff);
  copied.setHours(0, 0, 0, 0);
  return copied;
};

const addDays = (date: Date, days: number) => {
  const copied = new Date(date);
  copied.setDate(copied.getDate() + days);
  return copied;
};

const addMonths = (date: Date, months: number) => {
  const copied = new Date(date);
  copied.setMonth(copied.getMonth() + months);
  return copied;
};

const isDateBetween = (targetYMD: string, startYMD: string, endYMD: string) => {
  if (!targetYMD || !startYMD || !endYMD) return false;
  return targetYMD >= startYMD && targetYMD <= endYMD;
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
};

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;

  const row = payload?.[0]?.payload;
  if (!row) return null;

  return (
    <div
      className={[
        "min-w-60 rounded-[18px] border border-gray-200 bg-white shadow-md px-3 py-2.5",
        "dark:border-white/10 dark:bg-[#0B1220] dark:shadow-none",
      ].join(" ")}
    >
      <p className="text-[12px] font-semibold text-[#1f2240] dark:text-white/90 mb-1 wrap-break-word">
        {row.taskName || "-"}
      </p>

      <p className="mb-2 text-[10.5px] text-gray-500 dark:text-white/50 break-all">
        Host: {row.host}
      </p>

      <div className="space-y-1.5 text-[11px]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[#8b5cf6]">Latest Risk:</span>
          <span className="font-semibold text-[#1f2240] dark:text-white/85 tabular-nums">
            {row.riskScore.toFixed(2)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-[#38bdf8]">Previous Risk:</span>
          <span className="font-semibold text-[#1f2240] dark:text-white/85 tabular-nums">
            {row.threatLevel.toFixed(2)}
          </span>
        </div>

        <div className="my-2 h-px bg-gray-200 dark:bg-white/10" />

        <div className="flex items-center justify-between gap-3">
          <span className="text-gray-500 dark:text-white/55">Task Name:</span>
          <span className="font-medium text-[#1f2240] dark:text-white/85 text-right wrap-break-word">
            {row.taskName || "-"}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-gray-500 dark:text-white/55">Host:</span>
          <span className="font-medium text-[#1f2240] dark:text-white/85 text-right break-all">
            {row.host || "-"}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-gray-500 dark:text-white/55">Latest Task ID:</span>
          <span className="font-medium text-[#1f2240] dark:text-white/85 text-right">
            {row.latestTaskID || "-"}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-gray-500 dark:text-white/55">Previous Task ID:</span>
          <span className="font-medium text-[#1f2240] dark:text-white/85 text-right">
            {row.previousTaskID || "-"}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-gray-500 dark:text-white/55">
            Latest Total Vulnerability:
          </span>
          <span className="font-semibold text-[#1f2240] dark:text-white/85">
            {row.latestTotal}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-gray-500 dark:text-white/55">
            Previous Total Vulnerability:
          </span>
          <span className="font-semibold text-[#1f2240] dark:text-white/85">
            {row.previousTotal}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-gray-500 dark:text-white/55">
            Latest Detected Time:
          </span>
          <span className="font-medium text-[#1f2240] dark:text-white/85 text-right">
            {formatUnixToDateTime(row.latestDetectedTime)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-gray-500 dark:text-white/55">
            Previous Detected Time:
          </span>
          <span className="font-medium text-[#1f2240] dark:text-white/85 text-right">
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
  const [range] = useState<RangeKey>("This Year");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rawData, setRawData] = useState<TargetDifferDTO[]>([]);
  const isSmall = useIsSmall();

  const [queryOpen, setQueryOpen] = useState(false);
  const [querySearch, setQuerySearch] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  const queryDropdownRef = useRef<HTMLDivElement | null>(null);
  const rangeDropdownRef = useRef<HTMLDivElement | null>(null);

  const todayYMD = useMemo(() => formatDateToYMD(new Date()), []);
  const sevenDaysAgoYMD = useMemo(
    () => formatDateToYMD(addDays(new Date(), -6)),
    []
  );

  const [startDate, setStartDate] = useState<string>(sevenDaysAgoYMD);
  const [endDate, setEndDate] = useState<string>(todayYMD);

  const fetchData = async (mode: "initial" | "refresh" = "initial") => {
    try {
      if (mode === "initial") setLoading(true);
      if (mode === "refresh") setRefreshing(true);

      const res = await ListTargetDiffer();
      setRawData(Array.isArray(res) ? res : []);
    } catch (error) {
      console.error("fetch target differ error:", error);
      setRawData([]);
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
      if (
        queryDropdownRef.current &&
        !queryDropdownRef.current.contains(e.target as Node)
      ) {
        setQueryOpen(false);
      }

      if (
        rangeDropdownRef.current &&
        !rangeDropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
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
            item.previous_task_id !== null && item.previous_task_id !== undefined
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

  const queryFilteredRows = useMemo(() => {
    if (selectedKeys.length === 0) return mappedRows;

    const selectedSet = new Set(selectedKeys);
    return mappedRows.filter((row) =>
      selectedSet.has(`${row.taskName}__${row.host}`)
    );
  }, [mappedRows, selectedKeys]);

  const data = useMemo<Row[]>(() => {
    const now = new Date();
    const today = formatDateToYMD(now);

    let filtered = [...queryFilteredRows];

    switch (range) {
      case "Today": {
        filtered = filtered.filter((row) => row.date === today);
        break;
      }

      case "This Week": {
        const start = formatDateToYMD(getStartOfWeek(now));
        const end = formatDateToYMD(now);
        filtered = filtered.filter((row) => isDateBetween(row.date, start, end));
        break;
      }

      case "This Month": {
        const start = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-01`;
        const end = formatDateToYMD(now);
        filtered = filtered.filter((row) => isDateBetween(row.date, start, end));
        break;
      }

      case "This Year": {
        const start = `${now.getFullYear()}-01-01`;
        const end = formatDateToYMD(now);
        filtered = filtered.filter((row) => isDateBetween(row.date, start, end));
        break;
      }

      case "Custom Range": {
        if (!startDate || !endDate || startDate > endDate) return [];
        filtered = filtered.filter((row) =>
          isDateBetween(row.date, startDate, endDate)
        );
        break;
      }

      default:
        break;
    }

    return filtered;
  }, [queryFilteredRows, range, startDate, endDate]);

  const peakRisk = useMemo(() => {
    if (!data.length) return null;
    return data.reduce((max, item) =>
      item.riskScore > max.riskScore ? item : max
    );
  }, [data]);

  const xInterval = useMemo(() => {
    const n = data.length;

    if (n <= 7) return 0;
    if (n <= 12) return isSmall ? 1 : 0;
    if (n <= 20) return isSmall ? 2 : 1;
    if (n <= 30) return isSmall ? 3 : 1;
    return isSmall ? 4 : 2;
  }, [data.length, isSmall]);

  const customRangeError = useMemo(() => {
    if (range !== "Custom Range") return "";
    if (!startDate || !endDate) return "กรุณาเลือก Start Date และ End Date";
    if (startDate > endDate) return "Start Date ต้องไม่มากกว่า End Date";
    return "";
  }, [range, startDate, endDate]);

  const rangeDescription = useMemo(() => {
    switch (range) {
      case "Today":
        return "Filled area shows previous risk while lines compare latest and previous risk for targets detected today";
      case "This Week":
        return "Compare latest risk against previous risk for targets detected this week";
      case "This Month":
        return "Compare latest risk against previous risk for targets detected this month";
      case "This Year":
        return "Compare latest risk against previous risk for targets detected this year";
      case "Custom Range":
        return "Compare latest risk against previous risk within selected detected date range";
      default:
        return "Compare latest risk and previous risk over selected period";
    }
  }, [range]);

  const selectedCount = selectedKeys.length;

  const queryButtonLabel = useMemo(() => {
    if (selectedCount === 0) return "Query Select";
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

  return (
    <section
      className={[
        "relative overflow-hidden h-full rounded-[22px] p-3 sm:p-4 md:p-4.5 flex flex-col",
        "bg-white border border-gray-200/80 shadow-sm",
        "dark:bg-white/5 dark:border-white/10 dark:ring-1 dark:ring-white/10 dark:shadow-none",
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-14 -right-10 h-32 w-32 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute -bottom-14 -left-10 h-32 w-32 rounded-full bg-violet-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 flex h-full flex-col">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 flex-1">
              <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
                <div
                  className={[
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5",
                    "bg-cyan-50 text-cyan-700 border border-cyan-200/80",
                    "dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-400/20",
                  ].join(" ")}
                >
                  <FiShield className="text-[11px]" />
                  <span className="text-[10.5px] font-semibold tracking-wide">
                    Risk Analytics
                  </span>
                </div>

                {peakRisk && (
                  <div
                    className={[
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5",
                      "bg-slate-50 text-slate-600 border border-slate-200/80",
                      "dark:bg-white/5 dark:text-white/65 dark:border-white/10",
                    ].join(" ")}
                  >
                    <FiActivity className="text-[11px] text-violet-500" />
                    <span className="text-[10.5px] font-medium">
                      Peak Risk {peakRisk.label}: {peakRisk.riskScore.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              <h2 className="text-[17px] sm:text-[19px] font-semibold text-[#1f2240] dark:text-white/90 tracking-tight">
                Risk Score Trend
              </h2>

              <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] text-gray-500 dark:text-white/55">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-4 rounded-full bg-[#8b5cf6]" />
                  <span>Latest Risk</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-4 rounded-full bg-[#38bdf8]" />
                  <span>Previous Risk</span>
                </div>
              </div>
            </div>

            <div className="flex w-full flex-col gap-2.5 xl:w-auto xl:min-w-70">
              <div className="flex flex-col gap-2.5 sm:flex-row sm:justify-end">
                <div
                  className="relative min-w-full sm:min-w-72.5"
                  ref={queryDropdownRef}
                >
                  <button
                    type="button"
                    onClick={() => setQueryOpen((prev) => !prev)}
                    className={[
                      "w-full min-h-9 px-3.5 rounded-2xl inline-flex items-center justify-between gap-3 transition text-left",
                      "bg-white border border-gray-200/80 text-[12px] font-medium text-gray-600 hover:bg-gray-50",
                      "dark:bg-white/5 dark:border-white/10 dark:text-white/70 dark:hover:bg-white/10",
                    ].join(" ")}
                  >
                    <span className="truncate">{queryButtonLabel}</span>

                    <div className="flex items-center gap-2 shrink-0">
                      {selectedCount > 0 && (
                        <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[10px] font-semibold bg-cyan-50 text-cyan-700 border border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-400/20">
                          {selectedCount}
                        </span>
                      )}

                      <FiChevronDown
                        className={`text-[13px] text-gray-400 dark:text-white/45 transition-transform ${
                          queryOpen ? "rotate-180" : ""
                        }`}
                      />
                    </div>
                  </button>

                  {queryOpen && (
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
                            value={querySearch}
                            onChange={(e) => setQuerySearch(e.target.value)}
                            placeholder="Search task name or host..."
                            className="w-full bg-transparent outline-none text-[12px] text-gray-700 placeholder:text-gray-400 dark:text-white/80 dark:placeholder:text-white/30"
                          />
                          {querySearch.trim() !== "" && (
                            <button
                              type="button"
                              onClick={() => setQuerySearch("")}
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

                      <div className="max-h-64 overflow-y-auto p-2">
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

                <button
                  type="button"
                  onClick={() => void fetchData("refresh")}
                  disabled={refreshing}
                  className={[
                    "min-h-9 px-3.5 rounded-2xl inline-flex items-center justify-center gap-2 transition",
                    "bg-white border border-gray-200/80 text-[12px] font-medium text-gray-600 hover:bg-gray-50",
                    "dark:bg-white/5 dark:border-white/10 dark:text-white/70 dark:hover:bg-white/10",
                    refreshing ? "opacity-70 cursor-not-allowed" : "",
                  ].join(" ")}
                >
                  <FiRefreshCw className={refreshing ? "animate-spin text-[13px]" : "text-[13px]"} />
                  Refresh
                </button>
              </div>

              {range === "Custom Range" && (
                <div className="flex justify-end">
                  <div
                    className={[
                      "w-full lg:w-115 rounded-[18px] border p-3",
                      "bg-slate-50 border-slate-200/80",
                      "dark:bg-white/4 dark:border-white/10",
                    ].join(" ")}
                  >
                    <div className="mb-2.5 flex items-center gap-2">
                      <FiCalendar className="text-[13px] text-cyan-600 dark:text-cyan-300" />
                      <span className="text-[12px] font-semibold text-slate-700 dark:text-white/85">
                        Select Date Range
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      <div className="min-w-0">
                        <label className="mb-1.5 block text-[11px] font-medium text-slate-600 dark:text-white/60">
                          Start Date
                        </label>
                        <input
                          type="date"
                          value={startDate}
                          max={endDate || undefined}
                          onChange={(e) => setStartDate(e.target.value)}
                          className={[
                            "w-full h-9 rounded-2xl px-3 outline-none transition",
                            "border border-gray-200 bg-white text-[12px] text-slate-700",
                            "focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100",
                            "dark:bg-[#0B1220] dark:border-white/10 dark:text-white/85 dark:focus:border-cyan-400 dark:focus:ring-cyan-500/10",
                          ].join(" ")}
                        />
                      </div>

                      <div className="min-w-0">
                        <label className="mb-1.5 block text-[11px] font-medium text-slate-600 dark:text-white/60">
                          End Date
                        </label>
                        <input
                          type="date"
                          value={endDate}
                          min={startDate || undefined}
                          onChange={(e) => setEndDate(e.target.value)}
                          className={[
                            "w-full h-9 rounded-2xl px-3 outline-none transition",
                            "border border-gray-200 bg-white text-[12px] text-slate-700",
                            "focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100",
                            "dark:bg-[#0B1220] dark:border-white/10 dark:text-white/85 dark:focus:border-cyan-400 dark:focus:ring-cyan-500/10",
                          ].join(" ")}
                        />
                      </div>
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const end = new Date();
                          const start = addDays(end, -6);
                          setStartDate(formatDateToYMD(start));
                          setEndDate(formatDateToYMD(end));
                        }}
                        className="rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1.5 text-[11px] font-medium text-cyan-700 transition hover:bg-cyan-100 dark:border-cyan-400/20 dark:bg-cyan-500/10 dark:text-cyan-300 dark:hover:bg-cyan-500/15"
                      >
                        Last 7 Days
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const end = new Date();
                          const start = addDays(end, -29);
                          setStartDate(formatDateToYMD(start));
                          setEndDate(formatDateToYMD(end));
                        }}
                        className="rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10"
                      >
                        Last 30 Days
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const end = new Date();
                          const start = addMonths(end, -3);
                          setStartDate(formatDateToYMD(start));
                          setEndDate(formatDateToYMD(end));
                        }}
                        className="rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10"
                      >
                        Last 3 Months
                      </button>
                    </div>

                    {customRangeError && (
                      <p className="mt-2.5 text-[11px] font-medium text-red-500">
                        {customRangeError}
                      </p>
                    )}
                  </div>
                </div>
              )}
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
                Monitoring risk behavior
              </span>
            </div>

            <div className="hidden sm:block h-4 w-px bg-slate-200 dark:bg-white/10" />

            <div className="text-[11px] text-slate-500 dark:text-white/50">
              {rangeDescription}
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
          </div>
        </div>

        <div className="mt-3.5 h-75 sm:h-90 lg:flex-1 lg:min-h-90">
          {loading ? (
            <div
              className={[
                "h-full rounded-[18px] border flex items-center justify-center text-center px-4",
                "border-dashed border-gray-200 bg-slate-50",
                "dark:border-white/10 dark:bg-white/4",
              ].join(" ")}
            >
              <div className="flex items-center gap-2.5 text-slate-500 dark:text-white/60">
                <FiRefreshCw className="animate-spin text-[16px]" />
                <span className="text-[12px] font-medium">
                  Loading risk score data...
                </span>
              </div>
            </div>
          ) : !customRangeError && data.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data}
                margin={{ top: 8, right: 6, left: -10, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="5 5"
                  vertical={false}
                  stroke="#ececf1"
                  className="dark:opacity-30"
                />

                <XAxis
                  dataKey="axisKey"
                  interval={xInterval}
                  minTickGap={8}
                  tick={<CustomXAxisTick />}
                  axisLine={false}
                  tickLine={false}
                />

                <YAxis
                  tick={{ fill: "#5b6170", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                  domain={[0, 10]}
                  ticks={[0, 2, 4, 6, 8, 10]}
                />

                <Tooltip content={<CustomTooltip />} />

                <defs>
                  <linearGradient id="threatFillLight" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.26} />
                    <stop offset="60%" stopColor="#38bdf8" stopOpacity={0.10} />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
                  </linearGradient>

                  <linearGradient id="threatFillDark" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#67e8f9" stopOpacity={0.32} />
                    <stop offset="60%" stopColor="#38bdf8" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
                  </linearGradient>
                </defs>

                <Area
                  type="monotone"
                  dataKey="threatLevel"
                  name="Previous Risk"
                  stroke="transparent"
                  fill="url(#threatFillLight)"
                  className="dark:hidden"
                />
                <Area
                  type="monotone"
                  dataKey="threatLevel"
                  name="Previous Risk"
                  stroke="transparent"
                  fill="url(#threatFillDark)"
                  className="hidden dark:block"
                />

                <Line
                  type="monotone"
                  dataKey="riskScore"
                  name="Latest Risk"
                  stroke="#8b5cf6"
                  strokeWidth={2.2}
                  dot={false}
                  activeDot={{ r: 3.5 }}
                />
                <Line
                  type="monotone"
                  dataKey="threatLevel"
                  name="Previous Risk"
                  stroke="#38bdf8"
                  strokeWidth={2.2}
                  dot={false}
                  activeDot={{ r: 3.5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div
              className={[
                "h-full rounded-[18px] border flex items-center justify-center text-center px-4",
                "border-dashed border-gray-200 bg-slate-50",
                "dark:border-white/10 dark:bg-white/4",
              ].join(" ")}
            >
              <div>
                <div className="mx-auto mb-2.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-400/10 dark:text-amber-300">
                  <FiAlertCircle className="text-[18px]" />
                </div>
                <p className="text-[12px] font-semibold text-slate-700 dark:text-white/85">
                  ไม่มีข้อมูลสำหรับช่วงวันที่ที่เลือก
                </p>
                <p className="mt-1 text-[10.5px] text-slate-500 dark:text-white/50">
                  {customRangeError || "กรุณาเลือกช่วงวันที่ใหม่อีกครั้ง"}
                </p>
              </div>
            </div>
          )}
        </div>

        {(open || queryOpen) && (
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setQueryOpen(false);
            }}
            className="fixed inset-0 z-20 cursor-default"
            aria-label="Close dropdown"
          />
        )}
      </div>
    </section>
  );
};

export default RiskScoreGraph;