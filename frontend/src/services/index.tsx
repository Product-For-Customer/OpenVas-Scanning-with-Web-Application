import axios from "axios";
export * from "./auth";
export * from "./user";
export * from "./line";
export * from "./threat";
export * from "./gmp";
export * from "./compliance";
export * from "./schedule";
export * from "./setting";
import { apiUrl } from "./api";

// =======================
// Axios instance for cookie-based auth
// =======================
const vulnerabilityApi = axios.create({
  baseURL: apiUrl,
  withCredentials: true,
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
  },
});

// =======================
// API: GET /tasks/status
// Route Backend: authorized.GET("/tasks/status", vulnerability.ListStatus)
// =======================

export type TaskStatusValue = "Done" | "Running" | "New" | "Stopped" | string;

export type TaskSeverityLevel =
  | "Log"
  | "Low"
  | "Medium"
  | "High"
  | "Critical"
  | string;

export type TaskTrendDirection = "up" | "down" | "same" | "none" | string;

export type TaskStatusDTO = {
  task_id: string;
  task_name: string;
  target_name: string;
  target_hosts: string;
  mac_address: string;

  status: TaskStatusValue;
  count: number;

  reports: number;
  last_report_at: string;
  last_report_at_unix: number;

  severity_score: number;
  severity_level: TaskSeverityLevel;

  trend_direction: TaskTrendDirection;
  trend_delta: number;
};

const toStringSafe = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  return String(value);
};

const toNumberSafe = (value: unknown): number => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
};

const normalizeTaskStatus = (item: Partial<TaskStatusDTO>): TaskStatusDTO => {
  return {
    task_id: toStringSafe(item.task_id),
    task_name: toStringSafe(item.task_name),
    target_name: toStringSafe(item.target_name),
    target_hosts: toStringSafe(item.target_hosts),
    mac_address: toStringSafe(item.mac_address),

    status: toStringSafe(item.status),
    count: toNumberSafe(item.count),

    reports: toNumberSafe(item.reports),
    last_report_at: toStringSafe(item.last_report_at),
    last_report_at_unix: toNumberSafe(item.last_report_at_unix),

    severity_score: toNumberSafe(item.severity_score),
    severity_level: toStringSafe(item.severity_level),

    trend_direction: toStringSafe(item.trend_direction),
    trend_delta: toNumberSafe(item.trend_delta),
  };
};

export const ListTaskStatus = async (): Promise<TaskStatusDTO[] | null> => {
  try {
    const response = await vulnerabilityApi.get("/tasks/status");

    const rawData = Array.isArray(response.data)
      ? response.data
      : Array.isArray(response.data?.data)
        ? response.data.data
        : null;

    if (!rawData) {
      console.error("ListTaskStatus expected array but got:", response.data);
      return null;
    }

    return rawData.map((item : any) => normalizeTaskStatus(item));
  } catch (error) {
    console.error("ListTaskStatus error:", error);
    return null;
  }
};

// =======================
// API: GET /vulnerabilities/list
// =======================
export type VulnerabilityLevelDTO = {
  vulnerability_id: string;
  task_id: string;
  task_name: string;
  host_ip: string;
  port: string;
  vulnerability_family: string;
  vulnerability_name: string;
  level: "Critical" | "High" | "Medium" | "Low" | "Info";
  severity: number;
  total: number;
  detected_time: string;
};

export const ListVulnerability = async (): Promise<VulnerabilityLevelDTO[] | null> => {
  try {
    const response = await vulnerabilityApi.get("/vulnerabilities/list");


    if (response.status === 200) {
      const data = response.data?.data ?? response.data;
      return Array.isArray(data) ? (data as VulnerabilityLevelDTO[]) : [];
    }

    console.error("Unexpected status:", response.status);
    return null;
  } catch (error) {
    console.error("Error fetching vulnerabilities list:", error);
    return null;
  }
};

// =======================
// API: GET /assets/risk
// =======================
export type AssetRiskDTO = {
  task_id: string;
  task_name: string;
  host_ip: string;
  detected_date: string;
  aging_day: number;
  vulnerability_total: number;
  risk_score: number;
};

