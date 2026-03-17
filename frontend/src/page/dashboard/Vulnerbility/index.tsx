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
};

type FilterOption = {
  key: VulnRow["severity"];
  label: VulnRow["severity"];
};

const badgeClasses: Record<VulnRow["severity"], string> = {
  CRITICAL:
    "bg-[#ef4444] text-white shadow-[0_8px_20px_rgba(239,68,68,0.25)]",
  HIGH: "bg-[#f97316] text-white shadow-[0_8px_20px_rgba(249,115,22,0.22)]",
  MEDIUM:
    "bg-[#eab308] text-white shadow-[0_8px_20px_rgba(234,179,8,0.20)]",
  LOW: "bg-[#22c55e] text-white shadow-[0_8px_20px_rgba(34,197,94,0.20)]",
  INFO: "bg-[#3b82f6] text-white shadow-[0_8px_20px_rgba(59,130,246,0.22)]",
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

const TopVulnerability: React.FC = () => {
  const [data, setData] = useState<VulnerabilityLevelDTO[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const [openLevelQuery, setOpenLevelQuery] = useState(false);
  const [levelQuerySearch, setLevelQuerySearch] = useState("");
  const [selectedLevels, setSelectedLevels] = useState<VulnRow["severity"][]>([]);

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
      { title: string; count: number; topSeverity: VulnRow["severity"] }
    >();

    for (const item of list) {
      const titleRaw = (item?.vulnerability_name ?? "").trim();
      if (!titleRaw) continue;

      const key = titleRaw.toLowerCase();
      const sev = toSeverity(item.level);
      const cnt = Number(item.total ?? 0);

      const prev = map.get(key);

      if (!prev) {
        map.set(key, {
          title: titleRaw,
          count: cnt,
          topSeverity: sev,
        });
      } else {
        prev.count += cnt;
        if (severityRank[sev] < severityRank[prev.topSeverity]) {
          prev.topSeverity = sev;
        }
      }
    }

    const merged: VulnRow[] = Array.from(map.entries()).map(([key, value]) => ({
      id: key,
      severity: value.topSeverity,
      title: value.title,
      count: value.count,
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
    if (rows.length === 0) return "No vulnerability signatures detected";
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
        "relative w-full overflow-hidden rounded-[22px] p-4 sm:p-5 md:p-6",
        "bg-white border border-gray-200/80 shadow-sm",
        "dark:bg-white/5 dark:border-white/10 dark:ring-1 dark:ring-white/10 dark:shadow-none",
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-16 -right-10 h-44 w-44 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.04] dark:opacity-[0.06]">
          <div
            className="h-full w-full"
            style={{
              backgroundImage: `
                linear-gradient(to right, currentColor 1px, transparent 1px),
                linear-gradient(to bottom, currentColor 1px, transparent 1px)
              `,
              backgroundSize: "26px 26px",
            }}
          />
        </div>
      </div>

      <div className="relative z-10 flex flex-col">
        <div className="mb-4 flex shrink-0 flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <div
                  className={[
                    "inline-flex items-center gap-2 rounded-full px-3 py-1.5",
                    "bg-cyan-50 text-cyan-700 border border-cyan-200/80",
                    "dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-400/20",
                  ].join(" ")}
                >
                  <FiShield className="text-[14px]" />
                  <span className="text-[12px] font-semibold tracking-wide">
                    Threat Feed
                  </span>
                </div>

                {selectedLevels.length > 0 && (
                  <div
                    className={[
                      "inline-flex items-center gap-2 rounded-full px-3 py-1.5",
                      "bg-slate-50 text-slate-600 border border-slate-200/80",
                      "dark:bg-white/5 dark:text-white/65 dark:border-white/10",
                    ].join(" ")}
                  >
                    <span className="text-[12px] font-medium">
                      {selectedLevels.length} level selected
                    </span>
                  </div>
                )}
              </div>

              <h3 className="text-[18px] sm:text-[20px] font-semibold text-[#1f2240] dark:text-white/90">
                Top Vulnerabilities
              </h3>
              <p className="mt-1 text-[12.5px] text-gray-500 dark:text-white/55">
                {statusText}
              </p>
            </div>

            <div className="flex items-start gap-2">
              <div className="relative" ref={levelRef}>
                <button
                  type="button"
                  onClick={() => setOpenLevelQuery((prev) => !prev)}
                  className={[
                    "h-10 px-4 rounded-2xl inline-flex items-center justify-between gap-3 transition min-w-42.5",
                    "bg-white border border-gray-200/80 text-[13px] font-medium text-gray-600 hover:bg-gray-50",
                    "dark:bg-white/5 dark:border-white/10 dark:text-white/70 dark:hover:bg-white/8",
                  ].join(" ")}
                >
                  <span className="truncate">{levelButtonLabel}</span>

                  <div className="flex items-center gap-2 shrink-0">
                    {selectedLevels.length > 0 && (
                      <span className="inline-flex items-center justify-center min-w-5.5 h-5.5 px-1.5 rounded-full text-[11px] font-semibold bg-cyan-50 text-cyan-700 border border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-400/20">
                        {selectedLevels.length}
                      </span>
                    )}

                    <FiChevronDown
                      className={`text-gray-400 dark:text-white/45 transition-transform ${
                        openLevelQuery ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </button>

                {openLevelQuery && (
                  <div
                    className={[
                      "absolute right-0 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-3xl overflow-hidden z-30",
                      "border border-gray-200 bg-white shadow-xl",
                      "dark:border-white/10 dark:bg-[#0B1220] dark:shadow-none",
                    ].join(" ")}
                  >
                    <div className="p-3 border-b border-gray-100 dark:border-white/10">
                      <div
                        className={[
                          "flex items-center gap-2 rounded-2xl px-3 h-11",
                          "bg-slate-50 border border-slate-200/80",
                          "dark:bg-white/5 dark:border-white/10",
                        ].join(" ")}
                      >
                        <FiSearch className="text-gray-400 dark:text-white/40 shrink-0" />
                        <input
                          type="text"
                          value={levelQuerySearch}
                          onChange={(e) => setLevelQuerySearch(e.target.value)}
                          placeholder="Search level..."
                          className="w-full bg-transparent outline-none text-[13px] text-gray-700 placeholder:text-gray-400 dark:text-white/80 dark:placeholder:text-white/30"
                        />
                        {levelQuerySearch.trim() !== "" && (
                          <button
                            type="button"
                            onClick={() => setLevelQuerySearch("")}
                            className="text-gray-400 hover:text-gray-600 dark:text-white/35 dark:hover:text-white/70"
                            aria-label="Clear level query"
                          >
                            <FiX />
                          </button>
                        )}
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={handleSelectAllVisibleLevels}
                          className="text-[12px] font-medium text-cyan-600 hover:text-cyan-700 dark:text-cyan-300 dark:hover:text-cyan-200"
                        >
                          {allVisibleLevelsSelected
                            ? "Unselect visible"
                            : "Select visible"}
                        </button>

                        <button
                          type="button"
                          onClick={clearAllLevels}
                          className="text-[12px] font-medium text-gray-500 hover:text-gray-700 dark:text-white/50 dark:hover:text-white/75"
                        >
                          Clear all
                        </button>
                      </div>
                    </div>

                    <div className="max-h-72 overflow-y-auto p-2">
                      {filteredLevelOptions.length === 0 ? (
                        <div className="px-3 py-8 text-center text-[13px] text-gray-500 dark:text-white/50">
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
                                  "w-full flex items-start gap-3 rounded-2xl px-3 py-3 text-left transition",
                                  checked
                                    ? "bg-cyan-50 border border-cyan-200 dark:bg-cyan-500/10 dark:border-cyan-400/20"
                                    : "border border-transparent hover:bg-gray-50 dark:hover:bg-white/5",
                                ].join(" ")}
                              >
                                <span
                                  className={[
                                    "mt-0.5 h-5 w-5 rounded-md border flex items-center justify-center shrink-0 transition",
                                    checked
                                      ? "bg-cyan-500 border-cyan-500 text-white"
                                      : "bg-white border-gray-300 text-transparent dark:bg-white/5 dark:border-white/20",
                                  ].join(" ")}
                                >
                                  <FiCheck className="text-[12px]" />
                                </span>

                                <span className="min-w-0 flex-1">
                                  <span className="block text-[13px] font-medium text-gray-700 dark:text-white/80 wrap-break-word">
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

              {!loading && topCriticalCount > 0 ? (
                <div
                  className={[
                    "shrink-0 inline-flex items-center gap-2 rounded-2xl px-3 py-2",
                    "bg-red-50 border border-red-200 text-red-600",
                    "dark:bg-red-500/10 dark:border-red-400/20 dark:text-red-300",
                  ].join(" ")}
                >
                  <FiAlertTriangle className="text-[14px]" />
                  <span className="text-[12px] font-semibold">
                    {topCriticalCount} Critical
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {loading ? (
          <div
            className={[
              "rounded-2xl overflow-hidden",
              "border border-gray-200/80 bg-white/70 backdrop-blur-sm",
              "dark:border-white/10 dark:bg-white/3",
            ].join(" ")}
          >
            <div className="space-y-3 p-3 sm:p-3.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className={[
                    "rounded-2xl border px-4 py-3 animate-pulse",
                    "border-gray-200 bg-gray-50/80",
                    "dark:border-white/10 dark:bg-white/4",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-6 w-20 rounded-md bg-gray-200 dark:bg-white/10" />
                    <div className="h-4 flex-1 rounded bg-gray-200 dark:bg-white/10" />
                    <div className="h-7 w-10 rounded-md bg-gray-200 dark:bg-white/10" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : rows.length === 0 ? (
          <div
            className={[
              "flex items-center justify-center rounded-2xl px-4 py-10 text-center",
              "border border-gray-200 bg-gray-50/70 text-gray-500",
              "dark:border-white/10 dark:bg-white/4 dark:text-white/55",
            ].join(" ")}
          >
            <div>
              <div className="text-[14px] font-medium">No Data</div>
              <div className="mt-1 text-[12px] opacity-80">
                No vulnerabilities were returned from the latest query
              </div>
            </div>
          </div>
        ) : (
          <div
            className={[
              "rounded-2xl overflow-hidden",
              "border border-gray-200/80 bg-white/70 backdrop-blur-sm",
              "dark:border-white/10 dark:bg-white/3",
            ].join(" ")}
          >
            <div
              className={[
                "overflow-y-auto p-3 sm:p-3.5",
                "max-h-[calc(6*72px+5*12px)]",
              ].join(" ")}
            >
              <div className="space-y-3">
                {rows.map((row) => (
                  <div
                    key={row.id}
                    className={[
                      "group rounded-2xl border px-3.5 sm:px-4 py-3 transition-all duration-200",
                      "border-gray-200/80 bg-white hover:shadow-sm",
                      "dark:border-white/10 dark:bg-white/3 dark:hover:bg-white/5",
                      rowGlowClasses[row.severity],
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex shrink-0 items-center gap-3">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${dotClasses[row.severity]}`}
                        />
                        <span
                          className={[
                            "shrink-0 rounded-md px-2.5 py-1 text-[11px] font-bold tracking-wide",
                            badgeClasses[row.severity],
                          ].join(" ")}
                        >
                          {row.severity}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] sm:text-[14px] font-medium text-[#1f2240] dark:text-white/85">
                          {row.title}
                        </p>
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-400 dark:text-white/40">
                          <span>Vulnerability signature</span>
                          <span className="h-1 w-1 rounded-full bg-current" />
                          <span>Detected in scan results</span>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        <span
                          className={[
                            "inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2",
                            "text-[12px] font-semibold tabular-nums",
                            "border-gray-200 bg-[#fbfbfc] text-gray-700",
                            "dark:border-white/10 dark:bg-white/8 dark:text-white/75",
                          ].join(" ")}
                        >
                          {row.count}
                        </span>

                        <FiChevronRight className="text-gray-300 transition-colors dark:text-white/20 group-hover:text-gray-500 dark:group-hover:text-white/45" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default TopVulnerability;