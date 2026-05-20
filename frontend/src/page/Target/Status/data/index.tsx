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
  FiShield,
} from "react-icons/fi";
import { ListTaskStatus, type TaskStatusDTO } from "../../../../services";

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

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  {
    value: "risk_desc",
    label: "Highest Risk",
  },
  {
    value: "risk_asc",
    label: "Lowest Risk",
  },
  {
    value: "latest_report",
    label: "Latest Report",
  },
  {
    value: "reports_desc",
    label: "Most Reports",
  },
];

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
      timeZone: "Asia/Bangkok",
    });

    const timeText = date.toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "Asia/Bangkok",
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
        timeZone: "Asia/Bangkok",
      });

      const timeText = date.toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        timeZone: "Asia/Bangkok",
      });

      return `${dateText} ${timeText} น.`;
    }

    return item.last_report_at;
  }

  return "-";
};

const getTrend = (item: TaskStatusDTO) => {
  const direction = (item.trend_direction || "none").toLowerCase();
  const delta = Number(item.trend_delta || 0);

  if (direction === "up") {
    return {
      icon: <FiArrowUpRight />,
      value: `+${Math.abs(delta).toFixed(2)}`,
      label: "Increased",
      title: "Severity ล่าสุดสูงกว่า Report ก่อนหน้า",
      className:
        "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-300",
    };
  }

  if (direction === "down") {
    return {
      icon: <FiArrowDownRight />,
      value: `-${Math.abs(delta).toFixed(2)}`,
      label: "Decreased",
      title: "Severity ล่าสุดต่ำกว่า Report ก่อนหน้า",
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-300",
    };
  }

  if (direction === "same") {
    return {
      icon: <FiArrowRight />,
      value: "0.00",
      label: "Same",
      title: "Severity ล่าสุดเท่ากับ Report ก่อนหน้า",
      className:
        "border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/8 dark:text-white/60",
    };
  }

  return {
    icon: <FiClock />,
    value: "-",
    label: "First Report",
    title: "ยังไม่มี Report ก่อนหน้าให้เปรียบเทียบ",
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
      SORT_OPTIONS.find((option) => option.value === sortMode) ??
      SORT_OPTIONS[0]
    );
  }, [sortMode]);

  return (
    <main className="w-full">
      <div
        className={[
          "relative overflow-hidden rounded-[26px] border border-white/10 p-4 text-white sm:p-5 md:p-6",
          "bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_22%),radial-gradient(circle_at_bottom_left,rgba(139,92,246,0.12),transparent_24%),linear-gradient(135deg,#1e1b4b_0%,#111827_48%,#0b1220_100%)]",
        ].join(" ")}
      >
        <div className="pointer-events-none absolute -top-24 -left-24 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 -bottom-24 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl" />

        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-2 text-[11px] font-semibold text-white/80 backdrop-blur-sm transition-all duration-300 hover:bg-white/14"
            >
              <FiArrowLeft className="text-[13px]" />
              Back
            </button>

            <div className="flex flex-wrap items-center gap-2">
              <span
                className={[
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold",
                  statusStyle.chip,
                ].join(" ")}
              >
                {getStatusIcon(selectedStatus)}
                {selectedStatus}
              </span>

              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-[11px] text-white/70">
                <FiShield className="text-cyan-300" />
                OpenVAS Target Status
              </span>
            </div>

            <h1 className="mt-4 text-[24px] font-semibold tracking-tight sm:text-[30px]">
              Target Status Data
            </h1>

            <p className="mt-1.5 max-w-2xl text-[12px] leading-6 text-white/65 sm:text-[13px]">
              Showing target scan tasks with status{" "}
              <span className="font-semibold text-white">{selectedStatus}</span>.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 lg:w-105">
            <div className="rounded-2xl border border-white/10 bg-white/8 p-3 backdrop-blur-sm">
              <p className="text-[10px] text-white/45">Targets</p>
              <p className="mt-1 text-[20px] font-semibold tabular-nums">
                {loading ? "..." : summary.total.toLocaleString()}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/8 p-3 backdrop-blur-sm">
              <p className="text-[10px] text-white/45">Reports</p>
              <p className="mt-1 text-[20px] font-semibold tabular-nums">
                {loading ? "..." : summary.reports.toLocaleString()}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/8 p-3 backdrop-blur-sm">
              <p className="text-[10px] text-white/45">Avg Severity</p>
              <p className="mt-1 text-[20px] font-semibold tabular-nums">
                {loading ? "..." : formatSeverity(summary.avgSeverity)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <section className="mt-4 overflow-hidden rounded-[22px] border border-slate-200/80 bg-white shadow-sm dark:border-white/10 dark:bg-[#0B1220]">
        <div className="flex flex-col gap-3 border-b border-slate-200/80 px-4 py-3 dark:border-white/10 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-slate-900 dark:text-white">
              {selectedStatus} Targets
            </h2>

            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-white/45">
              {loading
                ? "Loading..."
                : `${sortedRows.length.toLocaleString()} of ${rows.length.toLocaleString()} targets • Page ${currentPage}/${totalPages}`}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-75">
              <FiSearch className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[13px] text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search target or host..."
                className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 pr-3 pl-8 text-[12px] text-slate-800 outline-none transition-all duration-300 placeholder:text-slate-400 focus:border-cyan-300 focus:bg-white focus:ring-3 focus:ring-cyan-100 dark:border-white/10 dark:bg-white/6 dark:text-white dark:placeholder:text-white/35 dark:focus:border-cyan-400/30 dark:focus:ring-cyan-400/10"
              />
            </div>

            <div className="relative w-full sm:w-45" ref={sortRef}>
              <button
                type="button"
                onClick={() => setOpenSort((prev) => !prev)}
                className={[
                  "flex h-9 w-full items-center justify-between gap-2 rounded-xl border px-3 text-left transition",
                  "border-slate-200 bg-slate-50 text-slate-800 hover:bg-white",
                  "dark:border-white/10 dark:bg-white/6 dark:text-white/80 dark:hover:bg-white/10",
                ].join(" ")}
              >
                <span className="block truncate text-[12px] font-semibold">
                  {currentSort.label}
                </span>

                <FiChevronDown
                  className={[
                    "shrink-0 text-[14px] text-slate-400 transition",
                    openSort ? "rotate-180" : "",
                  ].join(" ")}
                />
              </button>

              {openSort && (
                <div
                  className={[
                    "absolute right-0 z-50 mt-2 w-full overflow-hidden rounded-2xl border shadow-xl",
                    "border-slate-200 bg-white",
                    "dark:border-white/10 dark:bg-[#0B1220] dark:shadow-[0_18px_44px_rgba(0,0,0,0.28)]",
                  ].join(" ")}
                >
                  <div className="p-1.5">
                    {SORT_OPTIONS.map((option) => {
                      const active = option.value === sortMode;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setSortMode(option.value);
                            setOpenSort(false);
                          }}
                          className={[
                            "w-full rounded-xl px-3 py-2 text-left text-[11px] font-semibold transition",
                            active
                              ? "border border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-500/10 dark:text-cyan-300"
                              : "border border-transparent text-slate-700 hover:bg-slate-50 dark:text-white/75 dark:hover:bg-white/6",
                          ].join(" ")}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-245 border-collapse">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/70 text-left dark:border-white/10 dark:bg-white/4">
                <th className="px-4 py-2.5 text-[10.5px] font-semibold tracking-wide text-slate-500 dark:text-white/45">
                  Name
                </th>

                <th className="px-4 py-2.5 text-[10.5px] font-semibold tracking-wide text-slate-500 dark:text-white/45">
                  Status
                </th>

                <th className="px-4 py-2.5 text-[10.5px] font-semibold tracking-wide text-slate-500 dark:text-white/45">
                  Reports
                </th>

                <th className="px-4 py-2.5 text-[10.5px] font-semibold tracking-wide text-slate-500 dark:text-white/45">
                  Last Report
                </th>

                <th className="px-4 py-2.5 text-[10.5px] font-semibold tracking-wide text-slate-500 dark:text-white/45">
                  Severity
                </th>

                <th className="px-4 py-2.5 text-[10.5px] font-semibold tracking-wide text-slate-500 dark:text-white/45">
                  Trend
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
                      No target data found
                    </p>

                    <p className="mt-1 text-[11px] text-slate-500 dark:text-white/45">
                      Try changing your search keyword.
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
                  const trend = getTrend(item);
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

                          <p className="mt-0.5 max-w-65 truncate text-[11.5px] text-slate-600 dark:text-white/55">
                            {item.target_hosts || item.target_name || "-"}
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
                          {normalized}
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
                Showing{" "}
                {Math.min(
                  (currentPage - 1) * ROWS_PER_PAGE + 1,
                  sortedRows.length
                )}
                -
                {Math.min(currentPage * ROWS_PER_PAGE, sortedRows.length)} of{" "}
                {sortedRows.length.toLocaleString()}
              </p>

              <div className="flex flex-wrap items-center justify-start gap-1.5 sm:justify-end">
                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(1, prev - 1))
                  }
                  disabled={currentPage === 1}
                  className={[
                    "inline-flex h-8 min-w-8 items-center justify-center rounded-xl border px-2 text-[11px] font-medium transition",
                    currentPage === 1
                      ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-white/25"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/6 dark:text-white/80 dark:hover:bg-white/10",
                  ].join(" ")}
                >
                  Prev
                </button>

                {pageNumbers.map((page) => {
                  const active = page === currentPage;

                  return (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setCurrentPage(page)}
                      className={[
                        "inline-flex h-8 min-w-8 items-center justify-center rounded-xl border px-2 text-[11px] font-semibold transition",
                        active
                          ? "border-cyan-400 bg-cyan-500 text-white shadow-sm"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/6 dark:text-white/80 dark:hover:bg-white/10",
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
                  Next
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