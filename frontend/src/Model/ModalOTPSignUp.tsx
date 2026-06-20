import React, { useEffect, useRef, useState } from "react";
import { FiMail, FiArrowRight, FiShield, FiX } from "react-icons/fi";
import { message } from "antd";
import { VerifyOTPSignUp } from "../services";

type SignUpFormData = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  location: string;
  position: string;
};

type ModalOTPSignUpProps = {
  open: boolean;
  signupData: SignUpFormData;
  onClose: () => void;
  onVerified: () => void;
};

const OTP_LENGTH = 6;

const maskEmail = (email: string) => {
  if (!email || !email.includes("@")) return email;

  const [name, domain] = email.split("@");

  if (name.length <= 3) {
    return `${name[0] ?? ""}***@${domain}`;
  }

  return `${name.slice(0, 3)}***@${domain}`;
};

const ModalOTPSignUp: React.FC<ModalOTPSignUpProps> = ({
  open,
  signupData,
  onClose,
  onVerified,
}) => {
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const email = signupData.email;

  useEffect(() => {
    if (open) {
      setOtp(Array(OTP_LENGTH).fill(""));
      setError("");
      setSubmitting(false);

      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 80);
    }
  }, [open]);

  if (!open) return null;

  const joinedOtp = otp.join("");

  const handleChangeOTP = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);

    setOtp((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });

    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace") {
      if (otp[index]) {
        setOtp((prev) => {
          const next = [...prev];
          next[index] = "";
          return next;
        });
        return;
      }

      if (index > 0) {
        inputRefs.current[index - 1]?.focus();
        setOtp((prev) => {
          const next = [...prev];
          next[index - 1] = "";
          return next;
        });
      }
    }

    if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }

    if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();

    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, OTP_LENGTH);

    if (!pasted) return;

    const next = Array(OTP_LENGTH).fill("");
    pasted.split("").forEach((char, idx) => {
      next[idx] = char;
    });

    setOtp(next);

    const focusIndex = Math.min(pasted.length, OTP_LENGTH - 1);
    inputRefs.current[focusIndex]?.focus();
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (joinedOtp.length !== OTP_LENGTH) {
      setError(`กรุณากรอก OTP ให้ครบ ${OTP_LENGTH} หลัก`);
      return;
    }

    if (!signupData.email.trim()) {
      setError("ไม่พบอีเมลสำหรับสมัครสมาชิก");
      return;
    }

    if (!signupData.password.trim()) {
      setError("ไม่พบรหัสผ่านสำหรับสมัครสมาชิก");
      return;
    }

    try {
      setSubmitting(true);

      const res = await VerifyOTPSignUp({
        email: signupData.email,
        otp: joinedOtp,
        password: signupData.password,
        first_name: signupData.first_name,
        last_name: signupData.last_name,
        phone_number: signupData.phone_number,
        location: signupData.location,
        position: signupData.position,
      });

      if (!res) {
        setError("ยืนยัน OTP ไม่สำเร็จ");
        return;
      }

      if (res.error) {
        setError(res.error);
        return;
      }

      message.success(res.message || "สมัครสมาชิกสำเร็จ");
      onVerified();
    } catch (err: any) {
      console.error("Verify Sign Up OTP error:", err);
      setError(
        err?.response?.data?.error ||
          err?.message ||
          "เกิดข้อผิดพลาดระหว่างยืนยัน OTP"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-300 flex items-center justify-center bg-black/50 backdrop-blur-[3px] px-4">
      <div className="relative w-full max-w-107.5 overflow-hidden rounded-2xl border border-white/80 bg-white shadow-[0_24px_64px_rgba(15,23,42,0.20)] dark:border-white/10 dark:bg-[#12101f]">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-cyan-300/20 blur-3xl dark:bg-cyan-500/10" />
          <div className="absolute -bottom-12 right-0 h-32 w-32 rounded-full bg-sky-300/20 blur-3xl dark:bg-sky-500/10" />
          <div className="absolute inset-0 opacity-[0.20] dark:opacity-[0.08]">
            <div className="h-full w-full bg-[linear-gradient(rgba(59,130,246,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.08)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-size-[24px_24px]" />
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute right-4 top-4 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-white/90 text-slate-500 shadow-sm transition-all duration-200 hover:border-cyan-300 hover:text-cyan-600 hover:shadow-md dark:border-white/10 dark:bg-white/5 dark:text-white/60 dark:hover:border-cyan-400/30 dark:hover:text-cyan-300"
        >
          <FiX className="text-[18px]" />
        </button>

        <div className="relative px-6 py-7 sm:px-7 sm:py-8">
          <div className="mx-auto inline-flex w-fit items-center gap-1.5 rounded-full border border-cyan-200/80 bg-cyan-50/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-500/10 dark:text-cyan-300">
            <FiShield className="text-[11px]" />
            Email Verification
          </div>

          <div className="mx-auto mt-4 flex h-15 w-15 items-center justify-center rounded-full border border-slate-200/80 bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
            <div className="flex h-10.5 w-10.5 items-center justify-center rounded-full bg-linear-to-r from-cyan-500 via-sky-500 to-blue-500 text-white shadow-[0_12px_24px_rgba(14,165,233,0.28)]">
              <FiMail className="text-[18px]" />
            </div>
          </div>

          <div className="mt-4 text-center">
            <h3 className="bg-linear-to-r from-cyan-500 via-sky-500 to-blue-500 bg-clip-text text-[26px] font-extrabold tracking-[-0.03em] text-transparent">
              Verify Your Email
            </h3>
            <p className="mt-2 text-[13px] leading-5 text-slate-500 dark:text-white/55">
              กรุณากรอกรหัส OTP ที่ส่งไปยังอีเมลนี้
            </p>
            <p className="mt-1 text-[13px] font-semibold text-slate-700 dark:text-white/80">
              {maskEmail(email)}
            </p>
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-2.5 text-center text-[12px] text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
              {error}
            </div>
          ) : null}

          <form onSubmit={handleVerify} className="mt-6">
            <div className="flex items-center justify-center gap-2 sm:gap-2.5">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => {
                    inputRefs.current[index] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChangeOTP(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={handlePaste}
                  className={[
                    "h-12 w-12 rounded-xl border text-center text-[21px] font-bold outline-none transition-all duration-300 sm:h-13 sm:w-13",
                    digit
                      ? "border-cyan-400 bg-cyan-50 text-slate-900 shadow-[0_8px_20px_rgba(14,165,233,0.12)] dark:border-cyan-400 dark:bg-cyan-500/10 dark:text-white"
                      : "border-slate-200 bg-white text-slate-900 dark:border-white/10 dark:bg-white/4 dark:text-white",
                    "focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100/80 dark:focus:ring-cyan-500/15",
                  ].join(" ")}
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className={[
                "mt-6 inline-flex h-11.5 w-full items-center justify-center gap-2 rounded-2xl text-[14px] font-semibold text-white transition-all duration-300",
                "bg-linear-to-r from-cyan-500 via-sky-500 to-blue-500",
                "shadow-[0_16px_32px_rgba(14,165,233,0.24)]",
                "hover:translate-y-px hover:shadow-[0_18px_36px_rgba(14,165,233,0.30)]",
                "focus:outline-none focus:ring-4 focus:ring-cyan-200/60",
                submitting ? "cursor-not-allowed opacity-70" : "",
              ].join(" ")}
            >
              <span>{submitting ? "Verifying..." : "Verify Email"}</span>
              <FiArrowRight className="text-[16px]" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ModalOTPSignUp;