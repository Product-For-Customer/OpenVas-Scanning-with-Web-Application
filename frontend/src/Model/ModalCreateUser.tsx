import React, { useEffect, useMemo, useState } from "react";
import {
  FiArrowRight,
  FiBriefcase,
  FiChevronDown,
  FiMail,
  FiMapPin,
  FiPhone,
  FiShield,
  FiUpload,
  FiUser,
  FiX,
} from "react-icons/fi";
import { message } from "antd";
import { ListRoles, UpdateUserIDByAdmin } from "../services";

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

type ModalCreateUserProps = {
  open: boolean;
  user: UiUser | null;
  onClose: () => void;
  onUpdated: () => void;
};

type UpdatePayload = {
  email: string;
  first_name: string;
  last_name: string;
  profile: string;
  phone_number: string;
  location: string;
  position: string;
  app_role_id: number | "";
};

const toBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });

const getRoleBadgeClass = (role: string) => {
  if (role === "Admin") {
    return "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/20 dark:bg-violet-500/10 dark:text-violet-200";
  }

  return "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-500/10 dark:text-cyan-200";
};

const ModalCreateUser: React.FC<ModalCreateUserProps> = ({
  open,
  user,
  onClose,
  onUpdated,
}) => {
  const [formData, setFormData] = useState<UpdatePayload>({
    email: "",
    first_name: "",
    last_name: "",
    profile: "",
    phone_number: "",
    location: "",
    position: "",
    app_role_id: "",
  });

  const [roles, setRoles] = useState<RoleResponse[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState("");

  const fullName = useMemo(() => {
    return `${formData.first_name} ${formData.last_name}`.trim() || "User";
  }, [formData.first_name, formData.last_name]);

  const selectedRoleName = useMemo(() => {
    const found = roles.find((r) => r.id === Number(formData.app_role_id));
    return found?.role || "";
  }, [roles, formData.app_role_id]);

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
    if (open) {
      fetchRoles();
    }
  }, [open]);

  useEffect(() => {
    if (open && user) {
      const matchedRole = roles.find(
        (r) => r.role.toLowerCase() === String(user.role || "").toLowerCase()
      );

      setFormData({
        email: user.email ?? "",
        first_name: user.first_name ?? "",
        last_name: user.last_name ?? "",
        profile: user.profile ?? "",
        phone_number: user.phone_number ?? "",
        location: user.location ?? "",
        position: user.position ?? "",
        app_role_id: matchedRole?.id ?? "",
      });

      setSubmitting(false);
      setUploadingImage(false);
      setError("");
    }
  }, [open, user, roles]);

  if (!open || !user) return null;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: name === "app_role_id" ? (value ? Number(value) : "") : value,
    }));
  };

  const handleUploadImage = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingImage(true);
      const base64 = await toBase64(file);
      setFormData((prev) => ({
        ...prev,
        profile: base64,
      }));
    } catch (err) {
      console.error("Upload image error:", err);
      message.error("อัปโหลดรูปไม่สำเร็จ");
    } finally {
      setUploadingImage(false);
    }
  };

  const validateForm = () => {
    if (!formData.first_name.trim()) return "กรุณากรอก First Name";
    if (!formData.last_name.trim()) return "กรุณากรอก Last Name";
    if (!formData.email.trim()) return "กรุณากรอก Email";
    if (!/\S+@\S+\.\S+/.test(formData.email)) return "รูปแบบ Email ไม่ถูกต้อง";
    if (!formData.phone_number.trim()) return "กรุณากรอก Phone Number";
    if (!formData.location.trim()) return "กรุณากรอก Location";
    if (!formData.position.trim()) return "กรุณากรอก Position";
    if (!formData.app_role_id) return "กรุณาเลือก Role";
    return "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSubmitting(true);

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

      const res: any = await UpdateUserIDByAdmin(user.id, payload);

      if (!res) {
        setError("อัปเดตข้อมูลผู้ใช้ไม่สำเร็จ");
        return;
      }

      if (res.error) {
        setError(res.error);
        return;
      }

      message.success(res.message || "อัปเดตข้อมูลผู้ใช้สำเร็จ");
      onUpdated();
    } catch (err: any) {
      console.error("Update user by admin error:", err);
      setError(
        err?.response?.data?.error ||
          err?.message ||
          "เกิดข้อผิดพลาดระหว่างอัปเดตผู้ใช้"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-300 flex items-center justify-center bg-slate-900/30 backdrop-blur-[3px] px-4 py-6">
      <div
        className={[
          "relative w-full max-w-4xl rounded-3xl border px-6 py-7",
          "border-slate-200/80 bg-white",
          "shadow-[0_20px_70px_rgba(15,23,42,0.16)]",
          "dark:border-white/10 dark:bg-[#0f172a]",
          "max-h-[92vh] overflow-y-auto",
        ].join(" ")}
      >
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed dark:text-white/45 dark:hover:bg-white/10 dark:hover:text-white/80"
          aria-label="Close modal"
        >
          <FiX className="text-[20px]" />
        </button>

        <div className="mx-auto flex h-15 w-15 items-center justify-center rounded-full bg-slate-100 dark:bg-white/8">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-linear-to-r from-cyan-500 to-violet-500 text-white shadow-[0_8px_20px_rgba(79,109,245,0.28)]">
            <FiUser className="text-[18px]" />
          </div>
        </div>

        <h3 className="mt-4 text-center text-[24px] font-bold tracking-tight text-slate-900 dark:text-white">
          Edit User Account
        </h3>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-2.5 text-center text-[12px] text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-6">
          <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-[13px] font-medium text-slate-700 dark:text-white/80">
                Profile Preview
              </label>

              <div className="flex min-h-27.5 items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                {formData.profile ? (
                  <img
                    src={formData.profile}
                    alt="Profile Preview"
                    className="h-20 w-20 rounded-2xl object-cover ring-1 ring-slate-200 dark:ring-white/10"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-white/40">
                    <FiUser className="text-[28px]" />
                  </div>
                )}

                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-slate-800 dark:text-white">
                    {fullName}
                  </p>
                  <p className="mt-1 break-all text-[12px] text-slate-500 dark:text-white/50">
                    {formData.email || "No email"}
                  </p>
                  <p className="mt-1 text-[12px] text-slate-500 dark:text-white/50">
                    แสดงตัวอย่างรูปโปรไฟล์ปัจจุบัน
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-[13px] font-medium text-slate-700 dark:text-white/80">
                Upload Profile Image
              </label>

              <label className="flex min-h-27.5 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-4 text-[14px] text-slate-600 transition hover:border-[#4f6df5] hover:bg-[#f8fbff] dark:border-white/10 dark:bg-white/5 dark:text-white/75">
                <FiUpload className="text-[22px]" />
                <span className="font-medium">
                  {uploadingImage ? "Uploading..." : "Upload profile image"}
                </span>
                <span className="text-center text-[12px] text-slate-400 dark:text-white/40">
                  รองรับไฟล์รูปภาพ และจะแสดง preview ทันที
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleUploadImage}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-[13px] font-medium text-slate-700 dark:text-white/80">
                First Name
              </label>
              <div className="relative">
                <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  placeholder="Enter first name"
                  className="h-12 w-full rounded-2xl border border-slate-300 bg-white pl-10 pr-4 text-[14px] text-slate-900 outline-none transition focus:border-[#4f6df5] focus:ring-4 focus:ring-[#4f6df5]/12 dark:border-white/10 dark:bg-white/5 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-[13px] font-medium text-slate-700 dark:text-white/80">
                Last Name
              </label>
              <div className="relative">
                <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  placeholder="Enter last name"
                  className="h-12 w-full rounded-2xl border border-slate-300 bg-white pl-10 pr-4 text-[14px] text-slate-900 outline-none transition focus:border-[#4f6df5] focus:ring-4 focus:ring-[#4f6df5]/12 dark:border-white/10 dark:bg-white/5 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-[13px] font-medium text-slate-700 dark:text-white/80">
                Email
              </label>
              <div className="relative">
                <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Enter email"
                  className="h-12 w-full rounded-2xl border border-slate-300 bg-white pl-10 pr-4 text-[14px] text-slate-900 outline-none transition focus:border-[#4f6df5] focus:ring-4 focus:ring-[#4f6df5]/12 dark:border-white/10 dark:bg-white/5 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-[13px] font-medium text-slate-700 dark:text-white/80">
                Phone Number
              </label>
              <div className="relative">
                <FiPhone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  name="phone_number"
                  value={formData.phone_number}
                  onChange={handleChange}
                  placeholder="Enter phone number"
                  className="h-12 w-full rounded-2xl border border-slate-300 bg-white pl-10 pr-4 text-[14px] text-slate-900 outline-none transition focus:border-[#4f6df5] focus:ring-4 focus:ring-[#4f6df5]/12 dark:border-white/10 dark:bg-white/5 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-[13px] font-medium text-slate-700 dark:text-white/80">
                Location
              </label>
              <div className="relative">
                <FiMapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  placeholder="Enter location"
                  className="h-12 w-full rounded-2xl border border-slate-300 bg-white pl-10 pr-4 text-[14px] text-slate-900 outline-none transition focus:border-[#4f6df5] focus:ring-4 focus:ring-[#4f6df5]/12 dark:border-white/10 dark:bg-white/5 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-[13px] font-medium text-slate-700 dark:text-white/80">
                Position
              </label>
              <div className="relative">
                <FiBriefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  name="position"
                  value={formData.position}
                  onChange={handleChange}
                  placeholder="Enter position"
                  className="h-12 w-full rounded-2xl border border-slate-300 bg-white pl-10 pr-4 text-[14px] text-slate-900 outline-none transition focus:border-[#4f6df5] focus:ring-4 focus:ring-[#4f6df5]/12 dark:border-white/10 dark:bg-white/5 dark:text-white"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-[13px] font-medium text-slate-700 dark:text-white/80">
                Role
              </label>

              <div className="relative">
                <FiShield className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-slate-400" />

                <select
                  name="app_role_id"
                  value={formData.app_role_id}
                  onChange={handleChange}
                  disabled={loadingRoles}
                  className={[
                    "h-13 w-full appearance-none rounded-2xl border bg-white pl-11 pr-12 text-[14px] font-medium text-slate-900 outline-none transition-all",
                    "border-slate-300 shadow-[0_4px_14px_rgba(15,23,42,0.03)]",
                    "hover:border-slate-400",
                    "focus:border-[#4f6df5] focus:ring-4 focus:ring-[#4f6df5]/12",
                    "disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400",
                    "dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:border-white/20 dark:disabled:bg-white/5 dark:disabled:text-white/35",
                  ].join(" ")}
                >
                  <option value="">
                    {loadingRoles ? "Loading roles..." : "Select role"}
                  </option>

                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.role}
                    </option>
                  ))}
                </select>

                <FiChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[18px] text-slate-500 dark:text-white/55" />
              </div>

              <div className="mt-3 flex items-center gap-2">
                <span className="text-[12px] text-slate-500 dark:text-white/45">
                  Current role:
                </span>

                {selectedRoleName ? (
                  <span
                    className={[
                      "inline-flex items-center rounded-full border px-3 py-1 text-[12px] font-semibold",
                      getRoleBadgeClass(selectedRoleName),
                    ].join(" ")}
                  >
                    {selectedRoleName === "Admin" ? (
                      <FiShield className="mr-1.5 text-[12px]" />
                    ) : (
                      <FiUser className="mr-1.5 text-[12px]" />
                    )}
                    {selectedRoleName}
                  </span>
                ) : (
                  <span className="text-[12px] text-slate-400 dark:text-white/35">
                    ยังไม่ได้เลือก role
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className={[
              "mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-semibold text-white transition-all",
              "bg-linear-to-r from-cyan-500 via-sky-500 to-violet-500",
              "shadow-[0_10px_28px_rgba(63,92,240,0.24)]",
              "hover:scale-[1.01] active:scale-[0.99]",
              "focus:outline-none focus:ring-4 focus:ring-cyan-200/50",
              submitting ? "cursor-not-allowed opacity-70" : "",
            ].join(" ")}
          >
            <span>{submitting ? "Updating..." : "Update user"}</span>
            <FiArrowRight className="text-[16px]" />
          </button>

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="mt-3 w-full text-center text-[13px] text-slate-500 transition hover:text-slate-700 dark:text-white/45 dark:hover:text-white/75"
          >
            Cancel
          </button>
        </form>
      </div>
    </div>
  );
};

export default ModalCreateUser;