import { lazy } from "react";
import { Navigate, useRoutes, type RouteObject } from "react-router-dom";
import Loadable from "../component/load/Loadable";
import { useAuth } from "../contexts/AuthContext";

// ===== Admin Pages =====
const Dashboard          = Loadable(lazy(() => import("../page/Dashboard/index")));
const Account            = Loadable(lazy(() => import("../page/Account/index")));
const Target             = Loadable(lazy(() => import("../page/Target/index")));
const StatusTargetData   = Loadable(lazy(() => import("../page/Target/Status/data/index")));
const LineNotification   = Loadable(lazy(() => import("../page/Line/index")));
const User               = Loadable(lazy(() => import("../page/User/index")));
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

// ===== Auth Pages =====
const LoginPage          = Loadable(lazy(() => import("../page/Authentication/Login")));
const RegisterPage       = Loadable(lazy(() => import("../page/Authentication/Register")));
const ForgotPasswordPage = Loadable(lazy(() => import("../page/Authentication/ForgotPassword")));
const ResetPasswordPage  = Loadable(lazy(() => import("../page/Authentication/ResetPassword")));
const OTPPage            = Loadable(lazy(() => import("../page/Authentication/OTP")));

// ===== Utility =====
const Loader         = Loadable(lazy(() => import("../component/load/Loader")));
const CaptureTest    = Loadable(lazy(() => import("../page/Report/capture")));
const LogoAnimation  = Loadable(lazy(() => import("../page/Authentication/animation/index")));

// ======================= ROUTES =======================

const AdminRoutes = (): RouteObject[] => [
  { path: "/", element: <Navigate to="/admin" replace /> },
  {
    path: "/admin",
    element: <MainLayout />,
    children: [
      { index: true,                                          element: <Dashboard /> },
      { path: "dashboard",                                    element: <Dashboard /> },
      { path: "profile",                                      element: <Account /> },
      { path: "target",                                       element: <Target /> },
      { path: "vulnerability",                                element: <Vulnerability /> },
      { path: "line notification",                            element: <LineNotification /> },
      { path: "vulnerability-by-device",                      element: <VulnerabilityByDevice /> },
      { path: "vulnerability-by-level",                       element: <VulnerabilityByLevel /> },
      { path: "user",                                         element: <User /> },
      { path: "vulnerability-detail",                         element: <VulnerabilityDetail /> },
      { path: "service",                                      element: <Service /> },
      { path: "report",                                       element: <Report /> },
      { path: "diagrams",                                     element: <Diagram /> },
      { path: "diagram-node",                                 element: <DiagramNode /> },
      { path: "status-target-data",                           element: <StatusTargetData /> },
      { path: "threat-intelligence",                          element: <ThreatIntelligence /> },
      { path: "threat-intelligence/detail/:hostIp",           element: <ThreatIntelligenceDetail /> },
      { path: "scan-management",                              element: <ScanManagement /> },
      { path: "compliance",                                   element: <Compliance /> },
      { path: "compliance/:framework/:controlId",             element: <ComplianceControl /> },
      { path: "password-policy",                              element: <PasswordPolicy /> },
      { path: "vulnerability-delta",                          element: <VulnerabilityDelta /> },
      { path: "host/:ip",                                     element: <HostDetail /> },
      { path: "calendar",                                     element: <CalendarPage /> },
      { path: "feed-status",                                  element: <FeedStatus /> },
      { path: "threat-config",                                element: <ThreatConfig /> },
      { path: "recycle-bin",                                  element: <RecycleBin /> },
    ],
  },
  { path: "logo-animation",  element: <LogoAnimation /> },
  { path: "*",               element: <Navigate to="/admin" replace /> },
];


const UserRoutes = (): RouteObject[] => [
  { path: "/", element: <Navigate to="/admin" replace /> },
  {
    path: "/admin",
    element: <MainLayout />,
    children: [
      { index: true,                           element: <Dashboard /> },
      { path: "dashboard",                     element: <Dashboard /> },
      { path: "profile",                       element: <Account /> },
      { path: "target",                        element: <Target /> },
      { path: "status-target-data",            element: <StatusTargetData /> },
      { path: "vulnerability",                 element: <Vulnerability /> },
      { path: "vulnerability-by-device",       element: <VulnerabilityByDevice /> },
      { path: "vulnerability-detail",          element: <VulnerabilityDetail /> },
      { path: "vulnerability-by-level",        element: <VulnerabilityByLevel /> },
      { path: "diagrams",                      element: <Diagram /> },
      { path: "diagram-node",                  element: <DiagramNode /> },
      { path: "host/:ip",                      element: <HostDetail /> },
      { path: "calendar",                      element: <CalendarPage /> },
    ],
  },
  { path: "*", element: <Navigate to="/admin" replace /> },
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
      { path: "capture",                element: <CaptureTest /> },
      { path: "logo-animation",         element: <LogoAnimation /> },
      { path: "*",                      element: <LoginPage /> },
    ],
  },
];

// ======================= MAIN CONFIG =======================
function ConfigRoutes() {
  const { isLoading, isAuthed, isAdmin, isUser } = useAuth();

  if (isLoading) {
    return useRoutes([{ path: "*", element: <Loader /> }]);
  }

  if (!isAuthed) {
    return useRoutes(MainRoutes());
  }

  if (isAdmin) {
    return useRoutes(AdminRoutes());
  }

  if (isUser) {
    return useRoutes(UserRoutes());
  }

  return useRoutes(MainRoutes());
}

export default ConfigRoutes;
