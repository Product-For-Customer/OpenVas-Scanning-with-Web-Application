import React, { useEffect, useMemo, useState } from "react";
import Chart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";
import {
  FiRefreshCw,
  FiAlertCircle,
  FiCheckCircle,
  FiSlash,
  FiRotateCw,
  FiAlertTriangle,
  FiBell,
  FiLock,
  FiServer,
} from "react-icons/fi";
import { type HistoryNotifyResponse } from "../../../services";
import { useLanguage } from "../../../contexts/LanguageContext";

type StatusKey =
  | "Update Completed"
  | "No Update"
  | "Already Running"
  | "Update Failed"
  | "Status Notification"
  | "Unauthorized"
  | "Server Error"
  | "Timeout";

const normalizeText = (value?: string | null) => (value || "").trim();

const normalizeStatus = (status?: string | null): StatusKey => {
  const normalized = normalizeText(status).toLowerCase();

  if (normalized === "update completed") return "Update Completed";
  if (normalized === "no update") return "No Update";
  if (normalized === "already running") return "Already Running";
  if (normalized === "update failed") return "Update Failed";
  if (normalized === "status notification") return "Status Notification";
  if (normalized === "unauthorized") return "Unauthorized";
  if (normalized === "server error") return "Server Error";
  if (normalized === "timeout") return "Timeout";

  if (normalized === "update") return "Update Completed";
  if (normalized === "alert") return "Status Notification";
  if (normalized === "failed") return "Update Failed";
  if (normalized === "completed") return "Update Completed";
  if (normalized === "running") return "Already Running";

  return "Status Notification";
};

const cardClass = [
  "h-full p-4 sm:p-5",
  "rounded-xl border border-slate-200/70 bg-white",
  "dark:border-white/8 dark:bg-[#0d0b1a]/80",
  "flex flex-col",
].join(" ");

const panelClass = [
  "rounded-xl border border-slate-200/70 bg-slate-50/50",
  "dark:border-white/8 dark:bg-white/3",
  "flex flex-col",
].join(" ");

const STATUS_META = {
  completed: {
    label: "Completed",
    icon: <FiCheckCircle className="text-[10px]" />,
    badge:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200",
  },
  noUpdate: {
    label: "No Update",
    icon: <FiSlash className="text-[10px]" />,
    badge:
      "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-400/20 dark:bg-slate-500/10 dark:text-slate-200",
  },
  running: {
    label: "Running",
    icon: <FiRotateCw className="text-[10px]" />,
    badge:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200",
  },
  failed: {
    label: "Failed",
    icon: <FiAlertTriangle className="text-[10px]" />,
    badge:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-200",
  },
  notification: {
    label: "Notification",
    icon: <FiBell className="text-[10px]" />,
    badge:
      "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-500/10 dark:text-cyan-200",
  },
  unauthorized: {
    label: "Unauthorized",
    icon: <FiLock className="text-[10px]" />,
    badge:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/20 dark:bg-violet-500/10 dark:text-violet-200",
  },
  serverError: {
    label: "Server Error",
    icon: <FiServer className="text-[10px]" />,
    badge:
      "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-400/20 dark:bg-fuchsia-500/10 dark:text-fuchsia-200",
  },
  timeout: {
    label: "Timeout",
    icon: <FiAlertCircle className="text-[10px]" />,
    badge:
      "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-400/20 dark:bg-orange-500/10 dark:text-orange-200",
  },
};

type GraphProps = {
  items: HistoryNotifyResponse[];
  loading: boolean;
  refreshing: boolean;
  error: string;
  onRefresh: (showRefresh?: boolean) => Promise<void> | void;
};

