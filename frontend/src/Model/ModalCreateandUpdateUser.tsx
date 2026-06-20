import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FiBriefcase,
  FiCheck,
  FiChevronDown,
  FiEdit2,
  FiMail,
  FiMapPin,
  FiPhone,
  FiSave,
  FiSearch,
  FiShield,
  FiUpload,
  FiUser,
  FiUsers,
  FiX,
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

type Payload = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  profile: string;
  phone_number: string;
  location: string;
  position: string;
  app_role_id: number | "";
};

const EMPTY_FORM: Payload = {
  email: "",
  password: "",
  first_name: "",
  last_name: "",
  profile: "",
  phone_number: "",
  location: "",
  position: "",
  app_role_id: "",
};

const toBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });

const isBase64DataImage = (v: string) => {
  const s = (v || "").trim();
  return /^data:image\/(png|jpe?g|gif|webp|bmp|svg\+xml);base64,/i.test(s);
};

const isImageFile = (file: File) => {
  return file.type.startsWith("image/");
};

const getRoleBadgeClass = (role: string) => {
  if (role === "Admin") {
    return "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/25 dark:bg-violet-500/12 dark:text-violet-200";
  }

  return "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-400/25 dark:bg-cyan-500/12 dark:text-cyan-200";
};


const inputCls = [
  "h-9 rounded-lg border px-3 text-[10px] outline-none transition w-full",
  "border-gray-200/80 bg-white text-[#1f2240] focus:ring-2 focus:ring-cyan-200 focus:border-cyan-300",
  "dark:border-white/10 dark:bg-white/5 dark:text-white/85 dark:placeholder:text-white/35 dark:focus:ring-white/10 dark:focus:border-cyan-400/30",
].join(" ");

const selectorButtonCls = [
  "h-9 rounded-lg px-3 flex items-center gap-2 border transition w-full",
  "bg-white border-gray-200 text-slate-700 hover:border-cyan-200 hover:bg-cyan-50/60",
  "dark:bg-white/5 dark:border-white/10 dark:text-white/75 dark:hover:bg-white/10",
  "disabled:cursor-not-allowed disabled:opacity-60",
].join(" ");

const searchInputCls = [
  "h-7 w-full bg-transparent text-[10px] text-gray-700 outline-none placeholder:text-gray-400",
  "dark:text-white/80 dark:placeholder:text-white/35",
].join(" ");

const normalizeString = (value: string) => value.trim();
const normalizeEmail = (value: string) => value.trim().toLowerCase();
const normalizePhone = (value: string) => value.replace(/\D/g, "").trim();

const validatePassword = (value: string) => {
  const password = value || "";

  if (!password.trim()) return "";
  if (password.length < 8) return "Password must be at least 8 characters";
  if (!/[A-Z]/.test(password))
    return "Password must contain at least 1 uppercase letter";
  if (!/[a-z]/.test(password))
    return "Password must contain at least 1 lowercase letter";
  if (!/[^A-Za-z0-9]/.test(password))
    return "Password must contain at least 1 special character";

  return "";
};

