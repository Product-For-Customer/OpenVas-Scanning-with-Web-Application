import React, { useState } from "react";
import { message } from "antd";
import {
  FiShield,
  FiEye,
  FiEyeOff,
  FiMail,
  FiLock,
  FiArrowRight,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { Login } from "../../../services/auth";
import { useAuth } from "../../../contexts/AuthContext";

const Index: React.FC = () => {
  const navigate = useNavigate();
  const { refreshMe } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const inputClass = [
    "w-full h-10.5 sm:h-11 rounded-xl border pl-9.5 pr-10.5 text-[13px] outline-none transition-all duration-200",
    "border-slate-200 bg-[#f5f8ff] text-slate-800 placeholder:text-slate-400",
    "focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100/80",
    "dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-white/30",
    "dark:focus:border-cyan-400/30 dark:focus:ring-cyan-500/10",
  ].join(" ");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("กรุณากรอก Email และ Password");
      return;
    }

    try {
      setSubmitting(true);

      const res = await Login({ email, password });
      await refreshMe();

      const role = (res?.user?.role ?? "").toLowerCase();

      if (role === "admin") {
        message.success("login success");
        await new Promise((resolve) => setTimeout(resolve, 1200));
        navigate("/admin", { replace: true });
      } else {
        setError("บัญชีนี้ไม่มีสิทธิ์ Admin");
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        "Login ไม่สำเร็จ กรุณาลองใหม่";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#f5f7fc] dark:bg-[#07101b]">
      <div className="mx-auto min-h-screen w-full px-0 py-0 sm:px-2 sm:py-2 md:px-3 md:py-3 lg:px-4 lg:py-4 xl:px-5 xl:py-5 2xl:px-6 2xl:py-6">
        <div
          className={[
            "w-full overflow-hidden",
            "min-h-screen sm:min-h-[calc(100vh-16px)] md:min-h-[calc(100vh-24px)] lg:min-h-[calc(100vh-32px)] xl:min-h-[calc(100vh-40px)] 2xl:min-h-[calc(100vh-48px)]",
            "rounded-none sm:rounded-3xl",
            "border border-slate-200/80 bg-[#fbfcff]",
            "shadow-none sm:shadow-[0_14px_40px_rgba(15,23,42,0.055)]",
            "dark:border-white/10 dark:bg-[#08111f] dark:shadow-none",
          ].join(" ")}
        >
          <div className="grid min-h-full w-full grid-cols-1 xl:grid-cols-[minmax(0,1.02fr)_minmax(370px,455px)] 2xl:grid-cols-[minmax(0,1.05fr)_minmax(390px,475px)]">
            {/* LEFT SIDE */}
            <section className="relative hidden xl:flex min-h-full items-center justify-center px-6 py-7 2xl:px-8 2xl:py-9">
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute left-[14%] top-[12%] h-30 w-30 rounded-full bg-cyan-400/10 blur-3xl 2xl:h-38 2xl:w-38" />
                <div className="absolute right-[10%] top-[18%] h-34 w-34 rounded-full bg-violet-500/10 blur-3xl 2xl:h-42 2xl:w-42" />
                <div className="absolute bottom-[10%] left-[25%] h-30 w-30 rounded-full bg-sky-500/10 blur-3xl 2xl:h-36 2xl:w-36" />
              </div>

              <div className="relative z-10 flex w-full max-w-162.5 flex-col items-center text-center 2xl:max-w-182.5">
                <div
                  className={[
                    "mb-4 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5",
                    "border border-cyan-200/80 bg-cyan-50 text-cyan-700",
                    "dark:border-cyan-400/20 dark:bg-cyan-500/10 dark:text-cyan-300",
                  ].join(" ")}
                >
                  <FiShield className="text-[12px]" />
                  <span className="text-[11.5px] font-semibold tracking-wide 2xl:text-[12.5px]">
                    Secure Network Access
                  </span>
                </div>

                <div className="w-full max-w-113.75 2xl:max-w-131.25">
                  <svg
                    viewBox="0 0 760 520"
                    className="h-auto w-full"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-label="network security illustration"
                  >
                    <defs>
                      <linearGradient id="mainLine" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#22d3ee" />
                        <stop offset="50%" stopColor="#38bdf8" />
                        <stop offset="100%" stopColor="#8b5cf6" />
                      </linearGradient>

                      <linearGradient id="cardGlow" x1="0" y1="0" x2="1" y2="1">
                        <stop
                          offset="0%"
                          stopColor="#0ea5e9"
                          stopOpacity="0.14"
                        />
                        <stop
                          offset="100%"
                          stopColor="#8b5cf6"
                          stopOpacity="0.14"
                        />
                      </linearGradient>

                      <radialGradient
                        id="centerGlow"
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
                      x="180"
                      y="104"
                      width="400"
                      height="250"
                      rx="30"
                      fill="url(#cardGlow)"
                      stroke="url(#mainLine)"
                      strokeOpacity="0.35"
                      strokeWidth="1.6"
                    />

                    <circle cx="380" cy="228" r="92" fill="url(#centerGlow)" />
                    <circle
                      cx="380"
                      cy="228"
                      r="72"
                      stroke="#22d3ee"
                      strokeOpacity="0.78"
                      strokeWidth="2.3"
                    />
                    <circle
                      cx="380"
                      cy="228"
                      r="46"
                      stroke="#38bdf8"
                      strokeOpacity="0.65"
                      strokeWidth="2"
                    />
                    <circle
                      cx="380"
                      cy="228"
                      r="20"
                      fill="#22d3ee"
                      fillOpacity="0.12"
                      stroke="#22d3ee"
                      strokeWidth="2"
                    />

                    <path
                      d="M380 198L401 208V228C401 244 390 255 380 260C370 255 359 244 359 228V208L380 198Z"
                      fill="#0ea5e9"
                      fillOpacity="0.16"
                      stroke="#22d3ee"
                      strokeWidth="2"
                    />
                    <path
                      d="M372 228L378 234L390 221"
                      stroke="#22d3ee"
                      strokeWidth="2.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    <path
                      d="M380 156V102"
                      stroke="url(#mainLine)"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray="8 8"
                    />
                    <path
                      d="M445 191L520 146"
                      stroke="url(#mainLine)"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray="8 8"
                    />
                    <path
                      d="M451 267L540 304"
                      stroke="url(#mainLine)"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray="8 8"
                    />
                    <path
                      d="M315 267L226 304"
                      stroke="url(#mainLine)"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray="8 8"
                    />
                    <path
                      d="M315 191L240 146"
                      stroke="url(#mainLine)"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray="8 8"
                    />

                    <g>
                      <rect
                        x="334"
                        y="44"
                        width="92"
                        height="56"
                        rx="16"
                        fill="#ffffff"
                        stroke="#D6E4F0"
                      />
                      <rect
                        x="350"
                        y="62"
                        width="46"
                        height="8"
                        rx="4"
                        fill="#22d3ee"
                      />
                      <rect
                        x="350"
                        y="76"
                        width="34"
                        height="6"
                        rx="3"
                        fill="#c4b5fd"
                      />
                      <circle
                        cx="405"
                        cy="67"
                        r="6"
                        fill="#8b5cf6"
                        fillOpacity="0.15"
                      />
                      <circle cx="405" cy="67" r="3.2" fill="#8b5cf6" />
                    </g>

                    <g>
                      <rect
                        x="520"
                        y="106"
                        width="108"
                        height="68"
                        rx="18"
                        fill="#ffffff"
                        stroke="#D6E4F0"
                      />
                      <rect
                        x="538"
                        y="126"
                        width="54"
                        height="8"
                        rx="4"
                        fill="#38bdf8"
                      />
                      <rect
                        x="538"
                        y="140"
                        width="72"
                        height="6"
                        rx="3"
                        fill="#BAE6FD"
                      />
                      <path
                        d="M540 157L553 145L566 151L580 134L594 142"
                        stroke="#8b5cf6"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </g>

                    <g>
                      <rect
                        x="536"
                        y="278"
                        width="112"
                        height="76"
                        rx="18"
                        fill="#ffffff"
                        stroke="#D6E4F0"
                      />
                      <circle
                        cx="562"
                        cy="316"
                        r="13"
                        fill="#ef4444"
                        fillOpacity="0.12"
                      />
                      <path
                        d="M562 309V317"
                        stroke="#ef4444"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                      <circle cx="562" cy="322" r="1.8" fill="#ef4444" />
                      <rect
                        x="582"
                        y="306"
                        width="40"
                        height="8"
                        rx="4"
                        fill="#ef4444"
                      />
                      <rect
                        x="582"
                        y="320"
                        width="28"
                        height="6"
                        rx="3"
                        fill="#fecaca"
                      />
                    </g>

                    <g>
                      <rect
                        x="116"
                        y="278"
                        width="110"
                        height="76"
                        rx="18"
                        fill="#ffffff"
                        stroke="#D6E4F0"
                      />
                      <rect
                        x="136"
                        y="302"
                        width="46"
                        height="8"
                        rx="4"
                        fill="#22d3ee"
                      />
                      <rect
                        x="136"
                        y="316"
                        width="62"
                        height="6"
                        rx="3"
                        fill="#c4b5fd"
                      />
                      <circle
                        cx="192"
                        cy="306"
                        r="9"
                        stroke="#22d3ee"
                        strokeWidth="2"
                        fill="none"
                      />
                      <path
                        d="M198 312L205 319"
                        stroke="#22d3ee"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                    </g>

                    <g>
                      <rect
                        x="126"
                        y="106"
                        width="102"
                        height="68"
                        rx="18"
                        fill="#ffffff"
                        stroke="#D6E4F0"
                      />
                      <rect
                        x="146"
                        y="126"
                        width="44"
                        height="8"
                        rx="4"
                        fill="#8b5cf6"
                      />
                      <rect
                        x="146"
                        y="140"
                        width="62"
                        height="6"
                        rx="3"
                        fill="#ddd6fe"
                      />
                      <rect
                        x="146"
                        y="151"
                        width="50"
                        height="6"
                        rx="3"
                        fill="#dbeafe"
                      />
                    </g>

                    <g>
                      <rect
                        x="292"
                        y="374"
                        width="176"
                        height="74"
                        rx="20"
                        fill="#ffffff"
                        stroke="#D6E4F0"
                      />
                      <rect
                        x="315"
                        y="397"
                        width="58"
                        height="8"
                        rx="4"
                        fill="#22d3ee"
                      />
                      <rect
                        x="315"
                        y="411"
                        width="84"
                        height="6"
                        rx="3"
                        fill="#BAE6FD"
                      />
                      <rect
                        x="315"
                        y="423"
                        width="66"
                        height="6"
                        rx="3"
                        fill="#DDD6FE"
                      />
                      <circle
                        cx="425"
                        cy="410"
                        r="14"
                        fill="#0ea5e9"
                        fillOpacity="0.12"
                      />
                      <path
                        d="M419 410L424 415L432 405"
                        stroke="#22d3ee"
                        strokeWidth="2.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </g>

                    <circle cx="95" cy="228" r="24" fill="#E0F2FE" />
                    <circle cx="666" cy="228" r="24" fill="#EDE9FE" />
                    <circle cx="260" cy="436" r="20" fill="#DBEAFE" />

                    <circle cx="95" cy="228" r="7" fill="#22d3ee" />
                    <circle cx="666" cy="228" r="7" fill="#8b5cf6" />
                    <circle cx="260" cy="436" r="6" fill="#60a5fa" />

                    <path
                      d="M119 228C148 228 176 228 206 228"
                      stroke="#22d3ee"
                      strokeOpacity="0.7"
                      strokeWidth="2.5"
                      strokeDasharray="6 7"
                    />
                    <path
                      d="M554 228C586 228 612 228 642 228"
                      stroke="#8b5cf6"
                      strokeOpacity="0.7"
                      strokeWidth="2.5"
                      strokeDasharray="6 7"
                    />

                    <circle
                      cx="286"
                      cy="82"
                      r="4"
                      fill="#22d3ee"
                      fillOpacity="0.85"
                    />
                    <circle
                      cx="474"
                      cy="82"
                      r="3.5"
                      fill="#8b5cf6"
                      fillOpacity="0.85"
                    />
                    <circle
                      cx="214"
                      cy="380"
                      r="4"
                      fill="#60a5fa"
                      fillOpacity="0.85"
                    />
                    <circle
                      cx="550"
                      cy="384"
                      r="4"
                      fill="#22d3ee"
                      fillOpacity="0.85"
                    />
                  </svg>
                </div>

                <h1 className="mt-3.5 text-[24px] font-bold tracking-tight text-slate-900 dark:text-white 2xl:text-[29px]">
                  Welcome back!
                </h1>

                <p className="mt-3 max-w-130 text-[13px] leading-6 text-slate-600 dark:text-white/60 2xl:max-w-145 2xl:text-[14px]">
                  Access your secured scanning environment, monitor network
                  activity, and continue investigating vulnerabilities from one
                  centralized dashboard.
                </p>
              </div>
            </section>

            {/* RIGHT SIDE */}
            <section className="relative flex min-h-screen w-full items-center justify-center px-3 py-4 sm:px-4 sm:py-5 md:px-5 md:py-6 lg:px-6 lg:py-6 xl:min-h-full xl:px-5 xl:py-6 2xl:px-6 2xl:py-7">
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute right-[14%] top-[16%] h-28 w-28 rounded-full bg-cyan-400/10 blur-3xl 2xl:h-36 2xl:w-36" />
                <div className="absolute left-[8%] bottom-[10%] h-24 w-24 rounded-full bg-violet-500/10 blur-3xl 2xl:h-32 2xl:w-32" />
              </div>

              <div className="relative z-10 w-full max-w-93.75 sm:max-w-98.75 2xl:max-w-106.25">
                <div
                  className={[
                    "rounded-[22px] border border-slate-200/80 bg-white",
                    "p-4 sm:p-5 md:p-5.5 xl:p-5.5 2xl:p-6",
                    "shadow-[0_14px_38px_rgba(15,23,42,0.06)]",
                    "dark:border-white/10 dark:bg-[#0b1320]/90 dark:shadow-none",
                  ].join(" ")}
                >
                  <div
                    className={[
                      "mb-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5",
                      "border border-violet-200/80 bg-violet-50 text-violet-700",
                      "dark:border-violet-400/20 dark:bg-violet-500/10 dark:text-violet-300",
                    ].join(" ")}
                  >
                    <FiShield className="text-[11px]" />
                    <span className="text-[10.5px] font-semibold tracking-wide">
                      Protected Sign In
                    </span>
                  </div>

                  <h2 className="text-[25px] font-bold tracking-tight text-slate-900 dark:text-white sm:text-[26px] xl:text-[28px]">
                    Sign In
                  </h2>

                  <p className="mt-1.5 text-[12.5px] text-slate-500 dark:text-white/55">
                    Welcome Back! Log in to your account
                  </p>

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
                        Email
                      </label>
                      <div className="relative">
                        <FiMail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-slate-400 dark:text-white/35" />
                        <input
                          type="email"
                          placeholder="admin@example.com"
                          className={inputClass}
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          autoComplete="email"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-[12.5px] font-medium text-slate-700 dark:text-white/75">
                        Password
                      </label>
                      <div className="relative">
                        <FiLock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-slate-400 dark:text-white/35" />
                        <input
                          type={showPassword ? "text" : "password"}
                          placeholder="Password"
                          className={inputClass}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          autoComplete="current-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600 dark:text-white/35 dark:hover:text-white/70"
                          aria-label={
                            showPassword ? "Hide password" : "Show password"
                          }
                        >
                          {showPassword ? (
                            <FiEyeOff className="text-[15px]" />
                          ) : (
                            <FiEye className="text-[15px]" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-end text-[12px]">
                      <button
                        type="button"
                        onClick={() => navigate("/forgot-password")}
                        className="font-medium text-violet-600 transition hover:text-violet-700 dark:text-violet-300 dark:hover:text-violet-200"
                      >
                        Forgot password?
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className={[
                        "group inline-flex h-10.5 sm:h-11 w-full items-center justify-center gap-2 rounded-xl px-5",
                        "bg-linear-to-r from-cyan-500 via-sky-500 to-violet-500",
                        "text-[13.5px] font-semibold text-white sm:text-[14.5px]",
                        "shadow-[0_10px_24px_rgba(14,165,233,0.2)]",
                        "transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]",
                        "focus:outline-none focus:ring-4 focus:ring-cyan-200/60",
                        submitting ? "cursor-not-allowed opacity-70" : "",
                      ].join(" ")}
                    >
                      <span>{submitting ? "Signing In..." : "Sign In"}</span>
                      <FiArrowRight className="text-[15px] transition-transform duration-200 group-hover:translate-x-0.5" />
                    </button>

                    <div className="flex items-center gap-3 py-0.5">
                      <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
                      <span className="text-[11px] text-slate-400 dark:text-white/35">
                        OR
                      </span>
                      <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
                    </div>

                    <div className="pt-0.5 text-center text-[12.5px] text-slate-500 dark:text-white/55">
                      Don&apos;t have an account yet?{" "}
                      <button
                        type="button"
                        onClick={() => navigate("/register")}
                        className="font-semibold text-violet-600 transition hover:text-violet-700 dark:text-violet-300 dark:hover:text-violet-200"
                      >
                        Sign Up
                      </button>
                    </div>
                  </form>

                  <div
                    className={[
                      "mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5",
                      "dark:border-white/10 dark:bg-white/4",
                    ].join(" ")}
                  >
                    <div className="flex flex-wrap items-center gap-2.5">
                      <div className="inline-flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-500" />
                        </span>
                        <span className="text-[10.5px] font-medium text-slate-700 dark:text-white/75">
                          Secure authentication channel active
                        </span>
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
  );
};

export default Index;