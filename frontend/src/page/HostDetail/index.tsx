import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  FiArrowLeft,
  FiAlertTriangle,
  FiShield,
  FiClock,
  FiZap,
  FiBarChart2,
  FiServer,
  FiUser,
  FiActivity,
} from "react-icons/fi";
import {
  GetHostSummary,
  type HostSummaryResponse,
  type HostVulnDetail,
  type SLABreachItem,
  GetSLABreaches,
} from "../../services/host";
import { useLanguage } from "../../contexts/LanguageContext";

// ========================
// Utility helpers
// ========================

const severityColor = (level: string) => {
  switch (level) {
    case "Critical": return { bg: "bg-red-100 dark:bg-red-500/15", text: "text-red-700 dark:text-red-300", border: "border-red-200 dark:border-red-500/30" };
    case "High":     return { bg: "bg-orange-100 dark:bg-orange-500/15", text: "text-orange-700 dark:text-orange-300", border: "border-orange-200 dark:border-orange-500/30" };
    case "Medium":   return { bg: "bg-yellow-100 dark:bg-yellow-500/15", text: "text-yellow-700 dark:text-yellow-300", border: "border-yellow-200 dark:border-yellow-500/30" };
    case "Low":      return { bg: "bg-blue-100 dark:bg-blue-500/15", text: "text-blue-700 dark:text-blue-300", border: "border-blue-200 dark:border-blue-500/30" };
    default:         return { bg: "bg-gray-100 dark:bg-white/5", text: "text-gray-600 dark:text-white/50", border: "border-gray-200 dark:border-white/10" };
  }
};

const riskColor = (level: string) => {
  switch (level) {
    case "CRITICAL": return "text-red-600 dark:text-red-400";
    case "HIGH":     return "text-orange-500 dark:text-orange-400";
    case "MEDIUM":   return "text-yellow-500 dark:text-yellow-400";
    default:         return "text-green-500 dark:text-green-400";
  }
};

const criticalityColor = (c: string) => {
  switch (c) {
    case "crown_jewel": return "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/30";
    case "high":        return "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30";
    case "medium":      return "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-500/15 dark:text-yellow-300 dark:border-yellow-500/30";
    default:            return "bg-gray-100 text-gray-600 border-gray-200 dark:bg-white/5 dark:text-white/50 dark:border-white/10";
  }
};

