import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
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
} from "react-icons/fi";
import { FaNetworkWired } from "react-icons/fa";
import { Login } from "../../services/auth";
import { VerifyTOTPLogin } from "../../services/totp";
import {
  SendOTPForSignUp,
  CheckUserEmail,
  SendOTP,
  ListEmailAndPhoneNumber,
} from "../../services";
import {
  GetPasswordPolicy,
  validatePasswordAgainstPolicy,
  type PasswordPolicy,
} from "../../services/passwordpolicy";
import { pathOpenVas } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import ModalOTPSignUp from "../../Model/ModalOTPSignUp";
import ModalOTP from "../../Model/ModalOTP";
import travelPhoto from "../../assets/login-photo.jpg";
import greenboneIcon from "../../assets/logo-light.svg";

type SignUpFormData = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  location: string;
  position: string;
};

type ViewMode = "login" | "signup" | "forgot" | "reset" | "totp";

type EmailAndPhoneNumberResponse = {
  id: number;
  email: string;
  phone_number: string;
};

type DuplicateErrors = {
  email: string;
  phone_number: string;
};

const ANIM_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const ANIM_DURATION = "1100ms";

const imagePreloadCache = new Map<string, Promise<void>>();

const preloadImage = (src: string): Promise<void> => {
  if (!src || typeof window === "undefined") {
    return Promise.resolve();
  }

  const cached = imagePreloadCache.get(src);
  if (cached) {
    return cached;
  }

  const promise = new Promise<void>((resolve) => {
    const img = new Image();

    const finish = () => {
      if (typeof img.decode === "function") {
        img.decode().catch(() => undefined).finally(resolve);
        return;
      }

      resolve();
    };

    img.decoding = "async";
    img.onload = finish;
    img.onerror = () => resolve();
    img.src = src;
  });

  imagePreloadCache.set(src, promise);
  return promise;
};


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

  // TOTP step
  const [totpCode,        setTotpCode]        = useState("");
  const [totpSubmitting,  setTotpSubmitting]  = useState(false);
  const [totpError,       setTotpError]       = useState("");

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
  const [policy, setPolicy] = useState<PasswordPolicy | null>(null);

  const [pendingSignupData, setPendingSignupData] = useState<SignUpFormData>({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    phone_number: "",
    location: "",
    position: "",
  });

  const openGreenbone = () => {
    window.open(pathOpenVas, "_blank", "noopener,noreferrer");
  };

  const [signupForm, setSignupForm] = useState<SignUpFormData>({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    phone_number: "",
    location: "",
    position: "",
  });

  const [existingContacts, setExistingContacts] = useState<
    EmailAndPhoneNumberResponse[]
  >([]);//@ts-ignore
  const [loadingExistingContacts, setLoadingExistingContacts] = useState(false);
  const [duplicateErrors, setDuplicateErrors] = useState<DuplicateErrors>({
    email: "",
    phone_number: "",
  });
  const [phoneValidationError, setPhoneValidationError] = useState("");

  const isSignUp = viewMode === "signup";

  const hasFetchedContactsRef = useRef(false);
  const isFetchingContactsRef = useRef(false);
  const isMountedRef = useRef(false);
  const isPreparingLoginAnimationRef = useRef(false);

  const inputBase =
    "h-[40px] w-full rounded-xl border border-slate-200/90 bg-white/85 dark:bg-white/[0.06] dark:border-white/10 pl-10 pr-10 text-[12px] text-slate-700 dark:text-white/85 outline-none transition-all duration-300 placeholder:text-slate-400 dark:placeholder:text-white/30 focus:border-cyan-400 dark:focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100/70 dark:focus:ring-cyan-500/15 shadow-sm dark:shadow-none";

  const labelBase =
    "mb-1 block pl-1 text-[9px] font-semibold uppercase tracking-[0.10em] text-slate-500 dark:text-white/45";

  const panelTitleClass =
    "bg-linear-to-r from-cyan-500 via-sky-500 to-violet-500 bg-clip-text text-transparent font-extrabold leading-none";

  const sectionBadgeClass =
    "mb-3 inline-flex items-center gap-1.5 rounded-full border border-cyan-200/70 bg-cyan-50/80 dark:bg-cyan-500/10 dark:border-cyan-400/20 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-cyan-700 dark:text-cyan-300 shadow-sm dark:shadow-none";

  const subtleCardClass =
    "rounded-[16px] border border-slate-200/80 dark:border-white/10 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.68)_0%,rgba(2,6,23,0.92)_100%)] p-3 shadow-[0_12px_30px_rgba(47,128,237,0.08)] dark:shadow-none";

  const primaryButtonClass =
    "inline-flex h-[38px] min-w-[130px] items-center justify-center rounded-2xl bg-linear-to-r from-cyan-500 via-sky-500 to-violet-500 text-white shadow-sm shadow-[0_18px_34px_rgba(47,128,237,0.28)] transition-all duration-300 hover:translate-y-[-1px] hover:shadow-[0_20px_36px_rgba(47,128,237,0.34)] disabled:cursor-not-allowed disabled:opacity-70";

  const duplicateFieldClass =
    "mt-1 pl-1 text-[11px] font-medium text-red-600 dark:text-red-400";

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    void preloadImage(travelPhoto);
    void preloadImage(greenboneIcon);
    GetPasswordPolicy().then(setPolicy).catch(() => {});
  }, []);

  const normalizeEmail = (value: string) => value.trim().toLowerCase();
  const normalizePhone = (value: string) => value.replace(/\D/g, "").trim();

  const validateThaiPhoneNumber = useCallback((value: string) => {
    const phone = normalizePhone(value);

    if (!phone) return "";
    if (!phone.startsWith("0")) return "เบอร์โทรต้องขึ้นต้นด้วย 0";
    if (phone.length > 10) return "เบอร์โทรต้องไม่เกิน 10 ตัว";
    if (phone.length < 10) return "เบอร์โทรต้องมี 10 ตัว";
    return "";
  }, []);

  const checkDuplicateFields = useCallback(
    (email: string, phoneNumber: string) => {
      const normalizedEmail = normalizeEmail(email);
      const normalizedPhone = normalizePhone(phoneNumber);

      let emailError = "";
      let phoneError = "";

      if (normalizedEmail) {
        const emailExists = existingContacts.some(
          (item) => normalizeEmail(item.email) === normalizedEmail
        );
        if (emailExists) {
          emailError = "อีเมลนี้ถูกใช้งานแล้ว";
        }
      }

      if (normalizedPhone) {
        const phoneExists = existingContacts.some(
          (item) => normalizePhone(item.phone_number) === normalizedPhone
        );
        if (phoneExists) {
          phoneError = "เบอร์โทรนี้ถูกใช้งานแล้ว";
        }
      }

      return {
        email: emailError,
        phone_number: phoneError,
      };
    },
    [existingContacts]
  );

  const loadExistingContacts = useCallback(
    async (force = false) => {
      if (isFetchingContactsRef.current) return existingContacts;
      if (!force && hasFetchedContactsRef.current && existingContacts.length > 0) {
        return existingContacts;
      }

      try {
        isFetchingContactsRef.current = true;

        if (isMountedRef.current) {
          setLoadingExistingContacts(true);
        }

        const data = await ListEmailAndPhoneNumber();
        const normalized = Array.isArray(data) ? data : [];

        if (isMountedRef.current) {
          setExistingContacts(normalized);
        }

        hasFetchedContactsRef.current = true;
        return normalized;
      } catch (error) {
        console.error("ListEmailAndPhoneNumber error:", error);

        if (isMountedRef.current) {
          setExistingContacts([]);
        }

        return [];
      } finally {
        if (isMountedRef.current) {
          setLoadingExistingContacts(false);
        }
        isFetchingContactsRef.current = false;
      }
    },
    [existingContacts]
  );

  useEffect(() => {
    if (hasFetchedContactsRef.current) return;
    void loadExistingContacts();
  }, [loadExistingContacts]);

  useEffect(() => {
    if (viewMode !== "signup") return;
    if (hasFetchedContactsRef.current) return;
    void loadExistingContacts();
  }, [viewMode, loadExistingContacts]);

  const computedPhoneValidationError = useMemo(() => {
    if (viewMode !== "signup") return "";
    return validateThaiPhoneNumber(signupForm.phone_number);
  }, [signupForm.phone_number, validateThaiPhoneNumber, viewMode]);

  const computedDuplicateErrors = useMemo(() => {
    if (viewMode !== "signup") {
      return { email: "", phone_number: "" };
    }

    return checkDuplicateFields(signupForm.email, signupForm.phone_number);
  }, [signupForm.email, signupForm.phone_number, checkDuplicateFields, viewMode]);

  useEffect(() => {
    setPhoneValidationError(computedPhoneValidationError);
    setDuplicateErrors(computedDuplicateErrors);
  }, [computedPhoneValidationError, computedDuplicateErrors]);

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
    setDuplicateErrors({
      email: "",
      phone_number: "",
    });
    setPhoneValidationError("");
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

      const res = await Login({ email: loginEmail, password: loginPassword });

      // Backend requires TOTP verification
      if (res?.require_totp) {
        setTotpCode("");
        setTotpError("");
        setViewMode("totp");
        return;
      }

      const role = (res?.user?.role ?? "").toLowerCase();

      if (role === "admin" || role === "user") {
        message.success("login success");
        try { await refreshMe(); } catch { /* non-critical */ }
        navigate("/admin", { replace: true });
        return;
      } else {
        setLoginError("บัญชีนี้ไม่มีสิทธิ์เข้าใช้งาน");
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "Login ไม่สำเร็จ กรุณาลองใหม่";
      setLoginError(msg);
    } finally {
      isPreparingLoginAnimationRef.current = false;
      if (isMountedRef.current) setLoginSubmitting(false);
    }
  };

  const handleTOTPSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTotpError("");

    if (totpCode.length !== 6) {
      setTotpError("กรุณากรอกรหัส 6 หลักจาก Authenticator App");
      return;
    }

    try {
      setTotpSubmitting(true);
      await VerifyTOTPLogin(totpCode);
      message.success("login success");
      try { await refreshMe(); } catch { /* non-critical */ }
      navigate("/admin", { replace: true });
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "รหัส TOTP ไม่ถูกต้องหรือหมดอายุ";
      setTotpError(msg);
    } finally {
      if (isMountedRef.current) setTotpSubmitting(false);
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
    const minLen = policy?.min_length ?? 8;
    if (newPassword.length < minLen)
      return `รหัสผ่านต้องมีอย่างน้อย ${minLen} ตัวอักษร`;
    if ((policy?.require_uppercase ?? false) && !/[A-Z]/.test(newPassword))
      return "รหัสผ่านต้องมีตัวพิมพ์ใหญ่อย่างน้อย 1 ตัว";
    if ((policy?.require_number ?? false) && !/[0-9]/.test(newPassword))
      return "รหัสผ่านต้องมีตัวเลขอย่างน้อย 1 ตัว";
    if ((policy?.require_special ?? false) && !/[^A-Za-z0-9]/.test(newPassword))
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

    if (name === "phone_number") {
      const sanitizedPhone = value.replace(/\D/g, "").slice(0, 10);

      setSignupForm((prev) => ({
        ...prev,
        phone_number: sanitizedPhone,
      }));
      return;
    }

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
    if (computedDuplicateErrors.email) {
      message.error("อีเมลนี้ถูกใช้งานแล้ว");
      return false;
    }
    if (!signupForm.password.trim()) {
      message.error("กรุณากรอก Password");
      return false;
    }
    const pwError = validatePasswordAgainstPolicy(signupForm.password, policy);
    if (pwError) {
      message.error(pwError);
      return false;
    }
    if (!signupForm.phone_number.trim()) {
      message.error("กรุณากรอก Phone Number");
      return false;
    }

    if (computedPhoneValidationError) {
      message.error(computedPhoneValidationError);
      return false;
    }

    if (computedDuplicateErrors.phone_number) {
      message.error("เบอร์โทรนี้ถูกใช้งานแล้ว");
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

    const latestContacts = await loadExistingContacts(true);
    const latestPhoneError = validateThaiPhoneNumber(signupForm.phone_number);

    const latestDuplicateCheck = (() => {
      const normalizedEmail = normalizeEmail(signupForm.email);
      const normalizedPhone = normalizePhone(signupForm.phone_number);

      let emailError = "";
      let phoneError = "";

      if (normalizedEmail) {
        const emailExists = latestContacts.some(
          (item) => normalizeEmail(item.email) === normalizedEmail
        );
        if (emailExists) emailError = "อีเมลนี้ถูกใช้งานแล้ว";
      }

      if (normalizedPhone) {
        const phoneExists = latestContacts.some(
          (item) => normalizePhone(item.phone_number) === normalizedPhone
        );
        if (phoneExists) phoneError = "เบอร์โทรนี้ถูกใช้งานแล้ว";
      }

      return {
        email: emailError,
        phone_number: phoneError,
      };
    })();

    setPhoneValidationError(latestPhoneError);
    setDuplicateErrors(latestDuplicateCheck);

    if (latestPhoneError) {
      message.error(latestPhoneError);
      return;
    }

    if (latestDuplicateCheck.email || latestDuplicateCheck.phone_number) {
      if (latestDuplicateCheck.email) {
        message.error("อีเมลนี้ถูกใช้งานแล้ว");
      } else if (latestDuplicateCheck.phone_number) {
        message.error("เบอร์โทรนี้ถูกใช้งานแล้ว");
      }
      return;
    }

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
      message.success(
        (result as any).message || "ส่ง OTP สำเร็จ กรุณายืนยันอีเมล"
      );
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
  };

  const renderMotionStyles = () => (
    <style>{`
      @keyframes scanBeam {
        0% { transform: translateY(-110%); opacity: 0; }
        18% { opacity: 0.95; }
        50% { opacity: 0.55; }
        100% { transform: translateY(220%); opacity: 0; }
      }
      @keyframes floatSoft {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-10px); }
      }
      @keyframes floatSoftAlt {
        0%, 100% { transform: translateY(0px) scale(1); }
        50% { transform: translateY(8px) scale(1.03); }
      }
      @keyframes pulseGlow {
        0%, 100% { opacity: 0.55; box-shadow: 0 0 0 rgba(34,211,238,0); }
        50% { opacity: 1; box-shadow: 0 0 18px rgba(34,211,238,0.38); }
      }
      @keyframes orbitLine {
        0% { transform: translateX(-20px); opacity: 0.2; }
        50% { opacity: 0.8; }
        100% { transform: translateX(20px); opacity: 0.2; }
      }
      @keyframes compactCardIntro {
        0% {
          opacity: 0;
          transform: translateY(24px) scale(0.975);
          filter: blur(10px);
        }
        100% {
          opacity: 1;
          transform: translateY(0) scale(1);
          filter: blur(0);
        }
      }
      @keyframes compactContentReveal {
        0% {
          opacity: 0;
          transform: translateY(10px);
        }
        100% {
          opacity: 1;
          transform: translateY(0);
        }
      }
      @keyframes compactOrbFloat {
        0%, 100% { transform: translate3d(0,0,0); }
        50% { transform: translate3d(0,-10px,0); }
      }
      @keyframes compactGlowPulse {
        0%, 100% { opacity: 0.55; transform: scale(1); }
        50% { opacity: 1; transform: scale(1.08); }
      }
      @keyframes compactBorderScan {
        0% { transform: translateX(-120%); opacity: 0; }
        20% { opacity: 1; }
        80% { opacity: 1; }
        100% { transform: translateX(120%); opacity: 0; }
      }
    `}</style>
  );

  const renderDeviceDecoration = () => (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14.5 overflow-hidden">
      <div className="absolute bottom-3 left-4 flex items-center gap-2">
        <span
          className="h-2 w-2 rounded-full bg-cyan-400"
          style={{ animation: "pulseGlow 2.6s ease-in-out infinite" }}
        />
        <span className="h-px w-14 bg-linear-to-r from-cyan-400 via-sky-400 to-violet-400 opacity-80" />
      </div>
      <div className="absolute bottom-3 right-4 flex items-center gap-2">
        <span className="h-px w-14 bg-linear-to-r from-violet-400 via-sky-400 to-cyan-400 opacity-80" />
        <span
          className="h-2 w-2 rounded-full bg-violet-400"
          style={{ animation: "pulseGlow 2.6s ease-in-out infinite 0.6s" }}
        />
      </div>
    </div>
  );



  const renderPhotoPanel = () => (
    <div className="relative h-full overflow-hidden bg-slate-950">
      <img
        src={travelPhoto}
        alt="Network Security"
        className="absolute inset-0 h-full w-full object-cover"
      />

      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.38)_0%,rgba(2,6,23,0.56)_38%,rgba(2,6,23,0.84)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(6,182,212,0.22),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(139,92,246,0.18),transparent_32%)]" />

      <div className="absolute inset-0 opacity-[0.11]">
        <div className="h-full w-full bg-[linear-gradient(rgba(255,255,255,0.10)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.10)_1px,transparent_1px)] bg-size-[22px_22px]" />
      </div>

      <div
        className="absolute inset-x-[18%] top-[-25%] h-[55%] rounded-full bg-cyan-400/20 blur-3xl"
        style={{ animation: "floatSoftAlt 7s ease-in-out infinite" }}
      />
      <div
        className="absolute inset-x-0 top-[-20%] h-[42%] bg-linear-to-b from-cyan-300/18 via-sky-300/8 to-transparent"
        style={{ animation: "scanBeam 4.8s linear infinite" }}
      />

      <div className="absolute inset-x-0 top-0 p-6 text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-300/90">
              Network Security Scan
            </p>
            <h1 className="mt-2 text-[28px] font-extrabold leading-none">
              Argus
            </h1>
            <p className="mt-3 max-w-57.5 text-[11px] leading-5 text-slate-200/80">
              Secure access for scan operations, device visibility, and report review.
            </p>
          </div>

          <div className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 backdrop-blur-md">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-white/90">
              <FiShield className="text-cyan-300" />
              Protected
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full bg-cyan-400"
            style={{ animation: "pulseGlow 2.2s ease-in-out infinite" }}
          />
          <span
            className="h-px w-16 bg-white/20"
            style={{ animation: "orbitLine 2.8s ease-in-out infinite" }}
          />
          <span
            className="h-2 w-2 rounded-full bg-sky-400"
            style={{ animation: "pulseGlow 2.2s ease-in-out infinite 0.4s" }}
          />
        </div>
      </div>

      <div className="absolute bottom-16 left-5 right-5">
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: <FaNetworkWired className="text-[15px]" />, label: "Network", delay: "0s" },
            { icon: <FiWifi className="text-[15px]" />, label: "Wireless", delay: "0.45s" },
            { icon: <FiServer className="text-[15px]" />, label: "Access Type", delay: "0.9s" },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-white/10 bg-slate-900/45 px-3 py-2 backdrop-blur-md"
              style={{ animation: `floatSoft 4.8s ease-in-out infinite ${item.delay}` }}
            >
              <div className="flex items-center gap-2 text-white">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl bg-white/10 text-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.14)]">
                  {item.icon}
                </span>
                <div className="min-w-0">
                  <div className="text-[9px] uppercase tracking-[0.16em] text-slate-300/60">
                    Device
                  </div>
                  <div className="text-[11px] font-semibold text-white/95">
                    {item.label}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute bottom-5 left-5 right-5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openGreenbone}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-white/12 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-100 backdrop-blur-md transition-all duration-200 hover:-translate-y-px hover:border-emerald-200/45 hover:bg-white/18 hover:text-white active:translate-y-0"
          >
            <img
              src={greenboneIcon}
              alt="Greenbone"
              className="h-4 w-4 object-contain"
            />
            <span>Live Scan</span>
          </button>
        </div>
      </div>
    </div>
  );

  const renderTopWire = () => (
    <div className="pointer-events-none absolute right-5 top-5">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_14px_rgba(34,211,238,0.95)]" />
        <span className="h-px w-8 bg-linear-to-r from-cyan-400 via-sky-400 to-violet-400" />
        <span className="h-2 w-2 rounded-full bg-violet-400 shadow-[0_0_14px_rgba(167,139,250,0.95)]" />
      </div>
    </div>
  );

  const renderSectionBadge = (label: string) => (
    <div className={sectionBadgeClass}>
      <FaNetworkWired className="text-[9px]" />
      {label}
    </div>
  );

  const renderErrorBox = (text: string) =>
    text ? (
      <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] text-red-600 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300">
        {text}
      </div>
    ) : null;

  const renderTOTPForm = () => (
    <div className="w-full max-w-[320px]">
      <div className="text-center">
        {renderSectionBadge("2-Factor Auth")}
        <h2 className={`${panelTitleClass} text-[27px] tracking-[-0.04em]`}>
          Authenticator
        </h2>
        <p className="mt-1.5 text-[11px] leading-5 text-slate-500 dark:text-white/55">
          กรอกรหัส 6 หลักจาก Authenticator App ของคุณ
        </p>
      </div>

      {totpError ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-center text-[12px] text-red-600 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300">
          {totpError}
        </div>
      ) : null}

      <form onSubmit={handleTOTPSubmit} className="mt-5 space-y-4">
        <div>
          <label className={labelBase}>รหัส TOTP</label>
          <div className="relative">
            <FiShield className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-cyan-600 dark:text-cyan-300" />
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={totpCode}
              onChange={e => { setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setTotpError(""); }}
              placeholder="000 000"
              autoFocus
              className="h-10 w-full rounded-xl border border-slate-200/90 bg-white/85 dark:bg-white/6 dark:border-white/10 pl-10 pr-4 text-center font-mono text-[18px] tracking-[0.35em] text-slate-700 dark:text-white/85 outline-none transition-all duration-300 focus:border-cyan-400 dark:focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100/70 dark:focus:ring-cyan-500/15 shadow-sm dark:shadow-none"
            />
          </div>
          <p className="mt-1.5 pl-1 text-[10px] text-slate-400 dark:text-white/30">
            รหัสจาก Google Authenticator หรือ Authy
          </p>
        </div>

        <div className="flex justify-center">
          <button
            type="submit"
            disabled={totpSubmitting || totpCode.length !== 6}
            className={primaryButtonClass}
          >
            {totpSubmitting ? "Verifying..." : "Verify & Sign In"}
          </button>
        </div>

        <div className="text-center text-[12px] text-slate-600 dark:text-white/65">
          <button
            type="button"
            onClick={() => { setViewMode("login"); setTotpCode(""); setTotpError(""); }}
            className="font-extrabold text-slate-900 transition hover:text-cyan-600 dark:text-white dark:hover:text-cyan-300"
          >
            ← กลับไปหน้า Login
          </button>
        </div>
      </form>
    </div>
  );

  const renderLoginForm = (compact = false) => (
    <div className={compact ? "w-full max-w-170" : "w-full max-w-77.5"}>
      <div className="text-center">

        <h2
          className={`${panelTitleClass} ${compact ? "text-[34px] sm:text-[38px]" : "text-[30px]"
            } tracking-[-0.04em]`}
        >
          Welcome
        </h2>
        <p
          className={`mt-1.5 ${compact ? "text-[12px] sm:text-[13px]" : "text-[11px]"
            } text-slate-500 dark:text-white/55`}
        >
          Sign in to the security scan console
        </p>
      </div>

      {renderErrorBox(loginError)}

      <form onSubmit={handleLoginSubmit} className={compact ? "mt-6" : "mt-5"}>
        <div className={compact ? "space-y-4" : "space-y-3"}>
          <div>
            <label
              className={
                compact
                  ? "mb-1.5 block pl-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-white/45"
                  : labelBase
              }
            >
              Email Address
            </label>
            <div className="relative">
              <FiMail
                className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 ${compact ? "text-[15px]" : "text-[13px]"
                  } text-cyan-600 dark:text-cyan-300`}
              />
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="admin@network.local"
                autoComplete="email"
                className={
                  compact
                    ? "h-12.5 sm:h-14 w-full rounded-2xl border border-slate-200/90 bg-white/92 dark:bg-white/6 dark:border-white/10 pl-11 pr-11 text-[13px] sm:text-[15px] text-slate-700 dark:text-white/85 outline-none transition-all duration-300 placeholder:text-slate-400 dark:placeholder:text-white/30 focus:border-cyan-400 dark:focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100/75 dark:focus:ring-cyan-500/15 shadow-[0_10px_24px_rgba(15,23,42,0.04)] dark:shadow-none"
                    : inputBase
                }
              />
            </div>
          </div>

          <div>
            <label
              className={
                compact
                  ? "mb-1.5 block pl-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-white/45"
                  : labelBase
              }
            >
              Password
            </label>
            <div className="relative">
              <FiLock
                className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 ${compact ? "text-[15px]" : "text-[13px]"
                  } text-cyan-600 dark:text-cyan-300`}
              />
              <input
                type={showLoginPassword ? "text" : "password"}
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Enter secure password"
                autoComplete="current-password"
                className={
                  compact
                    ? "h-12.5 sm:h-14 w-full rounded-2xl border border-slate-200/90 bg-white/92 dark:bg-white/6 dark:border-white/10 pl-11 pr-11 text-[13px] sm:text-[15px] text-slate-700 dark:text-white/85 outline-none transition-all duration-300 placeholder:text-slate-400 dark:placeholder:text-white/30 focus:border-cyan-400 dark:focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100/75 dark:focus:ring-cyan-500/15 shadow-[0_10px_24px_rgba(15,23,42,0.04)] dark:shadow-none"
                    : inputBase
                }
              />
              <button
                type="button"
                onClick={() => setShowLoginPassword((prev) => !prev)}
                className={`absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-cyan-600 dark:text-white/40 dark:hover:text-cyan-300`}
                aria-label={showLoginPassword ? "Hide password" : "Show password"}
              >
                {showLoginPassword ? (
                  <FiEyeOff className={compact ? "text-[16px]" : "text-[14px]"} />
                ) : (
                  <FiEye className={compact ? "text-[16px]" : "text-[14px]"} />
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-3.5 flex items-center justify-between gap-2">
          {compact ? (
            <button
              type="button"
              onClick={() => {
                setLoginError("");
                setViewMode("signup");
              }}
              className="rounded-full bg-[#f2f8ff] px-2.5 py-0.5 text-[10px] font-semibold text-slate-600 transition hover:text-cyan-600 dark:bg-white/8 dark:text-white/65 dark:hover:text-cyan-300"
            >
              Sign Up
            </button>
          ) : (
            <div className="rounded-full bg-[#f2f8ff] px-2 py-0.5 text-[9px] font-medium text-slate-500 dark:bg-white/8 dark:text-white/55">
              Authorized access
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setForgotError("");
              setForgotEmail(loginEmail.trim());
              setViewMode("forgot");
            }}
            className={
              compact
                ? "text-[11px] font-semibold text-slate-500 transition hover:text-cyan-600 dark:text-white/55 dark:hover:text-cyan-300"
                : "text-[10px] font-semibold text-slate-500 transition hover:text-cyan-600 dark:text-white/55 dark:hover:text-cyan-300"
            }
          >
            Forgot your password?
          </button>
        </div>

        <div className="mt-6 flex justify-center">
          <button
            type="submit"
            disabled={loginSubmitting}
            className={
              compact
                ? "inline-flex h-11 min-w-42.5 items-center justify-center rounded-2xl bg-linear-to-r from-cyan-500 via-sky-500 to-violet-500 text-[15px] text-white shadow-[0_18px_34px_rgba(47,128,237,0.28)] transition-all duration-300 hover:translate-y-px hover:shadow-[0_20px_36px_rgba(47,128,237,0.34)] disabled:cursor-not-allowed disabled:opacity-70"
                : primaryButtonClass
            }
          >
            {loginSubmitting ? "Logging In..." : "Login"}
          </button>
        </div>

        {!compact && (
          <>
            <div className="mt-6 flex items-center gap-2">
              <div className="h-px flex-1 bg-[#d7e6fb] dark:bg-white/10" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-white/30">
                OR
              </span>
              <div className="h-px flex-1 bg-[#d7e6fb] dark:bg-white/10" />
            </div>

            <div className="mt-4 text-center text-[12px] text-slate-600 dark:text-white/65">
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setLoginError("");
                  setViewMode("signup");
                }}
                className="font-extrabold text-slate-900 transition hover:text-cyan-600 dark:text-white dark:hover:text-cyan-300"
              >
                Sign Up
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );

  const renderForgotForm = () => (
    <div className="w-full max-w-[320px]">
      <div className="text-center">
        {renderSectionBadge("Recovery")}
        <h2 className={`${panelTitleClass} text-[27px] tracking-[-0.04em]`}>
          Forgot Password
        </h2>
        <p className="mt-1.5 text-[11px] leading-5 text-slate-500 dark:text-white/55">
          Verify that your email exists before continuing the password reset flow.
        </p>
      </div>

      {renderErrorBox(forgotError)}

      <form onSubmit={handleForgotSubmit} className="mt-5">
        <div>
          <label className={labelBase}>Email Address</label>
          <div className="relative">
            <FiMail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-cyan-600 dark:text-cyan-300" />
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

        <div className={`mt-3 ${subtleCardClass}`}>
          <div className="flex items-start gap-2">
            <div className="mt-0.5 rounded-lg bg-[#e9f6ff] p-2 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-300">
              <FiRefreshCw className="text-[14px]" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-slate-800 dark:text-white/85">
                Secure recovery pipeline
              </p>
              <p className="mt-1 text-[11px] leading-4.5 text-slate-500 dark:text-white/55">
                The system checks your email first, then allows the OTP-based
                reset process to continue safely.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-center">
          <button
            type="submit"
            disabled={forgotSubmitting}
            className={primaryButtonClass}
          >
            {forgotSubmitting ? "Checking..." : "Continue"}
          </button>
        </div>

        <div className="mt-4 text-center text-[12px] text-slate-600 dark:text-white/65">
          Remember your password?{" "}
          <button
            type="button"
            onClick={() => setViewMode("login")}
            className="font-extrabold text-slate-900 transition hover:text-cyan-600 dark:text-white dark:hover:text-cyan-300"
          >
            Sign In
          </button>
        </div>
      </form>
    </div>
  );

  const renderResetForm = () => (
    <div className="w-full max-w-82.5">
      <div className="text-center">
        {renderSectionBadge("Reset")}
        <h2 className={`${panelTitleClass} text-[27px] tracking-[-0.04em]`}>
          Reset Password
        </h2>
        <p className="mt-1.5 text-[11px] leading-5 text-slate-500 dark:text-white/55">
          Set a new password for
          <br />
          <span className="font-semibold text-slate-700 dark:text-white/85">
            {verifiedResetEmail || "your account"}
          </span>
        </p>
      </div>

      {renderErrorBox(resetError)}

      <form onSubmit={handleResetSubmit} className="mt-5 space-y-3">
        <div>
          <label className={labelBase}>New Password</label>
          <div className="relative">
            <FiKey className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-cyan-600 dark:text-cyan-300" />
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
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-cyan-600 dark:text-white/40 dark:hover:text-cyan-300"
              aria-label={
                showResetPassword ? "Hide new password" : "Show new password"
              }
            >
              {showResetPassword ? (
                <FiEyeOff className="text-[14px]" />
              ) : (
                <FiEye className="text-[14px]" />
              )}
            </button>
          </div>
        </div>

        <div>
          <label className={labelBase}>Confirm Password</label>
          <div className="relative">
            <FiLock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-cyan-600 dark:text-cyan-300" />
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
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-cyan-600 dark:text-white/40 dark:hover:text-cyan-300"
              aria-label={
                showConfirmResetPassword
                  ? "Hide confirm password"
                  : "Show confirm password"
              }
            >
              {showConfirmResetPassword ? (
                <FiEyeOff className="text-[14px]" />
              ) : (
                <FiEye className="text-[14px]" />
              )}
            </button>
          </div>
        </div>

        <div className={subtleCardClass}>
          <div className="flex items-start gap-2">
            <div className="mt-0.5 rounded-lg bg-[#e9f6ff] p-2 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-300">
              <FiShield className="text-[14px]" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-slate-800 dark:text-white/85">
                Credential hardening
              </p>
              <p className="mt-1 text-[11px] leading-4.5 text-slate-500 dark:text-white/55">
                Use at least 8 characters with uppercase, lowercase, numbers,
                and symbols for stronger protection.
              </p>

              <div className="mt-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-medium text-slate-500 dark:text-white/50">
                    Password strength
                  </span>
                  <span className="text-[10px] font-semibold text-cyan-600 dark:text-cyan-300">
                    {passwordStrengthLabel}
                  </span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-[#dfeaf8] dark:bg-white/10">
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
            className={primaryButtonClass}
          >
            {resetSubmitting ? "Sending OTP..." : "Confirm Reset"}
          </button>
        </div>

        <div className="text-center text-[14px] text-slate-600 dark:text-white/65">
          Back to{" "}
          <button
            type="button"
            onClick={() => setViewMode("login")}
            className="font-extrabold text-slate-900 transition hover:text-cyan-600 dark:text-white dark:hover:text-cyan-300"
          >
            Sign In
          </button>
        </div>
      </form>
    </div>
  );

  const renderSignUpForm = () => (
    <div className="w-full max-w-110">
      <div className="text-center">
        <h2 className={`${panelTitleClass} text-[29px] tracking-[-0.04em]`}>
          Create Account
        </h2>
        <p className="mt-1.5 text-[11px] text-slate-500 dark:text-white/55">
          Register access for the network scan dashboard
        </p>
      </div>

      <form onSubmit={handleSignUpSubmit} className="mt-5">
        <div className="space-y-3.5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelBase}>First Name</label>
              <div className="relative">
                <FiUser className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-cyan-600 dark:text-cyan-300" />
                <input
                  type="text"
                  name="first_name"
                  value={signupForm.first_name}
                  onChange={handleSignupChange}
                  placeholder="Argus"
                  className={inputBase}
                />
              </div>
            </div>

            <div>
              <label className={labelBase}>Last Name</label>
              <div className="relative">
                <FiUser className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-cyan-600 dark:text-cyan-300" />
                <input
                  type="text"
                  name="last_name"
                  value={signupForm.last_name}
                  onChange={handleSignupChange}
                  placeholder="Scanner"
                  className={inputBase}
                />
              </div>
            </div>
          </div>

          <div>
            <label className={labelBase}>Email Address</label>
            <div className="relative">
              <FiMail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-cyan-600 dark:text-cyan-300" />
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
            {duplicateErrors.email ? (
              <div className={duplicateFieldClass}>{duplicateErrors.email}</div>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelBase}>Phone Number</label>
              <div className="relative">
                <FiPhone className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-cyan-600 dark:text-cyan-300" />
                <input
                  type="text"
                  name="phone_number"
                  value={signupForm.phone_number}
                  onChange={handleSignupChange}
                  placeholder="0812345678"
                  inputMode="numeric"
                  maxLength={10}
                  className={inputBase}
                />
              </div>
              {phoneValidationError ? (
                <div className={duplicateFieldClass}>{phoneValidationError}</div>
              ) : duplicateErrors.phone_number ? (
                <div className={duplicateFieldClass}>
                  {duplicateErrors.phone_number}
                </div>
              ) : null}
            </div>

            <div>
              <label className={labelBase}>Password</label>
              <div className="relative">
                <FiLock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-cyan-600 dark:text-cyan-300" />
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
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-cyan-600 dark:text-white/40 dark:hover:text-cyan-300"
                  aria-label={showSignUpPassword ? "Hide password" : "Show password"}
                >
                  {showSignUpPassword ? (
                    <FiEyeOff className="text-[14px]" />
                  ) : (
                    <FiEye className="text-[14px]" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelBase}>Location</label>
              <div className="relative">
                <FiMapPin className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-cyan-600 dark:text-cyan-300" />
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
                <FiBriefcase className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-cyan-600 dark:text-cyan-300" />
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
        </div>

        <div className="mt-5 flex justify-center">
          <button
            type="submit"
            disabled={
              signupSubmitting ||
              !!duplicateErrors.email ||
              !!duplicateErrors.phone_number ||
              !!phoneValidationError
            }
            className={primaryButtonClass}
          >
            {signupSubmitting ? "Sending OTP..." : "Sign Up"}
          </button>
        </div>

        <div className="mt-4 text-center text-[12px] text-slate-600 dark:text-white/65">
          Have an account?{" "}
          <button
            type="button"
            onClick={() => setViewMode("login")}
            className="font-extrabold text-slate-900 transition hover:text-cyan-600 dark:text-white dark:hover:text-cyan-300"
          >
            Sign In
          </button>
        </div>
      </form>
    </div>
  );

  const renderCompactPanel = () => (
    <div className="xl:hidden">
      <div className="mx-auto flex min-h-[calc(100vh-1rem)] w-full max-w-125 items-center justify-center py-4 sm:max-w-300 sm:py-5 lg:max-w-7xl">
        <div className="relative w-full max-w-115 px-3 sm:max-w-260 sm:px-8 lg:max-w-295">
          <div
            className="pointer-events-none absolute -left-6 top-8 h-24 w-24 rounded-full bg-cyan-200/55 blur-3xl dark:bg-cyan-500/15 sm:h-32 sm:w-32"
            style={{ animation: "compactOrbFloat 5.4s ease-in-out infinite" }}
          />
          <div
            className="pointer-events-none absolute -right-8 bottom-8 h-24 w-24 rounded-full bg-violet-200/55 blur-3xl dark:bg-violet-500/16 sm:h-32 sm:w-32"
            style={{ animation: "compactOrbFloat 6.2s ease-in-out infinite 0.6s" }}
          />
          <div
            className="pointer-events-none absolute left-1/2 top-0 h-20 w-20 -translate-x-1/2 rounded-full bg-sky-200/40 blur-3xl dark:bg-sky-500/10"
            style={{ animation: "compactGlowPulse 3s ease-in-out infinite" }}
          />

          <div
            className="relative overflow-hidden rounded-[26px] border border-white/80 bg-white/92 px-5 py-5 shadow-[0_20px_55px_rgba(15,23,42,0.10)] backdrop-blur-xl dark:border-white/10 dark:bg-white/5 dark:shadow-[0_24px_80px_rgba(2,8,23,0.45)] sm:px-16 sm:py-6 lg:px-20 lg:py-6"
            style={{ animation: `compactCardIntro 620ms ${ANIM_EASE}` }}
          >
            <div className="pointer-events-none absolute inset-0 opacity-[0.18] dark:opacity-[0.08]">
              <div className="h-full w-full bg-[linear-gradient(rgba(59,130,246,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.06)_1px,transparent_1px)] bg-size-[24px_24px]" />
            </div>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-cyan-300 to-transparent opacity-80 dark:via-cyan-400/70" />
            <div
              className="pointer-events-none absolute left-0 top-0 h-px w-28 bg-linear-to-r from-transparent via-cyan-300 to-transparent opacity-80"
              style={{ animation: "compactBorderScan 4.8s linear infinite" }}
            />
            <div className="pointer-events-none absolute inset-x-4 bottom-0 h-px bg-linear-to-r from-transparent via-violet-200 to-transparent opacity-80 dark:via-violet-400/40" />

            <div className="pointer-events-none absolute left-6 top-6 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.45)]" />
              <span className="h-px w-12 bg-linear-to-r from-cyan-300 via-sky-300 to-violet-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-violet-400 shadow-[0_0_12px_rgba(167,139,250,0.45)]" />
            </div>

            <div
              key={viewMode}
              className="relative flex min-h-125 items-center justify-center sm:min-h-117.5"
              style={{ animation: `compactContentReveal 420ms ${ANIM_EASE}` }}
            >
              {viewMode === "login" && renderLoginForm(true)}
              {viewMode === "forgot" && renderForgotForm()}
              {viewMode === "reset" && renderResetForm()}
              {viewMode === "signup" && renderSignUpForm()}
              {viewMode === "totp" && renderTOTPForm()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {renderMotionStyles()}

      <div className="relative min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#eef4fa_48%,#e9f1fb_100%)] px-2 py-2.5 dark:bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.14),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(139,92,246,0.12),transparent_26%),linear-gradient(180deg,#020617_0%,#081120_45%,#0b1220_100%)] sm:px-3 lg:px-4">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-35 top-30 h-55 w-55 rounded-full bg-cyan-300/25 blur-3xl dark:bg-cyan-500/12" />
          <div className="absolute -right-25 top-22.5 h-45 w-45 rounded-full bg-sky-300/20 blur-3xl dark:bg-violet-500/12" />
          <div className="absolute -bottom-40 left-[12%] h-45 w-55 rounded-full bg-blue-200/25 blur-3xl dark:bg-blue-500/10" />
          <div className="absolute bottom-[4%] right-[8%] h-40 w-40 rounded-full bg-violet-200/20 blur-3xl dark:bg-cyan-400/10" />
          <div className="absolute inset-0 opacity-[0.25] dark:opacity-[0.08]">
            <div className="h-full w-full bg-[linear-gradient(rgba(59,130,246,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.08)_1px,transparent_1px)] bg-size-[28px_28px] dark:bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)]" />
          </div>
        </div>

        <div className="mx-auto flex min-h-[calc(100vh-1rem)] max-w-280 items-center justify-center">
          {renderCompactPanel()}

          <div className="hidden xl:block relative w-full overflow-hidden rounded-[22px] border border-white/80 bg-white/80 shadow-[0_18px_54px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-white/4 dark:shadow-[0_24px_80px_rgba(2,8,23,0.55)]">
            <div className="relative h-140 overflow-hidden">
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.38)_0%,rgba(255,255,255,0.58)_100%)] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0.01)_100%)]" />

              <div
                className="absolute left-0 top-0 h-full"
                style={{
                  width: isSignUp ? "56%" : "50%",
                  right: isSignUp ? "0" : "auto",
                  left: isSignUp ? "0" : "0",
                  transform: isSignUp ? "translateX(0%)" : "translateX(100%)",
                  transition: `transform ${ANIM_DURATION} ${ANIM_EASE}, width ${ANIM_DURATION} ${ANIM_EASE}`,
                  willChange: "transform, width",
                  zIndex: isSignUp ? 10 : 20,
                }}
              >
                <div className="relative h-full overflow-hidden bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_60%,#f6f3ff_100%)] px-6 py-5 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.88)_0%,rgba(8,15,31,0.96)_58%,rgba(12,18,32,1)_100%)]">
                  <div className="absolute inset-0 opacity-30 dark:opacity-10">
                    <div className="h-full w-full bg-[linear-gradient(rgba(47,128,237,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(47,128,237,0.05)_1px,transparent_1px)] bg-size-[20px_20px] dark:bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)]" />
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
                            : "translateX(22px) scale(0.96)",
                        filter:
                          viewMode === "login" ? "blur(0px)" : "blur(3px)",
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
                            : "translateX(22px) scale(0.96)",
                        filter:
                          viewMode === "forgot" ? "blur(0px)" : "blur(3px)",
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
                            : "translateX(18px) scale(0.96)",
                        filter:
                          viewMode === "reset" ? "blur(0px)" : "blur(3px)",
                        transition: `opacity 620ms ${ANIM_EASE}, transform 760ms ${ANIM_EASE}, filter 760ms ${ANIM_EASE}`,
                        transitionDelay: viewMode === "reset" ? "80ms" : "0ms",
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
                            : "translateX(-28px) scale(0.95)",
                        filter:
                          viewMode === "signup" ? "blur(0px)" : "blur(3px)",
                        transition: `opacity 620ms ${ANIM_EASE}, transform 760ms ${ANIM_EASE}, filter 760ms ${ANIM_EASE}`,
                        transitionDelay: viewMode === "signup" ? "100ms" : "0ms",
                        pointerEvents: viewMode === "signup" ? "auto" : "none",
                      }}
                    >
                      {renderSignUpForm()}
                    </div>

                    <div
                      className="absolute inset-0 flex items-center justify-center"
                      style={{
                        opacity: viewMode === "totp" ? 1 : 0,
                        transform:
                          viewMode === "totp"
                            ? "translateX(0px) scale(1)"
                            : "translateX(22px) scale(0.96)",
                        filter: viewMode === "totp" ? "blur(0px)" : "blur(3px)",
                        transition: `opacity 620ms ${ANIM_EASE}, transform 760ms ${ANIM_EASE}, filter 760ms ${ANIM_EASE}`,
                        transitionDelay: viewMode === "totp" ? "60ms" : "0ms",
                        pointerEvents: viewMode === "totp" ? "auto" : "none",
                      }}
                    >
                      {renderTOTPForm()}
                    </div>
                  </div>
                </div>
              </div>

              <div
                className="absolute bottom-0 left-0 top-0 overflow-hidden"
                style={{
                  width: isSignUp ? "44%" : "50%",
                  transform: isSignUp
                    ? "translateX(127.2727%) translateY(0px)"
                    : "translateX(0%) translateY(0px)",
                  transition: `transform ${ANIM_DURATION} ${ANIM_EASE}, width ${ANIM_DURATION} ${ANIM_EASE}, box-shadow ${ANIM_DURATION} ${ANIM_EASE}`,
                  willChange: "transform, width",
                  zIndex: isSignUp ? 30 : 10,
                }}
              >
                <div
                  style={{
                    transform: isSignUp
                      ? "scale(1.04) rotate(0.35deg)"
                      : "scale(1) rotate(0deg)",
                    filter: isSignUp
                      ? "saturate(1.1) brightness(1.05)"
                      : "saturate(1) brightness(1)",
                    boxShadow: isSignUp
                      ? "0 24px 60px rgba(14,165,233,0.18)"
                      : "0 12px 34px rgba(15,23,42,0.12)",
                    transition: `transform ${ANIM_DURATION} ${ANIM_EASE}, filter ${ANIM_DURATION} ${ANIM_EASE}, box-shadow ${ANIM_DURATION} ${ANIM_EASE}`,
                  }}
                  className="h-full"
                >
                  {renderPhotoPanel()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ModalOTPSignUp
        open={otpOpen}
        onClose={() => setOtpOpen(false)}
        signupData={pendingSignupData}
        onVerified={handleVerified}
      />

      <ModalOTP
        open={openResetOTPModal}
        onClose={() => setOpenResetOTPModal(false)}
        email={verifiedResetEmail}
        newPassword={newPassword}
        onVerified={handleResetVerified}
      />
    </>
  );
};

export default Index;