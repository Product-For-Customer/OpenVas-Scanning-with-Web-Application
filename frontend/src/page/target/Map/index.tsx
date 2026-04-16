import React, { useEffect, useMemo, useRef, useState } from "react";
import Map, {
  Marker,
  NavigationControl,
  type MapRef,
} from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { message } from "antd";
import {
  FiCpu,
  FiSearch,
  FiMapPin,
  FiExternalLink,
  FiNavigation,
  FiShield,
  FiRadio,
  FiActivity,
  FiTrash2,
  FiX,
  FiHome,
  FiPlus,
  FiEdit2,
  FiCalendar,
} from "react-icons/fi";
import {
  ListLocation,
  DeleteLocationByID,
  CreateLocation as CreateLocationService,
  UpdateLocationByID as UpdateLocationByIDService,
  ListALLTarget,
  type CreateLocationInput,
  type UpdateLocationInput,
  type AllTargetDTO,
} from "../../../services";
import ModalCreateAndUpdate from "./modal/ModalCreateAndUpdate";
import ModalDelete from "./modal/ModalDelete";

export type DeviceStatus = "online" | "offline" | "warning";

export type Device = {
  id: number;
  device_name: string;
  lat: number;
  lng: number;
  ip: string;
  location: string;
  building: string;
  floor: number;
  status: DeviceStatus;
  lastSeen: string;
  task_id: string;
  detected_time: string;
};

export type LocationFormState = {
  location: string;
  building: string;
  floor: string;
  latitude: string;
  longtitude: string;
  task_id: string;
};

const MAP_STYLE =
  "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";

const emptyForm: LocationFormState = {
  location: "",
  building: "",
  floor: "",
  latitude: "",
  longtitude: "",
  task_id: "",
};

const DEFAULT_VIEW_STATE = {
  longitude: 100.5018,
  latitude: 13.7563,
  zoom: 12,
};

const getGoogleMapsLink = (lat: number, lng: number) =>
  `https://www.google.com/maps?q=${lat},${lng}`;

const getStatusColor = (status: DeviceStatus) => {
  switch (status) {
    case "online":
      return "#10b981";
    case "warning":
      return "#f59e0b";
    case "offline":
      return "#ef4444";
    default:
      return "#64748b";
  }
};

const isValidLatitude = (value: number) =>
  Number.isFinite(value) && value >= -90 && value <= 90;

const isValidLongitude = (value: number) =>
  Number.isFinite(value) && value >= -180 && value <= 180;

const isValidCoordinate = (lat: number, lng: number) =>
  isValidLatitude(lat) && isValidLongitude(lng);

const deriveStatus = (taskName?: string, ip?: string): DeviceStatus => {
  const normalizedTaskName = String(taskName || "").toLowerCase();
  const normalizedIP = String(ip || "").trim();

  if (!normalizedIP) return "offline";

  if (
    normalizedTaskName.includes("firewall") ||
    normalizedTaskName.includes("server") ||
    normalizedTaskName.includes("warning")
  ) {
    return "warning";
  }

  return "online";
};

