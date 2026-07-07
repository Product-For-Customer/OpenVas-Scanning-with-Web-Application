import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { message } from "antd";
import {
  FiMail, FiSend, FiPlus, FiEdit2, FiTrash2, FiPlay, FiClock,
  FiX, FiAlertTriangle, FiRefreshCw, FiCheckCircle, FiCalendar,
} from "react-icons/fi";
import { useStateContext } from "../../contexts/ProviderContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useAuth } from "../../contexts/AuthContext";
import {
  ListReportDigests, CreateReportDigest, UpdateReportDigest,
  DeleteReportDigest, RunReportDigestNow,
  type ReportDigestDTO, type ReportDigestInput, type DigestChannel, type DigestFrequency,
} from "../../services/reportdigest";
import { ListAppNotification, type AppNotificationResponse } from "../../services/line";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const TIMEZONES = [
  "Asia/Bangkok", "Asia/Singapore", "Asia/Tokyo", "Asia/Kolkata",
  "UTC", "Europe/London", "America/New_York", "Australia/Sydney",
];

const pad2 = (n: number) => String(n).padStart(2, "0");

const fmtDateTime = (iso: string | null): string => {
  if (!iso || iso === "0001-01-01T00:00:00Z") return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
};

const scheduleSummary = (d: ReportDigestDTO): string => {
  const at = `${pad2(d.hour)}:${pad2(d.minute)}`;
  switch (d.frequency) {
    case "weekly": return `Every ${WEEKDAYS[d.day_of_week] ?? "?"} at ${at}`;
    case "monthly": return `Day ${d.day_of_month} of every month at ${at}`;
    case "yearly": return `${MONTHS[(d.month || 1) - 1]} ${d.day} every year at ${at}`;
    default: return at;
  }
};

const axiosMsg = (e: unknown, fallback: string): string => {
  const err = e as { response?: { data?: { error?: string } } };
  return err?.response?.data?.error || fallback;
};

const toInput = (d: ReportDigestDTO): ReportDigestInput => ({
  name: d.name, channel: d.channel, frequency: d.frequency,
  hour: d.hour, minute: d.minute, day_of_week: d.day_of_week,
  day_of_month: d.day_of_month, month: d.month, day: d.day,
  timezone: d.timezone, email_to: d.email_to,
  line_notification_ids: d.line_notification_ids, enabled: d.enabled,
});

// ── Create/Edit modal ─────────────────────────────────────────────────────

