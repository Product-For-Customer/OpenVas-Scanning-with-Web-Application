import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { MdOutlineCancel, MdKeyboardArrowDown } from "react-icons/md";
import { FiLogOut } from "react-icons/fi";
import { RiDoorOpenLine } from "react-icons/ri";
import { getLinks, type SidebarSection, type SidebarLink } from "./data";
import { useStateContext } from "../../../contexts/ProviderContext";
import { useAuth } from "../../../contexts/AuthContext";
import { useLanguage } from "../../../contexts/LanguageContext";
import logo from "../../../assets/argus-logo-real.png";
import argusWordmark from "../../../assets/argus-font-sidebar.png";
import { message } from "antd";

/* ─── Constants ──────────────────────────────────────────────── */
const EXPANDED_WIDTH     = 272;
const COLLAPSED_WIDTH    = 88;
const DESKTOP_BREAKPOINT = 900;
const TABLET_MIN         = 768;
const TABLET_MAX         = 1024;
const MINI_MENU_CLOSE_DELAY = 180;

/* ─── Helpers ────────────────────────────────────────────────── */
const safeDecodePath = (pathname: string) => {
  try { return decodeURIComponent(pathname); } catch { return pathname; }
};
const normalizePath = (pathname: string) =>
  safeDecodePath(pathname).replace(/\/+$/, "").toLowerCase();
const isSamePath = (currentPath: string, targetPath: string) =>
  normalizePath(currentPath) === normalizePath(targetPath);
const getAdminLinkPath = (linkName: string) => `/admin/${linkName}`;

