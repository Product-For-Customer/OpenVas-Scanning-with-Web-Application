import axios from "axios";
export * from "./auth";
export * from "./user";
export * from "./line";
import { apiUrl } from "./api";

// =======================
// Axios instance for cookie-based auth
// =======================
const vulnerabilityApi = axios.create({
  baseURL: apiUrl,
  withCredentials: true,
  timeout: 60000,
  headers: {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
  },
});

// =======================
// API: GET /tasks/status
// =======================
export type TaskStatusDTO = {
  task_id: string;
  task_name: string;
  mac_address: string;
  status: string;
  count: number;
};

export const ListTaskStatus = async (): Promise<TaskStatusDTO[] | null> => {
  try {
    const response = await vulnerabilityApi.get("/tasks/status");

    console.log("Task status raw response:", response.data);

    if (Array.isArray(response.data)) {
      return response.data as TaskStatusDTO[];
    }

    const data = response.data?.data ?? response.data;

    if (Array.isArray(data)) {
      return data as TaskStatusDTO[];
    }

    console.error("Expected array but got:", response.data);
    return null;
  } catch (error) {
    console.error("ListTaskStatus error:", error);
    return null;
  }
};

// =======================
// API: GET /tasks/summary-vulnerability
// =======================
export type TaskVulnSummaryDTO = {
  task_id: string;
  task_name: string;
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
};

export const ListTaskVulnSummary = async (): Promise<TaskVulnSummaryDTO[] | null> => {
  try {
    const response = await vulnerabilityApi.get("/tasks/summary-vulnerability");

    console.log("TaskVulnSummary raw response:", response.data);

    if (response.status === 200) {
      const data = response.data?.data ?? response.data;
      return Array.isArray(data) ? (data as TaskVulnSummaryDTO[]) : [];
    }

    console.error("Unexpected status:", response.status);
    return null;
  } catch (error) {
    console.error("Error fetching task vulnerability summary:", error);
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

    console.log("ListVulnerability raw response:", response.data);

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

    console.log("ListAssetRisk raw response:", response.data);

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

    console.log("ListDeviceRisk raw response:", response.data);

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

    console.log("ListVulnerabilityDetailByName raw response:", response.data);

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

    console.log("ListVulnerabilityByTaskID raw response:", response.data);

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

    console.log("ListTargetDiffer raw response:", response.data);

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

    console.log("ListVulnerabilityByLevel raw response:", response.data);

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

export default vulnerabilityApi;

