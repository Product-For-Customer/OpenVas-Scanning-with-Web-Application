import { baseApi } from "./api";

// ========================
// DTOs
// ========================

export type HostAssetInfo = {
  criticality: string;
  criticality_score: number;
  asset_type: string;
  owner: string;
  business_impact: string;
};

export type KEVHitItem = {
  cve_id: string;
  vulnerability_name: string;
  product: string;
  is_ransomware: boolean;
  due_date: string;
};

export type EPSSHitItem = {
  cve_id: string;
  epss_score: number;
  percentile: number;
  vuln_name: string;
};

export type HostVulnDetail = {
  vuln_name: string;
  family: string;
  severity: number;
  level: "Critical" | "High" | "Medium" | "Low" | "Info";
  port: string;
  cve_list: string;
  days_open: number;
  sla_status: "ok" | "warning" | "breach" | "n/a";
  sla_days: number;
  risk_score: number;
};

export type HostSummaryResponse = {
  host_ip: string;
  task_name: string;
  scanned_at: string;
  asset: HostAssetInfo;

  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;

  risk_score: number;
  risk_level: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

  kev_count: number;
  kev_items: KEVHitItem[];

  top_epss: EPSSHitItem[];

  sla_breach_count: number;
  sla_warning_count: number;

  vulnerabilities: HostVulnDetail[];
};

export type SLABreachItem = {
  host_ip: string;
  task_name: string;
  vuln_name: string;
  severity: number;
  level: string;
  days_open: number;
  sla_days: number;
  sla_status: "breach" | "warning";
  overdue_days: number;
  scanned_at: string;
};

export type SLABreachesResponse = {
  data: SLABreachItem[];
  breach_count: number;
  warning_count: number;
  total: number;
};

export type CellData = {
  count: number;
  severity: number;
};

export type AttackSurfaceMatrix = {
  hosts: string[];
  families: string[];
  matrix: Record<string, Record<string, CellData>>;
  max_cell: number;
};

// ========================
// API calls
// ========================

export const GetHostSummary = async (
  ip: string
): Promise<HostSummaryResponse | null> => {
  try {
    const res = await baseApi.get(`/host/${encodeURIComponent(ip)}/summary`);
    return (res.data?.data ?? res.data) as HostSummaryResponse;
  } catch (err) {
    console.error("GetHostSummary error:", err);
    return null;
  }
};

export const GetSLABreaches = async (): Promise<SLABreachesResponse | null> => {
  try {
    const res = await baseApi.get("/vulnerabilities/sla-breaches");
    return res.data as SLABreachesResponse;
  } catch (err) {
    console.error("GetSLABreaches error:", err);
    return null;
  }
};

export const GetAttackSurfaceMatrix =
  async (): Promise<AttackSurfaceMatrix | null> => {
    try {
      const res = await baseApi.get("/attack-surface/matrix");
      return (res.data?.data ?? res.data) as AttackSurfaceMatrix;
    } catch (err) {
      console.error("GetAttackSurfaceMatrix error:", err);
      return null;
    }
  };
