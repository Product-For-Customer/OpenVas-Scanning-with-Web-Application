import React, { useMemo, useRef } from "react";
import { Outlet } from "react-router-dom";
import { useStateContext } from "../../contexts/ProviderContext";
import { Navbar, Sidebar, ThemeSettings } from "./path";
import MaintenanceCountdown from "./MaintenanceCountdown";
import "./main.css";

const SIDEBAR_EXPANDED_WIDTH  = 272;
const SIDEBAR_COLLAPSED_WIDTH = 88;
const DESKTOP_BREAKPOINT      = 900;

const MainLayout: React.FC = () => {
  const { activeMenu, themeSettings, screenSize, setIsClicked } =
    useStateContext();

  const scrollLockRef = useRef(false);

  const isDesktop =
    typeof screenSize === "number" ? screenSize > DESKTOP_BREAKPOINT : true;

  const contentMarginLeft = useMemo(() => {
    if (!isDesktop) return 0;
    return activeMenu ? SIDEBAR_EXPANDED_WIDTH : SIDEBAR_COLLAPSED_WIDTH;
  }, [activeMenu, isDesktop]);

  const isInsideScrollablePopup = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;
    return Boolean(target.closest('[data-allow-popup-scroll="true"]'));
  };

  const closeNavbarPopups = (event?: React.SyntheticEvent) => {
    if (scrollLockRef.current) return;
    if (isInsideScrollablePopup(event?.target ?? null)) return;

    scrollLockRef.current = true;
    setIsClicked((prev) => {
      if (!prev.notification && !prev.userProfile) return prev;
      return { ...prev, notification: false, userProfile: false };
    });
    window.requestAnimationFrame(() => { scrollLockRef.current = false; });
  };

  return (
    <div className="min-h-dvh">
      <div
        className={[
          "relative min-h-dvh overflow-x-hidden",
          "bg-[#f5f6fa]",
          "dark:bg-[#0b0d17]",
        ].join(" ")}
        onScrollCapture={closeNavbarPopups}
        onWheelCapture={closeNavbarPopups}
        onTouchMoveCapture={closeNavbarPopups}
      >
        {/* Subtle ambient glow — same as Example-Web-Application */}
        <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
          <div className="absolute right-[10%] top-[8%] h-80 w-80 rounded-full bg-violet-300/8 blur-[100px] dark:bg-violet-500/6" />
          <div className="absolute bottom-[15%] left-[8%] h-72 w-72 rounded-full bg-blue-300/8 blur-[100px] dark:bg-blue-500/5" />
        </div>

        <Sidebar />

        <div
          className={[
            "relative z-10 min-h-dvh",
            "transform-gpu will-change-[margin-left]",
            "transition-[margin-left] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          ].join(" ")}
          style={{ marginLeft: contentMarginLeft, backfaceVisibility: "hidden" }}
        >
          <Navbar />
          {themeSettings && <ThemeSettings />}
          <main className="relative px-2.5 pt-1 pb-4 sm:px-3.5 sm:pt-1.5 md:px-4.5 md:pt-2 md:pb-5 lg:px-5 lg:pt-2.5">
            <Outlet />
          </main>
        </div>
      </div>
      <MaintenanceCountdown />
    </div>
  );
};

export default MainLayout;
