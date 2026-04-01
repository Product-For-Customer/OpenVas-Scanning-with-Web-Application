import React, { useEffect, useMemo, useState } from "react";
import {
  FiSearch,
  FiBell,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiX,
  FiChevronDown,
  FiCheckCircle,
  FiAlertCircle,
  FiSend,
  FiHash,
  FiLayers,
  FiMessageSquare,
  FiUsers,
  FiUser,
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

type SortKey =
  | "Newest"
  | "Alert: On First"
  | "Alert: Off First";

type UiNotification = {
  id: number;
  name: string;
  send_id: string;
  alert: boolean;
  is_group: boolean;
  app_line_master_id: number;
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

const alertBadgeClass = (alert: boolean) => {
  if (alert) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:border-emerald-400/20";
  }
  return "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-200 dark:border-red-400/20";
};

const typeBadgeClass = (isGroup: boolean) => {
  if (isGroup) {
    return "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-200 dark:border-cyan-400/20";
  }
  return "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-200 dark:border-violet-400/20";
};

const cardGlowClass = [
  "relative h-full overflow-hidden rounded-[20px] p-3 sm:p-3.5",
  "bg-white border border-gray-200/80 shadow-[0_10px_28px_-22px_rgba(15,23,42,0.22)]",
  "dark:bg-[#08111f]/90 dark:border-white/10 dark:ring-1 dark:ring-cyan-400/10 dark:shadow-none",
  "flex flex-col",
].join(" ");

const inputClass = [
  "w-full h-9 rounded-2xl px-3 text-[11.5px] outline-none transition",
  "border border-gray-200 bg-white text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-violet-200",
  "dark:border-white/10 dark:bg-white/5 dark:text-white/85 dark:placeholder:text-white/35 dark:focus:ring-violet-400/10",
].join(" ");

const textareaClass = [
  "w-full min-h-24 rounded-2xl px-3 py-2.5 text-[11.5px] outline-none transition resize-none",
  "border border-gray-200 bg-white text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-violet-200",
  "dark:border-white/10 dark:bg-white/5 dark:text-white/85 dark:placeholder:text-white/35 dark:focus:ring-violet-400/10",
].join(" ");

const labelClass =
  "mb-1.5 block text-[10.5px] font-medium text-slate-700 dark:text-white/75";

const selectClass = [
  "w-full h-9 rounded-2xl px-3 text-[11.5px] outline-none transition appearance-none",
  "border border-gray-200 bg-white text-slate-800 focus:ring-2 focus:ring-violet-200",
  "dark:border-white/10 dark:bg-white/5 dark:text-white/85 dark:focus:ring-violet-400/10",
].join(" ");

const AlertToggle: React.FC<{
  value: boolean;
  onChange: (next: boolean) => void;
}> = ({ value, onChange }) => {
  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={[
          "group relative flex min-h-18 flex-col justify-center rounded-2xl border px-3 py-2 text-left transition-all",
          value
            ? "border-emerald-300 bg-emerald-50 shadow-[0_8px_20px_-16px_rgba(16,185,129,0.7)] dark:border-emerald-400/30 dark:bg-emerald-500/10"
            : "border-gray-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/50 dark:border-white/10 dark:bg-white/5 dark:hover:border-emerald-400/20 dark:hover:bg-emerald-500/5",
        ].join(" ")}
      >
        <div className="flex items-center justify-between">
          <div
            className={[
              "grid h-8 w-8 place-items-center rounded-xl border transition",
              value
                ? "border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-300"
                : "border-gray-200 bg-gray-50 text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-white/45",
            ].join(" ")}
          >
            <FiCheckCircle className="text-[14px]" />
          </div>

          <div
            className={[
              "h-3 w-3 rounded-full border transition",
              value
                ? "border-emerald-500 bg-emerald-500"
                : "border-gray-300 bg-transparent dark:border-white/20",
            ].join(" ")}
          />
        </div>

        <div className="mt-2">
          <p
            className={[
              "text-[11.5px] font-semibold",
              value
                ? "text-emerald-700 dark:text-emerald-300"
                : "text-slate-700 dark:text-white/75",
            ].join(" ")}
          >
            Alert On
          </p>
          <p className="mt-0.5 text-[10px] text-slate-500 dark:text-white/45">
            เปิดการแจ้งเตือนสำหรับผู้รับนี้
          </p>
        </div>
      </button>

      <button
        type="button"
        onClick={() => onChange(false)}
        className={[
          "group relative flex min-h-18 flex-col justify-center rounded-2xl border px-3 py-2 text-left transition-all",
          !value
            ? "border-rose-300 bg-rose-50 shadow-[0_8px_20px_-16px_rgba(244,63,94,0.7)] dark:border-rose-400/30 dark:bg-rose-500/10"
            : "border-gray-200 bg-white hover:border-rose-200 hover:bg-rose-50/50 dark:border-white/10 dark:bg-white/5 dark:hover:border-rose-400/20 dark:hover:bg-rose-500/5",
        ].join(" ")}
      >
        <div className="flex items-center justify-between">
          <div
            className={[
              "grid h-8 w-8 place-items-center rounded-xl border transition",
              !value
                ? "border-rose-300 bg-rose-100 text-rose-700 dark:border-rose-400/30 dark:bg-rose-500/15 dark:text-rose-300"
                : "border-gray-200 bg-gray-50 text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-white/45",
            ].join(" ")}
          >
            <FiAlertCircle className="text-[14px]" />
          </div>

          <div
            className={[
              "h-3 w-3 rounded-full border transition",
              !value
                ? "border-rose-500 bg-rose-500"
                : "border-gray-300 bg-transparent dark:border-white/20",
            ].join(" ")}
          />
        </div>

        <div className="mt-2">
          <p
            className={[
              "text-[11.5px] font-semibold",
              !value
                ? "text-rose-700 dark:text-rose-300"
                : "text-slate-700 dark:text-white/75",
            ].join(" ")}
          >
            Alert Off
          </p>
          <p className="mt-0.5 text-[10px] text-slate-500 dark:text-white/45">
            ปิดการแจ้งเตือนสำหรับผู้รับนี้
          </p>
        </div>
      </button>
    </div>
  );
};

