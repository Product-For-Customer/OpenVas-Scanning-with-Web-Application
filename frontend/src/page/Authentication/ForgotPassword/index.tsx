import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  CheckUserEmail,
  type CheckUserEmailResponse,
} from "../../../services/auth";
import { useLanguage } from "../../../contexts/LanguageContext";
import AuthLayout from "../_shared/AuthLayout";
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

const ForgotPasswordPage: React.FC = () => {
  const navigate         = useNavigate();
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
      <div className="flex justify-center mb-2">
        <img
          src={argusWordmark}
          alt="Argus"
          className="h-8 w-auto object-contain select-none"
          draggable={false}
        />
      </div>
      <p className="text-center text-sm text-gray-500 mb-7">
        {t("auth.forgotPasswordSubtitle")}
      </p>

      {error && (
        <div className="mb-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-1.5">
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
          style={{ backgroundColor: loading ? undefined : "#1A97F5" }}
          className="w-full text-white font-semibold py-3 text-sm transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {loading ? t("auth.checking") : t("auth.sendMeEmail")}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-6">
        {t("auth.returnTo")}{" "}
        <Link to="/login" style={{ color: "#1A97F5" }} className="hover:opacity-80 font-medium transition-opacity">
          {t("auth.signIn")}
        </Link>
      </p>
    </AuthLayout>
  );
};

export default ForgotPasswordPage;
