import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { message } from "antd";
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
  FiLayers,
  FiUsers,
  FiUser,
  FiRefreshCw,
  FiLink2,
  FiCpu,
  FiSlack,
  FiMail,
  FiEye,
  FiEyeOff,
  FiCopy,
  FiChevronLeft,
  FiChevronRight,
  FiCommand,
  FiBox,
  FiSmartphone,
  FiCheck,
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
import { useLanguage } from "../../../contexts/LanguageContext";
import { useStateContext } from "../../../contexts/ProviderContext";

type SortKey = "Newest" | "Alert: On First" | "Alert: Off First";
type FormMode = "create" | "edit";

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

type LineMasterFormData = {
  name: string;
  description: string;
  token: string;
};

type UiApp = {
  id: number;
  name: string;
  token: string;
  app_user_id: number;
  category: string;
  description: string;
  icon: React.ReactNode;
  chipClass: string;
  iconWrapClass: string;
  cardClass: string;
};

const PAGE_SIZE = 3;

let notificationListCache: UiNotification[] | null = null;
let lineMasterListCache: AppLineMasterResponse[] | null = null;
let initialNotifyPageLoadPromise: Promise<void> | null = null;

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

const integrationPalettes = [
  {
    cardClass:
      "border-cyan-200/70 bg-linear-to-br from-cyan-50 via-white to-sky-50/70 hover:border-cyan-300 hover:shadow-[0_12px_30px_rgba(34,211,238,0.12)] dark:border-cyan-400/15 dark:bg-linear-to-br dark:from-[#0d2130] dark:via-[#10192a] dark:to-[#0b2030] dark:hover:border-cyan-400/30 dark:hover:bg-linear-to-br dark:hover:from-[#11283a] dark:hover:via-[#132033] dark:hover:to-[#0d2738]",
    chipClass:
      "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-300",
    iconWrapClass:
      "border-cyan-200 bg-cyan-50 text-cyan-600 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-300",
  },
  {
    cardClass:
      "border-violet-200/70 bg-linear-to-br from-violet-50 via-white to-fuchsia-50/70 hover:border-violet-300 hover:shadow-[0_12px_30px_rgba(139,92,246,0.12)] dark:border-violet-400/15 dark:bg-linear-to-br dark:from-[#1a1632] dark:via-[#13182a] dark:to-[#221530] dark:hover:border-violet-400/30 dark:hover:bg-linear-to-br dark:hover:from-[#211b3d] dark:hover:via-[#171d31] dark:hover:to-[#2a1a39]",
    chipClass:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/20 dark:bg-violet-400/10 dark:text-violet-300",
    iconWrapClass:
      "border-violet-200 bg-violet-50 text-violet-600 dark:border-violet-400/20 dark:bg-violet-400/10 dark:text-violet-300",
  },
  {
    cardClass:
      "border-emerald-200/70 bg-linear-to-br from-emerald-50 via-white to-lime-50/70 hover:border-emerald-300 hover:shadow-[0_12px_30px_rgba(16,185,129,0.12)] dark:border-emerald-400/15 dark:bg-linear-to-br dark:from-[#0f221d] dark:via-[#10192a] dark:to-[#13261f] dark:hover:border-emerald-400/30 dark:hover:bg-linear-to-br dark:hover:from-[#132b24] dark:hover:via-[#122033] dark:hover:to-[#183125]",
    chipClass:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300",
    iconWrapClass:
      "border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300",
  },
  {
    cardClass:
      "border-amber-200/70 bg-linear-to-br from-amber-50 via-white to-orange-50/70 hover:border-amber-300 hover:shadow-[0_12px_30px_rgba(245,158,11,0.12)] dark:border-amber-400/15 dark:bg-linear-to-br dark:from-[#23190f] dark:via-[#11192a] dark:to-[#2b1b10] dark:hover:border-amber-400/30 dark:hover:bg-linear-to-br dark:hover:from-[#2a1f12] dark:hover:via-[#152033] dark:hover:to-[#332112]",
    chipClass:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-300",
    iconWrapClass:
      "border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-300",
  },
  {
    cardClass:
      "border-rose-200/70 bg-linear-to-br from-rose-50 via-white to-pink-50/70 hover:border-rose-300 hover:shadow-[0_12px_30px_rgba(244,63,94,0.12)] dark:border-rose-400/15 dark:bg-linear-to-br dark:from-[#25121a] dark:via-[#11192a] dark:to-[#2a1320] dark:hover:border-rose-400/30 dark:hover:bg-linear-to-br dark:hover:from-[#2d1520] dark:hover:via-[#152033] dark:hover:to-[#321726]",
    chipClass:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-300",
    iconWrapClass:
      "border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-300",
  },
  {
    cardClass:
      "border-sky-200/70 bg-linear-to-br from-sky-50 via-white to-indigo-50/70 hover:border-sky-300 hover:shadow-[0_12px_30px_rgba(59,130,246,0.12)] dark:border-sky-400/15 dark:bg-linear-to-br dark:from-[#102033] dark:via-[#10192a] dark:to-[#15213a] dark:hover:border-sky-400/30 dark:hover:bg-linear-to-br dark:hover:from-[#132741] dark:hover:via-[#122033] dark:hover:to-[#182946]",
    chipClass:
      "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-300",
    iconWrapClass:
      "border-sky-200 bg-sky-50 text-sky-600 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-300",
  },
];

