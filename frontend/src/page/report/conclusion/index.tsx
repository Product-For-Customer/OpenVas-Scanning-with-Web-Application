import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  LineChart,
  Line,
  PieChart,
  Pie,
  LabelList,
} from "recharts";
import {
  FiActivity,
  FiAlertTriangle,
  FiBarChart2,
  FiPieChart,
  FiShield,
  FiTarget,
  FiTrendingUp,
} from "react-icons/fi";
import {
  ListTaskVulnSummaryForReport,
  ListDeviceRiskForReport,
  ListCriticalForReport,
  type TaskVulnSummaryForReportResponse,
  type DeviceRiskForReportDTO,
  type CriticalForReportResponse,
} from "../../../services/report";

type ConclusionProps = {
  onReady?: (ready: boolean) => void;
};

type SeverityKey = "Critical" | "High" | "Medium" | "Low" | "Info";

type SeverityRow = {
  name: SeverityKey;
  value: number;
  color: string;
  share: number;
};

type DeviceTrendRow = {
  rank: string;
  rankNumber: number;
  target: string;
  ip: string;
  riskScore: number;
  vulnerabilities: number;
};

type MonthlyRiskRow = {
  month: string;
  vulnerabilityCount: number;
  riskScore: number;
};

const currentYear = 2026;

const monthlyMockData: MonthlyRiskRow[] = [
  { month: "Jan", vulnerabilityCount: 186, riskScore: 9.8 },
  { month: "Feb", vulnerabilityCount: 172, riskScore: 9.2 },
  { month: "Mar", vulnerabilityCount: 161, riskScore: 8.7 },
  { month: "Apr", vulnerabilityCount: 149, riskScore: 8.1 },
  { month: "May", vulnerabilityCount: 137, riskScore: 7.5 },
  { month: "Jun", vulnerabilityCount: 126, riskScore: 6.9 },
  { month: "Jul", vulnerabilityCount: 114, riskScore: 6.2 },
  { month: "Aug", vulnerabilityCount: 101, riskScore: 5.6 },
  { month: "Sep", vulnerabilityCount: 88, riskScore: 4.9 },
  { month: "Oct", vulnerabilityCount: 74, riskScore: 4.1 },
  { month: "Nov", vulnerabilityCount: 59, riskScore: 3.4 },
  { month: "Dec", vulnerabilityCount: 43, riskScore: 2.6 },
];

