import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FiActivity, FiRefreshCw, FiClock,
  FiCheckCircle, FiAlertTriangle, FiZap, FiDatabase,
  FiEdit2, FiSave, FiX, FiPlay,
} from "react-icons/fi";
import { message } from "antd";
import {
  GetGMPFeeds, GetKEVSyncStatus, TriggerKEVSync,
  type GMPFeedDTO, type KEVSyncStatusDTO,
} from "../../services";
import {
  ListFeedSchedules, UpdateFeedSchedule, TriggerFeedNow,
  type FeedScheduleDTO, type FeedType, type FeedFrequency,
} from "../../services/feedschedule";
import { useStateContext } from "../../contexts/ProviderContext";
import { useLanguage } from "../../contexts/LanguageContext";

// ── helpers ────────────────────────────────────────────────────────────────
const fmtDateTime = (iso: string | undefined | null): string => {
  if (!iso || iso === "0001-01-01T00:00:00Z") return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

const FEED_CONTENT: Record<string, string> = {
  NVT:       "NVTs (Network Vulnerability Tests)",
  SCAP:      "CVEs · CPEs",
  CERT:      "CERT-Bund · DFN-CERT Advisories",
  GVMD_DATA: "Compliance Policies · Port Lists · Scan Configs",
};
const FEED_ICON: Record<string, React.ReactNode> = {
  NVT: <FiZap />, SCAP: <FiDatabase />, CERT: <FiAlertTriangle />, GVMD_DATA: <FiCheckCircle />,
};
const FEED_COLOR: Record<string, string> = {
  NVT: "#ef4444", SCAP: "#3b82f6", CERT: "#f59e0b", GVMD_DATA: "#10b981",
};

const MONTHS = ["January","February","March","April","May","June",
  "July","August","September","October","November","December"];

// ── Status badge ──────────────────────────────────────────────────────────
const StatusBadge: React.FC<{ status: string; syncing: boolean }> = ({ status, syncing }) => {
  if (syncing) return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
      <FiRefreshCw className="animate-spin text-[10px]" /> Syncing
    </span>
  );
  if (status === "Current") return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
      <FiCheckCircle className="text-[10px]" /> Current
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-500 dark:border-white/8 dark:bg-white/5 dark:text-white/40">
      {status}
    </span>
  );
};

// ── Schedule Edit Row (inline editor) ─────────────────────────────────────
const FEED_META: Record<FeedType, { label: string; desc: string; color: string; icon: React.ReactNode }> = {
  openvas: { label: "OpenVAS Feeds",     desc: "NVT · SCAP · CERT · GVMD_DATA",    color: "#6366f1", icon: <FiDatabase /> },
  kev:     { label: "CISA KEV Catalog",  desc: "Known Exploited Vulnerabilities",   color: "#ef4444", icon: <FiZap /> },
  epss:    { label: "EPSS Scores",       desc: "Exploit Prediction Scoring System", color: "#f97316", icon: <FiActivity /> },
};

const inputCls = "h-9 rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-white/8 dark:bg-white/5 dark:text-white/80";
const selCls   = `${inputCls} appearance-none pr-8 cursor-pointer`;
const labelCls = "text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/30";

interface ScheduleRowProps {
  schedule: FeedScheduleDTO;
  onSaved: (s: FeedScheduleDTO) => void;
  currentColor: string;
  accentGrad: string;
}

