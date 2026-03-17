import React, { useState } from "react";
import {
  FiShield,
  FiMail,
  FiArrowRight,
  FiArrowLeft,
  FiCheckCircle,
  FiRefreshCw,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { CheckUserEmail } from "../../../services";

const Index: React.FC = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const inputClass = [
    "w-full h-10.5 sm:h-11 rounded-xl border pl-9.5 pr-4 text-[13px] outline-none transition-all duration-200",
    "border-slate-200 bg-[#f5f8ff] text-slate-800 placeholder:text-slate-400",
    "focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100/80",
    "dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-white/30",
    "dark:focus:border-cyan-400/30 dark:focus:ring-cyan-500/10",
  ].join(" ");

  const validateEmail = (value: string) => {
    const trimmed = value.trim();

    if (!trimmed) return "กรุณากรอกอีเมล";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) return "รูปแบบอีเมลไม่ถูกต้อง";

    return "";
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const emailError = validateEmail(email);
    if (emailError) {
      setError(emailError);
      return;
    }

    try {
      setSubmitting(true);

      const res = await CheckUserEmail({ email: email.trim() });

      if (!res) {
        setError("ไม่สามารถตรวจสอบอีเมลได้");
        return;
      }

      if (!res.exists) {
        setError(res.error || "ไม่พบอีเมลนี้ในระบบ");
        return;
      }

      navigate("/reset-password", {
        replace: true,
        state: {
          email: email.trim(),
          verifiedEmail: true,
        },
      });
    } catch (err: any) {
      console.error("CheckUserEmail error:", err);
      setError(
        err?.response?.data?.error ||
          err?.message ||
          "เกิดข้อผิดพลาดระหว่างตรวจสอบอีเมล"
      );
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
            "dark:bg-[#08111f] dark:border-white/10 dark:shadow-none",
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
                    "dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-400/20",
                  ].join(" ")}
                >
                  <FiShield className="text-[12px]" />
                  <span className="text-[11.5px] font-semibold tracking-wide 2xl:text-[12.5px]">
                    Recovery Access Control
                  </span>
                </div>

                <div className="w-full max-w-113.75 2xl:max-w-131.25">
                  <svg
                    viewBox="0 0 760 520"
                    className="w-full h-auto"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-label="forgot password network recovery illustration"
                  >
                    <defs>
                      <linearGradient
                        id="forgotMainStroke"
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
                        id="forgotPanelGlow"
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
                        id="forgotCoreGlow"
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
                      x="152"
                      y="102"
                      width="456"
                      height="270"
                      rx="34"
                      fill="url(#forgotPanelGlow)"
                      stroke="url(#forgotMainStroke)"
                      strokeOpacity="0.32"
                      strokeWidth="1.6"
                    />

                    <circle cx="380" cy="228" r="86" fill="url(#forgotCoreGlow)" />
                    <circle
                      cx="380"
                      cy="228"
                      r="62"
                      stroke="#22d3ee"
                      strokeOpacity="0.8"
                      strokeWidth="2.3"
                    />
                    <circle
                      cx="380"
                      cy="228"
                      r="38"
                      stroke="#38bdf8"
                      strokeOpacity="0.65"
                      strokeWidth="1.9"
                    />
                    <circle
                      cx="380"
                      cy="228"
                      r="18"
                      fill="#22d3ee"
                      fillOpacity="0.12"
                      stroke="#22d3ee"
                      strokeWidth="2"
                    />

                    <rect
                      x="364"
                      y="222"
                      width="32"
                      height="28"
                      rx="8"
                      fill="#ffffff"
                      stroke="#22d3ee"
                      strokeWidth="2"
                    />
                    <path
                      d="M370 222V214C370 208.477 374.477 204 380 204C385.523 204 390 208.477 390 214V222"
                      stroke="#22d3ee"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                    />

                    <path
                      d="M414 214C417 222 417 234 412 244"
                      stroke="#8b5cf6"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                    />
                    <path
                      d="M406 243L412 244L414 238"
                      stroke="#8b5cf6"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    <rect
                      x="322"
                      y="48"
                      width="116"
                      height="74"
                      rx="20"
                      fill="#ffffff"
                      stroke="#D6E4F0"
                    />
                    <rect
                      x="344"
                      y="72"
                      width="54"
                      height="8"
                      rx="4"
                      fill="#22d3ee"
                    />
                    <rect
                      x="344"
                      y="86"
                      width="74"
                      height="6"
                      rx="3"
                      fill="#BAE6FD"
                    />
                    <path
                      d="M404 68L416 76L428 68"
                      stroke="#8b5cf6"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    <path
                      d="M380 166V122"
                      stroke="url(#forgotMainStroke)"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray="8 8"
                    />

                    <rect
                      x="170"
                      y="154"
                      width="116"
                      height="78"
                      rx="20"
                      fill="#ffffff"
                      stroke="#D6E4F0"
                    />
                    <rect
                      x="190"
                      y="177"
                      width="46"
                      height="8"
                      rx="4"
                      fill="#22d3ee"
                    />
                    <rect
                      x="190"
                      y="191"
                      width="66"
                      height="6"
                      rx="3"
                      fill="#DDD6FE"
                    />
                    <circle
                      cx="250"
                      cy="181"
                      r="8"
                      fill="#0ea5e9"
                      fillOpacity="0.12"
                    />
                    <circle cx="250" cy="181" r="3.8" fill="#22d3ee" />

                    <rect
                      x="474"
                      y="154"
                      width="116"
                      height="78"
                      rx="20"
                      fill="#ffffff"
                      stroke="#D6E4F0"
                    />
                    <rect
                      x="495"
                      y="177"
                      width="48"
                      height="8"
                      rx="4"
                      fill="#8b5cf6"
                    />
                    <rect
                      x="495"
                      y="191"
                      width="68"
                      height="6"
                      rx="3"
                      fill="#DDD6FE"
                    />
                    <path
                      d="M496 207L509 198L521 204L535 192L549 200"
                      stroke="#8b5cf6"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    <rect
                      x="182"
                      y="288"
                      width="128"
                      height="84"
                      rx="22"
                      fill="#ffffff"
                      stroke="#D6E4F0"
                    />
                    <circle
                      cx="214"
                      cy="330"
                      r="13"
                      fill="#22d3ee"
                      fillOpacity="0.12"
                    />
                    <path
                      d="M206 325L214 331L224 320"
                      stroke="#22d3ee"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <rect
                      x="236"
                      y="321"
                      width="44"
                      height="8"
                      rx="4"
                      fill="#22d3ee"
                    />
                    <rect
                      x="236"
                      y="335"
                      width="32"
                      height="6"
                      rx="3"
                      fill="#BAE6FD"
                    />

                    <rect
                      x="450"
                      y="288"
                      width="132"
                      height="84"
                      rx="22"
                      fill="#ffffff"
                      stroke="#D6E4F0"
                    />
                    <circle
                      cx="482"
                      cy="330"
                      r="13"
                      fill="#8b5cf6"
                      fillOpacity="0.12"
                    />
                    <path
                      d="M482 322C487 322 491 326 491 331"
                      stroke="#8b5cf6"
                      strokeWidth="2.3"
                      strokeLinecap="round"
                    />
                    <path
                      d="M490 330L491 336L485 336"
                      stroke="#8b5cf6"
                      strokeWidth="2.3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <rect
                      x="504"
                      y="321"
                      width="46"
                      height="8"
                      rx="4"
                      fill="#8b5cf6"
                    />
                    <rect
                      x="504"
                      y="335"
                      width="34"
                      height="6"
                      rx="3"
                      fill="#DDD6FE"
                    />

                    <rect
                      x="316"
                      y="392"
                      width="128"
                      height="72"
                      rx="20"
                      fill="#ffffff"
                      stroke="#D6E4F0"
                    />
                    <rect
                      x="338"
                      y="415"
                      width="52"
                      height="8"
                      rx="4"
                      fill="#22d3ee"
                    />
                    <rect
                      x="338"
                      y="429"
                      width="72"
                      height="6"
                      rx="3"
                      fill="#BAE6FD"
                    />
                    <circle
                      cx="412"
                      cy="419"
                      r="10"
                      fill="#0ea5e9"
                      fillOpacity="0.12"
                    />
                    <path
                      d="M407 419L411 423L417 415"
                      stroke="#22d3ee"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    <path
                      d="M338 199L286 193"
                      stroke="url(#forgotMainStroke)"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray="8 8"
                    />
                    <path
                      d="M422 199L474 193"
                      stroke="url(#forgotMainStroke)"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray="8 8"
                    />
                    <path
                      d="M336 260L289 302"
                      stroke="url(#forgotMainStroke)"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray="8 8"
                    />
                    <path
                      d="M424 260L450 288"
                      stroke="url(#forgotMainStroke)"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray="8 8"
                    />
                    <path
                      d="M380 290V392"
                      stroke="url(#forgotMainStroke)"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray="8 8"
                    />

                    <circle cx="112" cy="232" r="24" fill="#E0F2FE" />
                    <circle cx="648" cy="232" r="24" fill="#EDE9FE" />
                    <circle cx="268" cy="438" r="18" fill="#DBEAFE" />
                    <circle cx="496" cy="438" r="18" fill="#ECFEFF" />

                    <circle cx="112" cy="232" r="7" fill="#22d3ee" />
                    <circle cx="648" cy="232" r="7" fill="#8b5cf6" />
                    <circle cx="268" cy="438" r="5.5" fill="#60a5fa" />
                    <circle cx="496" cy="438" r="5.5" fill="#22d3ee" />

                    <path
                      d="M136 232C160 232 176 232 198 232"
                      stroke="#22d3ee"
                      strokeOpacity="0.75"
                      strokeWidth="2.5"
                      strokeDasharray="6 7"
                    />
                    <path
                      d="M562 232C585 232 602 232 624 232"
                      stroke="#8b5cf6"
                      strokeOpacity="0.75"
                      strokeWidth="2.5"
                      strokeDasharray="6 7"
                    />

                    <circle
                      cx="244"
                      cy="98"
                      r="4"
                      fill="#22d3ee"
                      fillOpacity="0.85"
                    />
                    <circle
                      cx="520"
                      cy="96"
                      r="3.5"
                      fill="#8b5cf6"
                      fillOpacity="0.85"
                    />
                    <circle
                      cx="300"
                      cy="472"
                      r="4"
                      fill="#60a5fa"
                      fillOpacity="0.85"
                    />
                    <circle
                      cx="456"
                      cy="472"
                      r="4"
                      fill="#22d3ee"
                      fillOpacity="0.85"
                    />
                  </svg>
                </div>

                <h1 className="mt-3.5 text-[24px] font-bold tracking-tight text-slate-900 dark:text-white 2xl:text-[29px]">
                  Recover secure access
                </h1>

                <p className="mt-3 max-w-130 text-[13px] leading-6 text-slate-600 dark:text-white/60 2xl:max-w-145 2xl:text-[14px]">
                  Reset your password to regain access to the scanning platform,
                  restore your protected session, and continue monitoring network
                  security safely.
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
                      Password Recovery
                    </span>
                  </div>

                  <h2 className="text-[25px] font-bold tracking-tight text-slate-900 dark:text-white sm:text-[26px] xl:text-[28px]">
                    Forgot Password
                  </h2>

                  <p className="mt-1.5 text-[12.5px] leading-6 text-slate-500 dark:text-white/55">
                    Enter your email to verify that your account exists before
                    continuing the secure reset process.
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
                          placeholder="debra.holt@example.com"
                          className={inputClass}
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          autoComplete="email"
                        />
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
                        <div>
                          <p className="text-[12px] font-semibold text-slate-700 dark:text-white/80">
                            Secure recovery process
                          </p>
                          <p className="mt-1 text-[11px] leading-5 text-slate-500 dark:text-white/50">
                            We&apos;ll first verify your email exists in the
                            system before allowing you to continue.
                          </p>
                        </div>
                      </div>
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
                        submitting ? "opacity-70 cursor-not-allowed" : "",
                      ].join(" ")}
                    >
                      <span>
                        {submitting ? "Checking Email..." : "Continue to Reset"}
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
                          Recovery channel active
                        </span>
                      </div>

                      <div className="hidden h-4 w-px bg-slate-200 dark:bg-white/10 sm:block" />

                      <div className="inline-flex items-center gap-2 text-[10.5px] text-slate-500 dark:text-white/45">
                        <FiCheckCircle className="text-cyan-500" />
                        Reset environment ready
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