export const formatDateTime = (value?: string) => {
  if (!value) return "-";

  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;

    return d.toLocaleString("th-TH", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
};

const DeviceMarker: React.FC<{
  device: Device;
  active: boolean;
  onClick: (device: Device) => void;
}> = ({ device, active, onClick }) => {
  const color = getStatusColor(device.status);

  return (
    <Marker longitude={device.lng} latitude={device.lat} anchor="bottom">
      <button
        type="button"
        onClick={() => onClick(device)}
        className="group relative outline-none"
      >
        <div
          className={[
            "relative flex h-8 w-8 items-center justify-center rounded-full border border-white/80 bg-white shadow-md transition-all duration-200",
            active ? "scale-105 ring-2 ring-sky-300" : "hover:scale-105",
          ].join(" ")}
        >
          <FiCpu className="text-[13px] text-slate-700" />
          <span
            className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white"
            style={{ backgroundColor: color }}
          />
        </div>

        <div className="mt-1 rounded-full bg-slate-900/85 px-2 py-0.5 text-[9px] font-medium text-white opacity-0 shadow transition-all duration-200 group-hover:opacity-100">
          {device.device_name}
        </div>
      </button>
    </Marker>
  );
};

const MapPopupCard: React.FC<{
  device: Device;
  onClose: () => void;
}> = ({ device, onClose }) => {
  return (
    <div className="absolute bottom-3 left-3 right-3 z-120 md:right-auto md:w-85">
      <div
        className={[
          "overflow-hidden rounded-2xl backdrop-blur",
          "border border-white/70 bg-white/92 shadow-xl",
          "dark:border-white/10 dark:bg-[#0d1524]/92 dark:shadow-none",
        ].join(" ")}
      >
        <div className="border-b border-slate-200 px-3 py-2 dark:border-white/10">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[12px] font-semibold text-slate-900 dark:text-white/90">
                {device.device_name}
              </p>
              <p className="mt-1 text-[9px] text-slate-500 dark:text-white/45">
                Last seen: {device.lastSeen}
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-medium text-white"
                style={{ backgroundColor: getStatusColor(device.status) }}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-white/90" />
                {device.status}
              </span>

              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition hover:bg-slate-200 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/10"
                title="Close"
              >
                <FiX className="text-[12px]" />
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-2 p-3">
          <div className="rounded-xl border border-slate-200 bg-white p-2.5 dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center gap-2 text-[10px] font-medium text-slate-700 dark:text-white/75">
              <FiNavigation />
              IP Address
            </div>
            <p className="mt-1 text-[11px] text-slate-600 dark:text-white/65">
              {device.ip}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-2.5 dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center gap-2 text-[10px] font-medium text-slate-700 dark:text-white/75">
              <FiMapPin />
              Location
            </div>
            <p className="mt-1 text-[11px] text-slate-600 dark:text-white/65">
              {device.location}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-2.5 dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center gap-2 text-[10px] font-medium text-slate-700 dark:text-white/75">
              <FiHome />
              Building / Floor
            </div>
            <p className="mt-1 text-[11px] text-slate-600 dark:text-white/65">
              {device.building} / Floor {device.floor}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-2.5 dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center gap-2 text-[10px] font-medium text-slate-700 dark:text-white/75">
              <FiCalendar />
              Detected Time
            </div>
            <p className="mt-1 text-[11px] text-slate-600 dark:text-white/65">
              {device.detected_time}
            </p>
          </div>

          <a
            href={getGoogleMapsLink(device.lat, device.lng)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-cyan-500 via-sky-500 to-blue-600 px-4 text-[11px] font-medium text-white transition hover:from-cyan-600 hover:via-sky-600 hover:to-blue-700"
          >
            <FiExternalLink className="text-[12px]" />
            Open in Google Maps
          </a>
        </div>
      </div>
    </div>
  );
};

const MapDevice: React.FC = () => {
  const mapRef = useRef<MapRef | null>(null);

  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Device[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  const [targets, setTargets] = useState<AllTargetDTO[]>([]);
  const [loadingTargets, setLoadingTargets] = useState(false);

  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Device | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string>("");

  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createForm, setCreateForm] = useState<LocationFormState>(emptyForm);

  const [openEditModal, setOpenEditModal] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState("");
  const [editTarget, setEditTarget] = useState<Device | null>(null);
  const [editForm, setEditForm] = useState<LocationFormState>(emptyForm);

  const moveToDevice = (device: Device, zoom = 16) => {
    if (!isValidCoordinate(device.lat, device.lng)) return;

    mapRef.current?.flyTo({
      center: [device.lng, device.lat],
      zoom,
      duration: 1200,
      essential: true,
    });
  };

  const handleSelectDevice = (device: Device) => {
    setSelectedDevice(device);
    moveToDevice(device);
  };

  const fetchLocations = async () => {
    try {
      setLoading(true);
      setError("");

      const [locationData, targetData] = await Promise.all([
        ListLocation(),
        ListALLTarget(),
      ]);

      const allTargets = Array.isArray(targetData) ? targetData : [];
      setTargets(allTargets);

      if (!locationData) {
        setRows([]);
        setError("โหลดข้อมูล location ไม่สำเร็จ");
        return;
      }

      const mapped: Device[] = locationData
        .map((item) => {
          const lat = Number(item.latitude);
          const lng = Number(item.longtitude);

          if (!isValidCoordinate(lat, lng)) return null;

          const matchedTarget =
            allTargets.find((target) => target.task_id === item.task_id) || null;

          const targetName =
            String(matchedTarget?.name ?? "").trim() ||
            String(item.task_id ?? "").trim() ||
            `Location #${item.id}`;

          const targetIP = String(matchedTarget?.ip ?? "").trim() || "-";
          const detectedTime = formatDateTime(
            String(matchedTarget?.detected_date ?? "")
          );

          return {
            id: item.id,
            device_name: targetName,
            lat,
            lng,
            ip: targetIP,
            location: item.location || "-",
            building: item.building || "-",
            floor: Number(item.floor ?? 0),
            status: deriveStatus(targetName, targetIP),
            lastSeen: formatDateTime(item.updated_at),
            task_id: String(item.task_id ?? ""),
            detected_time: detectedTime,
          };
        })
        .filter((item): item is Device => item !== null);

      setRows(mapped);

      setSelectedDevice((prev) => {
        if (!prev) return null;
        const found = mapped.find((d) => d.id === prev.id);
        return found ?? null;
      });

      if (locationData.length > 0 && mapped.length === 0) {
        setError(
          "มีข้อมูล location บางรายการที่พิกัดไม่ถูกต้อง จึงไม่สามารถแสดงบนแผนที่ได้"
        );
      }
    } catch (e) {
      console.error("fetchLocations error:", e);
      setRows([]);
      setError("เกิดข้อผิดพลาดตอนโหลดข้อมูลแผนที่");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  const filteredDevices = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return rows.filter((device) => {
      const blob = [
        device.device_name,
        device.ip,
        device.location,
        device.building,
        String(device.floor),
        device.task_id,
        device.detected_time,
      ]
        .join(" ")
        .toLowerCase();

      return !keyword || blob.includes(keyword);
    });
  }, [rows, search]);

  const initialViewState = useMemo(() => {
    if (filteredDevices.length > 0) {
      const first = filteredDevices[0];
      if (isValidCoordinate(first.lat, first.lng)) {
        return {
          longitude: first.lng,
          latitude: first.lat,
          zoom: 15,
        };
      }
    }

    return DEFAULT_VIEW_STATE;
  }, [filteredDevices]);

  useEffect(() => {
    if (!selectedDevice) return;
    const stillExists = filteredDevices.find((d) => d.id === selectedDevice.id);
    if (!stillExists) setSelectedDevice(null);
  }, [filteredDevices, selectedDevice]);

  const openDeleteModal = (device: Device) => {
    setDeleteError("");
    setDeleteTarget(device);
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setDeleteTarget(null);
    setDeleteError("");
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      setDeleting(true);
      setDeleteError("");

      const res = await DeleteLocationByID(deleteTarget.id);

      if (!res) {
        setDeleteError("ลบ location ไม่สำเร็จ");
        return;
      }

      if (selectedDevice?.id === deleteTarget.id) {
        setSelectedDevice(null);
      }

      setDeleteTarget(null);
      await fetchLocations();
      message.success("delete success");
    } catch (err: any) {
      setDeleteError(
        err?.response?.data?.error ||
          err?.message ||
          "เกิดข้อผิดพลาดระหว่างลบ location"
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenCreateModal = async () => {
    setCreateError("");
    setCreateForm(emptyForm);
    setLoadingTargets(true);
    setOpenCreateModal(true);

    try {
      const data = await ListALLTarget();
      setTargets(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("fetch targets create error:", e);
      setTargets([]);
    } finally {
      setLoadingTargets(false);
    }
  };

  const closeCreateModal = () => {
    if (creating) return;
    setOpenCreateModal(false);
    setCreateError("");
  };

  const confirmCreate = async (form: LocationFormState) => {
    try {
      setCreating(true);
      setCreateError("");

      const floor = Number(form.floor);
      const latitude = Number(form.latitude);
      const longtitude = Number(form.longtitude);

      const payload: CreateLocationInput = {
        location: form.location.trim(),
        building: form.building.trim(),
        floor,
        latitude,
        longtitude,
        task_id: form.task_id.trim(),
      };

      if (!payload.location) {
        setCreateError("กรุณากรอก Location");
        return;
      }
      if (!payload.building) {
        setCreateError("กรุณากรอก Building");
        return;
      }
      if (!payload.floor || Number.isNaN(payload.floor)) {
        setCreateError("กรุณากรอก Floor ให้ถูกต้อง");
        return;
      }
      if (!Number.isFinite(latitude)) {
        setCreateError("กรุณากรอก Latitude ให้ถูกต้อง");
        return;
      }
      if (!isValidLatitude(latitude)) {
        setCreateError("Latitude ต้องอยู่ระหว่าง -90 ถึง 90");
        return;
      }
      if (!Number.isFinite(longtitude)) {
        setCreateError("กรุณากรอก Longtitude ให้ถูกต้อง");
        return;
      }
      if (!isValidLongitude(longtitude)) {
        setCreateError("Longtitude ต้องอยู่ระหว่าง -180 ถึง 180");
        return;
      }
      if (!payload.task_id) {
        setCreateError("กรุณาเลือก Task");
        return;
      }

      const res = await CreateLocationService(payload);

      if (!res) {
        setCreateError("สร้าง location ไม่สำเร็จ");
        return;
      }

      setOpenCreateModal(false);
      setCreateForm(emptyForm);
      await fetchLocations();
      message.success("create success");
    } catch (err: any) {
      setCreateError(
        err?.response?.data?.error ||
          err?.message ||
          "เกิดข้อผิดพลาดระหว่างสร้าง location"
      );
    } finally {
      setCreating(false);
    }
  };

  const handleOpenEditModal = async (device: Device) => {
    setEditError("");
    setEditTarget(device);
    setEditForm({
      location: device.location || "",
      building: device.building || "",
      floor: String(device.floor || ""),
      latitude: String(device.lat || ""),
      longtitude: String(device.lng || ""),
      task_id: String(device.task_id || ""),
    });
    setLoadingTargets(true);
    setOpenEditModal(true);

    try {
      const data = await ListALLTarget();
      setTargets(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("fetch targets edit error:", e);
      setTargets([]);
    } finally {
      setLoadingTargets(false);
    }
  };

  const closeEditModal = () => {
    if (editing) return;
    setOpenEditModal(false);
    setEditError("");
    setEditTarget(null);
  };

  const confirmEdit = async (form: LocationFormState) => {
    if (!editTarget) return;

    try {
      setEditing(true);
      setEditError("");

      const floor = Number(form.floor);
      const latitude = Number(form.latitude);
      const longtitude = Number(form.longtitude);

      const payload: UpdateLocationInput = {
        location: form.location.trim(),
        building: form.building.trim(),
        floor,
        latitude,
        longtitude,
        task_id: form.task_id.trim(),
      };

      if (!payload.location) {
        setEditError("กรุณากรอก Location");
        return;
      }
      if (!payload.building) {
        setEditError("กรุณากรอก Building");
        return;
      }
      if (!payload.floor || Number.isNaN(payload.floor)) {
        setEditError("กรุณากรอก Floor ให้ถูกต้อง");
        return;
      }
      if (!Number.isFinite(latitude)) {
        setEditError("กรุณากรอก Latitude ให้ถูกต้อง");
        return;
      }
      if (!isValidLatitude(latitude)) {
        setEditError("Latitude ต้องอยู่ระหว่าง -90 ถึง 90");
        return;
      }
      if (!Number.isFinite(longtitude)) {
        setEditError("กรุณากรอก Longtitude ให้ถูกต้อง");
        return;
      }
      if (!isValidLongitude(longtitude)) {
        setEditError("Longtitude ต้องอยู่ระหว่าง -180 ถึง 180");
        return;
      }
      if (!payload.task_id) {
        setEditError("กรุณาเลือก Task");
        return;
      }

      const res = await UpdateLocationByIDService(editTarget.id, payload);

      if (!res) {
        setEditError("อัปเดต location ไม่สำเร็จ");
        return;
      }

      setOpenEditModal(false);
      setEditTarget(null);
      await fetchLocations();
      message.success("update success");
    } catch (err: any) {
      setEditError(
        err?.response?.data?.error ||
          err?.message ||
          "เกิดข้อผิดพลาดระหว่างอัปเดต location"
      );
    } finally {
      setEditing(false);
    }
  };

  return (
    <>
      <section
        className={[
          "relative overflow-hidden rounded-[22px]",
          "bg-white border border-gray-200/80 shadow-[0_14px_34px_-24px_rgba(15,23,42,0.30)]",
          "dark:bg-[#08111f]/90 dark:border-white/10 dark:ring-1 dark:ring-cyan-400/10 dark:shadow-none",
        ].join(" ")}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-14 -right-10 h-32 w-32 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="absolute -bottom-14 -left-10 h-32 w-32 rounded-full bg-sky-500/10 blur-3xl" />
          <div className="absolute inset-0 opacity-[0.035] dark:opacity-[0.055]">
            <div
              className="h-full w-full"
              style={{
                backgroundImage: `
                  linear-gradient(to right, currentColor 1px, transparent 1px),
                  linear-gradient(to bottom, currentColor 1px, transparent 1px)
                `,
                backgroundSize: "24px 24px",
              }}
            />
          </div>
        </div>

        <div className="relative z-10 overflow-hidden rounded-[22px]">
          <div className="border-b border-slate-200 px-3.5 py-3.5 sm:px-4 md:px-4.5 dark:border-white/10">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
                  <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
                    <div
                      className={[
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5",
                        "bg-cyan-50 text-cyan-700 border border-cyan-200/80",
                        "dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-400/20",
                      ].join(" ")}
                    >
                      <FiShield className="text-[11px]" />
                      <span className="text-[10.5px] font-semibold tracking-wide">
                        Target Map Console
                      </span>
                    </div>

                    <div
                      className={[
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5",
                        "bg-slate-50 text-slate-600 border border-slate-200/80",
                        "dark:bg-white/5 dark:text-white/65 dark:border-white/10",
                      ].join(" ")}
                    >
                      <FiRadio className="text-[11px] text-cyan-500" />
                      <span className="text-[10.5px] font-medium">
                        {rows.length} targets loaded
                      </span>
                    </div>

                    <div
                      className={[
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5",
                        "bg-sky-50 text-sky-700 border border-sky-200/80",
                        "dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-400/20",
                      ].join(" ")}
                    >
                      <FiActivity className="text-[11px] text-sky-500" />
                      <span className="text-[10.5px] font-medium">
                        Live location telemetry
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleOpenCreateModal}
                      className="inline-flex h-8 items-center justify-center gap-2 rounded-full bg-linear-to-r from-cyan-500 via-sky-500 to-blue-600 px-3.5 text-white transition hover:from-cyan-600 hover:via-sky-600 hover:to-blue-700"
                    >
                      <FiPlus className="text-[12px]" />
                      <span className="text-[11px] font-medium">
                        Create Location
                      </span>
                    </button>
                  </div>

                  <h2 className="text-[17px] font-semibold tracking-tight text-slate-900 sm:text-[19px] dark:text-white">
                    Device Location Map
                  </h2>
                  <p className="mt-1 text-[11px] text-slate-500 sm:text-[12px] dark:text-white/55">
                    Display the device location from the Location and Task
                    information.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex w-full flex-col gap-2.5 lg:flex-row lg:items-center">
                  <div className="relative w-full lg:max-w-sm">
                    <FiSearch className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px] text-slate-400 dark:text-white/40" />
                    <input
                      type="text"
                      placeholder="Search device / IP / building / location / task..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className={[
                        "h-9 w-full rounded-2xl pl-9 pr-3.5 text-[12px] outline-none transition-all duration-200",
                        "border border-slate-200 bg-white text-slate-700 focus:border-sky-400",
                        "dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:placeholder:text-white/35 dark:focus:border-cyan-400/50",
                      ].join(" ")}
                    />
                  </div>
                </div>

                <div className="flex items-center">
                  <div className="text-[11px] text-slate-500 dark:text-white/50">
                    {loading ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-500" />
                        Loading map data...
                      </span>
                    ) : error ? (
                      <span className="text-red-600 dark:text-red-300">
                        {error}
                      </span>
                    ) : (
                      <span />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[270px_minmax(0,1fr)]">
            <div
              className={[
                "border-b border-slate-200 bg-slate-50/70 p-3",
                "xl:border-b-0 xl:border-r",
                "dark:border-white/10 dark:bg-white/3",
              ].join(" ")}
            >
              <div className="mb-2.5 flex items-center justify-between">
                <h3 className="text-[12px] font-semibold text-slate-800 dark:text-white/85">
                  Location List
                </h3>
                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-white/60">
                  {filteredDevices.length} items
                </span>
              </div>

              <div className="max-h-72 space-y-2 overflow-y-auto pr-1 xl:max-h-130">
                {loading && (
                  <div className="rounded-[18px] border border-dashed border-slate-300 bg-white px-3.5 py-5 text-center text-[12px] text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-white/50">
                    Loading...
                  </div>
                )}

                {!loading && filteredDevices.length === 0 && (
                  <div className="rounded-[18px] border border-dashed border-slate-300 bg-white px-3.5 py-5 text-center text-[12px] text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-white/50">
                    ไม่พบข้อมูลที่ตรงกับเงื่อนไข
                  </div>
                )}

                {!loading &&
                  filteredDevices.map((device) => {
                    const active = selectedDevice?.id === device.id;
                    const color = getStatusColor(device.status);

                    return (
                      <div
                        key={device.id}
                        className={[
                          "rounded-[18px] border px-3 py-2.5 transition-all duration-200",
                          active
                            ? "border-sky-200 bg-sky-50 dark:border-cyan-400/20 dark:bg-cyan-500/10"
                            : "border-slate-200 bg-white dark:border-white/10 dark:bg-white/5",
                        ].join(" ")}
                      >
                        <button
                          type="button"
                          onClick={() => handleSelectDevice(device)}
                          className="w-full text-left"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-[12px] font-semibold text-slate-800 dark:text-white/85">
                                {device.device_name}
                              </p>
                              <p className="mt-1 truncate text-[10px] text-slate-400 dark:text-white/35">
                                {device.location} • {device.building}
                              </p>
                              <p className="mt-1 truncate text-[10px] text-slate-400 dark:text-white/35">
                                IP: {device.ip}
                              </p>
                              <p className="mt-1 truncate text-[10px] text-slate-400 dark:text-white/35">
                                Detected Time: {device.detected_time}
                              </p>
                            </div>

                            <span
                              className="mt-0.5 h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: color }}
                            />
                          </div>
                        </button>

                        <div className="mt-2.5 flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(device)}
                            className={[
                              "inline-flex h-8 w-8 items-center justify-center rounded-xl transition-colors",
                              "text-cyan-600 bg-cyan-50 hover:bg-cyan-100 active:bg-cyan-200",
                              "dark:text-cyan-300 dark:bg-cyan-500/10 dark:hover:bg-cyan-500/20",
                            ].join(" ")}
                            title="Edit"
                          >
                            <FiEdit2 className="text-[13px]" />
                          </button>

                          <button
                            type="button"
                            onClick={() => openDeleteModal(device)}
                            className={[
                              "inline-flex h-8 w-8 items-center justify-center rounded-xl transition-colors",
                              "text-red-600 bg-red-50 hover:bg-red-100 active:bg-red-200",
                              "dark:text-red-300 dark:bg-red-500/10 dark:hover:bg-red-500/20",
                            ].join(" ")}
                            title="Delete"
                          >
                            <FiTrash2 className="text-[13px]" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="relative h-105 min-h-105 md:h-130 xl:h-155">
              <Map
                ref={mapRef}
                initialViewState={initialViewState}
                mapStyle={MAP_STYLE}
                attributionControl={{ compact: true }}
                dragRotate={false}
                style={{ width: "100%", height: "100%" }}
              >
                <NavigationControl position="top-right" />

                {filteredDevices.map((device) => (
                  <DeviceMarker
                    key={device.id}
                    device={device}
                    active={selectedDevice?.id === device.id}
                    onClick={handleSelectDevice}
                  />
                ))}
              </Map>

              <div className="pointer-events-none absolute left-3 top-3 z-110">
                <div
                  className={[
                    "rounded-[14px] px-2.5 py-1.5 text-[10px] font-medium backdrop-blur",
                    "border border-white/70 bg-white/90 text-slate-700 shadow-md",
                    "dark:border-white/10 dark:bg-[#0B1220]/90 dark:text-white/75 dark:shadow-none dark:ring-1 dark:ring-white/10",
                  ].join(" ")}
                >
                  {filteredDevices.length} device
                  {filteredDevices.length !== 1 ? "s" : ""} shown
                </div>
              </div>

              {selectedDevice && (
                <MapPopupCard
                  device={selectedDevice}
                  onClose={() => setSelectedDevice(null)}
                />
              )}
            </div>
          </div>
        </div>
      </section>

      <ModalCreateAndUpdate
        open={openCreateModal}
        mode="create"
        loading={creating}
        loadingTargets={loadingTargets}
        error={createError}
        form={createForm}
        targets={targets}
        onClose={closeCreateModal}
        onChange={setCreateForm}
        onSubmit={confirmCreate}
      />

      <ModalCreateAndUpdate
        open={openEditModal}
        mode="edit"
        loading={editing}
        loadingTargets={loadingTargets}
        error={editError}
        form={editForm}
        targets={targets}
        onClose={closeEditModal}
        onChange={setEditForm}
        onSubmit={confirmEdit}
      />

      <ModalDelete
        open={!!deleteTarget}
        loading={deleting}
        error={deleteError}
        target={deleteTarget}
        onClose={closeDeleteModal}
        onConfirm={confirmDelete}
      />
    </>
  );
};

export default MapDevice;