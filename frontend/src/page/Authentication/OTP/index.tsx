import React, { useEffect, useRef, useState } from "react";
import { message } from "antd";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { FiShield } from "react-icons/fi";
import { VerifyLoginEmailOTP } from "../../../services/auth";
import { VerifyTOTPLogin } from "../../../services/totp";
import { useLanguage } from "../../../contexts/LanguageContext";
import AuthLayout from "../_shared/AuthLayout";
import { preloadLoginSuccessAnimationAssets } from "../animation";

type OtpType = "totp" | "email_otp";

const OTPPage: React.FC = () => {
  const navigate         = useNavigate();
  const location         = useLocation();
  const { t }             = useLanguage();
  const isMounted        = useRef(true);

  const state            = (location.state as any) ?? {};
  const otpType: OtpType  = state.type ?? "email_otp";
  const maskedEmail: string = state.maskedEmail ?? "";

  const [digits,     setDigits]     = useState<string[]>(Array(6).fill(""));
  const [error,      setError]      = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>(Array(6).fill(null));

  useEffect(() => {
    isMounted.current = true;
    if (!state.type) navigate("/login", { replace: true });
    return () => { isMounted.current = false; };
  }, [state.type, navigate]);

  // Warm the success-animation image cache ahead of time — same reasoning
  // as the Login page.
  useEffect(() => {
    void preloadLoginSuccessAnimationAssets();
  }, []);

  const code = digits.join("");

  const handleChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next  = [...digits];
    next[index] = digit;
    setDigits(next);
    setError("");
    if (digit && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const next = Array(6).fill("");
    for (let i = 0; i < text.length; i++) next[i] = text[i];
    setDigits(next);
    setError("");
    inputRefs.current[Math.min(text.length, 5)]?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (code.length !== 6) { setError(t("auth.enterFullCode6")); return; }

    try {
      setSubmitting(true);
      if (otpType === "totp") {
        await VerifyTOTPLogin(code);
      } else {
        await VerifyLoginEmailOTP(code);
      }
      message.success(t("auth.loginSuccess"));
      // Navigate to the dedicated /after-login-animation route — it plays the
      // success animation, refreshes auth state, then switches to /admin
      // once the progress bar finishes.
      navigate("/after-login-animation", {
        replace: true,
        state: { redirectTo: "/admin", refreshAuth: true },
      });
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || t("auth.codeInvalidOrExpired"));
    } finally {
      if (isMounted.current) setSubmitting(false);
    }
  };

  const isTotp = otpType === "totp";

  return (
    <AuthLayout variant="login">
      {/* Icon */}
      <div className="flex justify-center mb-5">
        <div
          className="w-16 h-16 flex items-center justify-center border-2"
          style={{ borderColor: "#1A97F550" }}
        >
          {isTotp ? (
            <FiShield size={32} style={{ color: "#1A97F5" }} />
          ) : (
            <svg width="38" height="48" viewBox="0 0 38 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="1" y="1" width="36" height="46" rx="4" stroke="#1A97F5" strokeOpacity="0.6" strokeWidth="2" fill="none"/>
              <rect x="13" y="4" width="12" height="2" rx="1" fill="#1A97F5" fillOpacity="0.6"/>
              <rect x="7" y="16" width="24" height="16" rx="2" stroke="#1A97F5" strokeOpacity="0.6" strokeWidth="1.5" fill="none"/>
              <text x="19" y="27" textAnchor="middle" fontSize="8" fill="#1A97F5" fillOpacity="0.6" fontFamily="monospace" fontWeight="bold">***</text>
              <rect x="14" y="41" width="10" height="2" rx="1" fill="#1A97F5" fillOpacity="0.6"/>
            </svg>
          )}
        </div>
      </div>

      <h2 className="text-[2rem] font-bold text-center text-gray-900 mb-3">
        {isTotp ? t("auth.validateTotp") : t("auth.validateOtp")}
      </h2>

      <p className="text-center text-sm text-gray-500 leading-relaxed mb-1 max-w-xs mx-auto">
        {isTotp
          ? t("auth.totpInstructions")
          : `${t("auth.otpInstructions")}${maskedEmail ? ` ${t("auth.codeSentTo", { email: maskedEmail })}` : ""}`}
      </p>

      {error && (
        <div className="mt-3 mb-1 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 text-center">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <p className="text-center text-sm font-semibold text-gray-800 mt-5 mb-3">
          {t("auth.enter6DigitCode")}
        </p>

        {/* OTP boxes */}
        <div className="flex gap-3 justify-center mb-6">
          {Array(6).fill(null).map((_, i) => (
            <input
              key={i}
              ref={el => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digits[i]}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              onPaste={i === 0 ? handlePaste : undefined}
              autoFocus={i === 0}
              className="w-12 h-12 text-center text-xl font-bold border-2 border-gray-300 bg-white text-gray-900 outline-none transition"
              style={{
                borderColor: digits[i] ? "#1A97F5" : undefined,
                boxShadow: digits[i] ? "0 0 0 2px #1A97F525" : undefined,
              }}
            />
          ))}
        </div>

        <button
          type="submit"
          disabled={submitting || code.length !== 6}
          style={{ backgroundColor: submitting || code.length !== 6 ? undefined : "#1A97F5" }}
          className="w-full text-white font-semibold py-3 text-sm transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {submitting ? t("auth.verifying") : t("auth.verify")}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-4">
        <Link to="/login" style={{ color: "#1A97F5" }} className="hover:opacity-80 transition-opacity">
          ← {t("auth.backToSignIn")}
        </Link>
      </p>
    </AuthLayout>
  );
};

export default OTPPage;
