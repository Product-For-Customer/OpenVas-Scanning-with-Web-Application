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
  task_id: string;
  task_name: string;
  host: string;
};

type SummaryRow = {
  task_id: string;
  task_name: string;
  host: string;
  target_key: string;
  target_label: string;
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

const getTargetHost = (item: any) => {
  const host =
    item?.host ??
    item?.host_ip ??
    item?.ip ??
    item?.target_ip ??
    item?.ip_host ??
    item?.asset_ip ??
    item?.target_host ??
    item?.target ??
    "";

  return String(host).trim() || "-";
};

const getTargetKey = (taskName: string, host: string) => {
  return `${String(taskName || "-").trim()}__${String(host || "-").trim()}`;
};

const getTargetLabel = (taskName: string, host: string) => {
  return `${String(taskName || "-").trim()} - ${String(host || "-").trim()}`;
};

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
      const taskName =
        String((item as any)?.task_name ?? "").trim() || "Unknown";

      const taskID = String((item as any)?.task_id ?? "").trim();
      const host = getTargetHost(item);
      const targetKey = getTargetKey(taskName, host);
      const targetLabel = getTargetLabel(taskName, host);

      if (!map.has(targetKey)) {
        map.set(targetKey, {
          task_id: taskID,
          task_name: taskName,
          host,
          target_key: targetKey,
          target_label: targetLabel,
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          info: 0,
        });
      }

      const row = map.get(targetKey)!;
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
    const seen = new Set<string>();
    const options: TargetOption[] = [];

    for (const row of rows) {
      const key = row.target_key;
      if (!key || seen.has(key)) continue;

      seen.add(key);
      options.push({
        key,
        label: row.target_label,
        task_id: row.task_id,
        task_name: row.task_name,
        host: row.host,
      });
    }

    options.sort((a, b) => a.label.localeCompare(b.label));
    return options;
  }, [rows]);

  const selectedTargetOptions = useMemo(() => {
    const selectedSet = new Set(selectedTargets);
    return targetOptions.filter((option) => selectedSet.has(option.key));
  }, [targetOptions, selectedTargets]);

  const selectedTargetLabels = useMemo(() => {
    return selectedTargetOptions.map((option) => option.label);
  }, [selectedTargetOptions]);

  const filteredTargetOptions = useMemo(() => {
    const keyword = targetQuerySearch.trim().toLowerCase();
    if (!keyword) return targetOptions;

    return targetOptions.filter((opt) =>
      opt.label.toLowerCase().includes(keyword)
    );
  }, [targetOptions, targetQuerySearch]);

  const filteredRows = useMemo(() => {
    if (selectedTargets.length === 0) return rows;

    const selectedSet = new Set(selectedTargets);
    return rows.filter((r) => selectedSet.has(r.target_key));
  }, [rows, selectedTargets]);

  const selectedTaskIDs = useMemo(() => {
    if (selectedTargets.length === 0) return [];

    return Array.from(
      new Set(
        filteredRows
          .map((row) => String(row.task_id ?? "").trim())
          .filter((id) => id !== "")
      )
    );
  }, [filteredRows, selectedTargets.length]);

  const selectedTargetHosts = useMemo(() => {
    if (selectedTargets.length === 0) return [];

    return Array.from(
      new Set(
        selectedTargetOptions
          .map((row) => String(row.host ?? "").trim())
          .filter((host) => host !== "")
      )
    );
  }, [selectedTargetOptions, selectedTargets.length]);

  const selectedTargetPairs = useMemo(() => {
    return selectedTargetOptions.map((option) => ({
      key: option.key,
      label: option.label,
      task_id: option.task_id,
      task_name: option.task_name,
      host: option.host,
    }));
  }, [selectedTargetOptions]);

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

  const selectedScopeLabel = useMemo(() => {
    if (loading) return "Loading scope...";
    if (selectedTargets.length === 0) return "All Targets";
    if (selectedTargets.length === 1) {
      return selectedTargetLabels[0] || "1 Target Selected";
    }
    return `${selectedTargets.length} Targets Selected`;
  }, [loading, selectedTargets.length, selectedTargetLabels]);

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
    if (selectedTargets.length === 1) {
      return selectedTargetLabels[0] || "1 selected";
    }
    return `${selectedTargets.length} selected`;
  }, [selectedTargets.length, selectedTargetLabels]);

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
        scopeTask: selectedTargets.length > 0 ? selectedTargetLabels : "all",
        task_id: selectedTaskIDs.length === 1 ? selectedTaskIDs[0] : undefined,
        task_ids: selectedTaskIDs.length > 0 ? selectedTaskIDs : undefined,

        target_keys: selectedTargets.length > 0 ? selectedTargets : undefined,
        target_labels:
          selectedTargetLabels.length > 0 ? selectedTargetLabels : undefined,
        target_hosts:
          selectedTargetHosts.length > 0 ? selectedTargetHosts : undefined,
        target_pairs:
          selectedTargetPairs.length > 0 ? selectedTargetPairs : undefined,
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
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200/80 bg-cyan-50 px-3 py-1 text-[10px] font-medium text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-500/10 dark:text-cyan-300">
              <FiRadio className="text-[12px]" />
              Overall Severity
            </span>

            <span className="inline-flex items-center gap-2 rounded-full border border-violet-200/80 bg-violet-50 px-3 py-1 text-[10px] font-medium text-violet-700 dark:border-violet-400/20 dark:bg-violet-500/10 dark:text-violet-300">
              <FiActivity className="text-[12px]" />
              {loading
                ? "Loading findings."
                : `${totals.totalAll.toLocaleString()} finding vulnerabilities`}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <span className="inline-flex max-w-[min(34rem,100%)] items-center gap-2 rounded-full border border-slate-200/80 bg-white px-3 py-1 text-[10px] font-medium text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-white/70">
              <FiLayers className="shrink-0 text-[12px]" />
              <span className="truncate">{selectedScopeLabel}</span>
            </span>

            <div className="relative" ref={targetRef}>
              <button
                type="button"
                onClick={() => setOpenTargetQuery((prev) => !prev)}
                className={[
                  "h-9 rounded-xl px-3 flex items-center gap-2 border transition min-w-27.5 sm:min-w-32.5",
                  "bg-white border-gray-200 text-slate-700 hover:border-cyan-200 hover:bg-cyan-50/60",
                  "dark:bg-white/5 dark:border-white/10 dark:text-white/75 dark:hover:bg-white/10",
                ].join(" ")}
              >
                <FiShield className="shrink-0 text-[12px]" />
                <span className="max-w-52 overflow-hidden text-ellipsis whitespace-nowrap text-[10.5px] font-medium">
                  {targetButtonLabel}
                </span>
                <FiChevronDown
                  className={`ml-auto shrink-0 text-[12px] transition-transform ${
                    openTargetQuery ? "rotate-180" : ""
                  }`}
                />
              </button>

              {openTargetQuery && (
                <div
                  className={[
                    "absolute right-0 z-100 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl",
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
                        type="text"
                        value={targetQuerySearch}
                        onChange={(e) => setTargetQuerySearch(e.target.value)}
                        placeholder="Search target"
                        className="h-8 w-full bg-transparent text-[11px] text-gray-700 outline-none placeholder:text-gray-400 dark:text-white/80 dark:placeholder:text-white/35"
                      />
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
                                  <span className="h-2 w-2 shrink-0 rounded-full bg-cyan-500" />
                                  <span className="truncate text-[11px] font-medium text-gray-700 dark:text-white/80">
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

        <div className="grid grid-cols-1 gap-3 md:grid-cols-5 xl:grid-cols-5">
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
                  "group relative overflow-hidden rounded-[20px] p-4 md:p-4 xl:p-4 text-left transition-all duration-300 min-w-0",
                  item.bg,
                  item.ring,
                  item.glow,
                  "hover:-translate-y-0.5 hover:shadow-lg",
                ].join(" ")}
              >
                <div className="relative z-10">
                  <div className="flex items-start gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div
                        className={[
                          "flex h-8 w-8 md:h-8 md:w-8 xl:h-7 xl:w-7 shrink-0 items-center justify-center rounded-[14px] text-[13px]",
                          item.iconBox,
                        ].join(" ")}
                      >
                        {item.icon}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${item.dot}`}
                          />
                          <h3 className="min-w-0 truncate text-[10px] md:text-[12px] xl:text-[13px] font-semibold leading-[1.35] tracking-wide dark:text-white">
                            {item.title}
                          </h3>
                        </div>

                        <p className="mt-0.5 truncate text-[8px] md:text-[8.5px] xl:text-[8.5px] text-slate-700/80 dark:text-white/75">
                          Network scan severity
                        </p>
                      </div>
                    </div>

                    <span
                      className={[
                        "hidden xl:inline-flex h-4.5 shrink-0 items-center justify-center rounded-full px-1.5",
                        "border text-[8px] font-medium backdrop-blur ml-auto",
                        item.pill,
                      ].join(" ")}
                    >
                      {loading ? "." : `${percent(rawNumber).toFixed(2)}%`}
                    </span>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-end justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[20px] md:text-[19px] xl:text-[18px] font-semibold tracking-tight text-slate-900 dark:text-white">
                          {item.value}
                        </div>
                        <p className="hidden xl:block mt-1 text-[10px] text-slate-600 dark:text-white/60">
                          {item.subtitle}
                        </p>
                      </div>

                      <span
                        className={[
                          "hidden xl:inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-medium",
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
                    <div className="mb-1.5 flex items-center justify-between text-[9px] md:text-[9.5px] xl:text-[9px] text-slate-600 dark:text-white/55">
                      <span>Scan intensity</span>
                      <span>
                        {loading ? "..." : `${percent(rawNumber).toFixed(2)}%`}
                      </span>
                    </div>

                    <div className="h-2.5 md:h-2.5 xl:h-2 rounded-full bg-white/55 ring-1 ring-black/5 dark:bg-white/10 dark:ring-white/8">
                      <div
                        className={`h-2.5 md:h-2.5 xl:h-2 rounded-full ${item.bar}`}
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