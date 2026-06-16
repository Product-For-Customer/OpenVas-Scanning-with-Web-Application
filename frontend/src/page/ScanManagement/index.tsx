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

// ===========================
// GMP Status Badge
// ===========================

const GMPStatusBadge: React.FC<{
  status: GMPStatusResponse | null;
  loading: boolean;
}> = ({ status, loading }) => {
  if (loading) {
    return (
      <div className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] dark:border-white/10 dark:bg-white/5">
        <div className="h-2 w-2 animate-pulse rounded-full bg-gray-400" />
        <span className="text-gray-500 dark:text-white/50">Connecting...</span>
      </div>
    );
  }

  if (!status || !status.connected) {
    return (
      <div className="flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
        <span className="h-2 w-2 rounded-full bg-red-500" />
        <span>OpenVAS Disconnected</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <span>OpenVAS {status.version || "Connected"}</span>
    </div>
  );
};

// ===========================
// Progress Bar
// ===========================

const ProgressBar: React.FC<{ progress: number }> = ({ progress }) => (
  <div className="h-1 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
    <div
      className="h-full rounded-full bg-linear-to-r from-cyan-400 to-sky-500 transition-all duration-500"
      style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
    />
  </div>
);

// ===========================
// Modal: Create Target
// ===========================

type CreateTargetModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

const CreateTargetModal: React.FC<CreateTargetModalProps> = ({
  open,
  onClose,
  onCreated,
}) => {
  const [name, setName] = useState("");
  const [hosts, setHosts] = useState("");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setName("");
    setHosts("");
    setComment("");
  };

  const handleCreate = async () => {
    if (!name.trim() || !hosts.trim()) {
      message.warning("Name and Hosts are required");
      return;
    }
    setLoading(true);
    try {
      await CreateGMPTarget({
        name: name.trim(),
        hosts: hosts.trim(),
        comment: comment.trim(),
      });
      message.success("Target created successfully");
      reset();
      onCreated();
      onClose();
    } catch (err: unknown) {
      const errMsg = (
        err as { response?: { data?: { error?: string } } }
      )?.response?.data?.error;
      message.error(errMsg || "Failed to create target");
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    "w-full rounded-[14px] border border-gray-200 bg-white px-3.5 py-2.5 text-[12.5px] text-gray-700 placeholder-gray-400 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-white/10 dark:bg-white/5 dark:text-white/85 dark:placeholder-white/30 dark:focus:ring-sky-500/10";

  return (
    <Modal
      open={open}
      onCancel={() => {
        reset();
        onClose();
      }}
      footer={null}
      title={null}
      centered
      width={480}
      styles={{ body: { padding: 0 } }}
    >
      <div className="bg-white p-6 dark:bg-[#0f1117]">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl border border-sky-200 bg-sky-50 text-sky-600 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300">
            <FiTarget className="text-[15px]" />
          </div>
          <div>
            <div className="text-[15px] font-bold text-[#1f2240] dark:text-white/90">
              Create Scan Target
            </div>
            <div className="text-[10.5px] text-gray-500 dark:text-white/45">
              กำหนด host ที่ต้องการสแกน
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-gray-600 dark:text-white/65">
              Target Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Office Network"
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-gray-600 dark:text-white/65">
              Hosts / IP Range <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={hosts}
              onChange={(e) => setHosts(e.target.value)}
              placeholder="e.g. 192.168.1.0/24 or 10.0.0.1,10.0.0.2"
              className={inputCls}
            />
            <div className="mt-1 text-[10px] text-gray-400 dark:text-white/35">
              CIDR, comma-separated IPs, or range (e.g. 192.168.1.1-50)
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-gray-600 dark:text-white/65">
              Comment (optional)
            </label>
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Description..."
              className={inputCls}
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={() => {
              reset();
              onClose();
            }}
            className="rounded-[14px] border border-gray-200 bg-white px-4 py-2 text-[12.5px] font-semibold text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-white/70"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-[14px] bg-linear-to-r from-cyan-500 via-sky-500 to-violet-500 px-5 py-2 text-[12.5px] font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
          >
            {loading && <Spin size="small" />}
            Create Target
          </button>
        </div>
      </div>
    </Modal>
  );
};

// ===========================
// Task Card
// ===========================

type TaskCardProps = {
  task: GMPTaskDTO;
  onStart: (id: string) => Promise<void>;
  onStop: (id: string) => Promise<void>;
  onDelete: (id: string) => void;
};

const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onStart,
  onStop,
  onDelete,
}) => {
  const [acting, setActing] = useState(false);

  const statusLower = task.status?.toLowerCase() ?? "";
  const isRunning = statusLower === "running";

  const handleAction = async () => {
    setActing(true);
    try {
      if (isRunning) {
        await onStop(task.id);
      } else {
        await onStart(task.id);
      }
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
    <div className="rounded-[20px] border border-gray-200/80 bg-white p-4 shadow-sm transition-all hover:shadow-md dark:border-white/10 dark:bg-white/5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-[13px] font-bold text-[#1f2240] dark:text-white/90">
              {task.name}
            </span>
            <span
              className={`shrink-0 rounded-full border px-2 py-0.5 text-[9.5px] font-bold ${getTaskStatusBg(task.status)}`}
            >
              {task.status}
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10.5px] text-gray-500 dark:text-white/45">
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
                    task.severity >= 9
                      ? "text-red-600 dark:text-red-400"
                      : task.severity >= 7
                      ? "text-orange-600 dark:text-orange-400"
                      : task.severity >= 4
                      ? "text-yellow-600 dark:text-yellow-400"
                      : "text-emerald-600 dark:text-emerald-400",
                  ].join(" ")}
                >
                  Severity {task.severity.toFixed(1)}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            title={actionLabel}
            onClick={() => void handleAction()}
            disabled={acting}
            className={[
              "grid h-8 w-8 place-items-center rounded-xl border text-[13px] transition-all",
              actionBtnCls,
              acting ? "cursor-not-allowed opacity-60" : "",
            ].join(" ")}
          >
            {acting ? (
              <Spin size="small" />
            ) : isRunning ? (
              <FiSquare className="text-[11px]" />
            ) : (
              <FiPlay className="text-[11px]" />
            )}
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

      {/* Running progress bar */}
      {isRunning && (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-[9.5px] text-gray-500 dark:text-white/45">
            <span>Scanning in progress...</span>
            <span>{task.progress}%</span>
          </div>
          <ProgressBar progress={task.progress} />
        </div>
      )}

      {/* Footer meta */}
      <div className="mt-2 flex items-center gap-3 text-[10px] text-gray-400 dark:text-white/30">
        <span>
          {task.report_count} report{task.report_count !== 1 ? "s" : ""}
        </span>
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

