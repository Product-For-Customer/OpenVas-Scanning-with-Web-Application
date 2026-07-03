import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { message } from "antd";
import { useNavigate } from "react-router-dom";
import {
  FiSearch,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiX,
  FiRefreshCw,
  FiLink2,
  FiEye,
  FiEyeOff,
  FiCopy,
  FiType,
  FiLayers,
  FiLock,
  FiSave,
  FiArrowLeft,
  FiChevronLeft,
  FiChevronRight,
  FiCheckCircle,
} from "react-icons/fi";
import { SiLine } from "react-icons/si";
import {
  ListAppLineMaster,
  CreateAppLineMaster,
  UpdateAppLineMasterByID,
  DeleteAppLineMasterByID,
  UpdateAppSetting,
  type AppLineMasterResponse,
} from "../../../services";
import { useLanguage } from "../../../contexts/LanguageContext";
import { useStateContext } from "../../../contexts/ProviderContext";
import { useAuth } from "../../../contexts/AuthContext";
import type { TranslationKey } from "../../../locales";

type FormMode = "create" | "edit";

type TFn = (key: TranslationKey, vars?: Record<string, string | number>) => string;

type LineMasterFormData = {
  name: string;
  description: string;
  token: string;
};

type UiApp = {
  id: number;
  name: string;
  token: string;
  app_user_id: number;
  category: string;
  description: string;
};

const normalizeText = (value?: string | null) => (value || "").trim();

const getCategoryFromName = (name: string, t: TFn) => {
  const lower = normalizeText(name).toLowerCase();

  if (lower.includes("slack")) return t("line.categorySocialAuthority");
  if (lower.includes("google") || lower.includes("meet")) return t("line.categoryManagement");
  if (lower.includes("tiktok")) return t("line.categoryEntertainment");
  if (lower.includes("excel") || lower.includes("microsoft")) return t("line.categoryAnalytics");
  if (lower.includes("mail")) return t("line.categoryBusiness");
  if (lower.includes("youtube")) return t("line.categoryEntertainment");
  if (lower.includes("line")) return t("line.categoryMessaging");
  if (lower.includes("notify")) return t("line.categoryNotification");
  return t("line.categoryIntegration");
};

const getDescriptionFromName = (name: string, t: TFn) => {
  const lower = normalizeText(name).toLowerCase();

  if (lower.includes("slack")) {
    return t("line.descSlackIntegration");
  }
  if (lower.includes("google") || lower.includes("meet")) {
    return t("line.descGoogleIntegration");
  }
  if (lower.includes("tiktok")) {
    return t("line.descTiktokIntegration");
  }
  if (lower.includes("excel") || lower.includes("microsoft")) {
    return t("line.descMicrosoftIntegration");
  }
  if (lower.includes("mail")) {
    return t("line.descMailIntegration");
  }
  if (lower.includes("youtube")) {
    return t("line.descYoutubeIntegration");
  }
  if (lower.includes("line")) {
    return t("line.descLineIntegration");
  }

  return t("line.descGenericIntegration");
};

const mapToUiApp = (item: AppLineMasterResponse, t: TFn): UiApp => ({
  id: item.id,
  name: item.name,
  token: item.token,
  app_user_id: Number(item.app_user_id ?? 0),
  category: getCategoryFromName(item.name, t),
  description: normalizeText(item.description) || getDescriptionFromName(item.name, t),
});

const modalBackdropClass =
  "fixed inset-0 z-9999 flex items-center justify-center bg-black/55 p-4";

const modalCardClass =
  "relative w-full overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-xl dark:border-white/10 dark:bg-[#0d0b1a]";

const formLabelClass =
  "mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-white/40";

const formInputClass = [
  "h-9 w-full rounded-xl border px-3.5 text-[12px] outline-none transition",
  "border-slate-200/80 bg-white text-slate-800 placeholder:text-slate-400",
  "focus:ring-2 focus:ring-cyan-200 focus:border-cyan-400",
  "dark:border-white/10 dark:bg-white/5 dark:text-white/85 dark:placeholder:text-white/35",
  "dark:focus:ring-white/10 dark:focus:border-cyan-400/30",
  "disabled:cursor-not-allowed disabled:opacity-60",
].join(" ");

