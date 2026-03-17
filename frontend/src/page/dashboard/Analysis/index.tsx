import React, { useEffect, useMemo, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import {
  FiShield,
} from "react-icons/fi";
import { ConfigProvider, Select } from "antd";
import type { SelectProps } from "antd";
import {
  ListTaskVulnSummary,
  type TaskVulnSummaryDTO,
} from "../../../services";

type SeverityKey = "Critical" | "High" | "Medium" | "Low" | "Info";

type SeverityItem = {
  name: SeverityKey;
  value: number;
  color: string;
};

const COLORS: Record<SeverityKey, string> = {
  Critical: "#ef4444",
  High: "#f97316",
  Medium: "#eab308",
  Low: "#22c55e",
  Info: "#3b82f6",
};

const formatPercent = (percent: number) => `${(percent * 100).toFixed(0)}%`;

type CustomTooltipProps = {
  active?: boolean;
  payload?: Array<{ payload?: SeverityItem }>;
  total: number;
};

const CustomTooltip: React.FC<CustomTooltipProps> = ({
  active,
  payload,
  total,
}) => {
  if (!active || !payload || payload.length === 0) return null;

  const item = payload[0]?.payload as SeverityItem | undefined;
  if (!item) return null;

  const percent = total > 0 ? item.value / total : 0;

  return (
    <div
      className="rounded-2xl px-4 py-3 shadow-2xl text-white text-[13px] font-semibold border border-white/10 backdrop-blur-sm"
      style={{
        background: `linear-gradient(135deg, ${item.color}, ${item.color}dd)`,
        minWidth: 200,
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="truncate">{item.name}</span>
        <span className="tabular-nums">{item.value.toLocaleString()}</span>
      </div>
      <div className="mt-1.5 text-[12px] font-medium text-white/90">
        {formatPercent(percent)} of total findings
      </div>
    </div>
  );
};

const DeliveryAnalysis: React.FC = () => {
  const [rows, setRows] = useState<TaskVulnSummaryDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<string>("all");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        const res = await ListTaskVulnSummary();
        console.log("Fetched vulnerability summary:", res);
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

    return { critical, high, medium, low, info };
  }, [filteredRows]);

  const data = useMemo<SeverityItem[]>(() => {
    const items: SeverityItem[] = [
      { name: "Critical", value: totals.critical, color: COLORS.Critical },
      { name: "High", value: totals.high, color: COLORS.High },
      { name: "Medium", value: totals.medium, color: COLORS.Medium },
      { name: "Low", value: totals.low, color: COLORS.Low },
      { name: "Info", value: totals.info, color: COLORS.Info },
    ];

    const nonZero = items.filter((i) => i.value > 0);
    return nonZero.length > 0 ? nonZero : items;
  }, [totals]);

  const total = useMemo(() => {
    return data.reduce((sum, d) => sum + d.value, 0);
  }, [data]);

  return (
    <section
      className={[
        "relative overflow-hidden rounded-3xl p-4 sm:p-5 md:p-6 h-full",
        "bg-white border border-slate-200/80 shadow-[0_12px_40px_rgba(15,23,42,0.06)]",
        "dark:bg-[#08111f]/95 dark:border-white/10 dark:shadow-none",
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 -right-16 h-52 w-52 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute -bottom-20 -left-16 h-52 w-52 rounded-full bg-violet-500/10 blur-3xl" />
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

      <div className="relative z-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-3 mt-1">
              <div
                className={[
                  "inline-flex items-center gap-2 rounded-full px-3 py-1.5",
                  "bg-cyan-50 text-cyan-700 border border-cyan-200/80",
                  "dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-400/20",
                ].join(" ")}
              >
                <FiShield className="text-[14px]" />
                <span className="text-[12px] font-semibold tracking-wide">
                  Total Vulnerability Scanner
                </span>
              </div>
            </div>
          </div>

          <div className="w-full sm:w-auto">

            <ConfigProvider
              theme={{
                token: {
                  colorPrimary: "#e2e8f0",
                  borderRadius: 20,
                  colorBgElevated: "#ffffff",
                  colorBorder: "#e5e7eb",
                  boxShadowSecondary: "0 16px 40px -20px rgba(15,23,42,0.12)",
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
              <div className="relative w-full sm:min-w-75">
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
                        boxShadow: "0 16px 40px -20px rgba(15,23,42,0.12)",
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

        <div
          className={[
            "mt-5 rounded-2xl px-4 py-3 flex flex-wrap items-center gap-3",
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
              Scanner Telemetry Active
            </span>
          </div>

          <div className="hidden sm:block h-4 w-px bg-slate-200 dark:bg-white/10" />

          <div className="text-[12px] text-slate-500 dark:text-white/50">
            {selectedTask === "all"
              ? "Severity distribution across the latest imported scan results"
              : `Severity distribution for ${selectedTask}`}
          </div>
        </div>

        <div className="mt-5 sm:mt-6 h-72 sm:h-80 relative">
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400/10 blur-2xl dark:bg-cyan-400/10" />

          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              className={[
                "rounded-full h-28 w-28 sm:h-32 sm:w-32 flex flex-col items-center justify-center text-center",
                "bg-white/90 border border-slate-200 shadow-sm",
                "dark:bg-[#0b1728]/80 dark:border-white/10 dark:shadow-none backdrop-blur-md",
              ].join(" ")}
            >
              <div className="text-[22px] sm:text-[28px] font-semibold text-slate-900 dark:text-white/90 tabular-nums leading-none">
                {loading ? "..." : total.toLocaleString()}
              </div>
              <div className="mt-2 text-[11px] sm:text-[12px] text-slate-500 dark:text-white/55">
                Total Findings
              </div>
            </div>
          </div>

          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                content={(props: any) => (
                  <CustomTooltip {...props} total={total} />
                )}
                cursor={false}
              />
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius="58%"
                outerRadius="84%"
                paddingAngle={3}
                stroke="rgba(255,255,255,0.95)"
                strokeWidth={3}
                isAnimationActive
                animationDuration={800}
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 sm:mt-5">
          <div
            className={[
              "rounded-2xl px-4 py-3",
              "bg-white border border-gray-200/80",
              "dark:bg-white/5 dark:border-white/10",
            ].join(" ")}
          >
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
              {(["Critical", "High", "Medium"] as SeverityKey[]).map((k) => {
                const item = data.find((d) => d.name === k) || {
                  name: k,
                  value: 0,
                  color: COLORS[k],
                };
                const p = total > 0 ? item.value / total : 0;

                return (
                  <div key={k} className="flex items-center gap-2">
                    <span
                      className="h-4 w-4 rounded-sm"
                      style={{ background: COLORS[k] }}
                    />
                    <span className="text-[13px] font-medium text-[#1f2240] dark:text-white/85">
                      {k}
                    </span>
                    <span className="text-[12px] text-gray-500 dark:text-white/55 tabular-nums">
                      {loading ? "..." : item.value.toLocaleString()}
                    </span>
                    <span className="text-[12px] text-gray-400 dark:text-white/40 tabular-nums">
                      {loading ? "" : `(${formatPercent(p)})`}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
              {(["Low", "Info"] as SeverityKey[]).map((k) => {
                const item = data.find((d) => d.name === k) || {
                  name: k,
                  value: 0,
                  color: COLORS[k],
                };
                const p = total > 0 ? item.value / total : 0;

                return (
                  <div key={k} className="flex items-center gap-2">
                    <span
                      className="h-4 w-4 rounded-sm"
                      style={{ background: COLORS[k] }}
                    />
                    <span className="text-[13px] font-medium text-[#1f2240] dark:text-white/85">
                      {k}
                    </span>
                    <span className="text-[12px] text-gray-500 dark:text-white/55 tabular-nums">
                      {loading ? "..." : item.value.toLocaleString()}
                    </span>
                    <span className="text-[12px] text-gray-400 dark:text-white/40 tabular-nums">
                      {loading ? "" : `(${formatPercent(p)})`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DeliveryAnalysis;