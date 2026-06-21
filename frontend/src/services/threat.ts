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
  // CVSS v3.x (primary — v3.1 preferred)
  cvss_score: number;
  cvss_vector: string;
  cvss_severity: string;
  cvss_version: string;
  // CVSS v2 (may be 0 / empty if not available)
  cvss_v2_score: number;
  cvss_v2_vector: string;
  cvss_v2_severity: string;
  // CPE — JSON-encoded array of affected product URIs
  cpe: string;
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
// GitHub Security Advisory
// Fetched directly from GitHub public API (CORS-enabled, 60 req/hr unauthed)
// GET https://api.github.com/advisories?cve_id={id}&per_page=5
// ===========================

export type GitHubAdvisoryVulnerability = {
  package: { ecosystem: string; name: string };
  first_patched_version: string | null;
  vulnerable_version_range: string | null;
  vulnerable_functions: string[];
};

export type GitHubAdvisoryCredit = {
  user: { login: string; html_url: string; avatar_url: string } | null;
  type: string; // "reporter" | "finder" | "analyst" | ...
};

export type GitHubAdvisory = {
  ghsa_id: string;
  cve_id: string | null;
  url: string;
  html_url: string;
  summary: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low" | "unknown";
  cvss: { vector_string: string; score: number } | null;
  cvss_severities: {
    cvss_v3: { vector_string: string; score: number } | null;
    cvss_v4: { vector_string: string; score: number } | null;
  } | null;
  cwes: Array<{ cwe_id: string; name: string }> | null;
  identifiers: Array<{ type: string; value: string }>;
  references: string[];
  published_at: string;
  updated_at: string;
  withdrawn_at: string | null;
  vulnerabilities: GitHubAdvisoryVulnerability[] | null;
  credits: GitHubAdvisoryCredit[] | null;
  patched_at: string | null;
};

export type GitHubAdvisoryMap = Record<string, GitHubAdvisory | null>;

/**
 * Fetch GitHub Security Advisories for a list of CVE IDs.
 * Uses the public GitHub Advisory API (CORS-enabled, no auth required for public data).
 * Rate limit: 60 req/hr unauthenticated. Each CVE = 1 request → batching kept ≤5 CVEs.
 */
export const FetchGitHubAdvisories = async (
  cveIds: string[]
): Promise<GitHubAdvisoryMap> => {
  if (!cveIds || cveIds.length === 0) return {};

  const unique = [...new Set(cveIds.map((id) => id.trim().toUpperCase()))].filter(
    (id) => id.startsWith("CVE-")
  ).slice(0, 5); // cap — 1 req per CVE

  const results: GitHubAdvisoryMap = {};

  await Promise.allSettled(
    unique.map(async (cveId) => {
      try {
        const res = await fetch(
          `https://api.github.com/advisories?cve_id=${cveId}&per_page=3`,
          {
            headers: {
              Accept: "application/vnd.github+json",
              "X-GitHub-Api-Version": "2022-11-28",
            },
          }
        );
        if (!res.ok) { results[cveId] = null; return; }
        const data: GitHubAdvisory[] = await res.json();
        // Pick the advisory that explicitly references this CVE
        const match =
          data.find((a) => a.cve_id?.toUpperCase() === cveId) ?? data[0] ?? null;
        results[cveId] = match;
      } catch {
        results[cveId] = null;
      }
    })
  );

  return results;
};

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
