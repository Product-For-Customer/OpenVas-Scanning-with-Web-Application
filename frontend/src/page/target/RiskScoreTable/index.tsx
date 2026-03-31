import React, { useEffect, useMemo, useState } from "react";
import { FiActivity } from "react-icons/fi";
import {
  MdRouter,
  MdDevices,
  MdImportantDevices,
  MdMemory,
  MdSecurity,
} from "react-icons/md";
import { useNavigate } from "react-router-dom";
import { ListDeviceRisk, type DeviceRiskDTO } from "../../../services";

type Row = {
  id: string;
  taskID: string;
  taskName: string;
  ipAddress: string;
  firmwareVersion: string;
  vulnTotal: number;
  risk: number;
  iconIndex: number;
};

const DEVICE_ICONS = [
  {
    Icon: MdRouter,
    bg: "bg-cyan-50 dark:bg-cyan-500/10",
    fg: "text-cyan-600 dark:text-cyan-300",
    ring: "border-cyan-200/80 dark:border-cyan-400/20",
  },
  {
    Icon: MdDevices,
    bg: "bg-slate-100 dark:bg-white/8",
    fg: "text-slate-700 dark:text-white/80",
    ring: "border-slate-200/80 dark:border-white/10",
  },
  {
    Icon: MdImportantDevices,
    bg: "bg-violet-50 dark:bg-violet-500/10",
    fg: "text-violet-600 dark:text-violet-300",
    ring: "border-violet-200/80 dark:border-violet-400/20",
  },
  {
    Icon: MdMemory,
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
    fg: "text-emerald-600 dark:text-emerald-300",
    ring: "border-emerald-200/80 dark:border-emerald-400/20",
  },
  {
    Icon: MdSecurity,
    bg: "bg-orange-50 dark:bg-orange-500/10",
    fg: "text-orange-600 dark:text-orange-300",
    ring: "border-orange-200/80 dark:border-orange-400/20",
  },
];

const stableIconIndex = (seed: string) => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h % DEVICE_ICONS.length;
};

const formatNumber = (n: number) => {
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString();
};

const formatRisk = (n: number) => {
  if (!Number.isFinite(n)) return "0.00";
  return n.toFixed(2);
};

const clampRiskToTen = (risk: number) => {
  if (!Number.isFinite(risk)) return 0;
  return Math.min(Math.max(risk, 0), 10);
};

const getProgressPercentFromRisk = (risk: number) => {
  return (clampRiskToTen(risk) / 10) * 100;
};

const getRiskMeta = (risk: number) => {
  if (risk >= 8) {
    return {
      label: "Critical",
      dot: "bg-red-500",
      text: "text-red-600 dark:text-red-300",
      chip:
        "bg-red-50 border-red-200 text-red-700 dark:bg-red-500/10 dark:border-red-400/20 dark:text-red-300",
      bar: "linear-gradient(90deg, #fb7185 0%, #ef4444 100%)",
    };
  }

  if (risk >= 6) {
    return {
      label: "High",
      dot: "bg-orange-500",
      text: "text-orange-600 dark:text-orange-300",
      chip:
        "bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-500/10 dark:border-orange-400/20 dark:text-orange-300",
      bar: "linear-gradient(90deg, #fdba74 0%, #f97316 100%)",
    };
  }

  if (risk >= 4) {
    return {
      label: "Medium",
      dot: "bg-yellow-500",
      text: "text-yellow-700 dark:text-yellow-300",
      chip:
        "bg-yellow-50 border-yellow-200 text-yellow-700 dark:bg-yellow-500/10 dark:border-yellow-400/20 dark:text-yellow-300",
      bar: "linear-gradient(90deg, #fde68a 0%, #eab308 100%)",
    };
  }

  if (risk > 0) {
    return {
      label: "Low",
      dot: "bg-emerald-500",
      text: "text-emerald-700 dark:text-emerald-300",
      chip:
        "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-400/20 dark:text-emerald-300",
      bar: "linear-gradient(90deg, #86efac 0%, #22c55e 100%)",
    };
  }

  return {
    label: "Info",
    dot: "bg-sky-500",
    text: "text-sky-700 dark:text-sky-300",
    chip:
      "bg-sky-50 border-sky-200 text-sky-700 dark:bg-sky-500/10 dark:border-sky-400/20 dark:text-sky-300",
    bar: "linear-gradient(90deg, #7dd3fc 0%, #38bdf8 100%)",
  };
};

