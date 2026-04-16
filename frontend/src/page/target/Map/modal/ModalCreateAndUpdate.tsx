import React, { useEffect, useMemo, useRef, useState } from "react";
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
  FiPlus,
  FiEdit2,
} from "react-icons/fi";
import { type AllTargetDTO } from "../../../../services";
import type { LocationFormState } from "../index";
import { formatDateTime } from "../index";

type Props = {
  open: boolean;
  mode: "create" | "edit";
  loading: boolean;
  loadingTargets: boolean;
  error: string;
  form: LocationFormState;
  targets: AllTargetDTO[];
  onClose: () => void;
  onChange: React.Dispatch<React.SetStateAction<LocationFormState>>;
  onSubmit: (form: LocationFormState) => Promise<void>;
};

const primaryBlueButtonCls = [
  "h-9 px-3 rounded-xl inline-flex items-center justify-center gap-2 transition text-[10px] font-semibold",
  "bg-cyan-500 text-white hover:bg-cyan-600 border border-cyan-500 shadow-sm",
  "dark:bg-cyan-500 dark:text-white dark:hover:bg-cyan-400 dark:border-cyan-400/30",
  "disabled:cursor-not-allowed disabled:opacity-60",
].join(" ");

const secondaryBtnCls = [
  "h-9 px-3 rounded-xl inline-flex items-center justify-center gap-2 transition text-[10px] font-semibold",
  "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50",
  "dark:bg-white/5 dark:border-white/10 dark:text-white/75 dark:hover:bg-white/8",
  "disabled:cursor-not-allowed disabled:opacity-60",
].join(" ");

const selectorButtonCls = [
  "h-9 rounded-xl px-3 flex items-center gap-2 border transition w-full",
  "bg-white border-gray-200 text-slate-700 hover:border-cyan-200 hover:bg-cyan-50/60",
  "dark:bg-white/5 dark:border-white/10 dark:text-white/75 dark:hover:bg-white/10",
  "disabled:cursor-not-allowed disabled:opacity-60",
].join(" ");