const formTextareaClass = [
  "w-full min-h-18 rounded-xl border px-3.5 py-2.5 text-[12px] outline-none transition resize-none",
  "border-slate-200/80 bg-white text-slate-800 placeholder:text-slate-400",
  "focus:ring-2 focus:ring-cyan-200 focus:border-cyan-400",
  "dark:border-white/10 dark:bg-white/5 dark:text-white/85 dark:placeholder:text-white/35",
  "dark:focus:ring-white/10 dark:focus:border-cyan-400/30",
].join(" ");

const ActionButton: React.FC<{
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
}> = ({ onClick, children, className = "", type = "button", disabled = false }) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={[
        "inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-[12px] font-medium transition",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
};

const Index: React.FC = () => {
  const { t } = useLanguage();
  const { currentColor } = useStateContext();
  const { can } = useAuth();
  const canManage = can("line_management", "manage");
  const navigate = useNavigate();
  const accentGrad = `linear-gradient(135deg, ${currentColor}, color-mix(in srgb, ${currentColor} 65%, #a855f7))`;

  const [lineMasters, setLineMasters] = useState<AppLineMasterResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 5;

  const [masterFormOpen, setMasterFormOpen] = useState(false);
  const [masterFormMode, setMasterFormMode] = useState<FormMode>("create");
  const [masterSubmitting, setMasterSubmitting] = useState(false);
  const [masterFormError, setMasterFormError] = useState("");
  const [editingMaster, setEditingMaster] = useState<AppLineMasterResponse | null>(null);
  const [masterFormData, setMasterFormData] = useState<LineMasterFormData>({
    name: "",
    description: "",
    token: "",
  });
  const [showToken, setShowToken] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  const [masterDeleteOpen, setMasterDeleteOpen] = useState(false);
  const [masterDeleteTarget, setMasterDeleteTarget] =
    useState<AppLineMasterResponse | null>(null);
  const [masterDeleteError, setMasterDeleteError] = useState("");
  const [masterDeleting, setMasterDeleting] = useState(false);

  const [webhookSecret, setWebhookSecret] = useState("");
  const [webhookSecretSaving, setWebhookSecretSaving] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);

  const handleSaveWebhookSecret = useCallback(async () => {
    const value = normalizeText(webhookSecret);
    if (!value) return;

    setWebhookSecretSaving(true);
    try {
      await UpdateAppSetting("line_channel_secret", value);
      message.success(t("line.webhookSecretSaved"));
      setWebhookSecret("");
    } catch (err) {
      console.error("save webhook secret error:", err);
      message.error(t("line.webhookSecretSaveFailed"));
    } finally {
      setWebhookSecretSaving(false);
    }
  }, [webhookSecret, t]);

  const masterFormSnapshot = useMemo(
    () =>
      JSON.stringify({
        name: normalizeText(masterFormData.name),
        description: normalizeText(masterFormData.description),
        token: normalizeText(masterFormData.token),
      }),
    [masterFormData],
  );

  const editingMasterSnapshot = useMemo(
    () =>
      editingMaster
        ? JSON.stringify({
            name: normalizeText(editingMaster.name || ""),
            description: normalizeText(editingMaster.description || ""),
            token: normalizeText(editingMaster.token || ""),
          })
        : "",
    [editingMaster],
  );

  const isBotEditChanged =
    masterFormMode === "create"
      ? true
      : Boolean(editingMaster) && masterFormSnapshot !== editingMasterSnapshot;

  const uiLineMasters = useMemo(
    () => lineMasters.map((item) => mapToUiApp(item, t)),
    [lineMasters, t],
  );

  const filteredLineMasters = useMemo(() => {
    const q = search.trim().toLowerCase();

    return uiLineMasters.filter((item) => {
      const blob = [
        item.name,
        item.category,
        item.description,
        String(item.app_user_id || ""),
      ].join(" ").toLowerCase();
      return blob.includes(q);
    });
  }, [uiLineMasters, search]);

  const totalPages = Math.max(1, Math.ceil(filteredLineMasters.length / PAGE_SIZE));
  const pagedLineMasters = filteredLineMasters.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  useEffect(() => {
    setPage(1);
  }, [search]);

  const maskToken = (token: string) => {
    const clean = normalizeText(token);
    if (!clean) return "—";
    if (clean.length <= 4) return "••••";
    return `${"•".repeat(8)}${clean.slice(-4)}`;
  };

  const fetchLineMasters = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");

      const data = await ListAppLineMaster();

      if (!data) {
        setLineMasters([]);
        setError(t("line.unableLoadIntegrations"));
        return;
      }

      setLineMasters(data);
    } catch (err) {
      console.error("fetchLineMasters error:", err);
      setLineMasters([]);
      setError(t("line.errorLoadingIntegrations"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    void fetchLineMasters();
  }, [fetchLineMasters]);

  const openCreateMasterModal = () => {
    setMasterFormMode("create");
    setEditingMaster(null);
    setMasterFormData({ name: "", description: "", token: "" });
    setShowToken(false);
    setCopiedToken(false);
    setMasterFormError("");
    setMasterFormOpen(true);
  };

  const openEditMasterModal = (item: AppLineMasterResponse) => {
    setMasterFormMode("edit");
    setEditingMaster(item);
    setMasterFormData({
      name: item.name || "",
      description: item.description || "",
      token: item.token || "",
    });
    setShowToken(false);
    setCopiedToken(false);
    setMasterFormError("");
    setMasterFormOpen(true);
  };

  const closeMasterFormModal = () => {
    if (masterSubmitting) return;
    setMasterFormOpen(false);
    setMasterFormError("");
    setEditingMaster(null);
    setShowToken(false);
    setCopiedToken(false);
  };

  const validateMasterForm = () => {
    const name = normalizeText(masterFormData.name);
    const description = normalizeText(masterFormData.description);
    const token = normalizeText(masterFormData.token);

    if (!name) return t("line.pleaseEnterIntegrationName");
    if (name.length < 2) return t("line.integrationNameMinLength");
    if (!description) return t("line.pleaseEnterDescription");
    if (description.length < 2) return t("line.descriptionMinLength");
    if (!token) return t("line.pleaseEnterToken");
    if (token.length < 6) return t("line.tokenMinLength");

    return "";
  };

  const handleCopyToken = async () => {
    const token = normalizeText(masterFormData.token);
    if (!token) return;

    try {
      await navigator.clipboard.writeText(token);
      setCopiedToken(true);
      window.setTimeout(() => setCopiedToken(false), 1500);
    } catch (err) {
      console.error("copy token error:", err);
    }
  };

  const handleSubmitMaster = async () => {
    const validationError = validateMasterForm();
    if (validationError) {
      setMasterFormError(validationError);
      return;
    }

    try {
      setMasterSubmitting(true);
      setMasterFormError("");

      const payload = {
        name: normalizeText(masterFormData.name),
        description: normalizeText(masterFormData.description),
        token: normalizeText(masterFormData.token),
      };

      if (masterFormMode === "create") {
        const res = await CreateAppLineMaster(payload);

        if (!res?.data) {
          setMasterFormError(t("line.failedCreateIntegration"));
          return;
        }

        setLineMasters((prev) => [res.data, ...prev]);
        setMasterFormOpen(false);
        message.success(t("line.createSuccessMsg"));
        return;
      }

      if (!editingMaster?.id) {
        setMasterFormError(t("line.missingIntegrationId"));
        return;
      }

      const res = await UpdateAppLineMasterByID(editingMaster.id, payload);

      if (!res?.data) {
        setMasterFormError(t("line.failedUpdateIntegration"));
        return;
      }

      setLineMasters((prev) =>
        prev.map((item) => (item.id === editingMaster.id ? res.data : item)),
      );
      setMasterFormOpen(false);
      message.success(t("line.updateSuccessMsg"));
    } catch (err: any) {
      setMasterFormError(
        err?.response?.data?.error ||
          err?.message ||
          (masterFormMode === "create"
            ? t("line.failedCreateIntegration")
            : t("line.failedUpdateIntegration")),
      );
    } finally {
      setMasterSubmitting(false);
    }
  };

  const openDeleteMasterModal = (item: AppLineMasterResponse) => {
    setMasterDeleteTarget(item);
    setMasterDeleteError("");
    setMasterDeleteOpen(true);
  };

  const closeDeleteMasterModal = () => {
    if (masterDeleting) return;
    setMasterDeleteOpen(false);
    setMasterDeleteTarget(null);
    setMasterDeleteError("");
  };

  const handleDeleteMaster = async () => {
    if (!masterDeleteTarget?.id) {
      setMasterDeleteError(t("line.missingIntegrationId"));
      return;
    }

    try {
      setMasterDeleting(true);
      setMasterDeleteError("");

      const res = await DeleteAppLineMasterByID(masterDeleteTarget.id);

      if (!res) {
        setMasterDeleteError(t("line.failedDeleteIntegration"));
        return;
      }

      setLineMasters((prev) =>
        prev.filter((item) => item.id !== masterDeleteTarget.id),
      );
      setMasterDeleteOpen(false);
      setMasterDeleteTarget(null);
      message.success(t("line.deleteSuccessMsg"));
    } catch (err) {
      console.error("handleDeleteMaster error:", err);
      setMasterDeleteError(t("line.failedDeleteIntegration"));
    } finally {
      setMasterDeleting(false);
    }
  };

  return (
    <div className="w-full space-y-4 sm:space-y-5">

      {/* ── Header card ── */}
      <div
        className="relative overflow-hidden rounded-[18px] bg-white/95 p-4 shadow-sm backdrop-blur sm:rounded-[22px] sm:p-6 dark:bg-[#0d0b1a]/90"
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
              <SiLine className="text-[20px] sm:text-[22px]" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] sm:text-[10.5px]" style={{ color: currentColor }}>
                {t("line.integrationsKicker")}
              </p>
              <h1 className="truncate text-[18px] font-bold text-slate-900 sm:text-[20px] dark:text-white/90">
                {t("line.integrationsTitle")}
              </h1>
              <p className="mt-0.5 truncate text-[11px] text-slate-500 sm:text-[12px] dark:text-white/45">
                {t("line.integrationsSubtitle")}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate("/admin/line notification")}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-[11.5px] font-medium text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white/75 dark:hover:bg-white/10"
          >
            <FiArrowLeft className="text-[13px]" />
            {t("line.backToNotifications")}
          </button>
        </div>
      </div>

      {/* ── Webhook signature secret ── */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-4 dark:border-white/8 dark:bg-[#0d0b1a]/60 sm:p-5">
        <div className="flex items-center gap-2.5">
          <FiLock className="text-[14px] text-slate-400 dark:text-white/35" />
          <p className="text-[13px] font-bold text-slate-800 dark:text-white/90">
            {t("line.webhookSecretTitle")}
          </p>
        </div>
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-slate-500 dark:text-white/45">
          {t("line.webhookSecretDesc")}
        </p>
        {canManage ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="relative w-full max-w-80">
              <input
                type={showWebhookSecret ? "text" : "password"}
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                placeholder={t("line.webhookSecretPlaceholder")}
                className="w-full rounded-lg border border-slate-200/80 bg-white py-2 pl-3 pr-9 text-[12px] text-slate-700 placeholder-slate-400 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100 dark:border-white/8 dark:bg-white/5 dark:text-white/85 dark:placeholder-white/25"
              />
              <button
                type="button"
                onClick={() => setShowWebhookSecret((prev) => !prev)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/35"
              >
                {showWebhookSecret ? <FiEyeOff className="text-[13px]" /> : <FiEye className="text-[13px]" />}
              </button>
            </div>
            <button
              type="button"
              onClick={() => void handleSaveWebhookSecret()}
              disabled={webhookSecretSaving || !normalizeText(webhookSecret)}
              style={{ background: accentGrad }}
              className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[12px] font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FiSave className="text-[13px]" />
              {t("line.webhookSecretSave")}
            </button>
          </div>
        ) : (
          <p className="mt-3 text-[11.5px] text-slate-400 dark:text-white/30">••••••••••••••••</p>
        )}
      </div>

      {/* ── Integrations table ── */}
      <div className="rounded-xl border border-slate-200/80 bg-white dark:border-white/8 dark:bg-[#0d0b1a]/60">
        {/* Toolbar — title + count + search + buttons */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3.5 dark:border-white/8">
          {/* Title */}
          <div className="flex shrink-0 items-center gap-2.5">
            <FiLink2 className="text-[14px] text-slate-400 dark:text-white/35" />
            <p className="text-[13px] font-bold text-slate-800 dark:text-white/90">
              {t("line.integrationsTitle")}
              {!loading && (
                <span className="ml-2 text-[11px] font-normal text-slate-400 dark:text-white/30">
                  ({filteredLineMasters.length}/{lineMasters.length})
                </span>
              )}
            </p>
          </div>

          {/* Search */}
          <div className="relative w-44">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400 dark:text-white/30" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("line.searchEllipsisPlaceholder")}
              className="w-full rounded-lg border border-slate-200/80 bg-white py-1.5 pl-8 pr-3 text-[12px] text-slate-700 placeholder-slate-400 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100 dark:border-white/8 dark:bg-white/5 dark:text-white/85 dark:placeholder-white/25"
            />
          </div>

          {/* Buttons */}
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => void fetchLineMasters(true)}
              disabled={refreshing}
              className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200/70 bg-white text-slate-500 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/8 dark:bg-white/5 dark:text-white/50"
            >
              <FiRefreshCw className={`text-[12px] ${refreshing ? "animate-spin" : ""}`} />
            </button>
            {canManage && (
              <button
                type="button"
                onClick={openCreateMasterModal}
                style={{ background: accentGrad }}
                className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[12px] font-semibold text-white shadow-sm transition hover:opacity-90"
              >
                <FiPlus className="text-[13px]" /> {t("line.botLabel")}
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-b-xl">
          {loading ? (
            <div className="space-y-0">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 animate-pulse border-b border-slate-100 last:border-0 dark:border-white/6" />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <FiLink2 className="text-[24px] text-slate-300 dark:text-white/20" />
              <p className="text-[12.5px] text-rose-500 dark:text-rose-300">{error}</p>
            </div>
          ) : lineMasters.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <SiLine className="text-[24px] text-slate-300 dark:text-white/20" />
              <p className="text-[12.5px] text-slate-400 dark:text-white/35">{t("line.noBotLineFound")}</p>
            </div>
          ) : filteredLineMasters.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <FiSearch className="text-[24px] text-slate-300 dark:text-white/20" />
              <p className="text-[12.5px] text-slate-400 dark:text-white/35">{t("line.noResultsForFilter")}</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-160">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-white/8">
                      {[t("line.name"), t("line.tableCategory"), t("line.token"), ""].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/60 dark:divide-white/5">
                    {pagedLineMasters.map((item) => (
                      <tr key={item.id} className="transition-colors hover:bg-slate-50/60 dark:hover:bg-white/2">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-emerald-200 bg-emerald-50 text-[14px] text-emerald-600 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                              <SiLine />
                            </span>
                            <div className="min-w-0">
                              <p className="text-[13px] font-semibold text-slate-800 dark:text-white/85">{item.name}</p>
                              <p className="mt-0.5 max-w-80 truncate text-[10.5px] text-slate-400 dark:text-white/30">{item.description}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10.5px] font-medium text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-white/55">
                            {item.category}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-mono text-[12px] text-slate-500 dark:text-white/45">{maskToken(item.token)}</td>
                        <td className="px-4 py-3.5 text-right">
                          {canManage ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  openEditMasterModal(lineMasters.find((m) => m.id === item.id)!)
                                }
                                title={t("line.editBotLine")}
                                className="grid h-7 w-7 place-items-center rounded-lg border border-blue-200 bg-blue-50 text-blue-600 transition hover:bg-blue-100 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300"
                              >
                                <FiEdit2 className="text-[11px]" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  openDeleteMasterModal(lineMasters.find((m) => m.id === item.id)!)
                                }
                                title={t("line.deleteBotLine")}
                                className="grid h-7 w-7 place-items-center rounded-lg border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
                              >
                                <FiTrash2 className="text-[11px]" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-300 dark:text-white/15">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 dark:border-white/8">
                  <span className="text-[11px] text-slate-400 dark:text-white/30">{t("line.pageOfTotal", { page, totalPages })}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200/70 bg-white text-slate-500 transition hover:bg-slate-50 disabled:opacity-40 dark:border-white/8 dark:bg-white/5 dark:text-white/50"
                    >
                      <FiChevronLeft className="text-[12px]" />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setPage(n)}
                        style={n === page ? { background: accentGrad } : undefined}
                        className={[
                          "grid h-7 w-7 place-items-center rounded-lg text-[11.5px] font-semibold transition",
                          n === page
                            ? "text-white"
                            : "border border-slate-200/70 bg-white text-slate-500 hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/50",
                        ].join(" ")}
                      >
                        {n}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200/70 bg-white text-slate-500 transition hover:bg-slate-50 disabled:opacity-40 dark:border-white/8 dark:bg-white/5 dark:text-white/50"
                    >
                      <FiChevronRight className="text-[12px]" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Info note */}
      <div className="flex items-start gap-2 rounded-xl border border-slate-200/70 bg-slate-50/60 px-4 py-3.5 dark:border-white/8 dark:bg-white/3">
        <FiCheckCircle className="mt-0.5 shrink-0 text-[13px]" style={{ color: currentColor }} />
        <p className="text-[11.5px] text-slate-500 dark:text-white/45">
          {t("line.tokenSecurityNote")}
        </p>
      </div>

      {masterFormOpen && createPortal(
        <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/55 backdrop-blur-[3px]"
            onClick={!masterSubmitting ? closeMasterFormModal : undefined}
          />

          <div
            className="relative z-10 w-full max-w-md rounded-2xl bg-white dark:bg-[#12101f]"
            style={{ boxShadow: `0 24px 64px -12px ${currentColor}30, 0 8px 32px rgba(0,0,0,.28)` }}
          >
            <div className="flex items-center justify-between rounded-t-2xl border-b border-slate-100 px-4 py-3 dark:border-white/8">
              <div className="flex items-center gap-2.5">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
                  style={{ background: accentGrad }}
                >
                  {masterFormMode === "create" ? <FiLink2 className="text-[13px]" /> : <FiEdit2 className="text-[13px]" />}
                </span>
                <div>
                  <p className="text-[8.5px] font-bold uppercase tracking-widest" style={{ color: currentColor }}>
                    {t("line.integrationsTitle")}
                  </p>
                  <h3 className="text-[13.5px] font-bold text-slate-800 dark:text-white/90">
                    {masterFormMode === "create" ? t("line.createBotLine") : t("line.editBotLineModalTitle")}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={closeMasterFormModal}
                disabled={masterSubmitting}
                className="flex h-7 w-7 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 disabled:opacity-40 dark:text-white/35 dark:hover:bg-white/8"
              >
                <FiX className="text-[14px]" />
              </button>
            </div>

            <div className="space-y-3 px-4 py-4">
              {masterFormError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[10.5px] text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200">
                  {masterFormError}
                </div>
              ) : null}

              <div>
                <label className={formLabelClass}>
                  <FiType className="text-[10px]" />
                  {t("line.botLineNameLabel")} <span className="text-red-400">*</span>
                </label>
                <input
                  className={formInputClass}
                  value={masterFormData.name}
                  onChange={(e) =>
                    setMasterFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  disabled={masterSubmitting}
                  placeholder={t("line.integrationNamePlaceholder")}
                />
              </div>

              <div>
                <label className={formLabelClass}>
                  <FiLayers className="text-[10px]" />
                  {t("line.descriptionLabel")} <span className="text-red-400">*</span>
                </label>
                <textarea
                  className={formTextareaClass}
                  value={masterFormData.description}
                  onChange={(e) =>
                    setMasterFormData((prev) => ({ ...prev, description: e.target.value }))
                  }
                  disabled={masterSubmitting}
                  placeholder={t("line.describeIntegrationPlaceholder")}
                />
              </div>

              <div>
                <label className={formLabelClass}>
                  <FiLock className="text-[10px]" />
                  {t("line.token")} <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    className={`${formInputClass} pr-20`}
                    type={showToken ? "text" : "password"}
                    value={masterFormData.token}
                    onChange={(e) =>
                      setMasterFormData((prev) => ({ ...prev, token: e.target.value }))
                    }
                    disabled={masterSubmitting}
                    placeholder={t("line.enterTokenPlaceholder")}
                  />
                  <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowToken((prev) => !prev)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 dark:text-white/35 dark:hover:bg-white/8"
                    >
                      {showToken ? <FiEyeOff className="text-[13px]" /> : <FiEye className="text-[13px]" />}
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyToken}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 dark:text-white/35 dark:hover:bg-white/8"
                    >
                      <FiCopy className="text-[13px]" />
                    </button>
                  </div>
                </div>
                {copiedToken ? (
                  <p className="mt-1 text-[10px] text-emerald-600 dark:text-emerald-300">
                    {t("line.copiedLabel")}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex gap-2 rounded-b-2xl border-t border-slate-100 px-4 py-3 dark:border-white/8">
              <button
                type="button"
                onClick={closeMasterFormModal}
                disabled={masterSubmitting}
                className="flex-1 rounded-xl border border-slate-200 py-2 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60 dark:border-white/8 dark:text-white/55 dark:hover:bg-white/5"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={() => void handleSubmitMaster()}
                disabled={masterSubmitting || (masterFormMode === "edit" && !isBotEditChanged)}
                style={
                  !masterSubmitting && (masterFormMode === "create" || isBotEditChanged)
                    ? { background: accentGrad }
                    : undefined
                }
                className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-[12px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-white/10"
              >
                {masterSubmitting && <FiRefreshCw className="animate-spin text-[12px]" />}
                {!masterSubmitting && (masterFormMode === "create" ? <FiPlus className="text-[12px]" /> : <FiSave className="text-[12px]" />)}
                {masterSubmitting
                  ? masterFormMode === "create"
                    ? t("line.creatingEllipsis")
                    : t("common.saving")
                  : masterFormMode === "create"
                    ? t("line.createLabel")
                    : t("common.save")}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {masterDeleteOpen && masterDeleteTarget && createPortal(
        <div className={modalBackdropClass}>
          <div className={`${modalCardClass} max-w-md`}>
            <div className="px-5 py-5">
              <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-300">
                <FiTrash2 className="text-[18px]" />
              </div>

              <h3 className="text-center text-[16px] font-semibold text-slate-900 dark:text-white">
                {t("line.deleteBotLineTitle")}
              </h3>
              <p className="mt-2 text-center text-[12px] leading-6 text-slate-500 dark:text-white/50">
                {t("line.confirmDeleteQuestion", { name: masterDeleteTarget.name })}
              </p>

              {masterDeleteError ? (
                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[12px] text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200">
                  {masterDeleteError}
                </div>
              ) : null}

              <div className="mt-5 flex items-center justify-center gap-2">
                <ActionButton
                  onClick={closeDeleteMasterModal}
                  className="border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white/75 dark:hover:bg-white/10"
                >
                  {t("common.cancel")}
                </ActionButton>
                <ActionButton
                  onClick={handleDeleteMaster}
                  disabled={masterDeleting}
                  className="bg-rose-600 text-white hover:bg-rose-700"
                >
                  {masterDeleting ? t("common.deleting") : t("common.delete")}
                </ActionButton>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Index;
