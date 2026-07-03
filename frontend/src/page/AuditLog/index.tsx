import React, { useCallback, useEffect, useState } from "react";
import {
  FiShield, FiRefreshCw, FiClock, FiUser, FiTag, FiChevronLeft, FiChevronRight,
} from "react-icons/fi";
import { CustomSelect } from "../../component/ui/CustomSelect";
import { ListAuditLogs, type AuditLogDTO } from "../../services/auditlog";
import { useStateContext } from "../../contexts/ProviderContext";
import { useLanguage } from "../../contexts/LanguageContext";

const PAGE_SIZE = 25;

const ACTIONS = [
  "user.role_changed",
  "user.created",
  "user.deleted",
  "setting.updated",
  "target.deleted",
  "schedule.deleted",
  "line_master.updated",
  "line_master.deleted",
] as const;

const ACTION_COLOR: Record<string, string> = {
  "user.role_changed": "#f59e0b",
  "user.created": "#10b981",
  "user.deleted": "#ef4444",
  "setting.updated": "#3b82f6",
  "target.deleted": "#ef4444",
  "schedule.deleted": "#ef4444",
  "line_master.updated": "#3b82f6",
  "line_master.deleted": "#ef4444",
};

const fmtDateTime = (iso: string): string => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
};

const AuditLogPage: React.FC = () => {
  const { currentColor } = useStateContext();
  const { t } = useLanguage();
  const accentGrad = `linear-gradient(135deg, ${currentColor}, color-mix(in srgb, ${currentColor} 65%, #a855f7))`;

  const [logs, setLogs] = useState<AuditLogDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLogs = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true); else setLoading(true);
    const res = await ListAuditLogs({
      action: action || undefined,
      page,
      page_size: PAGE_SIZE,
    });
    setLogs(res.data);
    setTotal(res.total);
    setLoading(false);
    setRefreshing(false);
  }, [action, page]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="w-full space-y-4 sm:space-y-5">
      {/* Header card */}
      <div
        className="relative overflow-hidden rounded-[18px] bg-white/95 p-4 shadow-sm backdrop-blur sm:rounded-[22px] sm:p-6 dark:bg-[#0d0b1a]/90"
        style={{ border: `1px solid ${currentColor}30` }}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-12 right-10 h-40 w-40 rounded-full blur-3xl" style={{ backgroundColor: `${currentColor}1e` }} />
        </div>
        <div className="relative z-10 flex items-center gap-3 sm:gap-4">
          <div
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg sm:h-13 sm:w-13"
            style={{ background: accentGrad, boxShadow: `0 8px 24px -6px ${currentColor}50` }}
          >
            <FiShield className="text-[20px] sm:text-[22px]" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] sm:text-[10.5px]" style={{ color: currentColor }}>
              {t("auditLog.kicker")}
            </p>
            <h1 className="truncate text-[18px] font-bold text-slate-900 sm:text-[20px] dark:text-white/90">
              {t("auditLog.title")}
            </h1>
            <p className="mt-0.5 truncate text-[11px] text-slate-500 sm:text-[12px] dark:text-white/45">
              {t("auditLog.subtitle")}
            </p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200/80 bg-white dark:border-white/8 dark:bg-[#0d0b1a]/60">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3.5 dark:border-white/8">
          <div className="flex shrink-0 items-center gap-2.5">
            <FiTag className="text-[14px] text-slate-400 dark:text-white/35" />
            <p className="text-[13px] font-bold text-slate-800 dark:text-white/90">
              {t("auditLog.title")}
              {!loading && (
                <span className="ml-2 text-[11px] font-normal text-slate-400 dark:text-white/30">
                  ({total})
                </span>
              )}
            </p>
          </div>

          <div className="w-56">
            <CustomSelect
              options={[
                { value: "", label: t("auditLog.allActions") },
                ...ACTIONS.map((a) => ({ value: a, label: a })),
              ]}
              value={action}
              onChange={(v) => { setPage(1); setAction(v); }}
              searchable={false}
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => void fetchLogs(true)}
              disabled={refreshing}
              className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200/70 bg-white text-slate-500 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/8 dark:bg-white/5 dark:text-white/50"
            >
              <FiRefreshCw className={`text-[12px] ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-b-xl">
          {loading ? (
            <div className="space-y-0">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-14 animate-pulse border-b border-slate-100 last:border-0 dark:border-white/6" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <FiShield className="text-[24px] text-slate-300 dark:text-white/20" />
              <p className="text-[12.5px] text-slate-400 dark:text-white/35">{t("auditLog.noResults")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-180">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-white/8">
                    {[t("auditLog.colTime"), t("auditLog.colActor"), t("auditLog.colAction"), t("auditLog.colTarget"), t("auditLog.colDetail"), t("auditLog.colIP")].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/60 dark:divide-white/5">
                  {logs.map((l) => (
                    <tr key={l.id} className="transition-colors hover:bg-slate-50/60 dark:hover:bg-white/2">
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-[12px] text-slate-600 dark:text-white/55">
                          <FiClock className="text-[11px] text-slate-400 dark:text-white/30" />
                          {fmtDateTime(l.created_at)}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <FiUser className="text-[11px] text-slate-400 dark:text-white/30" />
                          <div className="min-w-0">
                            <p className="truncate text-[12.5px] font-medium text-slate-700 dark:text-white/80">{l.actor_email || "—"}</p>
                            <p className="text-[10.5px] text-slate-400 dark:text-white/30">{l.actor_role}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className="inline-flex items-center rounded-full px-2.5 py-1 text-[10.5px] font-semibold"
                          style={{
                            color: ACTION_COLOR[l.action] ?? "#64748b",
                            backgroundColor: `${ACTION_COLOR[l.action] ?? "#64748b"}18`,
                          }}
                        >
                          {l.action}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-[12px] text-slate-500 dark:text-white/45">
                        {l.target_type}{l.target_id ? ` #${l.target_id}` : ""}
                      </td>
                      <td className="max-w-96 px-4 py-3.5 text-[12px] text-slate-600 dark:text-white/55">
                        {l.detail}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-[11px] text-slate-400 dark:text-white/35">
                        {l.ip_address}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 dark:border-white/8">
            <p className="text-[11.5px] text-slate-400 dark:text-white/35">
              {t("auditLog.pageOfTotal", { page, totalPages })}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200/70 text-slate-500 disabled:opacity-40 dark:border-white/8 dark:text-white/50"
              >
                <FiChevronLeft className="text-[12px]" />
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200/70 text-slate-500 disabled:opacity-40 dark:border-white/8 dark:text-white/50"
              >
                <FiChevronRight className="text-[12px]" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLogPage;
