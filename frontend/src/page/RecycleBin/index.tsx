import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  FiTrash2, FiRefreshCw, FiRotateCcw, FiAlertTriangle,
  FiCheckCircle, FiKey, FiList, FiTarget, FiSettings, FiX,
} from "react-icons/fi";
import { message } from "antd";
import {
  GetGMPTrash, RestoreGMPTrash, EmptyGMPTrash,
  DeleteGMPTrashTask, DeleteGMPTrashTarget,
  DeleteGMPTrashCredential, DeleteGMPTrashPortList,
  type GMPTrashDTO, type GMPTaskDTO, type GMPTargetDTO,
  type GMPCredentialDTO, type GMPPortListDTO,
  CREDENTIAL_TYPE_LABELS,
} from "../../services/gmp";
import { useStateContext } from "../../contexts/ProviderContext";
import { useLanguage } from "../../contexts/LanguageContext";

// ─────────────────────────────────────────────────────────────
// Confirm dialog (portal)
// ─────────────────────────────────────────────────────────────
interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}
const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  title, message: msg, confirmLabel = "Confirm", danger = false, onConfirm, onCancel,
}) => createPortal(
  <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onCancel} />
    <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-[#12101f]">
      <div className="p-6">
        <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${danger ? "bg-red-50 dark:bg-red-500/10" : "bg-amber-50 dark:bg-amber-500/10"}`}>
          <FiAlertTriangle className={`text-[22px] ${danger ? "text-red-500" : "text-amber-500"}`} />
        </div>
        <h3 className="text-[15px] font-bold text-slate-800 dark:text-white/90">{title}</h3>
        <p className="mt-1.5 text-[12.5px] text-slate-500 dark:text-white/45">{msg}</p>
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onCancel}
            className="flex-1 rounded-xl border border-slate-200 py-2 text-[12.5px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/8 dark:text-white/55 dark:hover:bg-white/5 focus:outline-none">
            Cancel
          </button>
          <button type="button" onClick={onConfirm}
            className={`flex-1 rounded-xl py-2 text-[12.5px] font-semibold text-white transition focus:outline-none ${
              danger ? "bg-red-500 hover:bg-red-600" : "bg-amber-500 hover:bg-amber-600"
            }`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  </div>,
  document.body,
);

// ─────────────────────────────────────────────────────────────
// Action buttons: Restore + Permanent Delete
// ─────────────────────────────────────────────────────────────
const Actions: React.FC<{
  onRestore: () => void;
  onDelete: () => void;
  restoring?: boolean;
  deleting?: boolean;
}> = ({ onRestore, onDelete, restoring, deleting }) => (
  <div className="flex items-center justify-end gap-1.5">
    <button type="button" onClick={onRestore} disabled={restoring || deleting}
      title="Restore"
      className="grid h-7 w-7 place-items-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-600 transition hover:bg-emerald-100 disabled:opacity-40 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
      {restoring ? <FiRefreshCw className="animate-spin text-[11px]" /> : <FiRotateCcw className="text-[11px]" />}
    </button>
    <button type="button" onClick={onDelete} disabled={restoring || deleting}
      title="Delete permanently"
      className="grid h-7 w-7 place-items-center rounded-lg border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100 disabled:opacity-40 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
      {deleting ? <FiRefreshCw className="animate-spin text-[11px]" /> : <FiX className="text-[11px]" />}
    </button>
  </div>
);

// ─────────────────────────────────────────────────────────────
// Section wrapper
// ─────────────────────────────────────────────────────────────
const Section: React.FC<{
  icon: React.ReactNode;
  title: string;
  count: number;
  children: React.ReactNode;
}> = ({ icon, title, count, children }) => (
  <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white dark:border-white/8 dark:bg-[#0d0b1a]/60">
    <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-3.5 dark:border-white/8">
      <span className="text-[14px] text-slate-400 dark:text-white/35">{icon}</span>
      <h2 className="text-[13px] font-semibold text-slate-700 dark:text-white/80">{title}</h2>
      <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-100 px-1.5 text-[10.5px] font-bold text-slate-500 dark:bg-white/8 dark:text-white/40">
        {count}
      </span>
    </div>
    {count === 0 ? (
      <div className="flex items-center gap-2 px-5 py-4 text-[12px] text-slate-400 dark:text-white/30">
        <FiCheckCircle className="text-[13px] text-emerald-400" /> No items
      </div>
    ) : (
      <div className="overflow-x-auto" style={{ maxHeight: "320px", overflowY: "auto" }}>
        {children}
      </div>
    )}
  </div>
);

// ─────────────────────────────────────────────────────────────
// Main RecycleBin Page
// ─────────────────────────────────────────────────────────────
const RecycleBinPage: React.FC = () => {
  const { currentColor } = useStateContext();
  const { t } = useLanguage();

  const accentGrad = `linear-gradient(135deg, ${currentColor}, color-mix(in srgb, ${currentColor} 65%, #a855f7))`;

  const [trash,   setTrash]   = useState<GMPTrashDTO | null>(null);
  const [loading, setLoading] = useState(true);

  // Confirm dialogs
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [confirmItem, setConfirmItem]   = useState<{
    id: string; name: string; action: "restore" | "delete"; type: string;
  } | null>(null);

  // Per-item busy state
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [emptyingTrash, setEmptyingTrash] = useState(false);

  const hasFetched = useRef(false);
  const isMounted  = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const fetchTrash = useCallback(async () => {
    setLoading(true);
    try {
      const data = await GetGMPTrash();
      if (isMounted.current) setTrash(data);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      message.error(msg || "Cannot connect to OpenVAS");
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    void fetchTrash();
  }, [fetchTrash]);

  // ── Action handlers ─────────────────────────────────────────

  const setBusy = (id: string, busy: boolean) => {
    setBusyIds(prev => {
      const next = new Set(prev);
      busy ? next.add(id) : next.delete(id);
      return next;
    });
  };

  const handleConfirmAction = async () => {
    if (!confirmItem) return;
    const { id, name, action, type } = confirmItem;
    setConfirmItem(null);
    setBusy(id, true);

    try {
      if (action === "restore") {
        await RestoreGMPTrash(id);
        message.success(`"${name}" restored successfully`);
      } else {
        // Permanent delete based on type
        if (type === "task")       await DeleteGMPTrashTask(id);
        else if (type === "target")     await DeleteGMPTrashTarget(id);
        else if (type === "credential") await DeleteGMPTrashCredential(id);
        else if (type === "portlist")   await DeleteGMPTrashPortList(id);
        message.success(`"${name}" permanently deleted`);
      }
      void fetchTrash();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      message.error(msg || `Failed to ${action} "${name}"`);
    } finally {
      setBusy(id, false);
    }
  };

  const handleEmptyTrash = async () => {
    setConfirmEmpty(false);
    setEmptyingTrash(true);
    try {
      await EmptyGMPTrash();
      message.success("Trashcan emptied");
      void fetchTrash();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      message.error(msg || "Failed to empty trashcan");
    } finally {
      setEmptyingTrash(false);
    }
  };

  const totalItems = trash
    ? (trash.tasks?.length || 0) + (trash.targets?.length || 0) +
      (trash.credentials?.length || 0) + (trash.port_lists?.length || 0)
    : 0;

  const credTypeLabel = (type: string) =>
    CREDENTIAL_TYPE_LABELS[type as keyof typeof CREDENTIAL_TYPE_LABELS] ?? type;

  return (
    <div className="w-full space-y-5">

      {/* ── Header card ── */}
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
            <div
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg sm:h-13 sm:w-13"
              style={{ background: accentGrad, boxShadow: `0 8px 24px -6px ${currentColor}50` }}
            >
              <FiTrash2 className="text-[20px] sm:text-[22px]" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] sm:text-[10.5px]" style={{ color: currentColor }}>
                APPS · RECYCLE BIN
              </p>
              <h1 className="truncate text-[18px] font-bold text-slate-900 sm:text-[20px] dark:text-white/90">
                {t("nav.recycleBin")}
              </h1>
              <p className="mt-0.5 text-[11px] text-slate-500 sm:text-[12px] dark:text-white/45">
                Restore or permanently delete items removed from OpenVAS
              </p>
            </div>
          </div>

          {/* Right actions */}
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={() => { hasFetched.current = false; void fetchTrash(); }} disabled={loading}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/70 bg-white text-slate-500 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/8 dark:bg-white/5 dark:text-white/50">
              <FiRefreshCw className={`text-[13px] ${loading ? "animate-spin" : ""}`} />
            </button>
            <button type="button"
              onClick={() => setConfirmEmpty(true)}
              disabled={loading || emptyingTrash || totalItems === 0}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-[12px] font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
              {emptyingTrash ? <FiRefreshCw className="animate-spin text-[12px]" /> : <FiTrash2 className="text-[12px]" />}
              Empty Trash
            </button>
          </div>
        </div>
      </div>

      {/* ── Contents Summary ── */}
      {!loading && trash && (
        <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white dark:border-white/8 dark:bg-[#0d0b1a]/60">
          <div className="border-b border-slate-100 px-5 py-3 dark:border-white/8">
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">Contents</p>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 dark:border-white/8">
                <th className="px-5 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">Type</th>
                <th className="px-5 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">Items</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/60 dark:divide-white/5">
              {[
                { label: "Credentials", count: trash.credentials?.length || 0, icon: <FiKey /> },
                { label: "Targets",     count: trash.targets?.length     || 0, icon: <FiTarget /> },
                { label: "Tasks",       count: trash.tasks?.length       || 0, icon: <FiSettings /> },
                { label: "Port Lists",  count: trash.port_lists?.length  || 0, icon: <FiList /> },
              ].map(row => (
                <tr key={row.label} className="hover:bg-slate-50/50 dark:hover:bg-white/2">
                  <td className="px-5 py-2.5">
                    <div className="flex items-center gap-2.5 text-[12.5px] font-medium text-slate-700 dark:text-white/70">
                      <span className="text-slate-400 dark:text-white/30">{row.icon}</span>
                      {row.label}
                    </div>
                  </td>
                  <td className="px-5 py-2.5">
                    <span className={`text-[13px] font-semibold ${row.count > 0 ? "text-slate-800 dark:text-white/85" : "text-slate-300 dark:text-white/20"}`}>
                      {row.count}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-28 animate-pulse rounded-xl border border-slate-200/80 bg-slate-50 dark:border-white/8 dark:bg-white/4" />
          ))}
        </div>
      )}

      {/* ── Sections ── */}
      {!loading && trash && (
        <div className="space-y-4">

          {/* ── Credentials ── */}
          <Section icon={<FiKey />} title="Credentials" count={trash.credentials?.length || 0}>
            <table className="w-full min-w-[520px]">
              <thead className="sticky top-0 z-10 bg-white dark:bg-[#0d0b1a]">
                <tr className="border-b border-slate-100 dark:border-white/8">
                  {["Name", "Type", "Login", ""].map(h => (
                    <th key={h} className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/60 dark:divide-white/5">
                {(trash.credentials as GMPCredentialDTO[]).map(cr => (
                  <tr key={cr.id} className="hover:bg-slate-50/50 dark:hover:bg-white/2">
                    <td className="px-5 py-3">
                      <p className="text-[13px] font-semibold text-slate-800 dark:text-white/85">{cr.name}</p>
                      {cr.comment && <p className="text-[10.5px] text-slate-400 dark:text-white/30">{cr.comment}</p>}
                    </td>
                    <td className="px-5 py-3 text-[12px] text-slate-600 dark:text-white/55">{credTypeLabel(cr.type)}</td>
                    <td className="px-5 py-3 font-mono text-[12px] text-slate-500 dark:text-white/40">{cr.login || "—"}</td>
                    <td className="px-5 py-3">
                      <Actions
                        onRestore={() => setConfirmItem({ id: cr.id, name: cr.name, action: "restore", type: "credential" })}
                        onDelete={() => setConfirmItem({ id: cr.id, name: cr.name, action: "delete", type: "credential" })}
                        restoring={busyIds.has(cr.id) && confirmItem?.action === "restore"}
                        deleting={busyIds.has(cr.id)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          {/* ── Targets ── */}
          <Section icon={<FiTarget />} title="Targets" count={trash.targets?.length || 0}>
            <table className="w-full min-w-[640px]">
              <thead className="sticky top-0 z-10 bg-white dark:bg-[#0d0b1a]">
                <tr className="border-b border-slate-100 dark:border-white/8">
                  {["Name", "Hosts", "IPs", "Port List", ""].map(h => (
                    <th key={h} className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/60 dark:divide-white/5">
                {(trash.targets as GMPTargetDTO[]).map(tg => (
                  <tr key={tg.id} className="hover:bg-slate-50/50 dark:hover:bg-white/2">
                    <td className="px-5 py-3">
                      <p className="text-[13px] font-semibold text-slate-800 dark:text-white/85">{tg.name}</p>
                      {tg.comment && <p className="text-[10.5px] text-slate-400 dark:text-white/30">({tg.comment})</p>}
                    </td>
                    <td className="px-5 py-3 font-mono text-[12px] text-slate-600 dark:text-white/55">{tg.hosts || "—"}</td>
                    <td className="px-5 py-3 text-[12px] font-medium" style={{ color: currentColor }}>{tg.max_hosts || "—"}</td>
                    <td className="px-5 py-3 text-[12px] text-slate-500 dark:text-white/45">{tg.port_list_name || "—"}</td>
                    <td className="px-5 py-3">
                      <Actions
                        onRestore={() => setConfirmItem({ id: tg.id, name: tg.name, action: "restore", type: "target" })}
                        onDelete={() => setConfirmItem({ id: tg.id, name: tg.name, action: "delete", type: "target" })}
                        restoring={busyIds.has(tg.id) && confirmItem?.action === "restore"}
                        deleting={busyIds.has(tg.id)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          {/* ── Tasks ── */}
          <Section icon={<FiSettings />} title="Tasks" count={trash.tasks?.length || 0}>
            <table className="w-full min-w-[680px]">
              <thead className="sticky top-0 z-10 bg-white dark:bg-[#0d0b1a]">
                <tr className="border-b border-slate-100 dark:border-white/8">
                  {["Name", "Status", "Reports", "Last Report", "Severity", ""].map(h => (
                    <th key={h} className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/60 dark:divide-white/5">
                {(trash.tasks as GMPTaskDTO[]).map(task => (
                  <tr key={task.id} className="hover:bg-slate-50/50 dark:hover:bg-white/2">
                    <td className="px-5 py-3">
                      <p className="text-[13px] font-semibold text-slate-800 dark:text-white/85">{task.name}</p>
                      {task.target_name && <p className="text-[10.5px] text-slate-400 dark:text-white/30">{task.target_name}</p>}
                    </td>
                    <td className="px-5 py-3">
                      <span className={[
                        "inline-block rounded-full border px-2 py-0.5 text-[9.5px] font-bold",
                        task.status?.toLowerCase() === "done"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"
                          : "border-slate-200 bg-slate-50 text-slate-500 dark:border-white/8 dark:bg-white/5 dark:text-white/40",
                      ].join(" ")}>
                        {task.status || "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-[12.5px] font-semibold" style={{ color: currentColor }}>{task.report_count}</td>
                    <td className="px-5 py-3 text-[11.5px] text-slate-400 dark:text-white/35">{task.last_report_at || "—"}</td>
                    <td className="px-5 py-3">
                      {task.severity > 0 ? (
                        <span className={[
                          "text-[12px] font-bold",
                          task.severity >= 9 ? "text-red-600 dark:text-red-400"
                          : task.severity >= 7 ? "text-orange-600 dark:text-orange-400"
                          : task.severity >= 4 ? "text-yellow-600 dark:text-yellow-400"
                          : "text-emerald-600 dark:text-emerald-400",
                        ].join(" ")}>
                          {task.severity.toFixed(1)}
                        </span>
                      ) : <span className="text-[12px] text-slate-300 dark:text-white/20">N/A</span>}
                    </td>
                    <td className="px-5 py-3">
                      <Actions
                        onRestore={() => setConfirmItem({ id: task.id, name: task.name, action: "restore", type: "task" })}
                        onDelete={() => setConfirmItem({ id: task.id, name: task.name, action: "delete", type: "task" })}
                        restoring={busyIds.has(task.id) && confirmItem?.action === "restore"}
                        deleting={busyIds.has(task.id)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          {/* ── Port Lists ── */}
          <Section icon={<FiList />} title="Port Lists" count={trash.port_lists?.length || 0}>
            <table className="w-full min-w-[520px]">
              <thead className="sticky top-0 z-10 bg-white dark:bg-[#0d0b1a]">
                <tr className="border-b border-slate-100 dark:border-white/8">
                  {["Name", "Total", "TCP", "UDP", ""].map(h => (
                    <th key={h} className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/60 dark:divide-white/5">
                {(trash.port_lists as GMPPortListDTO[]).map(pl => (
                  <tr key={pl.id} className="hover:bg-slate-50/50 dark:hover:bg-white/2">
                    <td className="px-5 py-3">
                      <p className="text-[13px] font-semibold text-slate-800 dark:text-white/85">{pl.name}</p>
                      {pl.comment && <p className="text-[10.5px] text-slate-400 dark:text-white/30">{pl.comment}</p>}
                    </td>
                    <td className="px-5 py-3 text-[12.5px] font-semibold text-slate-700 dark:text-white/70">{pl.total.toLocaleString()}</td>
                    <td className="px-5 py-3 text-[12px] text-slate-500 dark:text-white/45">{pl.tcp.toLocaleString()}</td>
                    <td className="px-5 py-3 text-[12px] text-slate-500 dark:text-white/45">{pl.udp || <span className="text-slate-300 dark:text-white/20">0</span>}</td>
                    <td className="px-5 py-3">
                      <Actions
                        onRestore={() => setConfirmItem({ id: pl.id, name: pl.name, action: "restore", type: "portlist" })}
                        onDelete={() => setConfirmItem({ id: pl.id, name: pl.name, action: "delete", type: "portlist" })}
                        restoring={busyIds.has(pl.id) && confirmItem?.action === "restore"}
                        deleting={busyIds.has(pl.id)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          {/* Total empty state */}
          {totalItems === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200/70 bg-white py-16 text-center dark:border-white/8 dark:bg-white/3">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-white/5">
                <FiTrash2 className="text-[24px] text-slate-300 dark:text-white/20" />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-slate-500 dark:text-white/45">Recycle Bin is empty</p>
                <p className="mt-1 text-[12px] text-slate-400 dark:text-white/30">Deleted items will appear here</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Empty Trash confirm ── */}
      {confirmEmpty && (
        <ConfirmDialog
          title="Empty Recycle Bin?"
          message={`This will permanently delete all ${totalItems} item${totalItems !== 1 ? "s" : ""} from OpenVAS. This action cannot be undone.`}
          confirmLabel="Empty Trash"
          danger
          onConfirm={handleEmptyTrash}
          onCancel={() => setConfirmEmpty(false)}
        />
      )}

      {/* ── Per-item action confirm ── */}
      {confirmItem && (
        <ConfirmDialog
          title={confirmItem.action === "restore" ? "Restore Item?" : "Delete Permanently?"}
          message={
            confirmItem.action === "restore"
              ? `Restore "${confirmItem.name}" back to OpenVAS?`
              : `Permanently delete "${confirmItem.name}"? This cannot be undone.`
          }
          confirmLabel={confirmItem.action === "restore" ? "Restore" : "Delete Permanently"}
          danger={confirmItem.action === "delete"}
          onConfirm={() => void handleConfirmAction()}
          onCancel={() => setConfirmItem(null)}
        />
      )}
    </div>
  );
};

export default RecycleBinPage;
