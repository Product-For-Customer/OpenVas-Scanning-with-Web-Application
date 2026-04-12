import { lazy } from "react";
import { Navigate, useRoutes, type RouteObject } from "react-router-dom";
import Loadable from "../component/third-patry/Loadable";
import { useAuth } from "../contexts/AuthContext";

// ===== Admin Pages =====
const Dashboard = Loadable(lazy(() => import("../page/dashboard/index")));
const Account = Loadable(lazy(() => import("../page/Account/index")));
const Target = Loadable(lazy(() => import("../page/target/index")));
const LineNotification = Loadable(lazy(() => import("../page/line/index")));
const User = Loadable(lazy(() => import("../page/user/index")));
const MainLayout = Loadable(lazy(() => import("../component/admin/MainLayout")));
const Service = Loadable(lazy(() => import("../component/admin/Service")));
const VulnerabilityByDevice = Loadable(lazy(() => import("../page/target/RiskScoreTable/vulnerability/index")));
const VulnerabilityByLevel = Loadable(lazy(() => import("../page/dashboard/only/vulnerability")));
const Vulnerability = Loadable(lazy(() => import("../page/vulnerability/index")));
const VulnerabilityDetail = Loadable(lazy(() => import("../page/vulnerability/List/Detail/index")));
const Report = Loadable(lazy(() => import("../page/report/index")));

// ===== Login Pages =====
const SignIn = Loadable(lazy(() => import("../page/Authentication/Signin/index")));
const Forget = Loadable(lazy(() => import("../page/Authentication/Forget/index")));
const Reset = Loadable(lazy(() => import("../page/Authentication/Reset/index")));
const Loader = Loadable(lazy(() => import("../component/third-patry/Loader")));


//====== Test Captuer ======
const CaptureTest = Loadable(lazy(() => import("../page/report/CaptureTest")));
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
      { path: "report", element: <Report /> }
    ],
  },
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
      { path: "vulnerability", element: <Vulnerability /> },
      { path: "vulnerability-by-device", element: <VulnerabilityByDevice /> },
      { path: "vulnerability-detail", element: <VulnerabilityDetail /> },
      { path: "vulnerability-by-level", element: <VulnerabilityByLevel /> },
      { path: "service", element: <Service /> },

      // กัน user เข้าหน้าที่ไม่อนุญาต
      { path: "line notification", element: <Navigate to="/admin" replace /> },
      { path: "user", element: <Navigate to="/admin" replace /> },
    ],
  },
  { path: "*", element: <Navigate to="/admin" replace /> },
];

const MainRoutes = (): RouteObject[] => [
  {
    path: "/",
    children: [
      { index: true, element: <SignIn /> },
      { path: "loader", element: <Loader /> },
      { path: "forgot-password", element: <Forget /> },
      { path: "reset-password", element: <Reset /> },
      { path: "capture", element: <CaptureTest /> },
      { path: "*", element: <SignIn /> },
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