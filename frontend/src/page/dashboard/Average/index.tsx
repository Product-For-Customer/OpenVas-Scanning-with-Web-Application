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

  has_previous_record: boolean;

  previous_for_increase: number;
  previous_for_nonincrease: number;
  latest_overlay_equal_or_lower: number;
  latest_positive_diff: number;
  overlay_top_value: number;

  latest_increase_label: number | null;
  latest_equal_or_lower_label: number | null;
};

type FilterOption = {
  key: string;
  label: string;
};

type DetailRow = {
  task_id: string;
  task_name: string;

  detected_date_raw: string;
  detected_timestamp: number;
  detected_date_label: string;
  detected_tick_date: string;
  detected_tick_time: string;
  detected_time?: string;

  risk_score: number;
  axis_key: string;
  detail_color: string;

  host_ip: string;
  total: number;
  critical: number;
  high: number;
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

const MOBILE_BREAKPOINT = 640;
const IPAD_BREAKPOINT = 1280;

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
  if (value === null || value === undefined || value === "") return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;

    if (value < 1e12) {
      const d = new Date(value * 1000);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const str = String(value).trim();
  if (!str) return null;

  if (/^\d+$/.test(str)) {
    const num = Number(str);
    if (!Number.isFinite(num)) return null;

    if (num < 1e12) {
      const d = new Date(num * 1000);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    const d = new Date(num);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
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

const formatDetectedTickDate = (value: unknown) => {
  const date = toDate(value);
  if (!date) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
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

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const rgbToHex = (r: number, g: number, b: number) => {
  const toHex = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const interpolateColor = (
  c1: [number, number, number],
  c2: [number, number, number],
  t: number
) => {
  return rgbToHex(
    lerp(c1[0], c2[0], t),
    lerp(c1[1], c2[1], t),
    lerp(c1[2], c2[2], t)
  );
};

const getRiskHeatColor = (risk: number) => {
  const clamped = Math.max(0, Math.min(10, Number(risk || 0)));

  const green: [number, number, number] = [34, 197, 94];
  const yellow: [number, number, number] = [250, 204, 21];
  const orange: [number, number, number] = [249, 115, 22];
  const red: [number, number, number] = [239, 68, 68];

  if (clamped <= 5) {
    const t = clamped / 5;
    return interpolateColor(green, yellow, t);
  }

  if (clamped <= 7.5) {
    const t = (clamped - 5) / 2.5;
    return interpolateColor(yellow, orange, t);
  }

  const t = (clamped - 7.5) / 2.5;
  return interpolateColor(orange, red, t);
};

const getVisibleTickIndexSet = (length: number, maxLabels: number): Set<number> => {
  if (length <= 0) return new Set<number>();
  if (length <= maxLabels) {
    return new Set(Array.from({ length }, (_, i) => i));
  }

  const set = new Set<number>();
  const lastIndex = length - 1;

  for (let i = 0; i < maxLabels; i++) {
    const index = Math.round((i * lastIndex) / (maxLabels - 1));
    set.add(index);
  }

  return set;
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
  const isUp = item.has_previous_record && diff > 0;
  const isDown = item.has_previous_record && diff < 0;

  return (
    <div className="min-w-62.5 max-w-[320px] rounded-[18px] border border-gray-200/90 bg-white/96 px-3 py-2.5 shadow-[0_14px_32px_rgba(15,23,42,0.14)] backdrop-blur dark:border-white/10 dark:bg-[#0B1220]/96 dark:shadow-[0_14px_28px_rgba(0,0,0,0.32)]">
      <div className="mb-2">
        <p className="wrap-break-word text-[13px] font-semibold text-[#1f2240] dark:text-white/92">
          {item.task_name || "Unknown Task"}
        </p>
        <p className="mt-0.5 break-all text-[11px] text-gray-500 dark:text-white/45">
          Host: {item.host || "-"}
        </p>
      </div>

      <div className="space-y-1.5 text-[11px]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[#8B7CFF]">Previous Risk</span>
          <span className="font-semibold text-[#1f2240] dark:text-white/92">
            {item.has_previous_record ? formatRisk(item.previous_risk_score) : "-"}
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
            <span className="wrap-break-word text-right font-medium">
              {item.task_name || "-"}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 text-gray-600 dark:text-white/68">
            <span>Host</span>
            <span className="break-all text-right font-medium">
              {item.host || "-"}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 text-gray-600 dark:text-white/68">
            <span>Latest Total</span>
            <span className="text-right font-semibold text-[#1f2240] dark:text-white/90">
              {item.latest_total ?? 0}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 text-gray-600 dark:text-white/68">
            <span>Previous Total</span>
            <span className="text-right font-semibold text-[#1f2240] dark:text-white/90">
              {item.has_previous_record ? item.previous_total ?? 0 : "-"}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 text-gray-600 dark:text-white/68">
            <span>Latest Time</span>
            <span className="text-right font-medium">
              {formatUnixThai(item.latest_creation_time)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 text-gray-600 dark:text-white/68">
            <span>Previous Time</span>
            <span className="text-right font-medium">
              {item.has_previous_record
                ? formatUnixThai(item.previous_creation_time)
                : "-"}
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
            Risk Change: {item.has_previous_record ? `${diff > 0 ? "+" : ""}${formatRisk(diff)}` : "0.00"}
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
    <div className="min-w-62.5 max-w-85 rounded-[18px] border border-gray-200/90 bg-white/96 px-3 py-2.5 shadow-[0_14px_32px_rgba(15,23,42,0.14)] backdrop-blur dark:border-white/10 dark:bg-[#0B1220]/96 dark:shadow-[0_14px_28px_rgba(0,0,0,0.32)]">
      <div className="mb-2">
        <p className="wrap-break-word text-[13px] font-semibold text-[#1f2240] dark:text-white/92">
          {item.task_name || "-"}
        </p>
        <p className="mt-0.5 text-[11px] text-gray-500 dark:text-white/45">
          Date-Time: {item.detected_date_label || "-"}
        </p>
      </div>

      <div className="space-y-1.5 text-[11px]">
        <div className="flex items-center justify-between gap-3">
          <span style={{ color: item.detail_color }}>Risk Score</span>
          <span className="font-semibold text-[#1f2240] dark:text-white/92">
            {formatRisk(item.risk_score)}
          </span>
        </div>

        <div className="h-px bg-gray-200 dark:bg-white/10" />

        <div className="grid grid-cols-1 gap-1.5">
          <div className="flex items-center justify-between gap-3 text-gray-600 dark:text-white/68">
            <span>Host IP</span>
            <span className="break-all text-right font-medium">
              {item.host_ip || "-"}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 text-gray-600 dark:text-white/68">
            <span>Vulnerability Total</span>
            <span className="text-right font-semibold text-[#1f2240] dark:text-white/90">
              {item.total ?? 0}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 text-gray-600 dark:text-white/68">
            <span>Critical</span>
            <span className="text-right font-semibold text-[#1f2240] dark:text-white/90">
              {item.critical ?? 0}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 text-gray-600 dark:text-white/68">
            <span>High</span>
            <span className="text-right font-semibold text-[#1f2240] dark:text-white/90">
              {item.high ?? 0}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const CustomXAxisTick = (props: {
  x?: number;
  y?: number;
  payload?: { value?: string; index?: number };
  visibleIndexSet?: Set<number>;
}) => {
  const { x = 0, y = 0, payload, visibleIndexSet } = props;
  const rawValue = String(payload?.value || "");
  const tickIndex = Number(payload?.index ?? -1);
  const dark = isDarkMode();

  if (visibleIndexSet && !visibleIndexSet.has(tickIndex)) {
    return null;
  }

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
  payload?: { value?: string; index?: number };
  visibleIndexSet?: Set<number>;
}) => {
  const { x = 0, y = 0, payload, visibleIndexSet } = props;
  const rawValue = String(payload?.value || "");
  const tickIndex = Number(payload?.index ?? -1);
  const dark = isDarkMode();

  if (visibleIndexSet && !visibleIndexSet.has(tickIndex)) {
    return null;
  }

  const pure = rawValue.includes("__AXIS__")
    ? rawValue.split("__AXIS__")[0]
    : rawValue;

  const [datePart = "-", timePart = "-"] = pure.split("__TIME__");

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={12}
        textAnchor="middle"
        fill={dark ? COLORS.axisSubtleDark : COLORS.axisLight}
        fontSize={10}
        fontWeight={600}
      >
        <tspan x={0} dy="0">
          {datePart}
        </tspan>
        <tspan
          x={0}
          dy="12"
          fill={dark ? "rgba(255,255,255,0.38)" : "#98A2B3"}
          fontSize={9}
          fontWeight={500}
        >
          {timePart}
        </tspan>
      </text>
    </g>
  );
};

const CustomLegend = ({ detailMode = false }: { detailMode?: boolean }) => {
  if (detailMode) {
    return (
      <div className="mb-3 flex flex-wrap items-center gap-2.5 sm:gap-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/70 bg-emerald-50 px-2.5 py-1 dark:border-emerald-400/15 dark:bg-emerald-400/10">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
            Low Risk
          </span>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/70 bg-amber-50 px-2.5 py-1 dark:border-amber-400/15 dark:bg-amber-400/10">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
          <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
            Medium Risk
          </span>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-rose-200/70 bg-rose-50 px-2.5 py-1 dark:border-rose-400/15 dark:bg-rose-400/10">
          <span className="inline-block h-2 w-2 rounded-full bg-rose-500" />
          <span className="text-[11px] font-medium text-rose-700 dark:text-rose-300">
            High Risk
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
  const [sortBy, setSortBy] = useState<SortType>("Latest Updated");
  const [loading, setLoading] = useState<boolean>(true); //@ts-ignore
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

  const [screenWidth, setScreenWidth] = useState<number>(() => {
    if (typeof window === "undefined") return 1440;
    return window.innerWidth;
  });

  const hasFetchedRef = useRef(false);
  const isFetchingRef = useRef(false);
  const isMountedRef = useRef(false);

  const detailMode = detailTaskID !== "";

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleResize = () => {
      setScreenWidth(window.innerWidth);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isMobile = screenWidth < MOBILE_BREAKPOINT;
  const isIPad = screenWidth >= MOBILE_BREAKPOINT && screenWidth < IPAD_BREAKPOINT;

  const overviewMaxVisibleLabels = useMemo(() => {
    if (isMobile) return 3;
    if (isIPad) return 5;
    return Number.MAX_SAFE_INTEGER;
  }, [isMobile, isIPad]);

  const detailMaxVisibleLabels = useMemo(() => {
    if (isMobile) return 3;
    if (isIPad) return 5;
    return Number.MAX_SAFE_INTEGER;
  }, [isMobile, isIPad]);

  const fetchData = async (mode: "initial" | "refresh" = "initial") => {
    if (isFetchingRef.current) return;

    try {
      isFetchingRef.current = true;

      if (mode === "initial" && isMountedRef.current) setLoading(true);
      if (mode === "refresh" && isMountedRef.current) setRefreshing(true);

      const res = await ListTargetDiffer();

      if (!isMountedRef.current) return;

      setRows(Array.isArray(res) ? res : []);
    } catch (error) {
      console.error("fetch target differ error:", error);

      if (!isMountedRef.current) return;

      setRows([]);
    } finally {
      if (isMountedRef.current) {
        if (mode === "initial") setLoading(false);
        if (mode === "refresh") setRefreshing(false);
      }
      isFetchingRef.current = false;
    }
  };

  const fetchDetailByTaskID = async (taskID: string, taskName?: string) => {
    try {
      setDetailLoading(true);
      setDetailTaskID(taskID);
      setDetailTaskName(taskName || "");

      const res = await ListALLReportByTaskID(taskID);

      const rawRows = Array.isArray(res)
        ? res
        : Array.isArray((res as any)?.data)
        ? (res as any).data
        : [];

      const mapped: DetailRow[] = rawRows
        .map((item: any, index: number) => {
          const detectedRaw = getDetectedDateValue(item);
          const detectedDate = toDate(detectedRaw);
          const detectedTimestamp = detectedDate?.getTime() ?? index;
          const detectedDateLabel = formatDetectedDateLabel(detectedRaw);
          const detectedTickDate = formatDetectedTickDate(detectedRaw);
          const detectedTickTime = formatDetectedTimeLabel(detectedRaw);
          const riskScore = Number(item?.risk_score ?? 0);

          return {
            task_id: String(item?.task_id ?? taskID),
            task_name: String(item?.task_name ?? taskName ?? "-"),
            detected_date_raw: String(detectedRaw ?? ""),
            detected_timestamp: detectedTimestamp,
            detected_date_label: detectedDateLabel,
            detected_tick_date: detectedTickDate,
            detected_tick_time: detectedTickTime,
            detected_time: detectedTickTime,
            risk_score: riskScore,
            axis_key: `${detectedTickDate}__TIME__${detectedTickTime}__AXIS__${index}`,
            detail_color: getRiskHeatColor(riskScore),

            host_ip: String(item?.host_ip ?? item?.ip ?? item?.host ?? "-"),
            total: Number(item?.total ?? 0),
            critical: Number(item?.critical ?? 0),
            high: Number(item?.high ?? 0),
          };
        })
        .sort(
          (a: DetailRow, b: DetailRow) =>
            a.detected_timestamp - b.detected_timestamp
        );

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
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
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
      const host = (item as any).host || (item as any).host_ip || "-";

      const previousRisk = Number((item as any).previous_risk_score ?? 0);
      const latestRisk = Number((item as any).latest_risk_score ?? 0);

      const rawPreviousCreationTime = (item as any).previous_creation_time;
      const rawPreviousTotal = Number((item as any).previous_total ?? 0);

      const hasPreviousRecord =
        rawPreviousCreationTime !== null &&
        rawPreviousCreationTime !== undefined &&
        rawPreviousCreationTime !== "" &&
        !Number.isNaN(Number(rawPreviousCreationTime));

      const isEqual = hasPreviousRecord && latestRisk === previousRisk;
      const isIncrease = hasPreviousRecord && latestRisk > previousRisk;
      const isEqualOrLower = !hasPreviousRecord || latestRisk <= previousRisk;

      const diffRisk = hasPreviousRecord ? latestRisk - previousRisk : 0;

      return {
        host,
        task_name: taskName,
        asset_label: shortenTaskName(taskName),
        axis_key: `${shortenTaskName(taskName)}__AXIS__${host}__${index}`,
        latest_task_id:
          (item as any).latest_task_id !== null &&
          (item as any).latest_task_id !== undefined
            ? String((item as any).latest_task_id)
            : "-",

        latest_risk_score: latestRisk,
        previous_risk_score: hasPreviousRecord ? previousRisk : 0,
        diff_risk_score: diffRisk,

        latest_total: Number((item as any).latest_total ?? 0),
        previous_total: hasPreviousRecord ? rawPreviousTotal : 0,
        previous_version_status: (item as any).previous_version_status || "-",
        latest_creation_time: (item as any).latest_creation_time ?? null,
        previous_creation_time: hasPreviousRecord
          ? Number(rawPreviousCreationTime)
          : null,

        has_previous_record: hasPreviousRecord,

        previous_for_increase: isIncrease ? previousRisk : 0,
        previous_for_nonincrease:
          hasPreviousRecord && !isIncrease && !isEqual ? previousRisk : 0,
        latest_overlay_equal_or_lower: isEqualOrLower ? latestRisk : 0,
        latest_positive_diff: isIncrease ? latestRisk - previousRisk : 0,
        overlay_top_value: Math.max(previousRisk, latestRisk),

        latest_increase_label: isIncrease ? latestRisk : null,
        latest_equal_or_lower_label: isEqualOrLower ? latestRisk : null,
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

    options.sort((a: FilterOption, b: FilterOption) =>
      a.label.localeCompare(b.label)
    );
    return options;
  }, [mappedRows]);

  const filteredOptions = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) return filterOptions;

    return filterOptions.filter((opt: FilterOption) =>
      opt.label.toLowerCase().includes(keyword)
    );
  }, [filterOptions, searchQuery]);

  const filteredMappedRows = useMemo(() => {
    if (selectedKeys.length === 0) return mappedRows;

    const selectedSet = new Set(selectedKeys);
    return mappedRows.filter((row: ChartRow) =>
      selectedSet.has(`${row.task_name}__${row.host}`)
    );
  }, [mappedRows, selectedKeys]);

  const chartData = useMemo<ChartRow[]>(() => {
    const sorted = [...filteredMappedRows];

    if (sortBy === "Highest Latest Risk") {
      sorted.sort(
        (a: ChartRow, b: ChartRow) => b.latest_risk_score - a.latest_risk_score
      );
    } else if (sortBy === "Biggest Change") {
      sorted.sort(
        (a: ChartRow, b: ChartRow) =>
          Math.abs(b.diff_risk_score || 0) - Math.abs(a.diff_risk_score || 0)
      );
    } else {
      sorted.sort(
        (a: ChartRow, b: ChartRow) =>
          (b.latest_creation_time || 0) - (a.latest_creation_time || 0)
      );
    }

    return sorted.slice(0, 12);
  }, [filteredMappedRows, sortBy]);

  const summary = useMemo(() => {
    const totalAssets = filteredMappedRows.length;

    const avgLatestRisk =
      totalAssets > 0
        ? filteredMappedRows.reduce(
            (sum: number, item: ChartRow) =>
              sum + Number(item.latest_risk_score || 0),
            0
          ) / totalAssets
        : 0;

    const increasedCount = filteredMappedRows.filter(
      (item: ChartRow) => item.has_previous_record && item.diff_risk_score > 0
    ).length;

    const decreasedCount = filteredMappedRows.filter(
      (item: ChartRow) => item.has_previous_record && item.diff_risk_score < 0
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
      detailRows.reduce(
        (sum: number, item: DetailRow) => sum + Number(item.risk_score || 0),
        0
      ) / detailRows.length
    );
  }, [detailRows]);

  const maxRisk = useMemo(() => {
    if (detailMode) {
      return 10;
    }

    const values = chartData.map(
      (item: ChartRow) => item.overlay_top_value || 0
    );
    const rawMax = Math.max(...values, 0);
    return Math.max(6, Math.ceil(rawMax + 1));
  }, [chartData, detailMode]);

  const yTicks = useMemo(() => {
    if (detailMode) {
      return [0, 2, 4, 6, 8, 10];
    }

    const step = maxRisk <= 6 ? 1 : Math.ceil(maxRisk / 5);
    const ticks: number[] = [];

    for (let i = 0; i <= maxRisk; i += step) {
      ticks.push(i);
    }

    if (ticks[ticks.length - 1] !== maxRisk) ticks.push(maxRisk);
    return ticks;
  }, [maxRisk, detailMode]);

  const overviewVisibleTickIndexSet = useMemo(() => {
    return getVisibleTickIndexSet(chartData.length, overviewMaxVisibleLabels);
  }, [chartData.length, overviewMaxVisibleLabels]);

  const detailVisibleTickIndexSet = useMemo(() => {
    return getVisibleTickIndexSet(detailRows.length, detailMaxVisibleLabels);
  }, [detailRows.length, detailMaxVisibleLabels]);

  const selectedCount = selectedKeys.length;

  const dropdownButtonLabel = useMemo(() => {
    if (selectedCount === 0) return "Filter Device";
    if (selectedCount === 1) {
      const found = filterOptions.find(
        (x: FilterOption) => x.key === selectedKeys[0]
      );
      return found?.label || "1 selected";
    }
    return `${selectedCount} selected`;
  }, [selectedCount, filterOptions, selectedKeys]);

  const toggleSelect = (key: string) => {
    setSelectedKeys((prev: string[]) =>
      prev.includes(key)
        ? prev.filter((item: string) => item !== key)
        : [...prev, key]
    );
  };

  const handleSelectAllVisible = () => {
    const visibleKeys = filteredOptions.map((x: FilterOption) => x.key);

    setSelectedKeys((prev: string[]) => {
      const prevSet = new Set(prev);
      const allVisibleSelected = visibleKeys.every((key: string) =>
        prevSet.has(key)
      );

      if (allVisibleSelected) {
        return prev.filter((key: string) => !visibleKeys.includes(key));
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
    filteredOptions.every((opt: FilterOption) => selectedKeys.includes(opt.key));

  const sortButtonLabel = sortBy;

  const handleOverviewBarClick = (row?: ChartRow) => {
    if (!row?.latest_task_id || row.latest_task_id === "-") return;
    void fetchDetailByTaskID(row.latest_task_id, row.task_name);
  };

  return (
    <section
      className={[
        "relative flex h-full w-full flex-col overflow-hidden rounded-[22px] p-3 sm:p-4 md:p-4.5",
        "border border-gray-200/80 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.05)]",
        "dark:border-white/10 dark:bg-[#081120] dark:ring-1 dark:ring-cyan-400/10 dark:shadow-[0_14px_40px_rgba(0,0,0,0.24)]",
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[22px]">
        <div className="absolute -top-14 right-0 h-32 w-32 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-28 w-28 rounded-full bg-violet-400/10 blur-3xl" />
      </div>

      <div className="relative z-10 flex h-full min-h-0 flex-col">
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
                      ? `Risk Score Timeline${
                          detailTaskName ? ` • ${detailTaskName}` : ""
                        }`
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
                <div
                  className="relative min-w-full sm:min-w-72.5"
                  ref={dropdownRef}
                >
                  <button
                    type="button"
                    onClick={() => setOpen((prev: boolean) => !prev)}
                    className={[
                      "inline-flex min-h-9 w-full items-center justify-between gap-3 rounded-2xl px-3.5 text-left transition",
                      "border border-gray-200/80 bg-white text-[12px] font-medium text-gray-600 hover:bg-gray-50",
                      "dark:border-white/10 dark:bg-white/6 dark:text-white/75 dark:hover:bg-white/10",
                    ].join(" ")}
                  >
                    <span className="truncate">{dropdownButtonLabel}</span>

                    <div className="flex shrink-0 items-center gap-2">
                      {selectedCount > 0 && (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-cyan-200 bg-cyan-50 px-1.5 text-[10px] font-semibold text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-300">
                          {selectedCount}
                        </span>
                      )}
                      <FiChevronDown
                        className={`text-[14px] transition-transform ${
                          open ? "rotate-180" : ""
                        }`}
                      />
                    </div>
                  </button>

                  {open && (
                    <div className="absolute right-0 z-30 mt-2 w-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.12)] dark:border-white/10 dark:bg-[#0B1220]">
                      <div className="border-b border-gray-100 p-3 dark:border-white/10">
                        <div className="relative">
                          <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-gray-400 dark:text-white/35" />
                          <input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search device..."
                            className="h-10 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-9 text-[12px] text-gray-700 outline-none focus:border-cyan-300 dark:border-white/10 dark:bg-white/5 dark:text-white/85"
                          />
                          {searchQuery && (
                            <button
                              type="button"
                              onClick={() => setSearchQuery("")}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-white/35 dark:hover:text-white/70"
                            >
                              <FiX className="text-[13px]" />
                            </button>
                          )}
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={handleSelectAllVisible}
                            className="rounded-xl bg-gray-100 px-3 py-1.5 text-[11px] font-medium text-gray-700 hover:bg-gray-200 dark:bg-white/8 dark:text-white/80 dark:hover:bg-white/12"
                          >
                            {allVisibleSelected
                              ? "Unselect visible"
                              : "Select visible"}
                          </button>

                          <button
                            type="button"
                            onClick={clearAllSelections}
                            className="rounded-xl bg-rose-50 px-3 py-1.5 text-[11px] font-medium text-rose-600 hover:bg-rose-100 dark:bg-rose-400/10 dark:text-rose-300 dark:hover:bg-rose-400/15"
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      <div className="max-h-70 overflow-y-auto p-2">
                        {filteredOptions.length === 0 ? (
                          <div className="px-3 py-6 text-center text-[12px] text-gray-500 dark:text-white/45">
                            No device found
                          </div>
                        ) : (
                          filteredOptions.map((option: FilterOption) => {
                            const checked = selectedKeys.includes(option.key);

                            return (
                              <button
                                key={option.key}
                                type="button"
                                onClick={() => toggleSelect(option.key)}
                                className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-white/6"
                              >
                                <div className="min-w-0">
                                  <div className="truncate text-[12px] font-medium text-gray-700 dark:text-white/85">
                                    {option.label}
                                  </div>
                                </div>

                                <div
                                  className={[
                                    "flex h-5 w-5 items-center justify-center rounded-md border",
                                    checked
                                      ? "border-cyan-400 bg-cyan-500 text-white"
                                      : "border-gray-300 bg-white text-transparent dark:border-white/15 dark:bg-white/5",
                                  ].join(" ")}
                                >
                                  <FiCheck className="text-[11px]" />
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div
                  className="relative min-w-full sm:min-w-55"
                  ref={sortDropdownRef}
                >
                  <button
                    type="button"
                    onClick={() => setSortOpen((prev) => !prev)}
                    className={[
                      "inline-flex min-h-9 w-full items-center justify-between gap-3 rounded-2xl px-3.5 text-left transition",
                      "border border-gray-200/80 bg-white text-[12px] font-medium text-gray-600 hover:bg-gray-50",
                      "dark:border-white/10 dark:bg-white/6 dark:text-white/75 dark:hover:bg-white/10",
                    ].join(" ")}
                  >
                    <span className="truncate">{sortButtonLabel}</span>
                    <FiChevronDown
                      className={`text-[14px] transition-transform ${
                        sortOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {sortOpen && (
                    <div className="absolute right-0 z-30 mt-2 w-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.12)] dark:border-white/10 dark:bg-[#0B1220]">
                      <div className="p-2">
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
                              className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-white/6"
                            >
                              <span className="text-[12px] font-medium text-gray-700 dark:text-white/85">
                                {option}
                              </span>

                              <div
                                className={[
                                  "flex h-5 w-5 items-center justify-center rounded-md border",
                                  checked
                                    ? "border-cyan-400 bg-cyan-500 text-white"
                                    : "border-gray-300 bg-white text-transparent dark:border-white/15 dark:bg-white/5",
                                ].join(" ")}
                              >
                                <FiCheck className="text-[11px]" />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleBackToOverview}
                  className="inline-flex min-h-9 items-center justify-center gap-2 rounded-2xl border border-gray-200/80 bg-white px-4 text-[12px] font-medium text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-white/6 dark:text-white/80 dark:hover:bg-white/10"
                >
                  <FiArrowLeft className="text-[13px]" />
                  Back
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <div className="rounded-[22px] border border-gray-200/80 bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-white/6">
              <div className="mb-2 flex items-center gap-2 text-[12px] font-medium text-gray-500 dark:text-white/55">
                <FiShield className="text-[13px] text-cyan-500" />
                {detailMode ? "Data Points" : "Total Assets"}
              </div>
              <div className="text-[20px] font-semibold text-[#1f2240] dark:text-white/92">
                {detailMode ? detailRows.length : summary.totalAssets}
              </div>
            </div>

            <div className="rounded-[22px] border border-gray-200/80 bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-white/6">
              <div className="mb-2 flex items-center gap-2 text-[12px] font-medium text-gray-500 dark:text-white/55">
                <FiActivity className="text-[13px] text-violet-500" />
                Average Risk
              </div>
              <div className="text-[20px] font-semibold text-[#1f2240] dark:text-white/92">
                {formatRisk(detailMode ? detailAvgRisk : summary.avgLatestRisk)}
              </div>
            </div>

            <div className="rounded-[22px] border border-gray-200/80 bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-white/6">
              <div className="mb-2 flex items-center gap-2 text-[12px] font-medium text-gray-500 dark:text-white/55">
                <FiAlertCircle className="text-[13px] text-rose-500" />
                {detailMode ? "Risk Range" : "Increased / Decreased"}
              </div>
              <div className="text-[20px] font-semibold text-[#1f2240] dark:text-white/92">
                {detailMode
                  ? "0.00 - 10.00"
                  : `${summary.increasedCount} / ${summary.decreasedCount}`}
              </div>
            </div>
          </div>
        </div>

        <CustomLegend detailMode={detailMode} />

        <div className="min-h-105 flex-1">
          {loading ? (
            <div className="flex h-105 items-center justify-center text-[13px] text-gray-500 dark:text-white/55">
              Loading...
            </div>
          ) : detailLoading ? (
            <div className="flex h-105 items-center justify-center text-[13px] text-gray-500 dark:text-white/55">
              Loading detail...
            </div>
          ) : detailMode ? (
            detailRows.length === 0 ? (
              <div className="flex h-105 items-center justify-center text-[13px] text-gray-500 dark:text-white/55">
                No Data
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={420} minWidth={0}>
                <BarChart
                  data={detailRows}
                  margin={{ top: 18, right: 8, left: -12, bottom: 6 }}
                  barCategoryGap="22%"
                >
                  <CartesianGrid
                    stroke={isDarkMode() ? COLORS.gridDark : COLORS.gridLight}
                    strokeDasharray="3 3"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="axis_key"
                    tick={
                      <DetailXAxisTick visibleIndexSet={detailVisibleTickIndexSet} />
                    }
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    height={72}
                  />

                  <YAxis
                    tick={{
                      fill: isDarkMode() ? COLORS.axisDark : COLORS.axisLight,
                      fontSize: 11,
                    }}
                    axisLine={false}
                    tickLine={false}
                    width={38}
                    domain={[0, 10]}
                    ticks={[0, 2, 4, 6, 8, 10]}
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
                    maxBarSize={42}
                  >
                    {detailRows.map((entry: DetailRow, index: number) => (
                      <Cell
                        key={`detail-cell-${entry.axis_key}-${index}`}
                        fill={entry.detail_color}
                      />
                    ))}

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
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )
          ) : chartData.length === 0 ? (
            <div className="flex h-105 items-center justify-center text-[13px] text-gray-500 dark:text-white/55">
              No Data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={420} minWidth={0}>
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
                  tick={
                    <CustomXAxisTick visibleIndexSet={overviewVisibleTickIndexSet} />
                  }
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
                  onClick={(payload) =>
                    handleOverviewBarClick(payload as unknown as ChartRow)
                  }
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
                  radius={[0, 0, 0, 0]}
                  maxBarSize={34}
                  onClick={(payload) =>
                    handleOverviewBarClick(payload as unknown as ChartRow)
                  }
                  style={{ cursor: "pointer" }}
                />

                <Bar
                  dataKey="latest_positive_diff"
                  name="Latest Risk Increased"
                  stackId="riskUp"
                  fill={COLORS.latestUp}
                  radius={[8, 8, 0, 0]}
                  maxBarSize={34}
                  onClick={(payload) =>
                    handleOverviewBarClick(payload as unknown as ChartRow)
                  }
                  style={{ cursor: "pointer" }}
                >
                  <LabelList
                    dataKey="latest_increase_label"
                    position="top"
                    formatter={(value: any) =>
                      value !== null && value !== undefined && Number(value) > 0
                        ? formatRisk(Number(value))
                        : ""
                    }
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
                  onClick={(payload) =>
                    handleOverviewBarClick(payload as unknown as ChartRow)
                  }
                  style={{ cursor: "pointer" }}
                >
                  <LabelList
                    dataKey="latest_equal_or_lower_label"
                    position="top"
                    formatter={(value: any) =>
                      value !== null && value !== undefined && Number(value) >= 0
                        ? formatRisk(Number(value))
                        : ""
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
    </section>
  );
};

export default AverageEnrollment;