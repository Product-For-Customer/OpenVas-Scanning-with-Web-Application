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
  FiRefreshCw,
  FiLink2,
  FiSettings,
  FiCpu,
  FiSlack,
  FiMail,
  FiEye,
  FiEyeOff,
  FiCopy,
} from "react-icons/fi";
import {
  FaTiktok,
  FaGoogle,
  FaYoutube,
  FaMicrosoft,
} from "react-icons/fa";
import {
  ListAppNotification,
  CreateAppNotification,
  UpdateAppNotificationByID,
  DeleteAppNotificationByID,
  ListAppLineMaster,
  CreateAppLineMaster,
  UpdateAppLineMasterByID,
  DeleteAppLineMasterByID,
  TestLineNotifyByAppNotificationID,
  type AppNotificationResponse,
  type AppLineMasterResponse,
} from "../../../services";

type SortKey = "Newest" | "Alert: On First" | "Alert: Off First";
type FormMode = "create" | "edit";

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

type LineMasterFormData = {
  name: string;
  token: string;
};

type UiApp = {
  id: number;
  name: string;
  token: string;
  category: string;
  description: string;
  icon: React.ReactNode;
  chipClass: string;
  iconWrapClass: string;
};

const normalizeText = (value?: string | null) => (value || "").trim();

const getCategoryFromName = (name: string) => {
  const lower = normalizeText(name).toLowerCase();

  if (lower.includes("slack")) return "Social Authority";
  if (lower.includes("google") || lower.includes("meet")) return "Management";
  if (lower.includes("tiktok")) return "Entertainment";
  if (lower.includes("excel") || lower.includes("microsoft")) return "Analytics";
  if (lower.includes("mail")) return "Business";
  if (lower.includes("youtube")) return "Entertainment";
  if (lower.includes("line")) return "Messaging";
  if (lower.includes("notify")) return "Notification";
  return "Integration";
};

const getDescriptionFromName = (name: string) => {
  const lower = normalizeText(name).toLowerCase();

  if (lower.includes("slack")) {
    return "Connect Slack for team alerts, updates, and workflow communication.";
  }
  if (lower.includes("google") || lower.includes("meet")) {
    return "Connect Google services to support meeting and management workflows.";
  }
  if (lower.includes("tiktok")) {
    return "Connect TikTok for content and social engagement workflows.";
  }
  if (lower.includes("excel") || lower.includes("microsoft")) {
    return "Connect Microsoft tools for reporting, analytics, and productivity.";
  }
  if (lower.includes("mail")) {
    return "Connect email services for notifications and communication.";
  }
  if (lower.includes("youtube")) {
    return "Connect YouTube for media and content-related workflows.";
  }
  if (lower.includes("line")) {
    return "Connect your LINE channel for notifications and automated message delivery.";
  }

  return "Manage and connect this integration to expand your workflow.";
};

const FiMessageSquareIcon: React.FC = () => <FiBell />;

const getMetaByName = (name: string) => {
  const lower = normalizeText(name).toLowerCase();

  if (lower.includes("slack")) {
    return {
      icon: <FiSlack />,
      chipClass:
        "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-300",
      iconWrapClass:
        "border-sky-200 bg-sky-50 text-sky-600 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-300",
    };
  }

  if (lower.includes("google") || lower.includes("meet")) {
    return {
      icon: <FaGoogle />,
      chipClass:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300",
      iconWrapClass:
        "border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300",
    };
  }

  if (lower.includes("tiktok")) {
    return {
      icon: <FaTiktok />,
      chipClass:
        "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-400/20 dark:bg-fuchsia-400/10 dark:text-fuchsia-300",
      iconWrapClass:
        "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-600 dark:border-fuchsia-400/20 dark:bg-fuchsia-400/10 dark:text-fuchsia-300",
    };
  }

  if (lower.includes("excel") || lower.includes("microsoft")) {
    return {
      icon: <FaMicrosoft />,
      chipClass:
        "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-400/20 dark:bg-teal-400/10 dark:text-teal-300",
      iconWrapClass:
        "border-teal-200 bg-teal-50 text-teal-600 dark:border-teal-400/20 dark:bg-teal-400/10 dark:text-teal-300",
    };
  }

  if (lower.includes("mail")) {
    return {
      icon: <FiMail />,
      chipClass:
        "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-300",
      iconWrapClass:
        "border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-300",
    };
  }

  if (lower.includes("youtube")) {
    return {
      icon: <FaYoutube />,
      chipClass:
        "border-red-200 bg-red-50 text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-300",
      iconWrapClass:
        "border-red-200 bg-red-50 text-red-600 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-300",
    };
  }

  if (lower.includes("line")) {
    return {
      icon: <FiMessageSquareIcon />,
      chipClass:
        "border-lime-200 bg-lime-50 text-lime-700 dark:border-lime-400/20 dark:bg-lime-400/10 dark:text-lime-300",
      iconWrapClass:
        "border-lime-200 bg-lime-50 text-lime-600 dark:border-lime-400/20 dark:bg-lime-400/10 dark:text-lime-300",
    };
  }

  return {
    icon: <FiCpu />,
    chipClass:
      "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-300",
    iconWrapClass:
      "border-cyan-200 bg-cyan-50 text-cyan-600 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-300",
  };
};

