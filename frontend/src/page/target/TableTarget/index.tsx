import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FiSearch,
  FiChevronDown,
  FiShield,
  FiRadio,
  FiActivity,
  FiCheck,
  FiX,
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

type FilterOption = {
  key: string;
  label: string;
};

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

const formatNumber = (n: number) =>
  !Number.isFinite(n) ? "0" : n.toLocaleString();

const formatRisk = (n: number) =>
  !Number.isFinite(n) ? "0.00" : n.toFixed(2);

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

  const [openQuery, setOpenQuery] = useState(false);
  const [querySearch, setQuerySearch] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  const sortRef = useRef<HTMLDivElement | null>(null);
  const queryRef = useRef<HTMLDivElement | null>(null);

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

      if (queryRef.current && !queryRef.current.contains(e.target as Node)) {
        setOpenQuery(false);
      }
    };

    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const baseRows = useMemo(() => {
    const list = Array.isArray(data) ? data : [];
    const maxRisk = list.reduce(
      (m, x) => Math.max(m, Number(x?.risk_score) || 0),
      0
    );

    const mapped: Row[] = list.map((x, idx) => {
      const risk = Number(x?.risk_score) || 0;
      const vuln = Number(x?.vulnerability_total) || 0;
      const progressPercent = maxRisk > 0 ? (risk / maxRisk) * 100 : 0;

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

  const filterOptions = useMemo<FilterOption[]>(() => {
    const seen = new Set<string>();
    const options: FilterOption[] = [];

    for (const row of baseRows) {
      const key = `${row.taskID}__${row.ip}`;
      if (seen.has(key)) continue;
      seen.add(key);

      options.push({
        key,
        label: `${row.name} - ${row.ip || "-"}`,
      });
    }

    return options.sort((a, b) => a.label.localeCompare(b.label));
  }, [baseRows]);

  const filteredQueryOptions = useMemo(() => {
    const keyword = querySearch.trim().toLowerCase();
    if (!keyword) return filterOptions;

    return filterOptions.filter((opt) =>
      opt.label.toLowerCase().includes(keyword)
    );
  }, [filterOptions, querySearch]);

  const rows: Row[] = useMemo(() => {
    let filtered = [...baseRows];

    if (selectedKeys.length > 0) {
      const selectedSet = new Set(selectedKeys);
      filtered = filtered.filter((r) => selectedSet.has(`${r.taskID}__${r.ip}`));
    }

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
  }, [baseRows, selectedKeys, search, sortOrder]);

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

  const selectedCount = selectedKeys.length;

  const queryButtonLabel = useMemo(() => {
    if (selectedCount === 0) return "Query Select";
    if (selectedCount === 1) {
      const found = filterOptions.find((x) => x.key === selectedKeys[0]);
      return found?.label || "1 selected";
    }
    return `${selectedCount} selected`;
  }, [selectedCount, filterOptions, selectedKeys]);

  const toggleSelect = (key: string) => {
    setSelectedKeys((prev) =>
      prev.includes(key)
        ? prev.filter((item) => item !== key)
        : [...prev, key]
    );
  };

  const handleSelectAllVisible = () => {
    const visibleKeys = filteredQueryOptions.map((x) => x.key);

    setSelectedKeys((prev) => {
      const prevSet = new Set(prev);
      const allVisibleSelected = visibleKeys.every((key) => prevSet.has(key));

      if (allVisibleSelected) {
        return prev.filter((key) => !visibleKeys.includes(key));
      }

      return Array.from(new Set([...prev, ...visibleKeys]));
    });
  };

  const clearAllSelections = () => {
    setSelectedKeys([]);
  };

  const allVisibleSelected =
    filteredQueryOptions.length > 0 &&
    filteredQueryOptions.every((opt) => selectedKeys.includes(opt.key));

  return (
    <section
      className={[
        "relative overflow-hidden rounded-[22px] p-3 sm:p-4 md:p-4.5",
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

      <div className="relative z-10">
        <div className="flex flex-col gap-3 mb-3.5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
                <div
                  className={[
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5",
                    "bg-cyan-50 text-cyan-700 border border-cyan-200/80",
                    "dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-400/20",
                  ].join(" ")}
                >
                  <FiShield className="text-[11px]" />
                  <span className="text-[10.5px] font-semibold tracking-wide">
                    Target Scan Console
                  </span>
                </div>

                <div
                  className={[
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5",
                    "bg-slate-50 text-slate-600 border border-slate-200/80",
                    "dark:bg-white/5 dark:text-white/65 dark:border-white/10",
                  ].join(" ")}
                >
                  <FiRadio className="text-[11px] text-cyan-500" />
                  <span className="text-[10.5px] font-medium">
                    {loading ? "Scanner Syncing" : `${stats.totalTargets} targets loaded`}
                  </span>
                </div>

                <div
                  className={[
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5",
                    "bg-slate-50 text-slate-600 border border-slate-200/80",
                    "dark:bg-white/5 dark:text-white/65 dark:border-white/10",
                  ].join(" ")}
                >
                  <FiActivity className="text-[11px] text-violet-500" />
                  <span className="text-[10.5px] font-medium">
                    {loading
                      ? "Loading telemetry..."
                      : `${stats.totalVulns.toLocaleString()} total vulns`}
                  </span>
                </div>
              </div>

              <h2 className="text-[16px] sm:text-[18px] font-semibold text-[#1f2240] dark:text-white/90">
                Device Vulnerability Table
              </h2>
              <p className="text-[11px] sm:text-[12px] text-gray-500 dark:text-white/55 mt-1">
                Monitored targets, firmware details, vulnerability totals, and live risk posture
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <div className="relative" ref={queryRef}>
                <button
                  type="button"
                  onClick={() => setOpenQuery((prev) => !prev)}
                  className={[
                    "h-9 w-full sm:w-70 px-3.5 rounded-2xl inline-flex items-center justify-between gap-3 transition text-left",
                    "border border-gray-200/80 bg-white text-[12px] font-semibold text-[#1f2240] hover:bg-gray-50 active:bg-gray-100",
                    "dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10 dark:active:bg-white/15",
                  ].join(" ")}
                >
                  <span className="truncate">{queryButtonLabel}</span>

                  <div className="flex items-center gap-2 shrink-0">
                    {selectedCount > 0 && (
                      <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[10px] font-semibold bg-cyan-50 text-cyan-700 border border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-400/20">
                        {selectedCount}
                      </span>
                    )}

                    <FiChevronDown
                      className={`transition ${
                        openQuery ? "rotate-180" : ""
                      } text-gray-500 dark:text-white/55 text-[15px]`}
                    />
                  </div>
                </button>

                {openQuery && (
                  <div className="absolute right-0 mt-2 w-full sm:w-85 rounded-[22px] border border-gray-200 bg-white shadow-xl overflow-hidden z-30 dark:border-white/10 dark:bg-[#0B1220] dark:shadow-none">
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
                          value={querySearch}
                          onChange={(e) => setQuerySearch(e.target.value)}
                          placeholder="Search task name or ip..."
                          className="w-full bg-transparent outline-none text-[12px] text-gray-700 placeholder:text-gray-400 dark:text-white/80 dark:placeholder:text-white/30"
                        />
                        {querySearch.trim() !== "" && (
                          <button
                            type="button"
                            onClick={() => setQuerySearch("")}
                            className="text-gray-400 hover:text-gray-600 dark:text-white/35 dark:hover:text-white/70"
                            aria-label="Clear query search"
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
                      {filteredQueryOptions.length === 0 ? (
                        <div className="px-3 py-7 text-center text-[12px] text-gray-500 dark:text-white/50">
                          No matching device
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {filteredQueryOptions.map((opt) => {
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

              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/45 text-[13px]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search target / ip / firmware..."
                  className={[
                    "h-9 w-full sm:w-64 pl-9 pr-3 rounded-2xl text-[12px] transition",
                    "border border-gray-200/80 bg-white text-[#1f2240]",
                    "focus:outline-none focus:ring-2 focus:ring-cyan-500/20",
                    "dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:placeholder:text-white/35",
                  ].join(" ")}
                />
              </div>

              <div className="relative" ref={sortRef}>
                <button
                  type="button"
                  onClick={() => setOpenSort((v) => !v)}
                  className={[
                    "h-9 px-3.5 rounded-2xl inline-flex items-center gap-2 transition",
                    "border border-gray-200/80 bg-white text-[12px] font-semibold text-[#1f2240] hover:bg-gray-50 active:bg-gray-100",
                    "dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10 dark:active:bg-white/15",
                  ].join(" ")}
                  title="Sort by Vulnerability Total"
                >
                  Sort: Vuln {sortOrder === "desc" ? "High → Low" : "Low → High"}
                  <FiChevronDown
                    className={`transition ${
                      openSort ? "rotate-180" : ""
                    } text-gray-500 dark:text-white/55 text-[15px]`}
                  />
                </button>

                {openSort && (
                  <div className="absolute right-0 mt-2 w-46 rounded-[18px] border border-gray-200/80 bg-white shadow-sm p-2 z-20 dark:border-white/10 dark:bg-[#0B1220] dark:shadow-none">
                    <button
                      type="button"
                      onClick={() => {
                        setSortOrder("desc");
                        setOpenSort(false);
                      }}
                      className={[
                        "w-full text-left px-3 py-2 rounded-xl text-[12px] transition",
                        "hover:bg-gray-50 dark:hover:bg-white/8",
                        sortOrder === "desc"
                          ? "font-semibold text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-500/10"
                          : "text-gray-700 dark:text-white/70",
                      ].join(" ")}
                    >
                      Vuln High → Low
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSortOrder("asc");
                        setOpenSort(false);
                      }}
                      className={[
                        "w-full text-left px-3 py-2 rounded-xl text-[12px] transition",
                        "hover:bg-gray-50 dark:hover:bg-white/8",
                        sortOrder === "asc"
                          ? "font-semibold text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-500/10"
                          : "text-gray-700 dark:text-white/70",
                      ].join(" ")}
                    >
                      Vuln Low → High
                    </button>
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
                Target telemetry active
              </span>
            </div>

            <div className="hidden sm:block h-4 w-px bg-slate-200 dark:bg-white/10" />

            <div className="text-[11px] text-slate-500 dark:text-white/50">
              Highest risk score:{" "}
              <span className="font-semibold text-slate-700 dark:text-white/80">
                {loading ? "..." : formatRisk(stats.highestRisk)}
              </span>
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

        <div className="hidden xl:block rounded-[18px] overflow-hidden border border-gray-200/80 bg-white/80 backdrop-blur-sm dark:border-white/10 dark:bg-white/4">
          <div className="grid grid-cols-12 gap-5 px-3.5 py-2.5 bg-[#eef6ff] text-[12px] font-semibold text-[#1f2240] dark:bg-white/8 dark:text-white/80">
            <div className="col-span-1">No</div>
            <div className="col-span-3">Target</div>
            <div className="col-span-4">Firmware Version</div>
            <div className="col-span-1 text-right">Vulns</div>
            <div className="col-span-2">Scan Intensity</div>
            <div className="col-span-1 text-right">Risk</div>
          </div>

          <div>
            {loading ? (
              <div className="px-3.5 py-5 text-[12px] text-gray-500 dark:text-white/55">
                Loading...
              </div>
            ) : rows.length === 0 ? (
              <div className="px-3.5 py-5 text-[12px] text-gray-500 dark:text-white/55">
                No Data
              </div>
            ) : (
              rows.map((r, idx) => {
                const { Icon, bg, fg, ring } = DEVICE_ICONS[r.iconIndex];
                const riskMeta = getRiskMeta(r.riskScore);

                return (
                  <div
                    key={r.id}
                    className={[
                      "grid grid-cols-12 gap-5 px-3.5 py-3 items-start transition-colors",
                      idx !== 0 ? "border-t border-gray-200/70 dark:border-white/10" : "",
                      "hover:bg-cyan-50/40 dark:hover:bg-white/3",
                    ].join(" ")}
                  >
                    <div className="col-span-1 text-[12px] font-semibold text-[#1f2240] dark:text-white/85">
                      {r.no}
                    </div>

                    <div className="col-span-3 flex items-center gap-2.5 min-w-0">
                      <div
                        className={[
                          "h-9 w-9 rounded-2xl border flex items-center justify-center shrink-0",
                          bg,
                          ring,
                        ].join(" ")}
                        aria-hidden="true"
                      >
                        <Icon className={`${fg} text-[17px]`} />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="truncate text-[12.5px] font-semibold text-[#1f2240] dark:text-white/85">
                            {r.name}
                          </p>
                          <span
                            className={[
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold border",
                              riskMeta.chip,
                            ].join(" ")}
                          >
                            {riskMeta.label}
                          </span>
                        </div>

                        <p className="text-[10.5px] text-gray-500 dark:text-white/55 truncate">
                          {r.ip}
                        </p>
                      </div>
                    </div>

                    <div className="col-span-4 text-[12px] text-gray-700 dark:text-white/70 wrap-break-word">
                      {r.firmwareVersion}
                    </div>

                    <div className="col-span-1 text-right text-[12px] font-semibold text-[#1f2240] dark:text-white/85 tabular-nums">
                      {formatNumber(r.vulnerabilityTotal)}
                    </div>

                    <div className="col-span-2">
                      <div className="mb-1 flex items-center justify-between text-[10px] text-gray-500 dark:text-white/45">
                        <span>Scan level</span>
                        <span>{Math.round(r.progressPercent)}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-[#eef0f6] dark:bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${r.progressPercent}%`,
                            background: riskMeta.bar,
                          }}
                        />
                      </div>
                    </div>

                    <div
                      className={`col-span-1 text-right text-[12px] font-semibold tabular-nums ${riskMeta.text}`}
                    >
                      {formatRisk(r.riskScore)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="xl:hidden space-y-2.5">
          {loading ? (
            <div className="rounded-[18px] border border-gray-200/80 bg-white px-3.5 py-5 text-[12px] text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-white/55">
              Loading...
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-[18px] border border-gray-200/80 bg-white px-3.5 py-5 text-[12px] text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-white/55">
              No Data
            </div>
          ) : (
            rows.map((r) => {
              const { Icon, bg, fg, ring } = DEVICE_ICONS[r.iconIndex];
              const riskMeta = getRiskMeta(r.riskScore);

              return (
                <div
                  key={r.id}
                  className="rounded-[18px] border border-gray-200/80 bg-white px-3.5 py-3 dark:border-white/10 dark:bg-white/5"
                >
                  <div className="flex items-start gap-2.5">
                    <div
                      className={[
                        "h-9 w-9 rounded-2xl border flex items-center justify-center shrink-0",
                        bg,
                        ring,
                      ].join(" ")}
                    >
                      <Icon className={`${fg} text-[17px]`} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-[12.5px] font-semibold text-[#1f2240] dark:text-white/85">
                          {r.name}
                        </p>
                        <span className="text-[10.5px] font-semibold text-gray-400 dark:text-white/40">
                          #{r.no}
                        </span>
                      </div>

                      <p className="mt-1 truncate text-[10.5px] text-gray-500 dark:text-white/55">
                        {r.ip}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span
                          className={[
                            "inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold border",
                            riskMeta.chip,
                          ].join(" ")}
                        >
                          {riskMeta.label}
                        </span>
                        <span className="text-[10px] text-gray-500 dark:text-white/45">
                          {formatNumber(r.vulnerabilityTotal)} Vulns
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2.5 text-[11.5px] text-gray-700 dark:text-white/70 wrap-break-word">
                    {r.firmwareVersion}
                  </div>

                  <div className="mt-2.5">
                    <div className="mb-1 flex items-center justify-between text-[10px] text-gray-500 dark:text-white/45">
                      <span>Scan intensity</span>
                      <span>{Math.round(r.progressPercent)}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-[#eef0f6] dark:bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${r.progressPercent}%`,
                          background: riskMeta.bar,
                        }}
                      />
                    </div>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between">
                    <span className="text-[10.5px] text-gray-500 dark:text-white/45">
                      Risk Score
                    </span>
                    <span
                      className={`text-[12px] font-semibold tabular-nums ${riskMeta.text}`}
                    >
                      {formatRisk(r.riskScore)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
};

export default TableTarget;