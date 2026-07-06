import { baseApi } from "./api";

export type WebScanTargetDTO = {
  id: number;
  name: string;
  url: string;
  description: string;
  // The cookie itself is never returned by the backend (write-only) —
  // this just tells the UI whether one is configured, so it can show an
  // "Authenticated" indicator without ever seeing the actual value.
  has_auth_cookie: boolean;
  created_at: string;
  updated_at: string;
};

export type WebScanTargetInput = {
  name: string;
  url: string;
  description: string;
  // Optional. On update, an empty string means "leave the existing cookie
  // unchanged" — there's no separate clear action, matching how the Gmail
  // app-password field elsewhere in this app treats a blank edit.
  auth_cookie: string;
};

export type ScanType = "baseline" | "full";

export type WebScanResultDTO = {
  id: number;
  target_id: number;
  scan_type: ScanType;
  status: "spidering" | "active_scanning" | "completed" | "failed" | "stopped";
  spider_progress: number;
  active_progress: number;
  high: number;
  medium: number;
  low: number;
  informational: number;
  error_message: string;
  started_at: string;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WebScanStatusDTO = {
  is_running: boolean;
  data?: WebScanResultDTO;
};

export type WebScanFindingDTO = {
  id: number;
  result_id: number;
  alert_name: string;
  risk: "High" | "Medium" | "Low" | "Informational";
  confidence: string;
  url: string;
  param: string;
  method: string;
  description: string;
  solution: string;
  attack: string;
  other_info: string;
  cwe_id: string;
  wasc_id: string;
  alert_ref: string;
  plugin_id: string;
  // Newline-separated list of external reference URLs, as returned by ZAP.
  reference: string;
  // JSON-encoded object (e.g. {"OWASP_2021_A03":"https://..."}) — parse with
  // JSON.parse before use; falls back to "{}" server-side data can't produce
  // invalid JSON but older rows created before this field existed may be "".
  tags: string;
  evidence: string;
  created_at: string;
};

// ===== Targets =====

export const ListWebScanTargets = async (): Promise<WebScanTargetDTO[]> => {
  try {
    const res = await baseApi.get("/webscan/targets");
    const data = res.data?.data ?? [];
    return Array.isArray(data) ? (data as WebScanTargetDTO[]) : [];
  } catch (e) {
    console.error("ListWebScanTargets error:", e);
    return [];
  }
};

// Create/Update/Delete/trigger/stop are left to throw (no try/catch) so the
// caller can surface the backend's real error message, matching the
// convention used by services/discovery.ts and services/feedschedule.ts.
export const CreateWebScanTarget = async (input: WebScanTargetInput): Promise<WebScanTargetDTO> => {
  const res = await baseApi.post("/webscan/targets", input);
  return (res.data?.data ?? res.data) as WebScanTargetDTO;
};

export const UpdateWebScanTarget = async (id: number, input: WebScanTargetInput): Promise<WebScanTargetDTO> => {
  const res = await baseApi.patch(`/webscan/targets/${id}`, input);
  return (res.data?.data ?? res.data) as WebScanTargetDTO;
};

export const DeleteWebScanTarget = async (id: number): Promise<void> => {
  await baseApi.delete(`/webscan/targets/${id}`);
};

// ===== Scan lifecycle =====

export const TriggerWebScan = async (
  targetId: number,
  scanType: ScanType,
  confirmActiveScan: boolean
): Promise<WebScanResultDTO> => {
  const res = await baseApi.post(`/webscan/targets/${targetId}/scan`, {
    scan_type: scanType,
    confirm_active_scan: confirmActiveScan,
  });
  return (res.data?.data ?? res.data) as WebScanResultDTO;
};

export const GetWebScanStatus = async (): Promise<WebScanStatusDTO | null> => {
  try {
    const res = await baseApi.get("/webscan/status");
    return res.data as WebScanStatusDTO;
  } catch (e) {
    console.error("GetWebScanStatus error:", e);
    return null;
  }
};

export const StopWebScan = async (): Promise<void> => {
  await baseApi.post("/webscan/stop");
};

// ===== Results & findings =====

export const ListWebScanResults = async (targetId?: number): Promise<WebScanResultDTO[]> => {
  try {
    const res = await baseApi.get("/webscan/results", {
      params: targetId ? { target_id: targetId } : undefined,
    });
    const data = res.data?.data ?? [];
    return Array.isArray(data) ? (data as WebScanResultDTO[]) : [];
  } catch (e) {
    console.error("ListWebScanResults error:", e);
    return [];
  }
};

export const ListWebScanFindings = async (resultId: number): Promise<WebScanFindingDTO[]> => {
  try {
    const res = await baseApi.get(`/webscan/results/${resultId}/findings`);
    const data = res.data?.data ?? [];
    return Array.isArray(data) ? (data as WebScanFindingDTO[]) : [];
  } catch (e) {
    console.error("ListWebScanFindings error:", e);
    return [];
  }
};
