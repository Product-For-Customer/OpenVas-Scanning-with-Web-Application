import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  FiCheck,
  FiChevronDown,
  FiEdit2,
  FiEye,
  FiEyeOff,
  FiLock,
  FiMail,
  FiRefreshCw,
  FiSave,
  FiSearch,
  FiShield,
  FiType,
  FiUser,
  FiUsers,
  FiX,
  FiBriefcase,
  FiMapPin,
  FiPhone,
  FiUpload,
  FiImage,
} from "react-icons/fi";
import { message } from "antd";
import {
  ListRoles,
  UpdateUserIDByAdmin,
  CreateUser,
  ListEmailAndPhoneNumber,
} from "../services";
import { useStateContext } from "../contexts/ProviderContext";

type UiUser = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  profile: string;
  phone_number: string;
  location: string;
  position: string;
  role: "Admin" | "User" | string;
};

type RoleResponse = {
  id: number;
  role: string;
};

type EmailAndPhoneNumberResponse = {
  id: number;
  email: string;
  phone_number: string;
};

type ModalCreateandUpdateUserProps = {
  open: boolean;
  user: UiUser | null;
  onClose: () => void;
  onUpdated: () => void;
};

// ── Shared helpers ────────────────────────────────────────────
const toBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });

const isBase64DataImage = (v: string) =>
  /^data:image\/(png|jpe?g|gif|webp|bmp|svg\+xml);base64,/i.test((v || "").trim());

const normalizeEmail  = (v: string) => v.trim().toLowerCase();
const normalizePhone  = (v: string) => v.replace(/\D/g, "").trim();
const normalizeString = (v: string) => v.trim();

const validatePassword = (value: string) => {
  if (!value.trim()) return "";
  if (value.length < 8)            return "Password must be at least 8 characters";
  if (!/[A-Z]/.test(value))        return "Must contain at least 1 uppercase letter";
  if (!/[a-z]/.test(value))        return "Must contain at least 1 lowercase letter";
  if (!/[^A-Za-z0-9]/.test(value)) return "Must contain at least 1 special character";
  return "";
};

const getRoleBadgeClass = (role: string) =>
  role === "Admin"
    ? "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/25 dark:bg-violet-500/12 dark:text-violet-200"
    : "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-400/25 dark:bg-cyan-500/12 dark:text-cyan-200";

// ─────────────────────────────────────────────────────────────
// CREATE USER Modal — simple 4-field form (portal)
// ─────────────────────────────────────────────────────────────

type CreateForm = {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
};

const EMPTY_CREATE: CreateForm = { first_name: "", last_name: "", email: "", password: "" };

