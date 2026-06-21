import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import {
  FiUser, FiMail, FiPhone, FiMapPin, FiBriefcase,
  FiSave, FiShield, FiCheckCircle, FiAlertTriangle,
  FiX, FiRefreshCw, FiLock, FiCamera,
} from "react-icons/fi";
import { CameraOutlined } from "@ant-design/icons";
import { message } from "antd";
import {
  ListUserByID, UpdateUserByID,
  type UserResponse, type UpdateUserInput,
} from "../../services/user";
import { ListEmailAndPhoneNumber } from "../../services";
import {
  GetTOTPStatus, InitTOTPSetup, VerifyTOTPSetup, DisableTOTP,
  type TOTPStatus, type TOTPInitResponse,
} from "../../services/totp";
import { useAuth } from "../../contexts/AuthContext";
import { useStateContext } from "../../contexts/ProviderContext";
import profileBanner from "../../assets/background_profile.jpg";

// ─────────────────────────────────────────────────────────────
// Shared styles
// ─────────────────────────────────────────────────────────────
const inputCls = [
  "w-full h-10 rounded-lg border border-slate-200 bg-white px-3.5 text-[13px] text-slate-700 outline-none transition",
  "focus:border-blue-400 focus:ring-2 focus:ring-blue-100",
  "dark:border-white/8 dark:bg-white/5 dark:text-white/80 dark:focus:ring-blue-500/10",
  "placeholder:text-slate-400 dark:placeholder:text-white/25",
].join(" ");

const inputErrCls = [
  "w-full h-10 rounded-lg border border-red-400 bg-red-50 px-3.5 text-[13px] text-red-700 outline-none transition",
  "focus:border-red-400 focus:ring-2 focus:ring-red-100",
  "dark:border-red-500/40 dark:bg-red-500/10 dark:text-white/80",
].join(" ");

const labelCls = "mb-1.5 block text-[11.5px] font-medium text-slate-500 dark:text-white/45";

const normalize      = (s: string) => s.trim();
const normalizeEmail = (s: string) => s.trim().toLowerCase();
const normalizePhone = (s: string) => s.replace(/\D/g, "").trim();

const PREVIEW_SIZE = 88;
async function buildThumb(src: string, size: number): Promise<string> {
  return new Promise((res, rej) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) { rej(new Error("no ctx")); return; }
      const sc = Math.max(size / img.naturalWidth, size / img.naturalHeight);
      ctx.drawImage(
        img,
        (size - img.naturalWidth * sc) / 2,
        (size - img.naturalHeight * sc) / 2,
        img.naturalWidth * sc,
        img.naturalHeight * sc,
      );
      res(canvas.toDataURL("image/png"));
    };
    img.onerror = () => rej(new Error("load failed"));
    img.src = src;
  });
}

// ─────────────────────────────────────────────────────────────
// TOTP Modal (portal)
// ─────────────────────────────────────────────────────────────
interface TOTPModalProps {
  status: TOTPStatus | null;
  currentColor: string;
  onClose: () => void;
  onStatusChange: (s: TOTPStatus) => void;
}

