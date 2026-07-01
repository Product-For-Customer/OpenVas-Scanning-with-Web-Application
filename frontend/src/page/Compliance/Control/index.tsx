import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  FiArrowLeft,
  FiShield,
  FiCheckCircle,
  FiXCircle,
  FiAlertTriangle,
  FiAlertOctagon,
  FiFileText,
  FiRefreshCw,
  FiServer,
  FiCpu,
  FiTool,
  FiChevronDown,
  FiChevronUp,
  FiTag,
} from "react-icons/fi";
import type { ControlStatus, FrameworkScore } from "../../../services";
import {
  GetControlVulnerabilities,
  type ViolationVuln,
} from "../../../services/compliance";
import { useStateContext } from "../../../contexts/ProviderContext";

// ── helpers ────────────────────────────────────────────────────────────────────

const statusMeta = (s: string) => {
  if (s === "compliant")
    return {
      icon: <FiCheckCircle className="text-[28px] text-emerald-500" />,
      badge: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300",
      glow: "#10b98120",
      border: "#10b98130",
      label: "COMPLIANT",
      desc: "This control meets all requirements.",
    };
  if (s === "warning")
    return {
      icon: <FiAlertTriangle className="text-[28px] text-yellow-500" />,
      badge: "border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-500/25 dark:bg-yellow-500/10 dark:text-yellow-300",
      glow: "#eab30820",
      border: "#eab30830",
      label: "WARNING",
      desc: "This control requires attention.",
    };
  return {
    icon: <FiXCircle className="text-[28px] text-red-500" />,
    badge: "border-red-200 bg-red-50 text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300",
    glow: "#ef444420",
    border: "#ef444430",
    label: "NON COMPLIANT",
    desc: "This control is not compliant and needs immediate action.",
  };
};

const severityColors: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  Critical: {
    bg: "bg-red-50 dark:bg-red-500/10",
    text: "text-red-700 dark:text-red-300",
    border: "border-red-200 dark:border-red-500/25",
    dot: "bg-red-500",
  },
  High: {
    bg: "bg-orange-50 dark:bg-orange-500/10",
    text: "text-orange-700 dark:text-orange-300",
    border: "border-orange-200 dark:border-orange-500/25",
    dot: "bg-orange-500",
  },
  Medium: {
    bg: "bg-yellow-50 dark:bg-yellow-500/10",
    text: "text-yellow-700 dark:text-yellow-300",
    border: "border-yellow-200 dark:border-yellow-500/25",
    dot: "bg-yellow-500",
  },
  Low: {
    bg: "bg-blue-50 dark:bg-blue-500/10",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-200 dark:border-blue-500/25",
    dot: "bg-blue-500",
  },
  Info: {
    bg: "bg-slate-50 dark:bg-white/5",
    text: "text-slate-600 dark:text-white/50",
    border: "border-slate-200 dark:border-white/10",
    dot: "bg-slate-400",
  },
};

// ── VulnCard ──────────────────────────────────────────────────────────────────

