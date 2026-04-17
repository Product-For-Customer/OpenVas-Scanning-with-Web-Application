import React, { useMemo, useEffect, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
  Tooltip,
  LabelList,
} from "recharts";
import { FiBarChart2, FiCpu, FiShield } from "react-icons/fi";
import { ListDataForReportVulnerabilityMonth } from "../../../services/report";

type MonthlyRiskRow = {
  month: string;
  monthNo: number;
  vulnerabilityCount: number;
  avgRiskScore: number;
};

type ReportVulnerabilityMonthResponse = {
  task_id: string;
  task_name: string;
  ip: string;
  month: string;
  month_no: number;
  vulnerability: number;
  risk_score: number;
};

type Section6MonthlyRiskReportProps = {
  onReady?: (ready: boolean) => void;
  selectedTaskIDs?: string[];
};

const currentYear = new Date().getFullYear();

const MONTHS: string[] = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const formatRiskScore = (value?: number) => {
  if (typeof value !== "number" || Number.isNaN(value)) return "0.00";
  return value.toFixed(2);
};

const formatCount = (value?: number) => {
  if (typeof value !== "number" || Number.isNaN(value)) return "0";
  return value.toLocaleString("en-US");
};

// จัดระดับสีใหม่ให้เหมาะกับคะแนนเต็ม 10
// 0 = no data
// 0.01 - <4 = low  -> green
// 4 - <7    = medium -> yellow
// 7 - <9    = high -> orange
// 9 - 10    = critical -> red
const getRiskLevel = (score: number) => {
  if (score >= 9) return "critical";
  if (score >= 7) return "high";
  if (score >= 4) return "medium";
  if (score > 0) return "low";
  return "none";
};

const getBarColor = (score: number) => {
  const level = getRiskLevel(score);

  switch (level) {
    case "critical":
      return "#dc2626"; // red
    case "high":
      return "#f97316"; // orange
    case "medium":
      return "#eab308"; // yellow
    case "low":
      return "#22c55e"; // green
    default:
      return "#cbd5e1"; // slate
  }
};

const getCardClasses = (score: number) => {
  const level = getRiskLevel(score);

  switch (level) {
    case "critical":
      return {
        wrapper: "border-red-200 bg-red-50",
        icon: "border-red-200 text-red-700",
        label: "text-red-700",
      };
    case "high":
      return {
        wrapper: "border-orange-200 bg-orange-50",
        icon: "border-orange-200 text-orange-700",
        label: "text-orange-700",
      };
    case "medium":
      return {
        wrapper: "border-yellow-200 bg-yellow-50",
        icon: "border-yellow-200 text-yellow-700",
        label: "text-yellow-700",
      };
    case "low":
      return {
        wrapper: "border-green-200 bg-green-50",
        icon: "border-green-200 text-green-700",
        label: "text-green-700",
      };
    default:
      return {
        wrapper: "border-slate-200 bg-slate-50",
        icon: "border-slate-200 text-slate-700",
        label: "text-slate-500",
      };
  }
};

const getTextRiskColor = (score: number) => {
  const level = getRiskLevel(score);

  switch (level) {
    case "critical":
      return "text-red-700";
    case "high":
      return "text-orange-700";
    case "medium":
      return "text-yellow-700";
    case "low":
      return "text-green-700";
    default:
      return "text-slate-700";
  }
};

type CustomTooltipProps = {
  active?: boolean;
  payload?: Array<{
    payload: MonthlyRiskRow;
    value: number;
  }>;
};

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;

  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div className="min-w-56 rounded-md border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
      <p className="text-[12px] font-semibold text-slate-900">
        {row.month} {currentYear}
      </p>

      <div className="mt-2 space-y-1.5 text-[11px]">
        <div>
          <span className="font-medium text-slate-700">Vulnerabilities:</span>{" "}
          <span className="text-slate-600">
            {formatCount(row.vulnerabilityCount)}
          </span>
        </div>

        <div>
          <span className="font-medium text-slate-700">AVG Risk Score:</span>{" "}
          <span
            className={`font-semibold ${getTextRiskColor(row.avgRiskScore)}`}
          >
            {formatRiskScore(row.avgRiskScore)}
          </span>
        </div>
      </div>
    </div>
  );
};

type RiskScoreLabelProps = {
  x?: number;
  y?: number;
  width?: number;
  value?: number;
};

const RiskScoreLabel: React.FC<RiskScoreLabelProps> = (props) => {
  const { x = 0, y = 0, width = 0, value } = props;

  if (typeof value !== "number" || Number.isNaN(value)) return null;

  return (
    <text
      x={x + width / 2}
      y={y - 6}
      fill="#0f172a"
      textAnchor="middle"
      fontSize={9}
      fontWeight={600}
    >
      {value.toFixed(2)}
    </text>
  );
};

const normalizeTaskIDs = (ids?: string[]): string[] => {
  if (!Array.isArray(ids)) return [];

  return ids
    .map((id) => String(id).trim())
    .filter((id) => id !== "");
};

