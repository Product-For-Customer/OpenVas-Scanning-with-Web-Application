import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FiShield,
  FiChevronRight,
  FiAlertTriangle,
  FiChevronDown,
  FiSearch,
  FiCheck,
  FiX,
} from "react-icons/fi";
import type { VulnerabilityLevelDTO } from "../../../services";
import { ListVulnerability } from "../../../services";

type VulnRow = {
  id: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  title: string;
  count: number;
  detected_time: string;
  vulnerability_family: string;
};

type FilterOption = {
  key: VulnRow["severity"];
  label: VulnRow["severity"];
};

const CARD_HEIGHT_CLASS = "min-h-[560px] xl:min-h-[620px]";
const VISIBLE_ROWS_HEIGHT_CLASS = "h-[410px] sm:h-[440px] xl:h-[460px]";

const badgeClasses: Record<VulnRow["severity"], string> = {
  CRITICAL:
    "bg-[#ef4444] text-white shadow-[0_4px_12px_rgba(239,68,68,0.20)]",
  HIGH: "bg-[#f97316] text-white shadow-[0_4px_12px_rgba(249,115,22,0.18)]",
  MEDIUM:
    "bg-[#eab308] text-white shadow-[0_4px_12px_rgba(234,179,8,0.16)]",
  LOW: "bg-[#22c55e] text-white shadow-[0_4px_12px_rgba(34,197,94,0.16)]",
  INFO: "bg-[#3b82f6] text-white shadow-[0_4px_12px_rgba(59,130,246,0.18)]",
};

const dotClasses: Record<VulnRow["severity"], string> = {
  CRITICAL: "bg-[#ef4444]",
  HIGH: "bg-[#f97316]",
  MEDIUM: "bg-[#eab308]",
  LOW: "bg-[#22c55e]",
  INFO: "bg-[#3b82f6]",
};

const rowGlowClasses: Record<VulnRow["severity"], string> = {
  CRITICAL:
    "hover:border-red-200 hover:bg-red-50/60 dark:hover:border-red-400/20 dark:hover:bg-red-500/5",
  HIGH: "hover:border-orange-200 hover:bg-orange-50/60 dark:hover:border-orange-400/20 dark:hover:bg-orange-500/5",
  MEDIUM:
    "hover:border-yellow-200 hover:bg-yellow-50/60 dark:hover:border-yellow-400/20 dark:hover:bg-yellow-500/5",
  LOW: "hover:border-green-200 hover:bg-green-50/60 dark:hover:border-green-400/20 dark:hover:bg-green-500/5",
  INFO: "hover:border-blue-200 hover:bg-blue-50/60 dark:hover:border-blue-400/20 dark:hover:bg-blue-500/5",
};

const toSeverity = (
  level: VulnerabilityLevelDTO["level"]
): VulnRow["severity"] => {
  switch (level) {
    case "Critical":
      return "CRITICAL";
    case "High":
      return "HIGH";
    case "Medium":
      return "MEDIUM";
    case "Low":
      return "LOW";
    default:
      return "INFO";
  }
};

const severityRank: Record<VulnRow["severity"], number> = {
  CRITICAL: 1,
  HIGH: 2,
  MEDIUM: 3,
  LOW: 4,
  INFO: 5,
};

const formatDateTime = (value?: string): string => {
  if (!value) return "-";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;

  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
};

