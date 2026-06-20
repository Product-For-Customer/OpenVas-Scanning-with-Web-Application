import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FiCheck,
  FiEdit2,
  FiImage,
  FiPlus,
  FiRefreshCw,
  FiType,
  FiUpload,
  FiX,
  FiFileText,
  FiEye,
} from "react-icons/fi";
import { message } from "antd";
import {
  CreateDiagram,
  UpdateDiagramByID,
  type CreateDiagramInput,
  type DiagramResponse,
  type UpdateDiagramInput,
} from "../../../services/diagram";
import { useStateContext } from "../../../contexts/ProviderContext";

type ModalMode = "create" | "edit";

type FormState = {
  name: string;
  description: string;
  image_base64: string;
};

interface DiagramFormModalProps {
  open: boolean;
  mode: ModalMode;
  loading?: boolean;
  initialData: DiagramResponse | null;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
}

const emptyForm: FormState = {
  name: "",
  description: "",
  image_base64: "",
};

const MAX_IMAGE_SIZE_MB = 100;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/bmp",
];

const ALLOWED_IMAGE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".svg",
  ".bmp",
];

const getImageSrc = (value?: string) => {
  if (!value) return "";

  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("data:image")) return trimmed;

  return `data:image/png;base64,${trimmed}`;
};

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result);
    };

    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });

const getFileExtension = (fileName: string): string => {
  const lastDotIndex = fileName.lastIndexOf(".");
  if (lastDotIndex === -1) return "";

  return fileName.slice(lastDotIndex).toLowerCase();
};

const normalizeValue = (value?: string) => (value ?? "").trim();

const validateImageFile = (file: File): string => {
  const extension = getFileExtension(file.name);
  const hasValidMimeType = ALLOWED_IMAGE_MIME_TYPES.includes(
    file.type.toLowerCase()
  );
  const hasValidExtension = ALLOWED_IMAGE_EXTENSIONS.includes(extension);

  if (!hasValidMimeType || !hasValidExtension) {
    return "Only image files can be uploaded";
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return `Image size must be less than ${MAX_IMAGE_SIZE_MB} MB`;
  }

  return "";
};