const filterDataBySelectedTaskIDs = (
  apiData: ReportVulnerabilityMonthResponse[] | null,
  selectedTaskIDs: string[]
): ReportVulnerabilityMonthResponse[] => {
  if (!Array.isArray(apiData)) return [];

  if (!selectedTaskIDs.length) {
    return apiData;
  }

  const selectedSet = new Set(selectedTaskIDs.map((id) => String(id).trim()));

  return apiData.filter((item) =>
    selectedSet.has(String(item.task_id || "").trim())
  );
};

const normalizeMonthlyData = (
  apiData: ReportVulnerabilityMonthResponse[]
): MonthlyRiskRow[] => {
  const monthMap = new Map<
    number,
    {
      month: string;
      monthNo: number;
      vulnerabilityCount: number;
      totalRiskScore: number;
      riskScoreCount: number;
    }
  >();

  for (let i = 0; i < 12; i += 1) {
    monthMap.set(i + 1, {
      month: MONTHS[i],
      monthNo: i + 1,
      vulnerabilityCount: 0,
      totalRiskScore: 0,
      riskScoreCount: 0,
    });
  }

  apiData.forEach((item) => {
    const monthNo = Number(item.month_no);
    if (!Number.isFinite(monthNo) || monthNo < 1 || monthNo > 12) return;

    const current = monthMap.get(monthNo);
    if (!current) return;

    const vulnerability =
      typeof item.vulnerability === "number" && !Number.isNaN(item.vulnerability)
        ? item.vulnerability
        : 0;

    const riskScore =
      typeof item.risk_score === "number" && !Number.isNaN(item.risk_score)
        ? item.risk_score
        : 0;

    monthMap.set(monthNo, {
      month: String(item.month || "").trim() || MONTHS[monthNo - 1],
      monthNo,
      vulnerabilityCount: current.vulnerabilityCount + vulnerability,
      totalRiskScore: current.totalRiskScore + riskScore,
      riskScoreCount: current.riskScoreCount + 1,
    });
  });

  return Array.from(monthMap.values())
    .sort((a, b) => a.monthNo - b.monthNo)
    .map((item) => ({
      month: item.month,
      monthNo: item.monthNo,
      vulnerabilityCount: item.vulnerabilityCount,
      avgRiskScore:
        item.riskScoreCount > 0
          ? Number((item.totalRiskScore / item.riskScoreCount).toFixed(2))
          : 0,
    }));
};

const countUniqueAssets = (
  apiData: ReportVulnerabilityMonthResponse[]
): number => {
  const uniqueAssets = new Set<string>();

  apiData.forEach((item) => {
    const taskID = String(item.task_id || "").trim();
    const ip = String(item.ip || "").trim();

    if (taskID !== "" || ip !== "") {
      uniqueAssets.add(`${taskID}__${ip}`);
    }
  });

  return uniqueAssets.size;
};

const Section6MonthlyRiskReport: React.FC<Section6MonthlyRiskReportProps> = ({
  onReady,
  selectedTaskIDs = [],
}) => {
  const [apiData, setApiData] = useState<ReportVulnerabilityMonthResponse[] | null>(
    null
  );
  const [loading, setLoading] = useState<boolean>(true);

  const normalizedSelectedTaskIDs = useMemo(
    () => normalizeTaskIDs(selectedTaskIDs),
    [selectedTaskIDs]
  );

  useEffect(() => {
    let alive = true;

    const fetchMonthlyRisk = async () => {
      try {
        setLoading(true);
        onReady?.(false);

        const result = await ListDataForReportVulnerabilityMonth();

        if (!alive) return;
        setApiData(Array.isArray(result) ? result : []);
      } catch (error) {
        console.error("Failed to load monthly vulnerability report:", error);
        if (!alive) return;
        setApiData([]);
      } finally {
        if (!alive) return;
        setLoading(false);
        onReady?.(true);
      }
    };

    fetchMonthlyRisk();

    return () => {
      alive = false;
    };
  }, [onReady]);

  const filteredApiData = useMemo(() => {
    return filterDataBySelectedTaskIDs(apiData, normalizedSelectedTaskIDs);
  }, [apiData, normalizedSelectedTaskIDs]);

  const chartData = useMemo(() => {
    return normalizeMonthlyData(filteredApiData);
  }, [filteredApiData]);

  const totalDevice = useMemo(() => {
    return countUniqueAssets(filteredApiData);
  }, [filteredApiData]);

  const summary = useMemo(() => {
    const totalVulnerabilities = chartData.reduce(
      (sum, item) => sum + item.vulnerabilityCount,
      0
    );

    const nonZeroRiskMonths = chartData.filter((item) => item.avgRiskScore > 0);

    if (!nonZeroRiskMonths.length) {
      return {
        highestAvgRiskScore: 0,
        highestAvgRiskMonth: "-",
        totalVulnerabilities,
      };
    }

    const highestRow = nonZeroRiskMonths.reduce((prev, current) =>
      current.avgRiskScore > prev.avgRiskScore ? current : prev
    );

    return {
      highestAvgRiskScore: highestRow.avgRiskScore,
      highestAvgRiskMonth: highestRow.month,
      totalVulnerabilities,
    };
  }, [chartData]);

  const highestRiskCard = getCardClasses(summary.highestAvgRiskScore);

  return (
    <section
      style={{
        breakInside: "avoid-page",
        pageBreakInside: "avoid",
      }}
    >
      <div className="border border-slate-300 bg-white">
        <div className="border-b border-slate-200 px-3 py-3">
          <div className="grid grid-cols-3 gap-2.5">
            <div className="border border-slate-200 bg-slate-50 px-3 py-2.5">
              <div className="flex items-start gap-2.5">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700">
                  <FiCpu className="text-[13px]" />
                </span>

                <div>
                  <p className="text-[8.5px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Total Device
                  </p>
                  <p className="mt-0.5 text-[14px] font-semibold text-slate-900">
                    {formatCount(totalDevice)}
                  </p>
                </div>
              </div>
            </div>

            <div className={`border px-3 py-2.5 ${highestRiskCard.wrapper}`}>
              <div className="flex items-start gap-2.5">
                <span
                  className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-white ${highestRiskCard.icon}`}
                >
                  <FiBarChart2 className="text-[13px]" />
                </span>

                <div>
                  <p
                    className={`text-[8.5px] font-semibold uppercase tracking-[0.12em] ${highestRiskCard.label}`}
                  >
                    Highest AVG Risk (MAX 10.00)
                  </p>
                  <p className="mt-0.5 text-[14px] font-semibold">
                    <span className={getTextRiskColor(summary.highestAvgRiskScore)}>
                      {formatRiskScore(summary.highestAvgRiskScore)}
                    </span>
                    <span className="mx-1 text-slate-400">-</span>
                    <span className="font-medium text-slate-600 text-[12px]">
                      {summary.highestAvgRiskMonth === "-"
                        ? "No month data"
                        : `${summary.highestAvgRiskMonth} ${currentYear}`}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <div className="border border-sky-200 bg-sky-50 px-3 py-2.5">
              <div className="flex items-start gap-2.5">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-sky-200 bg-white text-sky-700">
                  <FiShield className="text-[13px]" />
                </span>

                <div>
                  <p className="text-[8.5px] font-semibold uppercase tracking-[0.12em] text-sky-700">
                    Total Vulnerabilities
                  </p>
                  <p className="mt-0.5 text-[14px] font-semibold text-slate-900">
                    {formatCount(summary.totalVulnerabilities)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-3 py-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Monthly AVG Risk Score Trend
            </p>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-medium text-slate-600">
              Year {currentYear}
            </span>
          </div>

          <div
            className="h-44 w-full"
            style={{
              breakInside: "avoid-page",
              pageBreakInside: "avoid",
            }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 18, right: 8, left: 2, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 9, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={{ stroke: "#cbd5e1" }}
                />
                <YAxis
                  domain={[0, 10]}
                  tick={{ fontSize: 9, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={{ stroke: "#cbd5e1" }}
                  width={34}
                  tickMargin={6}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="avgRiskScore" radius={[4, 4, 0, 0]} maxBarSize={24}>
                  <LabelList dataKey="avgRiskScore" content={<RiskScoreLabel />} />
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${entry.monthNo}-${index}`}
                      fill={getBarColor(entry.avgRiskScore)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="border-t border-slate-200 px-3 py-3">
          <div
            className="overflow-hidden rounded-md border border-slate-200"
            style={{
              breakInside: "avoid-page",
              pageBreakInside: "avoid",
            }}
          >
            <table className="w-full border-collapse">
              <thead className="bg-slate-50">
                <tr>
                  <th className="border-b border-slate-200 px-3 py-2 text-left text-[9px] font-semibold uppercase tracking-widest text-slate-600">
                    Month
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 text-center text-[9px] font-semibold uppercase tracking-widest text-slate-600">
                    Vulnerabilities
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 text-center text-[9px] font-semibold uppercase tracking-widest text-slate-600">
                    AVG Risk Score
                  </th>
                </tr>
              </thead>

              <tbody>
                {chartData.map((row) => (
                  <tr
                    key={row.monthNo}
                    className="odd:bg-white even:bg-slate-50/50"
                  >
                    <td className="border-b border-slate-200 px-3 py-2 text-[10.5px] font-medium text-slate-900">
                      {row.month}
                    </td>
                    <td className="border-b border-slate-200 px-3 py-2 text-center text-[10.5px] text-slate-700">
                      {loading ? "0" : formatCount(row.vulnerabilityCount)}
                    </td>
                    <td
                      className={`border-b border-slate-200 px-3 py-2 text-center text-[10.5px] font-semibold ${loading ? "text-slate-900" : getTextRiskColor(row.avgRiskScore)
                        }`}
                    >
                      {loading ? "0.00" : formatRiskScore(row.avgRiskScore)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-2 text-[10px] leading-4.5 text-slate-500">
            Note: This section presents the monthly AVG risk score together
            with the corresponding vulnerability counts observed in each month.
          </p>
        </div>
      </div>
    </section>
  );
};

export default Section6MonthlyRiskReport;