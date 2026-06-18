import React, { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  FiPlay, FiSquare, FiTrash2, FiPlus, FiRefreshCw,
  FiSettings, FiTarget, FiAlertTriangle, FiCheckCircle,
  FiWifi, FiClock, FiCalendar, FiX, FiRepeat,
} from "react-icons/fi";
import { message, Modal, Spin } from "antd";
import {
  GetGMPStatus, ListGMPTasks, ListGMPTargets, CreateGMPTarget,
  StartGMPTask, StopGMPTask, DeleteGMPTask, DeleteGMPTarget,
  getTaskStatusBg,
  ListScanSchedules, CreateScanSchedule, UpdateScanSchedule, DeleteScanSchedule,
  type GMPStatusResponse, type GMPTaskDTO, type GMPTargetDTO,
  type AutoScanScheduleDTO, type ScheduleFrequency,
} from "../../services";
import { useLanguage } from "../../contexts/LanguageContext";
import { useStateContext } from "../../contexts/ProviderContext";

// ─────────────────────────────────────────────────────────────
// Auto Scan Schedule — helpers (API-backed, no localStorage)
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
  if (s.frequency === "once" && s.schedule_at)    return `Once · ${s.schedule_at}`;
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
// GMP Status Badge
// ─────────────────────────────────────────────────────────────

