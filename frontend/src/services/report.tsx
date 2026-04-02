import axios from "axios";
import { apiUrl } from "./api";

// =======================
// Axios instance for PUBLIC report endpoints
// ไม่ส่ง cookie / credential
// =======================
export const publicReportApi = axios.create({
  baseURL: apiUrl,
  withCredentials: false,
  timeout: 120000,
  headers: {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
  },
});

// =======================
// Axios instance for PROTECTED report endpoints
// ส่ง cookie / credential
// =======================
export const protectedReportApi = axios.create({
  baseURL: apiUrl,
  withCredentials: true,
  timeout: 120000,
  headers: {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
  },
});

// =======================
// Types: GET /tasks/summary-vulnerability
// =======================
export type TaskVulnSummaryForReportResponse = {
  task_id: string;
  task_name: string;
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
};

// =======================
// API: GET /summary-vulnerability-report
// Public route: no login required
// =======================
export const ListTaskVulnSummaryForReport = async (): Promise<
  TaskVulnSummaryForReportResponse[] | null
> => {
  try {
    const response = await publicReportApi.get("/summary-vulnerability-report");

    if (Array.isArray(response.data)) {
      return response.data as TaskVulnSummaryForReportResponse[];
    }

    const data = response.data?.data ?? response.data;

    if (Array.isArray(data)) {
      return data as TaskVulnSummaryForReportResponse[];
    }

    console.error(
      "Expected array but got in ListTaskVulnSummaryForReport:",
      response.data
    );
    return null;
  } catch (error) {
    console.error("ListTaskVulnSummaryForReport error:", error);
    return null;
  }
};

