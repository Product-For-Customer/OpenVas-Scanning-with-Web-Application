import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventClickArg, CalendarApi, DatesSetArg } from "@fullcalendar/core";
import { BsCalendar3 } from "react-icons/bs";
import { FiX, FiChevronDown, FiTarget, FiClock, FiShield, FiInfo } from "react-icons/fi";
import { MdOutlineRadar } from "react-icons/md";
import dayjs from "dayjs";
import { useStateContext } from "../../contexts/ProviderContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { ListTaskStatus, ListTargetDiffer, type TaskStatusDTO, type TargetDifferDTO } from "../../services/index";

// ── Severity color map ──────────────────────────────────────────────────────
const SEVERITY_COLORS: Record<string, string> = {
  Critical: "#EF4444",
  High:     "#F97316",
  Medium:   "#EAB308",
  Low:      "#22C55E",
  Log:      "#64748B",
  Info:     "#64748B",
};

const PREVIOUS_COLOR   = "#8B5CF6";
const PREVIOUS_BORDER  = "#7C3AED";

const getSeverityColor = (level: string, fallback: string) =>
  SEVERITY_COLORS[level] ?? fallback;

// ── Severity badge colors ───────────────────────────────────────────────────
const SEVERITY_BADGE: Record<string, { bg: string; text: string }> = {
  Critical: { bg: "#FEE2E2", text: "#B91C1C" },
  High:     { bg: "#FFEDD5", text: "#C2410C" },
  Medium:   { bg: "#FEF9C3", text: "#854D0E" },
  Low:      { bg: "#DCFCE7", text: "#166534" },
  Log:      { bg: "#F1F5F9", text: "#475569" },
  Info:     { bg: "#F1F5F9", text: "#475569" },
  Previous: { bg: "#EDE9FE", text: "#6D28D9" },
};

// ── Date/Time helpers ───────────────────────────────────────────────────────
const fmtDate = (iso: string) => {
  const d = dayjs(iso);
  return d.isValid() ? d.format("ddd, MMM D, YYYY") : "-";
};
const fmtTime = (iso: string) => {
  const d = dayjs(iso);
  return d.isValid() ? d.format("HH:mm") : "-";
};
const fmtDateTime = (iso: string) => {
  const d = dayjs(iso);
  return d.isValid() ? d.format("MMM D, YYYY · HH:mm") : "-";
};

// ── Internal scan event type ────────────────────────────────────────────────
interface ScanEvent {
  key:        string;
  taskId:     string;
  taskName:   string;
  targetName: string;
  ip:         string;
  scanTime:   string;  // ISO string
  severity:   string;
  score:      number;
  taskStatus: string;
  reports:    number;
  type:       "latest" | "previous";
}

