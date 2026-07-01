import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { message } from "antd";
import { useNavigate, Link } from "react-router-dom";
import { FiEye, FiEyeOff } from "react-icons/fi";
import {
  GetServiceSettings,
  DirectSignUp,
  SendOTPForSignUp,
  ListEmailAndPhoneNumber,
  type ServiceSettings,
} from "../../../services/auth";
import {
  GetPasswordPolicy,
  validatePasswordAgainstPolicy,
  type PasswordPolicy,
} from "../../../services/passwordpolicy";
import { useStateContext } from "../../../contexts/ProviderContext";
import { useLanguage } from "../../../contexts/LanguageContext";
import AuthLayout from "../_shared/AuthLayout";
import PasswordPolicyDropdown from "../_shared/PasswordPolicyDropdown";

type FormData = {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
};

const inputCls = [
  "w-full border px-4 py-2.5 text-sm outline-none transition",
  "border-gray-300 dark:border-white/10",
  "bg-white dark:bg-white/5",
  "text-gray-800 dark:text-white/85",
  "placeholder:text-gray-400 dark:placeholder:text-white/25",
  "focus:border-gray-500 dark:focus:border-white/30",
  "focus:ring-2 focus:ring-gray-100 dark:focus:ring-white/5",
].join(" ");

const RegisterPage: React.FC = () => {
  const navigate         = useNavigate();
  const { currentColor } = useStateContext();
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

  const [existingEmails, setExistingEmails] = useState<string[]>([]);
  const emailsRef     = useRef<string[]>([]);
  const hasFetchedRef = useRef(false);
  const isFetchingRef = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    GetPasswordPolicy().then(setPolicy).catch(() => {});
    GetServiceSettings()
      .then(s => { if (isMounted.current) setSvcSettings(s); })
      .catch(() => {});
    return () => { isMounted.current = false; };
  }, []);

  const loadEmails = useCallback(async (force = false): Promise<string[]> => {
    if (isFetchingRef.current)                 return emailsRef.current;
    if (!force && hasFetchedRef.current)        return emailsRef.current;
    try {
      isFetchingRef.current = true;
      const data   = await ListEmailAndPhoneNumber();
      const arr    = Array.isArray(data) ? data : [];
      const emails = arr.map((i: any) => (i.email ?? "").trim().toLowerCase());
      emailsRef.current = emails;
      if (isMounted.current) setExistingEmails(emails);
      hasFetchedRef.current = true;
      return emails;
    } catch {
      return emailsRef.current;
    } finally {
      isFetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!hasFetchedRef.current) void loadEmails();
  }, [loadEmails]);

  const computedEmailError = useMemo(() => {
    const ne = form.email.trim().toLowerCase();
    if (!ne) return "";
    return existingEmails.includes(ne) ? t("auth.emailInUse") : "";
  }, [form.email, existingEmails, t]);

  useEffect(() => { setEmailError(computedEmailError); }, [computedEmailError]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm(p => ({ ...p, [name]: value }));
  };

  const validate = (): string => {
    if (!form.first_name.trim()) return t("auth.enterFirstName");
    if (!form.last_name.trim())  return t("auth.enterLastName");
    if (!form.email.trim())      return t("auth.enterEmailRequired");
    if (!/\S+@\S+\.\S+/.test(form.email)) return t("auth.invalidEmailFormat");
    if (computedEmailError)      return computedEmailError;
    if (!form.password.trim())   return t("auth.enterPasswordRequired");
    const pwErr = validatePasswordAgainstPolicy(form.password, policy);
    if (pwErr) return pwErr;
    return "";
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const latestEmails = await loadEmails(true);
    const ne           = form.email.trim().toLowerCase();
    if (latestEmails.includes(ne)) {
      setEmailError(t("auth.emailInUse"));
      message.error(t("auth.emailInUse"));
      return;
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
      <h2 className="text-[2rem] font-bold text-center text-gray-900 dark:text-white/90 mb-1">
        Argus
      </h2>
      <p className="text-center text-sm text-gray-500 dark:text-white/45 mb-7">
        {t("auth.registerSubtitle")}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* First + Last name */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold text-gray-800 dark:text-white/80 mb-1.5">
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
            <label className="block text-sm font-semibold text-gray-800 dark:text-white/80 mb-1.5">
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
          <label className="block text-sm font-semibold text-gray-800 dark:text-white/80 mb-1.5">
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
            <p className="mt-1 text-xs text-red-500 dark:text-red-400">{emailError}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-semibold text-gray-800 dark:text-white/80 mb-1.5">
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
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/35 hover:text-gray-600 dark:hover:text-white/60 transition"
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
          style={{ backgroundColor: submitting || emailError ? undefined : currentColor }}
          className="w-full text-white font-semibold py-3 text-sm transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-400 mt-1"
        >
          {submitting
            ? svcSettings.register_otp ? t("auth.sendingOtp") : t("auth.creatingAccount")
            : t("auth.register")}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 dark:text-white/40 mt-6">
        {t("auth.alreadyHaveAccount")}{" "}
        <Link to="/login" style={{ color: currentColor }} className="hover:opacity-80 font-medium transition-opacity">
          {t("auth.signIn")}
        </Link>
      </p>
    </AuthLayout>
  );
};

export default RegisterPage;
