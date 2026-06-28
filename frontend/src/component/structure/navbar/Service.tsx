import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FiMail, FiEdit2, FiSave, FiX,
  FiCheckCircle, FiShield, FiTool, FiKey,
  FiZap, FiAward, FiLock, FiServer,
} from "react-icons/fi";
import { message } from "antd";
import {
  ListSendEmails,
  UpdateSendEmailByID,
  type SendEmailResponse,
} from "../../../services";
import { GetAppSettings, UpdateAppSetting } from "../../../services/setting";
import { useStateContext } from "../../../contexts/ProviderContext";
import { useLanguage } from "../../../contexts/LanguageContext";

// ─────────────────────────────────────────────────────────────
// Toggle Switch
// ─────────────────────────────────────────────────────────────

const Toggle: React.FC<{
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  color?: string;
}> = ({ checked, onChange, disabled, color = "#22c55e" }) => (
  <button
    type="button"
    onClick={onChange}
    disabled={disabled}
    aria-label="toggle"
    className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
    style={{ backgroundColor: checked ? color : "#e2e8f0" }}
  >
    <span
      className={[
        "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transition-transform duration-200",
        checked ? "translate-x-5" : "translate-x-0",
      ].join(" ")}
    />
  </button>
);

// ─────────────────────────────────────────────────────────────
// OTP Sub-option row (checkbox-style toggle)
// ─────────────────────────────────────────────────────────────