// =======================
// Types: GET /critical-report
// =======================
export type CriticalForReportResponse = {
  task_name: string;
  ip: string;
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

// =======================
// API: GET /critical-report
// Public route: no login required
// Optional query:
//   - task_id
//   - limit
// =======================
export const ListCriticalForReport = async (
  taskID?: string | number,
  limit?: string | number
): Promise<CriticalForReportResponse[] | null> => {
  try {
    const params: Record<string, string | number> = {};

    if (taskID !== undefined && taskID !== null && `${taskID}`.trim() !== "") {
      params.task_id = taskID;
    }

    if (limit !== undefined && limit !== null && `${limit}`.trim() !== "") {
      params.limit = limit;
    }

    const response = await publicReportApi.get("/critical-report", {
      params,
    });

    if (Array.isArray(response.data)) {
      return response.data as CriticalForReportResponse[];
    }

    const data = response.data?.data ?? response.data;

    if (Array.isArray(data)) {
      return data as CriticalForReportResponse[];
    }

    console.error(
      "Expected array but got in ListCriticalForReport:",
      response.data
    );
    return null;
  } catch (error) {
    console.error("ListCriticalForReport error:", error);
    return null;
  }
};

// =======================
// Types: GET /devices/risk-report
// =======================
export type DeviceRiskForReportDTO = {
  task_id: string;
  task_name: string;
  ip_address: string;
  firmware_version: string;
  risk_score: number;
  vulnerability_total: number;
};

// =======================
// API: GET /devices/risk-report
// Public route: no login required
// =======================
export const ListDeviceRiskForReport = async (): Promise<
  DeviceRiskForReportDTO[] | null
> => {
  try {
    const response = await publicReportApi.get("/devices/risk-report");

    if (Array.isArray(response.data)) {
      return response.data as DeviceRiskForReportDTO[];
    }

    const data = response.data?.data ?? response.data;

    if (Array.isArray(data)) {
      return data as DeviceRiskForReportDTO[];
    }

    console.error(
      "Expected array but got in ListDeviceRiskForReport:",
      response.data
    );
    return null;
  } catch (error) {
    console.error("ListDeviceRiskForReport error:", error);
    return null;
  }
};

// =======================
// Types: GET /target-differ-report
// =======================
export type TargetDifferForReportDTO = {
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

// =======================
// API: GET /target-differ-report
// Public route: no login required
// =======================
export const ListTargetDifferForReport = async (): Promise<
  TargetDifferForReportDTO[] | null
> => {
  try {
    const response = await publicReportApi.get("/target-differ-report");

    if (Array.isArray(response.data)) {
      return response.data as TargetDifferForReportDTO[];
    }

    const data = response.data?.data ?? response.data;

    if (Array.isArray(data)) {
      return data as TargetDifferForReportDTO[];
    }

    console.error(
      "Expected array but got in ListTargetDifferForReport:",
      response.data
    );
    return null;
  } catch (error) {
    console.error("ListTargetDifferForReport error:", error);
    return null;
  }
};

// =======================
// Types: AppReport
// =======================
export type AppReportResponse = {
  id: number;
  company_name: string;
  logo: string;
  created_at: string;
  updated_at: string;
  message?: string;
  error?: string;
};

export type UpdateAppReportInput = {
  company_name?: string;
  logo?: string;
};

// =======================
// Types: Send PDF To LINE
// =======================
export type SendPDFToLineResponse = {
  message: string;
  file_path?: string;
  public_url?: string;

  sent_notification_ids?: number[];
  sent_targets?: string[];

  failed_notification_ids?: number[];
  failed_targets?: string[];

  error?: string;
};

// =======================
// API: GET /app-report
// ใช้ publicReportApi
// =======================
export const ListAppReport = async (): Promise<AppReportResponse | null> => {
  try {
    const response = await publicReportApi.get("/app-report");

    if (response.data && typeof response.data === "object") {
      return response.data as AppReportResponse;
    }

    console.error("Unexpected ListAppReport response:", response.data);
    return null;
  } catch (error) {
    console.error("ListAppReport error:", error);
    return null;
  }
};

// =======================
// API: PUT /app-report/:id
// ใช้ credential
// =======================
export const UpdateAppReportByID = async (
  id: number | string,
  payload: UpdateAppReportInput
): Promise<AppReportResponse | null> => {
  try {
    const response = await protectedReportApi.put(`/app-report/${id}`, payload);

    if (response.data && typeof response.data === "object") {
      return response.data as AppReportResponse;
    }

    console.error("Unexpected UpdateAppReportByID response:", response.data);
    return null;
  } catch (error) {
    console.error("UpdateAppReportByID error:", error);
    return null;
  }
};

// =======================
// API: GET /send-pdf-to-line
// public route
// รองรับ pdf และ app_notification_id หลายตัว
// =======================
export const SendPDFToLine = async (
  pdf?: string,
  appNotificationIDs?: number[]
): Promise<SendPDFToLineResponse | null> => {
  try {
    const params: Record<string, string> = {};

    if (pdf && pdf.trim() !== "") {
      params.pdf = pdf.trim();
    }

    if (appNotificationIDs && appNotificationIDs.length > 0) {
      const normalizedIDs = appNotificationIDs
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0);

      if (normalizedIDs.length > 0) {
        params.app_notification_id = normalizedIDs.join(",");
      }
    }

    const response = await publicReportApi.get("/send-pdf-to-line", {
      params,
    });

    if (response.data && typeof response.data === "object") {
      return response.data as SendPDFToLineResponse;
    }

    console.error("Unexpected SendPDFToLine response:", response.data);
    return null;
  } catch (error) {
    console.error("SendPDFToLine error:", error);
    return null;
  }
};

// =======================
// API: GET /download-pdf
// public route
// ใช้โหลดไฟล์ PDF ลงเครื่อง
// =======================
export const DownloadPDFFile = async (pdf?: string): Promise<void> => {
  const params: Record<string, string> = {};

  if (pdf && pdf.trim() !== "") {
    params.pdf = pdf;
  }

  const response = await publicReportApi.get("/download-pdf", {
    params,
    responseType: "blob",
  });

  const contentType = response.headers["content-type"] || "application/pdf";
  const blob = new Blob([response.data], { type: contentType });

  let fileName = "report_capture.pdf";
  const disposition = response.headers["content-disposition"];

  if (disposition) {
    const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    const asciiMatch = disposition.match(/filename="?([^"]+)"?/i);

    if (utf8Match?.[1]) {
      fileName = decodeURIComponent(utf8Match[1]);
    } else if (asciiMatch?.[1]) {
      fileName = asciiMatch[1];
    }
  }

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

const reportService = {
  ListTaskVulnSummaryForReport,
  ListCriticalForReport,
  ListDeviceRiskForReport,
  ListTargetDifferForReport,
  ListAppReport,
  UpdateAppReportByID,
  SendPDFToLine,
  DownloadPDFFile,
};

export default reportService;