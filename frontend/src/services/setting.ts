import { baseApi } from "./api";

export const GetAppSettings = async (): Promise<Record<string, string>> => {
  try {
    const res = await baseApi.get("/settings");
    return (res.data as Record<string, string>) ?? {};
  } catch {
    return {};
  }
};

export const UpdateAppSetting = async (key: string, value: string): Promise<void> => {
  await baseApi.put("/settings", { key, value });
};

export type PublicMaintenanceStatus = {
  enabled: boolean;
  seconds_remaining: number;
};

// Public — no auth required. Returns current maintenance state + seconds
// until the middleware starts blocking (0 means already blocking).
// Polled by MaintenanceCountdown to drive the auto-logout modal.
export const GetPublicMaintenanceStatus = async (): Promise<PublicMaintenanceStatus> => {
  try {
    const res = await baseApi.get("/maintenance/status");
    return (res.data as PublicMaintenanceStatus) ?? { enabled: false, seconds_remaining: 0 };
  } catch {
    return { enabled: false, seconds_remaining: 0 };
  }
};