const useTabletMobile = () => {
  const [screen, setScreen] = useState({
    isMobile: false,
    isTablet: false,
  });

  useEffect(() => {
    const update = () => {
      const width = window.innerWidth;
      setScreen({
        isMobile: width < 640,
        isTablet: width >= 640 && width < 1280,
      });
    };

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return screen;
};

const GraphIPad: React.FC<GraphProps> = ({ items, loading, error }) => {
  const { t } = useLanguage();
  const { isMobile, isTablet } = useTabletMobile();

  const summaryCount = useMemo(() => {
    const completed = items.filter(
      (item) => normalizeStatus(item.status) === "Update Completed"
    ).length;

    const noUpdate = items.filter(
      (item) => normalizeStatus(item.status) === "No Update"
    ).length;

    const running = items.filter(
      (item) => normalizeStatus(item.status) === "Already Running"
    ).length;

    const failed = items.filter(
      (item) => normalizeStatus(item.status) === "Update Failed"
    ).length;

    const notification = items.filter(
      (item) => normalizeStatus(item.status) === "Status Notification"
    ).length;

    const unauthorized = items.filter(
      (item) => normalizeStatus(item.status) === "Unauthorized"
    ).length;

    const serverError = items.filter(
      (item) => normalizeStatus(item.status) === "Server Error"
    ).length;

    const timeout = items.filter(
      (item) => normalizeStatus(item.status) === "Timeout"
    ).length;

    return {
      completed,
      noUpdate,
      running,
      failed,
      notification,
      unauthorized,
      serverError,
      timeout,
    };
  }, [items]);

  const chartSeries = useMemo(() => {
    return [
      {
        name: "History Notify",
        data: [
          summaryCount.completed,
          summaryCount.noUpdate,
          summaryCount.running,
          summaryCount.failed,
          summaryCount.notification,
          summaryCount.unauthorized,
          summaryCount.serverError,
          summaryCount.timeout,
        ],
      },
    ];
  }, [summaryCount]);

  const chartMax = useMemo(() => {
    const maxValue = Math.max(...chartSeries[0].data, 0);
    if (maxValue <= 5) return 5;
    if (maxValue <= 10) return 10;
    if (maxValue <= 20) return 20;
    if (maxValue <= 50) return 50;
    if (maxValue <= 100) return 100;
    return Math.ceil(maxValue / 20) * 20;
  }, [chartSeries]);

  const chartHeight = useMemo(() => {
    if (isMobile) return 300;
    if (isTablet) return 420;
    return 430;
  }, [isMobile, isTablet]);

  const chartOptions: ApexOptions = useMemo(() => {
    return {
      chart: {
        type: "radar",
        toolbar: { show: false },
        background: "transparent",
        animations: {
          enabled: true,
          easing: "easeinout",
          speed: 700,
        },
      },
      title: {
        text: "Status Distribution Radar",
        align: "left",
        offsetX: isMobile ? 0 : 8,
        style: {
          fontSize: isMobile ? "11px" : "12px",
          fontWeight: 700,
          color: "#0f172a",
        },
      },
      xaxis: {
        categories: [
          "Completed",
          "No Update",
          "Running",
          "Failed",
          "Notification",
          "Unauthorized",
          "Server Error",
          "Timeout",
        ],
        labels: {
          style: {
            colors: [
              "#475569",
              "#475569",
              "#475569",
              "#475569",
              "#475569",
              "#475569",
              "#475569",
              "#475569",
            ],
            fontSize: isMobile ? "7px" : "9px",
            fontWeight: 500,
          },
        },
      },
      yaxis: {
        min: 0,
        max: chartMax,
        tickAmount: isMobile ? 4 : 5,
        labels: {
          formatter: (val: number, index?: number) => {
            if (typeof index === "number" && index % 2 === 0) {
              return String(Math.round(val));
            }
            return "";
          },
          style: {
            colors: ["#64748b"],
            fontSize: isMobile ? "7px" : "9px",
          },
        },
      },
      stroke: {
        width: isMobile ? 1.8 : 2,
        curve: "smooth",
      },
      fill: {
        opacity: 0.22,
      },
      colors: ["#fb7185"],
      markers: {
        size: isMobile ? 2.5 : 3.5,
        colors: ["#ffffff"],
        strokeColor: "#fb4d67",
        strokeWidth: 2,
        hover: {
          size: isMobile ? 3.5 : 4.5,
        },
      },
      dataLabels: {
        enabled: !isMobile,
        background: {
          enabled: true,
          borderRadius: 4,
          padding: 2,
          foreColor: "#ffffff",
          borderWidth: 0,
          opacity: 0.95,
        },
        style: {
          fontSize: isTablet ? "8px" : "9px",
          fontWeight: 700,
          colors: ["#ffffff"],
        },
        formatter: (value: number) => String(value),
        offsetY: -2,
      },
      tooltip: {
        theme: "light",
        y: {
          formatter: (val: number) => `${val}`,
        },
      },
      plotOptions: {
        radar: {
          size: isMobile ? 115 : 180,
          polygons: {
            strokeColors: "#e5e7eb",
            connectorColors: "#e5e7eb",
            fill: {
              colors: ["#fafafa", "#f5f5f5"],
            },
          },
        },
      },
      legend: {
        show: false,
      },
    };
  }, [chartMax, isMobile, isTablet]);

  return (
    <section className={cardClass}>
      <div className="flex h-full flex-col">
        <div className="flex flex-col gap-2.5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-[13px] font-semibold text-slate-700 dark:text-white/80">
                {t("line.scanNotificationStats")}
              </h2>
              <span className="rounded-full border border-slate-200/70 bg-slate-50 px-2.5 py-0.5 text-[10.5px] font-medium text-slate-500 dark:border-white/8 dark:bg-white/5 dark:text-white/40">
                Radar Chart
              </span>
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <div
            className={[
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] sm:text-[9.5px] font-medium",
              STATUS_META.completed.badge,
            ].join(" ")}
          >
            {STATUS_META.completed.icon}
            {STATUS_META.completed.label}:{" "}
            <span className="font-semibold">{summaryCount.completed}</span>
          </div>

          <div
            className={[
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] sm:text-[9.5px] font-medium",
              STATUS_META.noUpdate.badge,
            ].join(" ")}
          >
            {STATUS_META.noUpdate.icon}
            {STATUS_META.noUpdate.label}:{" "}
            <span className="font-semibold">{summaryCount.noUpdate}</span>
          </div>

          <div
            className={[
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] sm:text-[9.5px] font-medium",
              STATUS_META.running.badge,
            ].join(" ")}
          >
            {STATUS_META.running.icon}
            {STATUS_META.running.label}:{" "}
            <span className="font-semibold">{summaryCount.running}</span>
          </div>

          <div
            className={[
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] sm:text-[9.5px] font-medium",
              STATUS_META.failed.badge,
            ].join(" ")}
          >
            {STATUS_META.failed.icon}
            {STATUS_META.failed.label}:{" "}
            <span className="font-semibold">{summaryCount.failed}</span>
          </div>

          <div
            className={[
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] sm:text-[9.5px] font-medium",
              STATUS_META.notification.badge,
            ].join(" ")}
          >
            {STATUS_META.notification.icon}
            {STATUS_META.notification.label}:{" "}
            <span className="font-semibold">{summaryCount.notification}</span>
          </div>

          <div
            className={[
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] sm:text-[9.5px] font-medium",
              STATUS_META.unauthorized.badge,
            ].join(" ")}
          >
            {STATUS_META.unauthorized.icon}
            {STATUS_META.unauthorized.label}:{" "}
            <span className="font-semibold">{summaryCount.unauthorized}</span>
          </div>

          <div
            className={[
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] sm:text-[9.5px] font-medium",
              STATUS_META.serverError.badge,
            ].join(" ")}
          >
            {STATUS_META.serverError.icon}
            {STATUS_META.serverError.label}:{" "}
            <span className="font-semibold">{summaryCount.serverError}</span>
          </div>

          <div
            className={[
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] sm:text-[9.5px] font-medium",
              STATUS_META.timeout.badge,
            ].join(" ")}
          >
            {STATUS_META.timeout.icon}
            {STATUS_META.timeout.label}:{" "}
            <span className="font-semibold">{summaryCount.timeout}</span>
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        )}

        <div
          className={`mt-3.5 ${panelClass} min-h-95 sm:min-h-125`}
        >
          {loading ? (
            <div className="flex h-full items-center justify-center px-5 py-8 text-center">
              <div>
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-500/10 dark:text-cyan-200">
                  <FiRefreshCw className="animate-spin text-[16px]" />
                </div>
                <h3 className="mt-3 text-[13px] font-semibold text-slate-900 dark:text-white/85">
                  Loading radar chart...
                </h3>
                <p className="mt-1 text-[10px] text-slate-500 dark:text-white/55">
                  Please wait while we analyze the status distribution.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col p-3 sm:p-3.5">
              <div className="min-h-0 flex-1">
                <div className="mx-auto w-full max-w-full">
                  <Chart
                    options={chartOptions}
                    series={chartSeries}
                    type="radar"
                    height={chartHeight}
                  />
                </div>
              </div>

              <div className="mt-auto pt-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] leading-5 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-white/60">
                  This graph counts the total number of data points obtained
                  from ListHistoryNotify and distributes them across each status
                  to provide a clearer overview.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default GraphIPad;