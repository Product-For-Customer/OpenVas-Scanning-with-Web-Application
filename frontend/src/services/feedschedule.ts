import axios from "axios";
import { apiUrl, installMaintenanceInterceptor } from "./api";

const api = axios.create({
  baseURL: apiUrl,
  withCredentials: true,
  timeout: 30000,
  headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
});

installMaintenanceInterceptor(api);

// ── Types ──────────────────────────────────────────────────────────────────

export type FeedType = "openvas" | "kev" | "epss" | "exploit";
export type FeedFrequency = "daily" | "monthly" | "yearly";

export type FeedScheduleDTO = {
  id: number;
  feed_type: FeedType;
  frequency: FeedFrequency;
  hour: number;       // 0-23
  minute: number;     // 0-59
  day_of_month: number; // 1-31  (monthly)
  month: number;        // 1-12  (yearly)
  day: number;          // 1-31  (yearly)
  enabled: boolean;
  last_run_at?: string;
  next_run_at?: string;
};

export type UpdateFeedScheduleRequest = {
  frequency?: FeedFrequency;
  hour?: number;
  minute?: number;
  day_of_month?: number;
  month?: number;
  day?: number;
  enabled?: boolean;
};

// ── API ─────────────────────────────────────────────────────────────────────

export const ListFeedSchedules = async (): Promise<FeedScheduleDTO[]> => {
  try {
    const res = await api.get("/feed-schedules");
    const data = res.data?.data ?? res.data;
    return Array.isArray(data) ? (data as FeedScheduleDTO[]) : [];
  } catch (e) {
    console.error("ListFeedSchedules error:", e);
    return [];
  }
};

export const UpdateFeedSchedule = async (
  feedType: FeedType,
  req: UpdateFeedScheduleRequest,
): Promise<FeedScheduleDTO> => {
  const res = await api.put(`/feed-schedules/${feedType}`, req);
  return res.data as FeedScheduleDTO;
};

export const TriggerFeedNow = async (feedType: FeedType): Promise<void> => {
  await api.post(`/feed-schedules/${feedType}/trigger`);
};
