import React, { useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  FiArrowLeft,
  FiShield,
  FiCheckCircle,
  FiXCircle,
  FiAlertTriangle,
  FiAlertOctagon,
  FiPrinter,
  FiFileText,
  FiCalendar,
  FiBarChart2,
  FiLayers,
  FiTarget,
} from "react-icons/fi";
import type { FrameworkScore, ControlStatus } from "../../../services";
import { useStateContext } from "../../../contexts/ProviderContext";

// ── helpers ───────────────────────────────────────────────────────────────────

const scoreRingColor = (s: number) => {
  if (s >= 80) return "#10b981";
  if (s >= 60) return "#eab308";
  return "#ef4444";
};
const scoreLabel = (s: number) => {
  if (s >= 80) return "GOOD";
  if (s >= 60) return "FAIR";
  return "POOR";
};

const statusMeta = (s: string) => {
  if (s === "compliant")
    return {
      icon: <FiCheckCircle className="text-[13px] text-emerald-500" />,
      badge: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/8 dark:text-emerald-300",
      label: "Compliant",
      bar: "bg-emerald-500",
    };
  if (s === "warning")
    return {
      icon: <FiAlertTriangle className="text-[13px] text-yellow-500" />,
      badge: "border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-500/20 dark:bg-yellow-500/8 dark:text-yellow-300",
      label: "Warning",
      bar: "bg-yellow-500",
    };
  return {
    icon: <FiXCircle className="text-[13px] text-red-500" />,
    badge: "border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/8 dark:text-red-300",
    label: "Non-Compliant",
    bar: "bg-red-500",
  };
};

const frameworkDescriptions: Record<string, { abbr: string; desc: string; purpose: string; scope: string }> = {
  PCI_DSS: {
    abbr: "PCI DSS v4.0",
    desc: "Payment Card Industry Data Security Standard",
    purpose:
      "กำหนดมาตรฐานความปลอดภัยสำหรับองค์กรที่จัดเก็บ ประมวลผล หรือส่งข้อมูลบัตรชำระเงิน เพื่อปกป้องข้อมูลผู้ถือบัตรจากการละเมิดและการฉ้อโกง",
    scope:
      "ระบบ network, แอปพลิเคชัน, อุปกรณ์จัดเก็บข้อมูล และกระบวนการที่เกี่ยวข้องกับข้อมูลบัตรชำระเงิน",
  },
  ISO_27001: {
    abbr: "ISO/IEC 27001:2022",
    desc: "Information Security Management System",
    purpose:
      "กำหนดข้อกำหนดสำหรับการจัดตั้ง นำไปใช้ บำรุงรักษา และปรับปรุงระบบการจัดการความปลอดภัยของข้อมูลอย่างต่อเนื่อง",
    scope:
      "ทรัพย์สินสารสนเทศทั้งหมดขององค์กร รวมถึงข้อมูล ระบบ บุคลากร และกระบวนการทางธุรกิจ",
  },
  NIST_CSF: {
    abbr: "NIST CSF 2.0",
    desc: "NIST Cybersecurity Framework",
    purpose:
      "ให้แนวทางและแนวปฏิบัติที่ดีที่สุดสำหรับการจัดการความเสี่ยงด้านความปลอดภัยทางไซเบอร์ โดยเน้นการระบุ ป้องกัน ตรวจจับ ตอบสนอง และฟื้นฟู",
    scope:
      "โครงสร้างพื้นฐานที่สำคัญ ระบบสารสนเทศ และเทคโนโลยีดิจิทัลทั่วทั้งองค์กร",
  },
  CIS_CONTROLS: {
    abbr: "CIS Controls v8",
    desc: "Center for Internet Security Critical Security Controls",
    purpose:
      "ชุดของการควบคุมความปลอดภัยที่ได้รับการจัดลำดับความสำคัญ เพื่อป้องกันภัยคุกคามทางไซเบอร์ที่พบบ่อยและมีผลกระทบสูงสุด",
    scope:
      "สินทรัพย์ฮาร์ดแวร์และซอฟต์แวร์ การจัดการ vulnerability และการป้องกันเครือข่าย",
  },
};

