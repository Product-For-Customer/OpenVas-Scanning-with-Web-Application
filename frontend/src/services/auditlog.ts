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
