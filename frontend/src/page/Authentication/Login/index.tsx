import React, { useEffect, useRef, useState } from "react";
import { message } from "antd";
import { useNavigate, Link } from "react-router-dom";
import { FiEye, FiEyeOff, FiServer, FiWifi, FiCpu } from "react-icons/fi";
import { Login } from "../../../services/auth";
import { useStateContext } from "../../../contexts/ProviderContext";
import { useLanguage } from "../../../contexts/LanguageContext";
import AuthLayout from "../_shared/AuthLayout";
import { preloadLoginSuccessAnimationAssets } from "../animation";
import argusLogo from "../../../assets/argus-logo-real.png";
import argusWordmark from "../../../assets/argus-font-sidebar.png";

const inputCls = [
  "w-full rounded-xl border px-3.5 py-2 text-sm outline-none transition",
  "border-gray-300 dark:border-white/10",
  "bg-white dark:bg-white/5",
  "text-gray-800 dark:text-white/85",
  "placeholder:text-gray-400 dark:placeholder:text-white/25",
  "focus:border-blue-400 dark:focus:border-white/30",
  "focus:ring-4 focus:ring-blue-100 dark:focus:ring-white/5",
].join(" ");

const LoginPage: React.FC = () => {
  const navigate           = useNavigate();
  const { currentColor }   = useStateContext();
  const { t }               = useLanguage();
  const isMounted          = useRef(true);

  const [email,      setEmail]      = useState("");
  const [password,   setPassword]   = useState("");
  const [showPw,     setShowPw]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState("");

  // Warm the success-animation image cache ahead of time so /logo-animation
  // starts rendering instantly once we navigate there.
  useEffect(() => {
    void preloadLoginSuccessAnimationAssets();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError(t("auth.fillEmailAndPassword"));
      return;
    }

    try {
      setSubmitting(true);
      const res = await Login({ email: email.trim(), password });

      if (res.require_totp) {
        navigate("/otp", { state: { type: "totp" } });
        return;
      }
      if (res.require_email_otp) {
        navigate("/otp", {
          state: { type: "email_otp", maskedEmail: res.masked_email ?? "" },
        });
        return;
      }

      const role = (res.user?.role ?? "").toLowerCase();
      if (role === "admin" || role === "user") {
        message.success(t("auth.loginSuccess"));
        // Navigate to the dedicated /logo-animation route — it plays the
        // success animation, refreshes auth state, then switches to /admin
        // once the progress bar finishes.
        navigate("/logo-animation", {
          replace: true,
          state: { redirectTo: "/admin", refreshAuth: true },
        });
        return;
      }

      setError(t("auth.noPermission"));
    } catch (err: any) {
      setError(
        err?.response?.data?.error || err?.message || t("auth.loginFailed")
      );
    } finally {
      if (isMounted.current) setSubmitting(false);
    }
  };

  return (
    <AuthLayout variant="login">
      {/* ── Heading ── */}
      <div className="flex flex-col items-center mb-1">
        <img
          src={argusLogo}
          alt=""
          className="h-16 w-auto object-contain select-none mb-1"
          draggable={false}
        />
        <img
          src={argusWordmark}
          alt="Argus"
          className="h-6 w-auto object-contain select-none dark:brightness-125 dark:contrast-125"
          draggable={false}
        />
      </div>
      <p className="text-center text-sm text-gray-500 dark:text-white/45 mb-3">
        {t("auth.loginSubtitle")}
      </p>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-semibold text-gray-800 dark:text-white/80 mb-1">
            {t("auth.usernameOrEmail")}
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder={t("auth.enterEmail")}
            autoComplete="email"
            className={inputCls}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-800 dark:text-white/80 mb-1">
            {t("auth.password")}
          </label>
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={t("auth.enterPassword")}
              autoComplete="current-password"
              className={inputCls}
            />
            <button
              type="button"
              onClick={() => setShowPw(p => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/35 hover:text-gray-600 dark:hover:text-white/60 transition"
              aria-label={showPw ? t("auth.hidePassword") : t("auth.showPassword")}
            >
              {showPw ? <FiEyeOff size={16} /> : <FiEye size={16} />}
            </button>
          </div>
        </div>

        {/* Keep signed in  ←→  Forgot Password */}
        <div className="flex items-center justify-between gap-2">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-gray-300 cursor-pointer"
              style={{ accentColor: currentColor }}
            />
            <span className="text-sm text-gray-600 dark:text-white/55">{t("auth.rememberMe")}</span>
          </label>
          <Link
            to="/forgot-password"
            style={{ color: currentColor }}
            className="text-sm font-medium hover:opacity-80 transition-opacity whitespace-nowrap"
          >
            {t("auth.forgotPassword")}
          </Link>
        </div>

        <button
          type="submit"
          disabled={submitting}
          style={{ backgroundColor: submitting ? undefined : currentColor }}
          className="w-full text-white font-semibold py-3 text-sm shadow-md shadow-blue-500/20 transition-all hover:opacity-90 hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-gray-400 mt-1"
        >
          {submitting ? t("auth.signingIn") : t("auth.signIn")}
        </button>
      </form>

      {/* ── Type of Scan ── */}
      <div className="mt-3 flex items-center gap-3">
        <span className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
        <span className="shrink-0 text-sm text-gray-400 dark:text-white/35">{t("auth.typeOfScan")}</span>
        <span className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="flex items-center justify-center gap-1.5 bg-linear-to-br from-blue-600 to-sky-500 py-2 text-white shadow-sm shadow-blue-500/30 transition-all hover:-translate-y-0.5 hover:shadow-md hover:brightness-110">
          <FiServer size={13} />
          <span className="text-[10px] font-semibold">{t("auth.scanTypeNetwork")}</span>
        </div>

        <div className="flex items-center justify-center gap-1.5 bg-linear-to-br from-teal-500 to-emerald-500 py-2 text-white shadow-sm shadow-emerald-500/30 transition-all hover:-translate-y-0.5 hover:shadow-md hover:brightness-110">
          <FiWifi size={13} />
          <span className="text-[10px] font-semibold">{t("auth.scanTypeWireless")}</span>
        </div>

        <div className="flex items-center justify-center gap-1.5 bg-linear-to-br from-violet-600 to-fuchsia-500 py-2 text-white shadow-sm shadow-fuchsia-500/30 transition-all hover:-translate-y-0.5 hover:shadow-md hover:brightness-110">
          <FiCpu size={13} />
          <span className="text-[10px] font-semibold">{t("auth.scanTypeVirtualDevice")}</span>
        </div>
      </div>

      <p className="text-center text-sm text-gray-500 dark:text-white/40 mt-4">
        {t("auth.newToArgus")}{" "}
        <Link to="/register" style={{ color: currentColor }} className="hover:opacity-80 font-medium transition-opacity">
          {t("auth.createAccount")}
        </Link>
      </p>
    </AuthLayout>
  );
};

export default LoginPage;