const recommendationsByStatus = (ctrl: ControlStatus): string => {
  if (ctrl.status === "compliant") return "ควบคุมนี้เป็นไปตามข้อกำหนด ให้คงการติดตามและทบทวนเป็นระยะ";
  if (ctrl.status === "warning") {
    if (ctrl.violations > 0)
      return `ตรวจพบ ${ctrl.violations} จุดที่ต้องแก้ไข ให้ดำเนินการแก้ไขช่องโหว่ที่มีความเสี่ยงสูงและกำหนดแผนการแก้ไขภายใน 30 วัน`;
    return "ต้องปรับปรุงกระบวนการ ให้ทบทวนนโยบายและขั้นตอนปฏิบัติงานที่เกี่ยวข้อง";
  }
  if (ctrl.violations > 0)
    return `ไม่เป็นไปตามข้อกำหนด ตรวจพบ ${ctrl.violations} ช่องโหว่ที่ต้องแก้ไขทันที ต้องดำเนินการแก้ไขเร่งด่วนภายใน 7 วัน`;
  return "ไม่เป็นไปตามข้อกำหนด ต้องดำเนินการแก้ไขกระบวนการและระบบที่เกี่ยวข้องโดยเร่งด่วน";
};

// ── Radial gauge ──────────────────────────────────────────────────────────────

const RadialGauge: React.FC<{ score: number }> = ({ score }) => {
  const r = 44, circ = 2 * Math.PI * r;
  const color = scoreRingColor(score);
  return (
    <svg width="110" height="110" viewBox="0 0 110 110">
      <circle cx="55" cy="55" r={r} fill="none" stroke="#e2e8f0" strokeWidth="8" />
      <circle
        cx="55" cy="55" r={r} fill="none" strokeWidth="8"
        strokeDasharray={`${(score / 100) * circ} ${circ}`}
        strokeLinecap="round" transform="rotate(-90 55 55)"
        stroke={color}
      />
      <text x="55" y="50" textAnchor="middle" fontSize="22" fontWeight="800" fill={color}>{score}</text>
      <text x="55" y="66" textAnchor="middle" fontSize="9" fontWeight="700" fill={color}>{scoreLabel(score)}</text>
    </svg>
  );
};

// ── ControlRow ────────────────────────────────────────────────────────────────

