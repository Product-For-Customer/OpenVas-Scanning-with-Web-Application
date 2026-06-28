import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FiSearch,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiCheck,
  FiX,
} from "react-icons/fi";
import { useLanguage } from "../../../contexts/LanguageContext";
import { useStateContext } from "../../../contexts/ProviderContext";
import {
  MdRouter,
  MdDevices,
  MdImportantDevices,
  MdMemory,
  MdSecurity,
} from "react-icons/md";
import { useNavigate } from "react-router-dom";
import type { DeviceRiskDTO } from "../../../services";

type SortOrder = "desc" | "asc";

type Row = {
  id: string;
  no: number;
  taskID: string;
  name: string;
  ip: string;
  targetKey: string;
  targetLabel: string;
  firmwareVersion: string;
  vulnerabilityTotal: number;
  progressPercent: number;
  riskScore: number;
  iconIndex: number;
};

type TargetOption = {
  key: string;
  label: string;
  taskID: string;
  name: string;
  ip: string;
};

interface TableTargetProps {
  data: DeviceRiskDTO[];
  loading: boolean;
}

const ROWS_PER_PAGE = 5;

const DEVICE_ICONS = [
  { Icon: MdRouter,           bg: "bg-cyan-50 dark:bg-cyan-500/10",   fg: "text-cyan-600 dark:text-cyan-300",   ring: "border-cyan-200/80 dark:border-cyan-400/20"   },
  { Icon: MdDevices,          bg: "bg-slate-100 dark:bg-white/8",     fg: "text-slate-700 dark:text-white/80",  ring: "border-slate-200/80 dark:border-white/10"     },
  { Icon: MdImportantDevices, bg: "bg-violet-50 dark:bg-violet-500/10",fg: "text-violet-600 dark:text-violet-300",ring: "border-violet-200/80 dark:border-violet-400/20"},
  { Icon: MdMemory,           bg: "bg-emerald-50 dark:bg-emerald-500/10",fg:"text-emerald-600 dark:text-emerald-300",ring:"border-emerald-200/80 dark:border-emerald-400/20"},
  { Icon: MdSecurity,         bg: "bg-orange-50 dark:bg-orange-500/10",fg: "text-orange-600 dark:text-orange-300",ring:"border-orange-200/80 dark:border-orange-400/20"},
];

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const stableIconIndex = (seed: string) => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % DEVICE_ICONS.length;
};

const formatNumber = (n: number) => (!Number.isFinite(n) ? "0" : n.toLocaleString());
const formatRisk   = (n: number) => (!Number.isFinite(n) ? "0.00" : n.toFixed(2));

const clampRiskToTen = (risk: number) => (!Number.isFinite(risk) ? 0 : clamp(risk, 0, 10));
const getProgressPercentFromRisk = (risk: number) => (clampRiskToTen(risk) / 10) * 100;

const buildTargetKey   = (t: string, ip: string) => `${String(t||"-").trim()||"-"}__${String(ip||"-").trim()||"-"}`;
const buildTargetLabel = (t: string, ip: string) => `${String(t||"-").trim()||"-"} - ${String(ip||"-").trim()||"-"}`;

