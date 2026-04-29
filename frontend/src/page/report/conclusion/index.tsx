import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  FiPieChart,
  FiShield,
  FiTarget,
  FiTrendingUp,
} from "react-icons/fi";
import {
  ListTaskVulnSummaryForReport,
  ListDeviceRiskForReport,
  ListCriticalForReport,
  ListDataForReportVulnerabilityMonth,
  type TaskVulnSummaryForReportResponse,
  type DeviceRiskForReportDTO,
  type CriticalForReportResponse,
  type ReportVulnerabilityMonthResponse,
} from "../../../services/report";

type ConclusionProps = {
  onReady?: (ready: boolean) => void;
  selectedTaskIDs?: string[];
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
  monthNo: number;
  vulnerabilityCount: number;
  riskScore: number;
};

const currentYear = 2026;

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

const normalizeTaskIDs = (ids?: string[]): string[] => {
  if (!Array.isArray(ids)) return [];

  return ids
    .map((id) => String(id).trim())
    .filter((id) => id !== "");
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
  if (score >= 7) return "#f97316";
  if (score >= 4) return "#eab308";
  if (score > 0) return "#22c55e";
  return "#cbd5e1";
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
      fontSize={11}
      fontWeight={700}
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

const filterMonthlyDataBySelectedTaskIDs = (
  apiData: ReportVulnerabilityMonthResponse[],
  selectedTaskIDs: string[]
): ReportVulnerabilityMonthResponse[] => {
  if (!selectedTaskIDs.length) return apiData;

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

    const current = monthMap.get(monthNo)!;

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
      riskScore:
        item.riskScoreCount > 0
          ? Number((item.totalRiskScore / item.riskScoreCount).toFixed(2))
          : 0,
    }));
};