// ===========================
// Target Row
// ===========================

type TargetRowProps = {
  target: GMPTargetDTO;
  index: number;
  onDelete: (id: string) => void;
};

const TargetRow: React.FC<TargetRowProps> = ({ target, index, onDelete }) => (
  <tr
    className={[
      "transition-colors hover:bg-cyan-50/50 dark:hover:bg-cyan-500/5",
      index % 2 === 0
        ? "bg-white dark:bg-white/3"
        : "bg-gray-50/50 dark:bg-white/2",
    ].join(" ")}
  >
    <td className="px-4 py-3 text-[12.5px] font-semibold text-[#1f2240] dark:text-white/85">
      {target.name}
    </td>
    <td className="px-4 py-3 font-mono text-[11.5px] text-gray-600 dark:text-white/60">
      {target.hosts}
    </td>
    <td className="px-4 py-3 text-[11px] text-gray-500 dark:text-white/45">
      {target.comment || "—"}
    </td>
    <td className="px-4 py-3 text-right">
      <button
        type="button"
        onClick={() => onDelete(target.id)}
        className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-2.5 py-1 text-[10.5px] font-semibold text-red-700 hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
      >
        <FiTrash2 className="text-[10px]" />
        Delete
      </button>
    </td>
  </tr>
);

// ===========================
// Main Page
// ===========================

