import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { message } from "antd";
import {
  FiSearch,
  FiTrash2,
  FiSquare,
  FiCheckSquare,
  FiChevronDown,
  FiAlertTriangle,
  FiCheckCircle,
  FiMessageSquare,
  FiX,
  FiClock,
  FiSlash,
  FiBell,
  FiRotateCw,
  FiLock,
  FiServer,
  FiAlertCircle,
  FiCalendar,
  FiCheck,
  FiDatabase,
} from "react-icons/fi";
import {
  DeleteHistoryNotifyByIDs,
  type HistoryNotifyResponse,
} from "../../../services";
import { useLanguage } from "../../../contexts/LanguageContext";
import { useAuth } from "../../../contexts/AuthContext";
import type { TranslationKey } from "../../../locales";

type FilterKey =
  | "All"
  | "Update Completed"
  | "No Update"
  | "Already Running"
  | "Update Failed"
  | "Status Notification"
  | "Unauthorized"
  | "Server Error"
  | "Timeout";

type StatusKey = Exclude<FilterKey, "All">;

type CombinedFilterOption = {
  key: string;
  label: string;
  type: "month" | "year";
  order: number;
};

const MONTH_OPTIONS: { key: string; value: number }[] = [
  { key: "1", value: 1 },
  { key: "2", value: 2 },
  { key: "3", value: 3 },
  { key: "4", value: 4 },
  { key: "5", value: 5 },
  { key: "6", value: 6 },
  { key: "7", value: 7 },
  { key: "8", value: 8 },
  { key: "9", value: 9 },
  { key: "10", value: 10 },
  { key: "11", value: 11 },
  { key: "12", value: 12 },
];

const MONTH_LABEL_KEYS: Record<number, TranslationKey> = {
  1: "line.monthJanuary",
  2: "line.monthFebruary",
  3: "line.monthMarch",
  4: "line.monthApril",
  5: "line.monthMay",
  6: "line.monthJune",
  7: "line.monthJuly",
  8: "line.monthAugust",
  9: "line.monthSeptember",
  10: "line.monthOctober",
  11: "line.monthNovember",
  12: "line.monthDecember",
};

const STATUS_LABEL_KEYS: Record<StatusKey, TranslationKey> = {
  "Update Completed": "line.statusUpdateCompleted",
  "No Update": "line.statusNoUpdate",
  "Already Running": "line.statusAlreadyRunning",
  "Update Failed": "line.statusUpdateFailed",
  "Status Notification": "line.statusStatusNotification",
  Unauthorized: "line.statusUnauthorized",
  "Server Error": "line.statusServerError",
  Timeout: "line.statusTimeout",
};

const TITLE_KEYS: Record<StatusKey, TranslationKey> = {
  "Update Completed": "line.titleFeedUpdateCompleted",
  "No Update": "line.titleNoFeedUpdate",
  "Already Running": "line.titleFeedUpdateAlreadyRunning",
  "Update Failed": "line.titleFeedUpdateFailed",
  "Status Notification": "line.statusStatusNotification",
  Unauthorized: "line.titleUnauthorizedRequest",
  "Server Error": "line.statusServerError",
  Timeout: "line.titleFeedUpdateTimeout",
};

const DESCRIPTION_KEYS: Record<StatusKey, TranslationKey> = {
  "Update Completed": "line.descUpdateCompleted",
  "No Update": "line.descNoUpdate",
  "Already Running": "line.descAlreadyRunning",
  "Update Failed": "line.descUpdateFailed",
  "Status Notification": "line.descStatusNotification",
  Unauthorized: "line.descUnauthorized",
  "Server Error": "line.descServerError",
  Timeout: "line.descTimeout",
};

const statusStyles: Record<
  StatusKey,
  {
    badge: string;
    dot: string;
    iconWrap: string;
    icon: React.ReactNode;
    label: string;
  }
