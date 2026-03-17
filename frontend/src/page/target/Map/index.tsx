import React, { useEffect, useMemo, useRef, useState } from "react";
import Map, { Marker, NavigationControl } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
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
  FiAlertTriangle,
  FiLayers,
  FiHome,
  FiHash,
  FiPlus,
  FiEdit2,
  FiSave,
  FiChevronDown,
  FiServer,
  FiCheck,
} from "react-icons/fi";
import {
  ListLocation,
  DeleteLocationByID,
  CreateLocation as CreateLocationService,
  UpdateLocationByID as UpdateLocationByIDService,
  ListAppTarget,
  type LocationResponse,
  type AppTargetResponse,
  type CreateLocationInput,
  type UpdateLocationInput,
} from "../../../services";

type DeviceStatus = "online" | "offline" | "warning";

type Device = {
  id: number;
  device_name: string;
  macc: string;
  lat: number;
  lng: number;
  ip: string;
  location: string;
  building: string;
  floor: number;
  status: DeviceStatus;
  lastSeen: string;
  app_target_id: number;
};

type LocationFormState = {
  location: string;
  building: string;
  floor: string;
  latitude: string;
  longtitude: string;
  app_target_id: string;
};

const MAP_STYLE =
  "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";

const emptyForm: LocationFormState = {
  location: "",
  building: "",
  floor: "",
  latitude: "",
  longtitude: "",
  app_target_id: "",
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

const deriveStatus = (item: LocationResponse): DeviceStatus => {
  const targetName = (item.app_target?.name || "").toLowerCase();
  const ip = (item.app_target?.ip_host || "").trim();

  if (!ip) return "offline";
  if (
    targetName.includes("firewall") ||
    targetName.includes("server") ||
    targetName.includes("warning")
  ) {
    return "warning";
  }

  return "online";
};

const formatUpdatedAt = (value?: string) => {
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
            "relative flex h-8.5 w-8.5 items-center justify-center rounded-full border border-white/80 bg-white shadow-md transition-all duration-200",
            active ? "scale-105 ring-2 ring-sky-300" : "hover:scale-105",
          ].join(" ")}
        >
          <FiCpu className="text-[14px] text-slate-700" />
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

type TargetSelectorProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: AppTargetResponse[];
  loading?: boolean;
  placeholder?: string;
};

