import { lazy } from "react";
import { Navigate, useRoutes, type RouteObject } from "react-router-dom";
import Loadable from "../component/load/Loadable";
import { useAuth } from "../contexts/AuthContext";

// ===== Admin Pages =====
const Dashboard = Loadable(lazy(() => import("../page/Dashboard/index")));
const Account = Loadable(lazy(() => import("../page/Account/index")));
const Target = Loadable(lazy(() => import("../page/Target/index")));
const StatusTargetData = Loadable(lazy(() => import("../page/Target/Status/data/index")));
const LineNotification = Loadable(lazy(() => import("../page/Line/index")));
const User = Loadable(lazy(() => import("../page/User/index")));
const MainLayout = Loadable(lazy(() => import("../component/structure/MainLayout")));
const Service = Loadable(lazy(() => import("../component/structure/navbar/Service")));
const VulnerabilityByDevice = Loadable(lazy(() => import("../page/Target/TableTarget/vulnerability/index")));
const VulnerabilityByLevel = Loadable(lazy(() => import("../page/Dashboard/Description/vulnerability")));
const Vulnerability = Loadable(lazy(() => import("../page/Vulnerability/index")));
const VulnerabilityDetail = Loadable(lazy(() => import("../page/Vulnerability/List/Detail/index")));
const Report = Loadable(lazy(() => import("../page/Report/index")));
const Diagram = Loadable(lazy(() => import("../page/Diagram/index")));
const DiagramNode = Loadable(lazy(() => import("../page/Diagram/Node/index")));
const ThreatIntelligence = Loadable(lazy(() => import("../page/ThreatIntelligence/index")));
const ThreatIntelligenceDetail = Loadable(lazy(() => import("../page/ThreatIntelligence/Detail/index")));
const ScanManagement = Loadable(lazy(() => import("../page/ScanManagement/index")));

// ===== Login Pages =====
const Authentication = Loadable(lazy(() => import("../page/Authentication/index")));
const Loader = Loadable(lazy(() => import("../component/load/Loader")));


//====== Test Captuer ======
const CaptureTest = Loadable(lazy(() => import("../page/Report/capture")));
const LogoAnimation = Loadable(lazy(() => import("../page/Authentication/animation/index")));
// ======================= ROUTES =======================

// Admin เห็นทุกหน้า
const AdminRoutes = (): RouteObject[] => [
  {
    path: "/",
    element: <Navigate to="/admin" replace />,
  },
  {
    path: "/admin",
    element: <MainLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "dashboard", element: <Dashboard /> },
      { path: "profile", element: <Account /> },
      { path: "target", element: <Target /> },
      { path: "vulnerability", element: <Vulnerability /> },
      { path: "line notification", element: <LineNotification /> },
      { path: "vulnerability-by-device", element: <VulnerabilityByDevice /> },
      { path: "vulnerability-by-level", element: <VulnerabilityByLevel /> },
      { path: "user", element: <User /> },
      { path: "vulnerability-detail", element: <VulnerabilityDetail /> },
      { path: "service", element: <Service /> },
      { path: "report", element: <Report /> },
      { path: "diagrams", element: <Diagram /> },
      { path: "diagram-node", element: <DiagramNode /> },
      { path: "status-target-data", element: <StatusTargetData /> },
      { path: "threat-intelligence", element: <ThreatIntelligence /> },
      { path: "threat-intelligence/detail/:hostIp", element: <ThreatIntelligenceDetail /> },
      { path: "scan-management", element: <ScanManagement /> },
    ],
  },
  { path: "logo-animation", element: <LogoAnimation/> },
  { path: "*", element: <Navigate to="/admin" replace /> },
];

// User เห็นเฉพาะบางหน้า
const UserRoutes = (): RouteObject[] => [
  {
    path: "/",
    element: <Navigate to="/admin" replace />,
  },
  {
    path: "/admin",
    element: <MainLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "dashboard", element: <Dashboard /> },
      { path: "profile", element: <Account /> },
      { path: "target", element: <Target /> },
      { path: "status-target-data", element: <StatusTargetData /> },
      { path: "vulnerability", element: <Vulnerability /> },
      { path: "vulnerability-by-device", element: <VulnerabilityByDevice /> },
      { path: "vulnerability-detail", element: <VulnerabilityDetail /> },
      { path: "vulnerability-by-level", element: <VulnerabilityByLevel /> },
      { path: "diagrams", element: <Diagram /> },
      { path: "diagram-node", element: <DiagramNode /> },
    ],
  },
  { path: "*", element: <Navigate to="/admin" replace /> },
];

const MainRoutes = (): RouteObject[] => [
  {
    path: "/",
    children: [
      { index: true, element: <Authentication /> },
      { path: "capture", element: <CaptureTest /> },
      { path: "*", element: <Authentication /> },
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