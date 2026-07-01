import axios from "axios";
import { apiUrl } from "./api";

const gmpApi = axios.create({
  baseURL: apiUrl,
  withCredentials: true,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
  },
});

// ===========================
// GMP Types
// ===========================

export type GMPStatusResponse = {
  connected: boolean;
  version: string;
  error?: string;
};

export type GMPTaskDTO = {
  id: string;
  name: string;
  comment: string;
  status: string;
  progress: number;
  alterable: boolean;
  target_id: string;
  target_name: string;
  config_id: string;
  config_name: string;
  scanner_id: string;
  scanner_name: string;
  last_report_at: string;
  severity: number;
  report_count: number;
  // Advanced OpenVAS preferences
  apply_overrides?: boolean;
  min_qod?: number;
  max_checks?: number;
  max_hosts?: number;
  auto_delete?: string;
  auto_delete_data?: number;
};

export type GMPTargetDTO = {
  id: string;
  name: string;
  hosts: string;
  exclude_hosts: string;
  comment: string;
  max_hosts: number;
  alive_test: string;
  multiple_ips: boolean;
  reverse_lookup_only: boolean;
  reverse_lookup_unify: boolean;
  port_list_id: string;
  port_list_name: string;
  ssh_cred_id: string;
  ssh_cred_name: string;
  ssh_cred_port: string;
  smb_cred_id: string;
  smb_cred_name: string;
  esxi_cred_id: string;
  esxi_cred_name: string;
  snmp_cred_id: string;
  snmp_cred_name: string;
};

export type GMPScannerDTO = {
  id: string;
  name: string;
  type: number;
};

export type GMPConfigDTO = {
  id: string;
  name: string;
};

export type GMPFeedDTO = {
  type: string;
  name: string;
  version: string;
  description: string;
  currently_syncing: boolean;
  status: string;
};

// ── Port Lists ────────────────────────────────────────────────
export type GMPPortListDTO = {
  id: string;
  name: string;
  comment: string;
  total: number;
  tcp: number;
  udp: number;
};

export type CreatePortListRequest = {
  name: string;
  comment?: string;
  port_range: string; // e.g. "T:1-5,7,9,U:1-3,5,7,9"
};

// ── Credentials ───────────────────────────────────────────────
export type GMPCredentialType = "up" | "usk" | "snmp" | "smime" | "pgp" | "pw" | "cc";

export const CREDENTIAL_TYPE_LABELS: Record<GMPCredentialType, string> = {
  up:    "Username + Password",
  usk:   "Username + SSH Key",
  snmp:  "SNMP",
  smime: "S/MIME Certificate",
  pgp:   "PGP Encryption Key",
  pw:    "Password only",
  cc:    "Client Certificate",
};

export type GMPCredentialDTO = {
  id: string;
  name: string;
  type: GMPCredentialType;
  login: string;
  comment: string;
};

export type CreateCredentialRequest = {
  name: string;
  comment?: string;
  type: GMPCredentialType;
  auto_generate?: boolean;
  // up / usk
  login?: string;
  password?: string;
  // usk
  private_key?: string;
  passphrase?: string;
  // snmp
  community?: string;
  auth_algorithm?: string;    // md5 | sha1
  privacy_algorithm?: string; // aes | des | none
  privacy_password?: string;
  // smime
  certificate?: string;
  // pgp
  public_pgp_key?: string;
  // cc
  cc_private_key?: string;
  cc_passphrase?: string;
};

export type CreateTargetRequest = {
  name: string;
  hosts: string;
  comment?: string;
  exclude_hosts?: string;
  port_list_id?: string;
  alive_test?: string;
  multiple_ips?: boolean;
  ssh_cred_id?: string;
  ssh_port?: string;
  smb_cred_id?: string;
  esxi_cred_id?: string;
  snmp_cred_id?: string;
  reverse_lookup?: boolean;
  reverse_unify?: boolean;
};

export type CreateTaskRequest = {
  name: string;
  target_id: string;
  config_id: string;
  scanner_id?: string;
  comment?: string;
  apply_overrides?: boolean;
  min_qod?: number;
  alterable?: boolean;
  add_assets?: boolean;
  auto_delete?: "no" | "keep";
  auto_delete_data?: number;
  max_checks?: number;
  max_hosts?: number;
};

// ===========================
// GMP API
// ===========================

// ── Port List API ─────────────────────────────────────────────
export const ListGMPPortLists = async (): Promise<GMPPortListDTO[]> => {
  try {
    const res = await gmpApi.get("/gmp/port-lists");
    const data = res.data?.data ?? res.data;
    return Array.isArray(data) ? (data as GMPPortListDTO[]) : [];
  } catch (e) { console.error("ListGMPPortLists error:", e); return []; }
};

