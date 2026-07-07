import { baseApi } from "./api";

// Auto-Report Digest: scheduled generation of the executive PDF report,
// delivered to email or LINE on a weekly / monthly / yearly cadence.

export type DigestChannel = "email" | "line";
export type DigestFrequency = "weekly" | "monthly" | "yearly";

export type ReportDigestDTO = {
  id: number;
  name: string;
  channel: DigestChannel;
  frequency: DigestFrequency;
  hour: number;
  minute: number;
  day_of_week: number; // 0=Sun..6=Sat (weekly)
  day_of_month: number; // 1-31 (monthly)
  month: number; // 1-12 (yearly)
  day: number; // 1-31 (yearly)
  timezone: string;
  email_to: string; // comma-separated
  line_notification_ids: string; // comma-separated app_notification ids
  enabled: boolean;
  last_run_at: string | null;
  last_status: string; // "", "ok", "failed"
  last_error: string;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ReportDigestInput = {
  name: string;
  channel: DigestChannel;
  frequency: DigestFrequency;
  hour: number;
  minute: number;
  day_of_week: number;
  day_of_month: number;
  month: number;
  day: number;
  timezone: string;
  email_to: string;
  line_notification_ids: string;
  enabled: boolean;
};

export const ListReportDigests = async (): Promise<ReportDigestDTO[]> => {
  try {
    const res = await baseApi.get("/report-digests");
    const data = res.data?.data ?? [];
    return Array.isArray(data) ? (data as ReportDigestDTO[]) : [];
  } catch (e) {
    console.error("ListReportDigests error:", e);
    return [];
  }
};

// Create/Update/Delete/Run are left to throw so callers surface the backend error.
export const CreateReportDigest = async (input: ReportDigestInput): Promise<ReportDigestDTO> => {
  const res = await baseApi.post("/report-digests", input);
  return (res.data?.data ?? res.data) as ReportDigestDTO;
};

export const UpdateReportDigest = async (id: number, input: ReportDigestInput): Promise<ReportDigestDTO> => {
  const res = await baseApi.patch(`/report-digests/${id}`, input);
  return (res.data?.data ?? res.data) as ReportDigestDTO;
};

export const DeleteReportDigest = async (id: number): Promise<void> => {
  await baseApi.delete(`/report-digests/${id}`);
};

// Send this digest right now (synchronous — resolves after it's actually sent).
export const RunReportDigestNow = async (id: number): Promise<void> => {
  await baseApi.post(`/report-digests/${id}/run`);
};
