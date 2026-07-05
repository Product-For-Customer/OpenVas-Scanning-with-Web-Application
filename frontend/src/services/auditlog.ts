import { baseApi } from "./api";

export type AuditLogDTO = {
  id: number;
  actor_id: number;
  actor_email: string;
  actor_role: string;
  action: string;
  target_type: string;
  target_id: string;
  detail: string;
  ip_address: string;
  created_at: string;
};

export type ListAuditLogsParams = {
  action?: string;
  actor_id?: number;
  from?: string; // RFC3339
  to?: string;   // RFC3339
  page?: number;
  page_size?: number;
};

export type ListAuditLogsResponse = {
  data: AuditLogDTO[];
  total: number;
  page: number;
  page_size: number;
};

// Deliberately does NOT catch and fall back to an empty-but-"successful"
// result — this page exists specifically for accountability, so a real fetch
// failure (network error, 401, 500) needs to surface as a visible error to
// the caller instead of rendering identically to "no log entries exist".
export const ListAuditLogs = async (
  params: ListAuditLogsParams = {},
): Promise<ListAuditLogsResponse> => {
  const res = await baseApi.get("/audit-logs", { params });
  return res.data as ListAuditLogsResponse;
};

export type TriggerAuditLogCleanupResponse = {
  message: string;
  deleted_count: number;
  retention_days: number;
};

// POST /audit-logs/cleanup — manually prunes entries older than the
// audit_log_retention_days setting right now, instead of waiting for the
// next daily tick. 400s if retention isn't configured (still "keep forever").
export const TriggerAuditLogCleanup = async (): Promise<TriggerAuditLogCleanupResponse> => {
  const res = await baseApi.post("/audit-logs/cleanup");
  return res.data as TriggerAuditLogCleanupResponse;
};
