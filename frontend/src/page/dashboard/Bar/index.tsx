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
} from "recharts";
import { FiShield, FiActivity } from "react-icons/fi";
import { ConfigProvider, Select } from "antd";
import type { SelectProps } from "antd";

import {
  ListTaskVulnSummary,
  type TaskVulnSummaryDTO,
} from "../../../services";

type SeverityName = "Critical" | "High" | "Medium" | "Low" | "Info";

type SeverityRow = {
  name: SeverityName;
  current: number;
};

const severityColors: Record<SeverityName, string> = {
  Critical: "#ef4444",
  High: "#f97316",
  Medium: "#eab308",
  Low: "#22c55e",
  Info: "#3b82f6",
};

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
}) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div
      className={[
        "rounded-2xl px-4 py-3 shadow-xl border min-w-45",
        "border-slate-200 bg-white/95 backdrop-blur-sm",
        "dark:border-white/10 dark:bg-[#0B1220]/95 dark:shadow-none",
      ].join(" ")}
    >
      <p className="text-[13px] font-semibold text-[#1f2240] dark:text-white/90 mb-2">
        {label}
      </p>

      {payload.map((item, index) => (
        <div
          key={index}
          className="flex items-center justify-between gap-3 text-[12px]"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-gray-500 dark:text-white/55 truncate">
              Findings
            </span>
          </div>

          <span className="font-semibold text-[#1f2240] dark:text-white/85 tabular-nums">
            {Number(item.value || 0).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
};

const BarSeverityChart: React.FC = () => {
  const [rows, setRows] = useState<TaskVulnSummaryDTO[]>([]);
  const [loading, setLoading] = useState(true);
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
        console.error("Failed to load severity summary:", error);
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
      .map((item) => ({
        task_id: String((item as any).task_id ?? ""),
        task_name: String((item as any).task_name ?? "").trim(),
      }))
      .filter((item) => item.task_name !== "");

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
    return rows.filter(
      (item) => String((item as any).task_name ?? "").trim() === selectedTask
    );
  }, [rows, selectedTask]);

  const totals = useMemo(() => {
    let critical = 0;
    let high = 0;
    let medium = 0;
    let low = 0;
    let info = 0;

    for (const r of filteredRows) {
      critical += Number((r as any).critical || 0);
      high += Number((r as any).high || 0);
      medium += Number((r as any).medium || 0);
      low += Number((r as any).low || 0);
      info += Number((r as any).info || 0);
    }

    return { critical, high, medium, low, info };
  }, [filteredRows]);

  const data: SeverityRow[] = useMemo(
    () => [
      { name: "Critical", current: totals.critical },
      { name: "High", current: totals.high },
      { name: "Medium", current: totals.medium },
      { name: "Low", current: totals.low },
      { name: "Info", current: totals.info },
    ],
    [totals]
  );

  const totalAll = useMemo(
    () => totals.critical + totals.high + totals.medium + totals.low + totals.info,
    [totals]
  );

  const subtitle = useMemo(() => {
    if (loading) return "Syncing latest severity telemetry...";
    return `Latest scan snapshot • Total findings: ${totalAll.toLocaleString()}`;
  }, [loading, totalAll]);

  return (
    <section
      className={[
        "relative overflow-hidden h-full rounded-[22px] p-4 sm:p-5 md:p-6 flex flex-col",
        "bg-white border border-gray-200/80 shadow-sm",
        "dark:bg-white/5 dark:border-white/10 dark:ring-1 dark:ring-white/10 dark:shadow-none",
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-16 -right-12 h-44 w-44 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute -bottom-16 -left-12 h-44 w-44 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.04] dark:opacity-[0.06]">
          <div
            className="h-full w-full"
            style={{
              backgroundImage: `
                linear-gradient(to right, currentColor 1px, transparent 1px),
                linear-gradient(to bottom, currentColor 1px, transparent 1px)
              `,
              backgroundSize: "28px 28px",
            }}
          />
        </div>
      </div>

      <div className="relative z-10 flex h-full flex-col">
        <div className="flex flex-col gap-4 mb-4 sm:mb-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <div
                  className={[
                    "inline-flex items-center gap-2 rounded-full px-3 py-1.5",
                    "bg-cyan-50 text-cyan-700 border border-cyan-200/80",
                    "dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-400/20",
                  ].join(" ")}
                >
                  <FiShield className="text-[14px]" />
                  <span className="text-[12px] font-semibold tracking-wide">
                    Vulnerability Monitor
                  </span>
                </div>             
              </div>

              <h2 className="text-[20px] sm:text-[22px] font-semibold text-[#1f2240] dark:text-white/90 tracking-tight">
                Vulnerability
              </h2>
              <p className="mt-1 text-[12.5px] text-gray-500 dark:text-white/55">
                {subtitle}
              </p>
            </div>

            <div className="w-full sm:w-auto flex flex-col items-stretch sm:items-end gap-3">
              <div className="w-full sm:w-auto">
                <ConfigProvider
                  theme={{
                    token: {
                      colorPrimary: "#e2e8f0",
                      borderRadius: 20,
                      colorBgElevated: "#ffffff",
                      colorBorder: "#e5e7eb",
                      boxShadowSecondary:
                        "0 16px 40px -20px rgba(15,23,42,0.12)",
                      colorText: "#334155",
                      colorTextPlaceholder: "#94a3b8",
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
                  <div className="relative w-full sm:min-w-52">
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
                            fontSize: 13,
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
                            padding: 8,
                            borderRadius: 22,
                            border: "1px solid #e5e7eb",
                            overflow: "hidden",
                            boxShadow:
                              "0 16px 40px -20px rgba(15,23,42,0.12)",
                            background: "#ffffff",
                          },
                          list: {
                            padding: 0,
                            background: "#ffffff",
                          },
                          listItem: {
                            minHeight: 42,
                            borderRadius: 14,
                            margin: "4px 0",
                            paddingInline: 14,
                            display: "flex",
                            alignItems: "center",
                            fontSize: 13,
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
                              gap: 10,
                              width: "100%",
                              padding: "2px 0",
                            }}
                          >
                            <div
                              style={{
                                width: 8,
                                height: 8,
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
                                fontSize: 13,
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
                            fontSize: 13,
                            fontWeight: 500,
                          }}
                        >
                          {props.label}
                        </span>
                      )}
                    />

                    <div
                      className="pointer-events-none absolute inset-0 rounded-[20px]"
                      style={{
                        border: "1px solid #dbeafe",
                        boxShadow: "0 8px 24px -18px rgba(15,23,42,0.10)",
                      }}
                    />
                  </div>
                </ConfigProvider>
              </div>
            </div>
          </div>

          <div
            className={[
              "rounded-2xl px-4 py-3 flex flex-wrap items-center gap-3",
              "bg-slate-50 border border-slate-200/80",
              "dark:bg-white/4 dark:border-white/10",
            ].join(" ")}
          >
            <div className="inline-flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-500" />
              </span>
              <span className="text-[12px] font-medium text-slate-700 dark:text-white/75">
                Severity telemetry active
              </span>
            </div>

            <div className="hidden sm:block h-4 w-px bg-slate-200 dark:bg-white/10" />

            <div className="inline-flex items-center gap-2 text-[12px] text-slate-500 dark:text-white/50">
              <FiActivity className="text-cyan-500" />
              Distribution of findings by severity level
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-65">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 8, right: 10, left: 0, bottom: 18 }}
              barCategoryGap="26%"
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#e5e7eb"
                className="dark:opacity-20"
              />

              <XAxis
                dataKey="name"
                tick={{ fill: "#64748b", fontSize: 12 }}
                axisLine={{ stroke: "#e5e7eb" }}
                tickLine={false}
                angle={-28}
                textAnchor="end"
                height={55}
              />

              <YAxis
                tick={{ fill: "#64748b", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={42}
                domain={[0, "dataMax + 6"]}
              />

              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
              />

              <Bar
                dataKey="current"
                name="Findings"
                radius={[10, 10, 0, 0]}
                maxBarSize={34}
                isAnimationActive
                animationDuration={700}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${entry.name}-${index}`}
                    fill={severityColors[entry.name]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
};

export default BarSeverityChart;