const inputCls = [
  "h-9 rounded-xl border px-3 text-[10px] outline-none transition w-full",
  "border-gray-200/80 bg-white text-[#1f2240] focus:ring-2 focus:ring-cyan-200 focus:border-cyan-300",
  "dark:border-white/10 dark:bg-white/5 dark:text-white/85 dark:placeholder:text-white/35 dark:focus:ring-white/10 dark:focus:border-cyan-400/30",
].join(" ");

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
  onClose,
  onChange,
  onSubmit,
}) => {
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
  }, [open, mode]);

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

  const filteredTargets = useMemo(() => {
    const keyword = targetSearch.trim().toLowerCase();
    if (!keyword) return targets;

    return targets.filter((target) => {
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
  }, [targets, targetSearch]);

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
    onChange((prev) => ({ ...prev, task_id: target.task_id }));
    setOpenTargetSelector(false);
    setTargetSearch("");
  };

  const subtitle =
    mode === "create"
      ? "เพิ่ม location ใหม่และผูกกับ target"
      : "แก้ไขข้อมูล location และ target";

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

  return (
    <div className="fixed inset-0 z-300 flex items-center justify-center bg-slate-950/60 backdrop-blur-[3px] p-3 sm:p-4">
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
                  {mode === "create" ? "Create Location" : "Edit Location"}
                </span>
              </div>

              <div className="mt-2.5 flex items-center gap-2">
                <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/80 bg-cyan-50 dark:border-cyan-400/20 dark:bg-cyan-500/10">
                  <FiMapPin className="text-[15px] text-cyan-600 dark:text-cyan-300" />
                </div>

                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-[#1f2240] dark:text-white/90">
                    Location Form
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
              disabled={loading}
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
                    Fill location detail and select target
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-[9px] font-medium text-gray-600 dark:text-white/65">
                    <FiMapPin className="text-[9.5px] text-cyan-600 dark:text-cyan-300" />
                    Location
                  </label>
                  <div className="relative">
                    <FiMapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-[9.5px] text-gray-400 dark:text-white/35" />
                    <input
                      type="text"
                      value={form.location}
                      onChange={(e) => handleChange("location", e.target.value)}
                      placeholder="Enter location"
                      className={["pl-8", inputCls].join(" ")}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-[9px] font-medium text-gray-600 dark:text-white/65">
                    <FiHome className="text-[9.5px] text-cyan-600 dark:text-cyan-300" />
                    Building
                  </label>
                  <div className="relative">
                    <FiHome className="absolute left-3 top-1/2 -translate-y-1/2 text-[9.5px] text-gray-400 dark:text-white/35" />
                    <input
                      type="text"
                      value={form.building}
                      onChange={(e) => handleChange("building", e.target.value)}
                      placeholder="Enter building"
                      className={["pl-8", inputCls].join(" ")}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-[9px] font-medium text-gray-600 dark:text-white/65">
                      <FiLayers className="text-[9.5px] text-cyan-600 dark:text-cyan-300" />
                      Floor
                    </label>
                    <div className="relative">
                      <FiLayers className="absolute left-3 top-1/2 -translate-y-1/2 text-[9.5px] text-gray-400 dark:text-white/35" />
                      <input
                        type="number"
                        value={form.floor}
                        onChange={(e) => handleChange("floor", e.target.value)}
                        placeholder="Enter floor"
                        className={["pl-8", inputCls].join(" ")}
                      />
                    </div>
                  </div>

                  <div className="relative" ref={selectorRef}>
                    <label className="mb-1.5 flex items-center gap-1.5 text-[9px] font-medium text-gray-600 dark:text-white/65">
                      <FiTarget className="text-[9.5px] text-cyan-600 dark:text-cyan-300" />
                      Target
                    </label>

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
                      <FiServer className="shrink-0 text-[11px]" />
                      <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[10px] font-medium">
                        {selectedTarget
                          ? selectedTarget.name?.trim()
                            ? selectedTarget.name
                            : selectedTarget.ip?.trim()
                            ? selectedTarget.ip
                            : "Selected target"
                          : loadingTargets
                          ? "Loading target..."
                          : "Select target"}
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
                                        ? "border border-cyan-200 bg-cyan-50 dark:border-cyan-400/20 dark:bg-cyan-500/10"
                                        : "border border-transparent hover:bg-gray-50 dark:hover:bg-white/5",
                                    ].join(" ")}
                                  >
                                    <span
                                      className={[
                                        "mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-md border transition",
                                        checked
                                          ? "border-cyan-500 bg-cyan-500 text-white"
                                          : "border-gray-300 bg-white text-transparent dark:border-white/20 dark:bg-white/5",
                                      ].join(" ")}
                                    >
                                      <FiCheck className="text-[9px]" />
                                    </span>

                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="h-2 w-2 shrink-0 rounded-full bg-cyan-500" />
                                        <span className="truncate text-[10px] font-medium text-gray-700 dark:text-white/80">
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
                                          {formatDateTime(target.detected_date)}
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
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-[9px] font-medium text-gray-600 dark:text-white/65">
                      <FiCrosshair className="text-[9.5px] text-cyan-600 dark:text-cyan-300" />
                      Latitude
                    </label>
                    <div className="relative">
                      <FiCrosshair className="absolute left-3 top-1/2 -translate-y-1/2 text-[9.5px] text-gray-400 dark:text-white/35" />
                      <input
                        type="number"
                        step="any"
                        value={form.latitude}
                        onChange={(e) => handleChange("latitude", e.target.value)}
                        placeholder="Enter latitude"
                        className={["pl-8", inputCls].join(" ")}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-[9px] font-medium text-gray-600 dark:text-white/65">
                      <FiCrosshair className="text-[9.5px] text-cyan-600 dark:text-cyan-300" />
                      Longtitude
                    </label>
                    <div className="relative">
                      <FiCrosshair className="absolute left-3 top-1/2 -translate-y-1/2 text-[9.5px] text-gray-400 dark:text-white/35" />
                      <input
                        type="number"
                        step="any"
                        value={form.longtitude}
                        onChange={(e) =>
                          handleChange("longtitude", e.target.value)
                        }
                        placeholder="Enter longtitude"
                        className={["pl-8", inputCls].join(" ")}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-3 rounded-[14px] border border-red-200 bg-red-50 px-3.5 py-2.5 text-center text-[11px] text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 bg-white/90 px-3.5 py-3 dark:border-white/10 dark:bg-[#0B1220]">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className={secondaryBtnCls}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => {
              if (mode === "edit" && !isFormChanged) return;
              onSubmit(form);
            }}
            disabled={isSubmitDisabled}
            className={primaryBlueButtonCls}
          >
            <FiSave className="text-[11px]" />
            {submitText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModalCreateAndUpdate;