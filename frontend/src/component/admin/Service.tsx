import React, { useEffect, useMemo, useState } from "react";
import {
  FiMail,
  FiKey,
  FiSave,
  FiRefreshCw,
  FiEye,
  FiEyeOff,
  FiShield,
  FiServer,
  FiAlertCircle,
  FiCheckCircle,
  FiSettings,
  FiLock,
} from "react-icons/fi";
import { message } from "antd";
import {
  ListSendEmails,
  UpdateSendEmailByID,
  type SendEmailResponse,
} from "../../services";

const Service: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [showPassApp, setShowPassApp] = useState<boolean>(false);

  const [recordId, setRecordId] = useState<number | null>(null);
  const [originalData, setOriginalData] = useState<SendEmailResponse | null>(null);

  const [formData, setFormData] = useState({
    email: "",
    pass_app: "",
  });

  const hasChanged = useMemo(() => {
    if (!originalData) return false;
    return (
      formData.email !== (originalData.email || "") ||
      formData.pass_app !== (originalData.pass_app || "")
    );
  }, [formData, originalData]);

  const isValidEmail = useMemo(() => {
    if (!formData.email.trim()) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim());
  }, [formData.email]);

  const isFormValid = useMemo(() => {
    return isValidEmail && formData.pass_app.trim().length > 0;
  }, [isValidEmail, formData.pass_app]);

  const fetchSendEmail = async (mode: "initial" | "refresh" = "initial") => {
    try {
      if (mode === "initial") setLoading(true);
      if (mode === "refresh") setRefreshing(true);

      const result = await ListSendEmails();

      if (result && result.length > 0) {
        const item = result[0];

        setRecordId(item.id);
        setOriginalData(item);
        setFormData({
          email: item.email || "",
          pass_app: item.pass_app || "",
        });
      } else {
        setRecordId(null);
        setOriginalData(null);
        setFormData({
          email: "",
          pass_app: "",
        });
      }
    } catch (error) {
      console.error("fetchSendEmail error:", error);
      message.error("โหลดข้อมูล Send Email ไม่สำเร็จ");
    } finally {
      if (mode === "initial") setLoading(false);
      if (mode === "refresh") setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSendEmail("initial");
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleReset = () => {
    if (!originalData) return;

    setFormData({
      email: originalData.email || "",
      pass_app: originalData.pass_app || "",
    });

    message.info("คืนค่าข้อมูลเดิมแล้ว");
  };

  const handleRefresh = async () => {
    await fetchSendEmail("refresh");
    message.success("รีเฟรชข้อมูลล่าสุดแล้ว");
  };

  const handleSubmit = async () => {
    if (recordId === null) {
      message.error("ไม่พบข้อมูลสำหรับอัปเดต");
      return;
    }

    if (!formData.email.trim()) {
      message.warning("กรุณากรอก Email");
      return;
    }

    if (!isValidEmail) {
      message.warning("รูปแบบ Email ไม่ถูกต้อง");
      return;
    }

    if (!formData.pass_app.trim()) {
      message.warning("กรุณากรอก App Password");
      return;
    }

    try {
      setSaving(true);

      const result = await UpdateSendEmailByID(recordId, {
        email: formData.email.trim(),
        pass_app: formData.pass_app.trim(),
      });

      if (!result) {
        message.error("อัปเดตข้อมูลไม่สำเร็จ");
        return;
      }

      setOriginalData(result);
      setFormData({
        email: result.email || "",
        pass_app: result.pass_app || "",
      });

      message.success("บันทึกข้อมูลสำเร็จ");
    } catch (error) {
      console.error("handleSubmit error:", error);
      message.error("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full bg-transparent">
      <div className="relative w-full h-full p-2.5 sm:p-3 md:p-4 lg:p-4.5">
        <div className="relative overflow-hidden rounded-[22px] border border-gray-200/80 bg-white/92 shadow-[0_14px_36px_-24px_rgba(15,23,42,0.32)] backdrop-blur dark:border-white/10 dark:bg-[#08111f]/88 dark:ring-1 dark:ring-cyan-400/10 dark:shadow-none">
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[22px]">
            <div className="absolute -top-16 right-0 h-36 w-36 rounded-full bg-cyan-400/10 blur-3xl" />
            <div className="absolute top-1/3 -left-10 h-32 w-32 rounded-full bg-violet-500/10 blur-3xl" />
            <div className="absolute bottom-0 right-1/4 h-28 w-28 rounded-full bg-sky-400/10 blur-3xl" />
          </div>

          <div className="relative z-10 flex min-h-[calc(100vh-40px)] flex-col">
            {/* Header */}
            <div className="border-b border-gray-200/70 px-3.5 py-4 sm:px-4.5 md:px-5 dark:border-white/10">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex items-start gap-3">
                  <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-linear-to-br from-cyan-500 via-sky-500 to-violet-500 shadow-sm">
                    <FiMail className="text-[20px] text-white" />
                    <span className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full bg-cyan-300 ring-2 ring-white dark:ring-[#08111f]" />
                  </div>

                  <div className="min-w-0">
                    <h1 className="text-[18px] font-semibold tracking-tight text-[#1f2240] dark:text-white/90 sm:text-[20px]">
                      Send Email Service
                    </h1>
                    <p className="mt-1 text-[12px] text-gray-500 dark:text-white/45 sm:text-[13px]">
                      Manage the system email account and app password used for
                      notifications and outbound messages.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-1.5 rounded-2xl border border-cyan-200 bg-cyan-50 px-2.5 py-1.5 text-[11px] font-medium text-cyan-700 dark:border-cyan-400/15 dark:bg-cyan-500/10 dark:text-cyan-300">
                    <FiServer className="text-[12px]" />
                    Single configuration record
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleRefresh()}
                    disabled={refreshing || loading}
                    className={[
                      "inline-flex h-9.5 items-center justify-center gap-2 rounded-2xl px-3.5 text-[12px] font-semibold transition-all",
                      "border border-gray-200 bg-white text-[#3a3d4f] hover:bg-gray-50",
                      "dark:border-white/10 dark:bg-white/8 dark:text-white/75 dark:hover:bg-white/10",
                      refreshing || loading ? "cursor-not-allowed opacity-70" : "",
                    ].join(" ")}
                  >
                    <FiRefreshCw
                      className={`${refreshing ? "animate-spin" : ""} text-[13px]`}
                    />
                    Refresh
                  </button>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="grid flex-1 grid-cols-1 gap-4 p-3.5 sm:p-4.5 md:p-5 xl:grid-cols-12">
              {/* Left Summary */}
              <div className="xl:col-span-4">
                <div className="flex h-full flex-col gap-3.5">
                  {/* Config Status */}
                  <div className="rounded-3xl border border-gray-200/80 bg-white/80 p-3.5 shadow-sm dark:border-white/10 dark:bg-white/6">
                    <div className="mb-3.5 flex items-center gap-2.5">
                      <div className="inline-flex h-9.5 w-9.5 items-center justify-center rounded-2xl bg-[#eef3f8] text-gray-600 dark:bg-white/10 dark:text-white/70">
                        <FiShield className="text-[16px]" />
                      </div>
                      <div>
                        <h2 className="text-[14px] font-semibold text-[#1f2240] dark:text-white/90">
                          Configuration Status
                        </h2>
                        <p className="text-[11px] text-gray-500 dark:text-white/45">
                          Real-time overview of the active email config
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      <div className="rounded-2xl border border-gray-200 bg-[#f8fbff] p-3.5 dark:border-white/10 dark:bg-[#0b1425]/80">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">
                            Record ID
                          </span>
                          <span className="rounded-xl bg-gray-100 px-2 py-1 text-[10px] font-semibold text-gray-600 dark:bg-white/8 dark:text-white/65">
                            {loading ? "Loading..." : recordId ?? "-"}
                          </span>
                        </div>
                        <p className="text-[12px] text-gray-500 dark:text-white/45">
                          This page is designed for one email sender configuration only.
                        </p>
                      </div>

                      <div className="rounded-2xl border border-gray-200 bg-[#f8fbff] p-3.5 dark:border-white/10 dark:bg-[#0b1425]/80">
                        <div className="mb-2 flex items-center gap-2">
                          <FiMail className="text-[13px] text-cyan-600 dark:text-cyan-300" />
                          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">
                            Current Email
                          </span>
                        </div>
                        <p className="break-all text-[13px] font-medium text-[#2b2f45] dark:text-white/85">
                          {loading ? "Loading..." : formData.email || "-"}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-gray-200 bg-[#f8fbff] p-3.5 dark:border-white/10 dark:bg-[#0b1425]/80">
                        <div className="mb-2 flex items-center gap-2">
                          <FiSettings className="text-[13px] text-violet-600 dark:text-violet-300" />
                          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">
                            Update State
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {hasChanged ? (
                            <span className="inline-flex items-center gap-1.5 rounded-xl bg-amber-100 px-2.5 py-1.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-400/15 dark:text-amber-300">
                              <FiAlertCircle className="text-[12px]" />
                              Unsaved changes
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-100 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300">
                              <FiCheckCircle className="text-[12px]" />
                              Synced
                            </span>
                          )}

                          {isFormValid ? (
                            <span className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-100 px-2.5 py-1.5 text-[11px] font-semibold text-cyan-700 dark:bg-cyan-400/15 dark:text-cyan-300">
                              <FiShield className="text-[12px]" />
                              Valid form
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-xl bg-rose-100 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 dark:bg-rose-400/15 dark:text-rose-300">
                              <FiAlertCircle className="text-[12px]" />
                              Incomplete
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Security Tips */}
                  <div className="rounded-3xl border border-gray-200/80 bg-white/80 p-3.5 shadow-sm dark:border-white/10 dark:bg-white/6">
                    <div className="mb-3.5 flex items-center gap-2.5">
                      <div className="inline-flex h-9.5 w-9.5 items-center justify-center rounded-2xl bg-[#eef3f8] text-gray-600 dark:bg-white/10 dark:text-white/70">
                        <FiLock className="text-[16px]" />
                      </div>
                      <div>
                        <h2 className="text-[14px] font-semibold text-[#1f2240] dark:text-white/90">
                          Security Notes
                        </h2>
                        <p className="text-[11px] text-gray-500 dark:text-white/45">
                          Best practices for safer email sender configuration
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2.5 text-[12px] leading-5.5 text-[#4f5366] dark:text-white/60">
                      <div className="rounded-2xl border border-dashed border-cyan-200 bg-cyan-50/70 p-3.5 dark:border-cyan-400/15 dark:bg-cyan-500/10">
                        Use an{" "}
                        <span className="font-semibold text-[#1f2240] dark:text-white/90">
                          App Password
                        </span>{" "}
                        instead of your main password.
                      </div>

                      <div className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/70 p-3.5 dark:border-violet-400/15 dark:bg-violet-500/10">
                        Keep this configuration updated only when the email sender
                        account changes.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Form */}
              <div className="xl:col-span-8">
                <div className="flex h-full flex-col rounded-3xl border border-gray-200/80 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/6">
                  <div className="border-b border-gray-200/70 px-3.5 py-3.5 sm:px-4.5 dark:border-white/10">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h2 className="text-[15px] font-semibold text-[#1f2240] dark:text-white/90 sm:text-[16px]">
                          Update Email Sender
                        </h2>
                        <p className="text-[12px] text-gray-500 dark:text-white/45">
                          Edit the sender email and app password, then save the
                          latest configuration.
                        </p>
                      </div>

                      <div className="inline-flex items-center gap-1.5 rounded-2xl bg-linear-to-r from-cyan-500 via-sky-500 to-violet-500 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-sm">
                        <FiShield className="text-[12px]" />
                        Secure Settings
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 p-3.5 sm:p-4.5 md:p-5">
                    {loading ? (
                      <div className="grid grid-cols-1 gap-3">
                        <div className="h-12 animate-pulse rounded-2xl bg-gray-100 dark:bg-white/8" />
                        <div className="h-12 animate-pulse rounded-2xl bg-gray-100 dark:bg-white/8" />
                        <div className="h-28 animate-pulse rounded-3xl bg-gray-100 dark:bg-white/8" />
                      </div>
                    ) : !recordId ? (
                      <div className="flex h-full min-h-75 items-center justify-center">
                        <div className="w-full max-w-lg rounded-3xl border border-rose-200 bg-rose-50 p-5 text-center dark:border-rose-400/15 dark:bg-rose-500/10">
                          <div className="mx-auto mb-3.5 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-400/15 dark:text-rose-300">
                            <FiAlertCircle className="text-[20px]" />
                          </div>
                          <h3 className="text-[16px] font-semibold text-rose-700 dark:text-rose-300">
                            No Send Email Configuration Found
                          </h3>
                          <p className="mt-2 text-[13px] text-rose-600 dark:text-rose-200/80">
                            ระบบยังไม่มีข้อมูล Send Email สำหรับแก้ไข
                          </p>

                          <button
                            type="button"
                            onClick={() => void handleRefresh()}
                            className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-cyan-500 via-sky-500 to-violet-500 px-4 text-[12px] font-semibold text-white shadow-sm"
                          >
                            <FiRefreshCw className="text-[12px]" />
                            Reload
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid h-full grid-cols-1 gap-4">
                        {/* Email Field */}
                        <div className="rounded-3xl border border-gray-200 bg-[#f8fbff] p-3.5 dark:border-white/10 dark:bg-[#0b1425]/80 sm:p-4.5">
                          <label className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-[#2b2f45] dark:text-white/85">
                            <span className="inline-flex h-8.5 w-8.5 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-300">
                              <FiMail className="text-[14px]" />
                            </span>
                            Sender Email
                          </label>

                          <div className="relative">
                            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/35">
                              <FiMail className="text-[16px]" />
                            </span>
                            <input
                              type="email"
                              name="email"
                              value={formData.email}
                              onChange={handleChange}
                              placeholder="example@gmail.com"
                              className={[
                                "h-11.5 w-full rounded-2xl border bg-white pl-11 pr-4 text-[13px] font-medium text-slate-900 outline-none transition-all",
                                "border-slate-300 shadow-[0_4px_12px_rgba(15,23,42,0.03)]",
                                "hover:border-slate-400",
                                "focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/12",
                                "dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:border-white/20",
                              ].join(" ")}
                            />
                          </div>

                          <div className="mt-2.5">
                            {formData.email.trim().length === 0 ? (
                              <p className="text-[11px] text-gray-500 dark:text-white/40">
                                กรุณากรอกอีเมลสำหรับใช้ส่งออกจากระบบ
                              </p>
                            ) : isValidEmail ? (
                              <p className="text-[11px] text-emerald-600 dark:text-emerald-300">
                                รูปแบบอีเมลถูกต้อง
                              </p>
                            ) : (
                              <p className="text-[11px] text-rose-600 dark:text-rose-300">
                                รูปแบบอีเมลไม่ถูกต้อง
                              </p>
                            )}
                          </div>
                        </div>

                        {/* App Password Field */}
                        <div className="rounded-3xl border border-gray-200 bg-[#f8fbff] p-3.5 dark:border-white/10 dark:bg-[#0b1425]/80 sm:p-4.5">
                          <label className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-[#2b2f45] dark:text-white/85">
                            <span className="inline-flex h-8.5 w-8.5 items-center justify-center rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">
                              <FiKey className="text-[14px]" />
                            </span>
                            App Password
                          </label>

                          <div className="relative">
                            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/35">
                              <FiKey className="text-[16px]" />
                            </span>

                            <input
                              type={showPassApp ? "text" : "password"}
                              name="pass_app"
                              value={formData.pass_app}
                              onChange={handleChange}
                              placeholder="Enter app password"
                              className={[
                                "h-11.5 w-full rounded-2xl border bg-white pl-11 pr-12 text-[13px] font-medium text-slate-900 outline-none transition-all",
                                "border-slate-300 shadow-[0_4px_12px_rgba(15,23,42,0.03)]",
                                "hover:border-slate-400",
                                "focus:border-violet-500 focus:ring-4 focus:ring-violet-500/12",
                                "dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:border-white/20",
                              ].join(" ")}
                            />

                            <button
                              type="button"
                              onClick={() => setShowPassApp((prev) => !prev)}
                              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-700 dark:text-white/35 dark:hover:text-white/80"
                            >
                              {showPassApp ? (
                                <FiEyeOff className="text-[16px]" />
                              ) : (
                                <FiEye className="text-[16px]" />
                              )}
                            </button>
                          </div>

                          <p className="mt-2.5 text-[11px] text-gray-500 dark:text-white/40">
                            แนะนำให้ใช้ App Password เพื่อเพิ่มความปลอดภัยในการส่งอีเมล
                          </p>
                        </div>

                        {/* Action Panel */}
                        <div className="rounded-3xl border border-gray-200 bg-white p-3.5 dark:border-white/10 dark:bg-white/5 sm:p-4.5">
                          <div className="flex flex-col gap-3.5 lg:flex-row lg:items-center lg:justify-between">
                            <div className="min-w-0">
                              <h3 className="text-[14px] font-semibold text-[#1f2240] dark:text-white/90">
                                Save Changes
                              </h3>
                              <p className="mt-1 text-[12px] text-gray-500 dark:text-white/45">
                                ตรวจสอบข้อมูลให้ถูกต้องก่อนบันทึกการเปลี่ยนแปลง
                              </p>
                            </div>

                            <div className="flex w-full flex-col gap-2.5 sm:flex-row lg:w-auto">
                              <button
                                type="button"
                                onClick={handleReset}
                                disabled={saving || !hasChanged}
                                className={[
                                  "inline-flex h-10 items-center justify-center gap-2 rounded-2xl px-4 text-[13px] font-semibold transition-all",
                                  "border border-gray-200 bg-white text-[#3a3d4f] hover:bg-gray-50",
                                  "dark:border-white/10 dark:bg-white/8 dark:text-white/75 dark:hover:bg-white/10",
                                  saving || !hasChanged
                                    ? "cursor-not-allowed opacity-60"
                                    : "",
                                ].join(" ")}
                              >
                                <FiRefreshCw className="text-[13px]" />
                                Reset
                              </button>

                              <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={saving || !hasChanged || !isFormValid}
                                className={[
                                  "inline-flex h-10 items-center justify-center gap-2 rounded-2xl px-4 text-[13px] font-semibold text-white transition-all",
                                  "bg-linear-to-r from-cyan-500 via-sky-500 to-violet-500 shadow-sm",
                                  "hover:translate-y-px",
                                  saving || !hasChanged || !isFormValid
                                    ? "cursor-not-allowed opacity-60"
                                    : "",
                                ].join(" ")}
                              >
                                {saving ? (
                                  <>
                                    <FiRefreshCw className="animate-spin text-[13px]" />
                                    Saving...
                                  </>
                                ) : (
                                  <>
                                    <FiSave className="text-[13px]" />
                                    Save Configuration
                                  </>
                                )}
                              </button>
                            </div>
                          </div>

                          <div className="mt-3.5 grid grid-cols-1 gap-2.5 md:grid-cols-3">
                            <div className="rounded-2xl border border-gray-200 bg-[#f8fbff] px-3.5 py-3 dark:border-white/10 dark:bg-[#0b1425]/80">
                              <p className="text-[10px] uppercase tracking-[0.12em] text-gray-400">
                                Form Status
                              </p>
                              <p className="mt-1 text-[13px] font-semibold text-[#2b2f45] dark:text-white/85">
                                {isFormValid ? "Ready to save" : "Need attention"}
                              </p>
                            </div>

                            <div className="rounded-2xl border border-gray-200 bg-[#f8fbff] px-3.5 py-3 dark:border-white/10 dark:bg-[#0b1425]/80">
                              <p className="text-[10px] uppercase tracking-[0.12em] text-gray-400">
                                Change State
                              </p>
                              <p className="mt-1 text-[13px] font-semibold text-[#2b2f45] dark:text-white/85">
                                {hasChanged ? "Modified" : "No changes"}
                              </p>
                            </div>

                            <div className="rounded-2xl border border-gray-200 bg-[#f8fbff] px-3.5 py-3 dark:border-white/10 dark:bg-[#0b1425]/80">
                              <p className="text-[10px] uppercase tracking-[0.12em] text-gray-400">
                                Save Action
                              </p>
                              <p className="mt-1 text-[13px] font-semibold text-[#2b2f45] dark:text-white/85">
                                {saving ? "Processing..." : "Available"}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div> 
    </div>
  );
};

export default Service;