// ─────────────────────────────────────────────────────────────────────────────
const CalendarPage: React.FC = () => {
  const { currentColor } = useStateContext();
  const { t } = useLanguage();
  const calRef = useRef<InstanceType<typeof FullCalendar>>(null);

  const [tasks,       setTasks]       = useState<TaskStatusDTO[]>([]);
  const [differs,     setDiffers]     = useState<TargetDifferDTO[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [currentView, setCurrentView] = useState("dayGridMonth");
  const [calendarTitle, setCalendarTitle] = useState("");
  const [showActivity, setShowActivity] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<ScanEvent | null>(null);

  const accentGradient = `linear-gradient(135deg, ${currentColor}, color-mix(in srgb, ${currentColor} 65%, #a855f7))`;

  // ── Fetch data ─────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [taskRes, differRes] = await Promise.all([
        ListTaskStatus(),
        ListTargetDiffer(),
      ]);
      setTasks(taskRes ?? []);
      setDiffers(differRes ?? []);
    } catch {
      // silently handle – shows empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Build scan events from API data ────────────────────────────────────────
  const scanEvents = useMemo<ScanEvent[]>(() => {
    // Map task_name → first TargetDifferDTO entry (for previous_creation_time)
    const differMap = new Map<string, TargetDifferDTO>();
    differs.forEach((d) => {
      if (!differMap.has(d.task_name)) differMap.set(d.task_name, d);
    });

    const events: ScanEvent[] = [];

    tasks.forEach((task) => {
      // Skip tasks with no report yet
      if (!task.last_report_at || task.last_report_at === "0001-01-01T00:00:00Z") return;

      // Latest scan event
      events.push({
        key:        `latest-${task.task_id}`,
        taskId:     task.task_id,
        taskName:   task.task_name,
        targetName: task.target_name,
        ip:         task.target_hosts,
        scanTime:   task.last_report_at,
        severity:   task.severity_level,
        score:      task.severity_score,
        taskStatus: task.status,
        reports:    task.reports,
        type:       "latest",
      });

      // Previous scan event – only when ≥ 2 scans completed
      if (task.reports >= 2) {
        const differ = differMap.get(task.task_name);
        if (differ?.previous_creation_time) {
          const prevTime = new Date(differ.previous_creation_time * 1000).toISOString();
          events.push({
            key:        `previous-${task.task_id}`,
            taskId:     task.task_id,
            taskName:   task.task_name,
            targetName: task.target_name,
            ip:         differ.host || task.target_hosts,
            scanTime:   prevTime,
            severity:   "Previous",
            score:      0,
            taskStatus: task.status,
            reports:    task.reports,
            type:       "previous",
          });
        }
      }
    });

    return events;
  }, [tasks, differs]);

  // ── FullCalendar events ────────────────────────────────────────────────────
  const fcEvents = useMemo(
    () =>
      scanEvents.map((e) => ({
        id:              e.key,
        title:           e.type === "previous" ? `↩ ${e.taskName}` : e.taskName,
        start:           e.scanTime,
        allDay:          false,
        backgroundColor: e.type === "previous" ? PREVIOUS_COLOR : getSeverityColor(e.severity, currentColor),
        borderColor:     e.type === "previous" ? PREVIOUS_BORDER : getSeverityColor(e.severity, currentColor),
        textColor:       "#ffffff",
        extendedProps:   e,
      })),
    [scanEvents, currentColor]
  );

  // ── Activity panel list (sorted newest first) ──────────────────────────────
  const activityList = useMemo(
    () => [...scanEvents].sort((a, b) => dayjs(b.scanTime).valueOf() - dayjs(a.scanTime).valueOf()),
    [scanEvents]
  );

  // ── Calendar navigation ────────────────────────────────────────────────────
  const getApi  = (): CalendarApi | null => calRef.current?.getApi() ?? null;
  const goToday = () => getApi()?.today();
  const goPrev  = () => getApi()?.prev();
  const goNext  = () => getApi()?.next();
  const changeView = (v: string) => {
    setCurrentView(v);
    getApi()?.changeView(v);
  };
  const handleDatesSet = (arg: DatesSetArg) => setCalendarTitle(arg.view.title);

  // ── Event click handler ────────────────────────────────────────────────────
  const handleEventClick = (info: EventClickArg) => {
    const ev = info.event.extendedProps as ScanEvent;
    setSelectedEvent(ev);
  };

  const VIEW_TABS = [
    { key: "dayGridMonth", label: t("calendar.month") },
    { key: "timeGridWeek", label: t("calendar.week") },
    { key: "timeGridDay",  label: t("calendar.day") },
    { key: "listYear",     label: t("calendar.list") },
  ];

  // ── Activity panel (shared between mobile/desktop) ─────────────────────────
  const ActivityPanel = (
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white dark:border-white/8 dark:bg-[#09071d]/60 h-full">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-white/8">
        <span className="text-[13px] font-bold text-slate-800 dark:text-white/85">
          {t("calendar.activityLabel")}
        </span>
        <button
          type="button"
          onClick={goToday}
          className="rounded-lg border px-2.5 py-1 text-[10.5px] font-semibold transition-colors focus:outline-none"
          style={{ borderColor: `${currentColor}40`, color: currentColor }}
        >
          {t("calendar.today")}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2.5 py-2 space-y-0.5">
        {loading && (
          <div className="flex h-20 items-center justify-center">
            <div
              className="h-5 w-5 animate-spin rounded-full border-2 border-t-transparent"
              style={{ borderColor: `${currentColor} transparent transparent transparent` }}
            />
          </div>
        )}

        {!loading && activityList.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-slate-400 dark:text-white/30">
            <MdOutlineRadar className="text-[28px] mb-2" />
            <p className="text-[11.5px]">{t("calendar.noActivity")}</p>
          </div>
        )}

        {!loading &&
          activityList.map((ev) => {
            const dotColor =
              ev.type === "previous"
                ? PREVIOUS_COLOR
                : getSeverityColor(ev.severity, currentColor);
            const badge = SEVERITY_BADGE[ev.severity] ?? SEVERITY_BADGE["Info"];

            return (
              <button
                key={ev.key}
                type="button"
                onClick={() => setSelectedEvent(ev)}
                className="group w-full flex flex-col gap-1 rounded-xl px-3 py-2.5 text-left transition-all hover:bg-slate-50 dark:hover:bg-white/4 focus:outline-none"
              >
                {/* Date row */}
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: dotColor }}
                  />
                  <span className="truncate text-[11.5px] font-semibold text-slate-700 dark:text-white/80">
                    {fmtDate(ev.scanTime)}
                  </span>
                  <span className="ml-auto shrink-0 text-[10px] text-slate-400 dark:text-white/30">
                    {fmtTime(ev.scanTime)}
                  </span>
                </div>

                {/* Task name */}
                <div className="pl-4">
                  <p className="truncate text-[11.5px] font-medium text-slate-600 dark:text-white/60">
                    {ev.type === "previous" ? `↩ ${ev.taskName}` : ev.taskName}
                  </p>
                  <p className="truncate text-[10.5px] text-slate-400 dark:text-white/35">
                    {ev.targetName} · {ev.ip}
                  </p>
                </div>

                {/* Badge */}
                <div className="pl-4">
                  <span
                    className="inline-block rounded-full px-2 py-0.5 text-[9.5px] font-semibold"
                    style={{ backgroundColor: badge.bg, color: badge.text }}
                  >
                    {ev.type === "previous" ? t("calendar.previousScan") : ev.severity}
                  </span>
                </div>
              </button>
            );
          })}
      </div>
    </div>
  );

  // ── Legend row ─────────────────────────────────────────────────────────────
  const LegendRow = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-1">
      {[
        { label: t("calendar.latestScan"), color: "#EF4444", sub: t("severity.critical") },
        { label: "",                        color: "#F97316", sub: t("severity.high") },
        { label: "",                        color: "#EAB308", sub: t("severity.medium") },
        { label: "",                        color: "#22C55E", sub: t("severity.low") },
        { label: t("calendar.previousScan"), color: PREVIOUS_COLOR, sub: t("common.prev") },
      ].map(({ label, color, sub }) => (
        <span key={sub} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: color }} />
          <span className="text-[10.5px] text-slate-500 dark:text-white/40">
            {label || sub}
          </span>
        </span>
      ))}
    </div>
  );

  return (
    <>
      {/* ── FullCalendar custom CSS ── */}
      <style>{`
        .fc { font-family: inherit; }
        .fc .fc-toolbar { display: none !important; }
        .fc .fc-daygrid-day-number { font-size: 12px; color: #64748b; padding: 4px 6px; }
        .fc .fc-col-header-cell-cushion { font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: .06em; padding: 6px 0; text-decoration: none; }
        .fc .fc-daygrid-event { border-radius: 5px; font-size: 11px; font-weight: 500; padding: 1px 5px; margin: 1px 2px; border: none !important; }
        .fc .fc-event-title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .fc .fc-daygrid-day.fc-day-today .fc-daygrid-day-number { background: ${currentColor}; color: #fff; border-radius: 50%; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; margin: 3px; padding: 0; }
        .fc .fc-daygrid-day.fc-day-today { background: ${currentColor}0a; }
        .fc .fc-scrollgrid { border: none !important; }
        .fc .fc-scrollgrid td, .fc .fc-scrollgrid th { border-color: #f1f5f9 !important; }
        .fc thead .fc-scrollgrid-sync-inner { border-bottom: 1px solid #f1f5f9; }
        .dark .fc .fc-daygrid-day-number { color: rgba(255,255,255,.45); }
        .dark .fc .fc-col-header-cell-cushion { color: rgba(255,255,255,.3); }
        .dark .fc .fc-scrollgrid td, .dark .fc .fc-scrollgrid th { border-color: rgba(255,255,255,.08) !important; }
        .dark .fc thead .fc-scrollgrid-sync-inner { border-color: rgba(255,255,255,.08); }
        .dark .fc .fc-daygrid-day.fc-day-today { background: ${currentColor}14; }
        .fc .fc-list-event:hover td { background: ${currentColor}0f; }
        .fc .fc-list-day-cushion { background: #f8fafc; }
        .dark .fc .fc-list-day-cushion { background: rgba(255,255,255,.04); }
        .fc .fc-timegrid-slot { height: 2.25rem; }
        .fc .fc-list-event-time { font-size: 11px; }
        .fc .fc-list-event-title { font-size: 12px; font-weight: 500; }
        .fc .fc-event:hover { cursor: pointer; opacity: 0.88; }
      `}</style>

      {/* ── Page header card ── */}
      <div
        className="relative mb-4 overflow-hidden rounded-[18px] bg-white/95 p-4 shadow-sm backdrop-blur sm:rounded-[22px] sm:mb-5 sm:p-6 dark:bg-[#0d0b1a]/90"
        style={{ borderWidth: 1, borderStyle: "solid", borderColor: `${currentColor}30` }}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-12 right-10 h-40 w-40 rounded-full blur-3xl" style={{ backgroundColor: `${currentColor}1e` }} />
          <div className="absolute -bottom-12 left-10 h-40 w-40 rounded-full blur-3xl" style={{ backgroundColor: `${currentColor}14` }} />
        </div>
        <div className="relative z-10 flex items-center gap-3 sm:gap-4">
          <div
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg sm:h-13 sm:w-13"
            style={{ background: accentGradient, boxShadow: `0 8px 24px -6px ${currentColor}50` }}
          >
            <BsCalendar3 className="text-[20px] sm:text-[24px]" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] sm:text-[10.5px]" style={{ color: currentColor }}>
              {t("calendar.kicker")}
            </p>
            <h1 className="truncate text-[18px] font-bold text-slate-900 sm:text-[22px] dark:text-white/90">
              {t("calendar.title")}
            </h1>
            <p className="mt-0.5 truncate text-[11px] text-slate-500 sm:text-[12px] dark:text-white/45">
              {t("calendar.subtitle")}
            </p>
          </div>
          <div className="ml-auto hidden sm:flex items-center gap-3">
            {/* Stats chips */}
            {[
              { label: t("calendar.latestScan"),  value: tasks.length,                                          color: currentColor },
              { label: t("calendar.previousScan"), value: scanEvents.filter((e) => e.type === "previous").length, color: PREVIOUS_COLOR },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="flex flex-col items-center rounded-xl border px-3 py-1.5 dark:border-white/8"
                style={{ borderColor: `${color}30`, backgroundColor: `${color}08` }}
              >
                <span className="text-[18px] font-bold" style={{ color }}>{value}</span>
                <span className="text-[9.5px] text-slate-500 dark:text-white/40">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ MOBILE ══ */}
      <div className="flex flex-col gap-3 lg:hidden">
        {/* Activity toggle */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowActivity((v) => !v)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 text-[12px] font-semibold text-slate-600 transition-all hover:bg-slate-50 dark:border-white/8 dark:bg-[#09071d]/60 dark:text-white/60 focus:outline-none"
          >
            <BsCalendar3 className="text-[13px]" />
            {t("calendar.activityLabel")}
            <FiChevronDown className={`text-[12px] transition-transform ${showActivity ? "rotate-180" : ""}`} />
          </button>
          <div className="ml-auto">{LegendRow}</div>
        </div>

        {showActivity && <div style={{ maxHeight: "40vh" }}>{ActivityPanel}</div>}

        {/* Calendar card */}
        <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white dark:border-white/8 dark:bg-[#09071d]/60">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5 dark:border-white/8">
            <div className="flex items-center gap-2">
              <span
                className="w-0.75 self-stretch rounded-full"
                style={{ background: `linear-gradient(to bottom, ${currentColor}, color-mix(in srgb, ${currentColor} 60%, purple))` }}
              />
              <h2 className="text-[15px] font-bold text-slate-800 dark:text-white/88">{t("calendar.title")}</h2>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-0.5 rounded-xl border border-slate-200 bg-slate-50 p-0.5 dark:border-white/10 dark:bg-white/4">
                <button type="button" onClick={goPrev} className="flex h-7 w-7 items-center justify-center rounded-lg text-[16px] text-slate-500 hover:bg-white dark:text-white/50 dark:hover:bg-white/10 transition-all focus:outline-none">‹</button>
                <span className="min-w-24 px-1 text-center text-[11px] font-semibold text-slate-600 dark:text-white/70">{calendarTitle}</span>
                <button type="button" onClick={goNext} className="flex h-7 w-7 items-center justify-center rounded-lg text-[16px] text-slate-500 hover:bg-white dark:text-white/50 dark:hover:bg-white/10 transition-all focus:outline-none">›</button>
              </div>
              <button
                type="button"
                onClick={goToday}
                className="rounded-xl border px-3 py-1.5 text-[11px] font-semibold transition-colors focus:outline-none"
                style={{ borderColor: `${currentColor}40`, color: currentColor }}
              >
                {t("calendar.today")}
              </button>
            </div>
            <div className="flex w-full gap-0.5 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-0.5 dark:border-white/10 dark:bg-white/4">
              {VIEW_TABS.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => changeView(v.key)}
                  className="flex-1 whitespace-nowrap rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-all focus:outline-none text-slate-500 dark:text-white/45"
                  style={currentView === v.key ? { background: accentGradient, color: "white" } : undefined}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-auto p-2" style={{ height: "calc(100dvh - 280px)", minHeight: "380px" }}>
            <FullCalendar
              ref={calRef}
              plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              headerToolbar={false}
              datesSet={handleDatesSet}
              events={fcEvents}
              editable={false}
              selectable={false}
              eventClick={handleEventClick}
              height="100%"
              dayMaxEvents={2}
              eventDisplay="block"
              nowIndicator
            />
          </div>
        </div>
      </div>

      {/* ══ DESKTOP ══ */}
      <div className="hidden lg:flex gap-4 overflow-hidden" style={{ height: "calc(100dvh - 120px)" }}>
        {/* Left: activity panel */}
        <div className="flex w-64 shrink-0 flex-col gap-3">
          <div className="flex-1 overflow-hidden">{ActivityPanel}</div>
        </div>

        {/* Right: calendar */}
        <div className="flex flex-1 min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white dark:border-white/8 dark:bg-[#09071d]/60">
          {/* Toolbar */}
          <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-white/8">
            <div className="flex items-center gap-2.5">
              <span
                className="w-0.75 self-stretch rounded-full"
                style={{ background: `linear-gradient(to bottom, ${currentColor}, color-mix(in srgb, ${currentColor} 60%, purple))` }}
              />
              <h2 className="text-[17px] font-bold text-slate-800 dark:text-white/88">{t("calendar.title")}</h2>
              <div className="ml-2">{LegendRow}</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5 rounded-xl border border-slate-200 bg-slate-50 p-0.5 dark:border-white/10 dark:bg-white/4">
                <button type="button" onClick={goPrev} className="flex h-7 w-7 items-center justify-center rounded-lg text-[16px] text-slate-500 hover:bg-white dark:text-white/50 dark:hover:bg-white/10 transition-all focus:outline-none">‹</button>
                <span className="min-w-28 px-1.5 text-center text-[12px] font-semibold text-slate-600 dark:text-white/70">{calendarTitle}</span>
                <button type="button" onClick={goNext} className="flex h-7 w-7 items-center justify-center rounded-lg text-[16px] text-slate-500 hover:bg-white dark:text-white/50 dark:hover:bg-white/10 transition-all focus:outline-none">›</button>
              </div>
              <button
                type="button"
                onClick={goToday}
                className="rounded-xl border px-3.5 py-1.5 text-[12px] font-semibold transition-colors focus:outline-none"
                style={{ borderColor: `${currentColor}40`, color: currentColor }}
              >
                {t("calendar.today")}
              </button>
              <div className="flex items-center gap-0.5 rounded-xl border border-slate-200 bg-slate-50 p-0.5 dark:border-white/10 dark:bg-white/4">
                {VIEW_TABS.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => changeView(v.key)}
                    className="rounded-lg px-3 py-1.5 text-[11.5px] font-semibold transition-all focus:outline-none text-slate-500 dark:text-white/45"
                    style={currentView === v.key ? { background: accentGradient, color: "white" } : undefined}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Calendar grid */}
          <div className="flex-1 overflow-auto p-4">
            <FullCalendar
              ref={calRef}
              plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              headerToolbar={false}
              datesSet={handleDatesSet}
              events={fcEvents}
              editable={false}
              selectable={false}
              eventClick={handleEventClick}
              height="100%"
              dayMaxEvents={3}
              eventDisplay="block"
              nowIndicator
            />
          </div>
        </div>
      </div>

      {/* ── Detail Modal ── */}
      {selectedEvent &&
        createPortal(
          <div className="fixed inset-0 z-9999 flex items-center justify-center p-3 sm:p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={() => setSelectedEvent(null)} />
            <div
              className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl bg-white dark:bg-[#12101f]"
              style={{ boxShadow: `0 24px 64px -12px ${currentColor}40, 0 8px 24px rgba(0,0,0,.18)` }}
            >
              {/* Modal header */}
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5 sm:px-5 sm:py-4 dark:border-white/8">
                <div className="flex items-center gap-2.5">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white"
                    style={{
                      background:
                        selectedEvent.type === "previous"
                          ? `linear-gradient(135deg, ${PREVIOUS_COLOR}, ${PREVIOUS_BORDER})`
                          : `linear-gradient(135deg, ${getSeverityColor(selectedEvent.severity, currentColor)}, color-mix(in srgb, ${getSeverityColor(selectedEvent.severity, currentColor)} 70%, #000))`,
                    }}
                  >
                    <MdOutlineRadar className="text-[15px]" />
                  </span>
                  <div>
                    <p
                      className="text-[10px] font-bold uppercase tracking-widest"
                      style={{ color: selectedEvent.type === "previous" ? PREVIOUS_COLOR : getSeverityColor(selectedEvent.severity, currentColor) }}
                    >
                      {selectedEvent.type === "previous" ? t("calendar.previousScan") : t("calendar.latestScan")}
                    </p>
                    <h3 className="text-[14px] font-bold leading-tight text-slate-800 dark:text-white/90">
                      {t("calendar.scanDetails")}
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedEvent(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:text-white/35 dark:hover:bg-white/8 transition-colors focus:outline-none"
                >
                  <FiX className="text-[15px]" />
                </button>
              </div>

              {/* Modal body */}
              <div className="px-5 py-4 space-y-3">
                {/* Task name */}
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/35">
                    {t("calendar.taskName")}
                  </span>
                  <span className="text-[14px] font-semibold text-slate-800 dark:text-white/90">
                    {selectedEvent.taskName}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Target name */}
                  <div className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-white/4">
                    <FiTarget className="mt-0.5 shrink-0 text-[13px]" style={{ color: currentColor }} />
                    <div className="min-w-0">
                      <p className="text-[9.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/35">
                        {t("calendar.targetName")}
                      </p>
                      <p className="truncate text-[12px] font-medium text-slate-700 dark:text-white/75">
                        {selectedEvent.targetName || "-"}
                      </p>
                    </div>
                  </div>

                  {/* IP address */}
                  <div className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-white/4">
                    <FiInfo className="mt-0.5 shrink-0 text-[13px] text-slate-400 dark:text-white/35" />
                    <div className="min-w-0">
                      <p className="text-[9.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/35">
                        {t("calendar.ip")}
                      </p>
                      <p className="truncate text-[12px] font-medium text-slate-700 dark:text-white/75 font-mono">
                        {selectedEvent.ip || "-"}
                      </p>
                    </div>
                  </div>

                  {/* Scan time */}
                  <div className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-white/4">
                    <FiClock className="mt-0.5 shrink-0 text-[13px] text-slate-400 dark:text-white/35" />
                    <div className="min-w-0">
                      <p className="text-[9.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/35">
                        {t("calendar.scanTime")}
                      </p>
                      <p className="text-[12px] font-medium text-slate-700 dark:text-white/75">
                        {fmtDateTime(selectedEvent.scanTime)}
                      </p>
                    </div>
                  </div>

                  {/* Severity */}
                  <div className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-white/4">
                    <FiShield className="mt-0.5 shrink-0 text-[13px] text-slate-400 dark:text-white/35" />
                    <div className="min-w-0">
                      <p className="text-[9.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/35">
                        {t("calendar.severityLevel")}
                      </p>
                      {selectedEvent.type === "previous" ? (
                        <span
                          className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{ backgroundColor: SEVERITY_BADGE["Previous"].bg, color: SEVERITY_BADGE["Previous"].text }}
                        >
                          {t("calendar.previousScan")}
                        </span>
                      ) : (
                        <span
                          className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{
                            backgroundColor: (SEVERITY_BADGE[selectedEvent.severity] ?? SEVERITY_BADGE["Info"]).bg,
                            color:           (SEVERITY_BADGE[selectedEvent.severity] ?? SEVERITY_BADGE["Info"]).text,
                          }}
                        >
                          {selectedEvent.severity}
                          {selectedEvent.score > 0 && ` (${selectedEvent.score.toFixed(1)})`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom row: task status + total scans */}
                <div className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-2.5 dark:border-white/8">
                  <div>
                    <p className="text-[9.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/35">
                      {t("calendar.taskStatus")}
                    </p>
                    <p className="text-[12px] font-medium text-slate-700 dark:text-white/70">
                      {selectedEvent.taskStatus || "-"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/35">
                      {t("calendar.totalReports")}
                    </p>
                    <p className="text-[14px] font-bold" style={{ color: currentColor }}>
                      {selectedEvent.reports}
                    </p>
                  </div>
                </div>

                {/* Type badge */}
                <div
                  className="w-full rounded-xl py-2 text-center text-[11px] font-semibold"
                  style={
                    selectedEvent.type === "previous"
                      ? { backgroundColor: `${PREVIOUS_COLOR}15`, color: PREVIOUS_COLOR }
                      : { backgroundColor: `${currentColor}12`, color: currentColor }
                  }
                >
                  {selectedEvent.type === "previous"
                    ? `↩ ${t("calendar.previousScan")} — ${selectedEvent.reports} ${t("calendar.totalScansSuffix")}`
                    : `✓ ${t("calendar.latestScan")} — ${selectedEvent.reports} ${t("calendar.totalScansSuffix")}`}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

export default CalendarPage;
