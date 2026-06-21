import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  FiCheck,
  FiEdit2,
  FiImage,
  FiPlus,
  FiRefreshCw,
  FiType,
  FiX,
  FiFileText,
  FiUpload,
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

const emptyForm: FormState = { name: "", description: "", image_base64: "" };

const MAX_IMAGE_SIZE_MB = 100;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg", "image/jpg", "image/png",
  "image/webp", "image/gif", "image/svg+xml", "image/bmp",
];

const ALLOWED_IMAGE_EXTENSIONS = [
  ".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".bmp",
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
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });

const getFileExtension = (fileName: string): string => {
  const i = fileName.lastIndexOf(".");
  return i === -1 ? "" : fileName.slice(i).toLowerCase();
};

const normalizeValue = (value?: string) => (value ?? "").trim();

const validateImageFile = (file: File): string => {
  const ext = getFileExtension(file.name);
  if (
    !ALLOWED_IMAGE_MIME_TYPES.includes(file.type.toLowerCase()) ||
    !ALLOWED_IMAGE_EXTENSIONS.includes(ext)
  ) return "Only image files can be uploaded";
  if (file.size > MAX_IMAGE_SIZE_BYTES)
    return `Image size must be less than ${MAX_IMAGE_SIZE_MB} MB`;
  return "";
};

