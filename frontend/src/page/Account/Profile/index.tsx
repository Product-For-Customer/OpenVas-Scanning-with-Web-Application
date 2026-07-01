import React, { useEffect, useMemo, useState } from "react";
import { Image } from "antd";
import {
  FiEdit2,
  FiHome,
  FiBriefcase,
  FiMail,
  FiPhone,
  FiSettings,
} from "react-icons/fi";
import { Link } from "react-router-dom";
import type { UserResponse } from "../../../services/user";
import profileBanner from "../../../assets/background_profile.jpg";
import { useLanguage } from "../../../contexts/LanguageContext";

type ProfileProps = {
  user: UserResponse;
};

const AVATAR_SIZE_MOBILE = 64;
const AVATAR_SIZE_DESKTOP = 80;

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

    img.onerror = () => reject(new Error("Failed to load profile image"));
    img.src = imageSrc;
  });
};

const Profile: React.FC<ProfileProps> = ({ user }) => {
  const { t } = useLanguage();
  const [thumbSrc, setThumbSrc] = useState<string>("");
  const [thumbLoading, setThumbLoading] = useState(false);

  const fullName =
    `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || t("accountProfile.unknownUser");

  const itemClass =
    "flex items-center gap-2.5 text-[12px] text-[#1f2240] dark:text-white/70";

  const iconClass = "text-gray-500 text-[14px] dark:text-white/40";

  const linkClass = [
    "inline-flex items-center gap-2.5 text-[12px] transition-colors",
    "text-[#1f2240] hover:text-[#6f5be8]",
    "dark:text-white/70 dark:hover:text-[#a99cff]",
  ].join(" ");

  const profileSrc = useMemo(() => {
    return user.profile?.trim() ? user.profile : "";
  }, [user.profile]);

  useEffect(() => {
    let cancelled = false;

    const buildThumbnail = async () => {
      if (!profileSrc) {
        setThumbSrc("");
        return;
      }

      try {
        setThumbLoading(true);

        const size =
          window.innerWidth >= 640 ? AVATAR_SIZE_DESKTOP : AVATAR_SIZE_MOBILE;

        const dataUrl = await createCoverThumbnail(profileSrc, size);

        if (!cancelled) {
          setThumbSrc(dataUrl);
        }
      } catch (error) {
        console.error("Failed to create avatar thumbnail:", error);
        if (!cancelled) {
          setThumbSrc(profileSrc);
        }
      } finally {
        if (!cancelled) {
          setThumbLoading(false);
        }
      }
    };

    buildThumbnail();

    const handleResize = () => {
      buildThumbnail();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      cancelled = true;
      window.removeEventListener("resize", handleResize);
    };
  }, [profileSrc]);

  return (
    <aside
      className={[
        "h-full rounded-[18px] border shadow-sm flex flex-col overflow-hidden",
        "border-gray-200/80 bg-[#f7f7f8]",
        "dark:border-white/10 dark:bg-white/5 dark:shadow-none dark:ring-1 dark:ring-white/10",
      ].join(" ")}
    >
      <div className="relative h-28 sm:h-32">
        <div className="absolute inset-0 overflow-hidden">
          <img
            src={profileBanner}
            alt="Profile banner"
            className="absolute inset-0 h-full w-full scale-[1.03] object-cover object-center"
          />

          <div className="absolute inset-0 bg-black/10 dark:bg-slate-950/20" />

          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0.02)_45%,rgba(255,255,255,0.08)_100%)] dark:bg-[linear-gradient(180deg,rgba(2,6,23,0.04)_0%,rgba(2,6,23,0.12)_50%,rgba(2,6,23,0.22)_100%)]" />
        </div>

        <div className="absolute left-1/2 bottom-0 z-10 -translate-x-1/2 translate-y-1/2">
          <div
            className={[
              "h-16 w-16 sm:h-20 sm:w-20 rounded-[18px] shadow-md flex items-center justify-center overflow-hidden",
              "bg-white ring-4 ring-[#f7f7f8]",
              "dark:bg-white/10 dark:ring-4 dark:ring-white/5 dark:shadow-none",
            ].join(" ")}
          >
            {profileSrc ? (
              <div className="block h-full w-full cursor-zoom-in">
                <Image
                  src={thumbSrc || profileSrc}
                  preview={{ src: profileSrc, mask: false }}
                  alt={fullName}
                  draggable={false}
                  className={[
                    "block h-full w-full object-cover",
                    thumbLoading ? "opacity-90" : "opacity-100",
                  ].join(" ")}
                  style={{ objectFit: "cover", objectPosition: "center" }}
                />
              </div>
            ) : (
              <span className="text-[34px]">🧑🏻‍💻</span>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-5 pt-11 pb-4 text-center">
        <h3 className="text-[16px] sm:text-[18px] font-semibold text-[#1f2240] dark:text-white/85">
          {fullName}
        </h3>

        <p className="mt-0.5 text-[11px] text-gray-500 dark:text-white/45">
          {user.role || t("accountProfile.noRole")}
        </p>
      </div>

      <div className="px-4 sm:px-5 pb-5 space-y-4 flex-1">
        <div className="border-t border-gray-200/80 pt-4 dark:border-white/10">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-[14px] font-semibold text-[#1f2240] dark:text-white/85">
              {t("accountProfile.about")}
            </h4>
            <button
              type="button"
              className="text-gray-400 hover:text-gray-600 transition-colors dark:text-white/35 dark:hover:text-white/65"
              aria-label={t("accountProfile.editAbout")}
            >
              <FiEdit2 className="text-[13px]" />
            </button>
          </div>

          <ul className="space-y-2.5">
            <li className={itemClass}>
              <FiHome className={iconClass} />
              <span>
                {user.location ? t("accountProfile.livesIn", { location: user.location }) : t("accountProfile.noLocation")}
              </span>
            </li>

            <li className={itemClass}>
              <FiBriefcase className={iconClass} />
              <span>
                {user.position ? t("accountProfile.worksAs", { position: user.position }) : t("accountProfile.noPosition")}
              </span>
            </li>

            <li className={itemClass}>
              <FiMail className={iconClass} />
              <span>{user.email || t("accountProfile.noEmail")}</span>
            </li>

            <li className={itemClass}>
              <FiPhone className={iconClass} />
              <span>{user.phone_number || t("accountProfile.noPhoneNumber")}</span>
            </li>
          </ul>
        </div>

        <div className="border-t border-gray-200/80 pt-4 dark:border-white/10">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-[14px] font-semibold text-[#1f2240] dark:text-white/85">
              {t("accountProfile.other")}
            </h4>
          </div>

          <ul className="space-y-2.5">
            <li>
              <Link to="/admin/service" className={linkClass}>
                <FiSettings className={iconClass} />
                <span className="text-blue-500">{t("accountProfile.service")}</span>
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </aside>
  );
};

export default Profile;