const TOTPModal: React.FC<TOTPModalProps> = ({
  status, currentColor, onClose, onStatusChange,
}) => {
  const accentGrad = `linear-gradient(135deg, ${currentColor}, color-mix(in srgb, ${currentColor} 65%, #a855f7))`;
  type Step = "idle" | "setup" | "disabling";

  const [step,       setStep]       = useState<Step>(status?.is_enabled ? "idle" : "setup");
  const [initData,   setInitData]   = useState<TOTPInitResponse | null>(null);
  const [qrDataUrl,  setQrDataUrl]  = useState<string | null>(null);
  const [code,       setCode]       = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState("");
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    // If not enabled, auto-start setup immediately
    if (!status?.is_enabled) { void startSetup(); }
    return () => { isMounted.current = false; };
  }, []);

  const startSetup = async () => {
    setError("");
    setSubmitting(true);
    try {
      const data = await InitTOTPSetup();
      if (!isMounted.current) return;
      setInitData(data);
      const url = await QRCode.toDataURL(data.otp_uri, { width: 220, margin: 1 });
      if (!isMounted.current) return;
      setQrDataUrl(url);
      setStep("setup");
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      if (isMounted.current) setError(msg || "Failed to initialize TOTP");
    } finally {
      if (isMounted.current) setSubmitting(false);
    }
  };

  const handleVerify = async () => {
    if (code.length !== 6) { setError("Enter the 6-digit code from your authenticator app"); return; }
    setError("");
    setSubmitting(true);
    try {
      await VerifyTOTPSetup(code);
      if (!isMounted.current) return;
      onStatusChange({ is_enabled: true, is_configured: true });
      message.success("TOTP enabled — your account is now protected");
      onClose();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      if (isMounted.current) setError(msg || "Invalid or expired code");
    } finally {
      if (isMounted.current) setSubmitting(false);
    }
  };

  const handleDisable = async () => {
    setSubmitting(true);
    setError("");
    try {
      await DisableTOTP();
      if (!isMounted.current) return;
      onStatusChange({ is_enabled: false, is_configured: false });
      message.success("TOTP disabled");
      onClose();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      if (isMounted.current) setError(msg || "Failed to disable TOTP");
    } finally {
      if (isMounted.current) setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[3px]" onClick={onClose} />
      <div
        className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl bg-white dark:bg-[#12101f]"
        style={{ boxShadow: `0 24px 64px -12px ${currentColor}30, 0 8px 32px rgba(0,0,0,.22)` }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-white/8">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: accentGrad }}>
              <FiShield className="text-[13px]" />
            </span>
            <div>
              <p className="text-[9.5px] font-bold uppercase tracking-widest" style={{ color: currentColor }}>SECURITY</p>
              <h3 className="text-[13.5px] font-bold text-slate-800 dark:text-white/90">
                {status?.is_enabled ? "TOTP Settings" : "Enable Authenticator App"}
              </h3>
            </div>
          </div>
          <button type="button" onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 dark:text-white/35 dark:hover:bg-white/8">
            <FiX className="text-[15px]" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">

          {/* ── Already enabled ── */}
          {step === "idle" && status?.is_enabled && (
            <div className="space-y-3">
              <div className="flex items-center gap-2.5 rounded-xl border border-emerald-100 bg-emerald-50/60 px-3.5 py-3 dark:border-emerald-500/15 dark:bg-emerald-500/5">
                <FiCheckCircle className="shrink-0 text-[16px] text-emerald-500" />
                <div>
                  <p className="text-[12px] font-semibold text-slate-800 dark:text-white/85">Authenticator App is Active</p>
                  <p className="text-[10.5px] text-slate-500 dark:text-white/40">Your account is protected with 2FA.</p>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 px-3.5 py-3 dark:border-white/8 dark:bg-white/3">
                <p className="text-[12px] font-medium text-slate-600 dark:text-white/60">Disable TOTP</p>
                <button type="button" onClick={() => setStep("disabling")}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-red-600 transition hover:bg-red-50 dark:border-red-500/20 dark:bg-transparent dark:text-red-400">
                  <FiX className="text-[10px]" /> Disable
                </button>
              </div>
              <button type="button" onClick={onClose}
                className="w-full rounded-xl border border-slate-200 py-2.5 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/8 dark:text-white/55 dark:hover:bg-white/5">
                Close
              </button>
            </div>
          )}

          {/* ── Confirm disable ── */}
          {step === "disabling" && (
            <div className="space-y-3">
              <div className="flex items-start gap-2.5 rounded-xl border border-red-100 bg-red-50/60 px-3.5 py-3 dark:border-red-500/15 dark:bg-red-500/5">
                <FiAlertTriangle className="mt-0.5 shrink-0 text-[15px] text-red-500" />
                <div>
                  <p className="text-[12px] font-semibold text-slate-800 dark:text-white/85">Disable authenticator app?</p>
                  <p className="text-[10.5px] text-slate-500 dark:text-white/40">Account will rely on password only.</p>
                </div>
              </div>
              {error && <p className="text-[11px] text-red-500">{error}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={() => void handleDisable()} disabled={submitting}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-red-500 py-2.5 text-[12.5px] font-semibold text-white transition hover:bg-red-600 disabled:opacity-60">
                  {submitting && <FiRefreshCw className="animate-spin text-[11px]" />}
                  {submitting ? "Disabling…" : "Yes, disable"}
                </button>
                <button type="button" onClick={() => { setStep("idle"); setError(""); }}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-[12.5px] font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/8 dark:text-white/55">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* ── Setup flow ── */}
          {step === "setup" && (
            <div className="space-y-3.5">

              {/* Loading */}
              {submitting && !qrDataUrl && (
                <div className="flex flex-col items-center gap-2.5 py-6">
                  <FiRefreshCw className="animate-spin text-[22px]" style={{ color: currentColor }} />
                  <p className="text-[12px] text-slate-500 dark:text-white/45">Generating QR code…</p>
                </div>
              )}

              {/* QR + code input */}
              {qrDataUrl && initData && (
                <>
                  {/* QR + manual key — compact horizontal layout */}
                  <div className="flex items-start gap-3">
                    {/* QR */}
                    <div className="shrink-0 rounded-xl border-2 border-slate-100 bg-white p-1.5 shadow-sm dark:border-white/10">
                      <img src={qrDataUrl} alt="TOTP QR Code" className="h-32.5 w-32.5" />
                    </div>
                    {/* Instructions + manual key */}
                    <div className="min-w-0 flex-1">
                      <p className="text-[11.5px] font-semibold text-slate-700 dark:text-white/80">Scan with your app</p>
                      <p className="mt-0.5 text-[10.5px] text-slate-400 dark:text-white/35">
                        Google Authenticator, Authy, or any TOTP app.
                      </p>
                      <div className="mt-2.5 rounded-lg border border-slate-200/70 bg-slate-50 px-2.5 py-2 dark:border-white/8 dark:bg-white/3">
                        <p className="mb-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/30">
                          Manual key
                        </p>
                        <p className="break-all select-all font-mono text-[10px] tracking-wide text-slate-700 dark:text-white/65">
                          {initData.secret}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-slate-100 dark:border-white/8" />

                  {/* 6-digit input */}
                  <div>
                    <p className="mb-2 text-[11.5px] font-semibold text-slate-700 dark:text-white/80">
                      Enter 6-digit code
                    </p>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={code}
                      onChange={e => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }}
                      placeholder="000 000"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-center font-mono text-[22px] tracking-[0.45em] text-slate-800 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100 dark:border-white/8 dark:bg-white/5 dark:text-white"
                    />
                    {error && <p className="mt-1.5 text-[10.5px] text-red-500">{error}</p>}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button type="button"
                      onClick={() => void handleVerify()}
                      disabled={submitting || code.length !== 6}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[12.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                      style={{ background: accentGrad }}
                    >
                      {submitting ? <FiRefreshCw className="animate-spin text-[11px]" /> : <FiCheckCircle className="text-[11px]" />}
                      {submitting ? "Verifying…" : "Verify & Enable"}
                    </button>
                    <button type="button" onClick={onClose}
                      className="rounded-xl border border-slate-200 px-4 py-2.5 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/8 dark:text-white/55 dark:hover:bg-white/5">
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

// ─────────────────────────────────────────────────────────────
// Main Account Page
// ─────────────────────────────────────────────────────────────
const Account: React.FC = () => {
  const auth = useAuth() as any;
  const { currentColor, triggerUserRefresh } = useStateContext();

  const accentGrad = `linear-gradient(135deg, ${currentColor}, color-mix(in srgb, ${currentColor} 65%, #a855f7))`;

  const [user,        setUser]        = useState<UserResponse | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [submitting,  setSubmitting]  = useState(false);

  // TOTP
  const [totpStatus,    setTotpStatus]    = useState<TOTPStatus | null>(null);
  const [showTotpModal, setShowTotpModal] = useState(false);

  // Form
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "",
    phone: "", location: "", position: "",
  });
  const [touched,          setTouched]          = useState<Record<string, boolean>>({});
  const [existingContacts, setExistingContacts] = useState<{ id: number; email: string; phone_number: string }[]>([]);
  const [profileBase64,    setProfileBase64]    = useState<string | undefined>(undefined);
  const [thumbSrc,         setThumbSrc]         = useState("");

  const hasFetched = useRef(false);
  const isMounted  = useRef(false);

  const currentUserId = useMemo(
    () => auth?.user?.id ?? auth?.me?.id ?? null,
    [auth],
  );

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const fetchAll = useCallback(async () => {
    if (!currentUserId || auth?.isLoading) return;
    setLoadingUser(true);
    try {
      const [result, contacts, totp] = await Promise.all([
        ListUserByID(currentUserId),
        ListEmailAndPhoneNumber(),
        GetTOTPStatus().catch(() => null),
      ]);
      if (!isMounted.current) return;
      if (result) {
        setUser(result);
        setForm({
          firstName: result.first_name    || "",
          lastName:  result.last_name     || "",
          email:     result.email         || "",
          phone:     result.phone_number  || "",
          location:  result.location      || "",
          position:  result.position      || "",
        });
      }
      setExistingContacts(Array.isArray(contacts) ? contacts : []);
      if (totp) setTotpStatus(totp);
    } catch { /* ignore */ } finally {
      if (isMounted.current) setLoadingUser(false);
    }
  }, [currentUserId, auth?.isLoading]);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    void fetchAll();
  }, [fetchAll]);

  // Avatar thumbnail
  const previewUrl = useMemo(
    () => profileBase64 || user?.profile || "",
    [profileBase64, user?.profile],
  );
  useEffect(() => {
    let cancelled = false;
    if (!previewUrl) { setThumbSrc(""); return; }
    buildThumb(previewUrl, PREVIEW_SIZE)
      .then(url => { if (!cancelled) setThumbSrc(url); })
      .catch(()  => { if (!cancelled) setThumbSrc(previewUrl); });
    return () => { cancelled = true; };
  }, [previewUrl]);

  // Validation
  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!form.firstName.trim()) e.firstName = "Required";
    if (!form.lastName.trim())  e.lastName  = "Required";
    if (!form.email.trim())     e.email = "Required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Invalid email";
    else if (existingContacts.some(c =>
      normalizeEmail(c.email) === normalizeEmail(form.email) && Number(c.id) !== Number(user?.id),
    )) e.email = "Email already in use";
    const ph = normalizePhone(form.phone);
    if (!ph) e.phone = "Required";
    else if (!ph.startsWith("0") || ph.length !== 10) e.phone = "Must be 10 digits starting with 0";
    else if (existingContacts.some(c =>
      normalizePhone(c.phone_number) === ph && Number(c.id) !== Number(user?.id),
    )) e.phone = "Phone already in use";
    if (!form.location.trim()) e.location = "Required";
    if (!form.position.trim()) e.position = "Required";
    return e;
  }, [form, existingContacts, user?.id]);

  const hasChanges = useMemo(() => user && (
    normalize(form.firstName) !== normalize(user.first_name    || "") ||
    normalize(form.lastName)  !== normalize(user.last_name     || "") ||
    normalize(form.email)     !== normalize(user.email         || "") ||
    normalize(form.phone)     !== normalize(user.phone_number  || "") ||
    normalize(form.location)  !== normalize(user.location      || "") ||
    normalize(form.position)  !== normalize(user.position      || "") ||
    !!profileBase64
  ), [form, user, profileBase64]);

  const canSave = !submitting && !!hasChanges && Object.keys(errors).length === 0;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const v = name === "phone" ? value.replace(/\D/g, "").slice(0, 10) : value;
    setForm(p => ({ ...p, [name]: v }));
    setTouched(p => ({ ...p, [name]: true }));
  };

  const handleFileChange = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { message.warning("Image only"); return; }
    const reader = new FileReader();
    reader.onloadend = () => setProfileBase64(reader.result as string);
    reader.readAsDataURL(file);
  };

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(Object.fromEntries(Object.keys(form).map(k => [k, true])));
    if (!user?.id || !hasChanges || Object.keys(errors).length) return;
    setSubmitting(true);
    try {
      const payload: UpdateUserInput = {
        first_name:   form.firstName.trim(),
        last_name:    form.lastName.trim(),
        email:        form.email.trim(),
        phone_number: form.phone.trim(),
        location:     form.location.trim(),
        position:     form.position.trim(),
        ...(profileBase64 ? { profile: profileBase64 } : {}),
      };
      const updated = await UpdateUserByID(user.id, payload);
      if (!updated) { message.error("Update failed"); return; }
      setUser(updated);
      setProfileBase64(undefined);
      setTouched({});
      message.success("Profile updated");
      triggerUserRefresh();
      hasFetched.current = false;
      void fetchAll();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      message.error(msg || "Update failed");
    } finally {
      setSubmitting(false);
    }
  };

  const getFieldCls = (field: string) =>
    touched[field] && errors[field] ? inputErrCls : inputCls;

  const fullName = `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim() || "User";

  if (auth?.isLoading || loadingUser) {
    return (
      <div className="flex items-center gap-2 py-10 text-[13px] text-slate-400 dark:text-white/30">
        <FiRefreshCw className="animate-spin" /> Loading profile…
      </div>
    );
  }

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
            <FiUser className="text-[20px] sm:text-[22px]" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] sm:text-[10.5px]" style={{ color: currentColor }}>
              ACCOUNT · PROFILE
            </p>
            <h1 className="truncate text-[18px] font-bold text-slate-900 sm:text-[20px] dark:text-white/90">
              {fullName}
            </h1>
            <p className="mt-0.5 text-[11px] text-slate-500 sm:text-[12px] dark:text-white/45">
              {user?.role || "User"} · {user?.email}
            </p>
          </div>
        </div>
      </div>

      {/* ── 2-column body — Settings LEFT, Profile RIGHT ── */}
      <div className="grid grid-cols-1 items-stretch gap-5 xl:grid-cols-12">

        {/* ── LEFT: Account Settings (col-span-8) ── */}
        <div className="flex xl:col-span-8">
          <div className="flex w-full flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white dark:border-white/8 dark:bg-[#0d0b1a]/60">

            <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5 dark:border-white/8">
              <FiUser className="text-[13px] text-slate-400 dark:text-white/35" />
              <p className="text-[13px] font-semibold text-slate-700 dark:text-white/80">Account Settings</p>
            </div>

            <form onSubmit={onSave} className="flex flex-1 flex-col p-5">
              {/* Avatar upload */}
              <div className="mb-5 flex items-center gap-4">
                <label htmlFor="settings-upload"
                  className="relative block h-14 w-14 shrink-0 cursor-pointer overflow-hidden rounded-full border-2 border-dashed border-slate-300 bg-white transition hover:border-blue-400 dark:border-white/15 dark:bg-white/5">
                  {previewUrl
                    ? <img src={thumbSrc || previewUrl} alt="" className="h-full w-full object-cover" />
                    : <span className="flex h-full w-full items-center justify-center"><CameraOutlined className="text-[18px] text-slate-400" /></span>
                  }
                </label>
                <input id="settings-upload" type="file" accept="image/*" className="hidden"
                  onChange={e => handleFileChange(e.target.files?.[0])} />
                <div>
                  <p className="text-[12.5px] font-medium text-slate-700 dark:text-white/75">Profile Photo</p>
                  <p className="text-[11px] text-slate-400 dark:text-white/35">Click to upload · JPG, PNG, WebP</p>
                </div>
              </div>

              {/* Fields */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {[
                  { name: "firstName", label: "First Name" },
                  { name: "lastName",  label: "Last Name"  },
                  { name: "email",     label: "Email Address", type: "email" },
                  { name: "phone",     label: "Phone",         hint: "10 digits, starts with 0" },
                  { name: "location",  label: "Location" },
                  { name: "position",  label: "Position" },
                ].map(({ name, label, type, hint }) => (
                  <div key={name}>
                    <label className={labelCls}>{label}</label>
                    <input
                      name={name} type={type ?? "text"}
                      value={(form as Record<string, string>)[name]}
                      onChange={handleChange}
                      onBlur={() => setTouched(p => ({ ...p, [name]: true }))}
                      className={getFieldCls(name)}
                    />
                    {touched[name] && errors[name] && (
                      <p className="mt-1 text-[11px] text-red-500">{errors[name]}</p>
                    )}
                    {!touched[name] && hint && (
                      <p className="mt-1 text-[11px] text-slate-400 dark:text-white/30">{hint}</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Save row — pushed to bottom */}
              <div className="mt-auto pt-5 flex items-center gap-2.5">
                <button type="submit" disabled={!canSave}
                  style={{ background: canSave ? accentGrad : undefined }}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-white/10 dark:disabled:text-white/30">
                  {submitting
                    ? <><FiRefreshCw className="animate-spin text-[12px]" /> Saving…</>
                    : <><FiSave className="text-[12px]" /> Save Changes</>
                  }
                </button>
                {hasChanges && !submitting && (
                  <p className="text-[11.5px] text-amber-500 dark:text-amber-400">Unsaved changes</p>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* ── RIGHT: Profile Card (col-span-4) ── */}
        <div className="flex xl:col-span-4">
          <div className="flex w-full flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white dark:border-white/8 dark:bg-[#0d0b1a]/60">

            {/* Banner + Avatar */}
            <div className="relative h-28 shrink-0">
              <img src={profileBanner} alt="banner"
                className="h-full w-full object-cover object-center" />
              <div className="absolute inset-0 bg-black/10 dark:bg-slate-950/25" />
              {/* Avatar */}
              <div className="absolute left-1/2 bottom-0 z-10 -translate-x-1/2 translate-y-1/2">
                <label htmlFor="avatar-upload"
                  className="group relative block h-17 w-17 cursor-pointer overflow-hidden rounded-2xl border-4 border-white bg-white shadow-lg dark:border-[#0d0b1a] dark:bg-white/10">
                  {previewUrl
                    ? <img src={thumbSrc || previewUrl} alt={fullName} className="h-full w-full object-cover" />
                    : <span className="flex h-full w-full items-center justify-center text-[28px]">🧑🏻‍💻</span>
                  }
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <FiCamera className="text-[16px] text-white" />
                  </div>
                </label>
                <input id="avatar-upload" type="file" accept="image/*" className="hidden"
                  onChange={e => handleFileChange(e.target.files?.[0])} />
              </div>
            </div>

            {/* Name + Role */}
            <div className="px-5 pb-3 pt-11 text-center">
              <h3 className="text-[16px] font-semibold text-slate-900 dark:text-white/90">{fullName}</h3>
              <p className="mt-0.5 text-[11.5px] text-slate-400 dark:text-white/35">{user?.role || "User"}</p>
            </div>

            {/* Info list */}
            <div className="border-t border-slate-100 px-5 py-4 space-y-2.5 dark:border-white/8">
              {[
                { icon: <FiMail />,      label: user?.email          || "—" },
                { icon: <FiPhone />,     label: user?.phone_number   || "—" },
                { icon: <FiMapPin />,    label: user?.location       || "—" },
                { icon: <FiBriefcase />, label: user?.position       || "—" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2.5 text-[12px] text-slate-600 dark:text-white/60">
                  <span className="shrink-0 text-slate-400 dark:text-white/30">{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                </div>
              ))}
            </div>

            {/* ── TOTP button — pushed to bottom ── */}
            <div className="mt-auto border-t border-slate-100 px-5 py-4 dark:border-white/8">
              {totpStatus === null ? (
                /* Loading */
                <div className="flex items-center gap-2 text-[11.5px] text-slate-400 dark:text-white/30">
                  <FiRefreshCw className="animate-spin text-[11px]" /> Loading security status…
                </div>
              ) : totpStatus.is_enabled ? (
                /* Enabled state */
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <FiCheckCircle className="text-[13px] text-emerald-500" />
                    <p className="text-[12px] font-semibold text-emerald-600 dark:text-emerald-400">TOTP Active</p>
                  </div>
                  <p className="text-[11px] text-slate-400 dark:text-white/30">
                    Authenticator app is protecting your account.
                  </p>
                  <button type="button" onClick={() => setShowTotpModal(true)}
                    className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/55 dark:hover:bg-white/8 focus:outline-none">
                    <FiShield className="text-[12px]" /> Manage TOTP
                  </button>
                </div>
              ) : (
                /* Not enabled */
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <FiLock className="text-[13px] text-slate-400 dark:text-white/30" />
                    <p className="text-[12px] font-medium text-slate-500 dark:text-white/45">Two-Factor Authentication</p>
                  </div>
                  <p className="text-[11px] text-slate-400 dark:text-white/30">
                    Add an authenticator app for extra security.
                  </p>
                  <button type="button" onClick={() => setShowTotpModal(true)}
                    style={{ background: accentGrad }}
                    className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-[12.5px] font-semibold text-white shadow-sm transition hover:opacity-90 focus:outline-none">
                    <FiShield className="text-[13px]" /> Enable TOTP
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>

      </div>

      {/* TOTP modal */}
      {showTotpModal && (
        <TOTPModal
          status={totpStatus}
          currentColor={currentColor}
          onClose={() => setShowTotpModal(false)}
          onStatusChange={s => setTotpStatus(s)}
        />
      )}

    </div>
  );
};

export default Account;
