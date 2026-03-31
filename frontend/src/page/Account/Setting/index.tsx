import React, { useEffect, useMemo, useState } from "react";
import { FiCheckCircle } from "react-icons/fi";
import { CameraOutlined } from "@ant-design/icons";
import { message } from "antd";
import {
  UpdateUserByID,
  type UserResponse,
  type UpdateUserInput,
} from "../../../services/user";

type SettingProps = {
  user: UserResponse;
  onUpdated: () => void;
};

type SettingForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  location: string;
  position: string;
};

const Setting: React.FC<SettingProps> = ({ user, onUpdated }) => {
  const createInitialForm = (userData: UserResponse): SettingForm => ({
    firstName: userData.first_name || "",
    lastName: userData.last_name || "",
    email: userData.email || "",
    phone: userData.phone_number || "",
    location: userData.location || "",
    position: userData.position || "",
  });

  const [form, setForm] = useState<SettingForm>(createInitialForm(user));
  const [submitting, setSubmitting] = useState<boolean>(false);
  //@ts-ignore
  const [uploadFile, setUploadFile] = useState<File | undefined>(undefined);
  const [profileBase64, setProfileBase64] = useState<string | undefined>(
    undefined
  );

  useEffect(() => {
    setForm(createInitialForm(user));
    setUploadFile(undefined);
    setProfileBase64(undefined);
  }, [user]);

  const previewUrl = useMemo(() => {
    if (profileBase64) return profileBase64;
    if (user.profile) return user.profile;
    return "";
  }, [profileBase64, user.profile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    if (name === "phone") {
      const numericOnly = value.replace(/\D/g, "").slice(0, 10);
      setForm((prev) => ({ ...prev, phone: numericOnly }));
      return;
    }

    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (file?: File) => {
    if (!file) {
      setUploadFile(undefined);
      setProfileBase64(undefined);
      return;
    }

    if (!file.type.startsWith("image/")) {
      message.error("กรุณาอัปโหลดไฟล์รูปภาพเท่านั้น");
      return;
    }

    setUploadFile(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      setProfileBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const validatePhone = (phone: string) => {
    if (!phone.trim()) {
      return "กรุณากรอกเบอร์โทรศัพท์";
    }

    if (!/^0\d*$/.test(phone)) {
      return "เบอร์โทรต้องขึ้นต้นด้วย 0 และเป็นตัวเลขเท่านั้น";
    }

    if (phone.length > 10) {
      return "เบอร์โทรต้องมีความยาวไม่เกิน 10 ตัว";
    }

    if (phone.length !== 10) {
      return "เบอร์โทรต้องมี 10 หลัก";
    }

    return "";
  };

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.id) {
      message.error("ไม่พบรหัสผู้ใช้งาน");
      return;
    }

    if (!form.firstName.trim()) {
      message.error("กรุณากรอกชื่อ");
      return;
    }

    if (!form.lastName.trim()) {
      message.error("กรุณากรอกนามสกุล");
      return;
    }

    if (!form.email.trim()) {
      message.error("ไม่พบอีเมลผู้ใช้งาน");
      return;
    }

    const phoneError = validatePhone(form.phone);
    if (phoneError) {
      message.error(phoneError);
      return;
    }

    if (!form.location.trim()) {
      message.error("กรุณากรอก Location");
      return;
    }

    if (!form.position.trim()) {
      message.error("กรุณากรอก Position");
      return;
    }

    try {
      setSubmitting(true);

      const payload: UpdateUserInput = {
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        phone_number: form.phone.trim(),
        location: form.location.trim(),
        position: form.position.trim(),
        ...(profileBase64 ? { profile: profileBase64 } : {}),
      };

      const updated = await UpdateUserByID(user.id, payload);

      if (!updated) {
        message.error("อัปเดตข้อมูลไม่สำเร็จ");
        return;
      }

      setForm(createInitialForm(updated));
      setUploadFile(undefined);
      setProfileBase64(undefined);

      message.success("บันทึกข้อมูลสำเร็จ");
      onUpdated();
    } catch (err: any) {
      console.error("Update profile error:", err);
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        "อัปเดตข้อมูลไม่สำเร็จ";
      message.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = [
    "w-full h-10 rounded-[10px] border px-3.5 text-[13px] outline-none",
    "border-gray-300 bg-white text-gray-700",
    "focus:ring-2 focus:ring-[#7a67ea]/25 focus:border-[#7a67ea]",
    "dark:border-white/10 dark:bg-white/5 dark:text-white/80",
    "dark:placeholder:text-white/35",
  ].join(" ");

  const disabledInputClass = [
    "w-full h-10 rounded-[10px] border px-3.5 text-[13px] outline-none cursor-not-allowed",
    "border-gray-200 bg-gray-100 text-gray-500",
    "dark:border-white/10 dark:bg-white/10 dark:text-white/45",
  ].join(" ");

  return (
    <section
      className={[
        "h-full rounded-[18px] border shadow-sm overflow-hidden flex flex-col",
        "border-gray-200/80 bg-[#f7f7f8]",
        "dark:border-white/10 dark:bg-white/5 dark:shadow-none dark:ring-1 dark:ring-white/10",
      ].join(" ")}
    >
      <div
        className={[
          "px-4 sm:px-5 py-3.5 border-b",
          "border-gray-200/80",
          "dark:border-white/10",
        ].join(" ")}
      >
        <h2 className="text-[16px] sm:text-[18px] font-semibold text-[#1f2240] dark:text-white/85">
          Account Settings
        </h2>
      </div>

      <form onSubmit={onSave} className="p-4 sm:p-5 flex-1 flex flex-col">
        <div>
          <div className="mb-5 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2.5">
              <label
                htmlFor="profile-upload-input"
                className={[
                  "relative flex h-22 w-22 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed transition",
                  "border-gray-300 bg-white hover:border-[#7a67ea]",
                  "dark:border-white/15 dark:bg-white/5 dark:hover:border-[#7a67ea]",
                ].join(" ")}
              >
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="profile preview"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <CameraOutlined className="text-[20px] text-[#7a67ea]" />
                )}

                <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors" />
              </label>

              <input
                id="profile-upload-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileChange(e.target.files?.[0])}
              />

              <p className="text-[11px] text-gray-500 dark:text-white/45">
                คลิกเพื่ออัปโหลดรูปโปรไฟล์
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <label className="block mb-1.5 text-[12px] font-medium text-[#374151] dark:text-white/65">
                First Name
              </label>
              <input
                name="firstName"
                value={form.firstName}
                onChange={handleChange}
                type="text"
                className={inputClass}
              />
            </div>

            <div>
              <label className="block mb-1.5 text-[12px] font-medium text-[#374151] dark:text-white/65">
                Last Name
              </label>
              <input
                name="lastName"
                value={form.lastName}
                onChange={handleChange}
                type="text"
                className={inputClass}
              />
            </div>

            <div>
              <label className="block mb-1.5 text-[12px] font-medium text-[#374151] dark:text-white/65">
                Email Address
              </label>
              <input
                name="email"
                value={form.email}
                type="email"
                disabled
                readOnly
                className={disabledInputClass}
              />
            </div>

            <div>
              <label className="block mb-1.5 text-[12px] font-medium text-[#374151] dark:text-white/65">
                Phone No
              </label>
              <input
                name="phone"
                value={form.phone}
                onChange={handleChange}
                type="text"
                inputMode="numeric"
                maxLength={10}
                placeholder="0XXXXXXXXX"
                className={inputClass}
              />
              <p className="mt-1 text-[11px] text-gray-500 dark:text-white/40">
                ต้องเป็นตัวเลข 10 หลัก และขึ้นต้นด้วย 0
              </p>
            </div>

            <div>
              <label className="block mb-1.5 text-[12px] font-medium text-[#374151] dark:text-white/65">
                Location
              </label>
              <input
                name="location"
                value={form.location}
                onChange={handleChange}
                type="text"
                className={inputClass}
              />
            </div>

            <div>
              <label className="block mb-1.5 text-[12px] font-medium text-[#374151] dark:text-white/65">
                Position
              </label>
              <input
                name="position"
                value={form.position}
                onChange={handleChange}
                type="text"
                className={inputClass}
                placeholder="Enter position"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <button
            type="submit"
            disabled={submitting}
            className={[
              "inline-flex items-center gap-2 rounded-[10px] px-3.5 py-2 transition-colors",
              "bg-[#6f5be8] hover:bg-[#624de0] text-white font-semibold text-[13px]",
              submitting ? "opacity-70 cursor-not-allowed" : "",
            ].join(" ")}
          >
            <FiCheckCircle className="text-[14px]" />
            {submitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </section>
  );
};

export default Setting;