const DiagramFormModal: React.FC<DiagramFormModalProps> = ({
  open,
  mode,
  loading = false,
  initialData,
  onClose,
  onSuccess,
}) => {
  const { currentColor } = useStateContext();
  const accentGrad = `linear-gradient(135deg, ${currentColor}, color-mix(in srgb, ${currentColor} 65%, #a855f7))`;

  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;

    if (mode === "edit" && initialData) {
      setForm({
        name: initialData.name ?? "",
        description: initialData.description ?? "",
        image_base64: initialData.image_base64 ?? "",
      });

      setFormError("");

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      return;
    }

    if (mode === "create") {
      setForm(emptyForm);
      setFormError("");

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [open, mode, initialData]);

  const isFormChanged = useMemo(() => {
    if (mode !== "edit") return true;
    if (!initialData) return false;

    return (
      normalizeValue(form.name) !== normalizeValue(initialData.name) ||
      normalizeValue(form.description) !==
        normalizeValue(initialData.description) ||
      normalizeValue(form.image_base64) !==
        normalizeValue(initialData.image_base64)
    );
  }, [form, initialData, mode]);

  const validateForm = () => {
    const name = form.name.trim();
    const image = form.image_base64.trim();

    if (!name) return "Please enter diagram name";
    if (!image) return "Please upload a diagram image";

    return "";
  };

  const handleChangeForm = (key: keyof FormState, value: string) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const resetImageInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveImage = () => {
    setForm((prev) => ({
      ...prev,
      image_base64: "",
    }));

    setFormError("");
    resetImageInput();
  };

  const handleSelectImage = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validationMessage = validateImageFile(file);
    if (validationMessage) {
      setFormError(validationMessage);
      message.error(validationMessage);
      resetImageInput();

      setForm((prev) => ({
        ...prev,
        image_base64: "",
      }));

      return;
    }

    try {
      const base64 = await fileToBase64(file);

      if (!base64.startsWith("data:image/")) {
        const errorMessage = "The selected file is not a valid image";

        setFormError(errorMessage);
        message.error(errorMessage);
        resetImageInput();

        setForm((prev) => ({
          ...prev,
          image_base64: "",
        }));

        return;
      }

      setForm((prev) => ({
        ...prev,
        image_base64: base64,
      }));

      setFormError("");
    } catch {
      const errorMessage = "Failed to convert image to base64";

      setFormError(errorMessage);
      message.error(errorMessage);
      resetImageInput();
    }
  };

  const handleSubmit = async () => {
    const validationMessage = validateForm();

    if (validationMessage) {
      setFormError(validationMessage);
      return;
    }

    if (mode === "edit" && !isFormChanged) {
      setFormError("No changes detected");
      return;
    }

    setSubmitting(true);
    setFormError("");

    try {
      if (mode === "create") {
        const payload: CreateDiagramInput = {
          name: form.name.trim(),
          description: form.description.trim(),
          image_base64: form.image_base64.trim(),
        };

        const created = await CreateDiagram(payload);

        if (!created) {
          setFormError("Failed to create diagram");
          return;
        }

        message.success("Create success");
      } else {
        if (!initialData?.id) {
          setFormError("Diagram not found");
          return;
        }

        const payload: UpdateDiagramInput = {
          name: form.name.trim(),
          description: form.description.trim(),
          image_base64: form.image_base64.trim(),
        };

        const updated = await UpdateDiagramByID(initialData.id, payload);

        if (!updated) {
          setFormError("Failed to update diagram");
          return;
        }

        message.success("Update success");
      }

      await onSuccess();
    } catch (error) {
      console.error("handleSubmit diagram error:", error);

      if (mode === "create") {
        setFormError("An error occurred while creating diagram");
      } else {
        setFormError("An error occurred while updating diagram");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const inputCls = [
    "h-8.5 rounded-xl border px-3 text-[10.5px] outline-none transition w-full",
    "border-gray-200/80 bg-white text-[#1f2240] focus:ring-2 focus:ring-cyan-200 focus:border-cyan-300",
    "dark:border-white/10 dark:bg-white/5 dark:text-white/85 dark:placeholder:text-white/35 dark:focus:ring-white/10 dark:focus:border-cyan-400/30",
  ].join(" ");

  const textareaCls = [
    "min-h-[72px] rounded-xl border px-3 py-2 text-[10.5px] outline-none transition w-full resize-none",
    "border-gray-200/80 bg-white text-[#1f2240] focus:ring-2 focus:ring-cyan-200 focus:border-cyan-300",
    "dark:border-white/10 dark:bg-white/5 dark:text-white/85 dark:placeholder:text-white/35 dark:focus:ring-white/10 dark:focus:border-cyan-400/30",
  ].join(" ");

  const dangerBtn = [
    "h-8 px-3 rounded-xl inline-flex items-center justify-center gap-1.5 transition text-[10px] font-semibold",
    "bg-red-50 border border-red-200 text-red-700 hover:bg-red-100",
    "dark:bg-red-500/10 dark:border-red-400/20 dark:text-red-200 dark:hover:bg-red-500/15",
  ].join(" ");

  const secondaryBtn = [
    "h-8 px-3 rounded-xl inline-flex items-center justify-center gap-1.5 transition text-[10px] font-semibold",
    "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50",
    "dark:bg-white/5 dark:border-white/10 dark:text-white/75 dark:hover:bg-white/8",
  ].join(" ");

  const sectionTitleCls =
    "mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold text-gray-700 dark:text-white/75";

  const isSubmitDisabled =
    submitting || loading || (mode === "edit" && !isFormChanged);

  return (
    <div className="fixed inset-0 z-1200 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={!submitting ? onClose : undefined} />
      <div
        className="relative z-10 w-full max-w-105 overflow-hidden rounded-2xl bg-white dark:bg-[#12101f]"
        style={{ boxShadow: `0 24px 64px -12px ${currentColor}30, 0 8px 24px rgba(0,0,0,.18)` }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/8">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: accentGrad }}>
              {mode === "create" ? <FiPlus className="text-[14px]" /> : <FiEdit2 className="text-[14px]" />}
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: currentColor }}>
                {mode === "create" ? "NEW DIAGRAM" : "EDIT DIAGRAM"}
              </p>
              <h3 className="text-[14px] font-bold text-slate-800 dark:text-white/90">
                {mode === "create" ? "Create Diagram" : "Edit Diagram"}
              </h3>
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

        <div className="px-5 py-5 space-y-3 max-h-[68vh] overflow-y-auto">
          {loading ? (
            <div className="py-8 text-center text-[10.5px] text-gray-500 dark:text-white/55">
              Loading.
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-gray-200/80 bg-gray-50/70 p-3 dark:border-white/10 dark:bg-white/3">
                <label className={sectionTitleCls}>
                  <FiType className="text-[11px] text-cyan-600 dark:text-cyan-300" />
                  Name
                </label>

                <div className="relative">
                  <FiType className="absolute left-3 top-1/2 -translate-y-1/2 text-[10.5px] text-gray-400 dark:text-white/35" />

                  <input
                    value={form.name}
                    onChange={(e) => handleChangeForm("name", e.target.value)}
                    placeholder="Enter diagram name"
                    className={["pl-8", inputCls].join(" ")}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200/80 bg-gray-50/70 p-3 dark:border-white/10 dark:bg-white/3">
                <label className={sectionTitleCls}>
                  <FiUpload className="text-[11px] text-emerald-600 dark:text-emerald-300" />
                  Update
                </label>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.gif,.svg,.bmp,image/*"
                  onChange={handleSelectImage}
                  className="hidden"
                />

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={secondaryBtn}
                  >
                    <FiUpload className="text-[10px]" />
                    Upload Image
                  </button>

                  {form.image_base64?.trim() && (
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className={dangerBtn}
                    >
                      <FiX className="text-[10px]" />
                      Remove
                    </button>
                  )}
                </div>

                <p className="mt-1.5 text-[9px] text-gray-500 dark:text-white/45">
                  Only image files can be uploaded (jpg, jpeg, png, webp, gif,
                  svg, bmp)
                </p>
              </div>

              <div className="rounded-2xl border border-gray-200/80 bg-gray-50/70 p-3 dark:border-white/10 dark:bg-white/3">
                <label className={sectionTitleCls}>
                  <FiFileText className="text-[11px] text-violet-600 dark:text-violet-300" />
                  Description
                </label>

                <textarea
                  value={form.description}
                  onChange={(e) =>
                    handleChangeForm("description", e.target.value)
                  }
                  placeholder="Enter diagram description"
                  className={textareaCls}
                />
              </div>

              <div className="rounded-2xl border border-gray-200/80 bg-gray-50/70 p-3 dark:border-white/10 dark:bg-white/3">
                <label className={sectionTitleCls}>
                  <FiEye className="text-[11px] text-orange-500 dark:text-orange-300" />
                  Preview
                </label>

                <div className="rounded-xl border border-gray-200/80 bg-white p-2.5 dark:bg-[#0F172A] dark:border-white/10">
                  <div className="min-h-29.5 w-full rounded-lg overflow-hidden border border-gray-200/80 bg-gray-50 dark:bg-white/5 dark:border-white/10">
                    {form.image_base64?.trim() ? (
                      <img
                        src={getImageSrc(form.image_base64)}
                        alt="Diagram preview"
                        className="block w-full h-auto object-contain"
                      />
                    ) : (
                      <div className="h-29.5 w-full flex flex-col items-center justify-center text-gray-400 dark:text-white/30">
                        <FiImage className="text-[18px]" />
                        <p className="mt-1 text-[9.5px]">No preview image</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {formError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[10px] text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-200">
                  {formError}
                </div>
              )}
            </>
          )}
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
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitDisabled}
            style={isSubmitDisabled ? undefined : { background: accentGrad }}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-[12.5px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:opacity-60"
          >
            {submitting ? (
              <>
                <FiRefreshCw className="animate-spin text-[12px]" />
                Saving…
              </>
            ) : (
              <>
                {mode === "create" ? <FiPlus className="text-[12px]" /> : <FiCheck className="text-[12px]" />}
                {mode === "create" ? "Create Diagram" : "Update Diagram"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DiagramFormModal;