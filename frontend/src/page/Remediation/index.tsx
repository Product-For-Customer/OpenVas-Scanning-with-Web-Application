import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  FiClipboard, FiPlus, FiEdit2, FiTrash2, FiX, FiSearch, FiRefreshCw, FiAlertTriangle,
  FiSave, FiChevronLeft, FiChevronRight, FiActivity, FiCheckCircle, FiAlertOctagon,
} from "react-icons/fi";
import { message } from "antd";
import {
  ListRemediationTickets,
  GetRemediationSummary,
  CreateRemediationTicket,
  UpdateRemediationTicket,
  DeleteRemediationTicket,
  type RemediationTicket,
  type RemediationStatus,
  type RemediationSummary,
} from "../../services/remediation";
import { ListUser, ListVulnerability, type UserResponse, type VulnerabilityLevelDTO } from "../../services";
import { useStateContext } from "../../contexts/ProviderContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useAuth } from "../../contexts/AuthContext";
import type { TranslationKey } from "../../locales";

const STATUSES: RemediationStatus[] = ["open", "in_progress", "fixed", "risk_accepted", "false_positive"];
const PAGE_SIZE = 5;

const STATUS_LABEL_KEY: Record<RemediationStatus, TranslationKey> = {
  open: "remediation.statusOpen",
  in_progress: "remediation.statusInProgress",
  fixed: "remediation.statusFixed",
  risk_accepted: "remediation.statusRiskAccepted",
  false_positive: "remediation.statusFalsePositive",
};

const statusBadgeClass = (status: RemediationStatus) => {
  switch (status) {
    case "open": return "border-red-200 bg-red-50 text-red-700 dark:border-red-400/25 dark:bg-red-500/12 dark:text-red-200";
    case "in_progress": return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/25 dark:bg-amber-500/12 dark:text-amber-200";
    case "fixed": return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-500/12 dark:text-emerald-200";
    case "risk_accepted": return "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/25 dark:bg-violet-500/12 dark:text-violet-200";
    case "false_positive": return "border-slate-200 bg-slate-50 text-slate-600 dark:border-white/8 dark:bg-white/5 dark:text-white/50";
    default: return "border-slate-200 bg-slate-50 text-slate-600";
  }
};

const severityColor = (s: number) =>
  s >= 9 ? "text-red-600 dark:text-red-400"
  : s >= 7 ? "text-orange-600 dark:text-orange-400"
  : s >= 4 ? "text-yellow-600 dark:text-yellow-400"
  : "text-emerald-600 dark:text-emerald-400";

// ─── Summary stat card — same visual language as ThreatIntelligence's KEV
// cards (page/ThreatIntelligence/index.tsx): tinted border/glow keyed off
// iconColor, icon chip top-right with an optional pulsing "needs attention"
// dot, big number, small caption underneath. ───────────────────────────────
const Pulse: React.FC = () => (
  <span className="inline-block h-5.5 w-12 animate-pulse rounded-lg bg-slate-100 dark:bg-white/10" />
);

type SummaryCardProps = {
  label: string;
  value: string | number;
  sub: string;
  icon: React.ReactNode;
  iconColor: string;
  loading?: boolean;
  pulse?: boolean;
};

const SummaryCard: React.FC<SummaryCardProps> = ({ label, value, sub, icon, iconColor, loading, pulse }) => (
  <div
    className="group relative overflow-hidden rounded-xl border bg-white px-3.5 py-3 shadow-sm transition-all duration-300 hover:-translate-y-0.5 dark:bg-[#0d0b1a]/80"
    style={{ borderColor: `${iconColor}55`, boxShadow: `0 6px 14px -12px ${iconColor}60` }}
  >
    <div
      className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-35 blur-2xl transition-opacity duration-300 group-hover:opacity-60"
      style={{ backgroundColor: `${iconColor}20` }}
      aria-hidden
    />
    <div
      className="pointer-events-none absolute inset-0 opacity-50 dark:opacity-25"
      style={{ background: `linear-gradient(160deg, ${iconColor}10, transparent 65%)` }}
      aria-hidden
    />
    <div className="relative flex items-center justify-between">
      <p className="text-[10.5px] font-bold tracking-wide text-slate-600 dark:text-white/55">{label}</p>
      <span
        className="relative flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-lg text-[12px] transition-transform duration-300 group-hover:scale-110"
        style={{ backgroundColor: `${iconColor}1c`, color: iconColor }}
      >
        {icon}
        {pulse && !loading && (
          <span className="absolute -right-1 -top-1 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-[#0d0b1a]" />
          </span>
        )}
      </span>
    </div>
    <p className="relative mt-1.5 text-[22px] font-bold leading-none tracking-tight text-slate-900 dark:text-white">
      {loading ? <Pulse /> : value}
    </p>
    <p className="relative mt-1 truncate text-[10px] text-slate-400 dark:text-white/35">{sub}</p>
  </div>
);

