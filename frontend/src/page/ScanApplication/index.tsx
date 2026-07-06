import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { message } from "antd";
import {
  FiGlobe, FiPlus, FiEdit2, FiTrash2, FiPlay, FiSquare,
  FiAlertTriangle, FiCheckCircle, FiChevronDown, FiChevronRight,
  FiX, FiRefreshCw, FiShield, FiClock, FiEye, FiEyeOff, FiArrowRight,
} from "react-icons/fi";
import {
  ListWebScanTargets, CreateWebScanTarget, UpdateWebScanTarget, DeleteWebScanTarget,
  TriggerWebScan, GetWebScanStatus, StopWebScan, ListWebScanResults, ListWebScanFindings,
  type WebScanTargetDTO, type WebScanResultDTO, type WebScanStatusDTO, type WebScanFindingDTO,
  type ScanType,
} from "../../services/webscan";
import { useStateContext } from "../../contexts/ProviderContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useAuth } from "../../contexts/AuthContext";

// ── helpers ────────────────────────────────────────────────────────────────

const fmtDateTime = (iso: string | undefined | null): string => {
  if (!iso || iso === "0001-01-01T00:00:00Z") return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

const RISK_COLOR: Record<string, string> = {
  High: "#dc2626", Medium: "#f97316", Low: "#eab308", Informational: "#3b82f6",
};

// Matches page/ThreatConfig/index.tsx's shared input/label styling exactly,
// so the Target modal reads as the same design system as the Credentials
// modal there rather than a one-off.
const inputCls =
  "w-full rounded-lg border border-slate-200/80 bg-white px-3.5 py-2.5 text-[12.5px] text-slate-700 placeholder-slate-400 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100 dark:border-white/8 dark:bg-white/5 dark:text-white/85 dark:placeholder-white/25 dark:focus:ring-blue-500/10";
const labelCls = "mb-1.5 block text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/35";

// ── Target create/edit modal ────────────────────────────────────────────────

const TargetFormModal: React.FC<{
  initial?: WebScanTargetDTO;
  onCancel: () => void;
  onSaved: (target: WebScanTargetDTO) => void;
}> = ({ initial, onCancel, onSaved }) => {
  const { t } = useLanguage();
  const { currentColor } = useStateContext();
  const accentGrad = `linear-gradient(135deg, ${currentColor}, color-mix(in srgb, ${currentColor} 65%, #a855f7))`;

  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(initial?.name ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [authCookie, setAuthCookie] = useState("");
  const [showCookie, setShowCookie] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const input = { name: name.trim(), url: url.trim(), description: description.trim(), auth_cookie: authCookie.trim() };
      const saved = initial
        ? await UpdateWebScanTarget(initial.id, input)
        : await CreateWebScanTarget(input);
      message.success(t("scanApp.targetSaved"));
      onSaved(saved);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      message.error(msg || t("scanApp.targetSaveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={saving ? undefined : onCancel} />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-[#12101f]"
        style={{ boxShadow: `0 24px 64px -12px ${currentColor}40`, maxHeight: "90dvh", display: "flex", flexDirection: "column" }}>

        {/* Header — matches ThreatConfig's Credential modal: icon badge + eyebrow + title */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/8">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl text-white" style={{ background: accentGrad }}>
              {initial ? <FiEdit2 className="text-[14px]" /> : <FiGlobe className="text-[14px]" />}
            </span>
            <div>
              <p className="text-[9.5px] font-bold uppercase tracking-widest" style={{ color: currentColor }}>{t("scanApp.targetsHeading")}</p>
              <h3 className="text-[14px] font-bold text-slate-800 dark:text-white/90">
                {initial ? t("scanApp.editTarget") : t("scanApp.addTarget")}
              </h3>
            </div>
          </div>
          <button type="button" onClick={onCancel} disabled={saving}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:text-white/35 dark:hover:bg-white/8 focus:outline-none disabled:opacity-40">
            <FiX className="text-[15px]" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          <div>
            <label className={labelCls}>{t("scanApp.targetName")} <span className="text-red-400">*</span></label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder={t("scanApp.targetNamePlaceholder")} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{t("scanApp.targetUrl")} <span className="text-red-400">*</span></label>
            <input type="text" value={url} onChange={(e) => setUrl(e.target.value)}
              placeholder="https://intranet.example.local" className={inputCls} />
            <p className="mt-1 text-[10.5px] text-slate-400 dark:text-white/30">{t("scanApp.targetUrlHint")}</p>
          </div>
          <div>
            <label className={labelCls}>{t("scanApp.targetDescription")}</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder={t("threatConfig.optionalDescriptionPlaceholder")} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{t("scanApp.authCookie")}</label>
            <div className="relative">
              <input
                type={showCookie ? "text" : "password"}
                value={authCookie}
                onChange={(e) => setAuthCookie(e.target.value)}
                placeholder={initial?.has_auth_cookie ? t("scanApp.authCookieKeepPlaceholder") : t("scanApp.authCookiePlaceholder")}
                className={`${inputCls} pr-10 font-mono text-[11.5px]`}
              />
              <button type="button" onClick={() => setShowCookie((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-white/30 focus:outline-none">
                {showCookie ? <FiEyeOff className="text-[13px]" /> : <FiEye className="text-[13px]" />}
              </button>
            </div>
            <p className="mt-1 text-[10.5px] text-slate-400 dark:text-white/30">{t("scanApp.authCookieHint")}</p>
            {initial?.has_auth_cookie && (
              <p className="mt-1 flex items-center gap-1 text-[10.5px] text-emerald-600 dark:text-emerald-400">
                <FiCheckCircle className="text-[10px]" /> {t("scanApp.authCookieConfigured")}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 gap-2 border-t border-slate-100 px-5 py-4 dark:border-white/8">
          <button type="button" onClick={onCancel} disabled={saving}
            className="flex-1 rounded-xl border border-slate-200 py-2 text-[12.5px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/8 dark:text-white/55 dark:hover:bg-white/5 focus:outline-none disabled:opacity-50">
            {t("common.cancel")}
          </button>
          <button type="button" onClick={() => void handleSave()} disabled={saving || !name.trim() || !url.trim()}
            style={{ background: accentGrad }}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-[12.5px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none">
            {saving && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
            {initial ? t("common.update") : t("common.save")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ── Trigger scan modal (Baseline vs Full, with an explicit, server-enforced
// confirmation step for Full since it sends real attack payloads) ─────────

const TriggerScanModal: React.FC<{
  target: WebScanTargetDTO;
  onCancel: () => void;
  onTriggered: () => void;
}> = ({ target, onCancel, onTriggered }) => {
  const { t } = useLanguage();
  const [scanType, setScanType] = useState<ScanType>("baseline");
  const [confirmed, setConfirmed] = useState(false);
  const [starting, setStarting] = useState(false);

  const handleStart = async () => {
    setStarting(true);
    try {
      await TriggerWebScan(target.id, scanType, scanType === "full" && confirmed);
      message.success(t("scanApp.scanStarted"));
      onTriggered();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      message.error(msg || t("scanApp.scanStartFailed"));
    } finally {
      setStarting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={starting ? undefined : onCancel} />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-[#12101f]">
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4 dark:border-white/8">
          <div>
            <h3 className="text-sm font-bold text-gray-800 dark:text-white/90">{t("scanApp.startScan")}</h3>
            <p className="mt-0.5 max-w-xs truncate text-[11.5px] text-gray-400 dark:text-white/35">{target.name}</p>
          </div>
          <button type="button" onClick={onCancel} disabled={starting}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 disabled:opacity-40 dark:text-white/35 dark:hover:bg-white/8">
            <FiX />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <button type="button" onClick={() => { setScanType("baseline"); setConfirmed(false); }}
            className={[
              "w-full rounded-xl border p-3.5 text-left transition",
              scanType === "baseline"
                ? "border-blue-400 bg-blue-50 dark:border-blue-400/50 dark:bg-blue-500/10"
                : "border-gray-200 hover:bg-gray-50 dark:border-white/8 dark:hover:bg-white/5",
            ].join(" ")}
          >
            <p className="text-[13px] font-semibold text-gray-800 dark:text-white/85">{t("scanApp.baselineScan")}</p>
            <p className="mt-0.5 text-[11.5px] text-gray-500 dark:text-white/45">{t("scanApp.baselineScanDesc")}</p>
          </button>

          <button type="button" onClick={() => setScanType("full")}
            className={[
              "w-full rounded-xl border p-3.5 text-left transition",
              scanType === "full"
                ? "border-red-400 bg-red-50 dark:border-red-400/50 dark:bg-red-500/10"
                : "border-gray-200 hover:bg-gray-50 dark:border-white/8 dark:hover:bg-white/5",
            ].join(" ")}
          >
            <p className="text-[13px] font-semibold text-gray-800 dark:text-white/85">{t("scanApp.fullScan")}</p>
            <p className="mt-0.5 text-[11.5px] text-gray-500 dark:text-white/45">{t("scanApp.fullScanDesc")}</p>
          </button>

          {scanType === "full" && (
            <div className="rounded-xl border border-red-200 bg-red-50/70 p-3.5 dark:border-red-500/20 dark:bg-red-500/10">
              <div className="flex items-start gap-2">
                <FiAlertTriangle className="mt-0.5 shrink-0 text-[13px] text-red-500" />
                <p className="text-[11.5px] text-red-700 dark:text-red-300">{t("scanApp.fullScanWarning")}</p>
              </div>
              <label className="mt-2.5 flex cursor-pointer items-start gap-2 text-[11.5px] text-red-700 dark:text-red-300">
                <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-0.5" />
                {t("scanApp.fullScanConfirm")}
              </label>
            </div>
          )}
        </div>

        <div className="flex gap-2.5 border-t border-gray-100 px-5 py-3.5 dark:border-white/8">
          <button type="button" onClick={onCancel} disabled={starting}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-[12.5px] font-semibold text-gray-600 transition hover:bg-gray-50 disabled:opacity-50 dark:border-white/8 dark:text-white/55 dark:hover:bg-white/5">
            {t("common.cancel")}
          </button>
          <button type="button" onClick={() => void handleStart()}
            disabled={starting || (scanType === "full" && !confirmed)}
            className="flex-1 rounded-xl bg-blue-500 py-2.5 text-[12.5px] font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50">
            {starting ? t("scanApp.starting") : t("scanApp.startScan")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ── Findings list (used inline under an expanded result row) ──────────────

const RISK_LEVELS = ["All", "High", "Medium", "Low", "Informational"] as const;
type RiskFilter = (typeof RISK_LEVELS)[number];

const riskLevelLabelKey = (level: RiskFilter) => {
  switch (level) {
    case "All": return "scanApp.riskAll";
    case "High": return "scanApp.riskHigh";
    case "Medium": return "scanApp.riskMedium";
    case "Low": return "scanApp.riskLow";
    default: return "scanApp.riskInformational";
  }
};

const FindingsList: React.FC<{
  resultId: number;
  targetName: string;
  targetUrl: string;
  scanType: ScanType;
  startedAt: string;
}> = ({ resultId, targetName, targetUrl, scanType, startedAt }) => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [findings, setFindings] = useState<WebScanFindingDTO[] | null>(null);
  const [levelFilter, setLevelFilter] = useState<RiskFilter>("All");

  useEffect(() => {
    let ignore = false;
    void ListWebScanFindings(resultId).then((rows) => {
      if (!ignore) setFindings(rows);
    });
    return () => { ignore = true; };
  }, [resultId]);

  if (findings === null) {
    return <p className="text-[11.5px] text-slate-400 dark:text-white/35">{t("scanApp.loadingFindings")}</p>;
  }
  if (findings.length === 0) {
    return <p className="text-[11.5px] text-slate-400 dark:text-white/35">{t("scanApp.noFindings")}</p>;
  }

  const filtered = levelFilter === "All" ? findings : findings.filter((f) => f.risk === levelFilter);

  return (
    <div className="space-y-3">
      {/* Risk-level filter tabs — same pattern as HostDetail's vulnerability
          level filter, with a live count per level so the numbers are
          visible before even clicking a tab. */}
      <div className="flex flex-wrap gap-1.5">
        {RISK_LEVELS.map((level) => {
          const active = level === levelFilter;
          const count = level === "All" ? findings.length : findings.filter((f) => f.risk === level).length;
          const color = level === "All" ? undefined : RISK_COLOR[level];
          return (
            <button
              key={level}
              type="button"
              onClick={() => setLevelFilter(level)}
              className={[
                "rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
                active
                  ? level === "All"
                    ? "border-slate-800 bg-slate-800 text-white dark:border-white dark:bg-white dark:text-slate-900"
                    : ""
                  : "border-slate-200 bg-transparent text-slate-500 hover:border-slate-400 dark:border-white/10 dark:text-white/40",
              ].join(" ")}
              style={active && color ? { borderColor: color, backgroundColor: `${color}18`, color } : undefined}
            >
              {t(riskLevelLabelKey(level))} ({count})
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="text-[11.5px] text-slate-400 dark:text-white/35">{t("scanApp.noFindingsForLevel")}</p>
      ) : (
      <div className="space-y-2">
      {filtered.map((f) => (
        <div key={f.id} className="rounded-lg border border-slate-200/70 bg-white px-3 py-2.5 dark:border-white/8 dark:bg-white/3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded px-1.5 py-0.5 text-[10.5px] font-bold" style={{ backgroundColor: `${RISK_COLOR[f.risk] ?? RISK_COLOR.Informational}18`, color: RISK_COLOR[f.risk] ?? RISK_COLOR.Informational }}>
              {f.risk}
            </span>
            <span className="text-[12.5px] font-semibold text-slate-700 dark:text-white/80">{f.alert_name}</span>
            {f.cwe_id && f.cwe_id !== "0" && (
              <span className="text-[10.5px] text-slate-400 dark:text-white/30">CWE-{f.cwe_id}</span>
            )}
          </div>
          {f.url && <p className="mt-1 truncate font-mono text-[11px] text-slate-500 dark:text-white/45">{f.url}{f.param ? ` (${f.param})` : ""}</p>}
          {f.description && <p className="mt-1 line-clamp-2 text-[11.5px] text-slate-500 dark:text-white/45">{f.description}</p>}
          {f.solution && (
            <p className="mt-1 line-clamp-1 text-[11.5px] text-emerald-600 dark:text-emerald-400">
              <span className="font-semibold">{t("scanApp.solution")}: </span>{f.solution}
            </p>
          )}
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() =>
                navigate("/admin/scan-application/finding-detail", {
                  state: { finding: f, targetName, targetUrl, scanType, startedAt },
                })
              }
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/8 dark:text-white/60 dark:hover:bg-white/5"
            >
              {t("scanApp.detailButton")} <FiArrowRight className="text-[10px]" />
            </button>
          </div>
        </div>
      ))}
      </div>
      )}
    </div>
  );
};

// ── Main page ────────────────────────────────────────────────────────────

const ScanApplicationPage: React.FC = () => {
  const { currentColor } = useStateContext();
  const { t } = useLanguage();
  const { can } = useAuth();
  const canManage = can("threat_intel", "manage");
  const accentGrad = `linear-gradient(135deg, ${currentColor}, color-mix(in srgb, ${currentColor} 65%, #a855f7))`;

  const [targets, setTargets] = useState<WebScanTargetDTO[]>([]);
  const [results, setResults] = useState<WebScanResultDTO[]>([]);
  const [scanStatus, setScanStatus] = useState<WebScanStatusDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedResult, setExpandedResult] = useState<number | null>(null);

  const [targetModal, setTargetModal] = useState<{ mode: "create" | "edit"; target?: WebScanTargetDTO } | null>(null);
  const [scanModalTarget, setScanModalTarget] = useState<WebScanTargetDTO | null>(null);
  const [deleteBusyId, setDeleteBusyId] = useState<number | null>(null);
  const [stopping, setStopping] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const hasFetched = useRef(false);
  const pollTimer = useRef<number | null>(null);
  const tickTimer = useRef<number | null>(null);

  const fetchAll = useCallback(async () => {
    const [targetsRes, resultsRes, statusRes] = await Promise.all([
      ListWebScanTargets(), ListWebScanResults(), GetWebScanStatus(),
    ]);
    setTargets(targetsRes);
    setResults(resultsRes);
    setScanStatus(statusRes);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    void fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (scanStatus?.is_running) {
      pollTimer.current = window.setInterval(() => void fetchAll(), 3000);
    }
    return () => { if (pollTimer.current) window.clearInterval(pollTimer.current); };
  }, [scanStatus?.is_running, fetchAll]);

  useEffect(() => {
    const startedAt = scanStatus?.data?.started_at;
    if (!scanStatus?.is_running || !startedAt) {
      setElapsedSeconds(0);
      return;
    }
    const startMs = new Date(startedAt).getTime();
    const tick = () => setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    tick();
    tickTimer.current = window.setInterval(tick, 1000);
    return () => { if (tickTimer.current) window.clearInterval(tickTimer.current); };
  }, [scanStatus?.is_running, scanStatus?.data?.started_at]);

  const handleDeleteTarget = async (id: number) => {
    setDeleteBusyId(id);
    try {
      await DeleteWebScanTarget(id);
      setTargets((prev) => prev.filter((t) => t.id !== id));
      message.success(t("scanApp.targetDeleted"));
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      message.error(msg || t("scanApp.targetDeleteFailed"));
    } finally {
      setDeleteBusyId(null);
    }
  };

  const handleStop = async () => {
    setStopping(true);
    try {
      await StopWebScan();
      message.success(t("scanApp.scanStopped"));
      void fetchAll();
    } catch {
      message.error(t("scanApp.scanStopFailed"));
    } finally {
      setStopping(false);
    }
  };

  const targetName = (targetId: number) => targets.find((t) => t.id === targetId)?.name ?? `#${targetId}`;

  const runningResult = scanStatus?.is_running ? scanStatus.data : undefined;
  const runningPhaseProgress = runningResult
    ? (runningResult.status === "active_scanning" ? runningResult.active_progress : runningResult.spider_progress)
    : 0;

  return (
    <div className="w-full space-y-5">

      {/* Header card */}
      <div
        className="relative overflow-hidden rounded-[18px] bg-white/95 p-4 shadow-sm backdrop-blur sm:rounded-[22px] sm:p-6 dark:bg-[#0d0b1a]/90"
        style={{ border: `1px solid ${currentColor}30` }}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-12 right-10 h-40 w-40 rounded-full blur-3xl" style={{ backgroundColor: `${currentColor}1e` }} />
        </div>
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg sm:h-13 sm:w-13"
              style={{ background: accentGrad, boxShadow: `0 8px 24px -6px ${currentColor}50` }}>
              <FiGlobe className="text-[20px] sm:text-[22px]" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] sm:text-[10.5px]" style={{ color: currentColor }}>
                {t("scanApp.kicker")}
              </p>
              <h1 className="truncate text-[18px] font-bold text-slate-900 sm:text-[20px] dark:text-white/90">
                {t("scanApp.title")}
              </h1>
              <p className="mt-0.5 text-[11px] text-slate-500 sm:text-[12px] dark:text-white/45">
                {t("scanApp.subtitle")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void fetchAll()} disabled={loading}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200/70 bg-white text-slate-500 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/8 dark:bg-white/5 dark:text-white/50">
              <FiRefreshCw className={`text-[13px] ${loading ? "animate-spin" : ""}`} />
            </button>
            {canManage && (
              <button type="button" onClick={() => setTargetModal({ mode: "create" })}
                style={{ background: accentGrad }}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white transition hover:opacity-90">
                <FiPlus className="text-[11px]" /> {t("scanApp.addTarget")}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Running-scan banner */}
      {runningResult && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-3.5 dark:border-blue-500/20 dark:bg-blue-500/10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <FiRefreshCw className="animate-spin text-[14px] text-blue-600 dark:text-blue-300" />
              <div>
                <p className="text-[12.5px] font-semibold text-blue-800 dark:text-blue-200">
                  {t(runningResult.status === "active_scanning" ? "scanApp.phaseActive" : "scanApp.phaseSpider")} — {targetName(runningResult.target_id)}
                </p>
                <p className="text-[11px] text-blue-600 dark:text-blue-300/70">
                  {runningPhaseProgress}% · {elapsedSeconds}s {t("scanApp.elapsed")}
                </p>
              </div>
            </div>
            {canManage && (
              <button type="button" onClick={() => void handleStop()} disabled={stopping}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-500/20 dark:bg-transparent dark:text-red-300">
                <FiSquare className="text-[10px]" /> {t("scanApp.stopScan")}
              </button>
            )}
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-blue-100 dark:bg-blue-500/10">
            <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${runningPhaseProgress}%` }} />
          </div>
        </div>
      )}

      {/* Targets */}
      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white dark:border-white/8 dark:bg-[#0d0b1a]/60">
        <div className="border-b border-slate-100 px-4 py-3 dark:border-white/8">
          <p className="text-[13px] font-bold text-slate-800 dark:text-white/90">{t("scanApp.targetsHeading")}</p>
        </div>
        {loading ? (
          <div className="h-20 animate-pulse bg-slate-50 dark:bg-white/3" />
        ) : targets.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <FiGlobe className="text-[22px] text-slate-300 dark:text-white/20" />
            <p className="text-[12.5px] font-medium text-slate-500 dark:text-white/40">{t("scanApp.noTargets")}</p>
            <p className="text-[11px] text-slate-400 dark:text-white/30">{t("scanApp.noTargetsHint")}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100/70 dark:divide-white/5">
            {targets.map((target) => (
              <div key={target.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-[13px] font-semibold text-slate-800 dark:text-white/85">{target.name}</p>
                    {target.has_auth_cookie && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9.5px] font-semibold text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                        <FiCheckCircle className="text-[8px]" /> {t("scanApp.authenticated")}
                      </span>
                    )}
                  </div>
                  <p className="truncate font-mono text-[11.5px] text-slate-500 dark:text-white/45">{target.url}</p>
                  {target.description && (
                    <p className="mt-0.5 truncate text-[11px] text-slate-400 dark:text-white/30">{target.description}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {canManage && (
                    <button type="button" onClick={() => setScanModalTarget(target)}
                      disabled={!!scanStatus?.is_running}
                      style={{ background: accentGrad }}
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
                      <FiPlay className="text-[10px]" /> {t("scanApp.scan")}
                    </button>
                  )}
                  {canManage && (
                    <>
                      <button type="button" onClick={() => setTargetModal({ mode: "edit", target })}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 dark:border-white/8 dark:text-white/50 dark:hover:bg-white/5">
                        <FiEdit2 className="text-[12px]" />
                      </button>
                      <button type="button" onClick={() => void handleDeleteTarget(target.id)}
                        disabled={deleteBusyId === target.id || !!scanStatus?.is_running}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-40 dark:border-white/8 dark:text-white/50">
                        <FiTrash2 className="text-[12px]" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Results */}
      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white dark:border-white/8 dark:bg-[#0d0b1a]/60">
        <div className="border-b border-slate-100 px-4 py-3 dark:border-white/8">
          <p className="text-[13px] font-bold text-slate-800 dark:text-white/90">{t("scanApp.resultsHeading")}</p>
        </div>
        {loading ? (
          <div className="h-20 animate-pulse bg-slate-50 dark:bg-white/3" />
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <FiShield className="text-[22px] text-slate-300 dark:text-white/20" />
            <p className="text-[12.5px] font-medium text-slate-500 dark:text-white/40">{t("scanApp.noResults")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-180">
              <thead>
                <tr className="border-b border-slate-100 dark:border-white/8">
                  {[t("scanApp.colTarget"), t("scanApp.colType"), "H", "M", "L", "I", t("scanApp.colStarted"), t("scanApp.colStatus")].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/70 dark:divide-white/5">
                {results.map((r) => {
                  const isExpanded = expandedResult === r.id;
                  const isDone = r.status === "completed" || r.status === "failed" || r.status === "stopped";
                  return (
                    <React.Fragment key={r.id}>
                      <tr
                        className={`transition-colors hover:bg-slate-50/60 dark:hover:bg-white/2 ${isDone ? "cursor-pointer" : ""}`}
                        onClick={() => isDone && setExpandedResult(isExpanded ? null : r.id)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {isDone ? (isExpanded ? <FiChevronDown className="shrink-0 text-[11px] text-slate-400" /> : <FiChevronRight className="shrink-0 text-[11px] text-slate-400" />) : <span className="w-[11px]" />}
                            <span className="truncate text-[12.5px] font-medium text-slate-700 dark:text-white/80">{targetName(r.target_id)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[12px] capitalize text-slate-500 dark:text-white/45">{r.scan_type}</td>
                        <td className="px-4 py-3"><span className="text-[12px] font-bold" style={{ color: r.high > 0 ? RISK_COLOR.High : undefined }}>{r.high}</span></td>
                        <td className="px-4 py-3"><span className="text-[12px] font-bold" style={{ color: r.medium > 0 ? RISK_COLOR.Medium : undefined }}>{r.medium}</span></td>
                        <td className="px-4 py-3"><span className="text-[12px] font-bold" style={{ color: r.low > 0 ? RISK_COLOR.Low : undefined }}>{r.low}</span></td>
                        <td className="px-4 py-3 text-[12px] text-slate-400 dark:text-white/35">{r.informational}</td>
                        <td className="px-4 py-3 text-[12px] text-slate-500 dark:text-white/45">{fmtDateTime(r.started_at)}</td>
                        <td className="px-4 py-3">
                          {r.status === "completed" && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                              <FiCheckCircle className="text-[9px]" /> {t("scanApp.statusCompleted")}
                            </span>
                          )}
                          {r.status === "failed" && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10.5px] font-semibold text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                              <FiAlertTriangle className="text-[9px]" /> {t("scanApp.statusFailed")}
                            </span>
                          )}
                          {r.status === "stopped" && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10.5px] font-semibold text-slate-500 dark:border-white/8 dark:bg-white/5 dark:text-white/40">
                              <FiSquare className="text-[9px]" /> {t("scanApp.statusStopped")}
                            </span>
                          )}
                          {(r.status === "spidering" || r.status === "active_scanning") && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10.5px] font-semibold text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
                              <FiRefreshCw className="animate-spin text-[9px]" /> {t("scanApp.statusRunning")}
                            </span>
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={8} className="border-t border-slate-100 bg-slate-50/60 px-4 py-3 dark:border-white/8 dark:bg-white/2">
                            {r.status === "failed" ? (
                              <p className="flex items-start gap-2 text-[11.5px] text-red-500 dark:text-red-400">
                                <FiAlertTriangle className="mt-0.5 shrink-0 text-[12px]" /> {r.error_message}
                              </p>
                            ) : (
                              <FindingsList
                                resultId={r.id}
                                targetName={targetName(r.target_id)}
                                targetUrl={targets.find((tg) => tg.id === r.target_id)?.url ?? ""}
                                scanType={r.scan_type}
                                startedAt={r.started_at}
                              />
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Security note */}
      <div className="flex items-start gap-2.5 rounded-xl border border-slate-200/70 bg-slate-50/60 px-4 py-3.5 dark:border-white/8 dark:bg-white/3">
        <FiClock className="mt-0.5 shrink-0 text-[13px] text-slate-400 dark:text-white/30" />
        <p className="text-[11.5px] text-slate-500 dark:text-white/45">{t("scanApp.footerNote")}</p>
      </div>

      {targetModal && (
        <TargetFormModal
          initial={targetModal.mode === "edit" ? targetModal.target : undefined}
          onCancel={() => setTargetModal(null)}
          onSaved={(saved) => {
            setTargets((prev) => {
              const exists = prev.some((t) => t.id === saved.id);
              return exists ? prev.map((t) => (t.id === saved.id ? saved : t)) : [saved, ...prev];
            });
            setTargetModal(null);
          }}
        />
      )}

      {scanModalTarget && (
        <TriggerScanModal
          target={scanModalTarget}
          onCancel={() => setScanModalTarget(null)}
          onTriggered={() => {
            setScanModalTarget(null);
            void fetchAll();
          }}
        />
      )}
    </div>
  );
};

export default ScanApplicationPage;