const DangerDots: React.FC<{ value: number }> = ({ value }) => {
  let level = 0;

  if (value >= 8) level = 5;
  else if (value >= 6) level = 4;
  else if (value >= 4) level = 3;
  else if (value > 0) level = 2;
  else level = 1;

  const activeClass =
    value >= 8
      ? "bg-[#ef4444]"
      : value >= 6
      ? "bg-[#f97316]"
      : value >= 4
      ? "bg-[#eab308]"
      : value > 0
      ? "bg-[#22c55e]"
      : "bg-[#38bdf8]";

  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={`h-1.5 w-1.5 rounded-full ${
            i < level ? activeClass : "bg-gray-200 dark:bg-white/10"
          }`}
        />
      ))}
    </div>
  );
};

const RiskScoreTable: React.FC = () => {
  const navigate = useNavigate();

  const [data, setData] = useState<DeviceRiskDTO[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await ListDeviceRisk();

        if (!mounted) return;
        setData(Array.isArray(res) ? res : []);
      } catch (error) {
        console.error("ListDeviceRisk error:", error);
        if (!mounted) return;
        setData([]);
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    };

    fetchData();

    return () => {
      mounted = false;
    };
  }, []);

  const rows = useMemo(() => {
    const list = Array.isArray(data) ? data : [];

    const mapped: Row[] = list.map((x, idx) => {
      const taskID = String(x?.task_id ?? "").trim();
      const taskName = String(x?.task_name ?? "").trim();
      const ipAddress = String(x?.ip_address ?? "").trim();
      const firmwareVersion = String(x?.firmware_version ?? "").trim();
      const vulnTotal = Number(x?.vulnerability_total) || 0;
      const risk = Number(x?.risk_score) || 0;

      return {
        id: `${taskID || "taskid"}-${taskName || "task"}-${ipAddress || "ip"}-${idx}`,
        taskID,
        taskName: taskName || "Unknown Task",
        ipAddress: ipAddress || "-",
        firmwareVersion: firmwareVersion || "Unknown Device",
        vulnTotal,
        risk,
        iconIndex: stableIconIndex(
          `${taskID}-${taskName}-${ipAddress}-${firmwareVersion}`
        ),
      };
    });

    mapped.sort((a, b) => {
      if (b.risk !== a.risk) return b.risk - a.risk;
      if (b.vulnTotal !== a.vulnTotal) return b.vulnTotal - a.vulnTotal;
      return a.taskName.localeCompare(b.taskName);
    });

    return mapped.slice(0, 5);
  }, [data]);

  const goToDevice = (row: Row) => {
    if (!row.taskID.trim()) {
      console.warn("Cannot navigate: task_id is empty");
      return;
    }

    navigate("/admin/vulnerability-by-device", {
      state: {
        task_id: row.taskID,
        ip_address: row.ipAddress,
        task_name: row.taskName,
        firmware_version: row.firmwareVersion,
      },
    });
  };

  return (
    <section
      className={[
        "relative overflow-hidden h-full rounded-[18px] p-2.5 sm:p-3 flex flex-col",
        "bg-white border border-gray-200/80 shadow-sm",
        "dark:bg-white/5 dark:border-white/10 dark:ring-1 dark:ring-white/10 dark:shadow-none",
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-12 -right-8 h-28 w-28 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute -bottom-12 -left-8 h-28 w-28 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]">
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

      <div className="relative z-10 flex h-full flex-col">
        <div className="flex flex-col gap-2.5">
          <div className="min-w-0">
            <h2 className="text-[15px] sm:text-[16px] font-semibold text-[#1f2240] dark:text-white/90 tracking-tight">
              Top 5 Devices Risk
            </h2>
            <p className="mt-0.5 text-[10px] sm:text-[11px] text-gray-500 dark:text-white/55">
              Ranked device exposure from the latest security scan snapshot
            </p>
          </div>

          <div
            className={[
              "rounded-[14px] px-3 py-2 flex flex-wrap items-center gap-2",
              "bg-slate-50 border border-slate-200/80",
              "dark:bg-white/4 dark:border-white/10",
            ].join(" ")}
          >
            <div className="inline-flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-500" />
              </span>
              <span className="text-[10px] font-medium text-slate-700 dark:text-white/75">
                Risk telemetry active
              </span>
            </div>

            <div className="hidden sm:block h-3.5 w-px bg-slate-200 dark:bg-white/10" />

            <div className="inline-flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-white/50">
              <FiActivity className="text-cyan-500 text-[11px]" />
              Risk score, vulnerability count, and device exposure ranking
            </div>
          </div>
        </div>

        <div className="mt-3 flex-1">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className={[
                    "rounded-2xl px-3 py-2.5 border animate-pulse",
                    "border-gray-200/80 bg-white",
                    "dark:border-white/10 dark:bg-white/5",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="h-8 w-8 rounded-xl bg-gray-200 dark:bg-white/10" />
                      <div className="min-w-0 flex-1">
                        <div className="h-3 w-32 rounded bg-gray-200 dark:bg-white/10" />
                        <div className="mt-1.5 h-2.5 w-44 rounded bg-gray-200 dark:bg-white/10" />
                      </div>
                    </div>
                    <div className="h-6 w-16 rounded bg-gray-200 dark:bg-white/10" />
                  </div>
                </div>
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="py-6 text-[11px] text-gray-500 dark:text-white/55">
              No Data
            </div>
          ) : (
            <div className="space-y-2">
              {rows.map((p) => {
                const { Icon, bg, fg, ring } = DEVICE_ICONS[p.iconIndex];
                const riskMeta = getRiskMeta(p.risk);
                const barPercent = getProgressPercentFromRisk(p.risk);

                return (
                  <div
                    key={p.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => goToDevice(p)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        goToDevice(p);
                      }
                    }}
                    className={[
                      "rounded-2xl px-3 py-2.5 border transition-all duration-200 cursor-pointer select-none",
                      "border-gray-200/80 bg-white hover:shadow-sm hover:border-cyan-200/80",
                      "focus:outline-none focus:ring-2 focus:ring-cyan-400/40",
                      "dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/[0.07] dark:hover:border-cyan-400/20 dark:focus:ring-cyan-300/30",
                    ].join(" ")}
                    title={
                      p.taskID
                        ? `Open vulnerabilities for task_id ${p.taskID}`
                        : "No task_id"
                    }
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div
                          className={[
                            "h-8 w-8 rounded-xl border flex items-center justify-center shrink-0",
                            bg,
                            ring,
                          ].join(" ")}
                          aria-hidden="true"
                        >
                          <Icon className={`${fg} text-[16px]`} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="truncate text-[12px] sm:text-[13px] font-semibold text-[#1f2240] dark:text-white/85">
                              {p.taskName}
                            </p>

                            <span
                              className={[
                                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[8.5px] font-semibold border",
                                riskMeta.chip,
                              ].join(" ")}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${riskMeta.dot}`} />
                              {riskMeta.label}
                            </span>

                            <span className="text-[9px] text-gray-400 dark:text-white/35">
                              • IP: {p.ipAddress || "-"}
                            </span>
                          </div>

                          <p className="mt-0.5 text-[10px] sm:text-[11px] text-gray-500 dark:text-white/55 truncate">
                            {formatNumber(p.vulnTotal)} Vulns •{" "}
                            {p.firmwareVersion || "Unknown Device"}
                          </p>

                          <div className="mt-1.5">
                            <div className="h-1.5 rounded-full bg-[#eef0f6] dark:bg-white/10 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${Math.max(barPercent, p.risk > 0 ? 4 : 0)}%`,
                                  background: riskMeta.bar,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0">
                        <div className="text-right">
                          <p
                            className={`text-[12px] sm:text-[13px] font-semibold tabular-nums ${riskMeta.text}`}
                          >
                            {formatRisk(p.risk)}
                          </p>
                          <p className="text-[9px] text-gray-400 dark:text-white/45">
                            Risk Score
                          </p>
                        </div>

                        <DangerDots value={p.risk} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default RiskScoreTable;