const CreateUserModal: React.FC<{
  open: boolean;
  existingEmails: string[];
  onClose: () => void;
  onCreated: () => void;
}> = ({ open, existingEmails, onClose, onCreated }) => {
  const { currentColor } = useStateContext();
  const accentGrad = `linear-gradient(135deg, ${currentColor}, color-mix(in srgb, ${currentColor} 65%, #a855f7))`;

  const [form, setForm] = useState<CreateForm>(EMPTY_CREATE);
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [passError, setPassError] = useState("");
  const [emailError, setEmailError] = useState("");

  const reset = () => {
    setForm(EMPTY_CREATE);
    setShowPass(false);
    setFormError("");
    setPassError("");
    setEmailError("");
  };

  const handleClose = () => { reset(); onClose(); };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));

    if (name === "email") {
      const dup = existingEmails.includes(normalizeEmail(value));
      setEmailError(dup ? "This email is already in use" : "");
    }
    if (name === "password") {
      setPassError(validatePassword(value));
    }
    setFormError("");
  };

  const handleSubmit = async () => {
    const { first_name, last_name, email, password } = form;
    if (!first_name.trim()) { setFormError("Please enter first name"); return; }
    if (!last_name.trim())  { setFormError("Please enter last name");  return; }
    if (!email.trim())      { setFormError("Please enter email");      return; }
    if (!/\S+@\S+\.\S+/.test(email)) { setFormError("Invalid email format"); return; }
    if (emailError)         { setFormError(emailError); return; }
    if (!password.trim())   { setFormError("Please enter password");   return; }
    const pe = validatePassword(password);
    if (pe) { setFormError(pe); return; }

    setSubmitting(true);
    setFormError("");
    try {
      const res = await CreateUser({
        email:        normalizeEmail(email),
        password:     password.trim(),
        first_name:   first_name.trim(),
        last_name:    last_name.trim(),
        profile:      "",
        phone_number: "",
        location:     "",
        position:     "",
        app_role_id:  0, // backend will default to "User" role
      });

      if (!res) { setFormError("Create user failed"); return; }
      if ((res as any).error) { setFormError((res as any).error); return; }

      message.success("User created successfully");
      reset();
      onCreated();
    } catch (err: any) {
      setFormError(err?.response?.data?.error || err?.message || "Create user failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const inputCls = [
    "h-9 w-full rounded-xl border px-3 text-[12px] outline-none transition",
    "border-slate-200/80 bg-white text-slate-800 placeholder:text-slate-400",
    "focus:ring-2 focus:ring-cyan-200 focus:border-cyan-300",
    "dark:border-white/10 dark:bg-white/5 dark:text-white/85 dark:placeholder:text-white/35",
    "dark:focus:ring-white/10 dark:focus:border-cyan-400/30",
  ].join(" ");

  const labelCls = "mb-1.5 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/35";

  return createPortal(
    <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[3px]" onClick={!submitting ? handleClose : undefined} />
      <div
        className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl bg-white dark:bg-[#12101f]"
        style={{ boxShadow: `0 24px 64px -12px ${currentColor}30, 0 8px 32px rgba(0,0,0,.25)` }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-white/8">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: accentGrad }}>
              <FiUsers className="text-[14px]" />
            </span>
            <div>
              <p className="text-[9.5px] font-bold uppercase tracking-widest" style={{ color: currentColor }}>
                MANAGEMENT · USER
              </p>
              <h3 className="text-[14px] font-bold text-slate-800 dark:text-white/90">Add User</h3>
            </div>
          </div>
          <button type="button" onClick={handleClose} disabled={submitting}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 disabled:opacity-40 dark:text-white/35 dark:hover:bg-white/8">
            <FiX className="text-[15px]" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-3.5 px-5 py-4">
          {/* First + Last name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>
                <FiType className="text-[10px]" />
                First Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                name="first_name"
                value={form.first_name}
                onChange={handleChange}
                placeholder="First name"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>
                <FiType className="text-[10px]" />
                Last Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                name="last_name"
                value={form.last_name}
                onChange={handleChange}
                placeholder="Last name"
                className={inputCls}
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className={labelCls}>
              <FiMail className="text-[10px]" />
              Email <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="user@example.com"
              className={inputCls}
            />
            {emailError && (
              <p className="mt-1 text-[10px] text-red-500">{emailError}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <label className={labelCls}>
              <FiLock className="text-[10px]" />
              Password <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="••••••••"
                className={`${inputCls} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowPass(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600 dark:text-white/30 dark:hover:text-white/60"
              >
                {showPass ? <FiEyeOff className="text-[13px]" /> : <FiEye className="text-[13px]" />}
              </button>
            </div>
            {passError ? (
              <p className="mt-1 text-[10px] text-red-500">{passError}</p>
            ) : (
              <p className="mt-1 text-[10px] text-slate-400 dark:text-white/30">
                Min 8 chars · uppercase · lowercase · special character
              </p>
            )}
          </div>

          {/* Info note */}
          <div
            className="rounded-xl px-3 py-2.5 text-[10.5px] text-slate-500 dark:text-white/40"
            style={{ backgroundColor: `${currentColor}08`, border: `1px solid ${currentColor}18` }}
          >
            Role defaults to <strong>User</strong>. Other details (phone, location, position) can be updated by the user in their profile.
          </div>

          {/* Error */}
          {formError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300">
              {formError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2.5 border-t border-slate-100 px-5 py-3.5 dark:border-white/8">
          <button type="button" onClick={handleClose} disabled={submitting}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 text-[12.5px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60 dark:border-white/8 dark:text-white/55 dark:hover:bg-white/5">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting || !!emailError || !!passError}
            style={!(submitting || !!emailError || !!passError) ? { background: accentGrad } : undefined}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-[12.5px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-white/10"
          >
            {submitting && <FiRefreshCw className="animate-spin text-[12px]" />}
            <FiUsers className="text-[12px]" />
            Create User
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

// ─────────────────────────────────────────────────────────────
// EDIT USER Modal — full form (portal)
// ─────────────────────────────────────────────────────────────

type EditPayload = {
  email: string;
  first_name: string;
  last_name: string;
  profile: string;
  phone_number: string;
  location: string;
  position: string;
  app_role_id: number | "";
};

const EMPTY_EDIT: EditPayload = {
  email: "", first_name: "", last_name: "", profile: "",
  phone_number: "", location: "", position: "", app_role_id: "",
};

const inputCls = [
  "h-9 rounded-lg border px-3 text-[12px] outline-none transition w-full",
  "border-gray-200/80 bg-white text-[#1f2240] focus:ring-2 focus:ring-cyan-200 focus:border-cyan-300",
  "dark:border-white/10 dark:bg-white/5 dark:text-white/85 dark:placeholder:text-white/35 dark:focus:ring-white/10 dark:focus:border-cyan-400/30",
].join(" ");

const EditUserModal: React.FC<{
  open: boolean;
  user: UiUser;
  existingContacts: EmailAndPhoneNumberResponse[];
  onClose: () => void;
  onUpdated: () => void;
}> = ({ open, user, existingContacts, onClose, onUpdated }) => {
  const { currentColor } = useStateContext();
  const accentGrad = `linear-gradient(135deg, ${currentColor}, color-mix(in srgb, ${currentColor} 65%, #a855f7))`;

  const [formData, setFormData] = useState<EditPayload>(EMPTY_EDIT);
  const [roles, setRoles] = useState<RoleResponse[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState("");
  const [roleOpen, setRoleOpen] = useState(false);
  const [roleSearch, setRoleSearch] = useState("");
  const [emailDuplicateError, setEmailDuplicateError] = useState("");
  const [phoneDuplicateError, setPhoneDuplicateError] = useState("");
  const [phoneValidationError, setPhoneValidationError] = useState("");
  const fetchedRolesRef = useRef(false);
  const roleDropdownRef = useRef<HTMLDivElement | null>(null);

  const fullName = useMemo(() =>
    `${formData.first_name} ${formData.last_name}`.trim() || "User",
    [formData.first_name, formData.last_name]
  );

  const selectedRole = useMemo(() =>
    roles.find(r => r.id === Number(formData.app_role_id)) || null,
    [roles, formData.app_role_id]
  );

  const filteredRoles = useMemo(() => {
    const kw = roleSearch.trim().toLowerCase();
    return kw ? roles.filter(r => r.role.toLowerCase().includes(kw)) : roles;
  }, [roles, roleSearch]);

  const validateThaiPhone = (v: string) => {
    const p = normalizePhone(v);
    if (!p) return "";
    if (!p.startsWith("0")) return "Phone number must start with 0";
    if (p.length !== 10) return "Phone number must be 10 digits";
    return "";
  };

  const checkDupEmail = (email: string) => {
    const ne = normalizeEmail(email);
    if (!ne) return "";
    const dup = existingContacts.some(item =>
      normalizeEmail(item.email) === ne && item.id !== user.id
    );
    return dup ? "This email is already in use" : "";
  };

  const checkDupPhone = (phone: string) => {
    const np = normalizePhone(phone);
    if (!np) return "";
    const dup = existingContacts.some(item =>
      normalizePhone(item.phone_number) === np && item.id !== user.id
    );
    return dup ? "This phone number is already in use" : "";
  };

  useEffect(() => {
    if (!open || fetchedRolesRef.current) return;
    fetchedRolesRef.current = true;
    setLoadingRoles(true);
    ListRoles().then(data => setRoles(data || [])).catch(() => setRoles([])).finally(() => setLoadingRoles(false));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const matchedRole = roles.find(r => r.role.toLowerCase() === String(user.role || "").toLowerCase());
    setFormData({
      email: user.email ?? "", first_name: user.first_name ?? "",
      last_name: user.last_name ?? "", profile: user.profile ?? "",
      phone_number: user.phone_number ?? "", location: user.location ?? "",
      position: user.position ?? "", app_role_id: matchedRole?.id ?? "",
    });
    setError(""); setRoleOpen(false); setRoleSearch("");
    setEmailDuplicateError(""); setPhoneDuplicateError(""); setPhoneValidationError("");
    setSubmitting(false); setUploadingImage(false);
  }, [open, user, roles]);

  useEffect(() => {
    if (!roleOpen) return;
    const handler = (e: MouseEvent) => {
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(e.target as Node)) setRoleOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [roleOpen]);

  const originalForm = useMemo<EditPayload>(() => {
    const matchedRole = roles.find(r => r.role.toLowerCase() === String(user.role || "").toLowerCase());
    return {
      email: user.email ?? "", first_name: user.first_name ?? "",
      last_name: user.last_name ?? "", profile: user.profile ?? "",
      phone_number: user.phone_number ?? "", location: user.location ?? "",
      position: user.position ?? "", app_role_id: matchedRole?.id ?? "",
    };
  }, [user, roles]);

  const hasFormChanged = useMemo(() => (
    normalizeEmail(formData.email) !== normalizeEmail(originalForm.email) ||
    normalizeString(formData.first_name) !== normalizeString(originalForm.first_name) ||
    normalizeString(formData.last_name) !== normalizeString(originalForm.last_name) ||
    normalizePhone(formData.phone_number) !== normalizePhone(originalForm.phone_number) ||
    normalizeString(formData.location) !== normalizeString(originalForm.location) ||
    normalizeString(formData.position) !== normalizeString(originalForm.position) ||
    String(formData.app_role_id || "") !== String(originalForm.app_role_id || "") ||
    (formData.profile || "") !== (originalForm.profile || "")
  ), [formData, originalForm]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === "phone_number") {
      const num = value.replace(/\D/g, "").slice(0, 10);
      setFormData(p => ({ ...p, phone_number: num }));
      setPhoneValidationError(validateThaiPhone(num));
      setPhoneDuplicateError(checkDupPhone(num));
      return;
    }
    if (name === "email") {
      setFormData(p => ({ ...p, email: value }));
      setEmailDuplicateError(checkDupEmail(value));
      return;
    }
    setFormData(p => ({ ...p, [name]: value }));
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { message.warning("Please upload image only"); return; }
    try {
      setUploadingImage(true);
      const b64 = await toBase64(file);
      setFormData(p => ({ ...p, profile: b64 }));
    } catch { message.error("Upload image failed"); }
    finally { setUploadingImage(false); e.target.value = ""; }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!hasFormChanged) { message.warning("No changes detected"); return; }
    if (!formData.first_name.trim()) { setError("Please enter first name"); return; }
    if (!formData.last_name.trim())  { setError("Please enter last name");  return; }
    if (!formData.email.trim())      { setError("Please enter email");      return; }
    if (!/\S+@\S+\.\S+/.test(formData.email)) { setError("Invalid email format"); return; }
    if (emailDuplicateError) { setError(emailDuplicateError); return; }

    setSubmitting(true);
    try {
      const res = await UpdateUserIDByAdmin(user.id, {
        email:        formData.email.trim(),
        first_name:   formData.first_name.trim(),
        last_name:    formData.last_name.trim(),
        profile:      formData.profile || "",
        phone_number: formData.phone_number.trim(),
        location:     formData.location.trim(),
        position:     formData.position.trim(),
        app_role_id:  formData.app_role_id ? Number(formData.app_role_id) : undefined,
      });
      if (!res) { setError("Update user failed"); return; }
      if ((res as any).error) { setError((res as any).error); return; }
      message.success((res as any).message || "Update success");
      onUpdated();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "Update user failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const selectorButtonCls = [
    "h-9 rounded-lg px-3 flex items-center gap-2 border transition w-full",
    "bg-white border-gray-200 text-slate-700 hover:border-cyan-200 hover:bg-cyan-50/60",
    "dark:bg-white/5 dark:border-white/10 dark:text-white/75 dark:hover:bg-white/10",
    "disabled:cursor-not-allowed disabled:opacity-60",
  ].join(" ");

  const isSubmitDisabled = submitting || uploadingImage || !!emailDuplicateError ||
    !!phoneDuplicateError || !!phoneValidationError || !hasFormChanged;

  return createPortal(
    <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[3px]" onClick={!submitting ? onClose : undefined} />
      <div
        className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl bg-white dark:bg-[#12101f]"
        style={{ boxShadow: `0 24px 64px -12px ${currentColor}30, 0 8px 32px rgba(0,0,0,.25)` }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-white/8">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: accentGrad }}>
              <FiEdit2 className="text-[14px]" />
            </span>
            <div>
              <p className="text-[9.5px] font-bold uppercase tracking-widest" style={{ color: currentColor }}>MANAGEMENT · USER</p>
              <h3 className="text-[14px] font-bold text-slate-800 dark:text-white/90">Edit User</h3>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={submitting}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 disabled:opacity-40 dark:text-white/35 dark:hover:bg-white/8">
            <FiX className="text-[15px]" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="max-h-[62vh] overflow-y-auto">
            <div className="grid grid-cols-1 gap-3 p-4 lg:grid-cols-[180px_1fr]">
              {/* Profile picture */}
              <div className="rounded-xl border border-gray-200/80 bg-gray-50/70 p-3 dark:border-white/10 dark:bg-white/3">
                <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold text-slate-700 dark:text-white/80">
                  <FiUser className="text-[11px]" style={{ color: currentColor }} /> Profile
                </p>
                <div className="flex flex-col items-center text-center">
                  {formData.profile && isBase64DataImage(formData.profile) ? (
                    <img src={formData.profile} alt="Profile" className="h-16 w-16 rounded-2xl object-cover ring-1 ring-gray-200 dark:ring-white/10" />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 text-gray-400 dark:border-white/10 dark:bg-white/5 dark:text-white/35">
                      <FiUser className="text-[20px]" />
                    </div>
                  )}
                  <p className="mt-2 text-[10.5px] font-semibold text-slate-800 dark:text-white/85 truncate w-full">{fullName}</p>
                  <p className="text-[9px] text-slate-500 dark:text-white/45 truncate w-full">{formData.email || "—"}</p>
                  <label className="mt-2.5 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-medium text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white/65">
                    <FiUpload className="text-[10px]" />
                    {uploadingImage ? "Uploading…" : "Upload Photo"}
                    <input type="file" accept="image/*" onChange={handleUploadImage} className="hidden" />
                  </label>
                  <p className="mt-1.5 flex items-center gap-1 text-[9px] text-slate-400 dark:text-white/30">
                    <FiImage className="text-[9px]" /> Image files only
                  </p>
                </div>
              </div>

              {/* Fields */}
              <div className="space-y-3">
                {/* Name */}
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { name: "first_name", label: "First Name", icon: <FiUser className="text-[10px]" /> },
                    { name: "last_name",  label: "Last Name",  icon: <FiUser className="text-[10px]" /> },
                  ].map(f => (
                    <div key={f.name}>
                      <label className="mb-1 flex items-center gap-1 text-[10px] font-medium text-slate-500 dark:text-white/50">
                        {f.icon} {f.label}
                      </label>
                      <input type="text" name={f.name}
                        value={(formData as any)[f.name]} onChange={handleChange}
                        placeholder={f.label} className={inputCls} />
                    </div>
                  ))}
                </div>

                {/* Email */}
                <div>
                  <label className="mb-1 flex items-center gap-1 text-[10px] font-medium text-slate-500 dark:text-white/50">
                    <FiMail className="text-[10px]" /> Email
                  </label>
                  <input type="email" name="email" value={formData.email} onChange={handleChange}
                    placeholder="Email" className={inputCls} />
                  {emailDuplicateError && <p className="mt-0.5 text-[10px] text-red-500">{emailDuplicateError}</p>}
                </div>

                {/* Phone + Location */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="mb-1 flex items-center gap-1 text-[10px] font-medium text-slate-500 dark:text-white/50">
                      <FiPhone className="text-[10px]" /> Phone
                    </label>
                    <input type="text" name="phone_number" value={formData.phone_number}
                      onChange={handleChange} placeholder="Phone" inputMode="numeric" maxLength={10} className={inputCls} />
                    {(phoneValidationError || phoneDuplicateError) && (
                      <p className="mt-0.5 text-[10px] text-red-500">{phoneValidationError || phoneDuplicateError}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 flex items-center gap-1 text-[10px] font-medium text-slate-500 dark:text-white/50">
                      <FiMapPin className="text-[10px]" /> Location
                    </label>
                    <input type="text" name="location" value={formData.location}
                      onChange={handleChange} placeholder="Location" className={inputCls} />
                  </div>
                </div>

                {/* Position */}
                <div>
                  <label className="mb-1 flex items-center gap-1 text-[10px] font-medium text-slate-500 dark:text-white/50">
                    <FiBriefcase className="text-[10px]" /> Position
                  </label>
                  <input type="text" name="position" value={formData.position}
                    onChange={handleChange} placeholder="Position" className={inputCls} />
                </div>

                {/* Role */}
                <div className="relative" ref={roleDropdownRef}>
                  <label className="mb-1 flex items-center gap-1 text-[10px] font-medium text-slate-500 dark:text-white/50">
                    <FiShield className="text-[10px]" /> Role
                  </label>
                  <button type="button" onClick={() => { if (!loadingRoles) setRoleOpen(p => !p); }}
                    disabled={loadingRoles} className={selectorButtonCls}>
                    <FiShield className="shrink-0 text-[11px] text-slate-400 dark:text-white/35" />
                    <span className="flex-1 truncate text-[12px]">
                      {loadingRoles ? "Loading…" : (selectedRole?.role || "Select role")}
                    </span>
                    <FiChevronDown className={`ml-auto text-[11px] text-slate-400 transition-transform dark:text-white/35 ${roleOpen ? "rotate-180" : ""}`} />
                  </button>

                  {roleOpen && (
                    <div className="absolute bottom-full left-0 right-0 z-50 mb-1.5 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-white/10 dark:bg-[#0B1220]">
                      <div className="border-b border-gray-100 p-1.5 dark:border-white/10">
                        <div className="flex items-center gap-1.5 rounded-lg border border-gray-200/80 bg-gray-50 px-2.5 dark:border-white/10 dark:bg-white/5">
                          <FiSearch className="shrink-0 text-[10px] text-gray-400 dark:text-white/40" />
                          <input value={roleSearch} onChange={e => setRoleSearch(e.target.value)}
                            placeholder="Search role"
                            className="h-7 w-full bg-transparent text-[10px] text-gray-700 outline-none placeholder:text-gray-400 dark:text-white/80 dark:placeholder:text-white/35" />
                        </div>
                      </div>
                      <div className="max-h-32 overflow-y-auto p-1.5">
                        {filteredRoles.length === 0 ? (
                          <p className="py-3 text-center text-[10px] text-gray-500 dark:text-white/50">No roles found</p>
                        ) : filteredRoles.map(role => {
                          const checked = Number(formData.app_role_id) === role.id;
                          return (
                            <button key={role.id} type="button"
                              onClick={() => { setFormData(p => ({ ...p, app_role_id: role.id })); setRoleOpen(false); setRoleSearch(""); }}
                              className={["w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-left transition",
                                checked ? "border border-cyan-200 bg-cyan-50 dark:border-cyan-400/20 dark:bg-cyan-500/10"
                                  : "border border-transparent hover:bg-gray-50 dark:hover:bg-white/5"].join(" ")}>
                              <span className={["flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border transition",
                                checked ? "border-cyan-500 bg-cyan-500 text-white" : "border-gray-300 bg-white text-transparent dark:border-white/20 dark:bg-white/5"].join(" ")}>
                                <FiCheck className="text-[7px]" />
                              </span>
                              <span className="flex-1 truncate text-[11px] font-medium text-gray-700 dark:text-white/80">{role.role}</span>
                              {checked && (
                                <span className={["inline-flex items-center rounded-full border px-1.5 py-0.5 text-[8px] font-semibold", getRoleBadgeClass(role.role)].join(" ")}>
                                  Selected
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300">
                    {error}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-2.5 border-t border-slate-100 px-5 py-3.5 dark:border-white/8">
            <button type="button" onClick={onClose} disabled={submitting}
              className="flex-1 rounded-xl border border-slate-200 py-2.5 text-[12.5px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60 dark:border-white/8 dark:text-white/55 dark:hover:bg-white/5">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitDisabled}
              style={!isSubmitDisabled ? { background: accentGrad } : undefined}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-[12.5px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-white/10">
              {submitting && <FiRefreshCw className="animate-spin text-[11px]" />}
              <FiSave className="text-[11px]" />
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
};

// ─────────────────────────────────────────────────────────────
// Wrapper — routes to Create or Edit modal
// ─────────────────────────────────────────────────────────────

const ModalCreateandUpdateUser: React.FC<ModalCreateandUpdateUserProps> = ({
  open, user, onClose, onUpdated,
}) => {
  const [existingContacts, setExistingContacts] = useState<EmailAndPhoneNumberResponse[]>([]);

  useEffect(() => {
    if (!open) return;
    ListEmailAndPhoneNumber().then(data => setExistingContacts(Array.isArray(data) ? data : [])).catch(() => {});
  }, [open]);

  const existingEmails = useMemo(
    () => existingContacts.map(c => normalizeEmail(c.email)),
    [existingContacts]
  );

  if (!user) {
    return (
      <CreateUserModal
        open={open}
        existingEmails={existingEmails}
        onClose={onClose}
        onCreated={onUpdated}
      />
    );
  }

  return (
    <EditUserModal
      open={open}
      user={user}
      existingContacts={existingContacts}
      onClose={onClose}
      onUpdated={onUpdated}
    />
  );
};

export default ModalCreateandUpdateUser;
