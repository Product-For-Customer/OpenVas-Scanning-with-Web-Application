import React, { useEffect, useMemo, useState } from "react";
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
import { FiCpu, FiTrendingUp } from "react-icons/fi";
import type { TargetDifferForReportDTO } from "../../../services/report";
import { ListTargetDifferForReport } from "../../../services/report";
import { useLanguage } from "../../../contexts/LanguageContext";

type ChartRow = {
  id: string;
  label: string;
  taskName: string;
  host: string;
  latestRisk: number;
  previousRisk: number;
  latestTotal: number;
  previousTotal: number;
  latestTime: number | null;
  previousTime: number | null;
};

type ComparisonReportProps = {
  onReady?: (ready: boolean) => void;
  selectedTaskIDs?: string[];
};

const clamp = (num: number, min: number, max: number) =>
  Math.max(min, Math.min(num, max));

const formatDateTime = (unix?: number | null) => {
  if (!unix) return "-";

  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(unix * 1000));
};

const shortenText = (value?: string, maxLength = 14) => {
  if (!value) return "-";
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}...`;
};

type CustomTooltipProps = {
  active?: boolean;
  payload?: Array<{ payload: ChartRow }>;
};

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  const { t } = useLanguage();

  if (!active || !payload || payload.length === 0) return null;

  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div className="min-w-55 rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
      <p className="text-[13.5px] font-semibold text-slate-900">
        {row.taskName}
      </p>

      <p className="mt-0.5 break-all text-[12px] text-slate-500">
        {t("comparison.deviceLabel")} {row.host || "-"}
      </p>

      <div className="my-2 h-px bg-slate-200" />

      <div className="space-y-1.5 text-[12.25px]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-slate-500">{t("comparison.latestRisk")}</span>
          <span className="font-semibold text-slate-900">
            {row.latestRisk.toFixed(2)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-slate-500">{t("comparison.previousRisk")}</span>
          <span className="font-semibold text-slate-900">
            {row.previousRisk.toFixed(2)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-slate-500">{t("comparison.latestTotal")}</span>
          <span className="font-medium text-slate-900">{row.latestTotal}</span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-slate-500">{t("comparison.previousTotal")}</span>
          <span className="font-medium text-slate-900">
            {row.previousTotal}
          </span>
        </div>

        <div className="flex items-start justify-between gap-3">
          <span className="text-slate-500">{t("comparison.latestScan")}</span>
          <span className="max-w-32.5 text-right font-medium text-slate-900">
            {formatDateTime(row.latestTime)}
          </span>
        </div>

        <div className="flex items-start justify-between gap-3">
          <span className="text-slate-500">{t("comparison.previousScan")}</span>
          <span className="max-w-32.5 text-right font-medium text-slate-900">
            {formatDateTime(row.previousTime)}
          </span>
        </div>
      </div>
    </div>
  );
};

const readTaskIDsFromQuery = (): { mode: "all" | "filtered"; ids: string[] } => {
  if (typeof window === "undefined") {
    return { mode: "all", ids: [] };
  }

  const searchParams = new URLSearchParams(window.location.search);
  const raw = (searchParams.get("task_id") || "").trim();

  if (!raw || raw.toUpperCase() === "ALL") {
    return { mode: "all", ids: [] };
  }

  const ids = raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "");

  if (ids.length === 0) {
    return { mode: "all", ids: [] };
  }

  return { mode: "filtered", ids };
};

const normalizeTaskIDs = (ids?: string[]): string[] => {
  if (!Array.isArray(ids)) return [];

  return ids
    .map((id) => String(id).trim())
    .filter((id) => id !== "");
};

const index: React.FC<ComparisonReportProps> = ({
  onReady,
  selectedTaskIDs = [],
}) => {
  const { t } = useLanguage();
  const [rawData, setRawData] = useState<TargetDifferForReportDTO[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [queryTaskIDs, setQueryTaskIDs] = useState<string[]>([]);
  const [taskMode, setTaskMode] = useState<"all" | "filtered">("all");

  const normalizedSelectedTaskIDs = useMemo(
    () => normalizeTaskIDs(selectedTaskIDs),
    [selectedTaskIDs]
  );

  useEffect(() => {
    const parsed = readTaskIDsFromQuery();
    setQueryTaskIDs(parsed.ids);
    setTaskMode(parsed.mode);
  }, []);

  const effectiveTaskMode = useMemo<"all" | "filtered">(() => {
    if (normalizedSelectedTaskIDs.length > 0) {
      return "filtered";
    }

    return taskMode;
  }, [normalizedSelectedTaskIDs, taskMode]);

  const effectiveTaskIDs = useMemo<string[]>(() => {
    if (normalizedSelectedTaskIDs.length > 0) {
      return normalizedSelectedTaskIDs;
    }

    return queryTaskIDs;
  }, [normalizedSelectedTaskIDs, queryTaskIDs]);

  useEffect(() => {
    let isMounted = true;

    onReady?.(false);

    const fetchData = async () => {
      setLoading(true);

      try {
        const result =
          effectiveTaskMode === "all"
            ? await ListTargetDifferForReport()
            : await ListTargetDifferForReport(effectiveTaskIDs);

        if (!isMounted) return;

        if (Array.isArray(result)) {
          setRawData(result);
        } else {
          setRawData([]);
        }
      } catch (error) {
        console.error("ListTargetDifferForReport error:", error);
        if (isMounted) setRawData([]);
      } finally {
        if (isMounted) {
          setLoading(false);
          onReady?.(true);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [onReady, effectiveTaskMode, effectiveTaskIDs]);

  const chartData = useMemo<ChartRow[]>(() => {
    return [...rawData]
      .map((item, index) => {
        const taskName = item.task_name || "-";
        const host = item.host || "-";
        const label = shortenText(taskName, 14);

        return {
          id: `${taskName}-${host}-${index}`,
          label,
          taskName,
          host,
          latestRisk: clamp(Number(item.latest_risk_score ?? 0), 0, 10),
          previousRisk: clamp(Number(item.previous_risk_score ?? 0), 0, 10),
          latestTotal: Number(item.latest_total ?? 0),
          previousTotal: Number(item.previous_total ?? 0),
          latestTime: item.latest_creation_time ?? null,
          previousTime: item.previous_creation_time ?? null,
        };
      })
      .sort((a, b) => {
        const latestRiskDiff = b.latestRisk - a.latestRisk;
        if (latestRiskDiff !== 0) return latestRiskDiff;

        const latestTotalDiff = b.latestTotal - a.latestTotal;
        if (latestTotalDiff !== 0) return latestTotalDiff;

        return (b.latestTime || 0) - (a.latestTime || 0);
      })
      .slice(0, 10);
  }, [rawData]);

  const highestLatestRisk = useMemo(() => {
    if (chartData.length === 0) return 0;
    return Math.max(...chartData.map((item) => item.latestRisk));
  }, [chartData]);

  const totalDevices = useMemo(() => {
    return chartData.length;
  }, [chartData]);

  if (loading) {
    return (
      <section
        style={{
          breakInside: "avoid-page",
          pageBreakInside: "avoid",
        }}
      >
        <div className="py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="h-16 animate-pulse rounded-md border border-slate-200 bg-slate-50" />
            <div className="h-16 animate-pulse rounded-md border border-slate-200 bg-slate-50" />
          </div>

          <div className="mt-3 h-52 animate-pulse rounded-md border border-slate-200 bg-slate-50" />
        </div>
      </section>
    );
  }

  if (chartData.length === 0) {
    return (
      <section
        style={{
          breakInside: "avoid-page",
          pageBreakInside: "avoid",
        }}
      >
        <div className="py-2">
          <p className="text-[14px] leading-6 text-slate-600">
            {t("comparison.noChartData")}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      style={{
        breakInside: "avoid-page",
        pageBreakInside: "avoid",
      }}
    >
      <div className="py-1">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700">
                <FiCpu className="text-[17px]" />
              </span>

              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {t("comparison.devicesLabel")}
                </p>

                <p className="mt-1 text-[19px] font-semibold text-slate-900">
                  {totalDevices}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-md border border-violet-200 bg-violet-50 px-3 py-3">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-violet-200 bg-white text-violet-700">
                <FiTrendingUp className="text-[17px]" />
              </span>

              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-700">
                  {t("comparison.highestLatestRisk")}
                </p>

                <p className="mt-1 text-[19px] font-semibold text-slate-900">
                  {highestLatestRisk.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-slate-600">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-4 rounded-full bg-violet-500" />
            <span>{t("comparison.latestRisk")}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="h-2.5 w-4 rounded-full bg-sky-400" />
            <span>{t("comparison.previousRisk")}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="h-2.5 w-4 rounded-full bg-violet-200" />
            <span>{t("comparison.riskArea")}</span>
          </div>
        </div>

        <div className="mt-2">
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 8, right: 14, left: 18, bottom: 12 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />

                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={{ stroke: "#cbd5e1" }}
                  interval={0}
                  height={36}
                />

                <YAxis
                  domain={[0, 10]}
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={{ stroke: "#cbd5e1" }}
                  width={44}
                  tickMargin={10}
                />

                <Tooltip content={<CustomTooltip />} />

                <Area
                  type="monotone"
                  dataKey="latestRisk"
                  stroke="#c4b5fd"
                  fill="#ede9fe"
                  strokeWidth={1.5}
                  fillOpacity={0.85}
                />

                <Line
                  type="monotone"
                  dataKey="latestRisk"
                  stroke="#8b5cf6"
                  strokeWidth={2.1}
                  dot={{ r: 2.2 }}
                  activeDot={{ r: 4 }}
                />

                <Line
                  type="monotone"
                  dataKey="previousRisk"
                  stroke="#38bdf8"
                  strokeWidth={1.9}
                  dot={{ r: 2.1 }}
                  activeDot={{ r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <p className="mt-2 text-[12.25px] leading-5 text-slate-500">
          {t("comparison.top10Note")}
        </p>
      </div>
    </section>
  );
};

export default index;