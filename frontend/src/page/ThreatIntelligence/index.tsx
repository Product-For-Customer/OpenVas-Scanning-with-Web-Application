import React, { useEffect, useRef, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiAlertTriangle,
  FiRefreshCw,
  FiShield,
  FiSearch,
  FiCalendar,
  FiExternalLink,
  FiZap,
  FiDatabase,
  FiClock,
  FiChevronRight,
  FiServer,
} from "react-icons/fi";
import { message } from "antd";
import {
  GetKEVSummary,
  GetKEVSyncStatus,
  ListKEVCatalog,
  TriggerKEVSync,
  type KEVByHost,
  type KEVEntryDTO,
  type KEVSummaryDTO,
  type KEVSyncStatusDTO,
} from "../../services";

// ===========================
// Sub-components
// ===========================

type SummaryCardProps = {
  label: string;
  value: string | number;
  sub: string;
  icon: React.ReactNode;
  accent: "red" | "orange" | "cyan" | "violet";
  loading?: boolean;
  pulse?: boolean;
};

const SummaryCard: React.FC<SummaryCardProps> = ({
  label,
  value,
  sub,
  icon,
  accent,
  loading,
  pulse,
}) => {
  const accentMap = {
    red: {
      ring: "border-red-200 dark:border-red-500/20",
      icon: "bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/20",
      glow: "bg-red-400/20",
      val: "text-red-700 dark:text-red-300",
    },
    orange: {
      ring: "border-orange-200 dark:border-orange-500/20",
      icon: "bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:border-orange-500/20",
      glow: "bg-orange-400/20",
      val: "text-orange-700 dark:text-orange-300",
    },
    cyan: {
      ring: "border-cyan-200 dark:border-cyan-500/20",
      icon: "bg-cyan-50 text-cyan-600 border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-500/20",
      glow: "bg-cyan-400/20",
      val: "text-cyan-700 dark:text-cyan-300",
    },
    violet: {
      ring: "border-violet-200 dark:border-violet-500/20",
      icon: "bg-violet-50 text-violet-600 border-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/20",
      glow: "bg-violet-400/20",
      val: "text-violet-700 dark:text-violet-300",
    },
  };

  const a = accentMap[accent];

  return (
    <div
      className={[
        "relative overflow-hidden rounded-[22px] border bg-white p-4 shadow-sm",
        "dark:bg-white/5",
        a.ring,
      ].join(" ")}
    >
      <div
        className={`pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full blur-3xl ${a.glow}`}
      />
      <div className="relative flex items-start gap-3">
        <div
          className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-2xl border text-[17px] ${a.icon}`}
        >
          {icon}
          {pulse && !loading && (
            <span className="absolute -right-1 -top-1 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold text-gray-500 dark:text-white/50">
            {label}
          </div>
          {loading ? (
            <div className="mt-1 h-6 w-20 animate-pulse rounded bg-gray-200/70 dark:bg-white/10" />
          ) : (
            <div className={`mt-0.5 text-[22px] font-extrabold ${a.val}`}>
              {value}
            </div>
          )}
          <div className="mt-0.5 text-[10px] text-gray-500 dark:text-white/40">
            {sub}
          </div>
        </div>
      </div>
    </div>
  );
};

// ===========================
// KEV Badge
// ===========================

const KEVBadge: React.FC<{ isRansomware?: boolean }> = ({ isRansomware }) => (
  <span
    className={[
      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9.5px] font-bold",
      isRansomware
        ? "border-red-300 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300"
        : "border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/15 dark:text-orange-300",
    ].join(" ")}
  >
    <FiZap className="text-[9px]" />
    {isRansomware ? "RANSOMWARE" : "KEV"}
  </span>
);

// ===========================
// KEV Table Row (Full Catalog)
// ===========================

const KEVRow: React.FC<{ entry: KEVEntryDTO; index: number }> = ({ entry, index }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        className={[
          "cursor-pointer transition-colors",
          index % 2 === 0
            ? "bg-white dark:bg-white/3"
            : "bg-gray-50/50 dark:bg-white/2",
          "hover:bg-cyan-50/60 dark:hover:bg-cyan-500/5",
        ].join(" ")}
        onClick={() => setExpanded((p) => !p)}
      >
        <td className="px-4 py-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[10.5px] font-bold text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-white/80">
            {entry.cve_id}
          </span>
        </td>
        <td className="px-4 py-3 text-[11.5px] font-medium text-[#1f2240] dark:text-white/80">
          <div className="max-w-70 truncate">{entry.vulnerability_name}</div>
          <div className="text-[10px] text-gray-500 dark:text-white/45">
            {entry.vendor_project} · {entry.product}
          </div>
        </td>
        <td className="hidden px-4 py-3 md:table-cell">
          <div className="flex flex-wrap gap-1.5">
            <KEVBadge isRansomware={false} />
            {entry.is_ransomware_related && <KEVBadge isRansomware={true} />}
          </div>
        </td>
        <td className="hidden px-4 py-3 text-[11px] text-gray-600 dark:text-white/60 lg:table-cell">
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
          <div className="max-w-50 truncate text-[10.5px] text-gray-600 dark:text-white/55">
            {entry.required_action}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-slate-50 dark:bg-white/3">
          <td colSpan={5} className="px-4 pb-4 pt-0">
            <div className="rounded-[14px] border border-gray-200 bg-white p-3.5 dark:border-white/10 dark:bg-white/5">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <div className="text-[10px] font-semibold uppercase text-gray-500 dark:text-white/40">
                    Description
                  </div>
                  <div className="mt-1 text-[11.5px] leading-relaxed text-gray-700 dark:text-white/75">
                    {entry.short_description || "No description available"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase text-gray-500 dark:text-white/40">
                    Required Action
                  </div>
                  <div className="mt-1 text-[11.5px] leading-relaxed text-gray-700 dark:text-white/75">
                    {entry.required_action || "N/A"}
                  </div>
                  {entry.notes && (
                    <>
                      <div className="mt-2 text-[10px] font-semibold uppercase text-gray-500 dark:text-white/40">
                        Notes
                      </div>
                      <div className="mt-1 text-[11px] text-gray-600 dark:text-white/60">
                        {entry.notes}
                      </div>
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

// ===========================
// Host Scan Row (KEV in Scans table)
// ===========================

const HostScanRow: React.FC<{
  host: KEVByHost;
  index: number;
  onClick: () => void;
}> = ({ host, index, onClick }) => {
  const ransomwareCount = host.cve_list.filter((c) => c.is_ransomware_related).length;
  const isOdd = index % 2 !== 0;

  return (
    <tr
      onClick={onClick}
      className={[
        "group cursor-pointer transition-colors",
        isOdd ? "bg-gray-50/50 dark:bg-white/2" : "bg-white dark:bg-white/3",
        "hover:bg-red-50/60 dark:hover:bg-red-500/5",
      ].join(" ")}
    >
      {/* # */}
      <td className="px-4 py-3.5 text-[11px] font-semibold text-gray-400 dark:text-white/30">
        {index + 1}
      </td>

      {/* Host IP */}
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-red-200 bg-red-50 text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
            <FiServer className="text-[12px]" />
          </div>
          <div>
            <div className="text-[12.5px] font-bold text-[#1f2240] dark:text-white/88 font-mono">
              {host.host_ip}
            </div>
            <div className="text-[10px] text-gray-500 dark:text-white/40">
              {host.task_name || "—"}
            </div>
          </div>
        </div>
      </td>

      {/* KEV Count */}
      <td className="px-4 py-3.5">
        <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-bold text-orange-700 dark:border-orange-500/25 dark:bg-orange-500/10 dark:text-orange-300">
          <FiZap className="text-[10px]" />
          {host.kev_count}
        </span>
      </td>

      {/* Ransomware Count */}
      <td className="px-4 py-3.5">
        {ransomwareCount > 0 ? (
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
            <span className="text-[12px] font-bold text-red-600 dark:text-red-400">
              {ransomwareCount}
            </span>
          </div>
        ) : (
          <span className="text-[11px] text-gray-400 dark:text-white/30">—</span>
        )}
      </td>

      {/* Arrow */}
      <td className="px-4 py-3.5 text-right">
        <FiChevronRight className="ml-auto text-[15px] text-gray-400 transition-transform group-hover:translate-x-0.5 group-hover:text-red-500 dark:text-white/30 dark:group-hover:text-red-400" />
      </td>
    </tr>
  );
};

// ===========================
// Main Page
// ===========================

const ThreatIntelligence: React.FC = () => {
  const navigate = useNavigate();

  const [summary, setSummary] = useState<KEVSummaryDTO | null>(null);
  const [syncStatus, setSyncStatus] = useState<KEVSyncStatusDTO | null>(null);
  const [catalog, setCatalog] = useState<KEVEntryDTO[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<"scans" | "catalog">("scans");
  const [search, setSearch] = useState("");
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

  const handleSync = async () => {
    setSyncing(true);
    const ok = await TriggerKEVSync();
    if (ok) {
      message.success("KEV sync started — data will update in ~30 seconds");
      setTimeout(() => {
        void fetchAll();
        setSyncing(false);
      }, 35000);
    } else {
      message.error("Failed to trigger KEV sync");
      setSyncing(false);
    }
  };

  const handleHostClick = (host: KEVByHost) => {
    navigate(
      `/admin/threat-intelligence/detail/${encodeURIComponent(host.host_ip)}`,
      { state: { host, summary } }
    );
  };

  // Filter catalog
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

  // Format sync time
  const lastSyncText = useMemo(() => {
    const at = syncStatus?.last_sync_at || summary?.last_synced_at || "";
    if (!at) return "Not synced yet";
    try {
      return new Date(at).toLocaleString("th-TH", {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return at;
    }
  }, [syncStatus, summary]);

  const kevByHostList = summary?.kev_by_host ?? [];

  return (
    <div className="w-full px-1 py-3 sm:px-2 sm:py-4 lg:px-2.5 xl:px-3">
      {/* Background glows */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-[8%] top-20 h-72 w-72 rounded-full bg-red-500/8 blur-[100px]" />
        <div className="absolute right-[12%] top-40 h-64 w-64 rounded-full bg-orange-500/7 blur-[90px]" />
      </div>

      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-2xl border border-red-200 bg-red-50 text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
              <FiZap className="text-[16px]" />
            </div>
            <div>
              <h1 className="text-[18px] font-extrabold text-[#1f2240] dark:text-white/90 sm:text-[20px]">
                Threat Intelligence
              </h1>
              <p className="text-[10.5px] text-gray-500 dark:text-white/45">
                CISA KEV Catalog · Known Exploited Vulnerabilities
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[10px] text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-white/55">
            <FiClock className="text-[11px]" />
            <span>Last sync: {lastSyncText}</span>
          </div>
          <button
            type="button"
            onClick={() => void handleSync()}
            disabled={syncing || (syncStatus?.is_syncing ?? false)}
            className={[
              "inline-flex items-center gap-2 rounded-2xl border px-3.5 py-2 text-[12px] font-semibold transition-all",
              "border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100",
              "dark:border-cyan-500/20 dark:bg-cyan-500/10 dark:text-cyan-300 dark:hover:bg-cyan-500/15",
              syncing || syncStatus?.is_syncing ? "cursor-not-allowed opacity-60" : "",
            ].join(" ")}
          >
            <FiRefreshCw
              className={`text-[13px] ${syncing || syncStatus?.is_syncing ? "animate-spin" : ""}`}
            />
            {syncing || syncStatus?.is_syncing ? "Syncing..." : "Sync Now"}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <SummaryCard
          label="KEV in Your Scans"
          value={summary?.total_kev_in_scans ?? 0}
          sub="Actively exploited CVEs found"
          icon={<FiAlertTriangle />}
          accent="red"
          loading={loadingSummary}
          pulse={(summary?.total_kev_in_scans ?? 0) > 0}
        />
        <SummaryCard
          label="Ransomware Related"
          value={summary?.ransomware_related ?? 0}
          sub="Linked to ransomware campaigns"
          icon={<FiZap />}
          accent="orange"
          loading={loadingSummary}
          pulse={(summary?.ransomware_related ?? 0) > 0}
        />
        <SummaryCard
          label="KEV Catalog Size"
          value={syncStatus?.total ?? summary?.total_kev_catalog ?? 0}
          sub="Total entries in CISA catalog"
          icon={<FiDatabase />}
          accent="cyan"
          loading={loadingSummary}
        />
        <SummaryCard
          label="Hosts at Risk"
          value={kevByHostList.length}
          sub="Hosts with active KEV CVEs"
          icon={<FiShield />}
          accent="violet"
          loading={loadingSummary}
        />
      </div>

      {/* KEV Alert Banner */}
      {!loadingSummary && (summary?.total_kev_in_scans ?? 0) > 0 && (
        <div className="mb-5 overflow-hidden rounded-[22px] border border-red-200 bg-linear-to-r from-red-50 via-orange-50 to-white p-4 dark:border-red-500/20 dark:from-red-500/10 dark:via-orange-500/8 dark:to-transparent">
          <div className="flex items-start gap-3">
            <div className="relative mt-0.5 flex h-3.5 w-3.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-red-500" />
            </div>
            <div>
              <div className="text-[13px] font-bold text-red-700 dark:text-red-300">
                ⚠️ {summary!.total_kev_in_scans} Actively Exploited{" "}
                {summary!.total_kev_in_scans === 1 ? "Vulnerability" : "Vulnerabilities"} Found
              </div>
              <div className="mt-0.5 text-[11px] text-red-600/80 dark:text-red-300/70">
                ช่องโหว่เหล่านี้กำลังถูก Hacker exploit อยู่จริงในขณะนี้ ต้องแก้ไขโดยด่วน
                {summary!.ransomware_related > 0 &&
                  ` · ${summary!.ransomware_related} รายการเกี่ยวข้องกับ Ransomware`}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-4 flex gap-2">
        {(["scans", "catalog"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={[
              "rounded-2xl border px-4 py-2 text-[12px] font-semibold transition-all",
              activeTab === tab
                ? "border-transparent bg-linear-to-r from-cyan-500 via-sky-500 to-violet-500 text-white shadow-sm"
                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-white/65 dark:hover:bg-white/8",
            ].join(" ")}
          >
            {tab === "scans"
              ? `KEV in Scans (${summary?.total_kev_in_scans ?? 0})`
              : `Full Catalog (${syncStatus?.total ?? 0})`}
          </button>
        ))}
      </div>

      {/* ── Tab: KEV in Scans (Table) ── */}
      {activeTab === "scans" && (
        <div className="rounded-3xl border border-gray-200/80 bg-white/90 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
          {loadingSummary ? (
            <div className="space-y-2 p-5">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-14 animate-pulse rounded-[18px] bg-gray-100 dark:bg-white/8"
                />
              ))}
            </div>
          ) : kevByHostList.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <div className="grid h-14 w-14 place-items-center rounded-3xl border border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                <FiShield className="text-[22px]" />
              </div>
              <div className="text-[13px] font-semibold text-emerald-700 dark:text-emerald-300">
                No KEV CVEs found in your scans
              </div>
              <div className="text-[11px] text-gray-500 dark:text-white/45">
                Your scanned hosts do not have any actively exploited vulnerabilities in CISA KEV catalog
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-130">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-white/8">
                    <th className="w-10 px-4 py-3 text-left text-[10px] font-semibold uppercase text-gray-400 dark:text-white/30">
                      #
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase text-gray-500 dark:text-white/40">
                      Host / Task
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase text-gray-500 dark:text-white/40">
                      KEV CVEs
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase text-gray-500 dark:text-white/40">
                      Ransomware Active
                    </th>
                    <th className="w-10 px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100/70 dark:divide-white/5">
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
        <div className="rounded-3xl border border-gray-200/80 bg-white/90 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
          {/* Search & Filter */}
          <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-4 py-3 dark:border-white/8">
            <div className="relative min-w-50 flex-1">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-gray-400" />
              <input
                type="text"
                placeholder="ค้นหา CVE, vendor, product..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-8 pr-3 text-[12px] text-gray-700 placeholder-gray-400 outline-none focus:border-cyan-300 dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:placeholder-white/30"
              />
            </div>
            <button
              type="button"
              onClick={() => setRansomwareOnly((p) => !p)}
              className={[
                "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11.5px] font-semibold transition-all",
                ransomwareOnly
                  ? "border-red-300 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300"
                  : "border-gray-200 bg-white text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-white/65",
              ].join(" ")}
            >
              <FiZap className="text-[12px]" />
              Ransomware Only
            </button>
            <span className="text-[11px] text-gray-500 dark:text-white/40">
              {filteredCatalog.length.toLocaleString()} entries
            </span>
          </div>

          {loadingCatalog ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="h-12 animate-pulse rounded-[14px] bg-gray-100 dark:bg-white/8"
                />
              ))}
            </div>
          ) : filteredCatalog.length === 0 ? (
            <div className="py-14 text-center text-[12px] text-gray-500 dark:text-white/45">
              No KEV entries found
            </div>
          ) : (
            <div
              className="overflow-y-auto overflow-x-auto"
              style={{ maxHeight: "calc(100vh - 420px)" }}
            >
              <table className="w-full min-w-160">
                <thead className="sticky top-0 z-10 bg-white dark:bg-[#0f1117]">
                  <tr className="border-b border-gray-100 dark:border-white/8">
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase text-gray-500 dark:text-white/40">
                      CVE ID
                    </th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase text-gray-500 dark:text-white/40">
                      Vulnerability
                    </th>
                    <th className="hidden px-4 py-2.5 text-left text-[10px] font-semibold uppercase text-gray-500 dark:text-white/40 md:table-cell">
                      Tags
                    </th>
                    <th className="hidden px-4 py-2.5 text-left text-[10px] font-semibold uppercase text-gray-500 dark:text-white/40 lg:table-cell">
                      Date Added
                    </th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase text-gray-500 dark:text-white/40">
                      Required Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100/60 dark:divide-white/5">
                  {filteredCatalog.slice(0, 200).map((entry, i) => (
                    <KEVRow key={entry.cve_id} entry={entry} index={i} />
                  ))}
                </tbody>
              </table>
              {filteredCatalog.length > 200 && (
                <div className="border-t border-gray-100 px-4 py-3 text-center text-[11px] text-gray-500 dark:border-white/8 dark:text-white/40">
                  Showing first 200 of {filteredCatalog.length.toLocaleString()} entries. Use search to filter.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 flex items-center gap-2 text-[10px] text-gray-400 dark:text-white/30">
        <FiExternalLink className="text-[11px]" />
        <span>Data source: CISA Known Exploited Vulnerabilities Catalog</span>
      </div>
    </div>
  );
};

export default ThreatIntelligence;
