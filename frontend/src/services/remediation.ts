import axios from "axios";
import { apiUrl, installMaintenanceInterceptor } from "./api";

// Dedicated axios instance (cookie auth), mirroring the other feature services.
const remediationApi = axios.create({
  baseURL: apiUrl,
  withCredentials: true,
  timeout: 30000,
  headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
});

installMaintenanceInterceptor(remediationApi);

export type RemediationStatus =
  | "open"
  | "in_progress"
  | "fixed_pending_verify"
  | "verified_closed"
  | "risk_accepted"
  | "false_positive"
  | "reopened";

export type RemediationNote = {
  id: number;
  remediation_id: number;
  author_id: number;
  author_name: string;
  body: string;
  kind: "comment" | "status_change" | "system";
  created_at: string;
};

export type Remediation = {
  id: number;
  finding_key: string;
  host_ip: string;
  nvt_oid: string;
  port: string;
  task_id: string;
  task_name: string;
  vuln_name: string;
  family: string;
  cve_list: string;
  severity: number;
  risk_score: number;
  risk_level: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  is_kev: boolean;
  epss_score: number;
  solution_text: string;
  solution_type: string;
  fix_method: string;
  status: RemediationStatus;
  assigned_to: number | null;
  assigned_name: string;
  due_date: string | null;
  first_detected_at: string;
  last_seen_at: string;
  last_report_id: string;
  fixed_at: string | null;
  verified_at: string | null;
  verified_report_id: string;
  mttr_hours: number | null;
  reopen_count: number;
  created_at: string;
  updated_at: string;
  notes?: RemediationNote[];
};

export type RemediationSummary = {
  total: number;
  open: number;
  in_progress: number;
  fixed_pending_verify: number;
  verified_closed: number;
  risk_accepted: number;
  false_positive: number;
  reopened: number;
  active_total: number;
  overdue: number;
  due_soon: number;
  critical_open: number;
  high_open: number;
  avg_mttr_hours: number;
  verified_last_30d: number;
  opened_last_30d: number;
  generated_at: string;
};

export type RemediationFilters = {
  status?: string;
  active?: boolean;
  risk_level?: string;
  host?: string;
  assigned?: "me" | "unassigned";
  q?: string;
};

export const GetRemediations = async (
  filters: RemediationFilters = {}
): Promise<Remediation[] | null> => {
  try {
    const params: Record<string, string> = {};
    if (filters.status) params.status = filters.status;
    if (filters.active) params.active = "true";
    if (filters.risk_level) params.risk_level = filters.risk_level;
    if (filters.host) params.host = filters.host;
    if (filters.assigned) params.assigned = filters.assigned;
    if (filters.q) params.q = filters.q;

    const r = await remediationApi.get("/remediations", { params });
    const d = r.data?.data ?? r.data;
    return Array.isArray(d) ? (d as Remediation[]) : [];
  } catch (e) {
    console.error("GetRemediations error:", e);
    return null;
  }
};

export const GetRemediationSummary = async (): Promise<RemediationSummary | null> => {
  try {
    const r = await remediationApi.get("/remediations/summary");
    return (r.data?.data ?? r.data) as RemediationSummary;
  } catch (e) {
    console.error("GetRemediationSummary error:", e);
    return null;
  }
};

export const GetRemediation = async (id: number): Promise<Remediation | null> => {
  try {
    const r = await remediationApi.get(`/remediations/${id}`);
    return (r.data?.data ?? r.data) as Remediation;
  } catch (e) {
    console.error("GetRemediation error:", e);
    return null;
  }
};

export type RemediationUpdate = {
  status?: RemediationStatus;
  fix_method?: string;
  assign?: "me" | "clear";
};

export const UpdateRemediation = async (
  id: number,
  body: RemediationUpdate
): Promise<Remediation | null> => {
  try {
    const r = await remediationApi.patch(`/remediations/${id}`, body);
    return (r.data?.data ?? r.data) as Remediation;
  } catch (e) {
    console.error("UpdateRemediation error:", e);
    return null;
  }
};

export const AddRemediationNote = async (
  id: number,
  body: string
): Promise<RemediationNote | null> => {
  try {
    const r = await remediationApi.post(`/remediations/${id}/notes`, { body });
    return (r.data?.data ?? r.data) as RemediationNote;
  } catch (e) {
    console.error("AddRemediationNote error:", e);
    return null;
  }
};

export const TriggerRemediationSync = async (): Promise<number | null> => {
  try {
    const r = await remediationApi.post("/remediations/sync");
    return Number(r.data?.changed ?? 0);
  } catch (e) {
    console.error("TriggerRemediationSync error:", e);
    return null;
  }
};

// ── Phase 2: remediation plan + re-scan ────────────────────────────────────

export type PlanRef = { label: string; url: string };

export type RemediationPlan = {
  method: string;        // patch | config | network_control | credential | certificate | compensating
  kind: "command" | "guidance";
  language: string;      // powershell | bash | cisco | text
  command: string;       // populated when kind === "command"
  guidance: string;      // populated when kind === "guidance"
  steps: string[];
  impact: string;
  affected: string;
  fixed_version: string;
  references: PlanRef[];
  compensating: string[]; // network-level mitigations if you can't patch yet
  source: string;        // playbook:<id> | scanner-solution
};

// Endpoint path stays /fix-script for compatibility; it now returns the richer
// remediation plan.
export const GetRemediationPlan = async (id: number): Promise<RemediationPlan | null> => {
  try {
    const r = await remediationApi.get(`/remediations/${id}/fix-script`);
    return (r.data?.data ?? r.data) as RemediationPlan;
  } catch (e) {
    console.error("GetRemediationPlan error:", e);
    return null;
  }
};

// Returns the started report id, or null on failure (e.g. gvmd unreachable /
// scan already running). Callers should surface a friendly error on null.
export const RescanRemediation = async (id: number): Promise<string | null> => {
  try {
    const r = await remediationApi.post(`/remediations/${id}/rescan`);
    return String(r.data?.report_id ?? "");
  } catch (e) {
    console.error("RescanRemediation error:", e);
    return null;
  }
};
