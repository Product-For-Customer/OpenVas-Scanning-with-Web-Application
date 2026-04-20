import React from "react";
import {
  FiShield,
  FiTarget,
  FiGitBranch,
  FiBell,
  FiFileText,
  FiUsers,
  FiSettings,
} from "react-icons/fi";
import { AiOutlineUser } from "react-icons/ai";
import { RiCustomerService2Line } from "react-icons/ri";
import type { JSX } from "react/jsx-dev-runtime";
import { MdSpaceDashboard, MdDashboardCustomize } from "react-icons/md";

export type SidebarLink = {
  name: string;
  icon?: React.ReactNode;
  badge?: string;
};

export type SidebarSection = {
  title: string;
  icon?: React.ReactNode;
  links: SidebarLink[];
};

type GetLinksParams = {
  isAdmin: boolean;
};

export const getLinks = ({ isAdmin }: GetLinksParams): SidebarSection[] => {
  const baseLinks: SidebarSection[] = [
    {
      title: "Dashboard",
      icon: <MdDashboardCustomize />,
      links: [
        { name: "dashboard", icon: <MdSpaceDashboard /> },
        { name: "vulnerability", icon: <FiShield /> },
        { name: "target", icon: <FiTarget /> },
        { name: "diagrams", icon: <FiGitBranch /> },
      ],
    },
  ];

  if (isAdmin) {
    baseLinks.push({
      title: "Management",
      icon: <FiSettings />,
      links: [
        { name: "line notification", icon: <FiBell /> },
        { name: "report", icon: <FiFileText /> },
        { name: "user", icon: <FiUsers /> },
      ],
    });
  }

  return baseLinks;
};

export const themeColors = [
  {
    name: "blue-theme",
    color: "#1A97F5",
  },
  {
    name: "green-theme",
    color: "#03C9D7",
  },
  {
    name: "purple-theme",
    color: "#7352FF",
  },
  {
    name: "red-theme",
    color: "#FF5C8E",
  },
  {
    name: "indigo-theme",
    color: "#1E4DB7",
  },
  {
    color: "#FB9678",
    name: "orange-theme",
  },
];

export type UserProfileItem = {
  icon: JSX.Element;
  title: string;
  desc: string;
  iconColor: string;
  iconBg: string;
  link: string;
};

export const userProfileData: UserProfileItem[] = [
  {
    icon: <AiOutlineUser />,
    title: "My Profile",
    desc: "Account Settings",
    iconColor: "#03C9D7",
    iconBg: "#E5FAFB",
    link: "/admin/profile",
  },
  {
    icon: <RiCustomerService2Line />,
    title: "Service",
    desc: "แก้ไขข้อมูลฝ่ายบริการ",
    iconColor: "#2563EB",
    iconBg: "#EAF2FF",
    link: "/admin/service",
  },
];