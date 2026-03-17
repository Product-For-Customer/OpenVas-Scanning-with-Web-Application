import { Outlet } from "react-router-dom";
import { TooltipComponent } from "@syncfusion/ej2-react-popups";
import { useStateContext } from "../../contexts/ContextProvider";
import { Navbar, Sidebar, ThemeSettings } from "./index";
import "./main.css";

const SIDEBAR_EXPANDED_WIDTH = 272;
const SIDEBAR_COLLAPSED_WIDTH = 76;
const DESKTOP_BREAKPOINT = 900;

const MainLayout = () => {
  const { activeMenu, themeSettings, screenSize } = useStateContext();

  const isDesktop =
    typeof screenSize === "number" ? screenSize > DESKTOP_BREAKPOINT : true;

  const contentMarginLeft = isDesktop
    ? activeMenu
      ? SIDEBAR_EXPANDED_WIDTH
      : SIDEBAR_COLLAPSED_WIDTH
    : 0;

  return (
    <div>
      <div
        className={[
          "relative min-h-screen overflow-x-hidden",
          "bg-[#f3f7fb]",
          "dark:bg-linear-to-br dark:from-[#070A12] dark:via-[#0A1020] dark:to-[#070A12]",
        ].join(" ")}
      >
        {/* background glow */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-[18%] h-96 w-96 rounded-full bg-cyan-400/8 blur-[120px]" />
          <div className="absolute top-[20%] right-0 h-96 w-96 rounded-full bg-violet-500/8 blur-[120px]" />
          <div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-sky-500/8 blur-[120px]" />
        </div>

        <div className="fixed right-4 bottom-4 z-1000">
          <TooltipComponent content="Settings" position={"Top" as any}>
            <div />
          </TooltipComponent>
        </div>

        <Sidebar />

        <div
          className="relative min-h-screen transition-all duration-300"
          style={{ marginLeft: contentMarginLeft }}
        >
          <Navbar />
          {themeSettings && <ThemeSettings />}

          <main className="relative px-2.5 sm:px-3.5 md:px-4.5 lg:px-5 pb-4 md:pb-5">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};

export default MainLayout;