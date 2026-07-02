import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiCheckCircle,
  FiXCircle,
  FiAlertTriangle,
  FiShield,
  FiChevronRight,
  FiRefreshCw,
} from "react-icons/fi";
import {
  GetComplianceReport,
  type ComplianceReportDTO,
  type FrameworkScore,
  type ControlStatus,
} from "../../services";
import { useLanguage } from "../../contexts/LanguageContext";
import { useStateContext } from "../../contexts/ProviderContext";

// ── helpers ────────────────────────────────────────────────────────────────────

const statusIcon = (s: string) => {
  if (s === "compliant") return <FiCheckCircle className="text-emerald-500" />;
  if (s === "warning")   return <FiAlertTriangle className="text-yellow-500" />;
  return <FiXCircle className="text-red-500" />;
};

const statusBadge = (s: string) => {
  if (s === "compliant") return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300";
  if (s === "warning")   return "border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-500/25 dark:bg-yellow-500/10 dark:text-yellow-300";
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

// ── Radial ────────────────────────────────────────────────────────────────────

const RadialScore: React.FC<{ score: number; label: string }> = ({ score, label }) => {
  const r = 32;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-gray-100 dark:text-white/10" />
        <circle cx="40" cy="40" r={r} fill="none" strokeWidth="6"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 40 40)" className={scoreRingColor(score)} />
        <text x="40" y="44" textAnchor="middle" className={`fill-current ${scoreColor(score)}`} fontSize="16" fontWeight="800">
          {score}
        </text>
      </svg>
      <div className="text-center text-[10.5px] font-semibold text-gray-600 dark:text-white/60">{label}</div>
    </div>
  );
};

// ── FrameworkCard ─────────────────────────────────────────────────────────────

