import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { message } from "antd";
import {
  FiSearch,
  FiBell,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiX,
  FiSend,
  FiUsers,
  FiRefreshCw,
  FiLink2,
  FiChevronLeft,
  FiChevronRight,
  FiType,
  FiHash,
  FiSave,
  FiMessageSquare,
} from "react-icons/fi";
import {
  ListAppNotification,
  CreateAppNotification,
  UpdateAppNotificationByID,
  DeleteAppNotificationByID,
  ListAppLineMaster,
  TestLineNotifyByAppNotificationID,
  type AppNotificationResponse,
  type AppLineMasterResponse,
} from "../../../services";
import { useLanguage } from "../../../contexts/LanguageContext";
import { useStateContext } from "../../../contexts/ProviderContext";
import { CustomSelect } from "../../../component/ui/CustomSelect";

type UiNotification = {
  id: number;
  name: string;
  send_id: string;
  alert: boolean;
  is_group: boolean;
  app_line_master_id: number;
  app_user_id: number;
};

type NotificationFormData = {
  name: string;
  send_id: string;
  alert: boolean;
  is_group: boolean;
  app_line_master_id: string;
};

type TestLineFormData = {
  message: string;
};

const PAGE_SIZE = 3;

let notificationListCache: UiNotification[] | null = null;
let lineMasterListCache: AppLineMasterResponse[] | null = null;
let initialNotifyPageLoadPromise: Promise<void> | null = null;

const normalizeText = (value?: string | null) => (value || "").trim();

const alertBadgeClass = (alert: boolean) => {
  if (alert) {
    return "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200";
  }
  return "border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200";
};

const typeBadgeClass = (isGroup: boolean) => {
  if (isGroup) {
    return "border border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-500/10 dark:text-cyan-200";
  }
  return "border border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/20 dark:bg-violet-500/10 dark:text-violet-200";
};

const cardGlowClass = [
  "h-full p-4 sm:p-5",
  "rounded-xl border border-slate-200/70 bg-white",
  "dark:border-white/8 dark:bg-[#0d0b1a]/80",
  "flex flex-col",
].join(" ");

const modalBackdropClass =
  "fixed inset-0 z-9999 flex items-center justify-center bg-black/55 p-4";

const modalCardClass =
  "relative w-full overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-xl dark:border-white/10 dark:bg-[#0d0b1a]";

const formLabelClass =
  "mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-white/40";

const formInputClass = [
  "h-9 w-full rounded-xl border px-3.5 text-[12px] outline-none transition",
  "border-slate-200/80 bg-white text-slate-800 placeholder:text-slate-400",
  "focus:ring-2 focus:ring-cyan-200 focus:border-cyan-400",
  "dark:border-white/10 dark:bg-white/5 dark:text-white/85 dark:placeholder:text-white/35",
  "dark:focus:ring-white/10 dark:focus:border-cyan-400/30",
  "disabled:cursor-not-allowed disabled:opacity-60",
].join(" ");

const formTextareaClass = [
  "w-full min-h-18 rounded-xl border px-3.5 py-2.5 text-[12px] outline-none transition resize-none",
  "border-slate-200/80 bg-white text-slate-800 placeholder:text-slate-400",
  "focus:ring-2 focus:ring-cyan-200 focus:border-cyan-400",
  "dark:border-white/10 dark:bg-white/5 dark:text-white/85 dark:placeholder:text-white/35",
  "dark:focus:ring-white/10 dark:focus:border-cyan-400/30",
].join(" ");

const editGradientIconBtn = [
  "inline-flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200",
  "border border-blue-200 bg-blue-50 text-blue-700",
  "hover:bg-blue-100 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/15",
].join(" ");

const deleteGradientIconBtn = [
  "inline-flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200",
  "border border-red-200 bg-red-50 text-red-700",
  "hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/15",
].join(" ");


const notifyPrimaryGradientBtn = [
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3.5",
  "text-[11px] font-medium text-white transition hover:opacity-90",
  "disabled:cursor-not-allowed disabled:opacity-60",
].join(" ");