const ScheduleRow: React.FC<ScheduleRowProps> = ({ schedule, onSaved, currentColor, accentGrad }) => {
  const { t } = useLanguage();
  const [editing,    setEditing]    = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [triggering, setTriggering] = useState(false);

  const [freq,       setFreq]       = useState<FeedFrequency>(schedule.frequency);
  const [hour,       setHour]       = useState(schedule.hour);
  const [minute,     setMinute]     = useState(schedule.minute);
  const [dayOfMonth, setDayOfMonth] = useState(schedule.day_of_month);
  const [month,      setMonth]      = useState(schedule.month);
  const [day,        setDay]        = useState(schedule.day);
  const [enabled,    setEnabled]    = useState(schedule.enabled);

  const meta = FEED_META[schedule.feed_type];

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await UpdateFeedSchedule(schedule.feed_type, {
        frequency: freq, hour, minute, day_of_month: dayOfMonth, month, day, enabled,
      });
      onSaved(updated);
      setEditing(false);
      message.success(t("feedschedule.saved"));
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      message.error(msg || "Failed to save schedule");
    } finally { setSaving(false); }
  };

  const handleTrigger = async () => {
    setTriggering(true);
    try {
      await TriggerFeedNow(schedule.feed_type);
      message.success(`${meta.label} — ${t("feedschedule.triggered")}`);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      message.error(msg || "Trigger failed");
    } finally { setTriggering(false); }
  };

  const cancelEdit = () => {
    setFreq(schedule.frequency); setHour(schedule.hour); setMinute(schedule.minute);
    setDayOfMonth(schedule.day_of_month); setMonth(schedule.month); setDay(schedule.day);
    setEnabled(schedule.enabled); setEditing(false);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white dark:border-white/8 dark:bg-[#0d0b1a]/60">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[15px]"
            style={{ backgroundColor: `${meta.color}15`, color: meta.color }}>
            {meta.icon}
          </div>
          <div>
            <p className="text-[13.5px] font-semibold text-slate-800 dark:text-white/88">{meta.label}</p>
            <p className="text-[11px] text-slate-400 dark:text-white/35">{meta.desc}</p>
          </div>
        </div>

        {/* Right: status + actions */}
        <div className="flex shrink-0 items-center gap-2">
          {/* Enabled badge */}
          <span className={[
            "hidden rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold sm:inline-block",
            enabled
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
              : "bg-slate-100 text-slate-400 dark:bg-white/5 dark:text-white/30",
          ].join(" ")}>
            {enabled ? t("feedschedule.enabled") : t("feedschedule.disabled")}
          </span>

          {/* Trigger now */}
          <button type="button" onClick={() => void handleTrigger()} disabled={triggering}
            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11.5px] font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/8 dark:bg-white/5 dark:text-white/55">
            {triggering
              ? <FiRefreshCw className="animate-spin text-[11px]" />
              : <FiPlay className="text-[11px]" />}
            <span className="hidden sm:inline">{t("feedschedule.triggerNow")}</span>
          </button>

          {/* Edit */}
          {!editing
            ? <button type="button" onClick={() => setEditing(true)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/50">
                <FiEdit2 className="text-[12px]" />
              </button>
            : <button type="button" onClick={cancelEdit}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/50">
                <FiX className="text-[12px]" />
              </button>
          }
        </div>
      </div>

      {/* Current schedule info (collapsed) */}
      {!editing && (
        <div className="grid grid-cols-3 divide-x divide-slate-100 border-t border-slate-100 dark:divide-white/6 dark:border-white/8">
          <div className="px-4 py-3">
            <p className={`mb-0.5 ${labelCls}`}>Frequency</p>
            <p className="text-[12.5px] font-medium text-slate-700 dark:text-white/70 capitalize">
              {schedule.frequency === "daily"
                ? `${t("feedschedule.daily")} at ${String(schedule.hour).padStart(2,"0")}:${String(schedule.minute).padStart(2,"0")}`
                : schedule.frequency === "monthly"
                ? `${t("feedschedule.monthly")} · Day ${schedule.day_of_month} at ${String(schedule.hour).padStart(2,"0")}:${String(schedule.minute).padStart(2,"0")}`
                : `${t("feedschedule.yearly")} · ${MONTHS[schedule.month-1]} ${schedule.day} at ${String(schedule.hour).padStart(2,"0")}:${String(schedule.minute).padStart(2,"0")}`
              }
            </p>
          </div>
          <div className="px-4 py-3">
            <p className={`mb-0.5 ${labelCls}`}>{t("feedschedule.nextRun")}</p>
            <p className="text-[12px] text-slate-600 dark:text-white/55">{fmtDateTime(schedule.next_run_at)}</p>
          </div>
          <div className="px-4 py-3">
            <p className={`mb-0.5 ${labelCls}`}>{t("feedschedule.lastRun")}</p>
            <p className="text-[12px] text-slate-500 dark:text-white/40">{fmtDateTime(schedule.last_run_at)}</p>
          </div>
        </div>
      )}

      {/* Inline edit form (expanded) */}
      {editing && (
        <div className="border-t border-slate-100 px-5 pb-5 pt-4 dark:border-white/8">
          <div className="space-y-4">

            {/* Enable / Disable */}
            <div className="flex items-center justify-between rounded-lg border border-slate-200/70 bg-slate-50/60 px-4 py-3 dark:border-white/8 dark:bg-white/3">
              <div>
                <p className="text-[12.5px] font-semibold text-slate-700 dark:text-white/75">Auto-update</p>
                <p className="text-[11px] text-slate-400 dark:text-white/35">Enable automatic scheduled updates</p>
              </div>
              <button type="button" onClick={() => setEnabled(p => !p)}
                className="relative inline-flex h-5.5 w-10 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
                style={{ backgroundColor: enabled ? currentColor : "#e2e8f0" }}>
                <span className="inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200"
                  style={{ transform: enabled ? "translateX(18px)" : "translateX(2px)" }} />
              </button>
            </div>

            {/* Frequency */}
            <div>
              <label className={`mb-1.5 block ${labelCls}`}>Frequency</label>
              <div className="flex gap-2">
                {(["daily","monthly","yearly"] as FeedFrequency[]).map(f => (
                  <button key={f} type="button"
                    onClick={() => setFreq(f)}
                    style={freq === f ? { background: accentGrad } : undefined}
                    className={[
                      "flex-1 rounded-lg border py-2 text-[12px] font-semibold transition-all capitalize focus:outline-none",
                      freq === f
                        ? "border-transparent text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/55",
                    ].join(" ")}
                  >
                    {f === "daily" ? t("feedschedule.daily") : f === "monthly" ? t("feedschedule.monthly") : t("feedschedule.yearly")}
                  </button>
                ))}
              </div>
            </div>

            {/* Time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`mb-1.5 block ${labelCls}`}>Hour (0–23)</label>
                <input type="number" min={0} max={23} value={hour}
                  onChange={e => setHour(Math.min(23, Math.max(0, parseInt(e.target.value)||0)))}
                  className={`${inputCls} w-full`} />
              </div>
              <div>
                <label className={`mb-1.5 block ${labelCls}`}>Minute (0–59)</label>
                <input type="number" min={0} max={59} value={minute}
                  onChange={e => setMinute(Math.min(59, Math.max(0, parseInt(e.target.value)||0)))}
                  className={`${inputCls} w-full`} />
              </div>
            </div>

            {/* Monthly: day of month */}
            {freq === "monthly" && (
              <div>
                <label className={`mb-1.5 block ${labelCls}`}>{t("feedschedule.dayOfMonth")} (1–31)</label>
                <input type="number" min={1} max={31} value={dayOfMonth}
                  onChange={e => setDayOfMonth(Math.min(31, Math.max(1, parseInt(e.target.value)||1)))}
                  className={`${inputCls} w-full`} />
              </div>
            )}

            {/* Yearly: month + day */}
            {freq === "yearly" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`mb-1.5 block ${labelCls}`}>{t("feedschedule.month")}</label>
                  <div className="relative">
                    <select value={month} onChange={e => setMonth(parseInt(e.target.value))}
                      className={`${selCls} w-full`}>
                      {MONTHS.map((m, i) => <option key={m} value={i+1}>{m}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className={`mb-1.5 block ${labelCls}`}>{t("feedschedule.day")} (1–31)</label>
                  <input type="number" min={1} max={31} value={day}
                    onChange={e => setDay(Math.min(31, Math.max(1, parseInt(e.target.value)||1)))}
                    className={`${inputCls} w-full`} />
                </div>
              </div>
            )}

            {/* Preview */}
            <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3.5 py-2.5 dark:border-white/8 dark:bg-white/3">
              <p className="text-[10.5px] text-slate-400 dark:text-white/30">
                Next run preview:&nbsp;
                <strong className="text-slate-700 dark:text-white/65">
                  {freq === "daily"
                    ? `Daily at ${String(hour).padStart(2,"0")}:${String(minute).padStart(2,"0")}`
                    : freq === "monthly"
                    ? `Monthly · Day ${dayOfMonth} at ${String(hour).padStart(2,"0")}:${String(minute).padStart(2,"0")}`
                    : `Yearly · ${MONTHS[month-1]} ${day} at ${String(hour).padStart(2,"0")}:${String(minute).padStart(2,"0")}`
                  }
                </strong>
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button type="button" onClick={() => void handleSave()} disabled={saving}
                style={{ background: accentGrad }}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-[12.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-60 focus:outline-none">
                {saving ? <FiRefreshCw className="animate-spin text-[12px]" /> : <FiSave className="text-[12px]" />}
                {saving ? "Saving…" : t("feedschedule.save")}
              </button>
              <button type="button" onClick={cancelEdit}
                className="rounded-xl border border-slate-200 px-4 py-2 text-[12.5px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/8 dark:text-white/55 dark:hover:bg-white/5 focus:outline-none">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── EPSS static card ──────────────────────────────────────────────────────
const EpssFeedCard: React.FC = () => {
  const { t } = useLanguage();
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white dark:border-white/8 dark:bg-[#0d0b1a]/60">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/8">
        <div className="flex items-center gap-3">
          <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[15px]"
            style={{ backgroundColor: "#f9731615", color: "#f97316" }}>
            <FiZap />
          </div>
          <div>
            <p className="text-[13.5px] font-semibold text-slate-800 dark:text-white/88">{t("feed.epssFeed")}</p>
            <p className="text-[11px] text-slate-400 dark:text-white/35">Exploit Prediction Scoring System</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-500 dark:border-white/8 dark:bg-white/5 dark:text-white/40">
          <FiCheckCircle className="text-[10px]" /> Idle
        </span>
      </div>
      <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-white/6">
        <div className="px-5 py-4">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/30">{t("feed.lastSync")}</p>
          <p className="text-[12px] font-medium text-slate-500 dark:text-white/40">{t("feed.never")}</p>
        </div>
        <div className="px-5 py-4">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/30">{t("feed.entries")}</p>
          <p className="text-[22px] font-bold leading-none text-slate-400 dark:text-white/30">—</p>
        </div>
        <div className="px-5 py-4">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/30">{t("feed.nextAuto")}</p>
          <p className="text-[11.5px] font-medium text-slate-600 dark:text-white/55">{t("feed.epssAuto")}</p>
        </div>
      </div>
    </div>
  );
};

// ── Main Page ──────────────────────────────────────────────────────────────
const FeedStatusPage: React.FC = () => {
  const { currentColor } = useStateContext();
  const { t } = useLanguage();

  const [feeds,      setFeeds]      = useState<GMPFeedDTO[]>([]);
  const [kevStatus,  setKevStatus]  = useState<KEVSyncStatusDTO | null>(null);
  const [schedules,  setSchedules]  = useState<FeedScheduleDTO[]>([]);
  const [loadingFeeds, setLoadingFeeds] = useState(true);
  const [loadingKev,   setLoadingKev]   = useState(true);
  const [loadingSched, setLoadingSched] = useState(true);
  const [syncingKEV,   setSyncingKEV]   = useState(false);

  const hasFetched = useRef(false);
  const accentGrad = `linear-gradient(135deg, ${currentColor}, color-mix(in srgb, ${currentColor} 65%, #a855f7))`;

  const fetchAll = useCallback(async () => {
    setLoadingFeeds(true); setLoadingKev(true); setLoadingSched(true);
    const [feedsRes, kevRes, schedRes] = await Promise.all([
      GetGMPFeeds(),
      GetKEVSyncStatus(),
      ListFeedSchedules(),
    ]);
    setFeeds(feedsRes);
    setKevStatus(kevRes);
    setSchedules(schedRes);
    setLoadingFeeds(false); setLoadingKev(false); setLoadingSched(false);
  }, []);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    void fetchAll();
  }, [fetchAll]);

  const handleKEVSync = async () => {
    setSyncingKEV(true);
    const ok = await TriggerKEVSync();
    if (ok) { message.success(t("feed.syncSuccess")); setTimeout(() => void fetchAll(), 3000); }
    else message.error(t("feed.syncFailed"));
    setSyncingKEV(false);
  };

  const handleScheduleSaved = (updated: FeedScheduleDTO) => {
    setSchedules(prev => prev.map(s => s.feed_type === updated.feed_type ? updated : s));
  };

  return (
    <div className="w-full space-y-5">

      {/* ── Header card ── */}
      <div
        className="relative overflow-hidden rounded-[18px] bg-white/95 p-4 shadow-sm backdrop-blur sm:rounded-[22px] sm:p-6 dark:bg-[#0d0b1a]/90"
        style={{ border: `1px solid ${currentColor}30` }}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-12 right-10 h-40 w-40 rounded-full blur-3xl" style={{ backgroundColor: `${currentColor}1e` }} />
          <div className="absolute -bottom-12 left-10 h-40 w-40 rounded-full blur-3xl" style={{ backgroundColor: `${currentColor}14` }} />
        </div>
        <div className="relative z-10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-4">
            <div
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg sm:h-13 sm:w-13"
              style={{ background: accentGrad, boxShadow: `0 8px 24px -6px ${currentColor}50` }}
            >
              <FiActivity className="text-[20px] sm:text-[22px]" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] sm:text-[10.5px]" style={{ color: currentColor }}>
                THREAT INTELLIGENCE · FEEDS
              </p>
              <h1 className="truncate text-[18px] font-bold text-slate-900 sm:text-[20px] dark:text-white/90">
                {t("feed.title")}
              </h1>
              <p className="mt-0.5 text-[11px] text-slate-500 sm:text-[12px] dark:text-white/45">
                {t("feed.subtitle")}
              </p>
            </div>
          </div>
          <button type="button" onClick={() => void fetchAll()}
            disabled={loadingFeeds && loadingKev && loadingSched}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200/70 bg-white text-slate-500 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/8 dark:bg-white/5 dark:text-white/50">
            <FiRefreshCw className={`text-[13px] ${(loadingFeeds || loadingKev || loadingSched) ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* ── OpenVAS Feeds table ── */}
      <section>
        <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-white/28">
          OpenVAS / Greenbone Feeds
        </p>
        <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white dark:border-white/8 dark:bg-[#0d0b1a]/60">
          {loadingFeeds ? (
            <div className="space-y-0">{[1,2,3,4].map(i => (
              <div key={i} className="h-16 animate-pulse border-b border-slate-100 last:border-0 dark:border-white/6" />
            ))}</div>
          ) : feeds.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <FiAlertTriangle className="text-[22px] text-slate-300 dark:text-white/20" />
              <p className="text-[12.5px] font-medium text-slate-500 dark:text-white/40">Cannot reach gvmd — check GMP connection</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-160">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-white/8">
                    {["Type","Content","Origin","Version","Status"].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/70 dark:divide-white/5">
                  {feeds.map(feed => {
                    const color   = FEED_COLOR[feed.type]   ?? currentColor;
                    const icon    = FEED_ICON[feed.type]    ?? <FiDatabase />;
                    const content = FEED_CONTENT[feed.type] ?? feed.type;
                    return (
                      <tr key={feed.type} className="transition-colors hover:bg-slate-50/60 dark:hover:bg-white/2">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2.5">
                            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[14px]"
                              style={{ backgroundColor: `${color}15`, color }}>
                              {icon}
                            </span>
                            <span className="text-[12.5px] font-bold text-slate-800 dark:text-white/88">{feed.type}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-[12px] text-slate-600 dark:text-white/65">{content}</td>
                        <td className="px-5 py-4 text-[12px] font-medium text-slate-700 dark:text-white/72">{feed.name || "—"}</td>
                        <td className="px-5 py-4">
                          <span className="inline-block rounded-full border border-slate-200/70 bg-slate-50 px-2.5 py-0.5 font-mono text-[10.5px] text-slate-600 dark:border-white/8 dark:bg-white/5 dark:text-white/55">
                            {feed.version || "—"}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge status={feed.status} syncing={feed.currently_syncing} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ── KEV Status card ── */}
      <section>
        <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-white/28">
          Threat Intelligence Feeds
        </p>
        <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white dark:border-white/8 dark:bg-[#0d0b1a]/60">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/8">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[15px]"
                style={{ backgroundColor: "#ef444415", color: "#ef4444" }}>
                <FiZap />
              </span>
              <div>
                <p className="text-[13px] font-semibold text-slate-800 dark:text-white/88">{t("feed.kevFeed")}</p>
                <p className="text-[11px] text-slate-400 dark:text-white/35">CISA Known Exploited Vulnerabilities Catalog</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              {!loadingKev && (
                kevStatus?.is_syncing
                  ? <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
                      <FiRefreshCw className="animate-spin text-[10px]" /> Syncing
                    </span>
                  : kevStatus?.last_error
                    ? <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                        <FiAlertTriangle className="text-[10px]" /> Error
                      </span>
                    : <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                        <FiCheckCircle className="text-[10px]" /> Idle
                      </span>
              )}
              <button type="button" onClick={() => void handleKEVSync()}
                disabled={syncingKEV || !!kevStatus?.is_syncing}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11.5px] font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/8 dark:bg-white/5 dark:text-white/55 dark:hover:bg-white/8">
                <FiRefreshCw className={`text-[11px] ${syncingKEV ? "animate-spin" : ""}`} />
                {syncingKEV ? t("feed.syncing") : t("feed.syncNow")}
              </button>
            </div>
          </div>
          {loadingKev ? (
            <div className="h-20 animate-pulse bg-slate-50 dark:bg-white/3" />
          ) : (
            <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-white/6">
              <div className="px-5 py-4">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/30">{t("feed.lastSync")}</p>
                <div className="flex items-center gap-1.5">
                  <FiClock className="shrink-0 text-[11px] text-slate-400 dark:text-white/30" />
                  <p className="text-[12px] font-medium text-slate-700 dark:text-white/72">{fmtDateTime(kevStatus?.last_sync_at)}</p>
                </div>
              </div>
              <div className="px-5 py-4">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/30">{t("feed.entries")}</p>
                <p className="text-[24px] font-bold leading-none" style={{ color: "#ef4444" }}>
                  {kevStatus?.total != null ? kevStatus.total.toLocaleString() : "—"}
                </p>
              </div>
              <div className="px-5 py-4">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/30">{t("feed.nextAuto")}</p>
                <p className="text-[11.5px] font-medium text-slate-600 dark:text-white/55">{t("feed.kevAuto")}</p>
              </div>
            </div>
          )}
          {!loadingKev && kevStatus?.last_error && (
            <div className="border-t border-red-100 bg-red-50/60 px-5 py-3 dark:border-red-500/10 dark:bg-red-500/5">
              <p className="text-[10.5px] text-red-600 dark:text-red-400">
                <span className="font-semibold">{t("feed.lastError")}:</span> {kevStatus.last_error}
              </p>
            </div>
          )}
        </div>

        <div className="mt-3">
          <EpssFeedCard />
        </div>
      </section>

      {/* ── Update Schedule Config ── */}
      <section>
        <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-white/28">
          {t("feedschedule.title")} — {t("feedschedule.subtitle")}
        </p>

        {loadingSched ? (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="h-24 animate-pulse rounded-xl border border-slate-200/80 bg-slate-50 dark:border-white/8 dark:bg-white/4" />
            ))}
          </div>
        ) : schedules.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200/70 bg-white py-12 text-center dark:border-white/8 dark:bg-white/3">
            <p className="text-[12.5px] text-slate-400 dark:text-white/35">No schedules — backend may be starting up</p>
          </div>
        ) : (
          <div className="space-y-3">
            {schedules.map(s => (
              <ScheduleRow
                key={s.feed_type}
                schedule={s}
                onSaved={handleScheduleSaved}
                currentColor={currentColor}
                accentGrad={accentGrad}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Info note ── */}
      <div className="flex items-start gap-2.5 rounded-xl border border-slate-200/70 bg-slate-50/60 px-4 py-3.5 dark:border-white/8 dark:bg-white/3">
        <FiClock className="mt-0.5 shrink-0 text-[13px] text-slate-400 dark:text-white/30" />
        <p className="text-[11.5px] text-slate-500 dark:text-white/45">
          Schedule changes take effect immediately. The backend scheduler checks every minute for due updates.
          Use <em>Sync Now</em> to trigger an immediate manual update for any feed.
        </p>
      </div>

    </div>
  );
};

export default FeedStatusPage;
