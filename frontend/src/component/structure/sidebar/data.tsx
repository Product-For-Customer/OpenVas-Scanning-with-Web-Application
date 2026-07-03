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
  FiClipboard,
  FiShieldOff,
} from "react-icons/fi";
import { MdSpaceDashboard, MdDashboardCustomize, MdAdminPanelSettings } from "react-icons/md";
import { FaProjectDiagram } from "react-icons/fa";
import { BsCalendar3 } from "react-icons/bs";
import type { TranslationKey } from "../../../locales";
import type { PermissionMap } from "../../../services/auth";

export type SidebarLink = {
  name: string;
  icon?: React.ReactNode;
  badge?: string;
  labelKey: TranslationKey;
  /** Permission category this link's page needs View access to. Omit for
   *  links that should always show (none currently — every page maps to a
   *  category now that access is dynamic). */
  category?: string;
};

export type SidebarSection = {
  title: string;
  icon?: React.ReactNode;
  links: SidebarLink[];
  titleKey: TranslationKey;
};

const canView = (permissions: PermissionMap, category?: string) =>
  !category || permissions[category]?.view === true;

export const getLinks = (permissions: PermissionMap): SidebarSection[] => {
  const filterLinks = (links: SidebarLink[]) => links.filter((l) => canView(permissions, l.category));

  const sections: SidebarSection[] = [
    {
      title: "Dashboard",
      titleKey: "section.dashboard",
      icon: <MdDashboardCustomize />,
      links: filterLinks([
        { name: "dashboard",     icon: <MdSpaceDashboard />, labelKey: "nav.dashboard", category: "dashboard" },
        { name: "vulnerability", icon: <FiShield />,          labelKey: "nav.vulnerability", category: "dashboard" },
        { name: "target",        icon: <FiTarget />,          labelKey: "nav.target", category: "dashboard" },
      ]),
    },
    {
      title: "Apps",
      titleKey: "section.apps",
      icon: <BsCalendar3 />,
      links: filterLinks([
        { name: "calendar",    icon: <BsCalendar3 />,      labelKey: "nav.calendar", category: "scan_management" },
        { name: "diagrams",    icon: <FaProjectDiagram />, labelKey: "nav.diagrams", category: "reports_diagrams" },
        { name: "recycle-bin", icon: <FiTrash2 />,         labelKey: "nav.recycleBin", category: "scan_management" },
        { name: "audit-log",   icon: <FiClipboard />,      labelKey: "nav.auditLog", category: "audit_log" },
      ]),
    },
    {
      title: "Threat Intelligence",
      titleKey: "section.threatIntelligence",
      icon: <FiZap />,
      links: filterLinks([
        { name: "threat-intelligence", icon: <FiDatabase />, labelKey: "nav.kevCatalog", category: "threat_intel" },
        { name: "feed-status",          icon: <FiActivity />, labelKey: "nav.feedStatus", category: "threat_intel" },
        { name: "threat-config",        icon: <FiSliders />,  labelKey: "nav.threatConfig", category: "threat_intel" },
        { name: "scan-management",      icon: <FiSettings />, labelKey: "nav.scanManagement", category: "scan_management" },
      ]),
    },
    {
      title: "Management",
      titleKey: "section.management",
      icon: <MdAdminPanelSettings />,
      links: filterLinks([
        { name: "line notification", icon: <FiBell />,      labelKey: "nav.lineNotification", category: "line_settings" },
        { name: "user",              icon: <FiUsers />,      labelKey: "nav.user", category: "user_management" },
        { name: "roles",             icon: <FiShieldOff />,  labelKey: "nav.roles", category: "user_management" },
        { name: "password-policy",   icon: <FiLock />,       labelKey: "nav.passwordPolicy", category: "line_settings" },
        { name: "service",           icon: <FiServer />,     labelKey: "nav.service", category: "line_settings" },
      ]),
    },
    {
      title: "Analytics",
      titleKey: "section.analytics",
      icon: <FiBarChart2 />,
      links: filterLinks([
        { name: "report",              icon: <FiFileText />, labelKey: "nav.report", category: "reports_diagrams" },
        { name: "compliance",          icon: <FiShield />,   labelKey: "nav.compliance", category: "reports_diagrams" },
        { name: "vulnerability-delta", icon: <FiGitMerge />, labelKey: "nav.vulnerabilityDelta", category: "dashboard" },
      ]),
    },
  ];

  // Drop sections that ended up with no visible links for this role.
  return sections.filter((s) => s.links.length > 0);
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
