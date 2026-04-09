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
  FiArrowLeft,
} from "react-icons/fi";
import {
  ListTargetDiffer,
  ListALLReportByTaskID,
  type TargetDifferDTO,
} from "../../../services";

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

  previous_for_increase: number;
  previous_for_nonincrease: number;
  latest_overlay_equal_or_lower: number;
  latest_positive_diff: number;
  overlay_top_value: number;
};

type FilterOption = {
  key: string;
  label: string;
};

type DetailRow = {
  task_id: string;
  task_name: string;
  detected_date_raw: string;
  detected_date_label: string;
  detected_time?: string;
  risk_score: number;
  axis_key: string;
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
  detail: "#39C6F4",
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

const toDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDetectedDateLabel = (value: unknown) => {
  const date = toDate(value);
  if (!date) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const formatDetectedTimeLabel = (value: unknown) => {
  const date = toDate(value);
  if (!date) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const getDetectedDateValue = (item: any) => {
  return (
    item?.detected_date ??
    item?.detected_at ??
    item?.creation_time ??
    item?.created_at ??
    item?.date ??
    item?.time ??
    ""
  );
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

const DetailTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: DetailRow }>;
}) => {
  if (!active || !payload || payload.length === 0) return null;

  const item = payload[0]?.payload;
  if (!item) return null;

  return (
    <div className="min-w-60 max-w-[320px] rounded-[18px] border border-gray-200/90 bg-white/96 px-3 py-2.5 shadow-[0_14px_32px_rgba(15,23,42,0.14)] backdrop-blur dark:border-white/10 dark:bg-[#0B1220]/96 dark:shadow-[0_14px_28px_rgba(0,0,0,0.32)]">
      <div className="mb-2">
        <p className="text-[13px] font-semibold text-[#1f2240] dark:text-white/92 wrap-break-word">
          {item.task_name || "-"}
        </p>
        <p className="mt-0.5 text-[11px] text-gray-500 dark:text-white/45">
          Date-Time: {item.detected_date_label || "-"}
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 text-[11px]">
        <span className="text-cyan-600 dark:text-cyan-300">Risk Score</span>
        <span className="font-semibold text-[#1f2240] dark:text-white/92">
          {formatRisk(item.risk_score)}
        </span>
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

const DetailXAxisTick = (props: {
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

const CustomLegend = ({ detailMode = false }: { detailMode?: boolean }) => {
  if (detailMode) {
    return (
      <div className="mb-3 flex flex-wrap items-center gap-2.5 sm:gap-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/70 bg-cyan-50 px-2.5 py-1 dark:border-cyan-400/15 dark:bg-cyan-400/10">
          <span className="inline-block h-2 w-2 rounded-full bg-[#39C6F4]" />
          <span className="text-[11px] font-medium text-cyan-700 dark:text-cyan-300">
            Risk Score by Date-Time
          </span>
        </div>
      </div>
    );
  }

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
  const [sortBy, setSortBy] = useState<SortType>("Latest Updated"); //@ts-ignore
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [rows, setRows] = useState<TargetDifferDTO[]>([]);

  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [detailRows, setDetailRows] = useState<DetailRow[]>([]);
  const [detailTaskID, setDetailTaskID] = useState<string>("");
  const [detailTaskName, setDetailTaskName] = useState<string>("");

  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const [sortOpen, setSortOpen] = useState(false);
  const sortDropdownRef = useRef<HTMLDivElement | null>(null);

  const detailMode = detailTaskID !== "";

  const fetchData = async (mode: "initial" | "refresh" = "initial") => {
    try {
      if (mode === "initial") setLoading(true);
      if (mode === "refresh") setRefreshing(true);

      const res = await ListTargetDiffer();
      setRows(Array.isArray(res) ? res : []);
    } catch (error) {
      console.error("fetch target differ error:", error);
      setRows([]);
    } finally {
      if (mode === "initial") setLoading(false);
      if (mode === "refresh") setRefreshing(false);
    }
  };

  const fetchDetailByTaskID = async (taskID: string, taskName?: string) => {
    try {
      setDetailLoading(true);
      setDetailTaskID(taskID);
      setDetailTaskName(taskName || "");

      const res = await ListALLReportByTaskID(taskID);

      const mapped: DetailRow[] = (Array.isArray(res) ? res : [])
        .map((item: any, index: number) => {
          const detectedRaw = getDetectedDateValue(item);
          const detectedLabel = formatDetectedDateLabel(detectedRaw);

          return {
            task_id: String(item?.task_id ?? taskID),
            task_name: String(item?.task_name ?? taskName ?? "-"),
            detected_date_raw: String(detectedRaw ?? ""),
            detected_date_label: `${detectedLabel} ${formatDetectedTimeLabel(
              detectedRaw
            )}`,
            detected_time: formatDetectedTimeLabel(detectedRaw),
            risk_score: Number(item?.risk_score ?? 0),
            axis_key: `${detectedLabel} ${formatDetectedTimeLabel(
              detectedRaw
            )}__AXIS__${index}`,
          };
        })
        .sort((a, b) => {
          const da = toDate(a.detected_date_raw)?.getTime() ?? 0;
          const db = toDate(b.detected_date_raw)?.getTime() ?? 0;
          return da - db;
        });

      setDetailRows(mapped);
    } catch (error) {
      console.error("fetch ListALLReportByTaskID error:", error);
      setDetailRows([]);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleBackToOverview = () => {
    setDetailTaskID("");
    setDetailTaskName("");
    setDetailRows([]);
  };

  useEffect(() => {
    void fetchData("initial");
  }, []);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
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

      const previousRisk = Number(item.previous_risk_score ?? 0);
      const latestRisk = Number(item.latest_risk_score ?? 0);
      const isEqual = latestRisk === previousRisk;
      const isIncrease = latestRisk > previousRisk;

      return {
        host,
        task_name: taskName,
        asset_label: shortenTaskName(taskName),
        axis_key: `${shortenTaskName(taskName)}__AXIS__${host}__${index}`,
        latest_task_id:
          item.latest_task_id !== null && item.latest_task_id !== undefined
            ? String(item.latest_task_id)
            : "-",
        latest_risk_score: latestRisk,
        previous_risk_score: previousRisk,
        diff_risk_score: Number(item.diff_risk_score ?? 0),
        latest_total: Number(item.latest_total ?? 0),
        previous_total: Number(item.previous_total ?? 0),
        previous_version_status: item.previous_version_status || "-",
        latest_creation_time: item.latest_creation_time ?? null,
        previous_creation_time: item.previous_creation_time ?? null,

        previous_for_increase: isIncrease ? previousRisk : 0,
        previous_for_nonincrease: !isIncrease && !isEqual ? previousRisk : 0,
        latest_overlay_equal_or_lower:
          latestRisk <= previousRisk ? latestRisk : 0,
        latest_positive_diff: isIncrease ? latestRisk - previousRisk : 0,
        overlay_top_value: Math.max(previousRisk, latestRisk),
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

  const detailAvgRisk = useMemo(() => {
    if (detailRows.length === 0) return 0;
    return (
      detailRows.reduce((sum, item) => sum + Number(item.risk_score || 0), 0) /
      detailRows.length
    );
  }, [detailRows]);

  const maxRisk = useMemo(() => {
    if (detailMode) {
      const values = detailRows.map((item) => item.risk_score || 0);
      const rawMax = Math.max(...values, 0);
      return Math.max(6, Math.ceil(rawMax + 1));
    }

    const values = chartData.map((item) => item.overlay_top_value || 0);
    const rawMax = Math.max(...values, 0);
    return Math.max(6, Math.ceil(rawMax + 1));
  }, [chartData, detailRows, detailMode]);

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

  const handleOverviewBarClick = (row?: ChartRow) => {
    if (!row?.latest_task_id || row.latest_task_id === "-") return;
    void fetchDetailByTaskID(row.latest_task_id, row.task_name);
  };

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
                    {detailMode
                      ? `Risk Score Timeline${detailTaskName ? ` • ${detailTaskName}` : ""}`
                      : "Target Risk Comparison"}
                  </h2>
                  <p className="text-[11px] text-gray-500 dark:text-white/55 sm:text-[12px]">
                    {detailMode
                      ? "แสดง Risk Score ของ task ที่เลือกตาม Date-Time"
                      : "เปรียบเทียบ Previous Risk Score กับ Latest Risk Score ของแต่ละ Targets"}
                  </p>
                </div>
              </div>
            </div>

            {!detailMode ? (
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
                      <div className="p-2">
                        <div className="space-y-1">
                          {SORT_OPTIONS.map((item) => {
                            const active = sortBy === item;

                            return (
                              <button
                                key={item}
                                type="button"
                                onClick={() => {
                                  setSortBy(item);
                                  setSortOpen(false);
                                }}
                                className={[
                                  "w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition",
                                  active
                                    ? "bg-violet-50 border border-violet-200 dark:bg-violet-500/10 dark:border-violet-400/20"
                                    : "border border-transparent hover:bg-gray-50 dark:hover:bg-white/5",
                                ].join(" ")}
                              >
                                <span
                                  className={[
                                    "h-4.5 w-4.5 rounded-md border flex items-center justify-center shrink-0 transition",
                                    active
                                      ? "bg-violet-500 border-violet-500 text-white"
                                      : "bg-white border-gray-300 text-transparent dark:bg-white/5 dark:border-white/20",
                                  ].join(" ")}
                                >
                                  <FiCheck className="text-[10px]" />
                                </span>

                                <span className="block text-[12px] font-medium text-gray-700 dark:text-white/80">
                                  {item}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {!detailMode && (
                  <button
                    type="button"
                    onClick={() => void fetchData("refresh")}
                    disabled={refreshing}
                    className={[
                      "inline-flex items-center justify-center gap-2 rounded-2xl h-9 px-3.5 transition shrink-0",
                      "bg-white border border-gray-200/80 text-[12px] font-medium text-gray-600 hover:bg-gray-50",
                      "dark:bg-white/6 dark:border-white/10 dark:text-white/75 dark:hover:bg-white/10",
                      refreshing ? "opacity-70 cursor-not-allowed" : "",
                    ].join(" ")}
                  >
                    <FiRefreshCw className={refreshing ? "animate-spin" : ""} />
                    Refresh
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={handleBackToOverview}
                  className={[
                    "inline-flex items-center justify-center gap-2 rounded-2xl h-9 px-3.5 transition shrink-0",
                    "bg-white border border-gray-200/80 text-[12px] font-medium text-gray-600 hover:bg-gray-50",
                    "dark:bg-white/6 dark:border-white/10 dark:text-white/75 dark:hover:bg-white/10",
                  ].join(" ")}
                >
                  <FiArrowLeft />
                  Back
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            <div className="rounded-[18px] border border-gray-200/80 bg-white/60 px-3 py-2.5 dark:border-white/10 dark:bg-white/5">
              <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-white/50">
                <FiShield />
                <span>{detailMode ? "Reports" : "Compared Targets"}</span>
              </div>
              <div className="mt-1 text-[18px] font-semibold text-[#1f2240] dark:text-white/92">
                {detailMode ? detailRows.length : summary.totalAssets}
              </div>
            </div>

            <div className="rounded-[18px] border border-gray-200/80 bg-white/60 px-3 py-2.5 dark:border-white/10 dark:bg-white/5">
              <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-white/50">
                <FiActivity />
                <span>Average Risk</span>
              </div>
              <div className="mt-1 text-[18px] font-semibold text-[#1f2240] dark:text-white/92">
                {detailMode ? formatRisk(detailAvgRisk) : formatRisk(summary.avgLatestRisk)}
              </div>
            </div>

            {!detailMode ? (
              <>
                <div className="rounded-[18px] border border-gray-200/80 bg-white/60 px-3 py-2.5 dark:border-white/10 dark:bg-white/5">
                  <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-white/50">
                    <MdTrendingUp className="text-[14px]" />
                    <span>Risk Increased</span>
                  </div>
                  <div className="mt-1 text-[18px] font-semibold text-rose-600 dark:text-rose-300">
                    {summary.increasedCount}
                  </div>
                </div>

                <div className="rounded-[18px] border border-gray-200/80 bg-white/60 px-3 py-2.5 dark:border-white/10 dark:bg-white/5">
                  <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-white/50">
                    <MdTrendingDown className="text-[14px]" />
                    <span>Risk Decreased</span>
                  </div>
                  <div className="mt-1 text-[18px] font-semibold text-cyan-600 dark:text-cyan-300">
                    {summary.decreasedCount}
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-[18px] border border-gray-200/80 bg-white/60 px-3 py-2.5 dark:border-white/10 dark:bg-white/5 col-span-2">
                <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-white/50">
                  <FiActivity />
                  <span>Selected Task</span>
                </div>
                <div className="mt-1 text-[14px] font-semibold text-[#1f2240] dark:text-white/92 wrap-break-word">
                  {detailTaskName || detailTaskID || "-"}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="relative z-10 flex-1 min-h-0 rounded-[20px] border border-gray-200/80 bg-white/72 p-3 sm:p-4 dark:border-white/10 dark:bg-white/4">
          <CustomLegend detailMode={detailMode} />

          <div className="h-85 sm:h-97.5 xl:h-107.5">
            {detailMode ? (
              detailLoading ? (
                <div className="grid h-full w-full place-items-center rounded-[18px] border border-dashed border-gray-200 bg-white/50 dark:border-white/10 dark:bg-white/5">
                  <div className="text-center">
                    <div className="mx-auto mb-2.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600 dark:bg-cyan-400/10 dark:text-cyan-300">
                      <FiRefreshCw className="animate-spin text-[18px]" />
                    </div>
                    <p className="text-[12px] font-semibold text-[#1f2240] dark:text-white/92">
                      Loading report detail
                    </p>
                    <p className="mt-1 text-[10px] text-gray-500 dark:text-white/50">
                      กำลังดึงข้อมูลจาก ListALLReportByTaskID
                    </p>
                  </div>
                </div>
              ) : detailRows.length === 0 ? (
                <div className="grid h-full w-full place-items-center rounded-[18px] border border-dashed border-gray-200 bg-white/50 dark:border-white/10 dark:bg-white/5">
                  <div className="text-center">
                    <div className="mx-auto mb-2.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-400/10 dark:text-amber-300">
                      <FiAlertCircle className="text-[18px]" />
                    </div>
                    <p className="text-[12px] font-semibold text-[#1f2240] dark:text-white/92">
                      No report detail data
                    </p>
                    <p className="mt-1 text-[10px] text-gray-500 dark:text-white/50">
                      ยังไม่มีข้อมูลจาก ListALLReportByTaskID
                    </p>
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={detailRows}
                    margin={{ top: 18, right: 8, left: -12, bottom: 6 }}
                    barCategoryGap="18%"
                  >
                    <CartesianGrid
                      stroke={isDarkMode() ? COLORS.gridDark : COLORS.gridLight}
                      strokeDasharray="3 3"
                      vertical={false}
                    />

                    <XAxis
                      dataKey="axis_key"
                      tick={<DetailXAxisTick />}
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
                      content={<DetailTooltip />}
                      cursor={{
                        fill: isDarkMode()
                          ? "rgba(255,255,255,0.04)"
                          : "rgba(148,163,184,0.08)",
                      }}
                    />

                    <ReferenceLine
                      y={Number(detailAvgRisk.toFixed(2))}
                      stroke={isDarkMode() ? COLORS.avgLineDark : COLORS.avgLineLight}
                      strokeDasharray="5 5"
                      ifOverflow="extendDomain"
                    />

                    <Bar
                      dataKey="risk_score"
                      name="Risk Score"
                      radius={[8, 8, 0, 0]}
                      maxBarSize={34}
                    >
                      <LabelList
                        dataKey="risk_score"
                        position="top"
                        formatter={(value: any) => formatRisk(Number(value ?? 0))}
                        style={{
                          fill: isDarkMode() ? "rgba(255,255,255,0.86)" : "#475467",
                          fontSize: 10,
                          fontWeight: 700,
                        }}
                      />
                      {detailRows.map((_, index) => (
                        <Cell key={`detail-${index}`} fill={COLORS.detail} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )
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
                  margin={{ top: 18, right: 8, left: -12, bottom: 6 }}
                  barCategoryGap="14%"
                  barGap="-100%"
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
                    dataKey="previous_for_nonincrease"
                    name="Previous Risk"
                    fill={COLORS.previous}
                    radius={[8, 8, 0, 0]}
                    maxBarSize={34}
                    onClick={(payload) => handleOverviewBarClick(payload as unknown as ChartRow)}
                    style={{ cursor: "pointer" }}
                  >
                    <LabelList
                      dataKey="previous_for_nonincrease"
                      position="top"
                      formatter={(value: any) =>
                        Number(value ?? 0) > 0 ? formatRisk(Number(value ?? 0)) : ""
                      }
                      style={{
                        fill: isDarkMode() ? "rgba(255,255,255,0.78)" : "#667085",
                        fontSize: 10,
                        fontWeight: 700,
                      }}
                    />
                  </Bar>

                  <Bar
                    dataKey="previous_for_increase"
                    name="Previous Risk"
                    stackId="riskUp"
                    fill={COLORS.previous}
                    radius={[8, 8, 0, 0]}
                    maxBarSize={34}
                    onClick={(payload) => handleOverviewBarClick(payload as unknown as ChartRow)}
                    style={{ cursor: "pointer" }}
                  />

                  <Bar
                    dataKey="latest_positive_diff"
                    name="Latest Risk Increased"
                    stackId="riskUp"
                    fill={COLORS.latestUp}
                    radius={[8, 8, 0, 0]}
                    maxBarSize={34}
                    onClick={(payload) => handleOverviewBarClick(payload as unknown as ChartRow)}
                    style={{ cursor: "pointer" }}
                  >
                    <LabelList
                      dataKey="overlay_top_value"
                      position="top"
                      formatter={(value: any) => formatRisk(Number(value ?? 0))}
                      style={{
                        fill: isDarkMode() ? "rgba(255,255,255,0.86)" : "#475467",
                        fontSize: 10,
                        fontWeight: 700,
                      }}
                    />
                  </Bar>

                  <Bar
                    dataKey="latest_overlay_equal_or_lower"
                    name="Latest Risk"
                    fill={COLORS.latestStable}
                    radius={[8, 8, 0, 0]}
                    maxBarSize={34}
                    onClick={(payload) => handleOverviewBarClick(payload as unknown as ChartRow)}
                    style={{ cursor: "pointer" }}
                  >
                    <LabelList
                      dataKey="latest_overlay_equal_or_lower"
                      position="top"
                      formatter={(value: any) =>
                        Number(value ?? 0) > 0 ? formatRisk(Number(value ?? 0)) : ""
                      }
                      style={{
                        fill: isDarkMode() ? "rgba(255,255,255,0.86)" : "#475467",
                        fontSize: 10,
                        fontWeight: 700,
                      }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default AverageEnrollment;