export type GMPPortRangeDTO = {
  id: string;
  start: number;
  end: number;
  protocol: "tcp" | "udp";
  comment?: string;
};

export type GMPPortListDetailDTO = GMPPortListDTO & {
  port_ranges: GMPPortRangeDTO[];
};

export const CreateGMPPortList = async (req: CreatePortListRequest): Promise<{ id: string }> => {
  const res = await gmpApi.post("/gmp/port-lists", req);
  return res.data;
};

export const GetGMPPortListDetail = async (id: string): Promise<GMPPortListDetailDTO> => {
  const res = await gmpApi.get(`/gmp/port-lists/${id}`);
  const data = res.data as GMPPortListDetailDTO;
  return { ...data, port_ranges: Array.isArray(data.port_ranges) ? data.port_ranges : [] };
};

export const CreateGMPPortRange = async (
  portListId: string,
  req: { start: number; end: number; protocol: "tcp" | "udp"; comment?: string },
): Promise<{ id: string }> => {
  const res = await gmpApi.post(`/gmp/port-lists/${portListId}/ranges`, req);
  return res.data as { id: string };
};

export const DeleteGMPPortRange = async (portListId: string, rangeId: string): Promise<void> => {
  await gmpApi.delete(`/gmp/port-lists/${portListId}/ranges/${rangeId}`);
};

export const DeleteGMPPortList = async (id: string): Promise<void> => {
  await gmpApi.delete(`/gmp/port-lists/${id}`);
};

export const UpdateGMPPortList = async (id: string, req: { name: string; comment?: string }): Promise<void> => {
  await gmpApi.patch(`/gmp/port-lists/${id}`, req);
};

export const UpdateGMPCredential = async (id: string, req: CreateCredentialRequest): Promise<void> => {
  await gmpApi.patch(`/gmp/credentials/${id}`, req);
};

export const UpdateGMPTarget = async (id: string, req: CreateTargetRequest): Promise<void> => {
  await gmpApi.patch(`/gmp/targets/${id}`, req);
};

export const ImportGMPPortList = async (file: File): Promise<{ id: string }> => {
  const formData = new FormData();
  formData.append("file", file);
  const res = await axios.post(`${apiUrl}/gmp/port-lists/import`, formData, {
    withCredentials: true,
    headers: { "ngrok-skip-browser-warning": "true" },
    timeout: 30000,
  });
  return res.data as { id: string };
};

// ── Credential API ────────────────────────────────────────────
export const ListGMPCredentials = async (): Promise<GMPCredentialDTO[]> => {
  try {
    const res = await gmpApi.get("/gmp/credentials");
    const data = res.data?.data ?? res.data;
    return Array.isArray(data) ? (data as GMPCredentialDTO[]) : [];
  } catch (e) { console.error("ListGMPCredentials error:", e); return []; }
};

export const CreateGMPCredential = async (req: CreateCredentialRequest): Promise<{ id: string }> => {
  const res = await gmpApi.post("/gmp/credentials", req);
  return res.data;
};

export const DeleteGMPCredential = async (id: string): Promise<void> => {
  await gmpApi.delete(`/gmp/credentials/${id}`);
};

// ── Trash / Recycle Bin ───────────────────────────────────────
export type GMPTrashDTO = {
  tasks:       GMPTaskDTO[];
  targets:     GMPTargetDTO[];
  credentials: GMPCredentialDTO[];
  port_lists:  GMPPortListDTO[];
  warnings?:   string[];
};

export const GetGMPTrash = async (): Promise<GMPTrashDTO> => {
  const res = await gmpApi.get("/gmp/trash");
  return res.data as GMPTrashDTO;
};

export const RestoreGMPTrash = async (id: string): Promise<void> => {
  await gmpApi.post(`/gmp/trash/restore/${id}`);
};

export const EmptyGMPTrash = async (): Promise<void> => {
  await gmpApi.delete("/gmp/trash");
};

export const DeleteGMPTrashTask       = async (id: string): Promise<void> => { await gmpApi.delete(`/gmp/trash/task/${id}`); };
export const DeleteGMPTrashTarget     = async (id: string): Promise<void> => { await gmpApi.delete(`/gmp/trash/target/${id}`); };
export const DeleteGMPTrashCredential = async (id: string): Promise<void> => { await gmpApi.delete(`/gmp/trash/credential/${id}`); };
export const DeleteGMPTrashPortList   = async (id: string): Promise<void> => { await gmpApi.delete(`/gmp/trash/portlist/${id}`); };

