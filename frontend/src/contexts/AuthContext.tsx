import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { GetMe, Logout, type MeResponse } from "../services/auth";

type AuthUser = MeResponse;

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthed: boolean;
  isAdmin: boolean;
  isUser: boolean;
  role: string;
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

  const value = useMemo<AuthContextValue>(() => {
    const isAuthed = !!user;
    const role = String(user?.role ?? "").trim().toLowerCase();

    const isAdmin = role === "admin";
    const isUser = role === "user";

    return {
      user,
      isLoading,
      isAuthed,
      isAdmin,
      isUser,
      role,
      refreshMe,
      logout,
    };
  }, [user, isLoading, refreshMe, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};