const mapToUiApp = (item: AppLineMasterResponse): UiApp => {
  const meta = getMetaByName(item.name);

  return {
    id: item.id,
    name: item.name,
    token: item.token,
    category: getCategoryFromName(item.name),
    description: getDescriptionFromName(item.name),
    icon: meta.icon,
    chipClass: meta.chipClass,
    iconWrapClass: meta.iconWrapClass,
  };
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

const modalBackdropClass =
  "fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-[2px]";

const modalCardClass =
  "relative w-full overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_24px_80px_-32px_rgba(15,23,42,0.38)] dark:border-white/10 dark:bg-[#08111f] dark:ring-1 dark:ring-white/10";

const sectionChipClass =
  "inline-flex items-center gap-1.5 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[10px] font-semibold text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-500/10 dark:text-cyan-300";

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
        "inline-flex items-center justify-center gap-1.5 rounded-2xl px-3 py-2 text-[11.5px] font-semibold transition",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
};

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
            Enable alerts for this receiver.
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
            Disable alerts for this receiver.
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
            For LINE groups and shared channels.
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
            For individual users and personal accounts.
          </p>
        </div>
      </button>
    </div>
  );
};

const Notify: React.FC = () => {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("Newest");
  const [openSort, setOpenSort] = useState(false);

  const [rows, setRows] = useState<UiNotification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  const [lineMasters, setLineMasters] = useState<AppLineMasterResponse[]>([]);
  const [loadingLineMasters, setLoadingLineMasters] = useState<boolean>(true);
  const [lineMasterError, setLineMasterError] = useState<string>("");
  const [lineMasterSearch, setLineMasterSearch] = useState("");

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

  // Line Master modal states
  const [masterFormOpen, setMasterFormOpen] = useState(false);
  const [masterFormMode, setMasterFormMode] = useState<FormMode>("create");
  const [masterSubmitting, setMasterSubmitting] = useState(false);
  const [masterFormError, setMasterFormError] = useState("");
  const [editingMaster, setEditingMaster] = useState<AppLineMasterResponse | null>(null);
  const [masterFormData, setMasterFormData] = useState<LineMasterFormData>({
    name: "",
    token: "",
  });
  const [showToken, setShowToken] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  const [masterDeleteOpen, setMasterDeleteOpen] = useState(false);
  const [masterDeleteTarget, setMasterDeleteTarget] =
    useState<AppLineMasterResponse | null>(null);
  const [masterDeleteError, setMasterDeleteError] = useState("");
  const [masterDeleting, setMasterDeleting] = useState(false);

  const lineMasterMap = useMemo(() => {
    return new Map<number, string>(
      lineMasters.map((item) => [item.id, item.name ?? `Line Master #${item.id}`])
    );
  }, [lineMasters]);

  const uiLineMasters = useMemo(() => {
    return lineMasters.map(mapToUiApp);
  }, [lineMasters]);

  const filteredLineMasters = useMemo(() => {
    const q = lineMasterSearch.trim().toLowerCase();

    return uiLineMasters.filter((item) => {
      const blob = [item.name, item.category, item.description]
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [uiLineMasters, lineMasterSearch]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      setError("");

      const data = await ListAppNotification();

      if (!data) {
        setRows([]);
        setError("Unable to load app notifications.");
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
      setError("Something went wrong while loading app notifications.");
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
        setLineMasterError("Unable to load line master data.");
        return;
      }

      setLineMasters(data);
    } catch (err) {
      console.error("fetchLineMasters error:", err);
      setLineMasters([]);
      setLineMasterError("Something went wrong while loading line master data.");
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
      await fetchNotifications();
    } catch (err: any) {
      setCreateError(
        err?.response?.data?.error ||
          err?.message ||
          "Something went wrong while creating app notification."
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
      await fetchNotifications();
    } catch (err: any) {
      setEditError(
        err?.response?.data?.error ||
          err?.message ||
          "Something went wrong while updating app notification."
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
          "Something went wrong while sending test LINE notification."
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
      await fetchNotifications();
    } catch (err: any) {
      setDeleteError(
        err?.response?.data?.error ||
          err?.message ||
          "Something went wrong while deleting app notification."
      );
    } finally {
      setDeleting(false);
    }
  };

  // ===== Line Master handlers =====
  const openCreateMasterModal = () => {
    setMasterFormMode("create");
    setEditingMaster(null);
    setMasterFormData({
      name: "",
      token: "",
    });
    setShowToken(false);
    setCopiedToken(false);
    setMasterFormError("");
    setMasterFormOpen(true);
  };

  const openEditMasterModal = (item: AppLineMasterResponse) => {
    setMasterFormMode("edit");
    setEditingMaster(item);
    setMasterFormData({
      name: item.name || "",
      token: item.token || "",
    });
    setShowToken(false);
    setCopiedToken(false);
    setMasterFormError("");
    setMasterFormOpen(true);
  };

  const closeMasterFormModal = () => {
    if (masterSubmitting) return;
    setMasterFormOpen(false);
    setMasterFormError("");
    setEditingMaster(null);
    setShowToken(false);
    setCopiedToken(false);
  };

  const validateMasterForm = () => {
    const name = normalizeText(masterFormData.name);
    const token = normalizeText(masterFormData.token);

    if (!name) {
      return "Please enter integration name.";
    }

    if (name.length < 2) {
      return "Integration name must be at least 2 characters.";
    }

    if (!token) {
      return "Please enter token.";
    }

    if (token.length < 6) {
      return "Token must be at least 6 characters.";
    }

    return "";
  };

  const handleCopyToken = async () => {
    const token = normalizeText(masterFormData.token);
    if (!token) return;

    try {
      await navigator.clipboard.writeText(token);
      setCopiedToken(true);
      window.setTimeout(() => setCopiedToken(false), 1500);
    } catch (err) {
      console.error("copy token error:", err);
    }
  };

  const handleSubmitMaster = async () => {
    const validationError = validateMasterForm();
    if (validationError) {
      setMasterFormError(validationError);
      return;
    }

    try {
      setMasterSubmitting(true);
      setMasterFormError("");

      const payload = {
        name: normalizeText(masterFormData.name),
        token: normalizeText(masterFormData.token),
      };

      if (masterFormMode === "create") {
        const res = await CreateAppLineMaster(payload);

        if (!res?.data) {
          setMasterFormError("Failed to create integration.");
          return;
        }

        setLineMasters((prev) => [res.data, ...prev]);
        setMasterFormOpen(false);

        setCreateForm((prev) => ({
          ...prev,
          app_line_master_id: String(res.data.id),
        }));

        setEditForm((prev) => ({
          ...prev,
          app_line_master_id:
            prev.app_line_master_id || String(res.data.id),
        }));

        return;
      }

      if (!editingMaster?.id) {
        setMasterFormError("Missing integration ID.");
        return;
      }

      const res = await UpdateAppLineMasterByID(editingMaster.id, payload);

      if (!res?.data) {
        setMasterFormError("Failed to update integration.");
        return;
      }

      setLineMasters((prev) =>
        prev.map((item) => (item.id === editingMaster.id ? res.data : item))
      );
      setMasterFormOpen(false);
    } catch (err) {
      console.error("handleSubmitMaster error:", err);
      setMasterFormError(
        masterFormMode === "create"
          ? "Failed to create integration."
          : "Failed to update integration."
      );
    } finally {
      setMasterSubmitting(false);
    }
  };

  const openDeleteMasterModal = (item: AppLineMasterResponse) => {
    setMasterDeleteTarget(item);
    setMasterDeleteError("");
    setMasterDeleteOpen(true);
  };

  const closeDeleteMasterModal = () => {
    if (masterDeleting) return;
    setMasterDeleteOpen(false);
    setMasterDeleteTarget(null);
    setMasterDeleteError("");
  };

  const handleDeleteMaster = async () => {
    if (!masterDeleteTarget?.id) {
      setMasterDeleteError("Missing integration ID.");
      return;
    }

    try {
      setMasterDeleting(true);
      setMasterDeleteError("");

      const res = await DeleteAppLineMasterByID(masterDeleteTarget.id);

      if (!res) {
        setMasterDeleteError("Failed to delete integration.");
        return;
      }

      setLineMasters((prev) =>
        prev.filter((item) => item.id !== masterDeleteTarget.id)
      );

      if (createForm.app_line_master_id === String(masterDeleteTarget.id)) {
        setCreateForm((prev) => ({
          ...prev,
          app_line_master_id: "",
        }));
      }

      if (editForm.app_line_master_id === String(masterDeleteTarget.id)) {
        setEditForm((prev) => ({
          ...prev,
          app_line_master_id: "",
        }));
      }

      setMasterDeleteOpen(false);
      setMasterDeleteTarget(null);
    } catch (err) {
      console.error("handleDeleteMaster error:", err);
      setMasterDeleteError("Failed to delete integration.");
    } finally {
      setMasterDeleting(false);
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
              className="h-full w-full text-slate-500 dark:text-white/15"
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
          {/* Header */}
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className={sectionChipClass}>
                <FiBell className="text-[10px]" />
                Notification Center
              </div>

              <h2 className="mt-2 text-[16px] font-semibold tracking-tight text-slate-900 sm:text-[18px] dark:text-white">
                Line Notification & Integration
              </h2>

              <p className="mt-1 text-[10.5px] sm:text-[11px] text-slate-500 dark:text-white/55">
                Manage notification receivers and connected line master integrations in one place.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <ActionButton
                onClick={fetchLineMasters}
                className="border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white/85 dark:hover:bg-white/10"
              >
                <FiRefreshCw className="text-[12px]" />
                Refresh Master
              </ActionButton>

              <ActionButton
                onClick={openCreateMasterModal}
                className="border border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100 dark:border-cyan-400/20 dark:bg-cyan-500/10 dark:text-cyan-300 dark:hover:bg-cyan-500/15"
              >
                <FiLink2 className="text-[12px]" />
                Add Line Master
              </ActionButton>

              <ActionButton
                onClick={openCreate}
                className="bg-[#6d5efc] text-white hover:bg-[#5f51eb]"
              >
                <FiPlus className="text-[12px]" />
                Add Notification
              </ActionButton>
            </div>
          </div>

          {/* Top area: Notification + Line Master */}
          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
            {/* Line Master panel */}
            <div className="xl:col-span-4">
              <div className="h-full rounded-[20px] border border-slate-200 bg-[#f9fcff] p-3 shadow-[0_10px_28px_-22px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-white/5 dark:ring-1 dark:ring-white/10 dark:shadow-none">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[10px] font-semibold text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-500/10 dark:text-cyan-300">
                      <FiSettings className="text-[10px]" />
                      App Line Master
                    </div>

                    <h3 className="mt-2 text-[14px] font-semibold text-slate-900 dark:text-white">
                      Integration List
                    </h3>

                    <p className="mt-1 text-[10.5px] leading-5 text-slate-500 dark:text-white/50">
                      Create, update, and manage integration tokens used by notifications.
                    </p>
                  </div>
                </div>

                <div className="mt-3 relative">
                  <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400 dark:text-white/35" />
                  <input
                    value={lineMasterSearch}
                    onChange={(e) => setLineMasterSearch(e.target.value)}
                    placeholder="Search integration..."
                    className="h-9 w-full rounded-2xl border border-slate-200 bg-white pl-9 pr-3 text-[11.5px] text-slate-800 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100 dark:border-white/10 dark:bg-white/5 dark:text-white/85 dark:placeholder:text-white/35 dark:focus:border-cyan-400/30 dark:focus:ring-cyan-400/10"
                  />
                </div>

                {lineMasterError && (
                  <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300">
                    {lineMasterError}
                  </div>
                )}

                <div className="mt-3 space-y-2 max-h-130 overflow-y-auto pr-1">
                  {loadingLineMasters ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-white/80 px-4 py-8 text-center text-[11.5px] text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-white/50">
                      Loading integrations...
                    </div>
                  ) : filteredLineMasters.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-white/80 px-4 py-8 text-center text-[11.5px] text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-white/50">
                      No integration found.
                    </div>
                  ) : (
                    filteredLineMasters.map((item) => {
                      const rawMaster =
                        lineMasters.find((m) => m.id === item.id) || null;

                      return (
                        <div
                          key={item.id}
                          className="rounded-[18px] border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-[#0b1628]/80"
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={[
                                "grid h-10 w-10 shrink-0 place-items-center rounded-2xl border text-[16px]",
                                item.iconWrapClass,
                              ].join(" ")}
                            >
                              {item.icon}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="truncate text-[12.5px] font-semibold text-slate-900 dark:text-white">
                                  {item.name}
                                </h4>
                                <span
                                  className={[
                                    "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                                    item.chipClass,
                                  ].join(" ")}
                                >
                                  {item.category}
                                </span>
                              </div>

                              <p className="mt-1 text-[10.5px] leading-5 text-slate-500 dark:text-white/50">
                                {item.description}
                              </p>

                              <div className="mt-2 flex items-center justify-between gap-2">
                                <span className="truncate text-[10px] text-slate-400 dark:text-white/35">
                                  ID: {item.id}
                                </span>

                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      rawMaster && openEditMasterModal(rawMaster)
                                    }
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-white/45 dark:hover:bg-white/10 dark:hover:text-white/80"
                                    title="Edit"
                                  >
                                    <FiEdit2 className="text-[12px]" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      rawMaster && openDeleteMasterModal(rawMaster)
                                    }
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-rose-500 transition hover:bg-rose-50 hover:text-rose-600 dark:text-rose-300 dark:hover:bg-rose-500/10"
                                    title="Delete"
                                  >
                                    <FiTrash2 className="text-[12px]" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Notification panel */}
            <div className="xl:col-span-8">
              <div className="h-full rounded-[20px] border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-[#0b1628]/80">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex-1">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="relative flex-1">
                        <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400 dark:text-white/35" />
                        <input
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder="Search name, send ID, group, personal, line master..."
                          className="h-9 w-full rounded-2xl border border-gray-200 bg-white pl-9 pr-3 text-[11.5px] text-slate-800 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100 dark:border-white/10 dark:bg-white/5 dark:text-white/85 dark:placeholder:text-white/35 dark:focus:border-violet-400/30 dark:focus:ring-violet-400/10"
                        />
                      </div>

                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={() => setOpenSort((prev) => !prev)}
                          className="inline-flex h-9 items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 text-[11.5px] font-medium text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white/85 dark:hover:bg-white/10"
                        >
                          <span>{sortBy}</span>
                          <FiChevronDown
                            className={`text-[12px] transition-transform ${
                              openSort ? "rotate-180" : ""
                            }`}
                          />
                        </button>

                        {openSort && (
                          <div className="absolute right-0 top-11 z-20 min-w-47.5 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-lg dark:border-white/10 dark:bg-[#0b1628]">
                            {(["Newest", "Alert: On First", "Alert: Off First"] as SortKey[]).map(
                              (option) => (
                                <button
                                  key={option}
                                  type="button"
                                  onClick={() => {
                                    setSortBy(option);
                                    setOpenSort(false);
                                  }}
                                  className={`flex w-full items-center rounded-xl px-3 py-2 text-left text-[11.5px] transition ${
                                    sortBy === option
                                      ? "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300"
                                      : "text-slate-700 hover:bg-slate-50 dark:text-white/80 dark:hover:bg-white/5"
                                  }`}
                                >
                                  {option}
                                </button>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300">
                    {error}
                  </div>
                )}

                <div className="mt-3 overflow-hidden rounded-[18px] border border-slate-200 dark:border-white/10">
                  <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse">
                      <thead className="bg-slate-50 dark:bg-white/5">
                        <tr>
                          <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-white/45">
                            Name
                          </th>
                          <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-white/45">
                            Send ID
                          </th>
                          <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-white/45">
                            Alert
                          </th>
                          <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-white/45">
                            Type
                          </th>
                          <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-white/45">
                            Line Master
                          </th>
                          <th className="px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-white/45">
                            Actions
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {loading ? (
                          <tr>
                            <td
                              colSpan={6}
                              className="px-3 py-10 text-center text-[11.5px] text-slate-500 dark:text-white/50"
                            >
                              Loading notifications...
                            </td>
                          </tr>
                        ) : notifications.length === 0 ? (
                          <tr>
                            <td
                              colSpan={6}
                              className="px-3 py-10 text-center text-[11.5px] text-slate-500 dark:text-white/50"
                            >
                              No notification found.
                            </td>
                          </tr>
                        ) : (
                          notifications.map((row) => {
                            const lineMasterName =
                              lineMasterMap.get(row.app_line_master_id) ||
                              `Line Master #${row.app_line_master_id}`;

                            return (
                              <tr
                                key={row.id}
                                className="border-t border-slate-200 bg-white transition hover:bg-slate-50/70 dark:border-white/10 dark:bg-transparent dark:hover:bg-white/5"
                              >
                                <td className="px-3 py-3 align-top">
                                  <div className="min-w-42.5">
                                    <div className="text-[11.5px] font-semibold text-slate-800 dark:text-white/90">
                                      {row.name}
                                    </div>
                                    <div className="mt-1 text-[10px] text-slate-400 dark:text-white/35">
                                      ID: {row.id}
                                    </div>
                                  </div>
                                </td>

                                <td className="px-3 py-3 align-top">
                                  <div className="min-w-45 text-[11px] text-slate-600 dark:text-white/65 break-all">
                                    {row.send_id || "-"}
                                  </div>
                                </td>

                                <td className="px-3 py-3 align-top">
                                  <span
                                    className={[
                                      "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                                      alertBadgeClass(row.alert),
                                    ].join(" ")}
                                  >
                                    {row.alert ? "On" : "Off"}
                                  </span>
                                </td>

                                <td className="px-3 py-3 align-top">
                                  <span
                                    className={[
                                      "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                                      typeBadgeClass(row.is_group),
                                    ].join(" ")}
                                  >
                                    {row.is_group ? (
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

                                <td className="px-3 py-3 align-top">
                                  <div className="min-w-37.5 text-[11px] text-slate-600 dark:text-white/65">
                                    {lineMasterName}
                                  </div>
                                </td>

                                <td className="px-3 py-3 align-top">
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      type="button"
                                      onClick={() => openTestLineModal(row)}
                                      className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-cyan-600 transition hover:bg-cyan-50 dark:text-cyan-300 dark:hover:bg-cyan-500/10"
                                      title="Test LINE"
                                    >
                                      <FiSend className="text-[12px]" />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => openEdit(row)}
                                      className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-white/45 dark:hover:bg-white/10 dark:hover:text-white/80"
                                      title="Edit"
                                    >
                                      <FiEdit2 className="text-[12px]" />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => openDeleteModal(row)}
                                      className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-rose-500 transition hover:bg-rose-50 hover:text-rose-600 dark:text-rose-300 dark:hover:bg-rose-500/10"
                                      title="Delete"
                                    >
                                      <FiTrash2 className="text-[12px]" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Create Notification Modal */}
      {openCreateModal && (
        <div className={modalBackdropClass}>
          <div className={`${modalCardClass} max-w-2xl`}>
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-white/10">
              <div>
                <h3 className="text-[16px] font-semibold text-slate-900 dark:text-white">
                  Create Notification
                </h3>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-white/50">
                  Add a new notification receiver and link it to a line master.
                </p>
              </div>

              <button
                type="button"
                onClick={closeCreate}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-white/45 dark:hover:bg-white/10 dark:hover:text-white/80"
              >
                <FiX className="text-[14px]" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className={labelClass}>Name</label>
                  <div className="relative">
                    <FiBell className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400 dark:text-white/35" />
                    <input
                      value={createForm.name}
                      onChange={(e) =>
                        setCreateForm((prev) => ({ ...prev, name: e.target.value }))
                      }
                      placeholder="Enter receiver name"
                      className={`${inputClass} pl-9`}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Send ID</label>
                  <div className="relative">
                    <FiHash className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400 dark:text-white/35" />
                    <input
                      value={createForm.send_id}
                      onChange={(e) =>
                        setCreateForm((prev) => ({ ...prev, send_id: e.target.value }))
                      }
                      placeholder="Enter send ID"
                      className={`${inputClass} pl-9`}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className={labelClass}>Receiver Type</label>
                <ReceiverTypeToggle
                  value={createForm.is_group}
                  onChange={(next) =>
                    setCreateForm((prev) => ({ ...prev, is_group: next }))
                  }
                />
              </div>

              <div>
                <label className={labelClass}>Alert Status</label>
                <AlertToggle
                  value={createForm.alert}
                  onChange={(next) =>
                    setCreateForm((prev) => ({ ...prev, alert: next }))
                  }
                />
              </div>

              <div>
                <label className={labelClass}>App Line Master</label>
                <div className="relative">
                  <FiLayers className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400 dark:text-white/35" />
                  <select
                    value={createForm.app_line_master_id}
                    onChange={(e) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        app_line_master_id: e.target.value,
                      }))
                    }
                    className={`${selectClass} pl-9`}
                  >
                    <option value="">Select line master</option>
                    {lineMasters.map((item) => (
                      <option key={item.id} value={String(item.id)}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {createError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11.5px] text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300">
                  {createError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-white/10">
              <ActionButton
                onClick={closeCreate}
                className="border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white/85 dark:hover:bg-white/10"
              >
                Cancel
              </ActionButton>

              <ActionButton
                onClick={submitCreate}
                disabled={creating}
                className="bg-[#6d5efc] text-white hover:bg-[#5f51eb]"
              >
                {creating ? "Creating..." : "Create Notification"}
              </ActionButton>
            </div>
          </div>
        </div>
      )}

      {/* Edit Notification Modal */}
      {openEditModal && (
        <div className={modalBackdropClass}>
          <div className={`${modalCardClass} max-w-2xl`}>
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-white/10">
              <div>
                <h3 className="text-[16px] font-semibold text-slate-900 dark:text-white">
                  Edit Notification
                </h3>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-white/50">
                  Update receiver information and alert settings.
                </p>
              </div>

              <button
                type="button"
                onClick={closeEdit}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-white/45 dark:hover:bg-white/10 dark:hover:text-white/80"
              >
                <FiX className="text-[14px]" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className={labelClass}>Name</label>
                  <div className="relative">
                    <FiBell className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400 dark:text-white/35" />
                    <input
                      value={editForm.name}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, name: e.target.value }))
                      }
                      placeholder="Enter receiver name"
                      className={`${inputClass} pl-9`}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Send ID</label>
                  <div className="relative">
                    <FiHash className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400 dark:text-white/35" />
                    <input
                      value={editForm.send_id}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, send_id: e.target.value }))
                      }
                      placeholder="Enter send ID"
                      className={`${inputClass} pl-9`}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className={labelClass}>Receiver Type</label>
                <ReceiverTypeToggle
                  value={editForm.is_group}
                  onChange={(next) =>
                    setEditForm((prev) => ({ ...prev, is_group: next }))
                  }
                />
              </div>

              <div>
                <label className={labelClass}>Alert Status</label>
                <AlertToggle
                  value={editForm.alert}
                  onChange={(next) =>
                    setEditForm((prev) => ({ ...prev, alert: next }))
                  }
                />
              </div>

              <div>
                <label className={labelClass}>App Line Master</label>
                <div className="relative">
                  <FiLayers className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400 dark:text-white/35" />
                  <select
                    value={editForm.app_line_master_id}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        app_line_master_id: e.target.value,
                      }))
                    }
                    className={`${selectClass} pl-9`}
                  >
                    <option value="">Select line master</option>
                    {lineMasters.map((item) => (
                      <option key={item.id} value={String(item.id)}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {editError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11.5px] text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300">
                  {editError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-white/10">
              <ActionButton
                onClick={closeEdit}
                className="border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white/85 dark:hover:bg-white/10"
              >
                Cancel
              </ActionButton>

              <ActionButton
                onClick={submitEdit}
                disabled={editing}
                className="bg-[#6d5efc] text-white hover:bg-[#5f51eb]"
              >
                {editing ? "Saving..." : "Save Changes"}
              </ActionButton>
            </div>
          </div>
        </div>
      )}

      {/* Test LINE Modal */}
      {openTestModal && (
        <div className={modalBackdropClass}>
          <div className={`${modalCardClass} max-w-xl`}>
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-white/10">
              <div>
                <h3 className="text-[16px] font-semibold text-slate-900 dark:text-white">
                  Test LINE Notification
                </h3>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-white/50">
                  Send a test message to this receiver.
                </p>
              </div>

              <button
                type="button"
                onClick={closeTestLineModal}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-white/45 dark:hover:bg-white/10 dark:hover:text-white/80"
              >
                <FiX className="text-[14px]" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-white/10 dark:bg-white/5">
                <div className="text-[11px] text-slate-500 dark:text-white/45">
                  Receiver
                </div>
                <div className="mt-1 text-[12px] font-semibold text-slate-800 dark:text-white">
                  {testTarget?.name || "-"}
                </div>
                <div className="mt-1 text-[10.5px] text-slate-500 dark:text-white/45 break-all">
                  Send ID: {testTarget?.send_id || "-"}
                </div>
              </div>

              <div>
                <label className={labelClass}>Message</label>
                <div className="relative">
                  <FiMessageSquare className="pointer-events-none absolute left-3 top-3 text-[12px] text-slate-400 dark:text-white/35" />
                  <textarea
                    value={testLineForm.message}
                    onChange={(e) =>
                      setTestLineForm((prev) => ({
                        ...prev,
                        message: e.target.value,
                      }))
                    }
                    placeholder="Enter test message..."
                    className={`${textareaClass} pl-9`}
                  />
                </div>
              </div>

              {testLineError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11.5px] text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300">
                  {testLineError}
                </div>
              )}

              {testLineSuccess && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11.5px] text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                  {testLineSuccess}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-white/10">
              <ActionButton
                onClick={closeTestLineModal}
                className="border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white/85 dark:hover:bg-white/10"
              >
                Cancel
              </ActionButton>

              <ActionButton
                onClick={submitTestLine}
                disabled={testingLine}
                className="bg-cyan-600 text-white hover:bg-cyan-700"
              >
                <FiSend className="text-[12px]" />
                {testingLine ? "Sending..." : "Send Test"}
              </ActionButton>
            </div>
          </div>
        </div>
      )}

      {/* Delete Notification Modal */}
      {deleteTarget && (
        <div className={modalBackdropClass}>
          <div className={`${modalCardClass} max-w-md p-5`}>
            <div className="mx-auto flex h-13 w-13 items-center justify-center rounded-full bg-[#ffe4dd]">
              <FiTrash2 className="text-[18px] text-[#ff5a3c]" />
            </div>

            <h3 className="mt-3.5 text-center text-[16px] font-semibold text-slate-800 dark:text-white">
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

      {/* Create / Edit Line Master Modal */}
      {masterFormOpen && (
        <div className={modalBackdropClass}>
          <div className={`${modalCardClass} max-w-2xl`}>
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-white/10">
              <div>
                <h3 className="text-[16px] font-semibold text-slate-900 dark:text-white">
                  {masterFormMode === "create" ? "Create Line Master" : "Edit Line Master"}
                </h3>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-white/50">
                  Manage integration name and token used by the notification system.
                </p>
              </div>

              <button
                type="button"
                onClick={closeMasterFormModal}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-white/45 dark:hover:bg-white/10 dark:hover:text-white/80"
              >
                <FiX className="text-[14px]" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              <div>
                <label className="mb-1.5 block text-[11.5px] font-medium text-slate-700 dark:text-white/75">
                  Integration Name
                </label>

                <div className="relative">
                  <FiSettings className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400 dark:text-white/35" />

                  <input
                    type="text"
                    value={masterFormData.name}
                    onChange={(e) =>
                      setMasterFormData((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="LINE Notify, Slack, Google Meet..."
                    className="h-9 w-full rounded-2xl border border-slate-200 bg-white pl-9 pr-3 text-[11.5px] text-slate-800 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100 dark:border-white/10 dark:bg-white/5 dark:text-white/85 dark:placeholder:text-white/30 dark:focus:border-cyan-400/30 dark:focus:ring-cyan-400/10"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[11.5px] font-medium text-slate-700 dark:text-white/75">
                  Token
                </label>

                <div className="relative">
                  <FiBell className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400 dark:text-white/35" />

                  <input
                    type={showToken ? "text" : "password"}
                    value={masterFormData.token}
                    onChange={(e) =>
                      setMasterFormData((prev) => ({ ...prev, token: e.target.value }))
                    }
                    placeholder="Enter token"
                    className="h-9 w-full rounded-2xl border border-slate-200 bg-white pl-9 pr-18 text-[11.5px] text-slate-800 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100 dark:border-white/10 dark:bg-white/5 dark:text-white/85 dark:placeholder:text-white/30 dark:focus:border-cyan-400/30 dark:focus:ring-cyan-400/10"
                  />

                  <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
                    <button
                      type="button"
                      onClick={handleCopyToken}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-white/45 dark:hover:bg-white/10 dark:hover:text-white/80"
                      title="Copy token"
                    >
                      <FiCopy className="text-[12px]" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowToken((prev) => !prev)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-white/45 dark:hover:bg-white/10 dark:hover:text-white/80"
                      title={showToken ? "Hide token" : "Show token"}
                    >
                      {showToken ? (
                        <FiEyeOff className="text-[12px]" />
                      ) : (
                        <FiEye className="text-[12px]" />
                      )}
                    </button>
                  </div>
                </div>

                {copiedToken && (
                  <p className="mt-1.5 text-[10.5px] text-emerald-600 dark:text-emerald-300">
                    Token copied to clipboard.
                  </p>
                )}
              </div>

              {masterFormError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11.5px] text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300">
                  {masterFormError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-white/10">
              <ActionButton
                onClick={closeMasterFormModal}
                className="border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white/85 dark:hover:bg-white/10"
              >
                Cancel
              </ActionButton>

              <ActionButton
                onClick={handleSubmitMaster}
                disabled={masterSubmitting}
                className="bg-cyan-600 text-white hover:bg-cyan-700"
              >
                {masterSubmitting
                  ? masterFormMode === "create"
                    ? "Creating..."
                    : "Saving..."
                  : masterFormMode === "create"
                  ? "Create Line Master"
                  : "Save Changes"}
              </ActionButton>
            </div>
          </div>
        </div>
      )}

      {/* Delete Line Master Modal */}
      {masterDeleteOpen && masterDeleteTarget && (
        <div className={modalBackdropClass}>
          <div className={`${modalCardClass} max-w-md p-5`}>
            <div className="mx-auto flex h-13 w-13 items-center justify-center rounded-full bg-[#ffe4dd]">
              <FiTrash2 className="text-[18px] text-[#ff5a3c]" />
            </div>

            <h3 className="mt-3.5 text-center text-[16px] font-semibold text-slate-800 dark:text-white">
              Delete Line Master
            </h3>

            <p className="mx-auto mt-1.5 max-w-95 text-center text-[11px] leading-5 text-slate-500 dark:text-white/55">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-slate-700 dark:text-white/80">
                {masterDeleteTarget.name}
              </span>
              ? This action cannot be undone.
            </p>

            {masterDeleteError && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-center text-[11.5px] text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300">
                {masterDeleteError}
              </div>
            )}

            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleDeleteMaster}
                disabled={masterDeleting}
                className={[
                  "min-w-27.5 rounded-[10px] px-3 py-2 text-[11.5px] font-medium transition",
                  "bg-[#f8dedd] text-[#ff5a3c] hover:bg-[#f4d2d1]",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                ].join(" ")}
              >
                {masterDeleting ? "Deleting..." : "Yes, Delete!"}
              </button>

              <button
                type="button"
                onClick={closeDeleteMasterModal}
                disabled={masterDeleting}
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

export default Notify;