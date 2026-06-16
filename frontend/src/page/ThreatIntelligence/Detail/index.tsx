import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  FiAlertTriangle,
  FiArrowLeft,
  FiCalendar,
  FiServer,
  FiZap,
  FiShield,
  FiRefreshCw,
} from "react-icons/fi";
import { GetKEVSummary, type KEVByHost, type KEVEntryDTO } from "../../../services";

// ===========================
// KEV Badge
// ===========================

const KEVBadge: React.FC<{ isRansomware?: boolean }> = ({ isRansomware }) => (
  <span
    className={[
      "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold",
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
// Severity Chip
// ===========================

const SeverityBadge: React.FC<{ label: string; color: "red" | "orange" | "yellow" | "gray" }> = ({
  label,
  color,
}) => {
  const cls = {
    red: "border-red-200 bg-red-50 text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300",
    orange: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/25 dark:bg-orange-500/10 dark:text-orange-300",
    yellow: "border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-500/25 dark:bg-yellow-500/10 dark:text-yellow-300",
    gray: "border-gray-200 bg-gray-50 text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-white/55",
  }[color];
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9.5px] font-semibold ${cls}`}>
      {label}
    </span>
  );
};

// ===========================
// CVE Detail Card
// ===========================

const CVECard: React.FC<{ entry: KEVEntryDTO; index: number }> = ({ entry, index }) => {
  const isRansomware = entry.is_ransomware_related;

  return (
    <div
      className={[
        "overflow-hidden rounded-[20px] border transition-shadow hover:shadow-md",
        isRansomware
          ? "border-red-200/80 dark:border-red-500/20"
          : "border-orange-200/70 dark:border-orange-500/15",
        "bg-white dark:bg-white/4",
      ].join(" ")}
    >
      {/* Card top stripe */}
      <div
        className={[
          "h-0.5 w-full",
          isRansomware
            ? "bg-linear-to-r from-red-400 to-orange-400"
            : "bg-linear-to-r from-orange-300 to-amber-300",
        ].join(" ")}
      />

      <div className="p-4">
        {/* Header row */}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {/* Index circle */}
            <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-500 dark:bg-white/10 dark:text-white/50">
              {index + 1}
            </div>
            {/* CVE ID pill */}
            <span className="rounded-full border border-gray-200 bg-white px-2.5 py-0.5 font-mono text-[11px] font-bold text-gray-800 dark:border-white/10 dark:bg-white/5 dark:text-white/85">
              {entry.cve_id}
            </span>
            <KEVBadge isRansomware={false} />
            {isRansomware && <KEVBadge isRansomware={true} />}
          </div>

          {/* Date */}
          {entry.date_added && (
            <div className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-white/30">
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

        {/* Vulnerability name */}
        <div className="mt-2.5 text-[13px] font-bold leading-snug text-[#1f2240] dark:text-white/90">
          {entry.vulnerability_name}
        </div>

        {/* Vendor / Product */}
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-white/45">
          <span className="font-semibold text-gray-700 dark:text-white/65">{entry.vendor_project}</span>
          <span>·</span>
          <span>{entry.product}</span>
        </div>

        {/* Description */}
        {entry.short_description && (
          <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50/70 p-3 text-[11.5px] leading-relaxed text-gray-600 dark:border-white/8 dark:bg-white/3 dark:text-white/60">
            {entry.short_description}
          </div>
        )}

        {/* Required Action */}
        {entry.required_action && (
          <div className="mt-3">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-white/35">
              Required Action
            </div>
            <div
              className={[
                "rounded-xl border p-3 text-[11.5px] leading-relaxed font-medium",
                isRansomware
                  ? "border-red-100 bg-red-50/60 text-red-700 dark:border-red-500/15 dark:bg-red-500/8 dark:text-red-300"
                  : "border-orange-100 bg-orange-50/60 text-orange-700 dark:border-orange-500/15 dark:bg-orange-500/8 dark:text-orange-300",
              ].join(" ")}
            >
              {entry.required_action}
            </div>
          </div>
        )}

        {/* Notes */}
        {entry.notes && (
          <div className="mt-2.5">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-white/35">
              Notes
            </div>
            <div className="text-[11px] text-gray-600 dark:text-white/55">{entry.notes}</div>
          </div>
        )}
      </div>
    </div>
  );
};

// ===========================
// Main Page
// ===========================

const ThreatIntelligenceDetail: React.FC = () => {
  const navigate = useNavigate();
  const { hostIp } = useParams<{ hostIp: string }>();
  const location = useLocation();

  const decodedIp = hostIp ? decodeURIComponent(hostIp) : "";

  // Try to get host data from navigation state first
  const stateHost = (location.state as { host?: KEVByHost } | null)?.host;

  const [host, setHost] = useState<KEVByHost | null>(stateHost ?? null);
  const [loading, setLoading] = useState(!stateHost);
  const [filterRansomware, setFilterRansomware] = useState(false);

  const hasFetched = useRef(false);

  useEffect(() => {
    if (stateHost || hasFetched.current) return;
    hasFetched.current = true;

    const fetchHost = async () => {
      setLoading(true);
      const summary = await GetKEVSummary();
      if (summary?.kev_by_host) {
        const found = summary.kev_by_host.find((h) => h.host_ip === decodedIp) ?? null;
        setHost(found);
      }
      setLoading(false);
    };
    void fetchHost();
  }, [decodedIp, stateHost]);

  const cveList: KEVEntryDTO[] = host?.cve_list ?? [];
  const ransomwareList = cveList.filter((c) => c.is_ransomware_related);
  const displayList = filterRansomware ? ransomwareList : cveList;

  return (
    <div className="w-full px-1 py-3 sm:px-2 sm:py-4 lg:px-2.5 xl:px-3">
      {/* Background glows */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-[5%] top-24 h-64 w-64 rounded-full bg-red-500/8 blur-[100px]" />
        <div className="absolute right-[10%] top-32 h-56 w-56 rounded-full bg-orange-500/6 blur-[90px]" />
      </div>

      {/* Back Button */}
      <button
        type="button"
        onClick={() => navigate("/admin/threat-intelligence")}
        className="mb-4 inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3.5 py-2 text-[12px] font-semibold text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-white/65 dark:hover:bg-white/8"
      >
        <FiArrowLeft className="text-[13px]" />
        Threat Intelligence
      </button>

      {/* Loading */}
      {loading && (
        <div className="space-y-4">
          <div className="h-28 animate-pulse rounded-3xl border border-gray-200 bg-white dark:border-white/10 dark:bg-white/5" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-44 animate-pulse rounded-[20px] border border-gray-200 bg-white dark:border-white/10 dark:bg-white/5"
              />
            ))}
          </div>
        </div>
      )}

      {/* Not found */}
      {!loading && !host && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-gray-200/80 bg-white/90 py-20 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
          <div className="grid h-14 w-14 place-items-center rounded-3xl border border-gray-200 bg-gray-50 text-gray-400 dark:border-white/10 dark:bg-white/5 dark:text-white/30">
            <FiShield className="text-[22px]" />
          </div>
          <div className="text-[13px] font-semibold text-gray-600 dark:text-white/60">
            Host not found
          </div>
          <div className="text-[11px] text-gray-400 dark:text-white/35">
            {decodedIp} — no KEV data available for this host
          </div>
          <button
            type="button"
            onClick={() => navigate("/admin/threat-intelligence")}
            className="mt-1 inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-[12px] font-semibold text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-white/60"
          >
            <FiArrowLeft className="text-[12px]" />
            Back
          </button>
        </div>
      )}

      {/* Host found */}
      {!loading && host && (
        <>
          {/* Host Header Card */}
          <div className="mb-5 overflow-hidden rounded-3xl border border-gray-200/80 bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
            {/* Top stripe */}
            <div className="h-1 w-full bg-linear-to-r from-red-400 via-orange-400 to-amber-300" />

            <div className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl border border-red-200 bg-red-50 text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                    <FiServer className="text-[20px]" />
                  </div>
                  <div>
                    <div className="font-mono text-[20px] font-extrabold text-[#1f2240] dark:text-white/90">
                      {host.host_ip}
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-gray-500 dark:text-white/45">
                      {host.task_name || "Unknown Task"}
                    </div>
                  </div>
                </div>

                {/* Stats pills */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-[11.5px] font-bold text-orange-700 dark:border-orange-500/25 dark:bg-orange-500/10 dark:text-orange-300">
                    <FiZap className="text-[11px]" />
                    {host.kev_count} KEV CVEs
                  </span>
                  {ransomwareList.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-[11.5px] font-bold text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
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
                  <div className="text-[11.5px] text-red-700 dark:text-red-300">
                    <span className="font-bold">{ransomwareList.length} ช่องโหว่</span> เกี่ยวข้องกับ Ransomware campaign
                    ที่กำลัง active อยู่ — ต้องแก้ไขโดยด่วนที่สุด
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Filter bar */}
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-[14px] font-bold text-[#1f2240] dark:text-white/85">
              KEV Vulnerabilities
              <span className="ml-2 text-[12px] font-normal text-gray-500 dark:text-white/40">
                ({displayList.length} shown)
              </span>
            </h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFilterRansomware(false)}
                className={[
                  "rounded-xl border px-3 py-1.5 text-[11.5px] font-semibold transition-all",
                  !filterRansomware
                    ? "border-transparent bg-linear-to-r from-cyan-500 to-sky-500 text-white shadow-sm"
                    : "border-gray-200 bg-white text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-white/65",
                ].join(" ")}
              >
                All ({cveList.length})
              </button>
              {ransomwareList.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterRansomware(true)}
                  className={[
                    "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11.5px] font-semibold transition-all",
                    filterRansomware
                      ? "border-transparent bg-linear-to-r from-red-500 to-orange-500 text-white shadow-sm"
                      : "border-red-200 bg-red-50 text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300",
                  ].join(" ")}
                >
                  <FiZap className="text-[10px]" />
                  Ransomware ({ransomwareList.length})
                </button>
              )}
            </div>
          </div>

          {/* CVE Cards Grid */}
          {displayList.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-gray-200/80 bg-white/90 py-16 shadow-sm dark:border-white/10 dark:bg-white/5">
              <FiRefreshCw className="text-[22px] text-gray-400 dark:text-white/30" />
              <div className="text-[12px] text-gray-500 dark:text-white/45">No CVEs to display</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {displayList.map((entry, i) => (
                <CVECard key={entry.cve_id} entry={entry} index={i} />
              ))}
            </div>
          )}

          {/* Summary footer */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <SeverityBadge
              label={`${cveList.length} Total KEV`}
              color="orange"
            />
            {ransomwareList.length > 0 && (
              <SeverityBadge
                label={`${ransomwareList.length} Ransomware`}
                color="red"
              />
            )}
            <SeverityBadge
              label={`Host: ${host.host_ip}`}
              color="gray"
            />
            <SeverityBadge
              label={`Task: ${host.task_name || "—"}`}
              color="gray"
            />
          </div>
        </>
      )}
    </div>
  );
};

export default ThreatIntelligenceDetail;
