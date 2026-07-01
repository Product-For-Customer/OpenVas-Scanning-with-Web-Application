import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  FiSave,
  FiX,
  FiTrash2,
  FiEdit2,
  FiPlus,
  FiType,
  FiAlignLeft,
  FiRefreshCw,
} from "react-icons/fi";
import type { AppDiagramNodeResponse } from "../../../services/diagram";
import { useStateContext } from "../../../contexts/ProviderContext";

export type DiagramNodeModalMode = "create" | "edit";

export type DiagramNodeFormValues = {
  task_id: string;
  label: string;
  description: string;
  icon: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z_index: number;
};

type Props = {
  open: boolean;
  mode: DiagramNodeModalMode;
  loading?: boolean;
  diagramName?: string;
  initialData?: AppDiagramNodeResponse | null;
  draftPosition?: { x: number; y: number; width: number; height: number } | null;
  onClose: () => void;
  onSubmit: (values: DiagramNodeFormValues) => Promise<void> | void;
  onDelete?: () => void;
};

const FIXED_ICON = "FiMapPin";

const defaultForm: DiagramNodeFormValues = {
  task_id: "",
  label: "",
  description: "",
  icon: FIXED_ICON,
  x: 10,
  y: 10,
  width: 12,
  height: 9,
  z_index: 1,
};