> = {
  "Update Completed": {
    badge:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:border-emerald-400/20",
    dot: "bg-emerald-500",
    iconWrap:
      "bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-500/10 dark:border-emerald-400/20 dark:text-emerald-300",
    icon: <FiCheckCircle className="text-[10px]" />,
    label: "Update Completed",
  },
  "No Update": {
    badge:
      "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-500/10 dark:text-slate-200 dark:border-slate-400/20",
    dot: "bg-slate-500",
    iconWrap:
      "bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-500/10 dark:border-slate-400/20 dark:text-slate-300",
    icon: <FiSlash className="text-[10px]" />,
    label: "No Update",
  },
  "Already Running": {
    badge:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:border-amber-400/20",
    dot: "bg-amber-500",
    iconWrap:
      "bg-amber-50 border-amber-200 text-amber-600 dark:bg-amber-500/10 dark:border-amber-400/20 dark:text-amber-300",
    icon: <FiRotateCw className="text-[10px]" />,
    label: "Already Running",
  },
  "Update Failed": {
    badge:
      "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-200 dark:border-red-400/20",
    dot: "bg-red-500",
    iconWrap:
      "bg-red-50 border-red-200 text-red-600 dark:bg-red-500/10 dark:border-red-400/20 dark:text-red-300",
    icon: <FiAlertTriangle className="text-[10px]" />,
    label: "Update Failed",
  },
  "Status Notification": {
    badge:
      "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-200 dark:border-cyan-400/20",
    dot: "bg-cyan-500",
    iconWrap:
      "bg-cyan-50 border-cyan-200 text-cyan-600 dark:bg-cyan-500/10 dark:border-cyan-400/20 dark:text-cyan-300",
    icon: <FiBell className="text-[10px]" />,
    label: "Status Notification",
  },
  Unauthorized: {
    badge:
      "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-200 dark:border-violet-400/20",
    dot: "bg-violet-500",
    iconWrap:
      "bg-violet-50 border-violet-200 text-violet-600 dark:bg-violet-500/10 dark:border-violet-400/20 dark:text-violet-300",
    icon: <FiLock className="text-[10px]" />,
    label: "Unauthorized",
  },
  "Server Error": {
    badge:
      "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-500/10 dark:text-fuchsia-200 dark:border-fuchsia-400/20",
    dot: "bg-fuchsia-500",
    iconWrap:
      "bg-fuchsia-50 border-fuchsia-200 text-fuchsia-600 dark:bg-fuchsia-500/10 dark:border-fuchsia-400/20 dark:text-fuchsia-300",
    icon: <FiServer className="text-[10px]" />,
    label: "Server Error",
  },
  Timeout: {
    badge:
      "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-200 dark:border-orange-400/20",
    dot: "bg-orange-500",
    iconWrap:
      "bg-orange-50 border-orange-200 text-orange-600 dark:bg-orange-500/10 dark:border-orange-400/20 dark:text-orange-300",
    icon: <FiAlertCircle className="text-[10px]" />,
    label: "Timeout",
  },
};

const normalizeText = (value?: string | null) => (value || "").trim();

const normalizeStatus = (status?: string | null): StatusKey => {
  const normalized = normalizeText(status).toLowerCase();

  if (normalized === "update completed") return "Update Completed";
  if (normalized === "no update") return "No Update";
  if (normalized === "already running") return "Already Running";
  if (normalized === "update failed") return "Update Failed";
  if (normalized === "status notification") return "Status Notification";
  if (normalized === "unauthorized") return "Unauthorized";
  if (normalized === "server error") return "Server Error";
  if (normalized === "timeout") return "Timeout";

  if (normalized === "update") return "Update Completed";
  if (normalized === "alert") return "Status Notification";
  if (normalized === "failed") return "Update Failed";
  if (normalized === "completed") return "Update Completed";
  if (normalized === "running") return "Already Running";

  return "Status Notification";
};

const getStatusMeta = (status?: string | null) => {
  const normalized = normalizeStatus(status);
  return statusStyles[normalized];
};

const formatDate = (dateString?: string) => {
  if (!dateString) return "-";

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
};

