import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Map, { Marker, NavigationControl, type MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
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
  FiCrosshair,
  FiTarget,
  FiEdit2,
  FiSlash,
  FiExternalLink,
  FiLink,
} from "react-icons/fi";
import { type AllTargetDTO } from "../../../../services";
import type { LocationFormState } from "../index";
import { formatDateTime } from "../index";
import { useStateContext } from "../../../../contexts/ProviderContext";
import { useLanguage } from "../../../../contexts/LanguageContext";

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";

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
  task_id: normalizeValue(form.task_id),
  latitude: normalizeValue(form.latitude),
  longtitude: normalizeValue(form.longtitude),
});

// ── Extract lat/lng from Google Maps URL ──────────────────────────────────────
const extractCoordsFromGoogleMapsUrl = (
  url: string,
): { lat: number; lng: number } | null => {
  const validate = (lat: number, lng: number) =>
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180;

  // /@lat,lng,zoom  (most common — browser address bar)
  const atMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (atMatch) {
    const lat = Number(atMatch[1]);
    const lng = Number(atMatch[2]);
    if (validate(lat, lng)) return { lat, lng };
  }

  // ?q=lat,lng  or  &q=lat,lng
  const qMatch = url.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (qMatch) {
    const lat = Number(qMatch[1]);
    const lng = Number(qMatch[2]);
    if (validate(lat, lng)) return { lat, lng };
  }

  // ?ll=lat,lng
  const llMatch = url.match(/[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (llMatch) {
    const lat = Number(llMatch[1]);
    const lng = Number(llMatch[2]);
    if (validate(lat, lng)) return { lat, lng };
  }

  // !3dlat!4dlng  (embed URL format)
  const dMatch = url.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/);
  if (dMatch) {
    const lat = Number(dMatch[1]);
    const lng = Number(dMatch[2]);
    if (validate(lat, lng)) return { lat, lng };
  }

  return null;
};

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
  const { t } = useLanguage();
  const accentGrad = `linear-gradient(135deg, ${currentColor}, color-mix(in srgb, ${currentColor} 65%, #a855f7))`;

  const [openTargetSelector, setOpenTargetSelector] = useState(false);
  const [targetSearch, setTargetSearch] = useState(emptySearch);
  const selectorButtonRef = useRef<HTMLButtonElement | null>(null);
  const selectorDropdownRef = useRef<HTMLDivElement | null>(null);
  const [selectorRect, setSelectorRect] = useState<DOMRect | null>(null);
  const initialEditFormRef = useRef<ReturnType<typeof createComparableForm> | null>(null);
  const miniMapRef = useRef<MapRef | null>(null);

  const [mapsUrl, setMapsUrl] = useState("");
  const [urlError, setUrlError] = useState("");

  useEffect(() => {
    if (!open) {
      setOpenTargetSelector(false);
      setTargetSearch("");
      setMapsUrl("");
      setUrlError("");
      setSelectorRect(null);
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
      const target = e.target as Node;
      if (
        selectorButtonRef.current?.contains(target) ||
        selectorDropdownRef.current?.contains(target)
      ) {
        return;
      }
      setOpenTargetSelector(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const usedTaskIdSet = useMemo(() => {
    const set = new Set<string>();
    usedTaskIds.forEach((taskId) => {
      const normalized = String(taskId || "").trim();
      if (!normalized) return;
      if (currentTaskId && normalized === String(currentTaskId).trim()) return;
      set.add(normalized);
    });
    return set;
  }, [usedTaskIds, currentTaskId]);

  const availableTargets = useMemo(() => {
    return targets.filter((target) => {
      const taskId = String(target.task_id ?? "").trim();
      if (!taskId) return false;
      if (taskId === String(form.task_id ?? "").trim()) return true;
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
    const current = createComparableForm(form);
    return (
      current.location !== initialEditFormRef.current.location ||
      current.task_id !== initialEditFormRef.current.task_id ||
      current.latitude !== initialEditFormRef.current.latitude ||
      current.longtitude !== initialEditFormRef.current.longtitude
    );
  }, [form, mode]);

  const handleChange = (field: keyof LocationFormState, value: string) => {
    onChange((prev) => ({ ...prev, [field]: value }));
  };

  const handleSelectTarget = (target: AllTargetDTO) => {
    const taskId = String(target.task_id ?? "").trim();
    if (!taskId) return;
    if (usedTaskIdSet.has(taskId) && taskId !== String(form.task_id ?? "").trim()) return;
    onChange((prev) => ({ ...prev, task_id: target.task_id }));
    setOpenTargetSelector(false);
    setTargetSearch("");
  };

  // ── Google Maps Link handler ──────────────────────────────────────────────

  const pickedLat = form.latitude.trim() !== "" ? Number(form.latitude) : null;
  const pickedLng = form.longtitude.trim() !== "" ? Number(form.longtitude) : null;
  const hasCoords =
    pickedLat !== null &&
    pickedLng !== null &&
    Number.isFinite(pickedLat) &&
    Number.isFinite(pickedLng);

  const miniMapInitialView = (() => {
    if (hasCoords) {
      return { latitude: pickedLat!, longitude: pickedLng!, zoom: 15 };
    }
    return { latitude: 13.7563, longitude: 100.5018, zoom: 12 };
  })();

  const handleMapsUrlChange = (url: string) => {
    setMapsUrl(url);
    setUrlError("");

    if (!url.trim()) {
      handleChange("latitude", "");
      handleChange("longtitude", "");
      return;
    }

    const coords = extractCoordsFromGoogleMapsUrl(url);
    if (coords) {
      handleChange("latitude", coords.lat.toFixed(6));
      handleChange("longtitude", coords.lng.toFixed(6));
      miniMapRef.current?.flyTo({
        center: [coords.lng, coords.lat],
        zoom: 15,
        duration: 800,
      });
    } else if (url.trim().length > 15) {
      setUrlError(t("targetModal.noCoordsInLink"));
    }
  };

  const handleMapPick = (e: any) => {
    const lat: number = e.lngLat.lat;
    const lng: number = e.lngLat.lng;
    handleChange("latitude", lat.toFixed(6));
    handleChange("longtitude", lng.toFixed(6));
  };

  const handleClearCoords = () => {
    handleChange("latitude", "");
    handleChange("longtitude", "");
    setMapsUrl("");
    setUrlError("");
  };

  // ─────────────────────────────────────────────────────────────────────────

  const submitText =
    mode === "create"
      ? loading ? t("targetModal.creating") : t("targetModal.create")
      : loading ? t("common.saving") : t("userModal.saveChanges");

  const isSubmitDisabled = loading || (mode === "edit" && !isFormChanged);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[3px]"
        onClick={!loading ? onClose : undefined}
      />

      {/* Modal */}
      <div
        className="relative z-10 flex w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white dark:bg-[#12101f]"
        style={{
          maxHeight: "90vh",
          boxShadow: `0 24px 64px -12px ${currentColor}30, 0 8px 32px rgba(0,0,0,.25)`,
        }}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-white/8">
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white"
              style={{ background: accentGrad }}
            >
              {mode === "create" ? (
                <FiMapPin className="text-[14px]" />
              ) : (
                <FiEdit2 className="text-[14px]" />
              )}
            </span>
            <div>
              <p
                className="text-[9.5px] font-bold uppercase tracking-widest"
                style={{ color: currentColor }}
              >
                {mode === "create"
                  ? t("targetModal.newLocationKicker")
                  : t("targetModal.editLocationKicker")}
              </p>
              <h3 className="text-[14px] font-bold text-slate-800 dark:text-white/90">
                {mode === "create" ? t("targetModal.createLocation") : t("targetModal.editLocation")}
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

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto space-y-3.5 px-5 py-4">

          {/* Location */}
          <div>
            <label className={labelCls}>
              <FiMapPin className="text-[10px]" />
              {t("targetModal.location")}
            </label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => handleChange("location", e.target.value)}
              placeholder={t("targetModal.enterLocation")}
              className={inputCls}
            />
          </div>

          {/* Target selector */}
          <div>
            <label className={labelCls}>
              <FiTarget className="text-[10px]" />
              {t("nav.target")}
            </label>
            <div>
              <button
                ref={selectorButtonRef}
                type="button"
                onClick={() => {
                  if (loadingTargets) return;
                  if (!openTargetSelector && selectorButtonRef.current) {
                    setSelectorRect(selectorButtonRef.current.getBoundingClientRect());
                  }
                  setOpenTargetSelector((p) => !p);
                }}
                disabled={loadingTargets}
                className={selectorButtonCls}
              >
                <FiServer className="shrink-0 text-[12px] text-slate-400 dark:text-white/35" />
                <span className="flex-1 truncate text-left text-[12px]">
                  {selectedTarget
                    ? selectedTarget.name?.trim() ||
                      selectedTarget.ip?.trim() ||
                      t("targetModal.selectedTarget")
                    : loadingTargets
                    ? t("targetModal.loadingTargets")
                    : t("targetModal.selectTarget")}
                </span>
                <FiChevronDown
                  className={`shrink-0 text-[12px] text-slate-400 transition-transform duration-200 dark:text-white/35 ${
                    openTargetSelector ? "rotate-180" : ""
                  }`}
                />
              </button>

              {openTargetSelector && selectorRect && createPortal(
                (() => {
                  const dropdownH = 220;
                  const spaceBelow = window.innerHeight - selectorRect.bottom - 8;
                  const spaceAbove = selectorRect.top - 8;
                  const openUpward = spaceBelow < dropdownH && spaceAbove > spaceBelow;
                  return (
                    <div
                      ref={selectorDropdownRef}
                      style={{
                        position: "fixed",
                        ...(openUpward
                          ? { bottom: window.innerHeight - selectorRect.top + 6 }
                          : { top: selectorRect.bottom + 6 }),
                        left: selectorRect.left,
                        width: selectorRect.width,
                        zIndex: 99999,
                      }}
                      className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xl dark:border-white/10 dark:bg-[#0d0b1a]"
                    >
                      {/* Search */}
                      <div className="border-b border-slate-100 p-2 dark:border-white/8">
                        <div className="flex items-center gap-2 rounded-xl border border-slate-200/70 bg-slate-50 px-2.5 dark:border-white/8 dark:bg-white/5">
                          <FiSearch className="shrink-0 text-[11px] text-slate-400 dark:text-white/35" />
                          <input
                            value={targetSearch}
                            onChange={(e) => setTargetSearch(e.target.value)}
                            placeholder={t("targetModal.searchTarget")}
                            autoFocus
                            className="h-8 w-full bg-transparent text-[11px] text-slate-700 outline-none placeholder:text-slate-400 dark:text-white/75 dark:placeholder:text-white/30"
                          />
                        </div>
                      </div>

                      {/* Options */}
                      <div className="max-h-44 overflow-y-auto p-1.5">
                        {loadingTargets ? (
                          <div className="py-5 text-center text-[11px] text-slate-400 dark:text-white/35">
                            {t("targetModal.loadingTargets")}
                          </div>
                        ) : filteredTargets.length === 0 ? (
                          <div className="flex flex-col items-center gap-1.5 py-5 text-[11px] text-slate-400 dark:text-white/35">
                            <FiSlash className="text-[16px]" />
                            {t("targetModal.noAvailableTarget")}
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
                                >
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
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-[11.5px] font-medium text-slate-700 dark:text-white/80">
                                      {target.name || t("targetModal.unnamedTarget")}
                                    </p>
                                    <div className="mt-0.5 flex flex-wrap gap-x-3">
                                      <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 dark:text-white/35">
                                        <FiServer className="text-[9px]" />
                                        {target.ip || "-"}
                                      </span>
                                      <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 dark:text-white/35">
                                        <FiCalendar className="text-[9px]" />
                                        {formatDateTime(target.detected_date)}
                                      </span>
                                      <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 dark:text-white/35">
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
                  );
                })(),
                document.body
              )}
            </div>
          </div>

          {/* ── Google Maps Link ── */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className={labelCls.replace("mb-1.5 ", "")}>
                <FiLink className="text-[10px]" />
                {t("targetModal.googleMapsLink")}
              </span>
              <a
                href="https://www.google.com/maps"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-[10px] font-medium text-blue-500 transition hover:text-blue-600 dark:text-blue-400"
              >
                <FiExternalLink className="text-[9px]" />
                {t("targetModal.openGoogleMaps")}
              </a>
            </div>

            {/* URL input */}
            <input
              type="url"
              value={mapsUrl}
              onChange={(e) => handleMapsUrlChange(e.target.value)}
              onPaste={(e) => {
                const pasted = e.clipboardData.getData("text");
                handleMapsUrlChange(pasted);
                e.preventDefault();
              }}
              placeholder="https://www.google.com/maps/@13.xxxx,100.xxxx,15z"
              className={inputCls}
            />

            {/* URL error */}
            {urlError && (
              <p className="mt-1.5 text-[10px] text-rose-500 dark:text-rose-400">
                {urlError}
              </p>
            )}

            {/* Coordinate result */}
            {hasCoords && (
              <div className="mt-2 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-400/20 dark:bg-emerald-500/10">
                <div className="flex items-center gap-2">
                  <FiCrosshair className="shrink-0 text-[11px] text-emerald-500" />
                  <span className="font-mono text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                    {pickedLat!.toFixed(6)}, {pickedLng!.toFixed(6)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleClearCoords}
                  className="text-[10px] text-slate-400 transition hover:text-rose-500 dark:text-white/30 dark:hover:text-rose-400"
                >
                  {t("common.clear")}
                </button>
              </div>
            )}

            {/* Preview map — shows only after coordinates are set */}
            {hasCoords && (
              <div
                className="relative mt-2 overflow-hidden rounded-xl border border-slate-200/80 dark:border-white/10"
                style={{ height: 160 }}
              >
                <Map
                  ref={miniMapRef}
                  mapStyle={MAP_STYLE}
                  initialViewState={miniMapInitialView}
                  onClick={handleMapPick}
                  cursor="crosshair"
                  style={{ width: "100%", height: "100%" }}
                  attributionControl={{ compact: true }}
                  dragRotate={false}
                >
                  <NavigationControl position="top-right" showCompass={false} />
                  <Marker
                    longitude={pickedLng!}
                    latitude={pickedLat!}
                    anchor="bottom"
                  >
                    <div className="flex flex-col items-center">
                      <div
                        className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white shadow-lg"
                        style={{ background: accentGrad }}
                      >
                        <FiMapPin className="text-[11px] text-white" />
                      </div>
                      <div className="h-2 w-0.5 bg-cyan-500" />
                    </div>
                  </Marker>
                </Map>
                <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2">
                  <span className="rounded-lg bg-black/40 px-2 py-1 text-[9px] text-white backdrop-blur-sm">
                    {t("targetModal.clickToAdjustCoords")}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex gap-2.5 border-t border-slate-100 px-5 py-3.5 dark:border-white/8">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 text-[12.5px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60 dark:border-white/8 dark:text-white/55 dark:hover:bg-white/5"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={() => {
              if (mode === "edit" && !isFormChanged) return;
              onSubmit(form);
            }}
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
