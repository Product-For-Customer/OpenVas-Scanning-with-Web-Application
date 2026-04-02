import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FiAlertOctagon,
  FiAlertTriangle,
  FiMinusCircle,
  FiShield,
  FiInfo,
  FiRadio,
  FiActivity,
  FiLayers,
  FiChevronDown,
  FiSearch,
  FiCheck,
  FiX,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";

import {
  ListTaskVulnSummary,
  type TaskVulnSummaryDTO,
} from "../../../services";

type SeverityKey = "Critical" | "High" | "Medium" | "Low" | "Info";

type StatCard = {
  id: number;
  title: SeverityKey;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  accent: string;
  softAccent: string;
  dot: string;
  bg: string;
  ring: string;
  glow: string;
  pill: string;
  bar: string;
  iconBox: string;
  chip: string;
};

type TargetOption = {
  key: string;
  label: string;
};

const Value: React.FC = () => {
  const navigate = useNavigate();

  const [rows, setRows] = useState<TaskVulnSummaryDTO[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [openTargetQuery, setOpenTargetQuery] = useState(false);
  const [targetQuerySearch, setTargetQuerySearch] = useState("");
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);

  const targetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        const res = await ListTaskVulnSummary();
        if (!alive) return;
        setRows(Array.isArray(res) ? res : []);
      } catch (error) {
        console.error("Failed to load vulnerability summary:", error);
        if (!alive) return;
        setRows([]);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (!targetRef.current) return;
      if (!targetRef.current.contains(e.target as Node)) {
        setOpenTargetQuery(false);
      }
    };

    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const targetOptions = useMemo<TargetOption[]>(() => {
    const names = rows
      .map((r) => ({
        key: String(r.task_name ?? "").trim(),
        label: String(r.task_name ?? "").trim(),
      }))
      .filter((r) => r.key !== "");

    const uniqueMap = new Map<string, TargetOption>();

    for (const item of names) {
      if (!uniqueMap.has(item.key)) {
        uniqueMap.set(item.key, item);
      }
    }

    return Array.from(uniqueMap.values());
  }, [rows]);

  const filteredTargetOptions = useMemo(() => {
    const keyword = targetQuerySearch.trim().toLowerCase();
    if (!keyword) return targetOptions;

    return targetOptions.filter((opt) =>
      opt.label.toLowerCase().includes(keyword)
    );
  }, [targetOptions, targetQuerySearch]);

  const filteredRows = useMemo(() => {
    if (selectedTargets.length === 0) return rows;
    return rows.filter((r) =>
      selectedTargets.includes(String(r.task_name ?? "").trim())
    );
  }, [rows, selectedTargets]);

  const totals = useMemo(() => {
    let critical = 0;
    let high = 0;
    let medium = 0;
    let low = 0;
    let info = 0;

    for (const r of filteredRows) {
      critical += Number(r.critical || 0);
      high += Number(r.high || 0);
      medium += Number(r.medium || 0);
      low += Number(r.low || 0);
      info += Number(r.info || 0);
    }

    const totalAll = critical + high + medium + low + info;

    return { totalAll, critical, high, medium, low, info };
  }, [filteredRows]);

  const percent = (n: number) => {
    if (!totals.totalAll) return 0;
    return ((n / totals.totalAll) * 100).toFixed(2);
  };

  const makeSubtitle = (n: number) => {
    if (loading) return "Synchronizing scan telemetry...";
    if (!totals.totalAll) return "No findings in selected scope";
    return `${percent(n)}% of total findings`;
  };

  const barWidth = (n: number) => `${percent(n)}%`;

  const highestSeverity = useMemo<SeverityKey>(() => {
    if (totals.critical > 0) return "Critical";
    if (totals.high > 0) return "High";
    if (totals.medium > 0) return "Medium";
    if (totals.low > 0) return "Low";
    return "Info";
  }, [totals]);

  const selectedScopeLabel = useMemo(() => {
    if (loading) return "Loading scope...";
    if (selectedTargets.length === 0) return "All Targets";
    if (selectedTargets.length === 1) return selectedTargets[0];
    return `${selectedTargets.length} Targets Selected`;
  }, [loading, selectedTargets]);

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

  const targetButtonLabel = useMemo(() => {
    if (selectedTargets.length === 0) return "Target Query";
    if (selectedTargets.length === 1) return selectedTargets[0];
    return `${selectedTargets.length} selected`;
  }, [selectedTargets]);

  const stats: StatCard[] = useMemo(
    () => [
      {
        id: 1,
        title: "Critical",
        value: loading ? "..." : totals.critical.toLocaleString(),
        subtitle: makeSubtitle(totals.critical),
        icon: <FiAlertOctagon />,
        accent: "#ef4444",
        softAccent: "#fb7185",
        dot: "bg-red-500",
        bg: [
          "bg-[radial-gradient(circle_at_top_right,rgba(239,68,68,0.18),transparent_34%),linear-gradient(135deg,#fff5f5_0%,#ffe4e6_45%,#fecdd3_100%)]",
          "dark:bg-[radial-gradient(circle_at_top_right,rgba(251,113,133,0.16),transparent_34%),linear-gradient(135deg,#120408_0%,#3a0a12_45%,#7f1d1d_100%)]",
        ].join(" "),
        ring: [
          "border border-rose-200/75 ring-1 ring-rose-300/35",
          "dark:border-white/10 dark:ring-rose-400/20",
        ].join(" "),
        glow: [
          "shadow-[0_8px_20px_-16px_rgba(239,68,68,0.22)]",
          "dark:shadow-[0_12px_28px_-16px_rgba(239,68,68,0.42)]",
        ].join(" "),
        pill: [
          "bg-white/75 text-rose-700 border border-rose-200/80",
          "dark:bg-white/10 dark:text-white dark:border-white/15",
        ].join(" "),
        bar: "bg-gradient-to-r from-[#fb7185] via-[#ef4444] to-[#991b1b]",
        iconBox: [
          "bg-white/75 border border-rose-200/80 text-rose-700",
          "dark:bg-white/10 dark:border-white/10 dark:text-white",
        ].join(" "),
        chip: [
          "bg-red-50 border-red-200 text-red-600",
          "dark:bg-red-500/10 dark:border-red-400/20 dark:text-red-300",
        ].join(" "),
      },
      {
        id: 2,
        title: "High",
        value: loading ? "..." : totals.high.toLocaleString(),
        subtitle: makeSubtitle(totals.high),
        icon: <FiAlertTriangle />,
        accent: "#f97316",
        softAccent: "#fdba74",
        dot: "bg-orange-500",
        bg: [
          "bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.18),transparent_34%),linear-gradient(135deg,#fff7ed_0%,#ffedd5_45%,#fed7aa_100%)]",
          "dark:bg-[radial-gradient(circle_at_top_right,rgba(253,186,116,0.16),transparent_34%),linear-gradient(135deg,#0f0703_0%,#3a1607_45%,#9a3412_100%)]",
        ].join(" "),
        ring: [
          "border border-orange-200/75 ring-1 ring-orange-300/35",
          "dark:border-white/10 dark:ring-orange-300/20",
        ].join(" "),
        glow: [
          "shadow-[0_8px_20px_-16px_rgba(249,115,22,0.22)]",
          "dark:shadow-[0_12px_28px_-16px_rgba(249,115,22,0.42)]",
        ].join(" "),
        pill: [
          "bg-white/75 text-orange-700 border border-orange-200/80",
          "dark:bg-white/10 dark:text-white dark:border-white/15",
        ].join(" "),
        bar: "bg-gradient-to-r from-[#fdba74] via-[#f97316] to-[#c2410c]",
        iconBox: [
          "bg-white/75 border border-orange-200/80 text-orange-700",
          "dark:bg-white/10 dark:border-white/10 dark:text-white",
        ].join(" "),
        chip: [
          "bg-orange-50 border-orange-200 text-orange-600",
          "dark:bg-orange-500/10 dark:border-orange-400/20 dark:text-orange-300",
        ].join(" "),
      },
      {
        id: 3,
        title: "Medium",
        value: loading ? "..." : totals.medium.toLocaleString(),
        subtitle: makeSubtitle(totals.medium),
        icon: <FiInfo />,
        accent: "#eab308",
        softAccent: "#fde68a",
        dot: "bg-yellow-500",
        bg: [
          "bg-[radial-gradient(circle_at_top_right,rgba(234,179,8,0.18),transparent_34%),linear-gradient(135deg,#fffbeb_0%,#fef3c7_45%,#fde68a_100%)]",
          "dark:bg-[radial-gradient(circle_at_top_right,rgba(253,230,138,0.14),transparent_34%),linear-gradient(135deg,#0f0b02_0%,#2a1a05_45%,#854d0e_100%)]",
        ].join(" "),
        ring: [
          "border border-amber-200/75 ring-1 ring-amber-300/35",
          "dark:border-white/10 dark:ring-amber-300/20",
        ].join(" "),
        glow: [
          "shadow-[0_8px_20px_-16px_rgba(234,179,8,0.20)]",
          "dark:shadow-[0_12px_28px_-16px_rgba(250,204,21,0.34)]",
        ].join(" "),
        pill: [
          "bg-white/75 text-amber-800 border border-amber-200/80",
          "dark:bg-white/10 dark:text-white dark:border-white/15",
        ].join(" "),
        bar: "bg-gradient-to-r from-[#fde68a] via-[#facc15] to-[#a16207]",
        iconBox: [
          "bg-white/75 border border-amber-200/80 text-amber-800",
          "dark:bg-white/10 dark:border-white/10 dark:text-white",
        ].join(" "),
        chip: [
          "bg-yellow-50 border-yellow-200 text-yellow-700",
          "dark:bg-yellow-500/10 dark:border-yellow-400/20 dark:text-yellow-300",
        ].join(" "),
      },
      {
        id: 4,
        title: "Low",
        value: loading ? "..." : totals.low.toLocaleString(),
        subtitle: makeSubtitle(totals.low),
        icon: <FiMinusCircle />,
        accent: "#22c55e",
        softAccent: "#86efac",
        dot: "bg-green-500",
        bg: [
          "bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.18),transparent_34%),linear-gradient(135deg,#ecfdf5_0%,#d1fae5_45%,#a7f3d0_100%)]",
          "dark:bg-[radial-gradient(circle_at_top_right,rgba(134,239,172,0.14),transparent_34%),linear-gradient(135deg,#03120b_0%,#052e1e_45%,#065f46_100%)]",
        ].join(" "),
        ring: [
          "border border-emerald-200/75 ring-1 ring-emerald-300/35",
          "dark:border-white/10 dark:ring-emerald-300/20",
        ].join(" "),
        glow: [
          "shadow-[0_8px_20px_-16px_rgba(34,197,94,0.20)]",
          "dark:shadow-[0_12px_28px_-16px_rgba(34,197,94,0.34)]",
        ].join(" "),
        pill: [
          "bg-white/75 text-emerald-800 border border-emerald-200/80",
          "dark:bg-white/10 dark:text-white dark:border-white/15",
        ].join(" "),
        bar: "bg-gradient-to-r from-[#86efac] via-[#22c55e] to-[#15803d]",
        iconBox: [
          "bg-white/75 border border-emerald-200/80 text-emerald-800",
          "dark:bg-white/10 dark:border-white/10 dark:text-white",
        ].join(" "),
        chip: [
          "bg-green-50 border-green-200 text-green-700",
          "dark:bg-green-500/10 dark:border-green-400/20 dark:text-green-300",
        ].join(" "),
      },
      {
        id: 5,
        title: "Info",
        value: loading ? "..." : totals.info.toLocaleString(),
        subtitle: makeSubtitle(totals.info),
        icon: <FiShield />,
        accent: "#3b82f6",
        softAccent: "#7dd3fc",
        dot: "bg-blue-500",
        bg: [
          "bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.18),transparent_34%),linear-gradient(135deg,#eff6ff_0%,#dbeafe_45%,#bfdbfe_100%)]",
          "dark:bg-[radial-gradient(circle_at_top_right,rgba(125,211,252,0.14),transparent_34%),linear-gradient(135deg,#020b16_0%,#06243a_45%,#075985_100%)]",
        ].join(" "),
        ring: [
          "border border-sky-200/75 ring-1 ring-sky-300/35",
          "dark:border-white/10 dark:ring-sky-300/20",
        ].join(" "),
        glow: [
          "shadow-[0_8px_20px_-16px_rgba(56,189,248,0.20)]",
          "dark:shadow-[0_12px_28px_-16px_rgba(56,189,248,0.34)]",
        ].join(" "),
        pill: [
          "bg-white/75 text-sky-800 border border-sky-200/80",
          "dark:bg-white/10 dark:text-white dark:border-white/15",
        ].join(" "),
        bar: "bg-gradient-to-r from-[#7dd3fc] via-[#38bdf8] to-[#0284c7]",
        iconBox: [
          "bg-white/75 border border-sky-200/80 text-sky-800",
          "dark:bg-white/10 dark:border-white/10 dark:text-white",
        ].join(" "),
        chip: [
          "bg-blue-50 border-blue-200 text-blue-700",
          "dark:bg-blue-500/10 dark:border-blue-400/20 dark:text-blue-300",
        ].join(" "),
      },
    ],
    [loading, totals]
  );

  const handleNavigateByLevel = (level: SeverityKey) => {
    navigate("/admin/vulnerability-by-level", {
      state: {
        level,
        scopeTask: selectedTargets,
      },
    });
  };

  return (
    <section
      className={[
        "relative overflow-visible rounded-[22px] p-1.5 sm:p-2",
        "bg-white border border-gray-200/80 shadow-sm",
        "dark:bg-white/5 dark:border-white/10 dark:ring-1 dark:ring-white/10 dark:shadow-none",
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[22px]">
        <div className="absolute -top-14 -right-12 h-28 w-28 rounded-full bg-cyan-400/8 blur-3xl" />
        <div className="absolute -bottom-14 -left-12 h-28 w-28 rounded-full bg-violet-500/8 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.045]">
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
        <div className="mb-2 flex flex-col gap-1.5">
          <div className="flex flex-col gap-1.5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-1.5">
              <div
                className={[
                  "inline-flex items-center gap-1.5 rounded-full px-2 py-1",
                  "bg-cyan-50 text-cyan-700 border border-cyan-200/80",
                  "dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-400/20",
                ].join(" ")}
              >
                <FiShield className="text-[10px]" />
                <span className="text-[10px] font-semibold tracking-wide">
                  Security Severity Matrix
                </span>
              </div>

              <div
                className={[
                  "inline-flex items-center gap-1.5 rounded-full px-2 py-1",
                  "bg-slate-50 text-slate-600 border border-slate-200/80",
                  "dark:bg-white/5 dark:text-white/65 dark:border-white/10",
                ].join(" ")}
              >
                <FiRadio className="text-[10px] text-cyan-500" />
                <span className="text-[10px] font-medium">
                  {loading ? "Scanner Syncing" : `${highestSeverity} activity detected`}
                </span>
              </div>

              <div
                className={[
                  "inline-flex items-center gap-1.5 rounded-full px-2 py-1",
                  "bg-slate-50 text-slate-600 border border-slate-200/80",
                  "dark:bg-white/5 dark:text-white/65 dark:border-white/10",
                ].join(" ")}
              >
                <FiActivity className="text-[10px] text-violet-500" />
                <span className="text-[10px] font-medium">
                  {loading
                    ? "Fetching telemetry..."
                    : `${totals.totalAll.toLocaleString()} total findings`}
                </span>
              </div>

              <div
                className={[
                  "inline-flex items-center gap-1.5 rounded-full px-2 py-1",
                  "bg-linear-to-r from-cyan-50 via-sky-50 to-violet-50",
                  "text-slate-700 border border-cyan-200/70 shadow-[0_8px_20px_-16px_rgba(6,182,212,0.35)]",
                  "dark:from-cyan-500/10 dark:via-sky-500/10 dark:to-violet-500/10",
                  "dark:text-cyan-100 dark:border-cyan-400/20",
                  "backdrop-blur-md",
                ].join(" ")}
              >
                <div className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-white/80 text-cyan-600 dark:bg-white/10 dark:text-cyan-300">
                  <FiLayers className="text-[9px]" />
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[8.5px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-white/50">
                    Scope
                  </span>
                  <span className="h-1 w-1 rounded-full bg-cyan-500" />
                  <span className="max-w-32 truncate text-[10px] font-semibold sm:max-w-36">
                    {selectedScopeLabel}
                  </span>
                </div>
              </div>
            </div>

            <div className="w-full xl:w-auto">
              <div className="flex items-start gap-1 shrink-0">
                <div className="relative z-80" ref={targetRef}>
                  <button
                    type="button"
                    onClick={() => setOpenTargetQuery((prev) => !prev)}
                    className={[
                      "h-9 rounded-2xl px-3 flex items-center gap-2 border transition min-w-36.25",
                      "bg-[#f7f7f8] border-[#d9d9de] text-slate-700 hover:border-slate-300 hover:bg-[#f3f4f6]",
                      "dark:bg-white/5 dark:border-white/10 dark:text-white/75 dark:hover:bg-white/10",
                    ].join(" ")}
                  >
                    <FiShield className="text-[12px] text-slate-500 dark:text-white/55" />
                    <span className="text-[10.5px] font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                      {targetButtonLabel}
                    </span>
                    <FiChevronDown
                      className={`ml-auto text-[12px] text-slate-500 dark:text-white/55 transition-transform ${
                        openTargetQuery ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {openTargetQuery && (
                    <div
                      className={[
                        "absolute right-0 top-full z-90 mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl",
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
                            value={targetQuerySearch}
                            onChange={(e) => setTargetQuerySearch(e.target.value)}
                            placeholder="Search target"
                            className="h-8 w-full bg-transparent text-[11px] text-gray-700 outline-none placeholder:text-gray-400 dark:text-white/80 dark:placeholder:text-white/35"
                          />
                          {targetQuerySearch.trim() !== "" && (
                            <button
                              type="button"
                              onClick={() => setTargetQuerySearch("")}
                              className="text-gray-400 hover:text-gray-600 dark:text-white/35 dark:hover:text-white/70"
                              aria-label="Clear search"
                            >
                              <FiX className="text-[11px]" />
                            </button>
                          )}
                        </div>

                        <div className="mt-2 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={handleSelectAllVisibleTargets}
                            className="text-[10.5px] font-medium text-cyan-600 hover:text-cyan-700 dark:text-cyan-300 dark:hover:text-cyan-200"
                          >
                            {allVisibleTargetsSelected
                              ? "Unselect visible"
                              : "Select visible"}
                          </button>

                          <button
                            type="button"
                            onClick={clearAllTargets}
                            className="text-[10.5px] font-medium text-gray-500 hover:text-gray-700 dark:text-white/50 dark:hover:text-white/75"
                          >
                            Clear all
                          </button>
                        </div>
                      </div>

                      <div className="max-h-56 overflow-y-auto p-2">
                        {filteredTargetOptions.length === 0 ? (
                          <div className="px-3 py-6 text-center text-[11px] text-gray-500 dark:text-white/50">
                            No matching target
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
                                      <span className="h-2 w-2 rounded-full bg-cyan-500" />
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

                {selectedTargets.length > 0 && (
                  <button
                    type="button"
                    onClick={clearAllTargets}
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
        </div>

        {!loading && filteredRows.length === 0 ? (
          <div
            className={[
              "rounded-[18px] border border-dashed p-5 text-center",
              "border-slate-200 bg-slate-50/80 text-slate-500",
              "dark:border-white/10 dark:bg-white/5 dark:text-white/60",
            ].join(" ")}
          >
            <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-2xl bg-white shadow-sm dark:bg-white/10">
              <FiShield className="text-[15px]" />
            </div>
            <h3 className="text-[13px] font-semibold text-slate-700 dark:text-white">
              No vulnerability data found
            </h3>
            <p className="mt-1 text-[10px]">
              ไม่มีข้อมูลสำหรับ task ที่เลือกในขณะนี้
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3 xl:grid-cols-5">
            {stats.map((item) => {
              const rawNumber =
                item.title === "Critical"
                  ? totals.critical
                  : item.title === "High"
                  ? totals.high
                  : item.title === "Medium"
                  ? totals.medium
                  : item.title === "Low"
                  ? totals.low
                  : totals.info;

              const w = loading ? "0%" : barWidth(rawNumber);

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavigateByLevel(item.title)}
                  className={[
                    "relative min-w-0 overflow-hidden rounded-2xl p-2 sm:p-2.5 text-left",
                    "text-slate-900 dark:text-white",
                    "transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-lg",
                    "cursor-pointer",
                    item.bg,
                    item.ring,
                    item.glow,
                  ].join(" ")}
                >
                  <div
                    className={[
                      "pointer-events-none absolute inset-0 opacity-20",
                      "dark:opacity-15",
                      "[background:linear-gradient(to_right,rgba(15,23,42,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.08)_1px,transparent_1px)]",
                      "dark:[background:linear-gradient(to_right,rgba(255,255,255,0.10)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.10)_1px,transparent_1px)]",
                      "bg-size-[16px_16px]",
                    ].join(" ")}
                  />
                  <div className="pointer-events-none absolute -top-10 -right-10 h-24 w-24 rounded-full bg-white/28 blur-3xl dark:bg-white/10" />
                  <div
                    className="pointer-events-none absolute left-0 top-0 h-1 w-full"
                    style={{
                      background: `linear-gradient(90deg, ${item.softAccent}, ${item.accent})`,
                    }}
                  />

                  <div className="relative flex min-h-31.5 flex-col justify-between sm:min-h-33">
                    <div className="flex min-w-0 items-start justify-between gap-1">
                      <div className="flex min-w-0 items-start gap-1.5">
                        <div
                          className={[
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-[14px] text-[13px]",
                            item.iconBox,
                          ].join(" ")}
                        >
                          {item.icon}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`h-1.5 w-1.5 rounded-full ${item.dot}`} />
                            <h3 className="min-w-0 truncate text-[10px] font-semibold leading-[1.1] tracking-wide sm:text-[10.5px]">
                              {item.title}
                            </h3>
                          </div>

                          <p className="mt-0.5 truncate text-[8.5px] text-slate-700/80 dark:text-white/75">
                            Network scan severity
                          </p>
                        </div>
                      </div>

                      <span
                        className={[
                          "inline-flex h-4.5 shrink-0 items-center justify-center rounded-full px-1.5",
                          "border text-[8px] font-medium backdrop-blur",
                          item.pill,
                        ].join(" ")}
                      >
                        {loading ? "Sync" : `${percent(rawNumber)}%`}
                      </span>
                    </div>

                    <div className="mt-1.5">
                      <div className="flex items-end justify-between gap-1.5">
                        <p className="truncate text-[13px] font-semibold leading-none tracking-tight sm:text-[14px] xl:text-[15px]">
                          {item.value}
                        </p>

                        <span
                          className={[
                            "shrink-0 rounded-full border px-1.5 py-0.5 text-[7.5px] font-semibold transition-all duration-300",
                            item.chip,
                          ].join(" ")}
                        >
                          {loading ? "Loading" : rawNumber > 0 ? "Detected" : "Clear"}
                        </span>
                      </div>

                      <p className="mt-0.5 text-[8.5px] leading-3.5 text-slate-700/80 dark:text-white/80 sm:text-[9px]">
                        {item.subtitle}
                      </p>
                    </div>

                    <div className="mt-1.5">
                      <div className="mb-1 flex items-center justify-between text-[8px] text-slate-700/75 dark:text-white/65">
                        <span>Scan intensity</span>
                        <span>{loading ? "..." : `${percent(rawNumber)}%`}</span>
                      </div>

                      <div className="h-1.5 w-full overflow-hidden rounded-full border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/10">
                        <div
                          className={[
                            "h-full rounded-full transition-all duration-700 ease-out",
                            item.bar,
                          ].join(" ")}
                          style={{ width: w }}
                        />
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default Value;