const hashText = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const getPaletteByName = (name: string) => {
  const index = hashText(normalizeText(name).toLowerCase() || "integration") % integrationPalettes.length;
  return integrationPalettes[index];
};

const getIconByName = (name: string) => {
  const lower = normalizeText(name).toLowerCase();

  if (lower.includes("line") || lower.includes("notify")) return <FiBell />;
  if (lower.includes("bot")) return <FiCommand />;
  if (lower.includes("device") || lower.includes("hardware") || lower.includes("sensor")) return <FiCpu />;
  if (lower.includes("mail")) return <FiMail />;
  if (lower.includes("send") || lower.includes("message")) return <FiSend />;
  if (lower.includes("group") || lower.includes("team")) return <FiUsers />;
  if (lower.includes("user") || lower.includes("personal")) return <FiUser />;
  if (lower.includes("slack")) return <FiSlack />;
  if (lower.includes("google") || lower.includes("meet")) return <FaGoogle />;
  if (lower.includes("youtube")) return <FaYoutube />;
  if (lower.includes("microsoft") || lower.includes("excel")) return <FaMicrosoft />;
  if (lower.includes("tiktok")) return <FaTiktok />;
  if (lower.includes("box") || lower.includes("package")) return <FiBox />;
  if (lower.includes("mobile") || lower.includes("phone")) return <FiSmartphone />;

  const fallbackIcons = [
    <FiBell key="bell" />,
    <FiCpu key="cpu" />,
    <FiCommand key="command" />,
    <FiSend key="send" />,
    <FiLayers key="layers" />,
    <FiLink2 key="link" />,
    <FiBox key="box" />,
    <FiSmartphone key="smartphone" />,
  ];

  return fallbackIcons[hashText(lower || "integration") % fallbackIcons.length];
};

const mapToUiApp = (item: AppLineMasterResponse): UiApp => {
  const palette = getPaletteByName(item.name);

  return {
    id: item.id,
    name: item.name,
    token: item.token,
    app_user_id: Number(item.app_user_id ?? 0),
    category: getCategoryFromName(item.name),
    description: normalizeText(item.description) || getDescriptionFromName(item.name),
    icon: getIconByName(item.name),
    chipClass: palette.chipClass,
    iconWrapClass: palette.iconWrapClass,
    cardClass: palette.cardClass,
  };
};

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

const inputClass = [
  "h-10 w-full rounded-lg px-3 text-[12px] outline-none transition",
  "border border-slate-200/70 bg-white text-slate-800 placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100",
  "dark:border-white/8 dark:bg-white/5 dark:text-white/85 dark:placeholder:text-white/30 dark:focus:border-blue-400/30 dark:focus:ring-blue-400/10",
].join(" ");

const textareaClass = [
  "w-full min-h-24 rounded-lg px-3 py-2.5 text-[12px] outline-none transition resize-none",
  "border border-slate-200/70 bg-white text-slate-800 placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100",
  "dark:border-white/8 dark:bg-white/5 dark:text-white/85 dark:placeholder:text-white/30 dark:focus:border-blue-400/30 dark:focus:ring-blue-400/10",
].join(" ");

const labelClass =
  "mb-1.5 block text-[11px] font-medium text-slate-700 dark:text-white/70";

const modalBackdropClass =
  "absolute inset-0 z-[300] flex items-center justify-center bg-slate-900/0 p-4";

const modalCardClass =
  "relative w-full overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-xl dark:border-white/10 dark:bg-[#0d0b1a]";


const createGradientBtn = [
  "flex h-8 items-center justify-center gap-1.5 rounded-lg px-3.5",
  "text-[11px] font-medium text-white transition hover:opacity-90",
].join(" ");

const editGradientIconBtn = [
  "inline-flex h-8 w-8 items-center justify-center rounded-full",
  "text-white shadow-sm transition-all duration-200",
  "bg-linear-to-r from-sky-400 via-blue-400 to-indigo-500",
  "hover:from-sky-500 hover:via-blue-500 hover:to-indigo-600",
  "focus:outline-none focus:ring-2 focus:ring-sky-200",
  "dark:focus:ring-sky-500/30",
].join(" ");

const deleteGradientIconBtn = [
  "inline-flex h-8 w-8 items-center justify-center rounded-full",
  "text-white shadow-sm transition-all duration-200",
  "bg-linear-to-r from-rose-400 via-red-400 to-rose-500",
  "hover:from-rose-500 hover:via-red-500 hover:to-rose-600",
  "focus:outline-none focus:ring-2 focus:ring-red-200",
  "dark:focus:ring-red-500/30",
].join(" ");


