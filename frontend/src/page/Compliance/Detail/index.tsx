import React from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  FiArrowLeft,
  FiShield,
  FiCheckCircle,
  FiXCircle,
  FiAlertTriangle,
  FiAlertOctagon,
  FiList,
} from "react-icons/fi";
import type { ControlStatus, FrameworkScore } from "../../../services";
import { useStateContext } from "../../../contexts/ProviderContext";

// ── helpers ────────────────────────────────────────────────────────────────────

const statusMeta = (s: string) => {
  if (s === "compliant")
    return {
      icon: <FiCheckCircle className="text-[18px] text-emerald-500" />,
      badge: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300",
      label: "COMPLIANT",
      dot: "bg-emerald-500",
    };
  if (s === "warning")
    return {
      icon: <FiAlertTriangle className="text-[18px] text-yellow-500" />,
      badge: "border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-500/25 dark:bg-yellow-500/10 dark:text-yellow-300",
      label: "WARNING",
      dot: "bg-yellow-500",
    };
  return {
    icon: <FiXCircle className="text-[18px] text-red-500" />,
    badge: "border-red-200 bg-red-50 text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300",
    label: "NON COMPLIANT",
    dot: "bg-red-500",
  };
};

const scoreColor = (score: number) => {
  if (score >= 80) return { text: "text-emerald-700 dark:text-emerald-300", stroke: "stroke-emerald-500" };
  if (score >= 60) return { text: "text-yellow-700 dark:text-yellow-300", stroke: "stroke-yellow-500" };
  return { text: "text-red-700 dark:text-red-300", stroke: "stroke-red-500" };
};

const RadialScore: React.FC<{ score: number }> = ({ score }) => {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const { text, stroke } = scoreColor(score);
  return (
    <svg width="90" height="90" viewBox="0 0 90 90">
      <circle cx="45" cy="45" r={r} fill="none" stroke="currentColor" strokeWidth="7" className="text-slate-100 dark:text-white/10" />
      <circle
        cx="45" cy="45" r={r} fill="none" strokeWidth="7"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 45 45)"
        className={stroke}
      />
      <text x="45" y="50" textAnchor="middle" className={`fill-current font-extrabold ${text}`} fontSize="18" fontWeight="800">
        {score}
      </text>
    </svg>
  );
};

// ── ControlRow ─────────────────────────────────────────────────────────────────

const ControlRow: React.FC<{ ctrl: ControlStatus; accent: string }> = ({ ctrl, accent }) => {
  const meta = statusMeta(ctrl.status);
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-slate-100 bg-white p-4 dark:border-white/8 dark:bg-white/3">
      <div className="mt-0.5 shrink-0">{meta.icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="text-[11.5px] font-bold"
            style={{ color: accent }}
          >
            {ctrl.control_id}
          </span>
          <span className="text-[12px] font-semibold text-slate-700 dark:text-white/80">
            {ctrl.control_name}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[9.5px] font-bold ${meta.badge}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
            {meta.label}
          </span>
        </div>
        {ctrl.detail && (
          <p className="mt-1.5 text-[11px] leading-5 text-slate-500 dark:text-white/45">
            {ctrl.detail}
          </p>
        )}
      </div>
      {ctrl.violations > 0 && (
        <div className="shrink-0 text-right">
          <span className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
            <FiAlertOctagon className="text-[11px]" />
            {ctrl.violations} violation{ctrl.violations > 1 ? "s" : ""}
          </span>
        </div>
      )}
    </div>
  );
};

// ── Main page ──────────────────────────────────────────────────────────────────

type LocationState = {
  framework: FrameworkScore;
  control?: ControlStatus;
};