const slaColor = (status: string) => {
  switch (status) {
    case "breach":  return { bg: "bg-red-50 dark:bg-red-500/10", text: "text-red-600 dark:text-red-400", badge: "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30" };
    case "warning": return { bg: "bg-yellow-50 dark:bg-yellow-500/10", text: "text-yellow-600 dark:text-yellow-400", badge: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-500/15 dark:text-yellow-300 dark:border-yellow-500/30" };
    case "ok":      return { bg: "", text: "text-green-600 dark:text-green-400", badge: "bg-green-100 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/30" };
    default:        return { bg: "", text: "text-gray-400", badge: "bg-gray-100 text-gray-500 border-gray-200 dark:bg-white/5 dark:text-white/30 dark:border-white/10" };
  }
};

// ========================
// Sub-components
// ========================

const StatCard: React.FC<{
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  sub?: string;
}> = ({ label, value, icon, color, sub }) => (
  <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-4 dark:border-white/8 dark:bg-white/4">
    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${color}`}>
      {icon}
    </div>
    <div className="min-w-0">
      <p className="truncate text-xs text-gray-500 dark:text-white/45">{label}</p>
      <p className="text-xl font-bold text-gray-800 dark:text-white">{value}</p>
      {sub && <p className="text-[11px] text-gray-400 dark:text-white/30">{sub}</p>}
    </div>
  </div>
);

const SeverityBar: React.FC<{ data: HostSummaryResponse }> = ({ data }) => {
  const { t } = useLanguage();
  const bars = [
    { label: t("severity.critical"), count: data.critical, color: "bg-red-500" },
    { label: t("severity.high"),     count: data.high,     color: "bg-orange-400" },
    { label: t("severity.medium"),   count: data.medium,   color: "bg-yellow-400" },
    { label: t("severity.low"),      count: data.low,      color: "bg-blue-400" },
    { label: t("severity.info"),     count: data.info,     color: "bg-gray-300 dark:bg-white/20" },
  ];
  const total = data.total || 1;
  return (
    <div className="space-y-2">
      {bars.map((b) => (
        <div key={b.label} className="flex items-center gap-2">
          <span className="w-14 text-right text-xs text-gray-500 dark:text-white/45">{b.label}</span>
          <div className="flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/8" style={{ height: 10 }}>
            <div
              className={`h-full rounded-full ${b.color} transition-all duration-500`}
              style={{ width: `${(b.count / total) * 100}%` }}
            />
          </div>
          <span className="w-6 text-right text-xs font-semibold text-gray-700 dark:text-white/70">{b.count}</span>
        </div>
      ))}
    </div>
  );
};

const VulnTable: React.FC<{ items: HostVulnDetail[] }> = ({ items }) => {
  const { t } = useLanguage();
  const [filter, setFilter] = useState<string>("All");
  const levels = ["All", "Critical", "High", "Medium", "Low", "Info"];
  const levelLabel = (l: string) => {
    switch (l) {
      case "All": return t("hostDetail.allLevels");
      case "Critical": return t("severity.critical");
      case "High": return t("severity.high");
      case "Medium": return t("severity.medium");
      case "Low": return t("severity.low");
      case "Info": return t("severity.info");
      default: return l;
    }
  };
  const filtered = filter === "All" ? items : items.filter((i) => i.level === filter);

  return (
    <div className="space-y-3">
      {/* Level filter tabs */}
      <div className="flex flex-wrap gap-1.5">
        {levels.map((l) => {
          const active = l === filter;
          const c = severityColor(l === "All" ? "" : l);
          return (
            <button
              key={l}
              onClick={() => setFilter(l)}
              className={[
                "rounded-full border px-3 py-1 text-xs font-medium transition-all",
                active
                  ? l === "All"
                    ? "border-gray-800 bg-gray-800 text-white dark:border-white dark:bg-white dark:text-gray-900"
                    : `${c.border} ${c.bg} ${c.text}`
                  : "border-gray-200 bg-transparent text-gray-500 hover:border-gray-400 dark:border-white/10 dark:text-white/40",
              ].join(" ")}
            >
              {levelLabel(l)}{l !== "All" && ` (${items.filter((i) => i.level === l).length})`}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-white/8">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs text-gray-500 dark:border-white/8 dark:bg-white/3 dark:text-white/40">
              <th className="px-4 py-2.5 font-medium">{t("hostDetail.vulnerability")}</th>
              <th className="px-4 py-2.5 font-medium">{t("hostDetail.family")}</th>
              <th className="px-4 py-2.5 font-medium">{t("delta.severity")}</th>
              <th className="px-4 py-2.5 font-medium">{t("hostDetail.cves")}</th>
              <th className="px-4 py-2.5 font-medium">{t("hostDetail.port")}</th>
              <th className="px-4 py-2.5 font-medium">{t("hostDetail.daysOpen")}</th>
              <th className="px-4 py-2.5 font-medium">{t("hostDetail.sla")}</th>
              <th className="px-4 py-2.5 font-medium">{t("hostDetail.risk")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-white/5">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400 dark:text-white/30">
                  {t("hostDetail.noVulnerabilities")}
                </td>
              </tr>
            )}
            {filtered.map((v, i) => {
              const sc = severityColor(v.level);
              const sl = slaColor(v.sla_status);
              const slaLabel = v.sla_status === "breach"
                ? t("hostDetail.daysOverdue", { n: v.days_open - v.sla_days })
                : v.sla_status === "warning"
                ? t("hostDetail.daysLeft", { n: v.sla_days - v.days_open })
                : v.sla_status === "n/a"
                ? "—"
                : t("hostDetail.ok");

              return (
                <tr
                  key={i}
                  className={`transition-colors hover:bg-gray-50 dark:hover:bg-white/3 ${sl.bg}`}
                >
                  <td className="max-w-70 px-4 py-2.5">
                    <span className="block truncate font-medium text-gray-800 dark:text-white/90" title={v.vuln_name}>
                      {v.vuln_name}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-white/45">
                    {v.family}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${sc.bg} ${sc.text} ${sc.border}`}>
                      {v.level} {v.severity.toFixed(1)}
                    </span>
                  </td>
                  <td className="max-w-45 px-4 py-2.5">
                    <span className="block truncate text-xs text-gray-500 dark:text-white/45" title={v.cve_list || "—"}>
                      {v.cve_list || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-white/45">
                    {v.port || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs font-medium text-gray-700 dark:text-white/70">
                    {v.days_open}d
                  </td>
                  <td className="px-4 py-2.5">
                    {v.sla_status !== "n/a" ? (
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${sl.badge}`}>
                        {v.sla_status === "breach" && <FiAlertTriangle className="text-[10px]" />}
                        {slaLabel}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300 dark:text-white/20">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                        <div
                          className={`h-full rounded-full ${v.risk_score >= 80 ? "bg-red-500" : v.risk_score >= 60 ? "bg-orange-400" : v.risk_score >= 40 ? "bg-yellow-400" : "bg-green-400"}`}
                          style={{ width: `${v.risk_score}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-gray-600 dark:text-white/60">
                        {v.risk_score.toFixed(0)}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ========================
// Main page
// ========================

export default function HostDetail() {
  const { t } = useLanguage();
  const { ip } = useParams<{ ip: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<HostSummaryResponse | null>(null);
  const [slaBreaches, setSlaBreaches] = useState<SLABreachItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ip) {
      // Previously left `loading` stuck at its initial `true` forever when ip
      // was falsy on mount, spinning indefinitely with no error shown.
      setLoading(false);
      setError(t("hostDetail.notFound"));
      return;
    }

    let ignore = false;
    setLoading(true);
    setError(null);

    Promise.all([GetHostSummary(ip), GetSLABreaches()]).then(([summary, sla]) => {
      // Guards against a slower request for a previous ip (e.g. rapid
      // back/forward navigation between two host pages) resolving after a
      // newer one and overwriting it with stale data.
      if (ignore) return;
      if (!summary) {
        setError(t("hostDetail.notFound"));
      } else {
        setData(summary);
      }
      if (sla?.data) {
        setSlaBreaches(sla.data.filter((s) => s.host_ip === ip));
      }
      setLoading(false);
    });

    return () => { ignore = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ip]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-blue-500" />
          <p className="text-sm text-gray-500 dark:text-white/40">{t("hostDetail.loadingHost")}</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <FiServer className="text-4xl text-gray-300 dark:text-white/20" />
        <p className="text-sm text-gray-500 dark:text-white/40">{error ?? t("hostDetail.noData")}</p>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:text-white/60 dark:hover:bg-white/5"
        >
          <FiArrowLeft /> {t("common.back")}
        </button>
      </div>
    );
  }

  const riskBarWidth = `${data.risk_score}%`;
  const riskBg =
    data.risk_score >= 80 ? "bg-red-500" :
    data.risk_score >= 60 ? "bg-orange-400" :
    data.risk_score >= 40 ? "bg-yellow-400" :
    "bg-green-400";

  return (
    <div className="space-y-6 p-1">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-white/10 dark:text-white/50 dark:hover:bg-white/5"
          >
            <FiArrowLeft />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-800 dark:text-white">{data.host_ip}</h1>
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${criticalityColor(data.asset.criticality)}`}>
                {data.asset.criticality || t("hostDetail.unclassified")}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-white/40">
              {data.task_name && <span className="mr-2">{data.task_name}</span>}
              {data.scanned_at && <span>{t("hostDetail.lastScan", { date: data.scanned_at })}</span>}
            </p>
          </div>
        </div>

        {/* Risk score pill */}
        <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-5 py-3 dark:border-white/8 dark:bg-white/4">
          <div>
            <p className="text-xs text-gray-500 dark:text-white/40">{t("hostDetail.compositeRiskScore")}</p>
            <p className={`text-2xl font-black ${riskColor(data.risk_level)}`}>
              {data.risk_score.toFixed(1)}
              <span className="ml-1 text-sm font-semibold">{data.risk_level}</span>
            </p>
            <div className="mt-1 h-1.5 w-32 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
              <div className={`h-full rounded-full transition-all ${riskBg}`} style={{ width: riskBarWidth }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label={t("hostDetail.statTotal")} value={data.total} icon={<FiShield className="text-white text-base" />} color="bg-gray-500" />
        <StatCard label={t("severity.critical")} value={data.critical} icon={<FiAlertTriangle className="text-white text-base" />} color="bg-red-500" />
        <StatCard label={t("severity.high")} value={data.high} icon={<FiAlertTriangle className="text-white text-base" />} color="bg-orange-400" />
        <StatCard label={t("hostDetail.statKevHits")} value={data.kev_count} icon={<FiZap className="text-white text-base" />} color="bg-purple-500" sub={t("hostDetail.knownExploited")} />
        <StatCard label={t("hostDetail.statSlaBreach")} value={data.sla_breach_count} icon={<FiClock className="text-white text-base" />} color="bg-rose-500" sub={t("hostDetail.warningSub", { n: data.sla_warning_count })} />
        <StatCard label={t("hostDetail.statTopEpss")} value={data.top_epss[0] ? `${(data.top_epss[0].epss_score * 100).toFixed(1)}%` : "—"} icon={<FiActivity className="text-white text-base" />} color="bg-blue-500" sub={t("hostDetail.exploitProbability")} />
      </div>

      {/* ── Severity + Asset info ── */}
      <div className="grid gap-4 lg:grid-cols-3">

        {/* Severity breakdown */}
        <div className="rounded-xl border border-gray-100 bg-white p-5 dark:border-white/8 dark:bg-white/4">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-white/80">
            <FiBarChart2 className="text-blue-500" /> {t("hostDetail.severityBreakdown")}
          </h3>
          <SeverityBar data={data} />
        </div>

        {/* Asset info */}
        <div className="rounded-xl border border-gray-100 bg-white p-5 dark:border-white/8 dark:bg-white/4">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-white/80">
            <FiServer className="text-blue-500" /> {t("hostDetail.assetInformation")}
          </h3>
          <dl className="space-y-2 text-sm">
            {[
              { label: t("hostDetail.criticality"),    value: data.asset.criticality || "—" },
              { label: t("hostDetail.assetType"),     value: data.asset.asset_type || "—" },
              { label: t("hostDetail.owner"),          value: data.asset.owner || "—" },
              { label: t("hostDetail.businessImpact"),value: data.asset.business_impact || "—" },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-start justify-between gap-2">
                <dt className="shrink-0 text-gray-500 dark:text-white/40">{label}</dt>
                <dd className="text-right font-medium text-gray-700 dark:text-white/75 capitalize">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Top EPSS */}
        <div className="rounded-xl border border-gray-100 bg-white p-5 dark:border-white/8 dark:bg-white/4">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-white/80">
            <FiActivity className="text-blue-500" /> {t("hostDetail.topEpssScores")}
          </h3>
          {data.top_epss.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-white/30">{t("hostDetail.noEpssData")}</p>
          ) : (
            <div className="space-y-3">
              {data.top_epss.map((e, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="truncate font-mono text-gray-600 dark:text-white/60">{e.cve_id}</span>
                    <span className={`font-bold ${e.epss_score >= 0.5 ? "text-red-500" : e.epss_score >= 0.1 ? "text-orange-500" : "text-blue-500"}`}>
                      {(e.epss_score * 100).toFixed(2)}%
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/8">
                    <div
                      className={`h-full rounded-full ${e.epss_score >= 0.5 ? "bg-red-500" : e.epss_score >= 0.1 ? "bg-orange-400" : "bg-blue-400"}`}
                      style={{ width: `${Math.min(e.epss_score * 100, 100)}%` }}
                    />
                  </div>
                  <p className="mt-0.5 truncate text-[10px] text-gray-400 dark:text-white/30">{e.vuln_name}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── KEV Section ── */}
      {data.kev_items.length > 0 && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-5 dark:border-orange-500/20 dark:bg-orange-500/8">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-orange-700 dark:text-orange-300">
            <FiZap /> {t("hostDetail.kevSectionTitle", { n: data.kev_count })}
          </h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.kev_items.map((k, i) => (
              <div
                key={i}
                className={`rounded-lg border p-3 ${
                  k.is_ransomware
                    ? "border-red-200 bg-red-50 dark:border-red-500/25 dark:bg-red-500/10"
                    : "border-orange-200 bg-white dark:border-orange-500/20 dark:bg-white/4"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-gray-700 dark:text-white/80">{k.cve_id}</span>
                  {k.is_ransomware && (
                    <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-500/15 dark:text-red-300">
                      {t("hostDetail.ransomware")}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-600 dark:text-white/55">{k.vulnerability_name}</p>
                <p className="mt-0.5 text-[11px] text-gray-400 dark:text-white/35">{k.product}</p>
                {k.due_date && (
                  <p className="mt-1.5 flex items-center gap-1 text-[11px] text-red-600 dark:text-red-400">
                    <FiClock className="text-[10px]" /> {t("hostDetail.due", { date: k.due_date })}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SLA Breach section ── */}
      {slaBreaches.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 dark:border-red-500/20 dark:bg-red-500/8">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-300">
            <FiClock /> {t("hostDetail.slaStatusTitle", { breach: data.sla_breach_count, warning: data.sla_warning_count })}
          </h3>
          <div className="overflow-x-auto rounded-lg border border-red-100 dark:border-red-500/15">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-red-100 bg-red-50/80 text-left text-gray-500 dark:border-red-500/15 dark:bg-red-500/10 dark:text-white/40">
                  <th className="px-3 py-2 font-medium">{t("hostDetail.vulnerability")}</th>
                  <th className="px-3 py-2 font-medium">{t("hostDetail.level")}</th>
                  <th className="px-3 py-2 font-medium">{t("hostDetail.daysOpen")}</th>
                  <th className="px-3 py-2 font-medium">{t("hostDetail.sla")}</th>
                  <th className="px-3 py-2 font-medium">{t("hostDetail.overdue")}</th>
                  <th className="px-3 py-2 font-medium">{t("common.status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-50 dark:divide-red-500/10">
                {slaBreaches.map((s, i) => {
                  const sl = slaColor(s.sla_status);
                  const sc = severityColor(s.level);
                  return (
                    <tr key={i} className="bg-white dark:bg-white/2">
                      <td className="max-w-55 px-3 py-2">
                        <span className="block truncate font-medium text-gray-700 dark:text-white/80" title={s.vuln_name}>
                          {s.vuln_name}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${sc.bg} ${sc.text} ${sc.border}`}>
                          {s.level}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-semibold text-gray-700 dark:text-white/70">{s.days_open}d</td>
                      <td className="px-3 py-2 text-gray-500 dark:text-white/40">{s.sla_days}d</td>
                      <td className={`px-3 py-2 font-bold ${sl.text}`}>
                        {s.overdue_days > 0 ? `+${s.overdue_days}d` : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold capitalize ${sl.badge}`}>
                          {s.sla_status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Full vulnerability table ── */}
      <div className="rounded-xl border border-gray-100 bg-white p-5 dark:border-white/8 dark:bg-white/4">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-white/80">
          <FiShield className="text-blue-500" />
          {t("hostDetail.vulnerabilitiesCount", { n: data.total })}
          <span className="ml-auto flex items-center gap-1 text-xs font-normal text-gray-400 dark:text-white/30">
            <FiUser className="text-[11px]" /> {t("hostDetail.riskFormula")}
          </span>
        </h3>
        <VulnTable items={data.vulnerabilities} />
      </div>

    </div>
  );
}