/* ─── Sidebar ────────────────────────────────────────────────── */
const Sidebar: React.FC = () => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { logout, isAdmin } = useAuth();
  const { activeMenu, setActiveMenu, screenSize, currentColor } = useStateContext();
  const { t } = useLanguage();

  const [menuLinks,        setMenuLinks]        = useState<SidebarSection[]>([]);
  const [openSections,     setOpenSections]     = useState<Record<string, boolean>>({});
  const [activeMiniSection, setActiveMiniSection] = useState<string | null>(null);
  const [loggingOut,       setLoggingOut]       = useState(false);

  const miniCloseTimerRef = useRef<number | null>(null);

  const currentScreen  = typeof screenSize === "number" ? screenSize : window.innerWidth;
  const isDesktop      = currentScreen > DESKTOP_BREAKPOINT;
  const isTablet       = currentScreen >= TABLET_MIN && currentScreen <= TABLET_MAX;
  const isExpanded     = !!activeMenu;

  const collapsedIconRadiusClass = isExpanded ? "rounded-xl" : "rounded-[10px]";
  const argusWordmarkSizeClass   = isDesktop && !isTablet ? "h-[22px]" : isTablet ? "h-[15px]" : "h-[16px]";

  const sidebarWidth = useMemo(() => {
    if (!isDesktop) return "88vw";
    return isExpanded ? `${EXPANDED_WIDTH}px` : `${COLLAPSED_WIDTH}px`;
  }, [isDesktop, isExpanded]);

  /* ── mini-popup helpers ─────────────────────────────────────── */
  const clearMiniCloseTimer = () => {
    if (miniCloseTimerRef.current) {
      window.clearTimeout(miniCloseTimerRef.current);
      miniCloseTimerRef.current = null;
    }
  };
  const openMiniSection = (title: string) => {
    clearMiniCloseTimer();
    setActiveMiniSection(title);
  };
  const scheduleCloseMiniSection = (title?: string) => {
    clearMiniCloseTimer();
    miniCloseTimerRef.current = window.setTimeout(() => {
      setActiveMiniSection((prev) => {
        if (title && prev !== title) return prev;
        return null;
      });
      miniCloseTimerRef.current = null;
    }, MINI_MENU_CLOSE_DELAY);
  };

  const handleCloseSideBar = () => {
    clearMiniCloseTimer();
    setActiveMiniSection(null);
    if (typeof screenSize === "number" && screenSize <= DESKTOP_BREAKPOINT) {
      setActiveMenu(false);
    }
  };

  /* ── Load links ─────────────────────────────────────────────── */
  useEffect(() => {
    try {
      const data   = getLinks({ isAdmin });
      const safeData = Array.isArray(data) ? data : [];
      setMenuLinks(safeData);

      const nextOpen: Record<string, boolean> = {};
      safeData.forEach((section: SidebarSection) => {
        const hasActiveChild = section.links?.some((link) =>
          isSamePath(location.pathname, getAdminLinkPath(link.name))
        );
        nextOpen[section.title] = !!hasActiveChild;
      });
      setOpenSections(nextOpen);
      clearMiniCloseTimer();
      setActiveMiniSection(null);
    } catch {
      setMenuLinks([]);
      clearMiniCloseTimer();
      setActiveMiniSection(null);
    }
  }, [location.pathname, isAdmin]);

  useEffect(() => {
    if (isExpanded) { clearMiniCloseTimer(); setActiveMiniSection(null); }
  }, [isExpanded]);

  useEffect(() => () => { clearMiniCloseTimer(); }, []);

  /* ── Section toggle ─────────────────────────────────────────── */
  const toggleSection = (title: string) => {
    if (isDesktop && !isExpanded) return;
    setOpenSections((prev) => ({ ...prev, [title]: !prev[title] }));
  };
  const toggleMiniSection = (title: string) => {
    clearMiniCloseTimer();
    setActiveMiniSection((prev) => (prev === title ? null : title));
  };

  const isLinkActive = (linkName: string) =>
    isSamePath(location.pathname, getAdminLinkPath(linkName));

  /* ── Logout ─────────────────────────────────────────────────── */
  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      clearMiniCloseTimer();
      setActiveMiniSection(null);
      await logout();
      message.success(t("sidebar.logoutSuccess"));
      handleCloseSideBar();
      await new Promise((resolve) => setTimeout(resolve, 1000));
      navigate("/", { replace: true });
    } catch {
      message.error(t("sidebar.logoutFailed"));
      navigate("/", { replace: true });
    } finally { setLoggingOut(false); }
  };

  if (!isDesktop && !activeMenu) return null;

  return (
    <>
      <style>{`
        @keyframes argusLogoFloat {
          0%, 100% { transform: translateY(0px) scale(1); }
          50%       { transform: translateY(-3px) scale(1.01); }
        }
        @keyframes sidebarMiniModalIn {
          0%   { opacity: 0; transform: translateX(-8px) scale(0.96); }
          100% { opacity: 1; transform: translateX(0px) scale(1); }
        }
      `}</style>

      {/* Backdrop for mini popup click-outside */}
      {!isExpanded && activeMiniSection && (
        <div className="fixed inset-0 z-35 bg-transparent"
          onClick={() => { clearMiniCloseTimer(); setActiveMiniSection(null); }} />
      )}

      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 z-30 transition-opacity duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] md:hidden ${
          activeMenu ? "opacity-100" : "pointer-events-none opacity-0"
        } bg-[#020817]/35 dark:bg-black/45`}
        onClick={handleCloseSideBar}
      />

      <aside
        className={[
          "fixed inset-y-0 left-0 z-40 h-dvh",
          "transform-gpu will-change-[width,transform]",
          "transition-[width,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        ].join(" ")}
        style={{
          width: sidebarWidth,
          height: "100dvh",
          maxHeight: "100dvh",
          maxWidth: isDesktop ? undefined : "320px",
          padding: isDesktop ? "10px" : isTablet ? "10px 8px 8px 8px" : "14px",
          paddingTop: isTablet
            ? "max(env(safe-area-inset-top), 8px)"
            : "max(env(safe-area-inset-top), 12px)",
          backfaceVisibility: "hidden",
          transform: "translateZ(0)",
        }}
      >
        <div className="relative flex h-full max-h-full min-h-0 flex-col overflow-visible rounded-xl border border-slate-200/70 bg-white shadow-sm dark:border-white/8 dark:bg-[#0d0b1a]">

          {/* ── Logo header ── */}
          <div className={`relative z-10 flex shrink-0 items-center ${
            isExpanded
              ? isTablet ? "justify-between px-3 pb-2 pt-3" : "justify-between px-3.5 pb-3 pt-4.5"
              : "justify-center px-2 pb-3 pt-4.5"
          }`}>
            <Link
              to="/admin"
              onClick={handleCloseSideBar}
              className={`select-none ${isExpanded ? "flex items-center gap-3" : "flex items-center justify-center"}`}
              aria-label="Go to dashboard"
            >
              <div
                className={`relative flex shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-cyan-50 to-sky-50 dark:from-cyan-500/10 dark:to-sky-500/10 ${
                  isTablet ? "h-12 w-12" : "h-14 w-14"
                }`}
                style={{ animation: "argusLogoFloat 4.2s ease-in-out infinite", willChange: "transform" }}
              >
                <img src={logo} alt="Logo"
                  className={`object-contain ${isTablet ? "h-10 w-10" : "h-12 w-12"}`} />
              </div>

              {isExpanded && (
                <div className="min-w-0">
                  <img src={argusWordmark} alt="Argus"
                    className={`block w-auto object-contain drop-shadow-[0_5px_12px_rgba(59,130,246,0.18)] dark:drop-shadow-[0_5px_14px_rgba(34,211,238,0.26)] ${argusWordmarkSizeClass}`}
                  />
                  <span className={`block text-gray-500 dark:text-white/45 ${isTablet ? "text-[10px]" : "text-[10.5px]"}`}>
                    {t("sidebar.vulnerabilityMonitoring")}
                  </span>
                </div>
              )}
            </Link>

            {isExpanded && !isDesktop && (
              <button type="button" onClick={() => setActiveMenu(false)}
                style={{ WebkitTapHighlightColor: "transparent" }}
                className={[
                  isTablet ? "rounded-xl p-1.5" : "rounded-xl p-2",
                  "transition-colors",
                  "text-gray-600 hover:bg-gray-200/70 active:bg-gray-300/70",
                  "dark:text-white/70 dark:hover:bg-white/10 dark:active:bg-white/15",
                  "focus:outline-none focus:ring-0",
                ].join(" ")}
                aria-label={t("sidebar.closeMenu")}
              >
                <MdOutlineCancel className={isTablet ? "text-[20px]" : "text-xl"} />
              </button>
            )}
          </div>

          {/* ── Nav ── */}
          <nav className={`relative z-10 min-h-0 flex-1 ${
            isExpanded
              ? isTablet
                ? "overflow-y-auto overflow-x-hidden px-2 pb-1"
                : "overflow-y-auto overflow-x-hidden px-2.5 pb-2"
              : "overflow-visible px-2 pb-2"
          }`}>
            <div className={isExpanded ? (isTablet ? "space-y-1" : "space-y-1.5") : "space-y-2.5"}>

              {menuLinks.map((section) => {
                const isOpen    = !!openSections[section.title];
                const isMiniOpen = activeMiniSection === section.title;
                const hasActiveChild = section.links?.some((link: SidebarLink) =>
                  isLinkActive(link.name)
                ) ?? false;
                const sectionIcon = (section as SidebarSection & { icon?: React.ReactNode }).icon ?? (
                  <span className="h-2.5 w-2.5 rounded-full bg-current opacity-70" />
                );
                const sectionLabel = t(section.titleKey);

                /* ── Expanded mode ── */
                if (isExpanded) {
                  return (
                    <div key={section.title} className="space-y-1">
                      <button type="button" onClick={() => toggleSection(section.title)}
                        style={{
                          WebkitTapHighlightColor: "transparent",
                          ...(isOpen ? {
                            background: `linear-gradient(135deg, ${currentColor}, color-mix(in srgb, ${currentColor} 60%, #9333ea))`,
                            boxShadow: `0 10px 20px -16px ${currentColor}90`,
                          } : {}),
                        }}
                        className={[
                          "flex w-full items-center justify-between rounded-xl text-left transition-all duration-200",
                          isTablet ? "px-3 py-2" : "px-3.5 py-2.5",
                          isOpen
                            ? "text-white"
                            : hasActiveChild
                              ? "bg-slate-100 text-slate-800 dark:bg-white/5 dark:text-white/90"
                              : "bg-transparent text-slate-600 hover:bg-slate-50 dark:text-white/65 dark:hover:bg-white/8",
                          "focus:outline-none focus:ring-0",
                        ].join(" ")}
                        aria-expanded={isOpen}
                      >
                        <div className="min-w-0 flex items-center gap-3">
                          <span className={[
                            "inline-flex items-center justify-center rounded-xl transition-all duration-200",
                            isTablet ? "h-7 w-7 text-[14px]" : "h-8 w-8 text-[15px]",
                            isOpen
                              ? "bg-white/15 text-white"
                              : hasActiveChild
                                ? "bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-white/80"
                                : "bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-white/55",
                          ].join(" ")}>
                            {sectionIcon}
                          </span>
                          <div className="min-w-0">
                            <span className={`block truncate font-medium ${isTablet ? "text-[13px]" : "text-[14px]"}`}>
                              {sectionLabel}
                            </span>
                            <span className={[
                              "block truncate",
                              isTablet ? "text-[9.5px]" : "text-[10px]",
                              isOpen ? "text-white/70" : "text-slate-400 dark:text-white/34",
                            ].join(" ")}>
                              {section.links?.length ?? 0} {t("sidebar.items")}
                            </span>
                          </div>
                        </div>
                        <MdKeyboardArrowDown className={[
                          "transition-transform",
                          isTablet ? "text-[18px]" : "text-[19px]",
                          isOpen ? "rotate-0" : "-rotate-90",
                          isOpen ? "text-white" : "text-gray-500 dark:text-white/55",
                        ].join(" ")} />
                      </button>

                      {/* Links */}
                      <div className={`overflow-hidden transition-all duration-200 ${
                        isOpen
                          ? isTablet ? "max-h-44 pb-0.5 pt-1 opacity-100" : "max-h-55 pb-0.5 pt-1 opacity-100"
                          : "max-h-0 opacity-0"
                      }`}>
                        <div className={isTablet ? "space-y-1 pl-5 pr-1.5" : "space-y-1 pl-5.5 pr-2"}>
                          {section.links?.map((link: SidebarLink) => {
                            const active = isLinkActive(link.name);
                            return (
                              <NavLink
                                to={getAdminLinkPath(link.name)}
                                key={`${section.title}-${link.name}`}
                                onClick={handleCloseSideBar}
                                style={active ? {
                                  backgroundColor: `color-mix(in srgb, ${currentColor} 10%, white)`,
                                  color: currentColor,
                                } : undefined}
                                className={[
                                  "group relative flex items-center justify-between gap-2 overflow-hidden rounded-xl transition-all duration-200",
                                  isTablet ? "px-2.5 py-1.75" : "px-3 py-2.25",
                                  active
                                    ? "font-semibold dark:bg-white/8"
                                    : "text-[#585b6b] hover:bg-white hover:text-[#2b2f45] dark:text-white/60 dark:hover:bg-white/8 dark:hover:text-white/85",
                                ].join(" ")}
                              >
                                {active && (
                                  <span className="absolute inset-y-1.5 left-0 w-1 rounded-full"
                                    style={{ background: `linear-gradient(to bottom, ${currentColor}, color-mix(in srgb, ${currentColor} 60%, #9333ea))` }} />
                                )}
                                <div className="min-w-0 flex items-center gap-2.5">
                                  <span
                                    className={[
                                      "inline-flex shrink-0 items-center justify-center rounded-lg transition-all duration-200",
                                      isTablet ? "h-6.5 w-6.5 text-[13px]" : "h-7 w-7 text-[14px]",
                                      active
                                        ? "bg-white shadow-sm dark:bg-white/10"
                                        : "bg-slate-100 text-slate-500 group-hover:bg-slate-200 dark:bg-white/6 dark:text-white/55 dark:group-hover:bg-white/10",
                                    ].join(" ")}
                                    style={active ? { color: currentColor } : undefined}
                                  >
                                    {link.icon ?? <span className="h-2 w-2 rounded-full bg-current opacity-70" />}
                                  </span>
                                  <span className={isTablet ? "truncate text-[12.5px]" : "truncate text-[13px]"}>
                                    {t(link.labelKey)}
                                  </span>
                                </div>
                                {link.badge && (
                                  <span className={`ml-2 shrink-0 rounded-full bg-linear-to-r from-cyan-500 to-violet-500 font-semibold text-white shadow-[0_8px_18px_-14px_rgba(59,130,246,0.95)] ${
                                    isTablet ? "px-2 py-0.5 text-[9px]" : "px-2.5 py-0.5 text-[10px]"
                                  }`}>
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

                /* ── Collapsed mode — icon button + mini popup ── */
                return (
                  <div key={section.title} className="relative"
                    onMouseEnter={() => openMiniSection(section.title)}
                    onMouseLeave={() => scheduleCloseMiniSection(section.title)}
                  >
                    <button type="button"
                      onClick={(e) => { e.stopPropagation(); toggleMiniSection(section.title); }}
                      onFocus={() => openMiniSection(section.title)}
                      style={{
                        WebkitTapHighlightColor: "transparent",
                        ...(isMiniOpen || hasActiveChild ? {
                          background: `linear-gradient(135deg, ${currentColor}, color-mix(in srgb, ${currentColor} 60%, #9333ea))`,
                          boxShadow: `0 8px 16px -12px ${currentColor}90`,
                          borderColor: `color-mix(in srgb, ${currentColor} 40%, transparent)`,
                        } : {}),
                      }}
                      className={[
                        "flex h-12 w-full items-center justify-center rounded-xl border transition-all duration-200",
                        isMiniOpen || hasActiveChild
                          ? "text-white"
                          : "border-transparent bg-slate-100 text-slate-500 hover:border-slate-200 hover:bg-slate-200 dark:bg-white/8 dark:text-white/60 dark:hover:bg-white/12",
                        "focus:outline-none focus:ring-0",
                      ].join(" ")}
                      aria-label={sectionLabel}
                      aria-expanded={isMiniOpen}
                    >
                      <span className={[
                        "inline-flex h-8.5 w-8.5 items-center justify-center text-[18px] transition-all duration-200",
                        collapsedIconRadiusClass,
                        isMiniOpen || hasActiveChild ? "bg-white/15 text-white" : "text-gray-500 dark:text-white/60",
                      ].join(" ")}>
                        {sectionIcon}
                      </span>
                    </button>

                    {/* Mini popup */}
                    {isMiniOpen && (
                      <div
                        className="absolute left-[calc(100%+12px)] top-0 z-70 w-64 origin-left"
                        style={{ animation: "sidebarMiniModalIn 160ms ease-out both" }}
                        onMouseEnter={() => openMiniSection(section.title)}
                        onMouseLeave={() => scheduleCloseMiniSection(section.title)}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="absolute -left-3 top-0 h-full w-3 bg-transparent" />
                        <div className="overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-xl dark:border-white/8 dark:bg-[#0d0b1a]">
                          <div className="border-b border-slate-100 px-4 py-3 dark:border-white/8">
                            <div className="flex items-center gap-3">
                              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/70 bg-slate-50 text-[15px] text-slate-600 dark:border-white/8 dark:bg-white/5 dark:text-white/70">
                                {sectionIcon}
                              </span>
                              <div className="min-w-0">
                                <span className="block truncate text-[13px] font-semibold text-slate-800 dark:text-white/85">
                                  {sectionLabel}
                                </span>
                                <span className="block text-[10px] text-slate-400 dark:text-white/35">
                                  {section.links?.length ?? 0} {t("sidebar.menuItems")}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="max-h-[58vh] overflow-y-auto py-2">
                            {section.links?.length ? (
                              section.links.map((link: SidebarLink) => {
                                const active = isLinkActive(link.name);
                                return (
                                  <NavLink
                                    key={`${section.title}-${link.name}-mini`}
                                    to={getAdminLinkPath(link.name)}
                                    onClick={() => {
                                      clearMiniCloseTimer();
                                      setActiveMiniSection(null);
                                      handleCloseSideBar();
                                    }}
                                    style={active ? {
                                      backgroundColor: `color-mix(in srgb, ${currentColor} 10%, white)`,
                                      color: currentColor,
                                    } : undefined}
                                    className={[
                                      "group flex items-center justify-between gap-2 px-4 py-2.5 text-[13px] transition-colors",
                                      active
                                        ? "font-semibold dark:bg-white/8"
                                        : "text-[#4f5366] hover:bg-gray-50 dark:text-white/65 dark:hover:bg-white/8",
                                    ].join(" ")}
                                  >
                                    <div className="min-w-0 flex items-center gap-3">
                                      <span
                                        className={[
                                          "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[14px] transition-all duration-200",
                                          active
                                            ? "bg-white shadow-sm dark:bg-white/10"
                                            : "bg-slate-100 text-slate-500 group-hover:bg-slate-200 dark:bg-white/6 dark:text-white/55 dark:group-hover:bg-white/10",
                                        ].join(" ")}
                                        style={active ? { color: currentColor } : undefined}
                                      >
                                        {link.icon ?? <span className="h-2 w-2 rounded-full bg-current opacity-70" />}
                                      </span>
                                      <span className="truncate">{t(link.labelKey)}</span>
                                    </div>
                                    {link.badge && (
                                      <span className="ml-3 shrink-0 rounded-full bg-linear-to-r from-cyan-500 to-violet-500 px-2.5 py-0.5 text-[10px] font-semibold text-white">
                                        {link.badge}
                                      </span>
                                    )}
                                  </NavLink>
                                );
                              })
                            ) : (
                              <div className="px-4 py-5 text-center text-[12px] text-slate-400 dark:text-white/45">
                                {t("sidebar.noMenuItems")}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </nav>

          {/* ── Logout ── */}
          <div className={`relative z-10 shrink-0 ${
            isExpanded
              ? isTablet ? "px-2 pb-2 pt-1" : "px-2.5 pb-3 pt-1"
              : "px-2 pb-3 pt-1"
          }`}>
            {isExpanded ? (
              <button type="button" onClick={() => void handleLogout()} disabled={loggingOut}
                style={{ WebkitTapHighlightColor: "transparent" }}
                className={[
                  "group flex w-full items-center justify-between rounded-xl border border-slate-200/70 transition-all duration-200",
                  isTablet ? "px-2.5 py-2" : "px-3 py-2.5",
                  "bg-white text-slate-700 hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/75 dark:hover:bg-white/8",
                  loggingOut ? "cursor-not-allowed opacity-70" : "",
                  "focus:outline-none focus:ring-0",
                ].join(" ")}
                aria-label={t("sidebar.logout")}
              >
                <div className={`flex items-center ${isTablet ? "gap-2" : "gap-2.5"}`}>
                  <span className={`inline-flex items-center justify-center rounded-xl border border-slate-200/70 bg-slate-100 text-slate-500 dark:border-white/8 dark:bg-white/8 dark:text-white/55 ${
                    isTablet ? "h-7 w-7" : "h-8 w-8"
                  }`}>
                    <RiDoorOpenLine className={isTablet ? "text-[14px]" : "text-[15px]"} />
                  </span>
                  <div className="text-left leading-tight">
                    <span className={`block font-semibold ${isTablet ? "text-[11.5px]" : "text-[12.5px]"}`}>
                      {loggingOut ? t("sidebar.loggingOut") : t("sidebar.logout")}
                    </span>
                    <span className={`block text-slate-500 dark:text-white/45 ${isTablet ? "text-[8.5px]" : "text-[9.5px]"}`}>
                      {t("sidebar.endSession")}
                    </span>
                  </div>
                </div>
                <FiLogOut className={`text-slate-400 transition-colors duration-200 group-hover:text-slate-600 dark:text-white/40 dark:group-hover:text-white/65 ${
                  isTablet ? "text-[13px]" : "text-[14px]"
                }`} />
              </button>
            ) : (
              <button type="button" onClick={() => void handleLogout()} disabled={loggingOut}
                style={{ WebkitTapHighlightColor: "transparent" }}
                className={[
                  "flex h-12 w-full items-center justify-center rounded-xl border transition-all duration-200",
                  "border-transparent bg-slate-100 text-slate-500 hover:border-slate-200 hover:bg-slate-200",
                  "dark:bg-white/8 dark:text-white/55 dark:hover:bg-white/12",
                  loggingOut ? "cursor-not-allowed opacity-70" : "",
                  "focus:outline-none focus:ring-0",
                ].join(" ")}
                aria-label={t("sidebar.logout")}
              >
                <FiLogOut className="text-[18px]" />
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
