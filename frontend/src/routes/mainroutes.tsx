import { lazy } from "react";
import { Navigate, useRoutes, type RouteObject } from "react-router-dom";
import Loadable from "../component/load/Loadable";
import { useAuth } from "../contexts/AuthContext";
import type { PermissionMap } from "../services/auth";

// ===== Admin Pages =====
const Dashboard          = Loadable(lazy(() => import("../page/Dashboard/index")));
const Account            = Loadable(lazy(() => import("../page/Account/index")));
const Target             = Loadable(lazy(() => import("../page/Target/index")));
const StatusTargetData   = Loadable(lazy(() => import("../page/Target/Status/data/index")));
const LineNotification   = Loadable(lazy(() => import("../page/Line/index")));
const LineIntegrations   = Loadable(lazy(() => import("../page/Line/Integrations/index")));
const User               = Loadable(lazy(() => import("../page/User/index")));
const RoleManagement     = Loadable(lazy(() => import("../page/RoleManagement/index")));
const MainLayout         = Loadable(lazy(() => import("../component/structure/MainLayout")));
const Service            = Loadable(lazy(() => import("../component/structure/navbar/Service")));
const VulnerabilityByDevice = Loadable(lazy(() => import("../page/Target/TableTarget/vulnerability/index")));
const VulnerabilityByLevel  = Loadable(lazy(() => import("../page/Dashboard/Description/vulnerability")));
const Vulnerability         = Loadable(lazy(() => import("../page/Vulnerability/index")));
const VulnerabilityDetail   = Loadable(lazy(() => import("../page/Vulnerability/List/Detail/index")));
const Report             = Loadable(lazy(() => import("../page/Report/index")));
const Diagram            = Loadable(lazy(() => import("../page/Diagram/index")));
const DiagramNode        = Loadable(lazy(() => import("../page/Diagram/Node/index")));
const ThreatIntelligence = Loadable(lazy(() => import("../page/ThreatIntelligence/index")));
const ThreatIntelligenceDetail = Loadable(lazy(() => import("../page/ThreatIntelligence/Detail/index")));
const ScanManagement     = Loadable(lazy(() => import("../page/ScanManagement/index")));
const Compliance         = Loadable(lazy(() => import("../page/Compliance/index")));
const ComplianceControl  = Loadable(lazy(() => import("../page/Compliance/Control/index")));
const PasswordPolicy     = Loadable(lazy(() => import("../page/PasswordPolicy/index")));
const VulnerabilityDelta = Loadable(lazy(() => import("../page/Vulnerability/Delta/index")));
const HostDetail         = Loadable(lazy(() => import("../page/HostDetail/index")));
const CalendarPage       = Loadable(lazy(() => import("../page/Calendar/index")));
const FeedStatus         = Loadable(lazy(() => import("../page/FeedStatus/index")));
const ThreatConfig       = Loadable(lazy(() => import("../page/ThreatConfig/index")));
const RecycleBin         = Loadable(lazy(() => import("../page/RecycleBin/index")));
const AuditLog           = Loadable(lazy(() => import("../page/AuditLog/index")));

// ===== Auth Pages =====
const LoginPage          = Loadable(lazy(() => import("../page/Authentication/Login")));
const RegisterPage       = Loadable(lazy(() => import("../page/Authentication/Register")));
const ForgotPasswordPage = Loadable(lazy(() => import("../page/Authentication/ForgotPassword")));
const ResetPasswordPage  = Loadable(lazy(() => import("../page/Authentication/ResetPassword")));
const OTPPage            = Loadable(lazy(() => import("../page/Authentication/OTP")));
const RegisterOTPPage    = Loadable(lazy(() => import("../page/Authentication/RegisterOTP")));
const ResetOTPPage       = Loadable(lazy(() => import("../page/Authentication/ResetOTP")));

// ===== Utility =====
const Loader         = Loadable(lazy(() => import("../component/load/Loader")));
const CaptureTest    = Loadable(lazy(() => import("../page/Report/capture")));
const AfterLoginAnimation = Loadable(lazy(() => import("../page/Authentication/animation/route")));

// ======================= ROUTES =======================
// Single source of truth: every /admin/* page + the permission category that
// gates it (undefined = always visible to any authenticated role, used only
// for the personal Account/profile page which is self-service on the backend
// too). ConfigRoutes filters this list against the logged-in role's
// permission matrix — replacing the old per-role duplicated route arrays.

type AdminRouteDef = RouteObject & { category?: string };