// Only fields an operator actually chooses: which known vulnerability to
// track, plus the ticket-management fields (status/owner/due date/notes).
// Host IP / Severity / Vulnerability Name / Task ID / NVT OID are never
// hand-typed — on create they come from the "prefill from known
// vulnerability" pick, on edit they're immutable identity of the ticket
// (still shown read-only for context, just not as editable inputs).
type TicketFormState = {
  host_ip: string;
  vuln_name: string;
  task_id: string;
  nvt_oid: string;
  severity: string;
  status: RemediationStatus;
  owner_user_id: string;
  due_date: string; // yyyy-mm-dd
  notes: string;
};

const EMPTY_FORM: TicketFormState = {
  host_ip: "", vuln_name: "", task_id: "", nvt_oid: "", severity: "0",
  status: "open", owner_user_id: "", due_date: "", notes: "",
};

const RemediationPage: React.FC = () => {
  const { currentColor } = useStateContext();
  const { t } = useLanguage();
  const { can } = useAuth();
  const canManage = can("remediation", "manage");
  const accentGrad = `linear-gradient(135deg, ${currentColor}, color-mix(in srgb, ${currentColor} 65%, #a855f7))`;

  const [tickets, setTickets] = useState<RemediationTicket[]>([]);
  const [summary, setSummary] = useState<RemediationSummary | null>(null);
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [vulnOptions, setVulnOptions] = useState<VulnerabilityLevelDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<RemediationStatus | "">("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RemediationTicket | null>(null);
  const [form, setForm] = useState<TicketFormState>(EMPTY_FORM);
  const [selectedVulnKey, setSelectedVulnKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RemediationTicket | null>(null);

  const isMounted = useRef(true);
  useEffect(() => { isMounted.current = true; return () => { isMounted.current = false; }; }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [list, sum] = await Promise.all([
        ListRemediationTickets(statusFilter ? { status: statusFilter } : undefined),
        GetRemediationSummary(),
      ]);
      if (!isMounted.current) return;
      setTickets(list ?? []);
      setSummary(sum);
    } catch {
      if (isMounted.current) message.error(t("remediation.loadFailed"));
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [statusFilter, t]);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!canManage) return;
    void ListUser().then((res) => { if (isMounted.current && res) setUsers(res); });
    void ListVulnerability().then((res) => { if (isMounted.current && res) setVulnOptions(res); });
  }, [canManage]);

  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return tickets;
    return tickets.filter(
      (tk) => tk.host_ip.toLowerCase().includes(q) || tk.vuln_name.toLowerCase().includes(q)
    );
  }, [tickets, q]);

  // Reset to page 1 whenever the visible result set changes underneath the
  // current page (new filter/search), so the user never lands on a blank page.
  useEffect(() => { setPage(1); }, [statusFilter, q]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  );

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setSelectedVulnKey("");
    setFormOpen(true);
  };

  const openEdit = (tk: RemediationTicket) => {
    setEditing(tk);
    setForm({
      host_ip: tk.host_ip,
      vuln_name: tk.vuln_name,
      task_id: tk.task_id,
      nvt_oid: tk.nvt_oid,
      severity: String(tk.severity),
      status: tk.status,
      owner_user_id: tk.owner_user_id ? String(tk.owner_user_id) : "",
      due_date: tk.due_date ? tk.due_date.slice(0, 10) : "",
      notes: tk.notes,
    });
    setSelectedVulnKey("");
    setFormOpen(true);
  };

  const applyPrefill = (vulnKey: string) => {
    setSelectedVulnKey(vulnKey);
    const v = vulnOptions.find((x) => `${x.task_id}|${x.host_ip}|${x.vulnerability_id}` === vulnKey);
    if (!v) return;
    setForm((prev) => ({
      ...prev,
      host_ip: v.host_ip,
      vuln_name: v.vulnerability_name,
      task_id: v.task_id,
      nvt_oid: v.vulnerability_id,
      severity: String(v.severity),
    }));
  };

  const canSubmitCreate = !!form.host_ip.trim() && !!form.vuln_name.trim();

  const handleSave = async () => {
    if (!editing && !canSubmitCreate) {
      message.error(t("remediation.pickVulnRequired"));
      return;
    }
    setSaving(true);
    try {
      const dueISO = form.due_date ? new Date(form.due_date + "T00:00:00Z").toISOString() : null;
      if (editing) {
        const result = await UpdateRemediationTicket(editing.id, {
          status: form.status,
          owner_user_id: form.owner_user_id ? Number(form.owner_user_id) : null,
          due_date: dueISO,
          notes: form.notes,
        });
        if (!result) throw new Error("update failed");
        message.success(t("remediation.updateSuccess"));
      } else {
        const result = await CreateRemediationTicket({
          host_ip: form.host_ip.trim(),
          vuln_name: form.vuln_name.trim(),
          task_id: form.task_id.trim(),
          nvt_oid: form.nvt_oid.trim(),
          severity: Number(form.severity) || 0,
          status: form.status,
          owner_user_id: form.owner_user_id ? Number(form.owner_user_id) : null,
          due_date: dueISO,
          notes: form.notes,
        });
        if (!result) throw new Error("create failed");
        message.success(t("remediation.createSuccess"));
      }
      setFormOpen(false);
      void fetchAll();
    } catch {
      message.error(t(editing ? "remediation.updateFailed" : "remediation.createFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    try {
      const result = await DeleteRemediationTicket(target.id);
      if (!result) throw new Error("delete failed");
      message.success(t("remediation.deleteSuccess"));
      void fetchAll();
    } catch {
      message.error(t("remediation.deleteFailed"));
    }
  };

  const openCount = summary?.by_status?.open ?? 0;
  const overdueCount = summary?.overdue_count ?? 0;

  return (
    <div className="w-full space-y-5">
      {/* Header */}
      <div className="relative overflow-hidden rounded-[18px] bg-white/95 p-4 shadow-sm backdrop-blur sm:rounded-[22px] sm:p-6 dark:bg-[#0d0b1a]/90"
        style={{ border: `1px solid ${currentColor}30` }}>
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg sm:h-13 sm:w-13"
              style={{ background: accentGrad, boxShadow: `0 8px 24px -6px ${currentColor}50` }}>
              <FiClipboard className="text-[20px] sm:text-[22px]" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] sm:text-[10.5px]" style={{ color: currentColor }}>
                {t("remediation.kicker")}
              </p>
              <h1 className="truncate text-[18px] font-bold text-slate-900 sm:text-[20px] dark:text-white/90">
                {t("remediation.title")}
              </h1>
              <p className="mt-0.5 text-[11px] text-slate-500 sm:text-[12px] dark:text-white/45">
                {t("remediation.subtitle")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void fetchAll()} disabled={loading}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/70 bg-white text-slate-500 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/8 dark:bg-white/5 dark:text-white/50">
              <FiRefreshCw className={`text-[13px] ${loading ? "animate-spin" : ""}`} />
            </button>
            {canManage && (
              <button type="button" onClick={openCreate}
                className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[12px] font-semibold text-white transition hover:opacity-90"
                style={{ background: accentGrad }}>
                <FiPlus className="text-[12px]" />
                {t("remediation.newTicket")}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <SummaryCard
          label={t("remediation.statAll")}
          value={summary?.total ?? 0}
          sub={t("remediation.subAll")}
          icon={<FiClipboard />}
          iconColor="#06b6d4"
          loading={loading}
        />
        <SummaryCard
          label={t("remediation.statOpen")}
          value={openCount}
          sub={t("remediation.subOpen")}
          icon={<FiAlertTriangle />}
          iconColor="#ef4444"
          loading={loading}
          pulse={openCount > 0}
        />
        <SummaryCard
          label={t("remediation.statInProgress")}
          value={summary?.by_status?.in_progress ?? 0}
          sub={t("remediation.subInProgress")}
          icon={<FiActivity />}
          iconColor="#f59e0b"
          loading={loading}
        />
        <SummaryCard
          label={t("remediation.statFixed")}
          value={summary?.by_status?.fixed ?? 0}
          sub={t("remediation.subFixed")}
          icon={<FiCheckCircle />}
          iconColor="#10b981"
          loading={loading}
        />
        <SummaryCard
          label={t("remediation.statOverdue")}
          value={overdueCount}
          sub={t("remediation.subOverdue")}
          icon={<FiAlertOctagon />}
          iconColor="#dc2626"
          loading={loading}
          pulse={overdueCount > 0}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as RemediationStatus | "")}
          className="rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-[12px] text-slate-700 outline-none dark:border-white/8 dark:bg-white/5 dark:text-white/80"
        >
          <option value="">{t("remediation.filterAllStatus")}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{t(STATUS_LABEL_KEY[s])}</option>
          ))}
        </select>
        <div className="relative ml-auto min-w-50">
          <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400 dark:text-white/30" />
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={t("remediation.searchPlaceholder")}
            className="w-full rounded-lg border border-slate-200/80 bg-white py-2 pl-8 pr-3 text-[12px] text-slate-700 placeholder-slate-400 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100 dark:border-white/8 dark:bg-white/5 dark:text-white/85 dark:placeholder-white/25"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white dark:border-white/8 dark:bg-[#0d0b1a]/60">
        {loading ? (
          <div className="space-y-3 p-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-50 dark:bg-white/4" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <FiClipboard className="text-[24px] text-slate-300 dark:text-white/20" />
            <p className="text-[13px] text-slate-500 dark:text-white/40">{t("remediation.noResults")}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-260">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-white/8">
                    {[
                      t("remediation.colHost"), t("remediation.colVulnerability"), t("remediation.colTaskId"),
                      t("remediation.colNvtOid"), t("remediation.colSeverity"), t("remediation.colStatus"),
                      t("remediation.colOwner"), t("remediation.colDueDate"), t("remediation.colNotes"), "",
                    ].map((h, i) => (
                      <th key={`${h}-${i}`} className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/60 dark:divide-white/5">
                  {pageItems.map((tk) => (
                    <tr key={tk.id} className="hover:bg-slate-50/50 dark:hover:bg-white/2">
                      <td className="px-5 py-3 font-mono text-[12px] text-slate-700 dark:text-white/70">{tk.host_ip}</td>
                      <td className="px-5 py-3 text-[12.5px] font-semibold text-slate-800 dark:text-white/85">{tk.vuln_name}</td>
                      <td className="px-5 py-3 font-mono text-[11px] text-slate-400 dark:text-white/35">{tk.task_id || "—"}</td>
                      <td className="max-w-40 truncate px-5 py-3 font-mono text-[11px] text-slate-400 dark:text-white/35">{tk.nvt_oid || "—"}</td>
                      <td className={`px-5 py-3 text-[12px] font-bold ${severityColor(tk.severity)}`}>{tk.severity.toFixed(1)}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-block rounded-full border px-2 py-0.5 text-[9.5px] font-bold ${statusBadgeClass(tk.status)}`}>
                          {t(STATUS_LABEL_KEY[tk.status])}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-[12px] text-slate-500 dark:text-white/45">
                        {tk.owner ? `${tk.owner.first_name} ${tk.owner.last_name}` : <span className="italic text-slate-300 dark:text-white/20">{t("remediation.unassigned")}</span>}
                      </td>
                      <td className="px-5 py-3 text-[11.5px] text-slate-400 dark:text-white/35">
                        {tk.due_date ? new Date(tk.due_date).toLocaleDateString() : t("remediation.noDueDate")}
                      </td>
                      <td className="max-w-50 truncate px-5 py-3 text-[11.5px] text-slate-400 dark:text-white/35">{tk.notes || "—"}</td>
                      <td className="px-5 py-3">
                        {canManage ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button type="button" onClick={() => openEdit(tk)} title={t("remediation.edit")}
                              className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 transition hover:bg-slate-100 dark:border-white/8 dark:bg-white/5 dark:text-white/60">
                              <FiEdit2 className="text-[11px]" />
                            </button>
                            <button type="button" onClick={() => setDeleteTarget(tk)} title={t("remediation.delete")}
                              className="grid h-7 w-7 place-items-center rounded-lg border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                              <FiTrash2 className="text-[11px]" />
                            </button>
                          </div>
                        ) : <span className="text-[11px] text-slate-300 dark:text-white/15">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 dark:border-white/8">
                <p className="text-[11.5px] text-slate-400 dark:text-white/35">
                  {t("remediation.pageOfTotal", { page, totalPages })}
                </p>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                    className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200/70 text-slate-500 disabled:opacity-40 dark:border-white/8 dark:text-white/50">
                    <FiChevronLeft className="text-[12px]" />
                  </button>
                  <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                    className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200/70 text-slate-500 disabled:opacity-40 dark:border-white/8 dark:text-white/50">
                    <FiChevronRight className="text-[12px]" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create/Edit modal — styled to match ModalCreateandUpdateRole's chrome */}
      {formOpen && canManage && createPortal(
        <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
          <button type="button" onClick={saving ? undefined : () => setFormOpen(false)}
            className="absolute inset-0 bg-black/55" aria-label={t("remediation.cancel")} />

          <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-xl dark:border-white/10 dark:bg-[#0d0b1a]">
            <button type="button" onClick={() => setFormOpen(false)} disabled={saving}
              className="absolute right-3 top-3 z-20 inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed dark:text-white/45 dark:hover:bg-white/10 dark:hover:text-white/70"
              aria-label={t("remediation.cancel")}>
              <FiX className="text-[13px]" />
            </button>

            <div className="px-4 pb-3 pt-4">
              <div className="flex items-center gap-3 pr-8">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white" style={{ background: accentGrad }}>
                  <FiClipboard className="text-[15px]" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-[13px] font-semibold text-slate-900 dark:text-white">
                    {t(editing ? "remediation.editTitle" : "remediation.createTitle")}
                  </h3>
                  {editing && (
                    <p className="truncate text-[11px] text-slate-400 dark:text-white/35">
                      {editing.host_ip} · {editing.vuln_name}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="max-h-[70vh] space-y-3.5 overflow-y-auto px-4 pb-2">
              {!editing && (
                <div>
                  <label className="mb-1 block text-[10.5px] font-semibold text-slate-500 dark:text-white/45">
                    {t("remediation.prefillFromVuln")}
                  </label>
                  {vulnOptions.length > 0 ? (
                    <select value={selectedVulnKey} onChange={(e) => applyPrefill(e.target.value)}
                      className="h-9 w-full rounded-lg border border-slate-200/70 bg-white px-3 text-[12px] text-slate-700 outline-none transition focus:ring-2 focus:ring-blue-200 dark:border-white/8 dark:bg-white/5 dark:text-white/80 dark:focus:ring-white/10">
                      <option value="">{t("remediation.prefillPlaceholder")}</option>
                      {vulnOptions.map((v) => (
                        <option key={`${v.task_id}|${v.host_ip}|${v.vulnerability_id}`} value={`${v.task_id}|${v.host_ip}|${v.vulnerability_id}`}>
                          {v.host_ip} — {v.vulnerability_name} ({v.level})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[10.5px] text-amber-800 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200">
                      <FiAlertTriangle className="mt-px shrink-0 text-[11px]" />
                      <span>{t("remediation.noVulnAvailable")}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[10.5px] font-semibold text-slate-500 dark:text-white/45">{t("remediation.fieldStatus")}</label>
                  <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as RemediationStatus }))}
                    className="h-9 w-full rounded-lg border border-slate-200/70 bg-white px-3 text-[12px] text-slate-700 outline-none transition focus:ring-2 focus:ring-blue-200 dark:border-white/8 dark:bg-white/5 dark:text-white/80 dark:focus:ring-white/10">
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{t(STATUS_LABEL_KEY[s])}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10.5px] font-semibold text-slate-500 dark:text-white/45">{t("remediation.fieldOwner")}</label>
                  <select value={form.owner_user_id} onChange={(e) => setForm((p) => ({ ...p, owner_user_id: e.target.value }))}
                    className="h-9 w-full rounded-lg border border-slate-200/70 bg-white px-3 text-[12px] text-slate-700 outline-none transition focus:ring-2 focus:ring-blue-200 dark:border-white/8 dark:bg-white/5 dark:text-white/80 dark:focus:ring-white/10">
                    <option value="">{t("remediation.unassigned")}</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[10.5px] font-semibold text-slate-500 dark:text-white/45">{t("remediation.fieldDueDate")}</label>
                <input type="date" value={form.due_date} onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))}
                  className="h-9 w-full rounded-lg border border-slate-200/70 bg-white px-3 text-[12px] text-slate-700 outline-none transition focus:ring-2 focus:ring-blue-200 dark:border-white/8 dark:bg-white/5 dark:text-white/80 dark:focus:ring-white/10" />
              </div>

              <div className="pb-2">
                <label className="mb-1 block text-[10.5px] font-semibold text-slate-500 dark:text-white/45">{t("remediation.fieldNotes")}</label>
                <textarea rows={3} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200/70 bg-white px-3 py-2 text-[12px] text-slate-700 outline-none transition focus:ring-2 focus:ring-blue-200 dark:border-white/8 dark:bg-white/5 dark:text-white/80 dark:focus:ring-white/10" />
              </div>

              {!editing && !canSubmitCreate && (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[10.5px] text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300">
                  <FiAlertTriangle className="mt-px shrink-0 text-[11px]" />
                  <span>{t("remediation.pickVulnRequired")}</span>
                </div>
              )}
            </div>

            <div className="mt-2 flex items-center justify-end gap-2 border-t border-slate-100 px-4 py-3 dark:border-white/8">
              <button type="button" onClick={() => setFormOpen(false)} disabled={saving}
                className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200/70 bg-white px-3 text-[10.5px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/8 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/8">
                {t("remediation.cancel")}
              </button>
              <button type="button" onClick={() => void handleSave()} disabled={saving || (!editing && !canSubmitCreate)}
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-3.5 text-[10.5px] font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                style={{ background: accentGrad }}>
                <FiSave className="text-[12px]" />
                {saving ? t("remediation.saving") : t("remediation.save")}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete confirm */}
      {deleteTarget && createPortal(
        <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[3px]" onClick={() => setDeleteTarget(null)} />
          <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl bg-white dark:bg-[#12101f]">
            <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-3.5 dark:border-white/8">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-500 text-white">
                <FiAlertTriangle className="text-[13px]" />
              </span>
              <h3 className="text-[14px] font-bold text-slate-800 dark:text-white/90">{t("remediation.deleteConfirmTitle")}</h3>
            </div>
            <div className="px-5 py-4">
              <p className="text-[12.5px] leading-6 text-slate-500 dark:text-white/45">{t("remediation.deleteConfirmDesc")}</p>
            </div>
            <div className="flex gap-2.5 border-t border-slate-100 px-5 py-3.5 dark:border-white/8">
              <button type="button" onClick={() => setDeleteTarget(null)}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-[12.5px] font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/8 dark:text-white/55 dark:hover:bg-white/5">
                {t("remediation.cancel")}
              </button>
              <button type="button" onClick={() => void handleDelete()}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-red-500 py-2.5 text-[12.5px] font-semibold text-white transition hover:opacity-90">
                <FiTrash2 className="text-[12px]" />
                {t("remediation.delete")}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default RemediationPage;
