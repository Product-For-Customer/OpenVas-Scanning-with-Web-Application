import React, { useEffect, useRef, useState } from "react";
import { message } from "antd";
import { useNavigate, Link } from "react-router-dom";
import { FiEye, FiEyeOff } from "react-icons/fi";
import {
  GetServiceSettings,
  DirectSignUp,
  SendOTPForSignUp,
  CheckEmailAvailable,
  type ServiceSettings,
} from "../../../services/auth";
import {
  GetPasswordPolicy,
  validatePasswordAgainstPolicy,
  type PasswordPolicy,
} from "../../../services/passwordpolicy";
import { useLanguage } from "../../../contexts/LanguageContext";
import AuthLayout from "../_shared/AuthLayout";
import PasswordPolicyDropdown from "../_shared/PasswordPolicyDropdown";
import argusWordmark from "../../../assets/argus-font-sidebar.png";

type FormData = {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
};

const inputCls = [
  "w-full border px-4 py-2.5 text-sm outline-none transition",
  "border-gray-300",
  "bg-white",
  "text-gray-800",
  "placeholder:text-gray-400",
  "focus:border-[#1A97F5]",
  "focus:ring-2 focus:ring-[#1A97F5]/20",
].join(" ");

const RegisterPage: React.FC = () => {
  const navigate         = useNavigate();
  const { t }             = useLanguage();
  const isMounted        = useRef(true);

  const [svcSettings, setSvcSettings] = useState<ServiceSettings>({
    login_otp: false, register_otp: false, reset_otp: false,
  });
  const [policy,     setPolicy]     = useState<PasswordPolicy | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPw,     setShowPw]     = useState(false);
  const [pwFocused,  setPwFocused]  = useState(false);
  const [emailError, setEmailError] = useState("");

  const [form, setForm] = useState<FormData>({
    first_name: "", last_name: "", email: "", password: "",
  });

  useEffect(() => {
    isMounted.current = true;
    GetPasswordPolicy().then(setPolicy).catch(() => {});
    GetServiceSettings()
      .then(s => { if (isMounted.current) setSvcSettings(s); })
      .catch(() => {});
    return () => { isMounted.current = false; };
  }, []);

  // Live "email already taken" check, debounced so we ask the backend once
  // the user pauses typing a syntactically-valid address — one email at a
  // time (the endpoint no longer hands the whole user list to the browser).
  useEffect(() => {
    const ne = form.email.trim().toLowerCase();
    if (!ne || !/\S+@\S+\.\S+/.test(ne)) {
      setEmailError("");
      return;
    }
    const handle = setTimeout(async () => {
      const available = await CheckEmailAvailable(ne);
      if (isMounted.current) {
        setEmailError(available ? "" : t("auth.emailInUse"));
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [form.email, t]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm(p => ({ ...p, [name]: value }));
  };

  const validate = (): string => {
    if (!form.first_name.trim()) return t("auth.enterFirstName");
    if (!form.last_name.trim())  return t("auth.enterLastName");
    if (!form.email.trim())      return t("auth.enterEmailRequired");
    if (!/\S+@\S+\.\S+/.test(form.email)) return t("auth.invalidEmailFormat");
    if (emailError)              return emailError;
    if (!form.password.trim())   return t("auth.enterPasswordRequired");
    const pwErr = validatePasswordAgainstPolicy(form.password, policy);
    if (pwErr) return pwErr;
    return "";
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Fresh server-side availability check at submit time (the debounced
    // check above may not have fired yet, or may be stale).
    const ne = form.email.trim().toLowerCase();
    if (ne && /\S+@\S+\.\S+/.test(ne)) {
      const available = await CheckEmailAvailable(ne);
      if (!available) {
        setEmailError(t("auth.emailInUse"));
        message.error(t("auth.emailInUse"));
        return;
      }
    }

    const err = validate();
    if (err) { message.error(err); return; }

    const payload = {
      email:        form.email.trim(),
      password:     form.password,
      first_name:   form.first_name.trim(),
      last_name:    form.last_name.trim(),
      phone_number: "",
      location:     "",
      position:     "",
    };

    try {
      setSubmitting(true);

      if (!svcSettings.register_otp) {
        await DirectSignUp(payload);
        message.success(t("auth.registerSuccess"));
        navigate("/login", { replace: true });
        return;
      }

      const result = await SendOTPForSignUp({ email: payload.email });
      if (!result)       { message.error(t("auth.otpSendFailed")); return; }
      if (result.error)  { message.error(result.error);             return; }

      message.success(result.message || t("auth.otpSentVerifyEmail"));
      navigate("/register-otp", { state: payload });
    } catch (err: any) {
      message.error(
        err?.response?.data?.error || err?.message || t("auth.registerFailed")
      );
    } finally {
      if (isMounted.current) setSubmitting(false);
    }
  };

  return (
    <AuthLayout variant="register">
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
        {t("auth.registerSubtitle")}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* First + Last name */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1.5">
              {t("auth.firstName")}
            </label>
            <input
              type="text"
              name="first_name"
              value={form.first_name}
              onChange={handleChange}
              placeholder={t("auth.firstName")}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1.5">
              {t("auth.lastName")}
            </label>
            <input
              type="text"
              name="last_name"
              value={form.last_name}
              onChange={handleChange}
              placeholder={t("auth.lastName")}
              className={inputCls}
            />
          </div>
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-1.5">
            {t("auth.emailAddress")}
          </label>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder={t("auth.enterEmail")}
            autoComplete="email"
            className={inputCls}
          />
          {emailError && (
            <p className="mt-1 text-xs text-red-500">{emailError}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-1.5">
            {t("auth.password")}
          </label>
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              name="password"
              value={form.password}
              onChange={handleChange}
              onFocus={() => setPwFocused(true)}
              onBlur={() => setPwFocused(false)}
              placeholder={t("auth.enterPassword")}
              autoComplete="new-password"
              className={inputCls}
            />
            <button
              type="button"
              onClick={() => setShowPw(p => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
              aria-label={showPw ? t("auth.hidePassword") : t("auth.showPassword")}
            >
              {showPw ? <FiEyeOff size={16} /> : <FiEye size={16} />}
            </button>
            <PasswordPolicyDropdown policy={policy} password={form.password} open={pwFocused} />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting || !!emailError}
          style={{ backgroundColor: submitting || emailError ? undefined : "#1A97F5" }}
          className="w-full text-white font-semibold py-3 text-sm transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-400 mt-1"
        >
          {submitting
            ? svcSettings.register_otp ? t("auth.sendingOtp") : t("auth.creatingAccount")
            : t("auth.register")}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-6">
        {t("auth.alreadyHaveAccount")}{" "}
        <Link to="/login" style={{ color: "#1A97F5" }} className="hover:opacity-80 font-medium transition-opacity">
          {t("auth.signIn")}
        </Link>
      </p>
    </AuthLayout>
  );
};

export default RegisterPage;
