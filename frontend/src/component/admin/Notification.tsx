import React, { useEffect, useMemo, useRef, useState } from "react";
import { MdOutlineCancel } from "react-icons/md";
import { FaTrash } from "react-icons/fa";
import {
  FiBell,
  FiWifi,
  FiActivity,
  FiAlertTriangle,
  FiCheckCircle,
  FiSlash,
  FiRotateCw,
  FiClock,
  FiSearch,
  FiChevronDown,
  FiCheck,
  FiFilter,
  FiX,
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

const ALL_STATUS_OPTIONS: StatusKey[] = [
  "Update Completed",
  "No Update",
  "Already Running",
  "Update Failed",
  "Status Notification",
];

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
      <FiCheckCircle className="text-[9px] text-emerald-600 dark:text-emerald-300" />
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
    icon: (
      <FiSlash className="text-[9px] text-slate-600 dark:text-slate-300" />
    ),
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
      <FiRotateCw className="text-[9px] text-amber-600 dark:text-amber-300" />
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
      <FiAlertTriangle className="text-[9px] text-red-600 dark:text-red-300" />
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
    icon: <FiBell className="text-[9px] text-cyan-600 dark:text-cyan-300" />,
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

  const [searchText, setSearchText] = useState("");
  const [openStatusSelector, setOpenStatusSelector] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState<StatusKey[]>([]);

  const statusSelectorRef = useRef<HTMLDivElement | null>(null);

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
    void loadHistory();
  }, []);

  useEffect(() => {
    if (!openStatusSelector) return;

    const onClickOutside = (e: MouseEvent) => {
      if (!statusSelectorRef.current) return;
      if (!statusSelectorRef.current.contains(e.target as Node)) {
        setOpenStatusSelector(false);
      }
    };

    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [openStatusSelector]);

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

  const toggleStatus = (status: StatusKey) => {
    setSelectedStatuses((prev) =>
      prev.includes(status)
        ? prev.filter((item) => item !== status)
        : [...prev, status]
    );
  };

  const clearStatusFilter = () => {
    setSelectedStatuses([]);
  };

  const visibleReports = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();

    return reports.filter((item) => {
      const normalizedStatus = normalizeStatus(item.status);

      const passStatus =
        selectedStatuses.length === 0 ||
        selectedStatuses.includes(normalizedStatus);

      const subject = String(item.subject ?? "").toLowerCase();
      const description = String(item.description ?? "").toLowerCase();
      const status = String(normalizedStatus ?? "").toLowerCase();
      const datetime = String(item.datetime ?? "").toLowerCase();

      const passSearch =
        !keyword ||
        subject.includes(keyword) ||
        description.includes(keyword) ||
        status.includes(keyword) ||
        datetime.includes(keyword);

      return passStatus && passSearch;
    });
  }, [reports, searchText, selectedStatuses]);

  const selectedStatusLabel = useMemo(() => {
    if (selectedStatuses.length === 0) return "Filter status";
    if (selectedStatuses.length === 1) return selectedStatuses[0];
    return `${selectedStatuses.length} statuses selected`;
  }, [selectedStatuses]);

  const selectorButtonCls = [
    "h-9 rounded-xl px-3 flex items-center gap-2 border transition w-full",
    "bg-white border-cyan-200/80 text-slate-700 hover:border-cyan-300 hover:bg-cyan-50/60",
    "dark:bg-white/5 dark:border-white/10 dark:text-white/75 dark:hover:bg-white/10",
    "disabled:cursor-not-allowed disabled:opacity-60",
  ].join(" ");

  if (!open) return null;

  return (
    <div
      data-allow-popup-scroll="true"
      className={[
        "fixed right-5 top-16 z-120",
        "w-[calc(100vw-24px)] max-w-90",
        "overflow-visible rounded-[22px]",
        "border border-gray-200/80 bg-white/95 shadow-[0_16px_34px_-22px_rgba(15,23,42,0.32)] backdrop-blur",
        "dark:border-cyan-400/12 dark:bg-[#08111f]/95 dark:ring-1 dark:ring-cyan-400/10 dark:shadow-[0_24px_60px_-28px_rgba(0,0,0,0.8)]",
      ].join(" ")}
      style={{ paddingTop: "max(0px, env(safe-area-inset-top))" }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[22px]">
        <div className="absolute -top-12 right-4 h-24 w-24 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-24 w-24 rounded-full bg-violet-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 flex items-center justify-between border-b border-gray-200/80 px-3.5 py-3.5 dark:border-white/10">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-linear-to-br from-cyan-500 via-sky-500 to-violet-500 text-white shadow-sm">
            <FiBell className="text-[16px]" />
          </span>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-[13px] font-semibold text-gray-800 dark:text-white/90">
                Scan Notifications
              </p>
              <span className="inline-flex h-4.5 items-center rounded-full bg-linear-to-r from-cyan-500 to-violet-500 px-1.5 text-[9px] font-bold text-white">
                {visibleReports.length > 99 ? "99+" : visibleReports.length}
              </span>
            </div>

            <p className="truncate text-[11px] text-gray-500 dark:text-white/50">
              findings / status / alerts
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={close}
          aria-label="Close notifications"
          className="inline-flex h-9 w-9 items-center justify-center rounded-2xl text-gray-600 transition-colors hover:bg-gray-100 active:bg-gray-200 dark:text-white/70 dark:hover:bg-white/10 dark:active:bg-white/15"
        >
          <MdOutlineCancel className="text-[18px]" />
        </button>
      </div>

      {error && (
        <div className="relative z-10 mx-3.5 mt-3.5 rounded-2xl border border-red-200 bg-red-50 px-3 py-2.5 text-[11px] text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="relative z-300 px-3.5 pt-3.5 overflow-visible">
        <div className="grid grid-cols-1 gap-2 overflow-visible">
          <div
            className={[
              "flex items-center gap-2 rounded-xl border px-2.5",
              "border-gray-200/80 bg-gray-50",
              "dark:border-white/10 dark:bg-white/5",
            ].join(" ")}
          >
            <FiSearch className="shrink-0 text-[11px] text-gray-400 dark:text-white/40" />
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search notification"
              className="h-8.5 w-full bg-transparent text-[10px] text-gray-700 outline-none placeholder:text-gray-400 dark:text-white/80 dark:placeholder:text-white/35"
            />
            {searchText ? (
              <button
                type="button"
                onClick={() => setSearchText("")}
                className="inline-flex h-6 w-6 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-200/70 hover:text-gray-600 dark:text-white/35 dark:hover:bg-white/10 dark:hover:text-white/70"
              >
                <FiX className="text-[10px]" />
              </button>
            ) : null}
          </div>

          <div
            className="relative z-400"
            ref={statusSelectorRef}
          >
            <button
              type="button"
              onClick={() => setOpenStatusSelector((prev) => !prev)}
              className={selectorButtonCls}
            >
              <FiFilter className="text-[10px] shrink-0" />
              <span className="text-[10px] font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                {selectedStatusLabel}
              </span>
              <FiChevronDown
                className={`ml-auto text-[10px] transition-transform ${
                  openStatusSelector ? "rotate-180" : ""
                }`}
              />
            </button>

            {openStatusSelector && (
              <div
                className={[
                  "absolute left-0 right-0 top-full mt-2 z-9999 overflow-hidden rounded-2xl",
                  "border border-gray-200 bg-white shadow-[0_18px_40px_-12px_rgba(15,23,42,0.28)]",
                  "dark:border-white/10 dark:bg-[#0B1220] dark:shadow-[0_18px_40px_-12px_rgba(0,0,0,0.55)]",
                ].join(" ")}
              >
                <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2 dark:border-white/10">
                  <p className="text-[10px] font-semibold text-slate-700 dark:text-white/80">
                    Select status
                  </p>

                  {selectedStatuses.length > 0 ? (
                    <button
                      type="button"
                      onClick={clearStatusFilter}
                      className="text-[9px] font-medium text-cyan-600 transition hover:text-cyan-700 dark:text-cyan-300 dark:hover:text-cyan-200"
                    >
                      Clear
                    </button>
                  ) : null}
                </div>

                <div className="max-h-44 overflow-y-auto p-2">
                  <div className="space-y-1">
                    {ALL_STATUS_OPTIONS.map((status) => {
                      const checked = selectedStatuses.includes(status);
                      const meta = statusMeta[status];

                      return (
                        <button
                          key={status}
                          type="button"
                          onClick={() => toggleStatus(status)}
                          className={[
                            "w-full flex items-center gap-2 rounded-xl px-2.5 py-2 text-left transition",
                            checked
                              ? "bg-cyan-50 border border-cyan-200 dark:bg-cyan-500/10 dark:border-cyan-400/20"
                              : "border border-transparent hover:bg-gray-50 dark:hover:bg-white/5",
                          ].join(" ")}
                        >
                          <span
                            className={[
                              "h-3.5 w-3.5 rounded-md border flex items-center justify-center shrink-0 transition",
                              checked
                                ? "bg-cyan-500 border-cyan-500 text-white"
                                : "bg-white border-gray-300 text-transparent dark:bg-white/5 dark:border-white/20",
                            ].join(" ")}
                          >
                            <FiCheck className="text-[8px]" />
                          </span>

                          <span
                            className={`inline-flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-xl ${meta.sideIconClass}`}
                          >
                            {meta.sideIcon}
                          </span>

                          <span className="min-w-0 flex-1 truncate text-[9.5px] font-medium text-gray-700 dark:text-white/80">
                            {meta.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {selectedStatuses.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {selectedStatuses.map((status) => {
                const meta = statusMeta[status];
                return (
                  <span
                    key={status}
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[8.5px] font-medium ${meta.badge}`}
                  >
                    {meta.label}
                    <button
                      type="button"
                      onClick={() => toggleStatus(status)}
                      className="ml-0.5 inline-flex items-center justify-center"
                    >
                      <FiX className="text-[9px]" />
                    </button>
                  </span>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      <div
        className="relative z-10 space-y-2.5 p-3.5"
        style={{ maxHeight: 390, overflowY: "auto" }}
      >
        {loading ? (
          <div className="py-8 text-center text-[12px] text-gray-500 dark:text-white/55">
            Loading notifications...
          </div>
        ) : visibleReports.length === 0 ? (
          <div className="py-8 text-center text-[12px] text-gray-500 dark:text-white/55">
            No matching notifications
          </div>
        ) : (
          visibleReports.map((item) => {
            const normalizedStatus = normalizeStatus(item.status);
            const meta = statusMeta[normalizedStatus];
            const isDeleting = deletingId === item.id;

            return (
              <div
                key={item.id}
                className="relative z-0 overflow-hidden rounded-[20px] border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none"
              >
                <div className={`h-1 w-full ${meta.topBar}`} />

                <div className="flex items-start gap-2.5 p-3">
                  <div className="relative shrink-0">
                    <img
                      src={avatarFallback}
                      alt="notification"
                      className="h-10 w-10 rounded-2xl object-cover"
                    />
                    <span
                      className={`absolute -bottom-1 -right-1 inline-flex h-4.5 w-4.5 items-center justify-center rounded-full ${meta.iconSmallWrap}`}
                    >
                      {meta.icon}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-semibold text-gray-800 dark:text-white/90">
                          {item.subject || "Notification"}
                        </p>

                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-medium ${meta.badge}`}
                          >
                            {meta.label}
                          </span>

                          <span className="inline-flex items-center gap-1 text-[9px] text-gray-500 dark:text-white/50">
                            <FiClock className="text-[9px]" />
                            {formatDateTime(item.datetime)}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`inline-flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-2xl ${meta.sideIconClass}`}
                      >
                        {meta.sideIcon}
                      </span>
                    </div>

                    <div className="mt-2.5 space-y-1 text-[10px] leading-5 text-gray-600 dark:text-white/68">
                      <p>
                        <span className="font-medium text-gray-700 dark:text-white/82">
                          Event:
                        </span>{" "}
                        {item.subject || "-"}
                      </p>
                      <p>
                        <span className="font-medium text-gray-700 dark:text-white/82">
                          Status:
                        </span>{" "}
                        {meta.label}
                      </p>
                      <p>
                        <span className="font-medium text-gray-700 dark:text-white/82">
                          Description:
                        </span>{" "}
                        {item.description || "-"}
                      </p>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-[10px] font-medium ${meta.badge}`}
                      >
                        <FiActivity className="text-[10px]" />
                        {meta.activeText || meta.label}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        disabled={isDeleting}
                        className={[
                          "inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[10px] font-medium transition",
                          "border-red-200 bg-white text-red-600 hover:bg-red-50",
                          "dark:border-red-400/20 dark:bg-transparent dark:text-red-300 dark:hover:bg-red-500/10",
                          isDeleting ? "cursor-not-allowed opacity-60" : "",
                        ].join(" ")}
                      >
                        <FaTrash className="text-[10px]" />
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