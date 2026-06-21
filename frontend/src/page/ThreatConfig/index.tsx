import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
  FiSliders, FiKey, FiList, FiTarget, FiPlus, FiTrash2,
  FiRefreshCw, FiX, FiChevronDown, FiEye, FiEyeOff,
  FiAlertTriangle, FiCheckCircle, FiUpload, FiEdit2,
} from "react-icons/fi";
import { message } from "antd";
import {
  ListGMPPortLists, CreateGMPPortList, DeleteGMPPortList, ImportGMPPortList, UpdateGMPPortList,
  ListGMPCredentials, CreateGMPCredential, DeleteGMPCredential, UpdateGMPCredential,
  ListGMPTargets, CreateGMPTarget, DeleteGMPTarget, UpdateGMPTarget,
  CREDENTIAL_TYPE_LABELS,
  type GMPPortListDTO, type GMPCredentialDTO, type GMPTargetDTO,
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
const PortListsTab: React.FC<{ currentColor: string; accentGrad: string }> = ({
  currentColor, accentGrad,
}) => {
  const [lists,   setLists]   = useState<GMPPortListDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<GMPPortListDTO | null>(null);
  const [form, setForm] = useState<CreatePortListRequest>({ name: "Unnamed", comment: "", port_range: "T:1-5,7,9,U:1-3,5,7,9" });
  const [saving, setSaving] = useState(false);
  const [deleteItem, setDeleteItem] = useState<GMPPortListDTO | null>(null);
  // Port range mode: manual text vs. upload file
  const [portRangeMode, setPortRangeMode] = useState<"manual" | "file">("manual");
  const [portRangeFile, setPortRangeFile] = useState<File | null>(null);
  const portRangeFileRef = useRef<HTMLInputElement>(null);
  // Import modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  const hasFetched = useRef(false);

  const fetchLists = useCallback(async () => {
    setLoading(true);
    const data = await ListGMPPortLists();
    setLists(data);
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
  };

  const openEdit = (pl: GMPPortListDTO) => {
    setEditItem(pl);
    setForm({ name: pl.name, comment: pl.comment, port_range: "" });
    setPortRangeMode("manual");
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { message.warning("Name is required"); return; }

    if (editItem) {
      // Update — only name & comment (port ranges not editable via GMP modify)
      setSaving(true);
      try {
        await UpdateGMPPortList(editItem.id, { name: form.name.trim(), comment: form.comment });
        message.success("Port list updated");
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
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-white/8">
          <div className="flex items-center gap-2.5">
            <FiList className="text-[14px] text-slate-400 dark:text-white/35" />
            <p className="text-[13px] font-semibold text-slate-700 dark:text-white/80">
              Port Lists
              {!loading && <span className="ml-2 text-[11px] font-normal text-slate-400 dark:text-white/30">({lists.length})</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void fetchLists()} disabled={loading}
              title="Refresh"
              className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200/70 bg-white text-slate-500 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/8 dark:bg-white/5 dark:text-white/50">
              <FiRefreshCw className={`text-[12px] ${loading ? "animate-spin" : ""}`} />
            </button>
            <button type="button" onClick={() => setShowImportModal(true)}
              title="Import Port List"
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
        ) : (
          <div className="overflow-x-auto" style={{ maxHeight: "320px", overflowY: "auto" }}>
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
                {lists.map(pl => (
                  <tr key={pl.id} className="transition-colors hover:bg-slate-50/60 dark:hover:bg-white/2">
                    <td className="px-5 py-3.5">
                      <p className="text-[13px] font-semibold text-slate-800 dark:text-white/85">{pl.name}</p>
                      {pl.comment && <p className="text-[10.5px] text-slate-400 dark:text-white/30">{pl.comment}</p>}
                    </td>
                    <td className="px-4 py-3.5 text-right text-[12.5px] font-semibold text-slate-700 dark:text-white/70">
                      {pl.total.toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5 text-right text-[12.5px] text-slate-500 dark:text-white/45">
                      {pl.tcp.toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5 text-right text-[12.5px] text-slate-500 dark:text-white/45">
                      {pl.udp === 0
                        ? <span className="text-slate-300 dark:text-white/20">0</span>
                        : pl.udp.toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button type="button" onClick={() => openEdit(pl)}
                          className="grid h-7 w-7 place-items-center rounded-lg border border-blue-200 bg-blue-50 text-blue-600 transition hover:bg-blue-100 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
                          <FiEdit2 className="text-[11px]" />
                        </button>
                        <button type="button" onClick={() => setDeleteItem(pl)}
                          className="grid h-7 w-7 place-items-center rounded-lg border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                          <FiTrash2 className="text-[11px]" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── New / Edit Port List Modal ── */}
      {showModal && createPortal(
        <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={resetNewModal} />
          <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-[#12101f]"
            style={{ boxShadow: `0 24px 64px -12px ${currentColor}40` }}>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/8">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl text-white" style={{ background: accentGrad }}>
                  {editItem ? <FiEdit2 className="text-[14px]" /> : <FiList className="text-[14px]" />}
                </span>
                <div>
                  <p className="text-[9.5px] font-bold uppercase tracking-widest" style={{ color: currentColor }}>PORT LISTS</p>
                  <h3 className="text-[14px] font-bold text-slate-800 dark:text-white/90">{editItem ? "Edit Port List" : "New Port List"}</h3>
                </div>
              </div>
              <button type="button" onClick={resetNewModal}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:text-white/35 dark:hover:bg-white/8 focus:outline-none">
                <FiX className="text-[15px]" />
              </button>
            </div>
            {/* Body */}
            <div className="space-y-4 px-5 py-5">
              <div>
                <label className={labelCls}>Name <span className="text-red-400">*</span></label>
                <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Unnamed" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Comment</label>
                <input type="text" value={form.comment ?? ""} onChange={e => setForm(p => ({ ...p, comment: e.target.value }))}
                  placeholder="Optional description" className={inputCls} />
              </div>
              {/* Port Ranges — hidden in edit mode */}
              {!editItem ? (
                <div>
                  <label className={labelCls}>Port Ranges</label>
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
                <p className="rounded-lg border border-slate-200/70 bg-slate-50/60 px-3 py-2 text-[10.5px] text-slate-400 dark:border-white/8 dark:bg-white/3 dark:text-white/30">
                  Port ranges cannot be changed after creation — {editItem.total.toLocaleString()} ports ({editItem.tcp.toLocaleString()} TCP · {editItem.udp.toLocaleString()} UDP)
                </p>
              )}
              <div className="flex gap-2 pt-1">
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

  const fetchCreds = useCallback(async () => {
    setLoading(true);
    const data = await ListGMPCredentials();
    setCreds(data);
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
  };

  const openEdit = (cr: GMPCredentialDTO) => {
    setEditItem(cr);
    setForm({
      ...emptyForm,
      name: cr.name, comment: cr.comment,
      type: cr.type as GMPCredentialType,
      login: cr.login,
      auto_generate: false,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { message.warning("Name is required"); return; }
    setSaving(true);
    try {
      if (editItem) {
        await UpdateGMPCredential(editItem.id, form);
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
    const t = form.type;
    return (
      <div className="space-y-3.5">

        {/* ── Auto-generate (up / usk only) ── */}
        {(t === "up" || t === "usk") && (
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

        {/* ── Username (up / usk) ── */}
        {(t === "up" || t === "usk") && (
          <div>
            <label className={labelCls}>Username</label>
            <input type="text" value={form.login ?? ""} onChange={e => setF("login", e.target.value)}
              placeholder="username" className={inputCls} />
          </div>
        )}

        {/* ── Password (up, only when !autoGen) ── */}
        {t === "up" && !autoGen && (
          <PwField label="Password"
            value={form.password ?? ""} show={showPass}
            onChange={v => setF("password", v)} onToggle={() => setShowPass(p => !p)} />
        )}

        {/* ── SSH Private Key + Passphrase (usk, only when !autoGen) ── */}
        {t === "usk" && !autoGen && (
          <>
            <div>
              <label className={labelCls}>Private SSH Key</label>
              <FileTextInput
                key={`ssh-${fileResetKey}`}
                onChange={text => setF("private_key", text)}
                accept=".pem,.key,.txt"
              />
            </div>
            <PwField label="Passphrase for Private SSH Key"
              value={form.passphrase ?? ""} show={showPrivPass} placeholder="optional"
              onChange={v => setF("passphrase", v)} onToggle={() => setShowPrivPass(p => !p)} />
          </>
        )}

        {/* ── SNMP ── */}
        {t === "snmp" && (
          <>
            <PwField label="SNMP Community"
              value={form.community ?? ""} show={showCommunity} placeholder="community"
              onChange={v => setF("community", v)} onToggle={() => setShowCommunity(p => !p)} />
            <div>
              <label className={labelCls}>Username</label>
              <input type="text" value={form.login ?? ""} onChange={e => setF("login", e.target.value)}
                placeholder="username" className={inputCls} />
            </div>
            <PwField label="Password"
              value={form.password ?? ""} show={showPass} placeholder="authentication password"
              onChange={v => setF("password", v)} onToggle={() => setShowPass(p => !p)} />
            <PwField label="Privacy Password"
              value={form.privacy_password ?? ""} show={showPrivPass} placeholder="privacy password"
              onChange={v => setF("privacy_password", v)} onToggle={() => setShowPrivPass(p => !p)} />
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

        {/* ── S/MIME Certificate ── */}
        {t === "smime" && (
          <div>
            <label className={labelCls}>S/MIME Certificate</label>
            <FileTextInput key={`smime-${fileResetKey}`}
              onChange={text => setF("certificate", text)}
              accept=".pem,.crt,.cer,.der" />
          </div>
        )}

        {/* ── PGP Encryption Key ── */}
        {t === "pgp" && (
          <div>
            <label className={labelCls}>Public PGP Key</label>
            <FileTextInput key={`pgp-${fileResetKey}`}
              onChange={text => setF("public_pgp_key", text)}
              accept=".asc,.pgp,.txt" />
          </div>
        )}

        {/* ── Password only ── */}
        {t === "pw" && (
          <PwField label="Password"
            value={form.password ?? ""} show={showPass}
            onChange={v => setF("password", v)} onToggle={() => setShowPass(p => !p)} />
        )}

        {/* ── Client Certificate ── */}
        {t === "cc" && (
          <>
            <div>
              <label className={labelCls}>Client Certificate</label>
              <FileTextInput key={`cc-cert-${fileResetKey}`}
                onChange={text => setF("certificate", text)}
                accept=".pem,.crt,.cer" />
            </div>
            <div>
              <label className={labelCls}>Client Private Key</label>
              <FileTextInput key={`cc-key-${fileResetKey}`}
                onChange={text => setF("cc_private_key", text)}
                accept=".pem,.key" />
            </div>
            <PwField label="Passphrase for Client Private Key"
              value={form.cc_passphrase ?? ""} show={showCcPass} placeholder="optional"
              onChange={v => setF("cc_passphrase", v)} onToggle={() => setShowCcPass(p => !p)} />
          </>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white dark:border-white/8 dark:bg-[#0d0b1a]/60">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-white/8">
          <div className="flex items-center gap-2.5">
            <FiKey className="text-[14px] text-slate-400 dark:text-white/35" />
            <p className="text-[13px] font-semibold text-slate-700 dark:text-white/80">
              Credentials
              {!loading && <span className="ml-2 text-[11px] font-normal text-slate-400 dark:text-white/30">({creds.length})</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
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

        {/* Table */}
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
        ) : (
          <div className="overflow-x-auto" style={{ maxHeight: "320px", overflowY: "auto" }}>
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
                {creds.map(cr => {
                  const badge = typeBadgeStyle(cr.type);
                  return (
                    <tr key={cr.id} className="transition-colors hover:bg-slate-50/60 dark:hover:bg-white/2">
                      <td className="px-5 py-3.5">
                        <p className="text-[13px] font-semibold text-slate-800 dark:text-white/85">{cr.name}</p>
                        {cr.comment && <p className="text-[10.5px] text-slate-400 dark:text-white/30">{cr.comment}</p>}
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
                          <button type="button" onClick={() => setDeleteItem(cr)}
                            className="grid h-7 w-7 place-items-center rounded-lg border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
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
        )}
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
}> = ({ label, required, value, onChange, placeholder, fileKey }) => {
  const [mode, setMode] = useState<"manual" | "file">("manual");

  const switchMode = (m: "manual" | "file") => {
    setMode(m);
    onChange(""); // clear when switching
  };

  return (
    <div>
      <label className={labelCls}>{label} {required && <span className="text-red-400">*</span>}</label>
      <div className="space-y-2">
        {/* Manual */}
        <label className="flex cursor-pointer items-start gap-2.5">
          <input type="radio" checked={mode === "manual"} onChange={() => switchMode("manual")} className="mt-0.5 accent-blue-500" />
          <div className="flex-1 min-w-0">
            <span className="text-[12.5px] font-medium text-slate-700 dark:text-white/70">Manual</span>
            <input
              type="text"
              value={mode === "manual" ? value : ""}
              onChange={e => onChange(e.target.value)}
              disabled={mode !== "manual"}
              placeholder={placeholder}
              className={`${inputCls} mt-1.5 ${mode !== "manual" ? "cursor-not-allowed opacity-40" : ""}`}
            />
          </div>
        </label>
        {/* From file */}
        <label className="flex cursor-pointer items-start gap-2.5">
          <input type="radio" checked={mode === "file"} onChange={() => switchMode("file")} className="mt-0.5 accent-blue-500" />
          <div className="flex-1 min-w-0">
            <span className="text-[12.5px] font-medium text-slate-700 dark:text-white/70">From file</span>
            <div className={`mt-1.5 ${mode !== "file" ? "pointer-events-none opacity-40" : ""}`}>
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
  const [loading,   setLoading]   = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editItem,  setEditItem]  = useState<GMPTargetDTO | null>(null);
  const [saving,    setSaving]    = useState(false);
  const [deleteItem, setDeleteItem] = useState<GMPTargetDTO | null>(null);
  const [fieldResetKey, setFieldResetKey] = useState(0);
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

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [t, pl, cr] = await Promise.all([
      ListGMPTargets(), ListGMPPortLists(), ListGMPCredentials(),
    ]);
    setTargets(t); setPortLists(pl); setCreds(cr);
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
  }> = ({ label, value, onChange, options, extra }) => (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <select value={value} onChange={e => onChange(e.target.value)} className={`${selCls} pr-8`}>
            <option value="">Select a Credential</option>
            {options.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400" />
        </div>
        <PlusIconBtn title={`Create new ${label} credential`} />
        {extra}
      </div>
    </div>
  );

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white dark:border-white/8 dark:bg-[#0d0b1a]/60">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-white/8">
          <div className="flex items-center gap-2.5">
            <FiTarget className="text-[14px] text-slate-400 dark:text-white/35" />
            <p className="text-[13px] font-semibold text-slate-700 dark:text-white/80">
              Targets
              {!loading && <span className="ml-2 text-[11px] font-normal text-slate-400 dark:text-white/30">({targets.length})</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
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

        {/* Table */}
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
        ) : (
          <div className="overflow-x-auto" style={{ maxHeight: "320px", overflowY: "auto" }}>
            <table className="w-full min-w-195">
              <thead>
                <tr className="border-b border-slate-100 dark:border-white/8">
                  {["Name", "Hosts", "IPs", "Port List", "Credentials", ""].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/60 dark:divide-white/5">
                {targets.map(tg => (
                  <tr key={tg.id} className="transition-colors hover:bg-slate-50/60 dark:hover:bg-white/2">
                    <td className="px-4 py-3.5">
                      <p className="text-[13px] font-semibold text-slate-800 dark:text-white/85">{tg.name}</p>
                      {tg.comment && <p className="text-[10.5px] text-slate-400 dark:text-white/30">({tg.comment})</p>}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[12px] text-slate-600 dark:text-white/55 max-w-[160px] truncate">{tg.hosts}</td>
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
                        <button type="button" onClick={() => setDeleteItem(tg)}
                          className="grid h-7 w-7 place-items-center rounded-lg border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                          <FiTrash2 className="text-[11px]" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">

              {/* Name */}
              <div>
                <label className={labelCls}>Name <span className="text-red-400">*</span></label>
                <input type="text" value={form.name} onChange={e => setF("name", e.target.value)}
                  placeholder="Unnamed" className={inputCls} />
              </div>

              {/* Comment */}
              <div>
                <label className={labelCls}>Comment</label>
                <input type="text" value={form.comment ?? ""} onChange={e => setF("comment", e.target.value)}
                  placeholder="Optional description" className={inputCls} />
              </div>

              {/* Hosts — Manual / From file */}
              <HostsField
                key={`hosts-${fieldResetKey}`}
                label="Hosts" required
                value={form.hosts}
                onChange={v => setF("hosts", v)}
                placeholder="192.168.1.0/24 or 10.0.0.1,10.0.0.2"
                fileKey={`h-${fieldResetKey}`}
              />

              {/* Exclude Hosts — Manual / From file */}
              <HostsField
                key={`excl-${fieldResetKey}`}
                label="Exclude Hosts"
                value={form.exclude_hosts ?? ""}
                onChange={v => setF("exclude_hosts", v)}
                placeholder="e.g. 192.168.1.1"
                fileKey={`e-${fieldResetKey}`}
              />

              {/* Allow simultaneous IPs */}
              <div>
                <label className={labelCls}>Allow simultaneous scanning via multiple IPs</label>
                <div className="flex gap-5 pt-0.5">
                  {([true, false] as const).map(v => (
                    <label key={String(v)} className="flex cursor-pointer items-center gap-2 text-[12.5px] text-slate-700 dark:text-white/70">
                      <input type="radio" checked={form.multiple_ips === v}
                        onChange={() => setF("multiple_ips", v)} className="accent-blue-500" />
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
                      className={`${selCls} pr-8`}>
                      <option value="">— Select Port List —</option>
                      {portLists.map(pl => <option key={pl.id} value={pl.id}>{pl.name}</option>)}
                    </select>
                    <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400" />
                  </div>
                  <PlusIconBtn title="Create new Port List" />
                </div>
              </div>

              {/* Alive Test — horizontal radio buttons (matching OpenVAS) */}
              <div>
                <label className={labelCls}>Alive Test</label>
                <div className="flex flex-wrap gap-x-5 gap-y-2 pt-0.5">
                  <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-slate-700 dark:text-white/70">
                    <input type="radio" checked={form.alive_test === "Scan Config Default"}
                      onChange={() => setF("alive_test", "Scan Config Default")} className="accent-blue-500" />
                    Use Scan Config Default
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-slate-700 dark:text-white/70">
                    <input type="radio" checked={form.alive_test === "Consider Alive"}
                      onChange={() => setF("alive_test", "Consider Alive")} className="accent-blue-500" />
                    Consider Hosts as Alive
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-slate-700 dark:text-white/70">
                    <input type="radio" checked={isCustom}
                      onChange={() => setF("alive_test", "ICMP Ping")} className="accent-blue-500" />
                    Custom
                  </label>
                </div>
                {isCustom && (
                  <div className="relative mt-2">
                    <select value={form.alive_test} onChange={e => setF("alive_test", e.target.value)}
                      className={`${selCls} pr-8`}>
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

                {/* SSH — dropdown + [+] + on port */}
                <CredSelect label="SSH"
                  value={form.ssh_cred_id ?? ""} onChange={v => setF("ssh_cred_id", v)}
                  options={creds.filter(c => c.type === "up" || c.type === "usk")}
                  extra={
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="text-[11.5px] text-slate-500 dark:text-white/40 whitespace-nowrap">on port</span>
                      <input type="text" value={form.ssh_port ?? "22"} onChange={e => setF("ssh_port", e.target.value)}
                        className={`${inputCls} w-16 text-center`} />
                    </div>
                  }
                />

                {/* SMB */}
                <CredSelect label="SMB (NTLM)"
                  value={form.smb_cred_id ?? ""} onChange={v => setF("smb_cred_id", v)}
                  options={creds.filter(c => c.type === "up")} />

                {/* ESXi */}
                <CredSelect label="ESXi"
                  value={form.esxi_cred_id ?? ""} onChange={v => setF("esxi_cred_id", v)}
                  options={creds.filter(c => c.type === "up")} />

                {/* SNMP */}
                <CredSelect label="SNMP"
                  value={form.snmp_cred_id ?? ""} onChange={v => setF("snmp_cred_id", v)}
                  options={creds.filter(c => c.type === "snmp")} />
              </div>

              {/* Reverse Lookup — Yes first (matching OpenVAS) */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Reverse Lookup Only</label>
                  <div className="flex gap-5 pt-0.5">
                    {([true, false] as const).map(v => (
                      <label key={String(v)} className="flex cursor-pointer items-center gap-2 text-[12.5px] text-slate-700 dark:text-white/70">
                        <input type="radio" checked={form.reverse_lookup === v}
                          onChange={() => setF("reverse_lookup", v)} className="accent-blue-500" />
                        {v ? "Yes" : "No"}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Reverse Lookup Unify</label>
                  <div className="flex gap-5 pt-0.5">
                    {([true, false] as const).map(v => (
                      <label key={String(v)} className="flex cursor-pointer items-center gap-2 text-[12.5px] text-slate-700 dark:text-white/70">
                        <input type="radio" checked={form.reverse_unify === v}
                          onChange={() => setF("reverse_unify", v)} className="accent-blue-500" />
                        {v ? "Yes" : "No"}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

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
// Main Page
// ─────────────────────────────────────────────────────────────
const ThreatConfigPage: React.FC = () => {
  const { currentColor } = useStateContext();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<ActiveTab>("credentials");

  const accentGrad = `linear-gradient(135deg, ${currentColor}, color-mix(in srgb, ${currentColor} 65%, #a855f7))`;

  const TABS: { key: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { key: "credentials", label: "Credentials", icon: <FiKey /> },
    { key: "portlists",   label: "Port Lists",  icon: <FiList /> },
    { key: "targets",     label: "Targets",     icon: <FiTarget /> },
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
