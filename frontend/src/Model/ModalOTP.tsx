import React, { useEffect, useRef, useState } from "react";
import { FiMail, FiArrowRight } from "react-icons/fi";
import { message } from "antd";
import { SendOTP, VerifyOTPAddUpdatePassword } from "../services";

type ModalOTPProps = {
  open: boolean;
  email: string;
  newPassword: string;
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

const ModalOTP: React.FC<ModalOTPProps> = ({
  open,
  email,
  newPassword,
  onClose,
  onVerified,
}) => {
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (open) {
      setOtp(Array(OTP_LENGTH).fill(""));
      setError("");
      setSubmitting(false);
      setResending(false);

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

    if (!newPassword.trim()) {
      setError("ไม่พบรหัสผ่านใหม่ กรุณากลับไปกรอกข้อมูลอีกครั้ง");
      return;
    }

    try {
      setSubmitting(true);

      const res = await VerifyOTPAddUpdatePassword({
        email,
        otp: joinedOtp,
        new_password: newPassword,
      });

      if (!res) {
        setError("ยืนยัน OTP ไม่สำเร็จ");
        return;
      }

      if (res.error) {
        setError(res.error);
        return;
      }

      message.success(res.message || "ยืนยัน OTP สำเร็จ");
      onVerified();
    } catch (err: any) {
      console.error("Verify OTP error:", err);
      setError(
        err?.response?.data?.error ||
          err?.message ||
          "เกิดข้อผิดพลาดระหว่างยืนยัน OTP"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendOTP = async () => {
    setError("");

    try {
      setResending(true);

      const res = await SendOTP({ email });

      if (!res) {
        setError("ส่ง OTP ใหม่ไม่สำเร็จ");
        return;
      }

      if (res.error) {
        setError(res.error);
        return;
      }

      message.success(res.message || "ส่ง OTP ใหม่สำเร็จ");

      setOtp(Array(OTP_LENGTH).fill(""));
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 80);
    } catch (err: any) {
      console.error("Resend OTP error:", err);
      setError(
        err?.response?.data?.error ||
          err?.message ||
          "เกิดข้อผิดพลาดระหว่างส่ง OTP ใหม่"
      );
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-300 flex items-center justify-center bg-black/50 backdrop-blur-[3px] px-4">
      <div
        className={[
          "w-full max-w-95 overflow-hidden rounded-2xl border px-6 py-7",
          "border-slate-200/80 bg-white",
          "shadow-[0_24px_64px_rgba(15,23,42,0.20)]",
          "dark:border-white/10 dark:bg-[#12101f]",
        ].join(" ")}
      >
        <div className="mx-auto flex h-15 w-15 items-center justify-center rounded-full bg-slate-100 dark:bg-white/8">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-linear-to-r from-cyan-500 to-violet-500 text-white shadow-[0_8px_20px_rgba(79,109,245,0.28)]">
            <FiMail className="text-[18px]" />
          </div>
        </div>

        <h3 className="mt-4 text-center text-[24px] font-bold tracking-tight text-slate-900 dark:text-white">
          Check your email
        </h3>

        <p className="mt-2 text-center text-[13px] leading-5 text-slate-500 dark:text-white/55">
          Enter the verification code sent to
        </p>
        <p className="text-center text-[13px] font-semibold text-slate-700 dark:text-white/80">
          {maskEmail(email)}
        </p>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-2.5 text-center text-[12px] text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleVerify} className="mt-5">
          <div className="flex items-center justify-center gap-2.5">
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
                  "h-12 w-12 rounded-xl border text-center text-[22px] font-semibold outline-none transition-all",
                  digit
                    ? "border-[#4f6df5] bg-[#f4f7ff] text-slate-900 shadow-[0_4px_12px_rgba(79,109,245,0.10)]"
                    : "border-slate-300 bg-white text-slate-900",
                  "focus:border-[#4f6df5] focus:ring-4 focus:ring-[#4f6df5]/12",
                  "dark:border-white/10 dark:bg-white/5 dark:text-white",
                  "dark:focus:border-cyan-400 dark:focus:ring-cyan-400/10",
                ].join(" ")}
              />
            ))}
          </div>

          <div className="mt-4 text-center text-[13px] text-slate-400 dark:text-white/35">
            Didn&apos;t get a code?{" "}
            <button
              type="button"
              onClick={handleResendOTP}
              disabled={resending}
              className="font-medium text-[#4f6df5] transition hover:underline disabled:opacity-60 dark:text-cyan-300"
            >
              {resending ? "sending..." : "resend"}
            </button>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className={[
              "mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-semibold text-white transition-all",
              "bg-linear-to-r from-cyan-500 via-sky-500 to-violet-500",
              "shadow-[0_10px_28px_rgba(63,92,240,0.24)]",
              "hover:scale-[1.01] active:scale-[0.99]",
              "focus:outline-none focus:ring-4 focus:ring-cyan-200/50",
              submitting ? "opacity-70 cursor-not-allowed" : "",
            ].join(" ")}
          >
            <span>{submitting ? "Verifying..." : "Verify email"}</span>
            <FiArrowRight className="text-[16px]" />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="mt-3 w-full text-center text-[13px] text-slate-500 transition hover:text-slate-700 dark:text-white/45 dark:hover:text-white/75"
          >
            Cancel
          </button>
        </form>
      </div>
    </div>
  );
};

export default ModalOTP;