const ADMIN_CHILD_ROUTES: AdminRouteDef[] = [
  { index: true,                                element: <Dashboard /> },
  { path: "dashboard",                          element: <Dashboard />, category: "dashboard" },
  { path: "profile",                            element: <Account /> }, // self-service, always visible
  { path: "target",                             element: <Target />, category: "dashboard" },
  { path: "vulnerability",                      element: <Vulnerability />, category: "dashboard" },
  { path: "vulnerability-by-device",            element: <VulnerabilityByDevice />, category: "dashboard" },
  { path: "vulnerability-by-level",              element: <VulnerabilityByLevel />, category: "dashboard" },
  { path: "vulnerability-detail",                element: <VulnerabilityDetail />, category: "dashboard" },
  { path: "vulnerability-delta",                  element: <VulnerabilityDelta />, category: "dashboard" },
  { path: "status-target-data",                  element: <StatusTargetData />, category: "dashboard" },
  { path: "host/:ip",                            element: <HostDetail />, category: "dashboard" },

  { path: "scan-management",                     element: <ScanManagement />, category: "threat_intel" },
  { path: "recycle-bin",                          element: <RecycleBin />, category: "threat_intel" },
  { path: "calendar",                             element: <CalendarPage />, category: "dashboard" },

  { path: "threat-intelligence",                  element: <ThreatIntelligence />, category: "threat_intel" },
  { path: "threat-intelligence/detail/:hostIp",   element: <ThreatIntelligenceDetail />, category: "threat_intel" },
  { path: "feed-status",                          element: <FeedStatus />, category: "threat_intel" },
  { path: "threat-config",                        element: <ThreatConfig />, category: "threat_intel" },

  { path: "report",                              element: <Report />, category: "dashboard" },
  { path: "diagrams",                            element: <Diagram />, category: "reports_diagrams" },
  { path: "diagram-node",                         element: <DiagramNode />, category: "reports_diagrams" },
  { path: "compliance",                          element: <Compliance />, category: "dashboard" },
  { path: "compliance/:framework/:controlId",     element: <ComplianceControl />, category: "dashboard" },

  { path: "user",                                element: <User />, category: "user_management" },
  { path: "roles",                               element: <RoleManagement />, category: "user_management" },

  { path: "line notification",                    element: <LineNotification />, category: "line_management" },
  { path: "line notification/integrations",       element: <LineIntegrations />, category: "line_management" },
  { path: "service",                              element: <Service />, category: "line_settings" },
  { path: "password-policy",                      element: <PasswordPolicy />, category: "line_settings" },

  { path: "audit-log",                           element: <AuditLog />, category: "audit_log" },
];

const canView = (permissions: PermissionMap, category?: string) =>
  !category || permissions[category]?.view === true;

const AdminRoutes = (permissions: PermissionMap): RouteObject[] => [
  { path: "/", element: <Navigate to="/admin" replace /> },
  {
    path: "/admin",
    element: <MainLayout />,
    children: [
      ...ADMIN_CHILD_ROUTES.filter((r) => canView(permissions, r.category)),
      // Unauthorized deep-links (bookmarked, typed) redirect home instead of
      // rendering a page the role can't reach.
      { path: "*", element: <Navigate to="/admin" replace /> },
    ],
  },
  { path: "after-login-animation",  element: <AfterLoginAnimation /> },
  { path: "*",               element: <Navigate to="/admin" replace /> },
];

// ── Public auth routes (unauthenticated) ──
const MainRoutes = (): RouteObject[] => [
  {
    path: "/",
    children: [
      { index: true,                    element: <LoginPage /> },
      { path: "login",                  element: <LoginPage /> },
      { path: "register",               element: <RegisterPage /> },
      { path: "forgot-password",        element: <ForgotPasswordPage /> },
      { path: "reset-password",         element: <ResetPasswordPage /> },
      { path: "otp",                    element: <OTPPage /> },
      { path: "register-otp",           element: <RegisterOTPPage /> },
      { path: "reset-otp",              element: <ResetOTPPage /> },
      { path: "capture",                element: <CaptureTest /> },
      { path: "after-login-animation",  element: <AfterLoginAnimation /> },
      { path: "*",                      element: <LoginPage /> },
    ],
  },
];

// ======================= MAIN CONFIG =======================
function ConfigRoutes() {
  const { isLoading, isAuthed, permissions } = useAuth();

  if (isLoading) {
    return useRoutes([{ path: "*", element: <Loader /> }]);
  }

  if (!isAuthed) {
    return useRoutes(MainRoutes());
  }

  return useRoutes(AdminRoutes(permissions));
}

export default ConfigRoutes;