const ActionButton: React.FC<{
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
}> = ({ onClick, children, className = "", type = "button", disabled = false }) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={[
        "inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-[12px] font-medium transition",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
};

const ALERT_OPTIONS = [
  { value: "on", label: "Alert On" },
  { value: "off", label: "Alert Off" },
];

const ALERT_FILTER_OPTIONS = [
  { value: "all", label: "All Alert" },
  { value: "on", label: "Alert On" },
  { value: "off", label: "Alert Off" },
];

const RECEIVER_TYPE_FILTER_OPTIONS = [
  { value: "all", label: "All Type" },
  { value: "group", label: "Group" },
  { value: "personal", label: "Personal" },
];

const RECEIVER_TYPE_OPTIONS = [
  { value: "group", label: "Group" },
  { value: "personal", label: "Personal" },
];

const index: React.FC = () => {
  const { t } = useLanguage();
  const { currentColor } = useStateContext();
  const accentGrad = `linear-gradient(135deg, ${currentColor}, color-mix(in srgb, ${currentColor} 65%, #a855f7))`;
  const [search, setSearch] = useState("");
  const [alertFilter, setAlertFilter] = useState("all");
  const [receiverTypeFilter, setReceiverTypeFilter] = useState("all");

  const [rows, setRows] = useState<UiNotification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  const [lineMasters, setLineMasters] = useState<AppLineMasterResponse[]>([]);
  const [loadingLineMasters, setLoadingLineMasters] = useState<boolean>(true);

  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const [openEditModal, setOpenEditModal] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState("");
  const [selectedRow, setSelectedRow] = useState<UiNotification | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<UiNotification | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [openTestModal, setOpenTestModal] = useState(false);
  const [testTarget, setTestTarget] = useState<UiNotification | null>(null);
  const [testingLine, setTestingLine] = useState(false);
  const [testLineError, setTestLineError] = useState("");
  const [testLineSuccess, setTestLineSuccess] = useState("");
  const [testLineForm, setTestLineForm] = useState<TestLineFormData>({
    message: "",
  });

  const [createForm, setCreateForm] = useState<NotificationFormData>({
    name: "",
    send_id: "",
    alert: true,
    is_group: true,
    app_line_master_id: "",
  });

  const [editForm, setEditForm] = useState<NotificationFormData>({
    name: "",
    send_id: "",
    alert: true,
    is_group: true,
    app_line_master_id: "",
  });

  const [notifyPage, setNotifyPage] = useState(1);


  const editFormSnapshot = useMemo(
    () =>
      JSON.stringify({
        name: normalizeText(editForm.name),
        send_id: normalizeText(editForm.send_id),
        alert: editForm.alert,
        is_group: editForm.is_group,
        app_line_master_id: String(editForm.app_line_master_id || ""),
      }),
    [editForm],
  );

  const selectedRowSnapshot = useMemo(
    () =>
      selectedRow
        ? JSON.stringify({
            name: normalizeText(selectedRow.name),
            send_id: normalizeText(selectedRow.send_id),
            alert: Boolean(selectedRow.alert),
            is_group: Boolean(selectedRow.is_group),
            app_line_master_id: String(selectedRow.app_line_master_id || ""),
          })
        : "",
    [selectedRow],
  );

  const isNotifyEditChanged = Boolean(selectedRow) && editFormSnapshot !== selectedRowSnapshot;

  const lineMasterMap = useMemo(() => {
    return new Map<number, string>(
      lineMasters.map((item) => [item.id, item.name ?? `Line Master #${item.id}`]),
    );
  }, [lineMasters]);

  const lineMasterSelectOptions = useMemo(
    () => lineMasters.map((item) => ({ value: String(item.id), label: item.name })),
    [lineMasters],
  );

  const fetchNotifications = useCallback(async (force = false) => {
    try {
      setLoading(true);
      setError("");

      if (!force && notificationListCache) {
        setRows(notificationListCache);
        return notificationListCache;
      }

      const data = await ListAppNotification();

      if (!data) {
        notificationListCache = [];
        setRows([]);
        setError("Unable to load app notifications.");
        return [];
      }

      const mapped: UiNotification[] = (data as AppNotificationResponse[]).map((item) => ({
        id: item.id,
        name: item.name ?? "",
        send_id: item.send_id ?? "",
        alert: Boolean(item.alert),
        is_group: Boolean(item.is_group),
        app_line_master_id: Number(item.app_line_master_id ?? 0),
        app_user_id: Number(item.app_user_id ?? 0),
      }));

      notificationListCache = mapped;
      setRows(mapped);
      return mapped;
    } catch (err) {
      console.error("fetchNotifications error:", err);
      notificationListCache = null;
      setRows([]);
      setError("Something went wrong while loading app notifications.");
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLineMasters = useCallback(async (force = false) => {
    try {
      setLoadingLineMasters(true);

      if (!force && lineMasterListCache) {
        setLineMasters(lineMasterListCache);
        return lineMasterListCache;
      }

      const data = await ListAppLineMaster();

      if (!data) {
        lineMasterListCache = [];
        setLineMasters([]);
        return [];
      }

      lineMasterListCache = data;
      setLineMasters(data);
      return data;
    } catch (err) {
      console.error("fetchLineMasters error:", err);
      lineMasterListCache = null;
      setLineMasters([]);
      return [];
    } finally {
      setLoadingLineMasters(false);
    }
  }, []);

  const loadInitialData = useCallback(async () => {
    if (notificationListCache && lineMasterListCache) {
      setRows(notificationListCache);
      setLineMasters(lineMasterListCache);
      setLoading(false);
      setLoadingLineMasters(false);
      setError("");
      return;
    }

    if (!initialNotifyPageLoadPromise) {
      initialNotifyPageLoadPromise = Promise.all([
        fetchNotifications(),
        fetchLineMasters(),
      ]).then(() => undefined).finally(() => {
        initialNotifyPageLoadPromise = null;
      });
    }

    await initialNotifyPageLoadPromise;
  }, [fetchLineMasters, fetchNotifications]);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  const notifications = useMemo(() => {
    const q = search.trim().toLowerCase();

    const filtered = rows.filter((item) => {
      const lineMasterName =
        lineMasterMap.get(item.app_line_master_id) ||
        `Line Master #${item.app_line_master_id}`;

      const typeText = item.is_group ? "group" : "personal";

      const blob = [
        item.name,
        item.send_id,
        item.alert ? "on" : "off",
        item.alert ? "true" : "false",
        item.is_group ? "group" : "personal",
        item.is_group ? "true" : "false",
        lineMasterName,
        typeText,
        String(item.app_user_id || ""),
      ]
        .join(" ")
        .toLowerCase();

      const matchSearch = blob.includes(q);

      const matchAlert =
        alertFilter === "all" ? true : item.alert === (alertFilter === "on");

      const matchReceiverType =
        receiverTypeFilter === "all" ? true : typeText === receiverTypeFilter;

      return matchSearch && matchAlert && matchReceiverType;
    });

    return [...filtered].sort((a, b) => b.id - a.id);
  }, [rows, search, alertFilter, receiverTypeFilter, lineMasterMap]);

  useEffect(() => {
    setNotifyPage(1);
  }, [search, alertFilter, receiverTypeFilter, rows.length]);

  const totalNotifyPages = Math.max(1, Math.ceil(notifications.length / PAGE_SIZE));

  const pagedNotifications = useMemo(() => {
    const safePage = Math.min(notifyPage, totalNotifyPages);
    const start = (safePage - 1) * PAGE_SIZE;
    return notifications.slice(start, start + PAGE_SIZE);
  }, [notifications, notifyPage, totalNotifyPages]);

  const resetCreateForm = () => {
    setCreateForm({
      name: "",
      send_id: "",
      alert: true,
      is_group: true,
      app_line_master_id: lineMasters.length > 0 ? String(lineMasters[0].id) : "",
    });
    setCreateError("");
  };

  const resetEditForm = () => {
    setEditForm({
      name: "",
      send_id: "",
      alert: true,
      is_group: true,
      app_line_master_id: "",
    });
    setEditError("");
  };

  const resetTestLineForm = () => {
    setTestLineForm({
      message: "",
    });
    setTestLineError("");
    setTestLineSuccess("");
  };

  const openCreate = () => {
    setCreateForm({
      name: "",
      send_id: "",
      alert: true,
      is_group: true,
      app_line_master_id: lineMasters.length > 0 ? String(lineMasters[0].id) : "",
    });
    setCreateError("");
    setOpenCreateModal(true);
  };

  const closeCreate = () => {
    if (creating) return;
    setOpenCreateModal(false);
    resetCreateForm();
  };

  const openEdit = (row: UiNotification) => {
    setSelectedRow(row);
    setEditForm({
      name: row.name,
      send_id: row.send_id,
      alert: row.alert,
      is_group: row.is_group,
      app_line_master_id: String(row.app_line_master_id),
    });
    setEditError("");
    setOpenEditModal(true);
  };

  const closeEdit = () => {
    if (editing) return;
    setOpenEditModal(false);
    setSelectedRow(null);
    resetEditForm();
  };

  const openDeleteModal = (row: UiNotification) => {
    setDeleteTarget(row);
    setDeleteError("");
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setDeleteTarget(null);
    setDeleteError("");
  };

  const openTestLineModal = (row: UiNotification) => {
    setTestTarget(row);
    setTestLineForm({
      message: "",
    });
    setTestLineError("");
    setTestLineSuccess("");
    setOpenTestModal(true);
  };

  const closeTestLineModal = () => {
    if (testingLine) return;
    setOpenTestModal(false);
    setTestTarget(null);
    resetTestLineForm();
  };

  const validateForm = (form: NotificationFormData) => {
    if (!form.name.trim()) return "Please enter Name.";
    if (!form.send_id.trim()) return "Please enter Send ID.";
    if (!form.app_line_master_id.trim()) return "Please select App Line Master.";

    const lineMasterID = Number(form.app_line_master_id);
    if (Number.isNaN(lineMasterID) || lineMasterID <= 0) {
      return "App Line Master is invalid.";
    }

    return "";
  };

  const validateTestLineForm = (form: TestLineFormData) => {
    if (!form.message.trim()) return "Please enter a test message.";
    if (form.message.trim().length < 2) return "Message must be at least 2 characters.";
    return "";
  };

  const submitCreate = async () => {
    const validationError = validateForm(createForm);
    if (validationError) {
      setCreateError(validationError);
      return;
    }

    try {
      setCreating(true);
      setCreateError("");

      const payload = {
        name: createForm.name.trim(),
        send_id: createForm.send_id.trim(),
        alert: createForm.alert,
        is_group: createForm.is_group,
        app_line_master_id: Number(createForm.app_line_master_id),
      };

      const res = await CreateAppNotification(payload);

      if (!res) {
        setCreateError("Failed to create app notification.");
        return;
      }

      setOpenCreateModal(false);
      resetCreateForm();
      await fetchNotifications(true);
      message.success("create success");
    } catch (err: any) {
      setCreateError(
        err?.response?.data?.error ||
          err?.message ||
          "Something went wrong while creating app notification.",
      );
    } finally {
      setCreating(false);
    }
  };

  const submitEdit = async () => {
    if (!selectedRow) return;

    const validationError = validateForm(editForm);
    if (validationError) {
      setEditError(validationError);
      return;
    }

    try {
      setEditing(true);
      setEditError("");

      const payload = {
        name: editForm.name.trim(),
        send_id: editForm.send_id.trim(),
        alert: editForm.alert,
        is_group: editForm.is_group,
        app_line_master_id: Number(editForm.app_line_master_id),
      };

      const res = await UpdateAppNotificationByID(selectedRow.id, payload);

      if (!res) {
        setEditError("Failed to update app notification.");
        return;
      }

      setOpenEditModal(false);
      setSelectedRow(null);
      resetEditForm();
      await fetchNotifications(true);
      message.success("update success");
    } catch (err: any) {
      setEditError(
        err?.response?.data?.error ||
          err?.message ||
          "Something went wrong while updating app notification.",
      );
    } finally {
      setEditing(false);
    }
  };

  const submitTestLine = async () => {
    if (!testTarget) return;

    const validationError = validateTestLineForm(testLineForm);
    if (validationError) {
      setTestLineError(validationError);
      return;
    }

    try {
      setTestingLine(true);
      setTestLineError("");
      setTestLineSuccess("");

      const res = await TestLineNotifyByAppNotificationID({
        app_notification_id: testTarget.id,
        message: testLineForm.message.trim(),
      });

      if (!res) {
        setTestLineError("Failed to send test LINE notification.");
        return;
      }

      if (!res.success) {
        setTestLineError(res.message || "Failed to send test LINE notification.");
        return;
      }

      setTestLineSuccess(res.message || "Test message sent successfully.");
      setTestLineForm((prev) => ({
        ...prev,
        message: "",
      }));
    } catch (err: any) {
      setTestLineError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Something went wrong while sending test LINE notification.",
      );
    } finally {
      setTestingLine(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      setDeleting(true);
      setDeleteError("");

      const res = await DeleteAppNotificationByID(deleteTarget.id);

      if (!res) {
        setDeleteError("Failed to delete app notification.");
        return;
      }

      setDeleteTarget(null);
      await fetchNotifications(true);
      message.success("delete success");
    } catch (err: any) {
      setDeleteError(
        err?.response?.data?.error ||
          err?.message ||
          "Something went wrong while deleting app notification.",
      );
    } finally {
      setDeleting(false);
    }
  };

  const renderNotificationTable = () => {
    if (loading) {
      return (
        <div className="overflow-hidden rounded-xl border border-slate-200/70 bg-white dark:border-white/8 dark:bg-[#0d0b1a]/80">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 dark:border-white/8">
                {["Name", "Send ID", "App", "Alert", "Type", "Actions"].map((h) => (
                  <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/35">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3].map((i) => (
                <tr key={i} className="border-b border-slate-100 dark:border-white/6">
                  {[180, 140, 120, 60, 70, 90].map((w, j) => (
                    <td key={j} className="px-4 py-4">
                      <div className="h-4 animate-pulse rounded-lg bg-slate-100 dark:bg-white/8" style={{ width: w }} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (error) {
      return (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200">
          {error}
        </div>
      );
    }

    if (notifications.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-slate-200/70 bg-white py-14 dark:border-white/8 dark:bg-white/4">
          <div className="grid h-13 w-13 place-items-center rounded-xl border border-slate-200/70 bg-slate-50 text-slate-400 dark:border-white/8 dark:bg-white/5 dark:text-white/25">
            <FiBell className="text-[20px]" />
          </div>
          <p className="text-[13px] font-semibold text-slate-600 dark:text-white/55">No notification destinations</p>
          <p className="text-[11px] text-slate-400 dark:text-white/30">Add a new receiver using the button above</p>
          <button
            type="button"
            onClick={openCreate}
            className={notifyPrimaryGradientBtn}
            style={{ background: accentGrad }}
          >
            <FiPlus className="text-[12px]" />
            Add Notify
          </button>
        </div>
      );
    }

    return (
      <div className="overflow-hidden rounded-xl border border-slate-200/70 bg-white dark:border-white/8 dark:bg-[#0d0b1a]/80">
        <div className="overflow-x-auto">
          <table className="w-full min-w-200">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 dark:border-white/8 dark:bg-white/3">
                <th className="whitespace-nowrap px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/35">Name</th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/35">Send ID</th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/35">App</th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/35">Alert</th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/35">Type</th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/35">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedNotifications.map((item) => {
                const lineMasterName =
                  lineMasterMap.get(item.app_line_master_id) ||
                  `Line Master #${item.app_line_master_id}`;

                return (
                  <tr key={item.id} className="border-b border-slate-100/70 transition hover:bg-slate-50/60 last:border-0 dark:border-white/6 dark:hover:bg-white/3">
                    <td className="px-4 py-3.5 align-middle">
                      <p className="text-[12px] font-semibold text-slate-800 dark:text-white/85">{item.name}</p>
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      <p className="font-mono text-[11px] text-slate-500 dark:text-white/55">{item.send_id}</p>
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      <span className="text-[11.5px] text-slate-700 dark:text-white/70">{lineMasterName}</span>
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      <span className={["inline-flex items-center rounded-full px-2.5 py-1 text-[10.5px] font-semibold", alertBadgeClass(item.alert)].join(" ")}>
                        {item.alert ? "On" : "Off"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      <span className={["inline-flex items-center rounded-full px-2.5 py-1 text-[10.5px] font-semibold", typeBadgeClass(item.is_group)].join(" ")}>
                        {item.is_group ? "Group" : "Personal"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openTestLineModal(item)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-200 text-cyan-600 transition hover:bg-cyan-50 dark:border-cyan-400/20 dark:text-cyan-300 dark:hover:bg-cyan-500/10"
                          title="Test"
                        >
                          <FiSend className="text-[13px]" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          className={editGradientIconBtn}
                          title="Edit"
                        >
                          <FiEdit2 className="text-[13px]" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openDeleteModal(item)}
                          className={deleteGradientIconBtn}
                          title="Delete"
                        >
                          <FiTrash2 className="text-[13px]" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-2.5 dark:border-white/8">
          <p className="text-[10.5px] text-slate-400 dark:text-white/30">
            {notifications.length === 0
              ? "0 destinations"
              : `${(notifyPage - 1) * PAGE_SIZE + 1}–${Math.min(notifyPage * PAGE_SIZE, notifications.length)} of ${notifications.length}`}
          </p>
          {totalNotifyPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setNotifyPage((prev) => Math.max(1, prev - 1))}
                disabled={notifyPage <= 1}
                className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200/70 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35 dark:border-white/8 dark:text-white/50 dark:hover:bg-white/5"
              >
                <FiChevronLeft className="text-[12px]" />
              </button>
              {Array.from({ length: totalNotifyPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setNotifyPage(p)}
                  className={[
                    "grid h-7 min-w-7 place-items-center rounded-lg px-1.5 text-[11px] font-semibold transition",
                    notifyPage === p
                      ? "bg-slate-800 text-white dark:bg-white dark:text-slate-900"
                      : "border border-slate-200/70 text-slate-500 hover:bg-slate-50 dark:border-white/8 dark:text-white/50 dark:hover:bg-white/5",
                  ].join(" ")}
                >
                  {p}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setNotifyPage((prev) => Math.min(totalNotifyPages, prev + 1))}
                disabled={notifyPage >= totalNotifyPages}
                className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200/70 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35 dark:border-white/8 dark:text-white/50 dark:hover:bg-white/5"
              >
                <FiChevronRight className="text-[12px]" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="relative">
      {/* ── Notification Destinations ── */}
      <section className={cardGlowClass}>
        <div className="flex h-full flex-col">

          {/* ── Top bar: title + action buttons ── */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <h2 className="text-[13px] font-bold text-slate-800 dark:text-white/90">
                {t("line.notificationDestinations")}
              </h2>
              <span className="rounded-full border border-slate-200/70 bg-slate-50 px-2.5 py-0.5 text-[10.5px] font-medium text-slate-500 dark:border-white/8 dark:bg-white/5 dark:text-white/40">
                {rows.length}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <ActionButton
                onClick={() => {
                  void fetchNotifications(true);
                  void fetchLineMasters(true);
                }}
                className="border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10"
              >
                <FiRefreshCw className="text-[13px]" />
                Refresh
              </ActionButton>

              <button
                type="button"
                onClick={openCreate}
                className={notifyPrimaryGradientBtn}
                style={{ background: accentGrad }}
              >
                <FiPlus className="text-[12px]" />
                Add Notify
              </button>
            </div>
          </div>

          {/* ── Search + filter toolbar ── */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <div className="relative">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400 dark:text-white/35" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("line.searchNotification")}
                className="h-9 w-55 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[12px] outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100 dark:border-white/10 dark:bg-white/5 dark:text-white/85 dark:placeholder:text-white/35 dark:focus:border-violet-400/30 dark:focus:ring-violet-400/10"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <CustomSelect
                options={ALERT_FILTER_OPTIONS}
                value={alertFilter}
                onChange={setAlertFilter}
                searchable={false}
                icon={<FiBell />}
                className="w-40"
              />

              <CustomSelect
                options={RECEIVER_TYPE_FILTER_OPTIONS}
                value={receiverTypeFilter}
                onChange={setReceiverTypeFilter}
                searchable={false}
                icon={<FiUsers />}
                className="w-40"
                menuAlign="right"
              />
            </div>
          </div>

          {/* ── Table ── */}
          <div className="mt-3">
            {renderNotificationTable()}
          </div>
        </div>
      </section>

      {openCreateModal && createPortal(
        <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/55 backdrop-blur-[3px]"
            onClick={!creating ? closeCreate : undefined}
          />

          <div
            className="relative z-10 w-full max-w-md rounded-2xl bg-white dark:bg-[#12101f]"
            style={{ boxShadow: `0 24px 64px -12px ${currentColor}30, 0 8px 32px rgba(0,0,0,.28)` }}
          >
            <div className="flex items-center justify-between rounded-t-2xl border-b border-slate-100 px-4 py-3 dark:border-white/8">
              <div className="flex items-center gap-2.5">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
                  style={{ background: accentGrad }}
                >
                  <FiUsers className="text-[13px]" />
                </span>
                <div>
                  <p className="text-[8.5px] font-bold uppercase tracking-widest" style={{ color: currentColor }}>
                    Notification Destinations
                  </p>
                  <h3 className="text-[13.5px] font-bold text-slate-800 dark:text-white/90">
                    Create Notification
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={closeCreate}
                disabled={creating}
                className="flex h-7 w-7 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 disabled:opacity-40 dark:text-white/35 dark:hover:bg-white/8"
              >
                <FiX className="text-[14px]" />
              </button>
            </div>

            <div className="space-y-3 px-4 py-4">
              {createError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[10.5px] text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200">
                  {createError}
                </div>
              ) : null}

              <div>
                <label className={formLabelClass}>
                  <FiType className="text-[10px]" />
                  Name <span className="text-red-400">*</span>
                </label>
                <input
                  className={formInputClass}
                  value={createForm.name}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  disabled={creating}
                  placeholder="Receiver name"
                />
              </div>

              <div>
                <label className={formLabelClass}>
                  <FiHash className="text-[10px]" />
                  Send ID <span className="text-red-400">*</span>
                </label>
                <input
                  className={formInputClass}
                  value={createForm.send_id}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, send_id: e.target.value }))
                  }
                  disabled={creating}
                  placeholder="LINE user ID / group ID"
                />
              </div>

              <div>
                <label className={formLabelClass}>
                  <FiLink2 className="text-[10px]" />
                  App Line Master <span className="text-red-400">*</span>
                </label>
                <CustomSelect
                  options={lineMasterSelectOptions}
                  value={createForm.app_line_master_id}
                  onChange={(next) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      app_line_master_id: next,
                    }))
                  }
                  placeholder="Select integration"
                  disabled={loadingLineMasters || creating}
                  maxListHeightClass="max-h-30"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={formLabelClass}>
                    <FiBell className="text-[10px]" />
                    Alert <span className="text-red-400">*</span>
                  </label>
                  <CustomSelect
                    options={ALERT_OPTIONS}
                    value={createForm.alert ? "on" : "off"}
                    onChange={(v) =>
                      setCreateForm((prev) => ({ ...prev, alert: v === "on" }))
                    }
                    searchable={false}
                    disabled={creating}
                  />
                </div>

                <div>
                  <label className={formLabelClass}>
                    <FiUsers className="text-[10px]" />
                    Receiver Type <span className="text-red-400">*</span>
                  </label>
                  <CustomSelect
                    options={RECEIVER_TYPE_OPTIONS}
                    value={createForm.is_group ? "group" : "personal"}
                    onChange={(v) =>
                      setCreateForm((prev) => ({ ...prev, is_group: v === "group" }))
                    }
                    searchable={false}
                    disabled={creating}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 rounded-b-2xl border-t border-slate-100 px-4 py-3 dark:border-white/8">
              <button
                type="button"
                onClick={closeCreate}
                disabled={creating}
                className="flex-1 rounded-xl border border-slate-200 py-2 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60 dark:border-white/8 dark:text-white/55 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitCreate}
                disabled={creating}
                style={!creating ? { background: accentGrad } : undefined}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-[12px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-white/10"
              >
                {creating && <FiRefreshCw className="animate-spin text-[12px]" />}
                {!creating && <FiPlus className="text-[12px]" />}
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {openEditModal && selectedRow && createPortal(
        <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/55 backdrop-blur-[3px]"
            onClick={!editing ? closeEdit : undefined}
          />

          <div
            className="relative z-10 w-full max-w-md rounded-2xl bg-white dark:bg-[#12101f]"
            style={{ boxShadow: `0 24px 64px -12px ${currentColor}30, 0 8px 32px rgba(0,0,0,.28)` }}
          >
            <div className="flex items-center justify-between rounded-t-2xl border-b border-slate-100 px-4 py-3 dark:border-white/8">
              <div className="flex items-center gap-2.5">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
                  style={{ background: accentGrad }}
                >
                  <FiEdit2 className="text-[13px]" />
                </span>
                <div>
                  <p className="text-[8.5px] font-bold uppercase tracking-widest" style={{ color: currentColor }}>
                    Notification Destinations
                  </p>
                  <h3 className="text-[13.5px] font-bold text-slate-800 dark:text-white/90">
                    Edit Notification
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={closeEdit}
                disabled={editing}
                className="flex h-7 w-7 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 disabled:opacity-40 dark:text-white/35 dark:hover:bg-white/8"
              >
                <FiX className="text-[14px]" />
              </button>
            </div>

            <div className="space-y-3 px-4 py-4">
              {editError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[10.5px] text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200">
                  {editError}
                </div>
              ) : null}

              <div>
                <label className={formLabelClass}>
                  <FiType className="text-[10px]" />
                  Name <span className="text-red-400">*</span>
                </label>
                <input
                  className={formInputClass}
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  disabled={editing}
                  placeholder="Receiver name"
                />
              </div>

              <div>
                <label className={formLabelClass}>
                  <FiHash className="text-[10px]" />
                  Send ID <span className="text-red-400">*</span>
                </label>
                <input
                  className={formInputClass}
                  value={editForm.send_id}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, send_id: e.target.value }))
                  }
                  disabled={editing}
                  placeholder="LINE user ID / group ID"
                />
              </div>

              <div>
                <label className={formLabelClass}>
                  <FiLink2 className="text-[10px]" />
                  App Line Master <span className="text-red-400">*</span>
                </label>
                <CustomSelect
                  options={lineMasterSelectOptions}
                  value={editForm.app_line_master_id}
                  onChange={(next) =>
                    setEditForm((prev) => ({
                      ...prev,
                      app_line_master_id: next,
                    }))
                  }
                  placeholder="Select integration"
                  disabled={loadingLineMasters || editing}
                  maxListHeightClass="max-h-30"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={formLabelClass}>
                    <FiBell className="text-[10px]" />
                    Alert <span className="text-red-400">*</span>
                  </label>
                  <CustomSelect
                    options={ALERT_OPTIONS}
                    value={editForm.alert ? "on" : "off"}
                    onChange={(v) =>
                      setEditForm((prev) => ({ ...prev, alert: v === "on" }))
                    }
                    searchable={false}
                    disabled={editing}
                  />
                </div>

                <div>
                  <label className={formLabelClass}>
                    <FiUsers className="text-[10px]" />
                    Receiver Type <span className="text-red-400">*</span>
                  </label>
                  <CustomSelect
                    options={RECEIVER_TYPE_OPTIONS}
                    value={editForm.is_group ? "group" : "personal"}
                    onChange={(v) =>
                      setEditForm((prev) => ({ ...prev, is_group: v === "group" }))
                    }
                    searchable={false}
                    disabled={editing}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 rounded-b-2xl border-t border-slate-100 px-4 py-3 dark:border-white/8">
              <button
                type="button"
                onClick={closeEdit}
                disabled={editing}
                className="flex-1 rounded-xl border border-slate-200 py-2 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60 dark:border-white/8 dark:text-white/55 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitEdit}
                disabled={editing || !isNotifyEditChanged}
                style={!editing && isNotifyEditChanged ? { background: accentGrad } : undefined}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-[12px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-white/10"
              >
                {editing && <FiRefreshCw className="animate-spin text-[12px]" />}
                {!editing && <FiSave className="text-[12px]" />}
                {editing ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {deleteTarget && createPortal(
        <div className={modalBackdropClass}>
          <div className={`${modalCardClass} max-w-md`}>
            <div className="px-5 py-5">
              <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-300">
                <FiTrash2 className="text-[18px]" />
              </div>

              <h3 className="text-center text-[16px] font-semibold text-slate-900 dark:text-white">
                Delete Notification
              </h3>
              <p className="mt-2 text-center text-[12px] leading-6 text-slate-500 dark:text-white/50">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-slate-700 dark:text-white/80">
                  {deleteTarget.name}
                </span>
                ?
              </p>

              {deleteError ? (
                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[12px] text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200">
                  {deleteError}
                </div>
              ) : null}

              <div className="mt-5 flex items-center justify-center gap-2">
                <ActionButton
                  onClick={closeDeleteModal}
                  className="border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white/75 dark:hover:bg-white/10"
                >
                  Cancel
                </ActionButton>
                <ActionButton
                  onClick={confirmDelete}
                  disabled={deleting}
                  className="bg-rose-600 text-white hover:bg-rose-700"
                >
                  {deleting ? "Deleting..." : "Delete"}
                </ActionButton>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {openTestModal && testTarget && createPortal(
        <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/55 backdrop-blur-[3px]"
            onClick={!testingLine ? closeTestLineModal : undefined}
          />

          <div
            className="relative z-10 w-full max-w-md rounded-2xl bg-white dark:bg-[#12101f]"
            style={{ boxShadow: `0 24px 64px -12px ${currentColor}30, 0 8px 32px rgba(0,0,0,.28)` }}
          >
            <div className="flex items-center justify-between rounded-t-2xl border-b border-slate-100 px-4 py-3 dark:border-white/8">
              <div className="flex items-center gap-2.5">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
                  style={{ background: accentGrad }}
                >
                  <FiSend className="text-[13px]" />
                </span>
                <div>
                  <p className="text-[8.5px] font-bold uppercase tracking-widest" style={{ color: currentColor }}>
                    Notification Destinations
                  </p>
                  <h3 className="text-[13.5px] font-bold text-slate-800 dark:text-white/90">
                    Test LINE Message
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={closeTestLineModal}
                disabled={testingLine}
                className="flex h-7 w-7 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 disabled:opacity-40 dark:text-white/35 dark:hover:bg-white/8"
              >
                <FiX className="text-[14px]" />
              </button>
            </div>

            <div className="space-y-3 px-4 py-4">
              {testLineError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[10.5px] text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200">
                  {testLineError}
                </div>
              ) : null}

              {testLineSuccess ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10.5px] text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200">
                  {testLineSuccess}
                </div>
              ) : null}

              <div>
                <label className={formLabelClass}>
                  <FiMessageSquare className="text-[10px]" />
                  Message <span className="text-red-400">*</span>
                </label>
                <textarea
                  className={formTextareaClass}
                  value={testLineForm.message}
                  onChange={(e) =>
                    setTestLineForm((prev) => ({
                      ...prev,
                      message: e.target.value,
                    }))
                  }
                  disabled={testingLine}
                  placeholder="Enter test message"
                />
              </div>
            </div>

            <div className="flex gap-2 rounded-b-2xl border-t border-slate-100 px-4 py-3 dark:border-white/8">
              <button
                type="button"
                onClick={closeTestLineModal}
                disabled={testingLine}
                className="flex-1 rounded-xl border border-slate-200 py-2 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60 dark:border-white/8 dark:text-white/55 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitTestLine}
                disabled={testingLine}
                style={!testingLine ? { background: accentGrad } : undefined}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-[12px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-white/10"
              >
                {testingLine && <FiRefreshCw className="animate-spin text-[12px]" />}
                {!testingLine && <FiSend className="text-[12px]" />}
                {testingLine ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};

export default index;