import React, { useCallback, useEffect, useRef, useState } from "react";
import { FiTool, FiX } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { GetPublicMaintenanceStatus } from "../../services/setting";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";

const TOTAL_SECONDS = 60;
const POLL_INTERVAL_MS = 4000;

// Shows a 60s auto-logout countdown to non-admin users once an admin turns
// on Maintenance Mode (Service page). Since this project has no SSE/push
// infrastructure, maintenance state is discovered by polling the public
// GET /maintenance/status endpoint — the backend middleware enforces the
// same 60s grace period, so this stays in sync even across tabs/devices.
const MaintenanceCountdown: React.FC = () => {
  const { isAuthed, isAdmin, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [active, setActive] = useState(false); // maintenance in-progress; component stays mounted
  const [show, setShow] = useState(false);      // modal UI visible
  const [seconds, setSeconds] = useState(TOTAL_SECONDS);
  const [leaving, setLeaving] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const didLogoutRef = useRef(false);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const doLogout = useCallback(async () => {
    if (didLogoutRef.current) return;
    didLogoutRef.current = true;
    stopTimer();
    setLeaving(true);
    setShow(false);
    await logout();
    navigate("/", { replace: true });
  }, [stopTimer, logout, navigate]);

  const startCountdown = useCallback((initialSeconds = TOTAL_SECONDS) => {
    if (didLogoutRef.current) return;
    const secs = Math.max(1, Math.min(initialSeconds, TOTAL_SECONDS));
    setSeconds(secs);
    setActive(true);
    setShow(true);
    setLeaving(false);
    stopTimer();
    timerRef.current = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) { doLogout(); return 0; }
        return prev - 1;
      });
    }, 1000);
  }, [stopTimer, doLogout]);

  // Keep latest callbacks in refs so the poll loop doesn't need re-registration.
  const startCountdownRef = useRef(startCountdown);
  const stopTimerRef = useRef(stopTimer);
  useEffect(() => { startCountdownRef.current = startCountdown; }, [startCountdown]);
  useEffect(() => { stopTimerRef.current = stopTimer; }, [stopTimer]);

  // Poll maintenance status while logged in as a non-admin.
  useEffect(() => {
    if (!isAuthed || isAdmin) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }

    const check = async () => {
      const status = await GetPublicMaintenanceStatus();
      if (status.enabled) {
        if (!timerRef.current && !didLogoutRef.current) {
          startCountdownRef.current(
            status.seconds_remaining > 0 ? status.seconds_remaining : TOTAL_SECONDS,
          );
        }
      } else if (timerRef.current) {
        stopTimerRef.current();
        setShow(false);
        setActive(false);
        didLogoutRef.current = false;
      }
    };

    void check();
    pollRef.current = setInterval(check, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed, isAdmin]);

  // When a protected API call returns 503 (maintenance middleware kicked in
  // after the grace period), AuthContext force-clears the user; just hide the UI.
  useEffect(() => {
    const onBlock = () => {
      setShow(false);
      setLeaving(true);
      setTimeout(() => setActive(false), 400);
    };
    window.addEventListener("session:maintenance", onBlock);
    return () => window.removeEventListener("session:maintenance", onBlock);
  }, []);

  if (!active || isAdmin) return null;

  const pct = (seconds / TOTAL_SECONDS) * 100;
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  const reopenModal = () => { setShow(true); setLeaving(false); };

  return (
    <>
      {/* ── Full modal (visible when show=true) ─────────────────────────── */}
      {show && (
        <div
          className={[
            "fixed right-4 top-4 z-9999 w-68 select-none",
            "transition-all duration-400 ease-out",
            !leaving ? "translate-x-0 opacity-100" : "translate-x-80 opacity-0",
          ].join(" ")}
          role="alert"
        >
          <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-lg shadow-black/8 dark:border-white/10 dark:bg-[#111019]">

            <div className="flex items-center justify-between px-4 pt-3.5 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-500/15">
                  <FiTool className="text-[12px] text-amber-500 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-[12px] font-semibold text-slate-800 dark:text-white/90">{t("maintenanceCountdown.title")}</p>
                  <p className="text-[10px] text-slate-400 dark:text-white/35">{t("maintenanceCountdown.subtitle")}</p>
                </div>
              </div>
              {/* X = hide modal only; timer keeps running in background */}
              <button
                onClick={() => setShow(false)}
                className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 dark:text-white/30 dark:hover:bg-white/8"
              >
                <FiX className="text-[11px]" />
              </button>
            </div>

            <div className="flex items-center justify-center py-4">
              <span className="text-[42px] font-bold tabular-nums leading-none text-slate-800 dark:text-white/90">
                {mm}:{ss}
              </span>
            </div>

            <div className="mx-4 mb-4 h-0.75 overflow-hidden rounded-full bg-slate-100 dark:bg-white/8">
              <div
                className="h-full rounded-full bg-amber-400 transition-all duration-1000"
                style={{ width: `${pct}%` }}
              />
            </div>

            <div className="border-t border-slate-100 px-4 py-3 dark:border-white/6">
              <button
                onClick={doLogout}
                className="w-full rounded-lg bg-amber-500 py-2 text-[12px] font-semibold text-white transition hover:bg-amber-400"
              >
                {t("maintenanceCountdown.signOutNow")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mini pill indicator (visible when modal is dismissed) ────────── */}
      {/* top-20 = 80px, safely below the navbar */}
      {!show && !leaving && (
        <button
          onClick={reopenModal}
          className="fixed right-4 top-20 z-9999 flex items-center gap-1.5 rounded-full border border-amber-200/80 bg-white px-3 py-1.5 shadow-md shadow-amber-500/10 transition hover:border-amber-300 hover:shadow-amber-500/20 dark:border-amber-400/25 dark:bg-[#111019] dark:hover:border-amber-400/40"
          title={t("maintenanceCountdown.reopenTooltip")}
        >
          <FiTool className="text-[10px] text-amber-500 dark:text-amber-400" />
          <span className="text-[11px] font-bold tabular-nums text-slate-700 dark:text-white/80">
            {mm}:{ss}
          </span>
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
        </button>
      )}
    </>
  );
};

export default MaintenanceCountdown;