const TopVulnerability: React.FC = () => {
  const [data, setData] = useState<VulnerabilityLevelDTO[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const [openLevelQuery, setOpenLevelQuery] = useState(false);
  const [levelQuerySearch, setLevelQuerySearch] = useState("");
  const [selectedLevels, setSelectedLevels] = useState<VulnRow["severity"][]>(
    []
  );

  const levelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await ListVulnerability();

        if (!mounted) return;

        if (Array.isArray(res)) {
          setData(res);
        } else {
          setData([]);
        }
      } catch (error) {
        console.error("Error fetching vulnerabilities:", error);
        if (!mounted) return;
        setData([]);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (!levelRef.current) return;
      if (!levelRef.current.contains(e.target as Node)) {
        setOpenLevelQuery(false);
      }
    };

    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const mergedRows: VulnRow[] = useMemo(() => {
    const list = Array.isArray(data) ? data : [];

    const map = new Map<
      string,
      {
        title: string;
        count: number;
        topSeverity: VulnRow["severity"];
        detected_time: string;
        vulnerability_family: string;
      }
    >();

    for (const item of list) {
      const titleRaw = (item?.vulnerability_name ?? "").trim();
      if (!titleRaw) continue;

      const key = titleRaw.toLowerCase();
      const sev = toSeverity(item.level);
      const cnt = Number(item.total ?? 0);
      const family = (item?.vulnerability_family ?? "").trim() || "-";
      const detected = item?.detected_time ?? "";

      const prev = map.get(key);

      if (!prev) {
        map.set(key, {
          title: titleRaw,
          count: cnt,
          topSeverity: sev,
          detected_time: detected,
          vulnerability_family: family,
        });
      } else {
        prev.count += cnt;

        if (severityRank[sev] < severityRank[prev.topSeverity]) {
          prev.topSeverity = sev;
        }

        const prevTime = new Date(prev.detected_time).getTime();
        const nextTime = new Date(detected).getTime();

        if (
          !Number.isNaN(nextTime) &&
          (Number.isNaN(prevTime) || nextTime > prevTime)
        ) {
          prev.detected_time = detected;
          prev.vulnerability_family = family;
        }
      }
    }

    const merged: VulnRow[] = Array.from(map.entries()).map(([key, value]) => ({
      id: key,
      severity: value.topSeverity,
      title: value.title,
      count: value.count,
      detected_time: value.detected_time,
      vulnerability_family: value.vulnerability_family,
    }));

    merged.sort((a, b) => {
      const severityDiff = severityRank[a.severity] - severityRank[b.severity];
      if (severityDiff !== 0) return severityDiff;

      if (b.count !== a.count) return b.count - a.count;

      return a.title.localeCompare(b.title);
    });

    return merged;
  }, [data]);

  const levelOptions = useMemo<FilterOption[]>(() => {
    const ordered: VulnRow["severity"][] = [
      "CRITICAL",
      "HIGH",
      "MEDIUM",
      "LOW",
      "INFO",
    ];

    return ordered.map((level) => ({
      key: level,
      label: level,
    }));
  }, []);

  const filteredLevelOptions = useMemo(() => {
    const keyword = levelQuerySearch.trim().toLowerCase();
    if (!keyword) return levelOptions;

    return levelOptions.filter((opt) =>
      opt.label.toLowerCase().includes(keyword)
    );
  }, [levelOptions, levelQuerySearch]);

  const rows = useMemo(() => {
    if (selectedLevels.length === 0) return mergedRows;
    return mergedRows.filter((row) => selectedLevels.includes(row.severity));
  }, [mergedRows, selectedLevels]);

  const topCriticalCount = useMemo(() => {
    return rows.filter((row) => row.severity === "CRITICAL").length;
  }, [rows]);

  const statusText = useMemo(() => {
    if (loading) return "Syncing threat feed...";
    if (rows.length === 0) return "No vulnerabilities detected";
    if (topCriticalCount > 0) {
      return `${topCriticalCount} critical threats require attention`;
    }
    return "Latest vulnerability queue loaded";
  }, [loading, rows.length, topCriticalCount]);

  const levelButtonLabel = useMemo(() => {
    if (selectedLevels.length === 0) return "Level Query";
    if (selectedLevels.length === 1) return selectedLevels[0];
    return `${selectedLevels.length} levels selected`;
  }, [selectedLevels]);

  const toggleLevel = (key: VulnRow["severity"]) => {
    setSelectedLevels((prev) =>
      prev.includes(key)
        ? prev.filter((item) => item !== key)
        : [...prev, key]
    );
  };

  const handleSelectAllVisibleLevels = () => {
    const visibleKeys = filteredLevelOptions.map((x) => x.key);

    setSelectedLevels((prev) => {
      const prevSet = new Set(prev);
      const allVisibleSelected = visibleKeys.every((key) => prevSet.has(key));

      if (allVisibleSelected) {
        return prev.filter((key) => !visibleKeys.includes(key));
      }

      return Array.from(new Set([...prev, ...visibleKeys]));
    });
  };

  const clearAllLevels = () => {
    setSelectedLevels([]);
  };

  const allVisibleLevelsSelected =
    filteredLevelOptions.length > 0 &&
    filteredLevelOptions.every((opt) => selectedLevels.includes(opt.key));

  return (
    <section
      className={[
        "relative w-full overflow-hidden rounded-[18px] p-2.5 sm:p-3 md:p-3.5",
        "bg-white border border-slate-200/80 shadow-[0_10px_26px_-20px_rgba(15,23,42,0.18)]",
        "dark:bg-white/5 dark:border-white/10 dark:ring-1 dark:ring-white/10 dark:shadow-none",
        "h-full flex flex-col",
        CARD_HEIGHT_CLASS,
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-12 -right-8 h-24 w-24 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute -bottom-12 -left-8 h-24 w-24 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]">
          <div
            className="h-full w-full"
            style={{
              backgroundImage: `
                linear-gradient(to right, currentColor 1px, transparent 1px),
                linear-gradient(to bottom, currentColor 1px, transparent 1px)
              `,
              backgroundSize: "22px 22px",
            }}
          />
        </div>
      </div>

      <div className="relative z-10 flex h-full flex-col">
        <div className="mb-3 shrink-0 flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-1">
                <div
                  className={[
                    "inline-flex items-center gap-1 rounded-full px-2 py-1",
                    "bg-cyan-50 text-cyan-700 border border-cyan-200/80",
                    "dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-400/20",
                  ].join(" ")}
                >
                  <FiShield className="text-[9px]" />
                  <span className="text-[8.5px] font-semibold tracking-wide">
                    Threat Feed
                  </span>
                </div>

                {selectedLevels.length > 0 && (
                  <div
                    className={[
                      "inline-flex items-center gap-1 rounded-full px-2 py-1",
                      "bg-slate-50 text-slate-600 border border-slate-200/80",
                      "dark:bg-white/5 dark:text-white/65 dark:border-white/10",
                    ].join(" ")}
                  >
                    <span className="text-[8.5px] font-medium">
                      {selectedLevels.length} level selected
                    </span>
                  </div>
                )}
              </div>

              <h3 className="text-[14px] sm:text-[15px] font-semibold text-[#1f2240] dark:text-white/90">
                Total Vulnerabilities
              </h3>
              <p className="mt-0.5 text-[10px] sm:text-[10.5px] text-slate-500 dark:text-white/55">
                {statusText}
              </p>
            </div>

            <div className="flex items-start gap-1">
              <div className="relative" ref={levelRef}>
                <button
                  type="button"
                  onClick={() => setOpenLevelQuery((prev) => !prev)}
                  className={[
                    "h-9 rounded-xl px-3 flex items-center gap-2 border transition",
                    "bg-white border-gray-200 text-slate-700 hover:border-cyan-200 hover:bg-cyan-50/60",
                    "dark:bg-white/5 dark:border-white/10 dark:text-white/75 dark:hover:bg-white/10",
                  ].join(" ")}
                >
                  <FiAlertTriangle className="text-[12px]" />
                  <span className="text-[10.5px] font-medium whitespace-nowrap">
                    {levelButtonLabel}
                  </span>
                  <FiChevronDown
                    className={`text-[12px] transition-transform ${
                      openLevelQuery ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {openLevelQuery && (
                  <div
                    className={[
                      "absolute right-0 z-30 mt-2 w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-2xl",
                      "border border-gray-200 bg-white shadow-xl",
                      "dark:border-white/10 dark:bg-[#0B1220] dark:shadow-none",
                    ].join(" ")}
                  >
                    <div className="border-b border-gray-100 p-2.5 dark:border-white/10">
                      <div
                        className={[
                          "flex items-center gap-2 rounded-xl border px-2.5",
                          "border-gray-200/80 bg-gray-50",
                          "dark:border-white/10 dark:bg-white/5",
                        ].join(" ")}
                      >
                        <FiSearch className="shrink-0 text-[11px] text-gray-400 dark:text-white/40" />
                        <input
                          value={levelQuerySearch}
                          onChange={(e) => setLevelQuerySearch(e.target.value)}
                          placeholder="Search level"
                          className="h-8 w-full bg-transparent text-[11px] text-gray-700 outline-none placeholder:text-gray-400 dark:text-white/80 dark:placeholder:text-white/35"
                        />
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={handleSelectAllVisibleLevels}
                          className="text-[10.5px] font-medium text-cyan-600 hover:text-cyan-700 dark:text-cyan-300 dark:hover:text-cyan-200"
                        >
                          {allVisibleLevelsSelected
                            ? "Unselect visible"
                            : "Select visible"}
                        </button>

                        <button
                          type="button"
                          onClick={clearAllLevels}
                          className="text-[10.5px] font-medium text-gray-500 hover:text-gray-700 dark:text-white/50 dark:hover:text-white/75"
                        >
                          Clear all
                        </button>
                      </div>
                    </div>

                    <div className="max-h-56 overflow-y-auto p-2">
                      {filteredLevelOptions.length === 0 ? (
                        <div className="px-3 py-6 text-center text-[11px] text-gray-500 dark:text-white/50">
                          No matching level
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {filteredLevelOptions.map((opt) => {
                            const checked = selectedLevels.includes(opt.key);

                            return (
                              <button
                                key={opt.key}
                                type="button"
                                onClick={() => toggleLevel(opt.key)}
                                className={[
                                  "w-full flex items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition",
                                  checked
                                    ? "bg-cyan-50 border border-cyan-200 dark:bg-cyan-500/10 dark:border-cyan-400/20"
                                    : "border border-transparent hover:bg-gray-50 dark:hover:bg-white/5",
                                ].join(" ")}
                              >
                                <span
                                  className={[
                                    "mt-0.5 h-4 w-4 rounded-md border flex items-center justify-center shrink-0 transition",
                                    checked
                                      ? "bg-cyan-500 border-cyan-500 text-white"
                                      : "bg-white border-gray-300 text-transparent dark:bg-white/5 dark:border-white/20",
                                  ].join(" ")}
                                >
                                  <FiCheck className="text-[10px]" />
                                </span>

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`h-2 w-2 rounded-full ${dotClasses[opt.key]}`}
                                    />
                                    <span className="text-[11px] font-medium text-gray-700 dark:text-white/80">
                                      {opt.label}
                                    </span>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {selectedLevels.length > 0 && (
                <button
                  type="button"
                  onClick={clearAllLevels}
                  className={[
                    "h-9 w-9 rounded-xl border flex items-center justify-center transition",
                    "bg-white border-gray-200 text-slate-500 hover:text-red-500 hover:border-red-200 hover:bg-red-50/60",
                    "dark:bg-white/5 dark:border-white/10 dark:text-white/55 dark:hover:text-red-300 dark:hover:bg-red-500/10",
                  ].join(" ")}
                  aria-label="Clear filters"
                >
                  <FiX className="text-[12px]" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div
          className={[
            "rounded-2xl px-3 py-2 flex flex-wrap items-center gap-2",
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
              Threat Queue Active
            </span>
          </div>

          <div className="hidden sm:block h-3 w-px bg-slate-200 dark:bg-white/10" />

          <div className="text-[10px] text-slate-500 dark:text-white/50">
            {selectedLevels.length === 0
              ? "Top vulnerability findings from the latest imported scan results"
              : `Filtered by ${selectedLevels.length} selected level${
                  selectedLevels.length > 1 ? "s" : ""
                }`}
          </div>
        </div>

        <div className="mt-3 flex-1 min-h-0">
          {loading ? (
            <div
              className={[
                "h-full rounded-2xl border border-gray-200/80 bg-white",
                "dark:bg-white/5 dark:border-white/10",
                "flex items-center justify-center",
              ].join(" ")}
            >
              <div className="text-[11px] text-gray-500 dark:text-white/50">
                Loading vulnerabilities...
              </div>
            </div>
          ) : rows.length === 0 ? (
            <div
              className={[
                "h-full rounded-2xl border border-dashed border-gray-200/80 bg-white/80",
                "dark:bg-white/5 dark:border-white/10",
                "flex items-center justify-center text-center px-4",
              ].join(" ")}
            >
              <div>
                <div className="text-[12px] font-medium text-slate-700 dark:text-white/75">
                  No vulnerabilities found
                </div>
                <div className="mt-1 text-[10px] text-slate-500 dark:text-white/45">
                  Try selecting a different level filter
                </div>
              </div>
            </div>
          ) : (
            <div
              className={[
                "rounded-2xl border border-gray-200/80 bg-white p-2",
                "dark:bg-white/5 dark:border-white/10",
                VISIBLE_ROWS_HEIGHT_CLASS,
              ].join(" ")}
            >
              <div className="h-full overflow-y-auto pr-1 space-y-2">
                {rows.map((row) => (
                  <div
                    key={row.id}
                    className={[
                      "group rounded-2xl border px-2 py-1.5 transition-all duration-200",
                      "border-gray-200/80 bg-white hover:shadow-sm",
                      "dark:border-white/10 dark:bg-white/3 dark:hover:bg-white/5",
                      rowGlowClasses[row.severity],
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-1.5">
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span
                          className={`h-2 w-2 rounded-full ${dotClasses[row.severity]}`}
                        />
                        <span
                          className={[
                            "shrink-0 rounded-md px-2 py-0.5 text-[8px] font-bold tracking-wide leading-3",
                            badgeClasses[row.severity],
                          ].join(" ")}
                        >
                          {row.severity}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[10px] sm:text-[10.5px] font-medium leading-4 text-[#1f2240] dark:text-white/85">
                          {row.title}
                        </p>

                        <div className="mt-px flex flex-wrap items-center gap-x-1 gap-y-0 text-[7.5px] leading-3 text-gray-400 dark:text-white/40">
                          <span className="font-medium">detected_time</span>
                          <span className="h-1 w-1 rounded-full bg-current" />
                          <span className="text-gray-500 dark:text-white/55">
                            {formatDateTime(row.detected_time)}
                          </span>
                        </div>

                        <div className="mt-px flex flex-wrap items-center gap-x-1 gap-y-0 text-[7.5px] leading-3 text-gray-400 dark:text-white/40">
                          <span className="font-medium">
                            vulnerability_family
                          </span>
                          <span className="h-1 w-1 rounded-full bg-current" />
                          <span className="text-gray-500 dark:text-white/55 break-all">
                            {row.vulnerability_family || "-"}
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-0.5">
                        <span
                          className={[
                            "inline-flex h-5 min-w-5 items-center justify-center rounded-lg border px-1.5",
                            "text-[8.5px] font-semibold tabular-nums",
                            "border-gray-200 bg-[#fbfbfc] text-gray-700",
                            "dark:border-white/10 dark:bg-white/8 dark:text-white/75",
                          ].join(" ")}
                        >
                          {row.count}
                        </span>

                        <FiChevronRight className="text-[9px] text-gray-300 transition-colors dark:text-white/20 group-hover:text-gray-500 dark:group-hover:text-white/45" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default TopVulnerability;