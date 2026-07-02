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
  FiChevronDown,
  FiCheck,
  FiSearch,
  FiX,
  FiArrowLeft,
  FiCalendar,
  FiServer,
  FiActivity,
  FiBarChart2,
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

type ChartRow = {
  host: string;
  task_name: string;
  asset_label: string;
  axis_key: string;
  date: string;
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

const COMPONENT_MOBILE_BREAKPOINT = 560;
const COMPONENT_TABLET_BREAKPOINT = 900;
const COMPONENT_NOTEBOOK_BREAKPOINT = 1180;
const COMPONENT_LARGE_DESKTOP_BREAKPOINT = 1500;

const pad2 = (n: number) => String(n).padStart(2, "0");

const formatRisk = (value: number) => Number(value || 0).toFixed(2);

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

const getSafeTooltipTransform = ({
  coordinate,
  viewBox,
  tooltipWidth = 320,
  tooltipHeight = 292,
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

const getSummaryChartWidth = ({
  containerWidth,
  chartDataLength,
  summaryMode,
}: {
  containerWidth: number;
  chartDataLength: number;
  summaryMode: boolean;
}) => {
  if (!summaryMode) return "100%";

  const safeWidth = Math.max(320, Number(containerWidth || 0));
  const total = Math.max(1, chartDataLength);

  const perTargetWidth =
    safeWidth < COMPONENT_MOBILE_BREAKPOINT
      ? 96
      : safeWidth < COMPONENT_TABLET_BREAKPOINT
        ? 106
        : safeWidth < COMPONENT_NOTEBOOK_BREAKPOINT
          ? 118
          : safeWidth < COMPONENT_LARGE_DESKTOP_BREAKPOINT
            ? 128
            : 140;

  const minReadableWidth =
    safeWidth < COMPONENT_MOBILE_BREAKPOINT
      ? 640
      : safeWidth < COMPONENT_TABLET_BREAKPOINT
        ? 760
        : Math.max(880, safeWidth - 8);

  return Math.max(minReadableWidth, total * perTargetWidth);
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

const getRiskLabel = (
  score: number
): { key: "critical" | "high" | "medium" | "low" | "none"; color: string } => {
  if (score >= 9)  return { key: "critical", color: "#ef4444" };
  if (score >= 7)  return { key: "high",     color: "#f97316" };
  if (score >= 4)  return { key: "medium",   color: "#eab308" };
  if (score > 0)   return { key: "low",      color: "#22c55e" };
  return                   { key: "none",    color: "#94a3b8" };
};

const getVisibleTickIndexSet = (
  length: number,
  maxLabels: number
): Set<number> => {
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

type CustomTooltipProps = {
  active?: boolean;
  payload?: Array<{ payload: ChartRow }>;
  coordinate?: { x?: number; y?: number };
  viewBox?: { x?: number; y?: number; width?: number; height?: number };
};

const CustomTooltip: React.FC<CustomTooltipProps> = ({
  active,
  payload,
  coordinate,
  viewBox,
}) => {
  const { t } = useLanguage();

  if (!active || !payload || payload.length === 0) return null;

  const item = payload[0]?.payload;
  if (!item) return null;

  const diff = item.diff_risk_score ?? 0;
  const isUp = item.has_previous_record && diff > 0;
  const isDown = item.has_previous_record && diff < 0;

  const tooltipTransform = getSafeTooltipTransform({
    coordinate,
    viewBox,
    tooltipWidth: 320,
    tooltipHeight: 322,
  });

  return (
    <div
      style={{ transform: tooltipTransform }}
      className="pointer-events-none min-w-62.5 max-w-[320px] rounded-[18px] border border-gray-200/90 bg-white/95 px-3 py-2.5 shadow-[0_14px_32px_rgba(15,23,42,0.14)] backdrop-blur dark:border-white/10 dark:bg-[#0B1220]/95 dark:shadow-[0_14px_28px_rgba(0,0,0,0.32)]"
    >
      <div className="mb-2">
        <p className="text-[13px] font-semibold text-[#1f2240] wrap-anywhere dark:text-white/92">
          {item.task_name || t("graphCompare.unknownTask")}
        </p>

        <p className="mt-0.5 break-all text-[11px] text-gray-500 dark:text-white/45">
          {t("graphCompare.host")}: {item.host || "-"}
        </p>
      </div>

      <div className="space-y-1.5 text-[11px]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[#8B7CFF]">{t("graphCompare.previousRisk")}</span>
          <span className="font-semibold text-[#1f2240] dark:text-white/92">
            {item.has_previous_record
              ? formatRisk(item.previous_risk_score)
              : "-"}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className={isUp ? "text-[#FF6B88]" : "text-[#39C6F4]"}>
            {t("graphCompare.latestRisk")}
          </span>
          <span className="font-semibold text-[#1f2240] dark:text-white/92">
            {formatRisk(item.latest_risk_score)}
          </span>
        </div>

        <div className="h-px bg-gray-200 dark:bg-white/10" />

        <div className="grid grid-cols-1 gap-1.5">
          <div className="flex items-center justify-between gap-3 text-gray-600 dark:text-white/68">
            <span>{t("graphCompare.targetName")}</span>
            <span className="text-right font-medium wrap-anywhere">
              {item.task_name || "-"}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 text-gray-600 dark:text-white/68">
            <span>{t("graphCompare.host")}</span>
            <span className="break-all text-right font-medium">
              {item.host || "-"}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 text-gray-600 dark:text-white/68">
            <span>{t("graphCompare.latestTotal")}</span>
            <span className="text-right font-semibold text-[#1f2240] dark:text-white/90">
              {item.latest_total ?? 0}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 text-gray-600 dark:text-white/68">
            <span>{t("graphCompare.previousTotal")}</span>
            <span className="text-right font-semibold text-[#1f2240] dark:text-white/90">
              {item.has_previous_record ? item.previous_total ?? 0 : "-"}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 text-gray-600 dark:text-white/68">
            <span>{t("graphCompare.latestTime")}</span>
            <span className="text-right font-medium">
              {formatUnixThai(item.latest_creation_time)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 text-gray-600 dark:text-white/68">
            <span>{t("graphCompare.previousTime")}</span>
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
            {t("graphCompare.riskChange")}:{" "}
            {item.has_previous_record
              ? `${diff > 0 ? "+" : ""}${formatRisk(diff)}`
              : "0.00"}
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
  const { t } = useLanguage();

  if (!active || !payload || payload.length === 0) return null;

  const item = payload[0]?.payload;
  if (!item) return null;

  const tooltipTransform = getSafeTooltipTransform({
    coordinate,
    viewBox,
    tooltipWidth: 340,
    tooltipHeight: 235,
  });

  return (
    <div
      style={{ transform: tooltipTransform }}
      className="pointer-events-none min-w-62.5 max-w-85 rounded-[18px] border border-gray-200/90 bg-white/95 px-3 py-2.5 shadow-[0_14px_32px_rgba(15,23,42,0.14)] backdrop-blur dark:border-white/10 dark:bg-[#0B1220]/95 dark:shadow-[0_14px_28px_rgba(0,0,0,0.32)]"
    >
      <div className="mb-2">
        <p className="text-[13px] font-semibold text-[#1f2240] wrap-anywhere dark:text-white/92">
          {item.task_name || "-"}
        </p>

        <p className="mt-0.5 text-[11px] text-gray-500 dark:text-white/45">
          {t("graphCompare.dateTime")}: {item.detected_date_label || "-"}
        </p>
      </div>

      <div className="space-y-1.5 text-[11px]">
        <div className="flex items-center justify-between gap-3">
          <span style={{ color: item.detail_color }}>{t("graphCompare.riskScore")}</span>
          <span className="font-semibold text-[#1f2240] dark:text-white/92">
            {formatRisk(item.risk_score)}
          </span>
        </div>

        <div className="h-px bg-gray-200 dark:bg-white/10" />

        <div className="grid grid-cols-1 gap-1.5">
          <div className="flex items-center justify-between gap-3 text-gray-600 dark:text-white/68">
            <span>{t("graphCompare.hostIp")}</span>
            <span className="break-all text-right font-medium">
              {item.host_ip || "-"}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 text-gray-600 dark:text-white/68">
            <span>{t("graphCompare.vulnerabilityTotal")}</span>
            <span className="text-right font-semibold text-[#1f2240] dark:text-white/90">
              {item.total ?? 0}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 text-gray-600 dark:text-white/68">
            <span>{t("severity.critical")}</span>
            <span className="text-right font-semibold text-[#1f2240] dark:text-white/90">
              {item.critical ?? 0}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 text-gray-600 dark:text-white/68">
            <span>{t("severity.high")}</span>
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

const MinimalLegend = ({ detailMode = false, avgRisk = 0 }: { detailMode?: boolean; avgRisk?: number }) => {
  const { t } = useLanguage();

  return (
    <div className="mt-2 flex flex-wrap items-center gap-4">
      {detailMode ? (
        <>
          <span className="flex items-center gap-1.5 text-[10.5px] text-slate-500 dark:text-white/35">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />{t("graphCompare.lowRisk")}
          </span>
          <span className="flex items-center gap-1.5 text-[10.5px] text-slate-500 dark:text-white/35">
            <span className="h-2 w-2 rounded-full bg-amber-400" />{t("graphCompare.mediumRisk")}
          </span>
          <span className="flex items-center gap-1.5 text-[10.5px] text-slate-500 dark:text-white/35">
            <span className="h-2 w-2 rounded-full bg-rose-400" />{t("graphCompare.highRisk")}
          </span>
          <span className="flex items-center gap-1.5 text-[10.5px] text-slate-400 dark:text-white/25">
            <span className="inline-block h-px w-4 border-t border-dashed border-slate-400 dark:border-white/30" />
            {t("graphCompare.avg")}: {avgRisk.toFixed(2)}
          </span>
        </>
      ) : (
        <>
          <span className="flex items-center gap-1.5 text-[10.5px] text-slate-500 dark:text-white/35">
            <span className="h-2 w-2 rounded-full bg-[#8B7CFF]" />{t("graphCompare.previousRisk")}
          </span>
          <span className="flex items-center gap-1.5 text-[10.5px] text-slate-500 dark:text-white/35">
            <span className="h-2 w-2 rounded-full bg-[#39C6F4]" />{t("graphCompare.latestRisk")}
          </span>
          <span className="flex items-center gap-1.5 text-[10.5px] text-slate-500 dark:text-white/35">
            <span className="h-2 w-2 rounded-full bg-[#FF6B88]" />{t("graphCompare.riskIncreased")}
          </span>
        </>
      )}
    </div>
  );
};

const index: React.FC = () => {
  const { t } = useLanguage();

  const translateSort = (option: SortType) =>
    option === "Latest Updated"
      ? t("graphCompare.sortLatestUpdated")
      : t("graphCompare.sortHighestLatestRisk");

  const translateViewMode = (option: ViewMode) =>
    option === "By Page"
      ? t("graphCompare.viewByPage")
      : t("graphCompare.viewSummary");

  const translateRange = (option: RangeKey) => {
    switch (option) {
      case "Today":
        return t("graphCompare.rangeToday");
      case "This Week":
        return t("graphCompare.rangeThisWeek");
      case "This Month":
        return t("graphCompare.rangeThisMonth");
      case "This Year":
        return t("graphCompare.rangeThisYear");
      case "Custom Range":
        return t("graphCompare.rangeCustom");
      default:
        return option;
    }
  };

  const sectionRef = useRef<HTMLElement | null>(null);

  const [containerWidth, setContainerWidth] = useState<number>(() => {
    if (typeof window === "undefined") return 1440;
    return window.innerWidth;
  });

  const [sortBy, setSortBy] = useState<SortType>("Latest Updated");
  const [viewMode, setViewMode] = useState<ViewMode>("Summary");
  const [range, setRange] = useState<RangeKey>("This Year");

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

  const [viewModeOpen, setViewModeOpen] = useState(false);
  const viewModeDropdownRef = useRef<HTMLDivElement | null>(null);

  const [sortOpen, setSortOpen] = useState(false);
  const sortDropdownRef = useRef<HTMLDivElement | null>(null);

  const [rangeOpen, setRangeOpen] = useState(false);
  const rangeDropdownRef = useRef<HTMLDivElement | null>(null);

  const todayYMD = useMemo(() => formatDateToYMD(new Date()), []);
  const sevenDaysAgoYMD = useMemo(
    () => formatDateToYMD(addDays(new Date(), -6)),
    []
  );

  const [startDate, setStartDate] = useState<string>(sevenDaysAgoYMD);
  const [endDate, setEndDate] = useState<string>(todayYMD);

  const [currentPage, setCurrentPage] = useState<number>(1);

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
    const element = sectionRef.current;
    if (!element || typeof ResizeObserver === "undefined") {
      if (typeof window !== "undefined") {
        const handleResize = () => setContainerWidth(window.innerWidth);
        handleResize();
        window.addEventListener("resize", handleResize);

        return () => window.removeEventListener("resize", handleResize);
      }

      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      const nextWidth = Math.floor(entry?.contentRect?.width || 0);

      if (nextWidth > 0) {
        setContainerWidth(nextWidth);
      }
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  const isMobile = containerWidth < COMPONENT_MOBILE_BREAKPOINT;
  const isTablet =
    containerWidth >= COMPONENT_MOBILE_BREAKPOINT &&
    containerWidth < COMPONENT_TABLET_BREAKPOINT;
  const isNotebook =
    containerWidth >= COMPONENT_TABLET_BREAKPOINT &&
    containerWidth < COMPONENT_NOTEBOOK_BREAKPOINT;
  const isLargeDesktop =
    containerWidth >= COMPONENT_LARGE_DESKTOP_BREAKPOINT;

  const chartHeight = useMemo(() => {
    if (isMobile) return 360;
    if (isTablet) return 390;
    return 420;
  }, [isMobile, isTablet]);

  const overviewPageSize = useMemo(() => {
    if (summaryMode) return Number.MAX_SAFE_INTEGER;
    if (isMobile) return 5;
    if (isTablet) return 6;
    if (isNotebook) return 8;
    if (isLargeDesktop) return 15;
    return 10;
  }, [summaryMode, isMobile, isTablet, isNotebook, isLargeDesktop]);

  const overviewMaxVisibleLabels = useMemo(() => {
    if (summaryMode) return Number.MAX_SAFE_INTEGER;
    if (isMobile) return 3;
    if (isTablet || isNotebook) return 5;
    return Number.MAX_SAFE_INTEGER;
  }, [summaryMode, isMobile, isTablet, isNotebook]);

  const detailMaxVisibleLabels = useMemo(() => {
    if (isMobile) return 3;
    if (isTablet || isNotebook) return 5;
    return Number.MAX_SAFE_INTEGER;
  }, [isMobile, isTablet, isNotebook]);

  const customRangeError = useMemo(() => {
    if (range !== "Custom Range") return "";

    if (!startDate || !endDate) {
      return t("graphCompare.selectBothDates");
    }

    if (startDate > endDate) {
      return t("graphCompare.startAfterEnd");
    }

    return "";
  }, [range, startDate, endDate, t]);

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
        viewModeDropdownRef.current &&
        !viewModeDropdownRef.current.contains(e.target as Node)
      ) {
        setViewModeOpen(false);
      }

      if (
        sortDropdownRef.current &&
        !sortDropdownRef.current.contains(e.target as Node)
      ) {
        setSortOpen(false);
      }

      if (
        rangeDropdownRef.current &&
        !rangeDropdownRef.current.contains(e.target as Node)
      ) {
        setRangeOpen(false);
      }
    };

    document.addEventListener("mousedown", onClickOutside);

    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const mappedRows = useMemo<ChartRow[]>(() => {
    return rows.map((item, index) => {
      const taskName = (item as any).task_name || "-";
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

      const isSingleNonZero =
        hasPreviousRecord &&
        ((previousRisk > 0 && latestRisk === 0) ||
          (latestRisk > 0 && previousRisk === 0));

      const isIncrease =
        hasPreviousRecord &&
        latestRisk > previousRisk &&
        !isSingleNonZero;

      const isEqual = hasPreviousRecord && latestRisk === previousRisk;

      const isEqualOrLower =
        !hasPreviousRecord ||
        latestRisk <= previousRisk ||
        isSingleNonZero;

      const diffRisk = hasPreviousRecord ? latestRisk - previousRisk : 0;
      const latestCreationTime = (item as any).latest_creation_time ?? null;

      return {
        host,
        task_name: taskName,
        asset_label: shortenTaskName(taskName),
        axis_key: `${shortenTaskName(taskName)}__AXIS__${host}__${index}`,
        date: formatUnixToYMD(latestCreationTime),
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
        latest_creation_time: latestCreationTime,
        previous_creation_time: hasPreviousRecord
          ? Number(rawPreviousCreationTime)
          : null,

        has_previous_record: hasPreviousRecord,

        previous_for_increase: isIncrease ? previousRisk : 0,

        previous_for_nonincrease:
          hasPreviousRecord && !isIncrease && !isEqual && !isSingleNonZero
            ? previousRisk
            : 0,

        latest_overlay_equal_or_lower: isSingleNonZero
          ? Math.max(previousRisk, latestRisk)
          : isEqualOrLower
            ? latestRisk
            : 0,

        latest_positive_diff: isIncrease ? latestRisk - previousRisk : 0,
        overlay_top_value: Math.max(previousRisk, latestRisk),

        latest_increase_label: isIncrease ? latestRisk : null,

        latest_equal_or_lower_label: isSingleNonZero
          ? Math.max(previousRisk, latestRisk)
          : isEqualOrLower
            ? latestRisk
            : null,
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

  const selectedFilteredRows = useMemo(() => {
    if (selectedKeys.length === 0) return mappedRows;

    const selectedSet = new Set(selectedKeys);

    return mappedRows.filter((row: ChartRow) =>
      selectedSet.has(`${row.task_name}__${row.host}`)
    );
  }, [mappedRows, selectedKeys]);

  const rangeFilteredRows = useMemo<ChartRow[]>(() => {
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

  const sortedChartRows = useMemo<ChartRow[]>(() => {
    const sorted = [...rangeFilteredRows];

    if (sortBy === "Highest Latest Risk") {
      sorted.sort(
        (a: ChartRow, b: ChartRow) =>
          b.latest_risk_score - a.latest_risk_score
      );
    } else {
      sorted.sort(
        (a: ChartRow, b: ChartRow) =>
          (b.latest_creation_time || 0) - (a.latest_creation_time || 0)
      );
    }

    return sorted;
  }, [rangeFilteredRows, sortBy]);

  const totalPages = useMemo(() => {
    if (summaryMode) return 1;

    const total = Math.ceil(sortedChartRows.length / overviewPageSize);
    return Math.max(1, total);
  }, [summaryMode, sortedChartRows.length, overviewPageSize]);

  const chartData = useMemo<ChartRow[]>(() => {
    if (summaryMode) return sortedChartRows;

    const start = (currentPage - 1) * overviewPageSize;
    const end = start + overviewPageSize;

    return sortedChartRows.slice(start, end);
  }, [summaryMode, sortedChartRows, currentPage, overviewPageSize]);

  const chartPixelWidth = useMemo(() => {
    return getSummaryChartWidth({
      containerWidth,
      chartDataLength: chartData.length,
      summaryMode,
    });
  }, [containerWidth, chartData.length, summaryMode]);

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
  ]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const summary = useMemo(() => {
    const totalAssets = rangeFilteredRows.length;

    const avgLatestRisk =
      totalAssets > 0
        ? rangeFilteredRows.reduce(
            (sum: number, item: ChartRow) =>
              sum + Number(item.latest_risk_score || 0),
            0
          ) / totalAssets
        : 0;

    const increasedCount = rangeFilteredRows.filter(
      (item: ChartRow) => item.has_previous_record && item.diff_risk_score > 0
    ).length;

    const decreasedCount = rangeFilteredRows.filter(
      (item: ChartRow) => item.has_previous_record && item.diff_risk_score < 0
    ).length;

    return {
      totalAssets,
      avgLatestRisk,
      increasedCount,
      decreasedCount,
    };
  }, [rangeFilteredRows]);

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
    if (detailMode) return 10;

    const values = chartData.map((item: ChartRow) => item.overlay_top_value || 0);
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
    if (selectedCount === 0) return t("graphCompare.targetFilter");

    if (selectedCount === 1) {
      const found = filterOptions.find(
        (x: FilterOption) => x.key === selectedKeys[0]
      );

      return found?.label || `1 ${t("graphCompare.selected")}`;
    }

    return `${selectedCount} ${t("graphCompare.selected")}`;
  }, [selectedCount, filterOptions, selectedKeys, t]);

  const pageNumbers = useMemo(() => {
    return buildPageNumbers(currentPage, totalPages);
  }, [currentPage, totalPages]);

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
    filteredOptions.every((opt: FilterOption) =>
      selectedKeys.includes(opt.key)
    );

  const handleOverviewBarClick = (payload?: any) => {
    const row = (payload?.payload ?? payload) as ChartRow | undefined;

    if (!row?.latest_task_id || row.latest_task_id === "-") return;

    void fetchDetailByTaskID(row.latest_task_id, row.task_name);
  };

  return (
    <section
      ref={sectionRef}
      className="rounded-xl border border-slate-200/70 bg-white p-4 h-full flex flex-col dark:border-white/8 dark:bg-[#0d0b1a]/80 sm:p-5"
    >
      <div className="flex h-full min-w-0 flex-col">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="grid min-w-0 grid-cols-1 gap-3">
            <div className="min-w-0">
              {detailMode ? (
                <div className="flex items-center gap-2.5">
                  <h2 className="text-[13px] font-bold text-slate-800 dark:text-white/90">
                    {t("dashboard.graphComparison")}
                    {detailTaskName ? ` · ${detailTaskName}` : ""}
                  </h2>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-[13px] font-bold text-slate-800 dark:text-white/90">
                    {t("dashboard.graphComparison")}
                  </h2>
                  <span className="rounded-full border border-slate-200/70 bg-slate-50 px-2.5 py-0.5 text-[10.5px] font-medium text-slate-500 dark:border-white/8 dark:bg-white/5 dark:text-white/40">
                    {loading ? t("common.loadingShort") : `${summary.totalAssets} targets`}
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
              <div className="flex w-full min-w-0 flex-col gap-2.5">
                <div className="grid min-w-0 grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4 min-[1600px]:flex min-[1600px]:justify-end">
                  <div
                    className="relative min-w-0 min-[1600px]:w-42"
                    ref={viewModeDropdownRef}
                  >
                  <button
                    type="button"
                    onClick={() => setViewModeOpen((prev) => !prev)}
                    className="flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border border-slate-200/70 bg-white px-3 text-[10.5px] font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/8"
                  >
                    <span className="truncate">{translateViewMode(viewMode)}</span>
                    <FiChevronDown className={`shrink-0 text-[11px] transition-transform ${viewModeOpen ? "rotate-180" : ""}`} />
                  </button>

                  {viewModeOpen && (
                    <div className="absolute left-0 z-50 mt-1.5 w-44 overflow-hidden rounded-xl border border-slate-200/80 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-[#0d0b1a]">
                      {VIEW_MODE_OPTIONS.map((option) => {
                        const checked = viewMode === option;
                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => { setViewMode(option); setViewModeOpen(false); }}
                            className={["flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] font-medium transition", checked ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300" : "text-slate-600 hover:bg-slate-50 dark:text-white/65 dark:hover:bg-white/5"].join(" ")}
                          >
                            <span>{translateViewMode(option)}</span>
                            {checked && <FiCheck className="text-[11px]" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                  <div
                    className="relative min-w-0 min-[1600px]:w-[20rem]"
                    ref={dropdownRef}
                  >
                  <button
                    type="button"
                    onClick={() => setOpen((prev: boolean) => !prev)}
                    className="flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border border-slate-200/70 bg-white px-3 text-[10.5px] font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/8"
                  >
                    <span className="min-w-0 truncate">{dropdownButtonLabel}</span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {selectedCount > 0 && (
                        <span className="inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full border border-blue-200 bg-blue-50 px-1 text-[9.5px] font-semibold text-blue-700 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-300">
                          {selectedCount}
                        </span>
                      )}
                      <FiChevronDown className={`text-[11px] transition-transform ${open ? "rotate-180" : ""}`} />
                    </div>
                  </button>

                  {open && (
                    <div className="absolute left-0 z-50 mt-1.5 w-full max-w-72 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xl dark:border-white/10 dark:bg-[#0d0b1a]">
                      <div className="border-b border-slate-100 p-2.5 dark:border-white/8">
                        <div className="flex items-center gap-2 rounded-lg border border-slate-200/70 bg-slate-50 px-2.5 dark:border-white/8 dark:bg-white/5">
                          <FiSearch className="shrink-0 text-[11px] text-slate-400 dark:text-white/35" />
                          <input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={t("dashboard.searchTarget")}
                            className="h-8 w-full bg-transparent text-[11px] text-slate-700 outline-none placeholder:text-slate-400 dark:text-white/75 dark:placeholder:text-white/30"
                          />
                          {searchQuery && (
                            <button type="button" onClick={() => setSearchQuery("")} className="shrink-0 text-slate-400 hover:text-slate-600 dark:text-white/35">
                              <FiX className="text-[11px]" />
                            </button>
                          )}
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <button type="button" onClick={handleSelectAllVisible} className="text-[10px] font-medium text-blue-500 hover:text-blue-600 dark:text-blue-400">
                            {allVisibleSelected ? t("common.unselectAll") : t("common.selectAll")}
                          </button>
                          <button type="button" onClick={clearAllSelections} className="text-[10px] font-medium text-slate-400 hover:text-slate-600 dark:text-white/35 dark:hover:text-white/55">
                            {t("common.clear")}
                          </button>
                        </div>
                      </div>
                      <div className="max-h-64 overflow-y-auto p-2">
                        {filteredOptions.length === 0 ? (
                          <p className="py-6 text-center text-[11px] text-slate-400 dark:text-white/35">{t("common.noResults")}</p>
                        ) : (
                          <div className="space-y-0.5">
                            {filteredOptions.map((option: FilterOption) => {
                              const checked = selectedKeys.includes(option.key);
                              return (
                                <button
                                  key={option.key}
                                  type="button"
                                  onClick={() => toggleSelect(option.key)}
                                  className={["flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition", checked ? "bg-blue-50 dark:bg-blue-500/10" : "hover:bg-slate-50 dark:hover:bg-white/5"].join(" ")}
                                >
                                  <span className={["flex h-4 w-4 shrink-0 items-center justify-center rounded border transition", checked ? "border-blue-500 bg-blue-500 text-white" : "border-slate-300 bg-white text-transparent dark:border-white/20 dark:bg-white/5"].join(" ")}>
                                    <FiCheck className="text-[9px]" />
                                  </span>
                                  <span className="min-w-0 flex-1 truncate text-[11px] text-slate-700 dark:text-white/75">{option.label}</span>
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
                    onClick={() => setSortOpen((prev) => !prev)}
                    className="flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border border-slate-200/70 bg-white px-3 text-[10.5px] font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/8"
                  >
                    <span className="truncate">{translateSort(sortBy)}</span>
                    <FiChevronDown className={`shrink-0 text-[11px] transition-transform ${sortOpen ? "rotate-180" : ""}`} />
                  </button>

                  {sortOpen && (
                    <div className="absolute left-0 z-50 mt-1.5 w-full min-w-52 overflow-hidden rounded-xl border border-slate-200/80 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-[#0d0b1a]">
                      {SORT_OPTIONS.map((option) => {
                        const checked = sortBy === option;
                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => { setSortBy(option); setSortOpen(false); }}
                            className={["flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] font-medium transition", checked ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300" : "text-slate-600 hover:bg-slate-50 dark:text-white/65 dark:hover:bg-white/5"].join(" ")}
                          >
                            <span>{translateSort(option)}</span>
                            {checked && <FiCheck className="text-[11px]" />}
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
                    onClick={() => setRangeOpen((prev) => !prev)}
                    className="flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border border-slate-200/70 bg-white px-3 text-[10.5px] font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/8"
                  >
                    <span className="flex min-w-0 items-center gap-1.5 truncate">
                      <FiCalendar className="shrink-0 text-[11px] text-blue-400" />
                      <span className="truncate">{translateRange(range)}</span>
                    </span>
                    <FiChevronDown className={`shrink-0 text-[11px] transition-transform ${rangeOpen ? "rotate-180" : ""}`} />
                  </button>

                  {rangeOpen && (
                    <div className="absolute right-0 z-50 mt-1.5 w-full min-w-60 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200/80 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-[#0d0b1a]">
                      {RANGE_OPTIONS.map((option) => {
                        const checked = range === option;
                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => { setRange(option); if (option !== "Custom Range") setRangeOpen(false); }}
                            className={["flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] font-medium transition", checked ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300" : "text-slate-600 hover:bg-slate-50 dark:text-white/65 dark:hover:bg-white/5"].join(" ")}
                          >
                            <span>{translateRange(option)}</span>
                            {checked && <FiCheck className="text-[11px]" />}
                          </button>
                        );
                      })}

                      {range === "Custom Range" && (
                        <div className="mt-1 border-t border-slate-100 p-2 dark:border-white/8">
                          <div className="grid grid-cols-1 gap-2">
                            <label className="text-[10px] font-medium text-slate-500 dark:text-white/40">
                              {t("common.startDate")}
                              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 h-8 w-full rounded-lg border border-slate-200/70 bg-white px-2 text-[11px] text-slate-700 outline-none focus:border-blue-300 dark:border-white/8 dark:bg-white/5 dark:text-white/80" />
                            </label>
                            <label className="text-[10px] font-medium text-slate-500 dark:text-white/40">
                              {t("common.endDate")}
                              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 h-8 w-full rounded-lg border border-slate-200/70 bg-white px-2 text-[11px] text-slate-700 outline-none focus:border-blue-300 dark:border-white/8 dark:bg-white/5 dark:text-white/80" />
                            </label>
                            {customRangeError && <p className="text-[10px] text-rose-500 dark:text-rose-300">{customRangeError}</p>}
                            <button type="button" disabled={Boolean(customRangeError)} onClick={() => setRangeOpen(false)} className={["h-8 rounded-lg text-[11px] font-semibold transition", customRangeError ? "cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-white/5 dark:text-white/25" : "bg-blue-500 text-white hover:bg-blue-600"].join(" ")}>
                              {t("common.apply")}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {refreshing && (
                  <div className="w-full text-right text-[10px] font-medium text-cyan-600 dark:text-cyan-300">
                    {t("graphCompare.refreshing")}
                  </div>
                )}
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
                  {t("common.back")}
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2.5">

            {/* ── Card 1 : Total Targets / Data Points ── */}
            <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-white/6 dark:bg-white/3">
              <div className="h-1 w-full bg-linear-to-r from-blue-400 to-blue-300 dark:from-blue-500 dark:to-blue-400" />
              <div className="px-4 py-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-white/30">
                    {detailMode ? t("graphCompare.dataPoints") : t("graphCompare.totalTargets")}
                  </p>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[15px] text-blue-500 dark:bg-blue-500/10 dark:text-blue-300">
                    <FiServer />
                  </span>
                </div>
                <p className="mt-3.5 text-[34px] font-black leading-none tracking-tight text-slate-900 dark:text-white">
                  {loading ? "—" : (detailMode ? detailRows.length : summary.totalAssets)}
                </p>
                <p className="mt-1.5 text-[9px] text-slate-400 dark:text-white/25">
                  {detailMode ? t("graphCompare.scanRecords") : t("graphCompare.monitoredAssets")}
                </p>
              </div>
            </div>

            {/* ── Card 2 : Avg Risk Score ── */}
            {(() => {
              const avgScore = detailMode ? detailAvgRisk : summary.avgLatestRisk;
              const { key: riskKey, color: labelColor } = getRiskLabel(avgScore);
              const riskLabel = t(`severity.${riskKey}` as const);
              return (
                <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-white/6 dark:bg-white/3">
                  <div className="h-1 w-full transition-all duration-500" style={{ background: `linear-gradient(to right, ${labelColor}, ${labelColor}88)` }} />
                  <div className="px-4 py-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-white/30">
                        {t("graphCompare.avgRiskScore")}
                      </p>
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[15px]"
                        style={{ color: labelColor, backgroundColor: `${labelColor}15` }}
                      >
                        <FiActivity />
                      </span>
                    </div>
                    <div className="mt-3.5 flex items-baseline gap-1.5 leading-none">
                      <span className="text-[34px] font-black tracking-tight" style={{ color: labelColor }}>
                        {formatRisk(avgScore)}
                      </span>
                      <span className="text-[34px] font-black tracking-tight" style={{ color: labelColor }}>{t("graphCompare.per10")}</span>
                    </div>
                    <span
                      className="mt-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                      style={{ backgroundColor: `${labelColor}12`, color: labelColor }}
                    >
                      {riskLabel}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* ── Card 3 : Risk Change / CVSS Range ── */}
            <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-white/6 dark:bg-white/3">
              <div className="h-1 w-full bg-linear-to-r from-slate-300 to-slate-200 dark:from-white/12 dark:to-white/6" />
              <div className="px-4 py-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-white/30">
                    {detailMode ? t("graphCompare.cvssRange") : t("graphCompare.riskChange")}
                  </p>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[15px] text-slate-500 dark:bg-white/10 dark:text-white/40">
                    <FiBarChart2 />
                  </span>
                </div>
                {detailMode ? (
                  <div className="mt-3.5">
                    <p className="text-[34px] font-black leading-none tracking-tight text-slate-900 dark:text-white">
                      {t("graphCompare.cvssScaleRange")}
                    </p>
                    <p className="mt-1.5 text-[9px] text-slate-400 dark:text-white/25">{t("graphCompare.cvssV31Scale")}</p>
                  </div>
                ) : (
                  <div className="mt-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 shrink-0 rounded-full bg-rose-400" />
                        <span className="text-[10px] text-slate-500 dark:text-white/35">{t("graphCompare.riskIncreased")}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MdTrendingUp className="text-[14px] text-rose-400" />
                        <span className="text-[22px] font-black leading-none text-slate-800 dark:text-white">
                          {loading ? "—" : summary.increasedCount}
                        </span>
                      </div>
                    </div>
                    <div className="h-px w-full bg-slate-100 dark:bg-white/6" />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                        <span className="text-[10px] text-slate-500 dark:text-white/35">{t("graphCompare.riskDecreased")}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MdTrendingDown className="text-[14px] text-emerald-400" />
                        <span className="text-[22px] font-black leading-none text-slate-800 dark:text-white">
                          {loading ? "—" : summary.decreasedCount}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

        <div className="min-h-90 flex min-w-0 flex-1 flex-col">
          {loading ? (
            <div
              style={{ height: chartHeight }}
              className="flex items-center justify-center text-[13px] text-gray-500 dark:text-white/55"
            >
              {t("common.loading")}
            </div>
          ) : detailLoading ? (
            <div
              style={{ height: chartHeight }}
              className="flex items-center justify-center text-[13px] text-gray-500 dark:text-white/55"
            >
              {t("common.loading")}
            </div>
          ) : detailMode ? (
            detailRows.length === 0 ? (
              <div
                style={{ height: chartHeight }}
                className="flex items-center justify-center text-[13px] text-gray-500 dark:text-white/55"
              >
                {t("dashboard.noData")}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={chartHeight} minWidth={0}>
                <BarChart
                  data={detailRows}
                  margin={{ top: 18, right: 8, left: 8, bottom: 22 }}
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
                      <DetailXAxisTick
                        visibleIndexSet={detailVisibleTickIndexSet}
                      />
                    }
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    height={82}
                    label={{
                      value: t("graphCompare.scanDate"),
                      position: "insideBottom",
                      offset: 2,
                      style: {
                        fill: isDarkMode() ? "rgba(255,255,255,0.30)" : "#94a3b8",
                        fontSize: 10,
                        fontWeight: 600,
                      },
                    }}
                  />

                  <YAxis
                    tick={{
                      fill: isDarkMode() ? COLORS.axisDark : COLORS.axisLight,
                      fontSize: 11,
                    }}
                    axisLine={false}
                    tickLine={false}
                    width={44}
                    domain={[0, 10]}
                    ticks={[0, 2, 4, 6, 8, 10]}
                    label={{
                      value: t("graphCompare.cvssScore"),
                      angle: -90,
                      position: "insideLeft",
                      offset: 14,
                      style: {
                        fill: isDarkMode() ? "rgba(255,255,255,0.30)" : "#94a3b8",
                        fontSize: 10,
                        fontWeight: 600,
                        textAnchor: "middle",
                      },
                    }}
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
                    stroke={
                      isDarkMode() ? COLORS.avgLineDark : COLORS.avgLineLight
                    }
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
                        fill: isDarkMode()
                          ? "rgba(255,255,255,0.86)"
                          : "#475467",
                        fontSize: 10,
                        fontWeight: 700,
                      }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )
          ) : chartData.length === 0 ? (
            <div
              style={{ height: chartHeight }}
              className="flex items-center justify-center text-[13px] text-gray-500 dark:text-white/55"
            >
              {t("dashboard.noData")}
            </div>
          ) : (
            <>
              <div
                className={[
                  "w-full min-w-0",
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
                  <ResponsiveContainer
                    width="100%"
                    height={chartHeight}
                    minWidth={0}
                  >
                    <BarChart
                      data={chartData}
                      margin={{ top: 18, right: 8, left: 8, bottom: 22 }}
                      barCategoryGap="14%"
                      barGap="-100%"
                    >
                      <CartesianGrid
                        stroke={
                          isDarkMode() ? COLORS.gridDark : COLORS.gridLight
                        }
                        strokeDasharray="3 3"
                        vertical={false}
                      />

                      <XAxis
                        dataKey="axis_key"
                        tick={
                          <CustomXAxisTick
                            visibleIndexSet={overviewVisibleTickIndexSet}
                          />
                        }
                        axisLine={false}
                        tickLine={false}
                        interval={0}
                        height={52}
                        label={{
                          value: t("graphCompare.targetName"),
                          position: "insideBottom",
                          offset: 2,
                          style: {
                            fill: isDarkMode() ? "rgba(255,255,255,0.30)" : "#94a3b8",
                            fontSize: 10,
                            fontWeight: 600,
                          },
                        }}
                      />

                      <YAxis
                        tick={{
                          fill: isDarkMode()
                            ? COLORS.axisDark
                            : COLORS.axisLight,
                          fontSize: 11,
                        }}
                        axisLine={false}
                        tickLine={false}
                        width={44}
                        domain={[0, maxRisk]}
                        ticks={yTicks}
                        label={{
                          value: t("graphCompare.cvssScore"),
                          angle: -90,
                          position: "insideLeft",
                          offset: 14,
                          style: {
                            fill: isDarkMode() ? "rgba(255,255,255,0.30)" : "#94a3b8",
                            fontSize: 10,
                            fontWeight: 600,
                            textAnchor: "middle",
                          },
                        }}
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
                        stroke={
                          isDarkMode()
                            ? COLORS.avgLineDark
                            : COLORS.avgLineLight
                        }
                        strokeDasharray="5 5"
                        ifOverflow="extendDomain"
                      />

                      <Bar
                        dataKey="previous_for_nonincrease"
                        name="Previous Risk"
                        fill={COLORS.previous}
                        radius={[8, 8, 0, 0]}
                        maxBarSize={34}
                        onClick={(payload: any) =>
                          handleOverviewBarClick(payload)
                        }
                        style={{ cursor: "pointer" }}
                      >
                        <LabelList
                          dataKey="previous_for_nonincrease"
                          position="top"
                          formatter={(value: any) =>
                            Number(value ?? 0) > 0
                              ? formatRisk(Number(value ?? 0))
                              : ""
                          }
                          style={{
                            fill: isDarkMode()
                              ? "rgba(255,255,255,0.78)"
                              : "#667085",
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
                        onClick={(payload: any) =>
                          handleOverviewBarClick(payload)
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
                        onClick={(payload: any) =>
                          handleOverviewBarClick(payload)
                        }
                        style={{ cursor: "pointer" }}
                      >
                        <LabelList
                          dataKey="latest_increase_label"
                          position="top"
                          formatter={(value: any) =>
                            value !== null && value !== undefined
                              ? formatRisk(Number(value ?? 0))
                              : ""
                          }
                          style={{
                            fill: isDarkMode()
                              ? "rgba(255,255,255,0.86)"
                              : "#BE123C",
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
                        onClick={(payload: any) =>
                          handleOverviewBarClick(payload)
                        }
                        style={{ cursor: "pointer" }}
                      >
                        <LabelList
                          dataKey="latest_equal_or_lower_label"
                          position="top"
                          formatter={(value: any) =>
                            value !== null && value !== undefined
                              ? formatRisk(Number(value ?? 0))
                              : ""
                          }
                          style={{
                            fill: isDarkMode()
                              ? "rgba(255,255,255,0.86)"
                              : "#0369A1",
                            fontSize: 10,
                            fontWeight: 700,
                          }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {!summaryMode && totalPages > 1 && (
                <div className="mt-3 flex flex-col gap-2 border-t border-gray-100 pt-3 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-[11px] text-gray-500 dark:text-white/45">
                    {t("graphCompare.showing")}{" "}
                    <span className="font-semibold text-gray-700 dark:text-white/75">
                      {chartData.length}
                    </span>{" "}
                    {t("common.of")}{" "}
                    <span className="font-semibold text-gray-700 dark:text-white/75">
                      {sortedChartRows.length}
                    </span>{" "}
                    {t("graphCompare.targets")}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className={["h-8 rounded-lg border px-3 text-[11px] font-medium transition", currentPage === 1 ? "cursor-not-allowed border-slate-200/70 bg-slate-100 text-slate-400 dark:border-white/8 dark:bg-white/5 dark:text-white/25" : "border-slate-200/70 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/8"].join(" ")}
                    >
                      {t("common.prev")}
                    </button>

                    {pageNumbers.map((page) => {
                      const active = page === currentPage;
                      return (
                        <button
                          key={page}
                          type="button"
                          onClick={() => setCurrentPage(page)}
                          className={["h-8 min-w-8 rounded-lg border px-2 text-[11px] font-semibold transition", active ? "border-blue-500 bg-blue-500 text-white" : "border-slate-200/70 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/8"].join(" ")}
                        >
                          {page}
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className={["h-8 rounded-lg border px-3 text-[11px] font-medium transition", currentPage === totalPages ? "cursor-not-allowed border-slate-200/70 bg-slate-100 text-slate-400 dark:border-white/8 dark:bg-white/5 dark:text-white/25" : "border-slate-200/70 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/8"].join(" ")}
                    >
                      {t("common.next")}
                    </button>
                  </div>
                </div>
              )}

              {summaryMode && (
                <div className="mt-3 border-t border-slate-100 pt-3 dark:border-white/8">
                  <p className="text-[10.5px] text-slate-400 dark:text-white/30">
                    {t("graphCompare.summaryModePrefix")}{" "}
                    <span className="font-semibold text-slate-600 dark:text-white/55">
                      {chartData.length}
                    </span>{" "}
                    {t("graphCompare.summaryModeSuffixChart")}
                  </p>
                  <MinimalLegend detailMode={detailMode} avgRisk={detailMode ? detailAvgRisk : summary.avgLatestRisk} />
                </div>
              )}

              {!summaryMode && !detailMode && (
                <MinimalLegend detailMode={false} avgRisk={summary.avgLatestRisk} />
              )}

              {detailMode && (
                <MinimalLegend detailMode avgRisk={detailAvgRisk} />
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default index;

