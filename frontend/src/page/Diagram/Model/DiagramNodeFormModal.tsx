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
  FiChevronDown,
  FiSearch,
  FiCheck,
  FiTarget,
  FiCalendar,
  FiActivity,
  FiServer,
  FiSlash,
} from "react-icons/fi";
import type { AppDiagramNodeResponse } from "../../../services/diagram";
import { ListALLTarget, type AllTargetDTO } from "../../../services";
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

type AnchorPoint = { clientX: number; clientY: number };

type Props = {
  open: boolean;
  mode: DiagramNodeModalMode;
  loading?: boolean;
  diagramName?: string;
  initialData?: AppDiagramNodeResponse | null;
  draftPosition?: { x: number; y: number; width: number; height: number } | null;
  allDiagramNodes?: AppDiagramNodeResponse[];
  currentNodeId?: number | null;
  anchorPoint?: AnchorPoint | null;
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
  task_id: normalizeValue(form.task_id),
  label: normalizeValue(form.label),
  description: normalizeValue(form.description),
  icon: normalizeValue(form.icon),
  x: Number(form.x),
  y: Number(form.y),
  width: Number(form.width),
  height: Number(form.height),
  z_index: Number(form.z_index),
});

// ── Inline dropdown (no portal needed — modal has no overflow-hidden) ────────
const DiagramNodeFormModal: React.FC<Props> = ({
  open,
  mode,
  loading = false,
  diagramName,
  initialData,
  draftPosition,
  allDiagramNodes = [],
  currentNodeId = null,
  onClose,
  onSubmit,
  onDelete,
}) => {
  const { currentColor } = useStateContext();
  const accentGrad = `linear-gradient(135deg, ${currentColor}, color-mix(in srgb, ${currentColor} 65%, #a855f7))`;

  const [form, setForm] = useState<DiagramNodeFormValues>(defaultForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const [targets, setTargets] = useState<AllTargetDTO[]>([]);
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [openTargetSelector, setOpenTargetSelector] = useState(false);
  const [targetSearch, setTargetSearch] = useState("");

  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const initialEditFormRef = useRef<ReturnType<typeof createComparableForm> | null>(null);

  // ── Init form ──────────────────────────────────────────────────
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

  // ── Fetch targets ──────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    let isMounted = true;
    const fetchTargets = async () => {
      setLoadingTargets(true);
      try {
        const res = await ListALLTarget();
        if (!isMounted) return;
        setTargets(Array.isArray(res) ? res : []);
      } catch {
        if (isMounted) setTargets([]);
      } finally {
        if (isMounted) setLoadingTargets(false);
      }
    };
    void fetchTargets();
    return () => { isMounted = false; };
  }, [open]);

  // ── Close dropdown on outside click ───────────────────────────
  useEffect(() => {
    if (!openTargetSelector) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !dropdownRef.current?.contains(t)) {
        setOpenTargetSelector(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openTargetSelector]);

  useEffect(() => {
    if (!open) setOpenTargetSelector(false);
  }, [open]);

  // ── Derived ────────────────────────────────────────────────────
  const subtitle = useMemo(
    () => mode === "create"
      ? `Create new node in ${diagramName || "diagram"}`
      : `Update selected node in ${diagramName || "diagram"}`,
    [mode, diagramName]
  );

  const usedTaskIdSet = useMemo(() => {
    const set = new Set<string>();
    for (const node of allDiagramNodes) {
      const nodeId = Number(node?.id ?? 0);
      const taskId = String(node?.task_id ?? "").trim();
      if (!taskId) continue;
      if (currentNodeId && nodeId === currentNodeId) continue;
      set.add(taskId);
    }
    return set;
  }, [allDiagramNodes, currentNodeId]);

  const selectedTarget = useMemo(
    () => targets.find((t) => t.task_id === form.task_id) ?? null,
    [targets, form.task_id]
  );

  const availableTargets = useMemo(
    () => targets.filter((t) => {
      const taskId = String(t.task_id ?? "").trim();
      if (!taskId) return false;
      if (taskId === String(form.task_id ?? "").trim()) return true;
      return !usedTaskIdSet.has(taskId);
    }),
    [targets, usedTaskIdSet, form.task_id]
  );

  const filteredTargets = useMemo(() => {
    const kw = targetSearch.trim().toLowerCase();
    if (!kw) return availableTargets;
    return availableTargets.filter((t) =>
      [t.name, t.ip, t.detected_date, t.task_id]
        .some((v) => String(v ?? "").toLowerCase().includes(kw))
    );
  }, [availableTargets, targetSearch]);

  const targetButtonLabel = useMemo(() => {
    if (!selectedTarget) return loadingTargets ? "Loading targets…" : "Select target";
    return selectedTarget.name?.trim() || selectedTarget.ip?.trim() || "Selected target";
  }, [selectedTarget, loadingTargets]);

  const isFormChanged = useMemo(() => {
    if (mode !== "edit") return true;
    if (!initialEditFormRef.current) return false;
    const cur = createComparableForm(form);
    const orig = initialEditFormRef.current;
    return (
      cur.task_id !== orig.task_id || cur.label !== orig.label ||
      cur.description !== orig.description || cur.icon !== orig.icon ||
      cur.x !== orig.x || cur.y !== orig.y ||
      cur.width !== orig.width || cur.height !== orig.height ||
      cur.z_index !== orig.z_index
    );
  }, [form, mode]);

  if (!open) return null;

  const setField = <K extends keyof DiagramNodeFormValues>(
    key: K, value: DiagramNodeFormValues[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const handleSelectTarget = (target: AllTargetDTO) => {
    const taskId = String(target.task_id ?? "").trim();
    if (!taskId) return;
    if (usedTaskIdSet.has(taskId) && taskId !== String(form.task_id ?? "").trim()) return;
    setField("task_id", taskId);
    setOpenTargetSelector(false);
    setTargetSearch("");
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!form.label.trim()) nextErrors.label = "Please enter a label";
    if (!form.task_id.trim()) {
      nextErrors.task_id = "Please select a target";
    } else if (
      usedTaskIdSet.has(form.task_id.trim()) &&
      form.task_id.trim() !== String(initialData?.task_id ?? "").trim()
    ) {
      nextErrors.task_id = "This target is already used";
    }
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
        task_id: form.task_id.trim(),
        icon: FIXED_ICON,
        x: Number(form.x), y: Number(form.y),
        width: Number(form.width), height: Number(form.height),
        z_index: Number(form.z_index),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const isUpdateDisabled =
    submitting || loading || loadingTargets || (mode === "edit" && !isFormChanged);

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

  // Each item ≈ 56px → 3 items = 168px for the list area
  const ITEM_H = 56;
  const LIST_MAX_H = ITEM_H * 3;

  return createPortal(
    <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[3px]"
        onClick={!submitting ? onClose : undefined}
      />

      {/* Modal card — no overflow-hidden so inline dropdown is visible */}
      <div
        className="relative z-10 w-full max-w-md rounded-2xl bg-white dark:bg-[#12101f]"
        style={{ boxShadow: `0 24px 64px -12px ${currentColor}30, 0 8px 32px rgba(0,0,0,.25)` }}
      >
        {/* Header */}
        <div className="flex items-center justify-between rounded-t-2xl border-b border-slate-100 px-5 py-3.5 dark:border-white/8">
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white"
              style={{ background: accentGrad }}
            >
              {mode === "create" ? <FiPlus className="text-[14px]" /> : <FiEdit2 className="text-[14px]" />}
            </span>
            <div>
              <p className="text-[9.5px] font-bold uppercase tracking-widest" style={{ color: currentColor }}>
                {mode === "create" ? "CREATE NODE" : "EDIT NODE"}
              </p>
              <h3 className="text-[14px] font-bold text-slate-800 dark:text-white/90">Diagram Node</h3>
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

            {/* Target selector */}
            <div>
              <label className={labelCls}>
                <FiTarget className="text-[10px]" />
                Target <span className="text-red-400">*</span>
              </label>

              {/* Trigger + floating dropdown wrapper */}
              <div className="relative">
                <button
                  ref={triggerRef}
                  type="button"
                  onClick={() => { if (!loadingTargets) setOpenTargetSelector((p) => !p); }}
                  disabled={loadingTargets}
                  className={[
                    "flex h-9 w-full items-center gap-2 rounded-xl border px-3 transition",
                    openTargetSelector
                      ? "border-cyan-300 bg-cyan-50/40 dark:border-cyan-400/30 dark:bg-white/10"
                      : "border-slate-200/80 bg-white hover:border-cyan-300 hover:bg-cyan-50/30 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10",
                    "disabled:cursor-not-allowed disabled:opacity-60",
                  ].join(" ")}
                >
                  <FiServer className="shrink-0 text-[12px] text-slate-400 dark:text-white/35" />
                  <span className="flex-1 truncate text-left text-[12px] text-slate-700 dark:text-white/75">
                    {targetButtonLabel}
                  </span>
                  <FiChevronDown
                    className={`shrink-0 text-[12px] text-slate-400 transition-transform duration-200 dark:text-white/35 ${openTargetSelector ? "rotate-180" : ""}`}
                  />
                </button>

              {/* Absolute dropdown — floats over content, does NOT expand modal */}
              {openTargetSelector && (
                <div
                  ref={dropdownRef}
                  className="absolute left-0 right-0 top-full z-200 mt-1.5 overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-white/10 dark:bg-[#0d0b1a]"
                  style={{ boxShadow: "0 16px 48px -8px rgba(0,0,0,.28), 0 4px 16px rgba(0,0,0,.14)" }}
                >
                  {/* Search bar */}
                  <div className="border-b border-slate-100 p-2 dark:border-white/8">
                    <div className="flex items-center gap-2 rounded-xl border border-slate-200/70 bg-slate-50 px-2.5 dark:border-white/8 dark:bg-white/5">
                      <FiSearch className="shrink-0 text-[11px] text-slate-400 dark:text-white/35" />
                      <input
                        value={targetSearch}
                        onChange={(e) => setTargetSearch(e.target.value)}
                        placeholder="Search target…"
                        autoFocus
                        className="h-8 w-full bg-transparent text-[11px] text-slate-700 outline-none placeholder:text-slate-400 dark:text-white/75 dark:placeholder:text-white/30"
                      />
                    </div>
                  </div>

                  {/* List — fixed height = 3 items, scroll for more */}
                  <div
                    className="overflow-y-auto px-1.5 py-1.5"
                    style={{ maxHeight: LIST_MAX_H }}
                  >
                    {loadingTargets ? (
                      <div className="flex items-center justify-center gap-2 py-5 text-[11px] text-slate-400 dark:text-white/35">
                        <FiRefreshCw className="animate-spin text-[12px]" />
                        Loading targets…
                      </div>
                    ) : filteredTargets.length === 0 ? (
                      <div className="flex flex-col items-center justify-center gap-1.5 py-5 text-[11px] text-slate-400 dark:text-white/35">
                        <FiSlash className="text-[16px]" />
                        No available targets
                      </div>
                    ) : (
                      <div className="space-y-0.5">
                        {filteredTargets.map((target) => {
                          const checked = form.task_id === target.task_id;
                          return (
                            <button
                              key={`${target.task_id}-${target.ip}`}
                              type="button"
                              onClick={() => handleSelectTarget(target)}
                              className={[
                                "flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition",
                                checked
                                  ? "bg-cyan-50 dark:bg-cyan-500/10"
                                  : "hover:bg-slate-50 dark:hover:bg-white/5",
                              ].join(" ")}
                              style={{ minHeight: ITEM_H }}
                            >
                              {/* Checkbox */}
                              <span
                                className={[
                                  "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition",
                                  checked
                                    ? "border-cyan-500 bg-cyan-500 text-white"
                                    : "border-slate-300 bg-white text-transparent dark:border-white/20 dark:bg-white/5",
                                ].join(" ")}
                              >
                                <FiCheck className="text-[9px]" />
                              </span>

                              {/* Info */}
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[11.5px] font-medium text-slate-700 dark:text-white/80">
                                  {target.name || "Unnamed Target"}
                                </p>
                                <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                                  <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 dark:text-white/35">
                                    <FiServer className="text-[9px]" />
                                    {target.ip || "-"}
                                  </span>
                                  <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 dark:text-white/35">
                                    <FiCalendar className="text-[9px]" />
                                    {target.detected_date || "-"}
                                  </span>
                                  <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 dark:text-white/35">
                                    <FiActivity className="text-[9px]" />
                                    Risk{" "}
                                    {typeof target.risk_score === "number"
                                      ? target.risk_score.toFixed(2)
                                      : "-"}
                                  </span>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
              </div>{/* end relative wrapper */}

              {/* Selected target chip (hidden while dropdown is open) */}
              {selectedTarget && !openTargetSelector && (
                <div
                  className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl px-3 py-2"
                  style={{ backgroundColor: `${currentColor}10`, border: `1px solid ${currentColor}25` }}
                >
                  <span
                    className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold"
                    style={{ color: currentColor }}
                  >
                    <FiServer className="text-[10px]" />
                    {selectedTarget.name || selectedTarget.ip || "-"}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[10.5px] text-slate-500 dark:text-white/45">
                    <FiCalendar className="text-[10px]" />
                    {selectedTarget.detected_date || "-"}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[10.5px] text-slate-500 dark:text-white/45">
                    <FiActivity className="text-[10px]" />
                    Risk{" "}
                    {typeof selectedTarget.risk_score === "number"
                      ? selectedTarget.risk_score.toFixed(2)
                      : "-"}
                  </span>
                </div>
              )}

              {errors.task_id && (
                <p className="mt-1 text-[10px] text-red-500">{errors.task_id}</p>
              )}
            </div>

            {/* Error banner */}
            {(errors.label || errors.task_id) && (
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
                  {mode === "create" ? <FiPlus className="text-[11px]" /> : <FiSave className="text-[11px]" />}
                  {mode === "create" ? "+ Create Node" : "Update Node"}
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
