import React, { useEffect, useRef, useState } from "react";
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
  ListKEVCatalogPaged,
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
  <span className="inline-block h-5.5 w-12 animate-pulse rounded-lg bg-slate-100 dark:bg-white/10" />
);

// Linkify แปลง URL ในข้อความให้เป็นลิงก์กดได้ (ใช้กับ Notes ของ KEV ที่มักมีหลาย URL)
const Linkify: React.FC<{ text: string }> = ({ text }) => {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (!/^https?:\/\//.test(part)) return <React.Fragment key={i}>{part}</React.Fragment>;
        // แยกเครื่องหมายวรรคตอนท้าย URL ออก ไม่ให้ติดไปในลิงก์
        const trail = part.match(/[.,;:)\]]+$/)?.[0] ?? "";
        const url = trail ? part.slice(0, part.length - trail.length) : part;
        return (
          <React.Fragment key={i}>
            <a href={url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
              className="wrap-break-word text-blue-600 hover:underline dark:text-blue-400">
              {url}
            </a>
            {trail}
          </React.Fragment>
        );
      })}
    </>
  );
};

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
  <div
    className="group relative overflow-hidden rounded-xl border bg-white px-3.5 py-3 shadow-sm transition-all duration-300 hover:-translate-y-0.5 dark:bg-[#0d0b1a]/80"
    style={{
      borderColor: `${iconColor}55`,
      boxShadow: `0 6px 14px -12px ${iconColor}60`,
    }}
  >
    {/* corner glow */}
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
      <p className="text-[10.5px] font-bold tracking-wide text-slate-600 dark:text-white/55">
        {label}
      </p>
      <span
        className="relative flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-lg text-[12px] transition-transform duration-300 group-hover:scale-110"
        style={{
          backgroundColor: `${iconColor}1c`,
          color: iconColor,
        }}
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

const KEVBadge: React.FC<{ isRansomware?: boolean }> = ({ isRansomware }) => {
  const { t } = useLanguage();
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9.5px] font-bold",
        isRansomware
          ? "border-red-200 bg-red-50 text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300"
          : "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/25 dark:bg-orange-500/10 dark:text-orange-300",
      ].join(" ")}
    >
      <FiZap className="text-[9px]" />
      {isRansomware ? t("threat.badgeRansomware") : t("threat.badgeKev")}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────
// KEV Table Row (Full Catalog)
// ─────────────────────────────────────────────────────────────