const getRiskMeta = (risk: number) => {
  if (risk >= 8) return { label:"Critical", dot:"bg-red-500",     text:"text-red-600 dark:text-red-300",     chip:"bg-red-50 border-red-200 text-red-700 dark:bg-red-500/10 dark:border-red-400/20 dark:text-red-300",     bar:"linear-gradient(90deg,#fb7185 0%,#ef4444 100%)" };
  if (risk >= 6) return { label:"High",     dot:"bg-orange-500",  text:"text-orange-600 dark:text-orange-300",chip:"bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-500/10 dark:border-orange-400/20 dark:text-orange-300",bar:"linear-gradient(90deg,#fdba74 0%,#f97316 100%)" };
  if (risk >= 4) return { label:"Medium",   dot:"bg-yellow-500",  text:"text-yellow-700 dark:text-yellow-300",chip:"bg-yellow-50 border-yellow-200 text-yellow-700 dark:bg-yellow-500/10 dark:border-yellow-400/20 dark:text-yellow-300",bar:"linear-gradient(90deg,#fde68a 0%,#eab308 100%)" };
  if (risk > 0)  return { label:"Low",      dot:"bg-emerald-500", text:"text-emerald-700 dark:text-emerald-300",chip:"bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-400/20 dark:text-emerald-300",bar:"linear-gradient(90deg,#86efac 0%,#22c55e 100%)" };
  return               { label:"Info",     dot:"bg-sky-500",      text:"text-sky-700 dark:text-sky-300",      chip:"bg-sky-50 border-sky-200 text-sky-700 dark:bg-sky-500/10 dark:border-sky-400/20 dark:text-sky-300",     bar:"linear-gradient(90deg,#7dd3fc 0%,#38bdf8 100%)" };
};

const DangerDots: React.FC<{ value: number }> = ({ value }) => {
  let level = 1;
  if (value >= 8) level = 5;
  else if (value >= 6) level = 4;
  else if (value >= 4) level = 3;
  else if (value > 0)  level = 2;

  const activeClass =
    value >= 8 ? "bg-[#ef4444]" : value >= 6 ? "bg-[#f97316]" :
    value >= 4 ? "bg-[#eab308]" : value > 0  ? "bg-[#22c55e]" : "bg-[#38bdf8]";

  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={["h-1.5 w-1.5 rounded-full", i < level ? activeClass : "bg-gray-200 dark:bg-white/10"].join(" ")} />
      ))}
    </div>
  );
};

const buildPageNumbers = (currentPage: number, totalPages: number): number[] => {
  if (totalPages <= 1) return [1];
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
  if (currentPage <= 3) return [1, 2, 3, 4, 5];
  if (currentPage >= totalPages - 2) return [totalPages-4, totalPages-3, totalPages-2, totalPages-1, totalPages];
  return [currentPage-2, currentPage-1, currentPage, currentPage+1, currentPage+2];
};

