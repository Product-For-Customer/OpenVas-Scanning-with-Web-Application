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
import ModalOTPSignUp from "../../../Model/ModalOTPSignUp";
import AuthLayout from "../_shared/AuthLayout";

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
  const isMounted        = useRef(true);

  const [svcSettings, setSvcSettings] = useState<ServiceSettings>({
    login_otp: false, register_otp: false, reset_otp: false,
  });
  const [policy,     setPolicy]     = useState<PasswordPolicy | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPw,     setShowPw]     = useState(false);
  const [otpOpen,    setOtpOpen]    = useState(false);
  const [emailError, setEmailError] = useState("");

  const [form, setForm] = useState<FormData>({
    first_name: "", last_name: "", email: "", password: "",
  });

  const [pending, setPending] = useState({
    first_name: "", last_name: "", email: "", password: "",
    phone_number: "", location: "", position: "",
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
    return existingEmails.includes(ne) ? "อีเมลนี้ถูกใช้งานแล้ว" : "";
  }, [form.email, existingEmails]);

  useEffect(() => { setEmailError(computedEmailError); }, [computedEmailError]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm(p => ({ ...p, [name]: value }));
  };

  const validate = (): string => {
    if (!form.first_name.trim()) return "กรุณากรอก First Name";
    if (!form.last_name.trim())  return "กรุณากรอก Last Name";
    if (!form.email.trim())      return "กรุณากรอก Email";
    if (!/\S+@\S+\.\S+/.test(form.email)) return "รูปแบบ Email ไม่ถูกต้อง";
    if (computedEmailError)      return computedEmailError;
    if (!form.password.trim())   return "กรุณากรอก Password";
    const pwErr = validatePasswordAgainstPolicy(form.password, policy);
    if (pwErr) return pwErr;
    return "";
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const latestEmails = await loadEmails(true);
    const ne           = form.email.trim().toLowerCase();
    if (latestEmails.includes(ne)) {
      setEmailError("อีเมลนี้ถูกใช้งานแล้ว");
      message.error("อีเมลนี้ถูกใช้งานแล้ว");
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
        message.success("สมัครสมาชิกสำเร็จ");
        navigate("/login", { replace: true });
        return;
      }

      const result = await SendOTPForSignUp({ email: payload.email });
      if (!result)       { message.error("ไม่สามารถส่ง OTP ได้"); return; }
      if (result.error)  { message.error(result.error);             return; }

      setPending(payload);
      setOtpOpen(true);
      message.success(result.message || "ส่ง OTP สำเร็จ กรุณายืนยันอีเมล");
    } catch (err: any) {
      message.error(
        err?.response?.data?.error || err?.message || "เกิดข้อผิดพลาดในการสมัครสมาชิก"
      );
    } finally {
      if (isMounted.current) setSubmitting(false);
    }
  };

  const handleVerified = () => {
    setOtpOpen(false);
    navigate("/login", { replace: true });
  };

  return (
    <AuthLayout variant="register">
      {/* ── Heading ── */}
      <h2 className="text-[2rem] font-bold text-center text-gray-900 dark:text-white/90 mb-1">
        Argus
      </h2>
      <p className="text-center text-sm text-gray-500 dark:text-white/45 mb-7">
        Register for create an account
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* First + Last name */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold text-gray-800 dark:text-white/80 mb-1.5">
              First Name
            </label>
            <input
              type="text"
              name="first_name"
              value={form.first_name}
              onChange={handleChange}
              placeholder="First Name"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-800 dark:text-white/80 mb-1.5">
              Last Name
            </label>
            <input
              type="text"
              name="last_name"
              value={form.last_name}
              onChange={handleChange}
              placeholder="Last Name"
              className={inputCls}
            />
          </div>
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-semibold text-gray-800 dark:text-white/80 mb-1.5">
            Email Address
          </label>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder="Enter Your Email"
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
            Password
          </label>
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Enter Password"
              className={inputCls}
            />
            <button
              type="button"
              onClick={() => setShowPw(p => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/35 hover:text-gray-600 dark:hover:text-white/60 transition"
              aria-label={showPw ? "Hide" : "Show"}
            >
              {showPw ? <FiEyeOff size={16} /> : <FiEye size={16} />}
            </button>
          </div>
          {policy && (
            <p className="mt-1 text-xs text-gray-400 dark:text-white/30">
              At least {policy.min_length ?? 8} characters
              {policy.require_uppercase ? ", uppercase" : ""}
              {policy.require_number    ? ", number"    : ""}
              {policy.require_special   ? ", special character" : ""}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting || !!emailError}
          style={{ backgroundColor: submitting || emailError ? undefined : currentColor }}
          className="w-full text-white font-semibold py-3 text-sm transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-400 mt-1"
        >
          {submitting
            ? svcSettings.register_otp ? "Sending OTP..." : "Creating Account..."
            : "Register"}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 dark:text-white/40 mt-6">
        Already have an account?{" "}
        <Link to="/login" style={{ color: currentColor }} className="hover:opacity-80 font-medium transition-opacity">
          Sign In
        </Link>
      </p>

      <ModalOTPSignUp
        open={otpOpen}
        onClose={() => setOtpOpen(false)}
        signupData={pending}
        onVerified={handleVerified}
      />
    </AuthLayout>
  );
};

export default RegisterPage;
