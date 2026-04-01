import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { message } from "antd";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiChevronDown,
  FiDownload,
  FiImage,
  FiLoader,
  FiSend,
  FiUpload,
  FiUser,
  FiUsers,
  FiX,
} from "react-icons/fi";
import Pdf from "./pdf";
import {
  SendPDFToLine,
  UpdateAppReportByID,
  ListAppReport,
  DownloadPDFFile,
} from "../../services/report";
import {
  ListAppNotification,
  type AppNotificationResponse,
} from "../../services";

type EditReportModalProps = {
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
};

type UpdatePayload = {
  company_name: string;
  logo: string;
};

type SendPDFToLineResponse = {
  message?: string;
  file_path?: string;
  public_url?: string;
  sent_notification_ids?: number[];
  sent_targets?: string[];
  failed_notification_ids?: number[];
  failed_targets?: string[];
  error?: string;
};

type SendToLinePickerModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: (selectedIDs: number[]) => Promise<void>;
  submitting: boolean;
};

const toBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });

const getAlertBadgeClass = (alert: boolean) => {
  if (alert) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-300";
  }

  return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-300";
};

const getTypeBadgeClass = (isGroup: boolean) => {
  if (isGroup) {
    return "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-500/10 dark:text-cyan-300";
  }

  return "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/20 dark:bg-violet-500/10 dark:text-violet-300";
};

