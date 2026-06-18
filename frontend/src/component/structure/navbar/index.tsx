import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AiOutlineMenu } from "react-icons/ai";
import { MdKeyboardArrowDown } from "react-icons/md";
import { UserProfile } from "../path";
import { useStateContext } from "../../../contexts/ProviderContext";
import { useAuth } from "../../../contexts/AuthContext";
import { pathOpenVas } from "../../../services/api";
import { HiOutlinePaintBrush } from "react-icons/hi2";
import greenboneIcon from "../../../assets/logo-light.svg";
import { ListUserByID, type UserResponse } from "../../../services";
import { useLanguage, LANGUAGE_OPTIONS } from "../../../contexts/LanguageContext";
import type { Lang } from "../../../locales";
import { FiCheck } from "react-icons/fi";
import flagEN from "../../../assets/flags/english.png";
import flagTH from "../../../assets/flags/thai.png";
import flagZH from "../../../assets/flags/china.png";

const FLAG_MAP: Record<Lang, string> = { en: flagEN, th: flagTH, zh: flagZH };

type NavBtnProps = {
  title: string;
  onClick?: () => void;
  icon: React.ReactNode;
  dotColor?: string;
  badgeCount?: number;
  className?: string;
  "aria-label"?: string;
};

type TooltipPosition =
  | "Top"
  | "TopCenter"
  | "BottomCenter"
  | "RightCenter"
  | "LeftCenter";

type SimpleTooltipProps = {
  content: string;
  position?: TooltipPosition;
  children: React.ReactNode;
};

const DESKTOP_BREAKPOINT = 900;
const NAV_AVATAR_SIZE = 36;

const SimpleTooltip: React.FC<SimpleTooltipProps> = ({
  content,
  position,
  children,
}) => {
  void content;
  void position;

  return <>{children}</>;
};

const createCoverThumbnail = async (
  imageSrc: string,
  size: number
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";

    img.onload = () => {
      try {
        const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
        const canvas = document.createElement("canvas");
        const targetSize = Math.round(size * dpr);

        canvas.width = targetSize;
        canvas.height = targetSize;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas context not available"));
          return;
        }

        ctx.clearRect(0, 0, targetSize, targetSize);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        const sw = img.naturalWidth;
        const sh = img.naturalHeight;

        const scale = Math.max(targetSize / sw, targetSize / sh);
        const drawW = sw * scale;
        const drawH = sh * scale;
        const dx = (targetSize - drawW) / 2;
        const dy = (targetSize - drawH) / 2;

        ctx.drawImage(img, dx, dy, drawW, drawH);

        resolve(canvas.toDataURL("image/png"));
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = imageSrc;
  });
};

