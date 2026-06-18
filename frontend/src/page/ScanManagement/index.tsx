import React, { useEffect, useRef, useState } from "react";
import {
  FiPlay,
  FiSquare,
  FiTrash2,
  FiPlus,
  FiRefreshCw,
  FiSettings,
  FiTarget,
  FiAlertTriangle,
  FiCheckCircle,
  FiWifi,
} from "react-icons/fi";
import { message, Modal, Spin } from "antd";
import {
  GetGMPStatus,
  ListGMPTasks,
  ListGMPTargets,
  CreateGMPTarget,
  StartGMPTask,
  StopGMPTask,
  DeleteGMPTask,
  DeleteGMPTarget,
  getTaskStatusBg,
  type GMPStatusResponse,
  type GMPTaskDTO,
  type GMPTargetDTO,
} from "../../services";
import { useLanguage } from "../../contexts/LanguageContext";

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
  const [gmpStatus, setGmpStatus]     = useState<GMPStatusResponse | null>(null);
  const [tasks, setTasks]             = useState<GMPTaskDTO[]>([]);
  const [targets, setTargets]         = useState<GMPTargetDTO[]>([]);
  const [loadingStatus, setLoadingStatus]   = useState(true);
  const [loadingTasks, setLoadingTasks]     = useState(true);
  const [loadingTargets, setLoadingTargets] = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [activeTab, setActiveTab]     = useState<"tasks" | "targets">("tasks");
  const [showCreateTarget, setShowCreateTarget] = useState(false);

  const hasFetched = useRef(false);

  const fetchStatus  = async () => { setLoadingStatus(true);  const s = await GetGMPStatus();   setGmpStatus(s);  setLoadingStatus(false); };
  const fetchTasks   = async () => { setLoadingTasks(true);   try { setTasks(await ListGMPTasks()); } catch { setTasks([]); } finally { setLoadingTasks(false); } };
  const fetchTargets = async () => { setLoadingTargets(true); try { setTargets(await ListGMPTargets()); } catch { setTargets([]); } finally { setLoadingTargets(false); } };
  const fetchAll     = async () => { await Promise.all([fetchStatus(), fetchTasks(), fetchTargets()]); };

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    void fetchAll();
  }, []);

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
    <div className="w-full space-y-5 py-3 sm:py-4">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[18px] font-bold text-slate-800 dark:text-white sm:text-[20px]">
              Scan Management
            </h1>
            <span className="rounded-full border border-slate-200/70 bg-slate-50 px-2.5 py-0.5 text-[10.5px] font-medium text-slate-500 dark:border-white/8 dark:bg-white/5 dark:text-white/40">
              OpenVAS GMP
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400 dark:text-white/30">
            Start, Stop &amp; Delete scan tasks
          </p>
        </div>

        <div className="flex items-center gap-2">
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

      {/* ── Tabs + New Target button ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {(["tasks", "targets"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={[
                "rounded-lg border px-4 py-2 text-[12px] font-semibold transition-all",
                activeTab === tab
                  ? "border-slate-900 bg-slate-900 text-white dark:border-white/20 dark:bg-white/10"
                  : "border-slate-200/70 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/8",
              ].join(" ")}
            >
              {tab === "tasks" ? `Scan Tasks (${tasks.length})` : `Targets (${targets.length})`}
            </button>
          ))}
        </div>

        {activeTab === "targets" && (
          <button
            type="button"
            onClick={() => setShowCreateTarget(true)}
            className="flex items-center gap-2 rounded-lg border border-slate-200/70 bg-white px-4 py-2 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/65 dark:hover:bg-white/8"
          >
            <FiPlus className="text-[13px]" />
            New Target
          </button>
        )}
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

      <CreateTargetModal
        open={showCreateTarget}
        onClose={() => setShowCreateTarget(false)}
        onCreated={() => void fetchTargets()}
      />
    </div>
  );
};

export default ScanManagement;
