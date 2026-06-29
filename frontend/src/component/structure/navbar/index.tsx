import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MdKeyboardArrowDown } from "react-icons/md";
import { LuPanelLeftClose, LuPanelLeftOpen } from "react-icons/lu";
import { FiCheck, FiSearch, FiX } from "react-icons/fi";
import { HiOutlinePaintBrush } from "react-icons/hi2";
import { useNavigate } from "react-router-dom";
import { UserProfile } from "../path";
import { useStateContext } from "../../../contexts/ProviderContext";
import { useAuth } from "../../../contexts/AuthContext";
import { pathOpenVas } from "../../../services/api";
import greenboneIcon from "../../../assets/logo-light.svg";
import { ListUserByID, type UserResponse } from "../../../services";
import { useLanguage, LANGUAGE_OPTIONS } from "../../../contexts/LanguageContext";
import type { Lang, TranslationKey } from "../../../locales";
import flagEN from "../../../assets/flags/english.png";
import flagTH from "../../../assets/flags/thai.png";
import flagZH from "../../../assets/flags/china.png";
import { getLinks } from "../sidebar/data";

// ─── Constants ───────────────────────────────────────────────────────────────

const FLAG_MAP: Record<Lang, string> = { en: flagEN, th: flagTH, zh: flagZH };
const DESKTOP_BREAKPOINT = 900;
const NAV_AVATAR_SIZE = 36;

// Page description map — keyed by sidebar link.name
const PAGE_DESCRIPTIONS: Record<string, string> = {
  "dashboard":           "Overview of vulnerability statistics, risk scores and recent findings",
  "vulnerability":       "Browse, filter and inspect all detected vulnerabilities by severity",
  "target":              "Manage scan targets, host assets and network scope",
  "calendar":            "Schedule scan tasks and track security events on a calendar",
  "diagrams":            "Visualise network topology and asset relationship diagrams",
  "recycle-bin":         "Restore or permanently remove recently deleted items",
  "threat-intelligence": "CISA KEV Catalog — track actively exploited CVE vulnerabilities",
  "feed-status":         "Monitor synchronisation status of threat intelligence feeds",
  "threat-config":       "Configure threat detection rules and scanner settings",
  "scan-management":     "Create, schedule and manage OpenVAS vulnerability scans",
  "line notification":   "Set up LINE messaging alerts for scan results and events",
  "user":                "Manage user accounts, assign roles and control permissions",
  "password-policy":     "Define and enforce password complexity and expiry policies",
  "service":             "Manage system service configurations and integrations",
  "report":              "Generate, preview and export security assessment reports",
  "compliance":          "Evaluate and track regulatory compliance posture",
  "vulnerability-delta": "Compare vulnerability counts between scan runs over time",
};

// ─── Types ───────────────────────────────────────────────────────────────────

type NavBtnProps = {
  title: string;
  onClick?: () => void;
  icon: React.ReactNode;
  dotColor?: string;
  badgeCount?: number;
  className?: string;
  "aria-label"?: string;
};

type TooltipPosition = "Top" | "TopCenter" | "BottomCenter" | "RightCenter" | "LeftCenter";

type SimpleTooltipProps = {
  content: string;
  position?: TooltipPosition;
  children: React.ReactNode;
};

type PageResult = {
  name:        string;
  path:        string;
  labelKey:    TranslationKey;
  icon:        React.ReactNode;
  sectionKey:  TranslationKey;
  description: string;
};

// ─── SimpleTooltip (no-op) ────────────────────────────────────────────────────

const SimpleTooltip: React.FC<SimpleTooltipProps> = ({ content, position, children }) => {
  void content; void position;
  return <>{children}</>;
};

// ─── Avatar helper ────────────────────────────────────────────────────────────

const createCoverThumbnail = async (imageSrc: string, size: number): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => {
      try {
        const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
        const canvas = document.createElement("canvas");
        const ts = Math.round(size * dpr);
        canvas.width = ts; canvas.height = ts;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas 2D unavailable")); return; }
        ctx.clearRect(0, 0, ts, ts);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        const scale = Math.max(ts / img.naturalWidth, ts / img.naturalHeight);
        const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
        ctx.drawImage(img, (ts - dw) / 2, (ts - dh) / 2, dw, dh);
        resolve(canvas.toDataURL("image/png"));
      } catch (e) { reject(e); }
    };
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = imageSrc;
  });

// ─── NavButton ────────────────────────────────────────────────────────────────