const VulnCard: React.FC<{ vuln: ViolationVuln; idx: number }> = ({ vuln, idx }) => {
  const [open, setOpen] = useState(false);
  const sc = severityColors[vuln.severity_label] ?? severityColors["Info"];
  const cves = vuln.cve_list
    ? vuln.cve_list.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  return (
    <div
      className={`overflow-hidden rounded-xl border transition-all ${sc.border} ${sc.bg}`}
    >
      {/* Header row — always visible */}
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-start gap-3 px-4 py-3.5 text-left"
      >
        {/* Severity indicator */}
        <div className="flex shrink-0 flex-col items-center gap-1 pt-0.5">
          <span className={`h-2.5 w-2.5 rounded-full ${sc.dot}`} />
          <span className={`text-[9px] font-bold ${sc.text}`}>{idx + 1}</span>
        </div>

        {/* Main info */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9.5px] font-bold ${sc.border} ${sc.bg} ${sc.text}`}>
              {vuln.severity_label} {vuln.severity.toFixed(1)}
            </span>
            <span className="truncate text-[12px] font-semibold text-slate-800 dark:text-white/85">
              {vuln.vulnerability_name}
            </span>
          </div>

          {/* Meta row */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            {vuln.ip && vuln.ip !== "N/A" && (
              <span className="flex items-center gap-1 text-[10.5px] text-slate-500 dark:text-white/40">
                <FiServer className="text-[10px]" />
                {vuln.ip}
              </span>
            )}
            {vuln.task_name && vuln.task_name !== "Unknown Task" && (
              <span className="flex items-center gap-1 text-[10.5px] text-slate-500 dark:text-white/40">
                <FiCpu className="text-[10px]" />
                {vuln.task_name}
              </span>
            )}
            {cves.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {cves.slice(0, 3).map((cve) => (
                  <span
                    key={cve}
                    className="flex items-center gap-0.5 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-mono font-semibold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-white/55"
                  >
                    <FiTag className="text-[8px]" />
                    {cve}
                  </span>
                ))}
                {cves.length > 3 && (
                  <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-white/30">
                    +{cves.length - 3}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Expand toggle */}
        <div className="shrink-0 self-center">
          {open ? (
            <FiChevronUp className="text-[13px] text-slate-400 dark:text-white/30" />
          ) : (
            <FiChevronDown className="text-[13px] text-slate-400 dark:text-white/30" />
          )}
        </div>
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-slate-100 bg-white/70 px-4 py-4 dark:border-white/8 dark:bg-black/10">
          <div className="space-y-4">

            {/* All CVEs */}
            {cves.length > 0 && (
              <section>
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">CVE References</p>
                <div className="flex flex-wrap gap-1.5">
                  {cves.map((cve) => (
                    <span
                      key={cve}
                      className="rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-mono font-semibold text-slate-700 dark:border-white/10 dark:bg-white/6 dark:text-white/65"
                    >
                      {cve}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Summary */}
            {vuln.summary && (
              <section>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">Summary</p>
                <p className="text-[11.5px] leading-6 text-slate-600 dark:text-white/60">{vuln.summary}</p>
              </section>
            )}

            {/* Impact */}
            {vuln.impact && (
              <section>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">Impact</p>
                <p className="text-[11.5px] leading-6 text-slate-600 dark:text-white/60">{vuln.impact}</p>
              </section>
            )}

            {/* Insight */}
            {vuln.insight && (
              <section>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">Technical Insight</p>
                <p className="text-[11.5px] leading-6 text-slate-600 dark:text-white/60">{vuln.insight}</p>
              </section>
            )}

            {/* Affected */}
            {vuln.affected && (
              <section>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">Affected Systems</p>
                <p className="text-[11.5px] leading-6 text-slate-600 dark:text-white/60">{vuln.affected}</p>
              </section>
            )}

            {/* Solution */}
            {vuln.solution && (
              <section className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3.5 dark:border-emerald-500/15 dark:bg-emerald-500/5">
                <div className="mb-2 flex items-center gap-2">
                  <FiTool className="text-[12px] text-emerald-600 dark:text-emerald-400" />
                  <p className="text-[10.5px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                    How to Fix
                    {vuln.solution_type && (
                      <span className="ml-2 font-normal normal-case tracking-normal opacity-70">({vuln.solution_type})</span>
                    )}
                  </p>
                </div>
                <p className="text-[11.5px] leading-6 text-emerald-800 dark:text-emerald-200/80">{vuln.solution}</p>
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main ───────────────────────────────────────────────────────────────────────

type LocationState = {
  framework: FrameworkScore;
  control: ControlStatus;
};

const ComplianceControlDetail: React.FC = () => {
  const navigate = useNavigate();
  useParams<{ framework: string; controlId: string }>();
  const location = useLocation();
  const { currentColor } = useStateContext();

  const state = location.state as LocationState | null;
  const fw = state?.framework ?? null;
  const ctrl = state?.control ?? null;

  const [vulns, setVulns] = useState<ViolationVuln[]>([]);
  const [vulnLoading, setVulnLoading] = useState(false);
  const hasFetched = useRef(false);

  const accentGrad = `linear-gradient(135deg, ${currentColor}, color-mix(in srgb, ${currentColor} 65%, #a855f7))`;

  useEffect(() => {
    if (!ctrl?.control_id || hasFetched.current) return;
    hasFetched.current = true;
    setVulnLoading(true);
    GetControlVulnerabilities(ctrl.control_id).then((data) => {
      setVulns(data);
      setVulnLoading(false);
    });
  }, [ctrl?.control_id]);

  // Reset fetch flag when control changes
  useEffect(() => {
    hasFetched.current = false;
  }, [ctrl?.control_id]);

  if (!fw || !ctrl) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <FiShield className="text-[40px] text-slate-300 dark:text-white/20" />
        <p className="text-[13px] text-slate-400 dark:text-white/35">No control data found.</p>
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

  const meta = statusMeta(ctrl.status);

  // Group vulns by severity for summary stats
  const critCount = vulns.filter((v) => v.severity_label === "Critical").length;
  const highCount = vulns.filter((v) => v.severity_label === "High").length;
  const medCount  = vulns.filter((v) => v.severity_label === "Medium").length;

  return (
    <div className="w-full space-y-4">

      {/* ── Header ── */}
      <div
        className="relative overflow-hidden rounded-[18px] bg-white/95 p-5 shadow-sm backdrop-blur dark:bg-[#0d0b1a]/90"
        style={{ border: `1px solid ${currentColor}30` }}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-10 right-8 h-36 w-36 rounded-full blur-3xl" style={{ backgroundColor: `${currentColor}1e` }} />
        </div>

        {/* Breadcrumb */}
        <div className="relative z-10 mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/admin/compliance")}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white/65 dark:hover:bg-white/8"
          >
            <FiArrowLeft className="text-[11px]" />
            Compliance
          </button>
          <span className="text-[11px] text-slate-300 dark:text-white/20">/</span>
          <span className="rounded-xl px-3 py-1.5 text-[11px] font-medium text-slate-500 dark:text-white/40">
            {fw.framework.replace(/_/g, " ")}
          </span>
          <span className="text-[11px] text-slate-300 dark:text-white/20">/</span>
          <span className="rounded-xl px-3 py-1.5 text-[11px] font-bold" style={{ color: currentColor }}>
            {ctrl.control_id}
          </span>
        </div>

        {/* Main header row */}
        <div className="relative z-10 flex flex-wrap items-center gap-4">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg"
            style={{ background: accentGrad, boxShadow: `0 8px 24px -6px ${currentColor}50` }}
          >
            <FiShield className="text-[22px]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[9.5px] font-bold uppercase tracking-[0.16em]" style={{ color: currentColor }}>
              {fw.full_name} · CONTROL DETAIL
            </p>
            <h1 className="text-[22px] font-extrabold text-slate-900 dark:text-white/90">
              {ctrl.control_id}
            </h1>
            <p className="text-[13px] font-semibold text-slate-600 dark:text-white/65">{ctrl.control_name}</p>
          </div>
        </div>
      </div>

      {/* ── Status card ── */}
      <div
        className="flex items-center gap-5 rounded-2xl border p-5"
        style={{ backgroundColor: meta.glow, borderColor: meta.border }}
      >
        <div className="shrink-0">{meta.icon}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold ${meta.badge}`}>
              {meta.label}
            </span>
          </div>
          <p className="mt-1 text-[11.5px] text-slate-500 dark:text-white/45">{meta.desc}</p>
        </div>
        {ctrl.violations > 0 && (
          <div className="shrink-0 text-right">
            <div className="flex items-center gap-1.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 dark:border-red-500/20 dark:bg-red-500/8">
              <FiAlertOctagon className="text-[16px] text-red-600 dark:text-red-300" />
              <div>
                <p className="text-[22px] font-extrabold leading-none text-red-700 dark:text-red-300">{ctrl.violations}</p>
                <p className="text-[9.5px] font-semibold text-red-600/70 dark:text-red-300/60">violation{ctrl.violations > 1 ? "s" : ""}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Detail ── */}
      {ctrl.detail && (
        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 dark:border-white/8 dark:bg-white/3">
          <div className="mb-3 flex items-center gap-2">
            <FiFileText className="text-[14px]" style={{ color: currentColor }} />
            <span className="text-[12px] font-bold text-slate-700 dark:text-white/80">Detail</span>
          </div>
          <p className="text-[12.5px] leading-6 text-slate-600 dark:text-white/60">{ctrl.detail}</p>
        </div>
      )}

      {/* ── Vulnerability findings ── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white dark:border-white/8 dark:bg-white/3">
        {/* Section header */}
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5 dark:border-white/8">
          <FiAlertOctagon className="text-[13px]" style={{ color: currentColor }} />
          <span className="text-[12.5px] font-bold text-slate-700 dark:text-white/80">
            Vulnerability Findings
          </span>
          {vulns.length > 0 && (
            <span className="ml-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600 dark:bg-red-500/10 dark:text-red-300">
              {vulns.length}
            </span>
          )}

          {/* Severity mini-stats */}
          {!vulnLoading && vulns.length > 0 && (
            <div className="ml-auto flex items-center gap-2">
              {critCount > 0 && (
                <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[9.5px] font-bold text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
                  {critCount} Critical
                </span>
              )}
              {highCount > 0 && (
                <span className="rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[9.5px] font-bold text-orange-700 dark:border-orange-500/25 dark:bg-orange-500/10 dark:text-orange-300">
                  {highCount} High
                </span>
              )}
              {medCount > 0 && (
                <span className="rounded-full border border-yellow-200 bg-yellow-50 px-2 py-0.5 text-[9.5px] font-bold text-yellow-700 dark:border-yellow-500/25 dark:bg-yellow-500/10 dark:text-yellow-300">
                  {medCount} Medium
                </span>
              )}
            </div>
          )}
        </div>

        <div className="p-4">
          {vulnLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-slate-400 dark:text-white/30">
              <FiRefreshCw className="animate-spin text-[18px]" />
              <span className="text-[11.5px]">Loading vulnerabilities…</span>
            </div>
          ) : vulns.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-10">
              <FiCheckCircle className="text-[32px] text-emerald-500" />
              <p className="text-[12px] font-semibold text-slate-500 dark:text-white/40">
                {ctrl.status === "compliant"
                  ? "No violations — this control is compliant."
                  : "No vulnerability data found for this control."}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {vulns.map((v, i) => (
                <VulnCard key={`${v.vulnerability_id}-${v.ip}-${i}`} vuln={v} idx={i} />
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default ComplianceControlDetail;
