import React, { useEffect, useMemo, useState } from "react";
import { AiOutlineMenu } from "react-icons/ai";
import { RiNotification3Line } from "react-icons/ri";
import { MdKeyboardArrowDown } from "react-icons/md";
import { TooltipComponent } from "@syncfusion/ej2-react-popups";
import { Notification, UserProfile } from ".";
import { useStateContext } from "../../contexts/ContextProvider";

import { FiSearch } from "react-icons/fi";
import { HiOutlineMoon, HiOutlineSun } from "react-icons/hi2";

// import png greenbone icon
import greenboneIcon from "../../assets/logo-light.svg";

type NavBtnProps = {
  title: string;
  onClick?: () => void;
  icon: React.ReactNode;
  dotColor?: string;
  badgeCount?: number;
  className?: string;
  "aria-label"?: string;
};

const DESKTOP_BREAKPOINT = 900;

const NavButton: React.FC<NavBtnProps> = ({
  title,
  onClick,
  icon,
  dotColor,
  badgeCount,
  className = "",
  "aria-label": ariaLabel,
}) => (
  <TooltipComponent content={title} position="BottomCenter">
    <button
      type="button"
      aria-label={ariaLabel ?? title}
      onClick={onClick}
      className={[
        "relative inline-flex h-10 w-10 items-center justify-center rounded-xl text-[18px] transition-all duration-200",
        "text-gray-600 hover:bg-gray-100 active:bg-gray-200",
        "dark:text-white/75 dark:hover:bg-white/10 dark:active:bg-white/15",
        className,
      ].join(" ")}
    >
      {dotColor && (
        <span
          style={{ background: dotColor }}
          className="absolute right-1.5 top-1.5 inline-flex h-2 w-2 rounded-full"
        />
      )}

      {typeof badgeCount === "number" && badgeCount > 0 && (
        <span
          className={[
            "absolute -right-1 -top-1 min-w-4 h-4 px-1",
            "inline-flex items-center justify-center rounded-full",
            "bg-linear-to-r from-cyan-500 to-violet-500 text-white text-[10px] font-bold leading-none shadow-sm",
          ].join(" ")}
        >
          {badgeCount > 99 ? "99+" : badgeCount}
        </span>
      )}

      {icon}
    </button>
  </TooltipComponent>
);

