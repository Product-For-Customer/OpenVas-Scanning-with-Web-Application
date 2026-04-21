import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FiSearch,
  FiChevronDown,
  FiShield,
  FiRadio,
  FiActivity,
} from "react-icons/fi";
import {
  MdRouter,
  MdDevices,
  MdImportantDevices,
  MdMemory,
  MdSecurity,
} from "react-icons/md";
import type { DeviceRiskDTO } from "../../../services";

type SortOrder = "desc" | "asc";

type Row = {
  id: string;
  no: number;
  taskID: string;
  name: string;
  ip: string;
  firmwareVersion: string;
  vulnerabilityTotal: number;
  progressPercent: number;
  riskScore: number;
  iconIndex: number;
};

interface TableTargetProps {
  data: DeviceRiskDTO[];
  loading: boolean;
}

const ROWS_PER_PAGE = 4;

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

const formatNumber = (n: number) =>
  !Number.isFinite(n) ? "0" : n.toLocaleString();

const formatRisk = (n: number) =>
  !Number.isFinite(n) ? "0.00" : n.toFixed(2);

const clampRiskToTen = (risk: number) => clamp(risk || 0, 0, 10);

const getProgressPercentFromRisk = (risk: number) =>
  (clampRiskToTen(risk) / 10) * 100;

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
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % DEVICE_ICONS.length;
};