const KEVRow: React.FC<{ entry: KEVEntryDTO; index: number }> = ({ entry }) => {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        className="border-b border-slate-100 cursor-pointer transition-colors hover:bg-slate-50/70 dark:border-white/6 dark:hover:bg-white/3"
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
              {t("threat.due", { date: entry.due_date })}
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
        <tr className="border-b border-slate-100 dark:border-white/6">
          <td colSpan={5} className="px-4 pb-4 pt-0">
            <div className="rounded-xl border border-slate-200/70 bg-white p-3.5 dark:border-white/8 dark:bg-white/4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-white/35">
                    {t("common.description")}
                  </p>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-slate-600 dark:text-white/70">
                    {entry.short_description || t("threat.noDescription")}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-white/35">
                    {t("threat.requiredAction")}
                  </p>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-slate-600 dark:text-white/70">
                    {entry.required_action || t("threat.notAvailable")}
                  </p>
                  {entry.notes && (
                    <>
                      <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-white/35">
                        {t("threat.notes")}
                      </p>
                      <p className="mt-1 wrap-break-word text-[11px] text-slate-500 dark:text-white/55">
                        <Linkify text={entry.notes} />
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
// Host KEV Row — one KEV CVE on a host, expandable to full detail
// ─────────────────────────────────────────────────────────────

const HostKEVRow: React.FC<{ entry: KEVEntryDTO }> = ({ entry }) => {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const accent = entry.is_ransomware_related ? "#dc2626" : "#f97316";

  return (
    <>
      <tr onClick={() => setOpen((p) => !p)} className="cursor-pointer border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/70 dark:border-white/6 dark:hover:bg-white/3">
        {/* CVE */}
        <td className="px-3 py-2.5">
          <a href={`https://nvd.nist.gov/vuln/detail/${entry.cve_id}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-slate-700 hover:underline dark:text-white/80">
            {entry.cve_id}
            <FiExternalLink className="text-[8px] opacity-50" />
          </a>
        </td>
        {/* Vulnerability name + vendor/product */}
        <td className="px-3 py-2.5">
          <p className="max-w-65 truncate text-[11.5px] font-medium text-slate-700 dark:text-white/75" title={entry.vulnerability_name}>{entry.vulnerability_name || "—"}</p>
          <p className="text-[10px] text-slate-400 dark:text-white/35">{entry.vendor_project} · {entry.product}</p>
        </td>
        {/* Tags */}
        <td className="px-3 py-2.5">
          <div className="flex flex-wrap gap-1.5">
            <KEVBadge isRansomware={false} />
            {entry.is_ransomware_related && <KEVBadge isRansomware={true} />}
          </div>
        </td>
        {/* Date added / due */}
        <td className="hidden px-3 py-2.5 text-[10.5px] text-slate-500 dark:text-white/45 lg:table-cell">
          <div className="flex items-center gap-1.5"><FiCalendar className="text-[10px]" />{entry.date_added || "—"}</div>
          {entry.due_date && <div className="mt-0.5 text-[10px] text-rose-600 dark:text-rose-400">{t("threat.due", { date: entry.due_date })}</div>}
        </td>
        {/* chevron */}
        <td className="px-3 py-2.5 text-right">
          <FiChevronRight className={`ml-auto text-[12px] text-slate-400 transition-transform dark:text-white/30 ${open ? "rotate-90" : ""}`} />
        </td>
      </tr>
      {open && (
        <tr className="border-b border-slate-100 last:border-0 dark:border-white/6">
          <td colSpan={5} className="bg-slate-50/50 px-3 pb-3.5 pt-0 dark:bg-white/2">
            <div className="rounded-xl border border-slate-200/70 bg-white p-3.5 dark:border-white/8 dark:bg-white/4">
              {/* full vulnerability name (row above is truncated) */}
              <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-slate-100 pb-2.5 dark:border-white/8">
                <span className="font-mono text-[11px] font-bold" style={{ color: accent }}>{entry.cve_id}</span>
                <span className="text-[12.5px] font-semibold text-slate-800 dark:text-white/85">{entry.vulnerability_name || "—"}</span>
              </div>
              {/* meta strip */}
              <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[10.5px]">
                <span className="text-slate-400 dark:text-white/35">{t("threat.colVendor")}: <span className="font-semibold text-slate-600 dark:text-white/70">{entry.vendor_project || "—"}</span></span>
                <span className="text-slate-400 dark:text-white/35">{t("threat.colProduct")}: <span className="font-semibold text-slate-600 dark:text-white/70">{entry.product || "—"}</span></span>
                <span className="text-slate-400 dark:text-white/35">{t("threat.colDateAdded")}: <span className="font-semibold text-slate-600 dark:text-white/70">{entry.date_added || "—"}</span></span>
                {entry.due_date && <span className="text-slate-400 dark:text-white/35">{t("threat.due", { date: entry.due_date })}</span>}
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-white/35">{t("common.description")}</p>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-slate-600 dark:text-white/70">{entry.short_description || t("threat.noDescription")}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-white/35">{t("threat.requiredAction")}</p>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-slate-600 dark:text-white/70">{entry.required_action || t("threat.notAvailable")}</p>
                  {entry.notes && (
                    <>
                      <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-white/35">{t("threat.notes")}</p>
                      <p className="mt-1 wrap-break-word text-[11px] text-slate-500 dark:text-white/55"><Linkify text={entry.notes} /></p>
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
// Host Scan Row — expandable to an inline KEV CVE table (no navigation)
// ─────────────────────────────────────────────────────────────

const HostScanRow: React.FC<{ host: KEVByHost; index: number }> = ({ host, index }) => {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const ransomwareCount = host.cve_list.filter((c) => c.is_ransomware_related).length;
  // Ransomware-linked CVEs first, then most recently added
  const sortedCves = host.cve_list
    .slice()
    .sort((a, b) =>
      Number(b.is_ransomware_related) - Number(a.is_ransomware_related) ||
      (b.date_added || "").localeCompare(a.date_added || "")
    );

  return (
    <>
      <tr onClick={() => setExpanded((p) => !p)} className="group border-b border-slate-100 cursor-pointer transition-colors hover:bg-slate-50/70 dark:border-white/6 dark:hover:bg-white/3">
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
          <FiChevronRight className={`ml-auto text-[14px] text-slate-400 transition-transform dark:text-white/30 ${expanded ? "rotate-90" : ""}`} />
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-slate-100 dark:border-white/6">
          <td colSpan={5} className="px-4 pb-4 pt-0">
            <div className="overflow-hidden rounded-xl border border-slate-200/70 bg-white dark:border-white/8 dark:bg-white/4">
              {/* panel header: which host / task these KEV CVEs belong to */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-slate-100 bg-slate-50/60 px-3.5 py-2.5 dark:border-white/8 dark:bg-white/3">
                <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-slate-700 dark:text-white/80">
                  <FiServer className="text-[11px] text-slate-400" />
                  <span className="font-mono">{host.host_ip || "—"}</span>
                </span>
                <span className="text-[10.5px] text-slate-400 dark:text-white/35">{t("threat.task")}: {host.task_name || "—"}</span>
                <span className="text-[10.5px] text-slate-400 dark:text-white/35">{t("threat.colKevCves")}: {host.kev_count}</span>
                {ransomwareCount > 0 && (
                  <span className="text-[10.5px] font-semibold text-red-600 dark:text-red-400">{t("threat.ransomwareCount", { n: ransomwareCount })}</span>
                )}
                <span className="ml-auto text-[10px] text-slate-400 dark:text-white/30">{t("threat.clickRowHint")}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-160">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-white/8">
                      {[t("threat.cveId"), t("threat.colVulnerability"), t("threat.colTags"), t("threat.colDateAdded"), ""].map((h, i) => (
                        <th key={i} className={["px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/35", i === 3 ? "hidden lg:table-cell" : "", i === 4 ? "w-8" : ""].join(" ")}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedCves.map((entry, i) => <HostKEVRow key={`${entry.cve_id}-${i}`} entry={entry} />)}
                  </tbody>
                </table>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────

const ThreatIntelligence: React.FC = () => {
  const { t } = useLanguage();
  const { currentColor } = useStateContext();
  const accentGrad = `linear-gradient(135deg, ${currentColor}, color-mix(in srgb, ${currentColor} 65%, #a855f7))`;

  const [summary, setSummary]         = useState<KEVSummaryDTO | null>(null);
  const [syncStatus, setSyncStatus]   = useState<KEVSyncStatusDTO | null>(null);
  const [catalog, setCatalog]         = useState<KEVEntryDTO[]>([]);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [activeTab, setActiveTab]     = useState<"scans" | "catalog">("scans");
  const [search, setSearch]           = useState("");
  const [ransomwareOnly, setRansomwareOnly] = useState(false);
  const [scansPage, setScansPage]     = useState(1);
  const [catalogPage, setCatalogPage] = useState(1);
  const PAGE_SIZE = 5;

  const hasFetched = useRef(false);

  // Summary + sync status only (the heavy KEV-in-scans data). The catalog is
  // fetched separately, one page at a time.
  const fetchMeta = async () => {
    setLoadingSummary(true);
    const [summaryData, statusData] = await Promise.all([
      GetKEVSummary(),
      GetKEVSyncStatus(),
    ]);
    setSummary(summaryData);
    setSyncStatus(statusData);
    setLoadingSummary(false);
  };

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    void fetchMeta();
  }, []);

  // Reset to the first page whenever the filters change.
  useEffect(() => { setCatalogPage(1); }, [search, ransomwareOnly]);

  // Server-side catalog fetch — one page at a time, debounced so typing in the
  // search box doesn't fire a request per keystroke. Search now spans the whole
  // catalog in the DB rather than a client-side slice of a preloaded list.
  useEffect(() => {
    const h = setTimeout(async () => {
      setLoadingCatalog(true);
      const { items, total } = await ListKEVCatalogPaged({
        search: search.trim() || undefined,
        ransomware_only: ransomwareOnly,
        limit: PAGE_SIZE,
        offset: (catalogPage - 1) * PAGE_SIZE,
      });
      setCatalog(items);
      setCatalogTotal(total);
      setLoadingCatalog(false);
    }, 300);
    return () => clearTimeout(h);
  }, [search, ransomwareOnly, catalogPage]);

  const kevByHostList = summary?.kev_by_host ?? [];
  const scansTotalPages   = Math.max(1, Math.ceil(kevByHostList.length / PAGE_SIZE));
  const pagedScans        = kevByHostList.slice((scansPage - 1) * PAGE_SIZE, scansPage * PAGE_SIZE);
  const catalogTotalPages = Math.max(1, Math.ceil(catalogTotal / PAGE_SIZE));
  const pagedCatalog      = catalog;

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
                {t("threat.kicker")}
              </p>
              <h1 className="truncate text-[18px] font-bold text-slate-900 sm:text-[20px] dark:text-white/90">
                {t("threat.title")}
              </h1>
              <p className="mt-0.5 truncate text-[11px] text-slate-500 sm:text-[12px] dark:text-white/45">
                {t("threat.catalogSubtitle")}
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
                {t("threat.activelyExploited", { n: summary!.total_kev_in_scans })}
              </span>
              {summary!.ransomware_related > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-[10.5px] font-semibold text-orange-700 dark:border-orange-500/25 dark:bg-orange-500/10 dark:text-orange-300">
                  <FiZap className="text-[10px]" />
                  {t("threat.ransomwareCount", { n: summary!.ransomware_related })}
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
          sub={t("threat.subActivelyExploited")}
          icon={<FiAlertTriangle />}
          iconColor="#ef4444"
          loading={loadingSummary}
          pulse={(summary?.total_kev_in_scans ?? 0) > 0}
        />
        <SummaryCard
          label={t("threat.exploitedInWild")}
          value={summary?.ransomware_related ?? 0}
          sub={t("threat.subRansomwareLinked")}
          icon={<FiZap />}
          iconColor="#f97316"
          loading={loadingSummary}
          pulse={(summary?.ransomware_related ?? 0) > 0}
        />
        <SummaryCard
          label={t("threat.lastSync")}
          value={syncStatus?.total ?? summary?.total_kev_catalog ?? 0}
          sub={t("threat.subTotalEntries")}
          icon={<FiDatabase />}
          iconColor="#06b6d4"
          loading={loadingSummary}
        />
        <SummaryCard
          label={t("threat.hostsAtRisk")}
          value={kevByHostList.length}
          sub={t("threat.subHostsAtRisk")}
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
              "rounded-lg border px-4 py-2 text-[12px] font-bold transition-all",
              activeTab === tab
                ? "border-transparent text-white"
                : "border-slate-200/70 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/8",
            ].join(" ")}
          >
            {tab === "scans"
              ? t("threat.tabScans", { n: summary?.total_kev_in_scans ?? 0 })
              : t("threat.tabCatalog", { n: syncStatus?.total ?? 0 })}
          </button>
        ))}
      </div>

      {/* ── Tab: KEV in Scans ── */}
      {activeTab === "scans" && (
        <div className="overflow-hidden rounded-xl border border-slate-200/70 bg-white dark:border-white/8 dark:bg-[#0d0b1a]/80">
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
                {t("threat.emptyScansTitle")}
              </p>
              <p className="text-[11px] text-slate-400 dark:text-white/35">
                {t("threat.emptyScansSub")}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-130">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60 dark:border-white/8 dark:bg-white/3">
                      <th className="whitespace-nowrap w-10 px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/35">#</th>
                      <th className="whitespace-nowrap px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/35">{t("threat.colHostTask")}</th>
                      <th className="whitespace-nowrap px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/35">{t("threat.colKevCves")}</th>
                      <th className="whitespace-nowrap px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/35">{t("threat.colRansomware")}</th>
                      <th className="w-10 px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {pagedScans.map((host, i) => (
                      <HostScanRow
                        key={`${host.host_ip}-${host.task_name}-${i}`}
                        host={host}
                        index={(scansPage - 1) * PAGE_SIZE + i}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5 dark:border-white/8">
                <p className="text-[10.5px] text-slate-400 dark:text-white/30">
                  {t("threat.hostsAtRiskCount", { n: kevByHostList.length })}
                </p>
                {scansTotalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setScansPage((p) => Math.max(1, p - 1))} disabled={scansPage === 1}
                      className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200/70 bg-white text-slate-500 transition hover:bg-slate-50 disabled:opacity-40 dark:border-white/8 dark:bg-white/5 dark:text-white/50">
                      <FiChevronRight className="rotate-180 text-[12px]" />
                    </button>
                    {Array.from({ length: scansTotalPages }, (_, i) => i + 1).map((n) => (
                      <button key={n} type="button" onClick={() => setScansPage(n)}
                        style={n === scansPage ? { background: accentGrad } : undefined}
                        className={["grid h-7 w-7 place-items-center rounded-lg text-[11.5px] font-semibold transition",
                          n === scansPage ? "text-white" : "border border-slate-200/70 bg-white text-slate-500 hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/50",
                        ].join(" ")}>
                        {n}
                      </button>
                    ))}
                    <button type="button" onClick={() => setScansPage((p) => Math.min(scansTotalPages, p + 1))} disabled={scansPage === scansTotalPages}
                      className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200/70 bg-white text-slate-500 transition hover:bg-slate-50 disabled:opacity-40 dark:border-white/8 dark:bg-white/5 dark:text-white/50">
                      <FiChevronRight className="text-[12px]" />
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Tab: Full Catalog ── */}
      {activeTab === "catalog" && (
        <div className="overflow-hidden rounded-xl border border-slate-200/70 bg-white dark:border-white/8 dark:bg-[#0d0b1a]/80">
          {/* Search & Filter */}
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-white/8">
            <div className="relative min-w-48 flex-1">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400" />
              <input
                type="text"
                placeholder={t("threat.searchPlaceholder")}
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
              {t("threat.ransomwareOnly")}
            </button>
          </div>

          {loadingCatalog ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100 dark:bg-white/8" />
              ))}
            </div>
          ) : pagedCatalog.length === 0 ? (
            <div className="py-14 text-center text-[12px] text-slate-400 dark:text-white/35">
              {t("threat.noEntriesFound")}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-160">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60 dark:border-white/8 dark:bg-white/3">
                      {[
                        t("threat.cveId"),
                        t("threat.colVulnerability"),
                        t("threat.colTags"),
                        t("threat.colDateAdded"),
                        t("threat.requiredAction"),
                      ].map((h, i) => (
                        <th
                          key={h}
                          className={[
                            "whitespace-nowrap px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/35",
                            i === 2 ? "hidden md:table-cell" : "",
                            i === 3 ? "hidden lg:table-cell" : "",
                          ].join(" ")}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pagedCatalog.map((entry, i) => (
                      <KEVRow key={entry.cve_id} entry={entry} index={(catalogPage - 1) * PAGE_SIZE + i} />
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-2.5 dark:border-white/8">
                <p className="text-[10.5px] text-slate-400 dark:text-white/30">
                  {t("threat.entriesPage", {
                    n: catalogTotal.toLocaleString(),
                    x: catalogPage,
                    y: catalogTotalPages,
                  })}
                </p>
                {catalogTotalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setCatalogPage((p) => Math.max(1, p - 1))} disabled={catalogPage === 1}
                      className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200/70 bg-white text-slate-500 transition hover:bg-slate-50 disabled:opacity-40 dark:border-white/8 dark:bg-white/5 dark:text-white/50">
                      <FiChevronRight className="rotate-180 text-[12px]" />
                    </button>
                    {(() => {
                      const total = catalogTotalPages;
                      const cur   = catalogPage;
                      const delta = 2;
                      const pages: (number | "…")[] = [];
                      for (let n = 1; n <= total; n++) {
                        if (n === 1 || n === total || (n >= cur - delta && n <= cur + delta)) {
                          pages.push(n);
                        } else if (pages[pages.length - 1] !== "…") {
                          pages.push("…");
                        }
                      }
                      return pages.map((n, idx) =>
                        n === "…" ? (
                          <span key={`ellipsis-${idx}`} className="px-1 text-[11px] text-slate-400 dark:text-white/30">…</span>
                        ) : (
                          <button key={n} type="button" onClick={() => setCatalogPage(n as number)}
                            style={n === cur ? { background: accentGrad } : undefined}
                            className={["grid h-7 w-7 place-items-center rounded-lg text-[11.5px] font-semibold transition",
                              n === cur ? "text-white" : "border border-slate-200/70 bg-white text-slate-500 hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/50",
                            ].join(" ")}>
                            {n}
                          </button>
                        )
                      );
                    })()}
                    <button type="button" onClick={() => setCatalogPage((p) => Math.min(catalogTotalPages, p + 1))} disabled={catalogPage === catalogTotalPages}
                      className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200/70 bg-white text-slate-500 transition hover:bg-slate-50 disabled:opacity-40 dark:border-white/8 dark:bg-white/5 dark:text-white/50">
                      <FiChevronRight className="text-[12px]" />
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Footer ── */}
      <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-white/25">
        <FiExternalLink className="text-[11px]" />
        <span>{t("threat.dataSource")}</span>
      </div>
    </div>
  );
};

export default ThreatIntelligence;