const NavButton: React.FC<NavBtnProps> = ({
  title,
  onClick,
  icon,
  dotColor,
  badgeCount,
  className = "",
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
        <span
          style={{ background: dotColor }}
          className="absolute right-1.5 top-1.5 inline-flex h-2 w-2 rounded-full"
        />
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

// ── Language Switcher ─────────────────────────────────────────────────────

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
      {/* Trigger — circular flag */}
      <button
        type="button"
        aria-label={t("navbar.language")}
        onClick={() => setOpen((p) => !p)}
        style={{ WebkitTapHighlightColor: "transparent" }}
        className={[
          "inline-flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
          "hover:bg-gray-100 dark:hover:bg-white/10",
          open ? "bg-gray-100 dark:bg-white/10" : "",
          "focus:outline-none focus:ring-0",
        ].join(" ")}
      >
        <div className="h-6 w-6 overflow-hidden rounded-full shadow-sm ring-1 ring-black/12 dark:ring-white/15">
          <img
            src={FLAG_MAP[lang]}
            alt={lang}
            draggable={false}
            className="h-full w-full object-cover"
          />
        </div>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className={[
            "absolute right-0 top-[calc(100%+8px)] z-9999 w-44 overflow-hidden",
            "rounded-2xl shadow-[0_8px_30px_-8px_rgba(0,0,0,0.18)]",
            "border border-slate-200 bg-white",
            "dark:border-white/8 dark:bg-[#0d0b1a]",
          ].join(" ")}
        >
          {/* Accent top bar */}
          <div
            className="h-0.5 w-full"
            style={{
              background: `linear-gradient(to right, ${currentColor}, color-mix(in srgb, ${currentColor} 65%, #a855f7))`,
            }}
          />

          <div className="p-1.5">
            {LANGUAGE_OPTIONS.map((opt) => {
              const active = lang === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { setLang(opt.value); setOpen(false); }}
                  className={[
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                    active ? "" : "hover:bg-slate-50 dark:hover:bg-white/6",
                    "focus:outline-none",
                  ].join(" ")}
                  style={active ? { backgroundColor: `${currentColor}12` } : undefined}
                >
                  {/* Rectangle flag */}
                  <div className="h-5 w-8 shrink-0 overflow-hidden rounded-md shadow-sm ring-1 ring-black/10 dark:ring-white/10">
                    <img
                      src={FLAG_MAP[opt.value]}
                      alt={opt.englishName}
                      draggable={false}
                      className="h-full w-full object-cover"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p
                      className={["text-[12px] font-medium", active ? "" : "text-slate-700 dark:text-white/75"].join(" ")}
                      style={active ? { color: currentColor } : undefined}
                    >
                      {opt.nativeName}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-white/35">
                      {opt.englishName}
                    </p>
                  </div>

                  {active && (
                    <FiCheck
                      className="shrink-0 text-[13px]"
                      style={{ color: currentColor }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Navbar ────────────────────────────────────────────────────────────────

const Navbar: React.FC = () => {
  const {
    activeMenu,
    setActiveMenu,
    currentColor,
    handleClick,
    isClicked,
    setScreenSize,
    screenSize,
    setThemeSettings,
    userRefreshTrigger,
  } = useStateContext();

  const { user, logout } = useAuth();
  const { t } = useLanguage();

  const [navbarUser, setNavbarUser] = useState<UserResponse | null>(null);
  const [profileError, setProfileError] = useState(false);
  const [profileThumbSrc, setProfileThumbSrc] = useState("");
  const [thumbLoading, setThumbLoading] = useState(false);

  const isMountedRef = useRef(false);
  const isFetchingUserRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

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

  const currentUserId = useMemo(() => {
    return user?.id ?? null;
  }, [user?.id]);

  const fetchNavbarUser = useCallback(async () => {
    if (isFetchingUserRef.current) return;
    if (!currentUserId) {
      if (isMountedRef.current) {
        setNavbarUser(null);
      }
      return;
    }

    try {
      isFetchingUserRef.current = true;
      const result = await ListUserByID(currentUserId);

      if (!isMountedRef.current) return;

      if (result) {
        setNavbarUser(result);
      }
    } catch (error) {
      console.error("Navbar fetch user error:", error);
    } finally {
      isFetchingUserRef.current = false;
    }
  }, [currentUserId]);

  useEffect(() => {
    if (user) {
      setNavbarUser(user as UserResponse);
    } else {
      setNavbarUser(null);
    }
  }, [user]);

  useEffect(() => {
    if (!currentUserId) return;
    void fetchNavbarUser();
  }, [currentUserId, userRefreshTrigger, fetchNavbarUser]);

  useEffect(() => {
    setProfileError(false);
  }, [navbarUser?.profile]);

  const handleActiveMenu = () => {
    setActiveMenu((prev) => !prev);
  };

  const openGreenbone = () => {
    window.open(pathOpenVas, "_blank", "noopener,noreferrer");
  };

  const avatarFallback = useMemo(
    () =>
      "data:image/svg+xml;utf8," +
      encodeURIComponent(`
        <svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'>
          <defs>
            <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
              <stop offset='0%' stop-color='#dbeafe'/>
              <stop offset='100%' stop-color='#c4b5fd'/>
            </linearGradient>
          </defs>
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

  const profileSrc =
    !profileError && effectiveUser?.profile?.trim()
      ? effectiveUser.profile
      : avatarFallback;

  useEffect(() => {
    let cancelled = false;

    const buildThumbnail = async () => {
      if (!profileSrc) {
        setProfileThumbSrc("");
        return;
      }

      if (profileSrc.startsWith("data:image/svg+xml")) {
        setProfileThumbSrc(profileSrc);
        return;
      }

      try {
        setThumbLoading(true);
        const dataUrl = await createCoverThumbnail(profileSrc, NAV_AVATAR_SIZE);

        if (!cancelled) {
          setProfileThumbSrc(dataUrl);
        }
      } catch (error) {
        console.error("Failed to create navbar avatar thumbnail:", error);
        if (!cancelled) {
          setProfileThumbSrc(profileSrc);
        }
      } finally {
        if (!cancelled) {
          setThumbLoading(false);
        }
      }
    };

    void buildThumbnail();

    return () => {
      cancelled = true;
    };
  }, [profileSrc]);

  const fullName =
    `${effectiveUser?.first_name || "Guest"} ${
      effectiveUser?.last_name || "User"
    }`.trim();

  const roleName = effectiveUser?.role || "Viewer";
  const email = effectiveUser?.email || "guest@example.com";

  return (
    <header
      className="sticky top-0 z-40 w-full bg-transparent dark:bg-transparent"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="px-2.5 pb-2.5 pt-2.5 sm:px-3.5 md:px-4.5 lg:px-5">
        <div
          className="flex min-h-18.5 w-full items-center justify-between rounded-xl border border-slate-200/70 bg-white shadow-sm dark:border-white/8 dark:bg-[#0d0b1a]"
        >
          <div className="flex min-w-0 flex-1 items-center gap-2.5 pl-3 sm:gap-3 sm:pl-4 md:pl-5">
            <SimpleTooltip
              content={activeMenu ? "Hide menu" : "Open menu"}
              position="BottomCenter"
            >
              <button
                type="button"
                aria-label={t("navbar.toggleMenu")}
                onClick={handleActiveMenu}
                style={{ WebkitTapHighlightColor: "transparent" }}
                className={[
                  "inline-flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200",
                  "text-gray-600 hover:bg-gray-100 active:bg-gray-200",
                  "dark:text-white/75 dark:hover:bg-white/10 dark:active:bg-white/15",
                  "focus:outline-none focus:ring-0",
                ].join(" ")}
              >
                <AiOutlineMenu className="text-[20px]" />
              </button>
            </SimpleTooltip>
          </div>

          <div className="flex h-full shrink-0 items-center">
            <div className="flex items-center gap-1 px-2 sm:px-3">
              <NavButton
                title={t("navbar.gotoOpenVAS")}
                aria-label={t("navbar.gotoOpenVAS")}
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
                    "group flex max-w-[44vw] items-center gap-2 rounded-xl px-2 py-1.5 transition-colors sm:max-w-none sm:gap-2.5 sm:px-2.5",
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
