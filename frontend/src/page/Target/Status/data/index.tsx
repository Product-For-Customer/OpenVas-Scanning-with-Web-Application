import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  FiArrowDownRight,
  FiArrowLeft,
  FiArrowRight,
  FiArrowUpRight,
  FiCheckCircle,
  FiChevronDown,
  FiClock,
  FiPauseCircle,
  FiPlayCircle,
  FiSearch,
  FiServer,
} from "react-icons/fi";
import { ListTaskStatus, type TaskStatusDTO } from "../../../../services";
import { useLanguage } from "../../../../contexts/LanguageContext";
import type { TranslationKey } from "../../../../locales";
import { useStateContext } from "../../../../contexts/ProviderContext";

type StatusKey = "Done" | "Running" | "New" | "Stopped";

type SortMode = "risk_desc" | "risk_asc" | "latest_report" | "reports_desc";

type LocationState = {
  status?: StatusKey;
  rows?: TaskStatusDTO[];
  allRows?: TaskStatusDTO[];
  totalTasks?: number;
  generatedAt?: string;
};

const ROWS_PER_PAGE = 5;

const clamp = (value: number, min: number, max: number) => {
  return Math.max(min, Math.min(max, value));
};

const formatSeverity = (value: number) => {
  return clamp(Number(value || 0), 0, 10).toFixed(2);
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

const buildPageNumbers = (currentPage: number, totalPages: number): number[] => {
  if (totalPages <= 1) return [1];

  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  if (currentPage <= 3) return [1, 2, 3, 4, 5];

  if (currentPage >= totalPages - 2) {
    return [
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }

  return [
    currentPage - 2,
    currentPage - 1,
    currentPage,
    currentPage + 1,
    currentPage + 2,
  ];
};

const getStatusIcon = (status: StatusKey) => {
  if (status === "Done") return <FiCheckCircle />;
  if (status === "Running") return <FiPlayCircle />;
  if (status === "New") return <FiClock />;
  return <FiPauseCircle />;
};

const getStatusStyle = (status: StatusKey) => {
  if (status === "Done") {
    return {
      chip:
        "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-300",
    };
  }

  if (status === "Running") {
    return {
      chip:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-300",
    };
  }

  if (status === "New") {
    return {
      chip:
        "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-300",
    };
  }

  return {
    chip:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-300",
  };
};

const getSeverityStyle = (score: number) => {
  const safeScore = clamp(Number(score || 0), 0, 10);

  if (safeScore >= 8) {
    return {
      text: "Critical",
      chip:
        "bg-red-50 border-red-200 text-red-700 dark:bg-red-500/10 dark:border-red-400/20 dark:text-red-300",
      textColor: "text-red-600 dark:text-red-300",
      bar: "linear-gradient(90deg, #fb7185 0%, #ef4444 100%)",
    };
  }

  if (safeScore >= 6) {
    return {
      text: "High",
      chip:
        "bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-500/10 dark:border-orange-400/20 dark:text-orange-300",
      textColor: "text-orange-500 dark:text-orange-300",
      bar: "linear-gradient(90deg, #fdba74 0%, #f97316 100%)",
    };
  }

  if (safeScore >= 4) {
    return {
      text: "Medium",
      chip:
        "bg-yellow-50 border-yellow-200 text-yellow-700 dark:bg-yellow-500/10 dark:border-yellow-400/20 dark:text-yellow-300",
      textColor: "text-yellow-500 dark:text-yellow-300",
      bar: "linear-gradient(90deg, #fde68a 0%, #eab308 100%)",
    };
  }

  if (safeScore > 0) {
    return {
      text: "Low",
      chip:
        "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-400/20 dark:text-emerald-300",
      textColor: "text-emerald-700 dark:text-emerald-300",
      bar: "linear-gradient(90deg, #86efac 0%, #22c55e 100%)",
    };
  }

  return {
    text: "Log",
    chip:
      "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-500/10 dark:border-blue-400/20 dark:text-blue-300",
    textColor: "text-blue-700 dark:text-blue-300",
    bar: "linear-gradient(90deg, #7dd3fc 0%, #38bdf8 100%)",
  };
};

const formatThaiDateTime = (item: TaskStatusDTO) => {
  if (item.last_report_at_unix && item.last_report_at_unix > 0) {
    const date = new Date(item.last_report_at_unix * 1000);

    const dateText = date.toLocaleDateString("th-TH", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: localStorage.getItem("appTimezone") ?? "Asia/Bangkok",
    });

    const timeText = date.toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: localStorage.getItem("appTimezone") ?? "Asia/Bangkok",
    });

    return `${dateText} ${timeText} น.`;
  }

  if (item.last_report_at) {
    const date = new Date(item.last_report_at.replace(" ", "T"));

    if (!Number.isNaN(date.getTime())) {
      const dateText = date.toLocaleDateString("th-TH", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: localStorage.getItem("appTimezone") ?? "Asia/Bangkok",
      });

      const timeText = date.toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        timeZone: localStorage.getItem("appTimezone") ?? "Asia/Bangkok",
      });

      return `${dateText} ${timeText} น.`;
    }

    return item.last_report_at;
  }

  return "-";
};

