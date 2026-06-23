import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  FiPlay, FiTrash2, FiPlus, FiRefreshCw,
  FiSettings, FiTarget, FiAlertTriangle, FiCheckCircle,
  FiClock, FiCalendar, FiX, FiRepeat,
  FiChevronDown, FiSearch, FiCheck, FiType, FiAlignLeft,
  FiActivity, FiTrendingUp, FiMinus, FiEdit2, FiStopCircle,
} from "react-icons/fi";
import { message } from "antd";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import {
  GetGMPStatus, ListGMPTasks, ListGMPTargets,
  CreateGMPTask, UpdateGMPTask, StartGMPTask, StopGMPTask, DeleteGMPTask,
  ListGMPScanners, ListGMPConfigs,
  getTaskStatusBg,
  ListScanSchedules, CreateScanSchedule, UpdateScanSchedule, DeleteScanSchedule,
  type GMPStatusResponse, type GMPTaskDTO, type GMPTargetDTO,
  type GMPScannerDTO, type GMPConfigDTO,
  type AutoScanScheduleDTO, type ScheduleFrequency,
} from "../../services";
import { useLanguage } from "../../contexts/LanguageContext";
import { useStateContext } from "../../contexts/ProviderContext";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function fmtNextRun(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" })
    + " " + d.toLocaleTimeString("en-GB", { hour:"2-digit", minute:"2-digit" });
}

function freqBadge(s: AutoScanScheduleDTO): string {
  if (s.frequency === "once" && s.schedule_at)     return `Once · ${s.schedule_at}`;
  if (s.frequency === "monthly" && s.day_of_month) return `Monthly · Day ${s.day_of_month}`;
  if (s.frequency === "yearly" && s.month && s.day)
    return `Yearly · ${MONTHS[s.month - 1]} ${s.day}`;
  return s.frequency;
}

const FREQ_COLOR: Record<ScheduleFrequency, { bg: string; text: string }> = {
  once:    { bg: "#EDE9FE", text: "#5B21B6" },
  monthly: { bg: "#DBEAFE", text: "#1E40AF" },
  yearly:  { bg: "#D1FAE5", text: "#065F46" },
};

function getSeverityInfo(score: number): { label: string; bg: string } {
  if (score === 0) return { label: "Log",      bg: "#374151" };
  if (score < 4)  return { label: "Low",      bg: "#22c55e" };
  if (score < 7)  return { label: "Medium",   bg: "#eab308" };
  if (score < 9)  return { label: "High",     bg: "#f97316" };
  return           { label: "Critical",  bg: "#ef4444" };
}

// ─────────────────────────────────────────────────────────────
// Severity Badge — "4.8 (Medium)" style
// ─────────────────────────────────────────────────────────────

const SeverityBadge: React.FC<{ score: number }> = ({ score }) => {
  const { label, bg } = getSeverityInfo(score);
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10.5px] font-bold text-white" style={{ background: bg }}>
      {score.toFixed(1)} ({label})
    </span>
  );
};

// ─────────────────────────────────────────────────────────────
// Shared: Searchable Dropdown
// ─────────────────────────────────────────────────────────────

type DropdownItem = { id: string; name: string };

type SearchDropdownProps = {
  dropRef: React.RefObject<HTMLDivElement | null>;
  open: boolean;
  setOpen: (v: boolean) => void;
  search: string;
  setSearch: (v: string) => void;
  selectedLabel: string;
  placeholder: string;
  items: DropdownItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  disabled?: boolean;
  dropH?: string; // Tailwind max-h class for the items list, default "max-h-44" (~5 items)
};

const SearchDropdown: React.FC<SearchDropdownProps> = ({
  dropRef, open, setOpen, search, setSearch,
  selectedLabel, placeholder, items, selectedId, onSelect, disabled,
  dropH = "max-h-44",
}) => (
  <div className="relative" ref={dropRef}>
    <button type="button" onClick={() => setOpen(!open)} disabled={disabled}
      className={[
        "flex h-9 w-full items-center gap-2 rounded-xl border px-3 text-left transition",
        open ? "border-cyan-300 bg-cyan-50/40 dark:border-cyan-400/30 dark:bg-white/10"
             : "border-slate-200/80 bg-white hover:border-cyan-300 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10",
        "disabled:cursor-not-allowed disabled:opacity-50",
      ].join(" ")}>
      <span className="flex-1 truncate text-[12px] text-slate-700 dark:text-white/75">
        {disabled ? "Loading…" : (selectedLabel || placeholder)}
      </span>
      <FiChevronDown className={`shrink-0 text-[12px] text-slate-400 transition-transform duration-200 dark:text-white/35 ${open ? "rotate-180" : ""}`} />
    </button>
    {open && (
      <div className="absolute left-0 right-0 z-60 mt-1.5 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xl dark:border-white/10 dark:bg-[#0d0b1a]">
        <div className="border-b border-slate-100 p-2 dark:border-white/8">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200/70 bg-slate-50 px-2.5 dark:border-white/8 dark:bg-white/5">
            <FiSearch className="shrink-0 text-[11px] text-slate-400 dark:text-white/35" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" autoFocus
              className="h-8 w-full bg-transparent text-[11px] text-slate-700 outline-none placeholder:text-slate-400 dark:text-white/75 dark:placeholder:text-white/30" />
          </div>
        </div>
        <div className={`${dropH} overflow-y-auto p-1.5`}>
          {items.length === 0
            ? <p className="py-4 text-center text-[11px] text-slate-400 dark:text-white/35">No items found</p>
            : <div className="space-y-0.5">
                {items.map(item => {
                  const checked = item.id === selectedId;
                  return (
                    <button key={item.id} type="button"
                      onClick={() => { onSelect(item.id); setOpen(false); setSearch(""); }}
                      className={["flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition",
                        checked ? "bg-cyan-50 dark:bg-cyan-500/10" : "hover:bg-slate-50 dark:hover:bg-white/5"].join(" ")}>
                      <span className={["flex h-4 w-4 shrink-0 items-center justify-center rounded border transition",
                        checked ? "border-cyan-500 bg-cyan-500 text-white" : "border-slate-300 bg-white text-transparent dark:border-white/20 dark:bg-white/5"].join(" ")}>
                        <FiCheck className="text-[9px]" />
                      </span>
                      <span className="truncate text-[11.5px] text-slate-700 dark:text-white/75">{item.name}</span>
                    </button>
                  );
                })}
              </div>
          }
        </div>
      </div>
    )}
  </div>
);

// ─────────────────────────────────────────────────────────────
// Shared: Yes/No Radio Group
// ─────────────────────────────────────────────────────────────

const YesNoRadio: React.FC<{
  value: boolean;
  onChange: (v: boolean) => void;
  currentColor: string;
}> = ({ value, onChange, currentColor }) => (
  <div className="flex gap-4">
    {[true, false].map(opt => (
      <label key={String(opt)} className="flex cursor-pointer items-center gap-2">
        <span
          onClick={() => onChange(opt)}
          className="relative flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 transition"
          style={{
            borderColor: value === opt ? currentColor : "#cbd5e1",
            backgroundColor: value === opt ? currentColor : "transparent",
          }}
        >
          {value === opt && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
        </span>
        <span className="text-[12px] font-medium text-slate-700 dark:text-white/70">
          {opt ? "Yes" : "No"}
        </span>
      </label>
    ))}
  </div>
);

// ─────────────────────────────────────────────────────────────
// ScanConfirmModal
// ─────────────────────────────────────────────────────────────

const DELETE_GRAD = "linear-gradient(135deg, #ef4444, #dc2626)";

type ScanConfirmModalProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
};

