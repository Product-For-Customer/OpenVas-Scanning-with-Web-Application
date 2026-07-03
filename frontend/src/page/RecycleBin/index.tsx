import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  FiTrash2, FiRefreshCw, FiRotateCcw,
  FiKey, FiList, FiTarget, FiSettings, FiX, FiSearch,
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
import { useAuth } from "../../contexts/AuthContext";

// ─── Category filter types ────────────────────────────────────────────────────
type CategoryTab = "all" | "tasks" | "targets" | "credentials" | "portlists";

// ─── Confirm dialog (portal) ─────────────────────────────────────────────────
interface ConfirmDialogProps {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  currentColor: string;
  accentGrad: string;
  onConfirm: () => void;
  onCancel: () => void;
}
const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  title, body, confirmLabel, danger = false,
  currentColor, accentGrad, onConfirm, onCancel,
}) => {
  const restoreGrad = accentGrad;
  const deleteGrad  = "linear-gradient(135deg,#ef4444,#dc2626)";
  const iconGrad    = danger ? deleteGrad : restoreGrad;
  const labelColor  = danger ? "#ef4444" : currentColor;
  const shadow      = danger ? "#ef444430" : `${currentColor}30`;
  const Icon        = danger ? FiTrash2 : FiRotateCcw;
  const { t } = useLanguage();

  return createPortal(
    <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[3px]" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl bg-white dark:bg-[#12101f]"
        style={{ boxShadow: `0 24px 64px -12px ${shadow},0 8px 32px rgba(0,0,0,.20)` }}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-white/8">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white"
              style={{ background: iconGrad }}>
              <Icon className="text-[13px]" />
            </span>
            <div>
              <p className="text-[9.5px] font-bold uppercase tracking-widest" style={{ color: labelColor }}>
                {t("recycleBin.badge")}
              </p>
              <h3 className="text-[14px] font-bold text-slate-800 dark:text-white/90">{title}</h3>
            </div>
          </div>
          <button type="button" onClick={onCancel}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 dark:text-white/35 dark:hover:bg-white/8">
            <FiX className="text-[15px]" />
          </button>
        </div>
        <div className="px-5 py-4">
          <p className="text-[12.5px] leading-6 text-slate-500 dark:text-white/45">{body}</p>
        </div>
        <div className="flex gap-2.5 border-t border-slate-100 px-5 py-3.5 dark:border-white/8">
          <button type="button" onClick={onCancel}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 text-[12.5px] font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/8 dark:text-white/55 dark:hover:bg-white/5">
            {t("common.cancel")}
          </button>
          <button type="button" onClick={onConfirm}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[12.5px] font-semibold text-white transition hover:opacity-90"
            style={{ background: iconGrad }}>
            <Icon className="text-[12px]" />
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

// ─── Row checkbox ─────────────────────────────────────────────────────────────
const RowCheck: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  accent: string;
}> = ({ checked, onChange, accent }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className={[
      "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition",
      checked
        ? "border-blue-500 bg-blue-500 text-white"
        : "border-slate-300 bg-white dark:border-white/20 dark:bg-white/5",
    ].join(" ")}
    style={checked ? { background: accent } : undefined}
  >
    {checked && (
      <svg viewBox="0 0 10 8" className="h-2.5 w-2.5 fill-none stroke-white stroke-2">
        <polyline points="1,4 3.5,7 9,1" />
      </svg>
    )}
  </button>
);

// ─── Action buttons ───────────────────────────────────────────────────────────
const Actions: React.FC<{
  onRestore: () => void;
  onDelete: () => void;
  busy?: boolean;
}> = ({ onRestore, onDelete, busy }) => {
  const { t } = useLanguage();
  const { can } = useAuth();
  // View-only roles (threat_intel granted but not Manage) see trash
  // contents but get no restore/delete controls at all.
  if (!can("threat_intel", "manage")) {
    return <span className="text-[11px] text-slate-300 dark:text-white/15">—</span>;
  }
  return (
    <div className="flex items-center justify-end gap-1.5">
      <button type="button" onClick={onRestore} disabled={busy} title={t("recycleBin.restore")}
        className="grid h-7 w-7 place-items-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-600 transition hover:bg-emerald-100 disabled:opacity-40 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
        {busy ? <FiRefreshCw className="animate-spin text-[11px]" /> : <FiRotateCcw className="text-[11px]" />}
      </button>
      <button type="button" onClick={onDelete} disabled={busy} title={t("recycleBin.deleteForever")}
        className="grid h-7 w-7 place-items-center rounded-lg border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100 disabled:opacity-40 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
        {busy ? <FiRefreshCw className="animate-spin text-[11px]" /> : <FiX className="text-[11px]" />}
      </button>
    </div>
  );
};

// ─── Section wrapper ──────────────────────────────────────────────────────────
const Section: React.FC<{
  icon: React.ReactNode;
  title: string;
  count: number;
  selected: number;
  onSelectAll: (v: boolean) => void;
  allSelected: boolean;
  accentGrad: string;
  currentColor: string;
  children: React.ReactNode;
}> = ({ icon, title, count, selected, onSelectAll, allSelected, accentGrad, currentColor, children }) => {
  const { t } = useLanguage();
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white dark:border-white/8 dark:bg-[#0d0b1a]/60">
      <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-3.5 dark:border-white/8">
        {count > 0 && (
          <RowCheck checked={allSelected} onChange={onSelectAll} accent={currentColor} />
        )}
        <span className="text-[14px] text-slate-400 dark:text-white/35">{icon}</span>
        <h2 className="text-[13px] font-bold text-slate-800 dark:text-white/90">{title}</h2>
        <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-100 px-1.5 text-[10.5px] font-bold text-slate-500 dark:bg-white/8 dark:text-white/40">
          {count}
        </span>
        {selected > 0 && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
            style={{ background: accentGrad }}>
            {t("recycleBin.selected").replace("{n}", String(selected))}
          </span>
        )}
      </div>
      {count === 0 ? (
        <div className="flex items-center gap-2 px-5 py-4 text-[12px] text-slate-400 dark:text-white/30">
          <FiRotateCcw className="text-[13px] text-emerald-400" /> {t("recycleBin.noItems")}
        </div>
      ) : (
        <div className="overflow-x-auto" style={{ maxHeight: "320px", overflowY: "auto" }}>
          {children}
        </div>
      )}
    </div>
  );
};