const getTrend = (
  item: TaskStatusDTO,
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string
) => {
  const direction = (item.trend_direction || "none").toLowerCase();
  const delta = Number(item.trend_delta || 0);

  if (direction === "up") {
    return {
      icon: <FiArrowUpRight />,
      value: `+${Math.abs(delta).toFixed(2)}`,
      label: t("targetPage.trendIncreased"),
      title: t("targetPage.trendIncreasedTitle"),
      className:
        "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-300",
    };
  }

  if (direction === "down") {
    return {
      icon: <FiArrowDownRight />,
      value: `-${Math.abs(delta).toFixed(2)}`,
      label: t("targetPage.trendDecreased"),
      title: t("targetPage.trendDecreasedTitle"),
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-300",
    };
  }

  if (direction === "same") {
    return {
      icon: <FiArrowRight />,
      value: "0.00",
      label: t("targetPage.trendSame"),
      title: t("targetPage.trendSameTitle"),
      className:
        "border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/8 dark:text-white/60",
    };
  }

  return {
    icon: <FiClock />,
    value: "-",
    label: t("targetPage.trendFirstReport"),
    title: t("targetPage.trendFirstReportTitle"),
    className:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-300",
  };
};

const getSortValue = (item: TaskStatusDTO, sortMode: SortMode) => {
  if (sortMode === "risk_desc" || sortMode === "risk_asc") {
    return clamp(Number(item.severity_score || 0), 0, 10);
  }

  if (sortMode === "latest_report") {
    return Number(item.last_report_at_unix || 0);
  }

  if (sortMode === "reports_desc") {
    return Number(item.reports || 0);
  }

  return 0;
};

const sortTaskRows = (items: TaskStatusDTO[], sortMode: SortMode) => {
  const withIndex = items.map((item, index) => ({ item, index }));

  withIndex.sort((a, b) => {
    const av = getSortValue(a.item, sortMode);
    const bv = getSortValue(b.item, sortMode);

    let diff = 0;

    if (
      sortMode === "risk_desc" ||
      sortMode === "latest_report" ||
      sortMode === "reports_desc"
    ) {
      diff = bv - av;
    } else {
      diff = av - bv;
    }

    if (diff !== 0) return diff;

    return a.index - b.index;
  });

  return withIndex.map((entry) => entry.item);
};

