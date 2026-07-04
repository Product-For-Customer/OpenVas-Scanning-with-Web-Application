import axios from "axios";
import { apiUrl } from "./api";

// =======================
// Axios instance for cookie-based auth
// =======================
const remediationApi = axios.create({
  baseURL: apiUrl,
  withCredentials: true,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
  },
});

// =======================
// Types
// =======================
export type RemediationStatus =
  | "open"
  | "in_progress"
  | "fixed"
  | "risk_accepted"
  | "false_positive";

export type RemediationOwner = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
};

export type RemediationTicket = {
  id: number;
  task_id: string;
  host_ip: string;
  nvt_oid: string;
  vuln_name: string;
  severity: number;
  status: RemediationStatus;
  owner_user_id: number | null;
  owner: RemediationOwner | null;
  due_date: string | null;
  notes: string;
  created_by_id: number;
  created_at: string;
  updated_at: string;
};

export type RemediationSummary = {
  total: number;
  by_status: Record<RemediationStatus, number>;
  overdue_count: number;
};

export type CreateRemediationTicketInput = {
  task_id?: string;
  host_ip: string;
  nvt_oid?: string;
  vuln_name: string;
  severity?: number;
  status?: RemediationStatus;
  owner_user_id?: number | null;
  due_date?: string | null; // RFC3339
  notes?: string;
};

export type UpdateRemediationTicketInput = {
  status?: RemediationStatus;
  owner_user_id?: number | null;
  due_date?: string | null;
  notes?: string;
  severity?: number;
};

export type RemediationTicketFilters = {
  status?: RemediationStatus;
  host_ip?: string;
  task_id?: string;
  owner_user_id?: number;
};

// =======================
// APIs
// =======================

// GET /remediation-tickets
export const ListRemediationTickets = async (
  filters?: RemediationTicketFilters
): Promise<RemediationTicket[] | null> => {
  try {
    const response = await remediationApi.get("/remediation-tickets", { params: filters });
    const data = response.data?.data ?? response.data;
    if (Array.isArray(data)) {
      return data as RemediationTicket[];
    }
    console.error("Expected remediation ticket array but got:", response.data);
    return null;
  } catch (error) {
    console.error("ListRemediationTickets error:", error);
    return null;
  }
};

// GET /remediation-tickets/summary
export const GetRemediationSummary = async (): Promise<RemediationSummary | null> => {
  try {
    const response = await remediationApi.get("/remediation-tickets/summary");
    const data = response.data?.data ?? response.data;
    if (data && typeof data === "object") {
      return data as RemediationSummary;
    }
    return null;
  } catch (error) {
    console.error("GetRemediationSummary error:", error);
    return null;
  }
};

// POST /remediation-tickets
export const CreateRemediationTicket = async (
  payload: CreateRemediationTicketInput
): Promise<RemediationTicket | null> => {
  try {
    const response = await remediationApi.post("/remediation-tickets", payload);
    const data = response.data?.data ?? response.data;
    if (data && typeof data === "object") {
      return data as RemediationTicket;
    }
    console.error("Unexpected CreateRemediationTicket response:", response.data);
    return null;
  } catch (error) {
    console.error("CreateRemediationTicket error:", error);
    return null;
  }
};

// PATCH /remediation-tickets/:id
export const UpdateRemediationTicket = async (
  id: number | string,
  payload: UpdateRemediationTicketInput
): Promise<RemediationTicket | null> => {
  try {
    const response = await remediationApi.patch(`/remediation-tickets/${id}`, payload);
    const data = response.data?.data ?? response.data;
    if (data && typeof data === "object") {
      return data as RemediationTicket;
    }
    console.error("Unexpected UpdateRemediationTicket response:", response.data);
    return null;
  } catch (error) {
    console.error("UpdateRemediationTicket error:", error);
    return null;
  }
};

// DELETE /remediation-tickets/:id
export const DeleteRemediationTicket = async (
  id: number | string
): Promise<{ message: string } | null> => {
  try {
    const response = await remediationApi.delete(`/remediation-tickets/${id}`);
    if (response.data && response.data.message) {
      return { message: String(response.data.message) };
    }
    return null;
  } catch (error) {
    console.error("DeleteRemediationTicket error:", error);
    return null;
  }
};