const ScanConfirmModal: React.FC<ScanConfirmModalProps> = ({
  open, title, description, confirmLabel, onConfirm, onCancel,
}) => {
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[3px]" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl bg-white dark:bg-[#12101f]"
        style={{ boxShadow: "0 24px 64px -12px #ef444430, 0 8px 32px rgba(0,0,0,.20)" }}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-white/8">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: DELETE_GRAD }}>
              <FiTrash2 className="text-[13px]" />
            </span>
            <div>
              <p className="text-[9.5px] font-bold uppercase tracking-widest text-red-500">SCAN MANAGEMENT · DELETE</p>
              <h3 className="text-[14px] font-bold text-slate-800 dark:text-white/90">{title}</h3>
            </div>
          </div>
          <button type="button" onClick={onCancel}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 dark:text-white/35 dark:hover:bg-white/8">
            <FiX className="text-[15px]" />
          </button>
        </div>
        <div className="px-5 py-4">
          <p className="text-[12.5px] leading-6 text-slate-500 dark:text-white/45">{description}</p>
        </div>
        <div className="flex gap-2.5 border-t border-slate-100 px-5 py-3.5 dark:border-white/8">
          <button type="button" onClick={onCancel}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 text-[12.5px] font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/8 dark:text-white/55 dark:hover:bg-white/5">
            Cancel
          </button>
          <button type="button" onClick={() => void onConfirm()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[12.5px] font-semibold text-white transition hover:opacity-90"
            style={{ background: DELETE_GRAD }}>
            <FiTrash2 className="text-[12px]" />{confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

// ─────────────────────────────────────────────────────────────
// GMP Status Badge
// ─────────────────────────────────────────────────────────────

const GMPStatusBadge: React.FC<{ status: GMPStatusResponse | null; loading: boolean }> = ({ status, loading }) => {
  const { t } = useLanguage();
  if (loading) return (
    <div className="flex items-center gap-1.5 rounded-full border border-slate-200/70 bg-white px-3 py-1.5 text-[11px] dark:border-white/8 dark:bg-white/5">
      <div className="h-2 w-2 animate-pulse rounded-full bg-slate-400" />
      <span className="text-slate-500 dark:text-white/40">{t("scan.connecting")}</span>
    </div>
  );
  if (!status || !status.connected) return (
    <div className="flex items-center gap-1.5 rounded-full border border-slate-200/70 bg-white px-3 py-1.5 text-[11px] dark:border-white/8 dark:bg-white/5 dark:text-white/40">
      <span className="h-2 w-2 rounded-full bg-red-400" />
      <span className="text-slate-500 dark:text-white/40">{t("scan.gmpDisconnected")}</span>
    </div>
  );
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <span>{t("scan.openvasConnected")} {status.version || ""}</span>
    </div>
  );
};


// ─────────────────────────────────────────────────────────────
// Section Header (inside modals)
// ─────────────────────────────────────────────────────────────

const SectionDivider: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center gap-2 pt-1">
    <span className="text-[9.5px] font-bold uppercase tracking-[0.15em] text-slate-400 dark:text-white/30">{label}</span>
    <div className="flex-1 border-t border-slate-100 dark:border-white/8" />
  </div>
);

// ─────────────────────────────────────────────────────────────
// CreateTaskModal — full OpenVAS New Task fields
// ─────────────────────────────────────────────────────────────

type CreateTaskModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

const CreateTaskModal: React.FC<CreateTaskModalProps> = ({ open, onClose, onCreated }) => {
  const { t } = useLanguage();
  const { currentColor } = useStateContext();
  const accentGrad = `linear-gradient(135deg, ${currentColor}, color-mix(in srgb, ${currentColor} 65%, #a855f7))`;

  // Basic fields
  const [name,      setName]      = useState("");
  const [comment,   setComment]   = useState("");
  const [targetId,  setTargetId]  = useState("");
  const [configId,  setConfigId]  = useState("");
  const [scannerId, setScannerId] = useState("");

  // OpenVAS options (same defaults as OpenVAS New Task)
  const [addAssets,      setAddAssets]      = useState(true);
  const [applyOverrides, setApplyOverrides] = useState(true);
  const [minQod,         setMinQod]         = useState(70);
  const [alterable,      setAlterable]      = useState(false);
  const [autoDelete,     setAutoDelete]     = useState<"no" | "keep">("no");
  const [autoDeleteData, setAutoDeleteData] = useState(5);
  const [maxChecks,      setMaxChecks]      = useState(4);
  const [maxHosts,       setMaxHosts]       = useState(20);

  const [loading,   setLoading]   = useState(false);
  const [formError, setFormError] = useState("");

  const [targets,     setTargets]     = useState<GMPTargetDTO[]>([]);
  const [configs,     setConfigs]     = useState<GMPConfigDTO[]>([]);
  const [scanners,    setScanners]    = useState<GMPScannerDTO[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Detect CVE scanner (type 3 in GMP, or name contains "CVE") — must be after scanners state
  const isCVEScanner = useMemo(() => {
    const sel = scanners.find(x => x.id === scannerId);
    return sel !== undefined && (
      (sel as GMPScannerDTO & { type?: number }).type === 3 ||
      sel.name.toLowerCase().includes("cve")
    );
  }, [scanners, scannerId]);

  const [openTarget,  setOpenTarget]  = useState(false);
  const [openConfig,  setOpenConfig]  = useState(false);
  const [openScanner, setOpenScanner] = useState(false);
  const [searchTarget,  setSearchTarget]  = useState("");
  const [searchConfig,  setSearchConfig]  = useState("");
  const [searchScanner, setSearchScanner] = useState("");

  const targetRef  = useRef<HTMLDivElement | null>(null);
  const configRef  = useRef<HTMLDivElement | null>(null);
  const scannerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!targetRef.current?.contains(e.target as Node))  setOpenTarget(false);
      if (!configRef.current?.contains(e.target as Node))  setOpenConfig(false);
      if (!scannerRef.current?.contains(e.target as Node)) setOpenScanner(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      setLoadingData(true);
      try {
        const [t2, c, s] = await Promise.all([ListGMPTargets(), ListGMPConfigs(), ListGMPScanners()]);
        setTargets(t2); setConfigs(c); setScanners(s);
        if (s.length > 0) {
          const def = s.find(x => x.name.toLowerCase().includes("openvas default")) ?? s[0];
          setScannerId(def.id);
        }
        if (c.length > 0) {
          const def = c.find(x => x.name.toLowerCase().includes("full and fast")) ?? c[0];
          setConfigId(def.id);
        }
      } catch { /* silent */ }
      finally { setLoadingData(false); }
    };
    void load();
  }, [open]);

  const reset = () => {
    setName(""); setComment(""); setTargetId(""); setConfigId(""); setScannerId("");
    setAddAssets(true); setApplyOverrides(true); setMinQod(70); setAlterable(false);
    setAutoDelete("no"); setAutoDeleteData(5); setMaxChecks(4); setMaxHosts(20);
    setFormError("");
    setOpenTarget(false); setOpenConfig(false); setOpenScanner(false);
    setSearchTarget(""); setSearchConfig(""); setSearchScanner("");
  };
  const handleClose = () => { reset(); onClose(); };

  const handleCreate = async () => {
    if (!name.trim()) { setFormError("Task name is required"); return; }
    if (!targetId)    { setFormError("Please select a Scan Target"); return; }
    if (!isCVEScanner && !configId) { setFormError("Please select a Scan Config"); return; }
    if (minQod < 0 || minQod > 100) { setFormError("Min QoD must be 0–100"); return; }
    if (!isCVEScanner && maxChecks < 1) { setFormError("Max concurrent NVTs must be ≥ 1"); return; }
    if (!isCVEScanner && maxHosts < 1)  { setFormError("Max concurrent hosts must be ≥ 1"); return; }

    setLoading(true); setFormError("");
    try {
      await CreateGMPTask({
        name:             name.trim(),
        comment:          comment.trim(),
        target_id:        targetId,
        config_id:        configId,
        scanner_id:       scannerId || undefined,
        add_assets:       addAssets,
        apply_overrides:  applyOverrides,
        min_qod:          minQod,
        alterable:        alterable,
        auto_delete:      autoDelete,
        auto_delete_data: autoDelete === "keep" ? autoDeleteData : undefined,
        max_checks:       maxChecks,
        max_hosts:        maxHosts,
      });
      message.success("Task created successfully");
      reset(); onCreated(); onClose();
    } catch (err: unknown) {
      setFormError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to create task");
    } finally { setLoading(false); }
  };

  if (!open) return null;

  const inputCls = "h-9 w-full rounded-xl border border-slate-200/80 bg-white px-3 text-[12px] text-slate-800 placeholder:text-slate-400 outline-none transition focus:ring-2 focus:ring-cyan-200 focus:border-cyan-300 dark:border-white/10 dark:bg-white/5 dark:text-white/85 dark:placeholder:text-white/35 dark:focus:ring-white/10 dark:focus:border-cyan-400/30";
  const numCls   = "h-9 w-full rounded-xl border border-slate-200/80 bg-white px-3 text-[12px] text-slate-800 outline-none transition focus:ring-2 focus:ring-cyan-200 focus:border-cyan-300 dark:border-white/10 dark:bg-white/5 dark:text-white/85 dark:focus:ring-white/10 dark:focus:border-cyan-400/30";
  const labelCls = "mb-1.5 flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/35";

  const fTarget  = searchTarget.trim()  ? targets.filter(x => x.name.toLowerCase().includes(searchTarget.toLowerCase()))  : targets;
  const fConfig  = searchConfig.trim()  ? configs.filter(x  => x.name.toLowerCase().includes(searchConfig.toLowerCase()))   : configs;
  const fScanner = searchScanner.trim() ? scanners.filter(x => x.name.toLowerCase().includes(searchScanner.toLowerCase()))  : scanners;

  return createPortal(
    <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[3px]" onClick={handleClose} />
      <div className="relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white dark:bg-[#12101f]"
        style={{ maxHeight: "90vh", boxShadow: `0 24px 64px -12px ${currentColor}30, 0 8px 32px rgba(0,0,0,.25)` }}>

        {/* ── Header ── */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-white/8">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: accentGrad }}>
              <FiSettings className="text-[14px]" />
            </span>
            <div>
              <p className="text-[9.5px] font-bold uppercase tracking-widest" style={{ color: currentColor }}>SCAN MANAGEMENT · NEW TASK</p>
              <h3 className="text-[14px] font-bold text-slate-800 dark:text-white/90">New Task</h3>
            </div>
          </div>
          <button type="button" onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 dark:text-white/35 dark:hover:bg-white/8">
            <FiX className="text-[15px]" />
          </button>
        </div>

        {/* ── Body (scrollable) ── */}
        <div className="overflow-y-auto px-5 py-4">
          <div className="space-y-4">

            {/* ── Basic Info ── */}
            <SectionDivider label="Basic Info" />

            <div>
              <label className={labelCls}><FiType className="text-[10px]" />Name <span className="text-red-400">*</span></label>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Internal Network Scan" className={inputCls} />
            </div>

            <div>
              <label className={labelCls}><FiAlignLeft className="text-[10px]" />Comment (optional)</label>
              <input type="text" value={comment} onChange={e => setComment(e.target.value)}
                placeholder="e.g. 192.168.1.1 or description" className={inputCls} />
            </div>

            {/* ── Scan Target ── */}
            <SectionDivider label="Scan Target" />

            <div>
              <label className={labelCls}><FiTarget className="text-[10px]" />Scan Targets <span className="text-red-400">*</span></label>
              <SearchDropdown dropRef={targetRef} open={openTarget} setOpen={setOpenTarget}
                search={searchTarget} setSearch={setSearchTarget}
                selectedLabel={targets.find(x => x.id === targetId)?.name ?? ""}
                placeholder="Select a target…" items={fTarget} selectedId={targetId}
                onSelect={setTargetId} disabled={loadingData} />
            </div>

            {/* ── Scan Options ── */}
            <SectionDivider label="Scan Options" />

            {/* Add results to Assets */}
            <div>
              <label className={labelCls}>Add results to Assets</label>
              <YesNoRadio value={addAssets} onChange={setAddAssets} currentColor={currentColor} />
            </div>

            {/* Apply Overrides */}
            <div>
              <label className={labelCls}>Apply Overrides</label>
              <YesNoRadio value={applyOverrides} onChange={setApplyOverrides} currentColor={currentColor} />
            </div>

            {/* Min QoD */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className={labelCls + " mb-0"}>Min QoD</label>
                <span className="text-[11px] font-bold tabular-nums" style={{ color: currentColor }}>{minQod}%</span>
              </div>
              <input type="range" min={0} max={100} step={1} value={minQod}
                onChange={e => setMinQod(Number(e.target.value))}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 dark:bg-white/15"
                style={{ accentColor: currentColor }} />
              <div className="mt-1 flex justify-between text-[9.5px] text-slate-400 dark:text-white/30">
                <span>0% (all)</span>
                <span>Only include results with QoD ≥ {minQod}%</span>
                <span>100%</span>
              </div>
              <div className="mt-2">
                <input type="number" min={0} max={100} value={minQod}
                  onChange={e => setMinQod(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                  className={numCls} />
              </div>
            </div>

            {/* Alterable Task */}
            <div>
              <label className={labelCls}>Alterable Task</label>
              <YesNoRadio value={alterable} onChange={setAlterable} currentColor={currentColor} />
              <p className="mt-1 text-[10.5px] text-slate-400 dark:text-white/30">
                Alterable tasks allow changing Scan Target and Config after scanning.
              </p>
            </div>

            {/* Auto Delete Reports */}
            <div>
              <label className={labelCls}>Auto Delete Reports</label>
              <div className="space-y-2.5">
                <div className="flex cursor-pointer items-center gap-2.5" onClick={() => setAutoDelete("no")}>
                  <span className="relative flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition"
                    style={{ borderColor: autoDelete === "no" ? currentColor : "#cbd5e1", backgroundColor: autoDelete === "no" ? currentColor : "transparent" }}>
                    {autoDelete === "no" && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </span>
                  <span className="text-[12px] font-medium text-slate-700 dark:text-white/70">Do not automatically delete reports</span>
                </div>
                <div className="flex cursor-pointer items-start gap-2.5" onClick={() => setAutoDelete("keep")}>
                  <span className="relative mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition"
                    style={{ borderColor: autoDelete === "keep" ? currentColor : "#cbd5e1", backgroundColor: autoDelete === "keep" ? currentColor : "transparent" }}>
                    {autoDelete === "keep" && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </span>
                  <div className="flex-1">
                    <span className="text-[12px] font-medium text-slate-700 dark:text-white/70">
                      Automatically delete oldest reports but always keep newest
                    </span>
                    {autoDelete === "keep" && (
                      <div className="mt-2 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <input type="number" min={1} max={99} value={autoDeleteData}
                          onChange={e => setAutoDeleteData(Math.max(1, Number(e.target.value) || 1))}
                          className={[numCls, "w-24"].join(" ")} />
                        <span className="text-[11.5px] text-slate-500 dark:text-white/45">reports</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Scanner & Config ── */}
            <SectionDivider label={isCVEScanner ? "Scanner" : "Scanner & Config"} />

            <div>
              <label className={labelCls}><FiTarget className="text-[10px]" />Scanner</label>
              <SearchDropdown dropRef={scannerRef} open={openScanner} setOpen={setOpenScanner}
                search={searchScanner} setSearch={setSearchScanner}
                selectedLabel={scanners.find(x => x.id === scannerId)?.name ?? ""}
                placeholder="Select scanner…" items={fScanner} selectedId={scannerId}
                onSelect={setScannerId} disabled={loadingData} />
            </div>

            {/* CVE scanner banner — explain why fields are hidden */}
            {isCVEScanner && (
              <div className="flex items-start gap-2.5 rounded-xl border border-cyan-200/60 bg-cyan-50/50 px-3.5 py-2.5 dark:border-cyan-500/20 dark:bg-cyan-500/8">
                <FiSettings className="mt-0.5 shrink-0 text-[12px] text-cyan-600 dark:text-cyan-400" />
                <p className="text-[11px] text-cyan-700 dark:text-cyan-300">
                  CVE Scanner uses the CVE database directly — Scan Config, Max NVTs per host and Max concurrent hosts are not applicable.
                </p>
              </div>
            )}

            {/* Scan Config — hidden for CVE scanner */}
            {!isCVEScanner && (
              <div>
                <label className={labelCls}><FiSettings className="text-[10px]" />Scan Config <span className="text-red-400">*</span></label>
                <SearchDropdown dropRef={configRef} open={openConfig} setOpen={setOpenConfig}
                  search={searchConfig} setSearch={setSearchConfig}
                  selectedLabel={configs.find(x => x.id === configId)?.name ?? ""}
                  placeholder="Select scan config…" items={fConfig} selectedId={configId}
                  onSelect={setConfigId} disabled={loadingData}
                  dropH="max-h-36" />
              </div>
            )}

            {/* ── Performance — hidden for CVE scanner ── */}
            {!isCVEScanner && <SectionDivider label="Performance" />}

            {!isCVEScanner && <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Max concurrent NVTs per host</label>
                <input type="number" min={1} max={99} value={maxChecks}
                  onChange={e => setMaxChecks(Math.max(1, Number(e.target.value) || 1))}
                  className={numCls} />
                <p className="mt-1 text-[10px] text-slate-400 dark:text-white/30">Default: 4</p>
              </div>
              <div>
                <label className={labelCls}>Max concurrent scanned hosts</label>
                <input type="number" min={1} max={999} value={maxHosts}
                  onChange={e => setMaxHosts(Math.max(1, Number(e.target.value) || 1))}
                  className={numCls} />
                <p className="mt-1 text-[10px] text-slate-400 dark:text-white/30">Default: 20</p>
              </div>
            </div>}

            {/* Error */}
            {formError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[11.5px] text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300">
                {formError}
              </div>
            )}

          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex shrink-0 gap-2.5 border-t border-slate-100 px-5 py-3.5 dark:border-white/8">
          <button type="button" onClick={handleClose}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 text-[12.5px] font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/8 dark:text-white/55 dark:hover:bg-white/5">
            {t("common.cancel")}
          </button>
          <button type="button" onClick={() => void handleCreate()} disabled={loading || loadingData}
            style={{ background: accentGrad }}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-[12.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-60">
            {loading && <FiRefreshCw className="animate-spin text-[12px]" />}
            <FiPlus className="text-[12px]" />Save
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

// ─────────────────────────────────────────────────────────────
// EditTaskModal — full OpenVAS fields
// New / Alterable tasks: all fields editable (dropdowns)
// Already-run + non-alterable: Target/Config/Scanner locked
// ─────────────────────────────────────────────────────────────

type EditTaskModalProps = {
  task: GMPTaskDTO | null;
  onClose: () => void;
  onSaved: () => void;
};

const EditTaskModal: React.FC<EditTaskModalProps> = ({ task, onClose, onSaved }) => {
  const { t } = useLanguage();
  const { currentColor } = useStateContext();
  const accentGrad = `linear-gradient(135deg, ${currentColor}, color-mix(in srgb, ${currentColor} 65%, #a855f7))`;

  // Is this task fully editable? (New status OR alterable=true)
  const isEditable = task?.status?.toLowerCase() === "new" || task?.alterable === true;

  // Basic fields (always editable)
  const [name,           setName]           = useState("");
  const [comment,        setComment]        = useState("");
  const [applyOverrides, setApplyOverrides] = useState(true);
  const [minQod,         setMinQod]         = useState(70);
  const [autoDelete,     setAutoDelete]     = useState<"no" | "keep">("no");
  const [autoDeleteData, setAutoDeleteData] = useState(5);
  const [maxChecks,      setMaxChecks]      = useState(8);
  const [maxHosts,       setMaxHosts]       = useState(20);

  // Fields only relevant when editable
  const [targetId,   setTargetId]   = useState("");
  const [configId,   setConfigId]   = useState("");
  const [scannerId,  setScannerId]  = useState("");
  const [alterable,  setAlterable]  = useState(false);
  const [addAssets,  setAddAssets]  = useState(true);

  const [loading,   setLoading]   = useState(false);
  const [formError, setFormError] = useState("");

  // Dropdown data (only loaded when isEditable)
  const [targets,     setTargets]     = useState<GMPTargetDTO[]>([]);
  const [configs,     setConfigs]     = useState<GMPConfigDTO[]>([]);
  const [scanners,    setScanners]    = useState<GMPScannerDTO[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  const [openTarget,  setOpenTarget]  = useState(false);
  const [openConfig,  setOpenConfig]  = useState(false);
  const [openScanner, setOpenScanner] = useState(false);
  const [searchTarget,  setSearchTarget]  = useState("");
  const [searchConfig,  setSearchConfig]  = useState("");
  const [searchScanner, setSearchScanner] = useState("");

  const targetRef  = useRef<HTMLDivElement | null>(null);
  const configRef  = useRef<HTMLDivElement | null>(null);
  const scannerRef = useRef<HTMLDivElement | null>(null);

  // CVE scanner detection
  const isCVEScanner = useMemo(() => {
    const sel = scanners.find(x => x.id === scannerId);
    return sel !== undefined && (
      (sel as GMPScannerDTO & { type?: number }).type === 3 ||
      sel.name.toLowerCase().includes("cve")
    );
  }, [scanners, scannerId]);

  // Pre-fill when task changes
  useEffect(() => {
    if (!task) return;
    setName(task.name);
    setComment(task.comment ?? "");
    setTargetId(task.target_id ?? "");
    setConfigId(task.config_id ?? "");
    setScannerId(task.scanner_id ?? "");
    setAlterable(task.alterable ?? false);
    setApplyOverrides(task.apply_overrides ?? true);
    setMinQod(task.min_qod ?? 70);
    setAutoDelete(task.auto_delete === "keep" ? "keep" : "no");
    setAutoDeleteData(task.auto_delete_data ?? 5);
    setMaxChecks(task.max_checks ?? 8);
    setMaxHosts(task.max_hosts ?? 20);
    setFormError("");
    setOpenTarget(false); setOpenConfig(false); setOpenScanner(false);
    setSearchTarget(""); setSearchConfig(""); setSearchScanner("");
  }, [task]);

  // Load dropdown data only when the task is fully editable
  useEffect(() => {
    if (!task || !isEditable) return;
    const load = async () => {
      setLoadingData(true);
      try {
        const [t2, c, s] = await Promise.all([ListGMPTargets(), ListGMPConfigs(), ListGMPScanners()]);
        setTargets(t2); setConfigs(c); setScanners(s);
      } catch { /* silent */ }
      finally { setLoadingData(false); }
    };
    void load();
  }, [task?.id, isEditable]);

  useEffect(() => {
    if (!isEditable) return;
    const handler = (e: MouseEvent) => {
      if (!targetRef.current?.contains(e.target as Node))  setOpenTarget(false);
      if (!configRef.current?.contains(e.target as Node))  setOpenConfig(false);
      if (!scannerRef.current?.contains(e.target as Node)) setOpenScanner(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isEditable]);

  const handleSave = async () => {
    if (!task) return;
    if (!name.trim()) { setFormError("Task name is required"); return; }
    if (minQod < 0 || minQod > 100) { setFormError("Min QoD must be 0–100"); return; }
    if (!isCVEScanner && maxChecks < 1) { setFormError("Max concurrent NVTs must be ≥ 1"); return; }
    if (!isCVEScanner && maxHosts < 1)  { setFormError("Max concurrent hosts must be ≥ 1"); return; }

    setLoading(true); setFormError("");
    try {
      await UpdateGMPTask(task.id, {
        name:             name.trim(),
        comment:          comment.trim(),
        // Editable fields — only sent when task is new/alterable
        ...(isEditable && { target_id:  targetId  || undefined }),
        ...(isEditable && !isCVEScanner && { config_id: configId || undefined }),
        ...(isEditable && { scanner_id: scannerId || undefined }),
        alterable:        alterable,
        add_assets:       addAssets,
        // Always editable
        apply_overrides:  applyOverrides,
        min_qod:          minQod,
        max_checks:       !isCVEScanner ? maxChecks : undefined,
        max_hosts:        !isCVEScanner ? maxHosts  : undefined,
        auto_delete:      autoDelete,
        auto_delete_data: autoDelete === "keep" ? autoDeleteData : undefined,
      });
      message.success("Task updated successfully");
      onSaved(); onClose();
    } catch (err: unknown) {
      setFormError(
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        || "Failed to update task"
      );
    } finally { setLoading(false); }
  };

  if (!task) return null;

  const inputCls = "h-9 w-full rounded-xl border border-slate-200/80 bg-white px-3 text-[12px] text-slate-800 placeholder:text-slate-400 outline-none transition focus:ring-2 focus:ring-cyan-200 focus:border-cyan-300 dark:border-white/10 dark:bg-white/5 dark:text-white/85 dark:placeholder:text-white/35 dark:focus:ring-white/10 dark:focus:border-cyan-400/30";
  const numCls   = "h-9 w-full rounded-xl border border-slate-200/80 bg-white px-3 text-[12px] text-slate-800 outline-none transition focus:ring-2 focus:ring-cyan-200 focus:border-cyan-300 dark:border-white/10 dark:bg-white/5 dark:text-white/85 dark:focus:ring-white/10 dark:focus:border-cyan-400/30";
  const labelCls = "mb-1.5 flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/35";

  // Locked read-only field (shown when !isEditable)
  const LockedField: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div>
      <label className={labelCls}>
        {label}
        <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[8.5px] font-bold uppercase text-slate-400 dark:bg-white/8 dark:text-white/30">locked</span>
      </label>
      <div className="flex h-9 w-full items-center rounded-xl border border-slate-200/60 bg-slate-50 px-3 dark:border-white/8 dark:bg-white/3">
        <span className="truncate text-[12px] text-slate-500 dark:text-white/40">{value || "—"}</span>
      </div>
    </div>
  );

  const fTarget  = searchTarget.trim()  ? targets.filter(x => x.name.toLowerCase().includes(searchTarget.toLowerCase()))  : targets;
  const fConfig  = searchConfig.trim()  ? configs.filter(x  => x.name.toLowerCase().includes(searchConfig.toLowerCase()))   : configs;
  const fScanner = searchScanner.trim() ? scanners.filter(x => x.name.toLowerCase().includes(searchScanner.toLowerCase()))  : scanners;

  return createPortal(
    <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[3px]" onClick={onClose} />
      <div className="relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white dark:bg-[#12101f]"
        style={{ maxHeight: "90vh", boxShadow: `0 24px 64px -12px ${currentColor}30, 0 8px 32px rgba(0,0,0,.25)` }}>

        {/* ── Header ── */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-white/8">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: accentGrad }}>
              <FiEdit2 className="text-[13px]" />
            </span>
            <div>
              <p className="text-[9.5px] font-bold uppercase tracking-widest" style={{ color: currentColor }}>SCAN MANAGEMENT · EDIT TASK</p>
              <h3 className="flex items-center gap-2 max-w-xs truncate text-[14px] font-bold text-slate-800 dark:text-white/90">
                {task.name}
                {isEditable
                  ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
                      {task.alterable ? "Alterable" : "New"}
                    </span>
                  : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500 dark:bg-white/8 dark:text-white/40">
                      Read-only config
                    </span>
                }
              </h3>
            </div>
          </div>
          <button type="button" onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 dark:text-white/35 dark:hover:bg-white/8">
            <FiX className="text-[15px]" />
          </button>
        </div>

        {/* ── Body (scrollable) ── */}
        <div className="overflow-y-auto px-5 py-4">
          <div className="space-y-4">

            {/* Task ID */}
            <div className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/60 px-3.5 py-2 dark:border-white/8 dark:bg-white/3">
              <span className="shrink-0 text-[9.5px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-white/30">Task ID</span>
              <span className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-slate-500 dark:text-white/40">{task.id}</span>
            </div>

            {/* ── Basic Info ── */}
            <SectionDivider label="Basic Info" />

            <div>
              <label className={labelCls}><FiType className="text-[10px]" />Name <span className="text-red-400">*</span></label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Task name" className={inputCls} />
            </div>

            <div>
              <label className={labelCls}><FiAlignLeft className="text-[10px]" />Comment (optional)</label>
              <input type="text" value={comment} onChange={e => setComment(e.target.value)} placeholder="e.g. IP address or description" className={inputCls} />
            </div>

            {/* ── Scan Configuration ── */}
            <SectionDivider label={isEditable ? "Scan Configuration" : "Scan Configuration"} />

            {isEditable ? (
              /* Fully editable dropdowns — like OpenVAS when task is New or Alterable */
              <>
                <div>
                  <label className={labelCls}><FiTarget className="text-[10px]" />Scan Target <span className="text-red-400">*</span></label>
                  <SearchDropdown dropRef={targetRef} open={openTarget} setOpen={setOpenTarget}
                    search={searchTarget} setSearch={setSearchTarget}
                    selectedLabel={targets.find(x => x.id === targetId)?.name ?? task.target_name}
                    placeholder="Select a target…" items={fTarget} selectedId={targetId}
                    onSelect={setTargetId} disabled={loadingData} />
                </div>

                <div>
                  <label className={labelCls}><FiTarget className="text-[10px]" />Scanner</label>
                  <SearchDropdown dropRef={scannerRef} open={openScanner} setOpen={setOpenScanner}
                    search={searchScanner} setSearch={setSearchScanner}
                    selectedLabel={scanners.find(x => x.id === scannerId)?.name ?? task.scanner_name}
                    placeholder="Select scanner…" items={fScanner} selectedId={scannerId}
                    onSelect={setScannerId} disabled={loadingData} />
                </div>

                {isCVEScanner && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-cyan-200/60 bg-cyan-50/50 px-3.5 py-2.5 dark:border-cyan-500/20 dark:bg-cyan-500/8">
                    <FiSettings className="mt-0.5 shrink-0 text-[12px] text-cyan-600 dark:text-cyan-400" />
                    <p className="text-[11px] text-cyan-700 dark:text-cyan-300">
                      CVE Scanner — Scan Config, Max NVTs and Max hosts are not applicable.
                    </p>
                  </div>
                )}

                {!isCVEScanner && (
                  <div>
                    <label className={labelCls}><FiSettings className="text-[10px]" />Scan Config <span className="text-red-400">*</span></label>
                    <SearchDropdown dropRef={configRef} open={openConfig} setOpen={setOpenConfig}
                      search={searchConfig} setSearch={setSearchConfig}
                      selectedLabel={configs.find(x => x.id === configId)?.name ?? task.config_name}
                      placeholder="Select scan config…" items={fConfig} selectedId={configId}
                      onSelect={setConfigId} disabled={loadingData} dropH="max-h-36" />
                  </div>
                )}
              </>
            ) : (
              /* Locked read-only fields — task has been run and is NOT alterable */
              <>
                <LockedField label="Scan Targets" value={task.target_name} />
                {task.scanner_name && <LockedField label="Scanner" value={task.scanner_name} />}
                {task.config_name  && <LockedField label="Scan Config" value={task.config_name} />}
                <p className="text-[10.5px] text-slate-400 dark:text-white/30">
                  Set <strong>Alterable Task = Yes</strong> below to unlock Scan Target, Scanner and Config for editing.
                </p>
              </>
            )}

            {/* ── Scan Options ── */}
            <SectionDivider label="Scan Options" />

            {/* Add results to Assets */}
            <div>
              <label className={labelCls}>Add results to Assets</label>
              <YesNoRadio value={addAssets} onChange={setAddAssets} currentColor={currentColor} />
            </div>

            {/* Apply Overrides */}
            <div>
              <label className={labelCls}>Apply Overrides</label>
              <YesNoRadio value={applyOverrides} onChange={setApplyOverrides} currentColor={currentColor} />
              <p className="mt-1 text-[10.5px] text-slate-400 dark:text-white/30">
                Use overrides to change the severity of scan results.
              </p>
            </div>

            {/* Min QoD */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className={labelCls + " mb-0"}>Min QoD</label>
                <span className="text-[11px] font-bold tabular-nums" style={{ color: currentColor }}>{minQod}%</span>
              </div>
              <input type="range" min={0} max={100} step={1} value={minQod}
                onChange={e => setMinQod(Number(e.target.value))}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 dark:bg-white/15"
                style={{ accentColor: currentColor }} />
              <div className="mt-1 flex justify-between text-[9.5px] text-slate-400 dark:text-white/30">
                <span>0% (all)</span>
                <span>Only include results with QoD ≥ {minQod}%</span>
                <span>100%</span>
              </div>
              <div className="mt-2">
                <input type="number" min={0} max={100} value={minQod}
                  onChange={e => setMinQod(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                  className={numCls} />
              </div>
            </div>

            {/* Alterable Task */}
            <div>
              <label className={labelCls}>Alterable Task</label>
              <YesNoRadio value={alterable} onChange={setAlterable} currentColor={currentColor} />
              <p className="mt-1 text-[10.5px] text-slate-400 dark:text-white/30">
                Alterable tasks allow changing Scan Target and Config after scanning.
              </p>
            </div>

            {/* Auto Delete Reports */}
            <div>
              <label className={labelCls}>Auto Delete Reports</label>
              <div className="space-y-2.5">
                <div className="flex cursor-pointer items-center gap-2.5" onClick={() => setAutoDelete("no")}>
                  <span className="relative flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition"
                    style={{ borderColor: autoDelete === "no" ? currentColor : "#cbd5e1", backgroundColor: autoDelete === "no" ? currentColor : "transparent" }}>
                    {autoDelete === "no" && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </span>
                  <span className="text-[12px] font-medium text-slate-700 dark:text-white/70">Do not automatically delete reports</span>
                </div>
                <div className="flex cursor-pointer items-start gap-2.5" onClick={() => setAutoDelete("keep")}>
                  <span className="relative mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition"
                    style={{ borderColor: autoDelete === "keep" ? currentColor : "#cbd5e1", backgroundColor: autoDelete === "keep" ? currentColor : "transparent" }}>
                    {autoDelete === "keep" && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </span>
                  <div className="flex-1">
                    <span className="text-[12px] font-medium text-slate-700 dark:text-white/70">
                      Automatically delete oldest reports but always keep newest
                    </span>
                    {autoDelete === "keep" && (
                      <div className="mt-2 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <input type="number" min={1} max={99} value={autoDeleteData}
                          onChange={e => setAutoDeleteData(Math.max(1, Number(e.target.value) || 1))}
                          className={[numCls, "w-24"].join(" ")} />
                        <span className="text-[11.5px] text-slate-500 dark:text-white/45">reports</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Scanner (when not editable) + Scan Config ── */}
            {!isEditable && (
              <>
                <SectionDivider label="Scanner & Config (locked)" />
                {task.scanner_name && <LockedField label="Scanner" value={task.scanner_name} />}
                {task.config_name  && <LockedField label="Scan Config" value={task.config_name} />}
              </>
            )}

            {/* ── Performance — hidden for CVE scanner ── */}
            {!isCVEScanner && (
              <>
                <SectionDivider label="Performance" />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Max concurrent NVTs per host</label>
                    <input type="number" min={1} max={99} value={maxChecks}
                      onChange={e => setMaxChecks(Math.max(1, Number(e.target.value) || 1))}
                      className={numCls} />
                    <p className="mt-1 text-[10px] text-slate-400 dark:text-white/30">Default: 8</p>
                  </div>
                  <div>
                    <label className={labelCls}>Max concurrent scanned hosts</label>
                    <input type="number" min={1} max={999} value={maxHosts}
                      onChange={e => setMaxHosts(Math.max(1, Number(e.target.value) || 1))}
                      className={numCls} />
                    <p className="mt-1 text-[10px] text-slate-400 dark:text-white/30">Default: 20</p>
                  </div>
                </div>
              </>
            )}

            {/* ── Current State ── */}
            <SectionDivider label="Current State" />

            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Status",     val: task.status || "—" },
                { label: "Reports",    val: String(task.report_count) },
                { label: "Severity",   val: task.severity > 0 ? task.severity.toFixed(1) : "0.0 (Log)" },
              ].map(({ label, val }) => (
                <div key={label} className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5 dark:border-white/8 dark:bg-white/3">
                  <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/30">{label}</p>
                  <p className="mt-0.5 text-[12px] font-semibold text-slate-700 dark:text-white/70">{val}</p>
                </div>
              ))}
            </div>

            {/* Error */}
            {formError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[11.5px] text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300">
                {formError}
              </div>
            )}

          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex shrink-0 gap-2.5 border-t border-slate-100 px-5 py-3.5 dark:border-white/8">
          <button type="button" onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 text-[12.5px] font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/8 dark:text-white/55 dark:hover:bg-white/5">
            {t("common.cancel")}
          </button>
          <button type="button" onClick={() => void handleSave()} disabled={loading || (isEditable && loadingData)}
            style={{ background: accentGrad }}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-[12.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-60">
            {loading && <FiRefreshCw className="animate-spin text-[12px]" />}
            <FiCheck className="text-[12px]" />Save Changes
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

// ─────────────────────────────────────────────────────────────
// Chart: Tasks by Status (Donut)
// ─────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  done:            "#3b82f6",  // blue  — Done
  running:         "#10b981",  // emerald — Running
  requested:       "#94a3b8",  // slate  — Starting
  "stop requested":"#94a3b8",  // slate  — Stopping
  stopped:         "#f87171",  // red    — Stopped
  interrupted:     "#f87171",  // red    — Interrupted
  new:             "#fbbf24",  // amber  — New
  other:           "#cbd5e1",  // grey
};

const StatusTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ payload?: { name: string; value: number; color: string } }>;
}> = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="rounded-xl px-3 py-2 text-[10.5px] font-semibold text-white shadow-xl" style={{ background: d.color }}>
      {d.name} · <span className="tabular-nums">{d.value}</span>
    </div>
  );
};

const TasksByStatusChart: React.FC<{ tasks: GMPTaskDTO[]; loading: boolean }> = ({ tasks, loading }) => {
  const data = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of tasks) {
      const key = t.status?.toLowerCase() ?? "other";
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value, color: STATUS_COLORS[name] ?? STATUS_COLORS.other }))
      .sort((a, b) => b.value - a.value);
  }, [tasks]);

  const total = tasks.length;

  return (
    <div className="flex h-full flex-col">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-white/40">
        Tasks by Status <span className="ml-1 font-bold text-slate-700 dark:text-white/70">(Total: {total})</span>
      </p>
      <div className="flex flex-1 items-center gap-5">
        <div className="relative h-36 w-36 shrink-0">
          {loading ? (
            <div className="h-full w-full animate-pulse rounded-full bg-slate-100 dark:bg-white/10" />
          ) : total === 0 ? (
            <div className="flex h-full w-full items-center justify-center rounded-full border-2 border-dashed border-slate-200 dark:border-white/10">
              <span className="text-[10px] text-slate-400 dark:text-white/30">No data</span>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="84%" paddingAngle={2} stroke="transparent">
                    {data.map(e => <Cell key={e.name} fill={e.color} />)}
                  </Pie>
                  <Tooltip content={<StatusTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[24px] font-bold leading-none text-slate-900 dark:text-white">{total}</span>
                <span className="mt-0.5 text-[9px] text-slate-400 dark:text-white/35">tasks</span>
              </div>
            </>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          {loading
            ? [1,2,3].map(i => <div key={i} className="h-5 animate-pulse rounded-lg bg-slate-100 dark:bg-white/10" />)
            : data.map(d => (
                <div key={d.name} className="flex items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: d.color }} />
                  <span className="min-w-0 flex-1 truncate text-[11px] text-slate-600 dark:text-white/60">{d.name}</span>
                  <span className="shrink-0 text-[12px] font-bold tabular-nums text-slate-800 dark:text-white/80">{d.value}</span>
                </div>
              ))
          }
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Chart: Tasks by Severity Class (Bar)
// ─────────────────────────────────────────────────────────────

const SEV_CLASSES = [
  { name: "Log",      min: 0,   max: 0,   exact: true,  color: "#6b7280" },
  { name: "Low",      min: 0.1, max: 3.9, exact: false, color: "#22c55e" },
  { name: "Medium",   min: 4,   max: 6.9, exact: false, color: "#eab308" },
  { name: "High",     min: 7,   max: 8.9, exact: false, color: "#f97316" },
  { name: "Critical", min: 9,   max: 10,  exact: false, color: "#ef4444" },
];

const SevBarTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ payload?: { name: string; count: number; color: string } }>;
}> = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="rounded-xl px-3 py-2 text-[10.5px] font-semibold text-white shadow-xl" style={{ background: d.color }}>
      {d.name} · <span className="tabular-nums">{d.count} task{d.count !== 1 ? "s" : ""}</span>
    </div>
  );
};

const TasksBySeverityChart: React.FC<{ tasks: GMPTaskDTO[]; loading: boolean }> = ({ tasks, loading }) => {
  const data = useMemo(() =>
    SEV_CLASSES.map(cls => ({
      name: cls.name,
      count: tasks.filter(t => cls.exact ? t.severity === 0 : t.severity >= cls.min && t.severity <= cls.max).length,
      color: cls.color,
    })),
  [tasks]);

  return (
    <div className="flex h-full flex-col">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-white/40">Tasks by Severity Class</p>
      {loading ? (
        <div className="flex flex-1 items-end gap-2 pb-2">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="flex-1 animate-pulse rounded-t-lg bg-slate-100 dark:bg-white/10" style={{ height: `${20 + i * 12}%` }} />
          ))}
        </div>
      ) : (
        <div className="flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barCategoryGap="32%" margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "rgba(100,116,139,0.9)" }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "rgba(100,116,139,0.9)" }} axisLine={false} tickLine={false} />
              <Tooltip content={<SevBarTooltip />} cursor={{ fill: "rgba(148,163,184,0.08)" }} />
              <Bar dataKey="count" radius={[5, 5, 0, 0]}>
                {data.map(e => <Cell key={e.name} fill={e.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Sort icon — ▲▼ / active single arrow
// ─────────────────────────────────────────────────────────────

type SortCol = "status" | "reports" | "last_report" | "severity" | "trend";

const SortIcon: React.FC<{ active: boolean; dir: "asc" | "desc" }> = ({ active, dir }) => (
  <span className="ml-1 inline-flex flex-col leading-0">
    <span className={`text-[7px] leading-none ${active && dir === "asc" ? "opacity-100" : "opacity-25"}`}>▲</span>
    <span className={`text-[7px] leading-none ${active && dir === "desc" ? "opacity-100" : "opacity-25"}`}>▼</span>
  </span>
);

// ─────────────────────────────────────────────────────────────
// StatusCell — matches OpenVAS style
// ─────────────────────────────────────────────────────────────

const StatusCell: React.FC<{ status: string; progress: number }> = ({ status, progress }) => {
  const sl = status?.toLowerCase() ?? "";

  if (sl === "requested") {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-white/45">
        <FiRefreshCw className="animate-spin text-[9px]" />
        Starting…
      </span>
    );
  }

  if (sl === "stop requested") {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-white/45">
        <FiRefreshCw className="animate-spin text-[9px]" />
        Stopping…
      </span>
    );
  }

  if (sl === "running") {
    return (
      <div className="space-y-1.5">
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          Running {progress}%
        </span>
        <div className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${Math.max(2, Math.min(100, progress))}%`,
              background: "linear-gradient(90deg, #10b981, #34d399, #10b981)",
              backgroundSize: "200% 100%",
              animation: "scanPulse 2s linear infinite",
            }}
          />
        </div>
      </div>
    );
  }

  if (sl === "stopped" || sl === "interrupted") {
    return (
      <div className="space-y-1.5">
        <span className="inline-flex whitespace-nowrap items-center rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-[10px] font-semibold text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
          Stopped at {progress}%
        </span>
        <div className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
          <div
            className="h-full rounded-full bg-red-300 dark:bg-red-500/50 transition-all duration-500"
            style={{ width: `${Math.max(1, Math.min(100, progress))}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <span className={`inline-flex w-fit whitespace-nowrap items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${getTaskStatusBg(status)}`}>
      {status || "—"}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────
// Task Table Row — icon-only actions
// ─────────────────────────────────────────────────────────────

type TaskRowProps = {
  task: GMPTaskDTO;
  onStart:  (id: string) => Promise<void>;
  onStop:   (id: string) => Promise<void>;
  onEdit:   (task: GMPTaskDTO) => void;
  onDelete: (id: string, name: string) => void;
};

// Format "2026-05-19T17:28:11+07:00" → "19 May 2026 17:28"
function fmtLastReport(raw: string): string {
  if (!raw) return "—";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    + " " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

const TaskRow: React.FC<TaskRowProps> = ({ task, onStart, onStop, onEdit, onDelete }) => {
  const [startBusy, setStartBusy] = useState(false);
  const [stopBusy,  setStopBusy]  = useState(false);

  const statusLower = task.status?.toLowerCase() ?? "";
  // "requested" = OpenVAS accepted the start command, not yet scanning
  // "stop requested" = OpenVAS accepted the stop command, not yet stopped
  const isRequested     = statusLower === "requested";
  const isStopRequested = statusLower === "stop requested";
  const isRunning       = statusLower === "running" || isRequested;
  const isTransitioning = isRequested || isStopRequested;
  const isDone          = statusLower === "done";
  const isStopped       = statusLower === "stopped" || statusLower === "interrupted";
  const isActive        = isRunning || isStopRequested; // any "in-flight" state

  const handleStart = async () => {
    setStartBusy(true);
    try { await onStart(task.id); }
    finally { setStartBusy(false); }
  };
  const handleStop = async () => {
    setStopBusy(true);
    try { await onStop(task.id); }
    finally { setStopBusy(false); }
  };

  const iconBtn = "grid h-7 w-7 place-items-center rounded-lg border transition";

  return (
    <tr className="border-b border-slate-100 transition-colors hover:bg-slate-50/70 dark:border-white/6 dark:hover:bg-white/3">

      {/* Name + Comment */}
      <td className="px-4 py-3.5">
        <p className="text-[12.5px] font-semibold text-slate-800 dark:text-white/88">{task.name}</p>
        {task.comment && (
          <p className="mt-0.5 text-[10.5px] text-slate-400 dark:text-white/35">({task.comment})</p>
        )}
      </td>

      {/* Type icon */}
      <td className="px-4 py-3.5">
        <div className="flex justify-center">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-slate-100 dark:bg-white/8">
            <FiTarget className="text-[13px] text-slate-500 dark:text-white/45" />
          </div>
        </div>
      </td>

      {/* Status */}
      <td className="px-4 py-3.5">
        <StatusCell status={task.status} progress={task.progress} />
      </td>

      {/* Reports */}
      <td className="px-4 py-3.5">
        <span className="text-[12px] font-medium tabular-nums text-slate-600 dark:text-white/60">
          {task.report_count}
        </span>
      </td>

      {/* Last Report */}
      <td className="px-4 py-3.5">
        <span className="whitespace-nowrap text-[11px] text-slate-500 dark:text-white/40">
          {fmtLastReport(task.last_report_at)}
        </span>
      </td>

      {/* Severity */}
      <td className="px-4 py-3.5">
        <SeverityBadge score={task.severity} />
      </td>

      {/* Trend */}
      <td className="px-4 py-3.5">
        {isActive || isTransitioning
          ? <FiActivity className="text-[14px] animate-pulse text-cyan-500" />
          : isDone && task.severity > 0
            ? <FiTrendingUp className="text-[14px] text-emerald-500" />
            : isStopped
              ? <FiMinus className="text-[14px] text-slate-400 dark:text-white/30" />
              : <FiMinus className="text-[14px] text-slate-300 dark:text-white/20" />
        }
      </td>

      {/* Actions */}
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-1">
          {/* Stop — shown when running or requested (not stop-requested, that's already stopping) */}
          {isRunning && !isStopRequested ? (
            <button type="button" title="Stop scan" onClick={() => void handleStop()}
              disabled={stopBusy || isRequested}
              className={`${iconBtn} border-orange-200 bg-orange-50 text-orange-600 hover:bg-orange-100 disabled:opacity-50 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-300`}>
              {stopBusy ? <FiRefreshCw className="animate-spin text-[11px]" /> : <FiStopCircle className="text-[12px]" />}
            </button>
          ) : isStopRequested ? (
            /* Waiting to stop — show a disabled spinner */
            <button type="button" disabled
              className={`${iconBtn} border-slate-200 bg-slate-50 text-slate-400 opacity-60 cursor-not-allowed dark:border-white/10 dark:bg-white/5`}>
              <FiRefreshCw className="animate-spin text-[11px]" />
            </button>
          ) : (
            /* Idle — Start / Re-run */
            <button type="button"
              title={isDone || isStopped ? "Re-run" : "Start"}
              onClick={() => void handleStart()}
              disabled={startBusy}
              className={[iconBtn, isDone || isStopped
                ? "border-violet-200 bg-violet-50 text-violet-600 hover:bg-violet-100 disabled:opacity-50 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-300"
                : "border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"].join(" ")}>
              {startBusy ? <FiRefreshCw className="animate-spin text-[11px]" /> : <FiPlay className="text-[11px]" />}
            </button>
          )}

          {/* Edit — disabled while task is in any active/transitioning state */}
          <button type="button" title="Edit task" onClick={() => onEdit(task)}
            disabled={isActive || isTransitioning}
            className={`${iconBtn} border-slate-200 bg-white text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-white/50 dark:hover:bg-white/10`}>
            <FiEdit2 className="text-[11px]" />
          </button>

          {/* Delete — disabled while task is in any active/transitioning state */}
          <button type="button" title="Delete task" onClick={() => onDelete(task.id, task.name)}
            disabled={isActive || isTransitioning || stopBusy || startBusy}
            className={`${iconBtn} border-red-200 bg-red-50 text-red-500 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300`}>
            <FiTrash2 className="text-[11px]" />
          </button>
        </div>
      </td>
    </tr>
  );
};

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────

const ICON_COLOR: Record<string, string> = {
  violet: "#8b5cf6", cyan: "#06b6d4", emerald: "#10b981", orange: "#f97316",
};

const ScanManagement: React.FC = () => {
  const { t } = useLanguage();
  const { currentColor } = useStateContext();
  const accentGrad = `linear-gradient(135deg, ${currentColor}, color-mix(in srgb, ${currentColor} 65%, #a855f7))`;

  const [gmpStatus,      setGmpStatus]      = useState<GMPStatusResponse | null>(null);
  const [tasks,          setTasks]          = useState<GMPTaskDTO[]>([]);
  const [loadingStatus,  setLoadingStatus]  = useState(true);
  const [loadingTasks,   setLoadingTasks]   = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [activeTab,      setActiveTab]      = useState<"tasks" | "schedule">("tasks");
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [editTask,       setEditTask]       = useState<GMPTaskDTO | null>(null);

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsAgo,  setSecondsAgo]  = useState(0);
  const pollingRef          = useRef<ReturnType<typeof setInterval> | null>(null);
  const aggressiveRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const aggressiveCountRef  = useRef(0);
  const clockRef            = useRef<ReturnType<typeof setInterval> | null>(null);

  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  const [schedules,         setSchedules]         = useState<AutoScanScheduleDTO[]>([]);
  const [loadingSchedules,  setLoadingSchedules]  = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [schedForm, setSchedForm] = useState<{
    taskId: string; frequency: ScheduleFrequency;
    time: string; date: string; dayOfMonth: number; month: number; day: number;
  }>({ taskId: "", frequency: "once", time: "02:00", date: "", dayOfMonth: 1, month: 1, day: 1 });

  const [taskDropOpen,  setTaskDropOpen]  = useState(false);
  const [taskSearch,    setTaskSearch]    = useState("");
  const [monthDropOpen, setMonthDropOpen] = useState(false);
  const taskDropRef  = useRef<HTMLDivElement | null>(null);
  const monthDropRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!taskDropRef.current?.contains(e.target as Node))  setTaskDropOpen(false);
      if (!monthDropRef.current?.contains(e.target as Node)) setMonthDropOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredTasksForModal = useMemo(() => {
    const kw = taskSearch.trim().toLowerCase();
    return kw ? tasks.filter(tk => tk.name.toLowerCase().includes(kw)) : tasks;
  }, [tasks, taskSearch]);

  const fetchSchedules = useCallback(async () => {
    setLoadingSchedules(true);
    setSchedules(await ListScanSchedules());
    setLoadingSchedules(false);
  }, []);

  const closeScheduleModal = useCallback(() => {
    setShowScheduleModal(false); setTaskDropOpen(false); setTaskSearch(""); setMonthDropOpen(false);
  }, []);

  const hasFetched = useRef(false);

  const fetchTasksSilent = useCallback(async () => {
    try { setTasks(await ListGMPTasks()); setLastUpdated(new Date()); setSecondsAgo(0); } catch { /* silent */ }
  }, []);

  /* Aggressive polling: poll every 2s for up to 20 iterations (40s) after start/stop */
  const startAggressivePolling = useCallback(() => {
    if (aggressiveRef.current) { clearInterval(aggressiveRef.current); aggressiveRef.current = null; }
    aggressiveCountRef.current = 0;
    aggressiveRef.current = setInterval(() => {
      void fetchTasksSilent();
      aggressiveCountRef.current += 1;
      if (aggressiveCountRef.current >= 20) {
        if (aggressiveRef.current) { clearInterval(aggressiveRef.current); aggressiveRef.current = null; }
      }
    }, 2000);
  }, [fetchTasksSilent]);

  const fetchAll = useCallback(async () => {
    setLoadingStatus(true); setLoadingTasks(true);
    await Promise.all([
      GetGMPStatus().then(r => { setGmpStatus(r); setLoadingStatus(false); }),
      ListGMPTasks().then(r => { setTasks(r); setLoadingTasks(false); }).catch(() => { setTasks([]); setLoadingTasks(false); }),
    ]);
  }, []);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    void fetchAll().then(() => { setLastUpdated(new Date()); setSecondsAgo(0); });
    void fetchSchedules();
  }, [fetchAll, fetchSchedules]);

  useEffect(() => {
    const ACTIVE_STATUSES = ["running", "requested", "stop requested"];
    const hasActive = tasks.some(t => ACTIVE_STATUSES.includes(t.status?.toLowerCase() ?? ""));
    if (hasActive) {
      if (!pollingRef.current) pollingRef.current = setInterval(() => { void fetchTasksSilent(); }, 4000);
    } else {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    }
    return () => { if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; } };
  }, [tasks, fetchTasksSilent]);

  useEffect(() => {
    clockRef.current = setInterval(() => setSecondsAgo(p => p + 1), 1000);
    return () => {
      if (clockRef.current) clearInterval(clockRef.current);
      if (aggressiveRef.current) { clearInterval(aggressiveRef.current); aggressiveRef.current = null; }
    };
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true); await fetchAll();
    setLastUpdated(new Date()); setSecondsAgo(0); setRefreshing(false);
  };

  const handleStart = async (id: string) => {
    try {
      await StartGMPTask(id);
      message.success("Scan started");
      // Optimistic: show "Requested" immediately while OpenVAS initialises
      setTasks(prev => prev.map(t => t.id === id ? { ...t, status: "Requested", progress: 0 } : t));
      startAggressivePolling();
    } catch (err: unknown) {
      message.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to start scan");
    }
  };

  const handleStop = async (id: string) => {
    try {
      await StopGMPTask(id);
      message.success("Scan stopped");
      // Optimistic: show "Stop Requested" immediately
      setTasks(prev => prev.map(t => t.id === id ? { ...t, status: "Stop Requested" } : t));
      startAggressivePolling();
    } catch (err: unknown) {
      message.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to stop scan");
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteConfirm) return;
    const { id } = deleteConfirm;
    setDeleteConfirm(null);
    try { await DeleteGMPTask(id); message.success("Task deleted"); await fetchTasksSilent(); }
    catch (err: unknown) { message.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to delete task"); }
  };

  const handleAddSchedule = useCallback(async () => {
    const task = tasks.find(t2 => t2.id === schedForm.taskId);
    if (!task) { message.warning(t("scan.selectTask")); return; }
    if (schedForm.frequency === "once" && !schedForm.date) { message.warning(t("scan.selectDate")); return; }
    try {
      await CreateScanSchedule({
        task_id: schedForm.taskId, task_name: task.name, frequency: schedForm.frequency, scan_time: schedForm.time,
        schedule_at:  schedForm.frequency === "once"    ? schedForm.date       : undefined,
        day_of_month: schedForm.frequency === "monthly" ? schedForm.dayOfMonth : undefined,
        month:        schedForm.frequency === "yearly"  ? schedForm.month      : undefined,
        day:          schedForm.frequency === "yearly"  ? schedForm.day        : undefined,
      });
      message.success(t("scan.scheduleCreated"));
      closeScheduleModal();
      setSchedForm({ taskId: "", frequency: "once", time: "02:00", date: "", dayOfMonth: 1, month: 1, day: 1 });
      void fetchSchedules();
    } catch { message.error(t("common.noResults")); }
  }, [schedForm, tasks, fetchSchedules, t, closeScheduleModal]);

  const toggleSchedule = useCallback(async (id: number, enabled: boolean) => {
    try { await UpdateScanSchedule(id, !enabled); void fetchSchedules(); }
    catch { message.error(t("common.noResults")); }
  }, [fetchSchedules, t]);

  const deleteSchedule = useCallback(async (id: number) => {
    try { await DeleteScanSchedule(id); message.success(t("scan.scheduleDeleted")); void fetchSchedules(); }
    catch { message.error(t("common.noResults")); }
  }, [fetchSchedules, t]);

  const ACTIVE_STATUSES = ["running", "requested", "stop requested"];
  const runningCount = tasks.filter(t => ["running", "requested"].includes(t.status?.toLowerCase() ?? "")).length;
  const doneCount    = tasks.filter(t => t.status?.toLowerCase() === "done").length;
  const stoppedCount = tasks.filter(t => ["stopped","interrupted"].includes(t.status?.toLowerCase() ?? "")).length;
  const hasRunning   = tasks.some(t => ACTIVE_STATUSES.includes(t.status?.toLowerCase() ?? ""));

  // ── Sorting ──────────────────────────────────────────────────
  const [sortBy,  setSortBy]  = useState<SortCol | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleSort = (col: SortCol) => {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("asc"); }
  };

  const sortedTasks = useMemo(() => {
    if (!sortBy) return tasks;
    return [...tasks].sort((a, b) => {
      let cmp = 0;
      const sl = (t: GMPTaskDTO) => t.status?.toLowerCase() ?? "";
      // status priority: Running > New > Done > Stopped > Interrupted
      const statusPriority = (t: GMPTaskDTO) => {
        switch (sl(t)) {
          case "running":     return 4;
          case "new":         return 3;
          case "done":        return 2;
          case "stopped":     return 1;
          case "interrupted": return 0;
          default:            return -1;
        }
      };
      switch (sortBy) {
        case "status":
          cmp = statusPriority(a) - statusPriority(b);
          break;
        case "reports":
          cmp = a.report_count - b.report_count;
          break;
        case "last_report":
          cmp = (a.last_report_at ?? "").localeCompare(b.last_report_at ?? "");
          break;
        case "severity":
          cmp = a.severity - b.severity;
          break;
        case "trend":
          // sort by severity desc for done tasks; running last
          cmp = (sl(a) === "running" ? -1 : a.severity) - (sl(b) === "running" ? -1 : b.severity);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [tasks, sortBy, sortDir]);

  const statCards = [
    { label: "Total Tasks", val: tasks.length,  icon: <FiSettings />,    color: "violet"  },
    { label: "Running",     val: runningCount,   icon: <FiPlay />,        color: "cyan"    },
    { label: "Done",        val: doneCount,      icon: <FiCheckCircle />, color: "emerald" },
    { label: "Stopped",     val: stoppedCount,   icon: <FiStopCircle />,  color: "orange"  },
  ];

  const lastUpdatedLabel = useMemo(() => {
    if (!lastUpdated) return null;
    if (secondsAgo < 5)  return "just now";
    if (secondsAgo < 60) return `${secondsAgo}s ago`;
    return `${Math.floor(secondsAgo / 60)}m ago`;
  }, [lastUpdated, secondsAgo]);

  const inputCls = "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[12.5px] text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 dark:border-white/8 dark:bg-white/5 dark:text-white/80 dark:focus:ring-blue-500/10";

  return (
    <div className="w-full space-y-5">

      {/* ── Header ── */}
      <div className="relative overflow-hidden rounded-[18px] bg-white/95 p-4 shadow-sm backdrop-blur sm:rounded-[22px] sm:p-6 dark:bg-[#0d0b1a]/90"
        style={{ border: `1px solid ${currentColor}30` }}>
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-12 right-10 h-40 w-40 rounded-full blur-3xl" style={{ backgroundColor: `${currentColor}1e` }} />
          <div className="absolute -bottom-12 left-10 h-40 w-40 rounded-full blur-3xl" style={{ backgroundColor: `${currentColor}14` }} />
        </div>
        <div className="relative z-10 flex items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg sm:h-13 sm:w-13"
              style={{ background: accentGrad, boxShadow: `0 8px 24px -6px ${currentColor}50` }}>
              <FiSettings className="text-[20px] sm:text-[22px]" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] sm:text-[10.5px]" style={{ color: currentColor }}>
                THREAT INTELLIGENCE · SCANNER
              </p>
              <h1 className="flex items-center gap-2 truncate text-[18px] font-bold text-slate-900 sm:text-[20px] dark:text-white/90">
                {t("scan.title")}
                {hasRunning && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/15 px-2 py-0.5 text-[9.5px] font-bold text-cyan-600 dark:text-cyan-400">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-500 opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-500" />
                    </span>
                    LIVE
                  </span>
                )}
              </h1>
              {lastUpdatedLabel && (
                <p className="mt-0.5 text-[10.5px] text-slate-400 dark:text-white/30">
                  Updated {lastUpdatedLabel}
                  {hasRunning && <span className="ml-1 text-cyan-500">· auto-refreshing</span>}
                </p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <GMPStatusBadge status={gmpStatus} loading={loadingStatus} />
            <button type="button" onClick={() => void handleRefresh()} disabled={refreshing}
              className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200/70 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-60 dark:border-white/8 dark:bg-white/5 dark:text-white/50"
              title={t("common.refresh")}>
              <FiRefreshCw className={`text-[13px] ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ── GMP offline ── */}
      {!loadingStatus && (!gmpStatus || !gmpStatus.connected) && (
        <div className="flex items-start gap-2.5 rounded-xl border border-slate-200/70 bg-slate-50 p-3.5 dark:border-white/8 dark:bg-white/3">
          <FiAlertTriangle className="mt-0.5 shrink-0 text-[13px] text-slate-500 dark:text-white/40" />
          <div>
            <p className="text-[12px] font-semibold text-slate-700 dark:text-white/70">Cannot connect to OpenVAS GMP</p>
            <p className="mt-0.5 text-[11px] text-slate-400 dark:text-white/35">
              {gmpStatus?.error || "Backend cannot reach gvmd socket."}
            </p>
          </div>
        </div>
      )}

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statCards.map(({ label, val, icon, color }) => (
          <div key={label} className="rounded-xl border border-slate-200/70 bg-white px-5 py-4 dark:border-white/8 dark:bg-[#0d0b1a]/80">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium tracking-wide text-slate-500 dark:text-white/45">{label}</p>
              <span style={{ color: ICON_COLOR[color] }} className="text-[15px] opacity-75">{icon}</span>
            </div>
            <p className="mt-2.5 text-[30px] font-bold leading-none tracking-tight text-slate-900 dark:text-white">
              {loadingTasks
                ? <span className="inline-block h-8 w-10 animate-pulse rounded-lg bg-slate-100 dark:bg-white/10" />
                : val}
            </p>
            {label === "Running" && runningCount > 0 && (
              <p className="mt-1 text-[9.5px] font-semibold text-cyan-500">scanning now</p>
            )}
          </div>
        ))}
      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="min-h-50 rounded-xl border border-slate-200/70 bg-white p-5 dark:border-white/8 dark:bg-[#0d0b1a]/80">
          <TasksByStatusChart tasks={tasks} loading={loadingTasks} />
        </div>
        <div className="min-h-50 rounded-xl border border-slate-200/70 bg-white p-5 dark:border-white/8 dark:bg-[#0d0b1a]/80">
          <TasksBySeverityChart tasks={tasks} loading={loadingTasks} />
        </div>
      </div>

      {/* ── Tabs + actions ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setActiveTab("tasks")}
            style={activeTab === "tasks" ? { background: accentGrad } : undefined}
            className={["rounded-lg border px-4 py-2 text-[12px] font-semibold transition-all",
              activeTab === "tasks" ? "border-transparent text-white"
                : "border-slate-200/70 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/8"].join(" ")}>
            {`${t("scan.tasks")} (${tasks.length})`}
          </button>
          <button type="button" onClick={() => setActiveTab("schedule")}
            style={activeTab === "schedule" ? { background: accentGrad } : undefined}
            className={["flex items-center gap-1.5 rounded-lg border px-4 py-2 text-[12px] font-semibold transition-all",
              activeTab === "schedule" ? "border-transparent text-white"
                : "border-slate-200/70 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/8"].join(" ")}>
            <FiClock className="text-[12px]" />
            {t("scan.autoSchedule")}
            {schedules.length > 0 && (
              <span className={["ml-0.5 min-w-4.5 rounded-full px-1.5 py-0.5 text-center text-[9.5px] font-bold",
                activeTab === "schedule" ? "bg-white/25 text-white" : "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-white/50"].join(" ")}>
                {schedules.length}
              </span>
            )}
          </button>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "tasks" && (
            <button type="button" onClick={() => setShowCreateTask(true)}
              style={{ background: accentGrad }}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-[12px] font-semibold text-white shadow-sm transition hover:opacity-90">
              <FiPlus className="text-[13px]" />Add Task
            </button>
          )}
          {activeTab === "schedule" && (
            <button type="button" onClick={() => setShowScheduleModal(true)}
              style={{ background: accentGrad }}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-[12px] font-semibold text-white shadow-sm transition hover:opacity-90">
              <FiPlus className="text-[13px]" />{t("scan.newSchedule")}
            </button>
          )}
        </div>
      </div>

      {/* ── Tasks Table ── */}
      {activeTab === "tasks" && (
        <>
          {loadingTasks ? (
            <div className="overflow-hidden rounded-xl border border-slate-200/70 bg-white dark:border-white/8 dark:bg-[#0d0b1a]/80">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-white/8">
                    {["Name","Type","Status","Reports","Last Report","Severity","Trend","Actions"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/35">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[1,2,3].map(i => (
                    <tr key={i} className="border-b border-slate-100 dark:border-white/6">
                      {[240,36,100,36,140,100,36,96].map((w, j) => (
                        <td key={j} className="px-4 py-4">
                          <div className="h-4 animate-pulse rounded-lg bg-slate-100 dark:bg-white/8" style={{ width: w }} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-slate-200/70 bg-white py-16 dark:border-white/8 dark:bg-white/4">
              <div className="grid h-14 w-14 place-items-center rounded-xl border border-slate-200/70 bg-slate-50 text-slate-400 dark:border-white/8 dark:bg-white/5 dark:text-white/25">
                <FiSettings className="text-[22px]" />
              </div>
              <p className="text-[13px] font-semibold text-slate-600 dark:text-white/55">{t("scan.noTasks")}</p>
              <p className="text-[11px] text-slate-400 dark:text-white/30">Create a task using Add Task, or create directly in OpenVAS</p>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setShowCreateTask(true)}
                  style={{ background: accentGrad }}
                  className="flex items-center gap-2 rounded-lg px-4 py-2 text-[12px] font-semibold text-white transition hover:opacity-90">
                  <FiPlus className="text-[12px]" />Add Task
                </button>
                <button type="button" onClick={() => void handleRefresh()}
                  className="flex items-center gap-2 rounded-lg border border-slate-200/70 bg-white px-4 py-2 text-[12px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/55">
                  <FiRefreshCw className="text-[12px]" />{t("common.refresh")}
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200/70 bg-white dark:border-white/8 dark:bg-[#0d0b1a]/80">
              <div className="overflow-x-auto">
                <table className="w-full min-w-215">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60 dark:border-white/8 dark:bg-white/3">
                      {/* Name — not sortable */}
                      <th className="whitespace-nowrap px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/35">
                        Name
                      </th>
                      {/* Type — not sortable */}
                      <th className="whitespace-nowrap px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/35">
                        Type
                      </th>
                      {/* Sortable columns */}
                      {([
                        { col: "status"      as SortCol, label: "Status"      },
                        { col: "reports"     as SortCol, label: "Reports"     },
                        { col: "last_report" as SortCol, label: "Last Report" },
                        { col: "severity"    as SortCol, label: "Severity"    },
                        { col: "trend"       as SortCol, label: "Trend"       },
                      ]).map(({ col, label }) => (
                        <th key={col}
                          className="whitespace-nowrap px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/35 cursor-pointer select-none"
                          onClick={() => handleSort(col)}>
                          <span className={["inline-flex items-center gap-0.5 transition-colors",
                            sortBy === col ? "text-slate-700 dark:text-white/75" : "hover:text-slate-600 dark:hover:text-white/55"].join(" ")}>
                            {label}
                            <SortIcon active={sortBy === col} dir={sortDir} />
                          </span>
                        </th>
                      ))}
                      {/* Actions — not sortable */}
                      <th className="whitespace-nowrap px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/35">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTasks.map(task => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        onStart={handleStart}
                        onStop={handleStop}
                        onEdit={t2 => setEditTask(t2)}
                        onDelete={(id, name) => setDeleteConfirm({ id, name })}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5 dark:border-white/8">
                <p className="text-[10.5px] text-slate-400 dark:text-white/30">{tasks.length} task{tasks.length !== 1 ? "s" : ""} total</p>
                {hasRunning && (
                  <div className="flex items-center gap-1.5 text-[10.5px] text-cyan-500">
                    <FiActivity className="animate-pulse text-[11px]" />
                    <span>{runningCount} scan{runningCount !== 1 ? "s" : ""} in progress · auto-refreshing every 4s</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Schedule Tab ── */}
      {activeTab === "schedule" && (
        <div className="space-y-3">
          <div className="flex items-start gap-2.5 rounded-xl border border-slate-200/70 bg-slate-50/60 px-4 py-3 dark:border-white/8 dark:bg-white/3">
            <FiClock className="mt-0.5 shrink-0 text-[12px] text-slate-400 dark:text-white/30" />
            <p className="text-[11px] text-slate-500 dark:text-white/40">
              {t("scan.scheduleLocalNote")} · {t("common.refresh")} เพื่ออัปเดต status
            </p>
          </div>
          {loadingSchedules ? (
            <div className="flex h-32 items-center justify-center">
              <FiRefreshCw className="animate-spin text-[18px] text-slate-400 dark:text-white/30" />
            </div>
          ) : schedules.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200/70 bg-white py-16 dark:border-white/8 dark:bg-white/3">
              <div className="grid h-14 w-14 place-items-center rounded-xl border border-slate-200/70 bg-slate-50 text-slate-400 dark:border-white/8 dark:bg-white/5 dark:text-white/25">
                <FiRepeat className="text-[22px]" />
              </div>
              <p className="text-[13px] font-semibold text-slate-500 dark:text-white/50">{t("scan.noSchedules")}</p>
              <button type="button" onClick={() => setShowScheduleModal(true)}
                style={{ background: accentGrad }}
                className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-[12.5px] font-semibold text-white shadow-sm transition hover:opacity-90">
                <FiPlus className="text-[13px]" />{t("scan.newSchedule")}
              </button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white dark:border-white/8 dark:bg-[#0d0b1a]/60">
              {schedules.map((s, idx) => {
                const fc = FREQ_COLOR[s.frequency];
                return (
                  <div key={s.id} className={["flex flex-wrap items-center gap-3 px-5 py-4 transition-colors",
                    idx < schedules.length - 1 ? "border-b border-slate-100 dark:border-white/6" : "",
                    !s.enabled ? "opacity-50" : ""].join(" ")}>
                    <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:flex"
                      style={{ backgroundColor: `${currentColor}12`, color: currentColor }}>
                      <FiRepeat className="text-[15px]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-[13px] font-semibold text-slate-800 dark:text-white/88">{s.task_name}</p>
                        <span className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold"
                          style={{ backgroundColor: fc.bg, color: fc.text }}>{freqBadge(s)}</span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-white/35">
                        <FiClock className="text-[10px]" />
                        <span>{t("scan.nextRun")}: <strong className="text-slate-600 dark:text-white/55">{fmtNextRun(s.next_run_at)}</strong></span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="hidden text-[10.5px] text-slate-400 dark:text-white/30 sm:block">
                        {s.enabled ? t("scan.scheduleEnabled") : t("scan.scheduleDisabled")}
                      </span>
                      <button type="button" onClick={() => void toggleSchedule(s.id, s.enabled)} aria-label="toggle schedule"
                        className="relative inline-flex h-5.5 w-10 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
                        style={{ backgroundColor: s.enabled ? currentColor : "#e2e8f0" }}>
                        <span className="inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200"
                          style={{ transform: s.enabled ? "translateX(18px)" : "translateX(2px)" }} />
                      </button>
                    </div>
                    <button type="button" onClick={() => void deleteSchedule(s.id)}
                      className="grid h-8 w-8 place-items-center rounded-xl border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                      <FiTrash2 className="text-[12px]" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Modals ── */}
      <CreateTaskModal
        open={showCreateTask}
        onClose={() => setShowCreateTask(false)}
        onCreated={() => void fetchTasksSilent()}
      />

      <EditTaskModal
        task={editTask}
        onClose={() => setEditTask(null)}
        onSaved={() => void fetchTasksSilent()}
      />

      <ScanConfirmModal
        open={!!deleteConfirm}
        title="Delete Scan Task?"
        description={`This action cannot be undone. The task "${deleteConfirm?.name ?? ""}" and all its reports will be removed from OpenVAS.`}
        confirmLabel="Delete Task"
        onConfirm={() => void handleDeleteConfirmed()}
        onCancel={() => setDeleteConfirm(null)}
      />

      {/* ── New Schedule Modal ── */}
      {showScheduleModal && createPortal(
        <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[3px]" onClick={closeScheduleModal} />
          <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl bg-white dark:bg-[#12101f]"
            style={{ boxShadow: `0 24px 64px -12px ${currentColor}40, 0 8px 24px rgba(0,0,0,.18)` }}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-white/8">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: accentGrad }}>
                  <FiRepeat className="text-[14px]" />
                </span>
                <div>
                  <p className="text-[9.5px] font-bold uppercase tracking-widest" style={{ color: currentColor }}>AUTO SCAN</p>
                  <h3 className="text-[14px] font-bold text-slate-800 dark:text-white/90">{t("scan.newSchedule")}</h3>
                </div>
              </div>
              <button type="button" onClick={closeScheduleModal}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:text-white/35 dark:hover:bg-white/8">
                <FiX className="text-[15px]" />
              </button>
            </div>
            <div className="space-y-4 px-5 py-5">
              <div>
                <label className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/35">{t("scan.selectTask")}</label>
                <div className="relative" ref={taskDropRef}>
                  <button type="button" onClick={() => setTaskDropOpen(p => !p)}
                    className="flex h-10 w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 text-left transition hover:border-slate-300 focus:outline-none dark:border-white/8 dark:bg-white/5 dark:hover:bg-white/8">
                    {schedForm.taskId ? (
                      <><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: currentColor }} />
                      <span className="flex-1 truncate text-[12.5px] font-medium text-slate-700 dark:text-white/85">
                        {tasks.find(tk => tk.id === schedForm.taskId)?.name ?? "—"}
                      </span></>
                    ) : (
                      <><span className="h-2 w-2 shrink-0 rounded-full bg-slate-300 dark:bg-white/20" />
                      <span className="flex-1 truncate text-[12.5px] text-slate-400 dark:text-white/30">— {t("scan.selectTask")} —</span></>
                    )}
                    <FiChevronDown className={`ml-auto shrink-0 text-[13px] text-slate-400 transition-transform dark:text-white/30 ${taskDropOpen ? "rotate-180" : ""}`} />
                  </button>
                  {taskDropOpen && (
                    <div className="absolute left-0 right-0 z-50 mt-1.5 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xl dark:border-white/10 dark:bg-[#0d0b1a]">
                      <div className="border-b border-slate-100 p-2 dark:border-white/8">
                        <div className="flex items-center gap-2 rounded-lg border border-slate-200/70 bg-slate-50 px-2.5 dark:border-white/8 dark:bg-white/5">
                          <FiSearch className="shrink-0 text-[11px] text-slate-400 dark:text-white/35" />
                          <input type="text" value={taskSearch} onChange={e => setTaskSearch(e.target.value)} placeholder="Search task..." autoFocus
                            className="h-8 w-full bg-transparent text-[11px] text-slate-700 outline-none placeholder:text-slate-400 dark:text-white/75 dark:placeholder:text-white/30" />
                        </div>
                      </div>
                      <div className="max-h-48 overflow-y-auto p-1.5">
                        {filteredTasksForModal.length === 0
                          ? <p className="py-4 text-center text-[11px] text-slate-400 dark:text-white/35">No tasks found</p>
                          : <div className="space-y-0.5">
                              {filteredTasksForModal.map(tk => {
                                const isSel = schedForm.taskId === tk.id;
                                return (
                                  <button key={tk.id} type="button"
                                    onClick={() => { setSchedForm(p => ({ ...p, taskId: tk.id })); setTaskDropOpen(false); setTaskSearch(""); }}
                                    className={["flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition",
                                      isSel ? "bg-blue-50 dark:bg-blue-500/10" : "hover:bg-slate-50 dark:hover:bg-white/5"].join(" ")}>
                                    <span className={["flex h-4 w-4 shrink-0 items-center justify-center rounded border transition",
                                      isSel ? "border-blue-500 bg-blue-500 text-white" : "border-slate-300 bg-white text-transparent dark:border-white/20 dark:bg-white/5"].join(" ")}>
                                      <FiCheck className="text-[9px]" />
                                    </span>
                                    <span className="truncate text-[11.5px] text-slate-700 dark:text-white/75">{tk.name}</span>
                                  </button>
                                );
                              })}
                            </div>
                        }
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/35">{t("scan.scheduleType")}</label>
                <div className="flex gap-2">
                  {(["once", "monthly", "yearly"] as ScheduleFrequency[]).map(freq => (
                    <button key={freq} type="button" onClick={() => setSchedForm(p => ({ ...p, frequency: freq }))}
                      style={schedForm.frequency === freq ? { background: accentGrad } : undefined}
                      className={["flex-1 rounded-xl border py-2 text-[11.5px] font-semibold transition-all",
                        schedForm.frequency === freq ? "border-transparent text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/55"].join(" ")}>
                      {t(`scan.${freq}` as "scan.once" | "scan.monthly" | "scan.yearly")}
                    </button>
                  ))}
                </div>
              </div>
              {schedForm.frequency === "once" && (
                <div>
                  <label className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/35">{t("scan.selectDate")}</label>
                  <div className="relative">
                    <FiCalendar className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px] text-slate-400 dark:text-white/30" />
                    <input type="date" value={schedForm.date} onChange={e => setSchedForm(p => ({ ...p, date: e.target.value }))}
                      className={["pl-10", inputCls].join(" ")} />
                  </div>
                </div>
              )}
              {schedForm.frequency === "monthly" && (
                <div>
                  <label className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/35">{t("scan.dayOfMonth")} (1–31)</label>
                  <input type="number" min={1} max={31} value={schedForm.dayOfMonth}
                    onChange={e => setSchedForm(p => ({ ...p, dayOfMonth: parseInt(e.target.value) || 1 }))} className={inputCls} />
                </div>
              )}
              {schedForm.frequency === "yearly" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/35">{t("scan.scheduleMonth")}</label>
                    <div className="relative" ref={monthDropRef}>
                      <button type="button" onClick={() => setMonthDropOpen(p => !p)}
                        className="flex h-10 w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-left transition hover:border-slate-300 focus:outline-none dark:border-white/8 dark:bg-white/5 dark:hover:bg-white/8">
                        <span className="flex-1 truncate text-[12px] text-slate-700 dark:text-white/80">{MONTHS[schedForm.month - 1]}</span>
                        <FiChevronDown className={`shrink-0 text-[12px] text-slate-400 transition-transform dark:text-white/30 ${monthDropOpen ? "rotate-180" : ""}`} />
                      </button>
                      {monthDropOpen && (
                        <div className="absolute left-0 right-0 z-50 mt-1.5 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xl dark:border-white/10 dark:bg-[#0d0b1a]">
                          <div className="max-h-48 overflow-y-auto p-1.5">
                            {MONTHS.map((m, i) => {
                              const isSel = schedForm.month === i + 1;
                              return (
                                <button key={m} type="button"
                                  onClick={() => { setSchedForm(p => ({ ...p, month: i + 1 })); setMonthDropOpen(false); }}
                                  className={["flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition",
                                    isSel ? "bg-blue-50 dark:bg-blue-500/10" : "hover:bg-slate-50 dark:hover:bg-white/5"].join(" ")}>
                                  <span className={["flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition",
                                    isSel ? "border-blue-500 bg-blue-500 text-white" : "border-slate-300 bg-white text-transparent dark:border-white/20 dark:bg-white/5"].join(" ")}>
                                    <FiCheck className="text-[8px]" />
                                  </span>
                                  <span className="text-[11.5px] text-slate-700 dark:text-white/75">{m}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/35">{t("scan.scheduleDay")}</label>
                    <input type="number" min={1} max={31} value={schedForm.day}
                      onChange={e => setSchedForm(p => ({ ...p, day: parseInt(e.target.value) || 1 }))} className={inputCls} />
                  </div>
                </div>
              )}
              <div>
                <label className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/35">{t("scan.scheduleTime")}</label>
                <div className="relative">
                  <FiClock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px] text-slate-400 dark:text-white/30" />
                  <input type="time" value={schedForm.time} onChange={e => setSchedForm(p => ({ ...p, time: e.target.value }))}
                    className={["pl-10", inputCls].join(" ")} />
                </div>
              </div>
              {schedForm.taskId && (
                <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3.5 py-2.5 dark:border-white/8 dark:bg-white/3">
                  <p className="text-[10.5px] text-slate-400 dark:text-white/30">
                    {t("scan.nextRun")}:&nbsp;
                    <span className="font-semibold text-slate-700 dark:text-white/70">
                      {schedForm.frequency === "once" && schedForm.date      ? `${schedForm.date} ${schedForm.time}`
                        : schedForm.frequency === "monthly" && schedForm.dayOfMonth ? `Day ${schedForm.dayOfMonth} of each month at ${schedForm.time}`
                        : schedForm.frequency === "yearly"  && schedForm.month && schedForm.day ? `${MONTHS[schedForm.month - 1]} ${schedForm.day} each year at ${schedForm.time}`
                        : "—"}
                    </span>
                  </p>
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={closeScheduleModal}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-[12.5px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/8 dark:text-white/55 dark:hover:bg-white/5">
                  {t("common.cancel")}
                </button>
                <button type="button" onClick={() => void handleAddSchedule()}
                  style={{ background: accentGrad }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-[12.5px] font-semibold text-white transition hover:opacity-90">
                  <FiCalendar className="text-[13px]" />{t("scan.newSchedule")}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};

export default ScanManagement;
