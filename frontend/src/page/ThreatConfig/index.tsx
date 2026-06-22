import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  FiSliders, FiKey, FiList, FiTarget, FiPlus, FiTrash2,
  FiRefreshCw, FiX, FiChevronDown, FiChevronLeft, FiChevronRight,
  FiEye, FiEyeOff, FiAlertTriangle, FiCheckCircle, FiUpload, FiEdit2, FiSearch, FiCheck,
} from "react-icons/fi";
import { message } from "antd";
import {
  ListGMPPortLists, CreateGMPPortList, DeleteGMPPortList, ImportGMPPortList, UpdateGMPPortList,
  GetGMPPortListDetail, CreateGMPPortRange, DeleteGMPPortRange,
  ListGMPCredentials, CreateGMPCredential, DeleteGMPCredential, UpdateGMPCredential,
  ListGMPTargets, CreateGMPTarget, DeleteGMPTarget, UpdateGMPTarget,
  ListGMPTasks,
  CREDENTIAL_TYPE_LABELS,
  type GMPPortListDTO, type GMPPortRangeDTO, type GMPCredentialDTO, type GMPTargetDTO,
  type GMPTaskDTO,
  type CreatePortListRequest, type CreateCredentialRequest, type CreateTargetRequest,
  type GMPCredentialType,
} from "../../services/gmp";
import { useStateContext } from "../../contexts/ProviderContext";
import { useLanguage } from "../../contexts/LanguageContext";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

type ActiveTab = "credentials" | "portlists" | "targets";

const CRED_TYPES: { value: GMPCredentialType; label: string }[] = [
  { value: "up",    label: "Username + Password" },
  { value: "usk",   label: "Username + SSH Key" },
  { value: "snmp",  label: "SNMP" },
  { value: "smime", label: "S/MIME Certificate" },
  { value: "pgp",   label: "PGP Encryption Key" },
  { value: "pw",    label: "Password only" },
  { value: "cc",    label: "Client Certificate" },
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
}> = ({ name, onConfirm, onCancel }) =>
  createPortal(
    <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-[#12101f]">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-500/10">
          <FiAlertTriangle className="text-[22px] text-red-500" />
        </div>
        <h3 className="text-[15px] font-bold text-slate-800 dark:text-white/90">Confirm Delete</h3>
        <p className="mt-1.5 text-[12.5px] text-slate-500 dark:text-white/45">
          Delete <strong className="text-slate-700 dark:text-white/70">"{name}"</strong>? This cannot be undone.
        </p>
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onCancel}
            className="flex-1 rounded-xl border border-slate-200 py-2 text-[12.5px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/8 dark:text-white/55 dark:hover:bg-white/5 focus:outline-none">
            Cancel
          </button>
          <button type="button" onClick={onConfirm}
            className="flex-1 rounded-xl bg-red-500 py-2 text-[12.5px] font-semibold text-white transition hover:bg-red-600 focus:outline-none">
            Delete
          </button>
        </div>
      </div>
    </div>,
    document.body
  );

