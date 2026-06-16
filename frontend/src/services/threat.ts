import axios from "axios";
import { apiUrl } from "./api";

const threatApi = axios.create({
  baseURL: apiUrl,
  withCredentials: true,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
  },
});

// ===========================
// KEV Types
// ===========================

export type KEVEntryDTO = {
  cve_id: string;
  vendor_project: string;
  product: string;
  vulnerability_name: string;
  date_added: string;
  short_description: string;
  required_action: string;
  due_date: string | null;
  known_ransomware_campaign_use: string;
  notes: string;
  is_ransomware_related: boolean;
};

export type KEVByHost = {
  host_ip: string;
  task_name: string;
  kev_count: number;
  cve_list: KEVEntryDTO[];
};

export type KEVSummaryDTO = {
  total_kev_catalog: number;
  total_kev_in_scans: number;
  ransomware_related: number;
  last_synced_at: string;
  last_sync_status: string;
  kev_by_host: KEVByHost[];
};

export type KEVSyncStatusDTO = {
  is_syncing: boolean;
  last_sync_at: string;
  last_error: string;
  total: number;
};

// ===========================
// NVD / CVE Enrich Types
// ===========================

export type NVDCVEDetailDTO = {
  cve_id: string;
  cvss_score: number;
  cvss_vector: string;
  cvss_severity: string;
  cvss_version: string;
  description: string;
  published_at: string;
  modified_at: string;
  vuln_status: string;
  cwe: string;
  references: string[];
  from_cache: boolean;
};

export type CVEEnrichDTO = {
  cve_id: string;
  nvd: NVDCVEDetailDTO | null;
  kev: KEVEntryDTO | null;
};

export type CVEEnrichMap = Record<string, CVEEnrichDTO | null>;

// ===========================
// KEV API
// ===========================

export const ListKEVCatalog = async (params?: {
  search?: string;
  ransomware_only?: boolean;
}): Promise<KEVEntryDTO[]> => {
  try {
    const response = await threatApi.get("/threats/kev", { params });
    const data = response.data?.data ?? response.data;
    return Array.isArray(data) ? (data as KEVEntryDTO[]) : [];
  } catch (error) {
    console.error("ListKEVCatalog error:", error);
    return [];
  }
};

export const CheckKEVByCVEIDs = async (
  cveIds: string[]
): Promise<Record<string, KEVEntryDTO | null>> => {
  if (!cveIds || cveIds.length === 0) return {};
  try {
    const response = await threatApi.get("/threats/kev/check", {
      params: { cve_ids: cveIds.join(",") },
    });
    return (response.data ?? {}) as Record<string, KEVEntryDTO | null>;
  } catch (error) {
    console.error("CheckKEVByCVEIDs error:", error);
    return {};
  }
};

export const GetKEVSummary = async (): Promise<KEVSummaryDTO | null> => {
  try {
    const response = await threatApi.get("/threats/kev/summary");
    return response.data as KEVSummaryDTO;
  } catch (error) {
    console.error("GetKEVSummary error:", error);
    return null;
  }
};

export const GetKEVSyncStatus = async (): Promise<KEVSyncStatusDTO | null> => {
  try {
    const response = await threatApi.get("/threats/kev/status");
    return response.data as KEVSyncStatusDTO;
  } catch (error) {
    console.error("GetKEVSyncStatus error:", error);
    return null;
  }
};

export const TriggerKEVSync = async (): Promise<boolean> => {
  try {
    await threatApi.post("/threats/kev/sync");
    return true;
  } catch (error) {
    console.error("TriggerKEVSync error:", error);
    return false;
  }
};

// ===========================
// CVE Enrich (NVD + KEV combined)
// ===========================

export const EnrichCVEs = async (
  cveIds: string[]
): Promise<CVEEnrichMap> => {
  if (!cveIds || cveIds.length === 0) return {};
  try {
    const uniqueIds = [...new Set(cveIds.map((id) => id.trim().toUpperCase()))].filter(
      (id) => id.startsWith("CVE-")
    );
    if (uniqueIds.length === 0) return {};

    const response = await threatApi.get("/threats/cve/enrich", {
      params: { cve_ids: uniqueIds.join(",") },
      timeout: 60000,
    });
    return (response.data ?? {}) as CVEEnrichMap;
  } catch (error) {
    console.error("EnrichCVEs error:", error);
    return {};
  }
};

// ===========================
// Helper: Parse CVE vector string
// ===========================

export type CVSSVectorParsed = {
  attackVector: string;
  attackComplexity: string;
  privilegesRequired: string;
  userInteraction: string;
  scope: string;
  confidentiality: string;
  integrity: string;
  availability: string;
  version: string;
};

const cvssV3Map: Record<string, Record<string, string>> = {
  AV: { N: "Network", A: "Adjacent", L: "Local", P: "Physical" },
  AC: { L: "Low", H: "High" },
  PR: { N: "None", L: "Low", H: "High" },
  UI: { N: "None", R: "Required" },
  S: { U: "Unchanged", C: "Changed" },
  C: { N: "None", L: "Low", H: "High" },
  I: { N: "None", L: "Low", H: "High" },
  A: { N: "None", L: "Low", H: "High" },
};

export const parseCVSSVector = (vector: string): CVSSVectorParsed | null => {
  if (!vector) return null;

  const parts = vector.split("/");
  if (parts.length < 2) return null;

  const versionPart = parts[0];
  const version = versionPart.replace("CVSS:", "");

  const kvPairs: Record<string, string> = {};
  for (const part of parts.slice(1)) {
    const [k, v] = part.split(":");
    if (k && v) kvPairs[k] = v;
  }

  const lookup = (key: string, abbr: string): string => {
    return cvssV3Map[key]?.[abbr] ?? abbr;
  };

  return {
    version,
    attackVector: lookup("AV", kvPairs["AV"] ?? ""),
    attackComplexity: lookup("AC", kvPairs["AC"] ?? ""),
    privilegesRequired: lookup("PR", kvPairs["PR"] ?? ""),
    userInteraction: lookup("UI", kvPairs["UI"] ?? ""),
    scope: lookup("S", kvPairs["S"] ?? ""),
    confidentiality: lookup("C", kvPairs["C"] ?? ""),
    integrity: lookup("I", kvPairs["I"] ?? ""),
    availability: lookup("A", kvPairs["A"] ?? ""),
  };
};
