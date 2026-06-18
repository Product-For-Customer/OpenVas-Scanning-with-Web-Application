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
  ReferenceLine,
} from "recharts";
import {
  FiChevronDown,
  FiCheck,
  FiSearch,
  FiCalendar,
  FiArrowLeft,
  FiX,
} from "react-icons/fi";
import {
  ListTargetDiffer,
  ListALLReportByTaskID,
  type TargetDifferDTO,
} from "../../../services";
import { useLanguage } from "../../../contexts/LanguageContext";

type SortType = "Latest Updated" | "Highest Latest Risk";

type ViewMode = "By Page" | "Summary";

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

type DetailRow = {
  taskID: string;
  taskName: string;
  axisKey: string;

  detectedRaw: string;
  detectedTimestamp: number;
  detectedDateLabel: string;
  detectedTickDate: string;
  detectedTickTime: string;

  host: string;
  riskScore: number;

  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
};

type FilterOption = {
  key: string;
  label: string;
};

type TooltipPositionProps = {
  coordinate?: { x?: number; y?: number };
  viewBox?: { x?: number; y?: number; width?: number; height?: number };
  tooltipWidth?: number;
  tooltipHeight?: number;
};

const SORT_OPTIONS: SortType[] = ["Latest Updated", "Highest Latest Risk"];

const VIEW_MODE_OPTIONS: ViewMode[] = ["By Page", "Summary"];

const RANGE_OPTIONS: RangeKey[] = [
  "Today",
  "This Week",
  "This Month",
  "This Year",
  "Custom Range",
];

const COLORS = {
  previousLine: "#8B7CFF",
  latestLine: "#39C6F4",
  riskLine: "#39C6F4",

  gridLight: "#E8ECF3",
  gridDark: "rgba(255,255,255,0.10)",

  axisLight: "#667085",
  axisDark: "rgba(255,255,255,0.72)",
  axisSubtleDark: "rgba(255,255,255,0.48)",

  avgLineLight: "#94A3B8",
  avgLineDark: "rgba(255,255,255,0.28)",
};

const MOBILE_BREAKPOINT = 640;
const IPAD_BREAKPOINT = 1280;
const LARGE_DESKTOP_BREAKPOINT = 1680;

const pad2 = (n: number) => String(n).padStart(2, "0");

const formatDateToYMD = (date: Date) => {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());

  return `${y}-${m}-${d}`;
};

const pickNumber = (obj: any, keys: string[], fallback = 0) => {
  for (const key of keys) {
    const value = obj?.[key];

    if (value !== null && value !== undefined && value !== "") {
      const num = Number(value);

      if (Number.isFinite(num)) return num;
    }
  }

  return fallback;
};

const pickString = (obj: any, keys: string[], fallback = "-") => {
  for (const key of keys) {
    const value = obj?.[key];

    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return String(value);
    }
  }

  return fallback;
};

const pickRaw = (obj: any, keys: string[]) => {
  for (const key of keys) {
    const value = obj?.[key];

    if (value !== null && value !== undefined && value !== "") {
      return value;
    }
  }

  return null;
};