const getRiskMeta = (risk: number) => {
  if (risk >= 8) {
    return {
      label: "Critical",
      text: "text-red-600 dark:text-red-300",
      chip:
        "bg-red-50 border-red-200 text-red-700 dark:bg-red-500/10 dark:border-red-400/20 dark:text-red-300",
      bar: "linear-gradient(90deg, #fb7185 0%, #ef4444 100%)",
    };
  }

  if (risk >= 6) {
    return {
      label: "High",
      text: "text-orange-600 dark:text-orange-300",
      chip:
        "bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-500/10 dark:border-orange-400/20 dark:text-orange-300",
      bar: "linear-gradient(90deg, #fdba74 0%, #f97316 100%)",
    };
  }

  if (risk >= 4) {
    return {
      label: "Medium",
      text: "text-yellow-700 dark:text-yellow-300",
      chip:
        "bg-yellow-50 border-yellow-200 text-yellow-700 dark:bg-yellow-500/10 dark:border-yellow-400/20 dark:text-yellow-300",
      bar: "linear-gradient(90deg, #fde68a 0%, #eab308 100%)",
    };
  }

  if (risk > 0) {
    return {
      label: "Low",
      text: "text-emerald-700 dark:text-emerald-300",
      chip:
        "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-400/20 dark:text-emerald-300",
      bar: "linear-gradient(90deg, #86efac 0%, #22c55e 100%)",
    };
  }

  return {
    label: "Info",
    text: "text-blue-700 dark:text-blue-300",
    chip:
      "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-500/10 dark:border-blue-400/20 dark:text-blue-300",
    bar: "linear-gradient(90deg, #7dd3fc 0%, #38bdf8 100%)",
  };
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
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [openSort, setOpenSort] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const sortRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setOpenSort(false);
      }
    };

    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const baseRows = useMemo(() => {
    const list = Array.isArray(data) ? data : [];

    const mapped: Row[] = list.map((x, idx) => {
      const risk = Number(x?.risk_score) || 0;
      const vuln = Number(x?.vulnerability_total) || 0;
      const progressPercent = getProgressPercentFromRisk(risk);

      const taskID = String(x?.task_id ?? "").trim();
      const name = String(x?.task_name ?? "").trim() || "-";
      const ip = String(x?.ip_address ?? "").trim() || "-";
      const fw =
        String(x?.firmware_version ?? "Unknown Device").trim() ||
        "Unknown Device";
      const iconIndex = stableIconIndex(`${taskID}-${ip}-${name}-${fw}`);

      return {
        id: `${taskID || "task"}-${ip}-${idx}`,
        no: idx + 1,
        taskID,
        name,
        ip,
        firmwareVersion: fw,
        vulnerabilityTotal: vuln,
        progressPercent: clamp(progressPercent, 0, 100),
        riskScore: risk,
        iconIndex,
      };
    });

    return mapped;
  }, [data]);

  const rows: Row[] = useMemo(() => {
    let filtered = [...baseRows];

    const q = search.trim().toLowerCase();
    if (q.length > 0) {
      filtered = filtered.filter((r) => {
        return (
          r.name.toLowerCase().includes(q) ||
          r.ip.toLowerCase().includes(q) ||
          r.firmwareVersion.toLowerCase().includes(q)
        );
      });
    }

    filtered.sort((a, b) => {
      const diff = b.riskScore - a.riskScore;
      return sortOrder === "desc" ? diff : -diff;
    });

    return filtered.map((r, i) => ({ ...r, no: i + 1 }));
  }, [baseRows, search, sortOrder]);

  const totalPages = useMemo(() => {
    const total = Math.ceil(rows.length / ROWS_PER_PAGE);
    return Math.max(1, total);
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
  }, [search, sortOrder]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const stats = useMemo(() => {
    const list = Array.isArray(data) ? data : [];
    const totalTargets = list.length;
    const totalVulns = list.reduce(
      (sum, x) => sum + (Number(x?.vulnerability_total) || 0),
      0
    );
    const highestRisk = list.reduce(
      (m, x) => Math.max(m, Number(x?.risk_score) || 0),
      0
    );

    return { totalTargets, totalVulns, highestRisk };
  }, [data]);

  return (
    <section
      className={[
        "relative overflow-hidden rounded-[20px] p-3 sm:p-4",
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

      <div className="relative z-10">
        <div className="mb-4 flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="mb-2.5 flex flex-wrap items-center gap-2">
                <div
                  className={[
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1",
                    "bg-cyan-50 text-cyan-700 border border-cyan-200/80",
                    "dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-400/20",
                  ].join(" ")}
                >
                  <FiShield className="text-[11px]" />
                  <span className="text-[10px] font-semibold tracking-wide">
                    Target Scan Console
                  </span>
                </div>

                <div
                  className={[
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1",
                    "bg-slate-50 text-slate-600 border border-slate-200/80",
                    "dark:bg-white/5 dark:text-white/65 dark:border-white/10",
                  ].join(" ")}
                >
                  <FiRadio className="text-[11px] text-cyan-500" />
                  <span className="text-[10px] font-medium">
                    {loading
                      ? "Scanner Syncing"
                      : `${stats.totalTargets} targets loaded`}
                  </span>
                </div>

                <div
                  className={[
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1",
                    "bg-slate-50 text-slate-600 border border-slate-200/80",
                    "dark:bg-white/5 dark:text-white/65 dark:border-white/10",
                  ].join(" ")}
                >
                  <FiActivity className="text-[11px] text-violet-500" />
                  <span className="text-[10px] font-medium">
                    {loading
                      ? "Loading telemetry..."
                      : `${stats.totalVulns.toLocaleString()} total vulns`}
                  </span>
                </div>

                <div
                  className={[
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1",
                    "bg-slate-50 text-slate-600 border border-slate-200/80",
                    "dark:bg-white/5 dark:text-white/65 dark:border-white/10",
                  ].join(" ")}
                >
                  <span className="text-[10px] font-medium">
                    Peak risk {formatRisk(stats.highestRisk)}/10
                  </span>
                </div>
              </div>

              <h2 className="text-[16px] font-semibold text-[#1f2240] dark:text-white/90 sm:text-[17px]">
                Device Vulnerability Table
              </h2>
              <p className="mt-1 text-[11px] text-gray-500 dark:text-white/55 sm:text-[12px]">
                Monitored targets, firmware details, vulnerability totals, and
                live risk posture
              </p>
            </div>

            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
              <div
                className={[
                  "flex items-center gap-2 rounded-[14px] h-9 px-3 min-w-60",
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

              <div className="relative" ref={sortRef}>
                <button
                  type="button"
                  onClick={() => setOpenSort((prev) => !prev)}
                  className={[
                    "h-9 px-3.5 rounded-[14px] inline-flex items-center justify-between gap-2 transition text-left min-w-35",
                    "border border-gray-200/80 bg-white text-[12px] font-medium text-[#1f2240] hover:bg-gray-50",
                    "dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10",
                  ].join(" ")}
                >
                  <span>
                    {sortOrder === "desc" ? "Highest Risk" : "Lowest Risk"}
                  </span>
                  <FiChevronDown
                    className={`text-[14px] text-gray-500 transition dark:text-white/55 ${
                      openSort ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {openSort && (
                  <div className="absolute right-0 z-30 mt-2 w-48 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-white/10 dark:bg-[#0B1220] dark:shadow-none">
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
            "overflow-hidden rounded-[18px] border",
            "border-gray-200/80 bg-white/80",
            "dark:border-white/10 dark:bg-white/3",
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
                  <th className="min-w-52.5 whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-white/50">
                    Risk Progress
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-right text-[11px] font-semibold text-gray-500 dark:text-white/50">
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
                        <div className="h-3 w-28 animate-pulse rounded bg-gray-200 dark:bg-white/10" />
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
                        <div className="h-2 w-full animate-pulse rounded bg-gray-200 dark:bg-white/10" />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="ml-auto h-3 w-12 animate-pulse rounded bg-gray-200 dark:bg-white/10" />
                      </td>
                    </tr>
                  ))
                ) : paginatedRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-7 text-center text-[12px] text-gray-500 dark:text-white/55"
                    >
                      No Data
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((row) => {
                    const { Icon, bg, fg, ring } = DEVICE_ICONS[row.iconIndex];
                    const riskMeta = getRiskMeta(row.riskScore);

                    return (
                      <tr
                        key={row.id}
                        className="border-b border-gray-100 transition-colors hover:bg-gray-50/70 dark:border-white/5 dark:hover:bg-white/3"
                      >
                        <td className="whitespace-nowrap px-4 py-3.5 text-[12px] text-gray-600 dark:text-white/70">
                          {row.no}
                        </td>

                        <td className="min-w-52.5 px-4 py-3.5">
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
                              <div className="mt-1">
                                <span
                                  className={[
                                    "inline-flex items-center rounded-full px-2 py-0.5 text-[8.5px] font-semibold border",
                                    riskMeta.chip,
                                  ].join(" ")}
                                >
                                  {riskMeta.label}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="whitespace-nowrap px-4 py-3.5 text-[12px] text-gray-600 dark:text-white/65">
                          {row.ip}
                        </td>

                        <td className="min-w-65 px-4 py-3.5">
                          <div className="truncate text-[12px] text-gray-600 dark:text-white/65">
                            {row.firmwareVersion}
                          </div>
                        </td>

                        <td className="whitespace-nowrap px-4 py-3.5 text-[12px] font-medium text-gray-700 dark:text-white/75">
                          {formatNumber(row.vulnerabilityTotal)}
                        </td>

                        <td className="min-w-52.5 px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#eef0f6] dark:bg-white/10">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${Math.max(
                                    row.progressPercent,
                                    row.riskScore > 0 ? 3 : 0
                                  )}%`,
                                  background: riskMeta.bar,
                                }}
                              />
                            </div>
                            <span className="whitespace-nowrap text-[10px] text-gray-400 dark:text-white/40">
                              {formatRisk(row.riskScore)}
                            </span>
                          </div>
                        </td>

                        <td className="whitespace-nowrap px-4 py-3.5 text-right">
                          <div
                            className={`text-[12px] font-semibold ${riskMeta.text}`}
                          >
                            {formatRisk(row.riskScore)}
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

        {!loading && totalPages > 1 && (
          <div className="mt-3 flex justify-end">
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
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
          </div>
        )}
      </div>
    </section>
  );
};

export default TableTarget;