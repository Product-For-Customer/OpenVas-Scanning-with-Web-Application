import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FiShield,
  FiChevronRight,
  FiAlertTriangle,
  FiChevronDown,
  FiSearch,
  FiCheck,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import type { VulnerabilityLevelDTO } from "../../../services";

type VulnRow = {
  id: string;
  vulnerability_id: string;
  task_id: string;
  task_name: string;
  host_ip: string;
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

interface TopVulnerabilityProps {
  vulnerabilityData?: VulnerabilityLevelDTO[];
  loading?: boolean;
}

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

const levelDotClasses: Record<VulnRow["severity"], string> = {
  CRITICAL: "bg-[#ef4444]",
  HIGH: "bg-[#f97316]",
  MEDIUM: "bg-[#eab308]",
  LOW: "bg-[#22c55e]",
  INFO: "bg-[#3b82f6]",
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

const toOriginalLevel = (
  severity: VulnRow["severity"]
): "Critical" | "High" | "Medium" | "Low" | "Info" => {
  switch (severity) {
    case "CRITICAL":
      return "Critical";
    case "HIGH":
      return "High";
    case "MEDIUM":
      return "Medium";
    case "LOW":
      return "Low";
    default:
      return "Info";
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

const TopVulnerability: React.FC<TopVulnerabilityProps> = ({
  vulnerabilityData = [],
  loading = false,
}) => {
  const navigate = useNavigate();

  const [openLevelQuery, setOpenLevelQuery] = useState(false);
  const [levelQuerySearch, setLevelQuerySearch] = useState("");
  const [selectedLevels, setSelectedLevels] = useState<VulnRow["severity"][]>(
    []
  );

  const levelRef = useRef<HTMLDivElement | null>(null);

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
    const list = Array.isArray(vulnerabilityData) ? vulnerabilityData : [];

    const map = new Map<
      string,
      {
        vulnerability_id: string;
        task_id: string;
        task_name: string;
        host_ip: string;
        title: string;
        count: number;
        topSeverity: VulnRow["severity"];
        detected_time: string;
        vulnerability_family: string;
      }
    >();

    for (const item of list) {
      const titleRaw = String(item?.vulnerability_name ?? "").trim();
      if (!titleRaw) continue;

      const key = titleRaw.toLowerCase();
      const sev = toSeverity(item.level);
      const cnt = Number(item.total ?? 0);
      const family = String(item?.vulnerability_family ?? "").trim() || "-";
      const detected = String(item?.detected_time ?? "");
      const vulnerabilityID = String(item?.vulnerability_id ?? "");
      const taskID = String(item?.task_id ?? "");
      const taskName = String(
        (item as VulnerabilityLevelDTO & { task_name?: string })?.task_name ?? ""
      );
      const hostIp = String(item?.host_ip ?? "");

      const prev = map.get(key);

      if (!prev) {
        map.set(key, {
          vulnerability_id: vulnerabilityID,
          task_id: taskID,
          task_name: taskName,
          host_ip: hostIp,
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
          prev.vulnerability_id = vulnerabilityID || prev.vulnerability_id;
          prev.task_id = taskID || prev.task_id;
          prev.task_name = taskName || prev.task_name;
          prev.host_ip = hostIp || prev.host_ip;
        }

        if (!prev.vulnerability_id && vulnerabilityID) {
          prev.vulnerability_id = vulnerabilityID;
        }
        if (!prev.task_id && taskID) {
          prev.task_id = taskID;
        }
        if (!prev.task_name && taskName) {
          prev.task_name = taskName;
        }
        if (!prev.host_ip && hostIp) {
          prev.host_ip = hostIp;
        }
      }
    }

    const merged: VulnRow[] = Array.from(map.entries()).map(([key, value]) => ({
      id: key,
      vulnerability_id: value.vulnerability_id,
      task_id: value.task_id,
      task_name: value.task_name,
      host_ip: value.host_ip,
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
  }, [vulnerabilityData]);

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

  const totalVulnerabilityCount = useMemo(() => {
    return rows.reduce((sum, row) => sum + Number(row.count || 0), 0);
  }, [rows]);

  const statusText = useMemo(() => {
    if (loading) return "Syncing threat feed...";
    if (rows.length === 0) return "No vulnerabilities detected";
    if (topCriticalCount > 0) {
      return `${topCriticalCount} critical threats require attention - ${totalVulnerabilityCount.toLocaleString()} vulnerabilities total`;
    }
    return `Latest vulnerability queue loaded - ${totalVulnerabilityCount.toLocaleString()} vulnerabilities total`;
  }, [loading, rows.length, topCriticalCount, totalVulnerabilityCount]);

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

  const handleNavigateToDetail = (row: VulnRow) => {
    navigate("/admin/vulnerability-detail", {
      state: {
        vulnerability_id: row.vulnerability_id,
        task_id: row.task_id,
        task_name: row.task_name,
        host_ip: row.host_ip,
        vulnerability_family: row.vulnerability_family,
        vulnerability_name: row.title,
        level: toOriginalLevel(row.severity),
        total: row.count,
        detected_time: row.detected_time,
      },
    });
  };

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
      </div>

      <div className="relative z-10 flex h-full flex-col">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <div
                className={[
                  "inline-flex items-center gap-1.5 rounded-full px-2 py-1",
                  "bg-amber-50 text-amber-700 border border-amber-200/80",
                  "dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-400/20",
                ].join(" ")}
              >
                <FiAlertTriangle className="text-[10px]" />
                <span className="text-[9.5px] font-semibold tracking-wide">
                  Vulnerability Queue
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="text-[14px] sm:text-[15px] font-semibold text-[#1f2240] dark:text-white/90 whitespace-nowrap">
                Total Vulnerability
              </h3>
              <p className="text-[10px] sm:text-[10.5px] text-slate-500 dark:text-white/55 whitespace-nowrap">
                Latest prioritized vulnerabilities from imported findings
              </p>
            </div>
          </div>

          <div className="flex items-start gap-1 shrink-0">
            <div className="relative" ref={levelRef}>
              <button
                type="button"
                onClick={() => setOpenLevelQuery((prev) => !prev)}
                className={[
                  "h-9 rounded-xl px-3 flex items-center gap-2 border transition min-w-27.5 sm:min-w-32.5",
                  "bg-white border-gray-200 text-slate-700 hover:border-cyan-200 hover:bg-cyan-50/60",
                  "dark:bg-white/5 dark:border-white/10 dark:text-white/75 dark:hover:bg-white/10",
                ].join(" ")}
              >
                <FiShield className="text-[12px]" />
                <span className="text-[10.5px] font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                  {levelButtonLabel}
                </span>
                <FiChevronDown
                  className={`ml-auto text-[12px] transition-transform ${
                    openLevelQuery ? "rotate-180" : ""
                  }`}
                />
              </button>

              {openLevelQuery && (
                <div
                  className={[
                    "absolute right-0 z-30 mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl",
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
                                    className={`h-2 w-2 rounded-full ${levelDotClasses[opt.key]}`}
                                  />
                                  <span className="text-[11px] font-medium text-gray-700 dark:text-white/80 truncate">
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
          </div>
        </div>

        <div
          className={[
            "mt-3 rounded-2xl px-3 py-2 flex flex-wrap items-center gap-2",
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
              {statusText}
            </span>
          </div>
        </div>

        <div className="mt-3 flex-1">
          {loading ? (
            <div
              className={[
                "rounded-2xl border border-dashed border-slate-200 bg-slate-50/70",
                "flex items-center justify-center text-[11px] text-slate-500",
                "dark:border-white/10 dark:bg-white/5 dark:text-white/45",
                VISIBLE_ROWS_HEIGHT_CLASS,
              ].join(" ")}
            >
              Loading vulnerability queue...
            </div>
          ) : rows.length === 0 ? (
            <div
              className={[
                "rounded-2xl border border-dashed border-slate-200 bg-slate-50/70",
                "flex items-center justify-center text-[11px] text-slate-500",
                "dark:border-white/10 dark:bg-white/5 dark:text-white/45",
                VISIBLE_ROWS_HEIGHT_CLASS,
              ].join(" ")}
            >
              No vulnerability data found
            </div>
          ) : (
            <div
              className={[
                "rounded-2xl border border-slate-200 bg-slate-50/50 p-2",
                "dark:border-white/10 dark:bg-white/3",
                VISIBLE_ROWS_HEIGHT_CLASS,
              ].join(" ")}
            >
              <div className="h-full space-y-2 overflow-y-auto pr-1">
                {rows.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => handleNavigateToDetail(row)}
                    className={[
                      "group w-full rounded-2xl border px-2 py-1.5 text-left transition-all duration-200",
                      "border-gray-200/80 bg-white hover:shadow-sm",
                      "dark:border-white/10 dark:bg-white/3 dark:hover:bg-white/5",
                      rowGlowClasses[row.severity],
                      "cursor-pointer",
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
                  </button>
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