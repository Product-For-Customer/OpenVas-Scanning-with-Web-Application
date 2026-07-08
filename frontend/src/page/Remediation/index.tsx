import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Drawer, Button, message, Tooltip, Spin } from "antd";
import {
  FiTool, FiRefreshCw, FiShield, FiClock, FiCheckCircle, FiAlertTriangle,
  FiActivity, FiCopy, FiZap, FiChevronLeft, FiChevronRight, FiChevronDown,
  FiSearch, FiInbox, FiTerminal, FiAlertCircle, FiArrowRight,
} from "react-icons/fi";
import {
  GetRemediations, GetRemediationSummary, GetRemediation,
  UpdateRemediation, TriggerRemediationSync,
  GetRemediationPlan,
  type Remediation, type RemediationSummary, type RemediationStatus, type RemediationPlan,
} from "../../services";
import { useLanguage } from "../../contexts/LanguageContext";
import { useStateContext } from "../../contexts/ProviderContext";
import type { TranslationKey } from "../../locales";

// ── constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 8;

const RISK_STYLE: Record<string, string> = {
  CRITICAL: "border-red-300 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300",
  HIGH:     "border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300",
  MEDIUM:   "border-yellow-300 bg-yellow-50 text-yellow-700 dark:border-yellow-500/30 dark:bg-yellow-500/10 dark:text-yellow-300",
  LOW:      "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
};

const STATUS_STYLE: Record<string, string> = {
  open:                 "border-slate-300 bg-slate-50 text-slate-700 dark:border-white/15 dark:bg-white/5 dark:text-white/70",
  in_progress:          "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300",
  fixed_pending_verify: "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300",
  verified_closed:      "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
  risk_accepted:        "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
  false_positive:       "border-slate-300 bg-slate-100 text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-white/45",
  reopened:             "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300",
};

const METHOD_STYLE: Record<string, string> = {
  patch:           "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  config:          "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  network_control: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300",
  credential:      "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  certificate:     "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  compensating:    "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-white/60",
};

// Trimmed lifecycle actions — the essentials only (verified_closed/reopened are
// earned by re-scan; risk_accepted was dropped to reduce clutter).
const MANUAL_STATUSES: RemediationStatus[] = [
  "open", "in_progress", "fixed_pending_verify", "false_positive",
];
const FILTER_STATUSES: string[] = [
  "open", "in_progress", "fixed_pending_verify", "reopened", "verified_closed", "false_positive",
];

const statusKey = (s: string): TranslationKey => `remediation.status.${s}` as TranslationKey;
const isActiveStatus = (s: string) => ["open", "in_progress", "fixed_pending_verify", "reopened"].includes(s);

const daysBetween = (from: string, to: Date = new Date()) => {
  const d = new Date(from).getTime();
  if (!Number.isFinite(d)) return 0;
  return Math.max(0, Math.floor((to.getTime() - d) / 86400000));
};
const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString("en-GB") : "—");
const fmtDuration = (hours: number | null) => {
  if (hours == null) return "—";
  if (hours < 48) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
};

// ── stat tile ─────────────────────────────────────────────────────────────────

const StatTile: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode; accent: string }> = ({ icon, label, value, accent }) => (
  <div className="flex items-center gap-3 rounded-xl border border-slate-200/70 bg-white px-4 py-3 dark:border-white/8 dark:bg-white/4">
    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[16px]" style={{ background: `${accent}18`, color: accent }}>{icon}</span>
    <div className="min-w-0">
      <div className="text-[18px] font-extrabold leading-none text-slate-900 dark:text-white/90">{value}</div>
      <div className="mt-1 truncate text-[10.5px] font-semibold uppercase tracking-wide text-slate-500 dark:text-white/45">{label}</div>
    </div>
  </div>
);

// ── styled filter dropdown (matches threat-config toolbar look) ───────────────

const FilterSelect: React.FC<{
  value?: string;
  onChange: (v?: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
}> = ({ value, onChange, placeholder, options }) => (
  <div className="relative shrink-0">
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || undefined)}
      className={`h-8 cursor-pointer appearance-none rounded-lg border bg-white py-1 pl-3 pr-7 text-[12px] outline-none transition focus:border-blue-300 dark:bg-white/5 dark:focus:border-blue-400/40 ${
        value
          ? "border-blue-300 text-slate-700 dark:border-blue-400/40 dark:text-white/85"
          : "border-slate-200/80 text-slate-500 dark:border-white/8 dark:text-white/45"
      }`}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
    <FiChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 dark:text-white/30" />
  </div>
);

