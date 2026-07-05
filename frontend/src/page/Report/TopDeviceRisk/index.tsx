import React, { useEffect, useMemo, useState } from "react";
import { FiCpu, FiActivity, FiServer, FiWifi, FiHardDrive } from "react-icons/fi";
import type { DeviceRiskForReportDTO } from "../../../services/report";
import { ListDeviceRiskForReport } from "../../../services/report";
import { useLanguage } from "../../../contexts/LanguageContext";

type TopDeviceRiskReportProps = {
  onReady?: (ready: boolean) => void;
  selectedTaskIDs?: string[];
  pageIndex?: number;
  pageSize?: number;
  onDataCountChange?: (count: number) => void;
  showOuterHeader?: boolean;
  countOnly?: boolean;
  prefetchedDevices?: DeviceRiskForReportDTO[];
  prefetchedLoading?: boolean;
};

const formatRiskScore = (score?: number) => {
  if (typeof score !== "number" || Number.isNaN(score)) return "-";
  return score.toFixed(2);
};

const formatNumber = (value?: number) => {
  if (typeof value !== "number" || Number.isNaN(value)) return "0";
  return value.toLocaleString("en-US");
};

const formatVulnerabilityTotal = (value?: number) => {
  if (typeof value !== "number" || Number.isNaN(value)) return "0";
  return value.toLocaleString("en-US");
};

