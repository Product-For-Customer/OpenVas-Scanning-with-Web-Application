import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
  FiSliders, FiKey, FiList, FiTarget, FiPlus, FiTrash2,
  FiRefreshCw, FiX, FiChevronDown, FiEye, FiEyeOff,
  FiAlertTriangle, FiCheckCircle,
} from "react-icons/fi";
import { message } from "antd";
import {
  ListGMPPortLists, CreateGMPPortList, DeleteGMPPortList,
  ListGMPCredentials, CreateGMPCredential, DeleteGMPCredential,
  ListGMPTargets, CreateGMPTarget, DeleteGMPTarget,
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
const textareaCls = `${inputCls} resize-none font-mono text-[11px]`;

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
// Port Lists tab
// ─────────────────────────────────────────────────────────────
const PortListsTab: React.FC<{ currentColor: string; accentGrad: string }> = ({
  currentColor, accentGrad,
}) => {
  const [lists,   setLists]   = useState<GMPPortListDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<CreatePortListRequest>({ name: "", comment: "", port_range: "T:1-1024" });
  const [saving, setSaving] = useState(false);
  const [deleteItem, setDeleteItem] = useState<GMPPortListDTO | null>(null);
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

  const handleCreate = async () => {
    if (!form.name.trim()) { message.warning("Name is required"); return; }
    if (!form.port_range.trim()) { message.warning("Port range is required"); return; }
    setSaving(true);
    try {
      await CreateGMPPortList(form);
      message.success("Port list created");
      setShowModal(false);
      setForm({ name: "", comment: "", port_range: "T:1-1024" });
      void fetchLists();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      message.error(msg || "Failed to create port list");
    } finally { setSaving(false); }
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
              className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200/70 bg-white text-slate-500 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/8 dark:bg-white/5 dark:text-white/50">
              <FiRefreshCw className={`text-[12px] ${loading ? "animate-spin" : ""}`} />
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
                      <button type="button" onClick={() => setDeleteItem(pl)}
                        className="grid h-7 w-7 place-items-center rounded-lg border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                        <FiTrash2 className="text-[11px]" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showModal && createPortal(
        <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={() => setShowModal(false)} />
          <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-[#12101f]"
            style={{ boxShadow: `0 24px 64px -12px ${currentColor}40` }}>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/8">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl text-white" style={{ background: accentGrad }}>
                  <FiList className="text-[14px]" />
                </span>
                <div>
                  <p className="text-[9.5px] font-bold uppercase tracking-widest" style={{ color: currentColor }}>PORT LISTS</p>
                  <h3 className="text-[14px] font-bold text-slate-800 dark:text-white/90">New Port List</h3>
                </div>
              </div>
              <button type="button" onClick={() => setShowModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:text-white/35 dark:hover:bg-white/8 focus:outline-none">
                <FiX className="text-[15px]" />
              </button>
            </div>
            {/* Body */}
            <div className="space-y-4 px-5 py-5">
              <div>
                <label className={labelCls}>Name <span className="text-red-400">*</span></label>
                <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. My Custom Ports" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Comment</label>
                <input type="text" value={form.comment ?? ""} onChange={e => setForm(p => ({ ...p, comment: e.target.value }))}
                  placeholder="Optional description" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Port Ranges <span className="text-red-400">*</span></label>
                <input type="text" value={form.port_range} onChange={e => setForm(p => ({ ...p, port_range: e.target.value }))}
                  placeholder="T:1-5,7,9,U:1-3,5,7,9" className={inputCls} />
                <p className="mt-1.5 text-[10.5px] text-slate-400 dark:text-white/30">
                  T: = TCP, U: = UDP. Example: <code className="rounded bg-slate-100 px-1 text-[10px] dark:bg-white/8">T:1-1024,U:161,162</code>
                </p>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-2 text-[12.5px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/8 dark:text-white/55 dark:hover:bg-white/5 focus:outline-none">
                  Cancel
                </button>
                <button type="button" onClick={() => void handleCreate()} disabled={saving}
                  style={{ background: accentGrad }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-[12.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-60 focus:outline-none">
                  {saving && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                  Save
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
const CredentialsTab: React.FC<{ currentColor: string; accentGrad: string }> = ({
  currentColor, accentGrad,
}) => {
  const [creds,   setCreds]   = useState<GMPCredentialDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [deleteItem, setDeleteItem] = useState<GMPCredentialDTO | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [showPrivPass, setShowPrivPass] = useState(false);
  const hasFetched = useRef(false);

  const [form, setForm] = useState<CreateCredentialRequest>({
    name: "", comment: "", type: "up",
    login: "", password: "",
    private_key: "", passphrase: "",
    community: "", auth_algorithm: "sha1", privacy_algorithm: "aes", privacy_password: "",
    certificate: "", public_pgp_key: "",
    cc_private_key: "", cc_passphrase: "",
  });

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

  const handleCreate = async () => {
    if (!form.name.trim()) { message.warning("Name is required"); return; }
    setSaving(true);
    try {
      await CreateGMPCredential(form);
      message.success("Credential created");
      setShowModal(false);
      setForm({ name: "", comment: "", type: "up", login: "", password: "", private_key: "", passphrase: "", community: "", auth_algorithm: "sha1", privacy_algorithm: "aes", privacy_password: "", certificate: "", public_pgp_key: "", cc_private_key: "", cc_passphrase: "" });
      setShowPass(false); setShowPrivPass(false);
      void fetchCreds();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      message.error(msg || "Failed to create credential");
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

  // Dynamic form fields
  const renderFormFields = () => {
    const t = form.type;
    return (
      <div className="space-y-3.5">
        {/* Login — for up, usk, snmp */}
        {(t === "up" || t === "usk" || t === "snmp") && (
          <div>
            <label className={labelCls}>Username</label>
            <input type="text" value={form.login ?? ""} onChange={e => setF("login", e.target.value)}
              placeholder="username" className={inputCls} />
          </div>
        )}

        {/* Password — for up, snmp, pw */}
        {(t === "up" || t === "pw") && (
          <div>
            <label className={labelCls}>Password</label>
            <div className="relative">
              <input type={showPass ? "text" : "password"} value={form.password ?? ""} onChange={e => setF("password", e.target.value)}
                placeholder="••••••••" className={`${inputCls} pr-10`} />
              <button type="button" onClick={() => setShowPass(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-white/30 focus:outline-none">
                {showPass ? <FiEyeOff className="text-[13px]" /> : <FiEye className="text-[13px]" />}
              </button>
            </div>
          </div>
        )}

        {/* SSH Private Key */}
        {t === "usk" && (
          <>
            <div>
              <label className={labelCls}>Private SSH Key</label>
              <textarea rows={4} value={form.private_key ?? ""} onChange={e => setF("private_key", e.target.value)}
                placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;...&#10;-----END RSA PRIVATE KEY-----"
                className={textareaCls} />
            </div>
            <div>
              <label className={labelCls}>Passphrase (optional)</label>
              <input type="password" value={form.passphrase ?? ""} onChange={e => setF("passphrase", e.target.value)}
                placeholder="optional" className={inputCls} />
            </div>
          </>
        )}

        {/* SNMP fields */}
        {t === "snmp" && (
          <>
            <div>
              <label className={labelCls}>SNMP Community</label>
              <input type="text" value={form.community ?? ""} onChange={e => setF("community", e.target.value)}
                placeholder="public" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Auth Password</label>
              <div className="relative">
                <input type={showPass ? "text" : "password"} value={form.password ?? ""} onChange={e => setF("password", e.target.value)}
                  placeholder="authentication password" className={`${inputCls} pr-10`} />
                <button type="button" onClick={() => setShowPass(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-white/30 focus:outline-none">
                  {showPass ? <FiEyeOff className="text-[13px]" /> : <FiEye className="text-[13px]" />}
                </button>
              </div>
            </div>
            <div>
              <label className={labelCls}>Privacy Password</label>
              <div className="relative">
                <input type={showPrivPass ? "text" : "password"} value={form.privacy_password ?? ""} onChange={e => setF("privacy_password", e.target.value)}
                  placeholder="privacy password" className={`${inputCls} pr-10`} />
                <button type="button" onClick={() => setShowPrivPass(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-white/30 focus:outline-none">
                  {showPrivPass ? <FiEyeOff className="text-[13px]" /> : <FiEye className="text-[13px]" />}
                </button>
              </div>
            </div>
            {/* Auth Algorithm */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Auth Algorithm</label>
                <div className="flex gap-3 pt-0.5">
                  {(["md5", "sha1"] as const).map(algo => (
                    <label key={algo} className="flex cursor-pointer items-center gap-2 text-[12.5px] text-slate-700 dark:text-white/70">
                      <input type="radio" name="auth_algo" value={algo}
                        checked={form.auth_algorithm === algo}
                        onChange={() => setF("auth_algorithm", algo)}
                        className="accent-blue-500" />
                      {algo.toUpperCase()}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>Privacy Algorithm</label>
                <div className="flex gap-2 pt-0.5">
                  {(["aes", "des", "none"] as const).map(algo => (
                    <label key={algo} className="flex cursor-pointer items-center gap-2 text-[12.5px] text-slate-700 dark:text-white/70">
                      <input type="radio" name="priv_algo" value={algo}
                        checked={form.privacy_algorithm === algo}
                        onChange={() => setF("privacy_algorithm", algo)}
                        className="accent-blue-500" />
                      {algo.toUpperCase()}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* S/MIME Certificate */}
        {t === "smime" && (
          <div>
            <label className={labelCls}>S/MIME Certificate</label>
            <textarea rows={5} value={form.certificate ?? ""} onChange={e => setF("certificate", e.target.value)}
              placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
              className={textareaCls} />
          </div>
        )}

        {/* PGP Key */}
        {t === "pgp" && (
          <div>
            <label className={labelCls}>Public PGP Key</label>
            <textarea rows={5} value={form.public_pgp_key ?? ""} onChange={e => setF("public_pgp_key", e.target.value)}
              placeholder="-----BEGIN PGP PUBLIC KEY BLOCK-----&#10;...&#10;-----END PGP PUBLIC KEY BLOCK-----"
              className={textareaCls} />
          </div>
        )}

        {/* Client Certificate */}
        {t === "cc" && (
          <>
            <div>
              <label className={labelCls}>Client Certificate</label>
              <textarea rows={4} value={form.certificate ?? ""} onChange={e => setF("certificate", e.target.value)}
                placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                className={textareaCls} />
            </div>
            <div>
              <label className={labelCls}>Client Private Key</label>
              <textarea rows={4} value={form.cc_private_key ?? ""} onChange={e => setF("cc_private_key", e.target.value)}
                placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;...&#10;-----END RSA PRIVATE KEY-----"
                className={textareaCls} />
            </div>
            <div>
              <label className={labelCls}>Passphrase for Private Key (optional)</label>
              <input type="password" value={form.cc_passphrase ?? ""} onChange={e => setF("cc_passphrase", e.target.value)}
                placeholder="optional" className={inputCls} />
            </div>
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
                        <button type="button" onClick={() => setDeleteItem(cr)}
                          className="grid h-7 w-7 place-items-center rounded-lg border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                          <FiTrash2 className="text-[11px]" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Credential Modal */}
      {showModal && createPortal(
        <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={() => { setShowModal(false); setShowPass(false); setShowPrivPass(false); }} />
          <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-[#12101f]"
            style={{ boxShadow: `0 24px 64px -12px ${currentColor}40`, maxHeight: "90dvh", display: "flex", flexDirection: "column" }}>
            {/* Modal Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/8">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl text-white" style={{ background: accentGrad }}>
                  <FiKey className="text-[14px]" />
                </span>
                <div>
                  <p className="text-[9.5px] font-bold uppercase tracking-widest" style={{ color: currentColor }}>CREDENTIALS</p>
                  <h3 className="text-[14px] font-bold text-slate-800 dark:text-white/90">New Credential</h3>
                </div>
              </div>
              <button type="button" onClick={() => { setShowModal(false); setShowPass(false); setShowPrivPass(false); }}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:text-white/35 dark:hover:bg-white/8 focus:outline-none">
                <FiX className="text-[15px]" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
              {/* Name */}
              <div>
                <label className={labelCls}>Name <span className="text-red-400">*</span></label>
                <input type="text" value={form.name} onChange={e => setF("name", e.target.value)}
                  placeholder="My Credential" className={inputCls} />
              </div>
              {/* Comment */}
              <div>
                <label className={labelCls}>Comment</label>
                <input type="text" value={form.comment ?? ""} onChange={e => setF("comment", e.target.value)}
                  placeholder="Optional description" className={inputCls} />
              </div>
              {/* Type */}
              <div>
                <label className={labelCls}>Type <span className="text-red-400">*</span></label>
                <div className="relative">
                  <select value={form.type} onChange={e => { setF("type", e.target.value as GMPCredentialType); setShowPass(false); setShowPrivPass(false); }}
                    className={`${inputCls} appearance-none pr-8`}>
                    {CRED_TYPES.map(ct => (
                      <option key={ct.value} value={ct.value}>{ct.label}</option>
                    ))}
                  </select>
                  <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400" />
                </div>
              </div>

              {/* Dynamic fields */}
              {renderFormFields()}
            </div>

            {/* Modal Footer */}
            <div className="flex shrink-0 gap-2 border-t border-slate-100 px-5 py-4 dark:border-white/8">
              <button type="button" onClick={() => { setShowModal(false); setShowPass(false); setShowPrivPass(false); }}
                className="flex-1 rounded-xl border border-slate-200 py-2 text-[12.5px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/8 dark:text-white/55 dark:hover:bg-white/5 focus:outline-none">
                Cancel
              </button>
              <button type="button" onClick={() => void handleCreate()} disabled={saving}
                style={{ background: accentGrad }}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-[12.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-60 focus:outline-none">
                {saving && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                Save
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
  { value: "Scan Config Default",   label: "Use Scan Config Default" },
  { value: "Consider Alive",        label: "Consider Hosts as Alive" },
  { value: "ICMP Ping",             label: "ICMP Ping" },
  { value: "TCP-ACK Service Ping",  label: "TCP-ACK Service Ping" },
  { value: "TCP-SYN Service Ping",  label: "TCP-SYN Service Ping" },
  { value: "ARP Ping",              label: "ARP Ping" },
];

const TargetsTab: React.FC<{ currentColor: string; accentGrad: string }> = ({
  currentColor, accentGrad,
}) => {
  const [targets,   setTargets]   = useState<GMPTargetDTO[]>([]);
  const [portLists, setPortLists] = useState<GMPPortListDTO[]>([]);
  const [creds,     setCreds]     = useState<GMPCredentialDTO[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [deleteItem, setDeleteItem] = useState<GMPTargetDTO | null>(null);
  const hasFetched = useRef(false);

  const emptyForm: CreateTargetRequest = {
    name: "", hosts: "", comment: "",
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

  const handleCreate = async () => {
    if (!form.name.trim() || !form.hosts.trim()) {
      message.warning("Name and Hosts are required"); return;
    }
    setSaving(true);
    try {
      await CreateGMPTarget(form);
      message.success("Target created");
      setShowModal(false);
      setForm(emptyForm);
      void fetchAll();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      message.error(msg || "Failed to create target");
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

  // Build credentials display string for a target row
  const credsSummary = (t: GMPTargetDTO): string => {
    const parts: string[] = [];
    if (t.ssh_cred_name)  parts.push(`SSH:${t.ssh_cred_name}`);
    if (t.smb_cred_name)  parts.push(`SMB:${t.smb_cred_name}`);
    if (t.esxi_cred_name) parts.push(`ESXi:${t.esxi_cred_name}`);
    if (t.snmp_cred_name) parts.push(`SNMP:${t.snmp_cred_name}`);
    return parts.join(" · ") || "—";
  };

  const selCls = `${inputCls} appearance-none`;

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
                    <td className="px-4 py-3.5 font-mono text-[12px] text-slate-600 dark:text-white/55">{tg.hosts}</td>
                    <td className="px-4 py-3.5 text-[12px] font-medium" style={{ color: currentColor }}>
                      {tg.max_hosts || "—"}
                    </td>
                    <td className="px-4 py-3.5 text-[12px] text-slate-600 dark:text-white/55">
                      {tg.port_list_name || <span className="text-slate-300 dark:text-white/20">—</span>}
                    </td>
                    <td className="px-4 py-3.5 text-[11.5px] text-slate-500 dark:text-white/45">
                      {credsSummary(tg)}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button type="button" onClick={() => setDeleteItem(tg)}
                        className="grid h-7 w-7 place-items-center rounded-lg border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                        <FiTrash2 className="text-[11px]" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Create Target Modal ── */}
      {showModal && createPortal(
        <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={() => setShowModal(false)} />
          <div className="relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-[#12101f]"
            style={{ boxShadow: `0 24px 64px -12px ${currentColor}40`, maxHeight: "92dvh" }}>

            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/8">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl text-white" style={{ background: accentGrad }}>
                  <FiTarget className="text-[14px]" />
                </span>
                <div>
                  <p className="text-[9.5px] font-bold uppercase tracking-widest" style={{ color: currentColor }}>TARGETS</p>
                  <h3 className="text-[14px] font-bold text-slate-800 dark:text-white/90">New Target</h3>
                </div>
              </div>
              <button type="button" onClick={() => setShowModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:text-white/35 dark:hover:bg-white/8 focus:outline-none">
                <FiX className="text-[15px]" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">

              {/* Name */}
              <div>
                <label className={labelCls}>Name <span className="text-red-400">*</span></label>
                <input type="text" value={form.name} onChange={e => setF("name", e.target.value)}
                  placeholder="e.g. Office Network" className={inputCls} />
              </div>

              {/* Comment */}
              <div>
                <label className={labelCls}>Comment</label>
                <input type="text" value={form.comment ?? ""} onChange={e => setF("comment", e.target.value)}
                  placeholder="Optional description" className={inputCls} />
              </div>

              {/* Hosts */}
              <div>
                <label className={labelCls}>Hosts <span className="text-red-400">*</span></label>
                <input type="text" value={form.hosts} onChange={e => setF("hosts", e.target.value)}
                  placeholder="192.168.1.0/24 or 10.0.0.1,10.0.0.2" className={inputCls} />
                <p className="mt-1.5 text-[10.5px] text-slate-400 dark:text-white/30">
                  CIDR, comma-separated IPs, or range (192.168.1.1-50)
                </p>
              </div>

              {/* Exclude Hosts */}
              <div>
                <label className={labelCls}>Exclude Hosts</label>
                <input type="text" value={form.exclude_hosts ?? ""} onChange={e => setF("exclude_hosts", e.target.value)}
                  placeholder="e.g. 192.168.1.1" className={inputCls} />
              </div>

              {/* Allow simultaneous IPs */}
              <div>
                <label className={labelCls}>Allow simultaneous scanning via multiple IPs</label>
                <div className="flex gap-5 pt-0.5">
                  {[true, false].map(v => (
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
                <div className="relative">
                  <select value={form.port_list_id ?? ""} onChange={e => setF("port_list_id", e.target.value)}
                    className={`${selCls} pr-8`}>
                    <option value="">— Select Port List —</option>
                    {portLists.map(pl => (
                      <option key={pl.id} value={pl.id}>{pl.name}</option>
                    ))}
                  </select>
                  <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400" />
                </div>
              </div>

              {/* Alive Test */}
              <div>
                <label className={labelCls}>Alive Test</label>
                <div className="space-y-1.5 pt-0.5">
                  {ALIVE_TESTS.slice(0, 2).map(at => (
                    <label key={at.value} className="flex cursor-pointer items-center gap-2 text-[12.5px] text-slate-700 dark:text-white/70">
                      <input type="radio" checked={form.alive_test === at.value}
                        onChange={() => setF("alive_test", at.value)} className="accent-blue-500" />
                      {at.label}
                    </label>
                  ))}
                  {/* Custom = all others */}
                  <div>
                    <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-slate-700 dark:text-white/70">
                      <input type="radio"
                        checked={form.alive_test !== "Scan Config Default" && form.alive_test !== "Consider Alive"}
                        onChange={() => setF("alive_test", "ICMP Ping")} className="accent-blue-500" />
                      Custom
                    </label>
                    {form.alive_test !== "Scan Config Default" && form.alive_test !== "Consider Alive" && (
                      <div className="mt-1.5 ml-6">
                        <div className="relative">
                          <select value={form.alive_test ?? "ICMP Ping"}
                            onChange={e => setF("alive_test", e.target.value)}
                            className={`${selCls} pr-8`}>
                            {ALIVE_TESTS.slice(2).map(at => (
                              <option key={at.value} value={at.value}>{at.label}</option>
                            ))}
                          </select>
                          <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Credentials section ── */}
              <div className="rounded-xl border border-slate-200/70 bg-slate-50/60 p-4 space-y-3.5 dark:border-white/8 dark:bg-white/3">
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-white/40">
                  Credentials for authenticated checks
                </p>

                {/* SSH */}
                <div>
                  <label className={labelCls}>SSH</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <select value={form.ssh_cred_id ?? ""} onChange={e => setF("ssh_cred_id", e.target.value)}
                        className={`${selCls} pr-8`}>
                        <option value="">Select a Credential</option>
                        {creds.filter(c => c.type === "up" || c.type === "usk").map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400" />
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="text-[11.5px] text-slate-500 dark:text-white/40 whitespace-nowrap">on port</span>
                      <input type="text" value={form.ssh_port ?? "22"} onChange={e => setF("ssh_port", e.target.value)}
                        className={`${inputCls} w-16 text-center`} />
                    </div>
                  </div>
                </div>

                {/* SMB */}
                <div>
                  <label className={labelCls}>SMB (NTLM)</label>
                  <div className="relative">
                    <select value={form.smb_cred_id ?? ""} onChange={e => setF("smb_cred_id", e.target.value)}
                      className={`${selCls} pr-8`}>
                      <option value="">Select a Credential</option>
                      {creds.filter(c => c.type === "up").map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400" />
                  </div>
                </div>

                {/* ESXi */}
                <div>
                  <label className={labelCls}>ESXi</label>
                  <div className="relative">
                    <select value={form.esxi_cred_id ?? ""} onChange={e => setF("esxi_cred_id", e.target.value)}
                      className={`${selCls} pr-8`}>
                      <option value="">Select a Credential</option>
                      {creds.filter(c => c.type === "up").map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400" />
                  </div>
                </div>

                {/* SNMP */}
                <div>
                  <label className={labelCls}>SNMP</label>
                  <div className="relative">
                    <select value={form.snmp_cred_id ?? ""} onChange={e => setF("snmp_cred_id", e.target.value)}
                      className={`${selCls} pr-8`}>
                      <option value="">Select a Credential</option>
                      {creds.filter(c => c.type === "snmp").map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400" />
                  </div>
                </div>
              </div>

              {/* Reverse Lookup */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Reverse Lookup Only</label>
                  <div className="flex gap-5 pt-0.5">
                    {[false, true].map(v => (
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
                    {[false, true].map(v => (
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
              <button type="button" onClick={() => setShowModal(false)}
                className="flex-1 rounded-xl border border-slate-200 py-2 text-[12.5px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/8 dark:text-white/55 dark:hover:bg-white/5 focus:outline-none">
                Cancel
              </button>
              <button type="button" onClick={() => void handleCreate()} disabled={saving}
                style={{ background: accentGrad }}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-[12.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-60 focus:outline-none">
                {saving && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                Save
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