const NavButton: React.FC<NavBtnProps> = ({
  title, onClick, icon, dotColor, badgeCount, className = "",
  "aria-label": ariaLabel,
}) => (
  <SimpleTooltip content={title} position="BottomCenter">
    <button
      type="button"
      aria-label={ariaLabel ?? title}
      onClick={onClick}
      style={{ WebkitTapHighlightColor: "transparent" }}
      className={[
        "relative inline-flex h-10 w-10 items-center justify-center rounded-xl text-[18px] transition-all duration-200",
        "text-gray-600 hover:bg-gray-100 active:bg-gray-200",
        "dark:text-white/75 dark:hover:bg-white/10 dark:active:bg-white/15",
        "focus:outline-none focus:ring-0",
        className,
      ].join(" ")}
    >
      {dotColor && (
        <span style={{ background: dotColor }} className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full" />
      )}
      {typeof badgeCount === "number" && badgeCount > 0 && (
        <span
          className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none text-white shadow-sm"
          style={{ background: `linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 60%, #9333ea))` }}
        >
          {badgeCount > 99 ? "99+" : badgeCount}
        </span>
      )}
      {icon}
    </button>
  </SimpleTooltip>
);

// ─── NavSearch (visible input field) ─────────────────────────────────────────

const NavSearch: React.FC = () => {
  const { isAdmin } = useAuth();
  const { t, lang } = useLanguage();
  const { currentColor } = useStateContext();
  const navigate = useNavigate();

  const [open, setOpen]             = useState(false);
  const [query, setQuery]           = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const wrapRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build flat page list (respects role)
  const allPages = useMemo<PageResult[]>(() => {
    const pages: PageResult[] = [];
    for (const section of getLinks({ isAdmin })) {
      for (const link of section.links) {
        pages.push({
          name:        link.name,
          path:        `/admin/${link.name}`,
          labelKey:    link.labelKey,
          icon:        link.icon,
          sectionKey:  section.titleKey,
          description: PAGE_DESCRIPTIONS[link.name] ?? "",
        });
      }
    }
    return pages;
  }, [isAdmin]);

  // Filter by query (label, section, name, description)
  const filtered = useMemo<PageResult[]>(() => {
    void lang;
    if (!query.trim()) return allPages;
    const kw = query.toLowerCase();
    return allPages.filter(p =>
      t(p.labelKey).toLowerCase().includes(kw) ||
      t(p.sectionKey).toLowerCase().includes(kw) ||
      p.name.toLowerCase().includes(kw) ||
      p.description.toLowerCase().includes(kw)
    );
  }, [allPages, query, t, lang]);

  useEffect(() => { setActiveIndex(0); }, [filtered.length]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const goTo = (path: string) => {
    navigate(path);
    setOpen(false);
    setQuery("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if      (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp")   { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter")     { e.preventDefault(); if (filtered[activeIndex]) goTo(filtered[activeIndex].path); }
    else if (e.key === "Escape")    { setOpen(false); setQuery(""); inputRef.current?.blur(); }
  };

  const showDropdown = open && (query.trim() !== "" || allPages.length > 0);

  return (
    <div className="relative w-40 sm:w-56 md:w-72 lg:w-80" ref={wrapRef}>

      {/* ── Visible search field ── */}
      <div className={[
        "flex h-9 items-center gap-2 rounded-xl border px-3 transition-all duration-200",
        open
          ? "border-slate-300 bg-white shadow-sm dark:border-white/20 dark:bg-white/8"
          : "border-slate-200/70 bg-slate-50/80 dark:border-white/8 dark:bg-white/4",
      ].join(" ")}>
        <FiSearch className="shrink-0 text-[13px] text-slate-400 dark:text-white/35" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search pages…"
          className="h-full w-full bg-transparent text-[12px] text-slate-600 outline-none placeholder:text-slate-400 dark:text-white/70 dark:placeholder:text-white/25"
        />
        {query ? (
          <button
            type="button"
            onClick={() => { setQuery(""); inputRef.current?.focus(); }}
            className="shrink-0 rounded-md p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:text-white/30 dark:hover:bg-white/8"
          >
            <FiX className="text-[11px]" />
          </button>
        ) : (
          <kbd className="hidden shrink-0 rounded border border-slate-200/80 bg-slate-100/80 px-1.5 py-0.5 text-[9px] font-medium text-slate-400 dark:border-white/8 dark:bg-white/5 dark:text-white/20 sm:inline">
            /
          </kbd>
        )}
      </div>

      {/* ── Dropdown ── */}
      {showDropdown && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-9999 w-full min-w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_16px_48px_-12px_rgba(0,0,0,0.22)] dark:border-white/8 dark:bg-[#0d0b1a]">

          {/* Accent top bar */}
          <div
            className="h-0.5 w-full"
            style={{ background: `linear-gradient(to right, ${currentColor}, color-mix(in srgb, ${currentColor} 60%, #a855f7))` }}
          />

          {/* Results */}
          <div className="max-h-80 overflow-y-auto p-2">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10">
                <FiSearch className="text-2xl text-slate-300 dark:text-white/15" />
                <p className="text-[11px] text-slate-400 dark:text-white/30">
                  No pages match &ldquo;{query}&rdquo;
                </p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {filtered.map((page, i) => {
                  const isActive = i === activeIndex;
                  return (
                    <button
                      key={page.name}
                      type="button"
                      onClick={() => goTo(page.path)}
                      onMouseEnter={() => setActiveIndex(i)}
                      className={[
                        "flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                        isActive
                          ? "bg-slate-100 dark:bg-white/8"
                          : "hover:bg-slate-50 dark:hover:bg-white/5",
                      ].join(" ")}
                    >
                      {/* Icon badge */}
                      <span
                        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[15px]"
                        style={{ backgroundColor: `${currentColor}18`, color: currentColor }}
                      >
                        {page.icon}
                      </span>

                      {/* Text */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-[12px] font-semibold text-slate-700 dark:text-white/85">
                            {t(page.labelKey)}
                          </p>
                          <span
                            className="shrink-0 rounded-full px-2 py-0.5 text-[9.5px] font-medium"
                            style={{ backgroundColor: `${currentColor}14`, color: currentColor }}
                          >
                            {t(page.sectionKey)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[10.5px] leading-relaxed text-slate-400 dark:text-white/30">
                          {page.description}
                        </p>
                      </div>

                      {/* Enter hint */}
                      {isActive && (
                        <kbd className="mt-1.5 shrink-0 self-start rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-medium text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-white/25">
                          ↵
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2 dark:border-white/8">
            <div className="flex items-center gap-3">
              {[["↑↓", "navigate"], ["↵", "open"], ["Esc", "close"]].map(([k, l]) => (
                <span key={k} className="flex items-center gap-1 text-[9.5px] text-slate-400 dark:text-white/20">
                  <kbd className="rounded border border-slate-200 bg-slate-50 px-1 py-px text-[8.5px] dark:border-white/10 dark:bg-white/5">
                    {k}
                  </kbd>
                  {l}
                </span>
              ))}
            </div>
            <span className="text-[9.5px] text-slate-300 dark:text-white/15">
              {filtered.length} page{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>

        </div>
      )}
    </div>
  );
};

// ─── LanguageSwitcher ─────────────────────────────────────────────────────────

const LanguageSwitcher: React.FC = () => {
  const { lang, setLang, t } = useLanguage();
  const { currentColor } = useStateContext();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={t("navbar.language")}
        onClick={() => setOpen(p => !p)}
        style={{ WebkitTapHighlightColor: "transparent" }}
        className={[
          "inline-flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
          "hover:bg-gray-100 dark:hover:bg-white/10",
          open ? "bg-gray-100 dark:bg-white/10" : "",
          "focus:outline-none focus:ring-0",
        ].join(" ")}
      >
        <div className="h-6 w-6 overflow-hidden rounded-full shadow-sm ring-1 ring-black/12 dark:ring-white/15">
          <img src={FLAG_MAP[lang]} alt={lang} draggable={false} className="h-full w-full object-cover" />
        </div>
      </button>

      {open && (
        <div className={[
          "absolute right-0 top-[calc(100%+8px)] z-9999 w-44 overflow-hidden",
          "rounded-2xl shadow-[0_8px_30px_-8px_rgba(0,0,0,0.18)]",
          "border border-slate-200 bg-white dark:border-white/8 dark:bg-[#0d0b1a]",
        ].join(" ")}>
          <div
            className="h-0.5 w-full"
            style={{ background: `linear-gradient(to right, ${currentColor}, color-mix(in srgb, ${currentColor} 65%, #a855f7))` }}
          />
          <div className="p-1.5">
            {LANGUAGE_OPTIONS.map(opt => {
              const active = lang === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { setLang(opt.value); setOpen(false); }}
                  className={[
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors focus:outline-none",
                    active ? "" : "hover:bg-slate-50 dark:hover:bg-white/6",
                  ].join(" ")}
                  style={active ? { backgroundColor: `${currentColor}12` } : undefined}
                >
                  <div className="h-5 w-8 shrink-0 overflow-hidden rounded-md shadow-sm ring-1 ring-black/10 dark:ring-white/10">
                    <img src={FLAG_MAP[opt.value]} alt={opt.englishName} draggable={false} className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={["text-[12px] font-medium", active ? "" : "text-slate-700 dark:text-white/75"].join(" ")}
                      style={active ? { color: currentColor } : undefined}
                    >
                      {opt.nativeName}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-white/35">{opt.englishName}</p>
                  </div>
                  {active && <FiCheck className="shrink-0 text-[13px]" style={{ color: currentColor }} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Navbar ───────────────────────────────────────────────────────────────────

const Navbar: React.FC = () => {
  const {
    activeMenu, setActiveMenu, currentColor,
    handleClick, isClicked, setScreenSize, screenSize,
    setThemeSettings, userRefreshTrigger,
  } = useStateContext();

  const { user, logout } = useAuth();
  const { t } = useLanguage();

  const [navbarUser, setNavbarUser]           = useState<UserResponse | null>(null);
  const [profileError, setProfileError]       = useState(false);
  const [profileThumbSrc, setProfileThumbSrc] = useState("");
  const [thumbLoading, setThumbLoading]       = useState(false);

  const isMountedRef      = useRef(false);
  const isFetchingUserRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    const onResize = () => setScreenSize(window.innerWidth);
    window.addEventListener("resize", onResize);
    onResize();
    return () => window.removeEventListener("resize", onResize);
  }, [setScreenSize]);

  useEffect(() => {
    if (typeof screenSize === "number") setActiveMenu(screenSize > DESKTOP_BREAKPOINT);
  }, [screenSize, setActiveMenu]);

  const currentUserId = useMemo(() => user?.id ?? null, [user?.id]);

  const fetchNavbarUser = useCallback(async () => {
    if (isFetchingUserRef.current || !currentUserId) {
      if (!currentUserId && isMountedRef.current) setNavbarUser(null);
      return;
    }
    try {
      isFetchingUserRef.current = true;
      const result = await ListUserByID(currentUserId);
      if (isMountedRef.current && result) setNavbarUser(result);
    } catch (error) {
      console.error("Navbar fetch user error:", error);
    } finally {
      isFetchingUserRef.current = false;
    }
  }, [currentUserId]);

  useEffect(() => {
    setNavbarUser(user ? (user as UserResponse) : null);
  }, [user]);

  useEffect(() => {
    if (!currentUserId) return;
    void fetchNavbarUser();
  }, [currentUserId, userRefreshTrigger, fetchNavbarUser]);

  useEffect(() => { setProfileError(false); }, [navbarUser?.profile]);

  const handleActiveMenu = () => setActiveMenu(prev => !prev);
  const openGreenbone    = () => window.open(pathOpenVas, "_blank", "noopener,noreferrer");

  const avatarFallback = useMemo(
    () =>
      "data:image/svg+xml;utf8," +
      encodeURIComponent(`
        <svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'>
          <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
            <stop offset='0%' stop-color='#dbeafe'/>
            <stop offset='100%' stop-color='#c4b5fd'/>
          </linearGradient></defs>
          <rect width='100%' height='100%' rx='18' fill='url(#g)'/>
          <circle cx='80' cy='62' r='24' fill='#475569'/>
          <path d='M38 126c7-20 24-30 42-30s35 10 42 30' fill='#475569'/>
          <text x='50%' y='150' dominant-baseline='middle' text-anchor='middle'
            font-size='12' fill='#334155' font-family='Arial'>SEC OPS</text>
        </svg>
      `),
    []
  );

  const effectiveUser = navbarUser ?? (user as UserResponse | null);
  const profileSrc    =
    !profileError && effectiveUser?.profile?.trim()
      ? effectiveUser.profile
      : avatarFallback;

  useEffect(() => {
    let cancelled = false;
    const build = async () => {
      if (!profileSrc) { setProfileThumbSrc(""); return; }
      if (profileSrc.startsWith("data:image/svg+xml")) { setProfileThumbSrc(profileSrc); return; }
      try {
        setThumbLoading(true);
        const url = await createCoverThumbnail(profileSrc, NAV_AVATAR_SIZE);
        if (!cancelled) setProfileThumbSrc(url);
      } catch {
        if (!cancelled) setProfileThumbSrc(profileSrc);
      } finally {
        if (!cancelled) setThumbLoading(false);
      }
    };
    void build();
    return () => { cancelled = true; };
  }, [profileSrc]);

  const fullName = `${effectiveUser?.first_name || "Guest"} ${effectiveUser?.last_name || "User"}`.trim();
  const roleName = effectiveUser?.role  || "Viewer";
  const email    = effectiveUser?.email || "guest@example.com";

  return (
    <header
      className="sticky top-0 z-40 w-full bg-transparent dark:bg-transparent"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="px-2.5 pb-2.5 pt-2.5 sm:px-3.5 md:px-4.5 lg:px-5">
        <div className="flex min-h-18.5 w-full items-center justify-between rounded-xl border border-slate-200/70 bg-white shadow-sm dark:border-white/8 dark:bg-[#0d0b1a]">

          {/* ── Left: toggle + search field ── */}
          <div className="flex min-w-0 flex-1 items-center gap-2 pl-3 sm:pl-4 md:pl-5">

            {/* Sidebar toggle */}
            <SimpleTooltip content={activeMenu ? "Collapse sidebar" : "Expand sidebar"} position="BottomCenter">
              <button
                type="button"
                aria-label={activeMenu ? "Collapse sidebar" : "Expand sidebar"}
                onClick={handleActiveMenu}
                style={{ WebkitTapHighlightColor: "transparent" }}
                className={[
                  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-200",
                  "text-gray-600 hover:bg-gray-100 active:bg-gray-200",
                  "dark:text-white/75 dark:hover:bg-white/10 dark:active:bg-white/15",
                  "focus:outline-none focus:ring-0",
                ].join(" ")}
              >
                {activeMenu
                  ? <LuPanelLeftClose className="text-[20px]" />
                  : <LuPanelLeftOpen  className="text-[20px]" />
                }
              </button>
            </SimpleTooltip>

            {/* Search field */}
            <NavSearch />
          </div>

          {/* ── Right: utility buttons + profile ── */}
          <div className="flex h-full shrink-0 items-center">
            <div className="flex items-center gap-1 px-2 sm:px-3">
              <NavButton
                title={t("navbar.gotoOpenVAS")}
                aria-label={t("navbar.gotoOpenVAS")}
                onClick={openGreenbone}
                icon={<img src={greenboneIcon} alt="Greenbone" className="h-7 w-7 object-contain" />}
              />
              <NavButton
                title={t("navbar.appearance")}
                aria-label={t("navbar.appearance")}
                onClick={() => setThemeSettings(prev => !prev)}
                icon={<HiOutlinePaintBrush />}
              />
              <LanguageSwitcher />
            </div>

            <div className="h-8 w-px bg-gray-200/90 dark:bg-white/10" />

            <div className="px-2.5 sm:px-3.5 md:px-4">
              <SimpleTooltip content={t("navbar.profile")} position="BottomCenter">
                <button
                  type="button"
                  onClick={() => handleClick("userProfile")}
                  style={{ WebkitTapHighlightColor: "transparent" }}
                  className={[
                    "group flex max-w-[44vw] items-center gap-2 rounded-xl px-2 py-1.5 transition-colors",
                    "sm:max-w-none sm:gap-2.5 sm:px-2.5",
                    "hover:bg-gray-100 active:bg-gray-200",
                    "dark:hover:bg-white/10 dark:active:bg-white/15",
                    "focus:outline-none focus:ring-0",
                  ].join(" ")}
                  aria-label={t("navbar.profile")}
                >
                  <div className="relative shrink-0">
                    <img
                      src={profileThumbSrc || profileSrc}
                      alt="profile"
                      draggable={false}
                      className={[
                        "h-9 w-9 rounded-full bg-white object-cover ring-1 ring-gray-200 dark:bg-white/10 dark:ring-white/15",
                        thumbLoading ? "opacity-90" : "opacity-100",
                      ].join(" ")}
                      onError={() => setProfileError(true)}
                    />
                    <span
                      className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white dark:ring-[#0d0b1a]"
                      style={{ backgroundColor: currentColor }}
                    />
                  </div>

                  <div className="hidden text-left leading-tight sm:block">
                    <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-gray-400 dark:text-white/35">
                      {t("navbar.profile")}
                    </span>
                    <span className="block max-w-24 truncate text-[13px] font-semibold text-gray-700 dark:text-white/85 md:max-w-30">
                      {fullName}
                    </span>
                  </div>

                  <MdKeyboardArrowDown className="hidden text-[18px] text-gray-400 transition-colors group-hover:text-gray-600 dark:text-white/45 dark:group-hover:text-white/70 sm:block" />
                </button>
              </SimpleTooltip>
            </div>
          </div>

        </div>
      </div>

      {isClicked.userProfile && (
        <UserProfile
          profileSrc={profileSrc}
          avatarFallback={avatarFallback}
          fullName={fullName}
          roleName={roleName}
          email={email}
          logout={logout}
        />
      )}
    </header>
  );
};

export default Navbar;