const DiagramFormModal: React.FC<DiagramFormModalProps> = ({
  open, mode, loading = false, initialData, onClose, onSuccess,
}) => {
  const { currentColor } = useStateContext();
  const accentGrad = `linear-gradient(135deg, ${currentColor}, color-mix(in srgb, ${currentColor} 65%, #a855f7))`;

  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [hoverPreview, setHoverPreview] = useState(false);

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
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (mode === "create") {
      setForm(emptyForm);
      setFormError("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [open, mode, initialData]);

  const isFormChanged = useMemo(() => {
    if (mode !== "edit") return true;
    if (!initialData) return false;
    return (
      normalizeValue(form.name) !== normalizeValue(initialData.name) ||
      normalizeValue(form.description) !== normalizeValue(initialData.description) ||
      normalizeValue(form.image_base64) !== normalizeValue(initialData.image_base64)
    );
  }, [form, initialData, mode]);

  const validateForm = () => {
    if (!form.name.trim()) return "Please enter diagram name";
    if (!form.image_base64.trim()) return "Please upload a diagram image";
    return "";
  };

  const handleChangeForm = (key: keyof FormState, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const resetImageInput = () => {
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setForm((prev) => ({ ...prev, image_base64: "" }));
    setFormError("");
    resetImageInput();
  };

  const handleSelectImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validationMessage = validateImageFile(file);
    if (validationMessage) {
      setFormError(validationMessage);
      message.error(validationMessage);
      resetImageInput();
      setForm((prev) => ({ ...prev, image_base64: "" }));
      return;
    }

    try {
      const base64 = await fileToBase64(file);
      if (!base64.startsWith("data:image/")) {
        const err = "The selected file is not a valid image";
        setFormError(err);
        message.error(err);
        resetImageInput();
        setForm((prev) => ({ ...prev, image_base64: "" }));
        return;
      }
      setForm((prev) => ({ ...prev, image_base64: base64 }));
      setFormError("");
    } catch {
      const err = "Failed to convert image to base64";
      setFormError(err);
      message.error(err);
      resetImageInput();
    }
  };

  const handleSubmit = async () => {
    const validationMessage = validateForm();
    if (validationMessage) { setFormError(validationMessage); return; }
    if (mode === "edit" && !isFormChanged) { setFormError("No changes detected"); return; }

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
        if (!created) { setFormError("Failed to create diagram"); return; }
        message.success("Create success");
      } else {
        if (!initialData?.id) { setFormError("Diagram not found"); return; }
        const payload: UpdateDiagramInput = {
          name: form.name.trim(),
          description: form.description.trim(),
          image_base64: form.image_base64.trim(),
        };
        const updated = await UpdateDiagramByID(initialData.id, payload);
        if (!updated) { setFormError("Failed to update diagram"); return; }
        message.success("Update success");
      }
      await onSuccess();
    } catch (error) {
      console.error("handleSubmit diagram error:", error);
      setFormError(
        mode === "create"
          ? "An error occurred while creating diagram"
          : "An error occurred while updating diagram"
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const imageSrc = getImageSrc(form.image_base64);
  const hasImage = !!imageSrc;
  const isSubmitDisabled = submitting || loading || (mode === "edit" && !isFormChanged);

  const inputCls = [
    "h-9 rounded-xl border px-3 text-[12px] outline-none transition w-full",
    "border-slate-200/80 bg-white text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-cyan-200 focus:border-cyan-300",
    "dark:border-white/10 dark:bg-white/5 dark:text-white/85 dark:placeholder:text-white/35 dark:focus:ring-white/10 dark:focus:border-cyan-400/30",
  ].join(" ");

  const textareaCls = [
    "rounded-xl border px-3 py-2 text-[12px] outline-none transition w-full resize-none",
    "border-slate-200/80 bg-white text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-cyan-200 focus:border-cyan-300",
    "dark:border-white/10 dark:bg-white/5 dark:text-white/85 dark:placeholder:text-white/35 dark:focus:ring-white/10 dark:focus:border-cyan-400/30",
  ].join(" ");

  return createPortal(
    <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
      {/* Full-screen backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[3px]"
        onClick={!submitting ? onClose : undefined}
      />

      {/* Modal card */}
      <div
        className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl bg-white dark:bg-[#12101f]"
        style={{ boxShadow: `0 24px 64px -12px ${currentColor}30, 0 8px 32px rgba(0,0,0,.25)` }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-white/8">
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white"
              style={{ background: accentGrad }}
            >
              {mode === "create" ? <FiPlus className="text-[14px]" /> : <FiEdit2 className="text-[14px]" />}
            </span>
            <div>
              <p className="text-[9.5px] font-bold uppercase tracking-widest" style={{ color: currentColor }}>
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
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 disabled:opacity-40 dark:text-white/35 dark:hover:bg-white/8"
          >
            <FiX className="text-[15px]" />
          </button>
        </div>

        {/* Body */}
        {loading ? (
          <div className="flex h-40 items-center justify-center text-[11px] text-slate-400 dark:text-white/40">
            <FiRefreshCw className="mr-2 animate-spin text-[14px]" />
            Loading…
          </div>
        ) : (
          <div className="px-5 py-4 space-y-3.5">

            {/* ── Preview / Upload zone (top, full width, clickable) ── */}
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/35">
                <FiImage className="text-[10px]" />
                Image <span className="text-red-400">*</span>
              </label>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.gif,.svg,.bmp,image/*"
                onChange={handleSelectImage}
                className="hidden"
              />

              {/* Clickable preview area */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
                onMouseEnter={() => setHoverPreview(true)}
                onMouseLeave={() => setHoverPreview(false)}
                className={[
                  "relative h-44 w-full cursor-pointer overflow-hidden rounded-xl border-2 border-dashed transition-all duration-200",
                  hasImage
                    ? "border-slate-200/80 dark:border-white/10"
                    : "border-slate-300 bg-slate-50 hover:bg-slate-100/70 dark:border-white/15 dark:bg-white/3 dark:hover:bg-white/5",
                ].join(" ")}
                style={!hasImage && hoverPreview ? { borderColor: currentColor } : undefined}
              >
                {hasImage ? (
                  <>
                    {/* Image */}
                    <img
                      src={imageSrc}
                      alt="Diagram preview"
                      className="h-full w-full object-contain"
                    />

                    {/* Hover overlay — click to change */}
                    <div
                      className={[
                        "absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/40 transition-opacity duration-200",
                        hoverPreview ? "opacity-100" : "opacity-0",
                      ].join(" ")}
                    >
                      <FiUpload className="text-[20px] text-white" />
                      <p className="text-[11px] font-semibold text-white">Click to change image</p>
                    </div>

                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-red-500"
                      title="Remove image"
                    >
                      <FiX className="text-[13px]" />
                    </button>
                  </>
                ) : (
                  /* Empty state */
                  <div className="flex h-full flex-col items-center justify-center gap-2">
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-2xl transition-transform duration-200"
                      style={{
                        background: hoverPreview ? accentGrad : `${currentColor}18`,
                        transform: hoverPreview ? "scale(1.08)" : "scale(1)",
                      }}
                    >
                      <FiImage
                        className="text-[20px] transition-colors duration-200"
                        style={{ color: hoverPreview ? "#fff" : currentColor }}
                      />
                    </div>
                    <p className="text-[12px] font-semibold text-slate-500 dark:text-white/50">
                      Click to upload image
                    </p>
                    <p className="text-[10.5px] text-slate-400 dark:text-white/30">
                      jpg, jpeg, png, webp, gif, svg, bmp
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* ── Name ── */}
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/35">
                <FiType className="text-[10px]" />
                Name <span className="text-red-400">*</span>
              </label>
              <input
                value={form.name}
                onChange={(e) => handleChangeForm("name", e.target.value)}
                placeholder="Enter diagram name"
                className={inputCls}
              />
            </div>

            {/* ── Description ── */}
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/35">
                <FiFileText className="text-[10px]" />
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) => handleChangeForm("description", e.target.value)}
                placeholder="Enter diagram description (optional)"
                rows={2}
                className={textareaCls}
              />
            </div>

            {/* ── Error ── */}
            {formError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300">
                {formError}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex gap-2.5 border-t border-slate-100 px-5 py-3.5 dark:border-white/8">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 text-[12.5px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60 dark:border-white/8 dark:text-white/55 dark:hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSubmitDisabled}
            style={isSubmitDisabled ? undefined : { background: accentGrad }}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-[12.5px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-white/10"
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
    </div>,
    document.body
  );
};

export default DiagramFormModal;
