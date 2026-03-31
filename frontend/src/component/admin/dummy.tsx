import React from "react";
import { FiShoppingBag, FiEdit } from "react-icons/fi";
import { AiOutlineShoppingCart, AiOutlineUser } from "react-icons/ai";
import { FaCarSide } from "react-icons/fa";
import { RiCustomerService2Line } from "react-icons/ri";
import type { JSX } from "react/jsx-dev-runtime";

export type SidebarLink = {
  name: string;
  icon?: React.ReactNode;
  badge?: string;
};

export type SidebarSection = {
  title: string;
  links: SidebarLink[];
};

type GetLinksParams = {
  isAdmin: boolean;
};

export const getLinks = ({ isAdmin }: GetLinksParams): SidebarSection[] => {
  const baseLinks: SidebarSection[] = [
    {
      title: "Dashboard",
      links: [
        { name: "dashboard", icon: <FiShoppingBag /> },
        { name: "vulnerability", icon: <FiEdit /> },
        { name: "target", icon: <FiEdit /> },
        //{ name: "P.THOR", icon: <FiEdit /> },
      ],
    },
  ];

  if (isAdmin) {
    baseLinks.push({
      title: "Mangement",
      links: [
        { name: "line notification", icon: <AiOutlineShoppingCart /> },
        { name: "user", icon: <FaCarSide /> },
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