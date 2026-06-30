import React, { useRef, useState } from "react";
import { message } from "antd";
import { useNavigate, Link } from "react-router-dom";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { Login } from "../../../services/auth";
import { useAuth } from "../../../contexts/AuthContext";
import { useStateContext } from "../../../contexts/ProviderContext";
import AuthLayout from "../_shared/AuthLayout";
import AnimationSuccess from "../animation";

const inputCls = [
  "w-full border px-4 py-2.5 text-sm outline-none transition",
  "border-gray-300 dark:border-white/10",
  "bg-white dark:bg-white/5",
  "text-gray-800 dark:text-white/85",
  "placeholder:text-gray-400 dark:placeholder:text-white/25",
  "focus:border-gray-500 dark:focus:border-white/30",
  "focus:ring-2 focus:ring-gray-100 dark:focus:ring-white/5",
].join(" ");

const LoginPage: React.FC = () => {
  const navigate           = useNavigate();
  const { refreshMe }      = useAuth();
  const { currentColor }   = useStateContext();
  const isMounted          = useRef(true);

  const [email,      setEmail]      = useState("");
  const [password,   setPassword]   = useState("");
  const [showPw,     setShowPw]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState("");
  const [showAnim,   setShowAnim]   = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("กรุณากรอก Email และ Password");
      return;
    }

    try {
      setSubmitting(true);
      const res = await Login({ email: email.trim(), password });

      if (res.require_totp) {
        navigate("/otp", { state: { type: "totp" } });
        return;
      }
      if (res.require_email_otp) {
        navigate("/otp", {
          state: { type: "email_otp", maskedEmail: res.masked_email ?? "" },
        });
        return;
      }

      const role = (res.user?.role ?? "").toLowerCase();
      if (role === "admin" || role === "user") {
        message.success("Login success");
        // Show animation FIRST — before refreshMe so LoginPage stays mounted.
        // onFinished will call refreshMe then navigate once animation ends.
        setShowAnim(true);
        return;
      }

      setError("บัญชีนี้ไม่มีสิทธิ์เข้าใช้งาน");
    } catch (err: any) {
      setError(
        err?.response?.data?.error || err?.message || "Login ไม่สำเร็จ กรุณาลองใหม่"
      );
    } finally {
      if (isMounted.current) setSubmitting(false);
    }
  };

  return (
    <>
      <AuthLayout variant="login">
        {/* ── Heading ── */}
        <h2 className="text-[2rem] font-bold text-center text-gray-900 dark:text-white/90 mb-1">
          Argus
        </h2>
        <p className="text-center text-sm text-gray-500 dark:text-white/45 mb-7">
          Login into your pages account
        </p>

        {error && (
          <div className="mb-4 border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-800 dark:text-white/80 mb-1.5">
              Username or Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Enter Your Email"
              autoComplete="email"
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-800 dark:text-white/80 mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter Password"
                autoComplete="current-password"
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
          </div>

          {/* Keep signed in  ←→  Forgot Password */}
          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="w-4 h-4 border-gray-300 cursor-pointer"
                style={{ accentColor: currentColor }}
              />
              <span className="text-sm text-gray-600 dark:text-white/55">Keep me signed in</span>
            </label>
            <Link
              to="/forgot-password"
              style={{ color: currentColor }}
              className="text-sm hover:opacity-80 transition-opacity whitespace-nowrap"
            >
              Forgot Password
            </Link>
          </div>

          <button
            type="submit"
            disabled={submitting}
            style={{ backgroundColor: submitting ? undefined : currentColor }}
            className="w-full text-white font-semibold py-3 text-sm transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-400 mt-1"
          >
            {submitting ? "Signing In..." : "Sign In"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 dark:text-white/40 mt-6">
          New to Argus?{" "}
          <Link to="/register" style={{ color: currentColor }} className="hover:opacity-80 font-medium transition-opacity">
            Create an Account
          </Link>
        </p>
      </AuthLayout>

      {/* ── Success animation overlay — rendered while still on /login (unauthenticated),
               so LoginPage stays mounted the full 3.8 s. refreshMe is called inside
               onFinished so auth updates only AFTER the animation completes. ── */}
      {showAnim && (
        <AnimationSuccess
          onFinished={async () => {
            try { await refreshMe(); } catch { /* non-critical */ }
            navigate("/admin", { replace: true });
          }}
        />
      )}
    </>
  );
};

export default LoginPage;
