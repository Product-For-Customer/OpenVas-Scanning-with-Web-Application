import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FiRadio, FiRefreshCw, FiPlay, FiAlertTriangle,
  FiWifi, FiSave, FiSliders,
  FiSearch, FiChevronLeft, FiChevronRight, FiX,
} from "react-icons/fi";
import { message } from "antd";
import {
  ListDiscoveredHosts, GetDiscoveryScanStatus, TriggerDiscoveryScan,
  type DiscoveredHostDTO, type DiscoveryScanStatusDTO, type DiscoveredHostStatusFilter,
} from "../../services/discovery";
import { GetAppSettings, UpdateAppSetting } from "../../services/setting";
import { useStateContext } from "../../contexts/ProviderContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useAuth } from "../../contexts/AuthContext";

const DISCOVERY_SUBNET_KEY = "discovery_subnet";
const PAGE_SIZE = 20;

// While a scan runs we poll every POLL_MS for status + the current page of
// hosts (2 lightweight requests per tick). 3s is a deliberate middle ground:
// fast enough that devices visibly appear as nmap streams them in, slow enough
// that a multi-minute scan doesn't hammer the backend with requests.
const POLL_MS = 3000;

const fmtDateTime = (iso: string | undefined | null): string => {
  if (!iso || iso === "0001-01-01T00:00:00Z") return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

// Client-side CIDR check (IPv4) — mirrors the backend's net.ParseCIDR guard so
// an obviously-bad subnet is rejected before it's ever sent/saved.
const isValidCIDR = (raw: string): boolean => {
  const v = raw.trim();
  const m = v.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/);
  if (!m) return false;
  const octets = [m[1], m[2], m[3], m[4]].map(Number);
  if (octets.some(o => o > 255)) return false;
  const prefix = Number(m[5]);
  return prefix >= 0 && prefix <= 32;
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
  const [refreshing, setRefreshing] = useState(false);
  const [triggering, setTriggering] = useState(false);

  const [subnet, setSubnet] = useState("");
  const [subnetInput, setSubnetInput] = useState("");
  const [savingSubnet, setSavingSubnet] = useState(false);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const tickTimer = useRef<number | null>(null);
  const wasRunning = useRef(false);
  const accentGrad = `linear-gradient(135deg, ${currentColor}, color-mix(in srgb, ${currentColor} 65%, #a855f7))`;

  const subnetTrimmed = subnetInput.trim();
  const subnetInvalid = subnetTrimmed !== "" && !isValidCIDR(subnetTrimmed);

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

  // Fetch just the current page of hosts (used on mount, on page/search/filter
  // change, after acknowledge, and every poll tick while a scan runs).
  const fetchHosts = useCallback(async () => {
    const res = await ListDiscoveredHosts({ page, pageSize: PAGE_SIZE, search, status: hostStatusFilter });
    setHosts(res.data);
    setTotalHostsCount(res.total_hosts);
    setUnrecognizedCount(res.unrecognized_count);
    setTotalPages(res.total_pages);
    setTotalFiltered(res.total);
    setLoading(false);
  }, [page, search, hostStatusFilter]);

  const fetchStatus = useCallback(async () => {
    setStatus(await GetDiscoveryScanStatus());
  }, []);

  // Initial one-time load of the settings (subnet) + status; the hosts list is
  // loaded by the fetchHosts effect below.
  useEffect(() => {
    let ignore = false;
    void (async () => {
      const [statusRes, settingsRes] = await Promise.all([GetDiscoveryScanStatus(), GetAppSettings()]);
      if (ignore) return;
      setStatus(statusRes);
      const savedSubnet = settingsRes[DISCOVERY_SUBNET_KEY] ?? "";
      setSubnet(savedSubnet);
      setSubnetInput(savedSubnet);
    })();
    return () => { ignore = true; };
  }, []);

  useEffect(() => {
    void fetchHosts();
  }, [fetchHosts]);

  // Real-time polling while a scan runs: status + hosts every POLL_MS so newly
  // discovered devices stream into the table live.
  useEffect(() => {
    if (!status?.is_running) return;
    const id = window.setInterval(() => {
      void fetchStatus();
      void fetchHosts();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [status?.is_running, fetchStatus, fetchHosts]);

  // When a scan transitions running → finished, do one final hosts refresh so
  // the table reflects everything saved right up to completion (the last poll
  // tick can miss hosts inserted in the final second).
  useEffect(() => {
    if (status?.is_running) {
      wasRunning.current = true;
    } else if (wasRunning.current) {
      wasRunning.current = false;
      void fetchHosts();
    }
  }, [status?.is_running, fetchHosts]);

  // A ticking "Scanning… Ns" counter so a slow run (first-ever scan pulls the
  // nmap image, which can take a few minutes) still visibly proves it's alive.
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

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchHosts(), fetchStatus()]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleTrigger = async () => {
    setTriggering(true);
    try {
      await TriggerDiscoveryScan();
      message.success(t("discovery.triggered"));
      await fetchStatus();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      message.error(msg || t("discovery.triggerFailed"));
    } finally {
      setTriggering(false);
    }
  };

  const handleSaveSubnet = async () => {
    if (subnetInvalid || subnetTrimmed === "") {
      message.warning(t("discovery.subnetInvalid"));
      return;
    }
    setSavingSubnet(true);
    try {
      await UpdateAppSetting(DISCOVERY_SUBNET_KEY, subnetTrimmed);
      setSubnet(subnetTrimmed);
      message.success(t("discovery.subnetSaved"));
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      message.error(msg || t("discovery.subnetSaveFailed"));
    } finally {
      setSavingSubnet(false);
    }
  };

  // Windowed page numbers (max 5) centered on the current page, so the footer
  // stays compact even when there are many pages.
  const pageNumbers = useMemo(() => {
    const maxButtons = 5;
    let start = Math.max(1, page - Math.floor(maxButtons / 2));
    const end = Math.min(totalPages, start + maxButtons - 1);
    start = Math.max(1, end - maxButtons + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [page, totalPages]);

  const running = !!status?.is_running;

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
            {running && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
                <FiRefreshCw className="animate-spin text-[10px]" />
                {t("discovery.scanning")} {elapsedSeconds}s · {status?.hosts_found ?? 0} {t("discovery.hostsFound")}
              </span>
            )}
            <button type="button" onClick={() => void handleRefresh()} disabled={refreshing || loading}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200/70 bg-white text-slate-500 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/8 dark:bg-white/5 dark:text-white/50">
              <FiRefreshCw className={`text-[13px] ${refreshing ? "animate-spin" : ""}`} />
            </button>
            {canManage && (
              <button type="button" onClick={() => void handleTrigger()}
                disabled={triggering || running}
                style={{ background: accentGrad }}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
                {triggering || running
                  ? <FiRefreshCw className="animate-spin text-[11px]" />
                  : <FiPlay className="text-[11px]" />}
                {t("discovery.scanNow")}
              </button>
            )}
          </div>
        </div>
      </div>

      {running && elapsedSeconds > 20 && (
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
              aria-invalid={subnetInvalid}
              className={[
                "h-9 min-w-56 flex-1 rounded-lg border bg-white px-3 font-mono text-[12.5px] text-slate-700 outline-none focus:ring-2 dark:bg-white/5 dark:text-white/80",
                subnetInvalid
                  ? "border-red-300 focus:border-red-400 focus:ring-red-100 dark:border-red-500/40"
                  : "border-slate-200 focus:border-blue-400 focus:ring-blue-100 dark:border-white/8",
              ].join(" ")}
            />
            <button
              type="button"
              onClick={() => void handleSaveSubnet()}
              disabled={savingSubnet || subnetInvalid || subnetTrimmed === "" || subnetTrimmed === subnet}
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
        {canManageSubnet && subnetInvalid ? (
          <p className="mt-1.5 flex items-center gap-1 text-[10.5px] text-red-500 dark:text-red-400">
            <FiAlertTriangle className="text-[10px]" /> {t("discovery.subnetInvalid")}
          </p>
        ) : (
          <p className="mt-1.5 text-[10.5px] text-slate-400 dark:text-white/30">{t("discovery.subnetHint")}</p>
        )}
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

      {/* Hosts card — toolbar + table + footer pagination (ThreatConfig style) */}
      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white dark:border-white/8 dark:bg-[#0d0b1a]/60">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-3.5 dark:border-white/8">
          <div className="flex shrink-0 items-center gap-2.5">
            <FiRadio className="text-[14px] text-slate-400 dark:text-white/35" />
            <p className="text-[13px] font-bold text-slate-800 dark:text-white/90">
              {t("discovery.hostsHeading")}
              {!loading && <span className="ml-2 text-[11px] font-normal text-slate-400 dark:text-white/30">({totalFiltered}/{totalHostsCount})</span>}
            </p>
          </div>
          <div className="relative min-w-44 flex-1 sm:max-w-64">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400 dark:text-white/30" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t("discovery.searchPlaceholder")}
              className="w-full rounded-lg border border-slate-200/80 bg-white py-1.5 pl-8 pr-8 text-[12px] text-slate-700 placeholder-slate-400 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100 dark:border-white/8 dark:bg-white/5 dark:text-white/85 dark:placeholder-white/25"
            />
            {searchInput && (
              <button type="button" onClick={() => setSearchInput("")} aria-label={t("common.clear")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-white/30 dark:hover:text-white/60">
                <FiX className="text-[12px]" />
              </button>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <select
              value={hostStatusFilter}
              onChange={(e) => setHostStatusFilter(e.target.value as DiscoveredHostStatusFilter)}
              className="h-8 rounded-lg border border-slate-200/80 bg-white px-2.5 text-[12px] text-slate-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100 dark:border-white/8 dark:bg-white/5 dark:text-white/85"
            >
              <option value="">{t("discovery.filterAll")}</option>
              <option value="unrecognized">{t("discovery.statusUnrecognized")}</option>
              <option value="known">{t("discovery.statusKnown")}</option>
              <option value="acknowledged">{t("discovery.statusAcknowledged")}</option>
            </select>
            <button type="button" onClick={() => void handleRefresh()} disabled={refreshing || loading} title={t("common.refresh")}
              className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200/70 bg-white text-slate-500 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/8 dark:bg-white/5 dark:text-white/50">
              <FiRefreshCw className={`text-[12px] ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="space-y-0">{[1, 2, 3].map(i => (
            <div key={i} className="h-14 animate-pulse border-b border-slate-100 last:border-0 dark:border-white/6" />
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
          <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-160">
              <thead>
                <tr className="border-b border-slate-100 dark:border-white/8">
                  {[
                    t("discovery.colIP"), t("discovery.colHostname"), t("discovery.colPorts"),
                    t("discovery.colFirstSeen"), t("discovery.colLastSeen"),
                  ].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/60 dark:divide-white/5">
                {hosts.map(h => {
                  const isUnrecognized = !h.is_known_target && !h.acknowledged;
                  return (
                    <tr key={h.id} className={isUnrecognized ? "bg-red-50/40 dark:bg-red-500/5" : "transition-colors hover:bg-slate-50/60 dark:hover:bg-white/2"}>
                      <td className="px-4 py-3.5 font-mono text-[12px] text-slate-700 dark:text-white/80">{h.ip_address}</td>
                      <td className="px-4 py-3.5 text-[12px] text-slate-500 dark:text-white/45">{h.hostname || "—"}</td>
                      <td className="px-4 py-3.5 text-[11.5px] text-slate-500 dark:text-white/45">{h.open_ports || "—"}</td>
                      <td className="px-4 py-3.5 text-[12px] text-slate-500 dark:text-white/45">{fmtDateTime(h.first_seen_at)}</td>
                      <td className="px-4 py-3.5 text-[12px] text-slate-500 dark:text-white/45">{fmtDateTime(h.last_seen_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer pagination */}
          {totalFiltered > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-3 dark:border-white/8">
              <span className="text-[11px] text-slate-400 dark:text-white/30">
                {t("discovery.showingRange", {
                  from: (page - 1) * PAGE_SIZE + 1,
                  to: Math.min(page * PAGE_SIZE, totalFiltered),
                  total: totalFiltered,
                })}
                <span className="mx-1.5 text-slate-300 dark:text-white/15">·</span>
                {t("discovery.pageOf", { page, totalPages })}
              </span>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200/70 bg-white text-slate-500 transition hover:bg-slate-50 disabled:opacity-40 dark:border-white/8 dark:bg-white/5 dark:text-white/50">
                  <FiChevronLeft className="text-[12px]" />
                </button>
                {pageNumbers.map(n => (
                  <button key={n} type="button" onClick={() => setPage(n)}
                    style={n === page ? { background: accentGrad } : undefined}
                    className={["grid h-7 w-7 place-items-center rounded-lg text-[11.5px] font-semibold transition",
                      n === page ? "text-white" : "border border-slate-200/70 bg-white text-slate-500 hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/50",
                    ].join(" ")}>
                    {n}
                  </button>
                ))}
                <button type="button" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200/70 bg-white text-slate-500 transition hover:bg-slate-50 disabled:opacity-40 dark:border-white/8 dark:bg-white/5 dark:text-white/50">
                  <FiChevronRight className="text-[12px]" />
                </button>
              </div>
            </div>
          )}
          </>
        )}
      </div>
    </div>
  );
};

export default DiscoveryPage;