// ─── Main RecycleBin Page ─────────────────────────────────────────────────────
const RecycleBinPage: React.FC = () => {
  const { currentColor } = useStateContext();
  const { t } = useLanguage();
  const { can } = useAuth();
  const canManageScan = can("threat_intel", "manage");
  const accentGrad = `linear-gradient(135deg, ${currentColor}, color-mix(in srgb, ${currentColor} 65%, #a855f7))`;

  const [trash,         setTrash]         = useState<GMPTrashDTO | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [emptyingTrash, setEmptyingTrash] = useState(false);
  const [busyIds,       setBusyIds]       = useState<Set<string>>(new Set());

  // ── UI state ────────────────────────────────────────────────────
  const [searchQuery,    setSearchQuery]    = useState("");
  const [activeCategory, setActiveCategory] = useState<CategoryTab>("all");

  // ── Selection state ──────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── Confirm dialogs ──────────────────────────────────────────────
  const [confirmEmpty,  setConfirmEmpty]  = useState(false);
  const [confirmItem,   setConfirmItem]   = useState<{
    id: string; name: string; action: "restore" | "delete"; type: string;
  } | null>(null);
  const [confirmBulk, setConfirmBulk] = useState<"restore" | "delete" | null>(null);

  const hasFetched = useRef(false);
  const isMounted  = useRef(true);
  useEffect(() => { isMounted.current = true; return () => { isMounted.current = false; }; }, []);

  // ── Data fetch ───────────────────────────────────────────────────
  const fetchTrash = useCallback(async () => {
    setLoading(true);
    try {
      const data = await GetGMPTrash();
      if (isMounted.current) { setTrash(data); setSelectedIds(new Set()); }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      message.error(msg || t("recycleBin.connectError"));
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    void fetchTrash();
  }, [fetchTrash]);

  // ── Counts ───────────────────────────────────────────────────────
  const taskCount  = trash?.tasks?.length       || 0;
  const tgCount    = trash?.targets?.length     || 0;
  const crCount    = trash?.credentials?.length || 0;
  const plCount    = trash?.port_lists?.length  || 0;
  const totalItems = taskCount + tgCount + crCount + plCount;

  // ── Filtered items (search + category) ───────────────────────────
  const q = searchQuery.toLowerCase();
  const match = (name: string) => !q || name.toLowerCase().includes(q);

  const filteredTasks  = useMemo(() => (trash?.tasks        || []).filter(i => match(i.name)), [trash, q]);
  const filteredTgs    = useMemo(() => (trash?.targets      || []).filter(i => match(i.name)), [trash, q]);
  const filteredCreds  = useMemo(() => (trash?.credentials  || []).filter(i => match(i.name)), [trash, q]);
  const filteredPls    = useMemo(() => (trash?.port_lists   || []).filter(i => match(i.name)), [trash, q]);

  const showTasks  = activeCategory === "all" || activeCategory === "tasks";
  const showTgs    = activeCategory === "all" || activeCategory === "targets";
  const showCreds  = activeCategory === "all" || activeCategory === "credentials";
  const showPls    = activeCategory === "all" || activeCategory === "portlists";

  // ── All visible IDs (for bulk ops) ──────────────────────────────
  const visibleIds = useMemo(() => {
    const ids: string[] = [];
    if (showTasks)  filteredTasks.forEach(i => ids.push(i.id));
    if (showTgs)    filteredTgs.forEach(i => ids.push(i.id));
    if (showCreds)  filteredCreds.forEach(i => ids.push(i.id));
    if (showPls)    filteredPls.forEach(i => ids.push(i.id));
    return ids;
  }, [showTasks, showTgs, showCreds, showPls, filteredTasks, filteredTgs, filteredCreds, filteredPls]);

  // ── Selection helpers ────────────────────────────────────────────
  const toggleId = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSection = (ids: string[], val: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => val ? next.add(id) : next.delete(id));
      return next;
    });
  };

  const selectedCount = [...selectedIds].filter(id => visibleIds.includes(id)).length;

  // ── Type lookup for bulk ops ────────────────────────────────────
  const typeMap = useMemo(() => {
    const m = new Map<string, string>();
    (trash?.tasks        || []).forEach(i => m.set(i.id, "task"));
    (trash?.targets      || []).forEach(i => m.set(i.id, "target"));
    (trash?.credentials  || []).forEach(i => m.set(i.id, "credential"));
    (trash?.port_lists   || []).forEach(i => m.set(i.id, "portlist"));
    return m;
  }, [trash]);

  const nameMap = useMemo(() => {
    const m = new Map<string, string>();
    [...(trash?.tasks||[]), ...(trash?.targets||[]), ...(trash?.credentials||[]), ...(trash?.port_lists||[])]
      .forEach(i => m.set(i.id, i.name));
    return m;
  }, [trash]);

  // ── Per-item busy ────────────────────────────────────────────────
  const setBusy = (id: string, busy: boolean) =>
    setBusyIds(prev => { const n = new Set(prev); busy ? n.add(id) : n.delete(id); return n; });

  // ── Single item action ───────────────────────────────────────────
  const handleConfirmAction = async () => {
    if (!confirmItem) return;
    const { id, name, action, type } = confirmItem;
    setConfirmItem(null);
    setBusy(id, true);
    try {
      if (action === "restore") {
        await RestoreGMPTrash(id);
        message.success(t("recycleBin.restoredSuccess").replace("{name}", name));
      } else {
        if (type === "task")       await DeleteGMPTrashTask(id);
        else if (type === "target")     await DeleteGMPTrashTarget(id);
        else if (type === "credential") await DeleteGMPTrashCredential(id);
        else if (type === "portlist")   await DeleteGMPTrashPortList(id);
        message.success(t("recycleBin.deletedSuccess").replace("{name}", name));
      }
      hasFetched.current = false;
      void fetchTrash();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      message.error(msg || t(action === "restore" ? "recycleBin.restoreFailed" : "recycleBin.deletePermFailed").replace("{name}", name));
    } finally {
      setBusy(id, false);
    }
  };

  // ── Bulk action ──────────────────────────────────────────────────
  const handleBulkAction = async () => {
    if (!confirmBulk) return;
    const action = confirmBulk;
    setConfirmBulk(null);
    const ids = [...selectedIds].filter(id => visibleIds.includes(id));
    setSelectedIds(new Set());

    for (const id of ids) {
      setBusy(id, true);
      const name = nameMap.get(id) ?? id;
      const type = typeMap.get(id) ?? "";
      try {
        if (action === "restore") {
          await RestoreGMPTrash(id);
        } else {
          if (type === "task")       await DeleteGMPTrashTask(id);
          else if (type === "target")     await DeleteGMPTrashTarget(id);
          else if (type === "credential") await DeleteGMPTrashCredential(id);
          else if (type === "portlist")   await DeleteGMPTrashPortList(id);
        }
      } catch {
        message.error(t(action === "restore" ? "recycleBin.restoreFailed" : "recycleBin.deletePermFailed").replace("{name}", name));
      } finally {
        setBusy(id, false);
      }
    }
    message.success(t(action === "restore" ? "recycleBin.bulkRestoredSuccess" : "recycleBin.bulkDeletedSuccess").replace("{n}", String(ids.length)));
    hasFetched.current = false;
    void fetchTrash();
  };

  // ── Empty trash ──────────────────────────────────────────────────
  const handleEmptyTrash = async () => {
    setConfirmEmpty(false);
    setEmptyingTrash(true);
    try {
      await EmptyGMPTrash();
      message.success(t("recycleBin.emptySuccess"));
      hasFetched.current = false;
      void fetchTrash();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      message.error(msg || t("recycleBin.failedEmpty"));
    } finally {
      setEmptyingTrash(false);
    }
  };

  const credTypeLabel = (type: string) =>
    CREDENTIAL_TYPE_LABELS[type as keyof typeof CREDENTIAL_TYPE_LABELS] ?? type;

  // ── Category tabs config ─────────────────────────────────────────
  const CATS: { key: CategoryTab; label: string; count: number; icon: React.ReactNode }[] = [
    { key: "all",         label: t("recycleBin.all"),         count: totalItems, icon: <FiTrash2 /> },
    { key: "tasks",       label: t("recycleBin.tasks"),       count: taskCount,  icon: <FiSettings /> },
    { key: "targets",     label: t("recycleBin.targets"),     count: tgCount,    icon: <FiTarget /> },
    { key: "credentials", label: t("recycleBin.credentials"), count: crCount,    icon: <FiKey /> },
    { key: "portlists",   label: t("recycleBin.portLists"),   count: plCount,    icon: <FiList /> },
  ];

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
              <FiTrash2 className="text-[20px] sm:text-[22px]" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] sm:text-[10.5px]" style={{ color: currentColor }}>
                {t("recycleBin.badge")}
              </p>
              <h1 className="truncate text-[18px] font-bold text-slate-900 sm:text-[20px] dark:text-white/90">
                {t("nav.recycleBin")}
              </h1>
              <p className="mt-0.5 text-[11px] text-slate-500 sm:text-[12px] dark:text-white/45">
                {t("recycleBin.subtitle")}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={() => { hasFetched.current = false; void fetchTrash(); }} disabled={loading}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/70 bg-white text-slate-500 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/8 dark:bg-white/5 dark:text-white/50">
              <FiRefreshCw className={`text-[13px] ${loading ? "animate-spin" : ""}`} />
            </button>
            {canManageScan && (
              <button type="button" onClick={() => setConfirmEmpty(true)}
                disabled={loading || emptyingTrash || totalItems === 0}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-[12px] font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                {emptyingTrash ? <FiRefreshCw className="animate-spin text-[12px]" /> : <FiTrash2 className="text-[12px]" />}
                {t("recycleBin.emptyTrash")}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Category tabs + Search + Bulk actions ── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Category tabs */}
        {CATS.map(cat => (
          <button key={cat.key} type="button"
            onClick={() => { setActiveCategory(cat.key); setSelectedIds(new Set()); }}
            style={activeCategory === cat.key ? { background: accentGrad } : undefined}
            className={[
              "flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-[11.5px] font-bold transition-all",
              activeCategory === cat.key
                ? "border-transparent text-white"
                : "border-slate-200/70 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/8",
            ].join(" ")}>
            <span className="text-[12px]">{cat.icon}</span>
            {cat.label}
            <span className={[
              "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9.5px] font-bold",
              activeCategory === cat.key
                ? "bg-white/25 text-white"
                : "bg-slate-100 text-slate-500 dark:bg-white/8 dark:text-white/40",
            ].join(" ")}>
              {cat.count}
            </span>
          </button>
        ))}

        {/* Search */}
        <div className="relative ml-auto min-w-50">
          <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400 dark:text-white/30" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setSelectedIds(new Set()); }}
            placeholder={t("recycleBin.searchAll")}
            className="w-full rounded-lg border border-slate-200/80 bg-white py-2 pl-8 pr-3 text-[12px] text-slate-700 placeholder-slate-400 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100 dark:border-white/8 dark:bg-white/5 dark:text-white/85 dark:placeholder-white/25"
          />
        </div>
      </div>

      {/* ── Bulk action bar (appears when items selected) — restore/delete
           only for roles with threat_intel Manage; a View-only role can
           still select rows but only sees the clear-selection control. ── */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-4 py-3 dark:border-white/8 dark:bg-[#0d0b1a]/60">
          <span className="text-[12px] font-semibold text-slate-700 dark:text-white/75">
            {t("recycleBin.selected").replace("{n}", String(selectedCount))}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {canManageScan && (
              <>
                <button type="button" onClick={() => setConfirmBulk("restore")}
                  className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-[12px] font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                  <FiRotateCcw className="text-[12px]" />
                  {t("recycleBin.bulkRestore").replace("{n}", String(selectedCount))}
                </button>
                <button type="button" onClick={() => setConfirmBulk("delete")}
                  className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-1.5 text-[12px] font-semibold text-red-700 transition hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                  <FiTrash2 className="text-[12px]" />
                  {t("recycleBin.bulkDelete").replace("{n}", String(selectedCount))}
                </button>
              </>
            )}
            <button type="button" onClick={() => setSelectedIds(new Set())}
              className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/50">
              <FiX className="text-[12px]" />
            </button>
          </div>
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

      {/* ── No results from search ── */}
      {!loading && trash && q &&
        filteredTasks.length === 0 && filteredTgs.length === 0 &&
        filteredCreds.length === 0 && filteredPls.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-200/70 bg-white py-12 text-center dark:border-white/8 dark:bg-white/3">
          <FiSearch className="text-[24px] text-slate-300 dark:text-white/20" />
          <p className="text-[13px] text-slate-500 dark:text-white/40">
            {t("recycleBin.noResults").replace("{q}", searchQuery)}
          </p>
        </div>
      )}

      {/* ── Sections ── */}
      {!loading && trash && (
        <div className="space-y-4">

          {/* ── Credentials ── */}
          {showCreds && (
            <Section
              icon={<FiKey />} title={t("recycleBin.credentials")}
              count={filteredCreds.length}
              selected={filteredCreds.filter(i => selectedIds.has(i.id)).length}
              allSelected={filteredCreds.length > 0 && filteredCreds.every(i => selectedIds.has(i.id))}
              onSelectAll={v => toggleSection(filteredCreds.map(i => i.id), v)}
              accentGrad={accentGrad} currentColor={currentColor}
            >
              <table className="w-full min-w-130">
                <thead className="sticky top-0 z-10 bg-white dark:bg-[#0d0b1a]">
                  <tr className="border-b border-slate-100 dark:border-white/8">
                    <th className="w-8 px-3 py-2.5" />
                    {[t("recycleBin.name"), t("recycleBin.type"), t("recycleBin.login"), ""].map(h => (
                      <th key={h} className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/60 dark:divide-white/5">
                  {filteredCreds.map((cr: GMPCredentialDTO) => (
                    <tr key={cr.id} className="hover:bg-slate-50/50 dark:hover:bg-white/2">
                      <td className="px-3 py-3">
                        <RowCheck checked={selectedIds.has(cr.id)} onChange={() => toggleId(cr.id)} accent={currentColor} />
                      </td>
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
                          busy={busyIds.has(cr.id)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          {/* ── Targets ── */}
          {showTgs && (
            <Section
              icon={<FiTarget />} title={t("recycleBin.targets")}
              count={filteredTgs.length}
              selected={filteredTgs.filter(i => selectedIds.has(i.id)).length}
              allSelected={filteredTgs.length > 0 && filteredTgs.every(i => selectedIds.has(i.id))}
              onSelectAll={v => toggleSection(filteredTgs.map(i => i.id), v)}
              accentGrad={accentGrad} currentColor={currentColor}
            >
              <table className="w-full min-w-160">
                <thead className="sticky top-0 z-10 bg-white dark:bg-[#0d0b1a]">
                  <tr className="border-b border-slate-100 dark:border-white/8">
                    <th className="w-8 px-3 py-2.5" />
                    {[t("recycleBin.name"), t("recycleBin.hosts"), t("recycleBin.ips"), t("recycleBin.portList"), ""].map(h => (
                      <th key={h} className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/60 dark:divide-white/5">
                  {filteredTgs.map((tg: GMPTargetDTO) => (
                    <tr key={tg.id} className="hover:bg-slate-50/50 dark:hover:bg-white/2">
                      <td className="px-3 py-3">
                        <RowCheck checked={selectedIds.has(tg.id)} onChange={() => toggleId(tg.id)} accent={currentColor} />
                      </td>
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
                          busy={busyIds.has(tg.id)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          {/* ── Tasks ── */}
          {showTasks && (
            <Section
              icon={<FiSettings />} title={t("recycleBin.tasks")}
              count={filteredTasks.length}
              selected={filteredTasks.filter(i => selectedIds.has(i.id)).length}
              allSelected={filteredTasks.length > 0 && filteredTasks.every(i => selectedIds.has(i.id))}
              onSelectAll={v => toggleSection(filteredTasks.map(i => i.id), v)}
              accentGrad={accentGrad} currentColor={currentColor}
            >
              <table className="w-full min-w-170">
                <thead className="sticky top-0 z-10 bg-white dark:bg-[#0d0b1a]">
                  <tr className="border-b border-slate-100 dark:border-white/8">
                    <th className="w-8 px-3 py-2.5" />
                    {[t("recycleBin.name"), t("recycleBin.status"), t("recycleBin.reports"), t("recycleBin.lastReport"), t("recycleBin.severity"), ""].map(h => (
                      <th key={h} className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/60 dark:divide-white/5">
                  {filteredTasks.map((task: GMPTaskDTO) => (
                    <tr key={task.id} className="hover:bg-slate-50/50 dark:hover:bg-white/2">
                      <td className="px-3 py-3">
                        <RowCheck checked={selectedIds.has(task.id)} onChange={() => toggleId(task.id)} accent={currentColor} />
                      </td>
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
                          busy={busyIds.has(task.id)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          {/* ── Port Lists ── */}
          {showPls && (
            <Section
              icon={<FiList />} title={t("recycleBin.portLists")}
              count={filteredPls.length}
              selected={filteredPls.filter(i => selectedIds.has(i.id)).length}
              allSelected={filteredPls.length > 0 && filteredPls.every(i => selectedIds.has(i.id))}
              onSelectAll={v => toggleSection(filteredPls.map(i => i.id), v)}
              accentGrad={accentGrad} currentColor={currentColor}
            >
              <table className="w-full min-w-130">
                <thead className="sticky top-0 z-10 bg-white dark:bg-[#0d0b1a]">
                  <tr className="border-b border-slate-100 dark:border-white/8">
                    <th className="w-8 px-3 py-2.5" />
                    {[t("recycleBin.name"), t("recycleBin.total"), t("threatConfig.tcp"), t("threatConfig.udp"), ""].map(h => (
                      <th key={h} className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/60 dark:divide-white/5">
                  {filteredPls.map((pl: GMPPortListDTO) => (
                    <tr key={pl.id} className="hover:bg-slate-50/50 dark:hover:bg-white/2">
                      <td className="px-3 py-3">
                        <RowCheck checked={selectedIds.has(pl.id)} onChange={() => toggleId(pl.id)} accent={currentColor} />
                      </td>
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
                          busy={busyIds.has(pl.id)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          {/* ── Global empty state ── */}
          {totalItems === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200/70 bg-white py-16 text-center dark:border-white/8 dark:bg-white/3">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-white/5">
                <FiTrash2 className="text-[24px] text-slate-300 dark:text-white/20" />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-slate-500 dark:text-white/45">{t("recycleBin.empty")}</p>
                <p className="mt-1 text-[12px] text-slate-400 dark:text-white/30">{t("recycleBin.emptyDesc")}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Confirm: Empty Trash ── */}
      {confirmEmpty && (
        <ConfirmDialog
          title={t("recycleBin.emptyConfirmTitle")}
          body={t("recycleBin.emptyConfirmMsg").replace("{n}", String(totalItems))}
          confirmLabel={t("recycleBin.emptyTrash")}
          danger currentColor={currentColor} accentGrad={accentGrad}
          onConfirm={handleEmptyTrash}
          onCancel={() => setConfirmEmpty(false)}
        />
      )}

      {/* ── Confirm: Single item ── */}
      {confirmItem && (
        <ConfirmDialog
          title={confirmItem.action === "restore" ? t("recycleBin.restoreTitle") : t("recycleBin.deleteTitle")}
          body={
            confirmItem.action === "restore"
              ? t("recycleBin.restoreMsg").replace("{name}", confirmItem.name)
              : t("recycleBin.deleteItemMsg").replace("{name}", confirmItem.name)
          }
          confirmLabel={confirmItem.action === "restore" ? t("recycleBin.restore") : t("recycleBin.deleteForever")}
          danger={confirmItem.action === "delete"}
          currentColor={currentColor} accentGrad={accentGrad}
          onConfirm={() => void handleConfirmAction()}
          onCancel={() => setConfirmItem(null)}
        />
      )}

      {/* ── Confirm: Bulk action ── */}
      {confirmBulk && (
        <ConfirmDialog
          title={confirmBulk === "restore" ? t("recycleBin.restoreTitle") : t("recycleBin.deleteTitle")}
          body={
            t(confirmBulk === "restore" ? "recycleBin.bulkRestoreConfirm" : "recycleBin.bulkDeleteConfirm").replace("{n}", String(selectedCount))
          }
          confirmLabel={confirmBulk === "restore" ? t("recycleBin.restore") : t("recycleBin.deleteForever")}
          danger={confirmBulk === "delete"}
          currentColor={currentColor} accentGrad={accentGrad}
          onConfirm={() => void handleBulkAction()}
          onCancel={() => setConfirmBulk(null)}
        />
      )}
    </div>
  );
};

export default RecycleBinPage;
