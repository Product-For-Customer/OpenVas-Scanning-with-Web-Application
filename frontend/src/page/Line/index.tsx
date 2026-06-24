import React, { useCallback, useEffect, useRef, useState } from "react";
import { FiBell } from "react-icons/fi";
import HistoryNotify from "./History";
import Notify from "./Notify";
import {
  ListHistoryNotify,
  type HistoryNotifyResponse,
} from "../../services";
import { useStateContext } from "../../contexts/ProviderContext";
import { useLanguage } from "../../contexts/LanguageContext";

const Index: React.FC = () => {
  const { currentColor } = useStateContext();
  const { t } = useLanguage();
  const accentGrad = `linear-gradient(135deg, ${currentColor}, color-mix(in srgb, ${currentColor} 65%, #a855f7))`;

  const [items, setItems] = useState<HistoryNotifyResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

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
        setError("Unable to load notification history.");
      }
    } catch (err) {
      console.error("fetchHistoryNotify error:", err);

      if (!isMountedRef.current) return;

      setItems([]);
      setError("Unable to load notification history.");
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
      isFetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    void fetchHistoryNotify();
  }, [fetchHistoryNotify]);

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
              MANAGEMENT · LINE NOTIFY
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