const ScanManagement: React.FC = () => {
  const [gmpStatus, setGmpStatus] = useState<GMPStatusResponse | null>(null);
  const [tasks, setTasks] = useState<GMPTaskDTO[]>([]);
  const [targets, setTargets] = useState<GMPTargetDTO[]>([]);

  const [loadingStatus, setLoadingStatus] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [loadingTargets, setLoadingTargets] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [activeTab, setActiveTab] = useState<"tasks" | "targets">("tasks");
  const [showCreateTarget, setShowCreateTarget] = useState(false);

  const hasFetched = useRef(false);

  const fetchStatus = async () => {
    setLoadingStatus(true);
    const s = await GetGMPStatus();
    setGmpStatus(s);
    setLoadingStatus(false);
  };

  const fetchTasks = async () => {
    setLoadingTasks(true);
    try {
      const data = await ListGMPTasks();
      setTasks(data);
    } catch {
      setTasks([]);
    } finally {
      setLoadingTasks(false);
    }
  };

  const fetchTargets = async () => {
    setLoadingTargets(true);
    try {
      const data = await ListGMPTargets();
      setTargets(data);
    } catch {
      setTargets([]);
    } finally {
      setLoadingTargets(false);
    }
  };

  const fetchAll = async () => {
    await Promise.all([fetchStatus(), fetchTasks(), fetchTargets()]);
  };

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    void fetchAll();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  };

  const handleStart = async (id: string) => {
    try {
      await StartGMPTask(id);
      message.success("Scan started");
      setTimeout(() => void fetchTasks(), 1500);
    } catch (err: unknown) {
      const errMsg = (
        err as { response?: { data?: { error?: string } } }
      )?.response?.data?.error;
      message.error(errMsg || "Failed to start scan");
    }
  };

  const handleStop = async (id: string) => {
    try {
      await StopGMPTask(id);
      message.success("Scan stopped");
      setTimeout(() => void fetchTasks(), 1500);
    } catch (err: unknown) {
      const errMsg = (
        err as { response?: { data?: { error?: string } } }
      )?.response?.data?.error;
      message.error(errMsg || "Failed to stop scan");
    }
  };

  const confirmDeleteTask = (id: string) => {
    Modal.confirm({
      title: "Delete Scan Task?",
      content:
        "This action cannot be undone. The task and all its reports will be removed from OpenVAS.",
      okText: "Delete",
      okButtonProps: { danger: true },
      centered: true,
      onOk: async () => {
        try {
          await DeleteGMPTask(id);
          message.success("Task deleted");
          await fetchTasks();
        } catch (err: unknown) {
          const errMsg = (
            err as { response?: { data?: { error?: string } } }
          )?.response?.data?.error;
          message.error(errMsg || "Failed to delete task");
        }
      },
    });
  };

  const confirmDeleteTarget = (id: string) => {
    Modal.confirm({
      title: "Delete Scan Target?",
      content:
        "This will remove the target from OpenVAS. Existing tasks using this target may be affected.",
      okText: "Delete",
      okButtonProps: { danger: true },
      centered: true,
      onOk: async () => {
        try {
          await DeleteGMPTarget(id);
          message.success("Target deleted");
          await fetchTargets();
        } catch (err: unknown) {
          const errMsg = (
            err as { response?: { data?: { error?: string } } }
          )?.response?.data?.error;
          message.error(errMsg || "Failed to delete target");
        }
      },
    });
  };

  const runningCount = tasks.filter(
    (t) => t.status?.toLowerCase() === "running"
  ).length;
  const doneCount = tasks.filter(
    (t) => t.status?.toLowerCase() === "done"
  ).length;

  return (
    <div className="w-full px-1 py-3 sm:px-2 sm:py-4 lg:px-2.5 xl:px-3">
      {/* Background glows */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-[5%] top-24 h-72 w-72 rounded-full bg-cyan-500/7 blur-[100px]" />
        <div className="absolute right-[10%] top-36 h-64 w-64 rounded-full bg-violet-500/7 blur-[90px]" />
      </div>

      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-2xl border border-cyan-200 bg-cyan-50 text-cyan-600 dark:border-cyan-500/20 dark:bg-cyan-500/10 dark:text-cyan-300">
            <FiSettings className="text-[16px]" />
          </div>
          <div>
            <h1 className="text-[18px] font-extrabold text-[#1f2240] dark:text-white/90 sm:text-[20px]">
              Scan Management
            </h1>
            <p className="text-[10.5px] text-gray-500 dark:text-white/45">
              OpenVAS GMP · Start, Stop &amp; Delete scan tasks
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <GMPStatusBadge status={gmpStatus} loading={loadingStatus} />
          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={refreshing}
            className="grid h-8 w-8 place-items-center rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-white/60"
            title="Refresh"
          >
            <FiRefreshCw
              className={`text-[13px] ${refreshing ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* GMP offline warning */}
      {!loadingStatus && (!gmpStatus || !gmpStatus.connected) && (
        <div className="mb-4 flex items-start gap-3 rounded-[20px] border border-orange-200 bg-orange-50 p-4 dark:border-orange-500/20 dark:bg-orange-500/8">
          <FiAlertTriangle className="mt-0.5 shrink-0 text-[15px] text-orange-600 dark:text-orange-300" />
          <div>
            <div className="text-[12.5px] font-bold text-orange-700 dark:text-orange-300">
              Cannot connect to OpenVAS GMP
            </div>
            <div className="mt-0.5 text-[11px] text-orange-600/80 dark:text-orange-300/70">
              {gmpStatus?.error ||
                "Backend cannot reach gvmd socket. Please check that gvmd_socket_vol is mounted in the backend service (docker-compose.yml)."}
            </div>
          </div>
        </div>
      )}

      {/* Stats cards */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: "Total Tasks",
            val: tasks.length,
            icon: <FiSettings />,
            color: "border-violet-200 dark:border-violet-500/20",
            iconCls:
              "bg-violet-50 text-violet-600 border-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/20",
            valCls: "text-violet-700 dark:text-violet-300",
          },
          {
            label: "Running",
            val: runningCount,
            icon: <FiPlay />,
            color: "border-cyan-200 dark:border-cyan-500/20",
            iconCls:
              "bg-cyan-50 text-cyan-600 border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-500/20",
            valCls: "text-cyan-700 dark:text-cyan-300",
          },
          {
            label: "Done",
            val: doneCount,
            icon: <FiCheckCircle />,
            color: "border-emerald-200 dark:border-emerald-500/20",
            iconCls:
              "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20",
            valCls: "text-emerald-700 dark:text-emerald-300",
          },
          {
            label: "Targets",
            val: targets.length,
            icon: <FiTarget />,
            color: "border-sky-200 dark:border-sky-500/20",
            iconCls:
              "bg-sky-50 text-sky-600 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/20",
            valCls: "text-sky-700 dark:text-sky-300",
          },
        ].map(({ label, val, icon, color, iconCls, valCls }) => (
          <div
            key={label}
            className={`overflow-hidden rounded-[22px] border bg-white p-4 shadow-sm dark:bg-white/5 ${color}`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-[14px] border text-[15px] ${iconCls}`}
              >
                {icon}
              </div>
              <div>
                <div className="text-[10px] font-semibold text-gray-500 dark:text-white/45">
                  {label}
                </div>
                <div className={`text-[20px] font-extrabold ${valCls}`}>
                  {val}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {(["tasks", "targets"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={[
                "rounded-2xl border px-4 py-2 text-[12px] font-semibold transition-all",
                activeTab === tab
                  ? "border-transparent bg-linear-to-r from-cyan-500 via-sky-500 to-violet-500 text-white shadow-sm"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-white/65 dark:hover:bg-white/8",
              ].join(" ")}
            >
              {tab === "tasks"
                ? `Scan Tasks (${tasks.length})`
                : `Targets (${targets.length})`}
            </button>
          ))}
        </div>

        {/* "New Target" only — tasks are created in OpenVAS */}
        {activeTab === "targets" && (
          <button
            type="button"
            onClick={() => setShowCreateTarget(true)}
            className="inline-flex items-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-2 text-[12px] font-semibold text-sky-700 hover:bg-sky-100 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300"
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
                <div
                  key={i}
                  className="h-28 animate-pulse rounded-[20px] border border-gray-200 bg-white dark:border-white/10 dark:bg-white/5"
                />
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-gray-200/80 bg-white/90 py-16 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
              <div className="grid h-14 w-14 place-items-center rounded-3xl border border-gray-200 bg-gray-50 text-gray-400 dark:border-white/10 dark:bg-white/5 dark:text-white/30">
                <FiSettings className="text-[22px]" />
              </div>
              <div className="text-[13px] font-semibold text-gray-600 dark:text-white/60">
                No scan tasks found
              </div>
              <div className="text-[11px] text-gray-400 dark:text-white/35">
                Create tasks in OpenVAS, then they will appear here
              </div>
              <button
                type="button"
                onClick={() => void handleRefresh()}
                className="mt-1 inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-[12px] font-semibold text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-white/60"
              >
                <FiRefreshCw className="text-[12px]" />
                Refresh
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
        <div className="rounded-3xl border border-gray-200/80 bg-white/90 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
          {loadingTargets ? (
            <div className="space-y-2 p-5">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-12 animate-pulse rounded-[14px] bg-gray-100 dark:bg-white/8"
                />
              ))}
            </div>
          ) : targets.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <div className="grid h-14 w-14 place-items-center rounded-3xl border border-gray-200 bg-gray-50 text-gray-400 dark:border-white/10 dark:bg-white/5 dark:text-white/30">
                <FiWifi className="text-[22px]" />
              </div>
              <div className="text-[13px] font-semibold text-gray-600 dark:text-white/60">
                No targets defined
              </div>
              <button
                type="button"
                onClick={() => setShowCreateTarget(true)}
                className="mt-1 inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-[12px] font-semibold text-sky-700 hover:bg-sky-100 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300"
              >
                <FiPlus className="text-[12px]" />
                Create Target
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-130">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-white/8">
                    {["Name", "Hosts / Range", "Comment", ""].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-[10px] font-semibold uppercase text-gray-500 dark:text-white/40"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100/60 dark:divide-white/5">
                  {targets.map((target, i) => (
                    <TargetRow
                      key={target.id}
                      target={target}
                      index={i}
                      onDelete={confirmDeleteTarget}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <CreateTargetModal
        open={showCreateTarget}
        onClose={() => setShowCreateTarget(false)}
        onCreated={() => void fetchTargets()}
      />
    </div>
  );
};

export default ScanManagement;
