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
  ListTaskIDForOwn,
  type LocationResponse,
  type CreateLocationInput,
  type UpdateLocationInput,
  type OwnTargetItem,
} from "../../../services";

type DeviceStatus = "online" | "offline" | "warning";

type Device = {
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
  target_id: string;
};

type LocationFormState = {
  location: string;
  building: string;
  floor: string;
  latitude: string;
  longtitude: string;
  target_id: string;
};

const MAP_STYLE =
  "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";

const emptyForm: LocationFormState = {
  location: "",
  building: "",
  floor: "",
  latitude: "",
  longtitude: "",
  target_id: "",
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
  const targetName = (item.target_info?.hostname || "").toLowerCase();
  const ip = (item.target_info?.ip || "").trim();

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
  options: OwnTargetItem[];
  loading?: boolean;
  placeholder?: string;
};

const TargetSelector: React.FC<TargetSelectorProps> = ({
  label,
  value,
  onChange,
  options,
  loading = false,
  placeholder = "Select Target",
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
    return options.find((t) => String(t.task_id) === value) || null;
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
                ? `${selectedTarget.hostname}${
                    selectedTarget.ip ? ` (${selectedTarget.ip})` : ""
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
                No target found
              </div>
            )}

            {options.map((target) => {
              const active = String(target.task_id) === value;
              return (
                <button
                  key={`${target.own_id}-${target.task_id}`}
                  type="button"
                  onClick={() => {
                    onChange(String(target.task_id));
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
                    <span className="truncate">{target.hostname || "-"}</span>
                    <span className="mt-0.5 text-[10px] text-slate-400 dark:text-white/40">
                      {target.ip || "-"} • {target.task_id}
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
  options: OwnTargetItem[];
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
    return options.filter((t) => values.includes(String(t.task_id)));
  }, [options, values]);

  const toggleValue = (taskID: string) => {
    if (values.includes(taskID)) {
      onChange(values.filter((v) => v !== taskID));
    } else {
      onChange([...values, taskID]);
    }
  };

  const clearAll = () => onChange([]);
  const selectAll = () => onChange(options.map((t) => String(t.task_id)));

  const label = useMemo(() => {
    if (loading) return "Loading targets...";
    if (selectedTargets.length === 0) return "Filter by Targets";
    if (selectedTargets.length === 1) {
      const target = selectedTargets[0];
      return `${target.hostname}${target.ip ? ` (${target.ip})` : ""}`;
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
                No target found
              </div>
            )}

            {options.map((target) => {
              const checked = values.includes(String(target.task_id));

              return (
                <button
                  key={`${target.own_id}-${target.task_id}`}
                  type="button"
                  onClick={() => toggleValue(String(target.task_id))}
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
                      {target.hostname || "-"}
                    </span>
                    <span className="mt-0.5 block truncate text-[10px] text-slate-400 dark:text-white/40">
                      {target.ip || "-"} • {target.task_id}
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

const MapPopupCard: React.FC<{
  device: Device;
  onClose: () => void;
}> = ({ device, onClose }) => {
  return (
    <div className="absolute bottom-3 left-3 right-3 z-120 md:right-auto md:w-85">
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
              <p className="truncate text-[13px] font-semibold text-slate-900 dark:text-white/90">
                {device.device_name}
              </p>
              <p className="mt-1 text-[10px] text-slate-500 dark:text-white/45">
                Last seen: {device.lastSeen}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium text-white"
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
                <FiX className="text-[13px]" />
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-2 p-3">
          <div className="rounded-[14px] border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center gap-2 text-[11px] font-medium text-slate-700 dark:text-white/75">
              <FiHash />
              Task ID
            </div>
            <p className="mt-1.5 break-all text-[12px] text-slate-600 dark:text-white/65">
              {device.target_id}
            </p>
          </div>

          <div className="rounded-[14px] border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center gap-2 text-[11px] font-medium text-slate-700 dark:text-white/75">
              <FiNavigation />
              IP Address
            </div>
            <p className="mt-1.5 text-[12px] text-slate-600 dark:text-white/65">
              {device.ip}
            </p>
          </div>

          <div className="rounded-[14px] border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center gap-2 text-[11px] font-medium text-slate-700 dark:text-white/75">
              <FiMapPin />
              Location
            </div>
            <p className="mt-1.5 text-[12px] text-slate-600 dark:text-white/65">
              {device.location}
            </p>
          </div>

          <div className="rounded-[14px] border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center gap-2 text-[11px] font-medium text-slate-700 dark:text-white/75">
              <FiHome />
              Building / Floor
            </div>
            <p className="mt-1.5 text-[12px] text-slate-600 dark:text-white/65">
              {device.building} / Floor {device.floor}
            </p>
          </div>

          <a
            href={getGoogleMapsLink(device.lat, device.lng)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-2xl bg-[#6d5efc] px-4 text-[12px] font-medium text-white transition hover:bg-[#5f51eb]"
          >
            <FiExternalLink className="text-[13px]" />
            Open in Google Maps
          </a>
        </div>
      </div>
    </div>
  );
};

const MapDevice: React.FC = () => {
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Device[]>([]);
  const [targets, setTargets] = useState<OwnTargetItem[]>([]);
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

      const mapped: Device[] = data
        .filter(
          (item) =>
            typeof item.latitude === "number" &&
            typeof item.longtitude === "number"
        )
        .map((item) => ({
          id: item.id,
          device_name:
            item.target_info?.hostname ||
            item.target_id ||
            `Location #${item.id}`,
          lat: item.latitude,
          lng: item.longtitude,
          ip: item.target_info?.ip || "-",
          location: item.location || "-",
          building: item.building || "-",
          floor: Number(item.floor ?? 0),
          status: deriveStatus(item),
          lastSeen: formatUpdatedAt(item.updated_at),
          target_id: String(item.target_id ?? ""),
        }));

      setRows(mapped);
      setSelectedDevice((prev) => {
        if (prev) {
          const found = mapped.find((d) => d.id === prev.id);
          return found ?? null;
        }
        return null;
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
      const data = await ListTaskIDForOwn();
      setTargets(Array.isArray(data) ? data : []);
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
        selectedTargetIds.includes(String(device.target_id));

      const blob = [
        device.device_name,
        device.ip,
        device.location,
        device.building,
        String(device.floor),
        device.target_id,
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
      setSelectedDevice(null);
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
        target_id: createForm.target_id.trim(),
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
      if (!payload.target_id) {
        setCreateError("กรุณาเลือก Target");
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
      target_id: String(device.target_id || ""),
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
        target_id: editForm.target_id.trim(),
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
      if (!payload.target_id) {
        setEditError("กรุณาเลือก Target");
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
                      <span className="text-[11px] font-medium">
                        Create Location
                      </span>
                    </button>
                  </div>

                  <h2 className="text-[17px] sm:text-[19px] font-semibold tracking-tight text-slate-900 dark:text-white">
                    Device Location Map
                  </h2>
                  <p className="mt-1 text-[11px] sm:text-[12px] text-slate-500 dark:text-white/55">
                    แสดงตำแหน่งอุปกรณ์จากข้อมูล Location และ Target จริง
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex w-full flex-col gap-2.5 lg:flex-row lg:items-center">
                  <div className="relative w-full lg:max-w-sm">
                    <FiSearch className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40 text-[13px]" />
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
                          onClick={() => setSelectedDevice(device)}
                          className="w-full text-left"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-[12px] font-semibold text-slate-800 dark:text-white/85">
                                {device.device_name}
                              </p>
                              <p className="mt-1 truncate text-[10px] text-slate-500 dark:text-white/45">
                                Task ID: {device.target_id}
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

      {openCreateModal && (
        <div className="fixed inset-0 z-300 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl dark:bg-[#0B1220]">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[16px] font-semibold text-slate-900 dark:text-white">
                  Create Location
                </h3>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-white/50">
                  เพิ่ม location ใหม่และผูกกับ target
                </p>
              </div>

              <button
                type="button"
                onClick={closeCreateModal}
                disabled={creating}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-slate-200 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/10"
              >
                <FiX />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-[12px] font-medium text-slate-700 dark:text-white/75">
                  Location
                </label>
                <input
                  type="text"
                  value={createForm.location}
                  onChange={(e) => handleCreateChange("location", e.target.value)}
                  className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3.5 text-[12px] text-slate-700 outline-none focus:border-sky-400 dark:border-white/10 dark:bg-white/5 dark:text-white/80"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-[12px] font-medium text-slate-700 dark:text-white/75">
                  Building
                </label>
                <input
                  type="text"
                  value={createForm.building}
                  onChange={(e) => handleCreateChange("building", e.target.value)}
                  className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3.5 text-[12px] text-slate-700 outline-none focus:border-sky-400 dark:border-white/10 dark:bg-white/5 dark:text-white/80"
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
                  className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3.5 text-[12px] text-slate-700 outline-none focus:border-sky-400 dark:border-white/10 dark:bg-white/5 dark:text-white/80"
                />
              </div>

              <div>
                <TargetSelector
                  label="Target"
                  value={createForm.target_id}
                  onChange={(value) => handleCreateChange("target_id", value)}
                  options={targets}
                  loading={loadingTargets}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-slate-700 dark:text-white/75">
                  Latitude
                </label>
                <input
                  type="number"
                  step="any"
                  value={createForm.latitude}
                  onChange={(e) => handleCreateChange("latitude", e.target.value)}
                  className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3.5 text-[12px] text-slate-700 outline-none focus:border-sky-400 dark:border-white/10 dark:bg-white/5 dark:text-white/80"
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
                  className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3.5 text-[12px] text-slate-700 outline-none focus:border-sky-400 dark:border-white/10 dark:bg-white/5 dark:text-white/80"
                />
              </div>
            </div>

            {createError && (
              <div className="mt-3 rounded-[14px] border border-red-200 bg-red-50 px-3.5 py-2.5 text-center text-[11px] text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300">
                {createError}
              </div>
            )}

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={closeCreateModal}
                disabled={creating}
                className="rounded-xl bg-slate-100 px-4 py-2 text-[12px] font-medium text-slate-600 transition hover:bg-slate-200 disabled:opacity-60 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmCreate}
                disabled={creating}
                className="inline-flex items-center gap-2 rounded-xl bg-[#6d5efc] px-4 py-2 text-[12px] font-medium text-white transition hover:bg-[#5f51eb] disabled:opacity-60"
              >
                <FiSave className="text-[12px]" />
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {openEditModal && editTarget && (
        <div className="fixed inset-0 z-300 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl dark:bg-[#0B1220]">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[16px] font-semibold text-slate-900 dark:text-white">
                  Edit Location
                </h3>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-white/50">
                  แก้ไขข้อมูล location และ target
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditModal}
                disabled={editing}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-slate-200 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/10"
              >
                <FiX />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-[12px] font-medium text-slate-700 dark:text-white/75">
                  Location
                </label>
                <input
                  type="text"
                  value={editForm.location}
                  onChange={(e) => handleEditChange("location", e.target.value)}
                  className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3.5 text-[12px] text-slate-700 outline-none focus:border-sky-400 dark:border-white/10 dark:bg-white/5 dark:text-white/80"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-[12px] font-medium text-slate-700 dark:text-white/75">
                  Building
                </label>
                <input
                  type="text"
                  value={editForm.building}
                  onChange={(e) => handleEditChange("building", e.target.value)}
                  className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3.5 text-[12px] text-slate-700 outline-none focus:border-sky-400 dark:border-white/10 dark:bg-white/5 dark:text-white/80"
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
                  className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3.5 text-[12px] text-slate-700 outline-none focus:border-sky-400 dark:border-white/10 dark:bg-white/5 dark:text-white/80"
                />
              </div>

              <div>
                <TargetSelector
                  label="Target"
                  value={editForm.target_id}
                  onChange={(value) => handleEditChange("target_id", value)}
                  options={targets}
                  loading={loadingTargets}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-slate-700 dark:text-white/75">
                  Latitude
                </label>
                <input
                  type="number"
                  step="any"
                  value={editForm.latitude}
                  onChange={(e) => handleEditChange("latitude", e.target.value)}
                  className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3.5 text-[12px] text-slate-700 outline-none focus:border-sky-400 dark:border-white/10 dark:bg-white/5 dark:text-white/80"
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
                  className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3.5 text-[12px] text-slate-700 outline-none focus:border-sky-400 dark:border-white/10 dark:bg-white/5 dark:text-white/80"
                />
              </div>
            </div>

            {editError && (
              <div className="mt-3 rounded-[14px] border border-red-200 bg-red-50 px-3.5 py-2.5 text-center text-[11px] text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300">
                {editError}
              </div>
            )}

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={closeEditModal}
                disabled={editing}
                className="rounded-xl bg-slate-100 px-4 py-2 text-[12px] font-medium text-slate-600 transition hover:bg-slate-200 disabled:opacity-60 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmEdit}
                disabled={editing}
                className="inline-flex items-center gap-2 rounded-xl bg-[#6d5efc] px-4 py-2 text-[12px] font-medium text-white transition hover:bg-[#5f51eb] disabled:opacity-60"
              >
                <FiSave className="text-[12px]" />
                {editing ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-300 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl dark:bg-[#0B1220]">
            <div className="mx-auto flex h-13 w-13 items-center justify-center rounded-full bg-[#f8dedd] text-[#ff5a3c]">
              <FiAlertTriangle className="text-[22px]" />
            </div>

            <div className="mt-4 text-center">
              <h3 className="text-[17px] font-semibold text-slate-900 dark:text-white">
                Delete Location?
              </h3>
              <p className="mt-2 text-[12px] leading-5 text-slate-500 dark:text-white/50">
                คุณกำลังจะลบ location นี้ออกจากระบบ
              </p>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-left text-[11px] text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-white/55">
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