export const ListAssetRisk = async (): Promise<AssetRiskDTO[] | null> => {
  try {
    const response = await vulnerabilityApi.get("/assets/risk");

    if (response.status === 200) {
      const data = response.data?.data ?? response.data;
      return Array.isArray(data) ? (data as AssetRiskDTO[]) : [];
    }

    console.error("Unexpected status:", response.status);
    return null;
  } catch (error) {
    console.error("Error fetching asset risk list:", error);
    return null;
  }
};

// =======================
// API: GET /devices/risk
// =======================
export type DeviceRiskDTO = {
  task_id: string;
  task_name: string;
  ip_address: string;
  firmware_version: string;
  risk_score: number;
  vulnerability_total: number;
};

export const ListDeviceRisk = async (): Promise<DeviceRiskDTO[] | null> => {
  try {
    const response = await vulnerabilityApi.get("/devices/risk");

    if (response.status === 200) {
      const data = response.data?.data ?? response.data;
      return Array.isArray(data) ? (data as DeviceRiskDTO[]) : [];
    }

    console.error("Unexpected status:", response.status);
    return null;
  } catch (error) {
    console.error("Error fetching device risk list:", error);
    return null;
  }
};

// =======================
// API: GET /vulnerabilities/detail/by-name
// =======================
export type VulnerabilityDetailDTO = {
  task_name: string;
  vulnerability_id: string;
  vulnerability_name: string;
  detected_date: string;
  severity: number;
  cve_list: string;
  summary: string;
  impact: string;
  affected: string;
  insight: string;
  solution: string;
  solution_type: string;
};

export const ListVulnerabilityDetailByName = async (
  task_id: string,
  name: string
): Promise<VulnerabilityDetailDTO[] | null> => {
  try {
    const response = await vulnerabilityApi.get("/vulnerabilities/detail/by-name", {
      params: { task_id, name },
    });

    if (response.status === 200) {
      const data = response.data?.data ?? response.data;
      return Array.isArray(data) ? (data as VulnerabilityDetailDTO[]) : [];
    }

    console.error("Unexpected status:", response.status);
    return null;
  } catch (error) {
    console.error("Error fetching vulnerability detail:", error);
    return null;
  }
};

// =======================
// DTO: /vulnerabilities/:task_id
// =======================
export type VulnerabilityByTaskIDDTO = {
  vulnerability_id: string;
  task_id: string;
  task_name: string;
  host_ip: string;
  port: string;
  vulnerability_family: string;
  vulnerability_name: string;
  level: "Critical" | "High" | "Medium" | "Low" | "Info";
  total: number;
  detected_time: string;
};

// =======================
// API: GET /vulnerabilities/:task_id
// =======================
export const ListVulnerabilityByTaskID = async (
  taskID: string
): Promise<VulnerabilityByTaskIDDTO[] | null> => {
  try {
    if (!taskID || !taskID.trim()) {
      console.error("taskID is required");
      return [];
    }

    const response = await vulnerabilityApi.get(
      `/vulnerabilities/${encodeURIComponent(taskID.trim())}`
    );

    if (response.status === 200) {
      const data = response.data?.data ?? response.data;
      return Array.isArray(data) ? (data as VulnerabilityByTaskIDDTO[]) : [];
    }

    console.error("Unexpected status:", response.status);
    return null;
  } catch (error) {
    console.error(`Error fetching vulnerabilities by task ID (${taskID}):`, error);
    return null;
  }
};

// =======================
// API: GET /target-differ
// =======================
export type TargetDifferDTO = {
  host: string;
  task_name: string;

  latest_task_id: string;
  latest_report_id: number;
  latest_creation_time: number | null;
  latest_total: number;
  latest_critical: number;
  latest_high: number;
  latest_medium: number;
  latest_low: number;
  latest_info: number;
  latest_risk_score: number;

  previous_task_id: string | null;
  previous_report_id: number | null;
  previous_creation_time: number | null;
  previous_total: number | null;
  previous_critical: number | null;
  previous_high: number | null;
  previous_medium: number | null;
  previous_low: number | null;
  previous_info: number | null;
  previous_risk_score: number | null;

  previous_version_status: string;

  diff_total: number | null;
  diff_critical: number | null;
  diff_high: number | null;
  diff_medium: number | null;
  diff_low: number | null;
  diff_info: number | null;
  diff_risk_score: number | null;
};

