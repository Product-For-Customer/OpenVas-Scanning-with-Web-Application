import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  FiAlertTriangle,
  FiArrowLeft,
  FiCalendar,
  FiServer,
  FiZap,
  FiShield,
} from "react-icons/fi";
import { GetKEVSummary, type KEVByHost, type KEVEntryDTO } from "../../../services";
import { useLanguage } from "../../../contexts/LanguageContext";
import { useStateContext } from "../../../contexts/ProviderContext";

// ─────────────────────────────────────────────────────────────
// KEV Badge
// ─────────────────────────────────────────────────────────────

const KEVBadge: React.FC<{ isRansomware?: boolean }> = ({ isRansomware }) => (
  <span className={[
    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9.5px] font-bold",
    isRansomware
      ? "border-red-200 bg-red-50 text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300"
      : "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/25 dark:bg-orange-500/10 dark:text-orange-300",
  ].join(" ")}>
    <FiZap className="text-[8px]" />
    {isRansomware ? "RANSOMWARE" : "KEV"}
  </span>
);

// ─────────────────────────────────────────────────────────────
// CVE Card
// ─────────────────────────────────────────────────────────────

const CVECard: React.FC<{ entry: KEVEntryDTO; index: number }> = ({ entry, index }) => {
  const { t } = useLanguage();
  const isRansomware = entry.is_ransomware_related;

  return (
    <div className={[
      "rounded-xl border bg-white p-4 transition hover:shadow-sm dark:bg-white/4",
      isRansomware
        ? "border-red-200 dark:border-red-500/20"
        : "border-slate-200/70 dark:border-white/8",
    ].join(" ")}>

      {/* Header row */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[9.5px] font-bold text-slate-500 dark:bg-white/10 dark:text-white/45">
            {index + 1}
          </span>
          <span className="rounded-full border border-slate-200/70 bg-slate-50 px-2.5 py-0.5 font-mono text-[10.5px] font-bold text-slate-700 dark:border-white/8 dark:bg-white/5 dark:text-white/80">
            {entry.cve_id}
          </span>
          <KEVBadge isRansomware={false} />
          {isRansomware && <KEVBadge isRansomware={true} />}
        </div>

        {entry.date_added && (
          <div className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-white/30">
            <FiCalendar className="text-[10px]" />
            {entry.date_added}
            {entry.due_date && (
              <span className="ml-1.5 font-semibold text-rose-500 dark:text-rose-400">
                Due: {entry.due_date}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Name */}
      <p className="mt-2.5 text-[13px] font-bold leading-snug text-slate-800 dark:text-white/90">
        {entry.vulnerability_name}
      </p>

      {/* Vendor · Product */}
      <p className="mt-0.5 text-[11px] text-slate-400 dark:text-white/40">
        <span className="font-semibold text-slate-600 dark:text-white/60">{entry.vendor_project}</span>
        {" · "}
        {entry.product}
      </p>

      {/* Description */}
      {entry.short_description && (
        <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-[11.5px] leading-relaxed text-slate-600 dark:border-white/8 dark:bg-white/3 dark:text-white/55">
          {entry.short_description}
        </div>
      )}

      {/* Required Action */}
      {entry.required_action && (
        <div className="mt-3">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-white/30">
            {t("threat.requiredAction")}
          </p>
          <div className={[
            "rounded-xl border p-3 text-[11.5px] leading-relaxed font-medium",
            isRansomware
              ? "border-red-100 bg-red-50/60 text-red-700 dark:border-red-500/15 dark:bg-red-500/8 dark:text-red-300"
              : "border-orange-100 bg-orange-50/60 text-orange-700 dark:border-orange-500/15 dark:bg-orange-500/8 dark:text-orange-300",
          ].join(" ")}>
            {entry.required_action}
          </div>
        </div>
      )}

      {/* Notes */}
      {entry.notes && (
        <div className="mt-2.5">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-white/30">Notes</p>
          <p className="text-[11px] text-slate-500 dark:text-white/45">{entry.notes}</p>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────

const ThreatIntelligenceDetail: React.FC = () => {
  const { t } = useLanguage();
  const { currentColor } = useStateContext();
  const accentGrad = `linear-gradient(135deg, ${currentColor}, color-mix(in srgb, ${currentColor} 65%, #a855f7))`;
  const navigate = useNavigate();
  const { hostIp } = useParams<{ hostIp: string }>();
  const location = useLocation();

  const decodedIp = hostIp ? decodeURIComponent(hostIp) : "";
  const stateHost = (location.state as { host?: KEVByHost } | null)?.host;

  const [host, setHost]               = useState<KEVByHost | null>(stateHost ?? null);
  const [loading, setLoading]         = useState(!stateHost);
  const [filterRansomware, setFilterRansomware] = useState(false);

  const hasFetched = useRef(false);

  useEffect(() => {
    if (stateHost || hasFetched.current) return;
    hasFetched.current = true;
    const fetchHost = async () => {
      setLoading(true);
      const summary = await GetKEVSummary();
      if (summary?.kev_by_host) {
        const found = summary.kev_by_host.find(h => h.host_ip === decodedIp) ?? null;
        setHost(found);
      }
      setLoading(false);
    };
    void fetchHost();
  }, [decodedIp, stateHost]);

  const cveList: KEVEntryDTO[]  = host?.cve_list ?? [];
  const ransomwareList          = cveList.filter(c => c.is_ransomware_related);
  const displayList             = filterRansomware ? ransomwareList : cveList;

  return (
    <div className="w-full space-y-5 py-3 sm:py-4">

      {/* ── Back button ── */}
      <button
        type="button"
        onClick={() => navigate("/admin/threat-intelligence")}
        className="flex h-9 items-center gap-2 rounded-lg border border-slate-200/70 bg-white px-3 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/8"
      >
        <FiArrowLeft className="text-[12px]" />
        {t("threat.backToThreat")}
      </button>

      {/* ── Loading ── */}
      {loading && (
        <div className="space-y-4">
          <div className="h-28 animate-pulse rounded-xl border border-slate-200/70 bg-slate-50 dark:border-white/8 dark:bg-white/4" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-44 animate-pulse rounded-xl border border-slate-200/70 bg-slate-50 dark:border-white/8 dark:bg-white/4" />
            ))}
          </div>
        </div>
      )}

      {/* ── Not found ── */}
      {!loading && !host && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-slate-200/70 bg-white py-16 dark:border-white/8 dark:bg-white/4">
          <div className="grid h-12 w-12 place-items-center rounded-xl border border-slate-200/70 bg-slate-50 text-slate-400 dark:border-white/8 dark:bg-white/5 dark:text-white/25">
            <FiShield className="text-[20px]" />
          </div>
          <p className="text-[13px] font-semibold text-slate-600 dark:text-white/55">Host not found</p>
          <p className="text-[11px] text-slate-400 dark:text-white/30">
            {decodedIp} — no KEV data available
          </p>
          <button
            type="button"
            onClick={() => navigate("/admin/threat-intelligence")}
            className="mt-1 flex items-center gap-2 rounded-lg border border-slate-200/70 bg-white px-4 py-2 text-[12px] font-medium text-slate-600 hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/55"
          >
            <FiArrowLeft className="text-[11px]" />
            Back
          </button>
        </div>
      )}

      {/* ── Host found ── */}
      {!loading && host && (
        <>
          {/* Host header card */}
          <div className="rounded-xl border border-slate-200/70 bg-white p-5 dark:border-white/8 dark:bg-[#0d0b1a]/80">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200/70 bg-slate-50 text-slate-600 dark:border-white/8 dark:bg-white/5 dark:text-white/55">
                  <FiServer className="text-[18px]" />
                </div>
                <div>
                  <p className="font-mono text-[20px] font-bold text-slate-900 dark:text-white">
                    {host.host_ip}
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-slate-400 dark:text-white/40">
                    {host.task_name || "Unknown Task"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-[11.5px] font-bold text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-300">
                  <FiZap className="text-[11px]" />
                  {host.kev_count} KEV CVEs
                </span>
                {ransomwareList.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-[11.5px] font-bold text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                    </span>
                    {ransomwareList.length} Ransomware
                  </span>
                )}
              </div>
            </div>

            {/* Ransomware alert */}
            {ransomwareList.length > 0 && (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-100 bg-red-50/60 p-3 dark:border-red-500/15 dark:bg-red-500/8">
                <FiAlertTriangle className="mt-0.5 shrink-0 text-[13px] text-red-600 dark:text-red-300" />
                <p className="text-[11.5px] text-red-700 dark:text-red-300">
                  <span className="font-bold">{ransomwareList.length} ช่องโหว่</span>{" "}
                  เกี่ยวข้องกับ Ransomware campaign ที่กำลัง active — ต้องแก้ไขโดยด่วน
                </p>
              </div>
            )}
          </div>

          {/* Filter bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-[13px] font-semibold text-slate-700 dark:text-white/80">
                KEV Vulnerabilities
              </h2>
              <span className="rounded-full border border-slate-200/70 bg-slate-50 px-2.5 py-0.5 text-[10.5px] font-medium text-slate-500 dark:border-white/8 dark:bg-white/5 dark:text-white/40">
                {displayList.length} shown
              </span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFilterRansomware(false)}
                style={!filterRansomware ? { background: accentGrad } : undefined}
                className={[
                  "rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-all",
                  !filterRansomware
                    ? "border-transparent text-white"
                    : "border-slate-200/70 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/60",
                ].join(" ")}
              >
                All ({cveList.length})
              </button>
              {ransomwareList.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterRansomware(true)}
                  className={[
                    "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-all",
                    filterRansomware
                      ? "border-red-300 bg-red-500 text-white"
                      : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300",
                  ].join(" ")}
                >
                  <FiZap className="text-[10px]" />
                  Ransomware ({ransomwareList.length})
                </button>
              )}
            </div>
          </div>

          {/* CVE grid */}
          {displayList.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-slate-200/70 bg-white py-14 dark:border-white/8 dark:bg-white/4">
              <FiShield className="text-[22px] text-slate-300 dark:text-white/20" />
              <p className="text-[12px] text-slate-400 dark:text-white/35">No CVEs to display</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {displayList.map((entry, i) => (
                <CVECard key={entry.cve_id} entry={entry} index={i} />
              ))}
            </div>
          )}

          {/* Footer summary */}
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 dark:text-white/30">
            <span>{cveList.length} total KEV</span>
            {ransomwareList.length > 0 && (
              <>
                <span>·</span>
                <span className="text-red-500 dark:text-red-400">{ransomwareList.length} ransomware</span>
              </>
            )}
            <span>·</span>
            <span className="font-mono">{host.host_ip}</span>
            {host.task_name && <><span>·</span><span>{host.task_name}</span></>}
          </div>
        </>
      )}
    </div>
  );
};

export default ThreatIntelligenceDetail;
