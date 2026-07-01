import React, { useEffect, useRef, useState } from "react";
import { message } from "antd";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { FiMail } from "react-icons/fi";
import { VerifyOTPSignUp, SendOTPForSignUp } from "../../../services/auth";
import { useStateContext } from "../../../contexts/ProviderContext";
import { useLanguage } from "../../../contexts/LanguageContext";
import AuthLayout from "../_shared/AuthLayout";
import { preloadLoginSuccessAnimationAssets } from "../animation";

type SignUpFormData = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  location: string;
  position: string;
};

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 30;

const maskEmail = (email: string) => {
  if (!email || !email.includes("@")) return email;
  const [name, domain] = email.split("@");
  if (name.length <= 3) return `${name[0] ?? ""}***@${domain}`;
  return `${name.slice(0, 3)}***@${domain}`;
};

const RegisterOTPPage: React.FC = () => {
  const navigate         = useNavigate();
  const location         = useLocation();
  const { currentColor } = useStateContext();
  const { t }             = useLanguage();
  const isMounted        = useRef(true);

  const signupData = (location.state as SignUpFormData | null) ?? null;

  const [digits,     setDigits]     = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [error,      setError]      = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending,  setResending]  = useState(false);
  const [cooldown,   setCooldown]   = useState(RESEND_COOLDOWN);
  const inputRefs = useRef<(HTMLInputElement | null)[]>(Array(OTP_LENGTH).fill(null));

  useEffect(() => {
    isMounted.current = true;
    if (!signupData?.email) navigate("/register", { replace: true });
    return () => { isMounted.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Warm the success-animation image cache ahead of time so /logo-animation
  // starts rendering instantly once we navigate there.
  useEffect(() => {
    void preloadLoginSuccessAnimationAssets();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  if (!signupData?.email) return null;

  const code = digits.join("");

  const handleChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next  = [...digits];
    next[index] = digit;
    setDigits(next);
    setError("");
    if (digit && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    const next = Array(OTP_LENGTH).fill("");
    for (let i = 0; i < text.length; i++) next[i] = text[i];
    setDigits(next);
    setError("");
    inputRefs.current[Math.min(text.length, OTP_LENGTH - 1)]?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (code.length !== OTP_LENGTH) { setError(t("auth.enterFullCodeN", { n: OTP_LENGTH })); return; }

    try {
      setSubmitting(true);
      const res = await VerifyOTPSignUp({
        email:        signupData.email,
        otp:          code,
        password:     signupData.password,
        first_name:   signupData.first_name,
        last_name:    signupData.last_name,
        phone_number: signupData.phone_number,
        location:     signupData.location,
        position:     signupData.position,
      });

      if (!res)       { setError(t("auth.otpVerifyFailed")); return; }
      if (res.error)  { setError(res.error);              return; }

      message.success(res.message || t("auth.registerSuccess"));
      // Navigate to the dedicated /logo-animation route — it plays the
      // success animation, then switches to /login once it finishes.
      navigate("/logo-animation", {
        replace: true,
        state: { redirectTo: "/login" },
      });
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || t("auth.otpVerifyError"));
    } finally {
      if (isMounted.current) setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setError("");
    try {
      setResending(true);
      const res = await SendOTPForSignUp({ email: signupData.email });
      if (!res)       { setError(t("auth.otpResendFailed")); return; }
      if (res.error)  { setError(res.error);                 return; }

      message.success(res.message || t("auth.otpResendSuccess"));
      setDigits(Array(OTP_LENGTH).fill(""));
      setCooldown(RESEND_COOLDOWN);
      inputRefs.current[0]?.focus();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || t("auth.otpResendError"));
    } finally {
      if (isMounted.current) setResending(false);
    }
  };

  return (
    <AuthLayout variant="login">
      {/* Icon */}
      <div className="flex justify-center mb-5">
        <div
          className="w-16 h-16 flex items-center justify-center border-2"
          style={{ borderColor: `${currentColor}50` }}
        >
          <FiMail size={30} style={{ color: currentColor }} />
        </div>
      </div>

      <h2 className="text-[2rem] font-bold text-center text-gray-900 dark:text-white/90 mb-3">
        {t("auth.verifyYourEmail")}
      </h2>

      <p className="text-center text-sm text-gray-500 dark:text-white/45 leading-relaxed mb-1 max-w-xs mx-auto">
        {t("auth.otpSentToPrefix")}
      </p>
      <p className="text-center text-sm font-semibold text-gray-800 dark:text-white/80">
        {maskEmail(signupData.email)}
      </p>

      {error && (
        <div className="mt-3 mb-1 border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300 text-center">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <p className="text-center text-sm font-semibold text-gray-800 dark:text-white/80 mt-5 mb-3">
          {t("auth.enterNDigitCode", { n: OTP_LENGTH })}
        </p>

        {/* OTP boxes */}
        <div className="flex gap-3 justify-center mb-6">
          {Array(OTP_LENGTH).fill(null).map((_, i) => (
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
              className="w-12 h-12 text-center text-xl font-bold border-2 border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white/90 outline-none transition"
              style={{
                borderColor: digits[i] ? currentColor : undefined,
                boxShadow: digits[i] ? `0 0 0 2px ${currentColor}25` : undefined,
              }}
            />
          ))}
        </div>

        <button
          type="submit"
          disabled={submitting || code.length !== OTP_LENGTH}
          style={{ backgroundColor: submitting || code.length !== OTP_LENGTH ? undefined : currentColor }}
          className="w-full text-white font-semibold py-3 text-sm transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {submitting ? t("auth.verifying") : t("auth.verify")}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 dark:text-white/40 mt-4">
        {t("auth.notReceivedCode")}{" "}
        <button
          type="button"
          onClick={handleResend}
          disabled={cooldown > 0 || resending}
          style={{ color: cooldown > 0 || resending ? undefined : currentColor }}
          className="font-medium underline underline-offset-2 disabled:no-underline disabled:text-gray-400 dark:disabled:text-white/25 disabled:cursor-not-allowed transition-opacity hover:opacity-80"
        >
          {resending ? t("common.sending") : cooldown > 0 ? t("auth.resendCodeCountdown", { s: cooldown }) : t("auth.resendCode")}
        </button>
      </p>

      <p className="text-center text-sm text-gray-500 dark:text-white/40 mt-2">
        <Link to="/register" style={{ color: currentColor }} className="hover:opacity-80 transition-opacity">
          ← {t("auth.backToRegister")}
        </Link>
      </p>
    </AuthLayout>
  );
};

export default RegisterOTPPage;
