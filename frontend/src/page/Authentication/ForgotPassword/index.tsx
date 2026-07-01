import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  CheckUserEmail,
  type CheckUserEmailResponse,
} from "../../../services/auth";
import { useStateContext } from "../../../contexts/ProviderContext";
import { useLanguage } from "../../../contexts/LanguageContext";
import AuthLayout from "../_shared/AuthLayout";

const inputCls = [
  "w-full border px-4 py-2.5 text-sm outline-none transition",
  "border-gray-300 dark:border-white/10",
  "bg-white dark:bg-white/5",
  "text-gray-800 dark:text-white/85",
  "placeholder:text-gray-400 dark:placeholder:text-white/25",
  "focus:border-gray-500 dark:focus:border-white/30",
  "focus:ring-2 focus:ring-gray-100 dark:focus:ring-white/5",
].join(" ");

const ForgotPasswordPage: React.FC = () => {
  const navigate         = useNavigate();
  const { currentColor } = useStateContext();
  const { t }             = useLanguage();

  const [email,   setEmail]   = useState("");
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmed = email.trim();
    if (!trimmed) {
      setError(t("auth.enterEmailPlain"));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError(t("auth.invalidEmailFormatPlain"));
      return;
    }

    try {
      setLoading(true);
      const res: CheckUserEmailResponse | null = await CheckUserEmail({ email: trimmed });
      if (!res)        { setError(t("auth.cannotVerifyEmail")); return; }
      if (!res.exists) { setError(res.error || t("auth.emailNotFound")); return; }
      navigate("/reset-password", { state: { email: trimmed } });
    } catch (err: any) {
      setError(
        err?.response?.data?.error || err?.message || t("auth.verifyEmailError")
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout variant="login">
      {/* ── Heading ── */}
      <h2 className="text-[2rem] font-bold text-center text-gray-900 dark:text-white/90 mb-1">
        Argus
      </h2>
      <p className="text-center text-sm text-gray-500 dark:text-white/45 mb-7">
        {t("auth.forgotPasswordSubtitle")}
      </p>

      {error && (
        <div className="mb-4 border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-800 dark:text-white/80 mb-1.5">
            {t("auth.emailAddress")}
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

        <button
          type="submit"
          disabled={loading}
          style={{ backgroundColor: loading ? undefined : currentColor }}
          className="w-full text-white font-semibold py-3 text-sm transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {loading ? t("auth.checking") : t("auth.sendMeEmail")}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 dark:text-white/40 mt-6">
        {t("auth.returnTo")}{" "}
        <Link to="/login" style={{ color: currentColor }} className="hover:opacity-80 font-medium transition-opacity">
          {t("auth.signIn")}
        </Link>
      </p>
    </AuthLayout>
  );
};

export default ForgotPasswordPage;
