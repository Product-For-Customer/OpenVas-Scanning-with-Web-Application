import React, { useEffect, useMemo, useState } from "react";
import { MdOutlineCancel } from "react-icons/md";
import { FaTrash } from "react-icons/fa";
import {
  FiBell,
  FiShield,
  FiWifi,
  FiActivity,
  FiAlertTriangle,
  FiCheckCircle,
  FiSlash,
  FiRotateCw,
  FiClock,
} from "react-icons/fi";
import { useStateContext } from "../../contexts/ContextProvider";
import {
  ListHistoryNotify,
  DeleteHistoryNotifyByIDs,
  type HistoryNotifyResponse,
} from "../../services";

type StatusKey =
  | "Update Completed"
  | "No Update"
  | "Already Running"
  | "Update Failed"
  | "Status Notification";

const normalizeStatus = (status?: string | null): StatusKey => {
  const normalized = (status || "").trim();

  if (normalized === "Update Completed") return "Update Completed";
  if (normalized === "No Update") return "No Update";
  if (normalized === "Already Running") return "Already Running";
  if (normalized === "Update Failed") return "Update Failed";
  if (normalized === "Status Notification") return "Status Notification";

  if (normalized === "Update") return "Update Completed";
  if (normalized === "Alert") return "Status Notification";

  return "Status Notification";
};

const statusMeta: Record<
  StatusKey,
  {
    label: string;
    badge: string;
    topBar: string;
    iconBox: string;
    iconSmallWrap: string;
    icon: React.ReactNode;
    sideIcon: React.ReactNode;
    sideIconClass: string;
    activeText?: string;
  }
> = {
  "Update Completed": {
    label: "Update Completed",
    badge:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:border-emerald-400/20",
    topBar: "bg-linear-to-r from-emerald-400 to-cyan-500",
    iconBox:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
    iconSmallWrap:
      "bg-white ring-1 ring-emerald-200 dark:bg-[#08111f] dark:ring-emerald-400/20",
    icon: (
      <FiCheckCircle className="text-[10px] text-emerald-600 dark:text-emerald-300" />
    ),
    sideIcon: <FiCheckCircle />,
    sideIconClass:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  },
  "No Update": {
    label: "No Update",
    badge:
      "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-500/10 dark:text-slate-200 dark:border-slate-400/20",
    topBar: "bg-linear-to-r from-slate-400 to-slate-500",
    iconBox:
      "bg-slate-50 text-slate-700 dark:bg-slate-500/10 dark:text-slate-300",
    iconSmallWrap:
      "bg-white ring-1 ring-slate-200 dark:bg-[#08111f] dark:ring-slate-400/20",
    icon: <FiSlash className="text-[10px] text-slate-600 dark:text-slate-300" />,
    sideIcon: <FiSlash />,
    sideIconClass:
      "bg-slate-50 text-slate-700 dark:bg-slate-500/10 dark:text-slate-300",
  },
  "Already Running": {
    label: "Already Running",
    badge:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:border-amber-400/20",
    topBar: "bg-linear-to-r from-amber-400 via-orange-400 to-amber-500",
    iconBox:
      "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
    iconSmallWrap:
      "bg-white ring-1 ring-amber-200 dark:bg-[#08111f] dark:ring-amber-400/20",
    icon: (
      <FiRotateCw className="text-[10px] text-amber-600 dark:text-amber-300" />
    ),
    sideIcon: <FiRotateCw />,
    sideIconClass:
      "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
    activeText: "Running",
  },
  "Update Failed": {
    label: "Update Failed",
    badge:
      "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-200 dark:border-red-400/20",
    topBar: "bg-linear-to-r from-red-500 via-rose-500 to-orange-500",
    iconBox: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300",
    iconSmallWrap:
      "bg-white ring-1 ring-red-200 dark:bg-[#08111f] dark:ring-red-400/20",
    icon: (
      <FiAlertTriangle className="text-[10px] text-red-600 dark:text-red-300" />
    ),
    sideIcon: <FiAlertTriangle />,
    sideIconClass:
      "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300",
  },
  "Status Notification": {
    label: "Status Notification",
    badge:
      "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-200 dark:border-cyan-400/20",
    topBar: "bg-linear-to-r from-cyan-500 via-sky-500 to-violet-500",
    iconBox:
      "bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-300",
    iconSmallWrap:
      "bg-white ring-1 ring-cyan-200 dark:bg-[#08111f] dark:ring-cyan-400/20",
    icon: <FiBell className="text-[10px] text-cyan-600 dark:text-cyan-300" />,
    sideIcon: <FiWifi />,
    sideIconClass:
      "bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-300",
    activeText: "Notification",
  },
};

