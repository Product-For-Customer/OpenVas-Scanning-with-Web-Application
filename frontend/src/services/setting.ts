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
