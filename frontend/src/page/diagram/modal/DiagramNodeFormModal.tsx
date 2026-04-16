import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FiSave,
  FiX,
  FiTrash2,
  FiEdit2,
  FiPlus,
  FiType,
  FiAlignLeft,
  FiRefreshCw,
  FiCpu,
  FiMapPin,
  FiChevronDown,
  FiSearch,
  FiCheck,
  FiTarget,
  FiCalendar,
  FiActivity,
  FiServer,
} from "react-icons/fi";
import type { AppDiagramNodeResponse } from "../../../services/diagram";
import { ListALLTarget, type AllTargetDTO } from "../../../services";

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
  draftPosition?: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
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
  const [form, setForm] = useState<DiagramNodeFormValues>(defaultForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const [targets, setTargets] = useState<AllTargetDTO[]>([]);
  const [loadingTargets, setLoadingTargets] = useState(false);

  const [openTargetSelector, setOpenTargetSelector] = useState(false);
  const [targetSearch, setTargetSearch] = useState("");

  const targetSelectorRef = useRef<HTMLDivElement | null>(null);
  const initialEditFormRef = useRef<ReturnType<typeof createComparableForm> | null>(
    null
  );

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

  useEffect(() => {
    if (!open) return;

    let isMounted = true;

    const fetchTargets = async () => {
      setLoadingTargets(true);
      try {
        const res = await ListALLTarget();
        if (!isMounted) return;
        setTargets(Array.isArray(res) ? res : []);
      } catch (error) {
        console.error("Failed to fetch all targets:", error);
        if (isMounted) setTargets([]);
      } finally {
        if (isMounted) setLoadingTargets(false);
      }
    };

    fetchTargets();

    return () => {
      isMounted = false;
    };
  }, [open]);

  useEffect(() => {
    if (!openTargetSelector) return;

    const onClickOutside = (e: MouseEvent) => {
      if (!targetSelectorRef.current) return;
      if (!targetSelectorRef.current.contains(e.target as Node)) {
        setOpenTargetSelector(false);
      }
    };

    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [openTargetSelector]);

  const subtitle = useMemo(() => {
    return mode === "create"
      ? `Create new node in ${diagramName || "diagram"}`
      : `Update selected node in ${diagramName || "diagram"}`;
  }, [mode, diagramName]);

  const selectedTarget = useMemo(() => {
    return targets.find((item) => item.task_id === form.task_id) ?? null;
  }, [targets, form.task_id]);

  const filteredTargets = useMemo(() => {
    const keyword = targetSearch.trim().toLowerCase();
    if (!keyword) return targets;

    return targets.filter((target) => {
      const name = String(target.name ?? "").toLowerCase();
      const ip = String(target.ip ?? "").toLowerCase();
      const detectedDate = String(target.detected_date ?? "").toLowerCase();
      return (
        name.includes(keyword) ||
        ip.includes(keyword) ||
        detectedDate.includes(keyword)
      );
    });
  }, [targets, targetSearch]);

  const targetButtonLabel = useMemo(() => {
    if (!selectedTarget) {
      return loadingTargets ? "Loading target..." : "Select target";
    }

    return selectedTarget.name?.trim()
      ? selectedTarget.name
      : selectedTarget.ip?.trim()
      ? selectedTarget.ip
      : "Selected target";
  }, [selectedTarget, loadingTargets]);

  const isFormChanged = useMemo(() => {
    if (mode !== "edit") return true;
    if (!initialEditFormRef.current) return false;

    const currentComparableForm = createComparableForm(form);

    return (
      currentComparableForm.task_id !== initialEditFormRef.current.task_id ||
      currentComparableForm.label !== initialEditFormRef.current.label ||
      currentComparableForm.description !==
        initialEditFormRef.current.description ||
      currentComparableForm.icon !== initialEditFormRef.current.icon ||
      currentComparableForm.x !== initialEditFormRef.current.x ||
      currentComparableForm.y !== initialEditFormRef.current.y ||
      currentComparableForm.width !== initialEditFormRef.current.width ||
      currentComparableForm.height !== initialEditFormRef.current.height ||
      currentComparableForm.z_index !== initialEditFormRef.current.z_index
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

  const handleSelectTarget = (target: AllTargetDTO) => {
    setField("task_id", target.task_id);
    setOpenTargetSelector(false);
    setTargetSearch("");
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};

    if (!form.label.trim()) {
      nextErrors.label = "กรุณากรอก Label";
    }

    if (!form.task_id.trim()) {
      nextErrors.task_id = "กรุณาเลือก Target";
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

  const inputCls = [
    "h-9 rounded-xl border px-3 text-[10px] outline-none transition w-full",
    "border-gray-200/80 bg-white text-[#1f2240] focus:ring-2 focus:ring-cyan-200 focus:border-cyan-300",
    "dark:border-white/10 dark:bg-white/5 dark:text-white/85 dark:placeholder:text-white/35 dark:focus:ring-white/10 dark:focus:border-cyan-400/30",
  ].join(" ");

  const textareaCls = [
    "min-h-[90px] rounded-xl border px-3 py-2 text-[10px] outline-none transition w-full resize-none",
    "border-gray-200/80 bg-white text-[#1f2240] focus:ring-2 focus:ring-cyan-200 focus:border-cyan-300",
    "dark:border-white/10 dark:bg-white/5 dark:text-white/85 dark:placeholder:text-white/35 dark:focus:ring-white/10 dark:focus:border-cyan-400/30",
  ].join(" ");

  const selectorButtonCls = [
    "h-9 rounded-xl px-3 flex items-center gap-2 border transition w-full",
    "bg-white border-gray-200 text-slate-700 hover:border-cyan-200 hover:bg-cyan-50/60",
    "dark:bg-white/5 dark:border-white/10 dark:text-white/75 dark:hover:bg-white/10",
    "disabled:cursor-not-allowed disabled:opacity-60",
  ].join(" ");

  const secondaryBtn = [
    "h-8.5 px-3 rounded-xl inline-flex items-center justify-center gap-2 transition text-[10px] font-semibold",
    "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50",
    "dark:bg-white/5 dark:border-white/10 dark:text-white/75 dark:hover:bg-white/8",
  ].join(" ");

  const actionBtn = [
    "h-8.5 px-3 rounded-xl inline-flex items-center justify-center gap-2 transition text-[10px] font-semibold",
    "bg-cyan-500 text-white hover:bg-cyan-600 border border-cyan-500 shadow-sm",
    "dark:bg-cyan-500 dark:text-white dark:hover:bg-cyan-400 dark:border-cyan-400/30",
  ].join(" ");

  const deleteGradientIconBtn = [
    "inline-flex h-8 w-8 items-center justify-center rounded-full",
    "text-white shadow-sm transition-all duration-200",
    "bg-linear-to-r from-rose-400 via-red-400 to-rose-500",
    "hover:from-rose-500 hover:via-red-500 hover:to-rose-600",
    "focus:outline-none focus:ring-2 focus:ring-red-200",
    "dark:focus:ring-red-500/30",
  ].join(" ");

  const isUpdateDisabled =
    submitting || loading || loadingTargets || (mode === "edit" && !isFormChanged);

  return (
    <div className="fixed inset-0 z-1200 flex items-center justify-center bg-slate-950/60 backdrop-blur-[3px] p-3 sm:p-4">
      <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0B1220] dark:shadow-none">
        <div className="relative border-b border-gray-100 bg-white px-3.5 py-3 dark:border-white/10 dark:bg-[#0B1220]">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-full bg-linear-to-r from-cyan-500/8 via-transparent to-violet-500/8 dark:from-cyan-500/10 dark:via-transparent dark:to-violet-500/10" />

          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200/80 bg-cyan-50 px-2 py-1 text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-500/10 dark:text-cyan-300">
                {mode === "create" ? (
                  <FiPlus className="text-[9px]" />
                ) : (
                  <FiEdit2 className="text-[9px]" />
                )}
                <span className="text-[8.5px] font-semibold tracking-wide">
                  {mode === "create" ? "Create Diagram Node" : "Edit Diagram Node"}
                </span>
              </div>

              <div className="mt-2.5 flex items-center gap-2">
                <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/80 bg-cyan-50 dark:border-cyan-400/20 dark:bg-cyan-500/10">
                  <FiCpu className="text-[15px] text-cyan-600 dark:text-cyan-300" />
                </div>

                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-[#1f2240] dark:text-white/90">
                    Diagram Node
                  </p>
                  <p className="mt-0.5 text-[9.5px] text-gray-500 dark:text-white/50">
                    {subtitle}
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={submitting || loading}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-gray-200 text-gray-500 transition hover:bg-gray-50 dark:border-white/10 dark:text-white/65 dark:hover:bg-white/8"
            >
              <FiX className="text-[14px]" />
            </button>
          </div>
        </div>

        <div className="max-h-[68vh] overflow-y-auto px-3.5 py-3.5">
          <div className="space-y-3">
            <div className="rounded-2xl border border-gray-200/80 bg-gray-50/70 p-3 dark:border-white/10 dark:bg-white/3">
              <div className="mb-2.5 flex items-center gap-2">
                <div className="inline-flex h-7 w-7 items-center justify-center rounded-xl border border-cyan-200/80 bg-white dark:border-white/10 dark:bg-white/5">
                  <FiMapPin className="text-[12px] text-cyan-600 dark:text-cyan-300" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-[#1f2240] dark:text-white/90">
                    Basic Information
                  </p>
                  <p className="text-[9px] text-gray-500 dark:text-white/50">
                    Fill label, description and select target
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-[9px] font-medium text-gray-600 dark:text-white/65">
                    <FiType className="text-[9.5px] text-cyan-600 dark:text-cyan-300" />
                    Label
                  </label>
                  <div className="relative">
                    <FiType className="absolute left-3 top-1/2 -translate-y-1/2 text-[9.5px] text-gray-400 dark:text-white/35" />
                    <input
                      value={form.label}
                      onChange={(e) => setField("label", e.target.value)}
                      placeholder="Enter label"
                      className={["pl-8", inputCls].join(" ")}
                    />
                  </div>
                  {errors.label ? (
                    <p className="mt-1 text-[9px] text-red-500">{errors.label}</p>
                  ) : null}
                </div>

                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-[9px] font-medium text-gray-600 dark:text-white/65">
                    <FiAlignLeft className="text-[9.5px] text-cyan-600 dark:text-cyan-300" />
                    Description
                  </label>
                  <div className="relative">
                    <FiAlignLeft className="absolute left-3 top-3 text-[9.5px] text-gray-400 dark:text-white/35" />
                    <textarea
                      value={form.description}
                      onChange={(e) => setField("description", e.target.value)}
                      placeholder="Enter description"
                      className={["pl-8", textareaCls].join(" ")}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-[9px] font-medium text-gray-600 dark:text-white/65">
                    <FiTarget className="text-[9.5px] text-cyan-600 dark:text-cyan-300" />
                    Target
                  </label>

                  <div className="relative" ref={targetSelectorRef}>
                    <button
                      type="button"
                      onClick={() => {
                        if (!loadingTargets) {
                          setOpenTargetSelector((prev) => !prev);
                        }
                      }}
                      disabled={loadingTargets}
                      className={selectorButtonCls}
                    >
                      <FiServer className="text-[11px] shrink-0" />
                      <span className="text-[10px] font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                        {targetButtonLabel}
                      </span>
                      <FiChevronDown
                        className={`ml-auto text-[11px] transition-transform ${
                          openTargetSelector ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {openTargetSelector && (
                      <div
                        className={[
                          "absolute bottom-full left-0 right-0 z-30 mb-2 overflow-hidden rounded-2xl",
                          "border border-gray-200 bg-white shadow-xl",
                          "dark:border-white/10 dark:bg-[#0B1220] dark:shadow-none",
                        ].join(" ")}
                      >
                        <div className="border-b border-gray-100 p-2 dark:border-white/10">
                          <div
                            className={[
                              "flex items-center gap-2 rounded-xl border px-2.5",
                              "border-gray-200/80 bg-gray-50",
                              "dark:border-white/10 dark:bg-white/5",
                            ].join(" ")}
                          >
                            <FiSearch className="shrink-0 text-[10px] text-gray-400 dark:text-white/40" />
                            <input
                              value={targetSearch}
                              onChange={(e) => setTargetSearch(e.target.value)}
                              placeholder="Search target"
                              className="h-7.5 w-full bg-transparent text-[10px] text-gray-700 outline-none placeholder:text-gray-400 dark:text-white/80 dark:placeholder:text-white/35"
                            />
                          </div>
                        </div>

                        <div className="max-h-44 overflow-y-auto p-2">
                          {loadingTargets ? (
                            <div className="px-3 py-5 text-center text-[10px] text-gray-500 dark:text-white/50">
                              Loading target...
                            </div>
                          ) : filteredTargets.length === 0 ? (
                            <div className="px-3 py-5 text-center text-[10px] text-gray-500 dark:text-white/50">
                              No matching target
                            </div>
                          ) : (
                            <div className="space-y-1">
                              {filteredTargets.map((target) => {
                                const checked = form.task_id === target.task_id;

                                return (
                                  <button
                                    key={`${target.task_id}-${target.ip}`}
                                    type="button"
                                    onClick={() => handleSelectTarget(target)}
                                    className={[
                                      "w-full flex items-start gap-2 rounded-xl px-2.5 py-2 text-left transition",
                                      checked
                                        ? "bg-cyan-50 border border-cyan-200 dark:bg-cyan-500/10 dark:border-cyan-400/20"
                                        : "border border-transparent hover:bg-gray-50 dark:hover:bg-white/5",
                                    ].join(" ")}
                                  >
                                    <span
                                      className={[
                                        "mt-0.5 h-3.5 w-3.5 rounded-md border flex items-center justify-center shrink-0 transition",
                                        checked
                                          ? "bg-cyan-500 border-cyan-500 text-white"
                                          : "bg-white border-gray-300 text-transparent dark:bg-white/5 dark:border-white/20",
                                      ].join(" ")}
                                    >
                                      <FiCheck className="text-[9px]" />
                                    </span>

                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="h-2 w-2 rounded-full bg-cyan-500 shrink-0" />
                                        <span className="text-[10px] font-medium text-gray-700 dark:text-white/80 truncate">
                                          {target.name || "Unnamed Target"}
                                        </span>
                                      </div>

                                      <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                                        <span className="inline-flex items-center gap-1 text-[9px] text-gray-500 dark:text-white/50">
                                          <FiServer className="text-[9px]" />
                                          {target.ip || "-"}
                                        </span>
                                        <span className="inline-flex items-center gap-1 text-[9px] text-gray-500 dark:text-white/50">
                                          <FiCalendar className="text-[9px]" />
                                          {target.detected_date || "-"}
                                        </span>
                                        <span className="inline-flex items-center gap-1 text-[9px] text-gray-500 dark:text-white/50">
                                          <FiActivity className="text-[9px]" />
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
                  </div>

                  {selectedTarget ? (
                    <div className="mt-2 rounded-xl border border-cyan-200/80 bg-cyan-50/70 px-3 py-2 dark:border-cyan-400/20 dark:bg-cyan-500/10">
                      <div className="grid grid-cols-1 gap-1">
                        <p className="text-[9px] text-cyan-800 dark:text-cyan-200">
                          <span className="font-semibold">Target:</span>{" "}
                          {selectedTarget.name || "-"}
                        </p>
                        <p className="text-[9px] text-cyan-800 dark:text-cyan-200">
                          <span className="font-semibold">IP:</span>{" "}
                          {selectedTarget.ip || "-"}
                        </p>
                        <p className="text-[9px] text-cyan-800 dark:text-cyan-200">
                          <span className="font-semibold">Detected Date:</span>{" "}
                          {selectedTarget.detected_date || "-"}
                        </p>
                        <p className="text-[9px] text-cyan-800 dark:text-cyan-200">
                          <span className="font-semibold">Risk Score:</span>{" "}
                          {typeof selectedTarget.risk_score === "number"
                            ? selectedTarget.risk_score.toFixed(2)
                            : "-"}
                        </p>
                      </div>
                    </div>
                  ) : null}

                  {errors.task_id ? (
                    <p className="mt-1 text-[9px] text-red-500">{errors.task_id}</p>
                  ) : null}
                </div>
              </div>
            </div>

            {(errors.task_id || errors.label) && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[9px] text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-200">
                กรุณาตรวจสอบข้อมูลให้ครบถ้วนก่อนบันทึก
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-gray-100 bg-white/90 px-3.5 py-3 dark:border-white/10 dark:bg-[#0B1220] sm:flex-row sm:items-center sm:justify-between">
          <div>
            {mode === "edit" && onDelete ? (
              <button
                type="button"
                onClick={onDelete}
                disabled={submitting || loading}
                className={[
                  deleteGradientIconBtn,
                  submitting || loading ? "cursor-not-allowed opacity-60" : "",
                ].join(" ")}
                title="Delete"
                aria-label="Delete"
              >
                <FiTrash2 className="text-[12px]" />
              </button>
            ) : (
              <div />
            )}
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting || loading}
              className={[
                secondaryBtn,
                submitting || loading ? "cursor-not-allowed opacity-60" : "",
              ].join(" ")}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isUpdateDisabled}
              className={[
                actionBtn,
                isUpdateDisabled ? "cursor-not-allowed opacity-60" : "",
              ].join(" ")}
            >
              {submitting || loading ? (
                <>
                  <FiRefreshCw className="animate-spin text-[11px]" />
                  Saving
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
    </div>
  );
};

export default DiagramNodeFormModal;