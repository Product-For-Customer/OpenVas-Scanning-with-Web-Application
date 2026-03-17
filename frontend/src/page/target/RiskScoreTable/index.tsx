import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FiActivity,
  FiChevronDown,
  FiCheck,
  FiSearch,
  FiX,
} from "react-icons/fi";
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

type FilterOption = {
  key: string;
  label: string;
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
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={`h-2 w-2 rounded-full ${
            i < level ? activeClass : "bg-gray-200 dark:bg-white/10"
          }`}
        />
      ))}
    </div>
  );
};

const RiskScoreTable: React.FC = () => {
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  const [data, setData] = useState<DeviceRiskDTO[] | null>(null);
  const [loading, setLoading] = useState(true);

  const dropdownRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const allRows = useMemo(() => {
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

    return mapped;
  }, [data]);

  const filterOptions = useMemo<FilterOption[]>(() => {
    const seen = new Set<string>();
    const options: FilterOption[] = [];

    for (const row of allRows) {
      const key = `${row.taskID}__${row.ipAddress}`;
      if (seen.has(key)) continue;
      seen.add(key);

      options.push({
        key,
        label: `${row.taskName} - ${row.ipAddress || "-"}`,
      });
    }

    return options;
  }, [allRows]);

  const filteredOptions = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) return filterOptions;

    return filterOptions.filter((opt) =>
      opt.label.toLowerCase().includes(keyword)
    );
  }, [filterOptions, searchQuery]);

  const rows = useMemo(() => {
    if (selectedKeys.length === 0) return allRows;

    const selectedSet = new Set(selectedKeys);
    return allRows.filter((row) =>
      selectedSet.has(`${row.taskID}__${row.ipAddress}`)
    );
  }, [allRows, selectedKeys]);

  const maxRisk = useMemo(() => {
    return rows.reduce((m, x) => Math.max(m, Number(x?.risk) || 0), 0);
  }, [rows]);

  const selectedCount = selectedKeys.length;

  const dropdownButtonLabel = useMemo(() => {
    if (selectedCount === 0) return "Query Select";
    if (selectedCount === 1) {
      const found = filterOptions.find((x) => x.key === selectedKeys[0]);
      return found?.label || "1 selected";
    }
    return `${selectedCount} selected`;
  }, [selectedCount, filterOptions, selectedKeys]);

  const toggleSelect = (key: string) => {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    );
  };

  const handleSelectAllVisible = () => {
    const visibleKeys = filteredOptions.map((x) => x.key);

    setSelectedKeys((prev) => {
      const prevSet = new Set(prev);
      const allVisibleSelected = visibleKeys.every((key) => prevSet.has(key));

      if (allVisibleSelected) {
        return prev.filter((key) => !visibleKeys.includes(key));
      }

      const merged = new Set([...prev, ...visibleKeys]);
      return Array.from(merged);
    });
  };

  const clearAllSelections = () => {
    setSelectedKeys([]);
  };

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

  const allVisibleSelected =
    filteredOptions.length > 0 &&
    filteredOptions.every((opt) => selectedKeys.includes(opt.key));

  return (
    <section
      className={[
        "relative overflow-hidden h-full rounded-[22px] p-3 sm:p-4 md:p-4.5 flex flex-col",
        "bg-white border border-gray-200/80 shadow-sm",
        "dark:bg-white/5 dark:border-white/10 dark:ring-1 dark:ring-white/10 dark:shadow-none",
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-14 -right-10 h-32 w-32 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute -bottom-14 -left-10 h-32 w-32 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.035] dark:opacity-[0.055]">
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
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <h2 className="text-[17px] sm:text-[19px] font-semibold text-[#1f2240] dark:text-white/90 tracking-tight">
                Top Devices Risk
              </h2>
              <p className="mt-1 text-[11px] sm:text-[12px] text-gray-500 dark:text-white/55">
                Ranked device exposure from the latest security scan snapshot
              </p>
            </div>

            <div className="flex items-start sm:items-center gap-2 self-start lg:self-auto">
              <div className="relative min-w-62.5 sm:min-w-72.5" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setOpen((prev) => !prev)}
                  className={[
                    "w-full min-h-9 px-3.5 rounded-2xl inline-flex items-center justify-between gap-3 transition text-left",
                    "bg-white border border-gray-200/80 text-[12px] font-medium text-gray-600 hover:bg-gray-50",
                    "dark:bg-white/5 dark:border-white/10 dark:text-white/70 dark:hover:bg-white/10",
                  ].join(" ")}
                >
                  <span className="truncate">{dropdownButtonLabel}</span>

                  <div className="flex items-center gap-2 shrink-0">
                    {selectedCount > 0 && (
                      <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[10px] font-semibold bg-cyan-50 text-cyan-700 border border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-400/20">
                        {selectedCount}
                      </span>
                    )}

                    <FiChevronDown
                      className={`text-[13px] text-gray-400 dark:text-white/45 transition-transform ${
                        open ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </button>

                {open && (
                  <div className="absolute right-0 mt-2 w-full rounded-[22px] border border-gray-200 bg-white shadow-xl overflow-hidden z-30 dark:border-white/10 dark:bg-[#0B1220] dark:shadow-none">
                    <div className="p-2.5 border-b border-gray-100 dark:border-white/10">
                      <div
                        className={[
                          "flex items-center gap-2 rounded-2xl px-3 h-9",
                          "bg-slate-50 border border-slate-200/80",
                          "dark:bg-white/5 dark:border-white/10",
                        ].join(" ")}
                      >
                        <FiSearch className="text-gray-400 dark:text-white/40 shrink-0 text-[13px]" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search task name or ip..."
                          className="w-full bg-transparent outline-none text-[12px] text-gray-700 placeholder:text-gray-400 dark:text-white/80 dark:placeholder:text-white/30"
                        />
                        {searchQuery.trim() !== "" && (
                          <button
                            type="button"
                            onClick={() => setSearchQuery("")}
                            className="text-gray-400 hover:text-gray-600 dark:text-white/35 dark:hover:text-white/70"
                            aria-label="Clear search"
                          >
                            <FiX className="text-[13px]" />
                          </button>
                        )}
                      </div>

                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={handleSelectAllVisible}
                          className="text-[11px] font-medium text-cyan-600 hover:text-cyan-700 dark:text-cyan-300 dark:hover:text-cyan-200"
                        >
                          {allVisibleSelected ? "Unselect visible" : "Select visible"}
                        </button>

                        <button
                          type="button"
                          onClick={clearAllSelections}
                          className="text-[11px] font-medium text-gray-500 hover:text-gray-700 dark:text-white/50 dark:hover:text-white/75"
                        >
                          Clear all
                        </button>
                      </div>
                    </div>

                    <div className="max-h-64 overflow-y-auto p-2">
                      {filteredOptions.length === 0 ? (
                        <div className="px-3 py-7 text-center text-[12px] text-gray-500 dark:text-white/50">
                          No matching device
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {filteredOptions.map((opt) => {
                            const checked = selectedKeys.includes(opt.key);

                            return (
                              <button
                                key={opt.key}
                                type="button"
                                onClick={() => toggleSelect(opt.key)}
                                className={[
                                  "w-full flex items-start gap-3 rounded-2xl px-3 py-2.5 text-left transition",
                                  checked
                                    ? "bg-cyan-50 border border-cyan-200 dark:bg-cyan-500/10 dark:border-cyan-400/20"
                                    : "border border-transparent hover:bg-gray-50 dark:hover:bg-white/5",
                                ].join(" ")}
                              >
                                <span
                                  className={[
                                    "mt-0.5 h-4.5 w-4.5 rounded-md border flex items-center justify-center shrink-0 transition",
                                    checked
                                      ? "bg-cyan-500 border-cyan-500 text-white"
                                      : "bg-white border-gray-300 text-transparent dark:bg-white/5 dark:border-white/20",
                                  ].join(" ")}
                                >
                                  <FiCheck className="text-[10px]" />
                                </span>

                                <span className="min-w-0 flex-1">
                                  <span className="block text-[12px] font-medium text-gray-700 dark:text-white/80 wrap-break-word">
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
            </div>
          </div>

          <div
            className={[
              "rounded-[18px] px-3.5 py-2.5 flex flex-wrap items-center gap-2.5",
              "bg-slate-50 border border-slate-200/80",
              "dark:bg-white/4 dark:border-white/10",
            ].join(" ")}
          >
            <div className="inline-flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-500" />
              </span>
              <span className="text-[11px] font-medium text-slate-700 dark:text-white/75">
                Risk telemetry active
              </span>
            </div>

            <div className="hidden sm:block h-4 w-px bg-slate-200 dark:bg-white/10" />

            <div className="inline-flex items-center gap-2 text-[11px] text-slate-500 dark:text-white/50">
              <FiActivity className="text-cyan-500 text-[12px]" />
              Risk score, vulnerability count, and device exposure ranking
            </div>

            {selectedCount > 0 && (
              <>
                <div className="hidden sm:block h-4 w-px bg-slate-200 dark:bg-white/10" />
                <div className="inline-flex items-center gap-2 text-[11px] text-cyan-700 dark:text-cyan-300">
                  <span className="inline-flex h-1.5 w-1.5 rounded-full bg-cyan-500" />
                  Filtered by {selectedCount} selected device{selectedCount > 1 ? "s" : ""}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mt-3.5 flex-1">
          {loading ? (
            <div className="space-y-2.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className={[
                    "rounded-[18px] px-3.5 py-3 border animate-pulse",
                    "border-gray-200/80 bg-white",
                    "dark:border-white/10 dark:bg-white/5",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="h-9 w-9 rounded-2xl bg-gray-200 dark:bg-white/10" />
                      <div className="min-w-0 flex-1">
                        <div className="h-3.5 w-36 rounded bg-gray-200 dark:bg-white/10" />
                        <div className="mt-2 h-3 w-48 rounded bg-gray-200 dark:bg-white/10" />
                      </div>
                    </div>
                    <div className="h-7 w-20 rounded bg-gray-200 dark:bg-white/10" />
                  </div>
                </div>
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="py-7 text-[12px] text-gray-500 dark:text-white/55">
              No Data
            </div>
          ) : (
            <div className="space-y-2.5">
              {rows.map((p) => {
                const { Icon, bg, fg, ring } = DEVICE_ICONS[p.iconIndex];
                const riskMeta = getRiskMeta(p.risk);
                const barPercent = maxRisk > 0 ? (p.risk / maxRisk) * 100 : 0;

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
                      "rounded-[18px] px-3 sm:px-3.5 py-3 border transition-all duration-200 cursor-pointer select-none",
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
                    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div
                          className={[
                            "h-9 w-9 rounded-2xl border flex items-center justify-center shrink-0",
                            bg,
                            ring,
                          ].join(" ")}
                          aria-hidden="true"
                        >
                          <Icon className={`${fg} text-[18px]`} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="truncate text-[13px] sm:text-[14px] font-semibold text-[#1f2240] dark:text-white/85">
                              {p.taskName}
                            </p>

                            <span
                              className={[
                                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold border",
                                riskMeta.chip,
                              ].join(" ")}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${riskMeta.dot}`} />
                              {riskMeta.label}
                            </span>

                            <span className="text-[10px] text-gray-400 dark:text-white/35">
                              • IP: {p.ipAddress || "-"}
                            </span>
                          </div>

                          <p className="mt-1 text-[11px] sm:text-[12px] text-gray-500 dark:text-white/55 truncate">
                            {formatNumber(p.vulnTotal)} Vulns •{" "}
                            {p.firmwareVersion || "Unknown Device"}
                          </p>

                          <div className="mt-2">
                            <div className="h-2 rounded-full bg-[#eef0f6] dark:bg-white/10 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${Math.max(barPercent, p.risk > 0 ? 6 : 0)}%`,
                                  background: riskMeta.bar,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-3.5 shrink-0">
                        <div className="text-right">
                          <p
                            className={`text-[13px] sm:text-[14px] font-semibold tabular-nums ${riskMeta.text}`}
                          >
                            {formatRisk(p.risk)}
                          </p>
                          <p className="text-[10px] text-gray-400 dark:text-white/45">
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