const GMPStatusBadge: React.FC<{
  status: GMPStatusResponse | null;
  loading: boolean;
}> = ({ status, loading }) => {
  const { t } = useLanguage();
  if (loading) {
    return (
      <div className="flex items-center gap-1.5 rounded-full border border-slate-200/70 bg-white px-3 py-1.5 text-[11px] dark:border-white/8 dark:bg-white/5">
        <div className="h-2 w-2 animate-pulse rounded-full bg-slate-400" />
        <span className="text-slate-500 dark:text-white/40">{t("scan.connecting")}</span>
      </div>
    );
  }

  if (!status || !status.connected) {
    return (
      <div className="flex items-center gap-1.5 rounded-full border border-slate-200/70 bg-white px-3 py-1.5 text-[11px] text-slate-500 dark:border-white/8 dark:bg-white/5 dark:text-white/40">
        <span className="h-2 w-2 rounded-full bg-red-400" />
        <span>{t("scan.gmpDisconnected")}</span>
      </div>
    );
  }

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
// Modal: Create Target
// ─────────────────────────────────────────────────────────────

type CreateTargetModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

const CreateTargetModal: React.FC<CreateTargetModalProps> = ({
  open, onClose, onCreated,
}) => {
  const { t } = useLanguage();
  const [name, setName]       = useState("");
  const [hosts, setHosts]     = useState("");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  const reset = () => { setName(""); setHosts(""); setComment(""); };

  const handleCreate = async () => {
    if (!name.trim() || !hosts.trim()) {
      message.warning("Name and Hosts are required");
      return;
    }
    setLoading(true);
    try {
      await CreateGMPTarget({ name: name.trim(), hosts: hosts.trim(), comment: comment.trim() });
      message.success("Target created successfully");
      reset();
      onCreated();
      onClose();
    } catch (err: unknown) {
      const errMsg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      message.error(errMsg || "Failed to create target");
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-slate-200/70 bg-white px-3.5 py-2.5 text-[12.5px] text-slate-700 placeholder-slate-400 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 dark:border-white/8 dark:bg-white/5 dark:text-white/85 dark:placeholder-white/30 dark:focus:ring-blue-500/10";

  return (
    <Modal
      open={open}
      onCancel={() => { reset(); onClose(); }}
      footer={null}
      title={null}
      centered
      width={480}
      styles={{ body: { padding: 0 } }}
    >
      <div className="bg-white p-6 dark:bg-[#0d0b1a]">
        {/* Modal header */}
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200/70 bg-slate-50 text-slate-600 dark:border-white/8 dark:bg-white/5 dark:text-white/65">
            <FiTarget className="text-[15px]" />
          </div>
          <div>
            <p className="text-[15px] font-bold text-slate-800 dark:text-white/90">{t("scan.createTarget")}</p>
            <p className="text-[10.5px] text-slate-400 dark:text-white/40">กำหนด host ที่ต้องการสแกน</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold text-slate-600 dark:text-white/60">
              Target Name <span className="text-red-500">*</span>
            </label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Office Network" className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold text-slate-600 dark:text-white/60">
              Hosts / IP Range <span className="text-red-500">*</span>
            </label>
            <input type="text" value={hosts} onChange={(e) => setHosts(e.target.value)}
              placeholder="e.g. 192.168.1.0/24 or 10.0.0.1,10.0.0.2" className={inputCls} />
            <p className="mt-1 text-[10px] text-slate-400 dark:text-white/30">
              CIDR, comma-separated IPs, or range (e.g. 192.168.1.1-50)
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold text-slate-600 dark:text-white/60">
              Comment (optional)
            </label>
            <input type="text" value={comment} onChange={(e) => setComment(e.target.value)}
              placeholder="Description…" className={inputCls} />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={() => { reset(); onClose(); }}
            className="rounded-lg border border-slate-200/70 bg-white px-4 py-2 text-[12.5px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/65"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2 text-[12.5px] font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-white/15 dark:hover:bg-white/20"
          >
            {loading && <Spin size="small" />}
            {t("scan.createTarget")}
          </button>
        </div>
      </div>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────
// Task Card
// ─────────────────────────────────────────────────────────────

type TaskCardProps = {
  task: GMPTaskDTO;
  onStart: (id: string) => Promise<void>;
  onStop: (id: string) => Promise<void>;
  onDelete: (id: string) => void;
};

const TaskCard: React.FC<TaskCardProps> = ({ task, onStart, onStop, onDelete }) => {
  const [acting, setActing] = useState(false);

  const statusLower = task.status?.toLowerCase() ?? "";
  const isRunning   = statusLower === "running";

  const handleAction = async () => {
    setActing(true);
    try {
      if (isRunning) await onStop(task.id);
      else await onStart(task.id);
    } finally {
      setActing(false);
    }
  };

  const actionLabel = isRunning ? "Stop scan" : statusLower === "done" ? "Re-run scan" : "Start scan";

  const actionBtnCls = isRunning
    ? "border-orange-200 bg-orange-50 text-orange-600 hover:bg-orange-100 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-300"
    : statusLower === "done"
    ? "border-violet-200 bg-violet-50 text-violet-600 hover:bg-violet-100 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-300"
    : "border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300";

  return (
    <div className="rounded-xl border border-slate-200/70 bg-white p-4 transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-white/8 dark:bg-white/4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-[13px] font-bold text-slate-800 dark:text-white/90">
              {task.name}
            </span>
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9.5px] font-bold ${getTaskStatusBg(task.status)}`}>
              {task.status}
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10.5px] text-slate-500 dark:text-white/40">
            <span className="flex items-center gap-1">
              <FiTarget className="text-[10px]" />
              {task.target_name || "—"}
            </span>
            <span>·</span>
            <span>{task.config_name || "—"}</span>
            {task.severity > 0 && (
              <>
                <span>·</span>
                <span
                  className={[
                    "font-semibold",
                    task.severity >= 9 ? "text-red-600 dark:text-red-400"
                    : task.severity >= 7 ? "text-orange-600 dark:text-orange-400"
                    : task.severity >= 4 ? "text-yellow-600 dark:text-yellow-400"
                    : "text-emerald-600 dark:text-emerald-400",
                  ].join(" ")}
                >
                  Severity {task.severity.toFixed(1)}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            title={actionLabel}
            onClick={() => void handleAction()}
            disabled={acting}
            className={["grid h-8 w-8 place-items-center rounded-xl border text-[13px] transition-all", actionBtnCls, acting ? "cursor-not-allowed opacity-60" : ""].join(" ")}
          >
            {acting ? <Spin size="small" /> : isRunning ? <FiSquare className="text-[11px]" /> : <FiPlay className="text-[11px]" />}
          </button>
          <button
            type="button"
            title="Delete task"
            onClick={() => onDelete(task.id)}
            disabled={isRunning || acting}
            className="grid h-8 w-8 place-items-center rounded-xl border border-red-200 bg-red-50 text-[13px] text-red-600 transition-all hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
          >
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
        {task.last_report_at && (
          <>
            <span>·</span>
            <span>Last: {task.last_report_at}</span>
          </>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Target Row
// ─────────────────────────────────────────────────────────────

type TargetRowProps = {
  target: GMPTargetDTO;
  index: number;
  onDelete: (id: string) => void;
};

const TargetRow: React.FC<TargetRowProps> = ({ target, index, onDelete }) => (
  <tr
    className={[
      "transition-colors hover:bg-slate-50 dark:hover:bg-white/3",
      index % 2 === 0 ? "bg-white dark:bg-white/2" : "bg-slate-50/50 dark:bg-white/1",
    ].join(" ")}
  >
    <td className="px-4 py-3 text-[12.5px] font-semibold text-slate-800 dark:text-white/85">
      {target.name}
    </td>
    <td className="px-4 py-3 font-mono text-[11.5px] text-slate-600 dark:text-white/55">
      {target.hosts}
    </td>
    <td className="px-4 py-3 text-[11px] text-slate-400 dark:text-white/40">
      {target.comment || "—"}
    </td>
    <td className="px-4 py-3 text-right">
      <button
        type="button"
        onClick={() => onDelete(target.id)}
        className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-[10.5px] font-semibold text-red-700 hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
      >
        <FiTrash2 className="text-[10px]" />
        Delete
      </button>
    </td>
  </tr>
);

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────

const ICON_COLOR: Record<string, string> = {
  violet: "#8b5cf6",
  cyan:   "#06b6d4",
  emerald:"#10b981",
  sky:    "#0ea5e9",
};

const ScanManagement: React.FC = () => {
  const { t } = useLanguage();
  const { currentColor } = useStateContext();
  const accentGrad = `linear-gradient(135deg, ${currentColor}, color-mix(in srgb, ${currentColor} 65%, #a855f7))`;

  const [gmpStatus, setGmpStatus]     = useState<GMPStatusResponse | null>(null);
  const [tasks, setTasks]             = useState<GMPTaskDTO[]>([]);
  const [targets, setTargets]         = useState<GMPTargetDTO[]>([]);
  const [loadingStatus, setLoadingStatus]   = useState(true);
  const [loadingTasks, setLoadingTasks]     = useState(true);
  const [loadingTargets, setLoadingTargets] = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [activeTab, setActiveTab]     = useState<"tasks" | "targets" | "schedule">("tasks");
  const [showCreateTarget, setShowCreateTarget] = useState(false);

  // ── Auto-scan schedule state (API-backed) ────────────────────────────
  const [schedules,         setSchedules]         = useState<AutoScanScheduleDTO[]>([]);
  const [loadingSchedules,  setLoadingSchedules]  = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [schedForm, setSchedForm] = useState<{
    taskId: string; frequency: ScheduleFrequency;
    time: string; date: string; dayOfMonth: number; month: number; day: number;
  }>({ taskId: "", frequency: "once", time: "02:00", date: "", dayOfMonth: 1, month: 1, day: 1 });

  const fetchSchedules = useCallback(async () => {
    setLoadingSchedules(true);
    const list = await ListScanSchedules();
    setSchedules(list);
    setLoadingSchedules(false);
  }, []);

  const handleAddSchedule = useCallback(async () => {
    const task = tasks.find(t2 => t2.id === schedForm.taskId);
    if (!task) { message.warning(t("scan.selectTask")); return; }
    if (schedForm.frequency === "once" && !schedForm.date) {
      message.warning(t("scan.selectDate")); return;
    }
    try {
      await CreateScanSchedule({
        task_id:     schedForm.taskId,
        task_name:   task.name,
        frequency:   schedForm.frequency,
        scan_time:   schedForm.time,
        schedule_at: schedForm.frequency === "once"    ? schedForm.date        : undefined,
        day_of_month: schedForm.frequency === "monthly" ? schedForm.dayOfMonth  : undefined,
        month:       schedForm.frequency === "yearly"  ? schedForm.month        : undefined,
        day:         schedForm.frequency === "yearly"  ? schedForm.day          : undefined,
      });
      message.success(t("scan.scheduleCreated"));
      setShowScheduleModal(false);
      setSchedForm({ taskId: "", frequency: "once", time: "02:00", date: "", dayOfMonth: 1, month: 1, day: 1 });
      void fetchSchedules();
    } catch { message.error(t("common.noResults")); }
  }, [schedForm, tasks, fetchSchedules, t]);

  const toggleSchedule = useCallback(async (id: number, enabled: boolean) => {
    try {
      await UpdateScanSchedule(id, !enabled);
      void fetchSchedules();
    } catch { message.error(t("common.noResults")); }
  }, [fetchSchedules, t]);

  const deleteSchedule = useCallback(async (id: number) => {
    try {
      await DeleteScanSchedule(id);
      message.success(t("scan.scheduleDeleted"));
      void fetchSchedules();
    } catch { message.error(t("common.noResults")); }
  }, [fetchSchedules, t]);

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
    try {
      await StartGMPTask(id);
      message.success("Scan started");
      setTimeout(() => void fetchTasks(), 1500);
    } catch (err: unknown) {
      const m = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      message.error(m || "Failed to start scan");
    }
  };

  const handleStop = async (id: string) => {
    try {
      await StopGMPTask(id);
      message.success("Scan stopped");
      setTimeout(() => void fetchTasks(), 1500);
    } catch (err: unknown) {
      const m = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      message.error(m || "Failed to stop scan");
    }
  };

  const confirmDeleteTask = (id: string) => {
    Modal.confirm({
      title: "Delete Scan Task?",
      content: "This action cannot be undone. The task and all its reports will be removed from OpenVAS.",
      okText: "Delete",
      okButtonProps: { danger: true },
      centered: true,
      onOk: async () => {
        try {
          await DeleteGMPTask(id);
          message.success("Task deleted");
          await fetchTasks();
        } catch (err: unknown) {
          const m = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
          message.error(m || "Failed to delete task");
        }
      },
    });
  };

  const confirmDeleteTarget = (id: string) => {
    Modal.confirm({
      title: "Delete Scan Target?",
      content: "This will remove the target from OpenVAS. Existing tasks using this target may be affected.",
      okText: "Delete",
      okButtonProps: { danger: true },
      centered: true,
      onOk: async () => {
        try {
          await DeleteGMPTarget(id);
          message.success("Target deleted");
          await fetchTargets();
        } catch (err: unknown) {
          const m = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
          message.error(m || "Failed to delete target");
        }
      },
    });
  };

  const runningCount = tasks.filter((t) => t.status?.toLowerCase() === "running").length;
  const doneCount    = tasks.filter((t) => t.status?.toLowerCase() === "done").length;

  const statCards = [
    { label: "Total Tasks", val: tasks.length,   icon: <FiSettings />,     color: "violet" },
    { label: "Running",     val: runningCount,    icon: <FiPlay />,         color: "cyan" },
    { label: "Done",        val: doneCount,       icon: <FiCheckCircle />,  color: "emerald" },
    { label: "Targets",     val: targets.length,  icon: <FiTarget />,       color: "sky" },
  ];

  return (
    <div className="w-full space-y-5 py-0 sm:py-0">

      {/* ── Header card ── */}
      <div
        className="relative mb-4 overflow-hidden rounded-[18px] bg-white/95 p-4 shadow-sm backdrop-blur sm:rounded-[22px] sm:mb-5 sm:p-6 dark:bg-[#0d0b1a]/90"
        style={{ border: `1px solid ${currentColor}30` }}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-12 right-10 h-40 w-40 rounded-full blur-3xl" style={{ backgroundColor: `${currentColor}1e` }} />
          <div className="absolute -bottom-12 left-10 h-40 w-40 rounded-full blur-3xl" style={{ backgroundColor: `${currentColor}14` }} />
        </div>
        <div className="relative z-10 flex items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg sm:h-13 sm:w-13"
              style={{ background: accentGrad, boxShadow: `0 8px 24px -6px ${currentColor}50` }}
            >
              <FiSettings className="text-[20px] sm:text-[22px]" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] sm:text-[10.5px]" style={{ color: currentColor }}>
                THREAT INTELLIGENCE · SCANNER
              </p>
              <h1 className="truncate text-[18px] font-bold text-slate-900 sm:text-[20px] dark:text-white/90">
                {t("scan.title")}
              </h1>
              <p className="mt-0.5 truncate text-[11px] text-slate-500 sm:text-[12px] dark:text-white/45">
                Start, stop &amp; schedule scan tasks via OpenVAS GMP
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <GMPStatusBadge status={gmpStatus} loading={loadingStatus} />
            <button
              type="button"
              onClick={() => void handleRefresh()}
              disabled={refreshing}
              className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200/70 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-60 dark:border-white/8 dark:bg-white/5 dark:text-white/50"
              title={t("common.refresh")}
            >
              <FiRefreshCw className={`text-[13px] ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ── GMP offline warning ── */}
      {!loadingStatus && (!gmpStatus || !gmpStatus.connected) && (
        <div className="flex items-start gap-2.5 rounded-xl border border-slate-200/70 bg-slate-50 p-3.5 dark:border-white/8 dark:bg-white/3">
          <FiAlertTriangle className="mt-0.5 shrink-0 text-[13px] text-slate-500 dark:text-white/40" />
          <div>
            <p className="text-[12px] font-semibold text-slate-700 dark:text-white/70">
              Cannot connect to OpenVAS GMP
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400 dark:text-white/35">
              {gmpStatus?.error || "Backend cannot reach gvmd socket. Check that gvmd_socket_vol is mounted."}
            </p>
          </div>
        </div>
      )}

      {/* ── Stats cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statCards.map(({ label, val, icon, color }) => (
          <div key={label} className="rounded-xl border border-slate-200/70 bg-white px-5 py-5 dark:border-white/8 dark:bg-[#0d0b1a]/80">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium tracking-wide text-slate-500 dark:text-white/45">
                {label}
              </p>
              <span style={{ color: ICON_COLOR[color] }} className="text-[15px] opacity-75">
                {icon}
              </span>
            </div>
            <p className="mt-3 text-[34px] font-bold leading-none tracking-tight text-slate-900 dark:text-white">
              {loadingTasks && (label === "Total Tasks" || label === "Running" || label === "Done")
                ? <span className="inline-block h-9 w-10 animate-pulse rounded-lg bg-slate-100 dark:bg-white/10" />
                : loadingTargets && label === "Targets"
                ? <span className="inline-block h-9 w-10 animate-pulse rounded-lg bg-slate-100 dark:bg-white/10" />
                : val}
            </p>
          </div>
        ))}
      </div>

      {/* ── Tabs + action buttons ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {/* Tasks tab */}
          <button type="button" onClick={() => setActiveTab("tasks")}
            className={["rounded-lg border px-4 py-2 text-[12px] font-semibold transition-all",
              activeTab === "tasks"
                ? "border-slate-900 bg-slate-900 text-white dark:border-white/20 dark:bg-white/10"
                : "border-slate-200/70 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/8",
            ].join(" ")}>
            {`${t("scan.tasks")} (${tasks.length})`}
          </button>
          {/* Targets tab */}
          <button type="button" onClick={() => setActiveTab("targets")}
            className={["rounded-lg border px-4 py-2 text-[12px] font-semibold transition-all",
              activeTab === "targets"
                ? "border-slate-900 bg-slate-900 text-white dark:border-white/20 dark:bg-white/10"
                : "border-slate-200/70 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/8",
            ].join(" ")}>
            {`${t("scan.targets")} (${targets.length})`}
          </button>
          {/* Auto Schedule tab */}
          <button type="button" onClick={() => setActiveTab("schedule")}
            style={activeTab === "schedule" ? { background: accentGrad } : undefined}
            className={["flex items-center gap-1.5 rounded-lg border px-4 py-2 text-[12px] font-semibold transition-all",
              activeTab === "schedule"
                ? "border-transparent text-white"
                : "border-slate-200/70 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/8",
            ].join(" ")}>
            <FiClock className="text-[12px]" />
            {t("scan.autoSchedule")}
            {schedules.length > 0 && (
              <span className={["ml-0.5 min-w-4.5 rounded-full px-1.5 py-0.5 text-center text-[9.5px] font-bold",
                activeTab === "schedule" ? "bg-white/25 text-white" : "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-white/50"
              ].join(" ")}>
                {schedules.length}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === "targets" && (
            <button type="button" onClick={() => setShowCreateTarget(true)}
              className="flex items-center gap-2 rounded-lg border border-slate-200/70 bg-white px-4 py-2 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/65 dark:hover:bg-white/8">
              <FiPlus className="text-[13px]" />
              {t("scan.addTarget")}
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
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-28 animate-pulse rounded-xl border border-slate-200/70 bg-slate-50 dark:border-white/8 dark:bg-white/4" />
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-slate-200/70 bg-white py-16 dark:border-white/8 dark:bg-white/4">
              <div className="grid h-14 w-14 place-items-center rounded-xl border border-slate-200/70 bg-slate-50 text-slate-400 dark:border-white/8 dark:bg-white/5 dark:text-white/25">
                <FiSettings className="text-[22px]" />
              </div>
              <p className="text-[13px] font-semibold text-slate-600 dark:text-white/55">
                {t("scan.noTasks")}
              </p>
              <p className="text-[11px] text-slate-400 dark:text-white/30">
                Create tasks in OpenVAS, then they will appear here
              </p>
              <button
                type="button"
                onClick={() => void handleRefresh()}
                className="mt-1 flex items-center gap-2 rounded-lg border border-slate-200/70 bg-white px-4 py-2 text-[12px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/55"
              >
                <FiRefreshCw className="text-[12px]" />
                {t("common.refresh")}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onStart={handleStart}
                  onStop={handleStop}
                  onDelete={confirmDeleteTask}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Targets Tab ── */}
      {activeTab === "targets" && (
        <div className="rounded-xl border border-slate-200/70 bg-white dark:border-white/8 dark:bg-[#0d0b1a]/80">
          {loadingTargets ? (
            <div className="space-y-2 p-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100 dark:bg-white/8" />
              ))}
            </div>
          ) : targets.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <div className="grid h-14 w-14 place-items-center rounded-xl border border-slate-200/70 bg-slate-50 text-slate-400 dark:border-white/8 dark:bg-white/4 dark:text-white/25">
                <FiWifi className="text-[22px]" />
              </div>
              <p className="text-[13px] font-semibold text-slate-500 dark:text-white/55">{t("scan.noTargets")}</p>
              <button
                type="button"
                onClick={() => setShowCreateTarget(true)}
                className="mt-1 flex items-center gap-2 rounded-lg border border-slate-200/70 bg-white px-4 py-2 text-[12px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/55"
              >
                <FiPlus className="text-[12px]" />
                {t("scan.createTarget")}
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-130">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-white/8">
                    {["Name", "Hosts / Range", "Comment", ""].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase text-slate-400 dark:text-white/30">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/60 dark:divide-white/5">
                  {targets.map((target, i) => (
                    <TargetRow key={target.id} target={target} index={i} onDelete={confirmDeleteTarget} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Auto Schedule Tab ── */}
      {activeTab === "schedule" && (
        <div className="space-y-3">

          {/* Info note */}
          <div className="flex items-start gap-2.5 rounded-xl border border-slate-200/70 bg-slate-50/60 px-4 py-3 dark:border-white/8 dark:bg-white/3">
            <FiClock className="mt-0.5 shrink-0 text-[12px] text-slate-400 dark:text-white/30" />
            <p className="text-[11px] text-slate-500 dark:text-white/40">
              {t("scan.scheduleLocalNote")} · {t("common.refresh")} เพื่ออัปเดต status
            </p>
          </div>

          {/* Empty state */}
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
                <FiPlus className="text-[13px]" />
                {t("scan.newSchedule")}
              </button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white dark:border-white/8 dark:bg-[#0d0b1a]/60">
              {schedules.map((s, idx) => {
                const fc = FREQ_COLOR[s.frequency];
                return (
                  <div key={s.id}
                    className={["flex flex-wrap items-center gap-3 px-5 py-4 transition-colors",
                      idx < schedules.length - 1 ? "border-b border-slate-100 dark:border-white/6" : "",
                      !s.enabled ? "opacity-50" : "",
                    ].join(" ")}
                  >
                    {/* Left: icon */}
                    <div
                      className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:flex"
                      style={{ backgroundColor: `${currentColor}12`, color: currentColor }}
                    >
                      <FiRepeat className="text-[15px]" />
                    </div>

                    {/* Task + freq */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-[13px] font-semibold text-slate-800 dark:text-white/88">{s.task_name}</p>
                        <span
                          className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold"
                          style={{ backgroundColor: fc.bg, color: fc.text }}
                        >
                          {freqBadge(s)}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-white/35">
                        <FiClock className="text-[10px]" />
                        <span>{t("scan.nextRun")}: <strong className="text-slate-600 dark:text-white/55">{fmtNextRun(s.next_run_at)}</strong></span>
                      </div>
                    </div>

                    {/* Enabled toggle */}
                    <div className="flex items-center gap-1.5">
                      <span className="hidden text-[10.5px] text-slate-400 dark:text-white/30 sm:block">
                        {s.enabled ? t("scan.scheduleEnabled") : t("scan.scheduleDisabled")}
                      </span>
                      <button type="button" onClick={() => void toggleSchedule(s.id, s.enabled)}
                        aria-label="toggle schedule"
                        className="relative inline-flex h-5.5 w-10 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
                        style={{ backgroundColor: s.enabled ? currentColor : "#e2e8f0" }}
                      >
                        <span className="inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200"
                          style={{ transform: s.enabled ? "translateX(18px)" : "translateX(2px)" }} />
                      </button>
                    </div>

                    {/* Delete */}
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

      <CreateTargetModal
        open={showCreateTarget}
        onClose={() => setShowCreateTarget(false)}
        onCreated={() => void fetchTargets()}
      />

      {/* ── New Schedule Modal ── */}
      {showScheduleModal && createPortal(
        <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={() => setShowScheduleModal(false)} />
          <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl bg-white dark:bg-[#12101f]"
            style={{ boxShadow: `0 24px 64px -12px ${currentColor}40, 0 8px 24px rgba(0,0,0,.18)` }}>

            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/8">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white"
                  style={{ background: accentGrad }}>
                  <FiRepeat className="text-[14px]" />
                </span>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: currentColor }}>
                    AUTO SCAN
                  </p>
                  <h3 className="text-[14px] font-bold text-slate-800 dark:text-white/90">{t("scan.newSchedule")}</h3>
                </div>
              </div>
              <button type="button" onClick={() => setShowScheduleModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:text-white/35 dark:hover:bg-white/8 focus:outline-none">
                <FiX className="text-[15px]" />
              </button>
            </div>

            {/* Modal body */}
            <div className="space-y-4 px-5 py-5">

              {/* Select task */}
              <div>
                <label className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/35">
                  {t("scan.selectTask")}
                </label>
                <select
                  value={schedForm.taskId}
                  onChange={e => setSchedForm(p => ({ ...p, taskId: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[12.5px] text-slate-700 outline-none focus:border-blue-300 dark:border-white/8 dark:bg-white/5 dark:text-white/80"
                >
                  <option value="">— {t("scan.selectTask")} —</option>
                  {tasks.map(tk => <option key={tk.id} value={tk.id}>{tk.name}</option>)}
                </select>
              </div>

              {/* Frequency */}
              <div>
                <label className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/35">
                  {t("scan.scheduleType")}
                </label>
                <div className="flex gap-2">
                  {(["once", "monthly", "yearly"] as ScheduleFrequency[]).map(freq => (
                    <button key={freq} type="button"
                      onClick={() => setSchedForm(p => ({ ...p, frequency: freq }))}
                      style={schedForm.frequency === freq ? { background: accentGrad } : undefined}
                      className={["flex-1 rounded-lg border py-2 text-[11.5px] font-semibold transition-all",
                        schedForm.frequency === freq
                          ? "border-transparent text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/55",
                      ].join(" ")}
                    >
                      {t(`scan.${freq}` as "scan.once" | "scan.monthly" | "scan.yearly")}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date / day config */}
              {schedForm.frequency === "once" && (
                <div>
                  <label className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/35">
                    {t("scan.selectDate")}
                  </label>
                  <input type="date" value={schedForm.date}
                    onChange={e => setSchedForm(p => ({ ...p, date: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[12.5px] text-slate-700 outline-none focus:border-blue-300 dark:border-white/8 dark:bg-white/5 dark:text-white/80" />
                </div>
              )}

              {schedForm.frequency === "monthly" && (
                <div>
                  <label className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/35">
                    {t("scan.dayOfMonth")} (1–31)
                  </label>
                  <input type="number" min={1} max={31} value={schedForm.dayOfMonth}
                    onChange={e => setSchedForm(p => ({ ...p, dayOfMonth: parseInt(e.target.value) || 1 }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[12.5px] text-slate-700 outline-none focus:border-blue-300 dark:border-white/8 dark:bg-white/5 dark:text-white/80" />
                </div>
              )}

              {schedForm.frequency === "yearly" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/35">
                      {t("scan.scheduleMonth")}
                    </label>
                    <select value={schedForm.month}
                      onChange={e => setSchedForm(p => ({ ...p, month: parseInt(e.target.value) }))}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[12.5px] text-slate-700 outline-none dark:border-white/8 dark:bg-white/5 dark:text-white/80">
                      {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/35">
                      {t("scan.scheduleDay")}
                    </label>
                    <input type="number" min={1} max={31} value={schedForm.day}
                      onChange={e => setSchedForm(p => ({ ...p, day: parseInt(e.target.value) || 1 }))}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[12.5px] text-slate-700 outline-none dark:border-white/8 dark:bg-white/5 dark:text-white/80" />
                  </div>
                </div>
              )}

              {/* Time */}
              <div>
                <label className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/35">
                  {t("scan.scheduleTime")}
                </label>
                <input type="time" value={schedForm.time}
                  onChange={e => setSchedForm(p => ({ ...p, time: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[12.5px] text-slate-700 outline-none focus:border-blue-300 dark:border-white/8 dark:bg-white/5 dark:text-white/80" />
              </div>

              {/* Next run preview */}
              {schedForm.taskId && (
                <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3.5 py-2.5 dark:border-white/8 dark:bg-white/3">
                  <p className="text-[10.5px] text-slate-400 dark:text-white/30">
                    {t("scan.nextRun")}:&nbsp;
                    <span className="font-semibold text-slate-700 dark:text-white/70">
                      {schedForm.frequency === "once" && schedForm.date
                        ? `${schedForm.date} ${schedForm.time}`
                        : schedForm.frequency === "monthly" && schedForm.dayOfMonth
                        ? `Day ${schedForm.dayOfMonth} of each month at ${schedForm.time}`
                        : schedForm.frequency === "yearly" && schedForm.month && schedForm.day
                        ? `${MONTHS[schedForm.month - 1]} ${schedForm.day} each year at ${schedForm.time}`
                        : "—"}
                    </span>
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowScheduleModal(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-2 text-[12.5px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/8 dark:text-white/55 dark:hover:bg-white/5 focus:outline-none">
                  {t("common.cancel")}
                </button>
                <button type="button" onClick={handleAddSchedule}
                  style={{ background: accentGrad }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-[12.5px] font-semibold text-white transition hover:opacity-90 focus:outline-none">
                  <FiCalendar className="text-[13px]" />
                  {t("scan.newSchedule")}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default ScanManagement;
