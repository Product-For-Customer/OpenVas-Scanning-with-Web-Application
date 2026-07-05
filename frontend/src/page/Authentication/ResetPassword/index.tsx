import React, { useEffect, useMemo, useRef, useState } from "react";
import { message } from "antd";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { FiEye, FiEyeOff } from "react-icons/fi";
import {
  GetServiceSettings,
  DirectResetPassword,
  SendOTP,
  type ServiceSettings,
} from "../../../services/auth";
import {
  GetPasswordPolicy,
  type PasswordPolicy,
} from "../../../services/passwordpolicy";
import { useLanguage } from "../../../contexts/LanguageContext";
import AuthLayout from "../_shared/AuthLayout";
import PasswordPolicyDropdown from "../_shared/PasswordPolicyDropdown";
import argusWordmark from "../../../assets/argus-font-sidebar.png";

const inputCls = [
  "w-full border px-4 py-2.5 text-sm outline-none transition",
  "border-gray-300",
  "bg-white",
  "text-gray-800",
  "placeholder:text-gray-400",
  "focus:border-[#1A97F5]",
  "focus:ring-2 focus:ring-[#1A97F5]/20",
].join(" ");

const ResetPasswordPage: React.FC = () => {
  const navigate         = useNavigate();
  const location         = useLocation();
  const { t }             = useLanguage();
  const isMounted        = useRef(true);

  const email: string = (location.state as any)?.email ?? "";

  const [svcSettings,     setSvcSettings]     = useState<ServiceSettings>({
    login_otp: false, register_otp: false, reset_otp: false,
  });
  const [policy,          setPolicy]          = useState<PasswordPolicy | null>(null);
  const [newPassword,     setNewPassword]     = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew,         setShowNew]         = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);
  const [newPwFocused,    setNewPwFocused]    = useState(false);
  const [error,           setError]           = useState("");
  const [submitting,      setSubmitting]      = useState(false);

  useEffect(() => {
    isMounted.current = true;
    if (!email) { navigate("/forgot-password", { replace: true }); return; }
    GetPasswordPolicy().then(setPolicy).catch(() => {});
    GetServiceSettings()
      .then(s => { if (isMounted.current) setSvcSettings(s); })
      .catch(() => {});
    return () => { isMounted.current = false; };
  }, [email, navigate]);

  const strength = useMemo(() => {
    let s = 0;
    if (newPassword.length >= 8)           s += 25;
    if (/[A-Z]/.test(newPassword))         s += 20;
    if (/[a-z]/.test(newPassword))         s += 20;
    if (/[0-9]/.test(newPassword))         s += 15;
    if (/[^A-Za-z0-9]/.test(newPassword))  s += 20;
    return Math.min(s, 100);
  }, [newPassword]);

  const strengthLabel = strength >= 80 ? t("auth.strengthStrong") : strength >= 50 ? t("auth.strengthMedium") : strength > 0 ? t("auth.strengthWeak") : "";
  const strengthColor = strength >= 80 ? "#22c55e" : strength >= 50 ? "#f59e0b" : "#ef4444";

  const validate = (): string => {
    if (!newPassword.trim()) return t("auth.enterNewPasswordRequired");
    const minLen = policy?.min_length ?? 8;
    if (newPassword.length < minLen)
      return t("auth.passwordMinLength", { min: minLen });
    if ((policy?.require_uppercase ?? false) && !/[A-Z]/.test(newPassword))
      return t("auth.passwordNeedsUppercase");
    if ((policy?.require_number    ?? false) && !/[0-9]/.test(newPassword))
      return t("auth.passwordNeedsNumber");
    if ((policy?.require_special   ?? false) && !/[^A-Za-z0-9]/.test(newPassword))
      return t("auth.passwordNeedsSpecial");
    if (!confirmPassword.trim()) return t("auth.enterConfirmPassword");
    if (newPassword !== confirmPassword) return t("auth.passwordMismatch");
    return "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const err = validate();
    if (err) { setError(err); return; }

    try {
      setSubmitting(true);

      if (!svcSettings.reset_otp) {
        await DirectResetPassword(email, newPassword);
        message.success(t("auth.resetSuccess"));
        navigate("/login", { replace: true });
        return;
      }

      const sendRes = await SendOTP({ email });
      if (!sendRes)       { setError(t("auth.otpSendFailed")); return; }
      if (sendRes.error)  { setError(sendRes.error);        return; }
      message.success(sendRes.message || t("auth.otpSentToEmail"));
      navigate("/reset-otp", { state: { email, newPassword } });
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || t("auth.otpSendError"));
    } finally {
      if (isMounted.current) setSubmitting(false);
    }
  };

  return (
    <AuthLayout variant="login">
      <div className="flex justify-center mb-2">
        <img
          src={argusWordmark}
          alt="Argus"
          className="h-8 w-auto object-contain select-none"
          draggable={false}
        />
      </div>
      <h2 className="text-[2rem] font-bold text-center text-gray-900 mb-2">
        {t("auth.resetPasswordTitle")}
      </h2>
      <p className="text-center text-sm text-gray-500 mb-7">
        {t("auth.setNewPasswordFor")}{" "}
        <span className="font-semibold text-gray-700">{email || t("auth.yourAccount")}</span>
      </p>

      {error && (
        <div className="mb-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-1.5">
            {t("auth.newPassword")}
          </label>
          <div className="relative">
            <input
              type={showNew ? "text" : "password"}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              onFocus={() => setNewPwFocused(true)}
              onBlur={() => setNewPwFocused(false)}
              placeholder={t("auth.enterNewPassword")}
              autoComplete="new-password"
              className={inputCls}
            />
            <button
              type="button"
              onClick={() => setShowNew(p => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
              aria-label={showNew ? t("auth.hidePassword") : t("auth.showPassword")}
            >
              {showNew ? <FiEyeOff size={16} /> : <FiEye size={16} />}
            </button>
            <PasswordPolicyDropdown policy={policy} password={newPassword} open={newPwFocused} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-1.5">
            {t("auth.confirmPassword")}
          </label>
          <div className="relative">
            <input
              type={showConfirm ? "text" : "password"}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder={t("auth.confirmPasswordPlaceholder")}
              className={inputCls}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(p => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
              aria-label={showConfirm ? t("auth.hidePassword") : t("auth.showPassword")}
            >
              {showConfirm ? <FiEyeOff size={16} /> : <FiEye size={16} />}
            </button>
          </div>
        </div>

        {/* Strength bar */}
        {newPassword && (
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-500">{t("auth.passwordStrength")}</span>
              <span className="font-semibold" style={{ color: strengthColor }}>{strengthLabel}</span>
            </div>
            <div className="h-1.5 bg-gray-200 overflow-hidden">
              <div
                className="h-full transition-all duration-300"
                style={{ width: `${strength}%`, backgroundColor: strengthColor }}
              />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          style={{ backgroundColor: submitting ? undefined : "#1A97F5" }}
          className="w-full text-white font-semibold py-3 text-sm transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {submitting
            ? svcSettings.reset_otp ? t("auth.sendingOtp") : t("auth.resetting")
            : t("auth.confirmReset")}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-5">
        {t("auth.backTo")}{" "}
        <Link to="/login" style={{ color: "#1A97F5" }} className="hover:opacity-80 font-medium transition-opacity">
          {t("auth.signIn")}
        </Link>
      </p>
    </AuthLayout>
  );
};

export default ResetPasswordPage;