const ReceiverTypeToggle: React.FC<{
  value: boolean;
  onChange: (next: boolean) => void;
}> = ({ value, onChange }) => {
  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={[
          "group relative flex min-h-18 flex-col justify-center rounded-2xl border px-3 py-2 text-left transition-all",
          value
            ? "border-cyan-300 bg-cyan-50 shadow-[0_8px_20px_-16px_rgba(6,182,212,0.7)] dark:border-cyan-400/30 dark:bg-cyan-500/10"
            : "border-gray-200 bg-white hover:border-cyan-200 hover:bg-cyan-50/50 dark:border-white/10 dark:bg-white/5 dark:hover:border-cyan-400/20 dark:hover:bg-cyan-500/5",
        ].join(" ")}
      >
        <div className="flex items-center justify-between">
          <div
            className={[
              "grid h-8 w-8 place-items-center rounded-xl border transition",
              value
                ? "border-cyan-300 bg-cyan-100 text-cyan-700 dark:border-cyan-400/30 dark:bg-cyan-500/15 dark:text-cyan-300"
                : "border-gray-200 bg-gray-50 text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-white/45",
            ].join(" ")}
          >
            <FiUsers className="text-[14px]" />
          </div>

          <div
            className={[
              "h-3 w-3 rounded-full border transition",
              value
                ? "border-cyan-500 bg-cyan-500"
                : "border-gray-300 bg-transparent dark:border-white/20",
            ].join(" ")}
          />
        </div>

        <div className="mt-2">
          <p
            className={[
              "text-[11.5px] font-semibold",
              value
                ? "text-cyan-700 dark:text-cyan-300"
                : "text-slate-700 dark:text-white/75",
            ].join(" ")}
          >
            Group
          </p>
          <p className="mt-0.5 text-[10px] text-slate-500 dark:text-white/45">
            ใช้สำหรับ LINE Group หรือห้องแชตกลุ่ม
          </p>
        </div>
      </button>

      <button
        type="button"
        onClick={() => onChange(false)}
        className={[
          "group relative flex min-h-18 flex-col justify-center rounded-2xl border px-3 py-2 text-left transition-all",
          !value
            ? "border-violet-300 bg-violet-50 shadow-[0_8px_20px_-16px_rgba(139,92,246,0.7)] dark:border-violet-400/30 dark:bg-violet-500/10"
            : "border-gray-200 bg-white hover:border-violet-200 hover:bg-violet-50/50 dark:border-white/10 dark:bg-white/5 dark:hover:border-violet-400/20 dark:hover:bg-violet-500/5",
        ].join(" ")}
      >
        <div className="flex items-center justify-between">
          <div
            className={[
              "grid h-8 w-8 place-items-center rounded-xl border transition",
              !value
                ? "border-violet-300 bg-violet-100 text-violet-700 dark:border-violet-400/30 dark:bg-violet-500/15 dark:text-violet-300"
                : "border-gray-200 bg-gray-50 text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-white/45",
            ].join(" ")}
          >
            <FiUser className="text-[14px]" />
          </div>

          <div
            className={[
              "h-3 w-3 rounded-full border transition",
              !value
                ? "border-violet-500 bg-violet-500"
                : "border-gray-300 bg-transparent dark:border-white/20",
            ].join(" ")}
          />
        </div>

        <div className="mt-2">
          <p
            className={[
              "text-[11.5px] font-semibold",
              !value
                ? "text-violet-700 dark:text-violet-300"
                : "text-slate-700 dark:text-white/75",
            ].join(" ")}
          >
            Personal
          </p>
          <p className="mt-0.5 text-[10px] text-slate-500 dark:text-white/45">
            ใช้สำหรับผู้ใช้ส่วนตัวหรือบัญชีรายบุคคล
          </p>
        </div>
      </button>
    </div>
  );
};

