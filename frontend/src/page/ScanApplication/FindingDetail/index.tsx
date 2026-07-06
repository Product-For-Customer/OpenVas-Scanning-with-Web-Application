import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  FiArrowLeft, FiShield, FiTag, FiTarget, FiCode,
  FiExternalLink, FiInfo, FiCheckCircle, FiAlertTriangle,
  FiLayers,
} from "react-icons/fi";

import { useLanguage } from "../../../contexts/LanguageContext";
import { useStateContext } from "../../../contexts/ProviderContext";
import type { WebScanFindingDTO, ScanType } from "../../../services/webscan";
import { cweName, cweUrl, wascName, wascUrl } from "../../../data/cweReference";

// ─────────────────────────────────────────────────────────────
// Types & helpers
// ─────────────────────────────────────────────────────────────

type FindingDetailState = {
  finding: WebScanFindingDTO;
  targetName: string;
  targetUrl: string;
  scanType: ScanType;
  startedAt: string;
};

const RISK_COLOR: Record<string, string> = {
  High: "#dc2626", Medium: "#f97316", Low: "#eab308", Informational: "#3b82f6",
};

const riskLabelKey = (risk: string): "scanApp.riskHigh" | "scanApp.riskMedium" | "scanApp.riskLow" | "scanApp.riskInformational" => {
  switch (risk) {
    case "High": return "scanApp.riskHigh";
    case "Medium": return "scanApp.riskMedium";
    case "Low": return "scanApp.riskLow";
    default: return "scanApp.riskInformational";
  }
};

// ─────────────────────────────────────────────────────────────
// Shared UI primitives (mirrors Vulnerability Detail's SideCard/KVRow)
// ─────────────────────────────────────────────────────────────

const KVRow = ({
  label, value, valueClass = "", skip = false,
}: { label: string; value: React.ReactNode; valueClass?: string; skip?: boolean }) => {
  if (skip) return null;
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100/70 py-1.5 last:border-0 dark:border-white/5">
      <span className="shrink-0 text-[10px] text-slate-500 dark:text-white/40">{label}</span>
      <span className={`text-right text-[10.5px] font-medium text-slate-700 break-all dark:text-white/75 ${valueClass}`}>
        {value}
      </span>
    </div>
  );
};

const SideCard = ({
  icon, ib = "border-slate-200/70 dark:border-white/8",
  ibg = "bg-slate-50 dark:bg-white/5",
  ic = "text-slate-500 dark:text-white/45",
  title, children,
}: {
  icon: React.ReactNode; ib?: string; ibg?: string; ic?: string;
  title: string; children: React.ReactNode;
}) => (
  <div className="rounded-xl border border-slate-200/70 bg-white p-4 dark:border-white/8 dark:bg-white/4">
    <div className="mb-3 flex items-center gap-2.5">
      <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl border ${ib} ${ibg} ${ic}`}>
        {icon}
      </div>
      <h3 className="text-[12px] font-bold text-slate-800 dark:text-white/85">{title}</h3>
    </div>
    <div className="divide-y divide-slate-100/70 dark:divide-white/5">{children}</div>
  </div>
);

const TextBlock = ({
  icon, ib, ibg, ic, title, text,
}: {
  icon: React.ReactNode; ib: string; ibg: string; ic: string; title: string; text: string;
}) => (
  <div className="rounded-xl border border-slate-200/70 bg-white p-4 dark:border-white/8 dark:bg-white/4">
    <div className="mb-2.5 flex items-center gap-2.5">
      <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl border ${ib} ${ibg} ${ic}`}>
        {icon}
      </div>
      <h3 className="text-[12.5px] font-bold text-slate-800 dark:text-white/85">{title}</h3>
    </div>
    <p className="whitespace-pre-line text-[12px] leading-relaxed text-slate-600 dark:text-white/60">{text}</p>
  </div>
);

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