const EditReportModal: React.FC<EditReportModalProps> = ({
  open,
  onClose,
  onUpdated,
}) => {
  const [formData, setFormData] = useState<UpdatePayload>({
    company_name: "",
    logo: "",
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [loadingInitialData, setLoadingInitialData] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const companyPreview = useMemo(() => {
    return formData.company_name.trim() || "Company Name";
  }, [formData.company_name]);

  useEffect(() => {
    if (!open) return;

    const fetchLatestReport = async () => {
      try {
        setLoadingInitialData(true);
        setError("");

        const res = await ListAppReport();

        if (!res) {
          setError("Load latest report data failed");
          return;
        }

        if ((res as any).error) {
          setError((res as any).error);
          return;
        }

        setFormData({
          company_name: (res as any).company_name || "",
          logo: (res as any).logo || "",
        });
      } catch (err: any) {
        console.error("ListAppReport error:", err);
        setError(
          err?.response?.data?.error ||
          err?.message ||
          "Something went wrong while loading latest report data"
        );
      } finally {
        setLoadingInitialData(false);
      }
    };

    fetchLatestReport();
  }, [open]);

  if (!open) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
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
        logo: base64,
      }));
    } catch (err) {
      console.error("Upload image error:", err);
      message.error("Upload image failed");
    } finally {
      setUploadingImage(false);
    }
  };

  const validateForm = () => {
    if (!formData.company_name.trim()) return "Please enter company name";
    if (!formData.logo.trim()) return "Please upload logo image";
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
        company_name: formData.company_name.trim(),
        logo: formData.logo,
      };

      const res = await UpdateAppReportByID(1, payload);

      if (!res) {
        setError("Update report failed");
        return;
      }

      if ((res as any).error) {
        setError((res as any).error);
        return;
      }

      message.success((res as any).message || "Update report success");
      onUpdated();
      onClose();
    } catch (err: any) {
      console.error("UpdateAppReportByID error:", err);
      setError(
        err?.response?.data?.error ||
        err?.message ||
        "Something went wrong while updating report"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-9999">
      <div
        className="absolute inset-0 bg-slate-900/35 backdrop-blur-[6px]"
        onClick={onClose}
      />

      <div className="absolute inset-0 flex items-center justify-center px-4 py-6">
        <div
          className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_18px_50px_rgba(15,23,42,0.20)] dark:border-white/10 dark:bg-[#0f172a]"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={submitting || loadingInitialData}
            className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed dark:text-white/45 dark:hover:bg-white/10 dark:hover:text-white/80"
            aria-label="Close modal"
          >
            <FiX className="text-[16px]" />
          </button>

          <div className="mb-4 pr-8">
            <h3 className="text-[16px] font-semibold text-slate-900 dark:text-white">
              Update Logo
            </h3>
            <p className="mt-1 text-[12px] text-slate-500 dark:text-white/50">
              Change logo and company name
            </p>
          </div>

          {error ? (
            <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
              {error}
            </div>
          ) : null}

          {loadingInitialData ? (
            <div className="flex min-h-60 flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5">
              <FiLoader className="animate-spin text-[22px] text-cyan-600 dark:text-cyan-400" />
              <p className="text-[13px] font-medium text-slate-600 dark:text-white/70">
                Loading latest report data...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
                {formData.logo ? (
                  <img
                    src={formData.logo}
                    alt="Logo Preview"
                    className="h-14 w-14 shrink-0 rounded-xl bg-white object-contain p-1.5 ring-1 ring-slate-200 dark:bg-white dark:ring-white/10"
                  />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-white/40">
                    <FiImage className="text-[20px]" />
                  </div>
                )}

                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-slate-800 dark:text-white">
                    {companyPreview}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-white/50">
                    Logo preview
                  </p>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-slate-700 dark:text-white/80">
                  Company Name
                </label>
                <input
                  type="text"
                  name="company_name"
                  value={formData.company_name}
                  onChange={handleChange}
                  placeholder="Enter company name"
                  className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-[13px] text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 dark:border-white/10 dark:bg-white/5 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-slate-700 dark:text-white/80">
                  Upload Logo
                </label>
                <label className="flex h-24 w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 bg-white px-3 text-[12px] text-slate-600 transition hover:border-cyan-500 hover:bg-cyan-50/40 dark:border-white/10 dark:bg-white/5 dark:text-white/75 dark:hover:bg-white/8">
                  {uploadingImage ? (
                    <FiLoader className="animate-spin text-[18px]" />
                  ) : (
                    <FiUpload className="text-[18px]" />
                  )}
                  <span className="font-medium">
                    {uploadingImage ? "Uploading..." : "Click to upload image"}
                  </span>
                  <span className="text-[11px] text-slate-400 dark:text-white/40">
                    PNG, JPG, JPEG
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleUploadImage}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="h-10 rounded-xl border border-slate-300 bg-white text-[12px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-cyan-600 text-[12px] font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-75"
                >
                  {submitting ? (
                    <>
                      <FiLoader className="animate-spin text-[14px]" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    <>
                      <FiCheckCircle className="text-[14px]" />
                      <span>Update</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

const SendToLinePickerModal: React.FC<SendToLinePickerModalProps> = ({
  open,
  onClose,
  onConfirm,
  submitting,
}) => {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<AppNotificationResponse[]>([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedIDs, setSelectedIDs] = useState<number[]>([]);

  useEffect(() => {
    if (!open) return;

    const fetchNotifications = async () => {
      try {
        setLoading(true);
        setError("");
        setSelectedIDs([]);

        const data = await ListAppNotification();

        if (!data) {
          setRows([]);
          setError("Unable to load app notifications.");
          return;
        }

        setRows(data);
      } catch (err) {
        console.error("ListAppNotification error:", err);
        setRows([]);
        setError("Something went wrong while loading app notifications.");
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [open]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return rows.filter((item) => {
      const blob = [
        item.id,
        item.name,
        item.send_id,
        item.alert ? "alert on" : "alert off",
        item.is_group ? "group" : "personal",
      ]
        .join(" ")
        .toLowerCase();

      return blob.includes(q);
    });
  }, [rows, search]);

  const selectableRows = useMemo(() => {
    return filteredRows.filter((item) => item.alert);
  }, [filteredRows]);

  const selectedCount = useMemo(() => {
    return selectedIDs.length;
  }, [selectedIDs]);

  const toggleRow = (id: number, disabled: boolean) => {
    if (disabled) return;

    setSelectedIDs((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      return [...prev, id];
    });
  };

  const handleSelectAllAvailable = () => {
    const ids = filteredRows.filter((item) => item.alert).map((item) => item.id);
    setSelectedIDs(ids);
  };

  const handleClearSelection = () => {
    setSelectedIDs([]);
  };

  const handleConfirm = async () => {
    if (selectedIDs.length === 0) {
      message.warning("Please select at least one alert-enabled receiver");
      return;
    }

    await onConfirm(selectedIDs);
  };

  if (!open) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-10000">
      <div
        className="absolute inset-0 bg-slate-900/35 backdrop-blur-[6px]"
        onClick={submitting ? undefined : onClose}
      />

      <div className="absolute inset-0 flex items-center justify-center px-4 py-6">
        <div
          className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_18px_50px_rgba(15,23,42,0.20)] dark:border-white/10 dark:bg-[#0f172a]"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed dark:text-white/45 dark:hover:bg-white/10 dark:hover:text-white/80"
            aria-label="Close modal"
          >
            <FiX className="text-[16px]" />
          </button>

          <div className="mb-4 pr-8">
            <h3 className="text-[16px] font-semibold text-slate-900 dark:text-white">
              Send PDF to LINE
            </h3>
            <p className="mt-1 text-[12px] text-slate-500 dark:text-white/50">
              Select receivers before sending the PDF report
            </p>
          </div>

          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search receiver name, send id, group, personal..."
                className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-[13px] text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAllAvailable}
                disabled={loading || selectableRows.length === 0 || submitting}
                className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10"
              >
                Select All
              </button>

              <button
                type="button"
                onClick={handleClearSelection}
                disabled={loading || selectedIDs.length === 0 || submitting}
                className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="inline-flex items-center rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 font-semibold text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-500/10 dark:text-cyan-300">
              Selected: {selectedCount}
            </span>
            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-300">
              Alert On: {rows.filter((item) => item.alert).length}
            </span>
            <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 font-semibold text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-300">
              Alert Off: {rows.filter((item) => !item.alert).length}
            </span>
          </div>

          {error ? (
            <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
              {error}
            </div>
          ) : null}

          <div className="max-h-105 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/70 dark:border-white/10 dark:bg-white/5">
            {loading ? (
              <div className="flex min-h-60 flex-col items-center justify-center gap-3">
                <FiLoader className="animate-spin text-[22px] text-cyan-600 dark:text-cyan-400" />
                <p className="text-[13px] font-medium text-slate-600 dark:text-white/70">
                  Loading receiver list...
                </p>
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="flex min-h-48 flex-col items-center justify-center gap-2 px-4 py-8 text-center">
                <FiAlertCircle className="text-[22px] text-slate-400 dark:text-white/35" />
                <p className="text-[13px] font-medium text-slate-600 dark:text-white/70">
                  No receiver found
                </p>
                <p className="text-[11px] text-slate-400 dark:text-white/40">
                  Try searching with another keyword
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-white/10">
                {filteredRows.map((item) => {
                  const disabled = !item.alert;
                  const checked = selectedIDs.includes(item.id);

                  return (
                    <label
                      key={item.id}
                      className={[
                        "flex cursor-pointer items-start gap-3 px-4 py-3 transition",
                        disabled
                          ? "bg-slate-100/70 opacity-75 dark:bg-white/3"
                          : "hover:bg-cyan-50/70 dark:hover:bg-cyan-500/5",
                      ].join(" ")}
                    >
                      <div className="pt-0.5">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled || submitting}
                          onChange={() => toggleRow(item.id, disabled)}
                          className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-[13px] font-semibold text-slate-800 dark:text-white">
                            {item.name}
                          </p>

                          <span
                            className={[
                              "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                              getAlertBadgeClass(item.alert),
                            ].join(" ")}
                          >
                            {item.alert ? "Alert On" : "Alert Off"}
                          </span>

                          <span
                            className={[
                              "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                              getTypeBadgeClass(item.is_group),
                            ].join(" ")}
                          >
                            {item.is_group ? (
                              <>
                                <FiUsers className="mr-1 text-[10px]" />
                                Group
                              </>
                            ) : (
                              <>
                                <FiUser className="mr-1 text-[10px]" />
                                Personal
                              </>
                            )}
                          </span>
                        </div>

                        <p className="mt-1 break-all text-[11px] text-slate-500 dark:text-white/45">
                          Send ID: {item.send_id || "-"}
                        </p>

                        {!item.alert ? (
                          <p className="mt-1 text-[10.5px] font-medium text-rose-600 dark:text-rose-300">
                            This receiver is visible but cannot be selected because alert is off.
                          </p>
                        ) : null}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="h-10 rounded-xl border border-slate-300 bg-white text-[12px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting || loading || selectedIDs.length === 0}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-cyan-600 text-[12px] font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-75"
            >
              {submitting ? (
                <>
                  <FiLoader className="animate-spin text-[14px]" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <FiSend className="text-[14px]" />
                  <span>Send to Selected</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

const Index: React.FC = () => {
  const [sendingToLine, setSendingToLine] = useState(false);
  const [savingPdf, setSavingPdf] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [openEditModal, setOpenEditModal] = useState(false);
  const [reportRefreshToken, setReportRefreshToken] = useState(0);
  const [openDownloadMenu, setOpenDownloadMenu] = useState(false);
  const [openSendToLineModal, setOpenSendToLineModal] = useState(false);

  const downloadMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        downloadMenuRef.current &&
        !downloadMenuRef.current.contains(event.target as Node)
      ) {
        setOpenDownloadMenu(false);
      }
    };

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenDownloadMenu(false);
        setOpenSendToLineModal(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  const handleOpenSendToLineModal = () => {
    setOpenDownloadMenu(false);
    setShowSuccess(false);
    setOpenSendToLineModal(true);
  };

  const handleSendToLine = async (selectedIDs: number[]) => {
    try {
      setSendingToLine(true);
      setShowSuccess(false);

      const res = await SendPDFToLine(undefined, selectedIDs);

      if (!res) {
        message.error("Send to LINE failed");
        return;
      }

      if ((res as SendPDFToLineResponse).error) {
        message.error((res as SendPDFToLineResponse).error || "Send failed");
        return;
      }

      setOpenSendToLineModal(false);
      setShowSuccess(true);

      const successCount = (res.sent_notification_ids || []).length;
      const failedCount = (res.failed_notification_ids || []).length;

      if (failedCount > 0) {
        message.success(
          `sent to LINE successfully (${successCount} success, ${failedCount} failed)`
        );
      } else {
        message.success("sent to LINE successfully");
      }

      window.setTimeout(() => {
        setShowSuccess(false);
      }, 2500);
    } catch (error) {
      console.error("SendPDFToLine error:", error);
      message.error("Send to LINE failed");
    } finally {
      setSendingToLine(false);
    }
  };

  const handleSaveAsPDF = async () => {
    try {
      setSavingPdf(true);
      setOpenDownloadMenu(false);

      await DownloadPDFFile();
      message.success("Download PDF success");
    } catch (error: any) {
      console.error("DownloadPDFFile error:", error);
      message.error(
        error?.response?.data?.error ||
        error?.message ||
        "Download PDF failed"
      );
    } finally {
      setSavingPdf(false);
    }
  };

  const handleReportUpdated = () => {
    setReportRefreshToken((prev) => prev + 1);
  };

  const actionBusy = sendingToLine || savingPdf;

  return (
    <div className="relative z-0 min-h-screen w-full bg-slate-100 text-slate-900 transition-colors dark:bg-[#07101d] dark:text-white/90">
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-sm transition-colors sm:px-6 dark:border-cyan-400/10 dark:bg-[#08111f]/92 dark:shadow-[0_1px_0_rgba(34,211,238,0.08)]">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white/92">
              PDF Preview
            </h1>
            <p className="text-sm text-slate-500 dark:text-white/50">
              Preview report, save as PDF, and send to LINE
            </p>
          </div>

          <div className="flex items-center gap-3">
            {showSuccess && (
              <div className="inline-flex items-center gap-2 border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 shadow-sm dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                <FiCheckCircle className="text-[15px]" />
                <span>Send to LINE success</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => setOpenEditModal(true)}
              className="inline-flex items-center gap-2 border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 active:scale-[0.98] dark:border-white/10 dark:bg-white/5 dark:text-white/85 dark:hover:bg-white/10"
            >
              <FiImage className="text-[15px]" />
              <span>CHANGE LOGO</span>
            </button>

            <div className="relative" ref={downloadMenuRef}>
              <button
                type="button"
                onClick={() => setOpenDownloadMenu((prev) => !prev)}
                disabled={actionBusy}
                className={[
                  "inline-flex min-w-42.5 items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white shadow-sm transition active:scale-[0.98]",
                  "bg-cyan-600 hover:bg-cyan-700",
                  actionBusy ? "cursor-not-allowed opacity-80" : "",
                ].join(" ")}
              >
                {actionBusy ? (
                  <>
                    <FiLoader className="animate-spin text-[15px]" />
                    <span>{savingPdf ? "PREPARING..." : "SENDING..."}</span>
                  </>
                ) : (
                  <>
                    <FiDownload className="text-[15px]" />
                    <span>DOWNLOAD</span>
                    <FiChevronDown className="text-[15px]" />
                  </>
                )}
              </button>

              {openDownloadMenu && !actionBusy ? (
                <div className="absolute right-0 top-[calc(100%+8px)] z-30 min-w-52.5 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_16px_40px_rgba(15,23,42,0.14)] dark:border-white/10 dark:bg-[#0f172a]">
                  <button
                    type="button"
                    onClick={handleSaveAsPDF}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium text-slate-700 transition hover:bg-slate-50 dark:text-white/85 dark:hover:bg-white/8"
                  >
                    <FiDownload className="text-[14px]" />
                    <span>Save as PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenSendToLineModal}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium text-slate-700 transition hover:bg-slate-50 dark:text-white/85 dark:hover:bg-white/8"
                  >
                    <FiSend className="text-[14px]" />
                    <span>Send to LINE</span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 sm:px-6">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-[#08111f]">
          <Pdf refreshToken={reportRefreshToken} />
        </div>
      </div>

      <EditReportModal
        open={openEditModal}
        onClose={() => setOpenEditModal(false)}
        onUpdated={handleReportUpdated}
      />

      <SendToLinePickerModal
        open={openSendToLineModal}
        onClose={() => setOpenSendToLineModal(false)}
        onConfirm={handleSendToLine}
        submitting={sendingToLine}
      />
    </div>
  );
};

export default Index;