const ControlRow: React.FC<{ ctrl: ControlStatus; idx: number; accent: string; onDetail: () => void }> = ({
  ctrl, idx, accent, onDetail,
}) => {
  const meta = statusMeta(ctrl.status);
  return (
    <tr className="border-b border-slate-100 dark:border-white/6 last:border-0">
      <td className="py-3 pl-4 pr-2 text-[10.5px] font-medium text-slate-400 dark:text-white/30 w-6">{idx + 1}</td>
      <td className="py-3 pr-3">
        <span className="text-[11px] font-bold text-slate-700 dark:text-white/80">{ctrl.control_id}</span>
      </td>
      <td className="py-3 pr-3">
        <span className="text-[11px] text-slate-600 dark:text-white/65">{ctrl.control_name}</span>
      </td>
      <td className="py-3 pr-3">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9.5px] font-bold ${meta.badge}`}>
          {meta.icon}
          {meta.label}
        </span>
      </td>
      <td className="py-3 pr-3 text-center">
        {ctrl.violations > 0 ? (
          <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:border-red-500/20 dark:bg-red-500/8 dark:text-red-300">
            {ctrl.violations}
          </span>
        ) : (
          <span className="text-[10px] text-slate-300 dark:text-white/20">—</span>
        )}
      </td>
      <td className="py-3 pr-4">
        <button
          type="button"
          onClick={onDetail}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[9.5px] font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/4 dark:text-white/55 dark:hover:bg-white/8"
          style={{ borderColor: `${accent}40`, color: accent }}
        >
          Detail →
        </button>
      </td>
    </tr>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────

type LocationState = { framework: FrameworkScore; generatedAt?: string };

const ComplianceDocument: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentColor } = useStateContext();
  const printRef = useRef<HTMLDivElement>(null);

  const state = location.state as LocationState | null;
  const fw = state?.framework ?? null;
  const generatedAt = state?.generatedAt ?? new Date().toISOString();

  const accentGrad = `linear-gradient(135deg, ${currentColor}, color-mix(in srgb, ${currentColor} 65%, #a855f7))`;

  if (!fw) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <FiFileText className="text-[40px] text-slate-300 dark:text-white/20" />
        <p className="text-[13px] text-slate-400 dark:text-white/35">No framework data found.</p>
        <button
          type="button"
          onClick={() => navigate("/admin/compliance")}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-white/60"
        >
          <FiArrowLeft className="text-[12px]" />
          Back to Compliance
        </button>
      </div>
    );
  }

  const fwInfo = frameworkDescriptions[fw.framework] ?? {
    abbr: fw.full_name,
    desc: fw.full_name,
    purpose: "",
    scope: "",
  };

  const totalViolations = fw.controls.reduce((s, c) => s + c.violations, 0);
  const nonCompliantCtrls = fw.controls.filter((c) => c.status === "non_compliant");

  const navigateToControl = (ctrl: ControlStatus) => {
    navigate(
      `/admin/compliance/${fw.framework.toLowerCase()}/${encodeURIComponent(ctrl.control_id)}`,
      { state: { framework: fw, control: ctrl } }
    );
  };

  const handlePrint = () => window.print();

  return (
    <div className="w-full space-y-4">

      {/* ── Header bar ── */}
      <div
        className="relative overflow-hidden rounded-[18px] bg-white/95 p-5 shadow-sm backdrop-blur dark:bg-[#0d0b1a]/90"
        style={{ border: `1px solid ${currentColor}30` }}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-12 right-8 h-40 w-40 rounded-full blur-3xl" style={{ backgroundColor: `${currentColor}1a` }} />
        </div>
        <div className="relative z-10 flex flex-wrap items-center gap-3">
          {/* Breadcrumb */}
          <button
            type="button"
            onClick={() => navigate("/admin/compliance")}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white/65"
          >
            <FiArrowLeft className="text-[11px]" />
            Compliance
          </button>
          <span className="text-[11px] text-slate-300 dark:text-white/20">/</span>
          <span className="rounded-xl px-3 py-1.5 text-[11px] font-bold" style={{ color: currentColor }}>
            {fw.framework.replace(/_/g, " ")} — Document
          </span>
          <div className="ml-auto">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white/65"
            >
              <FiPrinter className="text-[11px]" />
              Print / Export
            </button>
          </div>
        </div>
      </div>

      {/* ── Document body ── */}
      <div ref={printRef} className="space-y-4">

        {/* Cover section */}
        <div
          className="relative overflow-hidden rounded-2xl p-6 text-white"
          style={{ background: accentGrad }}
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/5" />
            <div className="absolute -bottom-12 -left-8 h-44 w-44 rounded-full bg-white/5" />
          </div>
          <div className="relative z-10 flex flex-wrap items-start justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
                  <FiShield className="text-[22px] text-white" />
                </div>
                <div>
                  <p className="text-[9.5px] font-bold uppercase tracking-[0.2em] text-white/60">COMPLIANCE DOCUMENT</p>
                  <h1 className="text-[20px] font-extrabold text-white">{fw.full_name}</h1>
                </div>
              </div>
              <p className="text-[11.5px] font-medium text-white/75 max-w-md">{fwInfo.desc}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <div className="flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5">
                  <FiCalendar className="text-[10px] text-white/70" />
                  <span className="text-[10.5px] text-white/80">
                    {new Date(generatedAt).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5">
                  <FiLayers className="text-[10px] text-white/70" />
                  <span className="text-[10.5px] text-white/80">{fw.controls.length} Controls</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5">
                  <FiTarget className="text-[10px] text-white/70" />
                  <span className="text-[10.5px] text-white/80">{totalViolations} Total Violations</span>
                </div>
              </div>
            </div>
            <RadialGauge score={fw.score} />
          </div>
        </div>

        {/* About framework */}
        {(fwInfo.purpose || fwInfo.scope) && (
          <div className="rounded-2xl border border-slate-200/70 bg-white p-5 dark:border-white/8 dark:bg-white/3">
            <div className="mb-3 flex items-center gap-2">
              <FiFileText className="text-[13px]" style={{ color: currentColor }} />
              <span className="text-[12.5px] font-bold text-slate-700 dark:text-white/80">เกี่ยวกับ {fwInfo.abbr}</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {fwInfo.purpose && (
                <div>
                  <p className="mb-1 text-[9.5px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">วัตถุประสงค์</p>
                  <p className="text-[11.5px] leading-6 text-slate-600 dark:text-white/60">{fwInfo.purpose}</p>
                </div>
              )}
              {fwInfo.scope && (
                <div>
                  <p className="mb-1 text-[9.5px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">ขอบเขตการใช้งาน</p>
                  <p className="text-[11.5px] leading-6 text-slate-600 dark:text-white/60">{fwInfo.scope}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            {
              label: "Compliance Score",
              value: `${fw.score}%`,
              icon: <FiBarChart2 className="text-[16px]" />,
              color: scoreRingColor(fw.score),
              bg: fw.score >= 80 ? "bg-emerald-50 dark:bg-emerald-500/8" : fw.score >= 60 ? "bg-yellow-50 dark:bg-yellow-500/8" : "bg-red-50 dark:bg-red-500/8",
              border: fw.score >= 80 ? "border-emerald-200 dark:border-emerald-500/20" : fw.score >= 60 ? "border-yellow-200 dark:border-yellow-500/20" : "border-red-200 dark:border-red-500/20",
            },
            {
              label: "Compliant Controls",
              value: `${fw.compliant} / ${fw.total}`,
              icon: <FiCheckCircle className="text-[16px]" />,
              color: "#10b981",
              bg: "bg-emerald-50 dark:bg-emerald-500/8",
              border: "border-emerald-200 dark:border-emerald-500/20",
            },
            {
              label: "Warning Controls",
              value: String(fw.warning),
              icon: <FiAlertTriangle className="text-[16px]" />,
              color: "#eab308",
              bg: "bg-yellow-50 dark:bg-yellow-500/8",
              border: "border-yellow-200 dark:border-yellow-500/20",
            },
            {
              label: "Total Violations",
              value: String(totalViolations),
              icon: <FiAlertOctagon className="text-[16px]" />,
              color: "#ef4444",
              bg: totalViolations > 0 ? "bg-red-50 dark:bg-red-500/8" : "bg-slate-50 dark:bg-white/4",
              border: totalViolations > 0 ? "border-red-200 dark:border-red-500/20" : "border-slate-200/70 dark:border-white/8",
            },
          ].map(({ label, value, icon, color, bg, border }) => (
            <div key={label} className={`rounded-2xl border p-4 ${bg} ${border}`}>
              <div className="mb-2" style={{ color }}>{icon}</div>
              <p className="text-[9.5px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">{label}</p>
              <p className="mt-1 text-[22px] font-extrabold" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Controls table */}
        <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white dark:border-white/8 dark:bg-white/3">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5 dark:border-white/8">
            <FiLayers className="text-[13px]" style={{ color: currentColor }} />
            <span className="text-[12.5px] font-bold text-slate-700 dark:text-white/80">
              รายการควบคุมทั้งหมด
            </span>
            <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-white/8 dark:text-white/40">
              {fw.controls.length}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 dark:border-white/6 dark:bg-white/2">
                  <th className="py-2.5 pl-4 pr-2 text-left text-[9.5px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">#</th>
                  <th className="py-2.5 pr-3 text-left text-[9.5px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">Control ID</th>
                  <th className="py-2.5 pr-3 text-left text-[9.5px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">Control Name</th>
                  <th className="py-2.5 pr-3 text-left text-[9.5px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">Status</th>
                  <th className="py-2.5 pr-3 text-center text-[9.5px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">Violations</th>
                  <th className="py-2.5 pr-4 text-left text-[9.5px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">Action</th>
                </tr>
              </thead>
              <tbody>
                {fw.controls.map((ctrl, i) => (
                  <ControlRow
                    key={ctrl.control_id}
                    ctrl={ctrl}
                    idx={i}
                    accent={currentColor}
                    onDetail={() => navigateToControl(ctrl)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Control detail cards */}
        <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white dark:border-white/8 dark:bg-white/3">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5 dark:border-white/8">
            <FiFileText className="text-[13px]" style={{ color: currentColor }} />
            <span className="text-[12.5px] font-bold text-slate-700 dark:text-white/80">รายละเอียดและคำแนะนำแต่ละ Control</span>
          </div>
          <div className="divide-y divide-slate-100/70 dark:divide-white/5">
            {fw.controls.map((ctrl) => {
              const meta = statusMeta(ctrl.status);
              return (
                <div key={ctrl.control_id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="mt-0.5 shrink-0">{meta.icon}</div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[12px] font-bold text-slate-800 dark:text-white/85">{ctrl.control_id}</span>
                          <span className="text-[11.5px] font-medium text-slate-600 dark:text-white/65">{ctrl.control_name}</span>
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-bold ${meta.badge}`}>
                            {meta.label}
                          </span>
                          {ctrl.violations > 0 && (
                            <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[9.5px] font-bold text-red-700 dark:border-red-500/20 dark:bg-red-500/8 dark:text-red-300">
                              {ctrl.violations} violation{ctrl.violations !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                        {ctrl.detail && (
                          <p className="mt-1.5 text-[11px] leading-5.5 text-slate-500 dark:text-white/45">{ctrl.detail}</p>
                        )}
                        {/* Recommendation */}
                        <div className={[
                          "mt-2.5 rounded-xl border px-3 py-2",
                          ctrl.status === "compliant"
                            ? "border-emerald-100 bg-emerald-50/60 dark:border-emerald-500/12 dark:bg-emerald-500/5"
                            : ctrl.status === "warning"
                            ? "border-yellow-100 bg-yellow-50/60 dark:border-yellow-500/12 dark:bg-yellow-500/5"
                            : "border-red-100 bg-red-50/60 dark:border-red-500/12 dark:bg-red-500/5",
                        ].join(" ")}>
                          <p className={[
                            "text-[9.5px] font-bold uppercase tracking-widest mb-1",
                            ctrl.status === "compliant" ? "text-emerald-600 dark:text-emerald-400"
                              : ctrl.status === "warning" ? "text-yellow-600 dark:text-yellow-400"
                              : "text-red-600 dark:text-red-400",
                          ].join(" ")}>
                            คำแนะนำ
                          </p>
                          <p className="text-[11px] leading-5.5 text-slate-600 dark:text-white/55">
                            {recommendationsByStatus(ctrl)}
                          </p>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigateToControl(ctrl)}
                      className="shrink-0 rounded-xl border px-3 py-1.5 text-[10.5px] font-semibold transition hover:opacity-90"
                      style={{ borderColor: `${currentColor}40`, color: currentColor, backgroundColor: `${currentColor}08` }}
                    >
                      ดูช่องโหว่ →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Non-compliant summary */}
        {nonCompliantCtrls.length > 0 && (
          <div className="rounded-2xl border border-red-200 bg-red-50/60 p-5 dark:border-red-500/20 dark:bg-red-500/5">
            <div className="mb-3 flex items-center gap-2">
              <FiAlertOctagon className="text-[14px] text-red-600 dark:text-red-400" />
              <span className="text-[12.5px] font-bold text-red-700 dark:text-red-300">
                สรุปการแก้ไขเร่งด่วน ({nonCompliantCtrls.length} รายการ)
              </span>
            </div>
            <div className="space-y-2">
              {nonCompliantCtrls.map((c) => (
                <div key={c.control_id} className="flex items-center gap-2.5 rounded-xl border border-red-100 bg-white/80 px-3 py-2.5 dark:border-red-500/15 dark:bg-red-500/5">
                  <FiXCircle className="shrink-0 text-[12px] text-red-500" />
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] font-bold text-red-700 dark:text-red-300">{c.control_id}</span>
                    <span className="ml-2 text-[10.5px] text-red-600/80 dark:text-red-300/70">{c.control_name}</span>
                    {c.violations > 0 && (
                      <span className="ml-2 text-[10px] text-red-500 dark:text-red-400">— {c.violations} violation{c.violations !== 1 ? "s" : ""}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => navigateToControl(c)}
                    className="shrink-0 rounded-lg border border-red-200 bg-white px-2.5 py-1 text-[9.5px] font-semibold text-red-600 transition hover:bg-red-50 dark:border-red-500/20 dark:bg-red-500/8 dark:text-red-300"
                  >
                    แก้ไข →
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer note */}
        <div className="rounded-2xl border border-slate-200/50 bg-slate-50/60 p-4 text-center dark:border-white/6 dark:bg-white/2">
          <p className="text-[10px] text-slate-400 dark:text-white/25">
            เอกสารนี้สร้างโดยอัตโนมัติจากระบบ OpenVAS Security Scanning &nbsp;·&nbsp;
            {new Date(generatedAt).toLocaleString("th-TH")} &nbsp;·&nbsp;
            ข้อมูลอาจเปลี่ยนแปลงตามผลการสแกนล่าสุด
          </p>
        </div>
      </div>
    </div>
  );
};

export default ComplianceDocument;