const FindingDetail: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { currentColor } = useStateContext();
  const state = (location.state ?? null) as FindingDetailState | null;

  const finding = state?.finding;
  const riskColor = finding ? (RISK_COLOR[finding.risk] ?? RISK_COLOR.Informational) : currentColor;

  const cwe = finding?.cwe_id && finding.cwe_id !== "0" ? finding.cwe_id.trim() : null;
  const wasc = finding?.wasc_id && finding.wasc_id !== "0" ? finding.wasc_id.trim() : null;
  const cweLabel = cwe ? cweName(cwe) : null;
  const wascLabel = wasc ? wascName(wasc) : null;

  // ── Missing state (direct URL visit / refresh) ──────────────
  if (!state || !finding) {
    return (
      <div className="w-full space-y-4">
        <button type="button" onClick={() => navigate("/admin/scan-application")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/8 dark:text-white/60 dark:hover:bg-white/5">
          <FiArrowLeft className="text-[12px]" /> {t("common.back")}
        </button>
        <div className="flex flex-col items-center gap-2 rounded-xl border border-slate-200/70 bg-white py-16 text-center dark:border-white/8 dark:bg-white/4">
          <FiAlertTriangle className="text-[24px] text-slate-300 dark:text-white/20" />
          <p className="text-[13px] font-medium text-slate-500 dark:text-white/40">{t("scanApp.detailErrorMissing")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-5">

      {/* Header */}
      <div className="relative overflow-hidden rounded-[18px] bg-white/95 p-4 shadow-sm backdrop-blur sm:rounded-[22px] sm:p-6 dark:bg-[#0d0b1a]/90"
        style={{ border: `1px solid ${riskColor}30` }}>
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-12 right-10 h-40 w-40 rounded-full blur-3xl" style={{ backgroundColor: `${riskColor}1e` }} />
        </div>
        <div className="relative z-10">
          <button type="button" onClick={() => navigate(-1)} aria-label={t("common.back")}
            className="mb-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11.5px] font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/8">
            <FiArrowLeft className="text-[12px]" /> {t("common.back")}
          </button>

          <div className="flex flex-wrap items-start gap-3 sm:gap-4">
            <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg sm:h-13 sm:w-13"
              style={{ backgroundColor: riskColor, boxShadow: `0 8px 24px -6px ${riskColor}50` }}>
              <FiShield className="text-[20px] sm:text-[22px]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full px-2.5 py-0.5 text-[10.5px] font-bold text-white" style={{ backgroundColor: riskColor }}>
                  {t(riskLabelKey(finding.risk))}
                </span>
                {finding.confidence && (
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:border-white/8 dark:bg-white/5 dark:text-white/40">
                    {t("scanApp.detailConfidence")}: {finding.confidence}
                  </span>
                )}
              </div>
              <h1 className="mt-1.5 text-[17px] font-bold text-slate-900 sm:text-[19px] dark:text-white/90">
                {finding.alert_name}
              </h1>
              <p className="mt-1 flex items-center gap-1.5 text-[11.5px] text-slate-500 dark:text-white/45">
                <FiTarget className="shrink-0 text-[11px]" />
                <span className="font-semibold">{state.targetName}</span>
                {state.targetUrl && <span className="truncate font-mono text-[11px]">· {state.targetUrl}</span>}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Body grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

        {/* Main column */}
        <div className="space-y-4 lg:col-span-2">
          {finding.description && (
            <TextBlock
              icon={<FiInfo className="text-[13px]" />}
              ib="border-sky-200/70 dark:border-sky-500/20" ibg="bg-sky-50 dark:bg-sky-500/10" ic="text-sky-600 dark:text-sky-300"
              title={t("scanApp.detailDescription")} text={finding.description}
            />
          )}

          {finding.solution && (
            <TextBlock
              icon={<FiCheckCircle className="text-[13px]" />}
              ib="border-emerald-200/70 dark:border-emerald-500/20" ibg="bg-emerald-50 dark:bg-emerald-500/10" ic="text-emerald-600 dark:text-emerald-300"
              title={t("scanApp.detailSolution")} text={finding.solution}
            />
          )}

          {finding.attack && (
            <TextBlock
              icon={<FiCode className="text-[13px]" />}
              ib="border-red-200/70 dark:border-red-500/20" ibg="bg-red-50 dark:bg-red-500/10" ic="text-red-600 dark:text-red-300"
              title={t("scanApp.detailAttack")} text={finding.attack}
            />
          )}

          {finding.evidence && (
            <TextBlock
              icon={<FiLayers className="text-[13px]" />}
              ib="border-orange-200/70 dark:border-orange-500/20" ibg="bg-orange-50 dark:bg-orange-500/10" ic="text-orange-600 dark:text-orange-300"
              title={t("scanApp.detailEvidence")} text={finding.evidence}
            />
          )}

          {finding.other_info && (
            <TextBlock
              icon={<FiInfo className="text-[13px]" />}
              ib="border-slate-200/70 dark:border-white/8" ibg="bg-slate-50 dark:bg-white/5" ic="text-slate-500 dark:text-white/45"
              title={t("scanApp.detailOtherInfo")} text={finding.other_info}
            />
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Classification */}
          <SideCard
            icon={<FiTag className="text-[13px]" />}
            ib="border-indigo-200/70 dark:border-indigo-500/20" ibg="bg-indigo-50 dark:bg-indigo-500/10" ic="text-indigo-600 dark:text-indigo-300"
            title={t("scanApp.detailClassificationTitle")}
          >
            <KVRow label={t("scanApp.detailRisk")} value={
              <span className="font-bold" style={{ color: riskColor }}>{finding.risk}</span>
            } />
            <KVRow label={t("scanApp.detailConfidence")} value={finding.confidence || t("scanApp.detailNotProvided")} />
            <KVRow label={t("scanApp.detailMethod")} value={finding.method || t("scanApp.detailNotProvided")} />
            <KVRow label={t("scanApp.detailParameter")} value={finding.param || t("scanApp.detailNotProvided")} />
            <KVRow label={t("scanApp.detailAffectedUrl")} value={
              <span className="font-mono text-[9.5px]">{finding.url || t("scanApp.detailNotProvided")}</span>
            } />
            <KVRow label={t("scanApp.detailAlertRef")} value={finding.alert_ref || t("scanApp.detailNotProvided")} />
            <KVRow label={t("scanApp.detailPluginId")} value={finding.plugin_id || t("scanApp.detailNotProvided")} />

            {cwe && (
              <div className="flex items-start justify-between gap-3 border-b border-slate-100/70 py-1.5 last:border-0 dark:border-white/5">
                <span className="shrink-0 text-[10px] text-slate-500 dark:text-white/40">{t("scanApp.detailCwe")}</span>
                <a href={cweUrl(cwe)} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-right text-[10.5px] font-semibold text-sky-600 hover:underline dark:text-sky-400">
                  <span>CWE-{cwe}{cweLabel ? ` — ${cweLabel}` : ""}</span>
                  <FiExternalLink className="shrink-0 text-[9px]" />
                </a>
              </div>
            )}
            {wasc && (
              <div className="flex items-start justify-between gap-3 border-b border-slate-100/70 py-1.5 last:border-0 dark:border-white/5">
                <span className="shrink-0 text-[10px] text-slate-500 dark:text-white/40">{t("scanApp.detailWasc")}</span>
                <a href={wascUrl()} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-right text-[10.5px] font-semibold text-sky-600 hover:underline dark:text-sky-400">
                  <span>WASC-{wasc}{wascLabel ? ` — ${wascLabel}` : ""}</span>
                  <FiExternalLink className="shrink-0 text-[9px]" />
                </a>
              </div>
            )}
          </SideCard>
        </div>
      </div>
    </div>
  );
};

export default FindingDetail;
