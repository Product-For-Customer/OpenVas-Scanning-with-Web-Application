import React, { useMemo, useRef } from "react";
import { Outlet } from "react-router-dom";
import { TooltipComponent } from "@syncfusion/ej2-react-popups";
import { useStateContext } from "../../contexts/ContextProvider";
import { Navbar, Sidebar, ThemeSettings } from "./index";
import "./main.css";

const SIDEBAR_EXPANDED_WIDTH = 272;
const SIDEBAR_COLLAPSED_WIDTH = 76;
const DESKTOP_BREAKPOINT = 900;

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

    if (isInsideScrollablePopup(event?.target ?? null)) {
      return;
    }

    scrollLockRef.current = true;

    setIsClicked((prev) => {
      if (!prev.notification && !prev.userProfile) return prev;

      return {
        ...prev,
        notification: false,
        userProfile: false,
      };
    });

    window.requestAnimationFrame(() => {
      scrollLockRef.current = false;
    });
  };

  return (
    <div>
      <div
        className={[
          "relative min-h-screen overflow-x-hidden",
          "bg-[#f3f7fb]",
          "dark:bg-linear-to-br dark:from-[#070A12] dark:via-[#0A1020] dark:to-[#070A12]",
        ].join(" ")}
        onScrollCapture={closeNavbarPopups}
        onWheelCapture={closeNavbarPopups}
        onTouchMoveCapture={closeNavbarPopups}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-[18%] top-0 h-96 w-96 rounded-full bg-cyan-400/8 blur-[120px]" />
          <div className="absolute right-0 top-[20%] h-96 w-96 rounded-full bg-violet-500/8 blur-[120px]" />
          <div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-sky-500/8 blur-[120px]" />
        </div>

        <div className="fixed bottom-4 right-4 z-1000">
          <TooltipComponent content="Settings" position={"Top" as any}>
            <div />
          </TooltipComponent>
        </div>

        <Sidebar />

        <div
          className={[
            "relative min-h-screen",
            "transform-gpu",
            "transition-[margin-left] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
            "will-change-[margin-left]",
          ].join(" ")}
          style={{
            marginLeft: contentMarginLeft,
            backfaceVisibility: "hidden",
          }}
        >
          <Navbar />
          {themeSettings && <ThemeSettings />}

          <main className="relative px-2.5 pb-4 sm:px-3.5 md:px-4.5 md:pb-5 lg:px-5">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};

export default MainLayout;