const toNumber = (value: unknown, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const normalizeValue = (value: unknown) => String(value ?? "").trim();

const createComparableForm = (form: DiagramNodeFormValues) => ({
  label: normalizeValue(form.label),
  description: normalizeValue(form.description),
  icon: normalizeValue(form.icon),
  x: Number(form.x),
  y: Number(form.y),
  width: Number(form.width),
  height: Number(form.height),
  z_index: Number(form.z_index),
});

const DiagramNodeFormModal: React.FC<Props> = ({
  open,
  mode,
  loading = false,
  diagramName,
  initialData,
  draftPosition,
  onClose,
  onSubmit,
  onDelete,
}) => {
  const { currentColor } = useStateContext();
  const accentGrad = `linear-gradient(135deg, ${currentColor}, color-mix(in srgb, ${currentColor} 65%, #a855f7))`;

  const [form, setForm] = useState<DiagramNodeFormValues>(defaultForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const initialEditFormRef = useRef<ReturnType<typeof createComparableForm> | null>(null);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && initialData) {
      const editForm: DiagramNodeFormValues = {
        task_id: initialData.task_id ?? "",
        label: initialData.label ?? "",
        description: initialData.description ?? "",
        icon: FIXED_ICON,
        x: toNumber(initialData.x, 10),
        y: toNumber(initialData.y, 10),
        width: toNumber(initialData.width, 12),
        height: toNumber(initialData.height, 9),
        z_index: toNumber(initialData.z_index, 1),
      };
      setForm(editForm);
      initialEditFormRef.current = createComparableForm(editForm);
      setErrors({});
      return;
    }
    if (mode === "create") {
      const createForm: DiagramNodeFormValues = {
        ...defaultForm,
        icon: FIXED_ICON,
        x: draftPosition?.x ?? 10,
        y: draftPosition?.y ?? 10,
        width: draftPosition?.width ?? 12,
        height: draftPosition?.height ?? 9,
      };
      setForm(createForm);
      initialEditFormRef.current = null;
      setErrors({});
    }
  }, [open, mode, initialData, draftPosition]);

  const subtitle = useMemo(
    () =>
      mode === "create"
        ? `Create new node in ${diagramName || "diagram"}`
        : `Update selected node in ${diagramName || "diagram"}`,
    [mode, diagramName]
  );

  const isFormChanged = useMemo(() => {
    if (mode !== "edit") return true;
    if (!initialEditFormRef.current) return false;
    const cur = createComparableForm(form);
    const orig = initialEditFormRef.current;
    return (
      cur.label !== orig.label ||
      cur.description !== orig.description ||
      cur.icon !== orig.icon ||
      cur.x !== orig.x ||
      cur.y !== orig.y ||
      cur.width !== orig.width ||
      cur.height !== orig.height ||
      cur.z_index !== orig.z_index
    );
  }, [form, mode]);

  if (!open) return null;

  const setField = <K extends keyof DiagramNodeFormValues>(
    key: K,
    value: DiagramNodeFormValues[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!form.label.trim()) nextErrors.label = "Please enter a label";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    if (mode === "edit" && !isFormChanged) return;
    setSubmitting(true);
    try {
      await onSubmit({
        ...form,
        label: form.label.trim(),
        description: form.description.trim(),
        icon: FIXED_ICON,
        x: Number(form.x),
        y: Number(form.y),
        width: Number(form.width),
        height: Number(form.height),
        z_index: Number(form.z_index),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const isUpdateDisabled =
    submitting || loading || (mode === "edit" && !isFormChanged);

  const inputCls = [
    "h-9 w-full rounded-xl border px-3 text-[12px] outline-none transition",
    "border-slate-200/80 bg-white text-slate-800 placeholder:text-slate-400",
    "focus:ring-2 focus:ring-cyan-200 focus:border-cyan-300",
    "dark:border-white/10 dark:bg-white/5 dark:text-white/85 dark:placeholder:text-white/35",
    "dark:focus:ring-white/10 dark:focus:border-cyan-400/30",
  ].join(" ");

  const textareaCls = [
    "w-full resize-none rounded-xl border px-3 py-2 text-[12px] outline-none transition",
    "border-slate-200/80 bg-white text-slate-800 placeholder:text-slate-400",
    "focus:ring-2 focus:ring-cyan-200 focus:border-cyan-300",
    "dark:border-white/10 dark:bg-white/5 dark:text-white/85 dark:placeholder:text-white/35",
    "dark:focus:ring-white/10 dark:focus:border-cyan-400/30",
  ].join(" ");

  const labelCls =
    "mb-1.5 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/35";

  return createPortal(
    <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[3px]"
        onClick={!submitting ? onClose : undefined}
      />

      {/* Modal card */}
      <div
        className="relative z-10 w-full max-w-md rounded-2xl bg-white dark:bg-[#12101f]"
        style={{
          boxShadow: `0 24px 64px -12px ${currentColor}30, 0 8px 32px rgba(0,0,0,.25)`,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between rounded-t-2xl border-b border-slate-100 px-5 py-3.5 dark:border-white/8">
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white"
              style={{ background: accentGrad }}
            >
              {mode === "create" ? (
                <FiPlus className="text-[14px]" />
              ) : (
                <FiEdit2 className="text-[14px]" />
              )}
            </span>
            <div>
              <p
                className="text-[9.5px] font-bold uppercase tracking-widest"
                style={{ color: currentColor }}
              >
                {mode === "create" ? "CREATE NODE" : "EDIT NODE"}
              </p>
              <h3 className="text-[14px] font-bold text-slate-800 dark:text-white/90">
                Diagram Node
              </h3>
              <p className="text-[10px] text-slate-400 dark:text-white/35">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting || loading}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 disabled:opacity-40 dark:text-white/35 dark:hover:bg-white/8"
          >
            <FiX className="text-[15px]" />
          </button>
        </div>

        {/* Body */}
        {loading ? (
          <div className="flex h-44 items-center justify-center text-[11px] text-slate-400 dark:text-white/40">
            <FiRefreshCw className="mr-2 animate-spin text-[14px]" />
            Loading…
          </div>
        ) : (
          <div className="space-y-3.5 px-5 py-4">
            {/* Label */}
            <div>
              <label className={labelCls}>
                <FiType className="text-[10px]" />
                Label <span className="text-red-400">*</span>
              </label>
              <input
                value={form.label}
                onChange={(e) => setField("label", e.target.value)}
                placeholder="Enter label"
                className={inputCls}
              />
              {errors.label && (
                <p className="mt-1 text-[10px] text-red-500">{errors.label}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className={labelCls}>
                <FiAlignLeft className="text-[10px]" />
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                placeholder="Enter description (optional)"
                rows={2}
                className={textareaCls}
              />
            </div>

            {/* Error banner */}
            {errors.label && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300">
                Please fill in all required fields before saving.
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 rounded-b-2xl border-t border-slate-100 px-5 py-3.5 dark:border-white/8">
          <div>
            {mode === "edit" && onDelete ? (
              <button
                type="button"
                onClick={onDelete}
                disabled={submitting || loading}
                title="Delete node"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100 disabled:opacity-40 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
              >
                <FiTrash2 className="text-[13px]" />
              </button>
            ) : (
              <div />
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting || loading}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-[12.5px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60 dark:border-white/8 dark:text-white/55 dark:hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={isUpdateDisabled}
              style={isUpdateDisabled ? undefined : { background: accentGrad }}
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[12.5px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-white/10"
            >
              {submitting || loading ? (
                <>
                  <FiRefreshCw className="animate-spin text-[11px]" />
                  Saving…
                </>
              ) : (
                <>
                  {mode === "create" ? (
                    <FiPlus className="text-[11px]" />
                  ) : (
                    <FiSave className="text-[11px]" />
                  )}
                  {mode === "create" ? "Create Node" : "Update Node"}
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

export default DiagramNodeFormModal;
