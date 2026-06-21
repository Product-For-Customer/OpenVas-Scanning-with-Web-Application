import React, { useEffect, useRef, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiAlertTriangle,
  FiShield,
  FiSearch,
  FiCalendar,
  FiExternalLink,
  FiZap,
  FiDatabase,
  FiChevronRight,
  FiServer,
} from "react-icons/fi";
import {
  GetKEVSummary,
  GetKEVSyncStatus,
  ListKEVCatalog,
  type KEVByHost,
  type KEVEntryDTO,
  type KEVSummaryDTO,
  type KEVSyncStatusDTO,
} from "../../services";
import { useLanguage } from "../../contexts/LanguageContext";
import { useStateContext } from "../../contexts/ProviderContext";

// ─────────────────────────────────────────────────────────────
// Micro-components
// ─────────────────────────────────────────────────────────────

const Pulse: React.FC = () => (
  <span className="inline-block h-9 w-14 animate-pulse rounded-lg bg-slate-100 dark:bg-white/10" />
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

const SummaryCard: React.FC<SummaryCardProps> = ({
  label, value, sub, icon, iconColor, loading, pulse,
}) => (
  <div className="rounded-xl border border-slate-200/70 bg-white px-5 py-5 dark:border-white/8 dark:bg-[#0d0b1a]/80">
    <div className="flex items-center justify-between">
      <p className="text-[11px] font-medium tracking-wide text-slate-500 dark:text-white/45">
        {label}
      </p>
      <span style={{ color: iconColor }} className="relative text-[15px] opacity-75">
        {icon}
        {pulse && !loading && (
          <span className="absolute -right-1 -top-1 flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
          </span>
        )}
      </span>
    </div>
    <p className="mt-3 text-[34px] font-bold leading-none tracking-tight text-slate-900 dark:text-white">
      {loading ? <Pulse /> : value}
    </p>
    <p className="mt-2 text-[11px] text-slate-400 dark:text-white/35">{sub}</p>
  </div>
);

const KEVBadge: React.FC<{ isRansomware?: boolean }> = ({ isRansomware }) => (
  <span
    className={[
      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9.5px] font-bold",
      isRansomware
        ? "border-red-200 bg-red-50 text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300"
        : "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/25 dark:bg-orange-500/10 dark:text-orange-300",
    ].join(" ")}
  >
    <FiZap className="text-[9px]" />
    {isRansomware ? "RANSOMWARE" : "KEV"}
  </span>
);

// ─────────────────────────────────────────────────────────────
// KEV Table Row (Full Catalog)
// ─────────────────────────────────────────────────────────────

