import axios from "axios";
import { apiUrl } from "./api";

// =======================
// Axios instance for PUBLIC report endpoints
// ไม่ส่ง cookie / credential
// =======================
const publicReportApi = axios.create({
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
const protectedReportApi = axios.create({
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
// Optional query:
//   - task_id
// รองรับทั้ง "ALL", "123", "123,456"
// =======================
export const ListTaskVulnSummaryForReport = async (
  taskID?: string | number | Array<string | number>
): Promise<TaskVulnSummaryForReportResponse[] | null> => {
  try {
    const params: Record<string, string> = {};

    if (Array.isArray(taskID)) {
      const normalized = taskID
        .map((id) => String(id).trim())
        .filter((id) => id !== "");

      if (normalized.length > 0) {
        params.task_id = normalized.join(",");
      }
    } else if (
      taskID !== undefined &&
      taskID !== null &&
      String(taskID).trim() !== ""
    ) {
      params.task_id = String(taskID).trim();
    }

    const response = await publicReportApi.get("/summary-vulnerability-report", {
      params,
    });

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
  task_id: string;
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
// รองรับทั้งค่าเดียว และหลายค่า เช่น "1,2,3"
// =======================
export const ListCriticalForReport = async (
  taskID?: string | number | Array<string | number>,
  limit?: string | number
): Promise<CriticalForReportResponse[] | null> => {
  try {
    const params: Record<string, string | number> = {};

    if (Array.isArray(taskID)) {
      const normalized = taskID
        .map((id) => String(id).trim())
        .filter((id) => id !== "");

      if (normalized.length > 0) {
        params.task_id = normalized.join(",");
      }
    } else if (
      taskID !== undefined &&
      taskID !== null &&
      `${taskID}`.trim() !== ""
    ) {
      params.task_id = String(taskID).trim();
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
// Optional query:
//   - task_id
// รองรับทั้ง "1" และ "1,2,3"
// =======================
export const ListDeviceRiskForReport = async (
  taskID?: string | number | Array<string | number>
): Promise<DeviceRiskForReportDTO[] | null> => {
  try {
    const params: Record<string, string> = {};

    if (Array.isArray(taskID)) {
      const normalized = taskID
        .map((id) => String(id).trim())
        .filter((id) => id !== "");

      if (normalized.length > 0) {
        params.task_id = normalized.join(",");
      }
    } else if (
      taskID !== undefined &&
      taskID !== null &&
      `${taskID}`.trim() !== ""
    ) {
      params.task_id = String(taskID).trim();
    }

    const response = await publicReportApi.get("/devices/risk-report", {
      params,
    });

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
// Optional query:
//   - task_id
// รองรับทั้ง "1" และ "1,2,3"
// =======================
export const ListTargetDifferForReport = async (
  taskID?: string | number | Array<string | number>
): Promise<TargetDifferForReportDTO[] | null> => {
  try {
    const params: Record<string, string> = {};

    if (Array.isArray(taskID)) {
      const normalized = taskID
        .map((id) => String(id).trim())
        .filter((id) => id !== "");

      if (normalized.length > 0) {
        params.task_id = normalized.join(",");
      }
    } else if (
      taskID !== undefined &&
      taskID !== null &&
      `${taskID}`.trim() !== ""
    ) {
      params.task_id = String(taskID).trim();
    }

    const response = await publicReportApi.get("/target-differ-report", {
      params,
    });

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
// Types: GET /report/vulnerability-month
// =======================
export type ReportVulnerabilityMonthResponse = {
  task_id: string;
  task_name: string;
  ip: string;
  month: string;
  month_no: number;
  vulnerability: number;
  risk_score: number;
};

// =======================
// API: GET /report/vulnerability-month
// Public route: no login required
// =======================
export const ListDataForReportVulnerabilityMonth = async (
  selectedTaskIDs?: string[]
): Promise<ReportVulnerabilityMonthResponse[] | null> => {
  try {
    const normalizedTaskIDs = Array.isArray(selectedTaskIDs)
      ? selectedTaskIDs
          .map((id) => String(id).trim())
          .filter((id) => id !== "")
      : [];

    const params =
      normalizedTaskIDs.length > 0
        ? {
            task_ids: normalizedTaskIDs.join(","),
          }
        : undefined;

    const response = await publicReportApi.get("/report/vulnerability-month", {
      params,
    });

    if (Array.isArray(response.data)) {
      return response.data as ReportVulnerabilityMonthResponse[];
    }

    const data = response.data?.data ?? response.data;

    if (Array.isArray(data)) {
      return data as ReportVulnerabilityMonthResponse[];
    }

    console.error(
      "Expected array but got in ListDataForReportVulnerabilityMonth:",
      response.data
    );
    return null;
  } catch (error) {
    console.error("ListDataForReportVulnerabilityMonth error:", error);
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

const normalizeTaskIDs = (taskIDs?: Array<string | number>): string[] => {
  if (!Array.isArray(taskIDs)) return [];

  return taskIDs
    .map((id) => String(id).trim())
    .filter((id) => id !== "");
};

// =======================
// API: GET /send-pdf-to-line
// public route
// รองรับ pdf, app_notification_id, task_id
// =======================
export const SendPDFToLine = async (
  pdf?: string,
  appNotificationIDs?: number[],
  taskIDs?: Array<string | number>
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

    const normalizedTaskIDs = normalizeTaskIDs(taskIDs);
    if (normalizedTaskIDs.length > 0) {
      params.task_id = normalizedTaskIDs.join(",");
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
// รองรับ pdf และ task_id
// =======================
export const DownloadPDFFile = async (
  pdf?: string,
  taskIDs?: Array<string | number>
): Promise<void> => {
  const params: Record<string, string> = {};

  if (pdf && pdf.trim() !== "") {
    params.pdf = pdf.trim();
  }

  const normalizedTaskIDs = normalizeTaskIDs(taskIDs);
  if (normalizedTaskIDs.length > 0) {
    params.task_id = normalizedTaskIDs.join(",");
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

// =======================
// API: GET /send-pdf-to-email  (protected — sends PDF to current user's email)
// =======================
export const SendPDFToEmail = async (
  taskIDs?: Array<string | number>
): Promise<{ message: string; email: string }> => {
  const params: Record<string, string> = {};
  const normalized = normalizeTaskIDs(taskIDs);
  if (normalized.length > 0) {
    params.task_id = normalized.join(",");
  }
  const response = await protectedReportApi.get("/send-pdf-to-email", { params });
  return response.data as { message: string; email: string };
};

