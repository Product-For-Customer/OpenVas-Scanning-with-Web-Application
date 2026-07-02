import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  FiSliders, FiKey, FiList, FiTarget, FiPlus, FiTrash2,
  FiRefreshCw, FiX, FiChevronLeft, FiChevronRight,
  FiEye, FiEyeOff, FiAlertTriangle, FiCheckCircle, FiUpload, FiEdit2, FiSearch,
} from "react-icons/fi";
import { CustomSelect, CustomMultiSelect } from "../../component/ui/CustomSelect";
import { message } from "antd";
import {
  ListGMPPortLists, CreateGMPPortList, DeleteGMPPortList, ImportGMPPortList, UpdateGMPPortList,
  GetGMPPortListDetail, CreateGMPPortRange, DeleteGMPPortRange,
  ListGMPCredentials, CreateGMPCredential, DeleteGMPCredential, UpdateGMPCredential,
  ListGMPTargets, CreateGMPTarget, DeleteGMPTarget, UpdateGMPTarget,
  ListGMPTasks,
  type GMPPortListDTO, type GMPPortRangeDTO, type GMPCredentialDTO, type GMPTargetDTO,
  type GMPTaskDTO,
  type CreatePortListRequest, type CreateCredentialRequest, type CreateTargetRequest,
  type GMPCredentialType,
} from "../../services/gmp";
import { useStateContext } from "../../contexts/ProviderContext";
import { useLanguage } from "../../contexts/LanguageContext";
import type { TranslationKey } from "../../locales";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

type ActiveTab = "credentials" | "portlists" | "targets";

type TFn = (key: TranslationKey, vars?: Record<string, string | number>) => string;

const getCredTypes = (t: TFn): { value: GMPCredentialType; label: string }[] => [
  { value: "up",    label: t("threatConfig.credTypeUp") },
  { value: "usk",   label: t("threatConfig.credTypeUsk") },
  { value: "snmp",  label: t("threatConfig.credTypeSnmp") },
  { value: "smime", label: t("threatConfig.credTypeSmime") },
  { value: "pgp",   label: t("threatConfig.credTypePgp") },
  { value: "pw",    label: t("threatConfig.credTypePw") },
  { value: "cc",    label: t("threatConfig.credTypeCc") },
];

// ─────────────────────────────────────────────────────────────
// Shared input styles
// ─────────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-lg border border-slate-200/80 bg-white px-3.5 py-2.5 text-[12.5px] text-slate-700 placeholder-slate-400 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100 dark:border-white/8 dark:bg-white/5 dark:text-white/85 dark:placeholder-white/25 dark:focus:ring-blue-500/10";
const labelCls = "mb-1.5 block text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/35";


