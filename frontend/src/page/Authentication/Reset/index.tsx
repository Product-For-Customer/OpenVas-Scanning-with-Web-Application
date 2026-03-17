import React, { useEffect, useMemo, useState } from "react";
import {
  FiShield,
  FiLock,
  FiEye,
  FiEyeOff,
  FiArrowRight,
  FiArrowLeft,
  FiCheckCircle,
  FiRefreshCw,
  FiKey,
  FiMail,
} from "react-icons/fi";
import { useLocation, useNavigate } from "react-router-dom";
import { message } from "antd";
import { SendOTP } from "../../../services";
import ModalOTP from "../../../Model/ModalOTP";

type ResetPageState = {
  email?: string;
  verifiedEmail?: boolean;
};

const Index: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const routeState = (location.state || {}) as ResetPageState;
  const emailFromPreviousPage = routeState?.email ?? "";
  const verifiedEmail = routeState?.verifiedEmail === true;

  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const [sendingOTP, setSendingOTP] = useState(false);
  const [openOTPModal, setOpenOTPModal] = useState(false);

  const allowResetSection =
    verifiedEmail && emailFromPreviousPage.trim() !== "";

  useEffect(() => {
    if (!allowResetSection) {
      navigate("/", { replace: true });
    }
  }, [allowResetSection, navigate]);

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

  const inputClass = [
    "w-full h-10.5 sm:h-11 rounded-xl border pl-9.5 pr-10.5 text-[13px] outline-none transition-all duration-200",
    "border-slate-200 bg-[#f5f8ff] text-slate-800 placeholder:text-slate-400",
    "focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100/80",
    "dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-white/30",
    "dark:focus:border-cyan-400/30 dark:focus:ring-cyan-500/10",
  ].join(" ");

  const validatePassword = () => {
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

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const passwordError = validatePassword();
    if (passwordError) {
      setError(passwordError);
      return;
    }

    try {
      setSendingOTP(true);

      const sendRes = await SendOTP({
        email: emailFromPreviousPage,
      });

      if (!sendRes) {
        setError("ส่ง OTP ไม่สำเร็จ");
        return;
      }

      if (sendRes.error) {
        setError(sendRes.error);
        return;
      }

      message.success(sendRes.message || "ส่ง OTP ไปยังอีเมลแล้ว");
      setOpenOTPModal(true);
    } catch (err: any) {
      console.error("Send OTP error:", err);
      setError(
        err?.response?.data?.error ||
          err?.message ||
          "เกิดข้อผิดพลาดระหว่างส่ง OTP"
      );
    } finally {
      setSendingOTP(false);
    }
  };

  const handleOTPVerified = () => {
    setOpenOTPModal(false);
    navigate("/", { replace: true });
  };

  if (!allowResetSection) {
    return null;
  }

  return (
    <>
      <div className="min-h-screen w-full bg-[#f5f7fc] dark:bg-[#07101b]">
        <div className="mx-auto min-h-screen w-full px-0 py-0 sm:px-2 sm:py-2 md:px-3 md:py-3 lg:px-4 lg:py-4 xl:px-5 xl:py-5 2xl:px-6 2xl:py-6">
          <div
            className={[
              "w-full overflow-hidden",
              "min-h-screen sm:min-h-[calc(100vh-16px)] md:min-h-[calc(100vh-24px)] lg:min-h-[calc(100vh-32px)] xl:min-h-[calc(100vh-40px)] 2xl:min-h-[calc(100vh-48px)]",
              "rounded-none sm:rounded-3xl",
              "border border-slate-200/80 bg-[#fbfcff]",
              "shadow-none sm:shadow-[0_14px_40px_rgba(15,23,42,0.055)]",
              "dark:bg-[#08111f] dark:border-white/10 dark:shadow-none",
            ].join(" ")}
          >
            <div className="grid min-h-full w-full grid-cols-1 xl:grid-cols-[minmax(0,1.02fr)_minmax(370px,455px)] 2xl:grid-cols-[minmax(0,1.05fr)_minmax(390px,475px)]">
              {/* LEFT SIDE */}
              <section className="relative hidden xl:flex min-h-full items-center justify-center px-6 py-7 2xl:px-8 2xl:py-9">
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                  <div className="absolute left-[14%] top-[10%] h-30 w-30 rounded-full bg-cyan-400/10 blur-3xl 2xl:h-38 2xl:w-38" />
                  <div className="absolute right-[10%] top-[20%] h-34 w-34 rounded-full bg-violet-500/10 blur-3xl 2xl:h-42 2xl:w-42" />
                  <div className="absolute bottom-[10%] left-[25%] h-30 w-30 rounded-full bg-sky-500/10 blur-3xl 2xl:h-36 2xl:w-36" />
                </div>

                <div className="relative z-10 flex w-full max-w-162.5 flex-col items-center text-center 2xl:max-w-182.5">
                  <div
                    className={[
                      "mb-4 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5",
                      "bg-cyan-50 text-cyan-700 border border-cyan-200/80",
                      "dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-400/20",
                    ].join(" ")}
                  >
                    <FiShield className="text-[12px]" />
                    <span className="text-[11.5px] font-semibold tracking-wide 2xl:text-[12.5px]">
                      Secure Credential Reset
                    </span>
                  </div>

                  <div className="w-full max-w-113.75 2xl:max-w-131.25">
                    <svg
                      viewBox="0 0 760 520"
                      className="w-full h-auto"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-label="reset password network illustration"
                    >
                      <defs>
                        <linearGradient
                          id="resetMainStroke"
                          x1="0"
                          y1="0"
                          x2="1"
                          y2="1"
                        >
                          <stop offset="0%" stopColor="#22d3ee" />
                          <stop offset="50%" stopColor="#38bdf8" />
                          <stop offset="100%" stopColor="#8b5cf6" />
                        </linearGradient>

                        <linearGradient
                          id="resetPanelGlow"
                          x1="0"
                          y1="0"
                          x2="1"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#0ea5e9"
                            stopOpacity="0.14"
                          />
                          <stop
                            offset="100%"
                            stopColor="#8b5cf6"
                            stopOpacity="0.16"
                          />
                        </linearGradient>

                        <radialGradient
                          id="resetCoreGlow"
                          cx="50%"
                          cy="50%"
                          r="50%"
                        >
                          <stop
                            offset="0%"
                            stopColor="#22d3ee"
                            stopOpacity="0.22"
                          />
                          <stop
                            offset="100%"
                            stopColor="#22d3ee"
                            stopOpacity="0"
                          />
                        </radialGradient>
                      </defs>

                      <rect
                        x="148"
                        y="98"
                        width="464"
                        height="274"
                        rx="34"
                        fill="url(#resetPanelGlow)"
                        stroke="url(#resetMainStroke)"
                        strokeOpacity="0.3"
                        strokeWidth="1.6"
                      />

                      <rect
                        x="292"
                        y="148"
                        width="176"
                        height="120"
                        rx="24"
                        fill="#ffffff"
                        stroke="#D6E4F0"
                      />
                      <rect
                        x="292"
                        y="148"
                        width="176"
                        height="24"
                        rx="24"
                        fill="#EEF6FF"
                      />
                      <circle cx="311" cy="160" r="3.5" fill="#22d3ee" />
                      <circle cx="324" cy="160" r="3.5" fill="#60a5fa" />
                      <circle cx="337" cy="160" r="3.5" fill="#8b5cf6" />

                      <circle
                        cx="380"
                        cy="220"
                        r="46"
                        fill="url(#resetCoreGlow)"
                      />
                      <circle
                        cx="380"
                        cy="220"
                        r="32"
                        stroke="#22d3ee"
                        strokeOpacity="0.82"
                        strokeWidth="2.2"
                      />
                      <circle
                        cx="380"
                        cy="220"
                        r="18"
                        stroke="#38bdf8"
                        strokeOpacity="0.68"
                        strokeWidth="1.8"
                      />
                      <circle cx="380" cy="220" r="5.5" fill="#22d3ee" />

                      <circle
                        cx="380"
                        cy="220"
                        r="13"
                        fill="#0ea5e9"
                        fillOpacity="0.1"
                        stroke="#22d3ee"
                        strokeWidth="1.8"
                      />
                      <path
                        d="M380 214.5C382.5 214.5 384.5 216.5 384.5 219C384.5 221.5 382.5 223.5 380 223.5C377.5 223.5 375.5 221.5 375.5 219C375.5 216.5 377.5 214.5 380 214.5Z"
                        stroke="#22d3ee"
                        strokeWidth="1.8"
                      />
                      <path
                        d="M384 219H390L392 217V221L394 219V223"
                        stroke="#22d3ee"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      <path
                        d="M380 46L414 62V94C414 120 397 137 380 144C363 137 346 120 346 94V62L380 46Z"
                        fill="#0ea5e9"
                        fillOpacity="0.12"
                        stroke="#22d3ee"
                        strokeWidth="2"
                      />
                      <path
                        d="M368 95L377 104L394 85"
                        stroke="#22d3ee"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      <path
                        d="M380 148V144"
                        stroke="url(#resetMainStroke)"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />

                      <rect
                        x="176"
                        y="154"
                        width="104"
                        height="74"
                        rx="20"
                        fill="#ffffff"
                        stroke="#D6E4F0"
                      />
                      <rect
                        x="195"
                        y="177"
                        width="42"
                        height="8"
                        rx="4"
                        fill="#22d3ee"
                      />
                      <rect
                        x="195"
                        y="191"
                        width="60"
                        height="6"
                        rx="3"
                        fill="#BAE6FD"
                      />
                      <circle
                        cx="244"
                        cy="181"
                        r="8"
                        fill="#0ea5e9"
                        fillOpacity="0.12"
                      />
                      <path
                        d="M241 181L243 183L247 178"
                        stroke="#22d3ee"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      <rect
                        x="480"
                        y="154"
                        width="104"
                        height="74"
                        rx="20"
                        fill="#ffffff"
                        stroke="#D6E4F0"
                      />
                      <rect
                        x="499"
                        y="177"
                        width="46"
                        height="8"
                        rx="4"
                        fill="#8b5cf6"
                      />
                      <rect
                        x="499"
                        y="191"
                        width="64"
                        height="6"
                        rx="3"
                        fill="#DDD6FE"
                      />
                      <path
                        d="M501 206L513 196L524 203L538 190L550 197"
                        stroke="#8b5cf6"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      <rect
                        x="182"
                        y="284"
                        width="126"
                        height="84"
                        rx="22"
                        fill="#ffffff"
                        stroke="#D6E4F0"
                      />
                      <circle
                        cx="214"
                        cy="326"
                        r="13"
                        fill="#22d3ee"
                        fillOpacity="0.12"
                      />
                      <rect
                        x="208"
                        y="322"
                        width="12"
                        height="10"
                        rx="3"
                        fill="#ffffff"
                        stroke="#22d3ee"
                        strokeWidth="1.8"
                      />
                      <path
                        d="M210 322V318.5C210 316.01 212.01 314 214.5 314C216.99 314 219 316.01 219 318.5V322"
                        stroke="#22d3ee"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                      <rect
                        x="236"
                        y="317"
                        width="46"
                        height="8"
                        rx="4"
                        fill="#22d3ee"
                      />
                      <rect
                        x="236"
                        y="331"
                        width="34"
                        height="6"
                        rx="3"
                        fill="#BAE6FD"
                      />

                      <rect
                        x="452"
                        y="284"
                        width="126"
                        height="84"
                        rx="22"
                        fill="#ffffff"
                        stroke="#D6E4F0"
                      />
                      <circle
                        cx="485"
                        cy="326"
                        r="13"
                        fill="#8b5cf6"
                        fillOpacity="0.12"
                      />
                      <path
                        d="M479 322C481 319 486 318 490 321C493 323 494 327 492 331"
                        stroke="#8b5cf6"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                      />
                      <path
                        d="M492 331L492 326L487 326"
                        stroke="#8b5cf6"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <rect
                        x="506"
                        y="317"
                        width="46"
                        height="8"
                        rx="4"
                        fill="#8b5cf6"
                      />
                      <rect
                        x="506"
                        y="331"
                        width="34"
                        height="6"
                        rx="3"
                        fill="#DDD6FE"
                      />

                      <rect
                        x="324"
                        y="392"
                        width="112"
                        height="70"
                        rx="20"
                        fill="#ffffff"
                        stroke="#D6E4F0"
                      />
                      <rect
                        x="344"
                        y="415"
                        width="46"
                        height="8"
                        rx="4"
                        fill="#22d3ee"
                      />
                      <rect
                        x="344"
                        y="429"
                        width="64"
                        height="6"
                        rx="3"
                        fill="#BAE6FD"
                      />
                      <circle
                        cx="406"
                        cy="419"
                        r="10"
                        fill="#0ea5e9"
                        fillOpacity="0.12"
                      />
                      <path
                        d="M401 419L405 423L411 415"
                        stroke="#22d3ee"
                        strokeWidth="2.3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      <path
                        d="M334 206L280 194"
                        stroke="url(#resetMainStroke)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray="8 8"
                      />
                      <path
                        d="M426 206L480 194"
                        stroke="url(#resetMainStroke)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray="8 8"
                      />
                      <path
                        d="M338 245L308 284"
                        stroke="url(#resetMainStroke)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray="8 8"
                      />
                      <path
                        d="M422 245L452 284"
                        stroke="url(#resetMainStroke)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray="8 8"
                      />
                      <path
                        d="M380 268V392"
                        stroke="url(#resetMainStroke)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray="8 8"
                      />

                      <circle cx="114" cy="222" r="24" fill="#E0F2FE" />
                      <circle cx="646" cy="222" r="24" fill="#EDE9FE" />
                      <circle cx="278" cy="436" r="18" fill="#DBEAFE" />
                      <circle cx="482" cy="436" r="18" fill="#ECFEFF" />

                      <circle cx="114" cy="222" r="7" fill="#22d3ee" />
                      <circle cx="646" cy="222" r="7" fill="#8b5cf6" />
                      <circle cx="278" cy="436" r="5.5" fill="#60a5fa" />
                      <circle cx="482" cy="436" r="5.5" fill="#22d3ee" />

                      <path
                        d="M138 222C160 222 174 222 195 222"
                        stroke="#22d3ee"
                        strokeOpacity="0.75"
                        strokeWidth="2.5"
                        strokeDasharray="6 7"
                      />
                      <path
                        d="M565 222C587 222 602 222 622 222"
                        stroke="#8b5cf6"
                        strokeOpacity="0.75"
                        strokeWidth="2.5"
                        strokeDasharray="6 7"
                      />

                      <circle
                        cx="246"
                        cy="98"
                        r="4"
                        fill="#22d3ee"
                        fillOpacity="0.85"
                      />
                      <circle
                        cx="515"
                        cy="98"
                        r="3.5"
                        fill="#8b5cf6"
                        fillOpacity="0.85"
                      />
                      <circle
                        cx="306"
                        cy="474"
                        r="4"
                        fill="#60a5fa"
                        fillOpacity="0.85"
                      />
                      <circle
                        cx="452"
                        cy="474"
                        r="4"
                        fill="#22d3ee"
                        fillOpacity="0.85"
                      />
                    </svg>
                  </div>

                  <h1 className="mt-3.5 text-[24px] font-bold tracking-tight text-slate-900 dark:text-white 2xl:text-[29px]">
                    Create a strong new password
                  </h1>

                  <p className="mt-3 max-w-130 text-[13px] leading-6 text-slate-600 dark:text-white/60 2xl:max-w-145 2xl:text-[14px]">
                    Update your credentials to restore protected access and keep
                    your network scanning environment secure from unauthorized
                    use.
                  </p>
                </div>
              </section>

              {/* RIGHT SIDE */}
              <section className="relative flex min-h-screen w-full items-center justify-center px-3 py-4 sm:px-4 sm:py-5 md:px-5 md:py-6 lg:px-6 lg:py-6 xl:min-h-full xl:px-5 xl:py-6 2xl:px-6 2xl:py-7">
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                  <div className="absolute right-[12%] top-[14%] h-28 w-28 rounded-full bg-cyan-400/10 blur-3xl 2xl:h-36 2xl:w-36" />
                  <div className="absolute left-[8%] bottom-[10%] h-24 w-24 rounded-full bg-violet-500/10 blur-3xl 2xl:h-32 2xl:w-32" />
                </div>

                <div className="relative z-10 w-full max-w-93.75 sm:max-w-98.75 2xl:max-w-106.25">
                  <div
                    className={[
                      "rounded-[22px] border border-slate-200/80 bg-white",
                      "p-4 sm:p-5 md:p-5.5 xl:p-5.5 2xl:p-6",
                      "shadow-[0_14px_38px_rgba(15,23,42,0.06)]",
                      "dark:bg-[#0b1320]/90 dark:border-white/10 dark:shadow-none",
                    ].join(" ")}
                  >
                    <div
                      className={[
                        "mb-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5",
                        "bg-violet-50 text-violet-700 border border-violet-200/80",
                        "dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-400/20",
                      ].join(" ")}
                    >
                      <FiShield className="text-[11px]" />
                      <span className="text-[10.5px] font-semibold tracking-wide">
                        Password Reset
                      </span>
                    </div>

                    <h2 className="text-[25px] font-bold tracking-tight text-slate-900 dark:text-white sm:text-[26px] xl:text-[28px]">
                      Create a New Password
                    </h2>

                    <div
                      className={[
                        "mt-3 rounded-xl px-3.5 py-3",
                        "bg-cyan-50 border border-cyan-200",
                        "dark:bg-cyan-500/10 dark:border-cyan-400/20",
                      ].join(" ")}
                    >
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-white/80 p-2 text-cyan-600 dark:bg-white/10 dark:text-cyan-300">
                          <FiMail className="text-[14px]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] text-slate-500 dark:text-white/45">
                            Recovery email
                          </p>
                          <p className="truncate text-[13px] font-semibold text-slate-800 dark:text-white/85">
                            {emailFromPreviousPage}
                          </p>
                        </div>
                      </div>
                    </div>

                    {error ? (
                      <div
                        className={[
                          "mt-3 rounded-xl border px-3.5 py-2.5 text-[11.5px]",
                          "border-red-200 bg-red-50 text-red-700",
                          "dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200",
                        ].join(" ")}
                      >
                        {error}
                      </div>
                    ) : null}

                    <form className="mt-4 space-y-3.5" onSubmit={onSubmit}>
                      <div>
                        <label className="mb-1.5 block text-[12.5px] font-medium text-slate-700 dark:text-white/75">
                          New Password
                        </label>
                        <div className="relative">
                          <FiLock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-slate-400 dark:text-white/35" />
                          <input
                            type={showNewPassword ? "text" : "password"}
                            placeholder="New Password"
                            className={inputClass}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setShowNewPassword((prev) => !prev)
                            }
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600 dark:text-white/35 dark:hover:text-white/70"
                            aria-label={
                              showNewPassword
                                ? "Hide new password"
                                : "Show new password"
                            }
                          >
                            {showNewPassword ? (
                              <FiEyeOff className="text-[15px]" />
                            ) : (
                              <FiEye className="text-[15px]" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-[12.5px] font-medium text-slate-700 dark:text-white/75">
                          Confirm Password
                        </label>
                        <div className="relative">
                          <FiKey className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-slate-400 dark:text-white/35" />
                          <input
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="Confirm Password"
                            className={inputClass}
                            value={confirmPassword}
                            onChange={(e) =>
                              setConfirmPassword(e.target.value)
                            }
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setShowConfirmPassword((prev) => !prev)
                            }
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600 dark:text-white/35 dark:hover:text-white/70"
                            aria-label={
                              showConfirmPassword
                                ? "Hide confirm password"
                                : "Show confirm password"
                            }
                          >
                            {showConfirmPassword ? (
                              <FiEyeOff className="text-[15px]" />
                            ) : (
                              <FiEye className="text-[15px]" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div
                        className={[
                          "rounded-xl px-3.5 py-3",
                          "bg-slate-50 border border-slate-200",
                          "dark:bg-white/4 dark:border-white/10",
                        ].join(" ")}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 rounded-lg bg-cyan-50 p-2 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-300">
                            <FiRefreshCw className="text-[14px]" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-semibold text-slate-700 dark:text-white/80">
                              Credential hardening
                            </p>
                            <p className="mt-1 text-[11px] leading-5 text-slate-500 dark:text-white/50">
                              Use at least 8 characters with uppercase,
                              lowercase, numbers, and symbols for stronger
                              protection.
                            </p>

                            <div className="mt-3">
                              <div className="mb-2 flex items-center justify-between gap-3">
                                <span className="text-[10.5px] font-medium text-slate-500 dark:text-white/45">
                                  Password strength
                                </span>
                                <span className="text-[10.5px] font-semibold text-cyan-600 dark:text-cyan-300">
                                  {passwordStrengthLabel}
                                </span>
                              </div>

                              <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                                <div
                                  className="h-full rounded-full bg-linear-to-r from-cyan-500 via-sky-500 to-violet-500"
                                  style={{ width: `${passwordStrength}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={sendingOTP}
                        className={[
                          "group inline-flex h-10.5 sm:h-11 w-full items-center justify-center gap-2 rounded-xl px-5",
                          "bg-linear-to-r from-cyan-500 via-sky-500 to-violet-500",
                          "text-[13.5px] font-semibold text-white sm:text-[14.5px]",
                          "shadow-[0_10px_24px_rgba(14,165,233,0.2)]",
                          "transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]",
                          "focus:outline-none focus:ring-4 focus:ring-cyan-200/60",
                          sendingOTP ? "opacity-70 cursor-not-allowed" : "",
                        ].join(" ")}
                      >
                        <span>
                          {sendingOTP
                            ? "Sending OTP..."
                            : "Confirm Password Reset"}
                        </span>
                        <FiArrowRight className="text-[15px] transition-transform duration-200 group-hover:translate-x-0.5" />
                      </button>

                      <div className="pt-0.5 text-[12.5px] text-slate-500 dark:text-white/55">
                        <button
                          type="button"
                          onClick={() => navigate("/")}
                          className="inline-flex items-center gap-2 font-medium text-violet-600 transition hover:text-violet-700 dark:text-violet-300 dark:hover:text-violet-200"
                        >
                          <FiArrowLeft className="text-[14px]" />
                          Back to Sign In
                        </button>
                      </div>
                    </form>

                    <div
                      className={[
                        "mt-4 rounded-xl px-3 py-2.5",
                        "bg-slate-50 border border-slate-200",
                        "dark:bg-white/4 dark:border-white/10",
                      ].join(" ")}
                    >
                      <div className="flex flex-wrap items-center gap-2.5">
                        <div className="inline-flex items-center gap-2">
                          <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-500" />
                          </span>
                          <span className="text-[10.5px] font-medium text-slate-700 dark:text-white/75">
                            Password update channel active
                          </span>
                        </div>

                        <div className="hidden h-4 w-px bg-slate-200 dark:bg-white/10 sm:block" />

                        <div className="inline-flex items-center gap-2 text-[10.5px] text-slate-500 dark:text-white/45">
                          <FiCheckCircle className="text-cyan-500" />
                          Reset environment secured
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>

      <ModalOTP
        open={openOTPModal}
        email={emailFromPreviousPage}
        newPassword={newPassword}
        onClose={() => setOpenOTPModal(false)}
        onVerified={handleOTPVerified}
      />
    </>
  );
};

export default Index;