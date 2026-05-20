import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactDOM from "react-dom";
import { message } from "antd";
import {
  FiCheckCircle,
  FiChevronDown,
  FiDownload,
  FiHardDrive,
  FiImage,
  FiLoader,
  FiSend,
  FiUpload,
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
  ListAssetRisk,
  type AppNotificationResponse,
  type AssetRiskDTO,
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

type DevicePickerProps = {
  open: boolean;
  loading: boolean;
  options: AssetRiskDTO[];
  selectedTaskIDs: string[];
  onToggleTask: (taskID: string) => void;
  onClear: () => void;
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

const buildDeviceLabel = (item: AssetRiskDTO) =>
  `${item.task_name}`;

const dedupeAssetRisk = (items: AssetRiskDTO[]): AssetRiskDTO[] => {
  const map = new Map<string, AssetRiskDTO>();

  for (const item of items) {
    const key = String(item.task_id).trim();
    if (!key) continue;
    if (!map.has(key)) {
      map.set(key, item);
    }
  }

  return Array.from(map.values());
};

const isAllowedImageFile = (file: File) => {
  const allowedMimeTypes = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
  ];

  const allowedExtensions = [".png", ".jpg", ".jpeg", ".webp"];
  const fileName = file.name.toLowerCase();

  const hasValidMimeType = allowedMimeTypes.includes(file.type);
  const hasValidExtension = allowedExtensions.some((ext) =>
    fileName.endsWith(ext)
  );

  return hasValidMimeType || hasValidExtension;
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

  const hasFetchedRef = useRef(false);
  const isFetchingRef = useRef(false);
  const isMountedRef = useRef(false);

  const companyPreview = useMemo(() => {
    return formData.company_name.trim() || "Company Name";
  }, [formData.company_name]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadLatestReport = useCallback(async () => {
    if (isFetchingRef.current) return;

    try {
      isFetchingRef.current = true;

      if (isMountedRef.current) {
        setLoadingInitialData(true);
        setError("");
      }

      const res = await ListAppReport();

      if (!isMountedRef.current) return;

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

      if (!isMountedRef.current) return;

      setError(
        err?.response?.data?.error ||
          err?.message ||
          "Something went wrong while loading latest report data"
      );
    } finally {
      if (isMountedRef.current) {
        setLoadingInitialData(false);
      }
      isFetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!open) {
      hasFetchedRef.current = false;
      return;
    }

    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    void loadLatestReport();
  }, [open, loadLatestReport]);

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

    if (!isAllowedImageFile(file)) {
      message.error("Only image files can be uploaded");
      e.target.value = "";
      return;
    }

    try {
      setUploadingImage(true);
      setError("");

      const base64 = await toBase64(file);

      if (!isMountedRef.current) return;

      setFormData((prev) => ({
        ...prev,
        logo: base64,
      }));
    } catch (err) {
      console.error("Upload image error:", err);
      message.error("Upload image failed");
      e.target.value = "";
    } finally {
      if (isMountedRef.current) {
        setUploadingImage(false);
      }
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
      if (isMountedRef.current) {
        setSubmitting(false);
      }
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
                <label className="flex h-24 w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 text-center transition hover:border-cyan-400 hover:bg-cyan-50/40 dark:border-white/10 dark:bg-white/5 dark:hover:border-cyan-400/40 dark:hover:bg-cyan-500/5">
                  {uploadingImage ? (
                    <FiLoader className="animate-spin text-[18px] text-cyan-600 dark:text-cyan-400" />
                  ) : (
                    <FiUpload className="text-[18px] text-slate-500 dark:text-white/50" />
                  )}
                  <span className="text-[12px] font-medium text-slate-700 dark:text-white/80">
                    {uploadingImage ? "Uploading..." : "Click to upload image"}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-white/45">
                    เฉพาะไฟล์รูป PNG, JPG, JPEG, WEBP
                  </span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    className="hidden"
                    onChange={handleUploadImage}
                  />
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-[13px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting || uploadingImage}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 text-[13px] font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {submitting ? (
                    <>
                      <FiLoader className="animate-spin text-[14px]" />
                      Saving...
                    </>
                  ) : (
                    "Save"
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
  const [items, setItems] = useState<AppNotificationResponse[]>([]);
  const [selectedIDs, setSelectedIDs] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const hasFetchedRef = useRef(false);
  const isFetchingRef = useRef(false);
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadItems = useCallback(async () => {
    if (isFetchingRef.current) return;

    try {
      isFetchingRef.current = true;

      if (isMountedRef.current) {
        setLoading(true);
        setError("");
      }

      const res = await ListAppNotification();

      if (!isMountedRef.current) return;

      if (!res) {
        setError("Load line targets failed");
        setItems([]);
        return;
      }

      const normalized = Array.isArray(res) ? res : [];
      setItems(normalized);
      setSelectedIDs(
        normalized.filter((item) => item.alert).map((item) => Number(item.id))
      );
    } catch (err: any) {
      console.error("ListAppNotification error:", err);

      if (!isMountedRef.current) return;

      setError(
        err?.response?.data?.error ||
          err?.message ||
          "Something went wrong while loading line targets"
      );
      setItems([]);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
      isFetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!open) {
      hasFetchedRef.current = false;
      return;
    }

    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    void loadItems();
  }, [open, loadItems]);

  if (!open) return null;

  const toggleSelect = (id: number) => {
    setSelectedIDs((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleConfirm = async () => {
    await onConfirm(selectedIDs);
  };

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-9999">
      <div
        className="absolute inset-0 bg-slate-900/35 backdrop-blur-[6px]"
        onClick={submitting ? undefined : onClose}
      />

      <div className="absolute inset-0 flex items-center justify-center px-4 py-6">
        <div
          className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_18px_50px_rgba(15,23,42,0.20)] dark:border-white/10 dark:bg-[#0f172a]"
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
              Send to LINE
            </h3>
            <p className="mt-1 text-[12px] text-slate-500 dark:text-white/50">
              Select line targets to receive the PDF link
            </p>
          </div>

          {error ? (
            <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5">
              <FiLoader className="animate-spin text-[22px] text-cyan-600 dark:text-cyan-400" />
              <p className="text-[13px] font-medium text-slate-600 dark:text-white/70">
                Loading line targets...
              </p>
            </div>
          ) : (
            <>
              <div className="max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/70 p-2 dark:border-white/10 dark:bg-white/5">
                {items.length === 0 ? (
                  <div className="flex min-h-36 flex-col items-center justify-center gap-2 text-center text-slate-500 dark:text-white/50">
                    <FiUsers className="text-[22px]" />
                    <p className="text-[13px] font-medium">No line targets found</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {items.map((item) => {
                      const itemID = Number(item.id);
                      const checked = selectedIDs.includes(itemID);

                      return (
                        <button
                          key={itemID}
                          type="button"
                          onClick={() => toggleSelect(itemID)}
                          className={`w-full rounded-xl border p-3 text-left transition ${
                            checked
                              ? "border-cyan-300 bg-cyan-50 dark:border-cyan-400/30 dark:bg-cyan-500/10"
                              : "border-slate-200 bg-white hover:border-slate-300 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:border-white/10 dark:bg-white/10 dark:text-white/65">
                                  #{itemID}
                                </span>

                                <span
                                  className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getAlertBadgeClass(
                                    item.alert
                                  )}`}
                                >
                                  {item.alert ? "Alert On" : "Alert Off"}
                                </span>

                                <span
                                  className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getTypeBadgeClass(
                                    Boolean(item.is_group)
                                  )}`}
                                >
                                  {item.is_group ? "Group" : "User"}
                                </span>
                              </div>

                              <p className="mt-2 truncate text-[13px] font-semibold text-slate-900 dark:text-white">
                                {item.name || "-"}
                              </p>

                              <p className="mt-0.5 truncate text-[12px] text-slate-500 dark:text-white/50">
                                {item.send_id || "-"}
                              </p>
                            </div>

                            <div
                              className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                                checked
                                  ? "border-cyan-500 bg-cyan-500 text-white"
                                  : "border-slate-300 bg-white text-transparent dark:border-white/20 dark:bg-white/5"
                              }`}
                            >
                              <FiCheckCircle className="text-[12px]" />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[12px] text-slate-500 dark:text-white/50">
                  Selected {selectedIDs.length} target(s)
                </p>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={submitting}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-[13px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={submitting || selectedIDs.length === 0}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 text-[13px] font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {submitting ? (
                      <>
                        <FiLoader className="animate-spin text-[14px]" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <FiSend className="text-[14px]" />
                        Send to Selected
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

const DevicePickerDropdown: React.FC<DevicePickerProps> = ({
  open,
  loading,
  options,
  selectedTaskIDs,
  onToggleTask,
  onClear,
}) => {
  if (!open) return null;

  return (
    <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_16px_40px_rgba(15,23,42,0.16)] sm:left-auto sm:right-0 sm:w-105 xl:w-120 dark:border-white/10 dark:bg-[#0f172a]">
      <div className="mb-2 flex items-center justify-between px-2 pt-1">
        <div>
          <p className="text-[12px] font-semibold text-slate-900 dark:text-white">
            Select Device Task
          </p>
          <p className="text-[11px] text-slate-500 dark:text-white/50">
            Choose one or more Devices
          </p>
        </div>

        <button
          type="button"
          onClick={onClear}
          className="text-[11px] font-medium text-cyan-700 hover:text-cyan-800 dark:text-cyan-300 dark:hover:text-cyan-200"
        >
          Clear
        </button>
      </div>

      <div className="max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/70 p-2 dark:border-white/10 dark:bg-white/5">
        {loading ? (
          <div className="flex min-h-40 flex-col items-center justify-center gap-3">
            <FiLoader className="animate-spin text-[20px] text-cyan-600 dark:text-cyan-400" />
            <p className="text-[12px] text-slate-500 dark:text-white/50">
              Loading devices...
            </p>
          </div>
        ) : options.length === 0 ? (
          <div className="flex min-h-40 flex-col items-center justify-center gap-3">
            <FiHardDrive className="text-[20px] text-slate-400 dark:text-white/40" />
            <p className="text-[12px] text-slate-500 dark:text-white/50">
              No devices found
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {options.map((item) => {
              const taskID = String(item.task_id).trim();
              const checked = selectedTaskIDs.includes(taskID);

              return (
                <button
                  key={taskID}
                  type="button"
                  onClick={() => onToggleTask(taskID)}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    checked
                      ? "border-cyan-300 bg-cyan-50 dark:border-cyan-400/30 dark:bg-cyan-500/10"
                      : "border-slate-200 bg-white hover:border-slate-300 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="wrap-break-word text-[12px] font-medium text-slate-800 dark:text-white/85">
                        {buildDeviceLabel(item)}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-500 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-200">
                          IP: {item.host_ip}
                        </span>
                      </div>
                    </div>

                    <div
                      className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                        checked
                          ? "border-cyan-500 bg-cyan-500 text-white"
                          : "border-slate-300 bg-white text-transparent dark:border-white/20 dark:bg-white/5"
                      }`}
                    >
                      <FiCheckCircle className="text-[12px]" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="px-2 pb-1 pt-2 text-[11px] text-slate-500 dark:text-white/50">
        Selected {selectedTaskIDs.length} task(s)
      </div>
    </div>
  );
};

const ReportPreviewIndex: React.FC = () => {
  const [openEditModal, setOpenEditModal] = useState(false);
  const [openSendToLineModal, setOpenSendToLineModal] = useState(false);
  const [openDownloadMenu, setOpenDownloadMenu] = useState(false);
  const [openDeviceMenu, setOpenDeviceMenu] = useState(false);

  const [showSuccess, setShowSuccess] = useState(false);
  const [sendingToLine, setSendingToLine] = useState(false);
  const [savingPdf, setSavingPdf] = useState(false);
  const [reportRefreshToken, setReportRefreshToken] = useState(0);

  const [assetRiskItems, setAssetRiskItems] = useState<AssetRiskDTO[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [selectedTaskIDs, setSelectedTaskIDs] = useState<string[]>([]);

  const downloadMenuRef = useRef<HTMLDivElement | null>(null);
  const deviceMenuRef = useRef<HTMLDivElement | null>(null);

  const hasFetchedDevicesRef = useRef(false);
  const isFetchingDevicesRef = useRef(false);
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (
        downloadMenuRef.current &&
        !downloadMenuRef.current.contains(target)
      ) {
        setOpenDownloadMenu(false);
      }

      if (deviceMenuRef.current && !deviceMenuRef.current.contains(target)) {
        setOpenDeviceMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadDevices = useCallback(async () => {
    if (isFetchingDevicesRef.current) return;

    try {
      isFetchingDevicesRef.current = true;

      if (isMountedRef.current) {
        setLoadingDevices(true);
      }

      const res = await ListAssetRisk();

      if (!isMountedRef.current) return;

      const normalized = dedupeAssetRisk(Array.isArray(res) ? res : []);
      setAssetRiskItems(normalized);
    } catch (error) {
      console.error("ListAssetRisk error:", error);

      if (!isMountedRef.current) return;

      setAssetRiskItems([]);
    } finally {
      if (isMountedRef.current) {
        setLoadingDevices(false);
      }
      isFetchingDevicesRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (hasFetchedDevicesRef.current) return;
    hasFetchedDevicesRef.current = true;
    void loadDevices();
  }, [loadDevices]);

  const handleToggleTask = useCallback((taskID: string) => {
    const normalized = String(taskID).trim();
    if (!normalized) return;

    setSelectedTaskIDs((prev) =>
      prev.includes(normalized)
        ? prev.filter((item) => item !== normalized)
        : [...prev, normalized]
    );
  }, []);

  const handleClearTaskSelection = useCallback(() => {
    setSelectedTaskIDs([]);
  }, []);

  const handleSendToLine = useCallback(
    async (selectedIDs: number[]) => {
      try {
        setSendingToLine(true);
        setOpenSendToLineModal(false);
        setOpenDownloadMenu(false);

        const res = (await SendPDFToLine(
          undefined,
          selectedIDs,
          selectedTaskIDs
        )) as SendPDFToLineResponse | null;

        if (!res) {
          message.error("Send to LINE failed");
          return;
        }

        if (res.error) {
          message.error(res.error);
          return;
        }

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
          if (isMountedRef.current) {
            setShowSuccess(false);
          }
        }, 2500);
      } catch (error) {
        console.error("SendPDFToLine error:", error);
        message.error("Send to LINE failed");
      } finally {
        if (isMountedRef.current) {
          setSendingToLine(false);
        }
      }
    },
    [selectedTaskIDs]
  );

  const handleSaveAsPDF = useCallback(async () => {
    try {
      setSavingPdf(true);
      setOpenDownloadMenu(false);

      await DownloadPDFFile(undefined, selectedTaskIDs);
      message.success("Download PDF Success");
    } catch (error: any) {
      console.error("DownloadPDFFile error:", error);
      message.error(
        error?.response?.data?.error ||
          error?.message ||
          "Download PDF failed"
      );
    } finally {
      if (isMountedRef.current) {
        setSavingPdf(false);
      }
    }
  }, [selectedTaskIDs]);

  const handleReportUpdated = useCallback(() => {
    setReportRefreshToken((prev) => prev + 1);
  }, []);

  const actionBusy = sendingToLine || savingPdf;

  return (
    <div className="relative z-0 min-h-screen w-full bg-slate-100 text-slate-900 transition-colors dark:bg-[#07101d] dark:text-white/90">
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-3 py-3 backdrop-blur-sm transition-colors sm:px-4 lg:px-6 dark:border-cyan-400/10 dark:bg-[#08111f]/92 dark:shadow-[0_1px_0_rgba(34,211,238,0.08)]">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-slate-900 sm:text-lg dark:text-white/92">
              PDF Preview
            </h1>
            <p className="text-[13px] text-slate-500 sm:text-sm dark:text-white/50">
              Preview report, save as PDF, and send to LINE
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center xl:w-auto xl:justify-end">
            {showSuccess && (
              <div className="inline-flex items-center gap-2 border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 shadow-sm dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                <FiCheckCircle className="text-[15px]" />
                <span>Send To LINE Success</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => setOpenEditModal(true)}
              className="inline-flex w-full items-center justify-center gap-2 border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 active:scale-[0.98] sm:w-auto dark:border-white/10 dark:bg-white/5 dark:text-white/85 dark:hover:bg-white/10"
            >
              <FiImage className="text-[15px]" />
              <span>CHANGE LOGO</span>
            </button>

            <div className="relative w-full sm:w-auto" ref={deviceMenuRef}>
              <button
                type="button"
                onClick={() => setOpenDeviceMenu((prev) => !prev)}
                className="inline-flex w-full items-center justify-center gap-2 border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 active:scale-[0.98] sm:w-auto dark:border-white/10 dark:bg-white/5 dark:text-white/85 dark:hover:bg-white/10"
              >
                <FiHardDrive className="text-[15px]" />
                <span>
                  DEVICE
                  {selectedTaskIDs.length > 0
                    ? ` (${selectedTaskIDs.length})`
                    : ""}
                </span>
                <FiChevronDown className="text-[15px]" />
              </button>

              <DevicePickerDropdown
                open={openDeviceMenu}
                loading={loadingDevices}
                options={assetRiskItems}
                selectedTaskIDs={selectedTaskIDs}
                onToggleTask={handleToggleTask}
                onClear={handleClearTaskSelection}
              />
            </div>

            <div className="relative w-full sm:w-auto" ref={downloadMenuRef}>
              <button
                type="button"
                onClick={() => setOpenDownloadMenu((prev) => !prev)}
                disabled={actionBusy}
                className={[
                  "inline-flex w-full items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white shadow-sm transition active:scale-[0.98] sm:min-w-42.5 sm:w-auto",
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
                <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_16px_40px_rgba(15,23,42,0.16)] sm:left-auto sm:right-0 sm:min-w-52.5 dark:border-white/10 dark:bg-[#0f172a]">
                  <button
                    type="button"
                    onClick={handleSaveAsPDF}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-slate-700 transition hover:bg-slate-100 dark:text-white/80 dark:hover:bg-white/10"
                  >
                    <FiDownload className="text-[14px]" />
                    <span>Save as PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setOpenDownloadMenu(false);
                      setOpenSendToLineModal(true);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-slate-700 transition hover:bg-slate-100 dark:text-white/80 dark:hover:bg-white/10"
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

      <main className="px-2 py-3 sm:px-3 sm:py-4 lg:px-5">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.08)] dark:border-cyan-400/10 dark:bg-[#0c1626] dark:shadow-[0_18px_40px_rgba(0,0,0,0.28)]">
          <Pdf
            refreshToken={reportRefreshToken}
            selectedTaskIDs={selectedTaskIDs}
          />
        </div>
      </main>

      <EditReportModal
        open={openEditModal}
        onClose={() => setOpenEditModal(false)}
        onUpdated={handleReportUpdated}
      />

      <SendToLinePickerModal
        open={openSendToLineModal}
        onClose={() => {
          if (!sendingToLine) setOpenSendToLineModal(false);
        }}
        onConfirm={handleSendToLine}
        submitting={sendingToLine}
      />
    </div>
  );
};

export default ReportPreviewIndex;