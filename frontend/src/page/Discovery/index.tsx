import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FiRadio, FiRefreshCw, FiPlay, FiAlertTriangle,
  FiCheckCircle, FiCheck, FiWifi, FiSave, FiSliders,
  FiSearch, FiChevronLeft, FiChevronRight, FiX,
} from "react-icons/fi";
import { message } from "antd";
import {
  ListDiscoveredHosts, GetDiscoveryScanStatus, TriggerDiscoveryScan, AcknowledgeDiscoveredHost,
  type DiscoveredHostDTO, type DiscoveryScanStatusDTO, type DiscoveredHostStatusFilter,
} from "../../services/discovery";
import { GetAppSettings, UpdateAppSetting } from "../../services/setting";
import { useStateContext } from "../../contexts/ProviderContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useAuth } from "../../contexts/AuthContext";

const DISCOVERY_SUBNET_KEY = "discovery_subnet";

const fmtDateTime = (iso: string | undefined | null): string => {
  if (!iso || iso === "0001-01-01T00:00:00Z") return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

const DiscoveryPage: React.FC = () => {
  const { currentColor } = useStateContext();
  const { t } = useLanguage();
  const { can } = useAuth();
  const canManage = can("threat_intel", "manage");
  // The subnet is stored via the shared /settings endpoint, which is gated on
  // line_settings.manage regardless of which page writes it — same precedent
  // as ScanManagement's global timezone picker.
  const canManageSubnet = can("line_settings", "manage");

  const PAGE_SIZE = 20;

  const [hosts, setHosts] = useState<DiscoveredHostDTO[]>([]);
  const [totalHostsCount, setTotalHostsCount] = useState(0);
  const [unrecognizedCount, setUnrecognizedCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalFiltered, setTotalFiltered] = useState(0);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [hostStatusFilter, setHostStatusFilter] = useState<DiscoveredHostStatusFilter>("");

  const [status, setStatus] = useState<DiscoveryScanStatusDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [ackBusyId, setAckBusyId] = useState<number | null>(null);

  const [subnet, setSubnet] = useState("");
  const [subnetInput, setSubnetInput] = useState("");
  const [savingSubnet, setSavingSubnet] = useState(false);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const pollTimer = useRef<number | null>(null);
  const tickTimer = useRef<number | null>(null);
  const accentGrad = `linear-gradient(135deg, ${currentColor}, color-mix(in srgb, ${currentColor} 65%, #a855f7))`;

  // Debounce the free-text search box — wait for the user to stop typing
  // before hitting the backend, and jump back to page 1 since the previous
  // page number may no longer exist under the new filter.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [hostStatusFilter]);

  const fetchAll = useCallback(async () => {
    const [hostsRes, statusRes, settingsRes] = await Promise.all([
      ListDiscoveredHosts({ page, pageSize: PAGE_SIZE, search, status: hostStatusFilter }),
      GetDiscoveryScanStatus(),
      GetAppSettings(),
    ]);
    setHosts(hostsRes.data);
    setTotalHostsCount(hostsRes.total_hosts);
    setUnrecognizedCount(hostsRes.unrecognized_count);
    setTotalPages(hostsRes.total_pages);
    setTotalFiltered(hostsRes.total);
    setStatus(statusRes);
    const savedSubnet = settingsRes[DISCOVERY_SUBNET_KEY] ?? "";
    setSubnet(savedSubnet);
    setSubnetInput(savedSubnet);
    setLoading(false);
  }, [page, search, hostStatusFilter]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (status?.is_running) {
      pollTimer.current = window.setInterval(() => void fetchAll(), 5000);
    }
    return () => {
      if (pollTimer.current) window.clearInterval(pollTimer.current);
    };
  }, [status?.is_running, fetchAll]);

  // A ticking "Scanning… Ns" counter so a slow run (first-ever scan pulls
  // the nmap image, which can take a few minutes) still visibly proves it's
  // alive instead of sitting on a static "Scanning…" label the whole time —
  // a user watching that for minutes with zero movement reasonably assumes
  // it's frozen.
  useEffect(() => {
    if (!status?.is_running || !status.started_at) {
      setElapsedSeconds(0);
      return;
    }
    const startedAt = new Date(status.started_at).getTime();
    const tick = () => setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    tick();
    tickTimer.current = window.setInterval(tick, 1000);
    return () => {
      if (tickTimer.current) window.clearInterval(tickTimer.current);
    };
  }, [status?.is_running, status?.started_at]);

  const handleTrigger = async () => {
    setTriggering(true);
    try {
      await TriggerDiscoveryScan();
      message.success(t("discovery.triggered"));
      void fetchAll();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      message.error(msg || t("discovery.triggerFailed"));
    } finally {
      setTriggering(false);
    }
  };

  const handleSaveSubnet = async () => {
    const trimmed = subnetInput.trim();
    setSavingSubnet(true);
    try {
      await UpdateAppSetting(DISCOVERY_SUBNET_KEY, trimmed);
      setSubnet(trimmed);
      message.success(t("discovery.subnetSaved"));
    } catch {
      message.error(t("discovery.subnetSaveFailed"));
    } finally {
      setSavingSubnet(false);
    }
  };

  const handleAcknowledge = async (id: number) => {
    setAckBusyId(id);
    try {
      await AcknowledgeDiscoveredHost(id);
      // Refetch rather than patch in place — acknowledging can move a row out
      // of the currently active status filter (e.g. "unrecognized"), so a
      // local patch could leave a row visible that no longer matches it.
      await fetchAll();
    } catch {
      message.error(t("discovery.acknowledgeFailed"));
    } finally {
      setAckBusyId(null);
    }
  };

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
              <FiWifi className="text-[20px] sm:text-[22px]" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] sm:text-[10.5px]" style={{ color: currentColor }}>
                {t("discovery.kicker")}
              </p>
              <h1 className="truncate text-[18px] font-bold text-slate-900 sm:text-[20px] dark:text-white/90">
                {t("discovery.title")}
              </h1>
              <p className="mt-0.5 text-[11px] text-slate-500 sm:text-[12px] dark:text-white/45">
                {t("discovery.subtitle")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {status?.is_running && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
                <FiRefreshCw className="animate-spin text-[10px]" /> {t("discovery.scanning")} {elapsedSeconds}s
              </span>
            )}
            <button type="button" onClick={() => void fetchAll()} disabled={loading}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200/70 bg-white text-slate-500 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/8 dark:bg-white/5 dark:text-white/50">
              <FiRefreshCw className={`text-[13px] ${loading ? "animate-spin" : ""}`} />
            </button>
            {canManage && (
              <button type="button" onClick={() => void handleTrigger()}
                disabled={triggering || !!status?.is_running}
                style={{ background: accentGrad }}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
                {triggering || status?.is_running
                  ? <FiRefreshCw className="animate-spin text-[11px]" />
                  : <FiPlay className="text-[11px]" />}
                {t("discovery.scanNow")}
              </button>
            )}
          </div>
        </div>
      </div>

      {status?.is_running && elapsedSeconds > 20 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-3 dark:border-blue-500/20 dark:bg-blue-500/10">
          <FiRefreshCw className="mt-0.5 shrink-0 animate-spin text-[13px] text-blue-500" />
          <p className="text-[11.5px] text-blue-700 dark:text-blue-300">{t("discovery.scanningSlowHint")}</p>
        </div>
      )}

      {status?.last_error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50/70 px-4 py-3 dark:border-red-500/20 dark:bg-red-500/10">
          <FiAlertTriangle className="mt-0.5 shrink-0 text-[13px] text-red-500" />
          <p className="text-[11.5px] text-red-600 dark:text-red-300">{status.last_error}</p>
        </div>
      )}

      {/* Subnet configuration — no .env/restart needed, saved straight from here */}
      <div className="rounded-xl border border-slate-200/80 bg-white px-4 py-3.5 dark:border-white/8 dark:bg-[#0d0b1a]/60">
        <div className="mb-2 flex items-center gap-2">
          <FiSliders className="text-[13px] text-slate-400 dark:text-white/35" />
          <p className="text-[12.5px] font-semibold text-slate-700 dark:text-white/80">{t("discovery.subnetLabel")}</p>
        </div>
        {canManageSubnet ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={subnetInput}
              onChange={(e) => setSubnetInput(e.target.value)}
              placeholder={t("discovery.subnetPlaceholder")}
              className="h-9 min-w-56 flex-1 rounded-lg border border-slate-200 bg-white px-3 font-mono text-[12.5px] text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-white/8 dark:bg-white/5 dark:text-white/80"
            />
            <button
              type="button"
              onClick={() => void handleSaveSubnet()}
              disabled={savingSubnet || subnetInput.trim() === subnet}
              style={{ background: accentGrad }}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingSubnet ? <FiRefreshCw className="animate-spin text-[11px]" /> : <FiSave className="text-[11px]" />}
              {t("common.save")}
            </button>
          </div>
        ) : (
          <p className="font-mono text-[12.5px] text-slate-600 dark:text-white/60">{subnet || "—"}</p>
        )}
        <p className="mt-1.5 text-[10.5px] text-slate-400 dark:text-white/30">{t("discovery.subnetHint")}</p>
      </div>

      {/* Summary row — always whole-inventory counts, unaffected by the
          search/status filter below (the table itself is what's filtered). */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-200/80 bg-white px-4 py-3 dark:border-white/8 dark:bg-[#0d0b1a]/60">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/30">{t("discovery.totalHosts")}</p>
          <p className="text-[22px] font-bold text-slate-800 dark:text-white/90">{totalHostsCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-white px-4 py-3 dark:border-white/8 dark:bg-[#0d0b1a]/60">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/30">{t("discovery.unrecognized")}</p>
          <p className="text-[22px] font-bold" style={{ color: unrecognizedCount > 0 ? "#dc2626" : undefined }}>{unrecognizedCount}</p>
        </div>
      </div>

      {/* Search + status filter */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400 dark:text-white/30" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t("discovery.searchPlaceholder")}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-8 text-[12.5px] text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-white/8 dark:bg-white/5 dark:text-white/80"
          />
          {searchInput && (
            <button type="button" onClick={() => setSearchInput("")} aria-label={t("common.clear")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-white/30 dark:hover:text-white/60">
              <FiX className="text-[12px]" />
            </button>
          )}
        </div>
        <select
          value={hostStatusFilter}
          onChange={(e) => setHostStatusFilter(e.target.value as DiscoveredHostStatusFilter)}
          className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-[12.5px] text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-white/8 dark:bg-white/5 dark:text-white/80"
        >
          <option value="">{t("discovery.filterAll")}</option>
          <option value="unrecognized">{t("discovery.statusUnrecognized")}</option>
          <option value="known">{t("discovery.statusKnown")}</option>
          <option value="acknowledged">{t("discovery.statusAcknowledged")}</option>
        </select>
      </div>

      {/* Hosts table */}
      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white dark:border-white/8 dark:bg-[#0d0b1a]/60">
        {loading ? (
          <div className="space-y-0">{[1, 2, 3].map(i => (
            <div key={i} className="h-16 animate-pulse border-b border-slate-100 last:border-0 dark:border-white/6" />
          ))}</div>
        ) : hosts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <FiRadio className="text-[24px] text-slate-300 dark:text-white/20" />
            <p className="text-[12.5px] font-medium text-slate-500 dark:text-white/40">
              {search || hostStatusFilter ? t("discovery.noResultsFiltered") : t("discovery.noResults")}
            </p>
            <p className="text-[11px] text-slate-400 dark:text-white/30">{t("discovery.noResultsHint")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-160">
              <thead>
                <tr className="border-b border-slate-100 dark:border-white/8">
                  {[
                    t("discovery.colIP"), t("discovery.colHostname"), t("discovery.colPorts"),
                    t("discovery.colFirstSeen"), t("discovery.colLastSeen"), t("discovery.colStatus"), "",
                  ].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/70 dark:divide-white/5">
                {hosts.map(h => {
                  const isUnrecognized = !h.is_known_target && !h.acknowledged;
                  return (
                    <tr key={h.id} className={isUnrecognized ? "bg-red-50/40 dark:bg-red-500/5" : "transition-colors hover:bg-slate-50/60 dark:hover:bg-white/2"}>
                      <td className="px-4 py-3 font-mono text-[12px] text-slate-700 dark:text-white/80">{h.ip_address}</td>
                      <td className="px-4 py-3 text-[12px] text-slate-500 dark:text-white/45">{h.hostname || "—"}</td>
                      <td className="px-4 py-3 text-[11.5px] text-slate-500 dark:text-white/45">{h.open_ports || "—"}</td>
                      <td className="px-4 py-3 text-[12px] text-slate-500 dark:text-white/45">{fmtDateTime(h.first_seen_at)}</td>
                      <td className="px-4 py-3 text-[12px] text-slate-500 dark:text-white/45">{fmtDateTime(h.last_seen_at)}</td>
                      <td className="px-4 py-3">
                        {h.is_known_target ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                            <FiCheckCircle className="text-[9px]" /> {t("discovery.statusKnown")}
                          </span>
                        ) : h.acknowledged ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10.5px] font-semibold text-slate-500 dark:border-white/8 dark:bg-white/5 dark:text-white/40">
                            <FiCheck className="text-[9px]" /> {t("discovery.statusAcknowledged")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10.5px] font-semibold text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                            <FiAlertTriangle className="text-[9px]" /> {t("discovery.statusUnrecognized")}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {canManage && isUnrecognized && (
                          <button type="button" onClick={() => void handleAcknowledge(h.id)} disabled={ackBusyId === h.id}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/8 dark:bg-white/5 dark:text-white/55">
                            {ackBusyId === h.id ? "…" : t("discovery.acknowledge")}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && totalFiltered > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <p className="text-[11.5px] text-slate-500 dark:text-white/40">
            {t("discovery.showingRange", {
              from: (page - 1) * PAGE_SIZE + 1,
              to: Math.min(page * PAGE_SIZE, totalFiltered),
              total: totalFiltered,
            })}
          </p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/8 dark:text-white/50 dark:hover:bg-white/5">
              <FiChevronLeft className="text-[13px]" />
            </button>
            <span className="text-[11.5px] font-medium text-slate-600 dark:text-white/55">
              {t("discovery.pageOf", { page, totalPages })}
            </span>
            <button type="button" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/8 dark:text-white/50 dark:hover:bg-white/5">
              <FiChevronRight className="text-[13px]" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DiscoveryPage;
