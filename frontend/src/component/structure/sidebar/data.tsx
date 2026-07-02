import React from "react";
import {
  FiShield,
  FiTarget,
  FiBell,
  FiFileText,
  FiUsers,
  FiZap,
  FiSettings,
  FiBarChart2,
  FiGitMerge,
  FiLock,
  FiServer,
  FiActivity,
  FiDatabase,
  FiSliders,
  FiTrash2,
} from "react-icons/fi";
import { MdSpaceDashboard, MdDashboardCustomize, MdAdminPanelSettings } from "react-icons/md";
import { FaProjectDiagram } from "react-icons/fa";
import { BsCalendar3 } from "react-icons/bs";
import type { TranslationKey } from "../../../locales";

export type SidebarLink = {
  name: string;
  icon?: React.ReactNode;
  badge?: string;
  labelKey: TranslationKey;
};

export type SidebarSection = {
  title: string;
  icon?: React.ReactNode;
  links: SidebarLink[];
  titleKey: TranslationKey;
};

type GetLinksParams = {
  isAdmin: boolean;
};

export const getLinks = ({ isAdmin }: GetLinksParams): SidebarSection[] => {
  // Apps — Calendar & Diagrams for everyone; Recycle Bin is an admin-only
  // destructive-data tool (permanent delete/restore), so it's admin-only.
  const appsLinks: SidebarLink[] = [
    { name: "calendar", icon: <BsCalendar3 />,      labelKey: "nav.calendar" },
    { name: "diagrams", icon: <FaProjectDiagram />, labelKey: "nav.diagrams" },
  ];
  if (isAdmin) {
    appsLinks.push({ name: "recycle-bin", icon: <FiTrash2 />, labelKey: "nav.recycleBin" });
  }

  const sections: SidebarSection[] = [
    {
      title: "Dashboard",
      titleKey: "section.dashboard",
      icon: <MdDashboardCustomize />,
      links: [
        { name: "dashboard",     icon: <MdSpaceDashboard />,   labelKey: "nav.dashboard" },
        { name: "vulnerability", icon: <FiShield />,            labelKey: "nav.vulnerability" },
        { name: "target",        icon: <FiTarget />,            labelKey: "nav.target" },
      ],
    },
    {
      title: "Apps",
      titleKey: "section.apps",
      icon: <BsCalendar3 />,
      links: appsLinks,
    },
  ];

  if (isAdmin) {
    sections.push(
      {
        title: "Threat Intelligence",
        titleKey: "section.threatIntelligence",
        icon: <FiZap />,
        links: [
          { name: "threat-intelligence", icon: <FiDatabase />, labelKey: "nav.kevCatalog" },
          { name: "feed-status",          icon: <FiActivity />, labelKey: "nav.feedStatus" },
          { name: "threat-config",        icon: <FiSliders />,  labelKey: "nav.threatConfig" },
          { name: "scan-management",      icon: <FiSettings />, labelKey: "nav.scanManagement" },
        ],
      },
      {
        title: "Management",
        titleKey: "section.management",
        icon: <MdAdminPanelSettings />,
        links: [
          { name: "line notification", icon: <FiBell />,    labelKey: "nav.lineNotification" },
          { name: "user",              icon: <FiUsers />,   labelKey: "nav.user" },
          { name: "password-policy",   icon: <FiLock />,    labelKey: "nav.passwordPolicy" },
          { name: "service",           icon: <FiServer />,  labelKey: "nav.service" },
        ],
      },
    );
  }

  // Analytics — shown to everyone (admin AND user); report download / email /
  // line "send" actions stay allowed for the read-only user role.
  sections.push({
    title: "Analytics",
    titleKey: "section.analytics",
    icon: <FiBarChart2 />,
    links: [
      { name: "report",               icon: <FiFileText />, labelKey: "nav.report" },
      { name: "compliance",           icon: <FiShield />,   labelKey: "nav.compliance" },
      { name: "vulnerability-delta",  icon: <FiGitMerge />, labelKey: "nav.vulnerabilityDelta" },
    ],
  });

  return sections;
};

export const themeColors = [
  { name: "azure-blue",  color: "#1A97F5" },
  { name: "cyan",        color: "#03C9D7" },
  { name: "violet",      color: "#A855F7" },
  { name: "hot-pink",    color: "#FF5C8E" },
  { name: "coral",       color: "#FB9678" },
  { name: "emerald",     color: "#10B981" },
  { name: "amber",       color: "#F59E0B" },
  { name: "vivid-red",   color: "#EF4444" },
  { name: "orange",      color: "#F97316" },
  { name: "magenta",     color: "#EC4899" },
];

