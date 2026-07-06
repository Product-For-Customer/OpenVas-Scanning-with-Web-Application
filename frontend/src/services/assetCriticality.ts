import { baseApi } from "./api";

export type AssetCriticalityDTO = {
  id: number;
  host_ip: string;
  criticality: string; // crown_jewel, high, medium, low
  criticality_score: number; // 1-5
  asset_type: string; // server, database, network, workstation, iot, web
  owner: string;
  business_impact: string;
  department: string;
  os_version: string;
  eol_date: string | null; // "YYYY-MM-DDTHH:mm:ssZ" or null
  created_at: string;
  updated_at: string;
};

export type AssetCriticalityInput = {
  host_ip: string;
  criticality: string;
  criticality_score: number;
  asset_type: string;
  owner: string;
  business_impact: string;
  department: string;
  os_version: string;
  eol_date: string; // "YYYY-MM-DD", empty string = unset
};

export const ListAssetCriticality = async (): Promise<AssetCriticalityDTO[] | null> => {
  try {
    const res = await baseApi.get("/risk/asset-criticality");
    return (res.data?.data ?? []) as AssetCriticalityDTO[];
  } catch (err) {
    console.error("ListAssetCriticality error:", err);
    return null;
  }
};

export const CreateAssetCriticality = async (
  input: AssetCriticalityInput
): Promise<AssetCriticalityDTO | null> => {
  try {
    const res = await baseApi.post("/risk/asset-criticality", input);
    return (res.data?.data ?? null) as AssetCriticalityDTO | null;
  } catch (err) {
    console.error("CreateAssetCriticality error:", err);
    return null;
  }
};

export const UpdateAssetCriticality = async (
  id: number,
  input: Partial<AssetCriticalityInput>
): Promise<AssetCriticalityDTO | null> => {
  try {
    const res = await baseApi.patch(`/risk/asset-criticality/${id}`, input);
    return (res.data?.data ?? null) as AssetCriticalityDTO | null;
  } catch (err) {
    console.error("UpdateAssetCriticality error:", err);
    return null;
  }
};

// Finds the row for a host_ip (if any exist yet — a host only gets a row once
// someone sets its criticality for the first time) and creates or updates it
// in one call, so the caller doesn't need to know whether a row already exists.
export const UpsertHostCriticality = async (
  input: AssetCriticalityInput
): Promise<AssetCriticalityDTO | null> => {
  const list = await ListAssetCriticality();
  if (list === null) return null;

  const existing = list.find(
    (item) => item.host_ip.trim().toLowerCase() === input.host_ip.trim().toLowerCase()
  );

  if (existing) {
    return UpdateAssetCriticality(existing.id, input);
  }
  return CreateAssetCriticality(input);
};
