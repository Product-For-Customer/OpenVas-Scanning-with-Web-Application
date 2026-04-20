import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { MdOutlineCancel, MdKeyboardArrowDown } from "react-icons/md";
import { TooltipComponent } from "@syncfusion/ej2-react-popups";
import { FiLogOut } from "react-icons/fi";
import { getLinks, type SidebarSection } from "./dummy";
import { useStateContext } from "../../contexts/ContextProvider";
import { useAuth } from "../../contexts/AuthContext";
import logo from "../../assets/argus-logo-real.png";
import { message } from "antd";

type SidebarLink = {
  name: string;
  icon?: React.ReactNode;
  badge?: string;
};

const EXPANDED_WIDTH = 272;
const COLLAPSED_WIDTH = 76;
const DESKTOP_BREAKPOINT = 900;

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const { logout, isAdmin } = useAuth();
  const { activeMenu, setActiveMenu, screenSize } = useStateContext();

  const [menuLinks, setMenuLinks] = useState<SidebarSection[]>([]);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [hoveredSection, setHoveredSection] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const hoverCloseTimer = useRef<number | null>(null);

  const isDesktop =
    typeof screenSize === "number" ? screenSize > DESKTOP_BREAKPOINT : true;

  const isExpanded = !!activeMenu;

  const sidebarWidth = useMemo(() => {
    if (!isDesktop) return "88vw";
    return isExpanded ? `${EXPANDED_WIDTH}px` : `${COLLAPSED_WIDTH}px`;
  }, [isDesktop, isExpanded]);

  const handleCloseSideBar = () => {
    if (typeof screenSize === "number" && screenSize <= DESKTOP_BREAKPOINT) {
      setActiveMenu(false);
    }
  };

  useEffect(() => {
    try {
      const data = getLinks({ isAdmin });
      const safeData = Array.isArray(data) ? data : [];

      setMenuLinks(safeData);

      const nextOpen: Record<string, boolean> = {};
      safeData.forEach((section: SidebarSection) => {
        const hasActiveChild = section.links?.some(
          (link) => location.pathname === `/admin/${link.name}`
        );

        nextOpen[section.title] = !!hasActiveChild;
      });
      setOpenSections(nextOpen);
    } catch (error) {
      console.error("Failed to load sidebar links:", error);
      setMenuLinks([]);
    }
  }, [location.pathname, isAdmin]);

  useEffect(() => {
    if (isDesktop && isExpanded) {
      setHoveredSection(null);
    }
  }, [isDesktop, isExpanded]);

  useEffect(() => {
    return () => {
      if (hoverCloseTimer.current) {
        window.clearTimeout(hoverCloseTimer.current);
      }
    };
  }, []);

  const openHoverPopup = (title: string) => {
    if (hoverCloseTimer.current) {
      window.clearTimeout(hoverCloseTimer.current);
      hoverCloseTimer.current = null;
    }
    setHoveredSection(title);
  };

  const closeHoverPopupWithDelay = (title: string) => {
    if (hoverCloseTimer.current) {
      window.clearTimeout(hoverCloseTimer.current);
    }

    hoverCloseTimer.current = window.setTimeout(() => {
      setHoveredSection((prev) => (prev === title ? null : prev));
      hoverCloseTimer.current = null;
    }, 120);
  };

  const toggleSection = (title: string) => {
    if (isDesktop && !isExpanded) return;
    setOpenSections((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  const isLinkActive = (linkName: string) =>
    location.pathname === `/admin/${linkName}`;

  const formatLabel = useMemo(
    () => (value: string) => {
      if (!value) return "";
      return value
        .replace(/[-_]+/g, " ")
        .replace(/\b\w/g, (s) => s.toUpperCase());
    },
    []
  );

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await logout();
      message.success("logout success");
      setHoveredSection(null);
      handleCloseSideBar();
      await new Promise((resolve) => setTimeout(resolve, 1000));
      navigate("/", { replace: true });
    } catch (error) {
      console.error("Logout failed:", error);
      message.error("logout failed");
      navigate("/", { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  if (!isDesktop && !activeMenu) return null;

  return (
    <>
      <style>
        {`
          @keyframes argusLogoFloat {
            0%, 100% {
              transform: translateY(0px) scale(1);
            }
            50% {
              transform: translateY(-3px) scale(1.01);
            }
          }

          @keyframes argusLogoGlow {
            0%, 100% {
              opacity: 0.28;
              transform: scale(0.96);
            }
            50% {
              opacity: 0.60;
              transform: scale(1.05);
            }
          }

          @keyframes argusPulseRingOne {
            0% {
              opacity: 0;
              transform: scale(0.74);
            }
            16% {
              opacity: 0.42;
            }
            42% {
              opacity: 0.24;
            }
            100% {
              opacity: 0;
              transform: scale(1.38);
            }
          }

          @keyframes argusPulseRingTwo {
            0% {
              opacity: 0;
              transform: scale(0.80);
            }
            18% {
              opacity: 0.34;
            }
            46% {
              opacity: 0.18;
            }
            100% {
              opacity: 0;
              transform: scale(1.52);
            }
          }

          @keyframes argusScanLine {
            0% {
              opacity: 0;
              transform: translateX(-16px) rotate(-16deg);
            }
            20% {
              opacity: 0.42;
            }
            80% {
              opacity: 0.12;
            }
            100% {
              opacity: 0;
              transform: translateX(16px) rotate(-16deg);
            }
          }

          @keyframes argusHorizontalBeam {
            0% {
              opacity: 0;
              transform: translateX(-10px) scaleX(0.85);
            }
            25% {
              opacity: 0.35;
            }
            75% {
              opacity: 0.16;
            }
            100% {
              opacity: 0;
              transform: translateX(10px) scaleX(1.05);
            }
          }

          @keyframes argusInnerArc {
            0%, 100% {
              opacity: 0.18;
              transform: scale(0.98) rotate(0deg);
            }
            50% {
              opacity: 0.38;
              transform: scale(1.03) rotate(8deg);
            }
          }

          @keyframes argusDotTwinkle {
            0%, 100% {
              opacity: 0.18;
              transform: scale(1);
            }
            50% {
              opacity: 0.9;
              transform: scale(1.22);
            }
          }

          @keyframes argusDotFloat {
            0%, 100% {
              transform: translateY(0px);
            }
            50% {
              transform: translateY(-2px);
            }
          }
        `}
      </style>

      <div
        className={`fixed inset-0 z-30 transition-opacity duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] md:hidden ${
          activeMenu ? "opacity-100" : "pointer-events-none opacity-0"
        } bg-[#020817]/35 dark:bg-black/45`}
        onClick={handleCloseSideBar}
      />

      <aside
        className={[
          "fixed inset-y-0 left-0 z-40 h-screen",
          "bg-transparent dark:bg-transparent",
          "transform-gpu will-change-[width,transform]",
          "transition-[width,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        ].join(" ")}
        style={{
          width: sidebarWidth,
          maxWidth: isDesktop ? undefined : "320px",
          padding: isDesktop ? "10px" : "14px",
          paddingTop: "max(env(safe-area-inset-top), 12px)",
          backfaceVisibility: "hidden",
          transform: "translateZ(0)",
        }}
      >
        <div
          className={[
            "relative flex h-full flex-col overflow-visible rounded-[28px]",
            "border border-gray-200/80 bg-white/92 shadow-[0_18px_44px_-24px_rgba(15,23,42,0.35)] backdrop-blur",
            "dark:border-white/10 dark:bg-[#08111f]/88 dark:ring-1 dark:ring-cyan-400/10 dark:shadow-none",
          ].join(" ")}
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[28px]">
            <div className="absolute -top-12 right-0 h-28 w-28 rounded-full bg-cyan-400/10 blur-3xl" />
            <div className="absolute bottom-0 -left-10 h-28 w-28 rounded-full bg-violet-500/10 blur-3xl" />
          </div>

          <div
            className={`relative z-10 flex items-center ${
              isExpanded
                ? "justify-between px-3.5 pb-3.5 pt-5"
                : "justify-center px-2 pb-3.5 pt-4.5"
            }`}
          >
            <Link
              to="/admin"
              onClick={handleCloseSideBar}
              className={`select-none ${
                isExpanded
                  ? "flex items-center gap-3.5"
                  : "flex items-center justify-center"
              }`}
              aria-label="Go to dashboard"
            >
              <div className="group relative flex h-16 w-16 shrink-0 items-center justify-center overflow-visible">
                <span
                  className="pointer-events-none absolute inset-2 rounded-full bg-cyan-400/15 blur-lg dark:bg-cyan-400/20"
                  style={{
                    animation: "argusLogoGlow 3.9s ease-in-out infinite",
                  }}
                />

                <span
                  className="pointer-events-none absolute inset-2.5 rounded-full border border-cyan-300/18 border-dashed"
                  style={{
                    animation: "argusInnerArc 3.4s ease-in-out infinite",
                  }}
                />

                <span
                  className="pointer-events-none absolute inset-1.25 rounded-full border border-cyan-400/40"
                  style={{
                    animation: "argusPulseRingOne 2.2s ease-out infinite",
                  }}
                />

                <span
                  className="pointer-events-none absolute inset-0.75 rounded-full border border-sky-300/28"
                  style={{
                    animation: "argusPulseRingTwo 2.2s ease-out 0.7s infinite",
                  }}
                />

                <span
                  className="pointer-events-none absolute left-1/2 top-1/2 h-13 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-linear-to-b from-transparent via-cyan-300/55 to-transparent blur-[5px]"
                  style={{
                    animation: "argusScanLine 2.4s ease-in-out infinite",
                  }}
                />

                <span
                  className="pointer-events-none absolute left-1/2 top-1/2 h-0.5 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-linear-to-r from-transparent via-cyan-300/45 to-transparent blur-[1px]"
                  style={{
                    animation: "argusHorizontalBeam 2.8s ease-in-out infinite",
                  }}
                />

                <span
                  className="pointer-events-none absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-cyan-300/90 blur-[1px]"
                  style={{
                    animation:
                      "argusDotTwinkle 2s ease-in-out infinite, argusDotFloat 2.6s ease-in-out infinite",
                  }}
                />
                <span
                  className="pointer-events-none absolute bottom-2 left-2 h-1 w-1 rounded-full bg-sky-300/85 blur-[1px]"
                  style={{
                    animation:
                      "argusDotTwinkle 2.2s ease-in-out 0.55s infinite, argusDotFloat 2.9s ease-in-out 0.2s infinite",
                  }}
                />
                <span
                  className="pointer-events-none absolute left-1 top-4 h-1.5 w-1.5 rounded-full bg-cyan-200/85 blur-[1px]"
                  style={{
                    animation:
                      "argusDotTwinkle 2.4s ease-in-out 0.35s infinite, argusDotFloat 3s ease-in-out 0.4s infinite",
                  }}
                />
                <span
                  className="pointer-events-none absolute right-1 bottom-3 h-1 w-1 rounded-full bg-sky-200/90 blur-[1px]"
                  style={{
                    animation:
                      "argusDotTwinkle 2.1s ease-in-out 0.8s infinite, argusDotFloat 2.7s ease-in-out 0.1s infinite",
                  }}
                />

                <div
                  className="relative z-10 flex h-16 w-16 items-center justify-center transition-transform duration-300 group-hover:scale-[1.04] group-hover:rotate-3"
                  style={{
                    animation: "argusLogoFloat 4.2s ease-in-out infinite",
                    willChange: "transform",
                  }}
                >
                  <img
                    src={logo}
                    alt="Logo"
                    className="h-28 w-28 object-contain drop-shadow-[0_8px_18px_rgba(34,211,238,0.14)] transition-all duration-300 group-hover:drop-shadow-[0_10px_22px_rgba(34,211,238,0.22)]"
                  />
                </div>
              </div>

              {isExpanded && (
                <div className="min-w-0">
                  <span className="block text-[16px] font-semibold tracking-tight text-[#1f2240] dark:text-white/90">
                    Argus
                  </span>
                  <span className="block text-[10.5px] text-gray-500 dark:text-white/45">
                    Network Monitoring Panel
                  </span>
                </div>
              )}
            </Link>

            {isExpanded && !isDesktop && (
              <TooltipComponent content="Close menu" position="BottomCenter">
                <button
                  type="button"
                  onClick={() => setActiveMenu(false)}
                  className={[
                    "rounded-xl p-2 transition-colors",
                    "text-gray-600 hover:bg-gray-200/70 active:bg-gray-300/70",
                    "dark:text-white/70 dark:hover:bg-white/10 dark:active:bg-white/15",
                  ].join(" ")}
                  aria-label="Close menu"
                >
                  <MdOutlineCancel className="text-xl" />
                </button>
              </TooltipComponent>
            )}
          </div>

          <nav
            className={`relative z-10 flex-1 ${
              isExpanded
                ? "overflow-y-auto px-2.5 pb-3.5"
                : "overflow-visible px-2 pb-3"
            }`}
          >
            <div className={isExpanded ? "space-y-1.5" : "space-y-2.5"}>
              {menuLinks.map((section) => {
                const isOpen = !!openSections[section.title];
                const hasActiveChild =
                  section.links?.some((link: SidebarLink) =>
                    isLinkActive(link.name)
                  ) ?? false;

                const sectionIcon =
                  section.links?.[0]?.icon ?? (
                    <span className="h-2.5 w-2.5 rounded-full bg-current opacity-70" />
                  );

                if (isExpanded) {
                  return (
                    <div key={section.title} className="rounded-2xl">
                      <button
                        type="button"
                        onClick={() => toggleSection(section.title)}
                        className={[
                          "flex w-full items-center justify-between rounded-2xl px-3.5 py-2.75 text-left transition-all duration-200",
                          isOpen
                            ? "bg-linear-to-r from-cyan-500 via-sky-500 to-violet-500 text-white shadow-sm"
                            : "bg-transparent text-[#4b4f63] hover:bg-gray-50",
                          isOpen
                            ? "dark:shadow-none"
                            : "dark:text-white/70 dark:hover:bg-white/8",
                        ].join(" ")}
                        aria-expanded={isOpen}
                      >
                        <div className="min-w-0 flex items-center gap-3">
                          <span
                            className={[
                              "inline-flex h-7.5 w-7.5 items-center justify-center rounded-xl text-[15px]",
                              isOpen
                                ? "bg-white/15 text-white"
                                : "bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-white/55",
                            ].join(" ")}
                          >
                            {sectionIcon}
                          </span>

                          <span className="truncate text-[14px] font-medium">
                            {formatLabel(section.title)}
                          </span>
                        </div>

                        <MdKeyboardArrowDown
                          className={[
                            "text-[19px] transition-transform",
                            isOpen ? "rotate-0" : "-rotate-90",
                            isOpen
                              ? "text-white"
                              : "text-gray-500 dark:text-white/55",
                          ].join(" ")}
                        />
                      </button>

                      <div
                        className={`overflow-hidden transition-all duration-200 ${
                          isOpen
                            ? "max-h-150 pb-1 pt-1.5 opacity-100"
                            : "max-h-0 opacity-0"
                        }`}
                      >
                        <div className="space-y-1 pl-6.5 pr-2">
                          {section.links?.map((link: SidebarLink) => {
                            const active = isLinkActive(link.name);

                            return (
                              <NavLink
                                to={`/admin/${link.name}`}
                                key={`${section.title}-${link.name}`}
                                onClick={handleCloseSideBar}
                                className={[
                                  "flex items-center justify-between gap-2 rounded-xl px-3 py-2.25 transition-colors",
                                  active
                                    ? "bg-cyan-50 font-semibold text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-300"
                                    : "text-[#585b6b] hover:bg-gray-50 hover:text-[#2b2f45]",
                                  active
                                    ? ""
                                    : "dark:text-white/60 dark:hover:bg-white/8 dark:hover:text-white/85",
                                ].join(" ")}
                              >
                                <div className="min-w-0 flex items-center gap-3">
                                  <span
                                    className={[
                                      "inline-block h-2 w-2 rounded-full border",
                                      active
                                        ? "border-cyan-500 bg-cyan-500"
                                        : "border-gray-400 bg-transparent dark:border-white/30",
                                    ].join(" ")}
                                  />
                                  <span className="truncate text-[13px]">
                                    {formatLabel(link.name)}
                                  </span>
                                </div>

                                {link.badge && (
                                  <span className="ml-2 shrink-0 rounded-md bg-linear-to-r from-cyan-500 to-violet-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                                    {link.badge}
                                  </span>
                                )}
                              </NavLink>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={section.title}
                    className="relative"
                    onMouseEnter={() => openHoverPopup(section.title)}
                    onMouseLeave={() => closeHoverPopupWithDelay(section.title)}
                  >
                    <TooltipComponent
                      content={formatLabel(section.title)}
                      position="RightCenter"
                    >
                      <button
                        type="button"
                        className={[
                          "flex h-11 w-full items-center justify-center rounded-2xl transition-all duration-200",
                          hasActiveChild
                            ? "bg-linear-to-r from-cyan-500 via-sky-500 to-violet-500 text-white shadow-sm"
                            : "bg-[#eef3f8] text-gray-500 hover:bg-gray-50",
                          hasActiveChild
                            ? "dark:shadow-none"
                            : "dark:bg-white/8 dark:text-white/60 dark:hover:bg-white/10",
                        ].join(" ")}
                        aria-label={formatLabel(section.title)}
                      >
                        <span
                          className={[
                            "inline-flex h-7.5 w-7.5 items-center justify-center rounded-xl text-[17px]",
                            hasActiveChild
                              ? "bg-white/15 text-white"
                              : "text-gray-500 dark:text-white/60",
                          ].join(" ")}
                        >
                          {sectionIcon}
                        </span>
                      </button>
                    </TooltipComponent>

                    {hoveredSection === section.title && (
                      <div
                        className="absolute left-[calc(100%+10px)] top-0 z-70 w-62.5"
                        onMouseEnter={() => openHoverPopup(section.title)}
                        onMouseLeave={() =>
                          closeHoverPopupWithDelay(section.title)
                        }
                      >
                        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-white/10 dark:bg-[#0B1220] dark:shadow-none">
                          <div className="bg-linear-to-r from-cyan-500 via-sky-500 to-violet-500 px-4 py-3 text-white">
                            <div className="flex items-center gap-3">
                              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 text-[15px]">
                                {sectionIcon}
                              </span>
                              <span className="truncate text-[14px] font-medium">
                                {formatLabel(section.title)}
                              </span>
                            </div>
                          </div>

                          <div className="py-2">
                            {section.links?.map((link: SidebarLink) => {
                              const active = isLinkActive(link.name);

                              return (
                                <NavLink
                                  key={`${section.title}-${link.name}-mini`}
                                  to={`/admin/${link.name}`}
                                  onClick={() => {
                                    setHoveredSection(null);
                                    handleCloseSideBar();
                                  }}
                                  className={[
                                    "flex items-center justify-between px-4 py-2.5 text-[13px] transition-colors",
                                    active
                                      ? "bg-cyan-50 font-semibold text-cyan-700 dark:bg-white/8 dark:text-cyan-300"
                                      : "text-[#4f5366] hover:bg-gray-50 dark:text-white/65 dark:hover:bg-white/8",
                                  ].join(" ")}
                                >
                                  <span className="truncate">
                                    {formatLabel(link.name)}
                                  </span>

                                  {link.badge && (
                                    <span className="ml-3 shrink-0 rounded-md bg-linear-to-r from-cyan-500 to-violet-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                                      {link.badge}
                                    </span>
                                  )}
                                </NavLink>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </nav>

          <div
            className={`${
              isExpanded
                ? "relative z-10 px-2.5 pb-3.5 pt-1.5"
                : "relative z-10 px-2 pb-3.5 pt-1"
            }`}
          >
            {isExpanded ? (
              <button
                type="button"
                onClick={() => void handleLogout()}
                disabled={loggingOut}
                className={[
                  "flex w-full items-center justify-between rounded-2xl px-4 py-3.5 transition-colors",
                  "bg-[#eef3f8] text-[#3a3d4f] hover:bg-[#e7edf5]",
                  "dark:bg-white/8 dark:text-white/75 dark:hover:bg-white/10",
                  loggingOut ? "cursor-not-allowed opacity-70" : "",
                ].join(" ")}
                aria-label="Logout"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-8.5 w-8.5 items-center justify-center rounded-xl bg-white text-gray-600 dark:bg-white/10 dark:text-white/70">
                    <FiLogOut />
                  </span>
                  <div className="text-left leading-tight">
                    <span className="block text-[14px] font-semibold">
                      {loggingOut ? "Logging out..." : "Logout"}
                    </span>
                    <span className="block text-[10.5px] text-gray-500 dark:text-white/45">
                      End current session
                    </span>
                  </div>
                </div>

                <FiLogOut className="text-[17px] text-gray-500 dark:text-white/60" />
              </button>
            ) : (
              <TooltipComponent
                content={loggingOut ? "Logging out..." : "Logout"}
                position="RightCenter"
              >
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  disabled={loggingOut}
                  className={[
                    "flex h-11 w-full items-center justify-center rounded-2xl transition-colors",
                    "bg-[#eef3f8] text-gray-500 hover:bg-[#e7edf5]",
                    "dark:bg-white/8 dark:text-white/60 dark:hover:bg-white/10",
                    loggingOut ? "cursor-not-allowed opacity-70" : "",
                  ].join(" ")}
                  aria-label="Logout"
                >
                  <FiLogOut className="text-[18px]" />
                </button>
              </TooltipComponent>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;