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

const SeveritySnapshot: React.FC<SeveritySnapshotProps> = ({
  title = "Severity Snapshot",
  totalLabel = "Total Findings",
  onReady,
}) => {
  const [rows, setRows] = useState<TaskVulnSummaryForReportResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
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
  }, [onReady]);

  const chartData = useMemo<SeverityChartRow[]>(() => {
    let critical = 0;
    let high = 0;
    let medium = 0;
    let low = 0;
    let info = 0;

    for (const row of rows) {
      critical += Number(row.critical || 0);
      high += Number(row.high || 0);
      medium += Number(row.medium || 0);
      low += Number(row.low || 0);
      info += Number(row.info || 0);
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
  }, [rows]);

  const total = useMemo(() => {
    return chartData.reduce((sum, item) => sum + Number(item.value || 0), 0);
  }, [chartData]);

  const hasData = useMemo(() => {
    return chartData.some((item) => item.value > 0);
  }, [chartData]);

  const tooltipFormatter = (
    value: number | string | undefined,
    name: string | undefined
  ): [string, string] => {
    return [Number(value ?? 0).toLocaleString(), name ?? ""];
  };

  return (
    <section className="border border-slate-300 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[8.5px] font-semibold uppercase tracking-normal text-slate-500">
              Severity Distribution
            </p>
            <h3 className="mt-1 text-[15px] font-bold leading-[1.2] text-slate-900">
              {title}
            </h3>
            <p className="mt-1 text-[10px] leading-normal text-slate-600">
              Summary of findings by severity level based on the latest
              consolidated task assessment.
            </p>
          </div>

          <div className="border border-slate-300 bg-slate-50 px-3 py-2">
            <p className="text-[8px] font-semibold uppercase tracking-normal text-slate-500">
              {totalLabel}
            </p>
            <p className="mt-1 text-[18px] font-bold leading-none text-slate-900">
              {loading ? "..." : total.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 p-4">
        <div className="col-span-5">
          <div className="h-full border border-slate-200 bg-white p-3">
            <h4 className="text-[12px] font-semibold text-slate-900">
              Proportion by Severity
            </h4>
            <p className="mt-1 text-[9.5px] leading-[1.45] text-slate-600">
              Donut chart showing the proportional distribution of findings.
            </p>

            <div className="relative mt-3 h-47.5">
              <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center">
                <p className="text-[8.5px] font-semibold uppercase tracking-normal text-slate-500">
                  Total
                </p>
                <p className="mt-1 text-[18px] font-bold leading-none text-slate-900">
                  {loading ? "..." : total.toLocaleString()}
                </p>
                <p className="mt-1 text-[8.5px] text-slate-500">Findings</p>
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
                  <div className="border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-500">
                    No Data
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-span-7">
          <div className="h-full border border-slate-200 bg-white p-3">
            <h4 className="text-[12px] font-semibold text-slate-900">
              Findings Count by Severity
            </h4>
            <p className="mt-1 text-[9.5px] leading-[1.45] text-slate-600">
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
                    tick={{ fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={28}
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
            <div className="border-b border-slate-200 px-3 py-3">
              <h4 className="text-[12px] font-semibold text-slate-900">
                Severity Breakdown Table
              </h4>
              <p className="mt-1 text-[9.5px] leading-[1.45] text-slate-600">
                Detailed breakdown of severity counts and percentage share.
              </p>
            </div>

            <div className="grid grid-cols-[1.5fr_1fr_1fr] bg-slate-100 px-3 py-2 text-[9px] font-semibold uppercase tracking-normal text-slate-600">
              <div>Severity</div>
              <div className="text-right">Count</div>
              <div className="text-right">Share</div>
            </div>

            {loading ? (
              <div className="px-3 py-4 text-[11px] text-slate-500">
                Loading...
              </div>
            ) : chartData.length === 0 ? (
              <div className="px-3 py-4 text-[11px] text-slate-500">
                No Data
              </div>
            ) : (
              chartData.map((item, index) => (
                <div
                  key={item.name}
                  className={`grid grid-cols-[1.5fr_1fr_1fr] items-center px-3 py-2.5 ${
                    index % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-[10.5px] text-slate-800">
                      {item.name}
                    </span>
                  </div>

                  <div className="text-right text-[10.5px] font-semibold text-slate-900">
                    {item.value.toLocaleString()}
                  </div>

                  <div className="text-right text-[10px] text-slate-600">
                    {item.share}%
                  </div>
                </div>
              ))
            )}

            {!loading && chartData.length > 0 && (
              <div className="grid grid-cols-[1.5fr_1fr_1fr] border-t border-slate-200 bg-slate-100 px-3 py-2.5">
                <div className="text-[10px] font-semibold uppercase tracking-normal text-slate-700">
                  Total
                </div>
                <div className="text-right text-[10.5px] font-bold text-slate-900">
                  {total.toLocaleString()}
                </div>
                <div className="text-right text-[10px] font-semibold text-slate-700">
                  100%
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default SeveritySnapshot;