export const GetGMPFeeds = async (): Promise<GMPFeedDTO[]> => {
  try {
    const response = await gmpApi.get("/gmp/feeds");
    const data = response.data?.data ?? response.data;
    return Array.isArray(data) ? (data as GMPFeedDTO[]) : [];
  } catch (err) {
    console.error("GetGMPFeeds error:", err);
    return [];
  }
};

export const GetGMPStatus = async (): Promise<GMPStatusResponse> => {
  try {
    const response = await gmpApi.get("/gmp/status");
    return response.data as GMPStatusResponse;
  } catch {
    return { connected: false, version: "", error: "Cannot reach backend" };
  }
};

export const ListGMPTasks = async (): Promise<GMPTaskDTO[]> => {
  try {
    const response = await gmpApi.get("/gmp/tasks");
    const data = response.data?.data ?? response.data;
    return Array.isArray(data) ? (data as GMPTaskDTO[]) : [];
  } catch (error) {
    console.error("ListGMPTasks error:", error);
    throw error;
  }
};

export const ListGMPTargets = async (): Promise<GMPTargetDTO[]> => {
  try {
    const response = await gmpApi.get("/gmp/targets");
    const data = response.data?.data ?? response.data;
    return Array.isArray(data) ? (data as GMPTargetDTO[]) : [];
  } catch (error) {
    console.error("ListGMPTargets error:", error);
    throw error;
  }
};

export const ListGMPScanners = async (): Promise<GMPScannerDTO[]> => {
  try {
    const response = await gmpApi.get("/gmp/scanners");
    const data = response.data?.data ?? response.data;
    return Array.isArray(data) ? (data as GMPScannerDTO[]) : [];
  } catch (error) {
    console.error("ListGMPScanners error:", error);
    return [];
  }
};

export const ListGMPConfigs = async (): Promise<GMPConfigDTO[]> => {
  try {
    const response = await gmpApi.get("/gmp/configs");
    const data = response.data?.data ?? response.data;
    return Array.isArray(data) ? (data as GMPConfigDTO[]) : [];
  } catch (error) {
    console.error("ListGMPConfigs error:", error);
    return [];
  }
};

export const CreateGMPTarget = async (
  req: CreateTargetRequest
): Promise<{ id: string; message: string }> => {
  const response = await gmpApi.post("/gmp/targets", req);
  return response.data;
};

export const CreateGMPTask = async (
  req: CreateTaskRequest
): Promise<{ id: string; message: string }> => {
  const response = await gmpApi.post("/gmp/tasks", req);
  return response.data;
};

export const StartGMPTask = async (
  taskId: string
): Promise<{ message: string; report_id: string }> => {
  const response = await gmpApi.post(`/gmp/tasks/${taskId}/start`);
  return response.data;
};

export const StopGMPTask = async (taskId: string): Promise<void> => {
  await gmpApi.post(`/gmp/tasks/${taskId}/stop`);
};

export const DeleteGMPTask = async (taskId: string): Promise<void> => {
  await gmpApi.delete(`/gmp/tasks/${taskId}`);
};

export type UpdateTaskRequest = {
  name: string;
  comment?: string;
  // Editable when task is New or Alterable
  target_id?: string;
  config_id?: string;
  scanner_id?: string;
  alterable?: boolean;
  add_assets?: boolean;
  // Always editable
  apply_overrides?: boolean;
  min_qod?: number;
  max_checks?: number;
  max_hosts?: number;
  auto_delete?: "no" | "keep";
  auto_delete_data?: number;
};

export const UpdateGMPTask = async (taskId: string, req: UpdateTaskRequest): Promise<void> => {
  await gmpApi.patch(`/gmp/tasks/${taskId}`, req);
};

export const DeleteGMPTarget = async (targetId: string): Promise<void> => {
  await gmpApi.delete(`/gmp/targets/${targetId}`);
};

// ===========================
// Status helpers
// ===========================

export const getTaskStatusBg = (status: string): string => {
  switch (status?.toLowerCase()) {
    case "running":
      return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20";
    case "done":
      return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20";
    case "stopped":
    case "interrupted":
      return "bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/20";
    case "new":
      return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20";
    case "requested":
    case "stop requested":
      return "bg-slate-50 text-slate-600 border-slate-200 dark:bg-white/5 dark:text-white/50 dark:border-white/10";
    default:
      return "bg-gray-50 text-gray-500 border-gray-200 dark:bg-white/5 dark:text-white/45 dark:border-white/10";
  }
};