const notifyPrimaryGradientBtn = [
  "inline-flex h-10 items-center justify-center gap-2 rounded-full px-4",
  "text-white shadow-sm transition-all duration-200",
  "bg-linear-to-r from-cyan-500 via-sky-500 to-blue-600",
  "hover:from-cyan-600 hover:via-sky-600 hover:to-blue-700",
  "focus:outline-none focus:ring-2 focus:ring-sky-200",
  "disabled:cursor-not-allowed disabled:opacity-60",
  "dark:focus:ring-sky-500/30",
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
          "rounded-xl border px-3 py-3 text-left transition",
          value
            ? "border-emerald-300 bg-emerald-50 dark:border-emerald-400/30 dark:bg-emerald-500/10"
            : "border-slate-200 bg-white dark:border-white/10 dark:bg-white/5",
        ].join(" ")}
      >
        <div className="mb-2 flex items-center justify-between">
          <span
            className={[
              "grid h-8 w-8 place-items-center rounded-lg border",
              value
                ? "border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-300"
                : "border-slate-200 bg-slate-50 text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-white/45",
            ].join(" ")}
          >
            <FiCheckCircle className="text-[14px]" />
          </span>
          <span
            className={[
              "h-2.5 w-2.5 rounded-full",
              value ? "bg-emerald-500" : "bg-slate-300 dark:bg-white/20",
            ].join(" ")}
          />
        </div>
        <p className="text-[12px] font-semibold text-slate-800 dark:text-white/85">
          Alert On
        </p>
        <p className="mt-0.5 text-[10.5px] text-slate-500 dark:text-white/45">
          Enable alerts
        </p>
      </button>

      <button
        type="button"
        onClick={() => onChange(false)}
        className={[
          "rounded-xl border px-3 py-3 text-left transition",
          !value
            ? "border-rose-300 bg-rose-50 dark:border-rose-400/30 dark:bg-rose-500/10"
            : "border-slate-200 bg-white  dark:border-white/10 dark:bg-white/5",
        ].join(" ")}
      >
        <div className="mb-2 flex items-center justify-between">
          <span
            className={[
              "grid h-8 w-8 place-items-center rounded-lg border",
              !value
                ? "border-rose-300 bg-rose-100 text-rose-700 dark:border-rose-400/30 dark:bg-rose-500/15 dark:text-rose-300"
                : "border-slate-200 bg-slate-50 text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-white/45",
            ].join(" ")}
          >
            <FiAlertCircle className="text-[14px]" />
          </span>
          <span
            className={[
              "h-2.5 w-2.5 rounded-full",
              !value ? "bg-rose-500" : "bg-slate-300 dark:bg-white/20",
            ].join(" ")}
          />
        </div>
        <p className="text-[12px] font-semibold text-slate-800 dark:text-white/85">
          Alert Off
        </p>
        <p className="mt-0.5 text-[10.5px] text-slate-500 dark:text-white/45">
          Disable alerts
        </p>
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
          "rounded-xl border px-3 py-3 text-left transition",
          value
            ? "border-cyan-300 bg-cyan-50 dark:border-cyan-400/30 dark:bg-cyan-500/10"
            : "border-slate-200 bg-white  dark:border-white/10 dark:bg-white/5",
        ].join(" ")}
      >
        <div className="mb-2 flex items-center justify-between">
          <span
            className={[
              "grid h-8 w-8 place-items-center rounded-lg border",
              value
                ? "border-cyan-300 bg-cyan-100 text-cyan-700 dark:border-cyan-400/30 dark:bg-cyan-500/15 dark:text-cyan-300"
                : "border-slate-200 bg-slate-50 text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-white/45",
            ].join(" ")}
          >
            <FiUsers className="text-[14px]" />
          </span>
          <span
            className={[
              "h-2.5 w-2.5 rounded-full",
              value ? "bg-cyan-500" : "bg-slate-300 dark:bg-white/20",
            ].join(" ")}
          />
        </div>
        <p className="text-[12px] font-semibold text-slate-800 dark:text-white/85">
          Group
        </p>
        <p className="mt-0.5 text-[10.5px] text-slate-500 dark:text-white/45">
          Shared channel
        </p>
      </button>

      <button
        type="button"
        onClick={() => onChange(false)}
        className={[
          "rounded-xl border px-3 py-3 text-left transition",
          !value
            ? "border-violet-300 bg-violet-50 dark:border-violet-400/30 dark:bg-violet-500/10"
            : "border-slate-200 bg-white  dark:border-white/10 dark:bg-white/5",
        ].join(" ")}
      >
        <div className="mb-2 flex items-center justify-between">
          <span
            className={[
              "grid h-8 w-8 place-items-center rounded-lg border",
              !value
                ? "border-violet-300 bg-violet-100 text-violet-700 dark:border-violet-400/30 dark:bg-violet-500/15 dark:text-violet-300"
                : "border-slate-200 bg-slate-50 text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-white/45",
            ].join(" ")}
          >
            <FiUser className="text-[14px]" />
          </span>
          <span
            className={[
              "h-2.5 w-2.5 rounded-full",
              !value ? "bg-violet-500" : "bg-slate-300 dark:bg-white/20",
            ].join(" ")}
          />
        </div>
        <p className="text-[12px] font-semibold text-slate-800 dark:text-white/85">
          Personal
        </p>
        <p className="mt-0.5 text-[10.5px] text-slate-500 dark:text-white/45">
          Single user
        </p>
      </button>
    </div>
  );
};

