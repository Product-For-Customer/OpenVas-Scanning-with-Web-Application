import React from "react";
import {
  FiEdit2,
  FiHome,
  FiBriefcase,
  FiCamera,
  FiMail,
  FiPhone,
  FiGlobe,
  FiSettings,
} from "react-icons/fi";
import { Link } from "react-router-dom";
import type { UserResponse } from "../../../services/user";

type ProfileProps = {
  user: UserResponse;
};

const Profile: React.FC<ProfileProps> = ({ user }) => {
  const fullName =
    `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || "Unknown User";

  const itemClass =
    "flex items-center gap-2.5 text-[12px] text-[#1f2240] dark:text-white/70";

  const iconClass = "text-gray-500 text-[14px] dark:text-white/40";

  const linkClass = [
    "inline-flex items-center gap-2.5 text-[12px] transition-colors",
    "text-[#1f2240] hover:text-[#6f5be8]",
    "dark:text-white/70 dark:hover:text-[#a99cff]",
  ].join(" ");

  return (
    <aside
      className={[
        "h-full rounded-[18px] border shadow-sm overflow-hidden flex flex-col",
        "border-gray-200/80 bg-[#f7f7f8]",
        "dark:border-white/10 dark:bg-white/5 dark:shadow-none dark:ring-1 dark:ring-white/10",
      ].join(" ")}
    >
      <div className="relative h-28 sm:h-32 bg-linear-to-r from-pink-100 via-purple-100 to-indigo-100 dark:from-white/10 dark:via-white/5 dark:to-white/10">
        <div className="absolute inset-0 opacity-80">
          <div className="absolute left-7 top-7 h-16 w-24 rounded-xl bg-pink-200/60 blur-[2px] dark:bg-white/10" />
          <div className="absolute right-8 top-5 h-20 w-28 rounded-2xl bg-indigo-300/30 blur-[2px] dark:bg-white/8" />
          <div className="absolute left-1/3 top-8 h-12 w-12 rounded-full bg-purple-300/40 dark:bg-white/10" />
        </div>

        <div className="absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2">
          <div className="relative">
            <div
              className={[
                "h-16 w-16 sm:h-20 sm:w-20 rounded-[18px] shadow-md flex items-center justify-center overflow-hidden",
                "bg-white ring-4 ring-[#f7f7f8]",
                "dark:bg-white/10 dark:ring-4 dark:ring-white/5 dark:shadow-none",
              ].join(" ")}
            >
              {user.profile ? (
                <img
                  src={user.profile}
                  alt={fullName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-[34px]">🧑🏻‍💻</span>
              )}
            </div>

            <button
              type="button"
              className={[
                "absolute right-0 bottom-0 h-6 w-6 rounded-full border shadow flex items-center justify-center",
                "bg-[#ede9fe] text-[#6f5be8] border-white",
                "dark:bg-white/10 dark:text-white/80 dark:border-white/10 dark:shadow-none",
              ].join(" ")}
              aria-label="Change avatar"
            >
              <FiCamera className="text-[12px]" />
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-5 pt-11 pb-4 text-center">
        <h3 className="text-[16px] sm:text-[18px] font-semibold text-[#1f2240] dark:text-white/85">
          {fullName}
        </h3>

        <p className="mt-0.5 text-[11px] text-gray-500 dark:text-white/45">
          {user.role || "No role"}
        </p>
      </div>

      <div className="px-4 sm:px-5 pb-5 space-y-4 flex-1">
        <div className="border-t border-gray-200/80 pt-4 dark:border-white/10">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-[14px] font-semibold text-[#1f2240] dark:text-white/85">
              About
            </h4>
            <button
              type="button"
              className="text-gray-400 hover:text-gray-600 transition-colors dark:text-white/35 dark:hover:text-white/65"
              aria-label="Edit about"
            >
              <FiEdit2 className="text-[13px]" />
            </button>
          </div>

          <ul className="space-y-2.5">
            <li className={itemClass}>
              <FiHome className={iconClass} />
              <span>
                {user.location ? `Lives in ${user.location}` : "No location"}
              </span>
            </li>

            <li className={itemClass}>
              <FiBriefcase className={iconClass} />
              <span>
                {user.position ? `Works as ${user.position}` : "No position"}
              </span>
            </li>

            <li className={itemClass}>
              <FiMail className={iconClass} />
              <span>{user.email || "No email"}</span>
            </li>

            <li className={itemClass}>
              <FiPhone className={iconClass} />
              <span>{user.phone_number || "No phone number"}</span>
            </li>
          </ul>
        </div>

        <div className="border-t border-gray-200/80 pt-4 dark:border-white/10">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-[14px] font-semibold text-[#1f2240] dark:text-white/85">
              Other
            </h4>
          </div>

          <ul className="space-y-2.5">
            <li>
              <a
                href="https://openvaswebv1.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                <FiGlobe className={iconClass} />
                <span className="text-blue-500">www.openvas.com</span>
              </a>
            </li>

            <li>
              <Link to="/admin/service" className={linkClass}>
                <FiSettings className={iconClass} />
                <span className="text-blue-500">Service</span>
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </aside>
  );
};

export default Profile;