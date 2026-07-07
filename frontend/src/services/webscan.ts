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
  // Same write-only treatment for a bearer/Authorization header.
  has_auth_header: boolean;
  // OpenAPI/Swagger spec URL imported before spidering (not a secret).
  openapi_url: string;
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
  // Optional bearer/Authorization header value (e.g. "Bearer eyJ..."); same
  // "empty on update = leave unchanged" convention as auth_cookie.
  auth_header?: string;
  // Optional OpenAPI/Swagger spec URL. Unlike the secrets above, sending an
  // empty string CLEARS it.
  openapi_url?: string;
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
  // ── B-2/B-3 data captured alongside the ZAP scan ──
  // security_grade is "" when not computed; the *_json fields hold the full
  // HTTPAuditResult / FingerprintResult (see services/scaninsights.ts types)
  // as JSON strings, "" when absent. Parse defensively.
  security_grade: string;
  security_score: number;
  http_audit_json: string;
  fingerprint_json: string;
  eol_warnings: number;
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

// Left to throw so the caller can surface the backend's error (e.g. a 409 when
// trying to delete a still-running scan).
export const DeleteWebScanResult = async (id: number): Promise<void> => {
  await baseApi.delete(`/webscan/results/${id}`);
};

// ── Header/TLS grade + technology fingerprint types ──────────────────────
// Captured alongside each ZAP scan (stored on WebScanResultDTO as the
// http_audit_json / fingerprint_json string columns) and parsed by the Scan
// History detail on the Scan Application page.

export type HeaderCheck = {
  name: string;
  present: boolean;
  good: boolean;
  value: string;
  weight: number;
  advice: string;
};

export type TLSInfo = {
  enabled: boolean;
  version: string;
  cipher_suite: string;
  cert_subject: string;
  cert_issuer: string;
  not_after: string;
  days_until_expiry: number;
  warnings: string[];
};

export type HTTPAuditResult = {
  target_id: number;
  url: string;
  final_url: string;
  status_code: number;
  scheme: string;
  grade: string; // A..F
  score: number; // 0..100
  max_score: number;
  checks: HeaderCheck[];
  tls: TLSInfo;
  checked_at: string;
};

export type EOLStatus = {
  product: string;
  cycle: string;
  is_eol: boolean;
  eol_date: string;
  latest: string;
  note: string;
};

export type DetectedTech = {
  name: string;
  version: string;
  categories: string[];
  source: string;
  eol?: EOLStatus;
};

export type FingerprintResult = {
  target_id: number;
  url: string;
  final_url: string;
  technologies: DetectedTech[];
  eol_warnings: number;
  checked_at: string;
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