const FrameworkCard: React.FC<{
  fw: FrameworkScore;
  onControlClick: (fw: FrameworkScore, ctrl: ControlStatus) => void;
}> = ({ fw, onControlClick }) => {
  const { t } = useLanguage();
  const { currentColor } = useStateContext();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/70 bg-white dark:border-white/8 dark:bg-white/4">
      {/* Header row — click to expand/collapse */}
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="flex w-full items-center justify-between gap-4 p-4 text-left"
      >
        <div className="flex items-center gap-4">
          <RadialScore score={fw.score} label={fw.framework.replace(/_/g, " ")} />
          <div>
            <div className="text-[13px] font-bold text-[#1f2240] dark:text-white/90">{fw.full_name}</div>
            <div className="mt-1 flex flex-wrap gap-2 text-[10.5px]">
              <span className="text-emerald-700 dark:text-emerald-300">✓ {fw.compliant} {t("compliance.compliant")}</span>
              {fw.warning > 0 && <span className="text-yellow-700 dark:text-yellow-300">⚠ {fw.warning} {t("compliance.warning")}</span>}
              {fw.non_compliant > 0 && <span className="text-red-700 dark:text-red-300">✗ {fw.non_compliant} {t("compliance.nonCompliant")}</span>}
            </div>
          </div>
        </div>
        <FiChevronRight
          className={`shrink-0 text-[15px] text-gray-400 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
        />
      </button>

      {/* Controls — each row is a separate clickable item */}
      {expanded && (
        <div className="border-t border-slate-100 dark:border-white/8">
          {fw.controls.map((ctrl) => (
            <button
              key={ctrl.control_id}
              type="button"
              onClick={() => onControlClick(fw, ctrl)}
              className="flex w-full items-start gap-3 border-b border-slate-100/50 px-4 py-3.5 text-left transition hover:bg-slate-50 last:border-0 dark:border-white/5 dark:hover:bg-white/4"
            >
              {/* Status icon */}
              <div className="mt-0.5 shrink-0 text-[15px]">{statusIcon(ctrl.status)}</div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold text-gray-700 dark:text-white/80">{ctrl.control_id}</span>
                  <span className="text-[11.5px] font-medium text-gray-600 dark:text-white/65">{ctrl.control_name}</span>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-bold ${statusBadge(ctrl.status)}`}>
                    {ctrl.status.replace("_", " ").toUpperCase()}
                  </span>
                </div>
                <p className="mt-0.5 text-[10.5px] text-gray-500 dark:text-white/45">{ctrl.detail}</p>
              </div>

              {/* Violations + arrow */}
              <div className="flex shrink-0 items-center gap-2">
                {ctrl.violations > 0 && (
                  <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
                    {t("compliance.violationsCount", { n: ctrl.violations })}
                  </span>
                )}
                <FiChevronRight className="text-[13px]" style={{ color: currentColor }} />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Main ───────────────────────────────────────────────────────────────────────

const Compliance: React.FC = () => {
  const { t } = useLanguage();
  const { currentColor } = useStateContext();
  const navigate = useNavigate();
  const [report, setReport] = useState<ComplianceReportDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const hasFetched = useRef(false);

  const accentGrad = `linear-gradient(135deg, ${currentColor}, color-mix(in srgb, ${currentColor} 65%, #a855f7))`;

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

  const handleControlClick = (fw: FrameworkScore, ctrl: ControlStatus) => {
    navigate(
      `/admin/compliance/${fw.framework.toLowerCase()}/${encodeURIComponent(ctrl.control_id)}`,
      { state: { framework: fw, control: ctrl } }
    );
  };

  return (
    <div className="w-full py-0 sm:py-0">

      {/* Header */}
      <div
        className="relative mb-4 overflow-hidden rounded-[18px] bg-white/95 p-4 shadow-sm backdrop-blur sm:mb-5 sm:rounded-[22px] sm:p-6 dark:bg-[#0d0b1a]/90"
        style={{ border: `1px solid ${currentColor}30` }}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-12 right-10 h-40 w-40 rounded-full blur-3xl" style={{ backgroundColor: `${currentColor}1e` }} />
          <div className="absolute -bottom-12 left-10 h-40 w-40 rounded-full blur-3xl" style={{ backgroundColor: `${currentColor}14` }} />
        </div>
        <div className="relative z-10 flex items-center gap-3 sm:gap-4">
          <div
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg sm:h-13 sm:w-13"
            style={{ background: accentGrad, boxShadow: `0 8px 24px -6px ${currentColor}50` }}
          >
            <FiShield className="text-[20px] sm:text-[22px]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] sm:text-[10.5px]" style={{ color: currentColor }}>
              {t("compliance.analyticsLabel")}
            </p>
            <h1 className="truncate text-[18px] font-bold text-slate-900 sm:text-[20px] dark:text-white/90">
              {t("compliance.title")}
            </h1>
            <p className="mt-0.5 truncate text-[11px] text-slate-500 sm:text-[12px] dark:text-white/45">
              {t("compliance.subtitle")}
              {report && (
                <span className="ml-2 text-slate-400 dark:text-white/30">
                  · {t("compliance.generated")}: {new Date(report.generated_at).toLocaleDateString("en-GB")}
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400 dark:text-white/35">
          <FiRefreshCw className="animate-spin text-[20px]" />
          <span className="text-[12px]">{t("compliance.loading")}</span>
        </div>
      ) : !report ? (
        <div className="rounded-xl border border-slate-200/70 bg-white py-16 text-center dark:border-white/8 dark:bg-white/4">
          <div className="text-[12px] text-slate-400 dark:text-white/35">{t("compliance.failedLoad")}</div>
        </div>
      ) : (
        <>
          {/* Overall Score */}
          <div className="mb-5 overflow-hidden rounded-xl border border-slate-200/70 bg-white p-5 dark:border-white/8 dark:bg-[#0d0b1a]/80">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-[11px] font-bold uppercase text-gray-600 dark:text-white/55">{t("compliance.overallScore")}</div>
                <div className={`mt-1 text-[40px] font-extrabold ${scoreColor(report.overall_score)}`}>
                  {report.overall_score}<span className="text-[20px]">%</span>
                </div>
                <div className="mt-1 text-[10.5px] text-gray-500 dark:text-white/40">
                  {t("compliance.scanCount", { n: report.scan_count })} · {t("compliance.lastScan", { date: report.last_scan_date || "—" })}
                </div>
              </div>
              <div className="flex flex-wrap gap-4">
                {report.frameworks.map((fw) => (
                  <RadialScore key={fw.framework} score={fw.score} label={fw.framework.replace(/_/g, " ")} />
                ))}
              </div>
            </div>
          </div>

          {/* Framework accordion cards */}
          <div className="space-y-3">
            {report.frameworks.map((fw) => (
              <FrameworkCard
                key={fw.framework}
                fw={fw}
                onControlClick={handleControlClick}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default Compliance;
