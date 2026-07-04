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

export const ListAuditLogs = async (
  params: ListAuditLogsParams = {},
): Promise<ListAuditLogsResponse> => {
  try {
    const res = await baseApi.get("/audit-logs", { params });
    return res.data as ListAuditLogsResponse;
  } catch (e) {
    console.error("ListAuditLogs error:", e);
    return { data: [], total: 0, page: 1, page_size: 50 };
  }
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
