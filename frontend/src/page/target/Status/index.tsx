import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FiCheckCircle,
  FiPlayCircle,
  FiPauseCircle,
  FiClock,
  FiShield,
  FiRadio,
} from "react-icons/fi";
import { ListTaskStatus, type TaskStatusDTO } from "../../../services";

type StatusKey = "Done" | "Running" | "New" | "Stopped";

type StatItem = {
  id: number;
  title: StatusKey;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
};

const normalizeStatus = (s: string): StatusKey => {
  const v = (s || "").toLowerCase().trim();
  if (v === "done") return "Done";
  if (v === "running") return "Running";
  if (v === "new") return "New";
  if (v === "stopped") return "Stopped";

  if (v.includes("run")) return "Running";
  if (v.includes("stop") || v.includes("pause") || v.includes("interrupt")) {
    return "Stopped";
  }
  if (v.includes("new") || v.includes("request") || v.includes("queue")) {
    return "New";
  }
  if (v.includes("done") || v.includes("finish")) return "Done";

  return "Done";
};

const StatusTarget: React.FC = () => {
  const [rows, setRows] = useState<TaskStatusDTO[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const hasFetchedRef = useRef(false);
  const isFetchingRef = useRef(false);
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    const fetchTaskStatus = async () => {
      if (isFetchingRef.current) return;

      try {
        isFetchingRef.current = true;

        if (isMountedRef.current) {
          setLoading(true);
        }

        const res = await ListTaskStatus();

        if (!isMountedRef.current) return;

        setRows(Array.isArray(res) ? res : []);
      } catch (error) {
        console.error("Fetched task status error:", error);

        if (!isMountedRef.current) return;

        setRows([]);
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
        isFetchingRef.current = false;
      }
    };

    void fetchTaskStatus();
  }, []);

  const statusCounts = useMemo(() => {
    const base: Record<StatusKey, number> = {
      Done: 0,
      Running: 0,
      New: 0,
      Stopped: 0,
    };

    for (const r of rows) {
      const key = normalizeStatus(r.status);
      base[key] += 1;
    }

    return base;
  }, [rows]);

  const totalTasks = rows.length;

  const dominantStatus = useMemo<StatusKey>(() => {
    const ordered: StatusKey[] = ["Running", "Done", "New", "Stopped"];
    let best: StatusKey = "Done";
    let bestValue = -1;

    for (const key of ordered) {
      if (statusCounts[key] > bestValue) {
        best = key;
        bestValue = statusCounts[key];
      }
    }

    return best;
  }, [statusCounts]);

  const themeByStatus: Record<
    StatusKey,
    {
      accent: string;
      soft: string;
      chip: string;
      iconWrap: string;
      iconColor: string;
      progress: string;
      panelLight: string;
      panelDark: string;
      borderLight: string;
      borderDark: string;
      glow: string;
    }
  > = useMemo(
    () => ({
      Done: {
        accent: "#3b82f6",
        soft: "#93c5fd",
        chip:
          "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-500/10 dark:border-blue-400/20 dark:text-blue-300",
        iconWrap:
          "bg-gradient-to-br from-[#60a5fa] via-[#3b82f6] to-[#1d4ed8]",
        iconColor: "text-white",
        progress:
          "bg-gradient-to-r from-[#93c5fd] via-[#3b82f6] to-[#1d4ed8]",
        panelLight: "bg-white",
        panelDark: "dark:bg-[#0d1526]",
        borderLight: "border-blue-100/80",
        borderDark: "dark:border-blue-400/10",
        glow: "shadow-[0_10px_26px_-20px_rgba(59,130,246,0.42)]",
      },
      Running: {
        accent: "#10b981",
        soft: "#6ee7b7",
        chip:
          "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-400/20 dark:text-emerald-300",
        iconWrap:
          "bg-gradient-to-br from-[#34d399] via-[#10b981] to-[#047857]",
        iconColor: "text-white",
        progress:
          "bg-gradient-to-r from-[#86efac] via-[#34d399] to-[#059669]",
        panelLight: "bg-white",
        panelDark: "dark:bg-[#0d161d]",
        borderLight: "border-emerald-100/80",
        borderDark: "dark:border-emerald-400/10",
        glow: "shadow-[0_10px_26px_-20px_rgba(16,185,129,0.40)]",
      },
      New: {
        accent: "#f59e0b",
        soft: "#fde68a",
        chip:
          "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-500/10 dark:border-amber-400/20 dark:text-amber-300",
        iconWrap:
          "bg-gradient-to-br from-[#fde68a] via-[#f59e0b] to-[#b45309]",
        iconColor: "text-white",
        progress:
          "bg-gradient-to-r from-[#fde68a] via-[#f59e0b] to-[#b45309]",
        panelLight: "bg-white",
        panelDark: "dark:bg-[#171208]",
        borderLight: "border-amber-100/80",
        borderDark: "dark:border-amber-400/10",
        glow: "shadow-[0_10px_26px_-20px_rgba(245,158,11,0.34)]",
      },
      Stopped: {
        accent: "#f43f5e",
        soft: "#fda4af",
        chip:
          "bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-500/10 dark:border-rose-400/20 dark:text-rose-300",
        iconWrap:
          "bg-gradient-to-br from-[#fda4af] via-[#fb7185] to-[#be123c]",
        iconColor: "text-white",
        progress:
          "bg-gradient-to-r from-[#fda4af] via-[#fb7185] to-[#be123c]",
        panelLight: "bg-white",
        panelDark: "dark:bg-[#180b12]",
        borderLight: "border-rose-100/80",
        borderDark: "dark:border-rose-400/10",
        glow: "shadow-[0_10px_26px_-20px_rgba(244,63,94,0.36)]",
      },
    }),
    []
  );

  const stats: StatItem[] = useMemo(
    () => [
      {
        id: 1,
        title: "Done",
        value: loading ? "..." : statusCounts.Done.toLocaleString(),
        subtitle: "Completed",
        icon: <FiCheckCircle />,
      },
      {
        id: 2,
        title: "Running",
        value: loading ? "..." : statusCounts.Running.toLocaleString(),
        subtitle: "In progress",
        icon: <FiPlayCircle />,
      },
      {
        id: 3,
        title: "New",
        value: loading ? "..." : statusCounts.New.toLocaleString(),
        subtitle: "Queued",
        icon: <FiClock />,
        },
      {
        id: 4,
        title: "Stopped",
        value: loading ? "..." : statusCounts.Stopped.toLocaleString(),
        subtitle: "Stopped",
        icon: <FiPauseCircle />,
      },
    ],
    [loading, statusCounts]
  );

  const percents = useMemo(() => {
    const toPercent = (n: number) => {
      if (!totalTasks) return 0;
      return Math.round((n / totalTasks) * 100);
    };

    return {
      Done: toPercent(statusCounts.Done),
      Running: toPercent(statusCounts.Running),
      New: toPercent(statusCounts.New),
      Stopped: toPercent(statusCounts.Stopped),
    };
  }, [statusCounts, totalTasks]);

  const nowText = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }, []);

  return (
    <section className="w-full">
      <div
        className={[
          "relative overflow-hidden rounded-[22px] px-4 sm:px-5 md:px-6 pt-5 sm:pt-6 pb-18 sm:pb-20",
          "bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.10),transparent_22%),radial-gradient(circle_at_bottom_left,rgba(139,92,246,0.10),transparent_24%),linear-gradient(135deg,#1e1b4b_0%,#111827_50%,#0b1220_100%)]",
          "text-white border border-white/10",
        ].join(" ")}
      >
        <div className="pointer-events-none absolute -top-20 -left-20 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-56 w-56 rounded-full bg-violet-500/10 blur-3xl" />

        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-[22px] font-semibold tracking-tight sm:text-[26px]">
              Scanning Network Status
            </h2>

            <p className="mt-1.5 text-[11px] text-white/70 sm:text-[12px]">
              OpenVAS task summary
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/8 px-2.5 py-1.5 text-[10.5px] text-white/80 backdrop-blur-sm">
                <FiShield className="text-[12px] text-cyan-300" />
                Security Monitor
              </div>

              <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/8 px-2.5 py-1.5 text-[10.5px] text-white/80 backdrop-blur-sm">
                <FiRadio className="text-[12px] text-violet-300" />
                {loading ? "Syncing..." : dominantStatus}
              </div>
            </div>
          </div>

          <div className="shrink-0 rounded-2xl border border-white/10 bg-white/8 px-3 py-2.5 backdrop-blur-sm">
            <p className="text-[9px] uppercase tracking-[0.16em] text-white/50">
              Date
            </p>
            <p className="mt-1 text-[11px] text-white/85 sm:text-[12px]">
              {nowText}
            </p>
          </div>
        </div>
      </div>

      <div className="relative z-10 -mt-13 px-3 sm:-mt-15 sm:px-4 md:px-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
          {stats.map((s) => {
            const theme = themeByStatus[s.title];
            const count = statusCounts[s.title];
            const percent = loading ? 0 : percents[s.title];

            return (
              <div
                key={s.id}
                className={[
                  "relative overflow-hidden rounded-[22px] border p-3 transition-all duration-300 sm:p-3.5",
                  "hover:-translate-y-0.5 hover:shadow-lg",
                  theme.panelLight,
                  theme.panelDark,
                  theme.borderLight,
                  theme.borderDark,
                  theme.glow,
                ].join(" ")}
              >
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 h-1"
                  style={{
                    background: `linear-gradient(90deg, ${theme.soft}, ${theme.accent})`,
                  }}
                />

                <div
                  className="pointer-events-none absolute -top-12 -right-12 h-24 w-24 rounded-full blur-3xl"
                  style={{ background: `${theme.accent}18` }}
                />

                <div className="relative">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-slate-900 dark:text-white/90">
                        {s.title}
                      </p>
                      <p className="mt-0.5 text-[10.5px] text-slate-600 dark:text-white/55">
                        {s.subtitle}
                      </p>
                    </div>

                    <div
                      className={[
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] text-[16px] shadow-sm",
                        theme.iconWrap,
                        theme.iconColor,
                      ].join(" ")}
                    >
                      {s.icon}
                    </div>
                  </div>

                  <div className="mt-3.5 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[22px] font-semibold leading-none tracking-tight text-slate-900 tabular-nums dark:text-white sm:text-[26px]">
                        {s.value}
                      </p>
                      <p className="mt-1.5 text-[10.5px] text-slate-600 dark:text-white/55">
                        {loading ? "Loading..." : `${count} tasks`}
                      </p>
                    </div>

                    <span
                      className={[
                        "shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold backdrop-blur-sm",
                        theme.chip,
                      ].join(" ")}
                    >
                      {loading ? "Sync" : `${percent}%`}
                    </span>
                  </div>

                  <div className="mt-3.5">
                    <div className="mb-1.5 flex items-center justify-between text-[9.5px] text-slate-600 dark:text-white/45">
                      <span>Status</span>
                      <span>{loading ? "..." : `${count}/${totalTasks}`}</span>
                    </div>

                    <div className="h-2 w-full overflow-hidden rounded-full border border-black/5 bg-black/5 dark:border-white/10 dark:bg-white/10">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${theme.progress}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default StatusTarget;