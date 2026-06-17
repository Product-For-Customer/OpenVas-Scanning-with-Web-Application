import axios from "axios";
import { apiUrl } from "./api";

const complianceApi = axios.create({
  baseURL: apiUrl,
  withCredentials: true,
  timeout: 30000,
  headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
});

export type ControlStatus = {
  control_id: string;
  control_name: string;
  framework: string;
  status: "compliant" | "warning" | "non_compliant";
  violations: number;
  detail: string;
};

export type FrameworkScore = {
  framework: string;
  full_name: string;
  score: number;
  compliant: number;
  warning: number;
  non_compliant: number;
  total: number;
  controls: ControlStatus[];
};

export type ComplianceReportDTO = {
  generated_at: string;
  frameworks: FrameworkScore[];
  overall_score: number;
  scan_count: number;
  last_scan_date: string;
};

export const GetComplianceReport = async (): Promise<ComplianceReportDTO | null> => {
  try {
    const r = await complianceApi.get("/compliance/report");
    return (r.data?.data ?? r.data) as ComplianceReportDTO;
  } catch (e) {
    console.error("GetComplianceReport error:", e);
    return null;
  }
};

export const GetComplianceViolations = async (framework?: string): Promise<ControlStatus[]> => {
  try {
    const r = await complianceApi.get("/compliance/violations", {
      params: framework ? { framework } : {},
    });
    const d = r.data?.data ?? r.data;
    return Array.isArray(d) ? d : [];
  } catch (e) {
    return [];
  }
};