const KEVRow: React.FC<{ entry: KEVEntryDTO; index: number }> = ({ entry, index }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        className={[
          "cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-white/3",
          index % 2 === 0 ? "bg-white dark:bg-white/2" : "bg-slate-50/50 dark:bg-white/1",
        ].join(" ")}
        onClick={() => setExpanded((p) => !p)}
      >
        <td className="px-4 py-3">
          <span className="inline-flex items-center rounded-full border border-slate-200/70 bg-slate-50 px-2.5 py-1 text-[10.5px] font-bold text-slate-700 dark:border-white/8 dark:bg-white/5 dark:text-white/80">
            {entry.cve_id}
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="max-w-70 truncate text-[11.5px] font-medium text-slate-800 dark:text-white/80">
            {entry.vulnerability_name}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-white/40">
            {entry.vendor_project} · {entry.product}
          </div>
        </td>
        <td className="hidden px-4 py-3 md:table-cell">
          <div className="flex flex-wrap gap-1.5">
            <KEVBadge isRansomware={false} />
            {entry.is_ransomware_related && <KEVBadge isRansomware={true} />}
          </div>
        </td>
        <td className="hidden px-4 py-3 text-[11px] text-slate-500 dark:text-white/45 lg:table-cell">
          <div className="flex items-center gap-1.5">
            <FiCalendar className="shrink-0 text-[11px]" />
            {entry.date_added}
          </div>
          {entry.due_date && (
            <div className="mt-0.5 text-[10px] text-rose-600 dark:text-rose-400">
              Due: {entry.due_date}
            </div>
          )}
        </td>
        <td className="px-4 py-3">
          <div className="max-w-50 truncate text-[10.5px] text-slate-500 dark:text-white/45">
            {entry.required_action}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-slate-50/80 dark:bg-white/2">
          <td colSpan={5} className="px-4 pb-4 pt-0">
            <div className="rounded-xl border border-slate-200/70 bg-white p-3.5 dark:border-white/8 dark:bg-white/4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-white/35">
                    Description
                  </p>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-slate-600 dark:text-white/70">
                    {entry.short_description || "No description available"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-white/35">
                    Required Action
                  </p>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-slate-600 dark:text-white/70">
                    {entry.required_action || "N/A"}
                  </p>
                  {entry.notes && (
                    <>
                      <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-white/35">
                        Notes
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-white/55">
                        {entry.notes}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

// ─────────────────────────────────────────────────────────────
// Host Scan Row
// ─────────────────────────────────────────────────────────────

const HostScanRow: React.FC<{
  host: KEVByHost;
  index: number;
  onClick: () => void;
}> = ({ host, index, onClick }) => {
  const ransomwareCount = host.cve_list.filter((c) => c.is_ransomware_related).length;

  return (
    <tr
      onClick={onClick}
      className={[
        "group cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-white/3",
        index % 2 === 0 ? "bg-white dark:bg-white/2" : "bg-slate-50/50 dark:bg-white/1",
      ].join(" ")}
    >
      <td className="px-4 py-3.5 text-[11px] font-semibold text-slate-400 dark:text-white/30">
        {index + 1}
      </td>
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-slate-200/70 bg-slate-50 text-slate-500 dark:border-white/8 dark:bg-white/5 dark:text-white/55">
            <FiServer className="text-[12px]" />
          </div>
          <div>
            <p className="font-mono text-[12.5px] font-bold text-slate-800 dark:text-white/88">
              {host.host_ip}
            </p>
            <p className="text-[10px] text-slate-400 dark:text-white/35">
              {host.task_name || "—"}
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3.5">
        <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-bold text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-300">
          <FiZap className="text-[10px]" />
          {host.kev_count}
        </span>
      </td>
      <td className="px-4 py-3.5">
        {ransomwareCount > 0 ? (
          <span className="text-[12px] font-bold text-red-600 dark:text-red-400">
            {ransomwareCount}
          </span>
        ) : (
          <span className="text-[11px] text-slate-400 dark:text-white/30">—</span>
        )}
      </td>
      <td className="px-4 py-3.5 text-right">
        <FiChevronRight className="ml-auto text-[14px] text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-600 dark:text-white/30 dark:group-hover:text-white/55" />
      </td>
    </tr>
  );
};

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────

const ThreatIntelligence: React.FC = () => {
  const { t } = useLanguage();
  const { currentColor } = useStateContext();
  const navigate = useNavigate();
  const accentGrad = `linear-gradient(135deg, ${currentColor}, color-mix(in srgb, ${currentColor} 65%, #a855f7))`;

  const [summary, setSummary]         = useState<KEVSummaryDTO | null>(null);
  const [syncStatus, setSyncStatus]   = useState<KEVSyncStatusDTO | null>(null);
  const [catalog, setCatalog]         = useState<KEVEntryDTO[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [activeTab, setActiveTab]     = useState<"scans" | "catalog">("scans");
  const [search, setSearch]           = useState("");
  const [ransomwareOnly, setRansomwareOnly] = useState(false);

  const hasFetched = useRef(false);

  const fetchAll = async () => {
    setLoadingSummary(true);
    setLoadingCatalog(true);
    const [summaryData, statusData, catalogData] = await Promise.all([
      GetKEVSummary(),
      GetKEVSyncStatus(),
      ListKEVCatalog(),
    ]);
    setSummary(summaryData);
    setSyncStatus(statusData);
    setCatalog(Array.isArray(catalogData) ? catalogData : []);
    setLoadingSummary(false);
    setLoadingCatalog(false);
  };

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    void fetchAll();
  }, []);


  const handleHostClick = (host: KEVByHost) => {
    navigate(
      `/admin/threat-intelligence/detail/${encodeURIComponent(host.host_ip)}`,
      { state: { host, summary } }
    );
  };

  const filteredCatalog = useMemo(() => {
    let list = catalog;
    if (ransomwareOnly) list = list.filter((e) => e.is_ransomware_related);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (e) =>
          e.cve_id.toLowerCase().includes(q) ||
          e.vulnerability_name.toLowerCase().includes(q) ||
          e.vendor_project.toLowerCase().includes(q) ||
          e.product.toLowerCase().includes(q)
      );
    }
    return list;
  }, [catalog, search, ransomwareOnly]);

  const kevByHostList = summary?.kev_by_host ?? [];

  return (
    <div className="w-full space-y-5 py-0 sm:py-0">

      {/* ── Header card ── */}
      <div
        className="relative mb-4 overflow-hidden rounded-[18px] bg-white/95 p-4 shadow-sm backdrop-blur sm:rounded-[22px] sm:mb-5 sm:p-6 dark:bg-[#0d0b1a]/90"
        style={{ border: `1px solid ${currentColor}30` }}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-12 right-10 h-40 w-40 rounded-full blur-3xl" style={{ backgroundColor: `${currentColor}1e` }} />
          <div className="absolute -bottom-12 left-10 h-40 w-40 rounded-full blur-3xl" style={{ backgroundColor: `${currentColor}14` }} />
        </div>
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg sm:h-13 sm:w-13"
              style={{ background: accentGrad, boxShadow: `0 8px 24px -6px ${currentColor}50` }}
            >
              <FiShield className="text-[20px] sm:text-[22px]" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] sm:text-[10.5px]" style={{ color: currentColor }}>
                THREAT INTELLIGENCE · KEV
              </p>
              <h1 className="truncate text-[18px] font-bold text-slate-900 sm:text-[20px] dark:text-white/90">
                {t("threat.title")}
              </h1>
              <p className="mt-0.5 truncate text-[11px] text-slate-500 sm:text-[12px] dark:text-white/45">
                CISA Known Exploited Vulnerabilities Catalog
              </p>
            </div>
          </div>

          {/* Alert chips */}
          {!loadingSummary && (summary?.total_kev_in_scans ?? 0) > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-[10.5px] font-semibold text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
                </span>
                {summary!.total_kev_in_scans} Actively Exploited
              </span>
              {summary!.ransomware_related > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-[10.5px] font-semibold text-orange-700 dark:border-orange-500/25 dark:bg-orange-500/10 dark:text-orange-300">
                  <FiZap className="text-[10px]" />
                  {summary!.ransomware_related} Ransomware
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <SummaryCard
          label={t("threat.totalKEVEntries")}
          value={summary?.total_kev_in_scans ?? 0}
          sub="Actively exploited CVEs found"
          icon={<FiAlertTriangle />}
          iconColor="#ef4444"
          loading={loadingSummary}
          pulse={(summary?.total_kev_in_scans ?? 0) > 0}
        />
        <SummaryCard
          label={t("threat.exploitedInWild")}
          value={summary?.ransomware_related ?? 0}
          sub="Linked to ransomware campaigns"
          icon={<FiZap />}
          iconColor="#f97316"
          loading={loadingSummary}
          pulse={(summary?.ransomware_related ?? 0) > 0}
        />
        <SummaryCard
          label={t("threat.lastSync")}
          value={syncStatus?.total ?? summary?.total_kev_catalog ?? 0}
          sub="Total entries in CISA catalog"
          icon={<FiDatabase />}
          iconColor="#06b6d4"
          loading={loadingSummary}
        />
        <SummaryCard
          label="Hosts at Risk"
          value={kevByHostList.length}
          sub="Hosts with active KEV CVEs"
          icon={<FiShield />}
          iconColor="#8b5cf6"
          loading={loadingSummary}
        />
      </div>

      {/* ── Tabs ── */}
      <div className="flex flex-wrap gap-2">
        {(["scans", "catalog"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            style={activeTab === tab ? { background: accentGrad } : undefined}
            className={[
              "rounded-lg border px-4 py-2 text-[12px] font-semibold transition-all",
              activeTab === tab
                ? "border-transparent text-white"
                : "border-slate-200/70 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/8",
            ].join(" ")}
          >
            {tab === "scans"
              ? `KEV in Scans (${summary?.total_kev_in_scans ?? 0})`
              : `Full Catalog (${syncStatus?.total ?? 0})`}
          </button>
        ))}
      </div>

      {/* ── Tab: KEV in Scans ── */}
      {activeTab === "scans" && (
        <div className="rounded-xl border border-slate-200/70 bg-white dark:border-white/8 dark:bg-[#0d0b1a]/80">
          {loadingSummary ? (
            <div className="space-y-2 p-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100 dark:bg-white/8" />
              ))}
            </div>
          ) : kevByHostList.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <div className="grid h-14 w-14 place-items-center rounded-xl border border-slate-200/70 bg-slate-50 text-slate-400 dark:border-white/8 dark:bg-white/4 dark:text-white/30">
                <FiShield className="text-[22px]" />
              </div>
              <p className="text-[13px] font-semibold text-slate-600 dark:text-white/60">
                No KEV CVEs found in your scans
              </p>
              <p className="text-[11px] text-slate-400 dark:text-white/35">
                Your scanned hosts do not have any actively exploited vulnerabilities
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-130">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-white/8">
                    <th className="w-10 px-4 py-3 text-left text-[10px] font-semibold uppercase text-slate-400 dark:text-white/30">#</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase text-slate-500 dark:text-white/40">Host / Task</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase text-slate-500 dark:text-white/40">KEV CVEs</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase text-slate-500 dark:text-white/40">Ransomware</th>
                    <th className="w-10 px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/70 dark:divide-white/5">
                  {kevByHostList.map((host, i) => (
                    <HostScanRow
                      key={`${host.host_ip}-${host.task_name}-${i}`}
                      host={host}
                      index={i}
                      onClick={() => handleHostClick(host)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Full Catalog ── */}
      {activeTab === "catalog" && (
        <div className="rounded-xl border border-slate-200/70 bg-white dark:border-white/8 dark:bg-[#0d0b1a]/80">
          {/* Search & Filter */}
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-white/8">
            <div className="relative min-w-48 flex-1">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400" />
              <input
                type="text"
                placeholder="Search CVE, vendor, product…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-200/70 bg-white py-2 pl-8 pr-3 text-[12px] text-slate-700 placeholder-slate-400 outline-none focus:border-blue-300 dark:border-white/8 dark:bg-white/5 dark:text-white/80 dark:placeholder-white/30"
              />
            </div>
            <button
              type="button"
              onClick={() => setRansomwareOnly((p) => !p)}
              className={[
                "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-semibold transition-all",
                ransomwareOnly
                  ? "border-red-200 bg-red-50 text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300"
                  : "border-slate-200/70 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/60",
              ].join(" ")}
            >
              <FiZap className="text-[11px]" />
              Ransomware Only
            </button>
            <span className="text-[11px] text-slate-500 dark:text-white/40">
              {filteredCatalog.length.toLocaleString()} entries
            </span>
          </div>

          {loadingCatalog ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100 dark:bg-white/8" />
              ))}
            </div>
          ) : filteredCatalog.length === 0 ? (
            <div className="py-14 text-center text-[12px] text-slate-400 dark:text-white/35">
              No KEV entries found
            </div>
          ) : (
            <div className="overflow-y-auto overflow-x-auto" style={{ maxHeight: "calc(100vh - 420px)" }}>
              <table className="w-full min-w-160">
                <thead className="sticky top-0 z-10 bg-white dark:bg-[#0d0b1a]">
                  <tr className="border-b border-slate-100 dark:border-white/8">
                    {["CVE ID", "Vulnerability", "Tags", "Date Added", "Required Action"].map((h, i) => (
                      <th
                        key={h}
                        className={`px-4 py-2.5 text-left text-[10px] font-semibold uppercase text-slate-500 dark:text-white/40 ${i === 2 ? "hidden md:table-cell" : ""} ${i === 3 ? "hidden lg:table-cell" : ""}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/60 dark:divide-white/5">
                  {filteredCatalog.slice(0, 200).map((entry, i) => (
                    <KEVRow key={entry.cve_id} entry={entry} index={i} />
                  ))}
                </tbody>
              </table>
              {filteredCatalog.length > 200 && (
                <div className="border-t border-slate-100 px-4 py-3 text-center text-[11px] text-slate-400 dark:border-white/8 dark:text-white/35">
                  Showing first 200 of {filteredCatalog.length.toLocaleString()} entries. Use search to filter.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Footer ── */}
      <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-white/25">
        <FiExternalLink className="text-[11px]" />
        <span>Data source: CISA Known Exploited Vulnerabilities Catalog</span>
      </div>
    </div>
  );
};

export default ThreatIntelligence;
