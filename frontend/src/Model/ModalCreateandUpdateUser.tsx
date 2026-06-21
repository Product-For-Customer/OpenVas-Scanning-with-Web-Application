import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
} from "react-icons/fi";
import { message } from "antd";
import {
  ListRoles,
  UpdateUserIDByAdmin,
  CreateUser,
  ListEmailAndPhoneNumber,
} from "../services";
import {
  GetPasswordPolicy,
  validatePasswordAgainstPolicy,
  type PasswordPolicy,
} from "../services/passwordpolicy";
import { useStateContext } from "../contexts/ProviderContext";

// ─── Types ────────────────────────────────────────────────────

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

type RoleResponse = { id: number; role: string };
type EmailContact = { id: number; email: string; phone_number: string };

type UserForm = {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  app_role_id: number | "";
};

const EMPTY_FORM: UserForm = {
  first_name: "",
  last_name: "",
  email: "",
  password: "",
  app_role_id: "",
};

const normalizeEmail = (v: string) => v.trim().toLowerCase();

const getRoleBadgeClass = (role: string) =>
  role.toLowerCase() === "admin"
    ? "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/25 dark:bg-violet-500/12 dark:text-violet-200"
    : "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-400/25 dark:bg-cyan-500/12 dark:text-cyan-200";

// ─── Portaled Role Dropdown ────────────────────────────────────
// Renders the dropdown list directly into document.body using
// fixed positioning from the trigger button's getBoundingClientRect().
// This avoids any overflow-hidden / z-index clipping from modal ancestors.

type RoleDropdownPortalProps = {
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  listRef: React.RefObject<HTMLDivElement | null>;
  roles: RoleResponse[];
  selectedId: number | "";
  search: string;
  onSearch: (v: string) => void;
  onSelect: (id: number) => void;
  onClose: () => void;
};