const Index: React.FC = () => {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("Newest");
  const [openSort, setOpenSort] = useState(false);

  const [rows, setRows] = useState<UiNotification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  const [lineMasters, setLineMasters] = useState<AppLineMasterResponse[]>([]);
  const [loadingLineMasters, setLoadingLineMasters] = useState<boolean>(true);
  const [lineMasterError, setLineMasterError] = useState<string>("");

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

  const lineMasterMap = useMemo(() => {
    return new Map<number, string>(
      lineMasters.map((item) => [item.id, item.name ?? `Line Master #${item.id}`])
    );
  }, [lineMasters]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      setError("");

      const data = await ListAppNotification();

      if (!data) {
        setRows([]);
        setError("โหลดข้อมูล App Notification ไม่สำเร็จ");
        return;
      }

      const mapped: UiNotification[] = (data as AppNotificationResponse[]).map(
        (item) => ({
          id: item.id,
          name: item.name ?? "",
          send_id: item.send_id ?? "",
          alert: Boolean(item.alert),
          is_group: Boolean(item.is_group),
          app_line_master_id: Number(item.app_line_master_id ?? 0),
        })
      );

      setRows(mapped);
    } catch (err) {
      console.error("fetchNotifications error:", err);
      setRows([]);
      setError("เกิดข้อผิดพลาดตอนโหลดข้อมูล App Notification");
    } finally {
      setLoading(false);
    }
  };

  const fetchLineMasters = async () => {
    try {
      setLoadingLineMasters(true);
      setLineMasterError("");

      const data = await ListAppLineMaster();

      if (!data) {
        setLineMasters([]);
        setLineMasterError("โหลดข้อมูล App Line Master ไม่สำเร็จ");
        return;
      }

      setLineMasters(data);
    } catch (err) {
      console.error("fetchLineMasters error:", err);
      setLineMasters([]);
      setLineMasterError("เกิดข้อผิดพลาดตอนโหลด App Line Master");
    } finally {
      setLoadingLineMasters(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    fetchLineMasters();
  }, []);

  const notifications = useMemo(() => {
    const q = search.trim().toLowerCase();

    let filtered = rows.filter((item) => {
      const lineMasterName =
        lineMasterMap.get(item.app_line_master_id) ||
        `Line Master #${item.app_line_master_id}`;

      const typeText = item.is_group ? "group" : "personal";

      const blob = [
        item.id,
        item.name,
        item.send_id,
        item.alert ? "on" : "off",
        item.alert ? "true" : "false",
        item.is_group ? "group" : "personal",
        item.is_group ? "true" : "false",
        item.app_line_master_id,
        lineMasterName,
        typeText,
      ]
        .join(" ")
        .toLowerCase();

      return blob.includes(q);
    });

    filtered = [...filtered].sort((a, b) => {
      if (sortBy === "Newest") return b.id - a.id;

      if (sortBy === "Alert: On First") {
        if (a.alert === b.alert) return b.id - a.id;
        return a.alert ? -1 : 1;
      }

      if (sortBy === "Alert: Off First") {
        if (a.alert === b.alert) return b.id - a.id;
        return a.alert ? 1 : -1;
      }

      return b.id - a.id;
    });

    return filtered;
  }, [rows, search, sortBy, lineMasterMap]);

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
    if (!form.name.trim()) return "กรุณากรอก Name";
    if (!form.send_id.trim()) return "กรุณากรอก Send ID";
    if (!form.app_line_master_id.trim()) return "กรุณาเลือก App Line Master";

    const lineMasterID = Number(form.app_line_master_id);
    if (Number.isNaN(lineMasterID) || lineMasterID <= 0) {
      return "App Line Master ไม่ถูกต้อง";
    }

    return "";
  };

  const validateTestLineForm = (form: TestLineFormData) => {
    if (!form.message.trim()) return "กรุณากรอก message สำหรับทดสอบ";
    if (form.message.trim().length < 2) return "message ต้องมีอย่างน้อย 2 ตัวอักษร";
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
        setCreateError("สร้าง App Notification ไม่สำเร็จ");
        return;
      }

      setOpenCreateModal(false);
      resetCreateForm();
      await fetchNotifications();
    } catch (err: any) {
      setCreateError(
        err?.response?.data?.error ||
          err?.message ||
          "เกิดข้อผิดพลาดระหว่างสร้าง App Notification"
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
        setEditError("อัปเดต App Notification ไม่สำเร็จ");
        return;
      }

      setOpenEditModal(false);
      setSelectedRow(null);
      resetEditForm();
      await fetchNotifications();
    } catch (err: any) {
      setEditError(
        err?.response?.data?.error ||
          err?.message ||
          "เกิดข้อผิดพลาดระหว่างอัปเดต App Notification"
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
        setTestLineError("ทดสอบส่ง LINE ไม่สำเร็จ");
        return;
      }

      if (!res.success) {
        setTestLineError(res.message || "ทดสอบส่ง LINE ไม่สำเร็จ");
        return;
      }

      setTestLineSuccess(res.message || "ส่งข้อความทดสอบสำเร็จ");
      setTestLineForm((prev) => ({
        ...prev,
        message: "",
      }));
    } catch (err: any) {
      setTestLineError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "เกิดข้อผิดพลาดระหว่างทดสอบส่ง LINE"
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
        setDeleteError("ลบ App Notification ไม่สำเร็จ");
        return;
      }

      setDeleteTarget(null);
      await fetchNotifications();
    } catch (err: any) {
      setDeleteError(
        err?.response?.data?.error ||
          err?.message ||
          "เกิดข้อผิดพลาดระหว่างลบ App Notification"
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <section className={cardGlowClass}>
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-12 right-6 h-24 w-24 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-24 w-24 rounded-full bg-violet-500/10 blur-3xl" />
          <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]">
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

        <div className="relative z-10 flex h-full flex-col">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[10px] font-semibold text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-500/10 dark:text-cyan-300">
                <FiBell className="text-[10px]" />
                App Notification Monitoring
              </div>

              <h2 className="mt-2 text-[16px] font-semibold tracking-tight text-slate-900 sm:text-[18px] dark:text-white">
                Line Notification
              </h2>

              <p className="mt-1 text-[10.5px] sm:text-[11px] text-slate-500 dark:text-white/55">
                Manage notification recipients, send targets, and alert status.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={openCreate}
                className={[
                  "inline-flex h-8.5 items-center gap-1.5 rounded-2xl px-3 text-[11.5px] font-semibold transition",
                  "bg-violet-600 text-white hover:bg-violet-700 active:bg-violet-800",
                  "dark:bg-violet-500 dark:hover:bg-violet-400 dark:active:bg-violet-600",
                ].join(" ")}
              >
                <FiPlus className="text-[12px]" />
                Create Notification
              </button>
            </div>
          </div>

          <div className="mt-3.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-gray-400 dark:text-white/35" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search id / name / send id / alert / type / line master..."
                className={[
                  "w-full h-8.5 rounded-2xl pl-8.5 pr-3 text-[11.5px] outline-none transition",
                  "border border-gray-200 bg-white text-slate-800 focus:ring-2 focus:ring-violet-200",
                  "dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:placeholder:text-white/35 dark:focus:ring-violet-400/10",
                ].join(" ")}
              />
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenSort((s) => !s)}
                className={[
                  "inline-flex h-8.5 items-center gap-2 rounded-2xl px-3 transition",
                  "bg-white border border-gray-200/80 text-[11.5px] font-medium text-gray-700 hover:bg-gray-50",
                  "dark:bg-white/5 dark:border-white/10 dark:text-white/75 dark:hover:bg-white/8",
                ].join(" ")}
              >
                {sortBy}
                <FiChevronDown
                  className={`text-[12px] text-gray-400 transition dark:text-white/45 ${
                    openSort ? "rotate-180" : ""
                  }`}
                />
              </button>

              {openSort && (
                <div className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg dark:border-white/10 dark:bg-[#0B1220] dark:shadow-none">
                  {(
                    [
                      "Newest",
                      "Alert: On First",
                      "Alert: Off First",
                    ] as SortKey[]
                  ).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        setSortBy(opt);
                        setOpenSort(false);
                      }}
                      className={[
                        "w-full px-3 py-2 text-left text-[11.5px] transition",
                        sortBy === opt
                          ? "bg-violet-50 text-violet-700 font-semibold dark:bg-violet-500/10 dark:text-violet-200"
                          : "text-gray-700 hover:bg-gray-50 dark:text-white/70 dark:hover:bg-white/8",
                      ].join(" ")}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-2 flex flex-col gap-1 text-[10.5px] text-slate-500 dark:text-white/50">
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-violet-500/70" />
                Loading app notifications...
              </span>
            ) : error ? (
              <span className="text-red-600 dark:text-red-300">{error}</span>
            ) : (
              <span>
                Showing <span className="font-semibold">{notifications.length}</span>{" "}
                notifications
              </span>
            )}

            {lineMasterError && (
              <span className="text-amber-600 dark:text-amber-300">
                {lineMasterError}
              </span>
            )}
          </div>

          <div className="mt-3 flex flex-1 flex-col overflow-hidden rounded-[20px] border border-gray-200/80 bg-white/80 dark:border-white/10 dark:bg-white/3">
            <div className="flex-1 overflow-x-auto overflow-y-auto">
              <table className="min-w-245 w-full border-separate border-spacing-0">
                <thead className="sticky top-0 z-10 bg-white/95 backdrop-blur dark:bg-[#0f172a]/95">
                  <tr className="text-left">
                    <th className="border-b border-gray-200/80 px-3 py-2.5 text-[10.5px] font-semibold text-slate-600 dark:border-white/10 dark:text-white/60">
                      Notification
                    </th>
                    <th className="border-b border-gray-200/80 px-3 py-2.5 text-[10.5px] font-semibold text-slate-600 dark:border-white/10 dark:text-white/60">
                      Send ID
                    </th>
                    <th className="border-b border-gray-200/80 px-3 py-2.5 text-[10.5px] font-semibold text-slate-600 dark:border-white/10 dark:text-white/60">
                      Type
                    </th>
                    <th className="border-b border-gray-200/80 px-3 py-2.5 text-[10.5px] font-semibold text-slate-600 dark:border-white/10 dark:text-white/60">
                      Alert
                    </th>
                    <th className="border-b border-gray-200/80 px-3 py-2.5 text-[10.5px] font-semibold text-slate-600 dark:border-white/10 dark:text-white/60">
                      App Line Master
                    </th>
                    <th className="border-b border-gray-200/80 px-3 py-2.5 text-right text-[10.5px] font-semibold text-slate-600 dark:border-white/10 dark:text-white/60">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {!loading &&
                    notifications.map((item, idx) => {
                      const lineMasterName =
                        lineMasterMap.get(item.app_line_master_id) ||
                        `Line Master #${item.app_line_master_id}`;

                      return (
                        <tr
                          key={item.id}
                          className="transition-colors hover:bg-violet-50/40 dark:hover:bg-white/4"
                        >
                          <td
                            className={`px-3 py-2.5 ${
                              idx !== notifications.length - 1
                                ? "border-b border-gray-100 dark:border-white/10"
                                : ""
                            }`}
                          >
                            <div className="flex min-w-0 items-center gap-2.5">
                              <div
                                className={[
                                  "grid h-9 w-9 place-items-center rounded-2xl ring-1",
                                  "bg-cyan-50 ring-cyan-100 text-cyan-700",
                                  "dark:bg-cyan-500/10 dark:ring-cyan-400/15 dark:text-cyan-300",
                                ].join(" ")}
                              >
                                <FiBell className="text-[14px]" />
                              </div>

                              <div className="min-w-0">
                                <p className="truncate text-[11.5px] font-semibold text-slate-900 dark:text-white/85">
                                  {item.name || "-"}
                                </p>

                                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-slate-500 dark:text-white/50">
                                  <span className="inline-flex items-center gap-1">
                                    <FiHash className="text-[10px]" />
                                    ID: {item.id}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>

                          <td
                            className={`px-3 py-2.5 ${
                              idx !== notifications.length - 1
                                ? "border-b border-gray-100 dark:border-white/10"
                                : ""
                            }`}
                          >
                            <div className="flex items-center gap-2 text-[11.5px] text-slate-700 dark:text-white/75">
                              <FiSend className="text-[11px] text-violet-600 dark:text-violet-300" />
                              <span className="break-all">{item.send_id || "-"}</span>
                            </div>
                          </td>

                          <td
                            className={`px-3 py-2.5 ${
                              idx !== notifications.length - 1
                                ? "border-b border-gray-100 dark:border-white/10"
                                : ""
                            }`}
                          >
                            <span
                              className={[
                                "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                                typeBadgeClass(item.is_group),
                              ].join(" ")}
                            >
                              {item.is_group ? (
                                <>
                                  <FiUsers className="mr-1 text-[10px]" />
                                  Group
                                </>
                              ) : (
                                <>
                                  <FiUser className="mr-1 text-[10px]" />
                                  Personal
                                </>
                              )}
                            </span>
                          </td>

                          <td
                            className={`px-3 py-2.5 ${
                              idx !== notifications.length - 1
                                ? "border-b border-gray-100 dark:border-white/10"
                                : ""
                            }`}
                          >
                            <span
                              className={[
                                "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                                alertBadgeClass(item.alert),
                              ].join(" ")}
                            >
                              {item.alert ? (
                                <>
                                  <FiCheckCircle className="mr-1 text-[10px]" />
                                  Alert On
                                </>
                              ) : (
                                <>
                                  <FiAlertCircle className="mr-1 text-[10px]" />
                                  Alert Off
                                </>
                              )}
                            </span>
                          </td>

                          <td
                            className={`px-3 py-2.5 ${
                              idx !== notifications.length - 1
                                ? "border-b border-gray-100 dark:border-white/10"
                                : ""
                            }`}
                          >
                            <div className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-white/75">
                              <FiLayers className="shrink-0 text-[10px]" />
                              <span className="truncate">{lineMasterName}</span>
                            </div>
                          </td>

                          <td
                            className={`px-3 py-2.5 text-right ${
                              idx !== notifications.length - 1
                                ? "border-b border-gray-100 dark:border-white/10"
                                : ""
                            }`}
                          >
                            <div className="inline-flex items-center gap-1.5 flex-wrap justify-end">
                              <button
                                type="button"
                                onClick={() => openTestLineModal(item)}
                                className={[
                                  "inline-flex h-8 items-center gap-1.5 rounded-xl px-2 transition-colors",
                                  "text-violet-700 bg-violet-50 hover:bg-violet-100 active:bg-violet-200",
                                  "dark:text-violet-300 dark:bg-violet-500/10 dark:hover:bg-violet-500/15 dark:active:bg-violet-500/20",
                                ].join(" ")}
                                title="ทดสอบ alert line"
                                aria-label="ทดสอบ alert line"
                              >
                                <FiMessageSquare className="text-[11px]" />
                                <span className="text-[10.5px] font-semibold">Test Line</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => openEdit(item)}
                                className={[
                                  "inline-flex h-8 w-8 items-center justify-center rounded-xl transition-colors",
                                  "text-cyan-600 bg-cyan-50 hover:bg-cyan-100 active:bg-cyan-200",
                                  "dark:text-cyan-300 dark:bg-cyan-500/10 dark:hover:bg-cyan-500/15 dark:active:bg-cyan-500/20",
                                ].join(" ")}
                                title="Update notification"
                                aria-label="Update notification"
                              >
                                <FiEdit2 className="text-[11px]" />
                              </button>

                              <button
                                type="button"
                                onClick={() => openDeleteModal(item)}
                                className={[
                                  "inline-flex h-8 w-8 items-center justify-center rounded-xl transition-colors",
                                  "text-red-600 bg-red-50 hover:bg-red-100 active:bg-red-200",
                                  "dark:text-red-300 dark:bg-red-500/10 dark:hover:bg-red-500/15 dark:active:bg-red-500/20",
                                ].join(" ")}
                                title="Delete notification"
                                aria-label="Delete notification"
                              >
                                <FiTrash2 className="text-[11px]" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                  {!loading && notifications.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-center text-[11.5px] text-slate-500 dark:text-white/50"
                      >
                        No app notification data found
                      </td>
                    </tr>
                  )}

                  {loading && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-center text-[11.5px] text-slate-500 dark:text-white/50"
                      >
                        Loading...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {openSort && (
          <button
            type="button"
            onClick={() => setOpenSort(false)}
            className="fixed inset-0 z-5 cursor-default"
            aria-label="Close sort overlay"
          />
        )}
      </section>

      {openCreateModal && (
        <div className="fixed inset-0 z-200 flex items-center justify-center p-3.5">
          <button
            type="button"
            onClick={closeCreate}
            className="absolute inset-0 bg-slate-900/35 backdrop-blur-[2px]"
            aria-label="Close create modal overlay"
          />

          <div
            className={[
              "relative z-10 w-full max-w-xl rounded-[18px] border border-gray-200 bg-white p-3.5 shadow-[0_20px_70px_rgba(15,23,42,0.18)]",
              "dark:border-white/10 dark:bg-[#0d1524]",
            ].join(" ")}
          >
            <button
              type="button"
              onClick={closeCreate}
              disabled={creating}
              className="absolute right-3 top-3 text-gray-400 transition hover:text-gray-600 disabled:cursor-not-allowed dark:text-white/45 dark:hover:text-white/70"
              aria-label="Close"
            >
              <FiX className="text-[16px]" />
            </button>

            <div className="mb-3.5">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[10px] font-semibold text-violet-700 dark:border-violet-400/20 dark:bg-violet-500/10 dark:text-violet-300">
                <FiPlus className="text-[10px]" />
                Create Notification
              </div>

              <h3 className="mt-2 text-[16px] font-semibold text-slate-800 dark:text-white">
                Add New App Notification
              </h3>

              <p className="mt-1 text-[10.5px] text-slate-500 dark:text-white/55">
                Create a new notification receiver and configure its alert status.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className={labelClass}>Name</label>
                <input
                  value={createForm.name}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="Enter notification name"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Send ID</label>
                <input
                  value={createForm.send_id}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, send_id: e.target.value }))
                  }
                  placeholder="Enter send id"
                  className={inputClass}
                />
              </div>

              <div className="md:col-span-2">
                <label className={labelClass}>Receiver Type</label>
                <ReceiverTypeToggle
                  value={createForm.is_group}
                  onChange={(next) =>
                    setCreateForm((prev) => ({ ...prev, is_group: next }))
                  }
                />
              </div>

              <div className="md:col-span-2">
                <label className={labelClass}>App Line Master</label>
                <div className="relative">
                  <select
                    value={createForm.app_line_master_id}
                    onChange={(e) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        app_line_master_id: e.target.value,
                      }))
                    }
                    className={selectClass}
                    disabled={loadingLineMasters || lineMasters.length === 0}
                  >
                    {loadingLineMasters ? (
                      <option value="">Loading App Line Master...</option>
                    ) : lineMasters.length === 0 ? (
                      <option value="">No App Line Master found</option>
                    ) : (
                      lineMasters.map((item) => (
                        <option key={item.id} value={String(item.id)}>
                          {item.name}
                        </option>
                      ))
                    )}
                  </select>

                  <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400 dark:text-white/40" />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className={labelClass}>Alert Status</label>
                <AlertToggle
                  value={createForm.alert}
                  onChange={(next) =>
                    setCreateForm((prev) => ({ ...prev, alert: next }))
                  }
                />
              </div>
            </div>

            {createError && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11.5px] text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300">
                {createError}
              </div>
            )}

            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeCreate}
                disabled={creating}
                className={[
                  "rounded-xl px-3 py-2 text-[11.5px] font-medium transition",
                  "bg-slate-100 text-slate-700 hover:bg-slate-200",
                  "dark:bg-white/8 dark:text-white/80 dark:hover:bg-white/12",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                ].join(" ")}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={submitCreate}
                disabled={creating || loadingLineMasters || lineMasters.length === 0}
                className={[
                  "rounded-xl px-3 py-2 text-[11.5px] font-medium transition",
                  "bg-violet-600 text-white hover:bg-violet-700",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                ].join(" ")}
              >
                {creating ? "Creating..." : "Create Notification"}
              </button>
            </div>
          </div>
        </div>
      )}

      {openEditModal && selectedRow && (
        <div className="fixed inset-0 z-200 flex items-center justify-center p-3.5">
          <button
            type="button"
            onClick={closeEdit}
            className="absolute inset-0 bg-slate-900/35 backdrop-blur-[2px]"
            aria-label="Close edit modal overlay"
          />

          <div
            className={[
              "relative z-10 w-full max-w-xl rounded-[18px] border border-gray-200 bg-white p-3.5 shadow-[0_20px_70px_rgba(15,23,42,0.18)]",
              "dark:border-white/10 dark:bg-[#0d1524]",
            ].join(" ")}
          >
            <button
              type="button"
              onClick={closeEdit}
              disabled={editing}
              className="absolute right-3 top-3 text-gray-400 transition hover:text-gray-600 disabled:cursor-not-allowed dark:text-white/45 dark:hover:text-white/70"
              aria-label="Close"
            >
              <FiX className="text-[16px]" />
            </button>

            <div className="mb-3.5">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[10px] font-semibold text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-500/10 dark:text-cyan-300">
                <FiEdit2 className="text-[10px]" />
                Update Notification
              </div>

              <h3 className="mt-2 text-[16px] font-semibold text-slate-800 dark:text-white">
                Edit App Notification
              </h3>

              <p className="mt-1 text-[10.5px] text-slate-500 dark:text-white/55">
                Update the selected notification information.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className={labelClass}>Name</label>
                <input
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="Enter notification name"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Send ID</label>
                <input
                  value={editForm.send_id}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, send_id: e.target.value }))
                  }
                  placeholder="Enter send id"
                  className={inputClass}
                />
              </div>

              <div className="md:col-span-2">
                <label className={labelClass}>Receiver Type</label>
                <ReceiverTypeToggle
                  value={editForm.is_group}
                  onChange={(next) =>
                    setEditForm((prev) => ({ ...prev, is_group: next }))
                  }
                />
              </div>

              <div className="md:col-span-2">
                <label className={labelClass}>App Line Master</label>
                <div className="relative">
                  <select
                    value={editForm.app_line_master_id}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        app_line_master_id: e.target.value,
                      }))
                    }
                    className={selectClass}
                    disabled={loadingLineMasters || lineMasters.length === 0}
                  >
                    {loadingLineMasters ? (
                      <option value="">Loading App Line Master...</option>
                    ) : lineMasters.length === 0 ? (
                      <option value="">No App Line Master found</option>
                    ) : (
                      lineMasters.map((item) => (
                        <option key={item.id} value={String(item.id)}>
                          {item.name}
                        </option>
                      ))
                    )}
                  </select>

                  <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400 dark:text-white/40" />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className={labelClass}>Alert Status</label>
                <AlertToggle
                  value={editForm.alert}
                  onChange={(next) =>
                    setEditForm((prev) => ({ ...prev, alert: next }))
                  }
                />
              </div>
            </div>

            {editError && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11.5px] text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300">
                {editError}
              </div>
            )}

            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeEdit}
                disabled={editing}
                className={[
                  "rounded-xl px-3 py-2 text-[11.5px] font-medium transition",
                  "bg-slate-100 text-slate-700 hover:bg-slate-200",
                  "dark:bg-white/8 dark:text-white/80 dark:hover:bg-white/12",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                ].join(" ")}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={submitEdit}
                disabled={editing || loadingLineMasters || lineMasters.length === 0}
                className={[
                  "rounded-xl px-3 py-2 text-[11.5px] font-medium transition",
                  "bg-cyan-600 text-white hover:bg-cyan-700",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                ].join(" ")}
              >
                {editing ? "Updating..." : "Update Notification"}
              </button>
            </div>
          </div>
        </div>
      )}

      {openTestModal && testTarget && (
        <div className="fixed inset-0 z-200 flex items-center justify-center p-3.5">
          <button
            type="button"
            onClick={closeTestLineModal}
            className="absolute inset-0 bg-slate-900/35 backdrop-blur-[2px]"
            aria-label="Close test line modal overlay"
          />

          <div
            className={[
              "relative z-10 w-full max-w-xl rounded-[18px] border border-gray-200 bg-white p-3.5 shadow-[0_20px_70px_rgba(15,23,42,0.18)]",
              "dark:border-white/10 dark:bg-[#0d1524]",
            ].join(" ")}
          >
            <button
              type="button"
              onClick={closeTestLineModal}
              disabled={testingLine}
              className="absolute right-3 top-3 text-gray-400 transition hover:text-gray-600 disabled:cursor-not-allowed dark:text-white/45 dark:hover:text-white/70"
              aria-label="Close"
            >
              <FiX className="text-[16px]" />
            </button>

            <div className="mb-3.5">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[10px] font-semibold text-violet-700 dark:border-violet-400/20 dark:bg-violet-500/10 dark:text-violet-300">
                <FiMessageSquare className="text-[10px]" />
                Test Alert Line
              </div>

              <h3 className="mt-2 text-[16px] font-semibold text-slate-800 dark:text-white">
                ทดสอบส่งข้อความ LINE
              </h3>

              <p className="mt-1 text-[10.5px] text-slate-500 dark:text-white/55">
                ระบบจะส่ง <span className="font-semibold">{testTarget.name}</span> โดยใช้{" "}
                <span className="font-semibold">{testTarget.send_id}</span>
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-white/5">
                <div className="flex flex-wrap items-center gap-2 text-[10.5px] text-slate-600 dark:text-white/70">
                  <span className="inline-flex items-center gap-1">
                    <FiHash className="text-[10px]" />
                    Notification ID: {testTarget.id}
                  </span>

                  <span
                    className={[
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                      typeBadgeClass(testTarget.is_group),
                    ].join(" ")}
                  >
                    {testTarget.is_group ? (
                      <>
                        <FiUsers className="mr-1 text-[10px]" />
                        Group
                      </>
                    ) : (
                      <>
                        <FiUser className="mr-1 text-[10px]" />
                        Personal
                      </>
                    )}
                  </span>

                  <span
                    className={[
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                      alertBadgeClass(testTarget.alert),
                    ].join(" ")}
                  >
                    {testTarget.alert ? "Alert On" : "Alert Off"}
                  </span>
                </div>
              </div>

              <div>
                <label className={labelClass}>Message</label>
                <textarea
                  value={testLineForm.message}
                  onChange={(e) =>
                    setTestLineForm((prev) => ({
                      ...prev,
                      message: e.target.value,
                    }))
                  }
                  placeholder="กรอกข้อความที่ต้องการใช้ทดสอบระบบส่ง LINE"
                  className={textareaClass}
                />
              </div>
            </div>

            {testLineError && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11.5px] text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300">
                {testLineError}
              </div>
            )}

            {testLineSuccess && (
              <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11.5px] text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                {testLineSuccess}
              </div>
            )}

            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeTestLineModal}
                disabled={testingLine}
                className={[
                  "rounded-xl px-3 py-2 text-[11.5px] font-medium transition",
                  "bg-slate-100 text-slate-700 hover:bg-slate-200",
                  "dark:bg-white/8 dark:text-white/80 dark:hover:bg-white/12",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                ].join(" ")}
              >
                Close
              </button>

              <button
                type="button"
                onClick={submitTestLine}
                disabled={testingLine}
                className={[
                  "inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[11.5px] font-medium transition",
                  "bg-violet-600 text-white hover:bg-violet-700",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                ].join(" ")}
              >
                <FiSend className="text-[11px]" />
                {testingLine ? "Sending..." : "Send Test Line"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-200 flex items-center justify-center p-3.5">
          <button
            type="button"
            onClick={closeDeleteModal}
            className="absolute inset-0 bg-slate-900/35 backdrop-blur-[2px]"
            aria-label="Close delete modal overlay"
          />

          <div
            className={[
              "relative z-10 w-full max-w-lg rounded-[18px] border border-gray-200 bg-white px-4 py-4 shadow-[0_20px_70px_rgba(15,23,42,0.18)]",
              "dark:border-white/10 dark:bg-[#0d1524]",
            ].join(" ")}
          >
            <button
              type="button"
              onClick={closeDeleteModal}
              disabled={deleting}
              className="absolute right-3 top-3 text-gray-400 transition hover:text-gray-600 disabled:cursor-not-allowed dark:text-white/45 dark:hover:text-white/70"
              aria-label="Close"
            >
              <FiX className="text-[16px]" />
            </button>

            <div className="flex justify-center pt-1">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-300">
                <FiTrash2 className="text-[20px]" />
              </div>
            </div>

            <h3 className="mt-2.5 text-center text-[16px] font-semibold text-slate-800 dark:text-white">
              Delete Notification
            </h3>

            <p className="mx-auto mt-1.5 max-w-95 text-center text-[11px] leading-5 text-slate-500 dark:text-white/55">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-slate-700 dark:text-white/80">
                {deleteTarget.name}
              </span>
              ? This action cannot be undone.
            </p>

            <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2">
              <span className="text-center text-[10.5px] text-slate-400 dark:text-white/40">
                Send ID: {deleteTarget.send_id || "-"}
              </span>

              <span
                className={[
                  "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                  typeBadgeClass(deleteTarget.is_group),
                ].join(" ")}
              >
                {deleteTarget.is_group ? (
                  <>
                    <FiUsers className="mr-1 text-[10px]" />
                    Group
                  </>
                ) : (
                  <>
                    <FiUser className="mr-1 text-[10px]" />
                    Personal
                  </>
                )}
              </span>
            </div>

            {deleteError && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-center text-[11.5px] text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300">
                {deleteError}
              </div>
            )}

            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className={[
                  "min-w-27.5 rounded-[10px] px-3 py-2 text-[11.5px] font-medium transition",
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
                  "min-w-27.5 rounded-[10px] px-3 py-2 text-[11.5px] font-medium transition",
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

export default Index;