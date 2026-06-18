import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FiSearch,
  FiChevronDown,
  FiCheck,
  FiX,
} from "react-icons/fi";
import { useLanguage } from "../../../contexts/LanguageContext";
import {
  MdRouter,
  MdDevices,
  MdImportantDevices,
  MdMemory,
  MdSecurity,
} from "react-icons/md";
import { useNavigate } from "react-router-dom";
import type { DeviceRiskDTO } from "../../../services";

type SortOrder = "desc" | "asc";

type Row = {
  id: string;
  no: number;
  taskID: string;
  name: string;
  ip: string;
  targetKey: string;
  targetLabel: string;
  firmwareVersion: string;
  vulnerabilityTotal: number;
  progressPercent: number;
  riskScore: number;
  iconIndex: number;
};

type TargetOption = {
  key: string;
  label: string;
  taskID: string;
  name: string;
  ip: string;
};

interface TableTargetProps {
  data: DeviceRiskDTO[];
  loading: boolean;
}

const ROWS_PER_PAGE = 5;

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

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

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
  return clamp(risk, 0, 10);
};

const getProgressPercentFromRisk = (risk: number) => {
  return (clampRiskToTen(risk) / 10) * 100;
};

const buildTargetKey = (taskName: string, ip: string) => {
  const safeTask = String(taskName || "-").trim() || "-";
  const safeIp = String(ip || "-").trim() || "-";
  return `${safeTask}__${safeIp}`;
};

const buildTargetLabel = (taskName: string, ip: string) => {
  const safeTask = String(taskName || "-").trim() || "-";
  const safeIp = String(ip || "-").trim() || "-";
  return `${safeTask} - ${safeIp}`;
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
  let level = 1;

  if (value >= 8) level = 5;
  else if (value >= 6) level = 4;
  else if (value >= 4) level = 3;
  else if (value > 0) level = 2;

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
          className={[
            "h-1.5 w-1.5 rounded-full",
            i < level ? activeClass : "bg-gray-200 dark:bg-white/10",
          ].join(" ")}
        />
      ))}
    </div>
  );
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

