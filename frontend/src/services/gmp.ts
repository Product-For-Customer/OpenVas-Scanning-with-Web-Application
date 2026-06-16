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
  target_id: string;
  target_name: string;
  config_id: string;
  config_name: string;
  scanner_id: string;
  scanner_name: string;
  last_report_at: string;
  severity: number;
  report_count: number;
};

export type GMPTargetDTO = {
  id: string;
  name: string;
  hosts: string;
  comment: string;
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

export type CreateTargetRequest = {
  name: string;
  hosts: string;
  comment?: string;
};

export type CreateTaskRequest = {
  name: string;
  target_id: string;
  config_id: string;
  scanner_id?: string;
  comment?: string;
};

// ===========================
// GMP API
// ===========================

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

export const DeleteGMPTarget = async (targetId: string): Promise<void> => {
  await gmpApi.delete(`/gmp/targets/${targetId}`);
};

// ===========================
// Status helpers
// ===========================

export const getTaskStatusColor = (status: string): string => {
  switch (status?.toLowerCase()) {
    case "running":
      return "text-cyan-600 dark:text-cyan-300";
    case "done":
      return "text-emerald-600 dark:text-emerald-300";
    case "stopped":
    case "interrupted":
      return "text-orange-600 dark:text-orange-300";
    case "new":
      return "text-sky-600 dark:text-sky-300";
    default:
      return "text-gray-500 dark:text-white/55";
  }
};

export const getTaskStatusBg = (status: string): string => {
  switch (status?.toLowerCase()) {
    case "running":
      return "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-500/20";
    case "done":
      return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20";
    case "stopped":
    case "interrupted":
      return "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:border-orange-500/20";
    case "new":
      return "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/20";
    default:
      return "bg-gray-50 text-gray-600 border-gray-200 dark:bg-white/5 dark:text-white/55 dark:border-white/10";
  }
};
