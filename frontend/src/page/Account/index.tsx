import React, { useCallback, useEffect, useMemo, useState } from "react";
import Setting from "./Setting";
import Profile from "./Profile";
import { ListUserByID, type UserResponse } from "../../services";
import { useAuth } from "../../contexts/AuthContext";

const Account: React.FC = () => {
  const auth = useAuth() as any;

  const [user, setUser] = useState<UserResponse | null>(null);
  const [loadingUser, setLoadingUser] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [reloadKey, setReloadKey] = useState<number>(0);

  const currentUserId = useMemo(() => {
    return (
      auth?.user?.id ??
      auth?.me?.id ??
      auth?.profile?.id ??
      auth?.currentUser?.id ??
      auth?.authUser?.id ??
      null
    );
  }, [auth]);

  const authLoading = auth?.isLoading ?? false;
  const isAdmin = auth?.isAdmin ?? false;

  const fetchUser = useCallback(async () => {
    try {
      setLoadingUser(true);
      setError("");

      if (authLoading) return;

      if (!isAdmin) {
        setError("ไม่มีสิทธิ์เข้าถึงข้อมูลโปรไฟล์");
        setUser(null);
        return;
      }

      if (!currentUserId) {
        setError("ไม่พบข้อมูลผู้ใช้งานจากระบบล็อกอิน");
        setUser(null);
        return;
      }

      const result = await ListUserByID(currentUserId);

      if (!result) {
        setError("ไม่พบข้อมูลผู้ใช้งาน");
        setUser(null);
        return;
      }

      setUser(result);
    } catch (err) {
      console.error("Fetch user error:", err);
      setError("เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้งาน");
      setUser(null);
    } finally {
      setLoadingUser(false);
    }
  }, [authLoading, isAdmin, currentUserId]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser, reloadKey]);

  const handleProfileUpdated = () => {
    setReloadKey((prev) => prev + 1);
  };

  if (authLoading || loadingUser) {
    return (
      <div
        className={[
          "rounded-[18px] border p-4 text-[13px]",
          "border-gray-200/80 bg-[#f7f7f8] text-gray-600",
          "dark:border-white/10 dark:bg-white/5 dark:text-white/70",
        ].join(" ")}
      >
        Loading...
      </div>
    );
  }

  if (error || !user) {
    return (
      <div
        className={[
          "rounded-[18px] border p-4 text-[13px]",
          "border-red-200 bg-red-50 text-red-600",
          "dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300",
        ].join(" ")}
      >
        {error || "No Data"}
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 gap-3.5 sm:gap-4 xl:grid-cols-12 items-stretch">
        <div className="xl:col-span-8 h-full">
          <Setting user={user} onUpdated={handleProfileUpdated} />
        </div>

        <div className="xl:col-span-4 h-full">
          <Profile user={user} />
        </div>
      </div>
    </div>
  );
};

export default Account;