const TargetStatusData: React.FC = () => {
  const { t } = useLanguage();
  const { currentColor } = useStateContext();
  const accentGrad = `linear-gradient(135deg, ${currentColor}, color-mix(in srgb, ${currentColor} 65%, #a855f7))`;
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const state = (location.state || {}) as LocationState;

  const statusFromQuery = searchParams.get("status") || "";
  const selectedStatus: StatusKey = normalizeStatus(
    state.status || statusFromQuery || "Done"
  );

  const [rows, setRows] = useState<TaskStatusDTO[]>(
    Array.isArray(state.rows) ? state.rows : []
  );

  const [loading, setLoading] = useState<boolean>(
    !Array.isArray(state.rows) || state.rows.length === 0
  );

  const [search, setSearch] = useState<string>("");
  const [sortMode, setSortMode] = useState<SortMode>("risk_desc");
  const [openSort, setOpenSort] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const isMountedRef = useRef(false);
  const isFetchingRef = useRef(false);
  const sortRef = useRef<HTMLDivElement | null>(null);

  const statusStyle = getStatusStyle(selectedStatus);

  const statusLabel: Record<StatusKey, string> = useMemo(
    () => ({
      Done: t("target.done"),
      Running: t("target.running"),
      New: t("target.new"),
      Stopped: t("target.stopped"),
    }),
    [t]
  );

  const sortOptions: { value: SortMode; label: string }[] = useMemo(
    () => [
      { value: "risk_desc", label: t("targetPage.highestRisk") },
      { value: "risk_asc", label: t("targetPage.lowestRisk") },
      { value: "latest_report", label: t("targetPage.sortLatestReport") },
      { value: "reports_desc", label: t("targetPage.sortMostReports") },
    ],
    [t]
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (sortRef.current && !sortRef.current.contains(target)) {
        setOpenSort(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchFallbackData = async () => {
    if (isFetchingRef.current) return;

    try {
      isFetchingRef.current = true;

      if (isMountedRef.current) {
        setLoading(true);
      }

      const res = await ListTaskStatus();
      const safeRows = Array.isArray(res) ? res : [];
      const filteredRows = safeRows.filter(
        (item) => normalizeStatus(item.status) === selectedStatus
      );

      if (!isMountedRef.current) return;

      setRows(filteredRows);
    } catch (error) {
      console.error("TargetStatusData fetch error:", error);

      if (!isMountedRef.current) return;

      setRows([]);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }

      isFetchingRef.current = false;
    }
  };

  useEffect(() => {
    isMountedRef.current = true;

    if (!Array.isArray(state.rows) || state.rows.length === 0) {
      void fetchFallbackData();
    }

    return () => {
      isMountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStatus]);

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) return rows;

    return rows.filter((item) => {
      const values = [
        item.task_id,
        item.task_name,
        item.target_name,
        item.target_hosts,
        item.mac_address,
        item.status,
        item.severity_level,
        item.last_report_at,
        item.reports,
        item.severity_score,
      ];

      return values.some((value) =>
        String(value || "").toLowerCase().includes(keyword)
      );
    });
  }, [rows, search]);

  const sortedRows = useMemo(() => {
    return sortTaskRows(filteredRows, sortMode);
  }, [filteredRows, sortMode]);

  const totalPages = useMemo(() => {
    const total = Math.ceil(sortedRows.length / ROWS_PER_PAGE);
    return Math.max(1, total);
  }, [sortedRows.length]);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * ROWS_PER_PAGE;
    const end = start + ROWS_PER_PAGE;

    return sortedRows.slice(start, end);
  }, [sortedRows, currentPage]);

  const pageNumbers = useMemo(() => {
    return buildPageNumbers(currentPage, totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedStatus, sortMode]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const summary = useMemo(() => {
    const total = rows.length;
    const reports = rows.reduce(
      (sum, item) => sum + Number(item.reports || 0),
      0
    );

    const avgSeverity =
      total > 0
        ? rows.reduce(
            (sum, item) => sum + clamp(Number(item.severity_score || 0), 0, 10),
            0
          ) / total
        : 0;

    return {
      total,
      reports,
      avgSeverity,
    };
  }, [rows]);

  const currentSort = useMemo(() => {
    return (
      sortOptions.find((option) => option.value === sortMode) ??
      sortOptions[0]
    );
  }, [sortMode, sortOptions]);

  return (
    <main className="w-full space-y-5 py-3 sm:py-4">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200/70 text-slate-500 transition hover:bg-slate-50 dark:border-white/8 dark:text-white/50 dark:hover:bg-white/5"
            >
              <FiArrowLeft />
            </button>
            <h1 className="text-[18px] font-bold text-slate-800 dark:text-white sm:text-[20px]">
              {t("targetPage.targetStatusDataTitle")}
            </h1>
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold ${statusStyle.chip}`}>
              {getStatusIcon(selectedStatus)}
              {statusLabel[selectedStatus]}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400 dark:text-white/30">
            {loading
              ? t("common.loading")
              : t("targetPage.targetsWithStatus", {
                  n: rows.length,
                  status: statusLabel[selectedStatus],
                })}
          </p>
        </div>
      </div>

      {/* ── Stat cards ── */}
      {!loading && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: t("targetPage.statusTargetsSuffix"), value: summary.total.toLocaleString() },
            { label: t("targetPage.reports"),              value: summary.reports.toLocaleString() },
            { label: t("targetPage.avgSeverity"),          value: formatSeverity(summary.avgSeverity) },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-slate-200/70 bg-white px-4 py-3.5 dark:border-white/8 dark:bg-white/4">
              <p className="text-[11px] font-medium text-slate-400 dark:text-white/35">{s.label}</p>
              <p className="mt-1 text-[24px] font-bold leading-none tracking-tight text-slate-900 dark:text-white">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200/70 bg-white dark:border-white/8 dark:bg-[#0d0b1a]/80">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 dark:border-white/8 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-[13px] font-semibold text-slate-700 dark:text-white/80">
              {statusLabel[selectedStatus]} {t("targetPage.statusTargetsSuffix")}
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-400 dark:text-white/30">
              {loading
                ? t("common.loading")
                : t("targetPage.showingOfPageX", {
                    shown: sortedRows.length.toLocaleString(),
                    total: rows.length.toLocaleString(),
                    page: currentPage,
                    totalPages,
                  })}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-72">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400 dark:text-white/30" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t("targetPage.searchTargetOrHost")}
                className="h-8 w-full rounded-lg border border-slate-200/70 bg-white pl-8.5 pr-3 text-[11px] text-slate-700 outline-none transition focus:border-blue-300 dark:border-white/8 dark:bg-white/5 dark:text-white/80 dark:placeholder:text-white/30"
              />
            </div>

            <div className="relative w-full sm:w-44" ref={sortRef}>
              <button
                type="button"
                onClick={() => setOpenSort(prev => !prev)}
                className="flex h-8 w-full items-center justify-between gap-2 rounded-lg border border-slate-200/70 bg-white px-3 text-[10.5px] font-medium text-slate-600 transition hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/8"
              >
                <span className="truncate">{currentSort.label}</span>
                <FiChevronDown className={`shrink-0 text-[11px] text-slate-400 transition-transform ${openSort ? "rotate-180" : ""}`} />
              </button>

              {openSort && (
                <div className="absolute right-0 z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-slate-200/80 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-[#0d0b1a]">
                  {sortOptions.map(option => {
                    const active = option.value === sortMode;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => { setSortMode(option.value); setOpenSort(false); }}
                        className={[
                          "w-full rounded-lg px-3 py-2 text-left text-[11px] font-medium transition",
                          active
                            ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
                            : "text-slate-600 hover:bg-slate-50 dark:text-white/65 dark:hover:bg-white/5",
                        ].join(" ")}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-245 border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-left dark:border-white/8 dark:bg-white/3">
                <th className="px-4 py-2.5 text-[10.5px] font-semibold tracking-wide text-slate-500 dark:text-white/45">
                  {t("common.name")}
                </th>

                <th className="px-4 py-2.5 text-[10.5px] font-semibold tracking-wide text-slate-500 dark:text-white/45">
                  {t("common.status")}
                </th>

                <th className="px-4 py-2.5 text-[10.5px] font-semibold tracking-wide text-slate-500 dark:text-white/45">
                  {t("targetPage.reports")}
                </th>

                <th className="px-4 py-2.5 text-[10.5px] font-semibold tracking-wide text-slate-500 dark:text-white/45">
                  {t("targetPage.lastReport")}
                </th>

                <th className="px-4 py-2.5 text-[10.5px] font-semibold tracking-wide text-slate-500 dark:text-white/45">
                  {t("targetPage.severity")}
                </th>

                <th className="px-4 py-2.5 text-[10.5px] font-semibold tracking-wide text-slate-500 dark:text-white/45">
                  {t("targetPage.trend")}
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                Array.from({ length: ROWS_PER_PAGE }).map((_, index) => (
                  <tr
                    key={`loading-${index}`}
                    className="border-b border-slate-100 dark:border-white/10"
                  >
                    <td className="px-4 py-3">
                      <div className="h-3.5 w-44 animate-pulse rounded-full bg-slate-200 dark:bg-white/10" />
                      <div className="mt-2 h-3 w-28 animate-pulse rounded-full bg-slate-100 dark:bg-white/6" />
                    </td>

                    <td className="px-4 py-3">
                      <div className="h-6 w-24 animate-pulse rounded-full bg-slate-200 dark:bg-white/10" />
                    </td>

                    <td className="px-4 py-3">
                      <div className="h-3.5 w-8 animate-pulse rounded-full bg-slate-200 dark:bg-white/10" />
                    </td>

                    <td className="px-4 py-3">
                      <div className="h-3.5 w-48 animate-pulse rounded-full bg-slate-200 dark:bg-white/10" />
                    </td>

                    <td className="px-4 py-3">
                      <div className="h-6 w-36 animate-pulse rounded-full bg-slate-200 dark:bg-white/10" />
                    </td>

                    <td className="px-4 py-3">
                      <div className="h-6 w-16 animate-pulse rounded-full bg-slate-200 dark:bg-white/10" />
                    </td>
                  </tr>
                ))
              ) : sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-white/8 dark:text-white/45">
                      <FiServer />
                    </div>

                    <p className="mt-3 text-[13px] font-semibold text-slate-800 dark:text-white">
                      {t("targetPage.noTargetDataFound")}
                    </p>

                    <p className="mt-1 text-[11px] text-slate-500 dark:text-white/45">
                      {t("targetPage.tryChangingSearchKeyword")}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedRows.map((item, index) => {
                  const normalized = normalizeStatus(item.status);
                  const rowStatusStyle = getStatusStyle(normalized);
                  const severityScore = clamp(
                    Number(item.severity_score || 0),
                    0,
                    10
                  );
                  const severity = getSeverityStyle(severityScore);
                  const trend = getTrend(item, t);
                  const severityWidth = Math.min(
                    Math.max(
                      (severityScore / 10) * 100,
                      severityScore > 0 ? 3 : 0
                    ),
                    100
                  );

                  return (
                    <tr
                      key={`${item.task_id}-${item.target_hosts}-${index}`}
                      className={[
                        "border-b border-slate-100 transition-all duration-200 last:border-b-0 dark:border-white/10",
                        "hover:bg-slate-50/70 dark:hover:bg-white/4",
                      ].join(" ")}
                    >
                      <td className="px-4 py-3 align-middle">
                        <div className="min-w-0">
                          <p className="max-w-65 truncate text-[13px] font-semibold text-blue-700 dark:text-cyan-300">
                            {item.task_name || "-"}
                          </p>

                          <p className="mt-0.5 max-w-65 text-[11.5px] text-slate-600 dark:text-white/55">
                            {(() => {
                              const raw = item.target_hosts || item.target_name || "-";
                              const parts = raw.split(/[,\s]+/).map((s: string) => s.trim()).filter(Boolean);
                              const isIP = (s: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(s);
                              return parts.map((part: string, idx: number) => (
                                <span key={idx}>
                                  {idx > 0 && <span className="mr-1">,</span>}
                                  {isIP(part) ? (
                                    <button
                                      type="button"
                                      onClick={() => navigate(`/admin/host/${encodeURIComponent(part)}`)}
                                      className="font-mono underline decoration-dotted underline-offset-2 hover:text-blue-500 dark:hover:text-blue-400"
                                      title={t("targetPage.viewHostData", { host: part })}
                                    >
                                      {part}
                                    </button>
                                  ) : (
                                    <span>{part}</span>
                                  )}
                                </span>
                              ));
                            })()}
                          </p>
                        </div>
                      </td>

                      <td className="px-4 py-3 align-middle">
                        <span
                          className={[
                            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-semibold",
                            rowStatusStyle.chip,
                          ].join(" ")}
                        >
                          {getStatusIcon(normalized)}
                          {statusLabel[normalized]}
                        </span>
                      </td>

                      <td className="px-4 py-3 align-middle">
                        <span className="text-[13px] font-semibold text-slate-800 tabular-nums dark:text-white/85">
                          {Number(item.reports || 0).toLocaleString()}
                        </span>
                      </td>

                      <td className="px-4 py-3 align-middle">
                        <div className="max-w-62.5 text-[12.5px] leading-5 font-medium text-slate-700 dark:text-white/70">
                          {formatThaiDateTime(item)}
                        </div>
                      </td>

                      <td className="px-4 py-3 align-middle">
                        <div className="w-52.5">
                          <div className="flex items-center gap-2.5">
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#eef0f6] dark:bg-white/10">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${severityWidth}%`,
                                  background: severity.bar,
                                }}
                              />
                            </div>

                            <span
                              className={[
                                "whitespace-nowrap text-[11px] font-semibold tabular-nums",
                                severity.textColor,
                              ].join(" ")}
                            >
                              {formatSeverity(severityScore)}
                            </span>
                          </div>

                          <div className="mt-1.5 flex items-center gap-2">
                            <span
                              className={[
                                "inline-flex rounded-full border px-2 py-0.5 text-[9px] font-semibold",
                                severity.chip,
                              ].join(" ")}
                            >
                              {severity.text}
                            </span>

                            <span className="text-[9px] text-slate-400 dark:text-white/35">
                              / 10.00
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 align-middle">
                        <span
                          title={trend.title}
                          className={[
                            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-semibold",
                            trend.className,
                          ].join(" ")}
                        >
                          <span className="text-[13px]">{trend.icon}</span>
                          <span>{trend.value}</span>
                          <span className="hidden xl:inline">{trend.label}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && sortedRows.length > 0 && totalPages > 1 && (
          <div className="border-t border-slate-100 px-4 py-3 dark:border-white/10">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[11px] text-slate-500 dark:text-white/45">
                {t("targetPage.showingRange", {
                  from: Math.min(
                    (currentPage - 1) * ROWS_PER_PAGE + 1,
                    sortedRows.length
                  ),
                  to: Math.min(currentPage * ROWS_PER_PAGE, sortedRows.length),
                  total: sortedRows.length.toLocaleString(),
                })}
              </p>

              <div className="flex flex-wrap items-center justify-start gap-1.5 sm:justify-end">
                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(1, prev - 1))
                  }
                  disabled={currentPage === 1}
                  className={[
                    "inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-[11px] font-medium transition",
                    currentPage === 1
                      ? "cursor-not-allowed border-slate-200/70 bg-slate-100 text-slate-400 dark:border-white/8 dark:bg-white/5 dark:text-white/25"
                      : "border-slate-200/70 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/8",
                  ].join(" ")}
                >
                  {t("common.prev")}
                </button>

                {pageNumbers.map((page) => {
                  const active = page === currentPage;

                  return (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setCurrentPage(page)}
                      style={active ? { background: accentGrad } : undefined}
                      className={[
                        "inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-[11px] font-semibold transition",
                        active
                          ? "border-transparent text-white"
                          : "border-slate-200/70 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/8",
                      ].join(" ")}
                    >
                      {page}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                  }
                  disabled={currentPage === totalPages}
                  className={[
                    "inline-flex h-8 min-w-8 items-center justify-center rounded-xl border px-2 text-[11px] font-medium transition",
                    currentPage === totalPages
                      ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-white/25"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/6 dark:text-white/80 dark:hover:bg-white/10",
                  ].join(" ")}
                >
                  {t("common.next")}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );

};

export default TargetStatusData;