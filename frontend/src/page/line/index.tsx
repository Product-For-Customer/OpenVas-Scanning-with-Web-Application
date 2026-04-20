import React, { useCallback, useEffect, useRef, useState } from "react";
import HistoryNotify from "./history";
import Notify from "./notify";
import Graph from "./graph";
import GraphIPad from "./graph/graphIPad";
import Count from "./count";
import {
  ListHistoryNotify,
  type HistoryNotifyResponse,
} from "../../services";

const useDeviceView = () => {
  const [isDesktopLike, setIsDesktopLike] = useState(false);

  useEffect(() => {
    const update = () => {
      setIsDesktopLike(window.innerWidth >= 1280);
    };

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return { isDesktopLike };
};

const Index: React.FC = () => {
  const [items, setItems] = useState<HistoryNotifyResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const hasFetchedRef = useRef(false);
  const isFetchingRef = useRef(false);
  const isMountedRef = useRef(false);

  const { isDesktopLike } = useDeviceView();

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
    <div className="w-full">
      <div className="mb-4 sm:mb-5">
        <Notify />
      </div>

      <div className="mb-4 grid grid-cols-1 items-stretch gap-4 sm:mb-5 sm:gap-5 xl:grid-cols-10">
        <div className="h-full min-w-0 xl:col-span-6">
          <Count
            items={items}
            loading={loading}
            refreshing={refreshing}
            error={error}
            onRefresh={fetchHistoryNotify}
          />
        </div>

        <div className="h-full min-w-0 xl:col-span-4">
          {isDesktopLike ? (
            <Graph
              items={items}
              loading={loading}
              refreshing={refreshing}
              error={error}
              onRefresh={fetchHistoryNotify}
            />
          ) : (
            <GraphIPad
              items={items}
              loading={loading}
              refreshing={refreshing}
              error={error}
              onRefresh={fetchHistoryNotify}
            />
          )}
        </div>
      </div>

      <div>
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