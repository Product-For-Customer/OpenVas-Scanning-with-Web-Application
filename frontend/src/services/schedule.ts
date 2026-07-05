import axios from "axios";
import { apiUrl, installMaintenanceInterceptor } from "./api";

const scheduleApi = axios.create({
  baseURL: apiUrl,
  withCredentials: true,
  timeout: 15000,
  headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
});

installMaintenanceInterceptor(scheduleApi);

// ── Types ──────────────────────────────────────────────────────────────────

export type ScheduleFrequency = "once" | "monthly" | "yearly";

export type AutoScanScheduleDTO = {
  id: number;
  task_id: string;
  task_name: string;
  frequency: ScheduleFrequency;
  scan_time: string;          // "HH:mm"
  timezone: string;           // IANA timezone, e.g. "Asia/Bangkok"
  schedule_at?: string;       // "YYYY-MM-DD" — for once
  day_of_month?: number;      // 1-31 — for monthly
  month?: number;             // 1-12 — for yearly
  day?: number;               // 1-31 — for yearly
  enabled: boolean;
  last_run_at?: string;       // ISO
  next_run_at?: string;       // ISO
  created_at: string;
};

export type CreateScheduleRequest = {
  task_id: string;
  task_name: string;
  frequency: ScheduleFrequency;
  scan_time: string;
  timezone: string;           // IANA timezone, e.g. "Asia/Bangkok"
  schedule_at?: string;
  day_of_month?: number;
  month?: number;
  day?: number;
};

// ── API calls ──────────────────────────────────────────────────────────────

export const ListScanSchedules = async (): Promise<AutoScanScheduleDTO[]> => {
  try {
    const res = await scheduleApi.get("/scan-schedules");
    const data = res.data?.data ?? res.data;
    return Array.isArray(data) ? (data as AutoScanScheduleDTO[]) : [];
  } catch (err) {
    console.error("ListScanSchedules error:", err);
    return [];
  }
};

export const CreateScanSchedule = async (
  req: CreateScheduleRequest,
): Promise<AutoScanScheduleDTO> => {
  const res = await scheduleApi.post("/scan-schedules", req);
  return res.data as AutoScanScheduleDTO;
};

export const UpdateScanSchedule = async (
  id: number,
  enabled: boolean,
): Promise<AutoScanScheduleDTO> => {
  const res = await scheduleApi.patch(`/scan-schedules/${id}`, { enabled });
  return res.data as AutoScanScheduleDTO;
};

export const DeleteScanSchedule = async (id: number): Promise<void> => {
  await scheduleApi.delete(`/scan-schedules/${id}`);
};