const DigestModal: React.FC<{
  initial?: ReportDigestDTO;
  notifications: AppNotificationResponse[];
  onCancel: () => void;
  onSaved: (d: ReportDigestDTO) => void;
}> = ({ initial, notifications, onCancel, onSaved }) => {
  const { currentColor } = useStateContext();
  const accent = `linear-gradient(135deg, ${currentColor}, color-mix(in srgb, ${currentColor} 65%, #a855f7))`;

  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(initial?.name ?? "");
  const [channel, setChannel] = useState<DigestChannel>(initial?.channel ?? "email");
  const [frequency, setFrequency] = useState<DigestFrequency>(initial?.frequency ?? "weekly");
  const [hour, setHour] = useState(initial?.hour ?? 8);
  const [minute, setMinute] = useState(initial?.minute ?? 0);
  const [dayOfWeek, setDayOfWeek] = useState(initial?.day_of_week ?? 1);
  const [dayOfMonth, setDayOfMonth] = useState(initial?.day_of_month ?? 1);
  const [month, setMonth] = useState(initial?.month ?? 1);
  const [day, setDay] = useState(initial?.day ?? 1);
  const [timezone, setTimezone] = useState(initial?.timezone ?? "Asia/Bangkok");
  const [emailTo, setEmailTo] = useState(initial?.email_to ?? "");
  const [lineIds, setLineIds] = useState<Set<number>>(
    new Set((initial?.line_notification_ids ?? "").split(",").map((s) => Number(s.trim())).filter((n) => n > 0))
  );

  const inputCls = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400 dark:border-white/10 dark:bg-white/5 dark:text-white/85";
  const labelCls = "mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/40";

  const toggleLine = (id: number) => setLineIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const save = async () => {
    setSaving(true);
    try {
      const input: ReportDigestInput = {
        name: name.trim(), channel, frequency, hour, minute,
        day_of_week: dayOfWeek, day_of_month: dayOfMonth, month, day,
        timezone, email_to: emailTo.trim(),
        line_notification_ids: Array.from(lineIds).join(","),
        enabled: initial?.enabled ?? true,
      };
      const saved = initial
        ? await UpdateReportDigest(initial.id, input)
        : await CreateReportDigest(input);
      message.success(initial ? "Digest updated" : "Digest created");
      onSaved(saved);
    } catch (e: unknown) {
      message.error(axiosMsg(e, "Failed to save digest"));
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={saving ? undefined : onCancel} />
      <div className="relative z-10 flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-[#12101f]">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/8">
          <h3 className="text-[15px] font-bold text-slate-800 dark:text-white/90">
            {initial ? "Edit Report Digest" : "New Report Digest"}
          </h3>
          <button onClick={onCancel} disabled={saving} className="text-slate-400 hover:text-slate-600"><FiX /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          <div>
            <label className={labelCls}>Name</label>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Weekly executive report" />
          </div>

          {/* Channel */}
          <div>
            <label className={labelCls}>Deliver via</label>
            <div className="flex gap-2">
              {(["email", "line"] as DigestChannel[]).map((ch) => (
                <button key={ch} type="button" onClick={() => setChannel(ch)}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg border py-2 text-sm font-medium capitalize transition ${channel === ch ? "border-blue-400 bg-blue-50 text-blue-600 dark:bg-blue-500/10" : "border-slate-200 text-slate-500 dark:border-white/10"}`}>
                  {ch === "email" ? <FiMail size={14} /> : <FiSend size={14} />} {ch}
                </button>
              ))}
            </div>
          </div>

          {/* Frequency + time */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Frequency</label>
              <select className={inputCls} value={frequency} onChange={(e) => setFrequency(e.target.value as DigestFrequency)}>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Hour</label>
              <input type="number" min={0} max={23} className={inputCls} value={hour} onChange={(e) => setHour(Number(e.target.value))} />
            </div>
            <div>
              <label className={labelCls}>Minute</label>
              <input type="number" min={0} max={59} className={inputCls} value={minute} onChange={(e) => setMinute(Number(e.target.value))} />
            </div>
          </div>

          {/* Conditional day fields */}
          {frequency === "weekly" && (
            <div>
              <label className={labelCls}>Day of week</label>
              <select className={inputCls} value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))}>
                {WEEKDAYS.map((w, i) => <option key={i} value={i}>{w}</option>)}
              </select>
            </div>
          )}
          {frequency === "monthly" && (
            <div>
              <label className={labelCls}>Day of month (1-31)</label>
              <input type="number" min={1} max={31} className={inputCls} value={dayOfMonth} onChange={(e) => setDayOfMonth(Number(e.target.value))} />
            </div>
          )}
          {frequency === "yearly" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Month</label>
                <select className={inputCls} value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                  {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Day (1-31)</label>
                <input type="number" min={1} max={31} className={inputCls} value={day} onChange={(e) => setDay(Number(e.target.value))} />
              </div>
            </div>
          )}

          <div>
            <label className={labelCls}>Timezone</label>
            <select className={inputCls} value={timezone} onChange={(e) => setTimezone(e.target.value)}>
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>

          {/* Targets */}
          {channel === "email" ? (
            <div>
              <label className={labelCls}>Recipient email(s)</label>
              <input className={inputCls} value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="alice@example.com, bob@example.com" />
              <p className="mt-1 text-[11px] text-slate-400">Comma-separated. Uses the SMTP account from Service settings.</p>
            </div>
          ) : (
            <div>
              <label className={labelCls}>LINE targets</label>
              {notifications.length === 0 ? (
                <p className="text-[12px] text-slate-400">No LINE notifications configured — add one on the LINE page first.</p>
              ) : (
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2 dark:border-white/10">
                  {notifications.map((n) => (
                    <label key={n.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-50 dark:hover:bg-white/5">
                      <input type="checkbox" checked={lineIds.has(n.id)} onChange={() => toggleLine(n.id)} />
                      <span className="text-slate-700 dark:text-white/75">{n.name}</span>
                      {!n.alert && <span className="text-[10px] text-amber-500">(alert off)</span>}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 gap-2 border-t border-slate-100 px-5 py-4 dark:border-white/8">
          <button onClick={onCancel} disabled={saving} className="flex-1 rounded-xl border border-slate-200 py-2 text-sm font-semibold text-slate-600 dark:border-white/10 dark:text-white/60">Cancel</button>
          <button onClick={() => void save()} disabled={saving || !name.trim()} style={{ background: accent }}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-sm font-semibold text-white disabled:opacity-60">
            {saving && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
            {initial ? "Update" : "Create"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ── Delete confirm ────────────────────────────────────────────────────────

const DeleteConfirm: React.FC<{ name: string; loading: boolean; onCancel: () => void; onConfirm: () => void; }> =
  ({ name, loading, onCancel, onConfirm }) => createPortal(
    <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={loading ? undefined : onCancel} />
      <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl bg-white dark:bg-[#12101f]">
        <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-4 dark:border-white/8">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-red-500 text-white"><FiTrash2 size={14} /></span>
          <h3 className="text-[14px] font-bold text-slate-800 dark:text-white/90">Delete digest</h3>
        </div>
        <div className="space-y-4 px-5 py-5">
          <p className="flex items-start gap-2 text-[12px] text-red-600 dark:text-red-300">
            <FiAlertTriangle className="mt-0.5 shrink-0" /> This removes the schedule <b>{name}</b>. It won't send anymore. This cannot be undone.
          </p>
          <div className="flex gap-2">
            <button onClick={onCancel} disabled={loading} className="flex-1 rounded-xl border border-slate-200 py-2 text-sm font-semibold text-slate-600 dark:border-white/10 dark:text-white/60">Cancel</button>
            <button onClick={onConfirm} disabled={loading} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {loading && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />} Delete
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );

// ── Page ──────────────────────────────────────────────────────────────────

const ReportDigestPage: React.FC = () => {
  const { currentColor } = useStateContext();
  const { t } = useLanguage();
  const { can } = useAuth();
  const canManage = can("dashboard", "manage");
  const accent = `linear-gradient(135deg, ${currentColor}, color-mix(in srgb, ${currentColor} 65%, #a855f7))`;

  const [digests, setDigests] = useState<ReportDigestDTO[]>([]);
  const [notifications, setNotifications] = useState<AppNotificationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ mode: "create" | "edit"; digest?: ReportDigestDTO } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ReportDigestDTO | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [ds, ns] = await Promise.all([ListReportDigests(), ListAppNotification()]);
    setDigests(ds);
    setNotifications(ns ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const runNow = async (d: ReportDigestDTO) => {
    setBusyId(d.id);
    try {
      await RunReportDigestNow(d.id);
      message.success("Digest sent");
      void load();
    } catch (e: unknown) {
      message.error(axiosMsg(e, "Failed to send digest"));
    } finally {
      setBusyId(null);
    }
  };

  const toggleEnabled = async (d: ReportDigestDTO) => {
    try {
      const updated = await UpdateReportDigest(d.id, { ...toInput(d), enabled: !d.enabled });
      setDigests((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch (e: unknown) {
      message.error(axiosMsg(e, "Failed to update"));
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      await DeleteReportDigest(deleteTarget.id);
      setDigests((prev) => prev.filter((x) => x.id !== deleteTarget.id));
      setDeleteTarget(null);
      message.success("Digest deleted");
    } catch (e: unknown) {
      message.error(axiosMsg(e, "Failed to delete"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl text-white" style={{ background: accent }}>
            <FiMail size={20} />
          </span>
          <div>
            <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">{t("nav.reportDigest")}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Automatically generate the executive report and deliver it to email or LINE on a schedule.
            </p>
          </div>
        </div>
        {canManage && (
          <button onClick={() => setModal({ mode: "create" })} style={{ background: accent }}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white">
            <FiPlus size={14} /> New
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : digests.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-gray-300 py-16 text-center dark:border-gray-700">
          <FiClock className="text-2xl text-gray-300" />
          <p className="text-sm text-gray-500">No scheduled digests yet.</p>
          {canManage && <p className="text-xs text-gray-400">Click “New” to schedule your first automated report.</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {digests.map((d) => (
            <div key={d.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-gray-800 dark:text-gray-100">{d.name}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-600 dark:bg-blue-500/10">
                      {d.channel === "email" ? <FiMail size={10} /> : <FiSend size={10} />} {d.channel}
                    </span>
                    {!d.enabled && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500 dark:bg-white/10">paused</span>}
                    {d.last_status === "ok" && <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600"><FiCheckCircle size={10} /> last ok</span>}
                    {d.last_status === "failed" && <span className="inline-flex items-center gap-1 text-[11px] text-red-500" title={d.last_error}><FiAlertTriangle size={10} /> last failed</span>}
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-gray-500 dark:text-gray-400">
                    <FiCalendar size={12} /> {scheduleSummary(d)} · {d.timezone}
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-gray-400">
                    To: {d.channel === "email" ? (d.email_to || "—") : `${d.line_notification_ids.split(",").filter(Boolean).length} LINE target(s)`}
                    <span className="mx-1.5">·</span>Next: {fmtDateTime(d.next_run_at)}
                  </p>
                </div>
                {canManage && (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button onClick={() => toggleEnabled(d)} title={d.enabled ? "Pause" : "Resume"}
                      className="rounded-lg border border-gray-200 px-2 py-1.5 text-[11px] font-medium text-gray-500 hover:bg-gray-50 dark:border-white/10">
                      {d.enabled ? "Pause" : "Resume"}
                    </button>
                    <button onClick={() => void runNow(d)} disabled={busyId === d.id} title="Send now"
                      className="grid h-8 w-8 place-items-center rounded-lg border border-gray-200 text-emerald-600 hover:bg-emerald-50 disabled:opacity-40 dark:border-white/10">
                      {busyId === d.id ? <FiRefreshCw className="animate-spin" size={13} /> : <FiPlay size={13} />}
                    </button>
                    <button onClick={() => setModal({ mode: "edit", digest: d })} title="Edit"
                      className="grid h-8 w-8 place-items-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-white/10">
                      <FiEdit2 size={13} />
                    </button>
                    <button onClick={() => setDeleteTarget(d)} title="Delete"
                      className="grid h-8 w-8 place-items-center rounded-lg border border-gray-200 text-gray-500 hover:bg-red-50 hover:text-red-500 dark:border-white/10">
                      <FiTrash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <DigestModal
          initial={modal.mode === "edit" ? modal.digest : undefined}
          notifications={notifications}
          onCancel={() => setModal(null)}
          onSaved={(saved) => {
            setDigests((prev) => {
              const exists = prev.some((x) => x.id === saved.id);
              return exists ? prev.map((x) => (x.id === saved.id ? saved : x)) : [saved, ...prev];
            });
            setModal(null);
          }}
        />
      )}

      {deleteTarget && (
        <DeleteConfirm
          name={deleteTarget.name}
          loading={busyId === deleteTarget.id}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}
    </div>
  );
};

export default ReportDigestPage;