const OtpOptionRow: React.FC<{
  label: string;
  desc: string;
  checked: boolean;
  onChange: () => void;
  color: string;
}> = ({ label, desc, checked, onChange, color }) => (
  <button
    type="button"
    onClick={onChange}
    className="flex w-full items-center justify-between gap-3 rounded-xl border bg-white/70 px-4 py-3 text-left transition-all hover:bg-white dark:bg-white/3 dark:hover:bg-white/6 focus:outline-none"
    style={{ borderColor: checked ? `${color}35` : "transparent" }}
  >
    <div className="flex items-center gap-3 min-w-0">
      {/* Custom checkbox */}
      <span
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all"
        style={
          checked
            ? { borderColor: color, backgroundColor: color }
            : { borderColor: "#cbd5e1", backgroundColor: "transparent" }
        }
      >
        {checked && (
          <svg viewBox="0 0 12 10" fill="none" className="h-3 w-3">
            <path d="M1 5l3.5 3.5L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <div className="min-w-0">
        <p className="text-[12.5px] font-semibold text-slate-800 dark:text-white/85">{label}</p>
        <p className="text-[11px] text-slate-400 dark:text-white/40">{desc}</p>
      </div>
    </div>
    {checked && (
      <span
        className="shrink-0 rounded-full px-2 py-0.5 text-[9.5px] font-bold"
        style={{ backgroundColor: `${color}15`, color }}
      >
        ON
      </span>
    )}
  </button>
);

// ─────────────────────────────────────────────────────────────
// Service Page
// ─────────────────────────────────────────────────────────────

const MAINT_KEY        = "argus_maintenance_mode";
const TOTP_KEY         = "argus_totp_enabled";
const FA2_KEY          = "argus_2fa_enabled";
const OTP_LOGIN_KEY    = "argus_otp_login";
const OTP_REG_KEY      = "argus_otp_register";
const OTP_RESET_KEY    = "argus_otp_reset_password";

const Service: React.FC = () => {
  const { currentColor } = useStateContext();
  const { t } = useLanguage();

  const accentGrad = `linear-gradient(135deg, ${currentColor}, color-mix(in srgb, ${currentColor} 65%, #a855f7))`;

  // ── Email config state ────────────────────────────────────
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [emailRecord,   setEmailRecord]   = useState<SendEmailResponse | null>(null);
  const [editingEmail,  setEditingEmail]  = useState(false);
  const [form,          setForm]          = useState({ email: "", pass_app: "" });
  const [showPass,      setShowPass]      = useState(false);

  // ── Toggle state (localStorage-backed) ───────────────────
  const [twoFA,       setTwoFA]       = useState(() => localStorage.getItem(FA2_KEY)   === "true");
  const [totpEnabled, setTotpEnabled] = useState(() => localStorage.getItem(TOTP_KEY)  === "true");
  const [maintenance, setMaintenance] = useState(() => localStorage.getItem(MAINT_KEY) === "true");

  // OTP sub-options (only active when twoFA is on)
  const [otpLogin,    setOtpLogin]    = useState(() => localStorage.getItem(OTP_LOGIN_KEY) !== "false");
  const [otpRegister, setOtpRegister] = useState(() => localStorage.getItem(OTP_REG_KEY)   === "true");
  const [otpReset,    setOtpReset]    = useState(() => localStorage.getItem(OTP_RESET_KEY)  === "true");

  const hasFetched = useRef(false);
  const isMounted  = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    void load();
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      const [emailData, settings] = await Promise.all([
        ListSendEmails(),
        GetAppSettings().catch(() => ({} as Record<string, string>)),
      ]);
      if (!isMounted.current) return;

      // ── Apply DB values (authoritative source), sync back to localStorage ──
      const applyBool = (key: string, setter: (v: boolean) => void, defaultWhenMissing: boolean) => {
        if (settings[key] !== undefined) {
          const val = key === OTP_LOGIN_KEY
            ? settings[key] !== "false"   // login OTP: default true → truthy unless explicitly "false"
            : settings[key] === "true";
          setter(val);
          localStorage.setItem(key, String(val));
        } else {
          // Key not in DB yet — keep localStorage value as initial state
          setter(defaultWhenMissing);
        }
      };

      applyBool(FA2_KEY,        setTwoFA,       localStorage.getItem(FA2_KEY)        === "true");
      applyBool(TOTP_KEY,       setTotpEnabled, localStorage.getItem(TOTP_KEY)       === "true");
      applyBool(MAINT_KEY,      setMaintenance, localStorage.getItem(MAINT_KEY)      === "true");
      applyBool(OTP_LOGIN_KEY,  setOtpLogin,    localStorage.getItem(OTP_LOGIN_KEY)  !== "false");
      applyBool(OTP_REG_KEY,    setOtpRegister, localStorage.getItem(OTP_REG_KEY)    === "true");
      applyBool(OTP_RESET_KEY,  setOtpReset,    localStorage.getItem(OTP_RESET_KEY)  === "true");

      // ── Email config ──
      const item = emailData?.[0] ?? null;
      setEmailRecord(item);
      if (item) setForm({ email: item.email || "", pass_app: item.pass_app || "" });
    } catch {
      if (isMounted.current) message.error(t("service.loadFailed"));
    } finally {
      if (isMounted.current) setLoading(false);
    }
  };

  const isValidEmail = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()), [form.email]);
  const hasChanged   = useMemo(() => {
    if (!emailRecord) return false;
    return form.email !== (emailRecord.email || "") || form.pass_app !== (emailRecord.pass_app || "");
  }, [form, emailRecord]);

  const handleSave = async () => {
    if (!emailRecord) return;
    if (!form.email.trim()) { message.warning(t("service.enterEmail")); return; }
    if (!isValidEmail)      { message.warning("Invalid email format."); return; }
    if (!form.pass_app.trim()) { message.warning(t("service.enterAppPassword")); return; }
    try {
      setSaving(true);
      const res = await UpdateSendEmailByID(emailRecord.id, { email: form.email.trim(), pass_app: form.pass_app.trim() });
      if (!res) { message.error(t("service.saveFailed")); return; }
      setEmailRecord(res);
      setForm({ email: res.email || "", pass_app: res.pass_app || "" });
      setEditingEmail(false);
      message.success(t("service.saveSuccess"));
    } catch {
      message.error(t("service.saveFailed"));
    } finally {
      if (isMounted.current) setSaving(false);
    }
  };

  const cancelEdit = () => {
    if (emailRecord) setForm({ email: emailRecord.email || "", pass_app: emailRecord.pass_app || "" });
    setEditingEmail(false);
    setShowPass(false);
  };

  const persistSetting = (key: string, value: boolean) => {
    localStorage.setItem(key, String(value));
    UpdateAppSetting(key, String(value)).catch(() => {
      // Warn admin — without DB persistence, other browsers/devices won't enforce the setting
      message.warning("บันทึกการตั้งค่าไปยัง Server ไม่สำเร็จ — ค่าถูกบันทึกเฉพาะในเบราว์เซอร์นี้เท่านั้น");
    });
  };

  const toggleTwoFA = () => {
    const next = !twoFA;
    setTwoFA(next);
    persistSetting(FA2_KEY, next);
    message.success(next ? t("service.enabled") : t("service.disabled"));
  };

  const toggleOtpLogin = () => {
    const next = !otpLogin;
    setOtpLogin(next);
    persistSetting(OTP_LOGIN_KEY, next);
  };
  const toggleOtpRegister = () => {
    const next = !otpRegister;
    setOtpRegister(next);
    persistSetting(OTP_REG_KEY, next);
  };
  const toggleOtpReset = () => {
    const next = !otpReset;
    setOtpReset(next);
    persistSetting(OTP_RESET_KEY, next);
  };

  const toggleTotp = () => {
    const next = !totpEnabled;
    setTotpEnabled(next);
    persistSetting(TOTP_KEY, next);
    message.success(next ? t("service.enabled") : t("service.disabled"));
  };

  const toggleMaintenance = () => {
    const next = !maintenance;
    setMaintenance(next);
    localStorage.setItem(MAINT_KEY, String(next));
    message.success(next ? t("service.systemInMaintenance") : t("service.systemOperational"));
  };

  const inputBase = [
    "h-10 w-full rounded-xl border bg-white pl-9 pr-4 text-[13px] text-slate-700 outline-none transition",
    "dark:bg-white/5 dark:text-white/85",
  ].join(" ");

  return (
    <div className="w-full space-y-4 p-0.5 sm:space-y-5 sm:p-1">

      {/* ── Header ── */}
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
            <FiServer className="text-[20px] sm:text-[22px]" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: currentColor }}>
              {t("service.configuration")}
            </p>
            <h1 className="text-[18px] font-bold text-slate-900 dark:text-white/90 sm:text-[20px]">
              {t("service.title")}
            </h1>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-white/45 sm:text-[12px]">
              {t("service.subtitle")}
            </p>
          </div>
        </div>
      </div>

      {/* ── Email & Security Settings ── */}
      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white dark:border-white/8 dark:bg-[#0d0b1a]/60">

        {/* Section header */}
        <div className="border-b border-slate-100 px-5 py-3.5 dark:border-white/8">
          <div className="flex items-center gap-2.5">
            <FiLock className="text-[14px] text-slate-400 dark:text-white/35" />
            <div>
              <h2 className="text-[13px] font-semibold text-slate-700 dark:text-white/80">
                {t("service.emailSecurityTitle")}
              </h2>
              <p className="text-[11px] text-slate-400 dark:text-white/35">
                {t("service.emailSecuritySubtitle")}
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-3">
          {loading ? (
            <div className="space-y-2.5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl border border-slate-100 bg-slate-50 dark:border-white/8 dark:bg-white/4" />
              ))}
            </div>
          ) : !emailRecord ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: `${currentColor}15` }}>
                <FiMail className="text-[20px]" style={{ color: currentColor }} />
              </div>
              <p className="text-[13px] font-semibold text-slate-600 dark:text-white/70">{t("service.noEmailConfig")}</p>
              <p className="text-[11px] text-slate-400 dark:text-white/40">{t("service.noEmailConfigDesc")}</p>
            </div>
          ) : (
            <>
              {/* Email row */}
              <div className="rounded-xl border border-slate-200/70 bg-slate-50/60 p-4 space-y-3 dark:border-white/8 dark:bg-white/3">

                {/* Top: email info + edit button */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl shrink-0"
                      style={{ backgroundColor: `${currentColor}12`, color: currentColor }}
                    >
                      <FiMail className="text-[15px]" />
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-slate-800 dark:text-white/90">
                        {emailRecord.email || "-"}
                      </p>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <FiCheckCircle className="text-[10px] text-emerald-500" />
                        <p className="text-[11px] text-slate-400 dark:text-white/40">
                          {t("service.appPasswordConfigured")}
                        </p>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => editingEmail ? cancelEdit() : setEditingEmail(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-600 transition hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/55 dark:hover:bg-white/8"
                  >
                    {editingEmail
                      ? <><FiX className="text-[11px]" />{t("service.cancel")}</>
                      : <><FiEdit2 className="text-[11px]" />{t("service.edit")}</>
                    }
                  </button>
                </div>

                {/* Inline edit form */}
                {editingEmail && (
                  <div className="rounded-xl border border-slate-200/70 bg-white p-4 space-y-3 dark:border-white/8 dark:bg-white/5">

                    {/* Email field */}
                    <div>
                      <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: currentColor }}>
                        {t("service.senderEmail")}
                      </label>
                      <div className="relative">
                        <FiMail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px]" style={{ color: currentColor }} />
                        <input
                          type="email"
                          value={form.email}
                          onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                          placeholder={t("service.emailPlaceholder")}
                          className={inputBase}
                          style={{ borderColor: `${currentColor}30` }}
                          onFocus={(e) => { e.target.style.borderColor = currentColor; e.target.style.boxShadow = `0 0 0 2px ${currentColor}20`; }}
                          onBlur={(e) => { e.target.style.borderColor = `${currentColor}30`; e.target.style.boxShadow = ""; }}
                        />
                      </div>
                    </div>

                    {/* App password field */}
                    <div>
                      <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: currentColor }}>
                        {t("service.appPassword")}
                      </label>
                      <div className="relative">
                        <FiKey className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px]" style={{ color: currentColor }} />
                        <input
                          type={showPass ? "text" : "password"}
                          value={form.pass_app}
                          onChange={(e) => setForm((p) => ({ ...p, pass_app: e.target.value }))}
                          placeholder={t("service.appPasswordPlaceholder")}
                          className={`${inputBase} pr-10`}
                          style={{ borderColor: `${currentColor}30` }}
                          onFocus={(e) => { e.target.style.borderColor = currentColor; e.target.style.boxShadow = `0 0 0 2px ${currentColor}20`; }}
                          onBlur={(e) => { e.target.style.borderColor = `${currentColor}30`; e.target.style.boxShadow = ""; }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPass((p) => !p)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600 dark:text-white/35 dark:hover:text-white/70"
                        >
                          <FiLock className="text-[13px]" />
                        </button>
                      </div>
                    </div>

                    {/* Save button */}
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving || !hasChanged}
                      className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
                      style={{ background: accentGrad }}
                    >
                      <FiSave className="text-[12px]" />
                      {saving ? t("service.saving") : t("service.save")}
                    </button>
                  </div>
                )}

                {/* Two-Step Verification + OTP sub-options */}
                <div className="overflow-hidden rounded-xl border border-slate-200/70 bg-white dark:border-white/8 dark:bg-white/3 transition-all">

                  {/* Main toggle row */}
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors"
                        style={twoFA
                          ? { backgroundColor: `${currentColor}15`, color: currentColor }
                          : { backgroundColor: "#f1f5f9", color: "#9ca3af" }
                        }
                      >
                        <FiShield className="text-[14px]" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="whitespace-nowrap text-[13px] font-semibold text-slate-800 dark:text-white/90">
                            {t("service.twoStep")}
                          </p>
                          <span
                            className="flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
                            style={twoFA
                              ? { borderColor: `${currentColor}40`, backgroundColor: `${currentColor}10`, color: currentColor }
                              : { borderColor: "#e2e8f0", color: "#94a3b8" }
                            }
                          >
                            {twoFA ? <><FiCheckCircle size={9} />{t("service.enabled")}</> : t("service.enable")}
                          </span>
                          <span
                            className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold"
                            style={{ borderColor: `${currentColor}30`, backgroundColor: `${currentColor}08`, color: currentColor }}
                          >
                            <FiZap size={8} />{t("service.strongAccess")}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-400 dark:text-white/40">
                          {t("service.twoStepDesc")}
                        </p>
                      </div>
                    </div>
                    <Toggle checked={twoFA} onChange={toggleTwoFA} color={currentColor} />
                  </div>

                  {/* OTP sub-options — slide in when twoFA is on */}
                  <div
                    className="overflow-hidden transition-all duration-300"
                    style={{ maxHeight: twoFA ? "360px" : "0px", opacity: twoFA ? 1 : 0 }}
                  >
                    <div className="border-t border-dashed border-slate-200 px-4 pb-4 pt-3 space-y-2 dark:border-white/8">
                      {/* Sub-section label */}
                      <div className="flex items-center gap-2 pb-1">
                        <div
                          className="inline-flex h-6 w-6 items-center justify-center rounded-lg"
                          style={{ backgroundColor: `${currentColor}15` }}
                        >
                          <FiShield className="text-[11px]" style={{ color: currentColor }} />
                        </div>
                        <div>
                          <p className="text-[11.5px] font-bold text-slate-700 dark:text-white/80">
                            {t("service.otpSettings")}
                          </p>
                          <p className="text-[10px] text-slate-400 dark:text-white/35">
                            {t("service.otpSettingsDesc")}
                          </p>
                        </div>
                      </div>

                      <OtpOptionRow
                        label={t("service.otpLogin")}
                        desc={t("service.otpLoginDesc")}
                        checked={otpLogin}
                        onChange={toggleOtpLogin}
                        color={currentColor}
                      />
                      <OtpOptionRow
                        label={t("service.otpRegister")}
                        desc={t("service.otpRegisterDesc")}
                        checked={otpRegister}
                        onChange={toggleOtpRegister}
                        color={currentColor}
                      />
                      <OtpOptionRow
                        label={t("service.otpResetPassword")}
                        desc={t("service.otpResetPasswordDesc")}
                        checked={otpReset}
                        onChange={toggleOtpReset}
                        color={currentColor}
                      />
                    </div>
                  </div>
                </div>

                {/* TOTP */}
                <div className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-white px-4 py-3 dark:border-white/8 dark:bg-white/3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors"
                      style={totpEnabled
                        ? { backgroundColor: "#e0f2fe", color: "#0891b2" }
                        : { backgroundColor: "#f1f5f9", color: "#9ca3af" }
                      }
                    >
                      <FiKey className="text-[14px]" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="whitespace-nowrap text-[13px] font-semibold text-slate-800 dark:text-white/90">
                          {t("service.authenticatorTotp")}
                        </p>
                        <span
                          className={[
                            "flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors",
                            totpEnabled
                              ? "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-300"
                              : "border-slate-200 bg-white text-slate-500 dark:border-slate-600 dark:bg-transparent dark:text-slate-400",
                          ].join(" ")}
                        >
                          {totpEnabled ? <><FiCheckCircle size={9} />{t("service.enabled")}</> : t("service.enable")}
                        </span>
                        <span className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                          <FiAward size={8} />{t("service.maximumSecurity")}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-400 dark:text-white/40">
                        {t("service.totpDesc")}
                      </p>
                    </div>
                  </div>
                  <Toggle checked={totpEnabled} onChange={toggleTotp} color="#0891b2" />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Maintenance Mode ── */}
      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white dark:border-white/8 dark:bg-[#0d0b1a]/60">

        <div className="border-b border-slate-100 px-5 py-3.5 dark:border-white/8">
          <div className="flex items-center gap-2.5">
            <FiTool className="text-[14px] text-amber-500" />
            <div>
              <h2 className="text-[13px] font-semibold text-slate-700 dark:text-white/80">
                {t("service.maintenanceMode")}
              </h2>
              <p className="text-[11px] text-slate-400 dark:text-white/35">
                {t("service.maintenanceModeSubtitle")}
              </p>
            </div>
          </div>
        </div>

        <div className="p-5">
          <div className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-slate-50/60 px-4 py-3.5 dark:border-white/8 dark:bg-white/3">
            <div className="flex items-center gap-3">
              <div
                className={[
                  "inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                  maintenance
                    ? "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400"
                    : "bg-slate-100 text-slate-400 dark:bg-white/5 dark:text-white/30",
                ].join(" ")}
              >
                <FiTool className="text-[14px]" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-slate-800 dark:text-white/90">
                  {maintenance ? t("service.systemInMaintenance") : t("service.systemOperational")}
                </p>
                <p className="text-[11px] text-slate-400 dark:text-white/40">
                  {maintenance ? t("service.maintenanceOnDesc") : t("service.systemOperationalDesc")}
                </p>
              </div>
            </div>
            <Toggle checked={maintenance} onChange={toggleMaintenance} color="#f59e0b" />
          </div>
        </div>
      </div>

    </div>
  );
};

export default Service;