// ─────────────────────────────────────────────────────────────
// Confirm Delete Dialog (portal)
// ─────────────────────────────────────────────────────────────
const ConfirmDeleteDialog: React.FC<{
  name: string;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ name, onConfirm, onCancel }) => {
  const { t } = useLanguage();
  return createPortal(
    <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-[#12101f]">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-500/10">
          <FiAlertTriangle className="text-[22px] text-red-500" />
        </div>
        <h3 className="text-[15px] font-bold text-slate-800 dark:text-white/90">{t("threatConfig.confirmDelete")}</h3>
        <p className="mt-1.5 text-[12.5px] text-slate-500 dark:text-white/45">
          {t("threatConfig.deleteMsg").replace("{name}", name)}
        </p>
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onCancel}
            className="flex-1 rounded-xl border border-slate-200 py-2 text-[12.5px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/8 dark:text-white/55 dark:hover:bg-white/5 focus:outline-none">
            {t("common.cancel")}
          </button>
          <button type="button" onClick={onConfirm}
            className="flex-1 rounded-xl bg-red-500 py-2 text-[12.5px] font-semibold text-white transition hover:bg-red-600 focus:outline-none">
            {t("common.delete")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ─────────────────────────────────────────────────────────────
// File upload area (shared by Port Lists tab)
// ─────────────────────────────────────────────────────────────
const FileUploadArea: React.FC<{
  file: File | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  accept?: string;
  onChange: (f: File | null) => void;
}> = ({ file, inputRef, accept, onChange }) => {
  const { t } = useLanguage();
  return (
  <div
    onClick={() => inputRef.current?.click()}
    className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200/80 bg-white px-3.5 py-2.5 text-[12.5px] text-slate-500 transition hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/45 dark:hover:bg-white/8"
  >
    <FiUpload className="shrink-0 text-[14px] text-slate-400 dark:text-white/30" />
    <span className="min-w-0 flex-1 truncate">
      {file ? file.name : t("threatConfig.chooseFile")}
    </span>
    <input
      ref={inputRef}
      type="file"
      accept={accept}
      className="hidden"
      onChange={(e) => {
        const f = e.target.files?.[0] ?? null;
        onChange(f);
        e.target.value = "";
      }}
    />
  </div>
  );
};

// ─────────────────────────────────────────────────────────────
// File-as-text input (reads file content → calls onChange with text)
// ─────────────────────────────────────────────────────────────
const FileTextInput: React.FC<{
  onChange: (text: string) => void;
  accept?: string;
  placeholder?: string;
}> = ({ onChange, accept, placeholder }) => {
  const { t } = useLanguage();
  const ref = useRef<HTMLInputElement | null>(null);
  const [filename, setFilename] = useState<string>("");

  return (
    <div
      onClick={() => ref.current?.click()}
      className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200/80 bg-white px-3.5 py-2.5 text-[12.5px] text-slate-500 transition hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/45 dark:hover:bg-white/8"
    >
      <FiUpload className="shrink-0 text-[14px] text-slate-400 dark:text-white/30" />
      <span className="min-w-0 flex-1 truncate">{filename || placeholder || t("threatConfig.chooseFile")}</span>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const reader = new FileReader();
          reader.onload = (ev) => onChange((ev.target?.result as string) || "");
          reader.readAsText(f);
          setFilename(f.name);
          e.target.value = "";
        }}
      />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Port Lists tab
// ─────────────────────────────────────────────────────────────
// IANA standard port lists — Edit is always locked, Delete allowed if not in use
const IANA_PORT_LIST_NAMES = [
  "All IANA assigned TCP",
  "All IANA assigned TCP and UDP",
  "All TCP and Nmap top 100 UDP",
] as const;

const isIANAPortList = (pl: GMPPortListDTO): boolean =>
  IANA_PORT_LIST_NAMES.some(name => pl.name === name || pl.name.startsWith(name));

const PortListsTab: React.FC<{ currentColor: string; accentGrad: string }> = ({
  currentColor, accentGrad,
}) => {
  const { t } = useLanguage();
  const [lists,   setLists]   = useState<GMPPortListDTO[]>([]);
  const [targets, setTargets] = useState<GMPTargetDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<GMPPortListDTO | null>(null);
  const [form, setForm] = useState<CreatePortListRequest>({ name: "Unnamed", comment: "", port_range: "T:1-5,7,9,U:1-3,5,7,9" });
  const [saving, setSaving] = useState(false);
  const [deleteItem, setDeleteItem] = useState<GMPPortListDTO | null>(null);
  // Port range mode for Create modal
  const [portRangeMode, setPortRangeMode] = useState<"manual" | "file">("manual");
  const [portRangeFile, setPortRangeFile] = useState<File | null>(null);
  const portRangeFileRef = useRef<HTMLInputElement>(null);
  // Import modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);
  // Port Ranges in Edit modal
  const [portRanges,      setPortRanges]      = useState<GMPPortRangeDTO[]>([]);
  const [loadingRanges,   setLoadingRanges]   = useState(false);
  const [newRange,        setNewRange]        = useState<{ start: string; end: string; protocol: "tcp" | "udp" }>({ start: "", end: "", protocol: "tcp" });
  const [addingRange,     setAddingRange]     = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set());
  const [search,      setSearch]      = useState("");
  const [page,        setPage]        = useState(1);
  const PL_PAGE = 4;

  const hasFetched = useRef(false);

  // Compute which port list IDs are in use and by which targets
  const usedPortListIds = useMemo(
    () => new Set(targets.map(t => t.port_list_id).filter(Boolean)),
    [targets],
  );

  const usageMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const t of targets) {
      if (t.port_list_id) {
        const arr = map.get(t.port_list_id) ?? [];
        arr.push(t.name);
        map.set(t.port_list_id, arr);
      }
    }
    return map;
  }, [targets]);

  const filteredLists = useMemo(
    () => lists.filter(pl =>
      pl.name.toLowerCase().includes(search.toLowerCase()) ||
      (pl.comment ?? "").toLowerCase().includes(search.toLowerCase()),
    ),
    [lists, search],
  );
  const plTotalPages = Math.max(1, Math.ceil(filteredLists.length / PL_PAGE));
  const pagedLists   = filteredLists.slice((page - 1) * PL_PAGE, page * PL_PAGE);

  useEffect(() => { setPage(1); }, [search]);

  // Fetch both port lists + targets so we know which are in-use
  const fetchLists = useCallback(async () => {
    setLoading(true);
    const [pl, tg] = await Promise.all([ListGMPPortLists(), ListGMPTargets()]);
    setLists(pl);
    setTargets(tg);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    void fetchLists();
  }, [fetchLists]);

  const readFileAsText = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve((e.target?.result as string) || "");
      reader.onerror = reject;
      reader.readAsText(file);
    });

  const resetNewModal = () => {
    setShowModal(false);
    setEditItem(null);
    setForm({ name: "Unnamed", comment: "", port_range: "T:1-5,7,9,U:1-3,5,7,9" });
    setPortRangeMode("manual");
    setPortRangeFile(null);
    setPortRanges([]);
    setNewRange({ start: "", end: "", protocol: "tcp" });
    setPendingDeleteIds(new Set());
  };

  const loadPortRanges = async (id: string) => {
    setLoadingRanges(true);
    try {
      const detail = await GetGMPPortListDetail(id);
      setPortRanges(detail.port_ranges);
    } catch { setPortRanges([]); }
    finally { setLoadingRanges(false); }
  };

  const openEdit = (pl: GMPPortListDTO) => {
    setEditItem(pl);
    setForm({ name: pl.name, comment: pl.comment ?? "", port_range: "" });
    setPortRangeMode("manual");
    setPortRanges([]);
    setNewRange({ start: "", end: "", protocol: "tcp" });
    setPendingDeleteIds(new Set());
    setShowModal(true);
    void loadPortRanges(pl.id);
  };

  const handleAddRange = async () => {
    if (!editItem) return;
    const start = parseInt(newRange.start);
    const end   = parseInt(newRange.end);
    if (!newRange.start || !newRange.end || isNaN(start) || isNaN(end)) {
      message.warning(t("threatConfig.startEndPortsRequired")); return;
    }
    if (start < 1 || start > 65535) { message.warning(t("threatConfig.startPortRange")); return; }
    if (end < start || end > 65535) { message.warning(t("threatConfig.endPortRange")); return; }
    setAddingRange(true);
    try {
      await CreateGMPPortRange(editItem.id, { start, end, protocol: newRange.protocol });
      setNewRange({ start: "", end: "", protocol: "tcp" });
      await loadPortRanges(editItem.id);
      void fetchLists();
      message.success(t("threatConfig.portRangeAdded", { start, end, protocol: newRange.protocol.toUpperCase() }));
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      message.error(msg || t("threatConfig.failedAddPortRange"));
    } finally { setAddingRange(false); }
  };

  const handleDeleteRange = (rangeId: string) => {
    setPendingDeleteIds(prev => new Set(prev).add(rangeId));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { message.warning(t("threatConfig.nameRequired")); return; }

    if (editItem) {
      setSaving(true);
      try {
        for (const rangeId of pendingDeleteIds) {
          await DeleteGMPPortRange(editItem.id, rangeId);
        }
        await UpdateGMPPortList(editItem.id, { name: form.name.trim(), comment: form.comment });
        const deleted = pendingDeleteIds.size;
        message.success(
          deleted > 0
            ? t("threatConfig.portListUpdatedRanges", { n: deleted })
            : t("threatConfig.portListUpdated"),
        );
        resetNewModal();
        void fetchLists();
      } catch (e: unknown) {
        const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
        message.error(msg || t("threatConfig.failedUpdatePortList"));
      } finally { setSaving(false); }
      return;
    }

    // Create
    let portRange = form.port_range;
    if (portRangeMode === "file") {
      if (!portRangeFile) { message.warning(t("threatConfig.selectFile")); return; }
      portRange = (await readFileAsText(portRangeFile)).trim();
      if (!portRange) { message.warning(t("threatConfig.fileEmpty")); return; }
    } else {
      if (!portRange.trim()) { message.warning(t("threatConfig.portRangeRequired")); return; }
    }
    setSaving(true);
    try {
      await CreateGMPPortList({ ...form, port_range: portRange });
      message.success(t("threatConfig.portListCreated"));
      resetNewModal();
      void fetchLists();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      message.error(msg || t("threatConfig.failedCreatePortList"));
    } finally { setSaving(false); }
  };

  const handleImport = async () => {
    if (!importFile) { message.warning(t("threatConfig.selectXmlFile")); return; }
    setImporting(true);
    try {
      await ImportGMPPortList(importFile);
      message.success(t("threatConfig.portListImported"));
      setShowImportModal(false);
      setImportFile(null);
      void fetchLists();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      message.error(msg || t("threatConfig.failedImportPortList"));
    } finally { setImporting(false); }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    try {
      await DeleteGMPPortList(deleteItem.id);
      message.success(t("threatConfig.portListDeleted"));
      setDeleteItem(null);
      void fetchLists();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      message.error(msg || t("threatConfig.failedDelete"));
      setDeleteItem(null);
    }
  };

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white dark:border-white/8 dark:bg-[#0d0b1a]/60">
        {/* Toolbar */}
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-3.5 dark:border-white/8">
          <div className="flex shrink-0 items-center gap-2.5">
            <FiList className="text-[14px] text-slate-400 dark:text-white/35" />
            <p className="text-[13px] font-bold text-slate-800 dark:text-white/90">
              {t("threatConfig.tabs.portLists")}
              {!loading && <span className="ml-2 text-[11px] font-normal text-slate-400 dark:text-white/30">({filteredLists.length}/{lists.length})</span>}
            </p>
          </div>
          <div className="relative flex-1 max-w-56">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400 dark:text-white/30" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={t("threatConfig.search")}
              className="w-full rounded-lg border border-slate-200/80 bg-white py-1.5 pl-8 pr-3 text-[12px] text-slate-700 placeholder-slate-400 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100 dark:border-white/8 dark:bg-white/5 dark:text-white/85 dark:placeholder-white/25" />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={() => void fetchLists()} disabled={loading} title={t("common.refresh")}
              className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200/70 bg-white text-slate-500 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/8 dark:bg-white/5 dark:text-white/50">
              <FiRefreshCw className={`text-[12px] ${loading ? "animate-spin" : ""}`} />
            </button>
            <button type="button" onClick={() => setShowImportModal(true)} title={t("threatConfig.importPortList")}
              className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200/70 bg-white text-slate-500 transition hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/50">
              <FiUpload className="text-[12px]" />
            </button>
            <button type="button" onClick={() => setShowModal(true)}
              style={{ background: accentGrad }}
              className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[12px] font-semibold text-white shadow-sm transition hover:opacity-90">
              <FiPlus className="text-[13px]" /> {t("threatConfig.newPortList")}
            </button>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="space-y-0">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-14 animate-pulse border-b border-slate-100 last:border-0 dark:border-white/6" />
            ))}
          </div>
        ) : lists.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <FiList className="text-[24px] text-slate-300 dark:text-white/20" />
            <p className="text-[12.5px] text-slate-400 dark:text-white/35">{t("threatConfig.noPortLists")}</p>
          </div>
        ) : filteredLists.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <FiSearch className="text-[24px] text-slate-300 dark:text-white/20" />
            <p className="text-[12.5px] text-slate-400 dark:text-white/35">{t("threatConfig.noResultsFor", { n: search })}</p>
          </div>
        ) : (
          <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-140">
              <thead>
                <tr className="border-b border-slate-100 dark:border-white/8">
                  <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">{t("threatConfig.name")}</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">{t("threatConfig.total")}</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">{t("threatConfig.tcp")}</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">{t("threatConfig.udp")}</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/60 dark:divide-white/5">
                {pagedLists.map(pl => {
                  const inUse  = usedPortListIds.has(pl.id);
                  const isIANA = isIANAPortList(pl);
                  const usedBy = usageMap.get(pl.id) ?? [];
                  // Edit: locked only for IANA standards.  Delete: locked when in-use
                  const canEdit   = !isIANA;
                  const canDelete = !inUse;
                  const editTip = isIANA
                    ? t("threatConfig.ianaCannotModify")
                    : t("threatConfig.editPortListTip");
                  const deleteTip = inUse
                    ? t("threatConfig.inUseCannotDelete", { n: usedBy.join(", ") })
                    : t("threatConfig.deletePortListTip");

                  return (
                    <tr key={pl.id} className="transition-colors hover:bg-slate-50/60 dark:hover:bg-white/2">
                      {/* Name + badges */}
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[13px] font-semibold text-slate-800 dark:text-white/85">{pl.name}</p>
                          {isIANA && (
                            <span className="inline-flex items-center rounded-full border border-blue-200/80 bg-blue-50 px-2 py-0.5 text-[9px] font-bold text-blue-500 dark:border-blue-500/25 dark:bg-blue-500/10 dark:text-blue-400">
                              {t("threatConfig.ianaStandard")}
                            </span>
                          )}
                          {inUse && (
                            <span title={t("threatConfig.usedBy", { n: usedBy.join(", ") })}
                              className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9.5px] font-bold text-amber-600 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                              {t("threatConfig.inUse")} ({usedBy.length})
                            </span>
                          )}
                        </div>
                        {pl.comment && <p className="mt-0.5 text-[10.5px] text-slate-400 dark:text-white/30">{pl.comment}</p>}
                        {inUse && (
                          <p className="mt-0.5 text-[10px] text-slate-400 dark:text-white/25">
                            {t("threatConfig.usedBy", { n: usedBy.join(", ") })}
                          </p>
                        )}
                      </td>

                      {/* Total */}
                      <td className="px-4 py-3.5 text-right text-[12.5px] font-semibold text-slate-700 dark:text-white/70">
                        {pl.total.toLocaleString()}
                      </td>
                      {/* TCP */}
                      <td className="px-4 py-3.5 text-right text-[12.5px] text-slate-500 dark:text-white/45">
                        {pl.tcp.toLocaleString()}
                      </td>
                      {/* UDP */}
                      <td className="px-4 py-3.5 text-right text-[12.5px] text-slate-500 dark:text-white/45">
                        {pl.udp === 0 ? <span className="text-slate-300 dark:text-white/20">0</span> : pl.udp.toLocaleString()}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Edit */}
                          <button type="button" title={editTip}
                            onClick={() => { if (canEdit) openEdit(pl); }}
                            disabled={!canEdit}
                            className={["grid h-7 w-7 place-items-center rounded-lg border transition",
                              canEdit
                                ? "border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300"
                                : "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300 dark:border-white/8 dark:bg-white/3 dark:text-white/20",
                            ].join(" ")}>
                            <FiEdit2 className="text-[11px]" />
                          </button>

                          {/* Delete */}
                          <button type="button" title={deleteTip}
                            onClick={() => { if (canDelete) setDeleteItem(pl); }}
                            disabled={!canDelete}
                            className={["grid h-7 w-7 place-items-center rounded-lg border transition",
                              canDelete
                                ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
                                : "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300 dark:border-white/8 dark:bg-white/3 dark:text-white/20",
                            ].join(" ")}>
                            <FiTrash2 className="text-[11px]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {plTotalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 dark:border-white/8">
              <span className="text-[11px] text-slate-400 dark:text-white/30">{t("threatConfig.page")} {page} {t("threatConfig.of")} {plTotalPages}</span>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200/70 bg-white text-slate-500 transition hover:bg-slate-50 disabled:opacity-40 dark:border-white/8 dark:bg-white/5 dark:text-white/50">
                  <FiChevronLeft className="text-[12px]" />
                </button>
                {Array.from({ length: plTotalPages }, (_, i) => i + 1).map(n => (
                  <button key={n} type="button" onClick={() => setPage(n)}
                    style={n === page ? { background: accentGrad } : undefined}
                    className={["grid h-7 w-7 place-items-center rounded-lg text-[11.5px] font-semibold transition",
                      n === page ? "text-white" : "border border-slate-200/70 bg-white text-slate-500 hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/50",
                    ].join(" ")}>
                    {n}
                  </button>
                ))}
                <button type="button" onClick={() => setPage(p => Math.min(plTotalPages, p + 1))} disabled={page === plTotalPages}
                  className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200/70 bg-white text-slate-500 transition hover:bg-slate-50 disabled:opacity-40 dark:border-white/8 dark:bg-white/5 dark:text-white/50">
                  <FiChevronRight className="text-[12px]" />
                </button>
              </div>
            </div>
          )}
          </>
        )}
      </div>

      {/* ── New / Edit Port List Modal ── */}
      {showModal && createPortal(
        <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={resetNewModal} />
          <div className="relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-[#12101f]"
            style={{ maxHeight: "90dvh", boxShadow: `0 24px 64px -12px ${currentColor}40` }}>

            {/* ── Header ── */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/8">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl text-white" style={{ background: accentGrad }}>
                  {editItem ? <FiEdit2 className="text-[14px]" /> : <FiList className="text-[14px]" />}
                </span>
                <div>
                  <p className="text-[9.5px] font-bold uppercase tracking-widest" style={{ color: currentColor }}>{t("threatConfig.tabs.portLists").toUpperCase()}</p>
                  <h3 className="text-[14px] font-bold text-slate-800 dark:text-white/90">
                    {editItem ? t("threatConfig.editPortList") : t("threatConfig.newPortList")}
                  </h3>
                </div>
              </div>
              <button type="button" onClick={resetNewModal}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:text-white/35 dark:hover:bg-white/8 focus:outline-none">
                <FiX className="text-[15px]" />
              </button>
            </div>

            {/* ── Body (scrollable) ── */}
            <div className="flex-1 overflow-y-auto px-5 py-5">
              <div className="space-y-4">

                {/* Name */}
                <div>
                  <label className={labelCls}>{t("threatConfig.name")} <span className="text-red-400">*</span></label>
                  <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder={t("threatConfig.unnamedPlaceholder")} className={inputCls} />
                </div>

                {/* Comment */}
                <div>
                  <label className={labelCls}>{t("threatConfig.comment")}</label>
                  <input type="text" value={form.comment ?? ""} onChange={e => setForm(p => ({ ...p, comment: e.target.value }))}
                    placeholder={t("threatConfig.optionalDescriptionPlaceholder")} className={inputCls} />
                </div>

                {/* ── Port Ranges section ── */}
                {!editItem ? (
                  /* CREATE mode: manual text or file */
                  <div>
                    <label className={labelCls}>{t("threatConfig.portRanges")} <span className="text-red-400">*</span></label>
                    <div className="space-y-3">
                      <label className="flex cursor-pointer items-start gap-2.5">
                        <input type="radio" checked={portRangeMode === "manual"}
                          onChange={() => setPortRangeMode("manual")} className="mt-0.5 accent-blue-500" />
                        <div className="flex-1 min-w-0">
                          <span className="text-[12.5px] font-medium text-slate-700 dark:text-white/70">{t("threatConfig.portRangeManual")}</span>
                          {portRangeMode === "manual" && (
                            <input type="text" value={form.port_range}
                              onChange={e => setForm(p => ({ ...p, port_range: e.target.value }))}
                              placeholder="T:1-5,7,9,U:1-3,5,7,9" className={`${inputCls} mt-1.5`} />
                          )}
                        </div>
                      </label>
                      <label className="flex cursor-pointer items-start gap-2.5">
                        <input type="radio" checked={portRangeMode === "file"}
                          onChange={() => setPortRangeMode("file")} className="mt-0.5 accent-blue-500" />
                        <div className="flex-1 min-w-0">
                          <span className="text-[12.5px] font-medium text-slate-700 dark:text-white/70">{t("threatConfig.portRangeFromFile")}</span>
                          {portRangeMode === "file" && (
                            <div className="mt-1.5">
                              <FileUploadArea file={portRangeFile} inputRef={portRangeFileRef} onChange={setPortRangeFile} />
                            </div>
                          )}
                        </div>
                      </label>
                    </div>
                  </div>
                ) : (
                  /* EDIT mode: live Port Ranges table + add form (like OpenVAS) */
                  <div>
                    {/* Port Ranges header */}
                    <div className="mb-2 flex items-center justify-between">
                      <label className={labelCls + " mb-0"}>{t("threatConfig.portRanges")}</label>
                      {!loadingRanges && (
                        <div className="flex items-center gap-2">
                          {pendingDeleteIds.size > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[9.5px] font-semibold text-red-500 dark:bg-red-500/10 dark:text-red-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                              {pendingDeleteIds.size} {t("threatConfig.pendingDelete")}
                            </span>
                          )}
                          <span className="text-[10.5px] text-slate-400 dark:text-white/30">
                            {portRanges.filter(pr => !pendingDeleteIds.has(pr.id)).length} range{portRanges.filter(pr => !pendingDeleteIds.has(pr.id)).length !== 1 ? "s" : ""}
                            {editItem.total > 0 && ` · ${editItem.total.toLocaleString()} ports`}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Ranges table */}
                    {loadingRanges ? (
                      <div className="space-y-1.5">
                        {[1,2,3].map(i => <div key={i} className="h-8 animate-pulse rounded-lg bg-slate-100 dark:bg-white/8" />)}
                      </div>
                    ) : portRanges.filter(pr => !pendingDeleteIds.has(pr.id)).length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 py-5 text-center text-[11.5px] text-slate-400 dark:border-white/10 dark:text-white/30">
                        {t("threatConfig.noPortRangesYet")}
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-xl border border-slate-200/80 dark:border-white/8"
                        style={{ maxHeight: "220px", overflowY: "auto" }}>
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/80 dark:border-white/8 dark:bg-white/3">
                              <th className="px-3 py-2 text-left text-[9.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/30">{t("threatConfig.start")}</th>
                              <th className="px-3 py-2 text-left text-[9.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/30">{t("threatConfig.end")}</th>
                              <th className="px-3 py-2 text-left text-[9.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/30">{t("threatConfig.protocol")}</th>
                              <th className="px-3 py-2 text-right text-[9.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/30">{t("common.actions")}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100/60 dark:divide-white/5">
                            {portRanges.filter(pr => !pendingDeleteIds.has(pr.id)).map(pr => (
                              <tr key={pr.id} className="hover:bg-slate-50/60 dark:hover:bg-white/2">
                                <td className="px-3 py-2 font-mono text-[12px] tabular-nums text-slate-700 dark:text-white/70">{pr.start}</td>
                                <td className="px-3 py-2 font-mono text-[12px] tabular-nums text-slate-700 dark:text-white/70">{pr.end}</td>
                                <td className="px-3 py-2">
                                  <span className={[
                                    "rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase",
                                    pr.protocol === "tcp"
                                      ? "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300"
                                      : "bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-300",
                                  ].join(" ")}>
                                    {pr.protocol}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <button type="button" title={t("threatConfig.markForDeletion")}
                                    onClick={() => handleDeleteRange(pr.id)}
                                    className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-500 transition hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                                    <FiX className="text-[10px]" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Add Range inline form */}
                    <div className="mt-3">
                      <label className={labelCls}>{t("threatConfig.addPortRange")}</label>
                      <div className="flex items-center gap-2">
                        <input type="number" min={1} max={65535} placeholder={t("threatConfig.start")}
                          value={newRange.start}
                          onChange={e => setNewRange(p => ({ ...p, start: e.target.value }))}
                          className={`${inputCls} w-24 text-center`} />
                        <span className="shrink-0 text-[12px] text-slate-400">—</span>
                        <input type="number" min={1} max={65535} placeholder={t("threatConfig.end")}
                          value={newRange.end}
                          onChange={e => setNewRange(p => ({ ...p, end: e.target.value }))}
                          className={`${inputCls} w-24 text-center`} />
                        <div className="w-24 shrink-0">
                          <CustomSelect
                            options={[{ value: "tcp", label: "TCP" }, { value: "udp", label: "UDP" }]}
                            value={newRange.protocol}
                            onChange={v => setNewRange(p => ({ ...p, protocol: v as "tcp" | "udp" }))}
                            searchable={false}
                          />
                        </div>
                        <button type="button" onClick={() => void handleAddRange()} disabled={addingRange}
                          style={{ background: accentGrad }}
                          className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold text-white transition hover:opacity-90 disabled:opacity-60">
                          {addingRange
                            ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            : <FiPlus className="text-[12px]" />}
                          {t("common.add")}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* ── Footer ── */}
            <div className="flex shrink-0 gap-2 border-t border-slate-100 px-5 py-4 dark:border-white/8">
              <button type="button" onClick={resetNewModal}
                className="flex-1 rounded-xl border border-slate-200 py-2 text-[12.5px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/8 dark:text-white/55 dark:hover:bg-white/5 focus:outline-none">
                {t("common.cancel")}
              </button>
              <button type="button" onClick={() => void handleSave()} disabled={saving}
                style={{ background: accentGrad }}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-[12.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-60 focus:outline-none">
                {saving && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                {editItem ? t("common.update") : t("common.save")}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Import Port List Modal ── */}
      {showImportModal && createPortal(
        <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            onClick={() => { setShowImportModal(false); setImportFile(null); }} />
          <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-[#12101f]"
            style={{ boxShadow: `0 24px 64px -12px ${currentColor}40` }}>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/8">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl text-white" style={{ background: accentGrad }}>
                  <FiUpload className="text-[14px]" />
                </span>
                <div>
                  <p className="text-[9.5px] font-bold uppercase tracking-widest" style={{ color: currentColor }}>{t("threatConfig.tabs.portLists").toUpperCase()}</p>
                  <h3 className="text-[14px] font-bold text-slate-800 dark:text-white/90">{t("threatConfig.importPortList")}</h3>
                </div>
              </div>
              <button type="button" onClick={() => { setShowImportModal(false); setImportFile(null); }}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:text-white/35 dark:hover:bg-white/8 focus:outline-none">
                <FiX className="text-[15px]" />
              </button>
            </div>
            {/* Body */}
            <div className="space-y-4 px-5 py-5">
              <div>
                <label className={labelCls}>{t("threatConfig.importPortList")}</label>
                <FileUploadArea
                  file={importFile}
                  inputRef={importFileRef}
                  accept=".xml"
                  onChange={setImportFile}
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => { setShowImportModal(false); setImportFile(null); }}
                  className="flex-1 rounded-xl border border-slate-200 py-2 text-[12.5px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/8 dark:text-white/55 dark:hover:bg-white/5 focus:outline-none">
                  {t("common.cancel")}
                </button>
                <button type="button" onClick={() => void handleImport()} disabled={importing}
                  style={{ background: accentGrad }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-[12.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-60 focus:outline-none">
                  {importing && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                  {t("common.upload")}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Confirm Delete */}
      {deleteItem && (
        <ConfirmDeleteDialog
          name={deleteItem.name}
          onConfirm={() => void handleDelete()}
          onCancel={() => setDeleteItem(null)}
        />
      )}
    </>
  );
};

// ─────────────────────────────────────────────────────────────
// Credentials tab
// ─────────────────────────────────────────────────────────────
const getPrivAlgoLabel = (t: TFn, algo: string): string =>
  algo === "none" ? t("threatConfig.algoNone") : algo.toUpperCase();

const CredentialsTab: React.FC<{ currentColor: string; accentGrad: string }> = ({
  currentColor, accentGrad,
}) => {
  const { t } = useLanguage();
  const CRED_TYPES = useMemo(() => getCredTypes(t), [t]);
  const [creds,      setCreds]      = useState<GMPCredentialDTO[]>([]);
  const [tgList,     setTgList]     = useState<GMPTargetDTO[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [showModal,  setShowModal]  = useState(false);
  const [editItem,   setEditItem]   = useState<GMPCredentialDTO | null>(null);
  const [saving,     setSaving]     = useState(false);
  const [deleteItem, setDeleteItem] = useState<GMPCredentialDTO | null>(null);
  const [showPass,       setShowPass]       = useState(false);
  const [showPrivPass,   setShowPrivPass]   = useState(false);
  const [showCommunity,  setShowCommunity]  = useState(false);
  const [showCcPass,     setShowCcPass]     = useState(false);
  const [fileResetKey,   setFileResetKey]   = useState(0);
  const [replaceFlags,   setReplaceFlags]   = useState<Record<string, boolean>>({});
  const setFlag = (k: string, v: boolean) => setReplaceFlags(p => ({ ...p, [k]: v }));
  const [crSearch,       setCrSearch]       = useState("");
  const [crPage,         setCrPage]         = useState(1);
  const [crTypeFilter,   setCrTypeFilter]   = useState<GMPCredentialType[]>([]);
  const CR_PAGE = 4;
  const hasFetched = useRef(false);

  const emptyForm: CreateCredentialRequest = {
    name: "Unnamed", comment: "", type: "up",
    auto_generate: false,
    login: "", password: "",
    private_key: "", passphrase: "",
    community: "", auth_algorithm: "sha1", privacy_algorithm: "aes", privacy_password: "",
    certificate: "", public_pgp_key: "",
    cc_private_key: "", cc_passphrase: "",
  };
  const [form, setForm] = useState<CreateCredentialRequest>(emptyForm);

  const setF = <K extends keyof CreateCredentialRequest>(k: K, v: CreateCredentialRequest[K]) =>
    setForm(p => ({ ...p, [k]: v }));

  const usedCredIds = useMemo(
    () => new Set(tgList.flatMap(tg =>
      [tg.ssh_cred_id, tg.smb_cred_id, tg.esxi_cred_id, tg.snmp_cred_id].filter(Boolean),
    )),
    [tgList],
  );

  const usageCredMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const tg of tgList) {
      for (const cid of [tg.ssh_cred_id, tg.smb_cred_id, tg.esxi_cred_id, tg.snmp_cred_id]) {
        if (cid) {
          const arr = map.get(cid) ?? [];
          if (!arr.includes(tg.name)) arr.push(tg.name);
          map.set(cid, arr);
        }
      }
    }
    return map;
  }, [tgList]);

  const filteredCreds = useMemo(() => {
    const q = crSearch.toLowerCase();
    return creds.filter(c => {
      const matchType   = crTypeFilter.length === 0 || crTypeFilter.includes(c.type as GMPCredentialType);
      const matchSearch = !q ||
        c.name.toLowerCase().includes(q) ||
        (c.comment ?? "").toLowerCase().includes(q) ||
        c.type.toLowerCase().includes(q);
      return matchType && matchSearch;
    });
  }, [creds, crSearch, crTypeFilter]);
  const crTotalPages = Math.max(1, Math.ceil(filteredCreds.length / CR_PAGE));
  const pagedCreds   = filteredCreds.slice((crPage - 1) * CR_PAGE, crPage * CR_PAGE);

  useEffect(() => { setCrPage(1); }, [crSearch, crTypeFilter]);

  const fetchCreds = useCallback(async () => {
    setLoading(true);
    const [data, tgs] = await Promise.all([ListGMPCredentials(), ListGMPTargets()]);
    setCreds(data);
    setTgList(tgs);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    void fetchCreds();
  }, [fetchCreds]);


  const resetModal = () => {
    setShowModal(false);
    setEditItem(null);
    setForm(emptyForm);
    setShowPass(false); setShowPrivPass(false);
    setShowCommunity(false); setShowCcPass(false);
    setFileResetKey(k => k + 1);
    setReplaceFlags({});
  };

  const openEdit = (cr: GMPCredentialDTO) => {
    setEditItem(cr);
    setForm({
      ...emptyForm,
      name: cr.name, comment: cr.comment,
      type: cr.type as GMPCredentialType,
      login: cr.login,
      auto_generate: false,
      auth_algorithm: "sha1",
      privacy_algorithm: "aes",
    });
    setReplaceFlags({});
    setShowPass(false); setShowPrivPass(false);
    setShowCommunity(false); setShowCcPass(false);
    setFileResetKey(k => k + 1);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { message.warning(t("threatConfig.nameRequired")); return; }
    setSaving(true);
    try {
      if (editItem) {
        // Only send sensitive fields that the user explicitly chose to replace
        const payload: typeof form = {
          ...form,
          password:         replaceFlags.password      ? form.password         : "",
          private_key:      replaceFlags.privateKey    ? form.private_key      : "",
          passphrase:       replaceFlags.passphrase    ? form.passphrase       : "",
          community:        replaceFlags.community     ? form.community        : "",
          privacy_password: replaceFlags.privacyPass   ? form.privacy_password : "",
          certificate:      replaceFlags.certificate   ? form.certificate      : "",
          public_pgp_key:   replaceFlags.pgpKey        ? form.public_pgp_key   : "",
          cc_private_key:   replaceFlags.ccKey         ? form.cc_private_key   : "",
          cc_passphrase:    replaceFlags.ccPassphrase  ? form.cc_passphrase    : "",
        };
        await UpdateGMPCredential(editItem.id, payload);
        message.success(t("threatConfig.credentialUpdated"));
      } else {
        await CreateGMPCredential(form);
        message.success(t("threatConfig.credentialCreated"));
      }
      resetModal();
      void fetchCreds();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      message.error(msg || (editItem ? t("threatConfig.failedUpdateCredential") : t("threatConfig.failedCreateCredential")));
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    try {
      await DeleteGMPCredential(deleteItem.id);
      message.success(t("threatConfig.credentialDeleted"));
      setDeleteItem(null);
      void fetchCreds();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      message.error(msg || t("threatConfig.failedDelete"));
      setDeleteItem(null);
    }
  };

  const credTypeLabel = (type: string) =>
    CRED_TYPES.find(ct => ct.value === type)?.label ?? type;

  const typeBadgeStyle = (type: string): { bg: string; text: string } => {
    const map: Record<string, { bg: string; text: string }> = {
      up:    { bg: "#DBEAFE", text: "#1E40AF" },
      usk:   { bg: "#EDE9FE", text: "#5B21B6" },
      snmp:  { bg: "#FEF3C7", text: "#92400E" },
      smime: { bg: "#D1FAE5", text: "#065F46" },
      pgp:   { bg: "#FCE7F3", text: "#9D174D" },
      pw:    { bg: "#F1F5F9", text: "#475569" },
      cc:    { bg: "#FFEDD5", text: "#9A3412" },
    };
    return map[type] ?? { bg: "#F1F5F9", text: "#475569" };
  };

  // Password field helper
  const PwField: React.FC<{
    label: string; value: string; show: boolean;
    onChange: (v: string) => void; onToggle: () => void; placeholder?: string;
  }> = ({ label, value, show, onChange, onToggle, placeholder = "••••••••" }) => (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="relative">
        <input type={show ? "text" : "password"} value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder} className={`${inputCls} pr-10`} />
        <button type="button" onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-white/30 focus:outline-none">
          {show ? <FiEyeOff className="text-[13px]" /> : <FiEye className="text-[13px]" />}
        </button>
      </div>
    </div>
  );

  const autoGen = form.auto_generate ?? false;

  const renderFormFields = () => {
    const credType = form.type;
    const isEdit   = !!editItem;

    // ── Shared: password input with eye toggle ──────────────────
    const pwInput = (
      fieldKey: keyof typeof form,
      show: boolean,
      onToggle: () => void,
      placeholder = "••••••••",
      disabled = false,
    ) => (
      <div className="relative">
        <input
          type={show && !disabled ? "text" : "password"}
          value={(form[fieldKey] as string) ?? ""}
          onChange={e => setF(fieldKey, e.target.value)}
          placeholder={disabled ? "" : placeholder}
          disabled={disabled}
          className={`${inputCls} pr-10 ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
        />
        {!disabled && (
          <button type="button" onClick={onToggle}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-white/30 focus:outline-none">
            {show ? <FiEyeOff className="text-[13px]" /> : <FiEye className="text-[13px]" />}
          </button>
        )}
      </div>
    );

    // ── Edit-mode "Replace existing X with" row ────────────────
    const replaceRow = (
      sectionLabel: string,
      flagKey: string,
      inputFn: (disabled: boolean) => React.ReactNode,
    ) => {
      const enabled = replaceFlags[flagKey] ?? false;
      return (
        <div key={flagKey}>
          <label className={labelCls}>{sectionLabel}</label>
          <div className="flex items-center gap-3">
            <label className="flex shrink-0 cursor-pointer items-center gap-2">
              <input type="checkbox" checked={enabled}
                onChange={e => setFlag(flagKey, e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 accent-blue-500 dark:border-white/30" />
              <span className="whitespace-nowrap text-[12px] text-slate-600 dark:text-white/60">
                {t("threatConfig.replaceExistingWith", { field: sectionLabel.toLowerCase() })}
              </span>
            </label>
            <div className="flex-1 min-w-0">{inputFn(!enabled)}</div>
          </div>
        </div>
      );
    };

    return (
      <div className="space-y-3.5">

        {/* ── Auto-generate (up / usk — CREATE only) ── */}
        {!isEdit && (credType === "up" || credType === "usk") && (
          <div>
            <label className={labelCls}>{t("threatConfig.autoGenerate")}</label>
            <div className="flex gap-5 pt-0.5">
              {([true, false] as const).map(v => (
                <label key={String(v)} className="flex cursor-pointer items-center gap-2 text-[12.5px] text-slate-700 dark:text-white/70">
                  <input type="radio" checked={autoGen === v}
                    onChange={() => setF("auto_generate", v)} className="accent-blue-500" />
                  {v ? t("common.yes") : t("common.no")}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* ── Username (up / usk / snmp) ── */}
        {(credType === "up" || credType === "usk" || credType === "snmp") && (
          <div>
            <label className={labelCls}>{t("threatConfig.usernameLabel")}</label>
            <input type="text" value={form.login ?? ""} onChange={e => setF("login", e.target.value)}
              placeholder={t("threatConfig.usernameLabel")} className={inputCls} />
          </div>
        )}

        {/* ══ Username + Password (up) ══ */}
        {credType === "up" && (
          isEdit
            ? replaceRow(t("threatConfig.password"), "password",
                disabled => pwInput("password", showPass, () => setShowPass(p => !p), t("threatConfig.newPasswordPlaceholder"), disabled))
            : !autoGen && (
              <PwField label={t("threatConfig.password")} value={form.password ?? ""} show={showPass}
                onChange={v => setF("password", v)} onToggle={() => setShowPass(p => !p)} />
            )
        )}

        {/* ══ Username + SSH Key (usk) ══ */}
        {credType === "usk" && !autoGen && (
          isEdit ? (
            <>
              {replaceRow(t("threatConfig.sshPrivateKey"), "privateKey",
                disabled => (
                  <div className={disabled ? "pointer-events-none opacity-40" : ""}>
                    <FileTextInput key={`ssh-${fileResetKey}`}
                      onChange={text => setF("private_key", text)} accept=".pem,.key,.txt" />
                  </div>
                ))}
              {replaceRow(t("threatConfig.sshKeyPassphrase"), "passphrase",
                disabled => pwInput("passphrase", showPrivPass, () => setShowPrivPass(p => !p), t("threatConfig.passphraseOptionalPlaceholder"), disabled))}
            </>
          ) : (
            <>
              <div>
                <label className={labelCls}>{t("threatConfig.privateSshKey")}</label>
                <FileTextInput key={`ssh-${fileResetKey}`}
                  onChange={text => setF("private_key", text)} accept=".pem,.key,.txt" />
              </div>
              <PwField label={t("threatConfig.passphraseForPrivateSshKey")}
                value={form.passphrase ?? ""} show={showPrivPass} placeholder={t("threatConfig.optionalPlaceholder")}
                onChange={v => setF("passphrase", v)} onToggle={() => setShowPrivPass(p => !p)} />
            </>
          )
        )}

        {/* ══ SNMP ══ */}
        {credType === "snmp" && (
          <>
            {isEdit
              ? replaceRow(t("threatConfig.snmpCommunity"), "community",
                  disabled => pwInput("community", showCommunity, () => setShowCommunity(p => !p), t("threatConfig.communityStringPlaceholder"), disabled))
              : <PwField label={t("threatConfig.snmpCommunity")} value={form.community ?? ""} show={showCommunity} placeholder={t("threatConfig.communityStringPlaceholder")}
                  onChange={v => setF("community", v)} onToggle={() => setShowCommunity(p => !p)} />}

            {isEdit
              ? replaceRow(t("threatConfig.password"), "password",
                  disabled => pwInput("password", showPass, () => setShowPass(p => !p), t("threatConfig.authPasswordPlaceholder"), disabled))
              : <PwField label={t("threatConfig.password")} value={form.password ?? ""} show={showPass} placeholder={t("threatConfig.authPasswordPlaceholder")}
                  onChange={v => setF("password", v)} onToggle={() => setShowPass(p => !p)} />}

            {isEdit
              ? replaceRow(t("threatConfig.privacyPassword"), "privacyPass",
                  disabled => pwInput("privacy_password", showPrivPass, () => setShowPrivPass(p => !p), t("threatConfig.privacyPasswordPlaceholder"), disabled))
              : <PwField label={t("threatConfig.privacyPassword")} value={form.privacy_password ?? ""} show={showPrivPass} placeholder={t("threatConfig.privacyPasswordPlaceholder")}
                  onChange={v => setF("privacy_password", v)} onToggle={() => setShowPrivPass(p => !p)} />}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>{t("threatConfig.authAlgorithm")}</label>
                <div className="flex gap-4 pt-0.5">
                  {(["md5", "sha1"] as const).map(algo => (
                    <label key={algo} className="flex cursor-pointer items-center gap-2 text-[12.5px] text-slate-700 dark:text-white/70">
                      <input type="radio" name="auth_algo" value={algo}
                        checked={form.auth_algorithm === algo}
                        onChange={() => setF("auth_algorithm", algo)} className="accent-blue-500" />
                      {algo.toUpperCase()}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>{t("threatConfig.privacyAlgorithmLabel")}</label>
                <div className="flex gap-3 pt-0.5">
                  {(["aes", "des", "none"] as const).map(algo => (
                    <label key={algo} className="flex cursor-pointer items-center gap-2 text-[12.5px] text-slate-700 dark:text-white/70">
                      <input type="radio" name="priv_algo" value={algo}
                        checked={form.privacy_algorithm === algo}
                        onChange={() => setF("privacy_algorithm", algo)} className="accent-blue-500" />
                      {getPrivAlgoLabel(t, algo)}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ══ S/MIME Certificate (smime) ══ */}
        {credType === "smime" && (
          isEdit
            ? replaceRow(t("threatConfig.credTypeSmime"), "certificate",
                disabled => (
                  <div className={disabled ? "pointer-events-none opacity-40" : ""}>
                    <FileTextInput key={`smime-${fileResetKey}`}
                      onChange={text => setF("certificate", text)} accept=".pem,.crt,.cer,.der" />
                  </div>
                ))
            : <div>
                <label className={labelCls}>{t("threatConfig.credTypeSmime")}</label>
                <FileTextInput key={`smime-${fileResetKey}`}
                  onChange={text => setF("certificate", text)} accept=".pem,.crt,.cer,.der" />
              </div>
        )}

        {/* ══ PGP Encryption Key (pgp) ══ */}
        {credType === "pgp" && (
          isEdit
            ? replaceRow(t("threatConfig.pgpPublicKey"), "pgpKey",
                disabled => (
                  <div className={disabled ? "pointer-events-none opacity-40" : ""}>
                    <FileTextInput key={`pgp-${fileResetKey}`}
                      onChange={text => setF("public_pgp_key", text)} accept=".asc,.pgp,.txt" />
                  </div>
                ))
            : <div>
                <label className={labelCls}>{t("threatConfig.pgpPublicKey")}</label>
                <FileTextInput key={`pgp-${fileResetKey}`}
                  onChange={text => setF("public_pgp_key", text)} accept=".asc,.pgp,.txt" />
              </div>
        )}

        {/* ══ Password only (pw) ══ */}
        {credType === "pw" && (
          isEdit
            ? replaceRow(t("threatConfig.password"), "password",
                disabled => pwInput("password", showPass, () => setShowPass(p => !p), t("threatConfig.newPasswordPlaceholder"), disabled))
            : <PwField label={t("threatConfig.password")} value={form.password ?? ""} show={showPass}
                onChange={v => setF("password", v)} onToggle={() => setShowPass(p => !p)} />
        )}

        {/* ══ Client Certificate (cc) ══ */}
        {credType === "cc" && (
          isEdit ? (
            <>
              {replaceRow(t("threatConfig.credTypeCc"), "certificate",
                disabled => (
                  <div className={disabled ? "pointer-events-none opacity-40" : ""}>
                    <FileTextInput key={`cc-cert-${fileResetKey}`}
                      onChange={text => setF("certificate", text)} accept=".pem,.crt,.cer" />
                  </div>
                ))}
              {replaceRow(t("threatConfig.clientPrivateKey"), "ccKey",
                disabled => (
                  <div className={disabled ? "pointer-events-none opacity-40" : ""}>
                    <FileTextInput key={`cc-key-${fileResetKey}`}
                      onChange={text => setF("cc_private_key", text)} accept=".pem,.key" />
                  </div>
                ))}
              {replaceRow(t("threatConfig.keyPassphrase"), "ccPassphrase",
                disabled => pwInput("cc_passphrase", showCcPass, () => setShowCcPass(p => !p), t("threatConfig.passphraseOptionalPlaceholder"), disabled))}
            </>
          ) : (
            <>
              <div>
                <label className={labelCls}>{t("threatConfig.credTypeCc")}</label>
                <FileTextInput key={`cc-cert-${fileResetKey}`}
                  onChange={text => setF("certificate", text)} accept=".pem,.crt,.cer" />
              </div>
              <div>
                <label className={labelCls}>{t("threatConfig.clientPrivateKey")}</label>
                <FileTextInput key={`cc-key-${fileResetKey}`}
                  onChange={text => setF("cc_private_key", text)} accept=".pem,.key" />
              </div>
              <PwField label={t("threatConfig.passphraseForClientPrivateKey")}
                value={form.cc_passphrase ?? ""} show={showCcPass} placeholder={t("threatConfig.optionalPlaceholder")}
                onChange={v => setF("cc_passphrase", v)} onToggle={() => setShowCcPass(p => !p)} />
            </>
          )
        )}

      </div>
    );
  };

  return (
    <>
      <div className="rounded-xl border border-slate-200/80 bg-white dark:border-white/8 dark:bg-[#0d0b1a]/60">
        {/* Toolbar: title + search + type dropdown + buttons */}
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-3.5 dark:border-white/8">
          <div className="flex shrink-0 items-center gap-2.5">
            <FiKey className="text-[14px] text-slate-400 dark:text-white/35" />
            <p className="text-[13px] font-bold text-slate-800 dark:text-white/90">
              {t("threatConfig.tabs.credentials")}
              {!loading && <span className="ml-2 text-[11px] font-normal text-slate-400 dark:text-white/30">({filteredCreds.length}/{creds.length})</span>}
            </p>
          </div>

          {/* Search */}
          <div className="relative flex-1 max-w-52">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400 dark:text-white/30" />
            <input type="text" value={crSearch} onChange={e => setCrSearch(e.target.value)} placeholder={t("threatConfig.search")}
              className="w-full rounded-lg border border-slate-200/80 bg-white py-1.5 pl-8 pr-3 text-[12px] text-slate-700 placeholder-slate-400 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100 dark:border-white/8 dark:bg-white/5 dark:text-white/85 dark:placeholder-white/25" />
          </div>

          {/* Type multi-select dropdown — using shared CustomMultiSelect */}
          <CustomMultiSelect
            options={CRED_TYPES.map(ct => ({
              value: ct.value,
              label: ct.label,
              badge: creds.filter(c => c.type === ct.value).length,
            }))}
            value={crTypeFilter}
            onChange={vals => setCrTypeFilter(vals as GMPCredentialType[])}
            placeholder={t("threatConfig.allTypes")}
            searchPlaceholder={t("threatConfig.searchType")}
            icon={<FiKey />}
            className="w-48"
          />

          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={() => void fetchCreds()} disabled={loading}
              className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200/70 bg-white text-slate-500 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/8 dark:bg-white/5 dark:text-white/50">
              <FiRefreshCw className={`text-[12px] ${loading ? "animate-spin" : ""}`} />
            </button>
            <button type="button" onClick={() => setShowModal(true)}
              style={{ background: accentGrad }}
              className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[12px] font-semibold text-white shadow-sm transition hover:opacity-90">
              <FiPlus className="text-[13px]" /> {t("threatConfig.newCredential")}
            </button>
          </div>
        </div>

        {/* Table — wrapped in overflow-hidden for corner clipping */}
        <div className="overflow-hidden rounded-b-xl">
        {loading ? (
          <div className="space-y-0">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-14 animate-pulse border-b border-slate-100 last:border-0 dark:border-white/6" />
            ))}
          </div>
        ) : creds.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <FiKey className="text-[24px] text-slate-300 dark:text-white/20" />
            <p className="text-[12.5px] text-slate-400 dark:text-white/35">{t("threatConfig.noCredentials")}</p>
          </div>
        ) : filteredCreds.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <FiSearch className="text-[24px] text-slate-300 dark:text-white/20" />
            <p className="text-[12.5px] text-slate-400 dark:text-white/35">
              {crTypeFilter.length > 0
                ? `${t("threatConfig.noCredentialsMatchType")}${crSearch ? ` ${t("threatConfig.andSearchTerm", { n: crSearch })}` : ""}`
                : t("threatConfig.noResultsFor", { n: crSearch })}
            </p>
          </div>
        ) : (
          <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-140">
              <thead>
                <tr className="border-b border-slate-100 dark:border-white/8">
                  <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">{t("threatConfig.name")}</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">{t("threatConfig.type")}</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">{t("threatConfig.login")}</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/60 dark:divide-white/5">
                {pagedCreds.map(cr => {
                  const badge   = typeBadgeStyle(cr.type);
                  const inUse   = usedCredIds.has(cr.id);
                  const usedBy  = usageCredMap.get(cr.id) ?? [];
                  const deleteTip = inUse
                    ? t("threatConfig.inUseCannotDelete", { n: usedBy.join(", ") })
                    : t("threatConfig.deleteCredentialTip");
                  return (
                    <tr key={cr.id} className="transition-colors hover:bg-slate-50/60 dark:hover:bg-white/2">
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[13px] font-semibold text-slate-800 dark:text-white/85">{cr.name}</p>
                          {inUse && (
                            <span title={t("threatConfig.usedBy", { n: usedBy.join(", ") })}
                              className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9.5px] font-bold text-amber-600 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                              {t("threatConfig.inUse")}
                            </span>
                          )}
                        </div>
                        {cr.comment && <p className="mt-0.5 text-[10.5px] text-slate-400 dark:text-white/30">{cr.comment}</p>}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold"
                          style={{ backgroundColor: badge.bg, color: badge.text }}>
                          {credTypeLabel(cr.type)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-[12px] text-slate-600 dark:text-white/55">
                        {cr.login || <span className="text-slate-300 dark:text-white/20">—</span>}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button type="button" onClick={() => openEdit(cr)}
                            className="grid h-7 w-7 place-items-center rounded-lg border border-blue-200 bg-blue-50 text-blue-600 transition hover:bg-blue-100 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
                            <FiEdit2 className="text-[11px]" />
                          </button>
                          <button type="button" title={deleteTip}
                            onClick={() => { if (!inUse) setDeleteItem(cr); }}
                            disabled={inUse}
                            className={["grid h-7 w-7 place-items-center rounded-lg border transition",
                              inUse
                                ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300 dark:border-white/8 dark:bg-white/3 dark:text-white/20"
                                : "border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300",
                            ].join(" ")}>
                            <FiTrash2 className="text-[11px]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {crTotalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 dark:border-white/8">
              <span className="text-[11px] text-slate-400 dark:text-white/30">{t("threatConfig.page")} {crPage} {t("threatConfig.of")} {crTotalPages}</span>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setCrPage(p => Math.max(1, p - 1))} disabled={crPage === 1}
                  className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200/70 bg-white text-slate-500 transition hover:bg-slate-50 disabled:opacity-40 dark:border-white/8 dark:bg-white/5 dark:text-white/50">
                  <FiChevronLeft className="text-[12px]" />
                </button>
                {Array.from({ length: crTotalPages }, (_, i) => i + 1).map(n => (
                  <button key={n} type="button" onClick={() => setCrPage(n)}
                    style={n === crPage ? { background: accentGrad } : undefined}
                    className={["grid h-7 w-7 place-items-center rounded-lg text-[11.5px] font-semibold transition",
                      n === crPage ? "text-white" : "border border-slate-200/70 bg-white text-slate-500 hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/50",
                    ].join(" ")}>
                    {n}
                  </button>
                ))}
                <button type="button" onClick={() => setCrPage(p => Math.min(crTotalPages, p + 1))} disabled={crPage === crTotalPages}
                  className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200/70 bg-white text-slate-500 transition hover:bg-slate-50 disabled:opacity-40 dark:border-white/8 dark:bg-white/5 dark:text-white/50">
                  <FiChevronRight className="text-[12px]" />
                </button>
              </div>
            </div>
          )}
          </>
        )}
        </div>{/* end overflow-hidden table wrapper */}
      </div>

      {/* ── New / Edit Credential Modal ── */}
      {showModal && createPortal(
        <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={resetModal} />
          <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-[#12101f]"
            style={{ boxShadow: `0 24px 64px -12px ${currentColor}40`, maxHeight: "90dvh", display: "flex", flexDirection: "column" }}>

            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/8">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl text-white" style={{ background: accentGrad }}>
                  {editItem ? <FiEdit2 className="text-[14px]" /> : <FiKey className="text-[14px]" />}
                </span>
                <div>
                  <p className="text-[9.5px] font-bold uppercase tracking-widest" style={{ color: currentColor }}>{t("threatConfig.tabs.credentials").toUpperCase()}</p>
                  <h3 className="text-[14px] font-bold text-slate-800 dark:text-white/90">{editItem ? t("threatConfig.editCredential") : t("threatConfig.newCredential")}</h3>
                </div>
              </div>
              <button type="button" onClick={resetModal}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:text-white/35 dark:hover:bg-white/8 focus:outline-none">
                <FiX className="text-[15px]" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
              <div>
                <label className={labelCls}>{t("threatConfig.name")} <span className="text-red-400">*</span></label>
                <input type="text" value={form.name} onChange={e => setF("name", e.target.value)}
                  placeholder={t("threatConfig.unnamedPlaceholder")} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{t("threatConfig.comment")}</label>
                <input type="text" value={form.comment ?? ""} onChange={e => setF("comment", e.target.value)}
                  placeholder={t("threatConfig.optionalDescriptionPlaceholder")} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{t("threatConfig.type")} <span className="text-red-400">*</span></label>
                <CustomSelect
                  options={CRED_TYPES.map(ct => ({ value: ct.value, label: ct.label }))}
                  value={form.type}
                  disabled={!!editItem}
                  onChange={v => {
                    setF("type", v as GMPCredentialType);
                    setF("auto_generate", false);
                    setShowPass(false); setShowPrivPass(false);
                    setShowCommunity(false); setShowCcPass(false);
                  }}
                  searchable={false}
                />
                {editItem && <p className="mt-1 text-[10.5px] text-slate-400 dark:text-white/30">{t("threatConfig.typeCannotChange")}</p>}
              </div>
              {renderFormFields()}
            </div>

            {/* Footer */}
            <div className="flex shrink-0 gap-2 border-t border-slate-100 px-5 py-4 dark:border-white/8">
              <button type="button" onClick={resetModal}
                className="flex-1 rounded-xl border border-slate-200 py-2 text-[12.5px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/8 dark:text-white/55 dark:hover:bg-white/5 focus:outline-none">
                {t("common.cancel")}
              </button>
              <button type="button" onClick={() => void handleSave()} disabled={saving}
                style={{ background: accentGrad }}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-[12.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-60 focus:outline-none">
                {saving && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                {editItem ? t("common.update") : t("common.save")}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Confirm Delete */}
      {deleteItem && (
        <ConfirmDeleteDialog
          name={deleteItem.name}
          onConfirm={() => void handleDelete()}
          onCancel={() => setDeleteItem(null)}
        />
      )}
    </>
  );
};

// ─────────────────────────────────────────────────────────────
// Targets tab
// ─────────────────────────────────────────────────────────────
const getAliveTests = (t: TFn) => [
  { value: "Scan Config Default",  label: t("threatConfig.aliveTestDefault") },
  { value: "Consider Alive",       label: t("threatConfig.aliveTestConsiderAlive") },
  { value: "ICMP Ping",            label: t("threatConfig.aliveTestIcmp") },
  { value: "TCP-ACK Service Ping", label: t("threatConfig.aliveTestTcpAck") },
  { value: "TCP-SYN Service Ping", label: t("threatConfig.aliveTestTcpSyn") },
  { value: "ARP Ping",             label: t("threatConfig.aliveTestArp") },
];

// Small "create new" icon button used next to credential / port list dropdowns
const PlusIconBtn: React.FC<{ title?: string }> = ({ title }) => (
  <button type="button" title={title}
    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200/70 bg-white text-slate-400 transition hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/30 dark:hover:bg-white/8">
    <FiPlus className="text-[13px]" />
  </button>
);

// Hosts / Exclude-Hosts: Manual or From-file selector
const HostsField: React.FC<{
  label: string; required?: boolean;
  value: string; onChange: (v: string) => void;
  placeholder?: string;
  fileKey: string;
  disabled?: boolean;
}> = ({ label, required, value, onChange, placeholder, fileKey, disabled }) => {
  const { t } = useLanguage();
  const [mode, setMode] = useState<"manual" | "file">("manual");

  const switchMode = (m: "manual" | "file") => {
    if (disabled) return;
    setMode(m);
    onChange("");
  };

  return (
    <div className={disabled ? "pointer-events-none" : ""}>
      <label className={labelCls}>{label} {required && <span className="text-red-400">*</span>}</label>
      <div className={`space-y-2 ${disabled ? "opacity-50" : ""}`}>
        {/* Manual */}
        <label className={`flex items-start gap-2.5 ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}>
          <input type="radio" checked={mode === "manual"} onChange={() => switchMode("manual")}
            disabled={disabled} className="mt-0.5 accent-blue-500" />
          <div className="flex-1 min-w-0">
            <span className="text-[12.5px] font-medium text-slate-700 dark:text-white/70">{t("threatConfig.portRangeManual")}</span>
            <input
              type="text"
              value={mode === "manual" ? value : ""}
              onChange={e => onChange(e.target.value)}
              disabled={disabled || mode !== "manual"}
              placeholder={placeholder}
              className={`${inputCls} mt-1.5 ${(disabled || mode !== "manual") ? "cursor-not-allowed opacity-40" : ""}`}
            />
          </div>
        </label>
        {/* From file */}
        <label className={`flex items-start gap-2.5 ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}>
          <input type="radio" checked={mode === "file"} onChange={() => switchMode("file")}
            disabled={disabled} className="mt-0.5 accent-blue-500" />
          <div className="flex-1 min-w-0">
            <span className="text-[12.5px] font-medium text-slate-700 dark:text-white/70">{t("threatConfig.portRangeFromFile")}</span>
            <div className={`mt-1.5 ${(disabled || mode !== "file") ? "pointer-events-none opacity-40" : ""}`}>
              <FileTextInput
                key={`${fileKey}-${mode}`}
                onChange={text => onChange(text)}
              />
            </div>
          </div>
        </label>
      </div>
    </div>
  );
};

const TargetsTab: React.FC<{ currentColor: string; accentGrad: string }> = ({
  currentColor, accentGrad,
}) => {
  const { t } = useLanguage();
  const ALIVE_TESTS = useMemo(() => getAliveTests(t), [t]);
  const [targets,   setTargets]   = useState<GMPTargetDTO[]>([]);
  const [portLists, setPortLists] = useState<GMPPortListDTO[]>([]);
  const [creds,     setCreds]     = useState<GMPCredentialDTO[]>([]);
  const [tasks,     setTasks]     = useState<GMPTaskDTO[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editItem,  setEditItem]  = useState<GMPTargetDTO | null>(null);
  const [saving,    setSaving]    = useState(false);
  const [deleteItem, setDeleteItem] = useState<GMPTargetDTO | null>(null);
  const [fieldResetKey, setFieldResetKey] = useState(0);
  const [tgSearch,          setTgSearch]          = useState("");
  const [tgPage,            setTgPage]            = useState(1);
  const [tgPortListFilter,  setTgPortListFilter]  = useState<string[]>([]);
  const [tgCredFilter,      setTgCredFilter]      = useState<string[]>([]);
  const TG_PAGE = 4;
  const hasFetched = useRef(false);

  const emptyForm: CreateTargetRequest = {
    name: "Unnamed", hosts: "", comment: "",
    exclude_hosts: "", port_list_id: "",
    alive_test: "Scan Config Default",
    multiple_ips: true,
    ssh_cred_id: "", ssh_port: "22",
    smb_cred_id: "", esxi_cred_id: "", snmp_cred_id: "",
    reverse_lookup: false, reverse_unify: false,
  };
  const [form, setForm] = useState<CreateTargetRequest>(emptyForm);
  const setF = <K extends keyof CreateTargetRequest>(k: K, v: CreateTargetRequest[K]) =>
    setForm(p => ({ ...p, [k]: v }));

  const filteredTargets = useMemo(() => {
    const q = tgSearch.toLowerCase();
    return targets.filter(tg => {
      const matchSearch = !q ||
        tg.name.toLowerCase().includes(q) ||
        tg.hosts.toLowerCase().includes(q) ||
        (tg.comment ?? "").toLowerCase().includes(q);
      const matchPortList = tgPortListFilter.length === 0 ||
        tgPortListFilter.includes(tg.port_list_id);
      const matchCred = tgCredFilter.length === 0 ||
        tgCredFilter.some(cid =>
          [tg.ssh_cred_id, tg.smb_cred_id, tg.esxi_cred_id, tg.snmp_cred_id].includes(cid),
        );
      return matchSearch && matchPortList && matchCred;
    });
  }, [targets, tgSearch, tgPortListFilter, tgCredFilter]);
  const tgTotalPages  = Math.max(1, Math.ceil(filteredTargets.length / TG_PAGE));
  const pagedTargets  = filteredTargets.slice((tgPage - 1) * TG_PAGE, tgPage * TG_PAGE);

  useEffect(() => { setTgPage(1); }, [tgSearch, tgPortListFilter, tgCredFilter]);

  const usedTargetIds = useMemo(
    () => new Set(tasks.map(tk => tk.target_id).filter(Boolean)),
    [tasks],
  );

  const usageTargetMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const tk of tasks) {
      if (tk.target_id) {
        const arr = map.get(tk.target_id) ?? [];
        if (!arr.includes(tk.name)) arr.push(tk.name);
        map.set(tk.target_id, arr);
      }
    }
    return map;
  }, [tasks]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [t, pl, cr, tk] = await Promise.all([
      ListGMPTargets(), ListGMPPortLists(), ListGMPCredentials(), ListGMPTasks(),
    ]);
    setTargets(t); setPortLists(pl); setCreds(cr); setTasks(tk);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    void fetchAll();
  }, [fetchAll]);


  const resetModal = () => {
    setShowModal(false);
    setEditItem(null);
    setForm(emptyForm);
    setFieldResetKey(k => k + 1);
  };

  const openEdit = (tg: GMPTargetDTO) => {
    setEditItem(tg);
    setForm({
      name: tg.name, hosts: tg.hosts, comment: tg.comment,
      exclude_hosts: tg.exclude_hosts ?? "",
      port_list_id: tg.port_list_id ?? "",
      alive_test: tg.alive_test || "Scan Config Default",
      multiple_ips: tg.multiple_ips ?? true,
      ssh_cred_id: tg.ssh_cred_id ?? "", ssh_port: tg.ssh_cred_port || "22",
      smb_cred_id: tg.smb_cred_id ?? "",
      esxi_cred_id: tg.esxi_cred_id ?? "",
      snmp_cred_id: tg.snmp_cred_id ?? "",
      reverse_lookup: tg.reverse_lookup_only ?? false,
      reverse_unify: tg.reverse_lookup_unify ?? false,
    });
    setFieldResetKey(k => k + 1);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { message.warning(t("threatConfig.nameRequired")); return; }
    if (!form.hosts.trim()) { message.warning(t("threatConfig.hostsRequired")); return; }
    setSaving(true);
    try {
      if (editItem) {
        await UpdateGMPTarget(editItem.id, form);
        message.success(t("threatConfig.targetUpdated"));
      } else {
        await CreateGMPTarget(form);
        message.success(t("threatConfig.targetCreated"));
      }
      resetModal();
      void fetchAll();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      message.error(msg || (editItem ? t("threatConfig.failedUpdateTarget") : t("threatConfig.failedCreateTarget")));
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    try {
      await DeleteGMPTarget(deleteItem.id);
      message.success(t("threatConfig.targetDeleted"));
      setDeleteItem(null);
      void fetchAll();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      message.error(msg || t("threatConfig.failedDelete")); setDeleteItem(null);
    }
  };

  const credsSummary = (tg: GMPTargetDTO): string => {
    const parts: string[] = [];
    if (tg.ssh_cred_name)  parts.push(`SSH:${tg.ssh_cred_name}`);
    if (tg.smb_cred_name)  parts.push(`SMB:${tg.smb_cred_name}`);
    if (tg.esxi_cred_name) parts.push(`ESXi:${tg.esxi_cred_name}`);
    if (tg.snmp_cred_name) parts.push(`SNMP:${tg.snmp_cred_name}`);
    return parts.join(" · ") || "—";
  };

  const isCustom = form.alive_test !== "Scan Config Default" && form.alive_test !== "Consider Alive";

  // Credential select helper
  const CredSelect: React.FC<{
    label: string; value: string; onChange: (v: string) => void;
    options: GMPCredentialDTO[];
    extra?: React.ReactNode;
    disabled?: boolean;
  }> = ({ label, value, onChange, options, extra, disabled }) => (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="flex gap-2">
        <CustomSelect
          options={[
            { value: "", label: t("threatConfig.selectCredential") },
            ...options.map(c => ({ value: c.id, label: c.name })),
          ]}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className="flex-1"
        />
        {!disabled && <PlusIconBtn title={`${t("threatConfig.newCredential")} (${label})`} />}
        {!disabled && extra}
        {disabled && extra && (
          <div className="pointer-events-none opacity-50">{extra}</div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <div className="rounded-xl border border-slate-200/80 bg-white dark:border-white/8 dark:bg-[#0d0b1a]/60">
        {/* Toolbar — single row: title + search + Port List dropdown + Credentials dropdown + buttons */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3.5 dark:border-white/8">
          {/* Title */}
          <div className="flex shrink-0 items-center gap-2.5">
            <FiTarget className="text-[14px] text-slate-400 dark:text-white/35" />
            <p className="text-[13px] font-bold text-slate-800 dark:text-white/90">
              {t("threatConfig.tabs.targets")}
              {!loading && <span className="ml-2 text-[11px] font-normal text-slate-400 dark:text-white/30">({filteredTargets.length}/{targets.length})</span>}
            </p>
          </div>

          {/* Search */}
          <div className="relative w-44">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400 dark:text-white/30" />
            <input type="text" value={tgSearch} onChange={e => setTgSearch(e.target.value)} placeholder={t("threatConfig.search")}
              className="w-full rounded-lg border border-slate-200/80 bg-white py-1.5 pl-8 pr-3 text-[12px] text-slate-700 placeholder-slate-400 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100 dark:border-white/8 dark:bg-white/5 dark:text-white/85 dark:placeholder-white/25" />
          </div>

          {/* ── Port List multi-select — shared component ── */}
          <CustomMultiSelect
            options={portLists.map(pl => ({
              value: pl.id,
              label: pl.name,
              badge: targets.filter(tg => tg.port_list_id === pl.id).length,
            }))}
            value={tgPortListFilter}
            onChange={setTgPortListFilter}
            placeholder={t("threatConfig.portList")}
            searchPlaceholder={t("threatConfig.searchPortList")}
            icon={<FiList />}
            className="w-44"
          />

          {/* ── Credentials multi-select — shared component ── */}
          <CustomMultiSelect
            options={creds.map(cr => ({
              value: cr.id,
              label: cr.name,
              badge: targets.filter(tg =>
                [tg.ssh_cred_id, tg.smb_cred_id, tg.esxi_cred_id, tg.snmp_cred_id].includes(cr.id),
              ).length,
            }))}
            value={tgCredFilter}
            onChange={setTgCredFilter}
            placeholder={t("threatConfig.credentials")}
            searchPlaceholder={t("threatConfig.searchCredential")}
            icon={<FiKey />}
            className="w-44"
          />

          {/* Buttons */}
          <div className="ml-auto flex items-center gap-2">
            {(tgPortListFilter.length > 0 || tgCredFilter.length > 0) && (
              <button type="button" onClick={() => { setTgPortListFilter([]); setTgCredFilter([]); }}
                className="text-[10.5px] font-medium text-slate-400 hover:text-slate-600 dark:text-white/30 dark:hover:text-white/55">
                {t("threatConfig.reset")}
              </button>
            )}
            <button type="button" onClick={() => void fetchAll()} disabled={loading}
              className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200/70 bg-white text-slate-500 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/8 dark:bg-white/5 dark:text-white/50">
              <FiRefreshCw className={`text-[12px] ${loading ? "animate-spin" : ""}`} />
            </button>
            <button type="button" onClick={() => setShowModal(true)}
              style={{ background: accentGrad }}
              className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[12px] font-semibold text-white shadow-sm transition hover:opacity-90">
              <FiPlus className="text-[13px]" /> {t("threatConfig.newTarget")}
            </button>
          </div>
        </div>

        {/* Table — wrapped in overflow-hidden for corner clipping */}
        <div className="overflow-hidden rounded-b-xl">
        {loading ? (
          <div className="space-y-0">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-14 animate-pulse border-b border-slate-100 last:border-0 dark:border-white/6" />
            ))}
          </div>
        ) : targets.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <FiTarget className="text-[24px] text-slate-300 dark:text-white/20" />
            <p className="text-[12.5px] text-slate-400 dark:text-white/35">{t("threatConfig.noTargets")}</p>
          </div>
        ) : filteredTargets.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <FiSearch className="text-[24px] text-slate-300 dark:text-white/20" />
            <p className="text-[12.5px] text-slate-400 dark:text-white/35">{t("threatConfig.noResultsFor", { n: tgSearch })}</p>
          </div>
        ) : (
          <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-195">
              <thead>
                <tr className="border-b border-slate-100 dark:border-white/8">
                  {[t("threatConfig.name"), t("threatConfig.hosts"), t("threatConfig.ips"), t("threatConfig.portList"), t("threatConfig.credentials"), ""].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/60 dark:divide-white/5">
                {pagedTargets.map(tg => {
                  const inUse    = usedTargetIds.has(tg.id);
                  const usedBy   = usageTargetMap.get(tg.id) ?? [];
                  const deleteTip = inUse
                    ? t("threatConfig.usedByTaskCannotDelete", { n: usedBy.join(", ") })
                    : t("threatConfig.deleteTargetTip");
                  return (
                    <tr key={tg.id} className="transition-colors hover:bg-slate-50/60 dark:hover:bg-white/2">
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[13px] font-semibold text-slate-800 dark:text-white/85">{tg.name}</p>
                          {inUse && (
                            <span title={t("threatConfig.usedBy", { n: usedBy.join(", ") })}
                              className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9.5px] font-bold text-amber-600 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                              {t("threatConfig.inUse")}
                            </span>
                          )}
                        </div>
                        {tg.comment && <p className="mt-0.5 text-[10.5px] text-slate-400 dark:text-white/30">({tg.comment})</p>}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-[12px] text-slate-600 dark:text-white/55 max-w-40 truncate">{tg.hosts}</td>
                      <td className="px-4 py-3.5 text-[12px] font-medium" style={{ color: currentColor }}>{tg.max_hosts || "—"}</td>
                      <td className="px-4 py-3.5 text-[12px] text-slate-600 dark:text-white/55">
                        {tg.port_list_name || <span className="text-slate-300 dark:text-white/20">—</span>}
                      </td>
                      <td className="px-4 py-3.5 text-[11.5px] text-slate-500 dark:text-white/45">{credsSummary(tg)}</td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button type="button" onClick={() => openEdit(tg)}
                            className="grid h-7 w-7 place-items-center rounded-lg border border-blue-200 bg-blue-50 text-blue-600 transition hover:bg-blue-100 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
                            <FiEdit2 className="text-[11px]" />
                          </button>
                          <button type="button" title={deleteTip}
                            onClick={() => { if (!inUse) setDeleteItem(tg); }}
                            disabled={inUse}
                            className={["grid h-7 w-7 place-items-center rounded-lg border transition",
                              inUse
                                ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300 dark:border-white/8 dark:bg-white/3 dark:text-white/20"
                                : "border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300",
                            ].join(" ")}>
                            <FiTrash2 className="text-[11px]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {tgTotalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 dark:border-white/8">
              <span className="text-[11px] text-slate-400 dark:text-white/30">{t("threatConfig.page")} {tgPage} {t("threatConfig.of")} {tgTotalPages}</span>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setTgPage(p => Math.max(1, p - 1))} disabled={tgPage === 1}
                  className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200/70 bg-white text-slate-500 transition hover:bg-slate-50 disabled:opacity-40 dark:border-white/8 dark:bg-white/5 dark:text-white/50">
                  <FiChevronLeft className="text-[12px]" />
                </button>
                {Array.from({ length: tgTotalPages }, (_, i) => i + 1).map(n => (
                  <button key={n} type="button" onClick={() => setTgPage(n)}
                    style={n === tgPage ? { background: accentGrad } : undefined}
                    className={["grid h-7 w-7 place-items-center rounded-lg text-[11.5px] font-semibold transition",
                      n === tgPage ? "text-white" : "border border-slate-200/70 bg-white text-slate-500 hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/50",
                    ].join(" ")}>
                    {n}
                  </button>
                ))}
                <button type="button" onClick={() => setTgPage(p => Math.min(tgTotalPages, p + 1))} disabled={tgPage === tgTotalPages}
                  className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200/70 bg-white text-slate-500 transition hover:bg-slate-50 disabled:opacity-40 dark:border-white/8 dark:bg-white/5 dark:text-white/50">
                  <FiChevronRight className="text-[12px]" />
                </button>
              </div>
            </div>
          )}
          </>
        )}
        </div>{/* end overflow-hidden table wrapper */}
      </div>

      {/* ── New / Edit Target Modal ── */}
      {showModal && createPortal(
        <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={resetModal} />
          <div className="relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-[#12101f]"
            style={{ boxShadow: `0 24px 64px -12px ${currentColor}40`, maxHeight: "92dvh" }}>

            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/8">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl text-white" style={{ background: accentGrad }}>
                  {editItem ? <FiEdit2 className="text-[14px]" /> : <FiTarget className="text-[14px]" />}
                </span>
                <div>
                  <p className="text-[9.5px] font-bold uppercase tracking-widest" style={{ color: currentColor }}>{t("threatConfig.tabs.targets").toUpperCase()}</p>
                  <h3 className="text-[14px] font-bold text-slate-800 dark:text-white/90">{editItem ? t("threatConfig.editTarget") : t("threatConfig.newTarget")}</h3>
                </div>
              </div>
              <button type="button" onClick={resetModal}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:text-white/35 dark:hover:bg-white/8 focus:outline-none">
                <FiX className="text-[15px]" />
              </button>
            </div>

            {/* Body */}
            {(() => {
              const isLocked = !!(editItem && usedTargetIds.has(editItem.id));
              const lockedBy = editItem ? (usageTargetMap.get(editItem.id) ?? []) : [];
              return (
              <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">

                {/* ── In-use warning banner ── */}
                {isLocked && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-500/25 dark:bg-amber-500/10">
                    <div className="flex items-start gap-2.5">
                      <FiAlertTriangle className="mt-0.5 shrink-0 text-[13px] text-amber-500" />
                      <div>
                        <p className="text-[12px] font-semibold text-amber-700 dark:text-amber-400">
                          {t("threatConfig.targetInUseBanner")}
                        </p>
                        <p className="mt-0.5 text-[11px] text-amber-600 dark:text-amber-400/80">
                          {t("threatConfig.usedBy", { n: "" })} <strong>{lockedBy.join(", ")}</strong>.{" "}
                          {t("threatConfig.targetInUseDetail")}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Name — always editable */}
                <div>
                  <label className={labelCls}>{t("threatConfig.name")} <span className="text-red-400">*</span></label>
                  <input type="text" value={form.name} onChange={e => setF("name", e.target.value)}
                    placeholder={t("threatConfig.unnamedPlaceholder")} className={inputCls} />
                </div>

                {/* Comment — always editable */}
                <div>
                  <label className={labelCls}>{t("threatConfig.comment")}</label>
                  <input type="text" value={form.comment ?? ""} onChange={e => setF("comment", e.target.value)}
                    placeholder={t("threatConfig.optionalDescriptionPlaceholder")} className={inputCls} />
                </div>

                {/* Hosts */}
                <HostsField
                  key={`hosts-${fieldResetKey}`}
                  label={t("threatConfig.hosts")} required
                  value={form.hosts}
                  onChange={v => setF("hosts", v)}
                  placeholder="192.168.1.0/24 or 10.0.0.1,10.0.0.2"
                  fileKey={`h-${fieldResetKey}`}
                  disabled={isLocked}
                />

                {/* Exclude Hosts */}
                <HostsField
                  key={`excl-${fieldResetKey}`}
                  label={t("threatConfig.excludeHosts")}
                  value={form.exclude_hosts ?? ""}
                  onChange={v => setF("exclude_hosts", v)}
                  placeholder="e.g. 192.168.1.1"
                  fileKey={`e-${fieldResetKey}`}
                  disabled={isLocked}
                />

                {/* Allow simultaneous IPs */}
                <div className={isLocked ? "opacity-50 pointer-events-none" : ""}>
                  <label className={labelCls}>{t("threatConfig.allowMultipleIPs")}</label>
                  <div className="flex gap-5 pt-0.5">
                    {([true, false] as const).map(v => (
                      <label key={String(v)} className={`flex items-center gap-2 text-[12.5px] text-slate-700 dark:text-white/70 ${isLocked ? "cursor-not-allowed" : "cursor-pointer"}`}>
                        <input type="radio" checked={form.multiple_ips === v}
                          onChange={() => setF("multiple_ips", v)}
                          disabled={isLocked} className="accent-blue-500" />
                        {v ? t("common.yes") : t("common.no")}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Port List */}
                <div>
                  <label className={labelCls}>{t("threatConfig.portList")}</label>
                  <div className="flex gap-2">
                    <CustomSelect
                      options={[
                        { value: "", label: t("threatConfig.selectPortList") },
                        ...portLists.map(pl => ({ value: pl.id, label: pl.name })),
                      ]}
                      value={form.port_list_id ?? ""}
                      onChange={v => setF("port_list_id", v)}
                      disabled={isLocked}
                      className="flex-1"
                    />
                    {!isLocked && <PlusIconBtn title={t("threatConfig.newPortList")} />}
                  </div>
                </div>

                {/* Alive Test */}
                <div className={isLocked ? "opacity-50 pointer-events-none" : ""}>
                  <label className={labelCls}>{t("threatConfig.aliveTest")}</label>
                  <div className="flex flex-wrap gap-x-5 gap-y-2 pt-0.5">
                    {ALIVE_TESTS.slice(0, 2).map(({ value: val, label }) => (
                      <label key={val} className={`flex items-center gap-2 text-[12.5px] text-slate-700 dark:text-white/70 ${isLocked ? "cursor-not-allowed" : "cursor-pointer"}`}>
                        <input type="radio" checked={form.alive_test === val}
                          onChange={() => setF("alive_test", val)}
                          disabled={isLocked} className="accent-blue-500" />
                        {label}
                      </label>
                    ))}
                    <label className={`flex items-center gap-2 text-[12.5px] text-slate-700 dark:text-white/70 ${isLocked ? "cursor-not-allowed" : "cursor-pointer"}`}>
                      <input type="radio" checked={isCustom}
                        onChange={() => setF("alive_test", "ICMP Ping")}
                        disabled={isLocked} className="accent-blue-500" />
                      {t("threatConfig.custom")}
                    </label>
                  </div>
                  {isCustom && (
                    <div className="mt-2">
                      <CustomSelect
                        options={ALIVE_TESTS.slice(2).map(at => ({ value: at.value, label: at.label }))}
                        value={form.alive_test ?? "ICMP Ping"}
                        onChange={v => setF("alive_test", v)}
                        disabled={isLocked}
                        searchable={false}
                      />
                    </div>
                  )}
                </div>

                {/* Credentials for authenticated checks */}
                <div className="rounded-xl border border-slate-200/70 bg-slate-50/60 p-4 space-y-3.5 dark:border-white/8 dark:bg-white/3">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-white/40">
                    {t("threatConfig.credentialsSection")}
                  </p>

                  <CredSelect label={t("threatConfig.credSsh")}
                    value={form.ssh_cred_id ?? ""} onChange={v => setF("ssh_cred_id", v)}
                    options={creds.filter(c => c.type === "up" || c.type === "usk")}
                    disabled={isLocked}
                    extra={
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className="text-[11.5px] text-slate-500 dark:text-white/40 whitespace-nowrap">{t("threatConfig.onPort")}</span>
                        <input type="text" value={form.ssh_port ?? "22"} onChange={e => setF("ssh_port", e.target.value)}
                          disabled={isLocked}
                          className={`${inputCls} w-16 text-center ${isLocked ? "cursor-not-allowed opacity-50" : ""}`} />
                      </div>
                    }
                  />

                  <CredSelect label={t("threatConfig.credSmb")}
                    value={form.smb_cred_id ?? ""} onChange={v => setF("smb_cred_id", v)}
                    options={creds.filter(c => c.type === "up")}
                    disabled={isLocked} />

                  <CredSelect label={t("threatConfig.credEsxi")}
                    value={form.esxi_cred_id ?? ""} onChange={v => setF("esxi_cred_id", v)}
                    options={creds.filter(c => c.type === "up")}
                    disabled={isLocked} />

                  <CredSelect label={t("threatConfig.credTypeSnmp")}
                    value={form.snmp_cred_id ?? ""} onChange={v => setF("snmp_cred_id", v)}
                    options={creds.filter(c => c.type === "snmp")}
                    disabled={isLocked} />
                </div>

                {/* Reverse Lookup */}
                <div className={`grid grid-cols-2 gap-4 ${isLocked ? "opacity-50 pointer-events-none" : ""}`}>
                  <div>
                    <label className={labelCls}>{t("threatConfig.reverseLookupOnly")}</label>
                    <div className="flex gap-5 pt-0.5">
                      {([true, false] as const).map(v => (
                        <label key={String(v)} className={`flex items-center gap-2 text-[12.5px] text-slate-700 dark:text-white/70 ${isLocked ? "cursor-not-allowed" : "cursor-pointer"}`}>
                          <input type="radio" checked={form.reverse_lookup === v}
                            onChange={() => setF("reverse_lookup", v)}
                            disabled={isLocked} className="accent-blue-500" />
                          {v ? t("common.yes") : t("common.no")}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>{t("threatConfig.reverseLookupUnify")}</label>
                    <div className="flex gap-5 pt-0.5">
                      {([true, false] as const).map(v => (
                        <label key={String(v)} className={`flex items-center gap-2 text-[12.5px] text-slate-700 dark:text-white/70 ${isLocked ? "cursor-not-allowed" : "cursor-pointer"}`}>
                          <input type="radio" checked={form.reverse_unify === v}
                            onChange={() => setF("reverse_unify", v)}
                            disabled={isLocked} className="accent-blue-500" />
                          {v ? t("common.yes") : t("common.no")}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

              </div>
              );
            })()}

            {/* Footer */}
            <div className="flex shrink-0 gap-2 border-t border-slate-100 px-5 py-4 dark:border-white/8">
              <button type="button" onClick={resetModal}
                className="flex-1 rounded-xl border border-slate-200 py-2 text-[12.5px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/8 dark:text-white/55 dark:hover:bg-white/5 focus:outline-none">
                {t("common.cancel")}
              </button>
              <button type="button" onClick={() => void handleSave()} disabled={saving}
                style={{ background: accentGrad }}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-[12.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-60 focus:outline-none">
                {saving && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                {editItem ? t("common.update") : t("common.save")}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Confirm Delete */}
      {deleteItem && (
        <ConfirmDeleteDialog
          name={deleteItem.name}
          onConfirm={() => void handleDelete()}
          onCancel={() => setDeleteItem(null)}
        />
      )}
    </>
  );
};

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────
const ThreatConfigPage: React.FC = () => {
  const { currentColor } = useStateContext();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<ActiveTab>("targets");

  const accentGrad = `linear-gradient(135deg, ${currentColor}, color-mix(in srgb, ${currentColor} 65%, #a855f7))`;

  const TABS: { key: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { key: "targets",     label: t("threatConfig.tabs.targets"),     icon: <FiTarget /> },
    { key: "credentials", label: t("threatConfig.tabs.credentials"), icon: <FiKey /> },
    { key: "portlists",   label: t("threatConfig.tabs.portLists"),   icon: <FiList /> },
  ];

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
        <div className="relative z-10 flex items-center gap-3 sm:gap-4">
          <div
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg sm:h-13 sm:w-13"
            style={{ background: accentGrad, boxShadow: `0 8px 24px -6px ${currentColor}50` }}
          >
            <FiSliders className="text-[20px] sm:text-[22px]" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] sm:text-[10.5px]" style={{ color: currentColor }}>
              THREAT INTELLIGENCE · CONFIGURATION
            </p>
            <h1 className="truncate text-[18px] font-bold text-slate-900 sm:text-[20px] dark:text-white/90">
              {t("threatConfig.title")}
            </h1>
            <p className="mt-0.5 truncate text-[11px] text-slate-500 sm:text-[12px] dark:text-white/45">
              {t("threatConfig.subtitle")}
            </p>
          </div>
        </div>
      </div>

      {/* ── Tab buttons ── */}
      <div className="flex flex-wrap gap-2">
        {TABS.map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            style={activeTab === tab.key ? { background: accentGrad } : undefined}
            className={[
              "flex items-center gap-1.5 rounded-lg border px-4 py-2 text-[12px] font-bold transition-all",
              activeTab === tab.key
                ? "border-transparent text-white"
                : "border-slate-200/70 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/8",
            ].join(" ")}
          >
            <span className="text-[13px]">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      {activeTab === "credentials" && <CredentialsTab currentColor={currentColor} accentGrad={accentGrad} />}
      {activeTab === "portlists"   && <PortListsTab   currentColor={currentColor} accentGrad={accentGrad} />}
      {activeTab === "targets"     && <TargetsTab     currentColor={currentColor} accentGrad={accentGrad} />}

      {/* Info note */}
      <div className="flex items-start gap-2 rounded-xl border border-slate-200/70 bg-slate-50/60 px-4 py-3.5 dark:border-white/8 dark:bg-white/3">
        <FiCheckCircle className="mt-0.5 shrink-0 text-[13px]" style={{ color: currentColor }} />
        <p className="text-[11.5px] text-slate-500 dark:text-white/45">
          {t("threatConfig.footerNote")}
        </p>
      </div>

    </div>
  );
};

export default ThreatConfigPage;