// ─────────────────────────────────────────────────────────────
// File upload area (shared by Port Lists tab)
// ─────────────────────────────────────────────────────────────
const FileUploadArea: React.FC<{
  file: File | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  accept?: string;
  onChange: (f: File | null) => void;
}> = ({ file, inputRef, accept, onChange }) => (
  <div
    onClick={() => inputRef.current?.click()}
    className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200/80 bg-white px-3.5 py-2.5 text-[12.5px] text-slate-500 transition hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/45 dark:hover:bg-white/8"
  >
    <FiUpload className="shrink-0 text-[14px] text-slate-400 dark:text-white/30" />
    <span className="min-w-0 flex-1 truncate">
      {file ? file.name : "Choose file..."}
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

// ─────────────────────────────────────────────────────────────
// File-as-text input (reads file content → calls onChange with text)
// ─────────────────────────────────────────────────────────────
const FileTextInput: React.FC<{
  onChange: (text: string) => void;
  accept?: string;
  placeholder?: string;
}> = ({ onChange, accept, placeholder = "Choose file..." }) => {
  const ref = useRef<HTMLInputElement | null>(null);
  const [filename, setFilename] = useState<string>("");

  return (
    <div
      onClick={() => ref.current?.click()}
      className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200/80 bg-white px-3.5 py-2.5 text-[12.5px] text-slate-500 transition hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/45 dark:hover:bg-white/8"
    >
      <FiUpload className="shrink-0 text-[14px] text-slate-400 dark:text-white/30" />
      <span className="min-w-0 flex-1 truncate">{filename || placeholder}</span>
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
      message.warning("Start and End ports are required"); return;
    }
    if (start < 1 || start > 65535) { message.warning("Start must be 1–65535"); return; }
    if (end < start || end > 65535) { message.warning("End must be ≥ Start and ≤ 65535"); return; }
    setAddingRange(true);
    try {
      await CreateGMPPortRange(editItem.id, { start, end, protocol: newRange.protocol });
      setNewRange({ start: "", end: "", protocol: "tcp" });
      await loadPortRanges(editItem.id);
      void fetchLists();
      message.success(`Port range ${start}–${end} (${newRange.protocol.toUpperCase()}) added`);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      message.error(msg || "Failed to add port range");
    } finally { setAddingRange(false); }
  };

  const handleDeleteRange = (rangeId: string) => {
    setPendingDeleteIds(prev => new Set(prev).add(rangeId));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { message.warning("Name is required"); return; }

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
            ? `Port list updated (${deleted} range${deleted > 1 ? "s" : ""} deleted)`
            : "Port list updated",
        );
        resetNewModal();
        void fetchLists();
      } catch (e: unknown) {
        const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
        message.error(msg || "Failed to update port list");
      } finally { setSaving(false); }
      return;
    }

    // Create
    let portRange = form.port_range;
    if (portRangeMode === "file") {
      if (!portRangeFile) { message.warning("Please select a file"); return; }
      portRange = (await readFileAsText(portRangeFile)).trim();
      if (!portRange) { message.warning("File is empty"); return; }
    } else {
      if (!portRange.trim()) { message.warning("Port range is required"); return; }
    }
    setSaving(true);
    try {
      await CreateGMPPortList({ ...form, port_range: portRange });
      message.success("Port list created");
      resetNewModal();
      void fetchLists();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      message.error(msg || "Failed to create port list");
    } finally { setSaving(false); }
  };

  const handleImport = async () => {
    if (!importFile) { message.warning("Please select an XML file"); return; }
    setImporting(true);
    try {
      await ImportGMPPortList(importFile);
      message.success("Port list imported");
      setShowImportModal(false);
      setImportFile(null);
      void fetchLists();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      message.error(msg || "Failed to import port list");
    } finally { setImporting(false); }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    try {
      await DeleteGMPPortList(deleteItem.id);
      message.success("Port list deleted");
      setDeleteItem(null);
      void fetchLists();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      message.error(msg || "Failed to delete");
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
            <p className="text-[13px] font-semibold text-slate-700 dark:text-white/80">
              Port Lists
              {!loading && <span className="ml-2 text-[11px] font-normal text-slate-400 dark:text-white/30">({filteredLists.length}/{lists.length})</span>}
            </p>
          </div>
          <div className="relative flex-1 max-w-56">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400 dark:text-white/30" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
              className="w-full rounded-lg border border-slate-200/80 bg-white py-1.5 pl-8 pr-3 text-[12px] text-slate-700 placeholder-slate-400 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100 dark:border-white/8 dark:bg-white/5 dark:text-white/85 dark:placeholder-white/25" />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={() => void fetchLists()} disabled={loading} title="Refresh"
              className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200/70 bg-white text-slate-500 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/8 dark:bg-white/5 dark:text-white/50">
              <FiRefreshCw className={`text-[12px] ${loading ? "animate-spin" : ""}`} />
            </button>
            <button type="button" onClick={() => setShowImportModal(true)} title="Import Port List"
              className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200/70 bg-white text-slate-500 transition hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/50">
              <FiUpload className="text-[12px]" />
            </button>
            <button type="button" onClick={() => setShowModal(true)}
              style={{ background: accentGrad }}
              className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[12px] font-semibold text-white shadow-sm transition hover:opacity-90">
              <FiPlus className="text-[13px]" /> New Port List
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
            <p className="text-[12.5px] text-slate-400 dark:text-white/35">No port lists found</p>
          </div>
        ) : filteredLists.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <FiSearch className="text-[24px] text-slate-300 dark:text-white/20" />
            <p className="text-[12.5px] text-slate-400 dark:text-white/35">No results for "{search}"</p>
          </div>
        ) : (
          <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-140">
              <thead>
                <tr className="border-b border-slate-100 dark:border-white/8">
                  <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">Name</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">Total</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">TCP</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">UDP</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">Actions</th>
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
                    ? "IANA standard port list — cannot be modified"
                    : "Edit port list";
                  const deleteTip = inUse
                    ? `In use by: ${usedBy.join(", ")} — cannot delete`
                    : "Delete port list";

                  return (
                    <tr key={pl.id} className="transition-colors hover:bg-slate-50/60 dark:hover:bg-white/2">
                      {/* Name + badges */}
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[13px] font-semibold text-slate-800 dark:text-white/85">{pl.name}</p>
                          {isIANA && (
                            <span className="inline-flex items-center rounded-full border border-blue-200/80 bg-blue-50 px-2 py-0.5 text-[9px] font-bold text-blue-500 dark:border-blue-500/25 dark:bg-blue-500/10 dark:text-blue-400">
                              IANA Standard
                            </span>
                          )}
                          {inUse && (
                            <span title={`Used by: ${usedBy.join(", ")}`}
                              className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9.5px] font-bold text-amber-600 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                              In use ({usedBy.length})
                            </span>
                          )}
                        </div>
                        {pl.comment && <p className="mt-0.5 text-[10.5px] text-slate-400 dark:text-white/30">{pl.comment}</p>}
                        {inUse && (
                          <p className="mt-0.5 text-[10px] text-slate-400 dark:text-white/25">
                            Used by: {usedBy.join(", ")}
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
              <span className="text-[11px] text-slate-400 dark:text-white/30">Page {page} of {plTotalPages}</span>
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
                  <p className="text-[9.5px] font-bold uppercase tracking-widest" style={{ color: currentColor }}>PORT LISTS</p>
                  <h3 className="text-[14px] font-bold text-slate-800 dark:text-white/90">
                    {editItem ? `Edit Port List` : "New Port List"}
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
                  <label className={labelCls}>Name <span className="text-red-400">*</span></label>
                  <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="Unnamed" className={inputCls} />
                </div>

                {/* Comment */}
                <div>
                  <label className={labelCls}>Comment</label>
                  <input type="text" value={form.comment ?? ""} onChange={e => setForm(p => ({ ...p, comment: e.target.value }))}
                    placeholder="Optional description" className={inputCls} />
                </div>

                {/* ── Port Ranges section ── */}
                {!editItem ? (
                  /* CREATE mode: manual text or file */
                  <div>
                    <label className={labelCls}>Port Ranges <span className="text-red-400">*</span></label>
                    <div className="space-y-3">
                      <label className="flex cursor-pointer items-start gap-2.5">
                        <input type="radio" checked={portRangeMode === "manual"}
                          onChange={() => setPortRangeMode("manual")} className="mt-0.5 accent-blue-500" />
                        <div className="flex-1 min-w-0">
                          <span className="text-[12.5px] font-medium text-slate-700 dark:text-white/70">Manual</span>
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
                          <span className="text-[12.5px] font-medium text-slate-700 dark:text-white/70">From file</span>
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
                      <label className={labelCls + " mb-0"}>Port Ranges</label>
                      {!loadingRanges && (
                        <div className="flex items-center gap-2">
                          {pendingDeleteIds.size > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[9.5px] font-semibold text-red-500 dark:bg-red-500/10 dark:text-red-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                              {pendingDeleteIds.size} pending delete
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
                        No port ranges yet. Add one below.
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-xl border border-slate-200/80 dark:border-white/8"
                        style={{ maxHeight: "220px", overflowY: "auto" }}>
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/80 dark:border-white/8 dark:bg-white/3">
                              <th className="px-3 py-2 text-left text-[9.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/30">Start</th>
                              <th className="px-3 py-2 text-left text-[9.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/30">End</th>
                              <th className="px-3 py-2 text-left text-[9.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/30">Protocol</th>
                              <th className="px-3 py-2 text-right text-[9.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/30">Actions</th>
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
                                  <button type="button" title="Mark for deletion (saved on Update)"
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
                      <label className={labelCls}>Add Port Range</label>
                      <div className="flex items-center gap-2">
                        <input type="number" min={1} max={65535} placeholder="Start"
                          value={newRange.start}
                          onChange={e => setNewRange(p => ({ ...p, start: e.target.value }))}
                          className={`${inputCls} w-24 text-center`} />
                        <span className="shrink-0 text-[12px] text-slate-400">—</span>
                        <input type="number" min={1} max={65535} placeholder="End"
                          value={newRange.end}
                          onChange={e => setNewRange(p => ({ ...p, end: e.target.value }))}
                          className={`${inputCls} w-24 text-center`} />
                        <div className="relative shrink-0">
                          <select value={newRange.protocol}
                            onChange={e => setNewRange(p => ({ ...p, protocol: e.target.value as "tcp" | "udp" }))}
                            className={`${inputCls} w-20 appearance-none pr-6`}>
                            <option value="tcp">TCP</option>
                            <option value="udp">UDP</option>
                          </select>
                          <FiChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-slate-400" />
                        </div>
                        <button type="button" onClick={() => void handleAddRange()} disabled={addingRange}
                          style={{ background: accentGrad }}
                          className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold text-white transition hover:opacity-90 disabled:opacity-60">
                          {addingRange
                            ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            : <FiPlus className="text-[12px]" />}
                          Add
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
                Cancel
              </button>
              <button type="button" onClick={() => void handleSave()} disabled={saving}
                style={{ background: accentGrad }}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-[12.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-60 focus:outline-none">
                {saving && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                {editItem ? "Update" : "Save"}
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
                  <p className="text-[9.5px] font-bold uppercase tracking-widest" style={{ color: currentColor }}>PORT LISTS</p>
                  <h3 className="text-[14px] font-bold text-slate-800 dark:text-white/90">Import Port List</h3>
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
                <label className={labelCls}>Import XML Port List</label>
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
                  Cancel
                </button>
                <button type="button" onClick={() => void handleImport()} disabled={importing}
                  style={{ background: accentGrad }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-[12.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-60 focus:outline-none">
                  {importing && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                  Import
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
const PRIV_ALGO_LABEL: Record<string, string> = { aes: "AES", des: "DES", none: "None" };

const CredentialsTab: React.FC<{ currentColor: string; accentGrad: string }> = ({
  currentColor, accentGrad,
}) => {
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
  const [crTypeOpen,     setCrTypeOpen]     = useState(false);
  const [crTypeSearch,   setCrTypeSearch]   = useState("");
  const crTypeRef = useRef<HTMLDivElement | null>(null);
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

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (crTypeRef.current && !crTypeRef.current.contains(e.target as Node)) {
        setCrTypeOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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
    if (!form.name.trim()) { message.warning("Name is required"); return; }
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
        message.success("Credential updated");
      } else {
        await CreateGMPCredential(form);
        message.success("Credential created");
      }
      resetModal();
      void fetchCreds();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      message.error(msg || (editItem ? "Failed to update credential" : "Failed to create credential"));
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    try {
      await DeleteGMPCredential(deleteItem.id);
      message.success("Credential deleted");
      setDeleteItem(null);
      void fetchCreds();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      message.error(msg || "Failed to delete");
      setDeleteItem(null);
    }
  };

  const credTypeLabel = (type: string) =>
    CREDENTIAL_TYPE_LABELS[type as GMPCredentialType] ?? type;

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
    const t      = form.type;
    const isEdit = !!editItem;

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
                Replace existing {sectionLabel.toLowerCase()} with
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
        {!isEdit && (t === "up" || t === "usk") && (
          <div>
            <label className={labelCls}>Auto-generate</label>
            <div className="flex gap-5 pt-0.5">
              {([true, false] as const).map(v => (
                <label key={String(v)} className="flex cursor-pointer items-center gap-2 text-[12.5px] text-slate-700 dark:text-white/70">
                  <input type="radio" checked={autoGen === v}
                    onChange={() => setF("auto_generate", v)} className="accent-blue-500" />
                  {v ? "Yes" : "No"}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* ── Username (up / usk / snmp) ── */}
        {(t === "up" || t === "usk" || t === "snmp") && (
          <div>
            <label className={labelCls}>Username</label>
            <input type="text" value={form.login ?? ""} onChange={e => setF("login", e.target.value)}
              placeholder="username" className={inputCls} />
          </div>
        )}

        {/* ══ Username + Password (up) ══ */}
        {t === "up" && (
          isEdit
            ? replaceRow("Password", "password",
                disabled => pwInput("password", showPass, () => setShowPass(p => !p), "New password", disabled))
            : !autoGen && (
              <PwField label="Password" value={form.password ?? ""} show={showPass}
                onChange={v => setF("password", v)} onToggle={() => setShowPass(p => !p)} />
            )
        )}

        {/* ══ Username + SSH Key (usk) ══ */}
        {t === "usk" && !autoGen && (
          isEdit ? (
            <>
              {replaceRow("SSH Private Key", "privateKey",
                disabled => (
                  <div className={disabled ? "pointer-events-none opacity-40" : ""}>
                    <FileTextInput key={`ssh-${fileResetKey}`}
                      onChange={text => setF("private_key", text)} accept=".pem,.key,.txt" />
                  </div>
                ))}
              {replaceRow("SSH Key Passphrase", "passphrase",
                disabled => pwInput("passphrase", showPrivPass, () => setShowPrivPass(p => !p), "Passphrase (optional)", disabled))}
            </>
          ) : (
            <>
              <div>
                <label className={labelCls}>Private SSH Key</label>
                <FileTextInput key={`ssh-${fileResetKey}`}
                  onChange={text => setF("private_key", text)} accept=".pem,.key,.txt" />
              </div>
              <PwField label="Passphrase for Private SSH Key"
                value={form.passphrase ?? ""} show={showPrivPass} placeholder="optional"
                onChange={v => setF("passphrase", v)} onToggle={() => setShowPrivPass(p => !p)} />
            </>
          )
        )}

        {/* ══ SNMP ══ */}
        {t === "snmp" && (
          <>
            {isEdit
              ? replaceRow("SNMP Community", "community",
                  disabled => pwInput("community", showCommunity, () => setShowCommunity(p => !p), "Community string", disabled))
              : <PwField label="SNMP Community" value={form.community ?? ""} show={showCommunity} placeholder="community"
                  onChange={v => setF("community", v)} onToggle={() => setShowCommunity(p => !p)} />}

            {isEdit
              ? replaceRow("Password", "password",
                  disabled => pwInput("password", showPass, () => setShowPass(p => !p), "Authentication password", disabled))
              : <PwField label="Password" value={form.password ?? ""} show={showPass} placeholder="authentication password"
                  onChange={v => setF("password", v)} onToggle={() => setShowPass(p => !p)} />}

            {isEdit
              ? replaceRow("Privacy Password", "privacyPass",
                  disabled => pwInput("privacy_password", showPrivPass, () => setShowPrivPass(p => !p), "Privacy password", disabled))
              : <PwField label="Privacy Password" value={form.privacy_password ?? ""} show={showPrivPass} placeholder="privacy password"
                  onChange={v => setF("privacy_password", v)} onToggle={() => setShowPrivPass(p => !p)} />}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Auth Algorithm</label>
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
                <label className={labelCls}>Privacy Algorithm</label>
                <div className="flex gap-3 pt-0.5">
                  {(["aes", "des", "none"] as const).map(algo => (
                    <label key={algo} className="flex cursor-pointer items-center gap-2 text-[12.5px] text-slate-700 dark:text-white/70">
                      <input type="radio" name="priv_algo" value={algo}
                        checked={form.privacy_algorithm === algo}
                        onChange={() => setF("privacy_algorithm", algo)} className="accent-blue-500" />
                      {PRIV_ALGO_LABEL[algo]}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ══ S/MIME Certificate (smime) ══ */}
        {t === "smime" && (
          isEdit
            ? replaceRow("S/MIME Certificate", "certificate",
                disabled => (
                  <div className={disabled ? "pointer-events-none opacity-40" : ""}>
                    <FileTextInput key={`smime-${fileResetKey}`}
                      onChange={text => setF("certificate", text)} accept=".pem,.crt,.cer,.der" />
                  </div>
                ))
            : <div>
                <label className={labelCls}>S/MIME Certificate</label>
                <FileTextInput key={`smime-${fileResetKey}`}
                  onChange={text => setF("certificate", text)} accept=".pem,.crt,.cer,.der" />
              </div>
        )}

        {/* ══ PGP Encryption Key (pgp) ══ */}
        {t === "pgp" && (
          isEdit
            ? replaceRow("PGP Public Key", "pgpKey",
                disabled => (
                  <div className={disabled ? "pointer-events-none opacity-40" : ""}>
                    <FileTextInput key={`pgp-${fileResetKey}`}
                      onChange={text => setF("public_pgp_key", text)} accept=".asc,.pgp,.txt" />
                  </div>
                ))
            : <div>
                <label className={labelCls}>Public PGP Key</label>
                <FileTextInput key={`pgp-${fileResetKey}`}
                  onChange={text => setF("public_pgp_key", text)} accept=".asc,.pgp,.txt" />
              </div>
        )}

        {/* ══ Password only (pw) ══ */}
        {t === "pw" && (
          isEdit
            ? replaceRow("Password", "password",
                disabled => pwInput("password", showPass, () => setShowPass(p => !p), "New password", disabled))
            : <PwField label="Password" value={form.password ?? ""} show={showPass}
                onChange={v => setF("password", v)} onToggle={() => setShowPass(p => !p)} />
        )}

        {/* ══ Client Certificate (cc) ══ */}
        {t === "cc" && (
          isEdit ? (
            <>
              {replaceRow("Client Certificate", "certificate",
                disabled => (
                  <div className={disabled ? "pointer-events-none opacity-40" : ""}>
                    <FileTextInput key={`cc-cert-${fileResetKey}`}
                      onChange={text => setF("certificate", text)} accept=".pem,.crt,.cer" />
                  </div>
                ))}
              {replaceRow("Client Private Key", "ccKey",
                disabled => (
                  <div className={disabled ? "pointer-events-none opacity-40" : ""}>
                    <FileTextInput key={`cc-key-${fileResetKey}`}
                      onChange={text => setF("cc_private_key", text)} accept=".pem,.key" />
                  </div>
                ))}
              {replaceRow("Key Passphrase", "ccPassphrase",
                disabled => pwInput("cc_passphrase", showCcPass, () => setShowCcPass(p => !p), "Passphrase (optional)", disabled))}
            </>
          ) : (
            <>
              <div>
                <label className={labelCls}>Client Certificate</label>
                <FileTextInput key={`cc-cert-${fileResetKey}`}
                  onChange={text => setF("certificate", text)} accept=".pem,.crt,.cer" />
              </div>
              <div>
                <label className={labelCls}>Client Private Key</label>
                <FileTextInput key={`cc-key-${fileResetKey}`}
                  onChange={text => setF("cc_private_key", text)} accept=".pem,.key" />
              </div>
              <PwField label="Passphrase for Client Private Key"
                value={form.cc_passphrase ?? ""} show={showCcPass} placeholder="optional"
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
            <p className="text-[13px] font-semibold text-slate-700 dark:text-white/80">
              Credentials
              {!loading && <span className="ml-2 text-[11px] font-normal text-slate-400 dark:text-white/30">({filteredCreds.length}/{creds.length})</span>}
            </p>
          </div>

          {/* Search */}
          <div className="relative flex-1 max-w-52">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400 dark:text-white/30" />
            <input type="text" value={crSearch} onChange={e => setCrSearch(e.target.value)} placeholder="Search..."
              className="w-full rounded-lg border border-slate-200/80 bg-white py-1.5 pl-8 pr-3 text-[12px] text-slate-700 placeholder-slate-400 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100 dark:border-white/8 dark:bg-white/5 dark:text-white/85 dark:placeholder-white/25" />
          </div>

          {/* Type multi-select dropdown */}
          <div className="relative" ref={crTypeRef}>
            <button type="button"
              onClick={() => setCrTypeOpen(p => !p)}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200/70 bg-white px-3 text-[10.5px] font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/8">
              <FiKey className="text-[11px]" />
              <span className="max-w-32 truncate">
                {crTypeFilter.length === 0
                  ? "All Types"
                  : crTypeFilter.length === 1
                    ? (CREDENTIAL_TYPE_LABELS[crTypeFilter[0]] ?? crTypeFilter[0])
                    : `${crTypeFilter.length} selected`}
              </span>
              {crTypeFilter.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />}
              <FiChevronDown className={`ml-0.5 text-[11px] transition-transform ${crTypeOpen ? "rotate-180" : ""}`} />
            </button>

            {crTypeOpen && (
              <div className="absolute left-0 z-9999 mt-1.5 w-64 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xl dark:border-white/10 dark:bg-[#0d0b1a]">
                <div className="border-b border-slate-100 p-2.5 dark:border-white/8">
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200/70 bg-slate-50 px-2.5 dark:border-white/8 dark:bg-white/5">
                    <FiSearch className="shrink-0 text-[11px] text-slate-400 dark:text-white/35" />
                    <input type="text" value={crTypeSearch} onChange={e => setCrTypeSearch(e.target.value)}
                      placeholder="Search type..."
                      className="h-8 w-full bg-transparent text-[11px] text-slate-700 outline-none placeholder:text-slate-400 dark:text-white/75 dark:placeholder:text-white/30" />
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <button type="button"
                      onClick={() => {
                        const visible = CRED_TYPES.filter(ct => ct.label.toLowerCase().includes(crTypeSearch.toLowerCase())).map(ct => ct.value);
                        const allSel  = visible.every(v => crTypeFilter.includes(v));
                        setCrTypeFilter(prev =>
                          allSel ? prev.filter(v => !visible.includes(v)) : [...new Set([...prev, ...visible])],
                        );
                      }}
                      className="text-[10px] font-medium text-blue-500 hover:text-blue-600 dark:text-blue-400">
                      {CRED_TYPES.filter(ct => ct.label.toLowerCase().includes(crTypeSearch.toLowerCase())).every(ct => crTypeFilter.includes(ct.value)) ? "Unselect all" : "Select all"}
                    </button>
                    {crTypeFilter.length > 0 && (
                      <button type="button" onClick={() => setCrTypeFilter([])}
                        className="text-[10px] font-medium text-slate-400 hover:text-slate-600 dark:text-white/35 dark:hover:text-white/55">
                        Clear
                      </button>
                    )}
                  </div>
                </div>
                <div className="max-h-36 overflow-y-auto p-2">
                  <div className="space-y-0.5">
                    {CRED_TYPES.filter(ct => ct.label.toLowerCase().includes(crTypeSearch.toLowerCase())).map(ct => {
                      const count   = creds.filter(c => c.type === ct.value).length;
                      const checked = crTypeFilter.includes(ct.value);
                      return (
                        <button key={ct.value} type="button"
                          onClick={() => setCrTypeFilter(prev =>
                            checked ? prev.filter(v => v !== ct.value) : [...prev, ct.value],
                          )}
                          className={["flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition",
                            checked ? "bg-blue-50 dark:bg-blue-500/10" : "hover:bg-slate-50 dark:hover:bg-white/5",
                          ].join(" ")}>
                          <span className={["flex h-4 w-4 shrink-0 items-center justify-center rounded border transition",
                            checked ? "border-blue-500 bg-blue-500 text-white" : "border-slate-300 bg-white text-transparent dark:border-white/20 dark:bg-white/5",
                          ].join(" ")}>
                            <FiCheck className="text-[9px]" />
                          </span>
                          <span className="flex-1 truncate text-[11px] text-slate-700 dark:text-white/75">{ct.label}</span>
                          <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-px text-[9.5px] font-semibold text-slate-500 dark:bg-white/8 dark:text-white/40">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={() => void fetchCreds()} disabled={loading}
              className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200/70 bg-white text-slate-500 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/8 dark:bg-white/5 dark:text-white/50">
              <FiRefreshCw className={`text-[12px] ${loading ? "animate-spin" : ""}`} />
            </button>
            <button type="button" onClick={() => setShowModal(true)}
              style={{ background: accentGrad }}
              className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[12px] font-semibold text-white shadow-sm transition hover:opacity-90">
              <FiPlus className="text-[13px]" /> New Credential
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
            <p className="text-[12.5px] text-slate-400 dark:text-white/35">No credentials found</p>
          </div>
        ) : filteredCreds.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <FiSearch className="text-[24px] text-slate-300 dark:text-white/20" />
            <p className="text-[12.5px] text-slate-400 dark:text-white/35">
              {crTypeFilter.length > 0
                ? `No credentials match the selected type${crSearch ? ` and "${crSearch}"` : ""}`
                : `No results for "${crSearch}"`}
            </p>
          </div>
        ) : (
          <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-140">
              <thead>
                <tr className="border-b border-slate-100 dark:border-white/8">
                  <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">Name</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">Type</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">Login</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/60 dark:divide-white/5">
                {pagedCreds.map(cr => {
                  const badge   = typeBadgeStyle(cr.type);
                  const inUse   = usedCredIds.has(cr.id);
                  const usedBy  = usageCredMap.get(cr.id) ?? [];
                  const deleteTip = inUse
                    ? `In use by: ${usedBy.join(", ")} — cannot delete`
                    : "Delete credential";
                  return (
                    <tr key={cr.id} className="transition-colors hover:bg-slate-50/60 dark:hover:bg-white/2">
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[13px] font-semibold text-slate-800 dark:text-white/85">{cr.name}</p>
                          {inUse && (
                            <span title={`Used by: ${usedBy.join(", ")}`}
                              className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9.5px] font-bold text-amber-600 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                              In use
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
              <span className="text-[11px] text-slate-400 dark:text-white/30">Page {crPage} of {crTotalPages}</span>
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
                  <p className="text-[9.5px] font-bold uppercase tracking-widest" style={{ color: currentColor }}>CREDENTIALS</p>
                  <h3 className="text-[14px] font-bold text-slate-800 dark:text-white/90">{editItem ? "Edit Credential" : "New Credential"}</h3>
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
                <label className={labelCls}>Name <span className="text-red-400">*</span></label>
                <input type="text" value={form.name} onChange={e => setF("name", e.target.value)}
                  placeholder="Unnamed" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Comment</label>
                <input type="text" value={form.comment ?? ""} onChange={e => setF("comment", e.target.value)}
                  placeholder="Optional description" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Type <span className="text-red-400">*</span></label>
                <div className="relative">
                  <select value={form.type}
                    disabled={!!editItem}
                    onChange={e => {
                      setF("type", e.target.value as GMPCredentialType);
                      setF("auto_generate", false);
                      setShowPass(false); setShowPrivPass(false);
                      setShowCommunity(false); setShowCcPass(false);
                    }}
                    className={`${inputCls} appearance-none pr-8 ${editItem ? "cursor-not-allowed opacity-60" : ""}`}>
                    {CRED_TYPES.map(ct => (
                      <option key={ct.value} value={ct.value}>{ct.label}</option>
                    ))}
                  </select>
                  <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400" />
                </div>
                {editItem && <p className="mt-1 text-[10.5px] text-slate-400 dark:text-white/30">Type cannot be changed. Leave password fields empty to keep existing values.</p>}
              </div>
              {renderFormFields()}
            </div>

            {/* Footer */}
            <div className="flex shrink-0 gap-2 border-t border-slate-100 px-5 py-4 dark:border-white/8">
              <button type="button" onClick={resetModal}
                className="flex-1 rounded-xl border border-slate-200 py-2 text-[12.5px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/8 dark:text-white/55 dark:hover:bg-white/5 focus:outline-none">
                Cancel
              </button>
              <button type="button" onClick={() => void handleSave()} disabled={saving}
                style={{ background: accentGrad }}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-[12.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-60 focus:outline-none">
                {saving && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                {editItem ? "Update" : "Save"}
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
const ALIVE_TESTS = [
  { value: "Scan Config Default",  label: "Use Scan Config Default" },
  { value: "Consider Alive",       label: "Consider Hosts as Alive" },
  { value: "ICMP Ping",            label: "ICMP Ping" },
  { value: "TCP-ACK Service Ping", label: "TCP-ACK Service Ping" },
  { value: "TCP-SYN Service Ping", label: "TCP-SYN Service Ping" },
  { value: "ARP Ping",             label: "ARP Ping" },
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
            <span className="text-[12.5px] font-medium text-slate-700 dark:text-white/70">Manual</span>
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
            <span className="text-[12.5px] font-medium text-slate-700 dark:text-white/70">From file</span>
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
  const [tgPlOpen,          setTgPlOpen]          = useState(false);
  const [tgPlSearch,        setTgPlSearch]        = useState("");
  const [tgCredOpen,        setTgCredOpen]        = useState(false);
  const [tgCredSearch,      setTgCredSearch]      = useState("");
  const tgPlRef   = useRef<HTMLDivElement | null>(null);
  const tgCredRef = useRef<HTMLDivElement | null>(null);
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

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (tgPlRef.current && !tgPlRef.current.contains(e.target as Node)) setTgPlOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (tgCredRef.current && !tgCredRef.current.contains(e.target as Node)) setTgCredOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

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
    if (!form.name.trim()) { message.warning("Name is required"); return; }
    if (!form.hosts.trim()) { message.warning("Hosts are required"); return; }
    setSaving(true);
    try {
      if (editItem) {
        await UpdateGMPTarget(editItem.id, form);
        message.success("Target updated");
      } else {
        await CreateGMPTarget(form);
        message.success("Target created");
      }
      resetModal();
      void fetchAll();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      message.error(msg || (editItem ? "Failed to update target" : "Failed to create target"));
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    try {
      await DeleteGMPTarget(deleteItem.id);
      message.success("Target deleted");
      setDeleteItem(null);
      void fetchAll();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      message.error(msg || "Failed to delete"); setDeleteItem(null);
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

  const selCls = `${inputCls} appearance-none`;
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
        <div className="relative flex-1">
          <select value={value} onChange={e => onChange(e.target.value)}
            disabled={disabled}
            className={`${selCls} pr-8 ${disabled ? "cursor-not-allowed opacity-50" : ""}`}>
            <option value="">Select a Credential</option>
            {options.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400" />
        </div>
        {!disabled && <PlusIconBtn title={`Create new ${label} credential`} />}
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
            <p className="text-[13px] font-semibold text-slate-700 dark:text-white/80">
              Targets
              {!loading && <span className="ml-2 text-[11px] font-normal text-slate-400 dark:text-white/30">({filteredTargets.length}/{targets.length})</span>}
            </p>
          </div>

          {/* Search */}
          <div className="relative w-44">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400 dark:text-white/30" />
            <input type="text" value={tgSearch} onChange={e => setTgSearch(e.target.value)} placeholder="Search..."
              className="w-full rounded-lg border border-slate-200/80 bg-white py-1.5 pl-8 pr-3 text-[12px] text-slate-700 placeholder-slate-400 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100 dark:border-white/8 dark:bg-white/5 dark:text-white/85 dark:placeholder-white/25" />
          </div>

          {/* ── Port List multi-select dropdown ── */}
          <div className="relative" ref={tgPlRef}>
            <button type="button" onClick={() => { setTgPlOpen(p => !p); setTgCredOpen(false); }}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200/70 bg-white px-3 text-[10.5px] font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/8">
              <FiList className="text-[11px]" />
              <span className="max-w-28 truncate">
                {tgPortListFilter.length === 0
                  ? "Port List"
                  : tgPortListFilter.length === 1
                    ? (portLists.find(p => p.id === tgPortListFilter[0])?.name ?? "1 selected")
                    : `${tgPortListFilter.length} selected`}
              </span>
              {tgPortListFilter.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />}
              <FiChevronDown className={`ml-0.5 text-[11px] transition-transform ${tgPlOpen ? "rotate-180" : ""}`} />
            </button>

            {tgPlOpen && (
              <div className="absolute left-0 z-9999 mt-1.5 w-64 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xl dark:border-white/10 dark:bg-[#0d0b1a]">
                <div className="border-b border-slate-100 p-2.5 dark:border-white/8">
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200/70 bg-slate-50 px-2.5 dark:border-white/8 dark:bg-white/5">
                    <FiSearch className="shrink-0 text-[11px] text-slate-400 dark:text-white/35" />
                    <input type="text" value={tgPlSearch} onChange={e => setTgPlSearch(e.target.value)} placeholder="Search port list..."
                      className="h-8 w-full bg-transparent text-[11px] text-slate-700 outline-none placeholder:text-slate-400 dark:text-white/75 dark:placeholder:text-white/30" />
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <button type="button"
                      onClick={() => {
                        const visible = portLists.filter(pl => pl.name.toLowerCase().includes(tgPlSearch.toLowerCase())).map(pl => pl.id);
                        const allSel  = visible.every(id => tgPortListFilter.includes(id));
                        setTgPortListFilter(prev =>
                          allSel ? prev.filter(id => !visible.includes(id)) : [...new Set([...prev, ...visible])],
                        );
                      }}
                      className="text-[10px] font-medium text-blue-500 hover:text-blue-600 dark:text-blue-400">
                      {portLists.filter(pl => pl.name.toLowerCase().includes(tgPlSearch.toLowerCase())).every(pl => tgPortListFilter.includes(pl.id)) ? "Unselect all" : "Select all"}
                    </button>
                    {tgPortListFilter.length > 0 && (
                      <button type="button" onClick={() => setTgPortListFilter([])}
                        className="text-[10px] font-medium text-slate-400 hover:text-slate-600 dark:text-white/35 dark:hover:text-white/55">Clear</button>
                    )}
                  </div>
                </div>
                <div className="max-h-36 overflow-y-auto p-2">
                  <div className="space-y-0.5">
                    {portLists.filter(pl => pl.name.toLowerCase().includes(tgPlSearch.toLowerCase())).map(pl => {
                      const count   = targets.filter(tg => tg.port_list_id === pl.id).length;
                      const checked = tgPortListFilter.includes(pl.id);
                      return (
                        <button key={pl.id} type="button"
                          onClick={() => setTgPortListFilter(prev =>
                            checked ? prev.filter(id => id !== pl.id) : [...prev, pl.id],
                          )}
                          className={["flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition",
                            checked ? "bg-blue-50 dark:bg-blue-500/10" : "hover:bg-slate-50 dark:hover:bg-white/5"].join(" ")}>
                          <span className={["flex h-4 w-4 shrink-0 items-center justify-center rounded border transition",
                            checked ? "border-blue-500 bg-blue-500 text-white" : "border-slate-300 bg-white text-transparent dark:border-white/20 dark:bg-white/5"].join(" ")}>
                            <FiCheck className="text-[9px]" />
                          </span>
                          <span className="flex-1 truncate text-[11px] text-slate-700 dark:text-white/75">{pl.name}</span>
                          <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-px text-[9.5px] font-semibold text-slate-500 dark:bg-white/8 dark:text-white/40">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Credentials multi-select dropdown ── */}
          <div className="relative" ref={tgCredRef}>
            <button type="button" onClick={() => { setTgCredOpen(p => !p); setTgPlOpen(false); }}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200/70 bg-white px-3 text-[10.5px] font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/8">
              <FiKey className="text-[11px]" />
              <span className="max-w-28 truncate">
                {tgCredFilter.length === 0
                  ? "Credentials"
                  : tgCredFilter.length === 1
                    ? (creds.find(c => c.id === tgCredFilter[0])?.name ?? "1 selected")
                    : `${tgCredFilter.length} selected`}
              </span>
              {tgCredFilter.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />}
              <FiChevronDown className={`ml-0.5 text-[11px] transition-transform ${tgCredOpen ? "rotate-180" : ""}`} />
            </button>

            {tgCredOpen && (
              <div className="absolute left-0 z-9999 mt-1.5 w-64 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xl dark:border-white/10 dark:bg-[#0d0b1a]">
                <div className="border-b border-slate-100 p-2.5 dark:border-white/8">
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200/70 bg-slate-50 px-2.5 dark:border-white/8 dark:bg-white/5">
                    <FiSearch className="shrink-0 text-[11px] text-slate-400 dark:text-white/35" />
                    <input type="text" value={tgCredSearch} onChange={e => setTgCredSearch(e.target.value)} placeholder="Search credential..."
                      className="h-8 w-full bg-transparent text-[11px] text-slate-700 outline-none placeholder:text-slate-400 dark:text-white/75 dark:placeholder:text-white/30" />
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <button type="button"
                      onClick={() => {
                        const visible = creds.filter(cr => cr.name.toLowerCase().includes(tgCredSearch.toLowerCase())).map(cr => cr.id);
                        const allSel  = visible.every(id => tgCredFilter.includes(id));
                        setTgCredFilter(prev =>
                          allSel ? prev.filter(id => !visible.includes(id)) : [...new Set([...prev, ...visible])],
                        );
                      }}
                      className="text-[10px] font-medium text-blue-500 hover:text-blue-600 dark:text-blue-400">
                      {creds.filter(cr => cr.name.toLowerCase().includes(tgCredSearch.toLowerCase())).every(cr => tgCredFilter.includes(cr.id)) ? "Unselect all" : "Select all"}
                    </button>
                    {tgCredFilter.length > 0 && (
                      <button type="button" onClick={() => setTgCredFilter([])}
                        className="text-[10px] font-medium text-slate-400 hover:text-slate-600 dark:text-white/35 dark:hover:text-white/55">Clear</button>
                    )}
                  </div>
                </div>
                <div className="max-h-36 overflow-y-auto p-2">
                  <div className="space-y-0.5">
                    {creds.filter(cr => cr.name.toLowerCase().includes(tgCredSearch.toLowerCase())).map(cr => {
                      const count   = targets.filter(tg =>
                        [tg.ssh_cred_id, tg.smb_cred_id, tg.esxi_cred_id, tg.snmp_cred_id].includes(cr.id),
                      ).length;
                      const checked = tgCredFilter.includes(cr.id);
                      return (
                        <button key={cr.id} type="button"
                          onClick={() => setTgCredFilter(prev =>
                            checked ? prev.filter(id => id !== cr.id) : [...prev, cr.id],
                          )}
                          className={["flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition",
                            checked ? "bg-blue-50 dark:bg-blue-500/10" : "hover:bg-slate-50 dark:hover:bg-white/5"].join(" ")}>
                          <span className={["flex h-4 w-4 shrink-0 items-center justify-center rounded border transition",
                            checked ? "border-blue-500 bg-blue-500 text-white" : "border-slate-300 bg-white text-transparent dark:border-white/20 dark:bg-white/5"].join(" ")}>
                            <FiCheck className="text-[9px]" />
                          </span>
                          <span className="flex-1 truncate text-[11px] text-slate-700 dark:text-white/75">{cr.name}</span>
                          <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-px text-[9.5px] font-semibold text-slate-500 dark:bg-white/8 dark:text-white/40">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="ml-auto flex items-center gap-2">
            {(tgPortListFilter.length > 0 || tgCredFilter.length > 0) && (
              <button type="button" onClick={() => { setTgPortListFilter([]); setTgCredFilter([]); }}
                className="text-[10.5px] font-medium text-slate-400 hover:text-slate-600 dark:text-white/30 dark:hover:text-white/55">
                Reset
              </button>
            )}
            <button type="button" onClick={() => void fetchAll()} disabled={loading}
              className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200/70 bg-white text-slate-500 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/8 dark:bg-white/5 dark:text-white/50">
              <FiRefreshCw className={`text-[12px] ${loading ? "animate-spin" : ""}`} />
            </button>
            <button type="button" onClick={() => setShowModal(true)}
              style={{ background: accentGrad }}
              className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[12px] font-semibold text-white shadow-sm transition hover:opacity-90">
              <FiPlus className="text-[13px]" /> New Target
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
            <p className="text-[12.5px] text-slate-400 dark:text-white/35">No targets found</p>
          </div>
        ) : filteredTargets.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <FiSearch className="text-[24px] text-slate-300 dark:text-white/20" />
            <p className="text-[12.5px] text-slate-400 dark:text-white/35">No results for this filter</p>
          </div>
        ) : (
          <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-195">
              <thead>
                <tr className="border-b border-slate-100 dark:border-white/8">
                  {["Name", "Hosts", "IPs", "Port List", "Credentials", ""].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/60 dark:divide-white/5">
                {pagedTargets.map(tg => {
                  const inUse    = usedTargetIds.has(tg.id);
                  const usedBy   = usageTargetMap.get(tg.id) ?? [];
                  const deleteTip = inUse
                    ? `Used by task${usedBy.length > 1 ? "s" : ""}: ${usedBy.join(", ")} — cannot delete`
                    : "Delete target";
                  return (
                    <tr key={tg.id} className="transition-colors hover:bg-slate-50/60 dark:hover:bg-white/2">
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[13px] font-semibold text-slate-800 dark:text-white/85">{tg.name}</p>
                          {inUse && (
                            <span title={`Used by: ${usedBy.join(", ")}`}
                              className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9.5px] font-bold text-amber-600 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                              In use
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
              <span className="text-[11px] text-slate-400 dark:text-white/30">Page {tgPage} of {tgTotalPages}</span>
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
                  <p className="text-[9.5px] font-bold uppercase tracking-widest" style={{ color: currentColor }}>TARGETS</p>
                  <h3 className="text-[14px] font-bold text-slate-800 dark:text-white/90">{editItem ? "Edit Target" : "New Target"}</h3>
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
                          Target is in use — limited editing
                        </p>
                        <p className="mt-0.5 text-[11px] text-amber-600 dark:text-amber-400/80">
                          Used by task{lockedBy.length > 1 ? "s" : ""}: <strong>{lockedBy.join(", ")}</strong>.
                          Only Name and Comment can be modified.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Name — always editable */}
                <div>
                  <label className={labelCls}>Name <span className="text-red-400">*</span></label>
                  <input type="text" value={form.name} onChange={e => setF("name", e.target.value)}
                    placeholder="Unnamed" className={inputCls} />
                </div>

                {/* Comment — always editable */}
                <div>
                  <label className={labelCls}>Comment</label>
                  <input type="text" value={form.comment ?? ""} onChange={e => setF("comment", e.target.value)}
                    placeholder="Optional description" className={inputCls} />
                </div>

                {/* Hosts */}
                <HostsField
                  key={`hosts-${fieldResetKey}`}
                  label="Hosts" required
                  value={form.hosts}
                  onChange={v => setF("hosts", v)}
                  placeholder="192.168.1.0/24 or 10.0.0.1,10.0.0.2"
                  fileKey={`h-${fieldResetKey}`}
                  disabled={isLocked}
                />

                {/* Exclude Hosts */}
                <HostsField
                  key={`excl-${fieldResetKey}`}
                  label="Exclude Hosts"
                  value={form.exclude_hosts ?? ""}
                  onChange={v => setF("exclude_hosts", v)}
                  placeholder="e.g. 192.168.1.1"
                  fileKey={`e-${fieldResetKey}`}
                  disabled={isLocked}
                />

                {/* Allow simultaneous IPs */}
                <div className={isLocked ? "opacity-50 pointer-events-none" : ""}>
                  <label className={labelCls}>Allow simultaneous scanning via multiple IPs</label>
                  <div className="flex gap-5 pt-0.5">
                    {([true, false] as const).map(v => (
                      <label key={String(v)} className={`flex items-center gap-2 text-[12.5px] text-slate-700 dark:text-white/70 ${isLocked ? "cursor-not-allowed" : "cursor-pointer"}`}>
                        <input type="radio" checked={form.multiple_ips === v}
                          onChange={() => setF("multiple_ips", v)}
                          disabled={isLocked} className="accent-blue-500" />
                        {v ? "Yes" : "No"}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Port List */}
                <div>
                  <label className={labelCls}>Port List</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <select value={form.port_list_id ?? ""} onChange={e => setF("port_list_id", e.target.value)}
                        disabled={isLocked}
                        className={`${selCls} pr-8 ${isLocked ? "cursor-not-allowed opacity-50" : ""}`}>
                        <option value="">— Select Port List —</option>
                        {portLists.map(pl => <option key={pl.id} value={pl.id}>{pl.name}</option>)}
                      </select>
                      <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400" />
                    </div>
                    {!isLocked && <PlusIconBtn title="Create new Port List" />}
                  </div>
                </div>

                {/* Alive Test */}
                <div className={isLocked ? "opacity-50 pointer-events-none" : ""}>
                  <label className={labelCls}>Alive Test</label>
                  <div className="flex flex-wrap gap-x-5 gap-y-2 pt-0.5">
                    {[
                      { val: "Scan Config Default", label: "Use Scan Config Default" },
                      { val: "Consider Alive",      label: "Consider Hosts as Alive" },
                    ].map(({ val, label }) => (
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
                      Custom
                    </label>
                  </div>
                  {isCustom && (
                    <div className="relative mt-2">
                      <select value={form.alive_test} onChange={e => setF("alive_test", e.target.value)}
                        disabled={isLocked} className={`${selCls} pr-8`}>
                        {ALIVE_TESTS.slice(2).map(at => (
                          <option key={at.value} value={at.value}>{at.label}</option>
                        ))}
                      </select>
                      <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400" />
                    </div>
                  )}
                </div>

                {/* Credentials for authenticated checks */}
                <div className="rounded-xl border border-slate-200/70 bg-slate-50/60 p-4 space-y-3.5 dark:border-white/8 dark:bg-white/3">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-white/40">
                    Credentials for authenticated checks
                  </p>

                  <CredSelect label="SSH"
                    value={form.ssh_cred_id ?? ""} onChange={v => setF("ssh_cred_id", v)}
                    options={creds.filter(c => c.type === "up" || c.type === "usk")}
                    disabled={isLocked}
                    extra={
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className="text-[11.5px] text-slate-500 dark:text-white/40 whitespace-nowrap">on port</span>
                        <input type="text" value={form.ssh_port ?? "22"} onChange={e => setF("ssh_port", e.target.value)}
                          disabled={isLocked}
                          className={`${inputCls} w-16 text-center ${isLocked ? "cursor-not-allowed opacity-50" : ""}`} />
                      </div>
                    }
                  />

                  <CredSelect label="SMB (NTLM)"
                    value={form.smb_cred_id ?? ""} onChange={v => setF("smb_cred_id", v)}
                    options={creds.filter(c => c.type === "up")}
                    disabled={isLocked} />

                  <CredSelect label="ESXi"
                    value={form.esxi_cred_id ?? ""} onChange={v => setF("esxi_cred_id", v)}
                    options={creds.filter(c => c.type === "up")}
                    disabled={isLocked} />

                  <CredSelect label="SNMP"
                    value={form.snmp_cred_id ?? ""} onChange={v => setF("snmp_cred_id", v)}
                    options={creds.filter(c => c.type === "snmp")}
                    disabled={isLocked} />
                </div>

                {/* Reverse Lookup */}
                <div className={`grid grid-cols-2 gap-4 ${isLocked ? "opacity-50 pointer-events-none" : ""}`}>
                  <div>
                    <label className={labelCls}>Reverse Lookup Only</label>
                    <div className="flex gap-5 pt-0.5">
                      {([true, false] as const).map(v => (
                        <label key={String(v)} className={`flex items-center gap-2 text-[12.5px] text-slate-700 dark:text-white/70 ${isLocked ? "cursor-not-allowed" : "cursor-pointer"}`}>
                          <input type="radio" checked={form.reverse_lookup === v}
                            onChange={() => setF("reverse_lookup", v)}
                            disabled={isLocked} className="accent-blue-500" />
                          {v ? "Yes" : "No"}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Reverse Lookup Unify</label>
                    <div className="flex gap-5 pt-0.5">
                      {([true, false] as const).map(v => (
                        <label key={String(v)} className={`flex items-center gap-2 text-[12.5px] text-slate-700 dark:text-white/70 ${isLocked ? "cursor-not-allowed" : "cursor-pointer"}`}>
                          <input type="radio" checked={form.reverse_unify === v}
                            onChange={() => setF("reverse_unify", v)}
                            disabled={isLocked} className="accent-blue-500" />
                          {v ? "Yes" : "No"}
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
                Cancel
              </button>
              <button type="button" onClick={() => void handleSave()} disabled={saving}
                style={{ background: accentGrad }}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-[12.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-60 focus:outline-none">
                {saving && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                {editItem ? "Update" : "Save"}
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
    { key: "targets",     label: "Targets",     icon: <FiTarget /> },
    { key: "credentials", label: "Credentials", icon: <FiKey /> },
    { key: "portlists",   label: "Port Lists",  icon: <FiList /> },
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
              "flex items-center gap-1.5 rounded-lg border px-4 py-2 text-[12px] font-semibold transition-all",
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
          All credentials and port lists are stored directly in <strong>OpenVAS (gvmd)</strong>. Changes take effect immediately.
        </p>
      </div>

    </div>
  );
};

export default ThreatConfigPage;
