import React, { useEffect, useMemo, useState } from "react";
import { FiCpu, FiActivity } from "react-icons/fi";
import type { DeviceRiskForReportDTO } from "../../../services/report";
import { ListDeviceRiskForReport } from "../../../services/report";

type TopDeviceRiskReportProps = {
  onReady?: (ready: boolean) => void;
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

const getAverageRiskTone = (score: number) => {
  if (score >= 9) {
    return {
      card: "border-rose-200 bg-rose-50",
      iconWrap: "border-rose-200 bg-white text-rose-700",
      label: "text-rose-700",
      value: "text-slate-900",
      desc: "text-slate-600",
    };
  }

  if (score >= 7) {
    return {
      card: "border-orange-200 bg-orange-50",
      iconWrap: "border-orange-200 bg-white text-orange-700",
      label: "text-orange-700",
      value: "text-slate-900",
      desc: "text-slate-600",
    };
  }

  if (score >= 4) {
    return {
      card: "border-amber-200 bg-amber-50",
      iconWrap: "border-amber-200 bg-white text-amber-700",
      label: "text-amber-700",
      value: "text-slate-900",
      desc: "text-slate-600",
    };
  }

  return {
    card: "border-emerald-200 bg-emerald-50",
    iconWrap: "border-emerald-200 bg-white text-emerald-700",
    label: "text-emerald-700",
    value: "text-slate-900",
    desc: "text-slate-600",
  };
};

const TopDeviceRiskReport: React.FC<TopDeviceRiskReportProps> = ({
  onReady,
}) => {
  const [devices, setDevices] = useState<DeviceRiskForReportDTO[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
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
  }, [onReady]);

  const sortedDevices = useMemo(() => {
    return [...devices].sort((a, b) => {
      const riskDiff = (b.risk_score || 0) - (a.risk_score || 0);
      if (riskDiff !== 0) return riskDiff;

      const vulnDiff =
        (b.vulnerability_total || 0) - (a.vulnerability_total || 0);
      if (vulnDiff !== 0) return vulnDiff;

      return (a.task_name || "").localeCompare(b.task_name || "");
    });
  }, [devices]);

  const averageRiskScore = useMemo(() => {
    if (sortedDevices.length === 0) return 0;

    const totalRisk = sortedDevices.reduce(
      (sum, item) => sum + (item.risk_score || 0),
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

  if (loading) {
    return (
      <section className="border border-slate-300 bg-white">
        <div className="px-5 py-5 md:px-6">
          <div className="border-b border-slate-200 pb-4">
            <div className="h-5 w-52 animate-pulse rounded bg-slate-200" />
            <div className="mt-2 h-4 w-80 animate-pulse rounded bg-slate-100" />
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <div className="h-20 flex-1 animate-pulse rounded-md border border-slate-200 bg-slate-50" />
            <div className="h-20 flex-1 animate-pulse rounded-md border border-slate-200 bg-slate-50" />
          </div>

          <div className="mt-5 divide-y divide-slate-200 rounded-md border border-slate-200">
            {[1, 2, 3, 4, 5].map((item) => (
              <div key={item} className="px-4 py-4">
                <div className="h-4 w-56 animate-pulse rounded bg-slate-200" />
                <div className="mt-2 h-3 w-40 animate-pulse rounded bg-slate-100" />
                <div className="mt-2 h-3 w-72 animate-pulse rounded bg-slate-100" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (sortedDevices.length === 0) {
    return (
      <section className="border border-slate-300 bg-white">
        <div className="px-5 py-6 md:px-6">
          <h3 className="text-[17px] font-semibold text-slate-900">
            Device Risk List
          </h3>
          <p className="mt-2 text-[13px] leading-6 text-slate-600">
            ไม่พบข้อมูลอุปกรณ์สำหรับรายงานรอบนี้
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="border border-slate-300 bg-white">
      <div className="px-5 py-5 md:px-6">
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="border border-slate-200 bg-slate-50 px-4 py-3.5">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700">
                <FiCpu className="text-[17px]" />
              </span>

              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                  Total Devices
                </p>
                <p className="mt-1 text-[17px] font-bold text-slate-900">
                  {formatNumber(totalTargets)}
                </p>
                <p className="mt-1 text-[11px] leading-5 text-slate-600">
                  Number of assessed devices included in the latest scan cycle.
                </p>
              </div>
            </div>
          </div>

          <div className={`border px-4 py-3.5 ${averageTone.card}`}>
            <div className="flex items-start gap-3">
              <span
                className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${averageTone.iconWrap}`}
              >
                <FiActivity className="text-[17px]" />
              </span>

              <div className="min-w-0">
                <p
                  className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${averageTone.label}`}
                >
                  Average Risk Score
                </p>
                <p className={`mt-1 text-[17px] font-bold ${averageTone.value}`}>
                  {formatRiskScore(averageRiskScore)}
                </p>
                <p className={`mt-1 text-[11px] leading-5 ${averageTone.desc}`}>
                  Average risk level across all Devices in this assessment.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div
          className="mt-5 overflow-hidden rounded-md border border-slate-200"
          style={{
            breakInside: "avoid-page",
            pageBreakInside: "avoid",
          }}
        >
          <ul className="divide-y divide-slate-200">
            {sortedDevices.map((device, index) => (
              <li
                key={`${device.task_id}-${index}`}
                className="px-4 py-3 sm:px-5"
                style={{
                  breakInside: "avoid-page",
                  pageBreakInside: "avoid",
                }}
              >
                <div className="flex items-start gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-slate-400" />

                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-medium leading-5 text-slate-900">
                      {device.task_name || "-"}
                    </p>

                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] leading-5 text-slate-600">
                      <span>
                        <span className="font-medium text-slate-700">IP:</span>{" "}
                        {device.ip_address || "-"}
                      </span>

                      <span>
                        <span className="font-medium text-slate-700">Risk:</span>{" "}
                        {formatRiskScore(device.risk_score)}
                      </span>

                      <span>
                        <span className="font-medium text-slate-700">
                          Vulnerabilities:
                        </span>{" "}
                        {formatVulnerabilityTotal(device.vulnerability_total)}
                      </span>
                    </div>

                    {device.firmware_version ? (
                      <p className="mt-1 text-[10.5px] leading-5 text-slate-500">
                        Firmware: {truncateText(device.firmware_version, 95)}
                      </p>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-3 text-[11px] leading-5 text-slate-500">
          Note: The list is ordered by risk score in descending order.
        </p>
      </div>
    </section>
  );
};

export default TopDeviceRiskReport;