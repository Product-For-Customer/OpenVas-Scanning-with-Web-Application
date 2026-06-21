import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  FiPlay, FiSquare, FiTrash2, FiPlus, FiRefreshCw,
  FiSettings, FiTarget, FiAlertTriangle, FiCheckCircle,
  FiClock, FiCalendar, FiX, FiRepeat,
  FiChevronDown, FiSearch, FiCheck, FiType, FiAlignLeft,
} from "react-icons/fi";
import { message } from "antd";
import {
  GetGMPStatus, ListGMPTasks, ListGMPTargets,
  CreateGMPTask, StartGMPTask, StopGMPTask, DeleteGMPTask,
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
// Schedule helpers
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

// ─────────────────────────────────────────────────────────────
// ScanConfirmModal — minimal delete portal
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
      <div
        className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl bg-white dark:bg-[#12101f]"
        style={{ boxShadow: "0 24px 64px -12px #ef444430, 0 8px 32px rgba(0,0,0,.20)" }}
      >
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
            <FiTrash2 className="text-[12px]" />
            {confirmLabel}
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
    <div className="flex items-center gap-1.5 rounded-full border border-slate-200/70 bg-white px-3 py-1.5 text-[11px] text-slate-500 dark:border-white/8 dark:bg-white/5 dark:text-white/40">
      <span className="h-2 w-2 rounded-full bg-red-400" />
      <span>{t("scan.gmpDisconnected")}</span>
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
// Progress Bar
// ─────────────────────────────────────────────────────────────

const ProgressBar: React.FC<{ progress: number }> = ({ progress }) => (
  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
    <div
      className="h-full rounded-full bg-linear-to-r from-cyan-400 to-sky-500 transition-all duration-500"
      style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
    />
  </div>
);

// ─────────────────────────────────────────────────────────────
// Modal: Create Task — Create Diagram style via portal
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

  const [name,      setName]      = useState("");
  const [comment,   setComment]   = useState("");
  const [targetId,  setTargetId]  = useState("");
  const [configId,  setConfigId]  = useState("");
  const [scannerId, setScannerId] = useState("");
  const [loading,   setLoading]   = useState(false);
  const [formError, setFormError] = useState("");

  const [targets,  setTargets]  = useState<GMPTargetDTO[]>([]);
  const [configs,  setConfigs]  = useState<GMPConfigDTO[]>([]);
  const [scanners, setScanners] = useState<GMPScannerDTO[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // ── Custom dropdowns ──────────────────────────────────────────
  const [openTarget,  setOpenTarget]  = useState(false);
  const [openConfig,  setOpenConfig]  = useState(false);
  const [openScanner, setOpenScanner] = useState(false);
  const [searchTarget,  setSearchTarget]  = useState("");
  const [searchConfig,  setSearchConfig]  = useState("");
  const [searchScanner, setSearchScanner] = useState("");

  const targetRef  = useRef<HTMLDivElement | null>(null);
  const configRef  = useRef<HTMLDivElement | null>(null);
  const scannerRef = useRef<HTMLDivElement | null>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!targetRef.current?.contains(e.target as Node))  setOpenTarget(false);
      if (!configRef.current?.contains(e.target as Node))  setOpenConfig(false);
      if (!scannerRef.current?.contains(e.target as Node)) setOpenScanner(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Fetch data when opened
  useEffect(() => {
    if (!open) return;
    const fetchData = async () => {
      setLoadingData(true);
      try {
        const [t2, c, s] = await Promise.all([
          ListGMPTargets(), ListGMPConfigs(), ListGMPScanners(),
        ]);
        setTargets(t2);
        setConfigs(c);
        setScanners(s);
        // Default to first config
        if (c.length > 0 && !configId) setConfigId(c[0].id);
        // Default to first scanner
        if (s.length > 0 && !scannerId) setScannerId(s[0].id);
      } catch { /* silent */ }
      finally { setLoadingData(false); }
    };
    void fetchData();
  }, [open]);

  const reset = () => {
    setName(""); setComment(""); setTargetId("");
    setConfigId(""); setScannerId(""); setFormError("");
    setOpenTarget(false); setOpenConfig(false); setOpenScanner(false);
    setSearchTarget(""); setSearchConfig(""); setSearchScanner("");
  };

  const handleClose = () => { reset(); onClose(); };

  const handleCreate = async () => {
    if (!name.trim())    { setFormError("Task name is required"); return; }
    if (!targetId)       { setFormError("Please select a Scan Target"); return; }
    if (!configId)       { setFormError("Please select a Scan Config"); return; }
    setLoading(true);
    setFormError("");
    try {
      await CreateGMPTask({
        name:       name.trim(),
        comment:    comment.trim(),
        target_id:  targetId,
        config_id:  configId,
        scanner_id: scannerId || undefined,
      });
      message.success("Task created successfully");
      reset();
      onCreated();
      onClose();
    } catch (err: unknown) {
      const errMsg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setFormError(errMsg || "Failed to create task");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const inputCls = [
    "h-9 w-full rounded-xl border px-3 text-[12px] outline-none transition",
    "border-slate-200/80 bg-white text-slate-800 placeholder:text-slate-400",
    "focus:ring-2 focus:ring-cyan-200 focus:border-cyan-300",
    "dark:border-white/10 dark:bg-white/5 dark:text-white/85 dark:placeholder:text-white/35",
    "dark:focus:ring-white/10 dark:focus:border-cyan-400/30",
  ].join(" ");

  const labelCls = "mb-1.5 flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/35";

  // Filtered lists
  const filteredTargets  = searchTarget.trim()  ? targets.filter(t2 => t2.name.toLowerCase().includes(searchTarget.toLowerCase()))  : targets;
  const filteredConfigs  = searchConfig.trim()  ? configs.filter(c  => c.name.toLowerCase().includes(searchConfig.toLowerCase()))   : configs;
  const filteredScanners = searchScanner.trim() ? scanners.filter(s => s.name.toLowerCase().includes(searchScanner.toLowerCase()))  : scanners;

  const selectedTarget  = targets.find(t2 => t2.id === targetId);
  const selectedConfig  = configs.find(c  => c.id === configId);
  const selectedScanner = scanners.find(s => s.id === scannerId);

  // Reusable dropdown
  const renderDropdown = (
    ref: React.RefObject<HTMLDivElement | null>,
    open2: boolean,
    setOpen: (v: boolean) => void,
    search: string,
    setSearch: (v: string) => void,
    selectedLabel: string,
    placeholder: string,
    items: { id: string; name: string }[],
    selectedId: string,
    onSelect: (id: string) => void,
  ) => (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => { setOpen(!open2); }}
        disabled={loadingData}
        className={[
          "flex h-9 w-full items-center gap-2 rounded-xl border px-3 text-left transition",
          open2
            ? "border-cyan-300 bg-cyan-50/40 dark:border-cyan-400/30 dark:bg-white/10"
            : "border-slate-200/80 bg-white hover:border-cyan-300 hover:bg-cyan-50/30 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10",
          "disabled:cursor-not-allowed disabled:opacity-50",
        ].join(" ")}
      >
        <span className="flex-1 truncate text-[12px] text-slate-700 dark:text-white/75">
          {loadingData ? "Loading…" : (selectedLabel || placeholder)}
        </span>
        <FiChevronDown className={`shrink-0 text-[12px] text-slate-400 transition-transform duration-200 dark:text-white/35 ${open2 ? "rotate-180" : ""}`} />
      </button>

      {open2 && (
        <div className="absolute left-0 right-0 z-50 mt-1.5 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xl dark:border-white/10 dark:bg-[#0d0b1a]">
          {/* Search */}
          <div className="border-b border-slate-100 p-2 dark:border-white/8">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200/70 bg-slate-50 px-2.5 dark:border-white/8 dark:bg-white/5">
              <FiSearch className="shrink-0 text-[11px] text-slate-400 dark:text-white/35" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search…"
                autoFocus
                className="h-8 w-full bg-transparent text-[11px] text-slate-700 outline-none placeholder:text-slate-400 dark:text-white/75 dark:placeholder:text-white/30"
              />
            </div>
          </div>
          {/* Options */}
          <div className="max-h-44 overflow-y-auto p-1.5">
            {items.length === 0 ? (
              <p className="py-4 text-center text-[11px] text-slate-400 dark:text-white/35">No items found</p>
            ) : (
              <div className="space-y-0.5">
                {items.map(item => {
                  const checked = item.id === selectedId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => { onSelect(item.id); setOpen(false); setSearch(""); }}
                      className={["flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition",
                        checked ? "bg-cyan-50 dark:bg-cyan-500/10" : "hover:bg-slate-50 dark:hover:bg-white/5"].join(" ")}
                    >
                      <span className={["flex h-4 w-4 shrink-0 items-center justify-center rounded border transition",
                        checked ? "border-cyan-500 bg-cyan-500 text-white" : "border-slate-300 bg-white text-transparent dark:border-white/20 dark:bg-white/5"].join(" ")}>
                        <FiCheck className="text-[9px]" />
                      </span>
                      <span className="truncate text-[11.5px] text-slate-700 dark:text-white/75">{item.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[3px]" onClick={handleClose} />
      <div
        className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl bg-white dark:bg-[#12101f]"
        style={{ boxShadow: `0 24px 64px -12px ${currentColor}30, 0 8px 32px rgba(0,0,0,.25)` }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-white/8">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: accentGrad }}>
              <FiSettings className="text-[14px]" />
            </span>
            <div>
              <p className="text-[9.5px] font-bold uppercase tracking-widest" style={{ color: currentColor }}>
                SCAN MANAGEMENT · NEW TASK
              </p>
              <h3 className="text-[14px] font-bold text-slate-800 dark:text-white/90">Create Scan Task</h3>
            </div>
          </div>
          <button type="button" onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 dark:text-white/35 dark:hover:bg-white/8">
            <FiX className="text-[15px]" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-3.5 px-5 py-4">
          {/* Name */}
          <div>
            <label className={labelCls}>
              <FiType className="text-[10px]" />
              Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Internal Network Scan"
              className={inputCls}
            />
          </div>

          {/* Comment */}
          <div>
            <label className={labelCls}>
              <FiAlignLeft className="text-[10px]" />
              Comment (optional)
            </label>
            <input
              type="text"
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Description…"
              className={inputCls}
            />
          </div>

          {/* Scan Target */}
          <div>
            <label className={labelCls}>
              <FiTarget className="text-[10px]" />
              Scan Target <span className="text-red-400">*</span>
            </label>
            {renderDropdown(
              targetRef, openTarget, setOpenTarget,
              searchTarget, setSearchTarget,
              selectedTarget?.name ?? "",
              "Select a target…",
              filteredTargets,
              targetId,
              setTargetId,
            )}
          </div>

          {/* Scan Config */}
          <div>
            <label className={labelCls}>
              <FiSettings className="text-[10px]" />
              Scan Config <span className="text-red-400">*</span>
            </label>
            {renderDropdown(
              configRef, openConfig, setOpenConfig,
              searchConfig, setSearchConfig,
              selectedConfig?.name ?? "",
              "Select scan config…",
              filteredConfigs,
              configId,
              setConfigId,
            )}
          </div>

          {/* Scanner */}
          <div>
            <label className={labelCls}>
              <FiTarget className="text-[10px]" />
              Scanner
            </label>
            {renderDropdown(
              scannerRef, openScanner, setOpenScanner,
              searchScanner, setSearchScanner,
              selectedScanner?.name ?? "",
              "Select scanner (default: OpenVAS Default)…",
              filteredScanners,
              scannerId,
              setScannerId,
            )}
          </div>

          {/* Error */}
          {formError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300">
              {formError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2.5 border-t border-slate-100 px-5 py-3.5 dark:border-white/8">
          <button type="button" onClick={handleClose}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 text-[12.5px] font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/8 dark:text-white/55 dark:hover:bg-white/5">
            {t("common.cancel")}
          </button>
          <button type="button" onClick={() => void handleCreate()} disabled={loading || loadingData}
            style={{ background: accentGrad }}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-[12.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-60">
            {loading && <FiRefreshCw className="animate-spin text-[12px]" />}
            <FiPlus className="text-[12px]" />
            Create Task
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

// ─────────────────────────────────────────────────────────────
// Task Card — Start / Stop / Delete (separate buttons)
// ─────────────────────────────────────────────────────────────

type TaskCardProps = {
  task: GMPTaskDTO;
  onStart:  (id: string) => Promise<void>;
  onStop:   (id: string) => Promise<void>;
  onDelete: (id: string, name: string) => void;
};

const TaskCard: React.FC<TaskCardProps> = ({ task, onStart, onStop, onDelete }) => {
  const [startBusy, setStartBusy] = useState(false);
  const [stopBusy,  setStopBusy]  = useState(false);

  const statusLower = task.status?.toLowerCase() ?? "";
  const isRunning   = statusLower === "running";
  const isDone      = statusLower === "done";

  const handleStart = async () => { setStartBusy(true); try { await onStart(task.id); } finally { setStartBusy(false); } };
  const handleStop  = async () => { setStopBusy(true);  try { await onStop(task.id);  } finally { setStopBusy(false);  } };

  return (
    <div className="rounded-xl border border-slate-200/70 bg-white p-4 transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-white/8 dark:bg-white/4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-[13px] font-bold text-slate-800 dark:text-white/90">{task.name}</span>
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9.5px] font-bold ${getTaskStatusBg(task.status)}`}>{task.status}</span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10.5px] text-slate-500 dark:text-white/40">
            <span className="flex items-center gap-1"><FiTarget className="text-[10px]" />{task.target_name || "—"}</span>
            <span>·</span>
            <span>{task.config_name || "—"}</span>
            {task.severity > 0 && (
              <><span>·</span>
              <span className={["font-semibold",
                task.severity >= 9 ? "text-red-600 dark:text-red-400"
                : task.severity >= 7 ? "text-orange-600 dark:text-orange-400"
                : task.severity >= 4 ? "text-yellow-600 dark:text-yellow-400"
                : "text-emerald-600 dark:text-emerald-400"].join(" ")}>
                Severity {task.severity.toFixed(1)}
              </span></>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {isRunning ? (
            <button type="button" title="Stop scan" onClick={() => void handleStop()} disabled={stopBusy}
              className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50 px-3 text-[11px] font-semibold text-orange-600 transition hover:bg-orange-100 disabled:opacity-60 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-300">
              {stopBusy ? <FiRefreshCw className="animate-spin text-[11px]" /> : <FiSquare className="text-[11px]" />}
              Stop
            </button>
          ) : (
            <button type="button" title={isDone ? "Re-run scan" : "Start scan"} onClick={() => void handleStart()} disabled={startBusy}
              className={["inline-flex h-8 items-center gap-1.5 rounded-xl border px-3 text-[11px] font-semibold transition disabled:opacity-60",
                isDone
                  ? "border-violet-200 bg-violet-50 text-violet-600 hover:bg-violet-100 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-300"
                  : "border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"].join(" ")}>
              {startBusy ? <FiRefreshCw className="animate-spin text-[11px]" /> : <FiPlay className="text-[11px]" />}
              {isDone ? "Re-run" : "Start"}
            </button>
          )}
          <button type="button" title="Delete task" onClick={() => onDelete(task.id, task.name)}
            disabled={isRunning || stopBusy || startBusy}
            className="grid h-8 w-8 place-items-center rounded-xl border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
            <FiTrash2 className="text-[11px]" />
          </button>
        </div>
      </div>

      {isRunning && (
        <div className="mt-3">
          <div className="mb-1.5 flex justify-between text-[9.5px] text-slate-500 dark:text-white/40">
            <span>Scanning in progress…</span>
            <span>{task.progress}%</span>
          </div>
          <ProgressBar progress={task.progress} />
        </div>
      )}

      <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-400 dark:text-white/25">
        <span>{task.report_count} report{task.report_count !== 1 ? "s" : ""}</span>
        {task.last_report_at && <><span>·</span><span>Last: {task.last_report_at}</span></>}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────

const ICON_COLOR: Record<string, string> = {
  violet: "#8b5cf6", cyan: "#06b6d4", emerald: "#10b981", sky: "#0ea5e9",
};

const ScanManagement: React.FC = () => {
  const { t } = useLanguage();
  const { currentColor } = useStateContext();
  const accentGrad = `linear-gradient(135deg, ${currentColor}, color-mix(in srgb, ${currentColor} 65%, #a855f7))`;

  const [gmpStatus,       setGmpStatus]       = useState<GMPStatusResponse | null>(null);
  const [tasks,           setTasks]           = useState<GMPTaskDTO[]>([]);
  const [targets,         setTargets]         = useState<GMPTargetDTO[]>([]);
  const [loadingStatus,   setLoadingStatus]   = useState(true);
  const [loadingTasks,    setLoadingTasks]    = useState(true);
  const [loadingTargets,  setLoadingTargets]  = useState(true);
  const [refreshing,      setRefreshing]      = useState(false);
  const [activeTab,       setActiveTab]       = useState<"tasks" | "schedule">("tasks");
  const [showCreateTask,  setShowCreateTask]  = useState(false);

  // Delete confirm
  const [deleteTaskConfirm, setDeleteTaskConfirm] = useState<{ id: string; name: string } | null>(null);

  // Auto-scan schedule
  const [schedules,        setSchedules]        = useState<AutoScanScheduleDTO[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [schedForm, setSchedForm] = useState<{
    taskId: string; frequency: ScheduleFrequency;
    time: string; date: string; dayOfMonth: number; month: number; day: number;
  }>({ taskId: "", frequency: "once", time: "02:00", date: "", dayOfMonth: 1, month: 1, day: 1 });

  // Custom dropdowns (schedule modal)
  const [taskDropOpen, setTaskDropOpen] = useState(false);
  const [taskSearch,   setTaskSearch]   = useState("");
  const taskDropRef  = useRef<HTMLDivElement | null>(null);
  const [monthDropOpen, setMonthDropOpen] = useState(false);
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
    const list = await ListScanSchedules();
    setSchedules(list);
    setLoadingSchedules(false);
  }, []);

  const closeScheduleModal = useCallback(() => {
    setShowScheduleModal(false); setTaskDropOpen(false); setTaskSearch(""); setMonthDropOpen(false);
  }, []);

  const hasFetched = useRef(false);

  const fetchStatus  = async () => { setLoadingStatus(true);  const s = await GetGMPStatus();   setGmpStatus(s);  setLoadingStatus(false); };
  const fetchTasks   = async () => { setLoadingTasks(true);   try { setTasks(await ListGMPTasks()); } catch { setTasks([]); } finally { setLoadingTasks(false); } };
  const fetchTargets = async () => { setLoadingTargets(true); try { setTargets(await ListGMPTargets()); } catch { setTargets([]); } finally { setLoadingTargets(false); } };
  const fetchAll     = async () => { await Promise.all([fetchStatus(), fetchTasks(), fetchTargets()]); };

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    void fetchAll();
    void fetchSchedules();
  }, [fetchSchedules]);

  const handleRefresh = async () => { setRefreshing(true); await fetchAll(); setRefreshing(false); };

  const handleStart = async (id: string) => {
    try { await StartGMPTask(id); message.success("Scan started"); setTimeout(() => void fetchTasks(), 1500); }
    catch (err: unknown) {
      const m = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      message.error(m || "Failed to start scan");
    }
  };

  const handleStop = async (id: string) => {
    try { await StopGMPTask(id); message.success("Scan stopped"); setTimeout(() => void fetchTasks(), 1500); }
    catch (err: unknown) {
      const m = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      message.error(m || "Failed to stop scan");
    }
  };

  const handleDeleteTaskConfirmed = async () => {
    if (!deleteTaskConfirm) return;
    const { id } = deleteTaskConfirm;
    setDeleteTaskConfirm(null);
    try { await DeleteGMPTask(id); message.success("Task deleted"); await fetchTasks(); }
    catch (err: unknown) {
      const m = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      message.error(m || "Failed to delete task");
    }
  };

  const handleAddSchedule = useCallback(async () => {
    const task = tasks.find(t2 => t2.id === schedForm.taskId);
    if (!task) { message.warning(t("scan.selectTask")); return; }
    if (schedForm.frequency === "once" && !schedForm.date) { message.warning(t("scan.selectDate")); return; }
    try {
      await CreateScanSchedule({
        task_id: schedForm.taskId, task_name: task.name, frequency: schedForm.frequency,
        scan_time: schedForm.time,
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

  const runningCount = tasks.filter(tk => tk.status?.toLowerCase() === "running").length;
  const doneCount    = tasks.filter(tk => tk.status?.toLowerCase() === "done").length;

  const statCards = [
    { label: "Total Tasks", val: tasks.length,   icon: <FiSettings />,    color: "violet"  },
    { label: "Running",     val: runningCount,    icon: <FiPlay />,        color: "cyan"    },
    { label: "Done",        val: doneCount,       icon: <FiCheckCircle />, color: "emerald" },
    { label: "Targets",     val: targets.length,  icon: <FiTarget />,      color: "sky"     },
  ];

  const inputCls = "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[12.5px] text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 dark:border-white/8 dark:bg-white/5 dark:text-white/80 dark:focus:ring-blue-500/10";

  return (
    <div className="w-full space-y-5">

      {/* ── Header ── */}
      <div
        className="relative overflow-hidden rounded-[18px] bg-white/95 p-4 shadow-sm backdrop-blur sm:rounded-[22px] sm:p-6 dark:bg-[#0d0b1a]/90"
        style={{ border: `1px solid ${currentColor}30` }}
      >
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
              <h1 className="truncate text-[18px] font-bold text-slate-900 sm:text-[20px] dark:text-white/90">{t("scan.title")}</h1>
              <p className="mt-0.5 truncate text-[11px] text-slate-500 sm:text-[12px] dark:text-white/45">
                Start, stop &amp; schedule scan tasks via OpenVAS GMP
              </p>
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
              {gmpStatus?.error || "Backend cannot reach gvmd socket. Check that gvmd_socket_vol is mounted."}
            </p>
          </div>
        </div>
      )}

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statCards.map(({ label, val, icon, color }) => (
          <div key={label} className="rounded-xl border border-slate-200/70 bg-white px-5 py-5 dark:border-white/8 dark:bg-[#0d0b1a]/80">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium tracking-wide text-slate-500 dark:text-white/45">{label}</p>
              <span style={{ color: ICON_COLOR[color] }} className="text-[15px] opacity-75">{icon}</span>
            </div>
            <p className="mt-3 text-[34px] font-bold leading-none tracking-tight text-slate-900 dark:text-white">
              {((loadingTasks && ["Total Tasks","Running","Done"].includes(label)) || (loadingTargets && label === "Targets"))
                ? <span className="inline-block h-9 w-10 animate-pulse rounded-lg bg-slate-100 dark:bg-white/10" />
                : val}
            </p>
          </div>
        ))}
      </div>

      {/* ── Tabs + actions ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {/* Tasks tab */}
          <button type="button" onClick={() => setActiveTab("tasks")}
            style={activeTab === "tasks" ? { background: accentGrad } : undefined}
            className={["rounded-lg border px-4 py-2 text-[12px] font-semibold transition-all",
              activeTab === "tasks" ? "border-transparent text-white"
                : "border-slate-200/70 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/8"].join(" ")}>
            {`${t("scan.tasks")} (${tasks.length})`}
          </button>
          {/* Schedule tab */}
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
              <FiPlus className="text-[13px]" />
              Add Task
            </button>
          )}
          {activeTab === "schedule" && (
            <button type="button" onClick={() => setShowScheduleModal(true)}
              style={{ background: accentGrad }}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-[12px] font-semibold text-white shadow-sm transition hover:opacity-90">
              <FiPlus className="text-[13px]" />
              {t("scan.newSchedule")}
            </button>
          )}
        </div>
      </div>

      {/* ── Tasks Tab ── */}
      {activeTab === "tasks" && (
        <>
          {loadingTasks ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {[1,2,3].map(i => <div key={i} className="h-28 animate-pulse rounded-xl border border-slate-200/70 bg-slate-50 dark:border-white/8 dark:bg-white/4" />)}
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
                  <FiPlus className="text-[12px]" /> Add Task
                </button>
                <button type="button" onClick={() => void handleRefresh()}
                  className="flex items-center gap-2 rounded-lg border border-slate-200/70 bg-white px-4 py-2 text-[12px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/55">
                  <FiRefreshCw className="text-[12px]" /> {t("common.refresh")}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {tasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onStart={handleStart}
                  onStop={handleStop}
                  onDelete={(id, name) => setDeleteTaskConfirm({ id, name })}
                />
              ))}
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
        onCreated={() => void fetchTasks()}
      />

      <ScanConfirmModal
        open={!!deleteTaskConfirm}
        title="Delete Scan Task?"
        description={`This action cannot be undone. The task "${deleteTaskConfirm?.name ?? ""}" and all its reports will be removed from OpenVAS.`}
        confirmLabel="Delete Task"
        onConfirm={() => void handleDeleteTaskConfirmed()}
        onCancel={() => setDeleteTaskConfirm(null)}
      />

      {/* ── New Schedule Modal ── */}
      {showScheduleModal && createPortal(
        <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[3px]" onClick={closeScheduleModal} />
          <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl bg-white dark:bg-[#12101f]"
            style={{ boxShadow: `0 24px 64px -12px ${currentColor}40, 0 8px 24px rgba(0,0,0,.18)` }}>

            {/* Header */}
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

            {/* Body */}
            <div className="space-y-4 px-5 py-5">

              {/* Task selector */}
              <div>
                <label className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/35">{t("scan.selectTask")}</label>
                <div className="relative" ref={taskDropRef}>
                  <button type="button" onClick={() => setTaskDropOpen(p => !p)}
                    className="flex h-10 w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 text-left transition hover:border-slate-300 hover:bg-slate-50/50 focus:outline-none dark:border-white/8 dark:bg-white/5 dark:hover:bg-white/8">
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
                          <input type="text" value={taskSearch} onChange={e => setTaskSearch(e.target.value)}
                            placeholder="Search task..." autoFocus
                            className="h-8 w-full bg-transparent text-[11px] text-slate-700 outline-none placeholder:text-slate-400 dark:text-white/75 dark:placeholder:text-white/30" />
                        </div>
                      </div>
                      <div className="max-h-48 overflow-y-auto p-1.5">
                        {filteredTasksForModal.length === 0 ? (
                          <p className="py-4 text-center text-[11px] text-slate-400 dark:text-white/35">No tasks found</p>
                        ) : (
                          <div className="space-y-0.5">
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
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Frequency */}
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
                    onChange={e => setSchedForm(p => ({ ...p, dayOfMonth: parseInt(e.target.value) || 1 }))}
                    className={inputCls} />
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
                      onChange={e => setSchedForm(p => ({ ...p, day: parseInt(e.target.value) || 1 }))}
                      className={inputCls} />
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
                      {schedForm.frequency === "once" && schedForm.date ? `${schedForm.date} ${schedForm.time}`
                        : schedForm.frequency === "monthly" && schedForm.dayOfMonth ? `Day ${schedForm.dayOfMonth} of each month at ${schedForm.time}`
                        : schedForm.frequency === "yearly" && schedForm.month && schedForm.day ? `${MONTHS[schedForm.month - 1]} ${schedForm.day} each year at ${schedForm.time}`
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
                  <FiCalendar className="text-[13px]" />
                  {t("scan.newSchedule")}
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
