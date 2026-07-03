import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { GetMe, Logout, type MeResponse, type PermissionMap } from "../services/auth";

type AuthUser = MeResponse;

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthed: boolean;
  /** Derived convenience flag: true when the role can manage User & Role
   *  Management — the closest dynamic equivalent of "is an admin-tier role".
   *  Kept only for the couple of places (maintenance countdown, password
   *  policy self-guard) that just need a quick superuser check. */
  isAdmin: boolean;
  role: string;
  roleId: number;
  permissions: PermissionMap;
  /** can("scan_management", "manage") / can("dashboard", "view") */
  can: (category: string, level: "view" | "manage") => boolean;
  refreshMe: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const hasFetchedInitialRef = useRef(false);
  const isFetchingRef = useRef(false);
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refreshMe = useCallback(async () => {
    if (isFetchingRef.current) return;

    try {
      isFetchingRef.current = true;

      const me = await GetMe();

      if (!isMountedRef.current) return;

      setUser(me);
    } catch (err) {
      console.error("GetMe error:", err);

      if (!isMountedRef.current) return;

      setUser(null);
    } finally {
      isFetchingRef.current = false;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await Logout();
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      if (isMountedRef.current) {
        setUser(null);
      }
    }
  }, []);

  useEffect(() => {
    if (hasFetchedInitialRef.current) return;
    hasFetchedInitialRef.current = true;

    const initAuth = async () => {
      try {
        if (isMountedRef.current) {
          setIsLoading(true);
        }

        await refreshMe();
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    };

    void initAuth();
  }, [refreshMe]);

  // Maintenance mode blocked a request (backend returned 503) — clear the
  // user immediately so route guards redirect to the login page.
  // /auth/logout is public in this app, so no retry loop is needed here;
  // MaintenanceCountdown handles calling it and navigating away.
  useEffect(() => {
    const onMaintenance = () => {
      if (isMountedRef.current) {
        setUser(null);
      }
    };
    window.addEventListener("session:maintenance", onMaintenance);
    return () => window.removeEventListener("session:maintenance", onMaintenance);
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const isAuthed = !!user;
    const role = String(user?.role ?? "").trim().toLowerCase();
    const roleId = user?.role_id ?? 0;
    const permissions = user?.permissions ?? {};

    const can = (category: string, level: "view" | "manage") => {
      const perm = permissions[category];
      if (!perm) return false;
      return level === "manage" ? perm.manage : perm.view;
    };

    const isAdmin = can("user_management", "manage");

    return {
      user,
      isLoading,
      isAuthed,
      isAdmin,
      role,
      roleId,
      permissions,
      can,
      refreshMe,
      logout,
    };
  }, [user, isLoading, refreshMe, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};