const TableTarget: React.FC<TableTargetProps> = ({ data, loading }) => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { currentColor } = useStateContext();

  const [search,         setSearch]         = useState("");
  const [sortOrder,      setSortOrder]      = useState<SortOrder>("desc");
  const [openSort,       setOpenSort]       = useState(false);
  const [currentPage,    setCurrentPage]    = useState(1);
  const [openTargetQuery,setOpenTargetQuery]= useState(false);
  const [targetQuerySearch, setTargetQuerySearch] = useState("");
  const [selectedTargets, setSelectedTargets]     = useState<string[]>([]);

  const sortRef   = useRef<HTMLDivElement | null>(null);
  const targetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const node = e.target as Node;
      if (sortRef.current   && !sortRef.current.contains(node))   setOpenSort(false);
      if (targetRef.current && !targetRef.current.contains(node)) setOpenTargetQuery(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const baseRows = useMemo<Row[]>(() => {
    const list = Array.isArray(data) ? data : [];
    return list.map((x, idx) => {
      const taskID   = String(x?.task_id        ?? "").trim();
      const name     = String(x?.task_name      ?? "").trim() || "Unknown Task";
      const ip       = String(x?.ip_address     ?? "").trim() || "-";
      const firmware = String(x?.firmware_version ?? "").trim() || "Unknown Device";
      const vulnTotal = Number(x?.vulnerability_total) || 0;
      const riskScore = Number(x?.risk_score)           || 0;
      const targetKey   = buildTargetKey(name, ip);
      const targetLabel = buildTargetLabel(name, ip);
      const iconIndex   = stableIconIndex(`${taskID}-${name}-${ip}-${firmware}`);
      return {
        id: `${targetKey}-${taskID || "task"}-${idx}`,
        no: idx + 1,
        taskID, name, ip,
        targetKey, targetLabel,
        firmwareVersion: firmware,
        vulnerabilityTotal: vulnTotal,
        progressPercent: clamp(getProgressPercentFromRisk(riskScore), 0, 100),
        riskScore, iconIndex,
      };
    });
  }, [data]);

  const targetOptions = useMemo<TargetOption[]>(() => {
    const seen = new Set<string>();
    const opts: TargetOption[] = [];
    for (const row of baseRows) {
      if (!row.targetKey || seen.has(row.targetKey)) continue;
      seen.add(row.targetKey);
      opts.push({ key: row.targetKey, label: row.targetLabel, taskID: row.taskID, name: row.name, ip: row.ip });
    }
    return opts.sort((a, b) => a.label.localeCompare(b.label));
  }, [baseRows]);

  const filteredTargetOptions = useMemo(() => {
    const kw = targetQuerySearch.trim().toLowerCase();
    return kw ? targetOptions.filter(o => o.label.toLowerCase().includes(kw)) : targetOptions;
  }, [targetOptions, targetQuerySearch]);

  const rows = useMemo<Row[]>(() => {
    let filtered = [...baseRows];
    if (selectedTargets.length > 0) {
      const set = new Set(selectedTargets);
      filtered = filtered.filter(r => set.has(r.targetKey));
    }
    const q = search.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.ip.toLowerCase().includes(q) ||
        r.targetLabel.toLowerCase().includes(q) ||
        r.firmwareVersion.toLowerCase().includes(q) ||
        r.riskScore.toString().includes(q) ||
        r.vulnerabilityTotal.toString().includes(q)
      );
    }
    filtered.sort((a, b) => {
      if (b.riskScore !== a.riskScore) return sortOrder === "desc" ? b.riskScore - a.riskScore : a.riskScore - b.riskScore;
      if (b.vulnerabilityTotal !== a.vulnerabilityTotal) return b.vulnerabilityTotal - a.vulnerabilityTotal;
      return a.name.localeCompare(b.name);
    });
    return filtered.map((r, i) => ({ ...r, no: i + 1 }));
  }, [baseRows, search, sortOrder, selectedTargets]);

  const totalPages    = useMemo(() => Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE)), [rows.length]);
  const paginatedRows = useMemo(() => rows.slice((currentPage-1)*ROWS_PER_PAGE, currentPage*ROWS_PER_PAGE), [rows, currentPage]);
  const pageNumbers   = useMemo(() => buildPageNumbers(currentPage, totalPages), [currentPage, totalPages]);

  const stats = useMemo(() => ({
    totalTargets: rows.length,
    totalVulns:   rows.reduce((s, x) => s + (Number(x.vulnerabilityTotal) || 0), 0),
    highestRisk:  rows.reduce((m, x) => Math.max(m, Number(x.riskScore) || 0), 0),
  }), [rows]);

  const targetButtonLabel = useMemo(() => {
    if (selectedTargets.length === 0) return "Target Filter";
    if (selectedTargets.length === 1) return "1 target selected";
    return `${selectedTargets.length} targets selected`;
  }, [selectedTargets.length]);

  const allVisibleTargetsSelected =
    filteredTargetOptions.length > 0 &&
    filteredTargetOptions.every(o => selectedTargets.includes(o.key));

  const toggleTarget = (key: string) =>
    setSelectedTargets(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  const handleSelectAllVisibleTargets = () => {
    const keys = filteredTargetOptions.map(o => o.key);
    setSelectedTargets(prev => {
      const s = new Set(prev);
      const allSel = keys.every(k => s.has(k));
      if (allSel) return prev.filter(k => !keys.includes(k));
      return Array.from(new Set([...prev, ...keys]));
    });
  };

  const clearAllTargets = () => setSelectedTargets([]);

  useEffect(() => { setCurrentPage(1); }, [search, sortOrder, selectedTargets]);
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [currentPage, totalPages]);

  const goToDevice = (row: Row) => {
    if (!row.taskID.trim()) return;
    navigate("/admin/vulnerability-by-device", {
      state: { task_id: row.taskID, ip_address: row.ip, task_name: row.name, firmware_version: row.firmwareVersion },
    });
  };

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────

  return (
    <section className="rounded-xl border border-slate-200/70 bg-white p-4 dark:border-white/8 dark:bg-[#0d0b1a]/80 sm:p-5">

      {/* ── Header ── */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">

        {/* Left: title + badges */}
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-[13px] font-semibold text-slate-700 dark:text-white/80">
            {t("target.title")}
          </h2>
          {!loading && (
            <>
              <span className="rounded-full border border-slate-200/70 bg-slate-50 px-2.5 py-0.5 text-[10.5px] font-medium text-slate-500 dark:border-white/8 dark:bg-white/5 dark:text-white/40">
                {stats.totalTargets} targets
              </span>
              <span className="rounded-full border border-slate-200/70 bg-slate-50 px-2.5 py-0.5 text-[10.5px] font-medium text-slate-500 dark:border-white/8 dark:bg-white/5 dark:text-white/40">
                {formatNumber(stats.totalVulns)} vulns
              </span>
            </>
          )}
        </div>

        {/* Right: filters */}
        <div className="flex flex-wrap items-center gap-2">

          {/* Target filter */}
          <div className="relative" ref={targetRef}>
            <button
              type="button"
              onClick={() => setOpenTargetQuery(p => !p)}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200/70 bg-white px-3 text-[10.5px] font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/8"
            >
              <span className="max-w-36 truncate">{targetButtonLabel}</span>
              <div className="flex shrink-0 items-center gap-1.5">
                {selectedTargets.length > 0 && (
                  <span className="inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full border border-blue-200 bg-blue-50 px-1 text-[9.5px] font-semibold text-blue-700 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-300">
                    {selectedTargets.length}
                  </span>
                )}
                <FiChevronDown className={`text-[11px] transition-transform ${openTargetQuery ? "rotate-180" : ""}`} />
              </div>
            </button>

            {openTargetQuery && (
              <div className="absolute right-0 z-50 mt-1.5 w-72 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xl dark:border-white/10 dark:bg-[#0d0b1a]">
                <div className="border-b border-slate-100 p-2.5 dark:border-white/8">
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200/70 bg-slate-50 px-2.5 dark:border-white/8 dark:bg-white/5">
                    <FiSearch className="shrink-0 text-[11px] text-slate-400 dark:text-white/35" />
                    <input
                      type="text"
                      value={targetQuerySearch}
                      onChange={e => setTargetQuerySearch(e.target.value)}
                      placeholder="Search target or ip..."
                      className="h-8 w-full bg-transparent text-[11px] text-slate-700 outline-none placeholder:text-slate-400 dark:text-white/75 dark:placeholder:text-white/30"
                    />
                    {targetQuerySearch.trim() && (
                      <button type="button" onClick={() => setTargetQuerySearch("")} className="text-slate-400 hover:text-slate-600 dark:text-white/35">
                        <FiX className="text-[11px]" />
                      </button>
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <button type="button" onClick={handleSelectAllVisibleTargets} className="text-[10px] font-medium text-blue-500 hover:text-blue-600 dark:text-blue-400">
                      {allVisibleTargetsSelected ? "Unselect visible" : "Select visible"}
                    </button>
                    <button type="button" onClick={clearAllTargets} className="text-[10px] font-medium text-slate-400 hover:text-slate-600 dark:text-white/35">
                      Clear all
                    </button>
                  </div>
                </div>
                <div className="max-h-56 overflow-y-auto p-2">
                  {filteredTargetOptions.length === 0 ? (
                    <p className="py-5 text-center text-[11px] text-slate-400 dark:text-white/35">No matching targets</p>
                  ) : (
                    <div className="space-y-0.5">
                      {filteredTargetOptions.map(opt => {
                        const checked = selectedTargets.includes(opt.key);
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => toggleTarget(opt.key)}
                            className={["flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition",
                              checked ? "bg-blue-50 dark:bg-blue-500/10" : "hover:bg-slate-50 dark:hover:bg-white/5"].join(" ")}
                          >
                            <span className={["flex h-4 w-4 shrink-0 items-center justify-center rounded border transition",
                              checked ? "border-blue-500 bg-blue-500 text-white" : "border-slate-300 bg-white text-transparent dark:border-white/20 dark:bg-white/5"].join(" ")}>
                              <FiCheck className="text-[9px]" />
                            </span>
                            <span className="truncate text-[11px] text-slate-700 dark:text-white/75">{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Search */}
          <div className="flex h-8 items-center gap-2 rounded-lg border border-slate-200/70 bg-white px-3 dark:border-white/8 dark:bg-white/5 sm:w-60">
            <FiSearch className="shrink-0 text-[11px] text-slate-400 dark:text-white/35" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search target, ip, firmware..."
              className="w-full bg-transparent text-[11px] text-slate-700 outline-none placeholder:text-slate-400 dark:text-white/75 dark:placeholder:text-white/30"
            />
          </div>

          {/* Sort */}
          <div className="relative" ref={sortRef}>
            <button
              type="button"
              onClick={() => setOpenSort(p => !p)}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200/70 bg-white px-3 text-[10.5px] font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/8"
            >
              <span>{sortOrder === "desc" ? "Highest Risk" : "Lowest Risk"}</span>
              <FiChevronDown className={`text-[11px] transition-transform ${openSort ? "rotate-180" : ""}`} />
            </button>
            {openSort && (
              <div className="absolute right-0 z-50 mt-1.5 w-48 overflow-hidden rounded-xl border border-slate-200/80 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-[#0d0b1a]">
                {(["desc","asc"] as SortOrder[]).map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => { setSortOrder(opt); setOpenSort(false); }}
                    className={["flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] font-medium transition",
                      sortOrder === opt ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300" : "text-slate-600 hover:bg-slate-50 dark:text-white/65 dark:hover:bg-white/5"].join(" ")}
                  >
                    <span>{opt === "desc" ? "Highest Risk Score" : "Lowest Risk Score"}</span>
                    {sortOrder === opt && <FiCheck className="text-[11px]" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="overflow-hidden rounded-xl border border-slate-200/70 bg-white dark:border-white/8 dark:bg-[#0d0b1a]/80">
        <div className="overflow-x-auto">
          <table className="w-full min-w-200">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 dark:border-white/8 dark:bg-white/3">
                <th className="whitespace-nowrap px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/35">No</th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/35">Target</th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/35">IP Address</th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/35">Firmware</th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/35">Vulnerability</th>
                <th className="min-w-72 whitespace-nowrap px-4 py-3 text-right text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/35">Risk Score</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                Array.from({ length: ROWS_PER_PAGE }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-100 dark:border-white/5">
                    <td className="px-4 py-3.5"><div className="h-3 w-5 animate-pulse rounded bg-slate-100 dark:bg-white/10" /></td>
                    <td className="px-4 py-3.5">
                      <div className="h-3 w-32 animate-pulse rounded bg-slate-100 dark:bg-white/10" />
                      <div className="mt-2 h-2.5 w-16 animate-pulse rounded bg-slate-100 dark:bg-white/10" />
                    </td>
                    <td className="px-4 py-3.5"><div className="h-3 w-20 animate-pulse rounded bg-slate-100 dark:bg-white/10" /></td>
                    <td className="px-4 py-3.5"><div className="h-3 w-36 animate-pulse rounded bg-slate-100 dark:bg-white/10" /></td>
                    <td className="px-4 py-3.5"><div className="h-3 w-14 animate-pulse rounded bg-slate-100 dark:bg-white/10" /></td>
                    <td className="px-4 py-3.5">
                      <div className="ml-auto h-3 w-16 animate-pulse rounded bg-slate-100 dark:bg-white/10" />
                      <div className="mt-2 ml-auto h-2 w-44 animate-pulse rounded bg-slate-100 dark:bg-white/10" />
                    </td>
                  </tr>
                ))
              ) : paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[12px] text-slate-500 dark:text-white/45">
                    {t("target.noTargets")}
                  </td>
                </tr>
              ) : (
                paginatedRows.map(row => {
                  const { Icon, bg, fg, ring } = DEVICE_ICONS[row.iconIndex];
                  const riskMeta = getRiskMeta(row.riskScore);
                  return (
                    <tr
                      key={row.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => goToDevice(row)}
                      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); goToDevice(row); } }}
                      className="cursor-pointer border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/60 focus:bg-slate-50/80 focus:outline-none dark:border-white/5 dark:hover:bg-white/3 dark:focus:bg-white/5"
                    >
                      {/* No */}
                      <td className="whitespace-nowrap px-4 py-3.5 text-[12px] text-slate-500 dark:text-white/50">
                        {row.no}
                      </td>

                      {/* Target */}
                      <td className="min-w-56 px-4 py-3.5">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div className={["flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border", bg, ring].join(" ")}>
                            <Icon className={`${fg} text-[15px]`} />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-[12px] font-semibold text-slate-800 dark:text-white/85">
                              {row.name}
                            </div>
                            <div className="mt-0.5">
                              <span className={["inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[8.5px] font-semibold", riskMeta.chip].join(" ")}>
                                <span className={`h-1.5 w-1.5 rounded-full ${riskMeta.dot}`} />
                                {riskMeta.label}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* IP */}
                      <td className="whitespace-nowrap px-4 py-3.5 text-[12px] text-slate-600 dark:text-white/65">
                        {row.ip}
                      </td>

                      {/* Firmware */}
                      <td className="min-w-64 px-4 py-3.5">
                        <div className="truncate text-[12px] text-slate-600 dark:text-white/65">
                          {row.firmwareVersion}
                        </div>
                      </td>

                      {/* Vulnerability total */}
                      <td className="whitespace-nowrap px-4 py-3.5 text-[12px] font-medium text-slate-700 dark:text-white/75">
                        {formatNumber(row.vulnerabilityTotal)}
                      </td>

                      {/* Risk score */}
                      <td className="min-w-72 px-4 py-3.5">
                        <div className="flex flex-col items-end gap-1.5">
                          <div className="flex items-center gap-2">
                            <DangerDots value={row.riskScore} />
                            <span className={`text-[12px] font-semibold tabular-nums ${riskMeta.text}`}>
                              {formatRisk(row.riskScore)}
                            </span>
                          </div>
                          <div className="flex w-full max-w-64 items-center gap-2.5">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ width:`${Math.max(row.progressPercent, row.riskScore > 0 ? 4 : 0)}%`, background: riskMeta.bar }}
                              />
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Footer: count + pagination ── */}
        {!loading && rows.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-2.5 dark:border-white/8">
            <p className="text-[10.5px] text-slate-400 dark:text-white/30">
              {rows.length > ROWS_PER_PAGE
                ? `${(currentPage - 1) * ROWS_PER_PAGE + 1}–${Math.min(currentPage * ROWS_PER_PAGE, rows.length)} of ${rows.length} targets`
                : `${rows.length} target${rows.length !== 1 ? "s" : ""} total`}
            </p>

            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200/70 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35 dark:border-white/8 dark:text-white/50 dark:hover:bg-white/5"
                >
                  <FiChevronLeft className="text-[12px]" />
                </button>

                {pageNumbers.map(page => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    style={currentPage === page ? { backgroundColor: currentColor } : undefined}
                    className={[
                      "grid h-7 min-w-7 place-items-center rounded-lg px-1.5 text-[11px] font-semibold transition",
                      currentPage === page
                        ? "text-white"
                        : "border border-slate-200/70 text-slate-500 hover:bg-slate-50 dark:border-white/8 dark:text-white/50 dark:hover:bg-white/5",
                    ].join(" ")}
                  >
                    {page}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200/70 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35 dark:border-white/8 dark:text-white/50 dark:hover:bg-white/5"
                >
                  <FiChevronRight className="text-[12px]" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default TableTarget;