const truncateText = (value?: string, maxLength = 90) => {
  if (!value) return "-";
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trim()}...`;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const polarToCartesian = (
  cx: number,
  cy: number,
  r: number,
  angleDeg: number
) => {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
};

const describeArc = (
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number
) => {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArcFlag = Math.abs(endAngle - startAngle) <= 180 ? "0" : "1";

  return [
    `M ${start.x} ${start.y}`,
    `A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`,
  ].join(" ");
};

const getGaugeAppearance = (score: number) => {
  if (score >= 9) {
    return {
      activeStart: "#f97373",
      activeEnd: "#ef4444",
      needle: "#64748b",
      center: "#94a3b8",
    };
  }

  if (score >= 7) {
    return {
      activeStart: "#fb923c",
      activeEnd: "#f97316",
      needle: "#64748b",
      center: "#94a3b8",
    };
  }

  if (score >= 4) {
    return {
      activeStart: "#f6c65b",
      activeEnd: "#e9a23b",
      needle: "#64748b",
      center: "#94a3b8",
    };
  }

  return {
    activeStart: "#5dd6a2",
    activeEnd: "#27c084",
    needle: "#64748b",
    center: "#94a3b8",
  };
};

const getAverageRiskTone = (score: number) => {
  if (score >= 9) {
    return {
      card: "border-rose-200 bg-rose-50/70",
      iconWrap: "border-rose-200 bg-white text-rose-700",
      label: "text-rose-700",
      value: "text-slate-900",
      desc: "text-slate-600",
    };
  }

  if (score >= 7) {
    return {
      card: "border-orange-200 bg-orange-50/70",
      iconWrap: "border-orange-200 bg-white text-orange-700",
      label: "text-orange-700",
      value: "text-slate-900",
      desc: "text-slate-600",
    };
  }

  if (score >= 4) {
    return {
      card: "border-amber-200 bg-amber-50/70",
      iconWrap: "border-amber-200 bg-white text-amber-700",
      label: "text-amber-700",
      value: "text-slate-900",
      desc: "text-slate-600",
    };
  }

  return {
    card: "border-emerald-200 bg-emerald-50/70",
    iconWrap: "border-emerald-200 bg-white text-emerald-700",
    label: "text-emerald-700",
    value: "text-slate-900",
    desc: "text-slate-600",
  };
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

type GaugeCardProps = {
  score: number;
};

const AverageRiskGauge: React.FC<GaugeCardProps> = ({ score }) => {
  const safeScore = clamp(score, 0, 10);
  const progressAngle = 180 * (safeScore / 10);

  const cx = 72;
  const cy = 72;
  const r = 46;

  const appearance = getGaugeAppearance(safeScore);

  const greenZone = describeArc(cx, cy, r, 180, 234);
  const amberZone = describeArc(cx, cy, r, 234, 306);
  const redZone = describeArc(cx, cy, r, 306, 360);
  const valuePath = describeArc(cx, cy, r, 180, 180 + progressAngle);

  const needleAngle = 180 + progressAngle;
  const needleBaseLeft = polarToCartesian(cx, cy, 4.5, needleAngle - 90);
  const needleBaseRight = polarToCartesian(cx, cy, 4.5, needleAngle + 90);
  const needleTip = polarToCartesian(cx, cy, 35, needleAngle);
  const needlePath = `M ${needleBaseLeft.x} ${needleBaseLeft.y} L ${needleTip.x} ${needleTip.y} L ${needleBaseRight.x} ${needleBaseRight.y} Z`;

  return (
    <div className="flex h-full min-w-30.5 items-center justify-center">
      <div className="relative h-20.5 w-36">
        <svg
          viewBox="0 0 144 90"
          className="h-full w-full overflow-visible"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="gaugeActiveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={appearance.activeStart} />
              <stop offset="100%" stopColor={appearance.activeEnd} />
            </linearGradient>
          </defs>

          <path
            d={greenZone}
            fill="none"
            stroke="#d8f5e8"
            strokeWidth="10"
            strokeLinecap="round"
          />
          <path
            d={amberZone}
            fill="none"
            stroke="#f8e7b3"
            strokeWidth="10"
            strokeLinecap="round"
          />
          <path
            d={redZone}
            fill="none"
            stroke="#f6d3d6"
            strokeWidth="10"
            strokeLinecap="round"
          />

          <path
            d={valuePath}
            fill="none"
            stroke="url(#gaugeActiveGradient)"
            strokeWidth="10"
            strokeLinecap="round"
          />

          <path d={needlePath} fill={appearance.needle} opacity="0.92" />
          <circle cx="72" cy="72" r="4.5" fill={appearance.center} />

          <text
            x="18"
            y="82"
            fontSize="11"
            fill="#64748b"
            fontWeight="700"
            textAnchor="middle"
          >
            0
          </text>
          <text
            x="126"
            y="82"
            fontSize="11"
            fill="#64748b"
            fontWeight="700"
            textAnchor="middle"
          >
            10
          </text>
        </svg>
      </div>
    </div>
  );
};

const index: React.FC<TopDeviceRiskReportProps> = ({
  onReady,
  selectedTaskIDs = [],
  pageIndex = 0,
  pageSize = 20,
  onDataCountChange,
  showOuterHeader = true,
  countOnly = false,
  prefetchedDevices,
  prefetchedLoading = false,
}) => {
  const { t } = useLanguage();
  const [devices, setDevices] = useState<DeviceRiskForReportDTO[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [queryTaskIDs, setQueryTaskIDs] = useState<string[]>([]);
  const [taskMode, setTaskMode] = useState<"all" | "filtered">("all");

  const hasPrefetchedDevices = Array.isArray(prefetchedDevices);

  const normalizedSelectedTaskIDs = useMemo(
    () => normalizeTaskIDs(selectedTaskIDs),
    [selectedTaskIDs]
  );

  useEffect(() => {
    const parsed = readTaskIDsFromQuery();
    setQueryTaskIDs(parsed.ids);
    setTaskMode(parsed.mode);
  }, []);

  useEffect(() => {
    if (!hasPrefetchedDevices) return;

    setDevices(prefetchedDevices ?? []);
    setLoading(Boolean(prefetchedLoading));
    onReady?.(!prefetchedLoading);
  }, [hasPrefetchedDevices, prefetchedDevices, prefetchedLoading, onReady]);

  useEffect(() => {
    if (hasPrefetchedDevices) return;

    let isMounted = true;

    onReady?.(false);

    const fetchData = async () => {
      setLoading(true);

      try {
        const result = await ListDeviceRiskForReport();

        if (!isMounted) return;

        if (Array.isArray(result)) {
          setDevices(result);
        } else {
          setDevices([]);
        }
      } catch (error) {
        console.error("TopDeviceRiskReport error:", error);
        if (isMounted) {
          setDevices([]);
        }
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
  }, [onReady, hasPrefetchedDevices]);

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

  const filteredDevices = useMemo(() => {
    if (effectiveTaskMode === "all") {
      return devices;
    }

    if (effectiveTaskIDs.length === 0) {
      return devices;
    }

    const selected = new Set(effectiveTaskIDs.map((id) => String(id).trim()));

    return devices.filter((device) =>
      selected.has(String(device.task_id).trim())
    );
  }, [devices, effectiveTaskIDs, effectiveTaskMode]);

  const sortedDevices = useMemo(() => {
    return [...filteredDevices].sort((a, b) => {
      const riskDiff = safeNumber(b.risk_score) - safeNumber(a.risk_score);
      if (riskDiff !== 0) return riskDiff;

      const vulnDiff =
        safeNumber(b.vulnerability_total) - safeNumber(a.vulnerability_total);
      if (vulnDiff !== 0) return vulnDiff;

      return (a.task_name || "").localeCompare(b.task_name || "");
    });
  }, [filteredDevices]);

  useEffect(() => {
    onDataCountChange?.(sortedDevices.length);
  }, [sortedDevices.length, onDataCountChange]);

  const pagedDevices = useMemo(() => {
    const start = pageIndex * pageSize;
    const end = start + pageSize;
    return sortedDevices.slice(start, end);
  }, [sortedDevices, pageIndex, pageSize]);

  const isSingleColumn = pagedDevices.length <= 10;

  const leftColumnDevices = useMemo(() => {
    return isSingleColumn ? pagedDevices : pagedDevices.slice(0, 10);
  }, [pagedDevices, isSingleColumn]);

  const rightColumnDevices = useMemo(() => {
    return isSingleColumn ? [] : pagedDevices.slice(10, 20);
  }, [pagedDevices, isSingleColumn]);

  const averageRiskScore = useMemo(() => {
    if (sortedDevices.length === 0) return 0;

    const totalRisk = sortedDevices.reduce(
      (sum, item) => sum + safeNumber(item.risk_score),
      0
    );

    return totalRisk / sortedDevices.length;
  }, [sortedDevices]);

  const totalTargets = useMemo(() => {
    return sortedDevices.length;
  }, [sortedDevices]);

  const averageTone = useMemo(() => {
    return getAverageRiskTone(averageRiskScore);
  }, [averageRiskScore]);

  const renderDeviceItem = (
    device: DeviceRiskForReportDTO,
    absoluteIndex: number
  ) => {
    return (
      <li
        key={`${device.task_id}-${device.ip_address || "no-ip"}-${absoluteIndex}`}
        className="px-4 py-3.5 sm:px-5"
        style={{
          breakInside: "avoid-page",
          pageBreakInside: "avoid",
        }}
      >
        <div className="flex items-start gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span className="mt-0.5 inline-flex h-5.5 min-w-5.5 items-center justify-center rounded-full bg-slate-200 px-1 text-[11.5px] font-bold text-slate-700">
              {absoluteIndex + 1}
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold leading-5 text-slate-900">
                {device.task_name || "-"}
              </p>

              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.25px] leading-5 text-slate-600">
                <span>
                  <span className="font-semibold text-slate-700">{t("topDeviceRisk.ipLabel")}</span>{" "}
                  {device.ip_address || "-"}
                </span>

                <span>
                  <span className="font-semibold text-slate-700">{t("topDeviceRisk.riskLabel")}</span>{" "}
                  {formatRiskScore(device.risk_score)}
                </span>

                <span>
                  <span className="font-semibold text-slate-700">
                    {t("conclusion.vulnerabilitiesLabel")}
                  </span>{" "}
                  {formatVulnerabilityTotal(device.vulnerability_total)}
                </span>
              </div>

              {device.firmware_version ? (
                <p className="mt-1 text-[11.75px] leading-5 text-slate-500">
                  {t("topDeviceRisk.firmwareLabel")} {truncateText(device.firmware_version, 95)}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </li>
    );
  };

  if (countOnly) {
    return null;
  }

  if (loading) {
    return (
      <section className="border border-slate-300 bg-white">
        <div className="px-5 py-5 md:px-6">
          {showOuterHeader ? (
            <div className="border-b border-slate-200 pb-4">
              <div className="h-5 w-52 animate-pulse bg-slate-200" />
              <div className="mt-2 h-4 w-80 animate-pulse bg-slate-100" />
            </div>
          ) : null}

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <div className="h-20 flex-1 animate-pulse border border-slate-200 bg-slate-50" />
            <div className="h-20 flex-1 animate-pulse border border-slate-200 bg-slate-50" />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4">
            <div className="divide-y divide-slate-200 border border-slate-200">
              {[1, 2, 3, 4, 5].map((item) => (
                <div key={`left-${item}`} className="px-4 py-4">
                  <div className="h-4 w-56 animate-pulse bg-slate-200" />
                  <div className="mt-2 h-3 w-40 animate-pulse bg-slate-100" />
                  <div className="mt-2 h-3 w-72 animate-pulse bg-slate-100" />
                </div>
              ))}
            </div>

            <div className="divide-y divide-slate-200 border border-slate-200">
              {[1, 2, 3, 4, 5].map((item) => (
                <div key={`right-${item}`} className="px-4 py-4">
                  <div className="h-4 w-56 animate-pulse bg-slate-200" />
                  <div className="mt-2 h-3 w-40 animate-pulse bg-slate-100" />
                  <div className="mt-2 h-3 w-72 animate-pulse bg-slate-100" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (sortedDevices.length === 0) {
    return (
      <section className="border border-slate-300 bg-white">
        <div className="px-5 py-6 md:px-6">
          {showOuterHeader ? (
            <>
              <h3 className="text-[19px] font-semibold text-slate-900">
                {t("topDeviceRisk.deviceRiskList")}
              </h3>
              <p className="mt-2 text-[14px] leading-6 text-slate-600">
                {t("topDeviceRisk.noDeviceDataForCycle")}
              </p>
            </>
          ) : (
            <p className="text-[14px] leading-6 text-slate-600">{t("execHighlights.noData")}</p>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="border border-slate-300 bg-white">
      <div className="px-5 py-5 md:px-6">
        {showOuterHeader ? (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="border border-slate-200 bg-slate-50 px-4 py-3.5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700">
                    <FiCpu className="text-[18px]" />
                  </span>

                  <div className="min-w-0">
                    <p className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                      {t("conclusion.totalDevices")}
                    </p>
                    <p className="mt-1 text-[20px] font-bold text-slate-900">
                      {formatNumber(totalTargets)}
                    </p>
                    <p className="mt-1 text-[12.25px] leading-5 text-slate-600">
                      {effectiveTaskMode === "all"
                        ? t("topDeviceRisk.devicesAssessedAll")
                        : t("topDeviceRisk.devicesAssessedFiltered")}
                    </p>
                  </div>
                </div>

                <div className="flex min-w-42.5 items-center justify-center">
                  <div className="relative h-20.5 w-42.5 overflow-visible">
                    <div className="absolute inset-x-7 top-1/2 h-px -translate-y-1/2 bg-slate-200" />
                    <div className="absolute left-1/2 top-6 h-5.5 w-px -translate-x-1/2 bg-slate-200" />

                    <div className="absolute left-3 top-2 h-3 w-3 rounded-full bg-slate-200/70 blur-[0.5px]" />
                    <div className="absolute left-9 top-1.5 h-2 w-2 rounded-full bg-slate-200/80 blur-[0.5px]" />
                    <div className="absolute right-4 top-2.5 h-3.5 w-3.5 rounded-full bg-slate-200/65 blur-[0.5px]" />
                    <div className="absolute right-10.5 top-7 h-2 w-2 rounded-full bg-slate-200/75 blur-[0.5px]" />
                    <div className="absolute left-5.5 bottom-3.5 h-2.5 w-2.5 rounded-full bg-slate-200/70 blur-[0.5px]" />
                    <div className="absolute left-12 bottom-2 h-3 w-3 rounded-full bg-slate-200/60 blur-[0.5px]" />
                    <div className="absolute right-7 bottom-2.5 h-2.5 w-2.5 rounded-full bg-slate-200/70 blur-[0.5px]" />
                    <div className="absolute left-1/2 top-9.5 h-2 w-2 -translate-x-1/2 rounded-full bg-slate-300/75" />

                    <div className="absolute left-7 top-4.5 text-slate-600">
                      <FiHardDrive className="text-[25px]" />
                    </div>

                    <div className="absolute right-7 top-4.5 text-slate-600">
                      <FiServer className="text-[25px]" />
                    </div>

                    <div className="absolute left-1/2 bottom-3.5 -translate-x-1/2 text-slate-600">
                      <FiWifi className="text-[26px]" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className={`border px-4 py-3.5 ${averageTone.card}`}>
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${averageTone.iconWrap}`}
                  >
                    <FiActivity className="text-[18px]" />
                  </span>

                  <div className="min-w-0">
                    <p
                      className={`text-[11.5px] font-semibold uppercase tracking-[0.14em] ${averageTone.label}`}
                    >
                      {t("topDeviceRisk.averageRiskScoreMax")}
                    </p>
                    <p className={`mt-1 text-[20px] font-bold ${averageTone.value}`}>
                      {formatRiskScore(averageRiskScore)}
                    </p>
                    <p className={`mt-1 text-[12.25px] leading-5 ${averageTone.desc}`}>
                      {effectiveTaskMode === "all"
                        ? t("topDeviceRisk.averageRiskAcrossAssessed")
                        : t("topDeviceRisk.averageRiskAcrossSelected")}
                    </p>
                  </div>
                </div>
                <AverageRiskGauge score={averageRiskScore} />
              </div>
            </div>
          </div>
        ) : null}

        <div
          className={[
            "mt-5 gap-4",
            isSingleColumn ? "grid grid-cols-1" : "grid grid-cols-2",
          ].join(" ")}
          style={{
            breakInside: "avoid-page",
            pageBreakInside: "avoid",
          }}
        >
          <div className="overflow-hidden border border-slate-200">
            <ul className="divide-y divide-slate-200">
              {leftColumnDevices.map((device, index) =>
                renderDeviceItem(device, pageIndex * pageSize + index)
              )}
            </ul>
          </div>

          {!isSingleColumn ? (
            <div className="overflow-hidden border border-slate-200">
              <ul className="divide-y divide-slate-200">
                {rightColumnDevices.map((device, index) =>
                  renderDeviceItem(device, pageIndex * pageSize + 10 + index)
                )}
              </ul>
            </div>
          ) : null}
        </div>

        <p className="mt-3 text-[12.25px] leading-5 text-slate-500">
          {t("topDeviceRisk.orderNote", { n: pageSize })}
        </p>
      </div>
    </section>
  );
};

export default index;