export const ListTargetDiffer = async (): Promise<TargetDifferDTO[] | null> => {
  try {
    const response = await vulnerabilityApi.get("/target-differ");

    if (response.status === 200) {
      const data = response.data?.data ?? response.data;
      return Array.isArray(data) ? (data as TargetDifferDTO[]) : [];
    }

    console.error("Unexpected status:", response.status);
    return null;
  } catch (error) {
    console.error("Error fetching target differ list:", error);
    return null;
  }
};

// =======================
// API: GET /vulnerabilities/level/:level
// =======================
export type VulnerabilityByLevelDTO = {
  vulnerability_id: string;
  task_id: string;
  task_name: string;
  host_ip: string;
  port: string;
  vulnerability_family: string;
  vulnerability_name: string;
  level: string;
  total: number;
  detected_time: string;
};

export const ListVulnerabilityByLevel = async (
  level: "Critical" | "High" | "Medium" | "Low" | "Info"
): Promise<VulnerabilityByLevelDTO[] | null> => {
  try {
    const response = await vulnerabilityApi.get(`/vulnerabilities/level/${level}`);

    if (Array.isArray(response.data)) {
      return response.data as VulnerabilityByLevelDTO[];
    }

    const data = response.data?.data ?? response.data;

    if (Array.isArray(data)) {
      return data as VulnerabilityByLevelDTO[];
    }

    console.error("Expected array but got:", response.data);
    return null;
  } catch (error) {
    console.error("ListVulnerabilityByLevel error:", error);
    return null;
  }
};

// =======================
// DTO: /reports/all/:task_id
// =======================
export type AllReportByTaskIDDTO = {
  task_id: string;
  task_name: string;
  detected_date: number;
  host_ip: string;
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  risk_score: number;
};

// =======================
// API: GET /reports/all/:task_id
// =======================
export const ListALLReportByTaskID = async (
  taskID: string
): Promise<AllReportByTaskIDDTO[] | null> => {
  try {
    if (!taskID || !taskID.trim()) {
      console.error("taskID is required");
      return [];
    }

    const response = await vulnerabilityApi.get(
      `/reports/all/${encodeURIComponent(taskID.trim())}`
    );

    if (response.status === 200) {
      const data = response.data?.data ?? response.data;
      return Array.isArray(data) ? (data as AllReportByTaskIDDTO[]) : [];
    }

    console.error("Unexpected status:", response.status);
    return null;
  } catch (error) {
    console.error(`Error fetching all reports by task ID (${taskID}):`, error);
    return null;
  }
};

// =======================
// DTO: /all-targets
// =======================
export type AllTargetDTO = {
  task_id: string;
  name: string;
  ip: string;
  detected_date: string;
  aging_day: number;
  risk_score: number;
  level: string;
  total: number;
  severity: number;
};

// =======================
// API: GET /all-targets
// =======================
export const ListALLTarget = async (): Promise<AllTargetDTO[] | null> => {
  try {
    const response = await vulnerabilityApi.get("/all-targets");

    if (response.status === 200) {
      const rawData = response.data?.data ?? response.data;

      if (!Array.isArray(rawData)) return [];

      return rawData.map((item: any): AllTargetDTO => ({
        task_id: String(item?.task_id ?? ""),
        name: String(item?.name ?? ""),
        ip: String(item?.ip ?? ""),
        detected_date: String(item?.detected_date ?? ""),
        aging_day: Number(item?.aging_day ?? 0),
        risk_score: Number(item?.risk_score ?? 0),
        level: String(item?.level ?? ""),
        total: Number(item?.total ?? 0),
        severity: Number(item?.severity ?? 0),
      }));
    }

    console.error("Unexpected status:", response.status);
    return null;
  } catch (error) {
    console.error("Error fetching all targets:", error);
    return null;
  }
};

export default vulnerabilityApi;