const ComplianceDetail: React.FC = () => {
  const navigate = useNavigate();
  useParams<{ framework: string }>();
  const location = useLocation();
  const { currentColor } = useStateContext();

  const state = location.state as LocationState | null;
  const fw = state?.framework ?? null;

  const accentGrad = `linear-gradient(135deg, ${currentColor}, color-mix(in srgb, ${currentColor} 65%, #a855f7))`;

  if (!fw) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <FiShield className="text-[40px] text-slate-300 dark:text-white/20" />
        <p className="text-[13px] text-slate-400 dark:text-white/35">No framework data found.</p>
        <button
          type="button"
          onClick={() => navigate("/admin/compliance")}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-white/60 dark:hover:bg-white/5"
        >
          <FiArrowLeft className="text-[12px]" />
          Back to Compliance
        </button>
      </div>
    );
  }

  const compliantCount   = fw.controls.filter((c) => c.status === "compliant").length;
  const warningCount     = fw.controls.filter((c) => c.status === "warning").length;
  const nonCompliantCount = fw.controls.filter((c) => c.status === "non_compliant").length;
  const totalViolations  = fw.controls.reduce((sum, c) => sum + (c.violations ?? 0), 0);

  const { text: scoreTxt } = scoreColor(fw.score);

  return (
    <div className="w-full space-y-4">

      {/* ── Header ── */}
      <div
        className="relative overflow-hidden rounded-[18px] bg-white/95 p-5 shadow-sm backdrop-blur dark:bg-[#0d0b1a]/90"
        style={{ border: `1px solid ${currentColor}30` }}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-12 right-10 h-40 w-40 rounded-full blur-3xl" style={{ backgroundColor: `${currentColor}1e` }} />
          <div className="absolute -bottom-12 left-10 h-40 w-40 rounded-full blur-3xl" style={{ backgroundColor: `${currentColor}14` }} />
        </div>
        <div className="relative z-10">
          <button
            type="button"
            onClick={() => navigate("/admin/compliance")}
            className="mb-4 inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3.5 py-1.5 text-[11.5px] font-medium text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white/65 dark:hover:bg-white/8"
          >
            <FiArrowLeft className="text-[12px]" />
            Back
          </button>
          <div className="flex flex-wrap items-center gap-5">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg"
              style={{ background: accentGrad, boxShadow: `0 8px 24px -6px ${currentColor}50` }}
            >
              <FiShield className="text-[22px]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[9.5px] font-bold uppercase tracking-[0.16em]" style={{ color: currentColor }}>
                ANALYTICS · COMPLIANCE
              </p>
              <h1 className="text-[20px] font-extrabold text-slate-900 dark:text-white/90">{fw.full_name}</h1>
              <p className="text-[11px] text-slate-400 dark:text-white/35">{fw.framework.replace("_", " ")}</p>
            </div>
            <RadialScore score={fw.score} />
          </div>
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Compliant",     value: compliantCount,    cls: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/8 dark:text-emerald-300", dot: "bg-emerald-500" },
          { label: "Warning",       value: warningCount,      cls: "border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-500/20 dark:bg-yellow-500/8 dark:text-yellow-300",   dot: "bg-yellow-500"  },
          { label: "Non-Compliant", value: nonCompliantCount, cls: "border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/8 dark:text-red-300",                      dot: "bg-red-500"     },
          { label: "Total Violations", value: totalViolations, cls: "border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-white/4 dark:text-white/70",                  dot: "bg-slate-400"   },
        ].map(({ label, value, cls, dot }) => (
          <div key={label} className={`rounded-2xl border p-4 ${cls}`}>
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider opacity-70">
              <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
              {label}
            </div>
            <div className="mt-1.5 text-[26px] font-extrabold leading-none">{value}</div>
          </div>
        ))}
      </div>

      {/* ── Score card ── */}
      <div className="flex items-center gap-4 rounded-2xl border border-slate-200/70 bg-white px-5 py-4 dark:border-white/8 dark:bg-[#0d0b1a]/80">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/35">Framework Score</p>
          <p className={`text-[38px] font-extrabold leading-none ${scoreTxt}`}>
            {fw.score}<span className="text-[18px]">%</span>
          </p>
        </div>
        <div className="h-12 w-px bg-slate-100 dark:bg-white/8" />
        <p className="text-[11.5px] leading-6 text-slate-500 dark:text-white/45">
          {compliantCount} of {fw.controls.length} controls are compliant.{warningCount > 0 ? ` ${warningCount} need attention.` : ""}{nonCompliantCount > 0 ? ` ${nonCompliantCount} non-compliant.` : ""}
        </p>
      </div>

      {/* ── Controls list ── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-slate-50/50 dark:border-white/8 dark:bg-white/2">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5 dark:border-white/8">
          <FiList className="text-[14px]" style={{ color: currentColor }} />
          <span className="text-[13px] font-bold text-slate-700 dark:text-white/80">Controls</span>
          <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-white/8 dark:text-white/40">
            {fw.controls.length}
          </span>
        </div>
        <div className="space-y-2 p-3">
          {fw.controls.length === 0 ? (
            <p className="py-8 text-center text-[12px] text-slate-400 dark:text-white/35">No controls found.</p>
          ) : (
            fw.controls.map((ctrl) => (
              <ControlRow key={ctrl.control_id} ctrl={ctrl} accent={currentColor} />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ComplianceDetail;
