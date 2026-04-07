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
import type { VulnerabilityLevelDTO } from "../../../services";

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

type SummaryRow = {
  task_name: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
};

interface ValueProps {
  vulnerabilityData?: VulnerabilityLevelDTO[];
  loading?: boolean;
}

const Value: React.FC<ValueProps> = ({
  vulnerabilityData = [],
  loading = false,
}) => {
  const navigate = useNavigate();

  const [openTargetQuery, setOpenTargetQuery] = useState(false);
  const [targetQuerySearch, setTargetQuerySearch] = useState("");
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);

  const targetRef = useRef<HTMLDivElement | null>(null);

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

  const rows = useMemo<SummaryRow[]>(() => {
    const map = new Map<string, SummaryRow>();

    for (const item of vulnerabilityData) {
      const taskName = String((item as any)?.task_name ?? "").trim() || "Unknown";

      if (!map.has(taskName)) {
        map.set(taskName, {
          task_name: taskName,
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          info: 0,
        });
      }

      const row = map.get(taskName)!;
      const total = Number(item?.total ?? 0);

      switch (item?.level) {
        case "Critical":
          row.critical += total;
          break;
        case "High":
          row.high += total;
          break;
        case "Medium":
          row.medium += total;
          break;
        case "Low":
          row.low += total;
          break;
        default:
          row.info += total;
          break;
      }
    }

    return Array.from(map.values());
  }, [vulnerabilityData]);

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
    return Number(((n / totals.totalAll) * 100).toFixed(2));
  };

  const makeSubtitle = (n: number) => {
    if (loading) return "Synchronizing scan telemetry...";
    if (!totals.totalAll) return "No findings in selected scope";
    return `${percent(n).toFixed(2)}% of total findings`;
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
          "dark:bg-[radial-gradient(circle_at_top_right,rgba(134,239,172,0.14),transparent_34%),linear-gradient(135deg,#03120b_0%,#062e1f_45%,#065f46_100%)]",
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
        value: loading ? "." : totals.info.toLocaleString(),
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
        scopeTask: selectedTargets.length > 0 ? selectedTargets : "all",
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
        <div className="absolute inset-0 opacity-[0.028] dark:opacity-[0.04]">
          <div
            className="h-full w-full"
            style={{
              backgroundImage: `
                linear-gradient(to right, rgba(15,23,42,0.06) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(15,23,42,0.06) 1px, transparent 1px)
              `,
              backgroundSize: "32px 32px",
            }}
          />
        </div>
      </div>

      <div className="relative z-10 flex flex-col gap-2.5">
        <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200/80 bg-cyan-50 px-3 py-1 text-[10px] font-medium text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-500/10 dark:text-cyan-300">
              <FiRadio className="text-[12px]" />
              Security Severity Matrix
            </span>

            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-slate-50 px-3 py-1 text-[10px] font-medium text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-white/70">
              <FiActivity className="text-[12px]" />
              {highestSeverity === "Critical"
                ? "Critical activity detected"
                : `${highestSeverity} activity detected`}
            </span>

            <span className="inline-flex items-center gap-2 rounded-full border border-violet-200/80 bg-violet-50 px-3 py-1 text-[10px] font-medium text-violet-700 dark:border-violet-400/20 dark:bg-violet-500/10 dark:text-violet-300">
              <FiActivity className="text-[12px]" />
              {loading
                ? "Loading findings."
                : `${totals.totalAll.toLocaleString()} findings loaded`}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-3 py-1 text-[10px] font-medium text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-white/70">
              <FiLayers className="text-[12px]" />
              {selectedScopeLabel}
            </span>

            <div className="relative" ref={targetRef}>
              <button
                type="button"
                onClick={() => setOpenTargetQuery((prev) => !prev)}
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-700 shadow-sm transition-all hover:border-cyan-300 hover:text-cyan-700 dark:border-white/10 dark:bg-white/5 dark:text-white/75 dark:hover:border-cyan-400/30 dark:hover:text-cyan-300"
              >
                <FiShield className="text-[12px]" />
                <span className="max-w-35 truncate">{targetButtonLabel}</span>
                <FiChevronDown
                  className={`text-[12px] transition-transform ${
                    openTargetQuery ? "rotate-180" : ""
                  }`}
                />
              </button>

              {openTargetQuery && (
                <div className="absolute right-0 z-100 mt-2 w-70 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-white/10 dark:bg-[#0b1220]">
                  <div className="relative mb-2">
                    <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400" />
                    <input
                      type="text"
                      value={targetQuerySearch}
                      onChange={(e) => setTargetQuerySearch(e.target.value)}
                      placeholder="Search target..."
                      className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-[11px] text-slate-700 outline-none focus:border-cyan-300 focus:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white/85 dark:focus:border-cyan-400/30"
                    />
                  </div>

                  <div className="mb-2 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllVisibleTargets}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] font-medium text-slate-600 hover:border-cyan-300 hover:text-cyan-700 dark:border-white/10 dark:text-white/70 dark:hover:border-cyan-400/30 dark:hover:text-cyan-300"
                    >
                      <FiCheck className="text-[11px]" />
                      {allVisibleTargetsSelected ? "Unselect All" : "Select All"}
                    </button>

                    {selectedTargets.length > 0 && (
                      <button
                        type="button"
                        onClick={clearAllTargets}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] font-medium text-slate-600 hover:border-red-300 hover:text-red-600 dark:border-white/10 dark:text-white/70 dark:hover:border-red-400/30 dark:hover:text-red-300"
                      >
                        <FiX className="text-[11px]" />
                        Clear
                      </button>
                    )}
                  </div>

                  <div className="max-h-60 overflow-y-auto pr-1">
                    <div className="space-y-1">
                      {filteredTargetOptions.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-[10.5px] text-slate-500 dark:border-white/10 dark:text-white/45">
                          No target found
                        </div>
                      ) : (
                        filteredTargetOptions.map((opt) => {
                          const active = selectedTargets.includes(opt.key);

                          return (
                            <button
                              key={opt.key}
                              type="button"
                              onClick={() => toggleTarget(opt.key)}
                              className={[
                                "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition-all",
                                active
                                  ? "border-cyan-300 bg-cyan-50 text-cyan-700 dark:border-cyan-400/30 dark:bg-cyan-500/10 dark:text-cyan-300"
                                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-white/10 dark:bg-white/5 dark:text-white/75",
                              ].join(" ")}
                            >
                              <span className="truncate text-[11px] font-medium">
                                {opt.label}
                              </span>
                              {active && <FiCheck className="text-[12px]" />}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-5">
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

            const w = barWidth(rawNumber);

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigateByLevel(item.title)}
                className={[
                  "group relative overflow-hidden rounded-[20px] p-4 text-left transition-all duration-300",
                  item.bg,
                  item.ring,
                  item.glow,
                  "hover:-translate-y-0.5 hover:shadow-lg",
                ].join(" ")}
              >
                <div className="relative z-10">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
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
                          <h3 className="min-w-0 truncate text-[10px] font-semibold leading-[1.1] tracking-wide sm:text-[10.5px] dark:text-white">
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
                      {loading ? "." : `${percent(rawNumber).toFixed(2)}%`}
                    </span>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-end justify-between gap-2">
                      <div>
                        <div className="text-[18px] font-semibold tracking-tight text-slate-900 dark:text-white">
                          {item.value}
                        </div>
                        <p className="mt-1 text-[10px] text-slate-600 dark:text-white/60">
                          {item.subtitle}
                        </p>
                      </div>

                      <span
                        className={[
                          "inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-medium",
                          rawNumber === 0
                            ? "bg-white/70 text-slate-500 border-slate-200/80 dark:bg-white/8 dark:border-white/10 dark:text-white/45"
                            : item.chip,
                        ].join(" ")}
                      >
                        {rawNumber === 0 ? "No finding" : "Detected"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-5">
                    <div className="mb-1.5 flex items-center justify-between text-[9px] text-slate-600 dark:text-white/55">
                      <span>Scan intensity</span>
                      <span>
                        {loading ? "..." : `${percent(rawNumber).toFixed(2)}%`}
                      </span>
                    </div>

                    <div className="h-2 rounded-full bg-white/55 ring-1 ring-black/5 dark:bg-white/10 dark:ring-white/8">
                      <div
                        className={`h-2 rounded-full ${item.bar}`}
                        style={{ width: w }}
                      />
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Value;