const Navbar: React.FC = () => {
  const {
    //@ts-ignore
    activeMenu,
    setActiveMenu,
    handleClick,
    isClicked,
    setScreenSize,
    screenSize,
    currentMode,
    toggleMode,
  } = useStateContext();

  const [firstnameUser] = useState<string>("Alex");
  const [profileError, setProfileError] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const onResize = () => setScreenSize(window.innerWidth);
    window.addEventListener("resize", onResize);
    onResize();
    return () => window.removeEventListener("resize", onResize);
  }, [setScreenSize]);

  useEffect(() => {
    if (typeof screenSize === "number") {
      setActiveMenu(screenSize > DESKTOP_BREAKPOINT);
    }
  }, [screenSize, setActiveMenu]);

  const handleActiveMenu = () => setActiveMenu(!activeMenu);

  const openGreenbone = () => {
    window.open("http://localhost:9392", "_blank", "noopener,noreferrer");
  };

  const fallbackAvatar = useMemo(
    () =>
      "data:image/svg+xml;utf8," +
      encodeURIComponent(`
        <svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'>
          <defs>
            <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
              <stop offset='0%' stop-color='#dbeafe'/>
              <stop offset='100%' stop-color='#c4b5fd'/>
            </linearGradient>
          </defs>
          <rect width='100%' height='100%' rx='14' ry='14' fill='url(#g)'/>
          <circle cx='32' cy='24' r='10' fill='#475569'/>
          <path d='M16 50c2-8 10-12 16-12s14 4 16 12' fill='#475569'/>
        </svg>
      `),
    []
  );

  const avatarSrc = profileError ? fallbackAvatar : fallbackAvatar;

  return (
    <header
      className={["sticky top-0 z-30 w-full", "bg-transparent", "dark:bg-transparent"].join(" ")}
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="px-2.5 sm:px-3.5 md:px-4.5 lg:px-5 pt-2.5 pb-2.5">
        <div
          className={[
            "relative w-full min-h-18.5 rounded-[22px] flex items-center justify-between overflow-hidden",
            "bg-white/92 border border-gray-200/80 shadow-[0_14px_36px_-24px_rgba(15,23,42,0.28)] backdrop-blur",
            "dark:bg-[#08111f]/80 dark:border-white/10 dark:ring-1 dark:ring-cyan-400/10 dark:shadow-none",
          ].join(" ")}
        >
          {/* glow background */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-12 right-10 h-24 w-24 rounded-full bg-cyan-400/10 blur-3xl" />
            <div className="absolute -bottom-12 left-16 h-24 w-24 rounded-full bg-violet-500/10 blur-3xl" />
          </div>

          {/* Left */}
          <div className="relative z-10 flex items-center gap-2.5 sm:gap-3 pl-3 sm:pl-4 md:pl-5 min-w-0 flex-1">
            <TooltipComponent
              content={activeMenu ? "Hide menu" : "Open menu"}
              position="BottomCenter"
            >
              <button
                type="button"
                aria-label="Toggle menu"
                onClick={handleActiveMenu}
                className={[
                  "inline-flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200",
                  "text-gray-600 hover:bg-gray-100 active:bg-gray-200",
                  "dark:text-white/75 dark:hover:bg-white/10 dark:active:bg-white/15",
                ].join(" ")}
              >
                <AiOutlineMenu className="text-[20px]" />
              </button>
            </TooltipComponent>

            {/* Search desktop */}
            <div
              className={[
                "hidden sm:flex items-center h-11 w-full max-w-85 lg:max-w-115 xl:max-w-130 rounded-full px-4",
                "border border-gray-200 bg-[#f6f8fc]",
                "shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]",
                "dark:border-white/10 dark:bg-white/5 dark:shadow-none",
              ].join(" ")}
            >
              <FiSearch className="text-gray-400 dark:text-white/40 text-[17px] mr-3 shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search assets, hosts, tasks, vulnerabilities..."
                className={[
                  "flex-1 bg-transparent outline-none border-none text-[13px]",
                  "text-gray-700 placeholder:text-gray-400",
                  "dark:text-white/80 dark:placeholder:text-white/35",
                ].join(" ")}
                aria-label="Search"
              />
              <span className="ml-3 hidden md:inline-flex items-center text-[11px] font-medium text-gray-400 dark:text-white/35 whitespace-nowrap">
                ⌘ + k
              </span>
            </div>
          </div>

          {/* Right */}
          <div className="relative z-10 flex items-center h-full shrink-0">
            <div className="flex items-center gap-1 px-2 sm:px-3">
              <NavButton
                title="Open Greenbone"
                aria-label="Open Greenbone"
                onClick={openGreenbone}
                icon={
                  <img
                    src={greenboneIcon}
                    alt="Greenbone"
                    className="h-7 w-7 object-contain"
                  />
                }
              />

              <NavButton
                title={currentMode === "Dark" ? "Light mode" : "Dark mode"}
                aria-label="Toggle theme"
                onClick={toggleMode}
                icon={currentMode === "Dark" ? <HiOutlineSun /> : <HiOutlineMoon />}
              />

              <NavButton
                title="Notifications"
                aria-label="Open notifications"
                badgeCount={0}
                dotColor="#22d3ee"
                onClick={() => handleClick("notification")}
                icon={<RiNotification3Line />}
              />
            </div>

            <div className="h-8 w-px bg-gray-200/90 dark:bg-white/10" />

            <div className="px-2.5 sm:px-3.5 md:px-4">
              <TooltipComponent content="Profile" position="BottomCenter">
                <button
                  type="button"
                  onClick={() => handleClick("userProfile")}
                  className={[
                    "group flex items-center gap-2 sm:gap-2.5 rounded-xl px-2 sm:px-2.5 py-1.5 transition-colors max-w-[44vw] sm:max-w-none",
                    "hover:bg-gray-100 active:bg-gray-200",
                    "dark:hover:bg-white/10 dark:active:bg-white/15",
                  ].join(" ")}
                  aria-label="Open profile"
                >
                  <div className="relative">
                    <img
                      src={avatarSrc}
                      alt="user"
                      className="h-9 w-9 rounded-full object-cover ring-1 ring-gray-200 bg-white dark:ring-white/15 dark:bg-white/10"
                      onError={() => setProfileError(true)}
                    />
                    <span className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full bg-cyan-400 ring-2 ring-white dark:ring-[#08111f]" />
                  </div>

                  <div className="hidden sm:block text-left leading-tight">
                    <span className="block text-[12px] text-gray-500 dark:text-white/45">
                      Analyst
                    </span>
                    <span className="block text-[13px] font-semibold text-gray-700 dark:text-white/80 truncate max-w-22 md:max-w-30">
                      {firstnameUser}...
                    </span>
                  </div>

                  <MdKeyboardArrowDown className="hidden sm:block text-gray-400 dark:text-white/45 group-hover:text-gray-600 dark:group-hover:text-white/70 text-[18px]" />
                </button>
              </TooltipComponent>
            </div>
          </div>
        </div>
      </div>

      {isClicked.notification && <Notification />}
      {isClicked.userProfile && <UserProfile />}
    </header>
  );
};

export default Navbar;