const toDate = (value: unknown): Date | null => {
  if (value === null || value === undefined || value === "") return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;

    const date = value < 1e12 ? new Date(value * 1000) : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const str = String(value).trim();
  if (!str) return null;

  if (/^\d+$/.test(str)) {
    const num = Number(str);

    if (!Number.isFinite(num)) return null;

    const date = num < 1e12 ? new Date(num * 1000) : new Date(num);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(str);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toUnixSeconds = (value: unknown): number | null => {
  const date = toDate(value);
  if (!date) return null;

  return Math.floor(date.getTime() / 1000);
};

const formatAnyToYMD = (value: unknown) => {
  const date = toDate(value);
  if (!date) return "";

  return formatDateToYMD(date);
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

const formatDetectedDateLabel = (value: unknown) => {
  const date = toDate(value);

  if (!date) return "-";

  return new Intl.DateTimeFormat("th-TH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
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

const formatRisk = (value: number) => Number(value || 0).toFixed(2);

const formatInt = (value: number) => Number(value || 0).toLocaleString();

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

const isDateBetween = (targetYMD: string, startYMD: string, endYMD: string) => {
  if (!targetYMD || !startYMD || !endYMD) return false;

  return targetYMD >= startYMD && targetYMD <= endYMD;
};

const getSafeTooltipTransform = ({
  coordinate,
  viewBox,
  tooltipWidth = 304,
  tooltipHeight = 260,
}: TooltipPositionProps) => {
  const gap = 14;

  const currentX = Number(coordinate?.x ?? 0);
  const currentY = Number(coordinate?.y ?? 0);

  const chartLeft = Number(viewBox?.x ?? 0);
  const chartTop = Number(viewBox?.y ?? 0);
  const chartWidth = Number(viewBox?.width ?? 0);
  const chartHeight = Number(viewBox?.height ?? 0);

  const chartRight = chartLeft + chartWidth;
  const chartBottom = chartTop + chartHeight;

  const wouldOverflowRight = currentX + tooltipWidth + gap > chartRight;
  const wouldOverflowLeft = currentX - tooltipWidth - gap < chartLeft;
  const wouldOverflowTop = currentY - tooltipHeight - gap < chartTop;
  const wouldOverflowBottom = currentY + tooltipHeight + gap > chartBottom;

  let xTransform = `${gap}px`;
  let yTransform = `calc(-100% - ${gap}px)`;

  if (wouldOverflowRight && !wouldOverflowLeft) {
    xTransform = `calc(-100% - ${gap}px)`;
  }

  if (wouldOverflowTop) {
    yTransform = `${gap}px`;
  } else if (wouldOverflowBottom) {
    yTransform = `calc(-100% - ${gap}px)`;
  }

  return `translate(${xTransform}, ${yTransform})`;
};

const getVisibleTickIndexes = (length: number, maxLabels: number): number[] => {
  if (length <= 0) return [];
  if (maxLabels >= length) return Array.from({ length }, (_, i) => i);
  if (maxLabels <= 1) return [0];

  const indexes = new Set<number>();
  const lastIndex = length - 1;

  for (let i = 0; i < maxLabels; i += 1) {
    indexes.add(Math.round((i * lastIndex) / (maxLabels - 1)));
  }

  return Array.from(indexes).sort((a, b) => a - b);
};

const buildPageNumbers = (currentPage: number, totalPages: number): number[] => {
  if (totalPages <= 1) return [1];

  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  if (currentPage <= 3) return [1, 2, 3, 4, 5];

  if (currentPage >= totalPages - 2) {
    return [
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }

  return [
    currentPage - 2,
    currentPage - 1,
    currentPage,
    currentPage + 1,
    currentPage + 2,
  ];
};

const getSummaryChartWidth = ({
  screenWidth,
  chartDataLength,
  summaryMode,
}: {
  screenWidth: number;
  chartDataLength: number;
  summaryMode: boolean;
}) => {
  if (!summaryMode) return "100%";

  const safeWidth = Number.isFinite(screenWidth) ? screenWidth : 1440;
  const total = Math.max(1, chartDataLength);

  const perTargetWidth =
    safeWidth < MOBILE_BREAKPOINT
      ? 94
      : safeWidth < IPAD_BREAKPOINT
        ? 108
        : safeWidth < LARGE_DESKTOP_BREAKPOINT
          ? 124
          : 136;

  const minVisibleWidth =
    safeWidth < MOBILE_BREAKPOINT
      ? Math.max(680, safeWidth - 48)
      : Math.max(920, safeWidth - 120);

  return Math.max(minVisibleWidth, total * perTargetWidth);
};

const getAxisLabelBoxWidth = ({
  screenWidth,
  summaryMode,
}: {
  screenWidth: number;
  summaryMode: boolean;
}) => {
  if (summaryMode) {
    if (screenWidth < MOBILE_BREAKPOINT) return 78;
    if (screenWidth < IPAD_BREAKPOINT) return 94;
    if (screenWidth < LARGE_DESKTOP_BREAKPOINT) return 108;

    return 118;
  }

  if (screenWidth < MOBILE_BREAKPOINT) return 86;
  if (screenWidth < IPAD_BREAKPOINT) return 112;
  if (screenWidth < LARGE_DESKTOP_BREAKPOINT) return 132;

  return 150;
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

  const tooltipTransform = getSafeTooltipTransform({
    coordinate,
    viewBox,
    tooltipWidth: 304,
    tooltipHeight: 300,
  });

  return (
    <div
      style={{ transform: tooltipTransform }}
      className="pointer-events-none min-w-64 max-w-76 rounded-2xl border border-gray-200 bg-white px-2.5 py-2 shadow-[0_14px_34px_rgba(15,23,42,0.12)] dark:border-white/10 dark:bg-[#0B1220] dark:shadow-[0_14px_30px_rgba(0,0,0,0.30)]"
    >
      <div className="mb-2">
        <p className="wrap-break-word text-[11px] font-semibold text-[#1f2240] dark:text-white/92">
          {row.taskName || "-"}
        </p>

        <p className="mt-0.5 break-all text-[10px] text-gray-500 dark:text-white/45">
          Host: {row.host || "-"}
        </p>
      </div>

      <div className="space-y-1.5 text-[10px]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[#39C6F4]">Latest Risk</span>
          <span className="tabular-nums font-semibold text-[#1f2240] dark:text-white/92">
            {formatRisk(row.riskScore)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-[#8B7CFF]">Previous Risk</span>
          <span className="tabular-nums font-semibold text-[#1f2240] dark:text-white/92">
            {formatRisk(row.threatLevel)}
          </span>
        </div>

        <div className="h-px bg-gray-200 dark:bg-white/10" />

        <div className="flex items-center justify-between gap-3 text-gray-600 dark:text-white/68">
          <span>Latest Total Vulnerability</span>
          <span className="font-semibold text-[#1f2240] dark:text-white/90">
            {formatInt(row.latestTotal)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3 text-gray-600 dark:text-white/68">
          <span>Previous Total Vulnerability</span>
          <span className="font-semibold text-[#1f2240] dark:text-white/90">
            {formatInt(row.previousTotal)}
          </span>
        </div>

        <div className="h-px bg-gray-200 dark:bg-white/10" />

        <div className="flex items-center justify-between gap-3 text-gray-600 dark:text-white/68">
          <span>Latest Detected Time</span>
          <span className="text-right font-medium">
            {formatUnixToDateTime(row.latestDetectedTime)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3 text-gray-600 dark:text-white/68">
          <span>Previous Detected Time</span>
          <span className="text-right font-medium">
            {formatUnixToDateTime(row.previousDetectedTime)}
          </span>
        </div>
      </div>
    </div>
  );
};

type DetailTooltipProps = {
  active?: boolean;
  payload?: Array<{ payload: DetailRow }>;
  coordinate?: { x?: number; y?: number };
  viewBox?: { x?: number; y?: number; width?: number; height?: number };
};

const DetailTooltip: React.FC<DetailTooltipProps> = ({
  active,
  payload,
  coordinate,
  viewBox,
}) => {
  if (!active || !payload || !payload.length) return null;

  const row = payload?.[0]?.payload;
  if (!row) return null;

  const tooltipTransform = getSafeTooltipTransform({
    coordinate,
    viewBox,
    tooltipWidth: 304,
    tooltipHeight: 270,
  });

  return (
    <div
      style={{ transform: tooltipTransform }}
      className="pointer-events-none min-w-64 max-w-76 rounded-2xl border border-gray-200 bg-white px-3 py-2 shadow-[0_14px_34px_rgba(15,23,42,0.12)] dark:border-white/10 dark:bg-[#0B1220] dark:shadow-[0_14px_30px_rgba(0,0,0,0.30)]"
    >
      <div className="mb-2">
        <p className="wrap-break-word text-[11px] font-semibold text-[#1f2240] dark:text-white/92">
          {row.taskName || "-"}
        </p>

        <p className="mt-0.5 text-[10px] text-gray-500 dark:text-white/45">
          Date-Time: {row.detectedDateLabel || "-"}
        </p>
      </div>

      <div className="space-y-1.5 text-[10px]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[#39C6F4]">Risk Score</span>
          <span className="tabular-nums font-semibold text-[#1f2240] dark:text-white/92">
            {formatRisk(row.riskScore)}
          </span>
        </div>

        <div className="h-px bg-gray-200 dark:bg-white/10" />

        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          <span className="text-gray-600 dark:text-white/68">Total</span>
          <span className="text-right font-semibold text-[#1f2240] dark:text-white/92">
            {formatInt(row.total)}
          </span>

          <span className="text-gray-600 dark:text-white/68">Critical</span>
          <span className="text-right font-semibold text-rose-600 dark:text-rose-300">
            {formatInt(row.critical)}
          </span>

          <span className="text-gray-600 dark:text-white/68">High</span>
          <span className="text-right font-semibold text-orange-600 dark:text-orange-300">
            {formatInt(row.high)}
          </span>

          <span className="text-gray-600 dark:text-white/68">Medium</span>
          <span className="text-right font-semibold text-amber-600 dark:text-amber-300">
            {formatInt(row.medium)}
          </span>

          <span className="text-gray-600 dark:text-white/68">Low</span>
          <span className="text-right font-semibold text-emerald-600 dark:text-emerald-300">
            {formatInt(row.low)}
          </span>

          <span className="text-gray-600 dark:text-white/68">Info</span>
          <span className="text-right font-semibold text-sky-600 dark:text-sky-300">
            {formatInt(row.info)}
          </span>
        </div>

        <div className="h-px bg-gray-200 dark:bg-white/10" />

        <div className="flex items-center justify-between gap-3 text-gray-600 dark:text-white/68">
          <span>Host IP</span>
          <span className="break-all text-right font-medium">
            {row.host || "-"}
          </span>
        </div>
      </div>
    </div>
  );
};

const ClickableDot = (props: any) => {
  const { cx, cy, payload, stroke, fill, active = false, onOpen } = props;

  if (cx === undefined || cy === undefined || !payload) return null;

  const radius = active ? 5.5 : 3.8;

  return (
    <circle
      cx={cx}
      cy={cy}
      r={radius}
      fill={fill || "#ffffff"}
      stroke={stroke || COLORS.latestLine}
      strokeWidth={active ? 3 : 2.4}
      className="cursor-pointer transition"
      style={{ pointerEvents: "auto" }}
      onClick={(e) => {
        e.stopPropagation();
        onOpen?.(payload);
      }}
    />
  );
};

const CustomXAxisTick = (props: {
  x?: number;
  y?: number;
  payload?: { value?: string; index?: number };
  visibleIndexes?: number[];
  boxWidth?: number;
  fontSize?: number;
  onSelectAxisKey?: (axisKey: string) => void;
}) => {
  const {
    x = 0,
    y = 0,
    payload,
    visibleIndexes = [],
    boxWidth = 110,
    fontSize = 10,
    onSelectAxisKey,
  } = props;

  const rawValue = String(payload?.value || "");
  const tickIndex = Number(payload?.index ?? -1);
  const dark = isDarkMode();

  if (!visibleIndexes.includes(tickIndex)) return null;

  const fullLabel = rawValue.includes("__AXIS__")
    ? rawValue.split("__AXIS__")[0]
    : rawValue;

  const labelColor = dark ? COLORS.axisSubtleDark : COLORS.axisLight;

  return (
    <g transform={`translate(${x},${y})`}>
      <foreignObject
        x={-(boxWidth / 2)}
        y={4}
        width={boxWidth}
        height={38}
        style={{
          overflow: "hidden",
          pointerEvents: "auto",
        }}
      >
        <div
          title={fullLabel}
          onClick={(e) => {
            e.stopPropagation();
            onSelectAxisKey?.(rawValue);
          }}
          style={{
            width: "100%",
            maxWidth: `${boxWidth}px`,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            textAlign: "center",
            color: labelColor,
            fontSize: `${fontSize}px`,
            fontWeight: 600,
            lineHeight: "18px",
            cursor: "pointer",
            userSelect: "none",
            padding: "0 4px",
          }}
        >
          {fullLabel}
        </div>
      </foreignObject>
    </g>
  );
};

const DetailXAxisTick = (props: {
  x?: number;
  y?: number;
  payload?: { value?: string; index?: number };
  visibleIndexes?: number[];
}) => {
  const { x = 0, y = 0, payload, visibleIndexes = [] } = props;
  const rawValue = String(payload?.value || "");
  const tickIndex = Number(payload?.index ?? -1);
  const dark = isDarkMode();

  if (!visibleIndexes.includes(tickIndex)) return null;

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

const RiskScoreGraph: React.FC = () => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [rawData, setRawData] = useState<TargetDifferDTO[]>([]);

  const [openQuery, setOpenQuery] = useState(false);
  const [querySearch, setQuerySearch] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  const [viewMode, setViewMode] = useState<ViewMode>("Summary");
  const [openViewMode, setOpenViewMode] = useState(false);

  const [sortBy, setSortBy] = useState<SortType>("Latest Updated");
  const [openSort, setOpenSort] = useState(false);

  const [range, setRange] = useState<RangeKey>("This Year");
  const [openRange, setOpenRange] = useState(false);

  const todayYMD = useMemo(() => formatDateToYMD(new Date()), []);
  const sevenDaysAgoYMD = useMemo(
    () => formatDateToYMD(addDays(new Date(), -6)),
    []
  );

  const [startDate, setStartDate] = useState<string>(sevenDaysAgoYMD);
  const [endDate, setEndDate] = useState<string>(todayYMD);

  const [currentPage, setCurrentPage] = useState<number>(1);

  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [detailRows, setDetailRows] = useState<DetailRow[]>([]);
  const [detailTaskID, setDetailTaskID] = useState<string>("");
  const [detailTaskName, setDetailTaskName] = useState<string>("");

  const [screenWidth, setScreenWidth] = useState<number>(() => {
    if (typeof window === "undefined") return 1440;
    return window.innerWidth;
  });

  const queryDropdownRef = useRef<HTMLDivElement | null>(null);
  const viewModeDropdownRef = useRef<HTMLDivElement | null>(null);
  const sortDropdownRef = useRef<HTMLDivElement | null>(null);
  const rangeDropdownRef = useRef<HTMLDivElement | null>(null);

  const hasFetchedRef = useRef(false);
  const isFetchingRef = useRef(false);
  const isMountedRef = useRef(false);

  const detailMode = detailTaskID !== "";
  const summaryMode = viewMode === "Summary";

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
  const isIPad =
    screenWidth >= MOBILE_BREAKPOINT && screenWidth < IPAD_BREAKPOINT;
  const isLargeDesktop = screenWidth >= LARGE_DESKTOP_BREAKPOINT;

  const chartHeight = useMemo(() => {
    if (isMobile) return 320;
    if (isIPad) return 360;
    if (isLargeDesktop) return 460;

    return 420;
  }, [isMobile, isIPad, isLargeDesktop]);

  const overviewPageSize = useMemo(() => {
    if (summaryMode) return Number.MAX_SAFE_INTEGER;
    if (isMobile) return 3;
    if (isIPad) return 5;
    if (isLargeDesktop) return 15;

    return 10;
  }, [summaryMode, isMobile, isIPad, isLargeDesktop]);

  const maxVisibleLabels = useMemo(() => {
    if (summaryMode) return Number.MAX_SAFE_INTEGER;
    if (isMobile) return 3;
    if (isIPad) return 5;

    return Number.MAX_SAFE_INTEGER;
  }, [summaryMode, isMobile, isIPad]);

  const detailMaxVisibleLabels = useMemo(() => {
    if (isMobile) return 3;
    if (isIPad) return 5;

    return Number.MAX_SAFE_INTEGER;
  }, [isMobile, isIPad]);

  const axisLabelBoxWidth = useMemo(() => {
    if (summaryMode) {
      if (screenWidth < MOBILE_BREAKPOINT) return 78;
      if (screenWidth < IPAD_BREAKPOINT) return 94;
      if (screenWidth < LARGE_DESKTOP_BREAKPOINT) return 108;

      return 118;
    }

    return getAxisLabelBoxWidth({ screenWidth, summaryMode });
  }, [screenWidth, summaryMode]);

  const axisTickFontSize = useMemo(() => {
    if (summaryMode && screenWidth < MOBILE_BREAKPOINT) return 9;
    if (summaryMode) return 10;
    if (isMobile) return 9;

    return 10;
  }, [isMobile, summaryMode, screenWidth]);

  const customRangeError = useMemo(() => {
    if (range !== "Custom Range") return "";

    if (!startDate || !endDate) {
      return "Please select both a start date and an end date.";
    }

    if (startDate > endDate) {
      return "The start date cannot be later than the end date.";
    }

    return "";
  }, [range, startDate, endDate]);

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

  const fetchDetailByTaskID = async (taskID: string, taskName?: string) => {
    if (!taskID || taskID === "-") return;

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
          const detectedTickDate = formatDetectedTickDate(detectedRaw);
          const detectedTickTime = formatDetectedTimeLabel(detectedRaw);
          const riskScore = clamp(
            pickNumber(item, ["risk_score", "riskScore", "risk", "RiskScore"]),
            0,
            10
          );

          return {
            taskID: String(item?.task_id ?? taskID),
            taskName: String(item?.task_name ?? taskName ?? "-"),
            axisKey: `${detectedTickDate}__TIME__${detectedTickTime}__AXIS__${index}`,

            detectedRaw: String(detectedRaw ?? ""),
            detectedTimestamp,
            detectedDateLabel: formatDetectedDateLabel(detectedRaw),
            detectedTickDate,
            detectedTickTime,

            host: pickString(item, ["host_ip", "host", "ip", "ip_address"], "-"),
            riskScore,

            total: pickNumber(item, [
              "total",
              "vulnerability_total",
              "latest_total",
              "vulnerability",
            ]),
            critical: pickNumber(item, ["critical", "Critical"]),
            high: pickNumber(item, ["high", "High"]),
            medium: pickNumber(item, ["medium", "Medium"]),
            low: pickNumber(item, ["low", "Low"]),
            info: pickNumber(item, ["info", "Info"]),
          };
        })
        .sort((a: DetailRow, b: DetailRow) => {
          return a.detectedTimestamp - b.detectedTimestamp;
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
        setOpenQuery(false);
      }

      if (
        viewModeDropdownRef.current &&
        !viewModeDropdownRef.current.contains(e.target as Node)
      ) {
        setOpenViewMode(false);
      }

      if (
        sortDropdownRef.current &&
        !sortDropdownRef.current.contains(e.target as Node)
      ) {
        setOpenSort(false);
      }

      if (
        rangeDropdownRef.current &&
        !rangeDropdownRef.current.contains(e.target as Node)
      ) {
        setOpenRange(false);
      }
    };

    document.addEventListener("mousedown", onClickOutside);

    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const mappedRows = useMemo<Row[]>(() => {
    return rawData.map((item, index) => {
      const src = item as any;

      const taskName = pickString(src, ["task_name", "taskName", "name"], "-");
      const host = pickString(src, ["host", "host_ip", "ip", "ip_address"], "-");
      const shortLabel = shortenTaskName(taskName);

      const latestTimeRaw = pickRaw(src, [
        "latest_creation_time",
        "latest_detected_time",
        "creation_time",
        "created_at",
        "detected_date",
        "detected_at",
      ]);

      const previousTimeRaw = pickRaw(src, [
        "previous_creation_time",
        "previous_detected_time",
      ]);

      const latestRisk = clamp(
        pickNumber(src, [
          "latest_risk_score",
          "latestRiskScore",
          "latest_risk",
          "risk_score",
          "riskScore",
          "risk",
          "RiskScore",
        ]),
        0,
        10
      );

      const previousRisk = clamp(
        pickNumber(src, [
          "previous_risk_score",
          "previousRiskScore",
          "previous_risk",
          "threat_level",
          "threatLevel",
          "previousRisk",
        ]),
        0,
        10
      );

      const latestTaskID = pickString(
        src,
        ["latest_task_id", "task_id", "taskID", "id"],
        "-"
      );

      const previousTaskID = pickString(
        src,
        ["previous_task_id", "task_id", "taskID", "id"],
        "-"
      );

      return {
        label: shortLabel,
        axisKey: `${shortLabel}__AXIS__${host}__${index}`,
        date: formatAnyToYMD(latestTimeRaw),
        host,
        taskName,

        latestTaskID,
        previousTaskID,

        latestDetectedTime: toUnixSeconds(latestTimeRaw),
        previousDetectedTime: toUnixSeconds(previousTimeRaw),

        latestTotal: pickNumber(src, [
          "latest_total",
          "vulnerability_total",
          "latest_vulnerability_total",
          "total",
        ]),
        previousTotal: pickNumber(src, [
          "previous_total",
          "previous_vulnerability_total",
        ]),

        riskScore: latestRisk,
        threatLevel: previousRisk,
      };
    });
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

  const selectedFilteredRows = useMemo<Row[]>(() => {
    if (selectedKeys.length === 0) return mappedRows;

    const selectedSet = new Set(selectedKeys);

    return mappedRows.filter((row) =>
      selectedSet.has(`${row.taskName}__${row.host}`)
    );
  }, [mappedRows, selectedKeys]);

  const rangeFilteredRows = useMemo<Row[]>(() => {
    const now = new Date();
    const today = formatDateToYMD(now);

    let filtered = [...selectedFilteredRows];

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
  }, [selectedFilteredRows, range, startDate, endDate]);

  const sortedRows = useMemo<Row[]>(() => {
    const sorted = [...rangeFilteredRows];

    if (sortBy === "Highest Latest Risk") {
      sorted.sort((a, b) => b.riskScore - a.riskScore);
      return sorted;
    }

    sorted.sort(
      (a, b) => (b.latestDetectedTime || 0) - (a.latestDetectedTime || 0)
    );

    return sorted;
  }, [rangeFilteredRows, sortBy]);

  const totalPages = useMemo(() => {
    if (summaryMode) return 1;

    const total = Math.ceil(sortedRows.length / overviewPageSize);

    return Math.max(1, total);
  }, [summaryMode, sortedRows.length, overviewPageSize]);

  const data = useMemo<Row[]>(() => {
    if (summaryMode) return sortedRows;

    const start = (currentPage - 1) * overviewPageSize;
    const end = start + overviewPageSize;

    return sortedRows.slice(start, end);
  }, [summaryMode, sortedRows, currentPage, overviewPageSize]);

  const chartRowMap = useMemo(() => {
    const map = new Map<string, Row>();

    for (const row of data) {
      map.set(row.axisKey, row);
    }

    return map;
  }, [data]);

  const pageNumbers = useMemo(() => {
    return buildPageNumbers(currentPage, totalPages);
  }, [currentPage, totalPages]);

  const visibleTickIndexes = useMemo(() => {
    return getVisibleTickIndexes(data.length, maxVisibleLabels);
  }, [data.length, maxVisibleLabels]);

  const detailVisibleTickIndexes = useMemo(() => {
    return getVisibleTickIndexes(detailRows.length, detailMaxVisibleLabels);
  }, [detailRows.length, detailMaxVisibleLabels]);

  const chartPixelWidth = useMemo(() => {
    return getSummaryChartWidth({
      screenWidth,
      chartDataLength: data.length,
      summaryMode,
    });
  }, [screenWidth, data.length, summaryMode]);

  const selectedCount = selectedKeys.length;

  const queryButtonLabel = useMemo(() => {
    if (selectedCount === 0) return "Target Filter";

    if (selectedCount === 1) {
      const found = filterOptions.find((x) => x.key === selectedKeys[0]);
      return found?.label || "1 selected";
    }

    return `${selectedCount} selected`;
  }, [selectedCount, filterOptions, selectedKeys]);

  const detailAverageRisk = useMemo(() => {
    if (detailRows.length === 0) return 0;

    return (
      detailRows.reduce(
        (sum: number, item: DetailRow) => sum + Number(item.riskScore || 0),
        0
      ) / detailRows.length
    );
  }, [detailRows]);

  const overviewAverageRisk = useMemo(() => {
    if (data.length === 0) return 0;

    return (
      data.reduce((sum: number, item: Row) => sum + Number(item.riskScore || 0), 0) /
      data.length
    );
  }, [data]);

  const totalTargets = rangeFilteredRows.length;

  useEffect(() => {
    setCurrentPage(1);
  }, [
    sortBy,
    viewMode,
    selectedKeys,
    range,
    startDate,
    endDate,
    overviewPageSize,
    detailMode,
  ]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

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

  const openDetailFromRow = (row?: Row | null) => {
    if (!row) return;

    const taskID =
      row.latestTaskID && row.latestTaskID !== "-"
        ? row.latestTaskID
        : row.previousTaskID;

    if (!taskID || taskID === "-") {
      console.warn(
        "Cannot open Risk Score Timeline because task_id is empty.",
        row
      );
      return;
    }

    void fetchDetailByTaskID(taskID, row.taskName);
  };

  const openDetailFromAxisKey = (axisKey: string) => {
    const row = chartRowMap.get(axisKey);
    openDetailFromRow(row);
  };

  const handleChartClick = (state: any) => {
    const row = state?.activePayload?.[0]?.payload as Row | undefined;
    openDetailFromRow(row);
  };

  const handleGraphicClick = (payload: any) => {
    const row = (payload?.payload ?? payload) as Row | undefined;
    openDetailFromRow(row);
  };

  const renderOverviewChart = () => {
    if (loading) {
      return (
        <div
          style={{ height: chartHeight }}
          className="flex items-center justify-center text-[13px] text-gray-500 dark:text-white/55"
        >
          Loading...
        </div>
      );
    }

    if (data.length === 0) {
      return (
        <div
          style={{ height: chartHeight }}
          className="flex items-center justify-center text-[13px] text-gray-500 dark:text-white/55"
        >
          {t("dashboard.noData")}
        </div>
      );
    }

    return (
      <div
        className={[
          "w-full",
          summaryMode
            ? "overflow-x-auto overflow-y-hidden pb-2"
            : "overflow-hidden",
        ].join(" ")}
      >
        <div
          style={{
            width: summaryMode ? chartPixelWidth : "100%",
            minWidth: summaryMode ? chartPixelWidth : "100%",
          }}
        >
          <ResponsiveContainer width="100%" height={chartHeight} minWidth={0}>
            <AreaChart
              data={data}
              margin={{
                top: 18,
                right: 18,
                left: isMobile ? -16 : -12,
                bottom: 6,
              }}
              onClick={handleChartClick}
              className="cursor-pointer"
            >
              <defs>
                <linearGradient
                  id="riskScorePreviousFill"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor={COLORS.previousLine}
                    stopOpacity={0.22}
                  />
                  <stop
                    offset="95%"
                    stopColor={COLORS.previousLine}
                    stopOpacity={0.02}
                  />
                </linearGradient>

                <linearGradient
                  id="riskScoreLatestFill"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor={COLORS.latestLine}
                    stopOpacity={0.28}
                  />
                  <stop
                    offset="95%"
                    stopColor={COLORS.latestLine}
                    stopOpacity={0.02}
                  />
                </linearGradient>
              </defs>

              <CartesianGrid
                stroke={isDarkMode() ? COLORS.gridDark : COLORS.gridLight}
                strokeDasharray="3 3"
                vertical={false}
              />

              <XAxis
                dataKey="axisKey"
                tick={
                  <CustomXAxisTick
                    visibleIndexes={visibleTickIndexes}
                    boxWidth={axisLabelBoxWidth}
                    fontSize={axisTickFontSize}
                    onSelectAxisKey={openDetailFromAxisKey}
                  />
                }
                axisLine={false}
                tickLine={false}
                interval={0}
                height={summaryMode ? 62 : 54}
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
                content={<CustomTooltip />}
                cursor={{
                  stroke: isDarkMode()
                    ? "rgba(255,255,255,0.08)"
                    : "rgba(148,163,184,0.35)",
                  strokeWidth: 1,
                }}
              />

              <ReferenceLine
                y={Number(overviewAverageRisk.toFixed(2))}
                stroke={isDarkMode() ? COLORS.avgLineDark : COLORS.avgLineLight}
                strokeDasharray="5 5"
                ifOverflow="extendDomain"
              />

              <Area
                type="monotone"
                dataKey="threatLevel"
                name="Previous Risk"
                stroke={COLORS.previousLine}
                strokeWidth={2}
                fill="url(#riskScorePreviousFill)"
                dot={(props: any) => (
                  <ClickableDot
                    {...props}
                    stroke={COLORS.previousLine}
                    fill="#ffffff"
                    onOpen={openDetailFromRow}
                  />
                )}
                activeDot={(props: any) => (
                  <ClickableDot
                    {...props}
                    active
                    stroke={COLORS.previousLine}
                    fill="#ffffff"
                    onOpen={openDetailFromRow}
                  />
                )}
                onClick={handleGraphicClick}
                isAnimationActive={false}
              />

              <Area
                type="monotone"
                dataKey="riskScore"
                name="Latest Risk"
                stroke={COLORS.latestLine}
                strokeWidth={2.5}
                fill="url(#riskScoreLatestFill)"
                dot={(props: any) => (
                  <ClickableDot
                    {...props}
                    stroke={COLORS.latestLine}
                    fill="#ffffff"
                    onOpen={openDetailFromRow}
                  />
                )}
                activeDot={(props: any) => (
                  <ClickableDot
                    {...props}
                    active
                    stroke={COLORS.latestLine}
                    fill="#ffffff"
                    onOpen={openDetailFromRow}
                  />
                )}
                onClick={handleGraphicClick}
                isAnimationActive={false}
              />

              <Line
                type="monotone"
                dataKey="threatLevel"
                stroke={COLORS.previousLine}
                strokeWidth={2}
                dot={false}
                activeDot={false}
                onClick={handleGraphicClick}
                isAnimationActive={false}
              />

              <Line
                type="monotone"
                dataKey="riskScore"
                stroke={COLORS.latestLine}
                strokeWidth={2.5}
                dot={false}
                activeDot={false}
                onClick={handleGraphicClick}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  const renderDetailChart = () => {
    if (detailLoading) {
      return (
        <div
          style={{ height: chartHeight }}
          className="flex items-center justify-center text-[13px] text-gray-500 dark:text-white/55"
        >
          Loading detail...
        </div>
      );
    }

    if (detailRows.length === 0) {
      return (
        <div
          style={{ height: chartHeight }}
          className="flex items-center justify-center text-[13px] text-gray-500 dark:text-white/55"
        >
          {t("dashboard.noData")}
        </div>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={chartHeight} minWidth={0}>
        <AreaChart
          data={detailRows}
          margin={{
            top: 18,
            right: 8,
            left: isMobile ? -16 : -12,
            bottom: 6,
          }}
        >
          <defs>
            <linearGradient
              id="riskScoreTimelineFill"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="5%" stopColor={COLORS.riskLine} stopOpacity={0.3} />
              <stop offset="95%" stopColor={COLORS.riskLine} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid
            stroke={isDarkMode() ? COLORS.gridDark : COLORS.gridLight}
            strokeDasharray="3 3"
            vertical={false}
          />

          <XAxis
            dataKey="axisKey"
            tick={<DetailXAxisTick visibleIndexes={detailVisibleTickIndexes} />}
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
              stroke: isDarkMode()
                ? "rgba(255,255,255,0.08)"
                : "rgba(148,163,184,0.35)",
              strokeWidth: 1,
            }}
          />

          <ReferenceLine
            y={Number(detailAverageRisk.toFixed(2))}
            stroke={isDarkMode() ? COLORS.avgLineDark : COLORS.avgLineLight}
            strokeDasharray="5 5"
            ifOverflow="extendDomain"
          />

          <Area
            type="monotone"
            dataKey="riskScore"
            name="Risk Score"
            stroke={COLORS.riskLine}
            strokeWidth={2.5}
            fill="url(#riskScoreTimelineFill)"
            dot={(props: any) => (
              <ClickableDot {...props} stroke={COLORS.riskLine} fill="#ffffff" />
            )}
            activeDot={(props: any) => (
              <ClickableDot
                {...props}
                active
                stroke={COLORS.riskLine}
                fill="#ffffff"
              />
            )}
            isAnimationActive={false}
          />

          <Line
            type="monotone"
            dataKey="riskScore"
            name="Risk Score"
            stroke={COLORS.riskLine}
            strokeWidth={2.5}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  };

  return (
    <section className="rounded-xl border border-slate-200/70 bg-white p-4 dark:border-white/8 dark:bg-[#0d0b1a]/80 sm:p-5">
      <div className="flex h-full min-w-0 flex-col">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="grid min-w-0 grid-cols-1 gap-3 min-[1600px]:grid-cols-[minmax(320px,1fr)_auto] min-[1600px]:items-start min-[1600px]:justify-between">
            <div className="min-w-0">
              {detailMode ? (
                <div className="flex items-center gap-2.5">
                  <h2 className="text-[13px] font-semibold text-slate-700 dark:text-white/80">
                    Risk Score Timeline
                    {detailTaskName ? ` · ${detailTaskName}` : ""}
                  </h2>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-[13px] font-semibold text-slate-700 dark:text-white/80">
                    {t("dashboard.graphComparison")}
                  </h2>
                  <span className="rounded-full border border-slate-200/70 bg-slate-50 px-2.5 py-0.5 text-[10.5px] font-medium text-slate-500 dark:border-white/8 dark:bg-white/5 dark:text-white/40">
                    {loading ? t("common.loadingShort") : `${totalTargets} targets`}
                  </span>
                  {summaryMode && (
                    <span className="rounded-full border border-slate-200/70 bg-slate-50 px-2.5 py-0.5 text-[10.5px] font-medium text-slate-500 dark:border-white/8 dark:bg-white/5 dark:text-white/40">
                      Summary
                    </span>
                  )}
                </div>
              )}
            </div>

            {!detailMode ? (
              <div className="flex w-full min-w-0 flex-col gap-2.5 min-[1600px]:w-auto">
                <div className="grid min-w-0 grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4 min-[1600px]:flex min-[1600px]:justify-end">
                  <div
                    className="relative min-w-0 min-[1600px]:w-42"
                    ref={viewModeDropdownRef}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenViewMode((prev) => !prev)}
                      className="flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border border-slate-200/70 bg-white px-3 text-[10.5px] font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/8"
                    >
                      <span className="truncate">{viewMode}</span>

                      <FiChevronDown
                        className={`text-[13px] transition-transform ${
                          openViewMode ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {openViewMode && (
                      <div className="absolute right-0 z-50 mt-1.5 w-full min-w-36 overflow-hidden rounded-xl border border-slate-200/80 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-[#0d0b1a]">
                        {VIEW_MODE_OPTIONS.map((item) => {
                          const active = viewMode === item;
                          return (
                            <button
                              key={item}
                              type="button"
                              onClick={() => { setViewMode(item); setOpenViewMode(false); }}
                              className={[
                                "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] font-medium transition",
                                active
                                  ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
                                  : "text-slate-600 hover:bg-slate-50 dark:text-white/65 dark:hover:bg-white/5",
                              ].join(" ")}
                            >
                              <span>{item}</span>
                              {active && <FiCheck className="text-[11px]" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div
                    className="relative min-w-0 min-[1600px]:w-[20rem]"
                    ref={queryDropdownRef}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenQuery((prev) => !prev)}
                      className="flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border border-slate-200/70 bg-white px-3 text-[10.5px] font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/8"
                    >
                      <span className="truncate">{queryButtonLabel}</span>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {selectedCount > 0 && (
                          <span className="inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full border border-blue-200 bg-blue-50 px-1 text-[9.5px] font-semibold text-blue-700 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-300">
                            {selectedCount}
                          </span>
                        )}
                        <FiChevronDown className={`text-[11px] transition-transform ${openQuery ? "rotate-180" : ""}`} />
                      </div>
                    </button>

                    {openQuery && (
                      <div className="absolute right-0 z-50 mt-1.5 w-full max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xl sm:min-w-72 dark:border-white/10 dark:bg-[#0d0b1a]">
                        <div className="border-b border-slate-100 p-2.5 dark:border-white/8">
                          <div className="flex items-center gap-2 rounded-lg border border-slate-200/70 bg-slate-50 px-2.5 dark:border-white/8 dark:bg-white/5">
                            <FiSearch className="shrink-0 text-[11px] text-slate-400 dark:text-white/35" />
                            <input
                              value={querySearch}
                              onChange={(e) => setQuerySearch(e.target.value)}
                              placeholder={t("dashboard.searchTarget")}
                              className="h-8 w-full bg-transparent text-[11px] text-slate-700 outline-none placeholder:text-slate-400 dark:text-white/75 dark:placeholder:text-white/30"
                            />
                            {querySearch && (
                              <button type="button" onClick={() => setQuerySearch("")} className="shrink-0 text-slate-400 hover:text-slate-600 dark:text-white/35 dark:hover:text-white/65">
                                <FiX className="text-[11px]" />
                              </button>
                            )}
                          </div>
                          <div className="mt-2 flex items-center justify-between">
                            <button type="button" onClick={handleSelectAllVisible} className="text-[10px] font-medium text-blue-500 hover:text-blue-600 dark:text-blue-400">
                              {allVisibleSelected ? t("common.unselectAll") : t("common.selectAll")}
                            </button>
                            {selectedCount > 0 && (
                              <button type="button" onClick={clearAllSelections} className="text-[10px] font-medium text-slate-400 hover:text-slate-600 dark:text-white/35 dark:hover:text-white/55">
                                {t("common.clear")}
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="max-h-64 overflow-y-auto p-2">
                          {filteredOptions.length === 0 ? (
                            <p className="py-6 text-center text-[11px] text-slate-400 dark:text-white/35">{t("common.noResults")}</p>
                          ) : (
                            <div className="space-y-0.5">
                              {filteredOptions.map((opt) => {
                                const checked = selectedKeys.includes(opt.key);
                                return (
                                  <button
                                    key={opt.key}
                                    type="button"
                                    onClick={() => toggleSelect(opt.key)}
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
                                    <span className="min-w-0 flex-1 truncate text-[11px] text-slate-700 dark:text-white/75">{opt.label}</span>
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
                    className="relative min-w-0 min-[1600px]:w-58"
                    ref={sortDropdownRef}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenSort((prev) => !prev)}
                      className="flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border border-slate-200/70 bg-white px-3 text-[10.5px] font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/8"
                    >
                      <span className="truncate">{sortBy}</span>
                      <FiChevronDown className={`text-[11px] transition-transform ${openSort ? "rotate-180" : ""}`} />
                    </button>

                    {openSort && (
                      <div className="absolute right-0 z-50 mt-1.5 w-full min-w-44 overflow-hidden rounded-xl border border-slate-200/80 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-[#0d0b1a]">
                        {SORT_OPTIONS.map((item) => {
                          const active = sortBy === item;
                          return (
                            <button
                              key={item}
                              type="button"
                              onClick={() => { setSortBy(item); setOpenSort(false); }}
                              className={[
                                "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] font-medium transition",
                                active
                                  ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
                                  : "text-slate-600 hover:bg-slate-50 dark:text-white/65 dark:hover:bg-white/5",
                              ].join(" ")}
                            >
                              <span>{item}</span>
                              {active && <FiCheck className="text-[11px]" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div
                    className="relative min-w-0 min-[1600px]:w-48"
                    ref={rangeDropdownRef}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenRange((prev) => !prev)}
                      className="flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border border-slate-200/70 bg-white px-3 text-[10.5px] font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/8"
                    >
                      <span className="flex min-w-0 items-center gap-1.5 truncate">
                        <FiCalendar className="shrink-0 text-[11px] text-blue-400" />
                        <span className="truncate">{range}</span>
                      </span>
                      <FiChevronDown className={`shrink-0 text-[11px] transition-transform ${openRange ? "rotate-180" : ""}`} />
                    </button>

                    {openRange && (
                      <div className="absolute right-0 z-50 mt-1.5 w-full min-w-60 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200/80 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-[#0d0b1a]">
                        {RANGE_OPTIONS.map((item) => {
                          const active = range === item;
                          return (
                            <button
                              key={item}
                              type="button"
                              onClick={() => { setRange(item); if (item !== "Custom Range") setOpenRange(false); }}
                              className={[
                                "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] font-medium transition",
                                active
                                  ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
                                  : "text-slate-600 hover:bg-slate-50 dark:text-white/65 dark:hover:bg-white/5",
                              ].join(" ")}
                            >
                              <span>{item}</span>
                              {active && <FiCheck className="text-[11px]" />}
                            </button>
                          );
                        })}

                        {range === "Custom Range" && (
                          <div className="mt-1 border-t border-slate-100 p-2 dark:border-white/8">
                            <div className="grid grid-cols-1 gap-2">
                              <label className="text-[10px] font-medium text-slate-500 dark:text-white/40">
                                Start Date
                                <input
                                  type="date"
                                  value={startDate}
                                  onChange={(e) => setStartDate(e.target.value)}
                                  className="mt-1 h-8 w-full rounded-lg border border-slate-200/70 bg-white px-2 text-[11px] text-slate-700 outline-none focus:border-blue-300 dark:border-white/8 dark:bg-white/5 dark:text-white/80"
                                />
                              </label>
                              <label className="text-[10px] font-medium text-slate-500 dark:text-white/40">
                                End Date
                                <input
                                  type="date"
                                  value={endDate}
                                  onChange={(e) => setEndDate(e.target.value)}
                                  className="mt-1 h-8 w-full rounded-lg border border-slate-200/70 bg-white px-2 text-[11px] text-slate-700 outline-none focus:border-blue-300 dark:border-white/8 dark:bg-white/5 dark:text-white/80"
                                />
                              </label>
                              {customRangeError && (
                                <p className="text-[10px] font-medium text-rose-500 dark:text-rose-300">{customRangeError}</p>
                              )}
                              <button
                                type="button"
                                disabled={Boolean(customRangeError)}
                                onClick={() => setOpenRange(false)}
                                className={[
                                  "h-8 rounded-lg text-[11px] font-semibold transition",
                                  customRangeError
                                    ? "cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-white/5 dark:text-white/25"
                                    : "bg-blue-500 text-white hover:bg-blue-600",
                                ].join(" ")}
                              >
                                Apply
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleBackToOverview}
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200/70 bg-white px-3 text-[10.5px] font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/8"
                >
                  <FiArrowLeft className="text-[11px]" />
                  Back
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            {!detailMode ? (
              <>
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

                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-slate-50 px-2.5 py-1 dark:border-white/10 dark:bg-white/5">
                  <span className="inline-block h-2 w-5 rounded-full border-t border-dashed border-slate-400" />
                  <span className="text-[11px] font-medium text-slate-600 dark:text-white/55">
                    Average Latest
                  </span>
                </div>

                {selectedCount > 0 && (
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/70 bg-emerald-50 px-2.5 py-1 dark:border-emerald-400/15 dark:bg-emerald-400/10">
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                      Filtered by {selectedCount} selected target
                      {selectedCount > 1 ? "s" : ""}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/70 bg-cyan-50 px-2.5 py-1 dark:border-cyan-400/15 dark:bg-cyan-400/10">
                  <span className="inline-block h-2 w-2 rounded-full bg-[#39C6F4]" />
                  <span className="text-[11px] font-medium text-cyan-700 dark:text-cyan-300">
                    Risk Score
                  </span>
                </div>

                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-slate-50 px-2.5 py-1 dark:border-white/10 dark:bg-white/5">
                  <span className="inline-block h-2 w-5 rounded-full border-t border-dashed border-slate-400" />
                  <span className="text-[11px] font-medium text-slate-600 dark:text-white/55">
                    Average Risk: {formatRisk(detailAverageRisk)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mt-3 min-h-80 min-w-0 flex-1">
          {detailMode ? renderDetailChart() : renderOverviewChart()}
        </div>

        {!detailMode && !summaryMode && totalPages > 1 && (
          <div className="mt-3 flex flex-col gap-2 border-t border-gray-100 pt-3 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-[11px] text-gray-500 dark:text-white/45">
              Showing{" "}
              <span className="font-semibold text-gray-700 dark:text-white/75">
                {data.length}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-gray-700 dark:text-white/75">
                {sortedRows.length}
              </span>{" "}
              targets
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                className={[
                  "h-8 rounded-xl px-3 text-[11px] font-semibold transition",
                  currentPage <= 1
                    ? "cursor-not-allowed bg-gray-100 text-gray-400 dark:bg-white/5 dark:text-white/30"
                    : "bg-white text-gray-600 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 dark:bg-white/6 dark:text-white/70 dark:ring-white/10 dark:hover:bg-white/10",
                ].join(" ")}
              >
                Prev
              </button>

              {pageNumbers.map((page) => {
                const active = page === currentPage;

                return (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={[
                      "h-8 min-w-8 rounded-xl px-2 text-[11px] font-semibold transition",
                      active
                        ? "bg-cyan-500 text-white shadow-sm"
                        : "bg-white text-gray-600 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 dark:bg-white/6 dark:text-white/70 dark:ring-white/10 dark:hover:bg-white/10",
                    ].join(" ")}
                  >
                    {page}
                  </button>
                );
              })}

              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() =>
                  setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                }
                className={[
                  "h-8 rounded-xl px-3 text-[11px] font-semibold transition",
                  currentPage >= totalPages
                    ? "cursor-not-allowed bg-gray-100 text-gray-400 dark:bg-white/5 dark:text-white/30"
                    : "bg-white text-gray-600 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 dark:bg-white/6 dark:text-white/70 dark:ring-white/10 dark:hover:bg-white/10",
                ].join(" ")}
              >
                Next
              </button>
            </div>
          </div>
        )}

        {!detailMode && summaryMode && (
          <div className="mt-3 border-t border-gray-100 pt-3 text-[11px] text-gray-500 dark:border-white/10 dark:text-white/45">
            Summary mode: showing{" "}
            <span className="font-semibold text-gray-700 dark:text-white/75">
              {totalTargets}
            </span>{" "}
            targets in one chart without pagination. Scroll horizontally to view
            all targets clearly.
          </div>
        )}

        <p className="mt-3 text-center text-[10.5px] text-slate-400 dark:text-white/25">
          Y axis = Risk Score · X axis = {detailMode ? "Date-Time" : "Target"}
        </p>
      </div>
    </section>
  );
};

export default RiskScoreGraph;