import React, { useEffect, useMemo, useState } from "react";
import { FiCheckCircle, FiSettings, FiShield } from "react-icons/fi";
import { CameraOutlined } from "@ant-design/icons";
import { message } from "antd";
import {
  UpdateUserByID,
  type UserResponse,
  type UpdateUserInput,
} from "../../../services/user";
import { ListEmailAndPhoneNumber } from "../../../services";

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

type TouchedField = {
  firstName: boolean;
  lastName: boolean;
  email: boolean;
  phone: boolean;
  location: boolean;
  position: boolean;
};

type EmailAndPhoneNumberResponse = {
  id: number;
  email: string;
  phone_number: string;
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
  const [submitting, setSubmitting] = useState<boolean>(false); //@ts-ignore
  const [uploadFile, setUploadFile] = useState<File | undefined>(undefined);
  const [profileBase64, setProfileBase64] = useState<string | undefined>(
    undefined
  );
  const [touched, setTouched] = useState<TouchedField>({
    firstName: false,
    lastName: false,
    email: false,
    phone: false,
    location: false,
    position: false,
  });

  const [existingContacts, setExistingContacts] = useState<
    EmailAndPhoneNumberResponse[]
  >([]);
  const [loadingContacts, setLoadingContacts] = useState(false);

  useEffect(() => {
    setForm(createInitialForm(user));
    setUploadFile(undefined);
    setProfileBase64(undefined);
    setTouched({
      firstName: false,
      lastName: false,
      email: false,
      phone: false,
      location: false,
      position: false,
    });
  }, [user]);

  useEffect(() => {
    const loadContacts = async () => {
      try {
        setLoadingContacts(true);
        const data = await ListEmailAndPhoneNumber();
        setExistingContacts(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("ListEmailAndPhoneNumber error:", error);
        setExistingContacts([]);
      } finally {
        setLoadingContacts(false);
      }
    };

    loadContacts();
  }, []);

  const previewUrl = useMemo(() => {
    if (profileBase64) return profileBase64;
    if (user.profile) return user.profile;
    return "";
  }, [profileBase64, user.profile]);

  const normalize = (value: string) => value.trim();
  const normalizeEmail = (value: string) => value.trim().toLowerCase();
  const normalizePhone = (value: string) => value.replace(/\D/g, "").trim();

  const validateFirstName = (value: string) => {
    if (!value.trim()) return "Please enter first name";
    return "";
  };

  const validateLastName = (value: string) => {
    if (!value.trim()) return "Please enter last name";
    return "";
  };

  const validateEmailDuplicate = (value: string) => {
    const email = normalizeEmail(value);
    if (!email) return "";

    const isDuplicate = existingContacts.some((item) => {
      const sameEmail = normalizeEmail(item.email) === email;
      const isCurrentUser = Number(item.id) === Number(user.id);
      return sameEmail && !isCurrentUser;
    });

    return isDuplicate ? "This email is already in use" : "";
  };

  const validateEmail = (value: string) => {
    const email = value.trim();
    if (!email) return "Please enter email";

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return "Invalid email format";

    const duplicateError = validateEmailDuplicate(email);
    if (duplicateError) return duplicateError;

    return "";
  };

  const validatePhoneDuplicate = (value: string) => {
    const phone = normalizePhone(value);
    if (!phone) return "";

    const isDuplicate = existingContacts.some((item) => {
      const samePhone = normalizePhone(item.phone_number) === phone;
      const isCurrentUser = Number(item.id) === Number(user.id);
      return samePhone && !isCurrentUser;
    });

    return isDuplicate ? "This phone number is already in use" : "";
  };

  const validatePhone = (value: string) => {
    const phone = normalizePhone(value);

    if (!phone) return "Please enter phone number";
    if (!phone.startsWith("0")) return "Phone number must start with 0";
    if (phone.length !== 10) return "Phone number must be 10 digits";

    const duplicateError = validatePhoneDuplicate(phone);
    if (duplicateError) return duplicateError;

    return "";
  };

  const validateLocation = (value: string) => {
    if (!value.trim()) return "Please enter location";
    return "";
  };

  const validatePosition = (value: string) => {
    if (!value.trim()) return "Please enter position";
    return "";
  };

  const errors = useMemo(
    () => ({
      firstName: validateFirstName(form.firstName),
      lastName: validateLastName(form.lastName),
      email: validateEmail(form.email),
      phone: validatePhone(form.phone),
      location: validateLocation(form.location),
      position: validatePosition(form.position),
    }),
    [form, existingContacts, user.id]
  );

  const isFormValid = useMemo(() => {
    return Object.values(errors).every((error) => !error);
  }, [errors]);

  const hasFormChanged = useMemo(() => {
    const initial = createInitialForm(user);

    return (
      normalize(form.firstName) !== normalize(initial.firstName) ||
      normalize(form.lastName) !== normalize(initial.lastName) ||
      normalize(form.email) !== normalize(initial.email) ||
      normalize(form.phone) !== normalize(initial.phone) ||
      normalize(form.location) !== normalize(initial.location) ||
      normalize(form.position) !== normalize(initial.position) ||
      !!profileBase64
    );
  }, [form, user, profileBase64]);

  const canSave = useMemo(() => {
    return !submitting && !loadingContacts && hasFormChanged && isFormValid;
  }, [submitting, loadingContacts, hasFormChanged, isFormValid]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    if (name === "phone") {
      const numericOnly = value.replace(/\D/g, "").slice(0, 10);
      setForm((prev) => ({ ...prev, phone: numericOnly }));
      setTouched((prev) => ({ ...prev, phone: true }));
      return;
    }

    setForm((prev) => ({ ...prev, [name]: value }));
    if (name in touched) {
      setTouched((prev) => ({
        ...prev,
        [name]: true,
      }));
    }
  };

  const handleBlur = (field: keyof TouchedField) => {
    setTouched((prev) => ({
      ...prev,
      [field]: true,
    }));
  };

  const handleFileChange = (file?: File) => {
    if (!file) {
      setUploadFile(undefined);
      setProfileBase64(undefined);
      return;
    }

    if (!file.type.startsWith("image/")) {
      message.warning("Please upload image only");
      return;
    }

    setUploadFile(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      setProfileBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();

    setTouched({
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      location: true,
      position: true,
    });

    if (!user?.id) {
      message.error("User ID not found");
      return;
    }

    if (!hasFormChanged) {
      message.warning("No changes");
      return;
    }

    if (!isFormValid) {
      message.error("Please fix invalid fields");
      return;
    }

    try {
      setSubmitting(true);

      const payload: UpdateUserInput = {
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        email: form.email.trim(),
        phone_number: form.phone.trim(),
        location: form.location.trim(),
        position: form.position.trim(),
        ...(profileBase64 ? { profile: profileBase64 } : {}),
      };

      const updated = await UpdateUserByID(user.id, payload);

      if (!updated) {
        message.error("Update failed");
        return;
      }

      setForm(createInitialForm(updated));
      setUploadFile(undefined);
      setProfileBase64(undefined);
      setTouched({
        firstName: false,
        lastName: false,
        email: false,
        phone: false,
        location: false,
        position: false,
      });

      message.success("Save success");
      onUpdated();
    } catch (err: any) {
      console.error("Update profile error:", err);
      const msg =
        err?.response?.data?.error || err?.message || "Update failed";
      message.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const inputBaseClass = [
    "w-full h-10 rounded-[10px] border px-3.5 text-[13px] outline-none transition-all",
    "bg-white text-gray-700",
    "dark:bg-white/5 dark:text-white/80",
    "dark:placeholder:text-white/35",
  ].join(" ");

  const getInputClass = (field: keyof TouchedField, error: string) =>
    [
      inputBaseClass,
      touched[field] && error
        ? "border-red-500 bg-red-50 text-red-700 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 dark:border-red-400 dark:bg-red-500/10 dark:text-white"
        : "border-gray-300 focus:ring-2 focus:ring-[#7a67ea]/25 focus:border-[#7a67ea] dark:border-white/10",
    ].join(" ");

  const renderFieldError = (field: keyof TouchedField, error: string) => {
    if (!touched[field] || !error) return null;

    return (
      <p className="mt-1 text-[11px] text-red-500 dark:text-red-400">
        {error}
      </p>
    );
  };

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
          "relative overflow-hidden px-4 sm:px-5 py-4 sm:py-5 border-b",
          "border-gray-200/80 bg-linear-to-r from-white via-[#f8fbff] to-[#f5f7ff]",
          "dark:border-white/10 dark:from-white/4 dark:via-white/3 dark:to-white/2",
        ].join(" ")}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-10 right-6 h-24 w-24 rounded-full bg-cyan-400/10 blur-2xl" />
          <div className="absolute bottom-0 left-10 h-20 w-20 rounded-full bg-violet-400/10 blur-2xl" />
        </div>

        <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div
                className={[
                  "flex h-11 w-11 items-center justify-center rounded-2xl",
                  "bg-linear-to-br from-cyan-400 via-sky-400 to-violet-400",
                  "text-white shadow-[0_10px_24px_-12px_rgba(59,130,246,0.65)]",
                ].join(" ")}
              >
                <FiSettings className="text-[18px]" />
              </div>

              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-300">
                  Profile
                </p>
                <h2 className="truncate text-[18px] sm:text-[20px] font-semibold tracking-tight text-[#1f2240] dark:text-white/90">
                  Account Settings
                </h2>
              </div>
            </div>
          </div>

          <div
            className={[
              "inline-flex items-center gap-1.5 self-start rounded-2xl px-3 py-1.5",
              "bg-linear-to-r from-cyan-400/90 via-sky-400/90 to-violet-400/90 text-white",
              "shadow-[0_8px_20px_-12px_rgba(56,189,248,0.55)]",
            ].join(" ")}
          >
            <FiShield className="text-[12px]" />
            <span className="text-[11px] font-semibold">My Profile</span>
          </div>
        </div>
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
                Click to upload profile image
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
                onBlur={() => handleBlur("firstName")}
                type="text"
                className={getInputClass("firstName", errors.firstName)}
              />
              {renderFieldError("firstName", errors.firstName)}
            </div>

            <div>
              <label className="block mb-1.5 text-[12px] font-medium text-[#374151] dark:text-white/65">
                Last Name
              </label>
              <input
                name="lastName"
                value={form.lastName}
                onChange={handleChange}
                onBlur={() => handleBlur("lastName")}
                type="text"
                className={getInputClass("lastName", errors.lastName)}
              />
              {renderFieldError("lastName", errors.lastName)}
            </div>

            <div>
              <label className="block mb-1.5 text-[12px] font-medium text-[#374151] dark:text-white/65">
                Email Address
              </label>
              <input
                name="email"
                value={form.email}
                onChange={handleChange}
                onBlur={() => handleBlur("email")}
                type="email"
                className={getInputClass("email", errors.email)}
              />
              {renderFieldError("email", errors.email)}
            </div>

            <div>
              <label className="block mb-1.5 text-[12px] font-medium text-[#374151] dark:text-white/65">
                Phone No
              </label>
              <input
                name="phone"
                value={form.phone}
                onChange={handleChange}
                onBlur={() => handleBlur("phone")}
                type="text"
                inputMode="numeric"
                maxLength={10}
                placeholder="0XXXXXXXXX"
                className={getInputClass("phone", errors.phone)}
              />
              {renderFieldError("phone", errors.phone)}
              {!touched.phone && (
                <p className="mt-1 text-[11px] text-gray-500 dark:text-white/40">
                  Must be 10 digits and start with 0
                </p>
              )}
            </div>

            <div>
              <label className="block mb-1.5 text-[12px] font-medium text-[#374151] dark:text-white/65">
                Location
              </label>
              <input
                name="location"
                value={form.location}
                onChange={handleChange}
                onBlur={() => handleBlur("location")}
                type="text"
                className={getInputClass("location", errors.location)}
              />
              {renderFieldError("location", errors.location)}
            </div>

            <div>
              <label className="block mb-1.5 text-[12px] font-medium text-[#374151] dark:text-white/65">
                Position
              </label>
              <input
                name="position"
                value={form.position}
                onChange={handleChange}
                onBlur={() => handleBlur("position")}
                type="text"
                className={getInputClass("position", errors.position)}
                placeholder="Enter position"
              />
              {renderFieldError("position", errors.position)}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <button
            type="submit"
            disabled={!canSave}
            className={[
              "inline-flex items-center gap-2 rounded-[10px] px-3.5 py-2 transition-all",
              "bg-linear-to-r from-cyan-400 via-sky-400 to-violet-400 text-white font-semibold text-[13px]",
              "shadow-[0_8px_20px_-12px_rgba(56,189,248,0.65)]",
              "hover:brightness-105",
              !canSave ? "opacity-60 cursor-not-allowed hover:brightness-100" : "",
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