import React, { useEffect, useMemo, useState } from "react";
import {
  FiAlertOctagon,
  FiAlertTriangle,
  FiMinusCircle,
  FiShield,
  FiInfo,
  FiRadio,
  FiActivity,
  FiLayers,
} from "react-icons/fi";
import { ConfigProvider, Select } from "antd";
import type { SelectProps } from "antd";

import {
  ListTaskVulnSummary,
  type TaskVulnSummaryDTO,
} from "../../../services";

type SeverityKey = "Critical" | "High" | "Medium" | "Low" | "Info";

type StatCard = {
  id: number;
  title: SeverityKey;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  accent: string;
  softAccent: string;
  dot: string;
  bg: string;
  ring: string;
  glow: string;
  pill: string;
  bar: string;
  iconBox: string;
  chip: string;
};

const Value: React.FC = () => {
  const [rows, setRows] = useState<TaskVulnSummaryDTO[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedTask, setSelectedTask] = useState<string>("all");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        const res = await ListTaskVulnSummary();
        if (!alive) return;
        setRows(Array.isArray(res) ? res : []);
      } catch (error) {
        console.error("Failed to load vulnerability summary:", error);
        if (!alive) return;
        setRows([]);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const taskOptions = useMemo(() => {
    const names = rows
      .map((r) => ({
        task_id: String(r.task_id ?? ""),
        task_name: String(r.task_name ?? "").trim(),
      }))
      .filter((r) => r.task_name !== "");

    const uniqueMap = new Map<string, { task_id: string; task_name: string }>();

    for (const item of names) {
      if (!uniqueMap.has(item.task_name)) {
        uniqueMap.set(item.task_name, item);
      }
    }

    return Array.from(uniqueMap.values());
  }, [rows]);

  const selectOptions: SelectProps["options"] = useMemo(() => {
    return [
      { value: "all", label: "All Tasks" },
      ...taskOptions.map((task) => ({
        value: task.task_name,
        label: task.task_name,
      })),
    ];
  }, [taskOptions]);

  const filteredRows = useMemo(() => {
    if (selectedTask === "all") return rows;
    return rows.filter((r) => String(r.task_name ?? "") === selectedTask);
  }, [rows, selectedTask]);

  const totals = useMemo(() => {
    let critical = 0;
    let high = 0;
    let medium = 0;
    let low = 0;
    let info = 0;

    for (const r of filteredRows) {
      critical += Number(r.critical || 0);
      high += Number(r.high || 0);
      medium += Number(r.medium || 0);
      low += Number(r.low || 0);
      info += Number(r.info || 0);
    }

    const totalAll = critical + high + medium + low + info;

    return { totalAll, critical, high, medium, low, info };
  }, [filteredRows]);

  const percent = (n: number) => {
    if (!totals.totalAll) return 0;
    return Math.round((n / totals.totalAll) * 100);
  };

  const makeSubtitle = (n: number) => {
    if (loading) return "Synchronizing scan telemetry...";
    if (!totals.totalAll) return "No findings in selected scope";
    return `${percent(n)}% of total findings`;
  };

  const barWidth = (n: number) => `${percent(n)}%`;

  const highestSeverity = useMemo<SeverityKey>(() => {
    if (totals.critical > 0) return "Critical";
    if (totals.high > 0) return "High";
    if (totals.medium > 0) return "Medium";
    if (totals.low > 0) return "Low";
    return "Info";
  }, [totals]);

  const selectedScopeLabel = useMemo(() => {
    if (loading) return "Loading scope...";
    if (selectedTask === "all") return "All Tasks";
    return selectedTask;
  }, [loading, selectedTask]);

  const stats: StatCard[] = useMemo(
    () => [
      {
        id: 1,
        title: "Critical",
        value: loading ? "..." : totals.critical.toLocaleString(),
        subtitle: makeSubtitle(totals.critical),
        icon: <FiAlertOctagon />,
        accent: "#ef4444",
        softAccent: "#fb7185",
        dot: "bg-red-500",
        bg: [
          "bg-[radial-gradient(circle_at_top_right,rgba(239,68,68,0.18),transparent_34%),linear-gradient(135deg,#fff5f5_0%,#ffe4e6_45%,#fecdd3_100%)]",
          "dark:bg-[radial-gradient(circle_at_top_right,rgba(251,113,133,0.16),transparent_34%),linear-gradient(135deg,#120408_0%,#3a0a12_45%,#7f1d1d_100%)]",
        ].join(" "),
        ring: [
          "border border-rose-200/75 ring-1 ring-rose-300/35",
          "dark:border-white/10 dark:ring-rose-400/20",
        ].join(" "),
        glow: [
          "shadow-[0_8px_20px_-16px_rgba(239,68,68,0.22)]",
          "dark:shadow-[0_12px_28px_-16px_rgba(239,68,68,0.42)]",
        ].join(" "),
        pill: [
          "bg-white/75 text-rose-700 border border-rose-200/80",
          "dark:bg-white/10 dark:text-white dark:border-white/15",
        ].join(" "),
        bar: "bg-gradient-to-r from-[#fb7185] via-[#ef4444] to-[#991b1b]",
        iconBox: [
          "bg-white/75 border border-rose-200/80 text-rose-700",
          "dark:bg-white/10 dark:border-white/10 dark:text-white",
        ].join(" "),
        chip: [
          "bg-red-50 border-red-200 text-red-600",
          "dark:bg-red-500/10 dark:border-red-400/20 dark:text-red-300",
        ].join(" "),
      },
      {
        id: 2,
        title: "High",
        value: loading ? "..." : totals.high.toLocaleString(),
        subtitle: makeSubtitle(totals.high),
        icon: <FiAlertTriangle />,
        accent: "#f97316",
        softAccent: "#fdba74",
        dot: "bg-orange-500",
        bg: [
          "bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.18),transparent_34%),linear-gradient(135deg,#fff7ed_0%,#ffedd5_45%,#fed7aa_100%)]",
          "dark:bg-[radial-gradient(circle_at_top_right,rgba(253,186,116,0.16),transparent_34%),linear-gradient(135deg,#0f0703_0%,#3a1607_45%,#9a3412_100%)]",
        ].join(" "),
        ring: [
          "border border-orange-200/75 ring-1 ring-orange-300/35",
          "dark:border-white/10 dark:ring-orange-300/20",
        ].join(" "),
        glow: [
          "shadow-[0_8px_20px_-16px_rgba(249,115,22,0.22)]",
          "dark:shadow-[0_12px_28px_-16px_rgba(249,115,22,0.42)]",
        ].join(" "),
        pill: [
          "bg-white/75 text-orange-700 border border-orange-200/80",
          "dark:bg-white/10 dark:text-white dark:border-white/15",
        ].join(" "),
        bar: "bg-gradient-to-r from-[#fdba74] via-[#f97316] to-[#c2410c]",
        iconBox: [
          "bg-white/75 border border-orange-200/80 text-orange-700",
          "dark:bg-white/10 dark:border-white/10 dark:text-white",
        ].join(" "),
        chip: [
          "bg-orange-50 border-orange-200 text-orange-600",
          "dark:bg-orange-500/10 dark:border-orange-400/20 dark:text-orange-300",
        ].join(" "),
      },
      {
        id: 3,
        title: "Medium",
        value: loading ? "..." : totals.medium.toLocaleString(),
        subtitle: makeSubtitle(totals.medium),
        icon: <FiInfo />,
        accent: "#eab308",
        softAccent: "#fde68a",
        dot: "bg-yellow-500",
        bg: [
          "bg-[radial-gradient(circle_at_top_right,rgba(234,179,8,0.18),transparent_34%),linear-gradient(135deg,#fffbeb_0%,#fef3c7_45%,#fde68a_100%)]",
          "dark:bg-[radial-gradient(circle_at_top_right,rgba(253,230,138,0.14),transparent_34%),linear-gradient(135deg,#0f0b02_0%,#2a1a05_45%,#854d0e_100%)]",
        ].join(" "),
        ring: [
          "border border-amber-200/75 ring-1 ring-amber-300/35",
          "dark:border-white/10 dark:ring-amber-300/20",
        ].join(" "),
        glow: [
          "shadow-[0_8px_20px_-16px_rgba(234,179,8,0.20)]",
          "dark:shadow-[0_12px_28px_-16px_rgba(250,204,21,0.34)]",
        ].join(" "),
        pill: [
          "bg-white/75 text-amber-800 border border-amber-200/80",
          "dark:bg-white/10 dark:text-white dark:border-white/15",
        ].join(" "),
        bar: "bg-gradient-to-r from-[#fde68a] via-[#facc15] to-[#a16207]",
        iconBox: [
          "bg-white/75 border border-amber-200/80 text-amber-800",
          "dark:bg-white/10 dark:border-white/10 dark:text-white",
        ].join(" "),
        chip: [
          "bg-yellow-50 border-yellow-200 text-yellow-700",
          "dark:bg-yellow-500/10 dark:border-yellow-400/20 dark:text-yellow-300",
        ].join(" "),
      },
      {
        id: 4,
        title: "Low",
        value: loading ? "..." : totals.low.toLocaleString(),
        subtitle: makeSubtitle(totals.low),
        icon: <FiMinusCircle />,
        accent: "#22c55e",
        softAccent: "#86efac",
        dot: "bg-green-500",
        bg: [
          "bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.18),transparent_34%),linear-gradient(135deg,#ecfdf5_0%,#d1fae5_45%,#a7f3d0_100%)]",
          "dark:bg-[radial-gradient(circle_at_top_right,rgba(134,239,172,0.14),transparent_34%),linear-gradient(135deg,#03120b_0%,#052e1e_45%,#065f46_100%)]",
        ].join(" "),
        ring: [
          "border border-emerald-200/75 ring-1 ring-emerald-300/35",
          "dark:border-white/10 dark:ring-emerald-300/20",
        ].join(" "),
        glow: [
          "shadow-[0_8px_20px_-16px_rgba(34,197,94,0.20)]",
          "dark:shadow-[0_12px_28px_-16px_rgba(34,197,94,0.34)]",
        ].join(" "),
        pill: [
          "bg-white/75 text-emerald-800 border border-emerald-200/80",
          "dark:bg-white/10 dark:text-white dark:border-white/15",
        ].join(" "),
        bar: "bg-gradient-to-r from-[#86efac] via-[#22c55e] to-[#15803d]",
        iconBox: [
          "bg-white/75 border border-emerald-200/80 text-emerald-800",
          "dark:bg-white/10 dark:border-white/10 dark:text-white",
        ].join(" "),
        chip: [
          "bg-green-50 border-green-200 text-green-700",
          "dark:bg-green-500/10 dark:border-green-400/20 dark:text-green-300",
        ].join(" "),
      },
      {
        id: 5,
        title: "Info",
        value: loading ? "..." : totals.info.toLocaleString(),
        subtitle: makeSubtitle(totals.info),
        icon: <FiShield />,
        accent: "#3b82f6",
        softAccent: "#7dd3fc",
        dot: "bg-blue-500",
        bg: [
          "bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.18),transparent_34%),linear-gradient(135deg,#eff6ff_0%,#dbeafe_45%,#bfdbfe_100%)]",
          "dark:bg-[radial-gradient(circle_at_top_right,rgba(125,211,252,0.14),transparent_34%),linear-gradient(135deg,#020b16_0%,#06243a_45%,#075985_100%)]",
        ].join(" "),
        ring: [
          "border border-sky-200/75 ring-1 ring-sky-300/35",
          "dark:border-white/10 dark:ring-sky-300/20",
        ].join(" "),
        glow: [
          "shadow-[0_8px_20px_-16px_rgba(56,189,248,0.20)]",
          "dark:shadow-[0_12px_28px_-16px_rgba(56,189,248,0.34)]",
        ].join(" "),
        pill: [
          "bg-white/75 text-sky-800 border border-sky-200/80",
          "dark:bg-white/10 dark:text-white dark:border-white/15",
        ].join(" "),
        bar: "bg-gradient-to-r from-[#7dd3fc] via-[#38bdf8] to-[#0284c7]",
        iconBox: [
          "bg-white/75 border border-sky-200/80 text-sky-800",
          "dark:bg-white/10 dark:border-white/10 dark:text-white",
        ].join(" "),
        chip: [
          "bg-blue-50 border-blue-200 text-blue-700",
          "dark:bg-blue-500/10 dark:border-blue-400/20 dark:text-blue-300",
        ].join(" "),
      },
    ],
    [loading, totals]
  );

  return (
    <section
      className={[
        "relative overflow-hidden rounded-[22px] p-1.5 sm:p-2",
        "bg-white border border-gray-200/80 shadow-sm",
        "dark:bg-white/5 dark:border-white/10 dark:ring-1 dark:ring-white/10 dark:shadow-none",
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-14 -right-12 h-28 w-28 rounded-full bg-cyan-400/8 blur-3xl" />
        <div className="absolute -bottom-14 -left-12 h-28 w-28 rounded-full bg-violet-500/8 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.045]">
          <div
            className="h-full w-full"
            style={{
              backgroundImage: `
                linear-gradient(to right, currentColor 1px, transparent 1px),
                linear-gradient(to bottom, currentColor 1px, transparent 1px)
              `,
              backgroundSize: "24px 24px",
            }}
          />
        </div>
      </div>

      <div className="relative z-10">
        <div className="mb-2 flex flex-col gap-1.5">
          <div className="flex flex-col gap-1.5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-1.5">
              <div
                className={[
                  "inline-flex items-center gap-1.5 rounded-full px-2 py-1",
                  "bg-cyan-50 text-cyan-700 border border-cyan-200/80",
                  "dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-400/20",
                ].join(" ")}
              >
                <FiShield className="text-[10px]" />
                <span className="text-[10px] font-semibold tracking-wide">
                  Security Severity Matrix
                </span>
              </div>

              <div
                className={[
                  "inline-flex items-center gap-1.5 rounded-full px-2 py-1",
                  "bg-slate-50 text-slate-600 border border-slate-200/80",
                  "dark:bg-white/5 dark:text-white/65 dark:border-white/10",
                ].join(" ")}
              >
                <FiRadio className="text-[10px] text-cyan-500" />
                <span className="text-[10px] font-medium">
                  {loading ? "Scanner Syncing" : `${highestSeverity} activity detected`}
                </span>
              </div>

              <div
                className={[
                  "inline-flex items-center gap-1.5 rounded-full px-2 py-1",
                  "bg-slate-50 text-slate-600 border border-slate-200/80",
                  "dark:bg-white/5 dark:text-white/65 dark:border-white/10",
                ].join(" ")}
              >
                <FiActivity className="text-[10px] text-violet-500" />
                <span className="text-[10px] font-medium">
                  {loading
                    ? "Fetching telemetry..."
                    : `${totals.totalAll.toLocaleString()} total findings`}
                </span>
              </div>

              <div
                className={[
                  "inline-flex items-center gap-1.5 rounded-full px-2 py-1",
                  "bg-linear-to-r from-cyan-50 via-sky-50 to-violet-50",
                  "text-slate-700 border border-cyan-200/70 shadow-[0_8px_20px_-16px_rgba(6,182,212,0.35)]",
                  "dark:from-cyan-500/10 dark:via-sky-500/10 dark:to-violet-500/10",
                  "dark:text-cyan-100 dark:border-cyan-400/20",
                  "backdrop-blur-md",
                ].join(" ")}
              >
                <div className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-white/80 text-cyan-600 dark:bg-white/10 dark:text-cyan-300">
                  <FiLayers className="text-[9px]" />
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[8.5px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-white/50">
                    Scope
                  </span>
                  <span className="h-1 w-1 rounded-full bg-cyan-500" />
                  <span className="max-w-32 truncate text-[10px] font-semibold sm:max-w-36">
                    {selectedScopeLabel}
                  </span>
                </div>
              </div>
            </div>

            <div className="w-full xl:w-auto">
              <ConfigProvider
                theme={{
                  token: {
                    colorPrimary: "#e2e8f0",
                    borderRadius: 14,
                    colorBgElevated: "#ffffff",
                    colorBorder: "#e5e7eb",
                    boxShadowSecondary:
                      "0 12px 28px -20px rgba(15,23,42,0.12)",
                    colorText: "#334155",
                    colorTextPlaceholder: "#94a3b8",
                    controlHeightLG: 34,
                    fontSize: 11,
                  },
                  components: {
                    Select: {
                      activeBorderColor: "#dbeafe",
                      hoverBorderColor: "#cbd5e1",
                      optionSelectedBg: "#f8fafc",
                      optionActiveBg: "#f1f5f9",
                      optionSelectedColor: "#0f172a",
                    },
                  },
                }}
              >
                <div className="relative w-full xl:min-w-55">
                  <Select
                    value={selectedTask}
                    onChange={(value) => setSelectedTask(value)}
                    options={selectOptions}
                    popupMatchSelectWidth
                    showSearch={false}
                    size="large"
                    variant="outlined"
                    suffixIcon={
                      <span
                        style={{
                          color: "#94a3b8",
                          fontSize: 10,
                          lineHeight: 1,
                          pointerEvents: "none",
                        }}
                      >
                        ▾
                      </span>
                    }
                    style={{
                      width: "100%",
                      background: "transparent",
                    }}
                    styles={{
                      root: {
                        width: "100%",
                      },
                      popup: {
                        root: {
                          padding: 6,
                          borderRadius: 16,
                          border: "1px solid #e5e7eb",
                          overflow: "hidden",
                          boxShadow: "0 12px 28px -20px rgba(15,23,42,0.12)",
                          background: "#ffffff",
                        },
                        list: {
                          padding: 0,
                          background: "#ffffff",
                        },
                        listItem: {
                          minHeight: 34,
                          borderRadius: 10,
                          margin: "3px 0",
                          paddingInline: 12,
                          display: "flex",
                          alignItems: "center",
                          fontSize: 11,
                          fontWeight: 500,
                          color: "#334155",
                          transition: "all 0.18s ease",
                        },
                      },
                    }}
                    classNames={{
                      root: "w-full",
                    }}
                    getPopupContainer={(triggerNode) =>
                      triggerNode.parentElement || document.body
                    }
                    optionRender={(option) => {
                      const isAll = option.data.value === "all";
                      const isSelected = selectedTask === option.data.value;

                      return (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            width: "100%",
                            padding: "1px 0",
                          }}
                        >
                          <div
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: 999,
                              background: isSelected
                                ? "#cbd5e1"
                                : isAll
                                  ? "#cbd5e1"
                                  : "#6366f1",
                              flexShrink: 0,
                            }}
                          />
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: isSelected ? 600 : 500,
                              color: "#334155",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {String(option.data.label)}
                          </span>
                        </div>
                      );
                    }}
                    labelRender={(props) => (
                      <span
                        style={{
                          color: "#334155",
                          fontSize: 11,
                          fontWeight: 500,
                        }}
                      >
                        {props.label}
                      </span>
                    )}
                  />

                  <div
                    className="pointer-events-none absolute inset-0 rounded-[14px]"
                    style={{
                      border: "1px solid #dbeafe",
                      boxShadow: "0 8px 18px -18px rgba(15,23,42,0.10)",
                    }}
                  />
                </div>
              </ConfigProvider>
            </div>
          </div>
        </div>

        {!loading && filteredRows.length === 0 ? (
          <div
            className={[
              "rounded-[18px] border border-dashed p-5 text-center",
              "border-slate-200 bg-slate-50/80 text-slate-500",
              "dark:border-white/10 dark:bg-white/5 dark:text-white/60",
            ].join(" ")}
          >
            <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-2xl bg-white shadow-sm dark:bg-white/10">
              <FiShield className="text-[15px]" />
            </div>
            <h3 className="text-[13px] font-semibold text-slate-700 dark:text-white">
              No vulnerability data found
            </h3>
            <p className="mt-1 text-[10px]">
              ไม่มีข้อมูลสำหรับ task ที่เลือกในขณะนี้
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3 xl:grid-cols-5">
            {stats.map((item) => {
              const rawNumber =
                item.title === "Critical"
                  ? totals.critical
                  : item.title === "High"
                    ? totals.high
                    : item.title === "Medium"
                      ? totals.medium
                      : item.title === "Low"
                        ? totals.low
                        : totals.info;

              const w = loading ? "0%" : barWidth(rawNumber);

              return (
                <div
                  key={item.id}
                  className={[
                    "relative min-w-0 overflow-hidden rounded-2xl p-2 sm:p-2.5",
                    "text-slate-900 dark:text-white",
                    "transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-lg",
                    item.bg,
                    item.ring,
                    item.glow,
                  ].join(" ")}
                >
                  <div
                    className={[
                      "pointer-events-none absolute inset-0 opacity-20",
                      "dark:opacity-15",
                      "[background:linear-gradient(to_right,rgba(15,23,42,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.08)_1px,transparent_1px)]",
                      "dark:[background:linear-gradient(to_right,rgba(255,255,255,0.10)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.10)_1px,transparent_1px)]",
                      "bg-size-[16px_16px]",
                    ].join(" ")}
                  />
                  <div className="pointer-events-none absolute -top-10 -right-10 h-24 w-24 rounded-full bg-white/28 blur-3xl dark:bg-white/10" />
                  <div
                    className="pointer-events-none absolute left-0 top-0 h-1 w-full"
                    style={{
                      background: `linear-gradient(90deg, ${item.softAccent}, ${item.accent})`,
                    }}
                  />

                  <div className="relative flex min-h-31.5 flex-col justify-between sm:min-h-33">
                    <div className="flex min-w-0 items-start justify-between gap-1">
                      <div className="flex min-w-0 items-start gap-1.5">
                        <div
                          className={[
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-[14px] text-[13px]",
                            item.iconBox,
                          ].join(" ")}
                        >
                          {item.icon}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`h-1.5 w-1.5 rounded-full ${item.dot}`} />
                            <h3 className="min-w-0 truncate text-[10px] font-semibold leading-[1.1] tracking-wide sm:text-[10.5px]">
                              {item.title}
                            </h3>
                          </div>

                          <p className="mt-0.5 truncate text-[8.5px] text-slate-700/80 dark:text-white/75">
                            Network scan severity
                          </p>
                        </div>
                      </div>

                      <span
                        className={[
                          "inline-flex h-4.5 shrink-0 items-center justify-center rounded-full px-1.5",
                          "border text-[8px] font-medium backdrop-blur",
                          item.pill,
                        ].join(" ")}
                      >
                        {loading ? "Sync" : `${percent(rawNumber)}%`}
                      </span>
                    </div>

                    <div className="mt-1.5">
                      <div className="flex items-end justify-between gap-1.5">
                        <p className="truncate text-[13px] font-semibold leading-none tracking-tight sm:text-[14px] xl:text-[15px]">
                          {item.value}
                        </p>

                        <span
                          className={[
                            "shrink-0 rounded-full border px-1.5 py-0.5 text-[7.5px] font-semibold transition-all duration-300",
                            item.chip,
                          ].join(" ")}
                        >
                          {loading ? "Loading" : rawNumber > 0 ? "Detected" : "Clear"}
                        </span>
                      </div>

                      <p className="mt-0.5 text-[8.5px] leading-3.5 text-slate-700/80 dark:text-white/80 sm:text-[9px]">
                        {item.subtitle}
                      </p>
                    </div>

                    <div className="mt-1.5">
                      <div className="mb-1 flex items-center justify-between text-[8px] text-slate-700/75 dark:text-white/65">
                        <span>Scan intensity</span>
                        <span>{loading ? "..." : `${percent(rawNumber)}%`}</span>
                      </div>

                      <div className="h-1.5 w-full overflow-hidden rounded-full border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/10">
                        <div
                          className={[
                            "h-full rounded-full transition-all duration-700 ease-out",
                            item.bar,
                          ].join(" ")}
                          style={{ width: w }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default Value;