const TableTarget: React.FC<TableTargetProps> = ({ data, loading }) => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [openSort, setOpenSort] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const [openTargetQuery, setOpenTargetQuery] = useState(false);
  const [targetQuerySearch, setTargetQuerySearch] = useState("");
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);

  const sortRef = useRef<HTMLDivElement | null>(null);
  const targetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;

      if (sortRef.current && !sortRef.current.contains(target)) {
        setOpenSort(false);
      }

      if (targetRef.current && !targetRef.current.contains(target)) {
        setOpenTargetQuery(false);
      }
    };

    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const baseRows = useMemo<Row[]>(() => {
    const list = Array.isArray(data) ? data : [];

    return list.map((x, idx) => {
      const taskID = String(x?.task_id ?? "").trim();
      const name = String(x?.task_name ?? "").trim() || "Unknown Task";
      const ip = String(x?.ip_address ?? "").trim() || "-";
      const firmwareVersion =
        String(x?.firmware_version ?? "").trim() || "Unknown Device";

      const vulnerabilityTotal = Number(x?.vulnerability_total) || 0;
      const riskScore = Number(x?.risk_score) || 0;
      const progressPercent = getProgressPercentFromRisk(riskScore);

      const targetKey = buildTargetKey(name, ip);
      const targetLabel = buildTargetLabel(name, ip);

      const iconIndex = stableIconIndex(
        `${taskID}-${name}-${ip}-${firmwareVersion}`
      );

      return {
        id: `${targetKey}-${taskID || "task"}-${idx}`,
        no: idx + 1,
        taskID,
        name,
        ip,
        targetKey,
        targetLabel,
        firmwareVersion,
        vulnerabilityTotal,
        progressPercent: clamp(progressPercent, 0, 100),
        riskScore,
        iconIndex,
      };
    });
  }, [data]);

  const targetOptions = useMemo<TargetOption[]>(() => {
    const seen = new Set<string>();
    const options: TargetOption[] = [];

    for (const row of baseRows) {
      if (!row.targetKey || seen.has(row.targetKey)) continue;

      seen.add(row.targetKey);

      options.push({
        key: row.targetKey,
        label: row.targetLabel,
        taskID: row.taskID,
        name: row.name,
        ip: row.ip,
      });
    }

    return options.sort((a, b) => a.label.localeCompare(b.label));
  }, [baseRows]);

  const filteredTargetOptions = useMemo(() => {
    const keyword = targetQuerySearch.trim().toLowerCase();
    if (!keyword) return targetOptions;

    return targetOptions.filter((opt) =>
      opt.label.toLowerCase().includes(keyword)
    );
  }, [targetOptions, targetQuerySearch]);

  const rows = useMemo<Row[]>(() => {
    let filtered = [...baseRows];

    if (selectedTargets.length > 0) {
      const selectedSet = new Set(selectedTargets);
      filtered = filtered.filter((r) => selectedSet.has(r.targetKey));
    }

    const q = search.trim().toLowerCase();

    if (q.length > 0) {
      filtered = filtered.filter((r) => {
        return (
          r.name.toLowerCase().includes(q) ||
          r.ip.toLowerCase().includes(q) ||
          r.targetLabel.toLowerCase().includes(q) ||
          r.firmwareVersion.toLowerCase().includes(q) ||
          r.riskScore.toString().includes(q) ||
          r.vulnerabilityTotal.toString().includes(q)
        );
      });
    }

    filtered.sort((a, b) => {
      if (b.riskScore !== a.riskScore) {
        return sortOrder === "desc"
          ? b.riskScore - a.riskScore
          : a.riskScore - b.riskScore;
      }

      if (b.vulnerabilityTotal !== a.vulnerabilityTotal) {
        return b.vulnerabilityTotal - a.vulnerabilityTotal;
      }

      return a.name.localeCompare(b.name);
    });

    return filtered.map((r, i) => ({ ...r, no: i + 1 }));
  }, [baseRows, search, sortOrder, selectedTargets]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE));
  }, [rows.length]);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * ROWS_PER_PAGE;
    const end = start + ROWS_PER_PAGE;

    return rows.slice(start, end);
  }, [rows, currentPage]);

  const pageNumbers = useMemo(() => {
    return buildPageNumbers(currentPage, totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, sortOrder, selectedTargets]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const stats = useMemo(() => {
    const source = rows;

    const totalTargets = source.length;
    const totalVulns = source.reduce(
      (sum, x) => sum + (Number(x?.vulnerabilityTotal) || 0),
      0
    );
    const highestRisk = source.reduce(
      (m, x) => Math.max(m, Number(x?.riskScore) || 0),
      0
    );

    return {
      totalTargets,
      totalVulns,
      highestRisk,
    };
  }, [rows]);

  const targetButtonLabel = useMemo(() => {
    if (selectedTargets.length === 0) return "Target Filter";
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

  const goToDevice = (row: Row) => {
    if (!row.taskID.trim()) {
      console.warn("Cannot navigate: task_id is empty");
      return;
    }

    navigate("/admin/vulnerability-by-device", {
      state: {
        task_id: row.taskID,
        ip_address: row.ip,
        task_name: row.name,
        firmware_version: row.firmwareVersion,
      },
    });
  };

  return (
    <section className="rounded-xl border border-slate-200/70 bg-white p-4 dark:border-white/8 dark:bg-[#0d0b1a]/80 sm:p-5">
      <div>
        <div className="mb-4 flex flex-col gap-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-[13px] font-semibold text-slate-700 dark:text-white/80">
                  {t("target.title")}
                </h2>
                {!loading && (
                  <>
                    <span className="rounded-full border border-slate-200/70 bg-slate-50 px-2.5 py-0.5 text-[10.5px] font-medium text-slate-500 dark:border-white/8 dark:bg-white/5 dark:text-white/40">
                      {stats.totalTargets} targets
                    </span>
                    <span className="rounded-full border border-slate-200/70 bg-slate-50 px-2.5 py-0.5 text-[10.5px] font-medium text-slate-500 dark:border-white/8 dark:bg-white/5 dark:text-white/40">
                      {formatNumber(stats.totalVulns)} vulns
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex w-full flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center xl:w-auto xl:justify-end">
              <div className="relative w-full sm:w-auto" ref={targetRef}>
                <button
                  type="button"
                  onClick={() => setOpenTargetQuery((prev) => !prev)}
                  className="flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border border-slate-200/70 bg-white px-3 text-[10.5px] font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/8 sm:min-w-44"
                >
                  <span className="truncate">{targetButtonLabel}</span>

                  <div className="flex shrink-0 items-center gap-1.5">
                    {selectedTargets.length > 0 && (
                      <span className="inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full border border-cyan-200 bg-cyan-50 px-1 text-[9px] font-semibold text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-500/10 dark:text-cyan-300">
                        {selectedTargets.length}
                      </span>
                    )}

                    <FiChevronDown
                      className={[
                        "text-[14px] text-gray-500 transition dark:text-white/55",
                        openTargetQuery ? "rotate-180" : "",
                      ].join(" ")}
                    />
                  </div>
                </button>

                {openTargetQuery && (
                  <div
                    className={[
                      "fixed left-3 right-3 top-20 z-100 overflow-hidden rounded-xl",
                      "border border-slate-200/80 bg-white shadow-xl",
                      "dark:border-white/10 dark:bg-[#0d0b1a]",
                      "sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-1.5 sm:w-[min(20rem,calc(100vw-2rem))]",
                    ].join(" ")}
                  >
                    <div className="border-b border-gray-100 p-2 dark:border-white/10">
                      <div
                        className={[
                          "flex h-8 items-center gap-2 rounded-xl px-2.5",
                          "bg-slate-50 border border-slate-200/80",
                          "dark:bg-white/5 dark:border-white/10",
                        ].join(" ")}
                      >
                        <FiSearch className="shrink-0 text-[12px] text-gray-400 dark:text-white/40" />

                        <input
                          type="text"
                          value={targetQuerySearch}
                          onChange={(e) => setTargetQuerySearch(e.target.value)}
                          placeholder="Search target or ip..."
                          className="w-full bg-transparent text-[10.5px] text-gray-700 outline-none placeholder:text-gray-400 dark:text-white/80 dark:placeholder:text-white/30"
                        />

                        {targetQuerySearch.trim() !== "" && (
                          <button
                            type="button"
                            onClick={() => setTargetQuerySearch("")}
                            className="text-gray-400 hover:text-gray-600 dark:text-white/35 dark:hover:text-white/70"
                            aria-label="Clear target search"
                          >
                            <FiX className="text-[11px]" />
                          </button>
                        )}
                      </div>

                      <div className="mt-1.5 flex items-center justify-between gap-2 px-0.5">
                        <button
                          type="button"
                          onClick={handleSelectAllVisibleTargets}
                          className="text-[9.5px] font-medium text-cyan-600 hover:text-cyan-700 dark:text-cyan-300 dark:hover:text-cyan-200"
                        >
                          {allVisibleTargetsSelected
                            ? "Unselect visible"
                            : "Select visible"}
                        </button>

                        <button
                          type="button"
                          onClick={clearAllTargets}
                          className="text-[9.5px] font-medium text-gray-500 hover:text-gray-700 dark:text-white/50 dark:hover:text-white/75"
                        >
                          Clear all
                        </button>
                      </div>
                    </div>

                    <div className="max-h-[min(17rem,calc(100vh-9rem))] overflow-y-auto p-1.5 sm:max-h-60">
                      {filteredTargetOptions.length === 0 ? (
                        <div className="px-3 py-5 text-center text-[10px] text-gray-500 dark:text-white/50">
                          No matching targets
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
                                  "flex w-full items-start gap-2 rounded-xl px-2 py-1.5 text-left transition",
                                  checked
                                    ? "bg-cyan-50 border border-cyan-200 dark:bg-cyan-500/10 dark:border-cyan-400/20"
                                    : "border border-transparent hover:bg-gray-50 dark:hover:bg-white/5",
                                ].join(" ")}
                              >
                                <span
                                  className={[
                                    "mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-md border transition",
                                    checked
                                      ? "bg-cyan-500 border-cyan-500 text-white"
                                      : "bg-white border-gray-300 text-transparent dark:bg-white/5 dark:border-white/20",
                                  ].join(" ")}
                                >
                                  <FiCheck className="text-[8px]" />
                                </span>

                                <span className="min-w-0 flex-1">
                                  <span
                                    className="block text-[10px] font-medium leading-4 text-gray-700 dark:text-white/80"
                                    style={{ wordBreak: "break-word" }}
                                  >
                                    {opt.label}
                                  </span>
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div
                className={[
                  "flex h-9 w-full items-center gap-2 rounded-[14px] px-3 sm:w-64",
                  "border border-gray-200/80 bg-white",
                  "dark:border-white/10 dark:bg-white/5",
                ].join(" ")}
              >
                <FiSearch className="shrink-0 text-[13px] text-gray-400 dark:text-white/35" />

                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search target, ip, firmware..."
                  className="w-full bg-transparent text-[12px] text-gray-700 outline-none placeholder:text-gray-400 dark:text-white/80 dark:placeholder:text-white/30"
                />
              </div>

              <div className="relative w-full sm:w-auto" ref={sortRef}>
                <button
                  type="button"
                  onClick={() => setOpenSort((prev) => !prev)}
                  className={[
                    "h-9 w-full px-3.5 rounded-[14px] inline-flex items-center justify-between gap-2 transition text-left sm:min-w-35",
                    "border border-gray-200/80 bg-white text-[12px] font-medium text-[#1f2240] hover:bg-gray-50",
                    "dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10",
                  ].join(" ")}
                >
                  <span>
                    {sortOrder === "desc" ? "Highest Risk" : "Lowest Risk"}
                  </span>

                  <FiChevronDown
                    className={[
                      "text-[14px] text-gray-500 transition dark:text-white/55",
                      openSort ? "rotate-180" : "",
                    ].join(" ")}
                  />
                </button>

                {openSort && (
                  <div className="absolute right-0 z-60 mt-2 w-48 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-white/10 dark:bg-[#0B1220] dark:shadow-none">
                    <button
                      type="button"
                      onClick={() => {
                        setSortOrder("desc");
                        setOpenSort(false);
                      }}
                      className="w-full px-3 py-2.5 text-left text-[12px] text-gray-700 hover:bg-gray-50 dark:text-white/80 dark:hover:bg-white/5"
                    >
                      Highest Risk Score
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSortOrder("asc");
                        setOpenSort(false);
                      }}
                      className="w-full px-3 py-2.5 text-left text-[12px] text-gray-700 hover:bg-gray-50 dark:text-white/80 dark:hover:bg-white/5"
                    >
                      Lowest Risk Score
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div
          className={[
            "overflow-hidden rounded-xl border",
            "border-slate-200/70 bg-white",
            "dark:border-white/8 dark:bg-white/3",
          ].join(" ")}
        >
          <div className="overflow-x-auto overflow-y-hidden">
            <table className="min-w-full">
              <thead className="sticky top-0 z-20 bg-white dark:bg-[#0B1220]">
                <tr className="border-b border-gray-200/80 dark:border-white/10">
                  <th className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-white/50">
                    No
                  </th>

                  <th className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-white/50">
                    Target
                  </th>

                  <th className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-white/50">
                    IP Address
                  </th>

                  <th className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-white/50">
                    Firmware
                  </th>

                  <th className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-white/50">
                    Vulnerability
                  </th>

                  <th className="min-w-72 whitespace-nowrap px-4 py-3 text-right text-[11px] font-semibold text-gray-500 dark:text-white/50">
                    Risk Score
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  Array.from({ length: ROWS_PER_PAGE }).map((_, i) => (
                    <tr
                      key={i}
                      className="border-b border-gray-100 dark:border-white/5"
                    >
                      <td className="px-4 py-3.5">
                        <div className="h-3 w-5 animate-pulse rounded bg-gray-200 dark:bg-white/10" />
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="h-3 w-32 animate-pulse rounded bg-gray-200 dark:bg-white/10" />
                        <div className="mt-2 h-2.5 w-16 animate-pulse rounded bg-gray-200 dark:bg-white/10" />
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="h-3 w-20 animate-pulse rounded bg-gray-200 dark:bg-white/10" />
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="h-3 w-36 animate-pulse rounded bg-gray-200 dark:bg-white/10" />
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="h-3 w-14 animate-pulse rounded bg-gray-200 dark:bg-white/10" />
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="ml-auto h-3 w-18 animate-pulse rounded bg-gray-200 dark:bg-white/10" />
                        <div className="mt-2 ml-auto h-2 w-48 animate-pulse rounded bg-gray-200 dark:bg-white/10" />
                      </td>
                    </tr>
                  ))
                ) : paginatedRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-7 text-center text-[12px] text-gray-500 dark:text-white/55"
                    >
                      {t("target.noTargets")}
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((row) => {
                    const { Icon, bg, fg, ring } = DEVICE_ICONS[row.iconIndex];
                    const riskMeta = getRiskMeta(row.riskScore);

                    return (
                      <tr
                        key={row.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => goToDevice(row)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            goToDevice(row);
                          }
                        }}
                        className={[
                          "cursor-pointer select-none border-b border-gray-100 transition-colors",
                          "hover:bg-cyan-50/45 focus:bg-cyan-50/60 focus:outline-none",
                          "dark:border-white/5 dark:hover:bg-white/5 dark:focus:bg-white/6",
                        ].join(" ")}
                        title={
                          row.taskID
                            ? `Open vulnerabilities for task_id ${row.taskID}`
                            : "No task_id"
                        }
                      >
                        <td className="whitespace-nowrap px-4 py-3.5 text-[12px] text-gray-600 dark:text-white/70">
                          {row.no}
                        </td>

                        <td className="min-w-56 px-4 py-3.5">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <div
                              className={[
                                "h-8 w-8 rounded-xl border flex items-center justify-center shrink-0",
                                bg,
                                ring,
                              ].join(" ")}
                            >
                              <Icon className={`${fg} text-[15px]`} />
                            </div>

                            <div className="min-w-0">
                              <div className="truncate text-[12px] font-semibold text-[#1f2240] dark:text-white/85">
                                {row.name}
                              </div>

                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <span
                                  className={[
                                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[8.5px] font-semibold border",
                                    riskMeta.chip,
                                  ].join(" ")}
                                >
                                  <span
                                    className={`h-1.5 w-1.5 rounded-full ${riskMeta.dot}`}
                                  />
                                  {riskMeta.label}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="whitespace-nowrap px-4 py-3.5 text-[12px] text-gray-600 dark:text-white/65">
                          {row.ip}
                        </td>

                        <td className="min-w-64 px-4 py-3.5">
                          <div className="truncate text-[12px] text-gray-600 dark:text-white/65">
                            {row.firmwareVersion}
                          </div>
                        </td>

                        <td className="whitespace-nowrap px-4 py-3.5 text-[12px] font-medium text-gray-700 dark:text-white/75">
                          {formatNumber(row.vulnerabilityTotal)}
                        </td>

                        <td className="min-w-72 px-4 py-3.5">
                          <div className="flex flex-col items-end gap-1.5">
                            <div className="flex items-center justify-end gap-2">
                              <DangerDots value={row.riskScore} />

                              <span
                                className={`text-[12px] font-semibold tabular-nums ${riskMeta.text}`}
                              >
                                {formatRisk(row.riskScore)}
                              </span>
                            </div>

                            <div className="flex w-full max-w-64 items-center gap-2.5">
                              <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#eef0f6] dark:bg-white/10">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${Math.max(
                                      row.progressPercent,
                                      row.riskScore > 0 ? 4 : 0
                                    )}%`,
                                    background: riskMeta.bar,
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {!loading && rows.length > 0 && (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-[10.5px] text-gray-500 dark:text-white/45">
              Showing{" "}
              <span className="font-semibold text-gray-700 dark:text-white/70">
                {paginatedRows.length}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-gray-700 dark:text-white/70">
                {rows.length}
              </span>{" "}
              targets
            </div>

            {totalPages > 1 && (
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
                      ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400 dark:border-white/10 dark:bg-white/5 dark:text-white/25"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-white/6 dark:text-white/80 dark:hover:bg-white/10",
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
                          : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-white/6 dark:text-white/80 dark:hover:bg-white/10",
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
                      ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400 dark:border-white/10 dark:bg-white/5 dark:text-white/25"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-white/6 dark:text-white/80 dark:hover:bg-white/10",
                  ].join(" ")}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default TableTarget;