const TargetSelector: React.FC<TargetSelectorProps> = ({
  label,
  value,
  onChange,
  options,
  loading = false,
  placeholder = "Select App Target",
}) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const selectedTarget = useMemo(() => {
    return options.find((t) => String(t.id) === value) || null;
  }, [options, value]);

  return (
    <div className="relative" ref={wrapRef}>
      <label className="mb-1.5 block text-[12px] font-medium text-slate-700 dark:text-white/75">
        {label}
      </label>

      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className={[
          "h-9 w-full rounded-2xl px-3.5 inline-flex items-center justify-between gap-3 transition text-left",
          "bg-white border border-gray-200/80 text-[12px] font-medium text-gray-700 hover:bg-gray-50",
          "dark:bg-white/5 dark:border-white/10 dark:text-white/75 dark:hover:bg-white/8",
        ].join(" ")}
      >
        <span className="min-w-0 flex items-center gap-2 truncate">
          <FiServer className="shrink-0 text-slate-400 dark:text-white/40 text-[13px]" />
          <span className="truncate">
            {loading
              ? "Loading targets..."
              : selectedTarget
                ? `${selectedTarget.name}${
                    selectedTarget.ip_host ? ` (${selectedTarget.ip_host})` : ""
                  }`
                : placeholder}
          </span>
        </span>

        <FiChevronDown
          className={`shrink-0 transition ${
            open ? "rotate-180" : ""
          } text-gray-400 dark:text-white/45 text-[13px]`}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-260 mt-2 overflow-hidden rounded-[18px] border border-gray-200 bg-white shadow-lg dark:border-white/10 dark:bg-[#0B1220] dark:shadow-none">
          <div className="max-h-56 overflow-y-auto py-1">
            {!loading && options.length === 0 && (
              <div className="px-3.5 py-3 text-[12px] text-slate-500 dark:text-white/50">
                No app target found
              </div>
            )}

            {options.map((target) => {
              const active = String(target.id) === value;
              return (
                <button
                  key={target.id}
                  type="button"
                  onClick={() => {
                    onChange(String(target.id));
                    setOpen(false);
                  }}
                  className={[
                    "w-full px-3.5 py-2.5 text-left text-[12px] transition",
                    active
                      ? "bg-violet-50 text-violet-700 font-semibold dark:bg-violet-500/10 dark:text-violet-200"
                      : "text-gray-700 hover:bg-gray-50 dark:text-white/70 dark:hover:bg-white/8",
                  ].join(" ")}
                >
                  <div className="flex flex-col">
                    <span className="truncate">{target.name}</span>
                    <span className="mt-0.5 text-[10px] text-slate-400 dark:text-white/40">
                      {target.ip_host || "-"}{" "}
                      {target.mac_address ? `• ${target.mac_address}` : ""}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

type MultiTargetSelectorProps = {
  values: string[];
  onChange: (values: string[]) => void;
  options: AppTargetResponse[];
  loading?: boolean;
};

const MultiTargetSelector: React.FC<MultiTargetSelectorProps> = ({
  values,
  onChange,
  options,
  loading = false,
}) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const selectedTargets = useMemo(() => {
    return options.filter((t) => values.includes(String(t.id)));
  }, [options, values]);

  const toggleValue = (id: string) => {
    if (values.includes(id)) {
      onChange(values.filter((v) => v !== id));
    } else {
      onChange([...values, id]);
    }
  };

  const clearAll = () => onChange([]);
  const selectAll = () => onChange(options.map((t) => String(t.id)));

  const label = useMemo(() => {
    if (loading) return "Loading targets...";
    if (selectedTargets.length === 0) return "Query by Target";
    if (selectedTargets.length === 1) {
      const target = selectedTargets[0];
      return `${target.name}${target.ip_host ? ` (${target.ip_host})` : ""}`;
    }
    return `${selectedTargets.length} targets selected`;
  }, [loading, selectedTargets]);

  return (
    <div className="relative w-full sm:w-70" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className={[
          "h-9 w-full rounded-2xl px-3.5 inline-flex items-center justify-between gap-3 transition text-left",
          "bg-white border border-slate-200 text-[12px] font-medium text-slate-700 hover:bg-slate-50",
          "dark:bg-white/5 dark:border-white/10 dark:text-white/75 dark:hover:bg-white/8",
        ].join(" ")}
      >
        <span className="min-w-0 flex items-center gap-2 truncate">
          <FiServer className="shrink-0 text-slate-400 dark:text-white/40 text-[13px]" />
          <span className="truncate">{label}</span>
        </span>

        <FiChevronDown
          className={`shrink-0 transition ${
            open ? "rotate-180" : ""
          } text-slate-400 dark:text-white/45 text-[13px]`}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-260 mt-2 overflow-hidden rounded-[18px] border border-gray-200 bg-white shadow-lg dark:border-white/10 dark:bg-[#0B1220] dark:shadow-none">
          <div className="flex items-center justify-between border-b border-slate-200 px-3.5 py-2.5 dark:border-white/10">
            <span className="text-[11px] font-semibold text-slate-700 dark:text-white/75">
              Select Target
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="text-[10px] font-medium text-cyan-600 hover:text-cyan-700 dark:text-cyan-300"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="text-[10px] font-medium text-slate-500 hover:text-slate-700 dark:text-white/50 dark:hover:text-white/70"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto py-1">
            {!loading && options.length === 0 && (
              <div className="px-3.5 py-3 text-[12px] text-slate-500 dark:text-white/50">
                No app target found
              </div>
            )}

            {options.map((target) => {
              const checked = values.includes(String(target.id));

              return (
                <button
                  key={target.id}
                  type="button"
                  onClick={() => toggleValue(String(target.id))}
                  className={[
                    "flex w-full items-start gap-3 px-3.5 py-2.5 text-left text-[12px] transition",
                    checked
                      ? "bg-violet-50 dark:bg-violet-500/10"
                      : "hover:bg-gray-50 dark:hover:bg-white/8",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-md border transition",
                      checked
                        ? "border-violet-500 bg-violet-500 text-white"
                        : "border-slate-300 bg-white text-transparent dark:border-white/20 dark:bg-white/5",
                    ].join(" ")}
                  >
                    <FiCheck className="text-[10px]" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span
                      className={[
                        "block truncate font-medium",
                        checked
                          ? "text-violet-700 dark:text-violet-200"
                          : "text-slate-700 dark:text-white/75",
                      ].join(" ")}
                    >
                      {target.name}
                    </span>
                    <span className="mt-0.5 block truncate text-[10px] text-slate-400 dark:text-white/40">
                      {target.ip_host || "-"}{" "}
                      {target.mac_address ? `• ${target.mac_address}` : ""}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const MapDevice: React.FC = () => {
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Device[]>([]);
  const [targets, setTargets] = useState<AppTargetResponse[]>([]);
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingTargets, setLoadingTargets] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

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

  const fetchLocations = async () => {
    try {
      setLoading(true);
      setError("");

      const data = await ListLocation();

      if (!data) {
        setRows([]);
        setError("โหลดข้อมูล location ไม่สำเร็จ");
        return;
      }

      const mapped: Device[] = (data as LocationResponse[])
        .filter(
          (item) =>
            typeof item.latitude === "number" &&
            typeof item.longtitude === "number"
        )
        .map((item) => ({
          id: item.id,
          device_name: item.app_target?.name || `Target #${item.app_target_id}`,
          macc: item.app_target?.mac_address || "-",
          lat: item.latitude,
          lng: item.longtitude,
          ip: item.app_target?.ip_host || "-",
          location: item.location || "-",
          building: item.building || "-",
          floor: Number(item.floor ?? 0),
          status: deriveStatus(item),
          lastSeen: formatUpdatedAt(item.updated_at),
          app_target_id: Number(item.app_target_id ?? 0),
        }));

      setRows(mapped);
      setSelectedDevice((prev) => {
        if (prev) {
          const found = mapped.find((d) => d.id === prev.id);
          return found ?? null;
        }
        return mapped.length > 0 ? mapped[0] : null;
      });
    } catch (e) {
      console.error("fetchLocations error:", e);
      setRows([]);
      setError("เกิดข้อผิดพลาดตอนโหลดข้อมูลแผนที่");
    } finally {
      setLoading(false);
    }
  };

  const fetchTargets = async () => {
    try {
      setLoadingTargets(true);
      const data = await ListAppTarget();
      if (!data) {
        setTargets([]);
        return;
      }
      setTargets(data);
    } catch (e) {
      console.error("fetchTargets error:", e);
      setTargets([]);
    } finally {
      setLoadingTargets(false);
    }
  };

  useEffect(() => {
    fetchLocations();
    fetchTargets();
  }, []);

  const filteredDevices = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return rows.filter((device) => {
      const matchTarget =
        selectedTargetIds.length === 0 ||
        selectedTargetIds.includes(String(device.app_target_id));

      const blob = [
        device.device_name,
        device.macc,
        device.ip,
        device.location,
        device.building,
        String(device.floor),
      ]
        .join(" ")
        .toLowerCase();

      const matchSearch = !keyword || blob.includes(keyword);

      return matchTarget && matchSearch;
    });
  }, [rows, search, selectedTargetIds]);

  useEffect(() => {
    if (!selectedDevice) return;
    const stillExists = filteredDevices.find((d) => d.id === selectedDevice.id);
    if (!stillExists) {
      setSelectedDevice(filteredDevices.length > 0 ? filteredDevices[0] : null);
    }
  }, [filteredDevices, selectedDevice]);

  const initialViewState = useMemo(() => {
    if (filteredDevices.length > 0) {
      return {
        longitude: filteredDevices[0].lng,
        latitude: filteredDevices[0].lat,
        zoom: 15,
      };
    }

    return {
      longitude: 100.5018,
      latitude: 13.7563,
      zoom: 12,
    };
  }, [filteredDevices]);

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

  const handleOpenCreateModal = () => {
    setCreateError("");
    setCreateForm(emptyForm);
    setOpenCreateModal(true);
  };

  const closeCreateModal = () => {
    if (creating) return;
    setOpenCreateModal(false);
    setCreateError("");
  };

  const handleCreateChange = (
    field: keyof LocationFormState,
    value: string
  ) => {
    setCreateForm((prev) => ({ ...prev, [field]: value }));
  };

  const confirmCreate = async () => {
    try {
      setCreating(true);
      setCreateError("");

      const payload: CreateLocationInput = {
        location: createForm.location.trim(),
        building: createForm.building.trim(),
        floor: Number(createForm.floor),
        latitude: Number(createForm.latitude),
        longtitude: Number(createForm.longtitude),
        app_target_id: Number(createForm.app_target_id),
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
      if (Number.isNaN(payload.latitude)) {
        setCreateError("กรุณากรอก Latitude ให้ถูกต้อง");
        return;
      }
      if (Number.isNaN(payload.longtitude)) {
        setCreateError("กรุณากรอก Longtitude ให้ถูกต้อง");
        return;
      }
      if (!payload.app_target_id || Number.isNaN(payload.app_target_id)) {
        setCreateError("กรุณาเลือก App Target");
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

  const handleOpenEditModal = (device: Device) => {
    setEditError("");
    setEditTarget(device);
    setEditForm({
      location: device.location || "",
      building: device.building || "",
      floor: String(device.floor || ""),
      latitude: String(device.lat || ""),
      longtitude: String(device.lng || ""),
      app_target_id: String(device.app_target_id || ""),
    });
    setOpenEditModal(true);
  };

  const closeEditModal = () => {
    if (editing) return;
    setOpenEditModal(false);
    setEditError("");
    setEditTarget(null);
  };

  const handleEditChange = (field: keyof LocationFormState, value: string) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const confirmEdit = async () => {
    if (!editTarget) return;

    try {
      setEditing(true);
      setEditError("");

      const payload: UpdateLocationInput = {
        location: editForm.location.trim(),
        building: editForm.building.trim(),
        floor: Number(editForm.floor),
        latitude: Number(editForm.latitude),
        longtitude: Number(editForm.longtitude),
        app_target_id: Number(editForm.app_target_id),
      };

      if (!payload.location) {
        setEditError("กรุณากรอก Location");
        return;
      }
      if (!payload.building) {
        setEditError("กรุณากรอก Building");
        return;
      }
      if (!payload.floor || Number.isNaN(Number(payload.floor))) {
        setEditError("กรุณากรอก Floor ให้ถูกต้อง");
        return;
      }
      if (Number.isNaN(Number(payload.latitude))) {
        setEditError("กรุณากรอก Latitude ให้ถูกต้อง");
        return;
      }
      if (Number.isNaN(Number(payload.longtitude))) {
        setEditError("กรุณากรอก Longtitude ให้ถูกต้อง");
        return;
      }
      if (
        !payload.app_target_id ||
        Number.isNaN(Number(payload.app_target_id))
      ) {
        setEditError("กรุณาเลือก App Target");
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
          <div className="absolute -bottom-14 -left-10 h-32 w-32 rounded-full bg-violet-500/10 blur-3xl" />
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
                        "bg-slate-50 text-slate-600 border border-slate-200/80",
                        "dark:bg-white/5 dark:text-white/65 dark:border-white/10",
                      ].join(" ")}
                    >
                      <FiActivity className="text-[11px] text-violet-500" />
                      <span className="text-[10.5px] font-medium">
                        Live location telemetry
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleOpenCreateModal}
                      className={[
                        "inline-flex h-8 items-center justify-center gap-2 rounded-full px-3.5 transition",
                        "bg-[#6d5efc] text-white hover:bg-[#5f51eb]",
                      ].join(" ")}
                    >
                      <FiPlus className="text-[12px]" />
                      <span className="text-[11px] font-medium">Create Location</span>
                    </button>
                  </div>

                  <h2 className="text-[17px] sm:text-[19px] font-semibold tracking-tight text-slate-900 dark:text-white">
                    Device Location Map
                  </h2>
                  <p className="mt-1 text-[11px] sm:text-[12px] text-slate-500 dark:text-white/55">
                    แสดงตำแหน่งอุปกรณ์จากข้อมูล Location และ AppTarget จริง
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex w-full flex-col gap-2.5 lg:flex-row lg:items-center">
                  <div className="relative w-full lg:max-w-sm">
                    <FiSearch className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40 text-[13px]" />
                    <input
                      type="text"
                      placeholder="Search device / MAC / IP / building / location..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className={[
                        "h-9 w-full rounded-2xl pl-9 pr-3.5 text-[12px] outline-none transition-all duration-200",
                        "border border-slate-200 bg-white text-slate-700 focus:border-sky-400",
                        "dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:placeholder:text-white/35 dark:focus:border-cyan-400/50",
                      ].join(" ")}
                    />
                  </div>

                  <MultiTargetSelector
                    values={selectedTargetIds}
                    onChange={setSelectedTargetIds}
                    options={targets}
                    loading={loadingTargets}
                  />
                </div>

                <div className="flex items-center">
                  <div className="text-[11px] text-slate-500 dark:text-white/50">
                    {loading ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-cyan-500 animate-pulse" />
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

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1 xl:max-h-130">
                {loading && (
                  <div className="rounded-[18px] border border-dashed border-slate-300 bg-white px-3.5 py-5 text-center text-[12px] text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-white/50">
                    Loading...
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
                          onClick={() => setSelectedDevice(device)}
                          className="w-full text-left"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-[12px] font-semibold text-slate-800 dark:text-white/85">
                                {device.device_name}
                              </p>
                              <p className="mt-1 truncate text-[10px] text-slate-500 dark:text-white/45">
                                {device.macc || "-"}
                              </p>
                              <p className="mt-1 truncate text-[10px] text-slate-400 dark:text-white/35">
                                {device.location} • {device.building}
                              </p>
                              <p className="mt-1 truncate text-[10px] text-slate-400 dark:text-white/35">
                                IP: {device.ip}
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
                              "dark:text-cyan-300 dark:bg-cyan-500/10 dark:hover:bg-cyan-500/15 dark:active:bg-cyan-500/20",
                            ].join(" ")}
                            title="Edit location"
                          >
                            <FiEdit2 className="text-[13px]" />
                          </button>

                          <button
                            type="button"
                            onClick={() => openDeleteModal(device)}
                            className={[
                              "inline-flex h-8 w-8 items-center justify-center rounded-xl transition-colors",
                              "text-red-600 bg-red-50 hover:bg-red-100 active:bg-red-200",
                              "dark:text-red-300 dark:bg-red-500/10 dark:hover:bg-red-500/15 dark:active:bg-red-500/20",
                            ].join(" ")}
                            title="Delete location"
                          >
                            <FiTrash2 className="text-[13px]" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                {!loading && filteredDevices.length === 0 && (
                  <div
                    className={[
                      "rounded-[18px] border border-dashed px-3.5 py-5 text-center text-[12px]",
                      "border-slate-300 bg-white text-slate-500",
                      "dark:border-white/10 dark:bg-white/5 dark:text-white/50",
                    ].join(" ")}
                  >
                    No matching locations
                  </div>
                )}
              </div>
            </div>

            <div className="relative h-97.5 w-full md:h-125 xl:h-170">
              <Map
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
                    onClick={setSelectedDevice}
                  />
                ))}
              </Map>

              <div className="pointer-events-none absolute left-3 top-3">
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
                <div className="absolute bottom-3 left-3 right-3 md:right-auto md:w-75">
                  <div
                    className={[
                      "overflow-hidden rounded-[18px] backdrop-blur",
                      "border border-white/70 bg-white/92 shadow-xl",
                      "dark:border-white/10 dark:bg-[#0d1524]/92 dark:shadow-none",
                    ].join(" ")}
                  >
                    <div className="border-b border-slate-200 px-3.5 py-2.5 dark:border-white/10">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[12px] font-semibold text-slate-900 dark:text-white/90">
                            {selectedDevice.device_name}
                          </p>
                          <p className="truncate text-[10px] text-slate-500 dark:text-white/45">
                            {selectedDevice.macc || "-"}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedDevice(null)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:text-white/45 dark:hover:bg-white/8 dark:hover:text-white/70"
                            aria-label="Close selected device"
                            title="Close"
                          >
                            <FiX className="text-[14px]" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="p-3.5">
                      <div className="space-y-1.5 text-[10.5px] text-slate-600 dark:text-white/65">
                        <div className="flex items-center gap-2">
                          <FiMapPin className="shrink-0 text-slate-400 text-[12px]" />
                          <span className="truncate">{selectedDevice.location}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <FiHome className="shrink-0 text-slate-400 text-[12px]" />
                          <span className="truncate">
                            Building: {selectedDevice.building}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <FiLayers className="shrink-0 text-slate-400 text-[12px]" />
                          <span>Floor: {selectedDevice.floor}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <FiHash className="shrink-0 text-slate-400 text-[12px]" />
                          <span>IP: {selectedDevice.ip}</span>
                        </div>

                        <p>
                          <span className="font-medium text-slate-700 dark:text-white/80">
                            Last Updated:
                          </span>{" "}
                          {selectedDevice.lastSeen}
                        </p>

                        <p>
                          <span className="font-medium text-slate-700 dark:text-white/80">
                            Lat / Lng:
                          </span>{" "}
                          {selectedDevice.lat}, {selectedDevice.lng}
                        </p>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <a
                          href={getGoogleMapsLink(selectedDevice.lat, selectedDevice.lng)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={[
                            "inline-flex items-center gap-2 rounded-[14px] px-2.5 py-2 text-[10.5px] font-medium transition-all duration-200",
                            "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100",
                          ].join(" ")}
                        >
                          <FiNavigation className="text-[11px]" />
                          Open in Google Maps
                          <FiExternalLink className="text-[10px]" />
                        </a>

                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(selectedDevice)}
                          className={[
                            "inline-flex items-center gap-2 rounded-[14px] px-2.5 py-2 text-[10.5px] font-medium transition-all duration-200",
                            "border border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100",
                          ].join(" ")}
                        >
                          <FiEdit2 className="text-[11px]" />
                          Edit Location
                        </button>

                        <button
                          type="button"
                          onClick={() => openDeleteModal(selectedDevice)}
                          className={[
                            "inline-flex items-center gap-2 rounded-[14px] px-2.5 py-2 text-[10.5px] font-medium transition-all duration-200",
                            "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
                          ].join(" ")}
                        >
                          <FiTrash2 className="text-[11px]" />
                          Delete Location
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {!loading && filteredDevices.length === 0 && !error && (
                <div className="absolute inset-0 grid place-items-center bg-white/70 dark:bg-[#08111f]/70">
                  <div className="rounded-[20px] border border-dashed border-slate-300 bg-white px-5 py-6 text-center shadow-sm dark:border-white/10 dark:bg-white/5">
                    <div className="mx-auto mb-2.5 grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-white/50">
                      <FiMapPin className="text-[18px]" />
                    </div>
                    <h3 className="text-[13px] font-semibold text-slate-800 dark:text-white/85">
                      No location data found
                    </h3>
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-white/50">
                      ไม่พบข้อมูลที่ตรงกับการค้นหา
                    </p>
                  </div>
                </div>
              )}

              {!loading && error && (
                <div className="absolute inset-0 grid place-items-center bg-white/70 dark:bg-[#08111f]/70">
                  <div className="rounded-[20px] border border-red-200 bg-white px-5 py-6 text-center shadow-sm dark:border-red-400/20 dark:bg-[#0d1524]">
                    <div className="mx-auto mb-2.5 grid h-11 w-11 place-items-center rounded-full bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-300">
                      <FiAlertTriangle className="text-[18px]" />
                    </div>
                    <h3 className="text-[13px] font-semibold text-slate-800 dark:text-white/85">
                      Load failed
                    </h3>
                    <p className="mt-1 text-[11px] text-red-600 dark:text-red-300">
                      {error}
                    </p>
                    <button
                      type="button"
                      onClick={fetchLocations}
                      className="mt-3 rounded-[14px] bg-slate-900 px-3.5 py-2 text-[12px] font-medium text-white transition hover:bg-slate-800 dark:bg-cyan-500/15 dark:text-cyan-200 dark:hover:bg-cyan-500/20"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {openCreateModal && (
        <div className="fixed inset-0 z-210 flex items-center justify-center p-4">
          <button
            type="button"
            onClick={closeCreateModal}
            className="absolute inset-0 bg-slate-900/35 backdrop-blur-[2px]"
            aria-label="Close create modal overlay"
          />

          <div
            className={[
              "relative z-10 w-full max-w-190 rounded-[18px] border border-gray-200 bg-white p-4 shadow-[0_20px_70px_rgba(15,23,42,0.18)]",
              "dark:border-white/10 dark:bg-[#0d1524]",
            ].join(" ")}
          >
            <button
              type="button"
              onClick={closeCreateModal}
              disabled={creating}
              className="absolute right-4 top-4 text-gray-400 transition hover:text-gray-600 disabled:cursor-not-allowed dark:text-white/45 dark:hover:text-white/70"
            >
              <FiX className="text-[18px]" />
            </button>

            <div className="mb-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1.5 text-[10.5px] font-semibold text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-500/10 dark:text-cyan-300">
                <FiPlus className="text-[12px]" />
                Create Location
              </div>
              <h3 className="mt-2.5 text-[18px] font-semibold text-slate-900 dark:text-white">
                Add New Location
              </h3>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-white/55">
                กรอกข้อมูล location ใหม่และผูกกับ App Target
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-slate-700 dark:text-white/75">
                  Location
                </label>
                <input
                  value={createForm.location}
                  onChange={(e) => handleCreateChange("location", e.target.value)}
                  className="h-9 w-full rounded-2xl border border-slate-200 bg-white px-3.5 text-[12px] text-slate-700 outline-none focus:border-sky-400 dark:border-white/10 dark:bg-white/5 dark:text-white/80"
                  placeholder="Enter location"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-slate-700 dark:text-white/75">
                  Building
                </label>
                <input
                  value={createForm.building}
                  onChange={(e) => handleCreateChange("building", e.target.value)}
                  className="h-9 w-full rounded-2xl border border-slate-200 bg-white px-3.5 text-[12px] text-slate-700 outline-none focus:border-sky-400 dark:border-white/10 dark:bg-white/5 dark:text-white/80"
                  placeholder="Enter building"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-slate-700 dark:text-white/75">
                  Floor
                </label>
                <input
                  type="number"
                  value={createForm.floor}
                  onChange={(e) => handleCreateChange("floor", e.target.value)}
                  className="h-9 w-full rounded-2xl border border-slate-200 bg-white px-3.5 text-[12px] text-slate-700 outline-none focus:border-sky-400 dark:border-white/10 dark:bg-white/5 dark:text-white/80"
                  placeholder="Enter floor"
                />
              </div>

              <TargetSelector
                label="App Target"
                value={createForm.app_target_id}
                onChange={(value) => handleCreateChange("app_target_id", value)}
                options={targets}
                loading={loadingTargets}
                placeholder="Select App Target"
              />

              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-slate-700 dark:text-white/75">
                  Latitude
                </label>
                <input
                  type="number"
                  step="any"
                  value={createForm.latitude}
                  onChange={(e) => handleCreateChange("latitude", e.target.value)}
                  className="h-9 w-full rounded-2xl border border-slate-200 bg-white px-3.5 text-[12px] text-slate-700 outline-none focus:border-sky-400 dark:border-white/10 dark:bg-white/5 dark:text-white/80"
                  placeholder="Enter latitude"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-slate-700 dark:text-white/75">
                  Longtitude
                </label>
                <input
                  type="number"
                  step="any"
                  value={createForm.longtitude}
                  onChange={(e) =>
                    handleCreateChange("longtitude", e.target.value)
                  }
                  className="h-9 w-full rounded-2xl border border-slate-200 bg-white px-3.5 text-[12px] text-slate-700 outline-none focus:border-sky-400 dark:border-white/10 dark:bg-white/5 dark:text-white/80"
                  placeholder="Enter longtitude"
                />
              </div>
            </div>

            {createError && (
              <div className="mt-3 rounded-[14px] border border-red-200 bg-red-50 px-3.5 py-2.5 text-[11px] text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300">
                {createError}
              </div>
            )}

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={closeCreateModal}
                disabled={creating}
                className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-[12px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white/75"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmCreate}
                disabled={creating}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#6d5efc] px-3.5 py-2 text-[12px] font-medium text-white transition hover:bg-[#5f51eb] disabled:opacity-60"
              >
                <FiSave className="text-[12px]" />
                {creating ? "Creating..." : "Create Location"}
              </button>
            </div>
          </div>
        </div>
      )}

      {openEditModal && editTarget && (
        <div className="fixed inset-0 z-210 flex items-center justify-center p-4">
          <button
            type="button"
            onClick={closeEditModal}
            className="absolute inset-0 bg-slate-900/35 backdrop-blur-[2px]"
            aria-label="Close edit modal overlay"
          />

          <div
            className={[
              "relative z-10 w-full max-w-190 rounded-[18px] border border-gray-200 bg-white p-4 shadow-[0_20px_70px_rgba(15,23,42,0.18)]",
              "dark:border-white/10 dark:bg-[#0d1524]",
            ].join(" ")}
          >
            <button
              type="button"
              onClick={closeEditModal}
              disabled={editing}
              className="absolute right-4 top-4 text-gray-400 transition hover:text-gray-600 disabled:cursor-not-allowed dark:text-white/45 dark:hover:text-white/70"
            >
              <FiX className="text-[18px]" />
            </button>

            <div className="mb-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1.5 text-[10.5px] font-semibold text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-500/10 dark:text-cyan-300">
                <FiEdit2 className="text-[12px]" />
                Update Location
              </div>
              <h3 className="mt-2.5 text-[18px] font-semibold text-slate-900 dark:text-white">
                Edit Location
              </h3>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-white/55">
                แก้ไขข้อมูล location ที่เลือก
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-slate-700 dark:text-white/75">
                  Location
                </label>
                <input
                  value={editForm.location}
                  onChange={(e) => handleEditChange("location", e.target.value)}
                  className="h-9 w-full rounded-2xl border border-slate-200 bg-white px-3.5 text-[12px] text-slate-700 outline-none focus:border-sky-400 dark:border-white/10 dark:bg-white/5 dark:text-white/80"
                  placeholder="Enter location"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-slate-700 dark:text-white/75">
                  Building
                </label>
                <input
                  value={editForm.building}
                  onChange={(e) => handleEditChange("building", e.target.value)}
                  className="h-9 w-full rounded-2xl border border-slate-200 bg-white px-3.5 text-[12px] text-slate-700 outline-none focus:border-sky-400 dark:border-white/10 dark:bg-white/5 dark:text-white/80"
                  placeholder="Enter building"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-slate-700 dark:text-white/75">
                  Floor
                </label>
                <input
                  type="number"
                  value={editForm.floor}
                  onChange={(e) => handleEditChange("floor", e.target.value)}
                  className="h-9 w-full rounded-2xl border border-slate-200 bg-white px-3.5 text-[12px] text-slate-700 outline-none focus:border-sky-400 dark:border-white/10 dark:bg-white/5 dark:text-white/80"
                  placeholder="Enter floor"
                />
              </div>

              <TargetSelector
                label="App Target"
                value={editForm.app_target_id}
                onChange={(value) => handleEditChange("app_target_id", value)}
                options={targets}
                loading={loadingTargets}
                placeholder="Select App Target"
              />

              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-slate-700 dark:text-white/75">
                  Latitude
                </label>
                <input
                  type="number"
                  step="any"
                  value={editForm.latitude}
                  onChange={(e) => handleEditChange("latitude", e.target.value)}
                  className="h-9 w-full rounded-2xl border border-slate-200 bg-white px-3.5 text-[12px] text-slate-700 outline-none focus:border-sky-400 dark:border-white/10 dark:bg-white/5 dark:text-white/80"
                  placeholder="Enter latitude"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-slate-700 dark:text-white/75">
                  Longtitude
                </label>
                <input
                  type="number"
                  step="any"
                  value={editForm.longtitude}
                  onChange={(e) => handleEditChange("longtitude", e.target.value)}
                  className="h-9 w-full rounded-2xl border border-slate-200 bg-white px-3.5 text-[12px] text-slate-700 outline-none focus:border-sky-400 dark:border-white/10 dark:bg-white/5 dark:text-white/80"
                  placeholder="Enter longtitude"
                />
              </div>
            </div>

            {editError && (
              <div className="mt-3 rounded-[14px] border border-red-200 bg-red-50 px-3.5 py-2.5 text-[11px] text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300">
                {editError}
              </div>
            )}

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={closeEditModal}
                disabled={editing}
                className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-[12px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white/75"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmEdit}
                disabled={editing}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#6d5efc] px-3.5 py-2 text-[12px] font-medium text-white transition hover:bg-[#5f51eb] disabled:opacity-60"
              >
                <FiSave className="text-[12px]" />
                {editing ? "Saving..." : "Update Location"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-220 flex items-center justify-center p-4">
          <button
            type="button"
            onClick={closeDeleteModal}
            className="absolute inset-0 bg-slate-900/35 backdrop-blur-[2px]"
            aria-label="Close delete modal overlay"
          />

          <div
            className={[
              "relative z-10 w-full max-w-140 rounded-[18px] border border-gray-200 bg-white px-4 py-4 shadow-[0_20px_70px_rgba(15,23,42,0.18)]",
              "dark:border-white/10 dark:bg-[#0d1524]",
            ].join(" ")}
          >
            <button
              type="button"
              onClick={closeDeleteModal}
              disabled={deleting}
              className="absolute right-4 top-4 text-gray-400 transition hover:text-gray-600 disabled:cursor-not-allowed dark:text-white/45 dark:hover:text-white/70"
              aria-label="Close"
            >
              <FiX className="text-[18px]" />
            </button>

            <div className="flex justify-center pt-1">
              <div className="grid h-11 w-11 place-items-center rounded-full bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-300">
                <FiTrash2 className="text-[22px]" />
              </div>
            </div>

            <h3 className="mt-3 text-center text-[18px] font-semibold text-slate-800 dark:text-white">
              Delete Location
            </h3>

            <p className="mx-auto mt-2.5 max-w-105 text-center text-[12px] leading-5 text-slate-500 dark:text-white/55">
              Are you sure you want to delete location{" "}
              <span className="font-semibold text-slate-700 dark:text-white/80">
                {deleteTarget.location}
              </span>
              ? This action cannot be undone.
            </p>

            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-[11px] text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-white/60">
              <div className="space-y-1.5">
                <p>
                  <span className="font-medium text-slate-700 dark:text-white/80">
                    Device:
                  </span>{" "}
                  {deleteTarget.device_name}
                </p>
                <p>
                  <span className="font-medium text-slate-700 dark:text-white/80">
                    Building:
                  </span>{" "}
                  {deleteTarget.building}
                </p>
                <p>
                  <span className="font-medium text-slate-700 dark:text-white/80">
                    Floor:
                  </span>{" "}
                  {deleteTarget.floor}
                </p>
                <p>
                  <span className="font-medium text-slate-700 dark:text-white/80">
                    IP:
                  </span>{" "}
                  {deleteTarget.ip}
                </p>
              </div>
            </div>

            {deleteError && (
              <div className="mt-3 rounded-[14px] border border-red-200 bg-red-50 px-3.5 py-2.5 text-center text-[11px] text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300">
                {deleteError}
              </div>
            )}

            <div className="mt-5 flex items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className={[
                  "min-w-27.5 rounded-[10px] px-3.5 py-2 text-[12px] font-medium transition",
                  "bg-[#f8dedd] text-[#ff5a3c] hover:bg-[#f4d2d1]",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                ].join(" ")}
              >
                {deleting ? "Deleting..." : "Yes, Delete!"}
              </button>

              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={deleting}
                className={[
                  "min-w-27.5 rounded-[10px] px-3.5 py-2 text-[12px] font-medium transition",
                  "bg-[#6d5efc] text-white hover:bg-[#5f51eb]",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                ].join(" ")}
              >
                No, Keep It.
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MapDevice;