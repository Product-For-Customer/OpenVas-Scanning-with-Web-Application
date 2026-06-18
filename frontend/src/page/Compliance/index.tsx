import React, { useEffect, useRef, useState } from "react";
import { FiCheckCircle, FiXCircle, FiAlertTriangle, FiRefreshCw } from "react-icons/fi";
import { GetComplianceReport, type ComplianceReportDTO, type FrameworkScore } from "../../services";
import { useLanguage } from "../../contexts/LanguageContext";

// ===========================
// Helpers
// ===========================
const statusIcon = (s: string) => {
  if (s === "compliant")     return <FiCheckCircle className="text-emerald-500" />;
  if (s === "warning")       return <FiAlertTriangle className="text-yellow-500" />;
  return <FiXCircle className="text-red-500" />;
};

const statusBadge = (s: string) => {
  if (s === "compliant")     return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300";
  if (s === "warning")       return "border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-500/25 dark:bg-yellow-500/10 dark:text-yellow-300";
  return "border-red-200 bg-red-50 text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300";
};

const scoreColor = (score: number) => {
  if (score >= 80) return "text-emerald-700 dark:text-emerald-300";
  if (score >= 60) return "text-yellow-700 dark:text-yellow-300";
  return "text-red-700 dark:text-red-300";
};

const scoreRingColor = (score: number) => {
  if (score >= 80) return "stroke-emerald-500";
  if (score >= 60) return "stroke-yellow-500";
  return "stroke-red-500";
};

// ===========================
// Radial Score
// ===========================
const RadialScore: React.FC<{ score: number; label: string }> = ({ score, label }) => {
  const r = 32;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-gray-100 dark:text-white/10" />
        <circle
          cx="40" cy="40" r={r} fill="none" strokeWidth="6"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 40 40)"
          className={scoreRingColor(score)}
        />
        <text x="40" y="44" textAnchor="middle" className={`fill-current ${scoreColor(score)}`} fontSize="16" fontWeight="800">
          {score}
        </text>
      </svg>
      <div className="text-center text-[10.5px] font-semibold text-gray-600 dark:text-white/60">{label}</div>
    </div>
  );
};

// ===========================
// Framework Card
// ===========================
const FrameworkCard: React.FC<{
  fw: FrameworkScore;
  expanded: boolean;
  onToggle: () => void;
}> = ({ fw, expanded, onToggle }) => {
  const { t } = useLanguage();
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/70 bg-white dark:border-white/8 dark:bg-white/4">
      {/* Header */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 p-4 text-left"
      >
        <div className="flex items-center gap-4">
          <RadialScore score={fw.score} label={fw.framework.replace("_", " ")} />
          <div>
            <div className="text-[13px] font-bold text-[#1f2240] dark:text-white/90">{fw.full_name}</div>
            <div className="mt-1 flex flex-wrap gap-2 text-[10.5px]">
              <span className="text-emerald-700 dark:text-emerald-300">✓ {fw.compliant} {t("compliance.compliant")}</span>
              {fw.warning > 0 && <span className="text-yellow-700 dark:text-yellow-300">⚠ {fw.warning} {t("compliance.warning")}</span>}
              {fw.non_compliant > 0 && <span className="text-red-700 dark:text-red-300">✗ {fw.non_compliant} {t("compliance.nonCompliant")}</span>}
            </div>
          </div>
        </div>
        <FiRefreshCw className={`shrink-0 text-[13px] text-gray-400 transition-transform ${expanded ? "rotate-90" : ""}`} />
      </button>

      {/* Controls */}
      {expanded && (
        <div className="border-t border-slate-100 dark:border-white/8">
          {fw.controls.map(ctrl => (
            <div key={ctrl.control_id} className="flex items-start gap-3 border-b border-slate-100/50 px-4 py-3 last:border-0 dark:border-white/5">
              <div className="mt-0.5 shrink-0 text-[15px]">{statusIcon(ctrl.status)}</div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10.5px] font-bold text-gray-700 dark:text-white/80">{ctrl.control_id}</span>
                  <span className="text-[11px] text-gray-600 dark:text-white/65">{ctrl.control_name}</span>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-bold ${statusBadge(ctrl.status)}`}>
                    {ctrl.status.replace("_", " ").toUpperCase()}
                  </span>
                </div>
                <div className="mt-0.5 text-[10.5px] text-gray-500 dark:text-white/45">{ctrl.detail}</div>
              </div>
              {ctrl.violations > 0 && (
                <span className="shrink-0 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
                  {ctrl.violations} violation{ctrl.violations > 1 ? "s" : ""}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ===========================
// Main Page
// ===========================
const Compliance: React.FC = () => {
  const { t } = useLanguage();
  const [report, setReport] = useState<ComplianceReportDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedFW, setExpandedFW] = useState<string>("PCI_DSS");
  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    (async () => {
      setLoading(true);
      const r = await GetComplianceReport();
      setReport(r);
      setLoading(false);
    })();
  }, []);

  const toggleFW = (fw: string) => setExpandedFW(p => p === fw ? "" : fw);

  return (
    <div className="w-full py-3 sm:py-4">

      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[18px] font-bold text-slate-800 dark:text-white sm:text-[20px]">{t("compliance.title")}</h1>
            <span className="rounded-full border border-slate-200/70 bg-slate-50 px-2.5 py-0.5 text-[10.5px] font-medium text-slate-500 dark:border-white/8 dark:bg-white/5 dark:text-white/40">
              PCI-DSS · ISO 27001 · NIST CSF · CIS Controls
            </span>
          </div>
          {report && (
            <p className="mt-1 text-[11px] text-slate-400 dark:text-white/30">
              Generated: {new Date(report.generated_at).toLocaleDateString("en-GB")}
            </p>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="h-24 animate-pulse rounded-xl border border-slate-200/70 bg-slate-50 dark:border-white/8 dark:bg-white/4" />)}
        </div>
      ) : !report ? (
        <div className="rounded-xl border border-slate-200/70 bg-white py-16 text-center dark:border-white/8 dark:bg-white/4">
          <div className="text-[12px] text-slate-400 dark:text-white/35">Failed to load compliance data</div>
        </div>
      ) : (
        <>
          {/* Overall Score */}
          <div className="mb-5 overflow-hidden rounded-xl border border-slate-200/70 bg-white p-5 dark:border-white/8 dark:bg-[#0d0b1a]/80">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase text-gray-500 dark:text-white/40">Overall Compliance Score</div>
                <div className={`mt-1 text-[40px] font-extrabold ${scoreColor(report.overall_score)}`}>
                  {report.overall_score}<span className="text-[20px]">%</span>
                </div>
                <div className="mt-1 text-[10.5px] text-gray-500 dark:text-white/40">
                  {report.scan_count} scans · Last scan: {report.last_scan_date || "—"}
                </div>
              </div>
              <div className="flex flex-wrap gap-4">
                {report.frameworks.map(fw => (
                  <RadialScore key={fw.framework} score={fw.score} label={fw.framework.replace("_", " ")} />
                ))}
              </div>
            </div>
          </div>

          {/* Framework Cards */}
          <div className="space-y-3">
            {report.frameworks.map(fw => (
              <FrameworkCard
                key={fw.framework}
                fw={fw}
                expanded={expandedFW === fw.framework}
                onToggle={() => toggleFW(fw.framework)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default Compliance;
