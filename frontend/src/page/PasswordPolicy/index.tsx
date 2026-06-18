import React, { useCallback, useEffect, useState } from "react";
import {
  FiShield, FiSave, FiRefreshCw, FiLock, FiCheck, FiClock, FiAlertTriangle,
} from "react-icons/fi";
import { message } from "antd";
import { GetPasswordPolicy, UpdatePasswordPolicy, type PasswordPolicy } from "../../services/passwordpolicy";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useStateContext } from "../../contexts/ProviderContext";
import { useLanguage } from "../../contexts/LanguageContext";

// ─────────────────────────────────────────────────────────────
// Default
// ─────────────────────────────────────────────────────────────

const DEFAULT: PasswordPolicy = {
  min_length: 8,
  require_uppercase: false,
  require_number: false,
  require_special: false,
  expiry_days: 0,
};

// ─────────────────────────────────────────────────────────────
// Toggle Row
// ─────────────────────────────────────────────────────────────

const ToggleRow: React.FC<{
  label: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}> = ({ label, desc, value, onChange, disabled }) => (
  <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200/70 bg-white px-4 py-3.5 dark:border-white/8 dark:bg-white/4">
    <div className="min-w-0">
      <p className="text-[12px] font-semibold text-slate-800 dark:text-white/85">{label}</p>
      <p className="mt-0.5 text-[11px] text-slate-400 dark:text-white/40">{desc}</p>
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={value}
      disabled={disabled}
      onClick={() => onChange(!value)}
      className={[
        "relative h-6 w-11 shrink-0 overflow-hidden rounded-full transition-colors duration-200",
        value ? "bg-slate-900 dark:bg-white/70" : "bg-slate-200 dark:bg-white/15",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
      ].join(" ")}
    >
      <span className={[
        "absolute left-0 top-0.5 block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200",
        value ? "translate-x-5.5" : "translate-x-0.5",
      ].join(" ")} />
    </button>
  </div>
);

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────