// ── section label (matches the Appearance drawer look) ───────────────────────

const SectionLabel: React.FC<{ children: React.ReactNode; right?: React.ReactNode }> = ({ children, right }) => (
  <div className="mb-2.5 flex items-center gap-2">
    <p className="flex shrink-0 items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 dark:text-white/30">{children}</p>
    <div className="h-px flex-1 bg-slate-100 dark:bg-white/8" />
    {right}
  </div>
);

// ── main ───────────────────────────────────────────────────────────────────────

const RemediationPage: React.FC = () => {
  const { t } = useLanguage();
  const { currentColor } = useStateContext();
  const accentGrad = `linear-gradient(135deg, ${currentColor}, color-mix(in srgb, ${currentColor} 65%, #a855f7))`;

  const [summary, setSummary] = useState<RemediationSummary | null>(null);
  const [rows, setRows] = useState<Remediation[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [page, setPage] = useState(1);

  // filters
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [riskFilter, setRiskFilter] = useState<string | undefined>();
  const [search, setSearch] = useState("");

  // drawer
  const [openId, setOpenId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Remediation | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [plan, setPlan] = useState<RemediationPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [s, list] = await Promise.all([
      GetRemediationSummary(),
      GetRemediations({
        status: statusFilter,
        risk_level: riskFilter,
        q: search.trim() || undefined,
      }),
    ]);
    if (s) setSummary(s);
    setRows(list ?? []);
    setLoading(false);
  }, [statusFilter, riskFilter, search]);

  useEffect(() => { void fetchAll(); }, [fetchAll]);
  useEffect(() => { setPage(1); }, [rows]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = useMemo(() => rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [rows, page]);
  const pageNumbers = useMemo(() => {
    const nums: number[] = [];
    const start = Math.max(1, Math.min(page - 2, pageCount - 4));
    const end = Math.min(pageCount, start + 4);
    for (let i = start; i <= end; i++) nums.push(i);
    return nums;
  }, [page, pageCount]);

  const handleSync = async () => {
    setSyncing(true);
    const changed = await TriggerRemediationSync();
    setSyncing(false);
    if (changed == null) { message.error(t("remediation.actionFailed")); return; }
    message.success(t("remediation.syncDone", { n: changed }));
    void fetchAll();
  };

  const openDrawer = async (id: number) => {
    setOpenId(id);
    setDetailLoading(true);
    setDetail(null);
    setPlan(null);
    setPlanLoading(true);
    const [d, p] = await Promise.all([GetRemediation(id), GetRemediationPlan(id)]);
    setDetail(d);
    setPlan(p);
    setDetailLoading(false);
    setPlanLoading(false);
  };
  const closeDrawer = () => { setOpenId(null); setDetail(null); setPlan(null); };

  const refreshDetail = async (id: number) => { setDetail(await GetRemediation(id)); void fetchAll(); };

  const doUpdate = async (body: Parameters<typeof UpdateRemediation>[1]) => {
    if (!detail) return;
    setActing(true);
    const res = await UpdateRemediation(detail.id, body);
    setActing(false);
    if (!res) { message.error(t("remediation.actionFailed")); return; }
    message.success(t("remediation.updated"));
    void refreshDetail(detail.id);
  };


  const copyText = async (text: string) => {
    if (!text) return;
    try { await navigator.clipboard.writeText(text); message.success(t("remediation.detail.copied")); }
    catch { /* clipboard blocked */ }
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="relative mb-4 overflow-hidden rounded-[18px] bg-white/95 p-4 shadow-sm backdrop-blur sm:mb-5 sm:rounded-[22px] sm:p-6 dark:bg-[#0d0b1a]/90"
        style={{ border: `1px solid ${currentColor}30` }}>
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-12 right-10 h-40 w-40 rounded-full blur-3xl" style={{ backgroundColor: `${currentColor}1e` }} />
          <div className="absolute -bottom-12 left-10 h-40 w-40 rounded-full blur-3xl" style={{ backgroundColor: `${currentColor}14` }} />
        </div>
        <div className="relative z-10 flex items-center gap-3 sm:gap-4">
          <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg sm:h-13 sm:w-13"
            style={{ background: accentGrad, boxShadow: `0 8px 24px -6px ${currentColor}50` }}>
            <FiTool className="text-[20px] sm:text-[22px]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] sm:text-[10.5px]" style={{ color: currentColor }}>{t("remediation.kicker")}</p>
            <h1 className="truncate text-[18px] font-bold text-slate-900 sm:text-[20px] dark:text-white/90">{t("remediation.title")}</h1>
            <p className="mt-0.5 text-[11px] text-slate-500 sm:text-[12px] dark:text-white/45">{t("remediation.subtitle")}</p>
          </div>
          <Button icon={<FiRefreshCw className={syncing ? "animate-spin" : ""} />} onClick={handleSync} loading={syncing} type="primary" className="shrink-0">
            {syncing ? t("remediation.syncing") : t("remediation.sync")}
          </Button>
        </div>
      </div>

      {/* KPIs */}
      {summary && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile icon={<FiActivity />} label={t("remediation.kpi.active")} value={summary.active_total} accent="#3b82f6" />
          <StatTile icon={<FiAlertTriangle />} label={t("remediation.kpi.overdue")} value={summary.overdue} accent="#ef4444" />
          <StatTile icon={<FiShield />} label={t("remediation.kpi.criticalOpen")} value={summary.critical_open} accent="#f97316" />
          <StatTile icon={<FiClock />} label={t("remediation.kpi.pendingVerify")} value={summary.fixed_pending_verify} accent="#a855f7" />
          <StatTile icon={<FiCheckCircle />} label={t("remediation.kpi.verifiedClosed")} value={summary.verified_closed} accent="#10b981" />
          <StatTile icon={<FiClock />} label={t("remediation.kpi.avgMttr")} value={fmtDuration(summary.avg_mttr_hours || null)} accent="#06b6d4" />
        </div>
      )}

      {/* Table card (styled like threat-config · Targets) */}
      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-white/8 dark:bg-[#0d0b1a]/60">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-3.5 dark:border-white/8">
          <div className="flex shrink-0 items-center gap-2.5">
            <FiTool className="text-[14px]" style={{ color: currentColor }} />
            <p className="text-[13px] font-bold text-slate-800 dark:text-white/90">
              {t("remediation.title")}
              <span className="ml-2 text-[11px] font-normal text-slate-400 dark:text-white/30">({rows.length})</span>
            </p>
          </div>

          {/* Search */}
          <div className="relative min-w-40 flex-1 sm:max-w-64">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400 dark:text-white/30" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("remediation.search")}
              className="w-full rounded-lg border border-slate-200/80 bg-white py-1.5 pl-8 pr-3 text-[12px] text-slate-700 placeholder-slate-400 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100 dark:border-white/8 dark:bg-white/5 dark:text-white/85 dark:placeholder-white/25" />
          </div>

          {/* Filters + refresh */}
          <div className="ml-auto flex items-center gap-2">
            <FilterSelect value={riskFilter} onChange={setRiskFilter} placeholder={t("remediation.filter.risk")}
              options={["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((r) => ({ value: r, label: r }))} />
            <FilterSelect value={statusFilter} onChange={setStatusFilter} placeholder={t("remediation.filter.status")}
              options={FILTER_STATUSES.map((s) => ({ value: s, label: t(statusKey(s)) }))} />
            <button type="button" onClick={() => void fetchAll()} disabled={loading} title="Refresh"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-200/70 bg-white text-slate-500 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/8 dark:bg-white/5 dark:text-white/50">
              <FiRefreshCw className={`text-[12px] ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400 dark:text-white/35">
            <Spin /><span className="text-[12px]">{t("remediation.loading")}</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400 dark:text-white/35">
            <FiInbox className="text-[28px]" />
            <span className="max-w-md text-center text-[12px]">{t("remediation.empty")}</span>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-225 border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-white/8">
                    {[
                      t("remediation.col.finding"), t("remediation.col.risk"), t("remediation.col.host"),
                      t("remediation.col.status"), t("remediation.col.due"), t("remediation.col.age"),
                    ].map((h, i) => (
                      <th key={i} className="px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/35">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r) => {
                    const overdue = isActiveStatus(r.status) && r.due_date && new Date(r.due_date) < new Date();
                    return (
                      <tr key={r.id} onClick={() => void openDrawer(r.id)}
                        className="group cursor-pointer border-b border-slate-100/70 transition hover:bg-slate-50 last:border-0 dark:border-white/5 dark:hover:bg-white/4">
                        {/* Finding */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-[12.5px] font-semibold text-slate-800 dark:text-white/85">{r.vuln_name}</span>
                            {r.is_kev && (
                              <Tooltip title="CISA Known Exploited Vulnerability">
                                <span className="inline-flex items-center gap-0.5 rounded border border-red-300 bg-red-50 px-1.5 py-0.5 text-[9px] font-bold text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                                  <FiZap className="text-[9px]" /> {t("remediation.kev")}
                                </span>
                              </Tooltip>
                            )}
                          </div>
                          <div className="mt-0.5 truncate text-[10.5px] text-slate-400 dark:text-white/40">
                            {r.family || "—"}{r.cve_list ? ` · ${r.cve_list.split(",")[0]}${r.cve_list.includes(",") ? " +" : ""}` : ""}
                          </div>
                        </td>
                        {/* Risk — Level - CVSS score */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold ${RISK_STYLE[r.risk_level] || RISK_STYLE.LOW}`}>{r.risk_level}</span>
                            <span className="text-[12px] font-bold text-slate-600 dark:text-white/65">- {r.severity.toFixed(1)}</span>
                          </div>
                        </td>
                        {/* Host */}
                        <td className="px-4 py-3">
                          <div className="truncate font-mono text-[12px] text-slate-700 dark:text-white/75">{r.host_ip}{r.port ? `:${r.port}` : ""}</div>
                          <div className="truncate text-[10px] text-slate-400 dark:text-white/35">{r.task_name || "—"}</div>
                        </td>
                        {/* Status */}
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLE[r.status]}`}>{t(statusKey(r.status))}</span>
                        </td>
                        {/* Due */}
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className={`text-[11px] ${overdue ? "font-bold text-red-600 dark:text-red-400" : "text-slate-600 dark:text-white/60"}`}>{fmtDate(r.due_date)}</span>
                            {overdue && <span className="text-[9px] font-bold uppercase text-red-500">{t("remediation.overdueTag")}</span>}
                          </div>
                        </td>
                        {/* Age */}
                        <td className="px-4 py-3">
                          <span className="text-[11px] text-slate-500 dark:text-white/45">{daysBetween(r.first_detected_at)}{t("remediation.daysShort")}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 dark:border-white/8">
              <span className="text-[11.5px] text-slate-400 dark:text-white/40">{t("remediation.pageOf", { page, total: pageCount })}</span>
              <div className="flex items-center gap-1">
                <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:text-white/50 dark:hover:bg-white/5">
                  <FiChevronLeft className="text-[13px]" />
                </button>
                {pageNumbers.map((n) => (
                  <button key={n} type="button" onClick={() => setPage(n)}
                    style={n === page ? { background: accentGrad, color: "#fff", borderColor: "transparent" } : {}}
                    className={`flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-[12px] font-semibold transition ${n === page ? "" : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-white/60 dark:hover:bg-white/5"}`}>
                    {n}
                  </button>
                ))}
                <button type="button" disabled={page >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:text-white/50 dark:hover:bg-white/5">
                  <FiChevronRight className="text-[13px]" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Detail Drawer — styled after the Appearance panel: compact, icon header, sectioned */}
      <Drawer
        open={openId != null}
        onClose={closeDrawer}
        width={380}
        destroyOnClose
        styles={{ body: { padding: 0 } }}
        closeIcon={<FiArrowRight className="text-[16px]" />}
        title={
          <div className="flex w-full items-center justify-end gap-3">
            <div className="min-w-0 text-right">
              <p className="text-[13px] font-semibold leading-tight text-slate-800 dark:text-white">{t("remediation.title")}</p>
              <p className="mt-0.5 text-[11px] leading-none text-slate-400 dark:text-white/35">{t("remediation.kicker")}</p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: `${currentColor}1f` }}>
              <FiTool className="text-[16px]" style={{ color: currentColor }} />
            </div>
          </div>
        }
      >
        {detailLoading || !detail ? (
          <div className="flex justify-center py-16"><Spin /></div>
        ) : (
          <div className="flex flex-col gap-5 px-5 py-5">
            {/* Finding name + family (moved out of the header) */}
            <div>
              <p className="text-[14px] font-bold leading-snug text-slate-800 dark:text-white/90">{detail.vuln_name}</p>
              {detail.family && <p className="mt-0.5 text-[11px] text-slate-400 dark:text-white/40">{detail.family}</p>}
            </div>

            {/* Status — dropdown selector (single neutral colour; table keeps per-status colours) */}
            <section>
              <SectionLabel>{t("remediation.detail.markStatus")}</SectionLabel>
              <div className="relative">
                <select
                  value={detail.status}
                  disabled={acting}
                  onChange={(e) => { const v = e.target.value; if (v !== detail.status) void doUpdate({ status: v as RemediationStatus }); }}
                  className="w-full cursor-pointer appearance-none rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-[12.5px] font-semibold text-slate-700 outline-none transition focus:border-blue-300 disabled:opacity-60 dark:border-white/8 dark:bg-white/5 dark:text-white/85 dark:focus:border-blue-400/40"
                >
                  {!MANUAL_STATUSES.includes(detail.status) && (
                    <option value={detail.status}>{t(statusKey(detail.status))}</option>
                  )}
                  {MANUAL_STATUSES.map((s) => (
                    <option key={s} value={s}>{t(statusKey(s))}</option>
                  ))}
                </select>
                <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400 dark:text-white/30" />
              </div>
            </section>

            {/* Remediation plan (impact + how-to-fix + references) */}
            <div>
              <SectionLabel
                right={plan?.kind === "command" && plan.command
                  ? <Button size="small" icon={<FiCopy />} onClick={() => copyText(plan!.command)}>{t("remediation.fix.copy")}</Button>
                  : undefined}
              >
                {t("remediation.fix.title")}
                {plan && (
                  <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${METHOD_STYLE[plan.method] || METHOD_STYLE.compensating}`}>{plan.method.replace("_", " ")}</span>
                )}
              </SectionLabel>

              {planLoading ? (
                <div className="flex items-center gap-2 py-4 text-[11px] text-slate-400 dark:text-white/40"><Spin size="small" /> {t("remediation.fix.generating")}</div>
              ) : plan ? (
                <div className="flex flex-col gap-3">
                  {/* Why it matters */}
                  {plan.impact && (
                    <div className="rounded-xl border border-amber-200/70 bg-amber-50/60 p-2.5 dark:border-amber-500/20 dark:bg-amber-500/8">
                      <div className="mb-0.5 flex items-center gap-1.5 text-[10px] font-bold uppercase text-amber-700 dark:text-amber-300"><FiAlertCircle className="text-[11px]" /> {t("remediation.fix.impact")}</div>
                      <p className="line-clamp-3 text-[11.5px] leading-relaxed text-slate-600 dark:text-white/65">{plan.impact}</p>
                    </div>
                  )}

                  {/* Affected → Fixed version */}
                  {(plan.affected || plan.fixed_version) && (
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      {plan.affected && (
                        <span className="max-w-full truncate rounded-md bg-slate-100 px-2 py-1 text-slate-600 dark:bg-white/8 dark:text-white/60">
                          <b className="text-[9px] uppercase tracking-wide text-slate-400 dark:text-white/35">{t("remediation.fix.affected")}: </b>{plan.affected}
                        </span>
                      )}
                      {plan.fixed_version && (
                        <span className="rounded-md bg-emerald-100 px-2 py-1 font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                          <FiCheckCircle className="mb-0.5 mr-1 inline text-[11px]" />{t("remediation.fix.fixedVersion")} {plan.fixed_version}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Steps */}
                  {plan.steps.length > 0 && (
                    <ol className="ml-4 list-decimal space-y-0.5 text-[11.5px] text-slate-600 dark:text-white/65">
                      {plan.steps.map((s, i) => <li key={i}>{s}</li>)}
                    </ol>
                  )}

                  {/* Real command (playbook) vs honest guidance (scanner advice) */}
                  {plan.kind === "command" ? (
                    <div>
                      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-400 dark:text-white/35"><FiTerminal className="text-[11px]" /> {plan.language}</div>
                      <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap wrap-break-word rounded-xl border border-slate-200/70 bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100 dark:border-white/10">{plan.command}</pre>
                    </div>
                  ) : (
                    plan.guidance && (
                      <div className="rounded-xl border border-slate-200/70 bg-white p-3 text-[12px] leading-relaxed text-slate-700 dark:border-white/8 dark:bg-white/4 dark:text-white/75">{plan.guidance}</div>
                    )
                  )}

                  {/* Compensating controls — "reduce blast radius if you can't patch now" */}
                  {plan.compensating.length > 0 && (
                    <div className="rounded-xl border border-cyan-200/70 bg-cyan-50/50 p-2.5 dark:border-cyan-500/20 dark:bg-cyan-500/8">
                      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase text-cyan-700 dark:text-cyan-300"><FiShield className="text-[11px]" /> {t("remediation.fix.compensating")}</div>
                      <ul className="ml-4 list-disc space-y-0.5 text-[11px] leading-relaxed text-slate-600 dark:text-white/65">
                        {plan.compensating.map((c, i) => <li key={i}>{c}</li>)}
                      </ul>
                    </div>
                  )}

                  <span className="text-[9.5px] text-slate-400 dark:text-white/30">
                    {plan.source.startsWith("playbook") ? t("remediation.fix.playbook") : t("remediation.fix.fromScanner")}
                  </span>
                </div>
              ) : (
                <div className="py-3 text-[11px] text-slate-400 dark:text-white/35">{t("remediation.fix.noScript")}</div>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default RemediationPage;
