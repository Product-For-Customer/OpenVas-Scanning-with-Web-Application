import React, { useMemo, useState } from "react";
import { message } from "antd";
import { useNavigate } from "react-router-dom";
import {
  FiEye,
  FiEyeOff,
  FiMail,
  FiLock,
  FiUser,
  FiPhone,
  FiMapPin,
  FiBriefcase,
  FiKey,
  FiRefreshCw,
  FiShield,
  FiWifi,
  FiServer,
  FiActivity,
  FiCpu,
  FiRadio,
} from "react-icons/fi";
import { FaNetworkWired } from "react-icons/fa";
import { IoAirplane } from "react-icons/io5";
import { Login } from "../../../services/auth";
import {
  SendOTPForSignUp,
  CheckUserEmail,
  SendOTP,
} from "../../../services";
import { useAuth } from "../../../contexts/AuthContext";
import ModalOTPSignUp from "../../../Model/ModalOTPSignUp";
import ModalOTP from "../../../Model/ModalOTP";
import travelPhoto from "../../../assets/login-photo.jpg";

type SignUpFormData = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  location: string;
  position: string;
};

type ViewMode = "login" | "signup" | "forgot" | "reset";

const ANIM_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const ANIM_DURATION = "900ms";

const Index: React.FC = () => {
  const navigate = useNavigate();
  const { refreshMe } = useAuth();

  const [viewMode, setViewMode] = useState<ViewMode>("login");

  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showConfirmResetPassword, setShowConfirmResetPassword] =
    useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [loginError, setLoginError] = useState("");

  const [forgotEmail, setForgotEmail] = useState("");
  const [verifiedResetEmail, setVerifiedResetEmail] = useState("");
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotError, setForgotError] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetError, setResetError] = useState("");
  const [openResetOTPModal, setOpenResetOTPModal] = useState(false);

  const [signupSubmitting, setSignupSubmitting] = useState(false);
  const [otpOpen, setOtpOpen] = useState(false);

  const [pendingSignupData, setPendingSignupData] = useState<SignUpFormData>({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    phone_number: "",
    location: "",
    position: "",
  });

  const [signupForm, setSignupForm] = useState<SignUpFormData>({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    phone_number: "",
    location: "",
    position: "",
  });

  const isSignUp = viewMode === "signup";

  const inputBase =
    "h-[46px] w-full rounded-2xl border border-[#c7dcff] bg-white/92 pl-11 pr-4 text-[14px] text-slate-700 outline-none transition-all duration-300 placeholder:text-slate-400 focus:border-[#34b8ff] focus:bg-white focus:ring-4 focus:ring-[#34b8ff]/10 shadow-[0_8px_24px_rgba(15,23,42,0.04)]";

  const labelBase =
    "mb-1.5 block pl-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#3d8ee7]";

  const panelTitleClass =
    "bg-[linear-gradient(90deg,#2f80ed_0%,#56ccf2_100%)] bg-clip-text text-transparent font-extrabold leading-none";

  const resetSignUpForm = () => {
    setSignupForm({
      email: "",
      password: "",
      first_name: "",
      last_name: "",
      phone_number: "",
      location: "",
      position: "",
    });
    setPendingSignupData({
      email: "",
      password: "",
      first_name: "",
      last_name: "",
      phone_number: "",
      location: "",
      position: "",
    });
    setShowSignUpPassword(false);
  };

  const resetForgotAndResetState = () => {
    setForgotError("");
    setForgotSubmitting(false);
    setResetError("");
    setResetSubmitting(false);
    setShowResetPassword(false);
    setShowConfirmResetPassword(false);
    setNewPassword("");
    setConfirmPassword("");
    setOpenResetOTPModal(false);
  };

  const validateEmailOnly = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return "กรุณากรอกอีเมล";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) return "รูปแบบอีเมลไม่ถูกต้อง";
    return "";
  };

  const passwordStrength = useMemo(() => {
    let score = 0;

    if (newPassword.length >= 8) score += 25;
    if (/[A-Z]/.test(newPassword)) score += 20;
    if (/[a-z]/.test(newPassword)) score += 20;
    if (/[0-9]/.test(newPassword)) score += 15;
    if (/[^A-Za-z0-9]/.test(newPassword)) score += 20;

    return Math.min(score, 100);
  }, [newPassword]);

  const passwordStrengthLabel = useMemo(() => {
    if (passwordStrength >= 80) return "Strong";
    if (passwordStrength >= 50) return "Medium";
    if (passwordStrength > 0) return "Weak";
    return "Not set";
  }, [passwordStrength]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");

    if (!loginEmail.trim() || !loginPassword.trim()) {
      setLoginError("กรุณากรอก Email และ Password");
      return;
    }

    try {
      setLoginSubmitting(true);

      const res = await Login({
        email: loginEmail,
        password: loginPassword,
      });

      await refreshMe();

      const role = (res?.user?.role ?? "").toLowerCase();

      if (role === "admin") {
        message.success("login success");
        await new Promise((resolve) => setTimeout(resolve, 1000));
        navigate("/admin", { replace: true });
      } else {
        setLoginError("บัญชีนี้ไม่มีสิทธิ์ Admin");
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        "Login ไม่สำเร็จ กรุณาลองใหม่";
      setLoginError(msg);
    } finally {
      setLoginSubmitting(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError("");

    const emailError = validateEmailOnly(forgotEmail);
    if (emailError) {
      setForgotError(emailError);
      return;
    }

    try {
      setForgotSubmitting(true);

      const res = await CheckUserEmail({ email: forgotEmail.trim() });

      if (!res) {
        setForgotError("ไม่สามารถตรวจสอบอีเมลได้");
        return;
      }

      if (!(res as any).exists) {
        setForgotError((res as any).error || "ไม่พบอีเมลนี้ในระบบ");
        return;
      }

      setVerifiedResetEmail(forgotEmail.trim());
      setResetError("");
      setNewPassword("");
      setConfirmPassword("");
      setViewMode("reset");
    } catch (err: any) {
      console.error("CheckUserEmail error:", err);
      setForgotError(
        err?.response?.data?.error ||
          err?.message ||
          "เกิดข้อผิดพลาดระหว่างตรวจสอบอีเมล"
      );
    } finally {
      setForgotSubmitting(false);
    }
  };

  const validateResetPassword = () => {
    if (!newPassword.trim()) return "กรุณากรอกรหัสผ่านใหม่";
    if (newPassword.length < 8) return "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร";
    if (!/[A-Z]/.test(newPassword))
      return "รหัสผ่านต้องมีตัวพิมพ์ใหญ่อย่างน้อย 1 ตัว";
    if (!/[a-z]/.test(newPassword))
      return "รหัสผ่านต้องมีตัวพิมพ์เล็กอย่างน้อย 1 ตัว";
    if (!/[0-9]/.test(newPassword))
      return "รหัสผ่านต้องมีตัวเลขอย่างน้อย 1 ตัว";
    if (!/[^A-Za-z0-9]/.test(newPassword))
      return "รหัสผ่านต้องมีอักขระพิเศษอย่างน้อย 1 ตัว";
    if (!confirmPassword.trim()) return "กรุณากรอกยืนยันรหัสผ่าน";
    if (newPassword !== confirmPassword)
      return "รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน";
    return "";
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError("");

    const passwordError = validateResetPassword();
    if (passwordError) {
      setResetError(passwordError);
      return;
    }

    try {
      setResetSubmitting(true);

      const sendRes = await SendOTP({
        email: verifiedResetEmail,
      });

      if (!sendRes) {
        setResetError("ส่ง OTP ไม่สำเร็จ");
        return;
      }

      if ((sendRes as any).error) {
        setResetError((sendRes as any).error);
        return;
      }

      message.success((sendRes as any).message || "ส่ง OTP ไปยังอีเมลแล้ว");
      setOpenResetOTPModal(true);
    } catch (err: any) {
      console.error("Send OTP error:", err);
      setResetError(
        err?.response?.data?.error ||
          err?.message ||
          "เกิดข้อผิดพลาดระหว่างส่ง OTP"
      );
    } finally {
      setResetSubmitting(false);
    }
  };

  const handleResetVerified = () => {
    setOpenResetOTPModal(false);
    setVerifiedResetEmail("");
    setForgotEmail("");
    resetForgotAndResetState();
    setViewMode("login");
    message.success("เปลี่ยนรหัสผ่านสำเร็จ");
  };

  const handleSignupChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSignupForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const validateSignUpForm = () => {
    if (!signupForm.first_name.trim()) {
      message.error("กรุณากรอก First Name");
      return false;
    }
    if (!signupForm.last_name.trim()) {
      message.error("กรุณากรอก Last Name");
      return false;
    }
    if (!signupForm.email.trim()) {
      message.error("กรุณากรอก Email");
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(signupForm.email)) {
      message.error("รูปแบบ Email ไม่ถูกต้อง");
      return false;
    }
    if (!signupForm.password.trim()) {
      message.error("กรุณากรอก Password");
      return false;
    }
    if (signupForm.password.length < 8) {
      message.error("Password ต้องมีอย่างน้อย 8 ตัวอักษร");
      return false;
    }
    if (!signupForm.phone_number.trim()) {
      message.error("กรุณากรอก Phone Number");
      return false;
    }
    if (!signupForm.location.trim()) {
      message.error("กรุณากรอก Location");
      return false;
    }
    if (!signupForm.position.trim()) {
      message.error("กรุณากรอก Position");
      return false;
    }

    return true;
  };

  const handleSignUpSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateSignUpForm()) return;

    const payload: SignUpFormData = {
      email: signupForm.email.trim(),
      password: signupForm.password,
      first_name: signupForm.first_name.trim(),
      last_name: signupForm.last_name.trim(),
      phone_number: signupForm.phone_number.trim(),
      location: signupForm.location.trim(),
      position: signupForm.position.trim(),
    };

    try {
      setSignupSubmitting(true);

      const result = await SendOTPForSignUp({
        email: payload.email,
      });

      if (!result) {
        message.error("ไม่สามารถส่ง OTP ได้");
        return;
      }

      if ((result as any).error) {
        message.error((result as any).error);
        return;
      }

      setPendingSignupData(payload);
      setOtpOpen(true);
      message.success((result as any).message || "ส่ง OTP สำเร็จ กรุณายืนยันอีเมล");
    } catch (error: any) {
      console.error("Send OTP error:", error);
      message.error(
        error?.response?.data?.error ||
          error?.message ||
          "เกิดข้อผิดพลาดในการส่ง OTP"
      );
    } finally {
      setSignupSubmitting(false);
    }
  };

  const handleVerified = () => {
    setOtpOpen(false);
    resetSignUpForm();
    setViewMode("login");
    message.success("สมัครสมาชิกสำเร็จ");
  };

  const renderDeviceDecoration = () => (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[96px] overflow-hidden">
      <div className="absolute bottom-4 left-6 flex items-end gap-3 text-[#42bfff]/80">
        <div className="rounded-2xl border border-[#42bfff]/30 bg-white/55 p-2 shadow-[0_8px_30px_rgba(46,144,250,0.14)] backdrop-blur-sm">
          <FaNetworkWired className="text-[22px]" />
        </div>
        <div className="rounded-2xl border border-[#42bfff]/30 bg-white/55 p-2 shadow-[0_8px_30px_rgba(46,144,250,0.14)] backdrop-blur-sm">
          <FiServer className="text-[22px]" />
        </div>
      </div>

      <div className="absolute bottom-4 right-6 flex items-end gap-3 text-[#42bfff]/80">
        <div className="rounded-2xl border border-[#42bfff]/30 bg-white/55 p-2 shadow-[0_8px_30px_rgba(46,144,250,0.14)] backdrop-blur-sm">
          <FiRadio className="text-[22px]" />
        </div>
        <div className="rounded-2xl border border-[#42bfff]/30 bg-white/55 p-2 shadow-[0_8px_30px_rgba(46,144,250,0.14)] backdrop-blur-sm">
          <FiWifi className="text-[22px]" />
        </div>
      </div>

      <svg
        className="absolute bottom-0 left-0 h-[76px] w-[220px]"
        viewBox="0 0 220 76"
        fill="none"
      >
        <path
          d="M8 62H120C146 62 160 49 174 32C184 20 196 12 212 8"
          stroke="url(#leftLine)"
          strokeWidth="2.2"
          strokeDasharray="5 7"
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="leftLine" x1="8" y1="62" x2="212" y2="8">
            <stop stopColor="#56CCF2" stopOpacity="0" />
            <stop offset="0.45" stopColor="#56CCF2" stopOpacity="0.8" />
            <stop offset="1" stopColor="#2F80ED" stopOpacity="1" />
          </linearGradient>
        </defs>
      </svg>

      <svg
        className="absolute bottom-0 right-0 h-[76px] w-[220px]"
        viewBox="0 0 220 76"
        fill="none"
      >
        <path
          d="M212 62H100C74 62 60 49 46 32C36 20 24 12 8 8"
          stroke="url(#rightLine)"
          strokeWidth="2.2"
          strokeDasharray="5 7"
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="rightLine" x1="212" y1="62" x2="8" y2="8">
            <stop stopColor="#56CCF2" stopOpacity="0" />
            <stop offset="0.45" stopColor="#56CCF2" stopOpacity="0.8" />
            <stop offset="1" stopColor="#2F80ED" stopOpacity="1" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );

  const renderPhotoPanel = () => (
    <div className="relative h-full overflow-hidden">
      <img
        src={travelPhoto}
        alt="Network Security"
        className="absolute inset-0 h-full w-full object-cover"
      />

      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,12,24,0.55)_0%,rgba(5,16,33,0.38)_36%,rgba(3,10,22,0.70)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(86,204,242,0.28),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(47,128,237,0.22),transparent_30%)]" />

      <div className="absolute inset-0 opacity-25">
        <div className="h-full w-full bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:28px_28px]" />
      </div>

      <div className="absolute left-0 right-0 top-0 px-8 pt-8 text-white">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-cyan-200/90">
              Network Scan Console
            </p>
            <h1 className="mt-2 text-[40px] font-extrabold leading-none">
              Argus Sentinel
            </h1>
          </div>

          <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-md">
            <div className="flex items-center gap-2 text-[12px] font-medium text-white/90">
              <FiShield className="text-cyan-300" />
              Secure Access
            </div>
          </div>
        </div>

        <p className="mt-6 max-w-[420px] text-[14px] leading-6 text-slate-100/88">
          Centralize your switch, router, wireless and infrastructure visibility
          through a clean access portal for monitoring, reporting and device
          intelligence.
        </p>

        <div className="mt-7 flex flex-wrap gap-3">
          {[
            { icon: <FiServer />, label: "Switch" },
            { icon: <FiCpu />, label: "Router" },
            { icon: <FiWifi />, label: "Wireless" },
            { icon: <FiActivity />, label: "Monitoring" },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 text-[13px] text-white/95 shadow-[0_10px_30px_rgba(15,23,42,0.18)] backdrop-blur-md"
            >
              <span className="text-cyan-300">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute bottom-8 left-8 right-8">
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Devices Online", value: "128", tone: "text-cyan-300" },
            { label: "Scan Coverage", value: "96%", tone: "text-sky-300" },
            { label: "Threat Intel", value: "Live", tone: "text-emerald-300" },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-[22px] border border-white/10 bg-white/8 px-4 py-4 shadow-[0_14px_34px_rgba(2,6,23,0.24)] backdrop-blur-md"
            >
              <p className="text-[11px] uppercase tracking-[0.12em] text-slate-200/70">
                {item.label}
              </p>
              <p className={`mt-2 text-[24px] font-bold ${item.tone}`}>
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderTopWire = () => (
    <div className="pointer-events-none absolute right-8 top-7">
      <div className="relative h-[48px] w-[110px]">
        <IoAirplane className="absolute right-0 top-0 rotate-[18deg] text-[24px] text-[#3ebcff]" />
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 110 48"
          fill="none"
        >
          <path
            d="M6 34C24 16 48 10 76 14C86 16 94 20 102 28"
            stroke="#48c4ff"
            strokeWidth="1.8"
            strokeDasharray="2 6"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );

  const renderSectionBadge = (label: string) => (
    <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#a9dbff] bg-[#eef8ff] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#2f80ed]">
      <FaNetworkWired className="text-[12px]" />
      {label}
    </div>
  );

  const renderLoginForm = () => (
    <div className="w-full max-w-[430px]">
      <div className="text-center">
        {renderSectionBadge("Access Portal")}
        <h2 className={`${panelTitleClass} text-[52px] tracking-[-0.04em]`}>
          Welcome
        </h2>
        <p className="mt-3 text-[14px] text-slate-500">
          Sign in to the network monitoring console
        </p>
      </div>

      {loginError ? (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-600">
          {loginError}
        </div>
      ) : null}

      <form onSubmit={handleLoginSubmit} className="mt-6">
        <div className="space-y-4">
          <div>
            <label className={labelBase}>Email Address</label>
            <div className="relative">
              <FiMail className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[16px] text-[#4d86c7]" />
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="admin@network.local"
                autoComplete="email"
                className={inputBase}
              />
            </div>
          </div>

          <div>
            <label className={labelBase}>Password</label>
            <div className="relative">
              <FiLock className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[16px] text-[#4d86c7]" />
              <input
                type={showLoginPassword ? "text" : "password"}
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Enter secure password"
                autoComplete="current-password"
                className={inputBase}
              />
              <button
                type="button"
                onClick={() => setShowLoginPassword((prev) => !prev)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6d7890] transition hover:text-[#1b9ef0]"
                aria-label={showLoginPassword ? "Hide password" : "Show password"}
              >
                {showLoginPassword ? (
                  <FiEyeOff className="text-[16px]" />
                ) : (
                  <FiEye className="text-[16px]" />
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="rounded-full bg-[#f2f8ff] px-3 py-1.5 text-[11px] font-medium text-slate-500">
            Admin access only
          </div>

          <button
            type="button"
            onClick={() => {
              setForgotError("");
              setForgotEmail(loginEmail.trim());
              setViewMode("forgot");
            }}
            className="text-[12px] font-semibold text-slate-500 transition hover:text-[#1b9ef0]"
          >
            Forgot your password?
          </button>
        </div>

        <div className="mt-7 flex justify-center">
          <button
            type="submit"
            disabled={loginSubmitting}
            className="inline-flex h-[48px] min-w-[170px] items-center justify-center rounded-2xl bg-[linear-gradient(90deg,#2f80ed_0%,#56ccf2_100%)] px-6 text-[14px] font-bold uppercase tracking-[0.08em] text-white shadow-[0_18px_34px_rgba(47,128,237,0.28)] transition-all duration-300 hover:translate-y-[-1px] hover:shadow-[0_20px_36px_rgba(47,128,237,0.34)] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loginSubmitting ? "Logging In..." : "Login"}
          </button>
        </div>

        <div className="mt-7 flex items-center gap-4">
          <div className="h-px flex-1 bg-[#d7e6fb]" />
          <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            OR
          </span>
          <div className="h-px flex-1 bg-[#d7e6fb]" />
        </div>

        <div className="mt-6 text-center text-[14px] text-slate-600">
          Don&apos;t have account?{" "}
          <button
            type="button"
            onClick={() => {
              setLoginError("");
              setViewMode("signup");
            }}
            className="font-extrabold text-slate-900 transition hover:text-[#1b9ef0]"
          >
            Register Now
          </button>
        </div>
      </form>
    </div>
  );

  const renderForgotForm = () => (
    <div className="w-full max-w-[460px]">
      <div className="text-center">
        {renderSectionBadge("Recovery")}
        <h2 className={`${panelTitleClass} text-[44px] tracking-[-0.04em]`}>
          Forgot Password
        </h2>
        <p className="mt-3 text-[14px] leading-6 text-slate-500">
          Verify that your email exists before continuing the password reset
          flow.
        </p>
      </div>

      {forgotError ? (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-600">
          {forgotError}
        </div>
      ) : null}

      <form onSubmit={handleForgotSubmit} className="mt-6">
        <div>
          <label className={labelBase}>Email Address</label>
          <div className="relative">
            <FiMail className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[16px] text-[#4d86c7]" />
            <input
              type="email"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              placeholder="admin@network.local"
              autoComplete="email"
              className={inputBase}
            />
          </div>
        </div>

        <div className="mt-5 rounded-[24px] border border-[#d7ecff] bg-[linear-gradient(180deg,#fafdff_0%,#f3f9ff_100%)] p-4 shadow-[0_12px_30px_rgba(47,128,237,0.08)]">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-2xl bg-[#e9f6ff] p-3 text-[#2f80ed]">
              <FiRefreshCw className="text-[16px]" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-slate-800">
                Secure recovery pipeline
              </p>
              <p className="mt-1.5 text-[13px] leading-6 text-slate-500">
                The system checks your email first, then allows the OTP-based
                reset process to continue safely.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-7 flex justify-center">
          <button
            type="submit"
            disabled={forgotSubmitting}
            className="inline-flex h-[48px] min-w-[190px] items-center justify-center rounded-2xl bg-[linear-gradient(90deg,#2f80ed_0%,#56ccf2_100%)] px-6 text-[14px] font-bold uppercase tracking-[0.08em] text-white shadow-[0_18px_34px_rgba(47,128,237,0.28)] transition-all duration-300 hover:translate-y-[-1px] hover:shadow-[0_20px_36px_rgba(47,128,237,0.34)] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {forgotSubmitting ? "Checking..." : "Continue"}
          </button>
        </div>

        <div className="mt-6 text-center text-[14px] text-slate-600">
          Remember your password?{" "}
          <button
            type="button"
            onClick={() => setViewMode("login")}
            className="font-extrabold text-slate-900 transition hover:text-[#1b9ef0]"
          >
            Sign In
          </button>
        </div>
      </form>
    </div>
  );

  const renderResetForm = () => (
    <div className="w-full max-w-[470px]">
      <div className="text-center">
        {renderSectionBadge("Reset")}
        <h2 className={`${panelTitleClass} text-[44px] tracking-[-0.04em]`}>
          Reset Password
        </h2>
        <p className="mt-3 text-[14px] leading-6 text-slate-500">
          Set a new password for
          <br />
          <span className="font-semibold text-slate-700">
            {verifiedResetEmail || "your account"}
          </span>
        </p>
      </div>

      {resetError ? (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-600">
          {resetError}
        </div>
      ) : null}

      <form onSubmit={handleResetSubmit} className="mt-6 space-y-4">
        <div>
          <label className={labelBase}>New Password</label>
          <div className="relative">
            <FiKey className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[16px] text-[#4d86c7]" />
            <input
              type={showResetPassword ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Set new password"
              className={inputBase}
            />
            <button
              type="button"
              onClick={() => setShowResetPassword((prev) => !prev)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6d7890] transition hover:text-[#1b9ef0]"
              aria-label={
                showResetPassword ? "Hide new password" : "Show new password"
              }
            >
              {showResetPassword ? (
                <FiEyeOff className="text-[16px]" />
              ) : (
                <FiEye className="text-[16px]" />
              )}
            </button>
          </div>
        </div>

        <div>
          <label className={labelBase}>Confirm Password</label>
          <div className="relative">
            <FiLock className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[16px] text-[#4d86c7]" />
            <input
              type={showConfirmResetPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
              className={inputBase}
            />
            <button
              type="button"
              onClick={() => setShowConfirmResetPassword((prev) => !prev)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6d7890] transition hover:text-[#1b9ef0]"
              aria-label={
                showConfirmResetPassword
                  ? "Hide confirm password"
                  : "Show confirm password"
              }
            >
              {showConfirmResetPassword ? (
                <FiEyeOff className="text-[16px]" />
              ) : (
                <FiEye className="text-[16px]" />
              )}
            </button>
          </div>
        </div>

        <div className="rounded-[24px] border border-[#d7ecff] bg-[linear-gradient(180deg,#fafdff_0%,#f3f9ff_100%)] p-4 shadow-[0_12px_30px_rgba(47,128,237,0.08)]">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-2xl bg-[#e9f6ff] p-3 text-[#2f80ed]">
              <FiShield className="text-[16px]" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-slate-800">
                Credential hardening
              </p>
              <p className="mt-1.5 text-[13px] leading-6 text-slate-500">
                Use at least 8 characters with uppercase, lowercase, numbers,
                and symbols for stronger protection.
              </p>

              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-[12px] font-medium text-slate-500">
                    Password strength
                  </span>
                  <span className="text-[12px] font-semibold text-[#2f80ed]">
                    {passwordStrengthLabel}
                  </span>
                </div>

                <div className="h-2.5 overflow-hidden rounded-full bg-[#dfeaf8]">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#22c1f1,#3b82f6,#8b5cf6)] transition-all duration-300"
                    style={{ width: `${passwordStrength}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-center pt-1">
          <button
            type="submit"
            disabled={resetSubmitting}
            className="inline-flex h-[48px] min-w-[220px] items-center justify-center rounded-2xl bg-[linear-gradient(90deg,#2f80ed_0%,#56ccf2_100%)] px-6 text-[14px] font-bold uppercase tracking-[0.08em] text-white shadow-[0_18px_34px_rgba(47,128,237,0.28)] transition-all duration-300 hover:translate-y-[-1px] hover:shadow-[0_20px_36px_rgba(47,128,237,0.34)] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {resetSubmitting ? "Sending OTP..." : "Confirm Reset"}
          </button>
        </div>

        <div className="text-center text-[14px] text-slate-600">
          Back to{" "}
          <button
            type="button"
            onClick={() => setViewMode("login")}
            className="font-extrabold text-slate-900 transition hover:text-[#1b9ef0]"
          >
            Sign In
          </button>
        </div>
      </form>
    </div>
  );

  const renderSignUpForm = () => (
    <div className="w-full max-w-[520px]">
      <div className="text-center">
        {renderSectionBadge("Provisioning")}
        <h2 className={`${panelTitleClass} text-[48px] tracking-[-0.04em]`}>
          Create Account
        </h2>
        <p className="mt-3 text-[14px] text-slate-500">
          Register access for the network scan dashboard
        </p>
      </div>

      <form onSubmit={handleSignUpSubmit} className="mt-6">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className={labelBase}>First Name</label>
              <div className="relative">
                <FiUser className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[16px] text-[#4d86c7]" />
                <input
                  type="text"
                  name="first_name"
                  value={signupForm.first_name}
                  onChange={handleSignupChange}
                  placeholder="Mohammed"
                  className={inputBase}
                />
              </div>
            </div>

            <div>
              <label className={labelBase}>Last Name</label>
              <div className="relative">
                <FiUser className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[16px] text-[#4d86c7]" />
                <input
                  type="text"
                  name="last_name"
                  value={signupForm.last_name}
                  onChange={handleSignupChange}
                  placeholder="Jawed"
                  className={inputBase}
                />
              </div>
            </div>
          </div>

          <div>
            <label className={labelBase}>Email Address</label>
            <div className="relative">
              <FiMail className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[16px] text-[#4d86c7]" />
              <input
                type="email"
                name="email"
                value={signupForm.email}
                onChange={handleSignupChange}
                placeholder="admin@network.local"
                autoComplete="email"
                className={inputBase}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className={labelBase}>Phone Number</label>
              <div className="relative">
                <FiPhone className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[16px] text-[#4d86c7]" />
                <input
                  type="text"
                  name="phone_number"
                  value={signupForm.phone_number}
                  onChange={handleSignupChange}
                  placeholder="0812345678"
                  className={inputBase}
                />
              </div>
            </div>

            <div>
              <label className={labelBase}>Password</label>
              <div className="relative">
                <FiLock className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[16px] text-[#4d86c7]" />
                <input
                  type={showSignUpPassword ? "text" : "password"}
                  name="password"
                  value={signupForm.password}
                  onChange={handleSignupChange}
                  placeholder="At least 8 characters"
                  className={inputBase}
                />
                <button
                  type="button"
                  onClick={() => setShowSignUpPassword((prev) => !prev)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6d7890] transition hover:text-[#1b9ef0]"
                  aria-label={showSignUpPassword ? "Hide password" : "Show password"}
                >
                  {showSignUpPassword ? (
                    <FiEyeOff className="text-[16px]" />
                  ) : (
                    <FiEye className="text-[16px]" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className={labelBase}>Location</label>
              <div className="relative">
                <FiMapPin className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[16px] text-[#4d86c7]" />
                <input
                  type="text"
                  name="location"
                  value={signupForm.location}
                  onChange={handleSignupChange}
                  placeholder="Bangkok"
                  className={inputBase}
                />
              </div>
            </div>

            <div>
              <label className={labelBase}>Position</label>
              <div className="relative">
                <FiBriefcase className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[16px] text-[#4d86c7]" />
                <input
                  type="text"
                  name="position"
                  value={signupForm.position}
                  onChange={handleSignupChange}
                  placeholder="Network Analyst"
                  className={inputBase}
                />
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-[#d7ecff] bg-[linear-gradient(180deg,#fafdff_0%,#f3f9ff_100%)] p-4 shadow-[0_12px_30px_rgba(47,128,237,0.08)]">
            <div className="flex flex-wrap items-center gap-2">
              {[
                { icon: <FiServer />, text: "Switch" },
                { icon: <FiCpu />, text: "Router" },
                { icon: <FiWifi />, text: "Wireless" },
              ].map((item) => (
                <div
                  key={item.text}
                  className="inline-flex items-center gap-2 rounded-full border border-[#cbe7ff] bg-white px-3 py-2 text-[12px] font-semibold text-[#2f80ed]"
                >
                  {item.icon}
                  {item.text}
                </div>
              ))}
            </div>

            <p className="mt-3 text-[13px] leading-6 text-slate-500">
              Create an operator account for monitoring infrastructure,
              reviewing scan reports and managing network visibility.
            </p>
          </div>
        </div>

        <div className="mt-7 flex justify-center">
          <button
            type="submit"
            disabled={signupSubmitting}
            className="inline-flex h-[50px] min-w-[190px] items-center justify-center rounded-2xl bg-[linear-gradient(90deg,#2f80ed_0%,#56ccf2_100%)] px-6 text-[14px] font-bold uppercase tracking-[0.08em] text-white shadow-[0_18px_34px_rgba(47,128,237,0.28)] transition-all duration-300 hover:translate-y-[-1px] hover:shadow-[0_20px_36px_rgba(47,128,237,0.34)] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {signupSubmitting ? "Sending OTP..." : "Sign Up"}
          </button>
        </div>

        <div className="mt-6 text-center text-[14px] text-slate-600">
          Have an account?{" "}
          <button
            type="button"
            onClick={() => setViewMode("login")}
            className="font-extrabold text-slate-900 transition hover:text-[#1b9ef0]"
          >
            Sign In
          </button>
        </div>
      </form>
    </div>
  );

  return (
    <>
      <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#f7fbff_0%,#eef5fb_100%)] px-4 py-6 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-[-140px] top-[-120px] h-[340px] w-[340px] rounded-full bg-cyan-200/30 blur-3xl" />
          <div className="absolute right-[-100px] top-[90px] h-[320px] w-[320px] rounded-full bg-sky-200/30 blur-3xl" />
          <div className="absolute bottom-[-160px] left-[12%] h-[360px] w-[360px] rounded-full bg-blue-200/25 blur-3xl" />
        </div>

        <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-[1440px] items-center justify-center">
          <div className="relative w-full overflow-hidden rounded-[34px] border border-white/70 bg-white/80 shadow-[0_24px_90px_rgba(15,23,42,0.10)] backdrop-blur-xl">
            <div className="hidden xl:block">
              <div className="relative h-[760px] overflow-hidden">
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.55)_0%,rgba(255,255,255,0.76)_100%)]" />

                <div
                  className="absolute left-0 top-0 h-full w-1/2"
                  style={{
                    transition: `transform ${ANIM_DURATION} ${ANIM_EASE}`,
                    transform: isSignUp ? "translateX(0%)" : "translateX(0%)",
                  }}
                >
                  <div className="relative h-full overflow-hidden bg-[linear-gradient(180deg,#fbfeff_0%,#f3f9ff_100%)] px-10 py-10">
                    <div className="absolute inset-0 opacity-40">
                      <div className="h-full w-full bg-[linear-gradient(rgba(47,128,237,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(47,128,237,0.06)_1px,transparent_1px)] bg-[size:26px_26px]" />
                    </div>

                    {renderTopWire()}
                    {renderDeviceDecoration()}

                    <div className="relative flex h-full w-full items-center justify-center">
                      <div
                        className="absolute inset-0 flex items-center justify-center"
                        style={{
                          opacity: viewMode === "login" ? 1 : 0,
                          transform:
                            viewMode === "login"
                              ? "translateX(0px) scale(1)"
                              : "translateX(28px) scale(0.975)",
                          filter:
                            viewMode === "login" ? "blur(0px)" : "blur(4px)",
                          transition: `opacity 620ms ${ANIM_EASE}, transform 760ms ${ANIM_EASE}, filter 760ms ${ANIM_EASE}`,
                          pointerEvents: viewMode === "login" ? "auto" : "none",
                        }}
                      >
                        {renderLoginForm()}
                      </div>

                      <div
                        className="absolute inset-0 flex items-center justify-center"
                        style={{
                          opacity: viewMode === "forgot" ? 1 : 0,
                          transform:
                            viewMode === "forgot"
                              ? "translateX(0px) scale(1)"
                              : "translateX(28px) scale(0.975)",
                          filter:
                            viewMode === "forgot" ? "blur(0px)" : "blur(4px)",
                          transition: `opacity 620ms ${ANIM_EASE}, transform 760ms ${ANIM_EASE}, filter 760ms ${ANIM_EASE}`,
                          pointerEvents: viewMode === "forgot" ? "auto" : "none",
                        }}
                      >
                        {renderForgotForm()}
                      </div>

                      <div
                        className="absolute inset-0 flex items-center justify-center"
                        style={{
                          opacity: viewMode === "reset" ? 1 : 0,
                          transform:
                            viewMode === "reset"
                              ? "translateX(0px) scale(1)"
                              : "translateX(24px) scale(0.975)",
                          filter:
                            viewMode === "reset" ? "blur(0px)" : "blur(4px)",
                          transition: `opacity 620ms ${ANIM_EASE}, transform 760ms ${ANIM_EASE}, filter 760ms ${ANIM_EASE}`,
                          transitionDelay: viewMode === "reset" ? "100ms" : "0ms",
                          pointerEvents: viewMode === "reset" ? "auto" : "none",
                        }}
                      >
                        {renderResetForm()}
                      </div>

                      <div
                        className="absolute inset-0 flex items-center justify-center"
                        style={{
                          opacity: viewMode === "signup" ? 1 : 0,
                          transform:
                            viewMode === "signup"
                              ? "translateX(0px) scale(1)"
                              : "translateX(-28px) scale(0.975)",
                          filter:
                            viewMode === "signup" ? "blur(0px)" : "blur(4px)",
                          transition: `opacity 620ms ${ANIM_EASE}, transform 760ms ${ANIM_EASE}, filter 760ms ${ANIM_EASE}`,
                          transitionDelay: viewMode === "signup" ? "120ms" : "0ms",
                          pointerEvents: viewMode === "signup" ? "auto" : "none",
                        }}
                      >
                        {renderSignUpForm()}
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  className="absolute top-0 h-full w-1/2 overflow-hidden"
                  style={{
                    transform: isSignUp ? "translateX(0%)" : "translateX(100%)",
                    transition: `transform ${ANIM_DURATION} ${ANIM_EASE}`,
                    willChange: "transform",
                    zIndex: 20,
                    right: isSignUp ? "0" : "auto",
                    left: isSignUp ? "auto" : "0",
                  }}
                >
                  <div
                    style={{
                      transform: isSignUp ? "scale(1.03)" : "scale(1)",
                      filter: isSignUp
                        ? "saturate(1.03) brightness(1.01)"
                        : "saturate(1) brightness(1)",
                      transition: `transform ${ANIM_DURATION} ${ANIM_EASE}, filter ${ANIM_DURATION} ${ANIM_EASE}`,
                    }}
                    className="h-full shadow-[0_8px_28px_rgba(15,23,42,0.12)]"
                  >
                    {renderPhotoPanel()}
                  </div>
                </div>
              </div>
            </div>

            <div className="xl:hidden">
              <div className="relative h-[250px] overflow-hidden">
                <img
                  src={travelPhoto}
                  alt="Network Security"
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,12,24,0.56)_0%,rgba(4,12,24,0.60)_100%)]" />
                <div className="absolute inset-0 opacity-20">
                  <div className="h-full w-full bg-[linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:24px_24px]" />
                </div>

                <div className="absolute inset-x-0 top-0 px-5 pt-5 text-white">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200/90">
                        Network Scan Console
                      </p>
                      <h1 className="mt-2 text-[28px] font-extrabold leading-none">
                        Argus Sentinel
                      </h1>
                    </div>

                    <div className="rounded-2xl border border-white/15 bg-white/10 px-3 py-2 backdrop-blur-md">
                      <FiShield className="text-[16px] text-cyan-300" />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {[
                      { icon: <FiServer />, label: "Switch" },
                      { icon: <FiCpu />, label: "Router" },
                      { icon: <FiWifi />, label: "Wireless" },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] text-white/90 backdrop-blur-md"
                      >
                        <span className="text-cyan-300">{item.icon}</span>
                        {item.label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="relative overflow-hidden bg-[linear-gradient(180deg,#fbfeff_0%,#f3f9ff_100%)] px-4 pb-6 pt-6 sm:px-6">
                <div className="absolute inset-0 opacity-40">
                  <div className="h-full w-full bg-[linear-gradient(rgba(47,128,237,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(47,128,237,0.06)_1px,transparent_1px)] bg-[size:24px_24px]" />
                </div>

                {renderTopWire()}
                {renderDeviceDecoration()}

                <div className="mx-auto relative min-h-[560px] w-full max-w-[560px]">
                  <div
                    className="absolute inset-0"
                    style={{
                      opacity: viewMode === "login" ? 1 : 0,
                      transform:
                        viewMode === "login"
                          ? "translateX(0px) scale(1)"
                          : "translateX(18px) scale(0.975)",
                      filter: viewMode === "login" ? "blur(0px)" : "blur(3px)",
                      transition: `opacity 600ms ${ANIM_EASE}, transform 760ms ${ANIM_EASE}, filter 760ms ${ANIM_EASE}`,
                      pointerEvents: viewMode === "login" ? "auto" : "none",
                    }}
                  >
                    {renderLoginForm()}
                  </div>

                  <div
                    className="absolute inset-0"
                    style={{
                      opacity: viewMode === "forgot" ? 1 : 0,
                      transform:
                        viewMode === "forgot"
                          ? "translateX(0px) scale(1)"
                          : "translateX(18px) scale(0.975)",
                      filter: viewMode === "forgot" ? "blur(0px)" : "blur(3px)",
                      transition: `opacity 600ms ${ANIM_EASE}, transform 760ms ${ANIM_EASE}, filter 760ms ${ANIM_EASE}`,
                      pointerEvents: viewMode === "forgot" ? "auto" : "none",
                    }}
                  >
                    {renderForgotForm()}
                  </div>

                  <div
                    className="absolute inset-0"
                    style={{
                      opacity: viewMode === "reset" ? 1 : 0,
                      transform:
                        viewMode === "reset"
                          ? "translateX(0px) scale(1)"
                          : "translateX(18px) scale(0.975)",
                      filter: viewMode === "reset" ? "blur(0px)" : "blur(3px)",
                      transition: `opacity 600ms ${ANIM_EASE}, transform 760ms ${ANIM_EASE}, filter 760ms ${ANIM_EASE}`,
                      transitionDelay: viewMode === "reset" ? "100ms" : "0ms",
                      pointerEvents: viewMode === "reset" ? "auto" : "none",
                    }}
                  >
                    {renderResetForm()}
                  </div>

                  <div
                    className="absolute inset-0"
                    style={{
                      opacity: viewMode === "signup" ? 1 : 0,
                      transform:
                        viewMode === "signup"
                          ? "translateX(0px) scale(1)"
                          : "translateX(-18px) scale(0.975)",
                      filter: viewMode === "signup" ? "blur(0px)" : "blur(3px)",
                      transition: `opacity 600ms ${ANIM_EASE}, transform 760ms ${ANIM_EASE}, filter 760ms ${ANIM_EASE}`,
                      transitionDelay: viewMode === "signup" ? "120ms" : "0ms",
                      pointerEvents: viewMode === "signup" ? "auto" : "none",
                    }}
                  >
                    {renderSignUpForm()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ModalOTPSignUp
        open={otpOpen}
        signupData={pendingSignupData}
        onClose={() => setOtpOpen(false)}
        onVerified={handleVerified}
      />

      <ModalOTP
        open={openResetOTPModal}
        email={verifiedResetEmail}
        newPassword={newPassword}
        onClose={() => setOpenResetOTPModal(false)}
        onVerified={handleResetVerified}
      />
    </>
  );
};

export default Index;