const SEVERITY_COLORS: Record<SeverityKey, string> = {
  Critical: "#e11d48",
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

const normalizeTaskId = (value?: string | number | null) => {
  return String(value ?? "").trim();
};

const normalizeText = (value?: string | null) => {
  const text = value?.trim();
  if (!text) return "";
  const lowered = text.toLowerCase();
  if (lowered === "n/a" || lowered === "null" || lowered === "undefined") {
    return "";
  }
  return text;
};

const formatNumber = (value?: number) => {
  if (typeof value !== "number" || Number.isNaN(value)) return "0";
  return value.toLocaleString("en-US");
};

const formatRiskScore = (value?: number) => {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return value.toFixed(2);
};

const formatDetectedDate = (detectedDate?: string) => {
  if (!detectedDate) return "-";

  const date = new Date(detectedDate);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const getDetectedDays = (detectedDate?: string) => {
  if (!detectedDate) return undefined;

  const detected = new Date(detectedDate);
  if (Number.isNaN(detected.getTime())) return undefined;

  const now = new Date();
  const diffMs = now.getTime() - detected.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return diffDays < 0 ? 0 : diffDays;
};

const getRiskTone = (score: number) => {
  if (score >= 9) {
    return {
      chipClass: "border-rose-200 bg-rose-50 text-rose-700",
      iconClass: "text-rose-700",
    };
  }

  if (score >= 7) {
    return {
      chipClass: "border-orange-200 bg-orange-50 text-orange-700",
      iconClass: "text-orange-700",
    };
  }

  if (score >= 4) {
    return {
      chipClass: "border-amber-200 bg-amber-50 text-amber-700",
      iconClass: "text-amber-700",
    };
  }

  return {
    chipClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
    iconClass: "text-emerald-700",
  };
};

const getMonthlyBarColor = (score: number) => {
  if (score >= 9) return "#dc2626";
  if (score >= 8) return "#ea580c";
  if (score >= 7) return "#f59e0b";
  if (score >= 6) return "#eab308";
  if (score >= 5) return "#84cc16";
  if (score >= 4) return "#22c55e";
  if (score >= 3) return "#14b8a6";
  return "#0ea5e9";
};

const RiskScoreLabel: React.FC<any> = (props) => {
  const { x, y, width, value } = props;

  if (typeof value !== "number" || Number.isNaN(value)) return null;

  return (
    <text
      x={x + width / 2}
      y={Math.max(y - 6, 12)}
      fill="#0f172a"
      textAnchor="middle"
      fontSize={9}
      fontWeight={600}
    >
      {value.toFixed(2)}
    </text>
  );
};

const sortDevicesByRiskDesc = (rows: DeviceRiskForReportDTO[]) => {
  return [...rows].sort((a, b) => {
    const riskA = Number(a.risk_score || 0);
    const riskB = Number(b.risk_score || 0);
    if (riskB !== riskA) return riskB - riskA;

    const vulnA = Number(a.vulnerability_total || 0);
    const vulnB = Number(b.vulnerability_total || 0);
    if (vulnB !== vulnA) return vulnB - vulnA;

    return String(a.task_name || "").localeCompare(String(b.task_name || ""));
  });
};

const Conclusion: React.FC<ConclusionProps> = ({ onReady }) => {
  const initialQuery = useMemo(() => readTaskIDsFromQuery(), []);

  const [summaryRows, setSummaryRows] = useState<TaskVulnSummaryForReportResponse[]>([]);
  const [deviceRows, setDeviceRows] = useState<DeviceRiskForReportDTO[]>([]);
  const [criticalRows, setCriticalRows] = useState<CriticalForReportResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [queryTaskIDs] = useState<string[]>(initialQuery.ids);
  const [taskMode] = useState<"all" | "filtered">(initialQuery.mode);

  const selectedTaskIdSet = useMemo(() => {
    return new Set(queryTaskIDs.map((id) => normalizeTaskId(id)));
  }, [queryTaskIDs]);

  useEffect(() => {
    let alive = true;

    onReady?.(false);

    const loadData = async () => {
      try {
        setLoading(true);

        const requestTaskIds =
          taskMode === "all" || queryTaskIDs.length === 0 ? undefined : queryTaskIDs;

        const [summaryResponse, deviceResponse, criticalResponse] = await Promise.all([
          ListTaskVulnSummaryForReport(requestTaskIds),
          ListDeviceRiskForReport(requestTaskIds),
          ListCriticalForReport(requestTaskIds, 50),
        ]);

        if (!alive) return;

        setSummaryRows(Array.isArray(summaryResponse) ? summaryResponse : []);
        setDeviceRows(Array.isArray(deviceResponse) ? deviceResponse : []);
        setCriticalRows(Array.isArray(criticalResponse) ? criticalResponse : []);
      } catch (error) {
        console.error("Conclusion report load error:", error);

        if (!alive) return;
        setSummaryRows([]);
        setDeviceRows([]);
        setCriticalRows([]);
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
  }, [onReady, queryTaskIDs, taskMode]);

  const filteredSummaryRows = useMemo(() => {
    if (taskMode === "all" || selectedTaskIdSet.size === 0) return summaryRows;
    return summaryRows.filter((row) => selectedTaskIdSet.has(normalizeTaskId(row.task_id)));
  }, [summaryRows, selectedTaskIdSet, taskMode]);

  const filteredDeviceRows = useMemo(() => {
    if (taskMode === "all" || selectedTaskIdSet.size === 0) return deviceRows;
    return deviceRows.filter((row) => selectedTaskIdSet.has(normalizeTaskId(row.task_id)));
  }, [deviceRows, selectedTaskIdSet, taskMode]);

  const filteredCriticalRows = useMemo(() => {
    if (taskMode === "all" || selectedTaskIdSet.size === 0) return criticalRows;
    return criticalRows.filter((row) => selectedTaskIdSet.has(normalizeTaskId(row.task_id)));
  }, [criticalRows, selectedTaskIdSet, taskMode]);

  const severityData = useMemo<SeverityRow[]>(() => {
    let critical = 0;
    let high = 0;
    let medium = 0;
    let low = 0;
    let info = 0;

    for (const row of filteredSummaryRows) {
      critical += Number(row.critical || 0);
      high += Number(row.high || 0);
      medium += Number(row.medium || 0);
      low += Number(row.low || 0);
      info += Number(row.info || 0);
    }

    const raw: Omit<SeverityRow, "share">[] = [
      { name: "Critical", value: critical, color: SEVERITY_COLORS.Critical },
      { name: "High", value: high, color: SEVERITY_COLORS.High },
      { name: "Medium", value: medium, color: SEVERITY_COLORS.Medium },
      { name: "Low", value: low, color: SEVERITY_COLORS.Low },
      { name: "Info", value: info, color: SEVERITY_COLORS.Info },
    ];

    const total = raw.reduce((sum, item) => sum + item.value, 0);

    return raw.map((item) => ({
      ...item,
      share: total > 0 ? Number(((item.value / total) * 100).toFixed(2)) : 0,
    }));
  }, [filteredSummaryRows]);

  const totalFindings = useMemo(() => {
    return filteredSummaryRows.reduce((sum, row) => sum + Number(row.total || 0), 0);
  }, [filteredSummaryRows]);

  const sortedDevices = useMemo(() => {
    return sortDevicesByRiskDesc(filteredDeviceRows);
  }, [filteredDeviceRows]);

  const topThreeLineData = useMemo<DeviceTrendRow[]>(() => {
    const top3 = sortDevicesByRiskDesc(filteredDeviceRows).slice(0, 3);

    return top3.map((item, index) => ({
      rank: `#${index + 1}`,
      rankNumber: index + 1,
      target: normalizeText(item.task_name) || `Target ${index + 1}`,
      ip: normalizeText(item.ip_address) || "-",
      riskScore: Number(item.risk_score || 0),
      vulnerabilities: Number(item.vulnerability_total || 0),
    }));
  }, [filteredDeviceRows]);

  const targetListData = useMemo(() => {
    return [...topThreeLineData]
      .sort((a, b) => a.rankNumber - b.rankNumber)
      .slice(0, 3);
  }, [topThreeLineData]);

  const totalTargets = useMemo(() => {
    return sortedDevices.length;
  }, [sortedDevices]);

  const averageRiskScore = useMemo(() => {
    if (sortedDevices.length === 0) return 0;

    const total = sortedDevices.reduce(
      (sum, item) => sum + Number(item.risk_score || 0),
      0
    );

    return total / sortedDevices.length;
  }, [sortedDevices]);

  const highestRiskTarget = useMemo(() => {
    return topThreeLineData[0];
  }, [topThreeLineData]);

  const highestRiskScore = useMemo(() => {
    return Number(highestRiskTarget?.riskScore || 0);
  }, [highestRiskTarget]);

  const latestCritical = useMemo(() => {
    return [...filteredCriticalRows]
      .sort((a, b) => Number(b.severity || 0) - Number(a.severity || 0))
      .find((item) => normalizeText(item.vulnerability_name));
  }, [filteredCriticalRows]);

  const priorityTone = getRiskTone(highestRiskScore);

  const monthlySummary = useMemo(() => {
    const highest = Math.max(...monthlyMockData.map((item) => item.riskScore));
    const lowest = Math.min(...monthlyMockData.map((item) => item.riskScore));
    const totalVulnerabilities = monthlyMockData.reduce(
      (sum, item) => sum + item.vulnerabilityCount,
      0
    );

    return {
      highest,
      lowest,
      totalVulnerabilities,
    };
  }, []);

  const severityTooltipFormatter = (
    value: number | string | undefined,
    name: string | undefined
  ): [string, string] => {
    return [Number(value ?? 0).toLocaleString("en-US"), name ?? ""];
  };

  if (loading) {
    return (
      <section className="border border-slate-300 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
          <div className="mt-2 h-5 w-72 animate-pulse rounded bg-slate-100" />
          <div className="mt-2 h-3 w-full animate-pulse rounded bg-slate-100" />
        </div>
      </section>
    );
  }

  return (
    <section
      className="overflow-hidden border border-slate-300 bg-white"
      style={{
        breakInside: "avoid-page",
        pageBreakInside: "avoid",
      }}
    >
      <div className="border-b border-slate-200 bg-linear-to-r from-white via-slate-50 to-white px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[8px] font-semibold uppercase tracking-normal text-slate-500">
              Executive Conclusion
            </p>
            <h3 className="mt-1 text-[14px] font-bold leading-[1.2] text-slate-900">
              Consolidated Risk Summary and Final Observation
            </h3>
            <p className="mt-1 max-w-full text-[9px] leading-normal text-slate-600">
              สรุปภาพรวมของรายงานทั้งหมดในหน้าเดียว โดยใช้กราฟรายเดือนสำหรับการเปรียบเทียบ
              และสรุปมุมมองระดับความรุนแรงร่วมกับแนวโน้ม Risk Score ของเป้าหมายสำคัญ
            </p>
          </div>

          <div className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-right shadow-sm">
            <p className="text-[7px] font-semibold uppercase tracking-normal text-slate-500">
              Year now
            </p>
            <p className="mt-1 text-[14px] font-bold leading-none text-slate-900">
              {currentYear}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2.5 border-b border-slate-200 bg-slate-50/50 px-4 py-3">
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2.5">
          <div className="flex items-start gap-2.5">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-700">
              <FiShield className="text-[13px]" />
            </span>
            <div>
              <p className="text-[7.5px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Total Findings
              </p>
              <p className="mt-1 text-[16px] font-bold leading-none text-slate-900">
                {formatNumber(totalFindings)}
              </p>
              <p className="mt-1 text-[8.5px] leading-[1.35] text-slate-600">
                จำนวนผลการค้นพบรวม
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-white px-3 py-2.5">
          <div className="flex items-start gap-2.5">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-700">
              <FiTarget className="text-[13px]" />
            </span>
            <div>
              <p className="text-[7.5px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Total Devices
              </p>
              <p className="mt-1 text-[16px] font-bold leading-none text-slate-900">
                {formatNumber(totalTargets)}
              </p>
              <p className="mt-1 text-[8.5px] leading-[1.35] text-slate-600">
                จำนวน device ทั้งหมด
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-md border border-orange-200 bg-orange-50 px-3 py-2.5">
          <div className="flex items-start gap-2.5">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-orange-200 bg-white text-orange-700">
              <FiActivity className="text-[13px]" />
            </span>
            <div>
              <p className="text-[7.5px] font-semibold uppercase tracking-[0.12em] text-orange-700">
                Average Risk
              </p>
              <p className="mt-1 text-[16px] font-bold leading-none text-slate-900">
                {formatRiskScore(averageRiskScore)}
              </p>
              <p className="mt-1 text-[8.5px] leading-[1.35] text-slate-600">
                ค่าเฉลี่ย Risk Score
              </p>
            </div>
          </div>
        </div>

        <div className={`rounded-md border px-3 py-2.5 ${priorityTone.chipClass}`}>
          <div className="flex items-start gap-2.5">
            <span
              className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-current bg-white ${priorityTone.iconClass}`}
            >
              <FiAlertTriangle className="text-[13px]" />
            </span>
            <div>
              <p className="text-[7.5px] font-semibold uppercase tracking-[0.12em]">
                Highest Priority
              </p>
              <p className="mt-1 text-[16px] font-bold leading-none text-slate-900">
                {formatRiskScore(highestRiskScore)}
              </p>
              <p className="mt-1 text-[8.5px] leading-[1.35] text-slate-700">
                เป้าหมายที่ควรติดตามก่อน
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-3">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 bg-slate-50/80 px-3.5 py-2.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700">
                    <FiBarChart2 className="text-[12px]" />
                  </span>
                  <div>
                    <h4 className="text-[11px] font-semibold text-slate-900">
                      Monthly Comparison Overview
                    </h4>
                    <p className="text-[8.5px] leading-[1.35] text-slate-600">
                      เปรียบเทียบ Risk Score ตลอดปี {currentYear}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid shrink-0 grid-cols-3 gap-1.5">
                <div className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-center">
                  <p className="text-[6.5px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Highest
                  </p>
                  <p className="mt-1 text-[11px] font-bold text-slate-900">
                    {formatRiskScore(monthlySummary.highest)}
                  </p>
                </div>
                <div className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-center">
                  <p className="text-[6.5px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Lowest
                  </p>
                  <p className="mt-1 text-[11px] font-bold text-slate-900">
                    {formatRiskScore(monthlySummary.lowest)}
                  </p>
                </div>
                <div className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-center">
                  <p className="text-[6.5px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Vulns
                  </p>
                  <p className="mt-1 text-[11px] font-bold text-slate-900">
                    {formatNumber(monthlySummary.totalVulnerabilities)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="px-3.5 pb-3 pt-2">
            <div className="mb-1.5 flex items-center justify-between">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[8px] text-slate-600">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-3.5 rounded-full bg-red-600" />
                  <span>Very High</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-3.5 rounded-full bg-orange-500" />
                  <span>High</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-3.5 rounded-full bg-green-500" />
                  <span>Lower</span>
                </div>
              </div>

              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[7px] font-medium text-slate-600">
                {currentYear}
              </span>
            </div>

            <div className="h-37.5 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={monthlyMockData}
                  margin={{ top: 14, right: 6, left: -10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 8, fill: "#64748b" }}
                    tickLine={false}
                    axisLine={{ stroke: "#cbd5e1" }}
                  />
                  <YAxis
                    domain={[0, 10]}
                    tick={{ fontSize: 8, fill: "#64748b" }}
                    tickLine={false}
                    axisLine={{ stroke: "#cbd5e1" }}
                    width={26}
                  />
                  <Tooltip
                    formatter={(value, name, item) => {
                      const row = item?.payload as MonthlyRiskRow | undefined;
                      if (String(name) === "riskScore") {
                        return [formatRiskScore(Number(value || 0)), "Risk Score"];
                      }
                      return [
                        row ? formatNumber(row.vulnerabilityCount) : "0",
                        "Vulnerabilities",
                      ];
                    }}
                    labelFormatter={(label) => `${label} ${currentYear}`}
                    contentStyle={{
                      borderRadius: 8,
                      borderColor: "#e2e8f0",
                      boxShadow: "0 6px 20px rgba(15,23,42,0.08)",
                      fontSize: "11px",
                    }}
                  />
                  <Bar dataKey="riskScore" radius={[5, 5, 0, 0]} maxBarSize={18}>
                    <LabelList dataKey="riskScore" content={<RiskScoreLabel />} />
                    {monthlyMockData.map((entry, index) => (
                      <Cell
                        key={`monthly-${index}`}
                        fill={getMonthlyBarColor(entry.riskScore)}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <p className="mt-1 text-[8px] leading-[1.35] text-slate-500">
              แนวโน้ม Risk Score ลดลงต่อเนื่องจาก Jan ถึง Dec
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-3 border-t border-slate-200 bg-slate-50/40 px-4 py-3">
        <div className="col-span-5">
          <div className="flex min-h-95.5 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-slate-50/80 px-3.5 py-2.5">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700">
                  <FiPieChart className="text-[12px]" />
                </span>
                <div>
                  <h4 className="text-[11px] font-semibold text-slate-900">
                    Total Severity
                  </h4>
                  <p className="text-[8.5px] leading-[1.35] text-slate-600">
                    สัดส่วนผลการค้นพบตามระดับความรุนแรง
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-1 flex-col p-3">
              <div className="relative h-43.75">
                <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center">
                  <p className="text-[7px] font-semibold uppercase tracking-normal text-slate-500">
                    Total
                  </p>
                  <p className="mt-1 text-[18px] font-bold leading-none text-slate-900">
                    {formatNumber(totalFindings)}
                  </p>
                  <p className="mt-1 text-[7px] text-slate-500">Findings</p>
                </div>

                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={severityData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={74}
                      paddingAngle={2}
                      stroke="#ffffff"
                      strokeWidth={2}
                      isAnimationActive={false}
                    >
                      {severityData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={severityTooltipFormatter} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-2 grid grid-cols-1 gap-1.5">
                {severityData.map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[8px]"
                  >
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span
                        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="font-medium text-slate-700">{item.name}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5 text-slate-600">
                      <span>{formatNumber(item.value)}</span>
                      <span>({item.share.toFixed(2)}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-7">
          <div className="flex min-h-95.5 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-slate-50/80 px-3.5 py-2.5">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700">
                  <FiTrendingUp className="text-[12px]" />
                </span>
                <div>
                  <h4 className="text-[11px] font-semibold text-slate-900">
                    Top 3 Device Risk Curve
                  </h4>
                  <p className="text-[8.5px] leading-[1.35] text-slate-600">
                    แสดงเฉพาะ Top 3 เป้าหมายที่มี risk score สูงสุดจริง
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-1 flex-col p-3">
              <div className="h-38 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={topThreeLineData}
                    margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis
                      dataKey="rank"
                      tick={{ fontSize: 8, fill: "#64748b" }}
                      tickLine={false}
                      axisLine={{ stroke: "#cbd5e1" }}
                    />
                    <YAxis
                      domain={[0, 10]}
                      tick={{ fontSize: 8, fill: "#64748b" }}
                      tickLine={false}
                      axisLine={{ stroke: "#cbd5e1" }}
                      width={26}
                    />
                    <Tooltip
                      formatter={(value, name, item) => {
                        const row = item?.payload as DeviceTrendRow | undefined;
                        if (String(name) === "riskScore") {
                          return [formatRiskScore(Number(value || 0)), "Risk Score"];
                        }
                        return [
                          row ? formatNumber(row.vulnerabilities) : "0",
                          "Vulnerabilities",
                        ];
                      }}
                      labelFormatter={(label) => `Rank ${label}`}
                      contentStyle={{
                        borderRadius: 8,
                        borderColor: "#e2e8f0",
                        boxShadow: "0 6px 20px rgba(15,23,42,0.08)",
                        fontSize: "11px",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="riskScore"
                      stroke="#8b5cf6"
                      strokeWidth={2.4}
                      dot={{
                        r: 3.5,
                        strokeWidth: 1.5,
                        fill: "#ffffff",
                        stroke: "#8b5cf6",
                      }}
                      activeDot={{ r: 4.5 }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-2 flex-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
                <p className="text-[7.5px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Target List
                </p>

                <div className="mt-1.5 grid grid-cols-1 gap-1.5">
                  {targetListData.length > 0 ? (
                    targetListData.map((item) => (
                      <div
                        key={`${item.rankNumber}-${item.target}-${item.ip}`}
                        className="grid grid-cols-[44px_minmax(0,1fr)_72px_58px] items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-2"
                      >
                        <div className="text-[8px] font-semibold text-slate-500">
                          #{item.rankNumber}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-[8.5px] font-semibold text-slate-900">
                            {item.target}
                          </p>
                          <p className="truncate text-[7.5px] text-slate-500">
                            {item.ip}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-[7px] uppercase tracking-[0.12em] text-slate-400">
                            Risk
                          </p>
                          <p className="text-[8.5px] font-semibold text-slate-900">
                            {formatRiskScore(item.riskScore)}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-[7px] uppercase tracking-[0.12em] text-slate-400">
                            Vulns
                          </p>
                          <p className="text-[8.5px] font-semibold text-slate-900">
                            {formatNumber(item.vulnerabilities)}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-md border border-dashed border-slate-300 bg-white px-3 py-3 text-[8px] text-slate-500">
                      No top device data available.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-8">
          <div className="h-full rounded-lg border border-slate-200 bg-white px-3 py-2.5">
            <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Final interpretation
            </p>

            <div className="mt-2 space-y-2 text-[8px] leading-[1.6] text-slate-600">
              <p>
                ภาพรวมของการประเมินรอบนี้สะท้อนให้เห็นว่าโครงสร้างความเสี่ยงหลักยังคงกระจุกตัวอยู่ใน
                device กลุ่มบนสุด โดยเฉพาะรายการที่อยู่ใน Top 3 ซึ่งมีค่า Risk Score สูงกว่าอุปกรณ์อื่นอย่างชัดเจน
                และควรถูกใช้เป็นกลุ่มเป้าหมายแรกของแผน remediation
              </p>

              <p>
                ในด้าน severity distribution พบว่ากลุ่ม Info และ Medium ยังมีสัดส่วนค่อนข้างมาก
                ขณะที่กลุ่ม Critical และ High แม้มีจำนวนน้อยกว่า แต่มีความสำคัญเชิงปฏิบัติการสูงกว่า
                ดังนั้นการจัดลำดับการแก้ไขควรอิงทั้ง “ความรุนแรง” และ “ผลกระทบต่อภาพรวมของความเสี่ยง”
                ไปพร้อมกัน
              </p>

              <p>
                จากกราฟ Top 3 Device Risk Curve จะเห็นว่าระดับความเสี่ยงของอุปกรณ์กลุ่มบนสุดยังอยู่ในระดับใกล้เคียงกัน
                หมายความว่าการแก้ไขเฉพาะรายการเดียวอาจยังไม่เพียงพอ หากต้องการลดแรงกดดันของความเสี่ยงรวมในรอบถัดไป
                ก็ควรวางแผน remediation แบบครอบคลุมทั้งกลุ่มอุปกรณ์ที่อยู่ในลำดับต้น ๆ
              </p>

              <p>
                {latestCritical ? (
                  <>
                    หากพิจารณารายการ critical ล่าสุด{" "}
                    <span className="font-semibold text-slate-900">
                      {latestCritical.vulnerability_name}
                    </span>{" "}
                    ซึ่งตรวจพบเมื่อ{" "}
                    <span className="font-semibold text-slate-900">
                      {formatDetectedDate(latestCritical.detected_date)}
                    </span>
                    {typeof getDetectedDays(latestCritical.detected_date) === "number" ? (
                      <>
                        {" "}
                        หรือประมาณ{" "}
                        <span className="font-semibold text-slate-900">
                          {getDetectedDays(latestCritical.detected_date)}
                        </span>{" "}
                        วัน ควรได้รับการติดตามในระดับเร่งด่วน เพื่อจำกัดผลกระทบในเชิงระบบและลดโอกาสของการถูกโจมตีซ้ำ
                      </>
                    ) : (
                      <> ควรได้รับการติดตามในระดับเร่งด่วน</>
                    )}
                  </>
                ) : (
                  <>
                    ในชุดข้อมูลที่เลือกไม่พบ critical finding ที่มีรายละเอียดพร้อมแสดงผลเพิ่มเติม
                  </>
                )}
              </p>

              <p>
                โดยสรุป ผลการประเมินนี้ชี้ให้เห็นว่าองค์กรควรดำเนินการแบบเป็นลำดับขั้น:
                เริ่มจากลดความเสี่ยงของ device กลุ่มบนสุด, จัดการ critical findings ที่ยังเปิดอยู่,
                และติดตามแนวโน้มรายเดือนเพื่อให้เห็นผลของการปรับปรุงในรอบถัดไปอย่างชัดเจน
              </p>
            </div>
          </div>
        </div>

        <div className="col-span-4">
          <div className="h-full rounded-lg border border-slate-200 bg-white px-3 py-2.5">
            <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Recommended actions
            </p>

            <div className="mt-2 space-y-2">
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2">
                <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-rose-700">
                  1. Immediate
                </p>
                <p className="mt-1 text-[8px] leading-[1.55] text-slate-700">
                  Prioritize remediation for the highest-risk devices and close critical vulnerabilities first.
                </p>
              </div>

              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-amber-700">
                  2. Near-term
                </p>
                <p className="mt-1 text-[8px] leading-[1.55] text-slate-700">
                  Review Medium and High findings in sequence and verify that affected systems are patched or mitigated.
                </p>
              </div>

              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
                <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
                  3. Continuous
                </p>
                <p className="mt-1 text-[8px] leading-[1.55] text-slate-700">
                  Reassess risk trends monthly and compare future scan results against the current baseline.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Conclusion;