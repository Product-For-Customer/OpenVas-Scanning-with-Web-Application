import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  FiX,
  FiSearch,
  FiChevronDown,
  FiCheck,
  FiServer,
  FiCalendar,
  FiActivity,
  FiSave,
  FiMapPin,
  FiHome,
  FiLayers,
  FiCrosshair,
  FiTarget,
  FiEdit2,
  FiSlash,
} from "react-icons/fi";
import { type AllTargetDTO } from "../../../../services";
import type { LocationFormState } from "../index";
import { formatDateTime } from "../index";
import { useStateContext } from "../../../../contexts/ProviderContext";

type Props = {
  open: boolean;
  mode: "create" | "edit";
  loading: boolean;
  loadingTargets: boolean;
  error: string;
  form: LocationFormState;
  targets: AllTargetDTO[];
  usedTaskIds: string[];
  currentTaskId?: string | null;
  onClose: () => void;
  onChange: React.Dispatch<React.SetStateAction<LocationFormState>>;
  onSubmit: (form: LocationFormState) => Promise<void>;
};

const selectorButtonCls = [
  "h-9 rounded-xl px-3 flex items-center gap-2 border transition w-full",
  "bg-white border-slate-200/80 text-slate-700 hover:border-cyan-300 hover:bg-cyan-50/30",
  "dark:bg-white/5 dark:border-white/10 dark:text-white/75 dark:hover:bg-white/10",
  "disabled:cursor-not-allowed disabled:opacity-60",
].join(" ");

const inputCls = [
  "h-9 w-full rounded-xl border px-3 text-[12px] outline-none transition",
  "border-slate-200/80 bg-white text-slate-800 placeholder:text-slate-400",
  "focus:ring-2 focus:ring-cyan-200 focus:border-cyan-300",
  "dark:border-white/10 dark:bg-white/5 dark:text-white/85 dark:placeholder:text-white/35",
  "dark:focus:ring-white/10 dark:focus:border-cyan-400/30",
].join(" ");

const labelCls =
  "mb-1.5 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/35";

const emptySearch = "";

const normalizeValue = (value: unknown) => String(value ?? "").trim();

const createComparableForm = (form: LocationFormState) => ({
  location: normalizeValue(form.location),
  building: normalizeValue(form.building),
  floor: normalizeValue(form.floor),
  task_id: normalizeValue(form.task_id),
  latitude: normalizeValue(form.latitude),
  longtitude: normalizeValue(form.longtitude),
});

