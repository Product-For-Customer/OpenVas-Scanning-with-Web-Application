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
import { ListDeviceRisk, type DeviceRiskDTO } from "../../../services";

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

const TableTarget: React.FC = () => {
  const [data, setData] = useState<DeviceRiskDTO[] | null>(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [openSort, setOpenSort] = useState(false);

  const sortRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
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
    })();

    return () => {
      mounted = false;
    };
  }, []);

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
      const diff = b.vulnerabilityTotal - a.vulnerabilityTotal;
      return sortOrder === "desc" ? diff : -diff;
    });

    return filtered.map((r, i) => ({ ...r, no: i + 1 }));
  }, [baseRows, search, sortOrder]);

  const stats = useMemo(() => {
    const list = data ?? [];
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
        <div className="flex flex-col gap-3 mb-4">
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
                    {loading ? "Scanner Syncing" : `${stats.totalTargets} targets loaded`}
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

              <h2 className="text-[16px] sm:text-[17px] font-semibold text-[#1f2240] dark:text-white/90">
                Device Vulnerability Table
              </h2>
              <p className="text-[11px] sm:text-[12px] text-gray-500 dark:text-white/55 mt-1">
                Monitored targets, firmware details, vulnerability totals, and live risk posture
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center">
              <div
                className={[
                  "flex items-center gap-2 rounded-[14px] h-9 px-3 min-w-60",
                  "border border-gray-200/80 bg-white",
                  "dark:border-white/10 dark:bg-white/5",
                ].join(" ")}
              >
                <FiSearch className="text-[13px] text-gray-400 dark:text-white/35 shrink-0" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search target, ip, firmware..."
                  className="w-full bg-transparent outline-none text-[12px] text-gray-700 placeholder:text-gray-400 dark:text-white/80 dark:placeholder:text-white/30"
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
                    {sortOrder === "desc" ? "Highest Vulns" : "Lowest Vulns"}
                  </span>
                  <FiChevronDown
                    className={`transition ${
                      openSort ? "rotate-180" : ""
                    } text-[14px] text-gray-500 dark:text-white/55`}
                  />
                </button>

                {openSort && (
                  <div className="absolute right-0 mt-2 w-48 rounded-2xl border border-gray-200 bg-white shadow-xl overflow-hidden z-30 dark:border-white/10 dark:bg-[#0B1220] dark:shadow-none">
                    <button
                      type="button"
                      onClick={() => {
                        setSortOrder("desc");
                        setOpenSort(false);
                      }}
                      className="w-full px-3 py-2.5 text-left text-[12px] text-gray-700 hover:bg-gray-50 dark:text-white/80 dark:hover:bg-white/5"
                    >
                      Highest Vulnerability
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSortOrder("asc");
                        setOpenSort(false);
                      }}
                      className="w-full px-3 py-2.5 text-left text-[12px] text-gray-700 hover:bg-gray-50 dark:text-white/80 dark:hover:bg-white/5"
                    >
                      Lowest Vulnerability
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
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200/80 dark:border-white/10">
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-white/50 whitespace-nowrap">
                    No
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-white/50 whitespace-nowrap">
                    Target
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-white/50 whitespace-nowrap">
                    IP Address
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-white/50 whitespace-nowrap">
                    Firmware
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-white/50 whitespace-nowrap">
                    Vulnerability
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-white/50 whitespace-nowrap min-w-52.5">
                    Risk Progress
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-500 dark:text-white/50 whitespace-nowrap">
                    Risk Score
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr
                      key={i}
                      className="border-b border-gray-100 dark:border-white/5"
                    >
                      <td className="px-4 py-3.5">
                        <div className="h-3 w-5 rounded bg-gray-200 dark:bg-white/10 animate-pulse" />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="h-3 w-28 rounded bg-gray-200 dark:bg-white/10 animate-pulse" />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="h-3 w-20 rounded bg-gray-200 dark:bg-white/10 animate-pulse" />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="h-3 w-36 rounded bg-gray-200 dark:bg-white/10 animate-pulse" />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="h-3 w-14 rounded bg-gray-200 dark:bg-white/10 animate-pulse" />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="h-2 w-full rounded bg-gray-200 dark:bg-white/10 animate-pulse" />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="ml-auto h-3 w-12 rounded bg-gray-200 dark:bg-white/10 animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-7 text-center text-[12px] text-gray-500 dark:text-white/55"
                    >
                      No Data
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const { Icon, bg, fg, ring } = DEVICE_ICONS[row.iconIndex];
                    const riskMeta = getRiskMeta(row.riskScore);

                    return (
                      <tr
                        key={row.id}
                        className="border-b border-gray-100 dark:border-white/5 hover:bg-gray-50/70 dark:hover:bg-white/3 transition-colors"
                      >
                        <td className="px-4 py-3.5 text-[12px] text-gray-600 dark:text-white/70 whitespace-nowrap">
                          {row.no}
                        </td>

                        <td className="px-4 py-3.5 min-w-52.5">
                          <div className="flex items-center gap-2.5 min-w-0">
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

                        <td className="px-4 py-3.5 text-[12px] text-gray-600 dark:text-white/65 whitespace-nowrap">
                          {row.ip}
                        </td>

                        <td className="px-4 py-3.5 min-w-65">
                          <div className="truncate text-[12px] text-gray-600 dark:text-white/65">
                            {row.firmwareVersion}
                          </div>
                        </td>

                        <td className="px-4 py-3.5 text-[12px] font-medium text-gray-700 dark:text-white/75 whitespace-nowrap">
                          {formatNumber(row.vulnerabilityTotal)}
                        </td>

                        <td className="px-4 py-3.5 min-w-52.5">
                          <div className="flex items-center gap-2.5">
                            <div className="flex-1 h-2 rounded-full bg-[#eef0f6] dark:bg-white/10 overflow-hidden">
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
                            <span className="text-[10px] text-gray-400 dark:text-white/40 whitespace-nowrap">
                              {formatRisk(row.riskScore)}
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
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
      </div>
    </section>
  );
};

export default TableTarget;