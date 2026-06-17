import axios from "axios";
import { apiUrl } from "./api";

const riskApi = axios.create({
  baseURL: apiUrl,
  withCredentials: true,
  timeout: 60000,
  headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
});

export type RiskLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type RiskScoreDTO = {
  host_ip: string;
  task_name: string;
  cve_id: string;
  vuln_name: string;
  cvss_score: number;
  epss_score: number;
  epss_percentile: number;
  is_kev: boolean;
  is_ransomware: boolean;
  asset_criticality: string;
  criticality_score: number;
  risk_score: number;
  risk_level: RiskLevel;
};

export type RiskSummaryDTO = {
  total_items: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  top_risks: RiskScoreDTO[];
  last_calculated: string;
};

export type AssetCriticalityDTO = {
  id: number;
  host_ip: string;
  criticality: "crown_jewel" | "high" | "medium" | "low";
  criticality_score: number;
  asset_type: "server" | "database" | "network" | "workstation" | "iot" | "web";
  owner: string;
  business_impact: string;
  created_at: string;
  updated_at: string;
};

export type EPSSStatusDTO = {
  total: number;
  last_sync: string;
  score_date: string;
};

export const GetRiskSummary = async (): Promise<RiskSummaryDTO | null> => {
  try {
    const r = await riskApi.get("/risk/summary");
    return (r.data?.data ?? r.data) as RiskSummaryDTO;
  } catch (e) {
    console.error("GetRiskSummary error:", e);
    return null;
  }
};

export const GetEPSSStatus = async (): Promise<EPSSStatusDTO | null> => {
  try {
    const r = await riskApi.get("/risk/epss/status");
    return r.data as EPSSStatusDTO;
  } catch (e) {
    return null;
  }
};

export const TriggerEPSSSync = async (): Promise<boolean> => {
  try {
    await riskApi.post("/risk/epss/sync");
    return true;
  } catch (e) {
    return false;
  }
};

export const ListAssetCriticality = async (): Promise<AssetCriticalityDTO[]> => {
  try {
    const r = await riskApi.get("/risk/asset-criticality");
    const d = r.data?.data ?? r.data;
    return Array.isArray(d) ? d : [];
  } catch (e) {
    return [];
  }
};

export const CreateAssetCriticality = async (payload: Partial<AssetCriticalityDTO>): Promise<AssetCriticalityDTO | null> => {
  try {
    const r = await riskApi.post("/risk/asset-criticality", payload);
    return r.data?.data ?? null;
  } catch (e) {
    return null;
  }
};

export const UpdateAssetCriticality = async (id: number, payload: Partial<AssetCriticalityDTO>): Promise<boolean> => {
  try {
    await riskApi.patch(`/risk/asset-criticality/${id}`, payload);
    return true;
  } catch (e) {
    return false;
  }
};

export const DeleteAssetCriticality = async (id: number): Promise<boolean> => {
  try {
    await riskApi.delete(`/risk/asset-criticality/${id}`);
    return true;
  } catch (e) {
    return false;
  }
};