const Conclusion: React.FC<ConclusionProps> = ({
  onReady,
  selectedTaskIDs = [],
}) => {
  const initialQuery = useMemo(() => readTaskIDsFromQuery(), []);

  const [summaryRows, setSummaryRows] = useState<
    TaskVulnSummaryForReportResponse[]
  >([]);
  const [deviceRows, setDeviceRows] = useState<DeviceRiskForReportDTO[]>([]);
  const [criticalRows, setCriticalRows] = useState<CriticalForReportResponse[]>(
    []
  );
  const [monthlyRows, setMonthlyRows] = useState<
    ReportVulnerabilityMonthResponse[]
  >([]);
  const [loading, setLoading] = useState<boolean>(true);

  const normalizedSelectedTaskIDs = useMemo(
    () => normalizeTaskIDs(selectedTaskIDs),
    [selectedTaskIDs]
  );

  const [queryTaskIDs] = useState<string[]>(initialQuery.ids);
  const [taskMode] = useState<"all" | "filtered">(initialQuery.mode);

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

  const selectedTaskIdSet = useMemo(() => {
    return new Set(effectiveTaskIDs.map((id) => normalizeTaskId(id)));
  }, [effectiveTaskIDs]);

  const isMountedRef = useRef(false);
  const isFetchingRef = useRef(false);
  const lastFetchKeyRef = useRef("");

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchData = useCallback(async () => {
    const fetchKey = JSON.stringify({
      mode: effectiveTaskMode,
      ids: effectiveTaskIDs,
    });

    if (isFetchingRef.current) return;
    if (lastFetchKeyRef.current === fetchKey) return;

    try {
      isFetchingRef.current = true;
      lastFetchKeyRef.current = fetchKey;

      if (isMountedRef.current) {
        setLoading(true);
      }

      onReady?.(false);

      const requestTaskIds =
        effectiveTaskMode === "all" || effectiveTaskIDs.length === 0
          ? undefined
          : effectiveTaskIDs;

      const [summaryResponse, deviceResponse, criticalResponse, monthlyResponse] =
        await Promise.all([
          ListTaskVulnSummaryForReport(requestTaskIds),
          ListDeviceRiskForReport(requestTaskIds),
          ListCriticalForReport(requestTaskIds, 50),
          ListDataForReportVulnerabilityMonth(requestTaskIds),
        ]);

      if (!isMountedRef.current) return;

      setSummaryRows(Array.isArray(summaryResponse) ? summaryResponse : []);
      setDeviceRows(Array.isArray(deviceResponse) ? deviceResponse : []);
      setCriticalRows(Array.isArray(criticalResponse) ? criticalResponse : []);
      setMonthlyRows(Array.isArray(monthlyResponse) ? monthlyResponse : []);
    } catch (error) {
      console.error("Conclusion report load error:", error);

      if (!isMountedRef.current) return;

      setSummaryRows([]);
      setDeviceRows([]);
      setCriticalRows([]);
      setMonthlyRows([]);
      lastFetchKeyRef.current = "";
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }

      onReady?.(true);
      isFetchingRef.current = false;
    }
  }, [effectiveTaskIDs, effectiveTaskMode, onReady]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const filteredSummaryRows = useMemo(() => {
    if (effectiveTaskMode === "all" || selectedTaskIdSet.size === 0) {
      return summaryRows;
    }

    return summaryRows.filter((row) =>
      selectedTaskIdSet.has(normalizeTaskId(row.task_id))
    );
  }, [summaryRows, selectedTaskIdSet, effectiveTaskMode]);

  const filteredDeviceRows = useMemo(() => {
    if (effectiveTaskMode === "all" || selectedTaskIdSet.size === 0) {
      return deviceRows;
    }

    return deviceRows.filter((row) =>
      selectedTaskIdSet.has(normalizeTaskId(row.task_id))
    );
  }, [deviceRows, selectedTaskIdSet, effectiveTaskMode]);

  const filteredCriticalRows = useMemo(() => {
    if (effectiveTaskMode === "all" || selectedTaskIdSet.size === 0) {
      return criticalRows;
    }

    return criticalRows.filter((row) =>
      selectedTaskIdSet.has(normalizeTaskId(row.task_id))
    );
  }, [criticalRows, selectedTaskIdSet, effectiveTaskMode]);

  const filteredMonthlyRows = useMemo(() => {
    if (effectiveTaskMode === "all" || selectedTaskIdSet.size === 0) {
      return monthlyRows;
    }

    return filterMonthlyDataBySelectedTaskIDs(monthlyRows, effectiveTaskIDs);
  }, [monthlyRows, selectedTaskIdSet, effectiveTaskMode, effectiveTaskIDs]);

  const monthlyChartData = useMemo(() => {
    return normalizeMonthlyData(filteredMonthlyRows);
  }, [filteredMonthlyRows]);

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
    return filteredSummaryRows.reduce(
      (sum, row) => sum + Number(row.total || 0),
      0
    );
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

  const topCriticalObservations = useMemo(() => {
    return [...filteredCriticalRows]
      .filter((item) => normalizeText(item.vulnerability_name))
      .sort((a, b) => {
        const severityDiff = Number(b.severity || 0) - Number(a.severity || 0);
        if (severityDiff !== 0) return severityDiff;

        const dateA = new Date(a.detected_date || "").getTime();
        const dateB = new Date(b.detected_date || "").getTime();

        if (!Number.isNaN(dateA) && !Number.isNaN(dateB) && dateB !== dateA) {
          return dateB - dateA;
        }

        return String(a.vulnerability_name || "").localeCompare(
          String(b.vulnerability_name || "")
        );
      })
      .slice(0, 3);
  }, [filteredCriticalRows]);

  const priorityTone = getRiskTone(highestRiskScore);

  const severityTooltipFormatter = (
    value: number | string | undefined,
    name: string | undefined
  ): [string, string] => {
    return [Number(value ?? 0).toLocaleString("en-US"), name ?? ""];
  };

  const MonthlyTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{
      payload: MonthlyRiskRow;
      value: number;
    }>;
  }) => {
    if (!active || !payload || payload.length === 0) return null;

    const row = payload[0]?.payload;
    if (!row) return null;

    return (
      <div className="min-w-56 rounded-md border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
        <p className="text-[13.5px] font-semibold text-slate-900">
          {row.month} {currentYear}
        </p>

        <div className="mt-2 space-y-1.5 text-[12.25px]">
          <div>
            <span className="font-medium text-slate-700">Vulnerabilities:</span>{" "}
            <span className="text-slate-600">
              {formatNumber(row.vulnerabilityCount)}
            </span>
          </div>

          <div>
            <span className="font-medium text-slate-700">AVG Risk Score:</span>{" "}
            <span className="font-semibold text-slate-900">
              {formatRiskScore(row.riskScore)}
            </span>
          </div>
        </div>
      </div>
    );
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
            <p className="text-[11px] font-semibold uppercase tracking-normal text-slate-500">
              Executive Conclusion
            </p>

            <h3 className="mt-1 text-[18px] font-bold leading-tight text-slate-900">
              Consolidated Risk Summary and Final Observation
            </h3>

            <p className="mt-1.5 max-w-full text-[12.25px] leading-[1.55] text-slate-600">
              สรุปภาพรวมของรายงานทั้งหมดในหน้าเดียว โดยใช้กราฟรายเดือนสำหรับการเปรียบเทียบ
              และสรุปมุมมองระดับความรุนแรงร่วมกับแนวโน้ม Risk Score ของเป้าหมายสำคัญ
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2.5 border-b border-slate-200 bg-slate-50/50 px-4 py-3">
        <div className="rounded-md border border-violet-200 bg-violet-50 px-3 py-2.5">
          <div className="flex items-start gap-2.5">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-violet-200 bg-white text-violet-700">
              <FiShield className="text-[15px]" />
            </span>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-500">
                Total Findings
              </p>

              <p className="mt-1 text-[20px] font-bold leading-none text-slate-900">
                {formatNumber(totalFindings)}
              </p>

              <p className="mt-1 text-[11px] leading-[1.4] text-slate-600">
                จำนวนผลการค้นพบรวม
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-white px-3 py-2.5">
          <div className="flex items-start gap-2.5">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-700">
              <FiTarget className="text-[15px]" />
            </span>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Total Devices
              </p>

              <p className="mt-1 text-[20px] font-bold leading-none text-slate-900">
                {formatNumber(totalTargets)}
              </p>

              <p className="mt-1 text-[11px] leading-[1.4] text-slate-600">
                จำนวน device ทั้งหมด
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-md border border-orange-200 bg-orange-50 px-3 py-2.5">
          <div className="flex items-start gap-2.5">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-orange-200 bg-white text-orange-700">
              <FiActivity className="text-[15px]" />
            </span>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-orange-700">
                Average Risk (0-10)
              </p>

              <p className="mt-1 text-[20px] font-bold leading-none text-slate-900">
                {formatRiskScore(averageRiskScore)}
              </p>

              <p className="mt-1 text-[11px] leading-[1.4] text-slate-600">
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
              <FiAlertTriangle className="text-[15px]" />
            </span>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em]">
                Highest Priority (0-10)
              </p>

              <p className="mt-1 text-[20px] font-bold leading-none text-slate-900">
                {formatRiskScore(highestRiskScore)}
              </p>

              <p className="mt-1 text-[11px] leading-[1.4] text-slate-700">
                เป้าหมายที่ควรติดตามก่อน
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-3">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="px-3 py-3">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <h4 className="text-[14.5px] font-semibold text-slate-900">
                  Monthly Comparison Overview
                </h4>

                <p className="text-[11.5px] leading-[1.4] text-slate-600">
                  เปรียบเทียบ Risk Score ตลอดปี {currentYear}
                </p>
              </div>

              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
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
                  data={monthlyChartData}
                  margin={{ top: 18, right: 8, left: 2, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />

                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    tickLine={false}
                    axisLine={{ stroke: "#cbd5e1" }}
                  />

                  <YAxis
                    domain={[0, 10]}
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    tickLine={false}
                    axisLine={{ stroke: "#cbd5e1" }}
                    width={36}
                    tickMargin={6}
                  />

                  <Tooltip content={<MonthlyTooltip />} />

                  <Bar dataKey="riskScore" radius={[4, 4, 0, 0]} maxBarSize={24}>
                    <LabelList dataKey="riskScore" content={<RiskScoreLabel />} />

                    {monthlyChartData.map((entry, index) => (
                      <Cell
                        key={`cell-${entry.monthNo}-${index}`}
                        fill={getMonthlyBarColor(entry.riskScore)}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <p className="mt-2 text-[12px] leading-4.5 text-slate-500">
              Note: This section presents the monthly AVG risk score across the
              year 2026.
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
                  <FiPieChart className="text-[14px]" />
                </span>

                <div>
                  <h4 className="text-[14px] font-semibold text-slate-900">
                    Total Severity
                  </h4>

                  <p className="text-[11px] leading-[1.4] text-slate-600">
                    สัดส่วนผลการค้นพบตามระดับความรุนแรง
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-1 flex-col p-3">
              <div className="relative h-43.75">
                <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center">
                  <p className="text-[9.5px] font-semibold uppercase tracking-normal text-slate-500">
                    Total
                  </p>

                  <p className="mt-1 text-[21px] font-bold leading-none text-slate-900">
                    {formatNumber(totalFindings)}
                  </p>

                  <p className="mt-1 text-[9.5px] text-slate-500">Findings</p>
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
                    className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[10.5px]"
                  >
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span
                        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />

                      <span className="font-medium text-slate-700">
                        {item.name}
                      </span>
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
                  <FiTrendingUp className="text-[14px]" />
                </span>

                <div>
                  <h4 className="text-[14px] font-semibold text-slate-900">
                    Top 3 Device Risk
                  </h4>

                  <p className="text-[11px] leading-[1.4] text-slate-600">
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
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#e2e8f0"
                      vertical={false}
                    />

                    <XAxis
                      dataKey="rank"
                      tick={{ fontSize: 10, fill: "#64748b" }}
                      tickLine={false}
                      axisLine={{ stroke: "#cbd5e1" }}
                    />

                    <YAxis
                      domain={[0, 10]}
                      tick={{ fontSize: 10, fill: "#64748b" }}
                      tickLine={false}
                      axisLine={{ stroke: "#cbd5e1" }}
                      width={28}
                    />

                    <Tooltip
                      formatter={(value, name, item) => {
                        const row = item?.payload as DeviceTrendRow | undefined;

                        if (String(name) === "riskScore") {
                          return [
                            formatRiskScore(Number(value || 0)),
                            "Risk Score",
                          ];
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
                        fontSize: "12px",
                      }}
                    />

                    <Line
                      type="monotone"
                      dataKey="riskScore"
                      stroke="#3b82f6"
                      strokeWidth={2.4}
                      dot={{
                        r: 3.5,
                        strokeWidth: 1.5,
                        fill: "#ffffff",
                        stroke: "#3b82f6",
                      }}
                      activeDot={{ r: 4.5, stroke: "#3b82f6", fill: "#ffffff" }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-2 flex-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Target List
                </p>

                <div className="mt-1.5 grid grid-cols-1 gap-1.5">
                  {targetListData.length > 0 ? (
                    targetListData.map((item) => (
                      <div
                        key={`${item.rankNumber}-${item.target}-${item.ip}`}
                        className="grid grid-cols-[44px_minmax(0,1fr)_72px_58px] items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-2"
                      >
                        <div className="text-[10px] font-semibold text-slate-500">
                          #{item.rankNumber}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-[11px] font-semibold text-slate-900">
                            {item.target}
                          </p>

                          <p className="truncate text-[10px] text-slate-500">
                            {item.ip}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-[9px] uppercase tracking-widest text-slate-500">
                            Risk
                          </p>

                          <p className="text-[11px] font-semibold text-slate-900">
                            {formatRiskScore(item.riskScore)}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-[9px] uppercase tracking-widest text-slate-500">
                            Vulns
                          </p>

                          <p className="text-[11px] font-semibold text-slate-900">
                            {formatNumber(item.vulnerabilities)}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-md border border-dashed border-slate-300 bg-white px-3 py-3 text-[11px] text-slate-500">
                      No target data available
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-3 border-t border-slate-200 px-4 py-3">
        <div className="col-span-7">
          <div className="flex h-full flex-col rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-slate-50/80 px-3.5 py-2.5">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700">
                  <FiAlertTriangle className="text-[14px]" />
                </span>

                <div>
                  <h4 className="text-[14px] font-semibold text-slate-900">
                    Critical Observation
                  </h4>

                  <p className="text-[11px] leading-[1.4] text-slate-600">
                    ช่องโหว่สำคัญที่ควรติดตามเป็นลำดับต้น
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-1 p-3">
              {topCriticalObservations.length > 0 ? (
                <div className="space-y-2">
                  {topCriticalObservations.map((item, index) => {
                    const severity = Number(item.severity || 0);

                    return (
                      <div
                        key={`${item.task_id || "task"}-${
                          item.vulnerability_name || "vuln"
                        }-${index}`}
                        className="border-b border-slate-200 pb-2 last:border-b-0 last:pb-0"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-700">
                              <FiAlertTriangle className="text-[14px]" />
                            </span>

                            <div className="min-w-0">
                              <h5 className="truncate text-[12px] font-semibold leading-[1.4] text-slate-900">
                                {normalizeText(item.vulnerability_name) || "-"}
                              </h5>

                              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-600">
                                <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 font-medium text-violet-700">
                                  {normalizeText(item.solution_type) ||
                                    "VendorFix"}
                                </span>

                                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-medium text-slate-700">
                                  {normalizeText(item.task_name) || "-"}
                                </span>
                              </div>

                              <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-600">
                                <span>
                                  Severity:{" "}
                                  <span className="font-semibold text-slate-800">
                                    {formatRiskScore(severity)}
                                  </span>
                                </span>

                                <span>
                                  Host:{" "}
                                  <span className="font-semibold text-slate-800">
                                    {normalizeText(item.ip) || "-"}
                                  </span>
                                </span>

                                <span>
                                  Detected:{" "}
                                  <span className="font-semibold text-slate-800">
                                    {item.detected_date
                                      ? (() => {
                                          const raw = String(
                                            item.detected_date ?? ""
                                          ).trim();

                                          if (!raw) return "-";

                                          let d: Date | null = null;

                                          if (/^\d+$/.test(raw)) {
                                            const num = Number(raw);
                                            d = new Date(
                                              num < 1e12 ? num * 1000 : num
                                            );
                                          } else {
                                            d = new Date(raw);
                                            if (Number.isNaN(d.getTime())) {
                                              d = new Date(raw.replace(" ", "T"));
                                            }
                                          }

                                          if (!d || Number.isNaN(d.getTime())) {
                                            return raw;
                                          }

                                          const bangkokTime = new Date(
                                            d.getTime() + 7 * 60 * 60 * 1000
                                          );

                                          return new Intl.DateTimeFormat("en-GB", {
                                            day: "2-digit",
                                            month: "2-digit",
                                            year: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                            second: "2-digit",
                                            hour12: false,
                                          }).format(bangkokTime);
                                        })()
                                      : "-"}
                                  </span>
                                </span>

                                <span>
                                  Age:{" "}
                                  <span className="font-semibold text-slate-800">
                                    {typeof getDetectedDays(
                                      item.detected_date
                                    ) === "number"
                                      ? `${getDetectedDays(
                                          item.detected_date
                                        )} days`
                                      : "-"}
                                  </span>
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-[11px] text-slate-500">
                  No critical observation found.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-span-5">
          <div className="flex h-full flex-col rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-slate-50/80 px-3.5 py-2.5">
              <h4 className="text-[14px] font-semibold text-slate-900">
                Recommended actions
              </h4>

              <p className="text-[11px] leading-[1.4] text-slate-600">
                ข้อเสนอแนะเชิงปฏิบัติการสำหรับรอบถัดไป
              </p>
            </div>

            <div className="flex flex-1 flex-col justify-center p-3">
              <div className="space-y-2">
                <div className="rounded-md border border-slate-200 bg-slate-50/50 px-3 py-2.5">
                  <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-800">
                    1. Immediate
                  </p>

                  <p className="mt-1 text-[11px] leading-[1.55] text-slate-600">
                    Prioritize remediation for the highest-risk devices and close
                    critical vulnerabilities first.
                  </p>
                </div>

                <div className="rounded-md border border-slate-200 bg-white px-3 py-2.5">
                  <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-800">
                    2. Near-term
                  </p>

                  <p className="mt-1 text-[11px] leading-[1.55] text-slate-600">
                    Review Medium and High findings in sequence and verify that
                    affected systems are patched or mitigated.
                  </p>
                </div>

                <div className="rounded-md border border-slate-200 bg-slate-50/50 px-3 py-2.5">
                  <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-800">
                    3. Continuous
                  </p>

                  <p className="mt-1 text-[11px] leading-[1.55] text-slate-600">
                    Reassess risk trends monthly and compare future scan results
                    against the current baseline.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Conclusion;