import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiCheckCircle,
  FiPlayCircle,
  FiPauseCircle,
  FiClock,
  FiShield,
  FiRadio,
} from "react-icons/fi";
import { ListTaskStatus, type TaskStatusDTO } from "../../../services";
import { useLanguage } from "../../../contexts/LanguageContext";

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
  const { t } = useLanguage();
  const navigate = useNavigate();

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
      focus: string;
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
        focus: "focus-visible:ring-blue-400/35",
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
        focus: "focus-visible:ring-emerald-400/35",
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
        focus: "focus-visible:ring-amber-400/35",
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
        focus: "focus-visible:ring-rose-400/35",
      },
    }),
    []
  );

  const statusLabel: Record<StatusKey, string> = useMemo(
    () => ({
      Done: t("target.done"),
      Running: t("target.running"),
      New: t("target.new"),
      Stopped: t("target.stopped"),
    }),
    [t]
  );

  const stats: StatItem[] = useMemo(
    () => [
      {
        id: 1,
        title: "Done",
        value: loading ? "..." : statusCounts.Done.toLocaleString(),
        subtitle: t("targetPage.completed"),
        icon: <FiCheckCircle />,
      },
      {
        id: 2,
        title: "Running",
        value: loading ? "..." : statusCounts.Running.toLocaleString(),
        subtitle: t("targetPage.inProgress"),
        icon: <FiPlayCircle />,
      },
      {
        id: 3,
        title: "New",
        value: loading ? "..." : statusCounts.New.toLocaleString(),
        subtitle: t("targetPage.queued"),
        icon: <FiClock />,
      },
      {
        id: 4,
        title: "Stopped",
        value: loading ? "..." : statusCounts.Stopped.toLocaleString(),
        subtitle: t("target.stopped"),
        icon: <FiPauseCircle />,
      },
    ],
    [loading, statusCounts, t]
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

  const handleStatusClick = (status: StatusKey) => {
    if (loading) return;

    const selectedRows = rows.filter(
      (item) => normalizeStatus(item.status) === status
    );

    navigate(
      {
        pathname: "/admin/status-target-data",
        search: `?status=${encodeURIComponent(status)}`,
      },
      {
        state: {
          status,
          rows: selectedRows,
          allRows: rows,
          totalTasks: rows.length,
          generatedAt: new Date().toISOString(),
        },
      }
    );
  };

  return (
    <section className="w-full">

      {/* ── Dark hero banner (with bottom padding for card overlap) ── */}
      <div className="relative overflow-hidden rounded-xl px-5 pb-20 pt-6 sm:px-6 sm:pb-22 sm:pt-7 bg-slate-900 dark:bg-[#0b0e1a] border border-white/8">
        <div className="pointer-events-none absolute -top-12 right-8 h-40 w-40 rounded-full bg-cyan-500/12 blur-[60px]" />
        <div className="pointer-events-none absolute -bottom-12 left-8 h-36 w-36 rounded-full bg-violet-500/12 blur-[60px]" />

        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-[20px] font-semibold tracking-tight text-white sm:text-[22px]">
              {t("targetPage.scanningNetworkStatus")}
            </h2>
            <p className="mt-1.5 text-[11px] text-white/50">
              {t("targetPage.clickStatusCardDesc")} · {nowText}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/8 px-3 py-1.5 text-[10.5px] text-white/70">
              <FiShield className="text-[11px] text-cyan-400" />
              {t("targetPage.securityMonitor")}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/8 px-3 py-1.5 text-[10.5px] text-white/70">
              <FiRadio className="text-[11px] text-violet-400" />
              {loading ? t("targetPage.syncing") : statusLabel[dominantStatus]}
            </span>
          </div>
        </div>
      </div>

      {/* ── Stat cards overlapping the banner ── */}
      <div className="-mt-14 grid grid-cols-2 gap-3 px-3 sm:-mt-16 sm:gap-4 sm:px-4 md:grid-cols-4 md:px-5">
        {stats.map((s) => {
          const theme = themeByStatus[s.title];
          const count = statusCounts[s.title];
          const percent = loading ? 0 : percents[s.title];

          return (
            <div
              key={s.id}
              role="button"
              tabIndex={0}
              title={loading ? t("common.loading") : t("targetPage.viewStatusTargets", { status: statusLabel[s.title] })}
              aria-label={t("targetPage.viewStatusTargets", { status: statusLabel[s.title] })}
              onClick={() => handleStatusClick(s.title)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleStatusClick(s.title);
                }
              }}
              className={[
                "group relative overflow-hidden rounded-xl border border-slate-200/70 bg-white px-4 py-4 transition-all duration-200",
                "hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300",
                loading ? "cursor-wait" : "cursor-pointer",
                "dark:border-white/8 dark:bg-[#0d0b1a]",
              ].join(" ")}
            >
              {/* Thin accent top bar */}
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-0.5 rounded-t-xl"
                style={{ backgroundColor: theme.accent }}
              />

              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-slate-800 dark:text-white/90">
                    {statusLabel[s.title]}
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-500 dark:text-white/45">
                    {s.subtitle}
                  </p>
                </div>
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[16px] text-white shadow-sm"
                  style={{ backgroundColor: theme.accent }}
                >
                  {s.icon}
                </span>
              </div>

              <p className="mt-3.5 text-[28px] font-bold leading-none tracking-tight text-slate-900 tabular-nums dark:text-white sm:text-[32px]">
                {loading
                  ? <span className="inline-block h-8 w-10 animate-pulse rounded-lg bg-slate-100 dark:bg-white/10" />
                  : s.value}
              </p>

              <p className="mt-1.5 text-[10.5px] text-slate-500 dark:text-white/45">
                {loading ? "—" : t("targetPage.countTasks", { n: count })}
              </p>

              <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/8">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${percent}%`, backgroundColor: theme.accent }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default StatusTarget;