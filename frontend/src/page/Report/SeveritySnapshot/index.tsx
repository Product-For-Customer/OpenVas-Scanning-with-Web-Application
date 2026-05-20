import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  ListTaskVulnSummaryForReport,
  type TaskVulnSummaryForReportResponse,
} from "../../../services/report";

type SeveritySnapshotProps = {
  title?: string;
  totalLabel?: string;
  onReady?: (ready: boolean) => void;
  selectedTaskIDs?: string[];
  prefetchedRows?: TaskVulnSummaryForReportResponse[];
  prefetchedLoading?: boolean;
};

type SeverityKey = "Critical" | "High" | "Medium" | "Low" | "Info";

type SeverityChartRow = {
  name: SeverityKey;
  value: number;
  color: string;
  share: number;
};

const COLORS: Record<SeverityKey, string> = {
  Critical: "#ef4444",
  High: "#f97316",
  Medium: "#eab308",
  Low: "#22c55e",
  Info: "#3b82f6",
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

const safeNumber = (value: unknown): number => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const normalizeTaskIDs = (ids?: string[]): string[] => {
  if (!Array.isArray(ids)) return [];

  return ids
    .map((id) => String(id).trim())
    .filter((id) => id !== "");
};

const index: React.FC<SeveritySnapshotProps> = ({
  title = "Severity Snapshot",
  totalLabel = "Total Findings",
  onReady,
  selectedTaskIDs = [],
  prefetchedRows,
  prefetchedLoading = false,
}) => {
  const [rows, setRows] = useState<TaskVulnSummaryForReportResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [queryTaskIDs, setQueryTaskIDs] = useState<string[]>([]);
  const [taskMode, setTaskMode] = useState<"all" | "filtered">("all");

  const normalizedSelectedTaskIDs = useMemo(
    () => normalizeTaskIDs(selectedTaskIDs),
    [selectedTaskIDs]
  );

  const hasPrefetchedRows = Array.isArray(prefetchedRows);

  useEffect(() => {
    const parsed = readTaskIDsFromQuery();
    setQueryTaskIDs(parsed.ids);
    setTaskMode(parsed.mode);
  }, []);

  useEffect(() => {
    if (hasPrefetchedRows) {
      onReady?.(false);
      setRows(prefetchedRows ?? []);
      setLoading(Boolean(prefetchedLoading));
      onReady?.(!prefetchedLoading);
      return;
    }

    let alive = true;

    onReady?.(false);

    const loadData = async () => {
      try {
        setLoading(true);

        const response = await ListTaskVulnSummaryForReport();

        if (!alive) return;
        setRows(Array.isArray(response) ? response : []);
      } catch (error) {
        console.error("Failed to load ListTaskVulnSummary:", error);

        if (!alive) return;
        setRows([]);
      } finally {
        if (!alive) return;
        setLoading(false);
        onReady?.(true);
      }
    };

    loadData();

    return () => {
      alive = false;
    };
  }, [onReady, hasPrefetchedRows, prefetchedRows, prefetchedLoading]);

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

  const filteredRows = useMemo(() => {
    if (effectiveTaskMode === "all") {
      return rows;
    }

    if (effectiveTaskIDs.length === 0) {
      return rows;
    }

    const selected = new Set(effectiveTaskIDs.map((id) => String(id).trim()));

    return rows.filter((row) => selected.has(String(row.task_id).trim()));
  }, [rows, effectiveTaskIDs, effectiveTaskMode]);

  const chartData = useMemo<SeverityChartRow[]>(() => {
    let critical = 0;
    let high = 0;
    let medium = 0;
    let low = 0;
    let info = 0;

    for (const row of filteredRows) {
      critical += safeNumber(row.critical);
      high += safeNumber(row.high);
      medium += safeNumber(row.medium);
      low += safeNumber(row.low);
      info += safeNumber(row.info);
    }

    const raw: Omit<SeverityChartRow, "share">[] = [
      { name: "Critical", value: critical, color: COLORS.Critical },
      { name: "High", value: high, color: COLORS.High },
      { name: "Medium", value: medium, color: COLORS.Medium },
      { name: "Low", value: low, color: COLORS.Low },
      { name: "Info", value: info, color: COLORS.Info },
    ];

    const total = raw.reduce((sum, item) => sum + item.value, 0);

    return raw.map((item) => ({
      ...item,
      share: total > 0 ? Number(((item.value / total) * 100).toFixed(1)) : 0,
    }));
  }, [filteredRows]);

  const total = useMemo(() => {
    return chartData.reduce((sum, item) => sum + Number(item.value || 0), 0);
  }, [chartData]);

  const hasData = useMemo(() => {
    return chartData.some((item) => item.value > 0);
  }, [chartData]);

  const filteredTaskCount = useMemo(() => {
    return filteredRows.length;
  }, [filteredRows]);

  const tooltipFormatter = (
    value: number | string | undefined,
    name: string | undefined
  ): [string, string] => {
    return [Number(value ?? 0).toLocaleString(), name ?? ""];
  };

  return (
    <section className="border border-slate-300 bg-white">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[11.5px] font-semibold uppercase tracking-normal text-slate-500">
              Severity Distribution
            </p>

            <h3 className="mt-1 text-[18.5px] font-bold leading-[1.22] text-slate-900">
              {title}
            </h3>

            <p className="mt-1.5 text-[12.25px] leading-[1.45] text-slate-600">
              {effectiveTaskMode === "all"
                ? "Summary of findings by severity level based on the latest consolidated task assessment."
                : `Summary of findings by severity level for ${filteredTaskCount.toLocaleString()} selected task(s).`}
            </p>
          </div>

          <div className="border border-slate-300 bg-slate-50 px-3.5 py-2.5">
            <p className="text-[10.5px] font-semibold uppercase tracking-normal text-slate-500">
              {totalLabel}
            </p>

            <p className="mt-1 text-[25px] font-bold leading-none text-slate-900">
              {loading ? "..." : total.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 p-4">
        <div className="col-span-5">
          <div className="h-full border border-slate-200 bg-white p-3.5">
            <h4 className="text-[16px] font-semibold text-slate-900">
              Proportion by Severity
            </h4>

            <p className="mt-1.5 text-[12px] leading-[1.45] text-slate-600">
              Donut chart showing the proportional distribution of findings.
            </p>

            <div className="relative mt-3 h-47.5">
              <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center">
                <p className="text-[10px] font-semibold uppercase tracking-normal text-slate-500">
                  Total
                </p>

                <p className="mt-1 text-[22px] font-bold leading-none text-slate-900">
                  {loading ? "..." : total.toLocaleString()}
                </p>

                <p className="mt-1 text-[10px] text-slate-500">Findings</p>
              </div>

              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={42}
                    outerRadius={70}
                    paddingAngle={2}
                    stroke="#ffffff"
                    strokeWidth={2}
                    isAnimationActive={false}
                  >
                    {chartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>

                  <Tooltip formatter={tooltipFormatter} />
                </PieChart>
              </ResponsiveContainer>

              {!loading && !hasData && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-500">
                    No Data
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-span-7">
          <div className="h-full border border-slate-200 bg-white p-3.5">
            <h4 className="text-[16px] font-semibold text-slate-900">
              Findings Count by Severity
            </h4>

            <p className="mt-1.5 text-[12px] leading-[1.45] text-slate-600">
              Bar chart presenting the total number of findings in each severity
              category.
            </p>

            <div className="mt-3 h-47.5">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  barSize={24}
                  margin={{ top: 4, right: 8, left: -8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />

                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />

                  <YAxis
                    tick={{ fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    width={30}
                  />

                  <Tooltip formatter={tooltipFormatter} />

                  <Bar dataKey="value" name="Findings" radius={[3, 3, 0, 0]}>
                    {chartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="col-span-12">
          <div className="overflow-hidden border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-3.5 py-3">
              <h4 className="text-[16px] font-semibold text-slate-900">
                Severity Breakdown Table
              </h4>

              <p className="mt-1.5 text-[12px] leading-[1.45] text-slate-600">
                Detailed breakdown of severity counts and percentage share.
              </p>
            </div>

            <div className="grid grid-cols-[1.5fr_1fr_1fr] bg-slate-100 px-3.5 py-2.5 text-[12px] font-semibold text-slate-700">
              <div>Severity</div>
              <div className="text-right">Findings</div>
              <div className="text-right">Share</div>
            </div>

            <div className="divide-y divide-slate-200">
              {chartData.map((item) => (
                <div
                  key={item.name}
                  className="grid grid-cols-[1.5fr_1fr_1fr] px-3.5 py-2.5 text-[11.5px] text-slate-700"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />

                    <span>{item.name}</span>
                  </div>

                  <div className="text-right font-medium">
                    {item.value.toLocaleString()}
                  </div>

                  <div className="text-right text-slate-500">
                    {item.share.toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default index;