const ModalCreateAndUpdate: React.FC<Props> = ({
  open,
  mode,
  loading,
  loadingTargets,
  error,
  form,
  targets,
  usedTaskIds,
  currentTaskId = null,
  onClose,
  onChange,
  onSubmit,
}) => {
  const { currentColor } = useStateContext();
  const accentGrad = `linear-gradient(135deg, ${currentColor}, color-mix(in srgb, ${currentColor} 65%, #a855f7))`;

  const [openTargetSelector, setOpenTargetSelector] = useState(false);
  const [targetSearch, setTargetSearch] = useState(emptySearch);
  const selectorRef = useRef<HTMLDivElement | null>(null);
  const initialEditFormRef = useRef<ReturnType<typeof createComparableForm> | null>(
    null
  );

  useEffect(() => {
    if (!open) {
      setOpenTargetSelector(false);
      setTargetSearch("");
      initialEditFormRef.current = null;
      return;
    }

    if (mode === "edit") {
      initialEditFormRef.current = createComparableForm(form);
    } else {
      initialEditFormRef.current = null;
    }
  }, [open, mode, form]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        selectorRef.current &&
        !selectorRef.current.contains(e.target as Node)
      ) {
        setOpenTargetSelector(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const usedTaskIdSet = useMemo(() => {
    const set = new Set<string>();

    usedTaskIds.forEach((taskId) => {
      const normalized = String(taskId || "").trim();
      if (!normalized) return;

      if (currentTaskId && normalized === String(currentTaskId).trim()) {
        return;
      }

      set.add(normalized);
    });

    return set;
  }, [usedTaskIds, currentTaskId]);

  const availableTargets = useMemo(() => {
    return targets.filter((target) => {
      const taskId = String(target.task_id ?? "").trim();
      if (!taskId) return false;

      if (taskId === String(form.task_id ?? "").trim()) {
        return true;
      }

      return !usedTaskIdSet.has(taskId);
    });
  }, [targets, usedTaskIdSet, form.task_id]);

  const filteredTargets = useMemo(() => {
    const keyword = targetSearch.trim().toLowerCase();
    if (!keyword) return availableTargets;

    return availableTargets.filter((target) => {
      const name = String(target.name ?? "").toLowerCase();
      const ip = String(target.ip ?? "").toLowerCase();
      const detectedDate = String(target.detected_date ?? "").toLowerCase();
      const taskID = String(target.task_id ?? "").toLowerCase();

      return (
        name.includes(keyword) ||
        ip.includes(keyword) ||
        detectedDate.includes(keyword) ||
        taskID.includes(keyword)
      );
    });
  }, [availableTargets, targetSearch]);

  const selectedTarget = useMemo(() => {
    return targets.find((item) => item.task_id === form.task_id) ?? null;
  }, [targets, form.task_id]);

  const isFormChanged = useMemo(() => {
    if (mode !== "edit") return true;
    if (!initialEditFormRef.current) return false;

    const currentComparableForm = createComparableForm(form);

    return (
      currentComparableForm.location !== initialEditFormRef.current.location ||
      currentComparableForm.building !== initialEditFormRef.current.building ||
      currentComparableForm.floor !== initialEditFormRef.current.floor ||
      currentComparableForm.task_id !== initialEditFormRef.current.task_id ||
      currentComparableForm.latitude !== initialEditFormRef.current.latitude ||
      currentComparableForm.longtitude !== initialEditFormRef.current.longtitude
    );
  }, [form, mode]);

  const handleChange = (field: keyof LocationFormState, value: string) => {
    onChange((prev) => ({ ...prev, [field]: value }));
  };

  const handleSelectTarget = (target: AllTargetDTO) => {
    const taskId = String(target.task_id ?? "").trim();
    if (!taskId) return;

    if (
      usedTaskIdSet.has(taskId) &&
      taskId !== String(form.task_id ?? "").trim()
    ) {
      return;
    }

    onChange((prev) => ({ ...prev, task_id: target.task_id }));
    setOpenTargetSelector(false);
    setTargetSearch("");
  };

  const submitText =
    mode === "create"
      ? loading
        ? "Creating..."
        : "Create"
      : loading
      ? "Saving..."
      : "Save Changes";

  const isSubmitDisabled = loading || (mode === "edit" && !isFormChanged);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
      {/* Full-screen backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[3px]"
        onClick={!loading ? onClose : undefined}
      />

      {/* Modal card */}
      <div
        className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl bg-white dark:bg-[#12101f]"
        style={{ boxShadow: `0 24px 64px -12px ${currentColor}30, 0 8px 32px rgba(0,0,0,.25)` }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-white/8">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: accentGrad }}>
              {mode === "create" ? <FiMapPin className="text-[14px]" /> : <FiEdit2 className="text-[14px]" />}
            </span>
            <div>
              <p className="text-[9.5px] font-bold uppercase tracking-widest" style={{ color: currentColor }}>
                {mode === "create" ? "APPS · TARGET · NEW LOCATION" : "APPS · TARGET · EDIT LOCATION"}
              </p>
              <h3 className="text-[14px] font-bold text-slate-800 dark:text-white/90">
                {mode === "create" ? "Create Location" : "Edit Location"}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 disabled:opacity-40 dark:text-white/35 dark:hover:bg-white/8"
          >
            <FiX className="text-[15px]" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-3.5 px-5 py-4">

          {/* Location */}
          <div>
            <label className={labelCls}>
              <FiMapPin className="text-[10px]" />
              Location
            </label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => handleChange("location", e.target.value)}
              placeholder="Enter location"
              className={inputCls}
            />
          </div>

          {/* Building + Floor */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>
                <FiHome className="text-[10px]" />
                Building
              </label>
              <input
                type="text"
                value={form.building}
                onChange={(e) => handleChange("building", e.target.value)}
                placeholder="Enter building"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>
                <FiLayers className="text-[10px]" />
                Floor
              </label>
              <input
                type="number"
                value={form.floor}
                onChange={(e) => handleChange("floor", e.target.value)}
                placeholder="Enter floor"
                className={inputCls}
              />
            </div>
          </div>

          {/* Latitude + Longitude */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>
                <FiCrosshair className="text-[10px]" />
                Latitude
              </label>
              <input
                type="number"
                step="any"
                value={form.latitude}
                onChange={(e) => handleChange("latitude", e.target.value)}
                placeholder="Enter latitude"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>
                <FiCrosshair className="text-[10px]" />
                Longitude
              </label>
              <input
                type="number"
                step="any"
                value={form.longtitude}
                onChange={(e) => handleChange("longtitude", e.target.value)}
                placeholder="Enter longitude"
                className={inputCls}
              />
            </div>
          </div>

          {/* Target selector */}
          <div>
            <label className={labelCls}>
              <FiTarget className="text-[10px]" />
              Target
            </label>
            <div className="relative" ref={selectorRef}>
              <button
                type="button"
                onClick={() => { if (!loadingTargets) setOpenTargetSelector(p => !p); }}
                disabled={loadingTargets}
                className={selectorButtonCls}
              >
                <FiServer className="shrink-0 text-[12px] text-slate-400 dark:text-white/35" />
                <span className="flex-1 truncate text-left text-[12px]">
                  {selectedTarget
                    ? (selectedTarget.name?.trim() || selectedTarget.ip?.trim() || "Selected target")
                    : loadingTargets ? "Loading targets…" : "Select target"}
                </span>
                <FiChevronDown className={`shrink-0 text-[12px] text-slate-400 transition-transform duration-200 dark:text-white/35 ${openTargetSelector ? "rotate-180" : ""}`} />
              </button>

              {openTargetSelector && (
                <div className="absolute left-0 right-0 z-50 mt-1.5 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xl dark:border-white/10 dark:bg-[#0d0b1a]">
                  {/* Search */}
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

                  {/* Options */}
                  <div className="max-h-44 overflow-y-auto p-1.5">
                    {loadingTargets ? (
                      <div className="py-5 text-center text-[11px] text-slate-400 dark:text-white/35">Loading targets…</div>
                    ) : filteredTargets.length === 0 ? (
                      <div className="flex flex-col items-center gap-1.5 py-5 text-[11px] text-slate-400 dark:text-white/35">
                        <FiSlash className="text-[16px]" />
                        No available target
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
                              className={["flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition",
                                checked ? "bg-cyan-50 dark:bg-cyan-500/10" : "hover:bg-slate-50 dark:hover:bg-white/5"].join(" ")}
                            >
                              <span className={["mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition",
                                checked ? "border-cyan-500 bg-cyan-500 text-white" : "border-slate-300 bg-white text-transparent dark:border-white/20 dark:bg-white/5"].join(" ")}>
                                <FiCheck className="text-[9px]" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[11.5px] font-medium text-slate-700 dark:text-white/80">
                                  {target.name || "Unnamed Target"}
                                </p>
                                <div className="mt-0.5 flex flex-wrap gap-x-3">
                                  <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 dark:text-white/35">
                                    <FiServer className="text-[9px]" />{target.ip || "-"}
                                  </span>
                                  <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 dark:text-white/35">
                                    <FiCalendar className="text-[9px]" />{formatDateTime(target.detected_date)}
                                  </span>
                                  <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 dark:text-white/35">
                                    <FiActivity className="text-[9px]" />
                                    {typeof target.risk_score === "number" ? target.risk_score.toFixed(2) : "-"}
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
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2.5 border-t border-slate-100 px-5 py-3.5 dark:border-white/8">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 text-[12.5px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60 dark:border-white/8 dark:text-white/55 dark:hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => { if (mode === "edit" && !isFormChanged) return; onSubmit(form); }}
            disabled={isSubmitDisabled}
            style={isSubmitDisabled ? undefined : { background: accentGrad }}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-[12.5px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-white/10"
          >
            <FiSave className="text-[11px]" />
            {submitText}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ModalCreateAndUpdate;