const PasswordPolicyPage: React.FC = () => {
  const { isAdmin } = useAuth() as any;
  const navigate    = useNavigate();
  const { currentColor } = useStateContext();
  const { t } = useLanguage();

  const accentGrad = `linear-gradient(135deg, ${currentColor}, color-mix(in srgb, ${currentColor} 65%, #a855f7))`;

  const [policy, setPolicy]       = useState<PasswordPolicy>(DEFAULT);
  const [draft, setDraft]         = useState<PasswordPolicy>(DEFAULT);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => { if (!isAdmin) navigate("/admin", { replace: true }); }, [isAdmin, navigate]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await GetPasswordPolicy();
      setPolicy(data); setDraft(data); setHasChanges(false);
    } catch { message.error("Failed to load password policy"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const updateDraft = <K extends keyof PasswordPolicy>(key: K, value: PasswordPolicy[K]) => {
    setDraft(prev => {
      const next = { ...prev, [key]: value };
      setHasChanges(JSON.stringify(next) !== JSON.stringify(policy));
      return next;
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const updated = await UpdatePasswordPolicy(draft);
      setPolicy(updated); setDraft(updated); setHasChanges(false);
      message.success("Password policy updated");
    } catch (err: any) {
      message.error(err?.response?.data?.error || "Failed to save policy");
    } finally { setSaving(false); }
  };

  const handleReset = () => { setDraft(policy); setHasChanges(false); };

  if (loading) {
    return (
      <div className="flex h-60 items-center justify-center">
        <FiRefreshCw className="animate-spin text-[22px] text-slate-400 dark:text-white/30" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-5 py-0 sm:py-0">

      {/* ── Header card ── */}
      <div
        className="relative mb-4 overflow-hidden rounded-[18px] bg-white/95 p-4 shadow-sm backdrop-blur sm:rounded-[22px] sm:mb-5 sm:p-6 dark:bg-[#0d0b1a]/90"
        style={{ border: `1px solid ${currentColor}30` }}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-12 right-10 h-40 w-40 rounded-full blur-3xl" style={{ backgroundColor: `${currentColor}1e` }} />
          <div className="absolute -bottom-12 left-10 h-40 w-40 rounded-full blur-3xl" style={{ backgroundColor: `${currentColor}14` }} />
        </div>
        <div className="relative z-10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-4">
            <div
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg sm:h-13 sm:w-13"
              style={{ background: accentGrad, boxShadow: `0 8px 24px -6px ${currentColor}50` }}
            >
              <FiLock className="text-[20px] sm:text-[22px]" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] sm:text-[10.5px]" style={{ color: currentColor }}>
                  MANAGEMENT · SECURITY
                </p>
              </div>
              <h1 className="truncate text-[18px] font-bold text-slate-900 sm:text-[20px] dark:text-white/90">
                {t("passwordpolicy.title")}
              </h1>
              <p className="mt-0.5 truncate text-[11px] text-slate-500 sm:text-[12px] dark:text-white/45">
                {t("passwordpolicy.subtitle")}
              </p>
            </div>
          </div>

          {/* Action buttons inline with header */}
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              disabled={!hasChanges || saving}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200/70 bg-white px-3 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/8 dark:bg-white/5 dark:text-white/60"
            >
              <FiRefreshCw className="text-[11px]" />
              <span className="hidden sm:inline">{t("passwordpolicy.reset")}</span>
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={!hasChanges || saving}
              className="flex h-8 items-center gap-1.5 rounded-lg px-3.5 text-[11px] font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: accentGrad }}
            >
              {saving ? <FiRefreshCw className="animate-spin text-[11px]" /> : <FiSave className="text-[11px]" />}
              <span className="hidden sm:inline">{saving ? t("passwordpolicy.saving") : t("passwordpolicy.saveChanges")}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Unsaved changes banner ── */}
      {hasChanges && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 dark:border-amber-500/20 dark:bg-amber-500/8">
          <FiAlertTriangle className="shrink-0 text-[13px] text-amber-500" />
          <p className="text-[11.5px] font-medium text-amber-700 dark:text-amber-300">
            {t("passwordpolicy.unsavedChanges")}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

        {/* ── Complexity Rules ── */}
        <div className="rounded-xl border border-slate-200/70 bg-white dark:border-white/8 dark:bg-[#0d0b1a]/80">
          <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-3.5 dark:border-white/8">
            <FiShield className="text-[14px] text-slate-500 dark:text-white/40" />
            <div>
              <h2 className="text-[13px] font-semibold text-slate-700 dark:text-white/80">Complexity Rules</h2>
              <p className="mt-0.5 text-[11px] text-slate-400 dark:text-white/30">Requirements for password strength</p>
            </div>
          </div>

          <div className="space-y-2.5 p-4">
            {/* Min Length */}
            <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200/70 bg-white px-4 py-3.5 dark:border-white/8 dark:bg-white/4">
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-slate-800 dark:text-white/85">Minimum Length</p>
                <p className="mt-0.5 text-[11px] text-slate-400 dark:text-white/40">Minimum number of characters required</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button type="button"
                  onClick={() => updateDraft("min_length", Math.max(6, draft.min_length - 1))}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200/70 bg-white text-slate-600 transition hover:border-slate-900 hover:text-slate-900 dark:border-white/8 dark:bg-white/5 dark:text-white/60 dark:hover:border-white/30 dark:hover:text-white">
                  −
                </button>
                <input type="number" min={6} max={128} value={draft.min_length}
                  onChange={e => updateDraft("min_length", Math.min(128, Math.max(6, parseInt(e.target.value) || 6)))}
                  className="h-7 w-12 rounded-lg border border-slate-200/70 bg-white px-0 text-center text-[13px] font-bold text-slate-900 outline-none dark:border-white/8 dark:bg-white/8 dark:text-white [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <button type="button"
                  onClick={() => updateDraft("min_length", Math.min(128, draft.min_length + 1))}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200/70 bg-white text-slate-600 transition hover:border-slate-900 hover:text-slate-900 dark:border-white/8 dark:bg-white/5 dark:text-white/60 dark:hover:border-white/30 dark:hover:text-white">
                  +
                </button>
              </div>
            </div>

            <ToggleRow
              label="Require Uppercase"
              desc="At least one uppercase letter (A–Z)"
              value={draft.require_uppercase}
              onChange={v => updateDraft("require_uppercase", v)}
            />
            <ToggleRow
              label="Require Number"
              desc="At least one numeric digit (0–9)"
              value={draft.require_number}
              onChange={v => updateDraft("require_number", v)}
            />
            <ToggleRow
              label="Require Special Character"
              desc={`At least one special character (!@#$%^&*)`}
              value={draft.require_special}
              onChange={v => updateDraft("require_special", v)}
            />
          </div>
        </div>

        {/* ── Right column ── */}
        <div className="space-y-5">

          {/* Password Expiry */}
          <div className="rounded-xl border border-slate-200/70 bg-white dark:border-white/8 dark:bg-[#0d0b1a]/80">
            <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-3.5 dark:border-white/8">
              <FiClock className="text-[14px] text-amber-500" />
              <div>
                <h2 className="text-[13px] font-semibold text-slate-700 dark:text-white/80">Password Expiry</h2>
                <p className="mt-0.5 text-[11px] text-slate-400 dark:text-white/30">How often passwords must be changed (0 = never)</p>
              </div>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-3">
                <input type="number" min={0} max={365} value={draft.expiry_days}
                  onChange={e => updateDraft("expiry_days", Math.min(365, Math.max(0, parseInt(e.target.value) || 0)))}
                  className="h-10 w-20 rounded-lg border border-slate-200/70 bg-white px-0 text-center text-[16px] font-bold text-slate-900 outline-none dark:border-white/8 dark:bg-white/8 dark:text-white [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <span className="text-[12px] text-slate-500 dark:text-white/45">days</span>
                {draft.expiry_days === 0 ? (
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10.5px] font-semibold text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/8 dark:text-emerald-400">
                    Never expires
                  </span>
                ) : (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[10.5px] font-semibold text-amber-600 dark:border-amber-500/20 dark:bg-amber-500/8 dark:text-amber-400">
                    Expires every {draft.expiry_days} days
                  </span>
                )}
              </div>
              {draft.expiry_days > 0 && (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-500/20 dark:bg-amber-500/8">
                  <FiAlertTriangle className="mt-0.5 shrink-0 text-[11px] text-amber-500" />
                  <p className="text-[11px] text-amber-700 dark:text-amber-300">
                    Users will be required to change their password every {draft.expiry_days} days.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Policy Preview */}
          <div className="rounded-xl border border-slate-200/70 bg-white dark:border-white/8 dark:bg-[#0d0b1a]/80">
            <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-3.5 dark:border-white/8">
              <FiLock className="text-[14px] text-slate-500 dark:text-white/40" />
              <div>
                <h2 className="text-[13px] font-semibold text-slate-700 dark:text-white/80">Policy Preview</h2>
                <p className="mt-0.5 text-[11px] text-slate-400 dark:text-white/30">Active rules for password validation</p>
              </div>
            </div>
            <div className="space-y-1.5 p-4">
              {[
                { label: `Minimum ${draft.min_length} characters`, active: true },
                { label: "At least one uppercase letter",           active: draft.require_uppercase },
                { label: "At least one number",                     active: draft.require_number },
                { label: "At least one special character",          active: draft.require_special },
                { label: draft.expiry_days > 0 ? `Password expires every ${draft.expiry_days} days` : "No expiry", active: true },
              ].map(rule => (
                <div key={rule.label}
                  className={[
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-[11.5px]",
                    rule.active
                      ? "bg-slate-50 font-medium text-slate-700 dark:bg-white/5 dark:text-white/70"
                      : "text-slate-300 line-through dark:text-white/20",
                  ].join(" ")}
                >
                  <FiCheck className={`shrink-0 text-[11px] ${rule.active ? "text-slate-500 dark:text-white/45" : "text-slate-200 dark:text-white/15"}`} />
                  {rule.label}
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default PasswordPolicyPage;