const RoleDropdownPortal: React.FC<RoleDropdownPortalProps> = ({
  anchorRef, listRef, roles, selectedId, search, onSearch, onSelect, onClose,
}) => {
  const [rect, setRect] = useState<DOMRect | null>(null);

  // Measure button position once on mount
  useEffect(() => {
    if (anchorRef.current) {
      setRect(anchorRef.current.getBoundingClientRect());
    }
  }, [anchorRef]);

  // Recalculate on window resize / scroll
  useEffect(() => {
    const update = () => {
      if (anchorRef.current) setRect(anchorRef.current.getBoundingClientRect());
    };
    window.addEventListener("resize", update, { passive: true });
    window.addEventListener("scroll", update, { passive: true, capture: true });
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [anchorRef]);

  if (!rect) return null;

  // Decide if dropdown should open upward (when too close to bottom of viewport)
  const spaceBelow = window.innerHeight - rect.bottom;
  const dropdownH = Math.min(roles.length * 46 + 56, 280); // approx height
  const openUpward = spaceBelow < dropdownH + 8 && rect.top > dropdownH + 8;

  const style: React.CSSProperties = {
    position: "fixed",
    left: rect.left,
    width: rect.width,
    zIndex: 99999,
    ...(openUpward
      ? { bottom: window.innerHeight - rect.top + 4 }
      : { top: rect.bottom + 4 }),
  };

  const filtered = search.trim()
    ? roles.filter((r) => r.role.toLowerCase().includes(search.trim().toLowerCase()))
    : roles;

  return createPortal(
    <div ref={listRef} style={style}
      className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0b1220]">
      {/* Search */}
      <div className="border-b border-slate-100 p-2 dark:border-white/10">
        <div className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-slate-50 px-2.5 dark:border-white/10 dark:bg-white/5">
          <FiSearch className="shrink-0 text-[11px] text-slate-400 dark:text-white/35" />
          <input
            autoFocus
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search role…"
            className="h-7 w-full bg-transparent text-[11px] text-slate-700 outline-none placeholder:text-slate-400 dark:text-white/80 dark:placeholder:text-white/35"
          />
        </div>
      </div>

      {/* Options */}
      <div className="max-h-44 overflow-y-auto p-1.5">
        {filtered.length === 0 ? (
          <p className="py-3 text-center text-[11px] text-slate-400 dark:text-white/40">No roles found</p>
        ) : (
          filtered.map((r) => {
            const isSelected = Number(selectedId) === r.id;
            return (
              <button key={r.id} type="button"
                onClick={() => { onSelect(r.id); onClose(); onSearch(""); }}
                className={[
                  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition",
                  isSelected
                    ? "bg-cyan-50 dark:bg-cyan-500/10"
                    : "hover:bg-slate-50 dark:hover:bg-white/5",
                ].join(" ")}
              >
                <span className={[
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition",
                  isSelected
                    ? "border-cyan-500 bg-cyan-500 text-white"
                    : "border-slate-300 bg-white dark:border-white/20 dark:bg-white/5",
                ].join(" ")}>
                  {isSelected && <FiCheck className="text-[9px]" />}
                </span>
                <span className="flex-1 text-[12px] font-medium text-slate-700 dark:text-white/80">{r.role}</span>
                <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold ${getRoleBadgeClass(r.role)}`}>
                  {r.role}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>,
    document.body
  );
};

// ─── Unified User Modal ────────────────────────────────────────

type UserModalProps = {
  open: boolean;
  user: UiUser | null;
  onClose: () => void;
  onDone: () => void;
};

const UserModal: React.FC<UserModalProps> = ({ open, user, onClose, onDone }) => {
  const isEdit = user !== null;
  const { currentColor } = useStateContext();
  const accentGrad = `linear-gradient(135deg, ${currentColor}, color-mix(in srgb, ${currentColor} 65%, #a855f7))`;

  // Form
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof UserForm | "form", string>>>({});

  // Role dropdown
  const [roles, setRoles] = useState<RoleResponse[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [roleSearch, setRoleSearch] = useState("");
  const roleButtonRef = useRef<HTMLButtonElement | null>(null);
  const roleListRef   = useRef<HTMLDivElement   | null>(null);
  const fetchedRolesRef = useRef(false);

  // Policy + contacts
  const [policy, setPolicy] = useState<PasswordPolicy | null>(null);
  const [existingContacts, setExistingContacts] = useState<EmailContact[]>([]);

  // ── Close dropdown on outside click ─────────────────────────
  const handleOutsideClick = useCallback((e: MouseEvent) => {
    const target = e.target as Node;
    if (
      roleButtonRef.current?.contains(target) ||
      roleListRef.current?.contains(target)
    ) return;
    setRoleOpen(false);
    setRoleSearch("");
  }, []);

  useEffect(() => {
    if (!roleOpen) return;
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [roleOpen, handleOutsideClick]);

  // Close dropdown on Escape
  useEffect(() => {
    if (!roleOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setRoleOpen(false); setRoleSearch(""); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [roleOpen]);

  // ── Load on open ─────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;

    setForm(isEdit && user
      ? { first_name: user.first_name ?? "", last_name: user.last_name ?? "", email: user.email ?? "", password: "", app_role_id: "" }
      : EMPTY_FORM);
    setErrors({});
    setShowPass(false);
    setRoleOpen(false);
    setRoleSearch("");

    GetPasswordPolicy().then(setPolicy).catch(() => {});
    ListEmailAndPhoneNumber()
      .then((d) => setExistingContacts(Array.isArray(d) ? d : []))
      .catch(() => {});

    if (!fetchedRolesRef.current) {
      fetchedRolesRef.current = true;
      setLoadingRoles(true);
      ListRoles()
        .then((d) => setRoles(d || []))
        .catch(() => setRoles([]))
        .finally(() => setLoadingRoles(false));
    }
  }, [open]);

  // Set role id after roles load (edit mode)
  useEffect(() => {
    if (!isEdit || !user || roles.length === 0) return;
    const matched = roles.find((r) => r.role.toLowerCase() === (user.role || "").toLowerCase());
    if (matched) setForm((p) => ({ ...p, app_role_id: matched.id }));
  }, [roles, isEdit, user]);

  // ── Derived ──────────────────────────────────────────────────
  const selectedRole = useMemo(
    () => roles.find((r) => r.id === Number(form.app_role_id)) ?? null,
    [roles, form.app_role_id]
  );

  const policyHint = useMemo(() => {
    const parts = [`Min ${policy?.min_length ?? 8} chars`];
    if (policy?.require_uppercase) parts.push("uppercase");
    if (policy?.require_number)    parts.push("number");
    if (policy?.require_special)   parts.push("special char");
    return parts.join(" · ");
  }, [policy]);

  // ── Validation ────────────────────────────────────────────────
  const validate = (): boolean => {
    const next: typeof errors = {};

    if (!form.first_name.trim()) next.first_name = "Please enter first name";
    if (!form.last_name.trim())  next.last_name  = "Please enter last name";

    if (!form.email.trim()) {
      next.email = "Please enter email";
    } else if (!/\S+@\S+\.\S+/.test(form.email)) {
      next.email = "Invalid email format";
    } else {
      const ne = normalizeEmail(form.email);
      const dup = existingContacts.some(
        (c) => normalizeEmail(c.email) === ne && c.id !== (user?.id ?? -1)
      );
      if (dup) next.email = "This email is already in use";
    }

    if (!isEdit) {
      if (!form.password.trim()) {
        next.password = "Please enter password";
      } else {
        const pe = validatePasswordAgainstPolicy(form.password, policy);
        if (pe) next.password = pe;
      }
    } else if (form.password.trim()) {
      const pe = validatePasswordAgainstPolicy(form.password, policy);
      if (pe) next.password = pe;
    }

    if (!form.app_role_id) next.app_role_id = "Please select a role";

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    setErrors((p) => ({ ...p, [name]: undefined, form: undefined }));
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    setErrors((p) => ({ ...p, form: undefined }));
    try {
      if (!isEdit) {
        const res = await CreateUser({
          first_name: form.first_name.trim(),
          last_name:  form.last_name.trim(),
          email:      normalizeEmail(form.email),
          password:   form.password.trim(),
          app_role_id: Number(form.app_role_id),
          profile: "", phone_number: "", location: "", position: "",
        });
        if (!res || (res as any).error) throw new Error((res as any)?.error || "Create user failed");
        message.success("User created successfully");
      } else {
        const payload: Record<string, any> = {
          first_name:  form.first_name.trim(),
          last_name:   form.last_name.trim(),
          email:       normalizeEmail(form.email),
          app_role_id: Number(form.app_role_id),
        };
        if (form.password.trim()) payload.password = form.password.trim();
        const res = await UpdateUserIDByAdmin(user!.id, payload);
        if (!res || (res as any).error) throw new Error((res as any)?.error || "Update user failed");
        message.success((res as any).message || "Updated successfully");
      }
      onDone();
    } catch (err: any) {
      setErrors((p) => ({
        ...p,
        form: err?.response?.data?.error || err?.message || "Something went wrong",
      }));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Styles ───────────────────────────────────────────────────
  const inputBase = [
    "h-10 w-full rounded-xl border px-3.5 text-[12.5px] outline-none transition",
    "border-slate-200/80 bg-white text-slate-800 placeholder:text-slate-400",
    "focus:ring-2 focus:ring-cyan-200 focus:border-cyan-400",
    "dark:border-white/10 dark:bg-white/5 dark:text-white/85 dark:placeholder:text-white/35",
    "dark:focus:ring-white/10 dark:focus:border-cyan-400/30",
    "disabled:cursor-not-allowed disabled:opacity-60",
  ].join(" ");

  const inputErr = inputBase
    .replace("border-slate-200/80", "border-red-300")
    .replace("dark:border-white/10", "dark:border-red-500/40");

  const labelCls =
    "mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-white/40";

  const errMsg = (key: keyof UserForm) =>
    errors[key] ? (
      <p className="mt-1 text-[10px] text-red-500 dark:text-red-400">{errors[key]}</p>
    ) : null;

  // ── Render ────────────────────────────────────────────────────
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-[3px]"
        onClick={!submitting ? onClose : undefined}
      />

      {/* Modal — NO overflow-hidden so dropdown can escape freely */}
      <div
        className="relative z-10 w-full max-w-115 rounded-2xl bg-white dark:bg-[#12101f]"
        style={{ boxShadow: `0 24px 64px -12px ${currentColor}30, 0 8px 32px rgba(0,0,0,.28)` }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between rounded-t-2xl border-b border-slate-100 px-5 py-4 dark:border-white/8">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
              style={{ background: accentGrad }}>
              {isEdit ? <FiEdit2 className="text-[14px]" /> : <FiUsers className="text-[14px]" />}
            </span>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: currentColor }}>
                MANAGEMENT · USER
              </p>
              <h3 className="text-[15px] font-bold text-slate-800 dark:text-white/90">
                {isEdit ? "Edit User" : "Add User"}
              </h3>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={submitting}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 disabled:opacity-40 dark:text-white/35 dark:hover:bg-white/8">
            <FiX className="text-[15px]" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="space-y-4 px-5 py-5">

          {/* First Name + Last Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>
                <FiType className="text-[10px]" />
                First Name <span className="text-red-400">*</span>
              </label>
              <input type="text" name="first_name" value={form.first_name}
                onChange={handleChange} placeholder="First name" disabled={submitting}
                className={errors.first_name ? inputErr : inputBase} />
              {errMsg("first_name")}
            </div>
            <div>
              <label className={labelCls}>
                <FiType className="text-[10px]" />
                Last Name <span className="text-red-400">*</span>
              </label>
              <input type="text" name="last_name" value={form.last_name}
                onChange={handleChange} placeholder="Last name" disabled={submitting}
                className={errors.last_name ? inputErr : inputBase} />
              {errMsg("last_name")}
            </div>
          </div>

          {/* Email */}
          <div>
            <label className={labelCls}>
              <FiMail className="text-[10px]" />
              Email <span className="text-red-400">*</span>
            </label>
            <input type="email" name="email" value={form.email}
              onChange={handleChange} placeholder="user@example.com" disabled={submitting}
              className={errors.email ? inputErr : inputBase} />
            {errMsg("email")}
          </div>

          {/* Password */}
          <div>
            <label className={labelCls}>
              <FiLock className="text-[10px]" />
              Password{!isEdit && <span className="text-red-400">*</span>}
              {isEdit && (
                <span className="ml-1 text-[9px] normal-case font-normal text-slate-400 dark:text-white/30">
                  (leave blank to keep current)
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                name="password" value={form.password}
                onChange={handleChange}
                placeholder={isEdit ? "••••••••" : "Enter password"}
                disabled={submitting}
                className={`${errors.password ? inputErr : inputBase} pr-10`}
              />
              <button type="button" onClick={() => setShowPass((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600 dark:text-white/30 dark:hover:text-white/60">
                {showPass ? <FiEyeOff className="text-[14px]" /> : <FiEye className="text-[14px]" />}
              </button>
            </div>
            {errors.password
              ? <p className="mt-1 text-[10px] text-red-500 dark:text-red-400">{errors.password}</p>
              : <p className="mt-1 text-[10px] text-slate-400 dark:text-white/30">{policyHint}</p>
            }
          </div>

          {/* Role */}
          <div>
            <label className={labelCls}>
              <FiShield className="text-[10px]" />
              Role <span className="text-red-400">*</span>
            </label>

            {/* Trigger button */}
            <button
              ref={roleButtonRef}
              type="button"
              disabled={loadingRoles || submitting}
              onClick={() => {
                if (loadingRoles || submitting) return;
                setRoleOpen((p) => !p);
                setRoleSearch("");
              }}
              className={[
                "flex h-10 w-full items-center gap-2.5 rounded-xl border px-3.5 text-[12.5px] transition",
                "bg-white border-slate-200/80 text-slate-700 hover:border-cyan-400",
                "dark:bg-white/5 dark:border-white/10 dark:text-white/80 dark:hover:border-cyan-400/40",
                "disabled:cursor-not-allowed disabled:opacity-60",
                errors.app_role_id ? "border-red-300 dark:border-red-500/40" : "",
                roleOpen ? "ring-2 ring-cyan-200 border-cyan-400 dark:ring-white/10 dark:border-cyan-400/40" : "",
              ].join(" ")}
            >
              <FiShield className="shrink-0 text-[12px] text-slate-400 dark:text-white/35" />
              <span className="flex-1 truncate text-left">
                {loadingRoles ? "Loading roles…" : selectedRole ? selectedRole.role : "Select role"}
              </span>
              {selectedRole && (
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold ${getRoleBadgeClass(selectedRole.role)}`}>
                  {selectedRole.role}
                </span>
              )}
              <FiChevronDown className={`shrink-0 text-[12px] text-slate-400 transition-transform duration-200 dark:text-white/35 ${roleOpen ? "rotate-180" : ""}`} />
            </button>

            {errMsg("app_role_id")}

            {/* Portaled dropdown — renders in document.body, no overflow clipping */}
            {roleOpen && (
              <RoleDropdownPortal
                anchorRef={roleButtonRef}
                listRef={roleListRef}
                roles={roles}
                selectedId={form.app_role_id}
                search={roleSearch}
                onSearch={setRoleSearch}
                onSelect={(id) => {
                  setForm((p) => ({ ...p, app_role_id: id }));
                  setErrors((p) => ({ ...p, app_role_id: undefined }));
                  setRoleOpen(false);
                }}
                onClose={() => { setRoleOpen(false); setRoleSearch(""); }}
              />
            )}
          </div>

          {/* Info note (create only) */}
          {!isEdit && (
            <div className="rounded-xl px-3.5 py-2.5 text-[10.5px] leading-5 text-slate-500 dark:text-white/40"
              style={{ backgroundColor: `${currentColor}08`, border: `1px solid ${currentColor}18` }}>
              <FiUser className="mr-1.5 inline text-[10px]" />
              Other details (phone, location, position) can be updated by the user in their profile.
            </div>
          )}

          {/* Form-level error */}
          {errors.form && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[11px] text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300">
              {errors.form}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex gap-2.5 rounded-b-2xl border-t border-slate-100 px-5 py-4 dark:border-white/8">
          <button type="button" onClick={onClose} disabled={submitting}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 text-[12.5px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60 dark:border-white/8 dark:text-white/55 dark:hover:bg-white/5">
            Cancel
          </button>
          <button type="button" onClick={() => void handleSubmit()} disabled={submitting}
            style={!submitting ? { background: accentGrad } : undefined}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-[12.5px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-white/10">
            {submitting && <FiRefreshCw className="animate-spin text-[12px]" />}
            {isEdit
              ? <><FiSave className="text-[12px]" />Save Changes</>
              : <><FiUsers className="text-[12px]" />Create User</>
            }
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ─── Wrapper ───────────────────────────────────────────────────

type ModalCreateandUpdateUserProps = {
  open: boolean;
  user: UiUser | null;
  onClose: () => void;
  onUpdated: () => void;
};

const ModalCreateandUpdateUser: React.FC<ModalCreateandUpdateUserProps> = ({
  open, user, onClose, onUpdated,
}) => (
  <UserModal open={open} user={user} onClose={onClose} onDone={onUpdated} />
);

export default ModalCreateandUpdateUser;