const formatTime = (dateString?: string) => {
  if (!dateString) return "-";

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const cleanInlineText = (text?: string | null) => {
  return (text || "")
    .replace(/\r/g, "")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const parseDescription = (description?: string | null) => {
  const raw = (description || "").replace(/\r/g, "").trim();

  if (!raw) {
    return {
      titleLine: "",
      summaryLine: "",
      metaLines: [] as string[],
      raw,
    };
  }

  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const getValueAfterColon = (prefix: string) => {
    const found = lines.find((line) =>
      line.toLowerCase().startsWith(prefix.toLowerCase())
    );
    if (!found) return "";
    const idx = found.indexOf(":");
    if (idx === -1) return found;
    return found.slice(idx + 1).trim();
  };

  const summaryLine = getValueAfterColon("Summary");
  const statusLine = getValueAfterColon("Status");
  const triggeredByLine = getValueAfterColon("Triggered By");
  const sourceLine = getValueAfterColon("Source");
  const forceLine = getValueAfterColon("Force");

  const metaLines: string[] = [];
  if (statusLine) metaLines.push(`Status: ${statusLine}`);
  if (triggeredByLine) metaLines.push(`Triggered By: ${triggeredByLine}`);
  if (sourceLine) metaLines.push(`Source: ${sourceLine}`);
  if (forceLine) metaLines.push(`Force: ${forceLine}`);

  return {
    titleLine: lines[0] || "",
    summaryLine: summaryLine || cleanInlineText(raw),
    metaLines,
    raw,
  };
};

type TFn = (key: TranslationKey, vars?: Record<string, string | number>) => string;

const getDisplayTitle = (item: HistoryNotifyResponse, t: TFn) => {
  const subject = normalizeText(item.subject);
  const normalizedStatus = normalizeStatus(item.status);

  if (subject) return subject;

  const key = TITLE_KEYS[normalizedStatus];
  return key ? t(key) : t("line.statusNotification");
};

const getDisplayDescription = (item: HistoryNotifyResponse, t: TFn) => {
  const normalizedStatus = normalizeStatus(item.status);
  const parsed = parseDescription(item.description);

  if (parsed.summaryLine) {
    return parsed.summaryLine;
  }

  const key = DESCRIPTION_KEYS[normalizedStatus];
  return key ? t(key) : item.description || "-";
};

type CombinedFilterProps = {
  buttonLabel: string;
  options: CombinedFilterOption[];
  selectedKeys: string[];
  searchValue: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSearchChange: (value: string) => void;
  onToggle: (key: string) => void;
  onSelectAllVisible: () => void;
  onClearAll: () => void;
  allVisibleSelected: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
};

const CombinedMonthYearFilter: React.FC<CombinedFilterProps> = ({
  buttonLabel,
  options,
  selectedKeys,
  searchValue,
  open,
  onOpenChange,
  onSearchChange,
  onToggle,
  onSelectAllVisible,
  onClearAll,
  allVisibleSelected,
  containerRef,
}) => {
  const { t } = useLanguage();
  const selectedCount = selectedKeys.length;
  const monthOptions = options.filter((opt) => opt.type === "month");
  const yearOptions = options.filter((opt) => opt.type === "year");

  return (
    <div className="relative w-full sm:w-55" ref={containerRef}>
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className={[
          "w-full h-8 rounded-[14px] px-3 inline-flex items-center justify-between gap-2 transition text-left",
          "bg-white border border-gray-200/80 text-[11px] font-medium text-gray-700 hover:bg-gray-50",
          "dark:bg-white/5 dark:border-white/10 dark:text-white/75 dark:hover:bg-white/8",
        ].join(" ")}
      >
        <div className="flex min-w-0 items-center gap-2">
          <FiCalendar className="shrink-0 text-[12px] text-gray-500 dark:text-white/55" />
          <span className="truncate">{buttonLabel}</span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {selectedCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-4.5 h-4.5 px-1.5 rounded-full text-[9px] font-semibold bg-cyan-50 text-cyan-700 border border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-400/20">
              {selectedCount}
            </span>
          )}

          <FiChevronDown
            className={`pointer-events-none text-[12px] text-gray-400 dark:text-white/45 transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {open && (
        <div className="absolute right-0 mt-1.5 w-72 rounded-xl border border-slate-200/80 bg-white shadow-xl overflow-hidden z-30 dark:border-white/10 dark:bg-[#0d0b1a]">
          <div className="p-2 border-b border-gray-100 dark:border-white/10">
            <div
              className={[
                "flex items-center gap-2 rounded-[14px] px-2.5 h-8",
                "bg-slate-50 border border-slate-200/80",
                "dark:bg-white/5 dark:border-white/10",
              ].join(" ")}
            >
              <FiSearch className="text-[11px] text-gray-400 dark:text-white/40 shrink-0" />
              <input
                type="text"
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={t("line.searchMonthOrYear")}
                className="w-full bg-transparent outline-none text-[10.5px] text-gray-700 placeholder:text-gray-400 dark:text-white/80 dark:placeholder:text-white/30"
              />
              {searchValue.trim() !== "" && (
                <button
                  type="button"
                  onClick={() => onSearchChange("")}
                  className="text-gray-400 hover:text-gray-600 dark:text-white/35 dark:hover:text-white/70"
                  aria-label={t("line.clearDateFilterSearch")}
                >
                  <FiX className="text-[11px]" />
                </button>
              )}
            </div>

            <div className="mt-2 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={onSelectAllVisible}
                className="text-[10px] font-medium text-cyan-600 hover:text-cyan-700 dark:text-cyan-300 dark:hover:text-cyan-200"
              >
                {allVisibleSelected ? t("line.unselectVisible") : t("line.selectVisible")}
              </button>

              <button
                type="button"
                onClick={onClearAll}
                className="text-[10px] font-medium text-gray-500 hover:text-gray-700 dark:text-white/50 dark:hover:text-white/75"
              >
                {t("line.clearAll")}
              </button>
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto p-2">
            {options.length === 0 ? (
              <div className="px-3 py-6 text-center text-[11px] text-gray-500 dark:text-white/50">
                {t("line.noMatchingDateFilter")}
              </div>
            ) : (
              <div className="space-y-2">
                {monthOptions.length > 0 && (
                  <div>
                    <div className="px-2.5 pb-1 text-[9.5px] font-semibold uppercase tracking-wide text-slate-400 dark:text-white/35">
                      {t("line.monthSectionLabel")}
                    </div>

                    <div className="space-y-1">
                      {monthOptions.map((opt) => {
                        const checked = selectedKeys.includes(opt.key);

                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => onToggle(opt.key)}
                            className={[
                              "w-full flex items-start gap-2.5 rounded-[14px] px-2.5 py-2 text-left transition",
                              checked
                                ? "bg-cyan-50 border border-cyan-200 dark:bg-cyan-500/10 dark:border-cyan-400/20"
                                : "border border-transparent hover:bg-gray-50 dark:hover:bg-white/5",
                            ].join(" ")}
                          >
                            <span
                              className={[
                                "mt-0.5 h-4 w-4 rounded-md border flex items-center justify-center shrink-0 transition",
                                checked
                                  ? "bg-cyan-500 border-cyan-500 text-white"
                                  : "bg-white border-gray-300 text-transparent dark:bg-white/5 dark:border-white/20",
                              ].join(" ")}
                            >
                              <FiCheck className="text-[9px]" />
                            </span>

                            <span className="min-w-0 flex-1">
                              <span className="block text-[10px] sm:text-[10.5px] font-medium text-gray-700 dark:text-white/80 wrap-break-word">
                                {opt.label}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {yearOptions.length > 0 && (
                  <div>
                    <div className="px-2.5 pb-1 pt-1 text-[9.5px] font-semibold uppercase tracking-wide text-slate-400 dark:text-white/35">
                      {t("line.yearSectionLabel")}
                    </div>

                    <div className="space-y-1">
                      {yearOptions.map((opt) => {
                        const checked = selectedKeys.includes(opt.key);

                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => onToggle(opt.key)}
                            className={[
                              "w-full flex items-start gap-2.5 rounded-[14px] px-2.5 py-2 text-left transition",
                              checked
                                ? "bg-cyan-50 border border-cyan-200 dark:bg-cyan-500/10 dark:border-cyan-400/20"
                                : "border border-transparent hover:bg-gray-50 dark:hover:bg-white/5",
                            ].join(" ")}
                          >
                            <span
                              className={[
                                "mt-0.5 h-4 w-4 rounded-md border flex items-center justify-center shrink-0 transition",
                                checked
                                  ? "bg-cyan-500 border-cyan-500 text-white"
                                  : "bg-white border-gray-300 text-transparent dark:bg-white/5 dark:border-white/20",
                              ].join(" ")}
                            >
                              <FiCheck className="text-[9px]" />
                            </span>

                            <span className="min-w-0 flex-1">
                              <span className="block text-[10px] sm:text-[10.5px] font-medium text-gray-700 dark:text-white/80 wrap-break-word">
                                {opt.label}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

type HistoryNotifyProps = {
  items: HistoryNotifyResponse[];
  setItems: React.Dispatch<React.SetStateAction<HistoryNotifyResponse[]>>;
  loading: boolean;
  refreshing: boolean;
  error: string;
  onRefresh: (showRefresh?: boolean) => Promise<void> | void;
};

const Index: React.FC<HistoryNotifyProps> = ({
  items,
  setItems,
  loading,
  error,
}) => {
  const { t } = useLanguage();
  const { can } = useAuth();
  const canManage = can("line_management", "manage");
  const [search, setSearch] = useState("");

  const [selected, setSelected] = useState<number[]>([]);

  const [deleteOpen, setDeleteOpen] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string>("");

  const [openDateFilter, setOpenDateFilter] = useState(false);
  const [dateFilterSearch, setDateFilterSearch] = useState("");
  const [selectedDateKeys, setSelectedDateKeys] = useState<string[]>([]);

  const dateFilterRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;

      if (dateFilterRef.current && !dateFilterRef.current.contains(target)) {
        setOpenDateFilter(false);
      }
    };

    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const yearOptions = useMemo<CombinedFilterOption[]>(() => {
    const years = items
      .map((item) => {
        const raw = item.datetime || item.created_at || item.updated_at;
        if (!raw) return null;
        const d = new Date(raw);
        if (Number.isNaN(d.getTime())) return null;
        return String(d.getFullYear());
      })
      .filter((v): v is string => Boolean(v));

    const uniqueYears = Array.from(new Set(years)).sort(
      (a, b) => Number(b) - Number(a)
    );

    return uniqueYears.map((year) => ({
      key: `year:${year}`,
      label: year,
      type: "year",
      order: Number(year),
    }));
  }, [items]);

  const monthOptions = useMemo<CombinedFilterOption[]>(() => {
    return MONTH_OPTIONS.map((m) => ({
      key: `month:${m.key}`,
      label: t(MONTH_LABEL_KEYS[m.value]),
      type: "month",
      order: m.value,
    }));
  }, [t]);

  const combinedFilterOptions = useMemo<CombinedFilterOption[]>(() => {
    const keyword = dateFilterSearch.trim().toLowerCase();
    const all = [...monthOptions, ...yearOptions];

    if (!keyword) return all;

    return all.filter((opt) => opt.label.toLowerCase().includes(keyword));
  }, [monthOptions, yearOptions, dateFilterSearch]);

  const selectedMonths = useMemo(
    () =>
      selectedDateKeys
        .filter((key) => key.startsWith("month:"))
        .map((key) => key.replace("month:", "")),
    [selectedDateKeys]
  );

  const selectedYears = useMemo(
    () =>
      selectedDateKeys
        .filter((key) => key.startsWith("year:"))
        .map((key) => key.replace("year:", "")),
    [selectedDateKeys]
  );

  const dateFilterButtonLabel = useMemo(() => {
    if (selectedDateKeys.length === 0) return t("line.dateFilterLabel");

    if (selectedDateKeys.length === 1) {
      const found = [...monthOptions, ...yearOptions].find(
        (opt) => opt.key === selectedDateKeys[0]
      );
      return found?.label || t("line.nSelected", { n: 1 });
    }

    return t("line.nSelected", { n: selectedDateKeys.length });
  }, [selectedDateKeys, monthOptions, yearOptions, t]);

  const allVisibleDateFiltersSelected =
    combinedFilterOptions.length > 0 &&
    combinedFilterOptions.every((opt) => selectedDateKeys.includes(opt.key));

  const toggleDateFilter = (key: string) => {
    setSelectedDateKeys((prev) => {
      if (prev.includes(key)) {
        return prev.filter((item) => item !== key);
      }

      const next = [...prev, key];

      return next.sort((a, b) => {
        const aIsMonth = a.startsWith("month:");
        const bIsMonth = b.startsWith("month:");

        if (aIsMonth && !bIsMonth) return -1;
        if (!aIsMonth && bIsMonth) return 1;

        const aVal = Number(a.split(":")[1]);
        const bVal = Number(b.split(":")[1]);

        if (aIsMonth && bIsMonth) return aVal - bVal;
        return bVal - aVal;
      });
    });
  };

  const handleSelectAllVisibleDateFilters = () => {
    const visibleKeys = combinedFilterOptions.map((x) => x.key);

    setSelectedDateKeys((prev) => {
      const prevSet = new Set(prev);
      const allSelected =
        visibleKeys.length > 0 && visibleKeys.every((key) => prevSet.has(key));

      if (allSelected) {
        return prev.filter((key) => !visibleKeys.includes(key));
      }

      const next = Array.from(new Set([...prev, ...visibleKeys]));

      return next.sort((a, b) => {
        const aIsMonth = a.startsWith("month:");
        const bIsMonth = b.startsWith("month:");

        if (aIsMonth && !bIsMonth) return -1;
        if (!aIsMonth && bIsMonth) return 1;

        const aVal = Number(a.split(":")[1]);
        const bVal = Number(b.split(":")[1]);

        if (aIsMonth && bIsMonth) return aVal - bVal;
        return bVal - aVal;
      });
    });
  };

  const notifications = useMemo(() => {
    const q = search.trim().toLowerCase();

    return items.filter((item) => {
      const normalizedStatus = normalizeStatus(item.status);
      const parsed = parseDescription(item.description);

      const rawDate = item.datetime || item.created_at || item.updated_at;
      const itemDate = rawDate ? new Date(rawDate) : null;

      const itemMonth =
        itemDate && !Number.isNaN(itemDate.getTime())
          ? String(itemDate.getMonth() + 1)
          : "";

      const itemYear =
        itemDate && !Number.isNaN(itemDate.getTime())
          ? String(itemDate.getFullYear())
          : "";

      const matchMonth =
        selectedMonths.length === 0 ? true : selectedMonths.includes(itemMonth);

      const matchYear =
        selectedYears.length === 0 ? true : selectedYears.includes(itemYear);

      const blob = [
        item.subject,
        item.description,
        item.status,
        item.datetime,
        item.created_at,
        item.updated_at,
        normalizedStatus,
        parsed.summaryLine,
        ...parsed.metaLines,
      ]
        .join(" ")
        .toLowerCase();

      const matchSearch = blob.includes(q);

      return matchSearch && matchMonth && matchYear;
    });
  }, [items, search, selectedMonths, selectedYears]);

  const toggleSelect = (id: number) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const allSelected =
    notifications.length > 0 &&
    notifications.every((item) => selected.includes(item.id));

  const toggleSelectAll = () => {
    const visibleIds = notifications.map((n) => n.id);

    if (allSelected) {
      setSelected((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelected((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const openDeleteModal = () => {
    if (selected.length === 0) return;
    setDeleteError("");
    setDeleteOpen(true);
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setDeleteOpen(false);
    setDeleteError("");
  };

  const confirmDelete = async () => {
    if (selected.length === 0) {
      setDeleteError(t("line.selectAtLeastOne"));
      return;
    }

    try {
      setDeleting(true);
      setDeleteError("");

      const res = await DeleteHistoryNotifyByIDs({
        ids: selected,
      });

      if (!res) {
        setDeleteError(t("line.failedDeleteSelected"));
        return;
      }

      const selectedSet = new Set(selected);

      setItems((prev) => prev.filter((item) => !selectedSet.has(item.id)));
      setSelected([]);
      setDeleteOpen(false);
      message.success(t("line.deleteSuccess"));
    } catch (err) {
      console.error("confirmDelete error:", err);
      setDeleteError(t("line.failedDeleteSelected"));
    } finally {
      setDeleting(false);
    }
  };

  const selectedItems = useMemo(() => {
    const selectedSet = new Set(selected);
    return items.filter((item) => selectedSet.has(item.id));
  }, [items, selected]);

  return (
    <section className="rounded-xl border border-slate-200/70 bg-white p-4 dark:border-white/8 dark:bg-[#0d0b1a]/80 sm:p-5">
      <div>
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-[13px] font-bold text-slate-800 dark:text-white/90">
                {t("line.notificationHistory")}
              </h2>
            </div>

            {/* Auto-delete policy banner */}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-white/45">
                <FiDatabase className="shrink-0 text-[10px]" />
                <span>{t("line.autoDeleteNotice")}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <div className="relative min-w-46 flex-1 sm:flex-none sm:w-75">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-gray-400 dark:text-white/35" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("line.searchNotificationsPlaceholder")}
                className={[
                  "w-full h-8 rounded-[14px] pl-8.5 pr-3 text-[11px] outline-none transition",
                  "border border-gray-200 bg-white text-slate-800 focus:ring-2 focus:ring-cyan-200",
                  "dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:placeholder:text-white/35 dark:focus:ring-cyan-400/10",
                ].join(" ")}
              />
            </div>

            <CombinedMonthYearFilter
              buttonLabel={dateFilterButtonLabel}
              options={combinedFilterOptions}
              selectedKeys={selectedDateKeys}
              searchValue={dateFilterSearch}
              open={openDateFilter}
              onOpenChange={setOpenDateFilter}
              onSearchChange={setDateFilterSearch}
              onToggle={toggleDateFilter}
              onSelectAllVisible={handleSelectAllVisibleDateFilters}
              onClearAll={() => setSelectedDateKeys([])}
              allVisibleSelected={allVisibleDateFiltersSelected}
              containerRef={dateFilterRef}
            />

            <button
              type="button"
              onClick={toggleSelectAll}
              className={[
                "inline-flex h-8 items-center gap-1.5 rounded-[14px] px-3 text-[11px] font-medium transition",
                allSelected
                  ? "bg-cyan-50 text-cyan-700 border border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-200 dark:border-cyan-400/20"
                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-white/5 dark:border-white/10 dark:text-white/70 dark:hover:bg-white/8",
              ].join(" ")}
              title={allSelected ? t("line.deselectAllTitle") : t("line.selectAllTitle")}
            >
              {allSelected ? (
                <FiCheckSquare className="text-[12px]" />
              ) : (
                <FiSquare className="text-[12px]" />
              )}
              {allSelected ? t("line.deselectAllLabel") : t("line.selectAllLabel")}
            </button>

            {canManage && (
              <button
                type="button"
                onClick={openDeleteModal}
                disabled={selected.length === 0}
                className={[
                  "inline-flex h-8 w-8 items-center justify-center rounded-[14px] transition",
                  selected.length > 0
                    ? "bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 dark:bg-red-500/10 dark:border-red-400/20 dark:text-red-300 dark:hover:bg-red-500/15"
                    : "bg-white border border-gray-200 text-gray-300 cursor-not-allowed dark:bg-white/5 dark:border-white/10 dark:text-white/20",
                ].join(" ")}
                title={t("line.deleteSelected")}
              >
                <FiTrash2 className="text-[12px]" />
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded-[14px] border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="mt-3.5 overflow-hidden rounded-[18px] border border-gray-200/80 bg-white/70 dark:border-white/10 dark:bg-white/3">
          {loading ? (
            <div className="min-h-110 px-5 py-8 text-center flex flex-col items-center justify-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-[14px] border border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-500/10 dark:text-cyan-200">
                <FiRotateCw className="animate-spin text-[16px]" />
              </div>

              <h3 className="mt-3 text-[13px] font-semibold text-slate-900 dark:text-white/85">
                {t("line.loadingNotifications")}
              </h3>

              <p className="mt-1 text-[10px] text-slate-500 dark:text-white/55">
                {t("line.loadingNotificationHistoryDesc")}
              </p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="min-h-110 px-5 py-8 text-center flex flex-col items-center justify-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-[14px] border border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-500/10 dark:text-cyan-200">
                <FiMessageSquare className="text-[16px]" />
              </div>

              <h3 className="mt-3 text-[13px] font-semibold text-slate-900 dark:text-white/85">
                {t("line.noNotificationsFound")}
              </h3>

              <p className="mt-1 text-[10px] text-slate-500 dark:text-white/55">
                {t("line.tryAdjustingFilters")}
              </p>
            </div>
          ) : (
            <div className="min-h-110 max-h-110 overflow-y-auto">
              {notifications.map((item, idx) => {
                const tone = getStatusMeta(item.status);
                const isSelected = selected.includes(item.id);
                const parsed = parseDescription(item.description);
                const displayTitle = getDisplayTitle(item, t);
                const displayDescription = getDisplayDescription(item, t);
                const statusLabel = t(STATUS_LABEL_KEYS[normalizeStatus(item.status)]);

                return (
                  <div
                    key={item.id}
                    className={[
                      "px-3 py-2.5 transition-colors sm:px-4",
                      idx !== notifications.length - 1
                        ? "border-b border-gray-200/70 dark:border-white/10"
                        : "",
                      isSelected
                        ? "bg-cyan-50/70 dark:bg-cyan-500/5"
                        : "hover:bg-gray-50 dark:hover:bg-white/4",
                    ].join(" ")}
                  >
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={() => toggleSelect(item.id)}
                        className={[
                          "mt-1 inline-flex h-4 w-4 shrink-0 rounded border transition",
                          isSelected
                            ? "border-cyan-500 bg-cyan-500"
                            : "border-gray-300 bg-white dark:border-white/15 dark:bg-white/5",
                        ].join(" ")}
                        aria-label={t("line.selectNotificationAria")}
                      >
                        {isSelected && (
                          <span className="m-auto h-1.5 w-1.5 rounded-xs bg-white" />
                        )}
                      </button>

                      <div
                        className={[
                          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border",
                          tone.iconWrap,
                        ].join(" ")}
                      >
                        {tone.icon}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <h3 className="truncate text-[12px] font-semibold text-slate-900 dark:text-white/90">
                                {displayTitle}
                              </h3>

                              <span
                                className={[
                                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-medium",
                                  tone.badge,
                                ].join(" ")}
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${tone.dot}`}
                                />
                                {statusLabel}
                              </span>
                            </div>

                            <p className="mt-1 text-[10.5px] leading-5 text-slate-600 dark:text-white/60">
                              {displayDescription}
                            </p>

                            {parsed.metaLines.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                {parsed.metaLines.map((line, index) => (
                                  <span
                                    key={`${item.id}-meta-${index}`}
                                    className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-white/55"
                                  >
                                    {line}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="shrink-0 text-right">
                            <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-[9px] text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-white/55">
                              <FiClock className="text-[9px]" />
                              {formatDate(item.datetime || item.created_at)}
                            </div>

                            <p className="mt-1 text-[9.5px] text-slate-500 dark:text-white/45">
                              {formatTime(item.datetime || item.created_at)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {deleteOpen && createPortal(
        <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-[22px] border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0B1220]">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-white/10">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl border border-red-200 bg-red-50 text-red-600 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300">
                  <FiTrash2 className="text-[15px]" />
                </div>

                <div>
                  <h3 className="text-[14px] font-semibold text-slate-900 dark:text-white/90">
                    {t("line.deleteSelectedNotificationsTitle")}
                  </h3>

                  <p className="mt-1 text-[10.5px] text-slate-500 dark:text-white/55">
                    {t("line.deleteSelectedNotificationsDesc")}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeDeleteModal}
                className="rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:text-white/35 dark:hover:bg-white/8 dark:hover:text-white/70"
              >
                <FiX className="text-[14px]" />
              </button>
            </div>

            <div className="px-4 py-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
                <p className="text-[11px] font-medium text-slate-700 dark:text-white/75">
                  {t("line.selectedItemsCount", { n: selectedItems.length })}
                </p>

                <div className="mt-2 max-h-40 overflow-y-auto space-y-1.5">
                  {selectedItems.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-[10px] text-slate-600 dark:border-white/10 dark:bg-[#0F172A] dark:text-white/60"
                    >
                      <p className="font-medium text-slate-800 dark:text-white/80">
                        {getDisplayTitle(item, t)}
                      </p>

                      <p className="mt-0.5 text-slate-500 dark:text-white/45">
                        {formatDate(item.datetime || item.created_at)}{" "}
                        {formatTime(item.datetime || item.created_at)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {deleteError && (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[10.5px] text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300">
                  {deleteError}
                </div>
              )}

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeDeleteModal}
                  disabled={deleting}
                  className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-[11px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/8"
                >
                  {t("common.cancel")}
                </button>

                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={deleting}
                  className="inline-flex h-9 items-center justify-center rounded-xl border border-red-200 bg-red-50 px-4 text-[11px] font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-60 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/15"
                >
                  {deleting ? t("common.deleting") : t("common.delete")}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </section>
  );
};

export default Index;