const LineMasterSelector: React.FC<{
  value: string;
  onChange: (next: string) => void;
  options: AppLineMasterResponse[];
  disabled?: boolean;
  placeholder?: string;
}> = ({ value, onChange, options, disabled = false, placeholder = "Select integration" }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(
    () => options.find((item) => String(item.id) === String(value)),
    [options, value],
  );

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;

    return options.filter((item) => {
      const blob = [item.name, item.description, item.token].join(" ").toLowerCase();
      return blob.includes(q);
    });
  }, [options, search]);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((prev) => !prev)}
        disabled={disabled}
        className={[
          "group w-full min-h-11 rounded-xl px-3 text-left transition-all duration-200",
          "border border-slate-300 bg-white",
          "hover:border-cyan-300 hover:bg-cyan-50/40",
          "focus:outline-none focus:ring-4 focus:ring-cyan-100/80",
          "disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100",
          "dark:border-[#23314d] dark:bg-[#182338]",
          "dark:hover:border-cyan-400/35 dark:hover:bg-[#1d2b45]",
          "dark:focus:border-cyan-400/30 dark:focus:ring-cyan-400/10",
          open ? "border-cyan-300 bg-cyan-50/50 dark:border-cyan-400/35 dark:bg-[#1b2a44]" : "",
        ].join(" ")}
      >
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-200">
            {selected ? getIconByName(selected.name) : <FiBell className="text-[11px]" />}
          </span>

          <span className="min-w-0 flex-1">
            <span className={[
              "block truncate text-[12px] font-semibold",
              selected ? "text-slate-800 dark:text-slate-100" : "text-slate-500 dark:text-white/45",
            ].join(" ")}>
              {selected?.name || placeholder}
            </span>
          </span>

          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-600 transition group-hover:border-cyan-200 group-hover:text-cyan-700 dark:border-white/10 dark:bg-white/5 dark:text-white/65 dark:group-hover:border-cyan-400/20 dark:group-hover:bg-cyan-400/10 dark:group-hover:text-cyan-200">
            <FiChevronDown className={`text-[12px] transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
          </span>
        </div>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xl dark:border-white/10 dark:bg-[#0d0b1a]">
          <div className="border-b border-slate-100 px-3 py-2 dark:border-white/8">
            <span className="text-[10px] font-medium text-slate-500 dark:text-white/45">
              Select integration
            </span>
          </div>

          <div className="border-b border-slate-100 p-2 dark:border-white/8">
            <div className="relative">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400 dark:text-white/35" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search integration..."
                className="h-10 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-[12px] outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100 dark:border-white/10 dark:bg-white/5 dark:text-white/85 dark:placeholder:text-white/35 dark:focus:border-cyan-400/30 dark:focus:ring-cyan-400/10"
              />
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto p-2">
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                  setSearch("");
                }}
                className={[
                  "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-all duration-150",
                  !value
                    ? "border border-cyan-200 bg-cyan-50 shadow-[0_4px_14px_rgba(34,211,238,0.08)] dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:shadow-none"
                    : "border border-transparent hover:bg-slate-50 dark:hover:bg-white/5",
                ].join(" ")}
              >
                <span className={[
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition",
                  !value
                    ? "border-cyan-500 bg-cyan-500 text-white"
                    : "border-slate-300 bg-white text-transparent dark:border-white/15 dark:bg-[#162136]",
                ].join(" ")}>
                  <FiCheck className="text-[10px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] font-medium text-slate-700 dark:text-white/85">
                    {placeholder}
                  </span>
                </span>
              </button>

              {filteredOptions.map((item) => {
                const checked = String(value) === String(item.id);
                const palette = getPaletteByName(item.name);

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onChange(String(item.id));
                      setOpen(false);
                      setSearch("");
                    }}
                    className={[
                      "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-all duration-150",
                      checked
                        ? "border border-cyan-200 bg-cyan-50 shadow-[0_4px_14px_rgba(34,211,238,0.08)] dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:shadow-none"
                        : "border border-transparent hover:bg-slate-50 dark:hover:bg-white/5",
                    ].join(" ")}
                  >
                    <span className={[
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition",
                      checked
                        ? "border-cyan-500 bg-cyan-500 text-white"
                        : "border-slate-300 bg-white text-transparent dark:border-white/15 dark:bg-[#162136]",
                    ].join(" ")}>
                      <FiCheck className="text-[10px]" />
                    </span>

                    <span className={[
                      "grid h-8 w-8 shrink-0 place-items-center rounded-xl border text-[14px]",
                      palette.iconWrapClass,
                    ].join(" ")}>
                      {getIconByName(item.name)}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-medium text-slate-700 dark:text-white/85">
                        {item.name}
                      </span>
                      <span className="mt-0.5 block truncate text-[10px] text-slate-500 dark:text-white/45">
                        {normalizeText(item.description) || getDescriptionFromName(item.name)}
                      </span>
                    </span>
                  </button>
                );
              })}

              {filteredOptions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 px-3 py-6 text-center text-[11px] text-slate-500 dark:border-white/10 dark:text-white/45">
                  No integration found
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const index: React.FC = () => {
  const { t } = useLanguage();
  const { currentColor } = useStateContext();
  const accentGrad = `linear-gradient(135deg, ${currentColor}, color-mix(in srgb, ${currentColor} 65%, #a855f7))`;
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("Newest");
  const [openSort, setOpenSort] = useState(false);
  const [openIntegrationMenu, setOpenIntegrationMenu] = useState(false);

  const [rows, setRows] = useState<UiNotification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  const [lineMasters, setLineMasters] = useState<AppLineMasterResponse[]>([]);
  const [loadingLineMasters, setLoadingLineMasters] = useState<boolean>(true);
  const [lineMasterError, setLineMasterError] = useState<string>("");
  const [lineMasterSearch, setLineMasterSearch] = useState("");
  const integrationMenuRef = useRef<HTMLDivElement | null>(null);

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

  const [masterFormOpen, setMasterFormOpen] = useState(false);
  const [masterFormMode, setMasterFormMode] = useState<FormMode>("create");
  const [masterSubmitting, setMasterSubmitting] = useState(false);
  const [masterFormError, setMasterFormError] = useState("");
  const [editingMaster, setEditingMaster] = useState<AppLineMasterResponse | null>(null);
  const [masterFormData, setMasterFormData] = useState<LineMasterFormData>({
    name: "",
    description: "",
    token: "",
  });
  const [showToken, setShowToken] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  const [masterDeleteOpen, setMasterDeleteOpen] = useState(false);
  const [masterDeleteTarget, setMasterDeleteTarget] =
    useState<AppLineMasterResponse | null>(null);
  const [masterDeleteError, setMasterDeleteError] = useState("");
  const [masterDeleting, setMasterDeleting] = useState(false);

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

  const masterFormSnapshot = useMemo(
    () =>
      JSON.stringify({
        name: normalizeText(masterFormData.name),
        description: normalizeText(masterFormData.description),
        token: normalizeText(masterFormData.token),
      }),
    [masterFormData],
  );

  const editingMasterSnapshot = useMemo(
    () =>
      editingMaster
        ? JSON.stringify({
            name: normalizeText(editingMaster.name || ""),
            description: normalizeText(editingMaster.description || ""),
            token: normalizeText(editingMaster.token || ""),
          })
        : "",
    [editingMaster],
  );

  const isBotEditChanged =
    masterFormMode === "create" ? true : Boolean(editingMaster) && masterFormSnapshot !== editingMasterSnapshot;


  const lineMasterMap = useMemo(() => {
    return new Map<number, string>(
      lineMasters.map((item) => [item.id, item.name ?? `Line Master #${item.id}`]),
    );
  }, [lineMasters]);

  const uiLineMasters = useMemo(() => {
    return lineMasters.map(mapToUiApp);
  }, [lineMasters]);

  const filteredLineMasters = useMemo(() => {
    const q = lineMasterSearch.trim().toLowerCase();

    return uiLineMasters.filter((item) => {
      const blob = [
        item.name,
        item.category,
        item.description,
        String(item.app_user_id || ""),
      ].join(" ").toLowerCase();
      return blob.includes(q);
    });
  }, [uiLineMasters, lineMasterSearch]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (integrationMenuRef.current && !integrationMenuRef.current.contains(event.target as Node)) {
        setOpenIntegrationMenu(false);
      }
    };

    if (openIntegrationMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openIntegrationMenu]);

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
      setLineMasterError("");

      if (!force && lineMasterListCache) {
        setLineMasters(lineMasterListCache);
        return lineMasterListCache;
      }

      const data = await ListAppLineMaster();

      if (!data) {
        lineMasterListCache = [];
        setLineMasters([]);
        setLineMasterError("Unable to load line master data.");
        return [];
      }

      lineMasterListCache = data;
      setLineMasters(data);
      return data;
    } catch (err) {
      console.error("fetchLineMasters error:", err);
      lineMasterListCache = null;
      setLineMasters([]);
      setLineMasterError("Something went wrong while loading line master data.");
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
      setLineMasterError("");
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

    let filtered = rows.filter((item) => {
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

  useEffect(() => {
    setNotifyPage(1);
  }, [search, sortBy, rows.length]);

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

  const openCreateMasterModal = () => {
    setMasterFormMode("create");
    setEditingMaster(null);
    setMasterFormData({
      name: "",
      description: "",
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
      description: item.description || "",
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
    const description = normalizeText(masterFormData.description);
    const token = normalizeText(masterFormData.token);

    if (!name) return "Please enter integration name.";
    if (name.length < 2) return "Integration name must be at least 2 characters.";
    if (!description) return "Please enter description.";
    if (description.length < 2) return "Description must be at least 2 characters.";
    if (!token) return "Please enter token.";
    if (token.length < 6) return "Token must be at least 6 characters.";

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
        description: normalizeText(masterFormData.description),
        token: normalizeText(masterFormData.token),
      };

      if (masterFormMode === "create") {
        const res = await CreateAppLineMaster(payload);

        if (!res?.data) {
          setMasterFormError("Failed to create integration.");
          return;
        }

        setLineMasters((prev) => {
          const next = [res.data, ...prev];
          lineMasterListCache = next;
          return next;
        });
        setMasterFormOpen(false);

        setCreateForm((prev) => ({
          ...prev,
          app_line_master_id: String(res.data.id),
        }));

        setEditForm((prev) => ({
          ...prev,
          app_line_master_id: prev.app_line_master_id || String(res.data.id),
        }));

        message.success("create success");
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

      setLineMasters((prev) => {
        const next = prev.map((item) =>
          item.id === editingMaster.id ? res.data : item,
        );
        lineMasterListCache = next;
        return next;
      });
      setMasterFormOpen(false);
      message.success("update success");
    } catch (err: any) {
      setMasterFormError(
        err?.response?.data?.error ||
          err?.message ||
          (masterFormMode === "create"
            ? "Failed to create integration."
            : "Failed to update integration."),
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

      setLineMasters((prev) => {
        const next = prev.filter((item) => item.id !== masterDeleteTarget.id);
        lineMasterListCache = next;
        return next;
      });

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
      message.success("delete success");
    } catch (err) {
      console.error("handleDeleteMaster error:", err);
      setMasterDeleteError("Failed to delete integration.");
    } finally {
      setMasterDeleting(false);
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
          <button type="button" onClick={openCreate} className={notifyPrimaryGradientBtn}>
            <FiPlus className="text-[12px]" />
            <span className="text-[11px] font-medium">Add Notify</span>
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
      <section className={cardGlowClass}>
        <div className="flex h-full flex-col">

          {/* ── Top bar: title + action buttons ── */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <h2 className="text-[13px] font-semibold text-slate-700 dark:text-white/80">
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

              <div className="relative" ref={integrationMenuRef}>
                <ActionButton
                  onClick={() => setOpenIntegrationMenu((prev) => !prev)}
                  className="border border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100 dark:border-cyan-400/20 dark:bg-cyan-500/10 dark:text-cyan-300 dark:hover:bg-cyan-500/15"
                >
                  <FiLink2 className="text-[13px]" />
                  Integrations
                  <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-200">
                    {filteredLineMasters.length}
                  </span>
                  <FiChevronDown
                    className={`text-[13px] transition-transform duration-200 ${openIntegrationMenu ? "rotate-180" : ""}`}
                  />
                </ActionButton>

                {openIntegrationMenu && (
                  <div className="absolute right-0 z-30 mt-2 w-[min(92vw,420px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-[#0b1525]">
                    <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-white/10">
                      <div>
                        <h3 className="text-[13px] font-semibold text-slate-800 dark:text-white/85">
                          Integration List
                        </h3>
                        <p className="mt-0.5 text-[10.5px] text-slate-500 dark:text-white/45">
                          Connected channels and apps
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={openCreateMasterModal}
                        className={createGradientBtn}
                        style={{ background: accentGrad }}
                      >
                        <FiPlus className="text-[12px]" />
                        <span className="text-[11px] font-medium">Bot</span>
                      </button>
                    </div>

                    <div className="border-b border-slate-200 px-4 py-3 dark:border-white/10">
                      <div className="relative">
                        <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400 dark:text-white/35" />
                        <input
                          value={lineMasterSearch}
                          onChange={(e) => setLineMasterSearch(e.target.value)}
                          placeholder="Search integration..."
                          className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-[12px] outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100 dark:border-white/10 dark:bg-white/5 dark:text-white/85 dark:placeholder:text-white/35 dark:focus:border-cyan-400/30 dark:focus:ring-cyan-400/10"
                        />
                      </div>
                    </div>

                    <div className="max-h-100 overflow-y-auto p-3">
                      {loadingLineMasters ? (
                        <div className="flex min-h-40 items-center justify-center text-[12px] text-slate-500 dark:text-white/45">
                          Loading integrations...
                        </div>
                      ) : lineMasterError ? (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200">
                          {lineMasterError}
                        </div>
                      ) : filteredLineMasters.length === 0 ? (
                        <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-slate-200 text-[12px] text-slate-500 dark:border-white/10 dark:text-white/45">
                          No integration found
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {filteredLineMasters.map((item) => (
                            <div
                              key={item.id}
                              className={["group rounded-xl p-3 transition-all duration-200", item.cardClass].join(" ")}
                            >
                              <div className="flex items-start gap-3">
                                <div
                                  className={[
                                    "grid h-10 w-10 shrink-0 place-items-center rounded-xl border text-[15px]",
                                    item.iconWrapClass,
                                  ].join(" ")}
                                >
                                  {item.icon}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-[12px] font-semibold text-slate-800 dark:text-white/85">
                                    {item.name}
                                  </p>

                                  <p className="mt-2 line-clamp-2 text-[11px] leading-5 text-slate-600 dark:text-white/55">
                                    {item.description}
                                  </p>

                                  <div className="mt-3 flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openEditMasterModal(
                                          lineMasters.find((m) => m.id === item.id)!,
                                        )
                                      }
                                      className={editGradientIconBtn}
                                      title="Edit Bot LINE"
                                    >
                                      <FiEdit2 className="text-[13px]" />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        openDeleteMasterModal(
                                          lineMasters.find((m) => m.id === item.id)!,
                                        )
                                      }
                                      className={deleteGradientIconBtn}
                                      title="Delete Bot LINE"
                                    >
                                      <FiTrash2 className="text-[13px]" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={openCreate}
                className={notifyPrimaryGradientBtn}
              >
                <FiPlus className="text-[12px]" />
                <span className="text-[11px] font-medium">Add Notify</span>
              </button>
            </div>
          </div>

          {/* ── Search + sort toolbar ── */}
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

            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenSort((prev) => !prev)}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-medium text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white/75 dark:hover:bg-white/10"
              >
                {sortBy}
                <FiChevronDown className={`text-[12px] transition ${openSort ? "rotate-180" : ""}`} />
              </button>
              {openSort && (
                <div className="absolute right-0 top-[calc(100%+6px)] z-20 w-45 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-[#10192a]">
                  {(["Newest", "Alert: On First", "Alert: Off First"] as SortKey[]).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => { setSortBy(item); setOpenSort(false); }}
                      className={["flex w-full items-center justify-between px-3 py-2.5 text-left text-[12px] transition hover:bg-slate-50 dark:hover:bg-white/5",
                        sortBy === item ? "text-violet-700 dark:text-violet-300" : "text-slate-700 dark:text-white/70"].join(" ")}
                    >
                      {item}
                      {sortBy === item ? <FiCheck className="text-[12px]" /> : null}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Table ── */}
          <div className="mt-3">
            {renderNotificationTable()}
          </div>
        </div>
      </section>

      {openCreateModal && (
        <div className={modalBackdropClass}>
          <div className={`${modalCardClass} max-w-2xl`}>
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-white/10">
              <div>
                <h3 className="text-[16px] font-semibold text-slate-900 dark:text-white">
                  Create Notification
                </h3>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-white/45">
                  Add a new receiver for LINE messages.
                </p>
              </div>
              <button
                type="button"
                onClick={closeCreate}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-white/70 dark:hover:bg-white/5"
              >
                <FiX />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              {createError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[12px] text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200">
                  {createError}
                </div>
              ) : null}

              <div>
                <label className={labelClass}>Name</label>
                <input
                  className={inputClass}
                  value={createForm.name}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="Receiver name"
                />
              </div>

              <div>
                <label className={labelClass}>Send ID</label>
                <input
                  className={inputClass}
                  value={createForm.send_id}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, send_id: e.target.value }))
                  }
                  placeholder="LINE user ID / group ID"
                />
              </div>

              <div>
                <label className={labelClass}>App Line Master</label>
                <LineMasterSelector
                  value={createForm.app_line_master_id}
                  onChange={(next) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      app_line_master_id: next,
                    }))
                  }
                  options={lineMasters}
                  disabled={loadingLineMasters}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className={labelClass}>Alert</label>
                  <AlertToggle
                    value={createForm.alert}
                    onChange={(next) =>
                      setCreateForm((prev) => ({ ...prev, alert: next }))
                    }
                  />
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
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-white/10">
              <ActionButton
                onClick={closeCreate}
                className="border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white/75 dark:hover:bg-white/10"
              >
                Cancel
              </ActionButton>
              <ActionButton
                onClick={submitCreate}
                disabled={creating}
                className="bg-cyan-600 text-white hover:bg-cyan-700"
              >
                {creating ? "Creating..." : "Create"}
              </ActionButton>
            </div>
          </div>
        </div>
      )}

      {openEditModal && selectedRow && (
        <div className={modalBackdropClass}>
          <div className={`${modalCardClass} max-w-2xl`}>
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-white/10">
              <div>
                <h3 className="text-[16px] font-semibold text-slate-900 dark:text-white">
                  Edit Notification
                </h3>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-white/45">
                  Update selected receiver data.
                </p>
              </div>
              <button
                type="button"
                onClick={closeEdit}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-white/70 dark:hover:bg-white/5"
              >
                <FiX />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              {editError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[12px] text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200">
                  {editError}
                </div>
              ) : null}

              <div>
                <label className={labelClass}>Name</label>
                <input
                  className={inputClass}
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="Receiver name"
                />
              </div>

              <div>
                <label className={labelClass}>Send ID</label>
                <input
                  className={inputClass}
                  value={editForm.send_id}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, send_id: e.target.value }))
                  }
                  placeholder="LINE user ID / group ID"
                />
              </div>

              <div>
                <label className={labelClass}>App Line Master</label>
                <LineMasterSelector
                  value={editForm.app_line_master_id}
                  onChange={(next) =>
                    setEditForm((prev) => ({
                      ...prev,
                      app_line_master_id: next,
                    }))
                  }
                  options={lineMasters}
                  disabled={loadingLineMasters}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className={labelClass}>Alert</label>
                  <AlertToggle
                    value={editForm.alert}
                    onChange={(next) =>
                      setEditForm((prev) => ({ ...prev, alert: next }))
                    }
                  />
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
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-white/10">
              <ActionButton
                onClick={closeEdit}
                className="border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white/75 dark:hover:bg-white/10"
              >
                Cancel
              </ActionButton>
              <ActionButton
                onClick={submitEdit}
                disabled={editing || !isNotifyEditChanged}
                className="bg-cyan-600 text-white hover:bg-cyan-700"
              >
                {editing ? "Saving..." : "Save"}
              </ActionButton>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
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
        </div>
      )}

      {openTestModal && testTarget && (
        <div className={modalBackdropClass}>
          <div className={`${modalCardClass} max-w-lg`}>
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-white/10">
              <div>
                <h3 className="text-[16px] font-semibold text-slate-900 dark:text-white">
                  Test LINE Message
                </h3>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-white/45">
                  Send a test message to selected receiver.
                </p>
              </div>
              <button
                type="button"
                onClick={closeTestLineModal}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-white/70 dark:hover:bg-white/5"
              >
                <FiX />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              {testLineError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[12px] text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200">
                  {testLineError}
                </div>
              ) : null}

              {testLineSuccess ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[12px] text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200">
                  {testLineSuccess}
                </div>
              ) : null}

              <div>
                <label className={labelClass}>Message</label>
                <textarea
                  className={textareaClass}
                  value={testLineForm.message}
                  onChange={(e) =>
                    setTestLineForm((prev) => ({
                      ...prev,
                      message: e.target.value,
                    }))
                  }
                  placeholder="Enter test message"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-white/10">
              <ActionButton
                onClick={closeTestLineModal}
                className="border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white/75 dark:hover:bg-white/10"
              >
                Cancel
              </ActionButton>
              <ActionButton
                onClick={submitTestLine}
                disabled={testingLine}
                className="bg-cyan-600 text-white hover:bg-cyan-700"
              >
                {testingLine ? "Sending..." : "Send"}
              </ActionButton>
            </div>
          </div>
        </div>
      )}

      {masterFormOpen && (
        <div className={modalBackdropClass}>
          <div className={`${modalCardClass} max-w-xl`}>
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-white/10">
              <div>
                <h3 className="text-[16px] font-semibold text-slate-900 dark:text-white">
                  {masterFormMode === "create" ? "Create Integration" : "Edit Integration"}
                </h3>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-white/45">
                  Manage line master connection
                </p>
              </div>
              <button
                type="button"
                onClick={closeMasterFormModal}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-white/70 dark:hover:bg-white/5"
              >
                <FiX />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              {masterFormError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[12px] text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200">
                  {masterFormError}
                </div>
              ) : null}

              <div>
                <label className={labelClass}>Integration Name</label>
                <input
                  className={inputClass}
                  value={masterFormData.name}
                  onChange={(e) =>
                    setMasterFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="LINE Notify / Slack / Google..."
                />
              </div>

              <div>
                <label className={labelClass}>Description</label>
                <textarea
                  className={textareaClass}
                  value={masterFormData.description}
                  onChange={(e) =>
                    setMasterFormData((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Describe this integration"
                />
              </div>

              <div>
                <label className={labelClass}>Token</label>
                <div className="relative">
                  <input
                    className={`${inputClass} pr-24`}
                    type={showToken ? "text" : "password"}
                    value={masterFormData.token}
                    onChange={(e) =>
                      setMasterFormData((prev) => ({ ...prev, token: e.target.value }))
                    }
                    placeholder="Enter token"
                  />
                  <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowToken((prev) => !prev)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-white/70 dark:hover:bg-white/5"
                    >
                      {showToken ? <FiEyeOff /> : <FiEye />}
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyToken}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-white/70 dark:hover:bg-white/5"
                    >
                      <FiCopy />
                    </button>
                  </div>
                </div>
                {copiedToken ? (
                  <p className="mt-1 text-[10.5px] text-emerald-600 dark:text-emerald-300">
                    Copied
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-white/10">
              <ActionButton
                onClick={closeMasterFormModal}
                className="border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white/75 dark:hover:bg-white/10"
              >
                Cancel
              </ActionButton>
              <ActionButton
                onClick={handleSubmitMaster}
                disabled={masterSubmitting || (masterFormMode === "edit" && !isBotEditChanged)}
                className="bg-cyan-600 text-white hover:bg-cyan-700"
              >
                {masterSubmitting
                  ? masterFormMode === "create"
                    ? "Creating..."
                    : "Saving..."
                  : masterFormMode === "create"
                    ? "Create"
                    : "Save"}
              </ActionButton>
            </div>
          </div>
        </div>
      )}

      {masterDeleteOpen && masterDeleteTarget && (
        <div className={modalBackdropClass}>
          <div className={`${modalCardClass} max-w-md`}>
            <div className="px-5 py-5">
              <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-300">
                <FiTrash2 className="text-[18px]" />
              </div>

              <h3 className="text-center text-[16px] font-semibold text-slate-900 dark:text-white">
                Delete Integration
              </h3>
              <p className="mt-2 text-center text-[12px] leading-6 text-slate-500 dark:text-white/50">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-slate-700 dark:text-white/80">
                  {masterDeleteTarget.name}
                </span>
                ?
              </p>

              {masterDeleteError ? (
                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[12px] text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200">
                  {masterDeleteError}
                </div>
              ) : null}

              <div className="mt-5 flex items-center justify-center gap-2">
                <ActionButton
                  onClick={closeDeleteMasterModal}
                  className="border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white/75 dark:hover:bg-white/10"
                >
                  Cancel
                </ActionButton>
                <ActionButton
                  onClick={handleDeleteMaster}
                  disabled={masterDeleting}
                  className="bg-rose-600 text-white hover:bg-rose-700"
                >
                  {masterDeleting ? "Deleting..." : "Delete"}
                </ActionButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default index;