const formatDateTime = (dateString?: string) => {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;

  return date.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const Notification: React.FC = () => {
  const ctx = useStateContext() as any;
  const isClicked = ctx?.isClicked;
  const setIsClicked = ctx?.setIsClicked;

  const [reports, setReports] = useState<HistoryNotifyResponse[]>([]);
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (isClicked?.notification) setOpen(true);
  }, [isClicked?.notification]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await ListHistoryNotify();
      setReports(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error("loadHistory error:", err);
      setReports([]);
      setError("Unable to load notifications.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleDelete = async (id: number) => {
    try {
      setDeletingId(id);
      setError("");

      const res = await DeleteHistoryNotifyByIDs({
        ids: [id],
      });

      if (!res) {
        setError("Failed to delete notification.");
        return;
      }

      setReports((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error("delete notification error:", err);
      setError("Failed to delete notification.");
    } finally {
      setDeletingId(null);
    }
  };

  const close = () => {
    if (typeof setIsClicked === "function") {
      setIsClicked((prev: any) => ({ ...(prev || {}), notification: false }));
    }
    setOpen(false);
  };

  const avatarFallback = useMemo(
    () =>
      "data:image/svg+xml;utf8," +
      encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'>
          <defs>
            <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
              <stop offset='0%' stop-color='#dbeafe'/>
              <stop offset='100%' stop-color='#c4b5fd'/>
            </linearGradient>
          </defs>
          <rect width='100%' height='100%' rx='14' fill='url(#g)'/>
          <text x='50%' y='54%' dominant-baseline='middle' text-anchor='middle'
            font-size='16' fill='#334155' font-family='Arial'>SOC</text>
        </svg>`
      ),
    []
  );

  const visibleReports = useMemo(() => reports, [reports]);

  if (!open) return null;

  return (
    <div
      className={[
        "fixed right-3 top-16 z-50",
        "w-[calc(100vw-24px)] max-w-90",
        "rounded-[22px] overflow-hidden",
        "bg-white/95 border border-gray-200/80 shadow-[0_16px_34px_-22px_rgba(15,23,42,0.32)] backdrop-blur",
        "dark:bg-[#08111f]/95 dark:border-white/10 dark:ring-1 dark:ring-cyan-400/10 dark:shadow-none",
      ].join(" ")}
      style={{ paddingTop: "max(0px, env(safe-area-inset-top))" }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-12 right-4 h-24 w-24 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-24 w-24 rounded-full bg-violet-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 flex items-center justify-between px-3.5 py-3.5 border-b border-gray-200/80 dark:border-white/10">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-linear-to-br from-cyan-500 via-sky-500 to-violet-500 text-white shadow-sm">
            <FiBell className="text-[16px]" />
          </span>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[13px] font-semibold text-gray-800 dark:text-white/90 truncate">
                Scan Notifications
              </p>
              <span className="inline-flex items-center h-4.5 px-1.5 rounded-full text-[9px] font-bold bg-linear-to-r from-cyan-500 to-violet-500 text-white">
                {visibleReports.length > 99 ? "99+" : visibleReports.length}
              </span>
            </div>

            <p className="text-[11px] text-gray-500 dark:text-white/50 truncate">
              findings / status / alerts
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={close}
          aria-label="Close notifications"
          className="inline-flex h-9 w-9 items-center justify-center rounded-2xl transition-colors text-gray-600 hover:bg-gray-100 active:bg-gray-200 dark:text-white/70 dark:hover:bg-white/10 dark:active:bg-white/15"
        >
          <MdOutlineCancel className="text-[18px]" />
        </button>
      </div>

      {error && (
        <div className="relative z-10 mx-3.5 mt-3.5 rounded-2xl border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      )}

      <div
        className="relative z-10 p-3.5 space-y-2.5"
        style={{ maxHeight: 390, overflowY: "auto" }}
      >
        {loading ? (
          <div className="text-center text-gray-500 dark:text-white/55 text-[13px] py-8">
            Loading notifications...
          </div>
        ) : visibleReports.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-white/55 text-[13px] py-8">
            ยังไม่มีการแจ้งเตือนใหม่
          </div>
        ) : (
          visibleReports.map((item) => {
            const normalizedStatus = normalizeStatus(item.status);
            const meta = statusMeta[normalizedStatus];
            const isDeleting = deletingId === item.id;

            return (
              <div
                key={item.id}
                className={[
                  "relative overflow-hidden rounded-[18px] p-3 border transition-all duration-200",
                  "border-gray-200/80 bg-white hover:bg-gray-50",
                  "dark:border-white/10 dark:bg-white/4 dark:hover:bg-white/6",
                ].join(" ")}
              >
                <div
                  className={[
                    "pointer-events-none absolute inset-x-0 top-0 h-1",
                    meta.topBar,
                  ].join(" ")}
                />

                <div className="flex items-start gap-2.5">
                  <div className="relative shrink-0">
                    <img
                      src={avatarFallback}
                      alt="Notification"
                      className="h-10 w-10 rounded-2xl object-cover ring-1 ring-gray-200 bg-white dark:ring-white/10 dark:bg-white/10"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = avatarFallback;
                      }}
                    />

                    <span
                      className={[
                        "absolute -right-1 -bottom-1 inline-flex h-4.5 w-4.5 items-center justify-center rounded-full",
                        meta.iconSmallWrap,
                      ].join(" ")}
                    >
                      {meta.icon}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold text-gray-900 dark:text-white/85 truncate">
                          {item.subject || "Notification"}
                        </p>

                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span
                            className={[
                              "inline-flex items-center h-5.5 px-2 rounded-full text-[10px] font-semibold border",
                              meta.badge,
                            ].join(" ")}
                          >
                            {meta.label}
                          </span>

                          {meta.activeText && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-cyan-600 dark:text-cyan-300">
                              <FiActivity className="text-[9px]" />
                              {meta.activeText}
                            </span>
                          )}

                          <span className="inline-flex items-center gap-1 text-[10px] text-gray-500 dark:text-white/50">
                            <FiClock className="text-[10px]" />
                            {formatDateTime(item.created_at)}
                          </span>
                        </div>
                      </div>

                      <span
                        className={[
                          "inline-flex h-7 w-7 items-center justify-center rounded-xl shrink-0 text-[13px]",
                          meta.sideIconClass,
                        ].join(" ")}
                      >
                        {meta.sideIcon}
                      </span>
                    </div>

                    <p className="mt-2.5 text-[12px] leading-5 text-gray-600 dark:text-white/70 whitespace-pre-line">
                      {item.description || "-"}
                    </p>

                    <div className="mt-2.5 flex items-center gap-2">
                      <div
                        className={[
                          "inline-flex items-center h-7 px-2.5 rounded-[10px] text-[11px] font-semibold border",
                          meta.badge,
                        ].join(" ")}
                      >
                        <FiShield className="mr-1.5 text-[11px]" />
                        {meta.label}
                      </div>

                      <button
                        onClick={() => item.id && handleDelete(item.id)}
                        disabled={isDeleting}
                        title="Delete Notification"
                        className="ml-auto inline-flex items-center h-7 px-2.5 rounded-[10px] text-[11px] font-semibold border transition-colors border-red-200 text-red-600 bg-white hover:bg-red-50 active:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/15"
                      >
                        <FaTrash className="mr-1.5" size={10} />
                        {isDeleting ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Notification;