const ModalCreateandUpdateUser: React.FC<ModalCreateandUpdateUserProps> = ({
  open,
  user,
  onClose,
  onUpdated,
}) => {
  const { currentColor } = useStateContext();
  const accentGrad = `linear-gradient(135deg, ${currentColor}, color-mix(in srgb, ${currentColor} 65%, #a855f7))`;
  const isEditMode = !!user;

  const [formData, setFormData] = useState<Payload>(EMPTY_FORM);
  const [roles, setRoles] = useState<RoleResponse[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState("");
  const fetchedRolesRef = useRef(false);

  const [roleOpen, setRoleOpen] = useState(false);
  const [roleSearch, setRoleSearch] = useState("");
  const roleDropdownRef = useRef<HTMLDivElement | null>(null);

  const [existingContacts, setExistingContacts] = useState<
    EmailAndPhoneNumberResponse[]
  >([]);
  const [loadingExistingContacts, setLoadingExistingContacts] = useState(false);

  const [emailDuplicateError, setEmailDuplicateError] = useState("");
  const [phoneDuplicateError, setPhoneDuplicateError] = useState("");
  const [phoneValidationError, setPhoneValidationError] = useState("");
  const [passwordValidationError, setPasswordValidationError] = useState("");

  const fullName = useMemo(() => {
    return `${formData.first_name} ${formData.last_name}`.trim() || "User";
  }, [formData.first_name, formData.last_name]);

  const selectedRole = useMemo(() => {
    return roles.find((r) => r.id === Number(formData.app_role_id)) || null;
  }, [roles, formData.app_role_id]);

  const selectedRoleName = selectedRole?.role || "";

  const filteredRoles = useMemo(() => {
    const keyword = roleSearch.trim().toLowerCase();
    if (!keyword) return roles;

    return roles.filter((role) =>
      String(role.role || "")
        .toLowerCase()
        .includes(keyword)
    );
  }, [roles, roleSearch]);

  const validateThaiPhoneNumber = (value: string) => {
    const phone = normalizePhone(value);

    if (!phone) return "";
    if (!phone.startsWith("0")) return "Phone number must start with 0";
    if (phone.length > 10) return "Phone number must not exceed 10 digits";
    if (phone.length < 10) return "Phone number must be 10 digits";
    return "";
  };

  const loadExistingContacts = async () => {
    try {
      setLoadingExistingContacts(true);
      const data = await ListEmailAndPhoneNumber();
      setExistingContacts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("ListEmailAndPhoneNumber error:", err);
      setExistingContacts([]);
    } finally {
      setLoadingExistingContacts(false);
    }
  };

  const checkDuplicateEmail = (email: string) => {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return "";

    const duplicated = existingContacts.some((item) => {
      const sameEmail = normalizeEmail(item.email) === normalizedEmail;
      const isSameCurrentUser = isEditMode && user?.id === item.id;
      return sameEmail && !isSameCurrentUser;
    });

    return duplicated ? "This email is already in use" : "";
  };

  const checkDuplicatePhone = (phoneNumber: string) => {
    const normalizedPhone = normalizePhone(phoneNumber);
    if (!normalizedPhone) return "";

    const duplicated = existingContacts.some((item) => {
      const samePhone = normalizePhone(item.phone_number) === normalizedPhone;
      const isSameCurrentUser = isEditMode && user?.id === item.id;
      return samePhone && !isSameCurrentUser;
    });

    return duplicated ? "This phone number is already in use" : "";
  };

  const fetchRoles = async () => {
    try {
      setLoadingRoles(true);
      const data = await ListRoles();

      if (!data) {
        setRoles([]);
        return;
      }

      setRoles(data);
    } catch (err) {
      console.error("ListRoles error:", err);
      setRoles([]);
    } finally {
      setLoadingRoles(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    if (fetchedRolesRef.current) return;

    fetchedRolesRef.current = true;
    fetchRoles();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    loadExistingContacts();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    if (isEditMode && user) {
      const matchedRole = roles.find(
        (r) => r.role.toLowerCase() === String(user.role || "").toLowerCase()
      );

      setFormData({
        email: user.email ?? "",
        password: "",
        first_name: user.first_name ?? "",
        last_name: user.last_name ?? "",
        profile: user.profile ?? "",
        phone_number: user.phone_number ?? "",
        location: user.location ?? "",
        position: user.position ?? "",
        app_role_id: matchedRole?.id ?? "",
      });
    } else {
      setFormData(EMPTY_FORM);
    }

    setSubmitting(false);
    setUploadingImage(false);
    setError("");
    setRoleOpen(false);
    setRoleSearch("");
    setEmailDuplicateError("");
    setPhoneDuplicateError("");
    setPhoneValidationError("");
    setPasswordValidationError("");
  }, [open, isEditMode, user, roles]);

  useEffect(() => {
    if (!roleOpen) return;

    const onClickOutside = (e: MouseEvent) => {
      if (
        roleDropdownRef.current &&
        !roleDropdownRef.current.contains(e.target as Node)
      ) {
        setRoleOpen(false);
      }
    };

    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [roleOpen]);

  useEffect(() => {
    if (!open) return;

    setEmailDuplicateError(checkDuplicateEmail(formData.email));
    setPhoneDuplicateError(checkDuplicatePhone(formData.phone_number));
    setPhoneValidationError(validateThaiPhoneNumber(formData.phone_number));

    if (!isEditMode) {
      setPasswordValidationError(validatePassword(formData.password));
    }
  }, [
    formData.email,
    formData.phone_number,
    formData.password,
    existingContacts,
    open,
    isEditMode,
  ]);

  const originalEditForm = useMemo<Payload>(() => {
    if (!isEditMode || !user) return EMPTY_FORM;

    const matchedRole = roles.find(
      (r) => r.role.toLowerCase() === String(user.role || "").toLowerCase()
    );

    return {
      email: user.email ?? "",
      password: "",
      first_name: user.first_name ?? "",
      last_name: user.last_name ?? "",
      profile: user.profile ?? "",
      phone_number: user.phone_number ?? "",
      location: user.location ?? "",
      position: user.position ?? "",
      app_role_id: matchedRole?.id ?? "",
    };
  }, [isEditMode, user, roles]);

  const hasFormChanged = useMemo(() => {
    if (!isEditMode) return true;

    return (
      normalizeEmail(formData.email) !== normalizeEmail(originalEditForm.email) ||
      normalizeString(formData.first_name) !==
        normalizeString(originalEditForm.first_name) ||
      normalizeString(formData.last_name) !==
        normalizeString(originalEditForm.last_name) ||
      normalizePhone(formData.phone_number) !==
        normalizePhone(originalEditForm.phone_number) ||
      normalizeString(formData.location) !==
        normalizeString(originalEditForm.location) ||
      normalizeString(formData.position) !==
        normalizeString(originalEditForm.position) ||
      String(formData.app_role_id || "") !==
        String(originalEditForm.app_role_id || "") ||
      (formData.profile || "") !== (originalEditForm.profile || "")
    );
  }, [formData, originalEditForm, isEditMode]);

  if (!open) return null;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    if (name === "phone_number") {
      const numericOnly = value.replace(/\D/g, "").slice(0, 10);

      setFormData((prev) => ({
        ...prev,
        phone_number: numericOnly,
      }));

      setPhoneValidationError(validateThaiPhoneNumber(numericOnly));
      setPhoneDuplicateError(checkDuplicatePhone(numericOnly));
      return;
    }

    if (name === "email") {
      setFormData((prev) => ({
        ...prev,
        email: value,
      }));

      setEmailDuplicateError(checkDuplicateEmail(value));
      return;
    }

    if (name === "password") {
      setFormData((prev) => ({
        ...prev,
        password: value,
      }));

      if (!isEditMode) {
        setPasswordValidationError(validatePassword(value));
      }
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: name === "app_role_id" ? (value ? Number(value) : "") : value,
    }));
  };

  const handleRoleSelect = (roleId: number) => {
    setFormData((prev) => ({
      ...prev,
      app_role_id: roleId,
    }));
    setRoleOpen(false);
    setRoleSearch("");
  };

  const handleUploadImage = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isImageFile(file)) {
      message.warning("Please upload image only");
      e.target.value = "";
      return;
    }

    try {
      setUploadingImage(true);
      const base64 = await toBase64(file);
      setFormData((prev) => ({
        ...prev,
        profile: base64,
      }));
    } catch (err) {
      console.error("Upload image error:", err);
      message.error("Upload image failed");
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  };

  const validateForm = () => {
    if (!formData.first_name.trim()) return "Please enter first name";
    if (!formData.last_name.trim()) return "Please enter last name";
    if (!formData.email.trim()) return "Please enter email";
    if (!/\S+@\S+\.\S+/.test(formData.email)) return "Invalid email format";
    if (emailDuplicateError) return emailDuplicateError;

    if (!isEditMode && !formData.password.trim()) {
      return "Please enter password";
    }

    if (!isEditMode) {
      const passwordError = validatePassword(formData.password);
      if (passwordError) return passwordError;
    }

    if (!formData.phone_number.trim()) return "Please enter phone number";

    const phoneError = validateThaiPhoneNumber(formData.phone_number);
    if (phoneError) return phoneError;

    if (phoneDuplicateError) return phoneDuplicateError;

    if (!formData.location.trim()) return "Please enter location";
    if (!formData.position.trim()) return "Please enter position";
    if (!formData.app_role_id) return "Please select role";

    if (isEditMode && !hasFormChanged) {
      return "No changes detected";
    }

    return "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (isEditMode && !hasFormChanged) {
      message.warning("No changes detected");
      return;
    }

    await loadExistingContacts();

    const latestEmailDuplicateError = checkDuplicateEmail(formData.email);
    const latestPhoneDuplicateError = checkDuplicatePhone(formData.phone_number);
    const latestPhoneValidationError = validateThaiPhoneNumber(
      formData.phone_number
    );
    const latestPasswordValidationError = !isEditMode
      ? validatePassword(formData.password)
      : "";

    setEmailDuplicateError(latestEmailDuplicateError);
    setPhoneDuplicateError(latestPhoneDuplicateError);
    setPhoneValidationError(latestPhoneValidationError);
    setPasswordValidationError(latestPasswordValidationError);

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSubmitting(true);

      let res: any;

      if (isEditMode && user) {
        const payload = {
          email: formData.email.trim(),
          first_name: formData.first_name.trim(),
          last_name: formData.last_name.trim(),
          profile: formData.profile || "",
          phone_number: formData.phone_number.trim(),
          location: formData.location.trim(),
          position: formData.position.trim(),
          app_role_id: Number(formData.app_role_id),
        };

        res = await UpdateUserIDByAdmin(user.id, payload);
      } else {
        const payload = {
          email: formData.email.trim(),
          password: formData.password.trim(),
          first_name: formData.first_name.trim(),
          last_name: formData.last_name.trim(),
          profile: formData.profile || "",
          phone_number: formData.phone_number.trim(),
          location: formData.location.trim(),
          position: formData.position.trim(),
          app_role_id: Number(formData.app_role_id),
        };

        res = await CreateUser(payload);
      }

      if (!res) {
        setError(isEditMode ? "Update user failed" : "Create user failed");
        return;
      }

      if (res.error) {
        setError(res.error);
        return;
      }

      message.success(
        res.message || (isEditMode ? "Update success" : "Create success")
      );
      onUpdated();
    } catch (err: any) {
      console.error("Submit user error:", err);
      setError(
        err?.response?.data?.error ||
          err?.message ||
          (isEditMode ? "Update user failed" : "Create user failed")
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-300 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-3">
      <div
        className="w-full max-w-4xl overflow-hidden rounded-2xl bg-white dark:bg-[#12101f]"
        style={{ boxShadow: `0 24px 64px -12px ${currentColor}30, 0 8px 24px rgba(0,0,0,.22)` }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/8">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: accentGrad }}>
              {isEditMode ? <FiEdit2 className="text-[14px]" /> : <FiUsers className="text-[14px]" />}
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: currentColor }}>
                {isEditMode ? "EDIT USER" : "CREATE USER"}
              </p>
              <h3 className="text-[14px] font-bold text-slate-800 dark:text-white/90">User Form</h3>
              <p className="text-[10px] text-slate-400 dark:text-white/35">Manage user profile, contact information, role, and profile image.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 disabled:opacity-40 dark:text-white/35 dark:hover:bg-white/8"
          >
            <FiX className="text-[15px]" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="max-h-[64vh] overflow-y-auto px-3 py-3">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[210px_1fr]">
              <div className="rounded-xl border border-gray-200/80 bg-gray-50/70 p-3 dark:border-white/10 dark:bg-white/3">
                <div className="mb-2 flex items-center gap-2">
                  <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-cyan-200/80 bg-white dark:border-white/10 dark:bg-white/5">
                    <FiUser className="text-[11px] text-cyan-600 dark:text-cyan-300" />
                  </div>
                  <p className="text-[10px] font-semibold text-[#1f2240] dark:text-white/90">
                    Profile
                  </p>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-white/10 dark:bg-white/5">
                  <div className="flex flex-col items-center text-center">
                    {formData.profile && isBase64DataImage(formData.profile) ? (
                      <img
                        src={formData.profile}
                        alt="Profile Preview"
                        className="h-18 w-18 rounded-[18px] object-cover ring-1 ring-gray-200 dark:ring-white/10"
                      />
                    ) : (
                      <div className="flex h-18 w-18 items-center justify-center rounded-[18px] border border-dashed border-gray-300 bg-gray-50 text-gray-400 dark:border-white/10 dark:bg-white/5 dark:text-white/35">
                        <FiUser className="text-[20px]" />
                      </div>
                    )}

                    <p className="mt-2.5 text-[10px] font-semibold text-[#1f2240] dark:text-white/90 line-clamp-1">
                      {fullName}
                    </p>
                    <p className="mt-1 break-all text-[8.5px] text-gray-500 dark:text-white/50 line-clamp-2">
                      {formData.email || "No email"}
                    </p>

                    <label className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-[9px] font-semibold text-cyan-700 transition hover:bg-cyan-100 dark:border-cyan-400/20 dark:bg-cyan-500/10 dark:text-cyan-300 dark:hover:bg-cyan-500/15">
                      <FiUpload className="text-[10px]" />
                      {uploadingImage ? "Uploading..." : "Upload"}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleUploadImage}
                        className="hidden"
                      />
                    </label>

                    <div className="mt-2 flex items-center gap-1 text-[8px] text-gray-500 dark:text-white/45">
                      <FiImage className="text-[9px]" />
                      <span>Image files only</span>
                    </div>
                  </div>

                  <div className="mt-3 rounded-lg border border-cyan-200/80 bg-cyan-50/70 px-2.5 py-2 dark:border-cyan-400/20 dark:bg-cyan-500/10">
                    <div className="space-y-1.5">
                      <p className="text-[8.5px] text-cyan-800 dark:text-cyan-200 line-clamp-1">
                        <span className="font-semibold">Name:</span> {fullName}
                      </p>
                      <p className="text-[8.5px] text-cyan-800 dark:text-cyan-200 line-clamp-1">
                        <span className="font-semibold">Role:</span>{" "}
                        {selectedRoleName || "-"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-xl border border-gray-200/80 bg-gray-50/70 p-3 dark:border-white/10 dark:bg-white/3">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-cyan-200/80 bg-white dark:border-white/10 dark:bg-white/5">
                      <FiUser className="text-[11px] text-cyan-600 dark:text-cyan-300" />
                    </div>
                    <p className="text-[10px] font-semibold text-[#1f2240] dark:text-white/90">
                      Basic Information
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 flex items-center gap-1 text-[8.5px] font-medium text-gray-600 dark:text-white/65">
                        <FiUser className="text-[9px] text-cyan-600 dark:text-cyan-300" />
                        First Name
                      </label>
                      <div className="relative">
                        <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] text-gray-400 dark:text-white/35" />
                        <input
                          type="text"
                          name="first_name"
                          value={formData.first_name}
                          onChange={handleChange}
                          placeholder="First name"
                          className={["pl-8", inputCls].join(" ")}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 flex items-center gap-1 text-[8.5px] font-medium text-gray-600 dark:text-white/65">
                        <FiUser className="text-[9px] text-cyan-600 dark:text-cyan-300" />
                        Last Name
                      </label>
                      <div className="relative">
                        <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] text-gray-400 dark:text-white/35" />
                        <input
                          type="text"
                          name="last_name"
                          value={formData.last_name}
                          onChange={handleChange}
                          placeholder="Last name"
                          className={["pl-8", inputCls].join(" ")}
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="mb-1 flex items-center gap-1 text-[8.5px] font-medium text-gray-600 dark:text-white/65">
                        <FiMail className="text-[9px] text-cyan-600 dark:text-cyan-300" />
                        Email
                      </label>
                      <div className="relative">
                        <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] text-gray-400 dark:text-white/35" />
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          placeholder="Email"
                          className={["pl-8", inputCls].join(" ")}
                        />
                      </div>
                      {emailDuplicateError ? (
                        <div className="mt-1 pl-1 text-[9px] font-medium text-red-600 dark:text-red-400">
                          {emailDuplicateError}
                        </div>
                      ) : null}
                    </div>

                    {!isEditMode && (
                      <div className="sm:col-span-2">
                        <label className="mb-1 flex items-center gap-1 text-[8.5px] font-medium text-gray-600 dark:text-white/65">
                          <FiShield className="text-[9px] text-cyan-600 dark:text-cyan-300" />
                          Password
                        </label>
                        <div className="relative">
                          <FiShield className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] text-gray-400 dark:text-white/35" />
                          <input
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            placeholder="Password"
                            className={["pl-8", inputCls].join(" ")}
                          />
                        </div>

                        {passwordValidationError ? (
                          <div className="mt-1 pl-1 text-[9px] font-medium text-red-600 dark:text-red-400">
                            {passwordValidationError}
                          </div>
                        ) : (
                          <div className="mt-1 pl-1 text-[8.5px] text-gray-500 dark:text-white/45">
                            Password must be at least 8 characters and include
                            uppercase, lowercase, and special character.
                          </div>
                        )}
                      </div>
                    )}

                    <div>
                      <label className="mb-1 flex items-center gap-1 text-[8.5px] font-medium text-gray-600 dark:text-white/65">
                        <FiPhone className="text-[9px] text-cyan-600 dark:text-cyan-300" />
                        Phone Number
                      </label>
                      <div className="relative">
                        <FiPhone className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] text-gray-400 dark:text-white/35" />
                        <input
                          type="text"
                          name="phone_number"
                          value={formData.phone_number}
                          onChange={handleChange}
                          placeholder="Phone number"
                          inputMode="numeric"
                          maxLength={10}
                          className={["pl-8", inputCls].join(" ")}
                        />
                      </div>
                      {phoneValidationError ? (
                        <div className="mt-1 pl-1 text-[9px] font-medium text-red-600 dark:text-red-400">
                          {phoneValidationError}
                        </div>
                      ) : phoneDuplicateError ? (
                        <div className="mt-1 pl-1 text-[9px] font-medium text-red-600 dark:text-red-400">
                          {phoneDuplicateError}
                        </div>
                      ) : null}
                    </div>

                    <div>
                      <label className="mb-1 flex items-center gap-1 text-[8.5px] font-medium text-gray-600 dark:text-white/65">
                        <FiMapPin className="text-[9px] text-cyan-600 dark:text-cyan-300" />
                        Location
                      </label>
                      <div className="relative">
                        <FiMapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] text-gray-400 dark:text-white/35" />
                        <input
                          type="text"
                          name="location"
                          value={formData.location}
                          onChange={handleChange}
                          placeholder="Location"
                          className={["pl-8", inputCls].join(" ")}
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="mb-1 flex items-center gap-1 text-[8.5px] font-medium text-gray-600 dark:text-white/65">
                        <FiBriefcase className="text-[9px] text-cyan-600 dark:text-cyan-300" />
                        Position
                      </label>
                      <div className="relative">
                        <FiBriefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] text-gray-400 dark:text-white/35" />
                        <input
                          type="text"
                          name="position"
                          value={formData.position}
                          onChange={handleChange}
                          placeholder="Position"
                          className={["pl-8", inputCls].join(" ")}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200/80 bg-gray-50/70 p-3 dark:border-white/10 dark:bg-white/3">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-cyan-200/80 bg-white dark:border-white/10 dark:bg-white/5">
                      <FiShield className="text-[11px] text-cyan-600 dark:text-cyan-300" />
                    </div>
                    <p className="text-[10px] font-semibold text-[#1f2240] dark:text-white/90">
                      Role
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    <div className="relative" ref={roleDropdownRef}>
                      <label className="mb-1 flex items-center gap-1 text-[8.5px] font-medium text-gray-600 dark:text-white/65">
                        <FiShield className="text-[9px] text-cyan-600 dark:text-cyan-300" />
                        Role
                      </label>

                      <button
                        type="button"
                        onClick={() => {
                          if (!loadingRoles) {
                            setRoleOpen((prev) => !prev);
                          }
                        }}
                        disabled={loadingRoles}
                        className={selectorButtonCls}
                      >
                        <FiShield className="shrink-0 text-[10px]" />
                        <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[10px] font-medium">
                          {loadingRoles
                            ? "Loading role..."
                            : selectedRoleName || "Select role"}
                        </span>
                        <FiChevronDown
                          className={`ml-auto text-[10px] transition-transform ${
                            roleOpen ? "rotate-180" : ""
                          }`}
                        />
                      </button>

                      {roleOpen && (
                        <div
                          className={[
                            "absolute bottom-full left-0 right-0 z-50 mb-1.5 overflow-hidden rounded-xl",
                            "border border-gray-200 bg-white shadow-xl",
                            "dark:border-white/10 dark:bg-[#0B1220] dark:shadow-none",
                          ].join(" ")}
                        >
                          <div className="border-b border-gray-100 p-1.5 dark:border-white/10">
                            <div
                              className={[
                                "flex items-center gap-1.5 rounded-lg border px-2.5",
                                "border-gray-200/80 bg-gray-50",
                                "dark:border-white/10 dark:bg-white/5",
                              ].join(" ")}
                            >
                              <FiSearch className="shrink-0 text-[10px] text-gray-400 dark:text-white/40" />
                              <input
                                value={roleSearch}
                                onChange={(e) => setRoleSearch(e.target.value)}
                                placeholder="Search role"
                                className={searchInputCls}
                              />
                            </div>
                          </div>

                          <div className="max-h-32 overflow-y-auto p-1.5">
                            {loadingRoles ? (
                              <div className="px-2 py-3 text-center text-[10px] text-gray-500 dark:text-white/50">
                                Loading role...
                              </div>
                            ) : filteredRoles.length === 0 ? (
                              <div className="px-2 py-3 text-center text-[10px] text-gray-500 dark:text-white/50">
                                No matching role
                              </div>
                            ) : (
                              <div className="space-y-1">
                                {filteredRoles.map((role) => {
                                  const checked =
                                    Number(formData.app_role_id) === role.id;

                                  return (
                                    <button
                                      key={role.id}
                                      type="button"
                                      onClick={() => handleRoleSelect(role.id)}
                                      className={[
                                        "w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-left transition",
                                        checked
                                          ? "border border-cyan-200 bg-cyan-50 dark:border-cyan-400/20 dark:bg-cyan-500/10"
                                          : "border border-transparent hover:bg-gray-50 dark:hover:bg-white/5",
                                      ].join(" ")}
                                    >
                                      <span
                                        className={[
                                          "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border transition",
                                          checked
                                            ? "border-cyan-500 bg-cyan-500 text-white"
                                            : "border-gray-300 bg-white text-transparent dark:border-white/20 dark:bg-white/5",
                                        ].join(" ")}
                                      >
                                        <FiCheck className="text-[7px]" />
                                      </span>

                                      <span className="min-w-0 flex-1 truncate text-[9px] font-medium text-gray-700 dark:text-white/80">
                                        {role.role}
                                      </span>

                                      {checked && (
                                        <span
                                          className={[
                                            "inline-flex items-center rounded-full border px-1.5 py-0.5 text-[7.5px] font-semibold",
                                            getRoleBadgeClass(role.role),
                                          ].join(" ")}
                                        >
                                          Selected
                                        </span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="rounded-lg border border-cyan-200/80 bg-cyan-50/70 px-2.5 py-2 dark:border-cyan-400/20 dark:bg-cyan-500/10">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[8.5px] font-semibold text-cyan-800 dark:text-cyan-200">
                          Selected:
                        </span>
                        {selectedRoleName ? (
                          <span
                            className={[
                              "inline-flex items-center rounded-full border px-2 py-0.5 text-[8px] font-semibold",
                              getRoleBadgeClass(selectedRoleName),
                            ].join(" ")}
                          >
                            {selectedRoleName}
                          </span>
                        ) : (
                          <span className="text-[8.5px] text-cyan-800 dark:text-cyan-200">
                            -
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center text-[9px] text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300">
                    {error}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-2.5 border-t border-slate-100 px-5 py-4 dark:border-white/8">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 rounded-xl border border-slate-200 py-2.5 text-[12.5px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60 dark:border-white/8 dark:text-white/55 dark:hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                submitting ||
                uploadingImage ||
                loadingExistingContacts ||
                !!emailDuplicateError ||
                !!phoneDuplicateError ||
                !!phoneValidationError ||
                (!isEditMode && !!passwordValidationError) ||
                (isEditMode && !hasFormChanged)
              }
              style={
                !(submitting || uploadingImage || loadingExistingContacts || !!emailDuplicateError || !!phoneDuplicateError || !!phoneValidationError || (!isEditMode && !!passwordValidationError) || (isEditMode && !hasFormChanged))
                  ? { background: accentGrad }
                  : undefined
              }
              className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-[12.5px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:opacity-60"
            >
              <FiSave className="text-[11px]" />
              {submitting ? (isEditMode ? "Saving…" : "Creating…") : isEditMode ? "Save Changes" : "Create User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModalCreateandUpdateUser;