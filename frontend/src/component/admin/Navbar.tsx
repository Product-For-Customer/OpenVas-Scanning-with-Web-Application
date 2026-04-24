import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AiOutlineMenu } from "react-icons/ai";
import { RiNotification3Line } from "react-icons/ri";
import { MdKeyboardArrowDown } from "react-icons/md";
import { TooltipComponent } from "@syncfusion/ej2-react-popups";
import { Notification, UserProfile } from ".";
import { useStateContext } from "../../contexts/ContextProvider";
import { useAuth } from "../../contexts/AuthContext";
import { pathOpenVas } from "../../services/api";
import { FiSearch } from "react-icons/fi";
import { HiOutlineMoon, HiOutlineSun } from "react-icons/hi2";
import greenboneIcon from "../../assets/logo-light.svg";
import { ListUserByID, type UserResponse } from "../../services";

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
const NAV_AVATAR_SIZE = 36;

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
        <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-linear-to-r from-cyan-500 to-violet-500 px-1 text-[10px] font-bold leading-none text-white shadow-sm">
          {badgeCount > 99 ? "99+" : badgeCount}
        </span>
      )}

      {icon}
    </button>
  </TooltipComponent>
);

const Navbar: React.FC = () => {
  const {
    activeMenu,
    setActiveMenu,
    handleClick,
    isClicked,
    setScreenSize,
    screenSize,
    currentMode,
    toggleMode,
    userRefreshTrigger,
  } = useStateContext();

  const { user, logout } = useAuth();

  const [navbarUser, setNavbarUser] = useState<UserResponse | null>(null);
  const [profileError, setProfileError] = useState(false);
  const [search, setSearch] = useState("");
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

  const fullName = `${effectiveUser?.first_name || "Guest"} ${effectiveUser?.last_name || "User"}`.trim();
  const roleName = effectiveUser?.role || "Viewer";
  const email = effectiveUser?.email || "guest@example.com";

  return (
    <header
      className="sticky top-0 z-40 w-full bg-transparent dark:bg-transparent"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="px-2.5 pb-2.5 pt-2.5 sm:px-3.5 md:px-4.5 lg:px-5">
        <div
          className={[
            "relative flex min-h-18.5 w-full items-center justify-between overflow-hidden rounded-[22px]",
            "border border-gray-200/80 bg-white/92 shadow-[0_14px_36px_-24px_rgba(15,23,42,0.28)] backdrop-blur",
            "dark:border-white/10 dark:bg-[#08111f]/80 dark:ring-1 dark:ring-cyan-400/10 dark:shadow-none",
          ].join(" ")}
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-12 right-10 h-24 w-24 rounded-full bg-cyan-400/10 blur-3xl" />
            <div className="absolute -bottom-12 left-16 h-24 w-24 rounded-full bg-violet-500/10 blur-3xl" />
          </div>

          <div className="relative z-10 flex min-w-0 flex-1 items-center gap-2.5 pl-3 sm:gap-3 sm:pl-4 md:pl-5">
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

            <div
              className={[
                "hidden h-11 w-full items-center rounded-full border border-gray-200 bg-[#f6f8fc] px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] sm:flex",
                "max-w-60 lg:max-w-90 xl:max-w-130",
                "dark:border-white/10 dark:bg-white/5 dark:shadow-none",
              ].join(" ")}
            >
              <FiSearch className="mr-3 shrink-0 text-[17px] text-gray-400 dark:text-white/40" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search assets, hosts, tasks, vulnerabilities..."
                className={[
                  "flex-1 border-none bg-transparent text-[13px] outline-none",
                  "text-gray-700 placeholder:text-gray-400",
                  "dark:text-white/80 dark:placeholder:text-white/35",
                ].join(" ")}
                aria-label="Search"
              />
              <span className="ml-3 hidden whitespace-nowrap text-[11px] font-medium text-gray-400 dark:text-white/35 xl:inline-flex">
                ⌘ + k
              </span>
            </div>
          </div>

          <div className="relative z-10 flex h-full shrink-0 items-center">
            <div className="flex items-center gap-1 px-2 sm:px-3">
              <NavButton
                title="Go to OpenVAS"
                aria-label="Go to OpenVAS"
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
                icon={
                  currentMode === "Dark" ? <HiOutlineSun /> : <HiOutlineMoon />
                }
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
                    "group flex max-w-[44vw] items-center gap-2 rounded-xl px-2 py-1.5 transition-colors sm:max-w-none sm:gap-2.5 sm:px-2.5",
                    "hover:bg-gray-100 active:bg-gray-200",
                    "dark:hover:bg-white/10 dark:active:bg-white/15",
                  ].join(" ")}
                  aria-label="Open profile"
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
                    <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-cyan-400 ring-2 ring-white dark:ring-[#08111f]" />
                  </div>

                  <div className="hidden text-left leading-tight sm:block">
                    <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-gray-400 dark:text-white/35">
                      Profile
                    </span>
                    <span className="block max-w-24 truncate text-[13px] font-semibold text-gray-700 dark:text-white/85 md:max-w-30">
                      {fullName}
                    </span>
                  </div>

                  <MdKeyboardArrowDown className="hidden text-[18px] text-gray-400 transition-colors group-hover:text-gray-600 dark:text-white/45 dark:group-hover:text-white/70 sm:block" />
                </button>
              </TooltipComponent>
            </div>
          </div>
        </div>
      </div>

      {isClicked.notification && <Notification />}

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