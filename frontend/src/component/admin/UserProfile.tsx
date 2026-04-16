import { MdOutlineCancel } from "react-icons/md";
import { useNavigate } from "react-router-dom";
import { type JSX, useMemo, useState, useEffect } from "react";
import { useStateContext } from "../../contexts/ContextProvider";
import {
  FiSettings,
  FiLogOut,
  FiShield,
  FiUser,
  FiChevronRight,
  FiServer,
} from "react-icons/fi";
import { useAuth } from "../../contexts/AuthContext";
import { message } from "antd";

type UserProfileItem = {
  icon: JSX.Element;
  title: string;
  desc: string;
  iconColor: string;
  iconBg: string;
  link?: string;
  action?: "logout" | "navigate";
};

const userProfileData: UserProfileItem[] = [
  {
    icon: <FiSettings />,
    title: "Settings",
    desc: "ตั้งค่าระบบ / integrations",
    iconColor: "#06b6d4",
    iconBg: "#ecfeff",
    link: "/admin/profile",
    action: "navigate",
  },
  {
    icon: <FiServer />,
    title: "Service",
    desc: "จัดการ service ของระบบ",
    iconColor: "#7c3aed",
    iconBg: "#f5f3ff",
    link: "/admin/service",
    action: "navigate",
  },
  {
    icon: <FiLogOut />,
    title: "Logout",
    desc: "ออกจากระบบ",
    iconColor: "#dc2626",
    iconBg: "#fff1f2",
    action: "logout",
  },
];

const UserProfile = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const ctx = useStateContext() as any;
  const isClicked = ctx?.isClicked;
  const setIsClicked = ctx?.setIsClicked;

  const [open, setOpen] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (isClicked?.userProfile) setOpen(true);
  }, [isClicked?.userProfile]);

  const close = () => {
    if (typeof setIsClicked === "function") {
      setIsClicked((prev: any) => ({ ...(prev || {}), userProfile: false }));
    }
    setOpen(false);
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

  const profileSrc = user?.profile?.trim() ? user.profile : avatarFallback;
  const fullName = `${user?.first_name || "Guest"} ${user?.last_name || "User"}`.trim();
  const roleName = user?.role || "Viewer";
  const email = user?.email || "guest@example.com";

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await logout();
      message.success("logout success");
      close();
      await new Promise((resolve) => setTimeout(resolve, 1000));
      navigate("/", { replace: true });
    } catch (error) {
      console.error("Logout failed:", error);
      message.error("logout failed");
      close();
      navigate("/", { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  const handleItemClick = async (item: UserProfileItem) => {
    if (item.action === "logout") {
      await handleLogout();
      return;
    }

    close();
    if (item.link) {
      navigate(item.link);
    }
  };

  if (!open) return null;

  return (
    <div
      className={[
        "fixed right-5 top-16 z-50",
        "w-[calc(100vw-24px)] max-w-85",
        "rounded-[22px] overflow-hidden",
        "bg-white/95 border border-gray-200/80 shadow-[0_16px_34px_-22px_rgba(15,23,42,0.32)] backdrop-blur",
        "dark:bg-[#08111f]/95 dark:border-white/10 dark:ring-1 dark:ring-cyan-400/10 dark:shadow-none",
      ].join(" ")}
      style={{ paddingTop: "max(0px, env(safe-area-inset-top))" }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-12 right-4 h-24 w-24 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-24 w-24 rounded-full bg-violet-500/10 blur-3xl" />
      </div>

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-3.5 py-3.5 border-b border-gray-200/80 dark:border-white/10">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-linear-to-br from-cyan-500 via-sky-500 to-violet-500 text-white shadow-sm">
            <FiUser className="text-[16px]" />
          </span>

          <div>
            <p className="text-[13px] font-semibold text-gray-800 dark:text-white/90">
              User Profile
            </p>
            <p className="text-[11px] text-gray-500 dark:text-white/50">
              Security analyst profile
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={close}
          aria-label="Close user profile"
          className="inline-flex h-9 w-9 items-center justify-center rounded-2xl transition-colors text-gray-600 hover:bg-gray-100 active:bg-gray-200 dark:text-white/70 dark:hover:bg-white/10 dark:active:bg-white/15"
        >
          <MdOutlineCancel className="text-[18px]" />
        </button>
      </div>

      {/* Hero */}
      <div className="relative z-10 px-3.5 pt-3.5">
        <div className="relative overflow-hidden rounded-3xl border border-cyan-200/70 bg-linear-to-br from-cyan-50 via-white to-violet-50 p-3.5 dark:border-cyan-400/15 dark:from-cyan-500/10 dark:via-white/4 dark:to-violet-500/10">
          <div className="pointer-events-none absolute -right-10 -top-10 h-20 w-20 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="pointer-events-none absolute -left-10 bottom-0 h-20 w-20 rounded-full bg-violet-500/20 blur-3xl" />

          <div className="relative flex gap-3 items-center">
            <div className="relative shrink-0">
              <img
                className="h-15 w-15 rounded-[20px] object-cover ring-1 ring-gray-200 bg-white dark:ring-white/10 dark:bg-white/10"
                src={profileSrc}
                alt="user-profile"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = avatarFallback;
                }}
              />
              <span className="absolute -right-1 -bottom-1 h-3.5 w-3.5 rounded-full bg-cyan-400 ring-2 ring-white dark:ring-[#08111f]" />
            </div>

            <div className="min-w-0">
              <p className="text-[16px] font-semibold text-gray-900 dark:text-white/90 truncate">
                {fullName}
              </p>

              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-500/10 dark:text-cyan-200">
                  <FiShield className="mr-1 text-[10px]" />
                  {roleName}
                </span>

                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-white/60">
                  Analyst Access
                </span>
              </div>

              <p className="mt-1.5 text-[11px] text-gray-500 dark:text-white/55 truncate">
                {email}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="relative z-10 px-3.5 pb-3.5 pt-2.5">
        <div className="rounded-3xl overflow-hidden border border-gray-200/80 bg-white dark:border-white/10 dark:bg-white/4">
          {userProfileData.map((item: UserProfileItem, idx: number) => (
            <button
              key={idx}
              onClick={() => void handleItemClick(item)}
              disabled={loggingOut}
              className={[
                "w-full flex items-center gap-2.5 px-3.5 py-3 transition-colors text-left",
                "hover:bg-gray-50 dark:hover:bg-white/6",
                idx !== 0 ? "border-t border-gray-200/80 dark:border-white/10" : "",
                loggingOut ? "opacity-70 cursor-not-allowed" : "",
              ].join(" ")}
            >
              <span
                className="inline-flex h-9 w-9 items-center justify-center rounded-2xl text-[17px] shrink-0"
                style={{ color: item.iconColor, backgroundColor: item.iconBg }}
              >
                {item.icon}
              </span>

              <div className="text-left min-w-0 flex-1">
                <p className="text-[12.5px] font-semibold text-gray-900 dark:text-white/85 truncate">
                  {item.action === "logout" && loggingOut ? "Logging out..." : item.title}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-white/55 truncate">
                  {item.desc}
                </p>
              </div>

              <FiChevronRight className="text-[14px] text-gray-400 dark:text-white/35 shrink-0" />
            </button>
          ))}
        </div>

        <div className="px-1 pt-2.5">
          <p className="text-[10px] text-gray-400 dark:text-white/35">
            Tip: ตรวจสอบ Tasks / Reports / Findings หลังการสแกนเสมอ
          </p>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;