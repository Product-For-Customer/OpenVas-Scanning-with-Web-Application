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
import { useStateContext } from "../../../contexts/ProviderContext";
import ModalOTP from "../../../Model/ModalOTP";
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

const ResetPasswordPage: React.FC = () => {
  const navigate         = useNavigate();
  const location         = useLocation();
  const { currentColor } = useStateContext();
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
  const [error,           setError]           = useState("");
  const [submitting,      setSubmitting]      = useState(false);
  const [otpOpen,         setOtpOpen]         = useState(false);

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

  const strengthLabel = strength >= 80 ? "Strong" : strength >= 50 ? "Medium" : strength > 0 ? "Weak" : "";
  const strengthColor = strength >= 80 ? "#22c55e" : strength >= 50 ? "#f59e0b" : "#ef4444";

  const validate = (): string => {
    if (!newPassword.trim()) return "กรุณากรอกรหัสผ่านใหม่";
    const minLen = policy?.min_length ?? 8;
    if (newPassword.length < minLen)
      return `รหัสผ่านต้องมีอย่างน้อย ${minLen} ตัวอักษร`;
    if ((policy?.require_uppercase ?? false) && !/[A-Z]/.test(newPassword))
      return "รหัสผ่านต้องมีตัวพิมพ์ใหญ่อย่างน้อย 1 ตัว";
    if ((policy?.require_number    ?? false) && !/[0-9]/.test(newPassword))
      return "รหัสผ่านต้องมีตัวเลขอย่างน้อย 1 ตัว";
    if ((policy?.require_special   ?? false) && !/[^A-Za-z0-9]/.test(newPassword))
      return "รหัสผ่านต้องมีอักขระพิเศษอย่างน้อย 1 ตัว";
    if (!confirmPassword.trim()) return "กรุณากรอกยืนยันรหัสผ่าน";
    if (newPassword !== confirmPassword) return "รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน";
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
        message.success("เปลี่ยนรหัสผ่านสำเร็จ");
        navigate("/login", { replace: true });
        return;
      }

      const sendRes = await SendOTP({ email });
      if (!sendRes)       { setError("ส่ง OTP ไม่สำเร็จ"); return; }
      if (sendRes.error)  { setError(sendRes.error);        return; }
      message.success(sendRes.message || "ส่ง OTP ไปยังอีเมลแล้ว");
      setOtpOpen(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "เกิดข้อผิดพลาดระหว่างส่ง OTP");
    } finally {
      if (isMounted.current) setSubmitting(false);
    }
  };

  const handleOtpVerified = () => {
    setOtpOpen(false);
    message.success("เปลี่ยนรหัสผ่านสำเร็จ");
    navigate("/login", { replace: true });
  };

  return (
    <AuthLayout variant="login">
      <h2 className="text-[2rem] font-bold text-center text-gray-900 dark:text-white/90 mb-2">
        Reset Password
      </h2>
      <p className="text-center text-sm text-gray-500 dark:text-white/45 mb-7">
        Set a new password for{" "}
        <span className="font-semibold text-gray-700 dark:text-white/70">{email || "your account"}</span>
      </p>

      {error && (
        <div className="mb-4 border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-800 dark:text-white/80 mb-1.5">
            New Password
          </label>
          <div className="relative">
            <input
              type={showNew ? "text" : "password"}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              className={inputCls}
            />
            <button
              type="button"
              onClick={() => setShowNew(p => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/35 hover:text-gray-600 dark:hover:text-white/60 transition"
            >
              {showNew ? <FiEyeOff size={16} /> : <FiEye size={16} />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-800 dark:text-white/80 mb-1.5">
            Confirm Password
          </label>
          <div className="relative">
            <input
              type={showConfirm ? "text" : "password"}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
              className={inputCls}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(p => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/35 hover:text-gray-600 dark:hover:text-white/60 transition"
            >
              {showConfirm ? <FiEyeOff size={16} /> : <FiEye size={16} />}
            </button>
          </div>
        </div>

        {/* Strength bar */}
        {newPassword && (
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-500 dark:text-white/40">Password strength</span>
              <span className="font-semibold" style={{ color: strengthColor }}>{strengthLabel}</span>
            </div>
            <div className="h-1.5 bg-gray-200 dark:bg-white/10 overflow-hidden">
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
          style={{ backgroundColor: submitting ? undefined : currentColor }}
          className="w-full text-white font-semibold py-3 text-sm transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {submitting
            ? svcSettings.reset_otp ? "Sending OTP..." : "Resetting..."
            : "Confirm Reset"}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 dark:text-white/40 mt-5">
        Back to{" "}
        <Link to="/login" style={{ color: currentColor }} className="hover:opacity-80 font-medium transition-opacity">
          Sign In
        </Link>
      </p>

      <ModalOTP
        open={otpOpen}
        onClose={() => setOtpOpen(false)}
        email={email}
        newPassword={newPassword}
        onVerified={handleOtpVerified}
      />
    </AuthLayout>
  );
};

export default ResetPasswordPage;
