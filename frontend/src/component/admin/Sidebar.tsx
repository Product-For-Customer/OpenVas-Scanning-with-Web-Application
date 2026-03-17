import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { MdOutlineCancel, MdKeyboardArrowDown } from "react-icons/md";
import { TooltipComponent } from "@syncfusion/ej2-react-popups";
import { FiLogOut, FiShield } from "react-icons/fi";
import { getLinks, type SidebarSection } from "./dummy";
import { useStateContext } from "../../contexts/ContextProvider";
import { useAuth } from "../../contexts/AuthContext";

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
      safeData.forEach((section: SidebarSection, index: number) => {
        const hasActiveChild = section.links?.some(
          (link) => location.pathname === `/admin/${link.name}`
        );
        nextOpen[section.title] = hasActiveChild || index === 0;
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
      setHoveredSection(null);
      handleCloseSideBar();
      navigate("/", { replace: true });
    } catch (error) {
      console.error("Logout failed:", error);
      navigate("/", { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  if (!isDesktop && !activeMenu) return null;

  return (
    <>
      <div
        className={`fixed inset-0 z-30 transition-opacity md:hidden ${
          activeMenu ? "opacity-100" : "pointer-events-none opacity-0"
        } bg-[#020817]/35 dark:bg-black/45`}
        onClick={handleCloseSideBar}
      />

      <aside
        className={[
          "fixed inset-y-0 left-0 z-40 h-screen transition-all duration-300",
          "bg-transparent",
          "dark:bg-transparent",
        ].join(" ")}
        style={{
          width: isDesktop
            ? isExpanded
              ? `${EXPANDED_WIDTH}px`
              : `${COLLAPSED_WIDTH}px`
            : "88vw",
          maxWidth: isDesktop ? undefined : "320px",
          padding: isDesktop ? "10px" : "14px",
          paddingTop: "max(env(safe-area-inset-top), 12px)",
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

          {/* Header */}
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
                  ? "flex items-center gap-3"
                  : "flex justify-center items-center"
              }`}
              aria-label="Go to dashboard"
            >
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-cyan-500 via-sky-500 to-violet-500 shadow-sm">
                <FiShield className="text-[18px] text-white" />
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-cyan-300 ring-2 ring-white dark:ring-[#08111f]" />
              </div>

              {isExpanded && (
                <div className="min-w-0">
                  <span className="block text-[16px] font-semibold tracking-tight text-[#1f2240] dark:text-white/90">
                    Scan Network
                  </span>
                  <span className="block text-[10.5px] text-gray-500 dark:text-white/45">
                    Network Security Panel
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

          {/* Menu Body */}
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
                          hasActiveChild || isOpen
                            ? "bg-linear-to-r from-cyan-500 via-sky-500 to-violet-500 text-white shadow-sm"
                            : "bg-transparent text-[#4b4f63] hover:bg-gray-50",
                          hasActiveChild || isOpen
                            ? "dark:shadow-none"
                            : "dark:text-white/70 dark:hover:bg-white/8",
                        ].join(" ")}
                        aria-expanded={isOpen}
                      >
                        <div className="min-w-0 flex items-center gap-3">
                          <span
                            className={[
                              "inline-flex h-7.5 w-7.5 items-center justify-center rounded-xl text-[15px]",
                              hasActiveChild || isOpen
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
                            hasActiveChild || isOpen
                              ? "text-white"
                              : "text-gray-500 dark:text-white/55",
                          ].join(" ")}
                        />
                      </button>

                      <div
                        className={`overflow-hidden transition-all duration-200 ${
                          isOpen ? "max-h-150 pb-1 pt-1.5 opacity-100" : "max-h-0 opacity-0"
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
                        onMouseLeave={() => closeHoverPopupWithDelay(section.title)}
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

          {/* Footer - Logout */}
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