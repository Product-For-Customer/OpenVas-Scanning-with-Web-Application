import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiBell, FiClock, FiLink2, FiChevronRight } from "react-icons/fi";
import HistoryNotify from "./History";
import Notify from "./Notify";
import {
  ListHistoryNotify,
  ListAppNotification,
  ListAppLineMaster,
  type HistoryNotifyResponse,
} from "../../services";
import { useStateContext } from "../../contexts/ProviderContext";
import { useLanguage } from "../../contexts/LanguageContext";

// ─────────────────────────────────────────────────────────────
// Summary card (matches ThreatIntelligence design)
// ─────────────────────────────────────────────────────────────

const Pulse: React.FC = () => (
  <span className="inline-block h-5.5 w-12 animate-pulse rounded-lg bg-slate-100 dark:bg-white/10" />
);

type SummaryCardProps = {
  label: string;
  value: string | number;
  sub: string;
  icon: React.ReactNode;
  iconColor: string;
  loading?: boolean;
  onClick?: () => void;
};

const SummaryCard: React.FC<SummaryCardProps> = ({
  label, value, sub, icon, iconColor, loading, onClick,
}) => {
  const clickable = typeof onClick === "function";
  return (
    <div
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={[
        "group relative overflow-hidden rounded-xl border bg-white px-3.5 py-3 shadow-sm transition-all duration-300 hover:-translate-y-0.5 dark:bg-[#0d0b1a]/80",
        clickable ? "cursor-pointer focus:outline-none focus:ring-2" : "",
      ].join(" ")}
      style={{
        borderColor: `${iconColor}55`,
        boxShadow: `0 6px 14px -12px ${iconColor}60`,
      }}
    >
      {/* corner glow */}
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-35 blur-2xl transition-opacity duration-300 group-hover:opacity-60"
        style={{ backgroundColor: `${iconColor}20` }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-50 dark:opacity-25"
        style={{ background: `linear-gradient(160deg, ${iconColor}10, transparent 65%)` }}
        aria-hidden
      />
      <div className="relative flex items-center justify-between">
        <p className="text-[10.5px] font-bold tracking-wide text-slate-600 dark:text-white/55">
          {label}
        </p>
        <span
          className="relative flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-lg text-[12px] transition-transform duration-300 group-hover:scale-110"
          style={{ backgroundColor: `${iconColor}1c`, color: iconColor }}
        >
          {icon}
        </span>
      </div>
      <p className="relative mt-1.5 text-[22px] font-bold leading-none tracking-tight text-slate-900 dark:text-white">
        {loading ? <Pulse /> : value}
      </p>
      <div className="relative mt-1 flex items-center gap-1">
        <p className="truncate text-[10px] text-slate-400 dark:text-white/35">{sub}</p>
        {clickable && (
          <FiChevronRight
            className="shrink-0 text-[11px] transition-transform duration-300 group-hover:translate-x-0.5"
            style={{ color: iconColor }}
          />
        )}
      </div>
    </div>
  );
};

const Index: React.FC = () => {
  const { currentColor } = useStateContext();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const accentGrad = `linear-gradient(135deg, ${currentColor}, color-mix(in srgb, ${currentColor} 65%, #a855f7))`;

  const [items, setItems] = useState<HistoryNotifyResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const [notifCount, setNotifCount] = useState<number>(0);
  const [integrationCount, setIntegrationCount] = useState<number>(0);
  const [countsLoading, setCountsLoading] = useState<boolean>(true);

  const hasFetchedRef = useRef(false);
  const isFetchingRef = useRef(false);
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchHistoryNotify = useCallback(async (showRefresh = false) => {
    if (isFetchingRef.current) return;

    try {
      isFetchingRef.current = true;

      if (isMountedRef.current) {
        setError("");

        if (showRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }
      }

      const res = await ListHistoryNotify();

      if (!isMountedRef.current) return;

      if (Array.isArray(res)) {
        setItems(res);
      } else {
        setItems([]);
        setError(t("line.unableLoadNotificationHistory"));
      }
    } catch (err) {
      console.error("fetchHistoryNotify error:", err);

      if (!isMountedRef.current) return;

      setItems([]);
      setError(t("line.unableLoadNotificationHistory"));
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
      isFetchingRef.current = false;
    }
  }, [t]);

  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    void fetchHistoryNotify();
  }, [fetchHistoryNotify]);

  const fetchCounts = useCallback(async () => {
    try {
      setCountsLoading(true);

      const [notifications, integrations] = await Promise.all([
        ListAppNotification(),
        ListAppLineMaster(),
      ]);

      if (!isMountedRef.current) return;

      setNotifCount(Array.isArray(notifications) ? notifications.length : 0);
      setIntegrationCount(Array.isArray(integrations) ? integrations.length : 0);
    } catch (err) {
      console.error("fetchCounts error:", err);
      if (!isMountedRef.current) return;
      setNotifCount(0);
      setIntegrationCount(0);
    } finally {
      if (isMountedRef.current) setCountsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCounts();
  }, [fetchCounts]);

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
        <div className="relative z-10 flex items-center gap-3 sm:gap-4">
          <div
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg sm:h-13 sm:w-13"
            style={{ background: accentGrad, boxShadow: `0 8px 24px -6px ${currentColor}50` }}
          >
            <FiBell className="text-[20px] sm:text-[22px]" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] sm:text-[10.5px]" style={{ color: currentColor }}>
              {t("line.kicker")}
            </p>
            <h1 className="truncate text-[18px] font-bold text-slate-900 sm:text-[20px] dark:text-white/90">
              {t("line.scanNotificationStats")}
            </h1>
            <p className="mt-0.5 truncate text-[11px] text-slate-500 sm:text-[12px] dark:text-white/45">
              {t("line.subtitle")}
            </p>
          </div>
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard
          label={t("line.cardNotification")}
          value={notifCount}
          sub={t("line.cardNotificationSub")}
          icon={<FiBell />}
          iconColor="#06b6d4"
          loading={countsLoading}
        />
        <SummaryCard
          label={t("line.cardHistory")}
          value={items.length}
          sub={t("line.cardHistorySub")}
          icon={<FiClock />}
          iconColor="#8b5cf6"
          loading={loading}
        />
        <SummaryCard
          label={t("line.cardIntegrations")}
          value={integrationCount}
          sub={t("line.cardIntegrationsSub")}
          icon={<FiLink2 />}
          iconColor="#10b981"
          loading={countsLoading}
          onClick={() => navigate("/admin/line notification/integrations")}
        />
      </div>

      <div>
        <Notify />
      </div>

      <div className="mt-2">
        <HistoryNotify
          items={items}
          setItems={setItems}
          loading={loading}
          refreshing={refreshing}
          error={error}
          onRefresh={fetchHistoryNotify}
        />
      </div>
    </div>
  );
};

export default Index;