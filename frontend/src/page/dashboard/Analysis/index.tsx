import React, { useEffect, useMemo, useRef, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import {
  FiShield,
  FiChevronDown,
  FiSearch,
  FiCheck,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import type { VulnerabilityLevelDTO } from "../../../services";

type SeverityKey = "Critical" | "High" | "Medium" | "Low" | "Info";

type SeverityItem = {
  name: SeverityKey;
  value: number;
  color: string;
};

type TargetOption = {
  key: string;
  label: string;
  task_id: string;
  task_name: string;
  host: string;
};

type SummaryRow = {
  task_id: string;
  task_name: string;
  host: string;
  target_key: string;
  target_label: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
};

interface DeliveryAnalysisProps {
  vulnerabilityData?: VulnerabilityLevelDTO[];
  loading?: boolean;
}

const COLORS: Record<SeverityKey, string> = {
  Critical: "#ef4444",
  High: "#f97316",
  Medium: "#eab308",
  Low: "#22c55e",
  Info: "#3b82f6",
};

const CARD_HEIGHT_CLASS = "min-h-[560px] xl:min-h-[620px]";

const formatPercent = (percent: number) => `${(percent * 100).toFixed(2)}%`;

const getTargetHost = (item: any) => {
  const host =
    item?.host ??
    item?.host_ip ??
    item?.ip ??
    item?.target_ip ??
    item?.ip_host ??
    item?.asset_ip ??
    item?.target_host ??
    item?.target ??
    "";

  return String(host).trim() || "-";
};

const getTargetKey = (taskName: string, host: string) => {
  return `${String(taskName || "-").trim()}__${String(host || "-").trim()}`;
};

const getTargetLabel = (taskName: string, host: string) => {
  return `${String(taskName || "-").trim()} - ${String(host || "-").trim()}`;
};

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
      className="rounded-2xl px-2.5 py-2 shadow-2xl text-white text-[10.5px] font-semibold border border-white/10 backdrop-blur-sm"
      style={{
        background: `linear-gradient(135deg, ${item.color}, ${item.color}dd)`,
        minWidth: 150,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate">{item.name}</span>
        <span className="tabular-nums">{item.value.toLocaleString()}</span>
      </div>
      <div className="mt-1 text-[10px] font-medium text-white/90">
        {formatPercent(percent)} of total findings
      </div>
    </div>
  );
};

const DeliveryAnalysis: React.FC<DeliveryAnalysisProps> = ({
  vulnerabilityData = [],
  loading = false,
}) => {
  const navigate = useNavigate();

  const [openTargetQuery, setOpenTargetQuery] = useState(false);
  const [targetQuerySearch, setTargetQuerySearch] = useState("");
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);

  const targetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (!targetRef.current) return;
      if (!targetRef.current.contains(e.target as Node)) {
        setOpenTargetQuery(false);
      }
    };

    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const rows = useMemo<SummaryRow[]>(() => {
    const map = new Map<string, SummaryRow>();

    for (const item of vulnerabilityData) {
      const taskName =
        String((item as any)?.task_name ?? "").trim() || "Unknown";
      const taskID = String((item as any)?.task_id ?? "").trim();
      const host = getTargetHost(item);
      const targetKey = getTargetKey(taskName, host);
      const targetLabel = getTargetLabel(taskName, host);

      if (!map.has(targetKey)) {
        map.set(targetKey, {
          task_id: taskID,
          task_name: taskName,
          host,
          target_key: targetKey,
          target_label: targetLabel,
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          info: 0,
        });
      }

      const row = map.get(targetKey)!;
      const total = Number(item?.total ?? 0);

      switch (item?.level) {
        case "Critical":
          row.critical += total;
          break;
        case "High":
          row.high += total;
          break;
        case "Medium":
          row.medium += total;
          break;
        case "Low":
          row.low += total;
          break;
        default:
          row.info += total;
          break;
      }
    }

    return Array.from(map.values());
  }, [vulnerabilityData]);

  const targetOptions = useMemo<TargetOption[]>(() => {
    const seen = new Set<string>();
    const options: TargetOption[] = [];

    for (const row of rows) {
      const key = row.target_key;
      if (!key || seen.has(key)) continue;

      seen.add(key);

      options.push({
        key,
        label: row.target_label,
        task_id: row.task_id,
        task_name: row.task_name,
        host: row.host,
      });
    }

    options.sort((a, b) => a.label.localeCompare(b.label));
    return options;
  }, [rows]);

  const selectedTargetOptions = useMemo(() => {
    const selectedSet = new Set(selectedTargets);
    return targetOptions.filter((option) => selectedSet.has(option.key));
  }, [targetOptions, selectedTargets]);

  const selectedTargetLabels = useMemo(() => {
    return selectedTargetOptions.map((option) => option.label);
  }, [selectedTargetOptions]);

  const selectedTargetHosts = useMemo(() => {
    if (selectedTargets.length === 0) return [];

    return Array.from(
      new Set(
        selectedTargetOptions
          .map((option) => String(option.host ?? "").trim())
          .filter((host) => host !== "")
      )
    );
  }, [selectedTargetOptions, selectedTargets.length]);

  const selectedTargetPairs = useMemo(() => {
    return selectedTargetOptions.map((option) => ({
      key: option.key,
      label: option.label,
      task_id: option.task_id,
      task_name: option.task_name,
      host: option.host,
    }));
  }, [selectedTargetOptions]);

  const filteredTargetOptions = useMemo(() => {
    const keyword = targetQuerySearch.trim().toLowerCase();
    if (!keyword) return targetOptions;

    return targetOptions.filter((opt) =>
      opt.label.toLowerCase().includes(keyword)
    );
  }, [targetOptions, targetQuerySearch]);

  const filteredRows = useMemo(() => {
    if (selectedTargets.length === 0) return rows;

    const selectedSet = new Set(selectedTargets);
    return rows.filter((r) => selectedSet.has(r.target_key));
  }, [rows, selectedTargets]);

  const selectedTaskIDs = useMemo(() => {
    if (selectedTargets.length === 0) return [];

    return Array.from(
      new Set(
        filteredRows
          .map((row) => String(row.task_id ?? "").trim())
          .filter((id) => id !== "")
      )
    );
  }, [filteredRows, selectedTargets.length]);

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

  const targetButtonLabel = useMemo(() => {
    if (selectedTargets.length === 0) return "Target Query";
    if (selectedTargets.length === 1) return "1 target selected";
    return `${selectedTargets.length} targets selected`;
  }, [selectedTargets.length]);

  const toggleTarget = (key: string) => {
    setSelectedTargets((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    );
  };

  const handleSelectAllVisibleTargets = () => {
    const visibleKeys = filteredTargetOptions.map((x) => x.key);

    setSelectedTargets((prev) => {
      const prevSet = new Set(prev);
      const allVisibleSelected = visibleKeys.every((key) => prevSet.has(key));

      if (allVisibleSelected) {
        return prev.filter((key) => !visibleKeys.includes(key));
      }

      return Array.from(new Set([...prev, ...visibleKeys]));
    });
  };

  const clearAllTargets = () => {
    setSelectedTargets([]);
  };

  const allVisibleTargetsSelected =
    filteredTargetOptions.length > 0 &&
    filteredTargetOptions.every((opt) => selectedTargets.includes(opt.key));

  const handleNavigateByLevel = (level: SeverityKey) => {
    navigate("/admin/vulnerability-by-level", {
      state: {
        level,
        scopeTask: selectedTargets.length > 0 ? selectedTargetLabels : "all",
        task_id: selectedTaskIDs.length === 1 ? selectedTaskIDs[0] : undefined,
        task_ids: selectedTaskIDs.length > 0 ? selectedTaskIDs : undefined,

        target_keys: selectedTargets.length > 0 ? selectedTargets : undefined,
        target_labels:
          selectedTargetLabels.length > 0 ? selectedTargetLabels : undefined,
        target_hosts:
          selectedTargetHosts.length > 0 ? selectedTargetHosts : undefined,
        target_pairs:
          selectedTargetPairs.length > 0 ? selectedTargetPairs : undefined,
      },
    });
  };

  return (
    <section
      className={[
        "relative w-full overflow-hidden rounded-[18px] p-2.5 sm:p-3 md:p-3.5",
        "bg-white border border-slate-200/80 shadow-[0_10px_26px_-20px_rgba(15,23,42,0.18)]",
        "dark:bg-[#08111f]/95 dark:border-white/10 dark:shadow-none",
        "h-full flex flex-col",
        CARD_HEIGHT_CLASS,
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-10 -right-6 h-24 w-24 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute -bottom-10 -left-6 h-24 w-24 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]">
          <div
            className="h-full w-full"
            style={{
              backgroundImage: `
                linear-gradient(to right, currentColor 1px, transparent 1px),
                linear-gradient(to bottom, currentColor 1px, transparent 1px)
              `,
              backgroundSize: "22px 22px",
            }}
          />
        </div>
      </div>

      <div className="relative z-10 flex h-full flex-col">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <div
                className={[
                  "inline-flex items-center gap-1.5 rounded-full px-2 py-1",
                  "bg-cyan-50 text-cyan-700 border border-cyan-200/80",
                  "dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-400/20",
                ].join(" ")}
              >
                <FiShield className="text-[10px]" />
                <span className="text-[9.5px] font-semibold tracking-wide">
                  Total Vulnerability
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="text-[14px] sm:text-[15px] font-semibold text-[#1f2240] dark:text-white/90 whitespace-nowrap">
                Vulnerability Distribution
              </h3>
              <p className="text-[10px] sm:text-[10.5px] text-slate-500 dark:text-white/55 whitespace-nowrap">
                Severity overview from imported scan results
              </p>
            </div>
          </div>

          <div className="flex items-start gap-1 shrink-0">
            <div className="relative" ref={targetRef}>
              <button
                type="button"
                onClick={() => setOpenTargetQuery((prev) => !prev)}
                className={[
                  "h-9 rounded-xl px-3 flex items-center gap-2 border transition min-w-27.5 sm:min-w-32.5",
                  "bg-white border-gray-200 text-slate-700 hover:border-cyan-200 hover:bg-cyan-50/60",
                  "dark:bg-white/5 dark:border-white/10 dark:text-white/75 dark:hover:bg-white/10",
                ].join(" ")}
              >
                <FiShield className="shrink-0 text-[12px]" />
                <span className="max-w-52 overflow-hidden text-ellipsis whitespace-nowrap text-[10.5px] font-medium">
                  {targetButtonLabel}
                </span>
                <FiChevronDown
                  className={`ml-auto shrink-0 text-[12px] transition-transform ${
                    openTargetQuery ? "rotate-180" : ""
                  }`}
                />
              </button>

              {openTargetQuery && (
                <div
                  className={[
                    "absolute right-0 z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl",
                    "border border-gray-200 bg-white shadow-xl",
                    "dark:border-white/10 dark:bg-[#0B1220] dark:shadow-none",
                  ].join(" ")}
                >
                  <div className="border-b border-gray-100 p-2.5 dark:border-white/10">
                    <div
                      className={[
                        "flex items-center gap-2 rounded-xl border px-2.5",
                        "border-gray-200/80 bg-gray-50",
                        "dark:border-white/10 dark:bg-white/5",
                      ].join(" ")}
                    >
                      <FiSearch className="shrink-0 text-[11px] text-gray-400 dark:text-white/40" />
                      <input
                        value={targetQuerySearch}
                        onChange={(e) => setTargetQuerySearch(e.target.value)}
                        placeholder="Search target"
                        className="h-8 w-full bg-transparent text-[11px] text-gray-700 outline-none placeholder:text-gray-400 dark:text-white/80 dark:placeholder:text-white/35"
                      />
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={handleSelectAllVisibleTargets}
                        className="text-[10.5px] font-medium text-cyan-600 hover:text-cyan-700 dark:text-cyan-300 dark:hover:text-cyan-200"
                      >
                        {allVisibleTargetsSelected
                          ? "Unselect visible"
                          : "Select visible"}
                      </button>

                      <button
                        type="button"
                        onClick={clearAllTargets}
                        className="text-[10.5px] font-medium text-gray-500 hover:text-gray-700 dark:text-white/50 dark:hover:text-white/75"
                      >
                        Clear all
                      </button>
                    </div>
                  </div>

                  <div className="max-h-56 overflow-y-auto p-2">
                    {filteredTargetOptions.length === 0 ? (
                      <div className="px-3 py-6 text-center text-[11px] text-gray-500 dark:text-white/50">
                        No matching target
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {filteredTargetOptions.map((opt) => {
                          const checked = selectedTargets.includes(opt.key);

                          return (
                            <button
                              key={opt.key}
                              type="button"
                              onClick={() => toggleTarget(opt.key)}
                              className={[
                                "w-full flex items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition",
                                checked
                                  ? "bg-cyan-50 border border-cyan-200 dark:bg-cyan-500/10 dark:border-cyan-400/20"
                                  : "border border-transparent hover:bg-gray-50 dark:hover:bg-white/5",
                              ].join(" ")}
                            >
                              <span
                                className={[
                                  "mt-0.5 h-4 w-4 rounded-md border flex items-center justify-center shrink-0 transition",
                                  checked
                                    ? "bg-cyan-500 border-cyan-500 text-white"
                                    : "bg-white border-gray-300 text-transparent dark:bg-white/5 dark:border-white/20",
                                ].join(" ")}
                              >
                                <FiCheck className="text-[10px]" />
                              </span>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="h-2 w-2 shrink-0 rounded-full bg-cyan-500" />
                                  <span className="truncate text-[11px] font-medium text-gray-700 dark:text-white/80">
                                    {opt.label}
                                  </span>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 flex-1 flex flex-col">
          <div className="flex-1 flex items-center justify-center">
            <div className="relative mx-auto h-67.5 w-full max-w-67.5 sm:h-75 sm:max-w-75">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="62%"
                    outerRadius="86%"
                    paddingAngle={3}
                    stroke="rgba(255,255,255,0.95)"
                    strokeWidth={2}
                    onClick={(entry) => {
                      const level = entry?.name as SeverityKey | undefined;
                      if (!level) return;
                      handleNavigateByLevel(level);
                    }}
                    cursor="pointer"
                  >
                    {data.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={entry.color}
                        style={{ cursor: "pointer" }}
                      />
                    ))}
                  </Pie>

                  <Tooltip content={<CustomTooltip total={total} />} />
                </PieChart>
              </ResponsiveContainer>

              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400 dark:text-white/35">
                  TOTAL
                </span>
                <span className="mt-1 text-[26px] sm:text-[30px] font-semibold tracking-tight text-[#1f2240] dark:text-white">
                  {loading ? "..." : total.toLocaleString()}
                </span>
                <span className="mt-1 text-[10px] text-slate-500 dark:text-white/50">
                  findings
                </span>
              </div>
            </div>
          </div>

          <div>
            <div
              className={[
                "rounded-2xl px-3 py-2.5",
                "bg-white border border-gray-200/80",
                "dark:bg-white/5 dark:border-white/10",
              ].join(" ")}
            >
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                {(["Critical", "High", "Medium"] as SeverityKey[]).map((k) => {
                  const item = data.find((d) => d.name === k) || {
                    name: k,
                    value: 0,
                    color: COLORS[k],
                  };
                  const p = total > 0 ? item.value / total : 0;

                  return (
                    <div
                      key={k}
                      className="flex items-center gap-1.5 cursor-pointer"
                      onClick={() => handleNavigateByLevel(k)}
                    >
                      <span
                        className="h-3 w-3 rounded-sm"
                        style={{ background: COLORS[k] }}
                      />
                      <span className="text-[10.5px] font-medium text-[#1f2240] dark:text-white/85">
                        {k}
                      </span>
                      <span className="text-[10px] text-gray-500 dark:text-white/55 tabular-nums">
                        {loading ? "..." : item.value.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-gray-400 dark:text-white/40 tabular-nums">
                        {loading ? "" : `(${formatPercent(p)})`}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                {(["Low", "Info"] as SeverityKey[]).map((k) => {
                  const item = data.find((d) => d.name === k) || {
                    name: k,
                    value: 0,
                    color: COLORS[k],
                  };
                  const p = total > 0 ? item.value / total : 0;

                  return (
                    <div
                      key={k}
                      className="flex items-center gap-1.5 cursor-pointer"
                      onClick={() => handleNavigateByLevel(k)}
                    >
                      <span
                        className="h-3 w-3 rounded-sm"
                        style={{ background: COLORS[k] }}
                      />
                      <span className="text-[10.5px] font-medium text-[#1f2240] dark:text-white/85">
                        {k}
                      </span>
                      <span className="text-[10px] text-gray-500 dark:text-white/55 tabular-nums">
                        {loading ? "..." : item.value.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-gray-400 dark:text-white/40 tabular-nums">
                        {loading ? "" : `(${formatPercent(p)})`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DeliveryAnalysis;