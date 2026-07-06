import { baseApi } from "./api";

export type DiscoveredHostDTO = {
  id: number;
  ip_address: string;
  hostname: string;
  open_ports: string; // comma-separated, e.g. "22,80,443"
  is_known_target: boolean;
  acknowledged: boolean;
  first_seen_at: string;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
};

export type DiscoveryScanStatusDTO = {
  is_running: boolean;
  started_at: string;
  finished_at: string;
  last_error: string;
};

export type DiscoveredHostStatusFilter = "" | "known" | "unrecognized" | "acknowledged";

export type ListDiscoveredHostsParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: DiscoveredHostStatusFilter;
};

export type DiscoveredHostsPageDTO = {
  data: DiscoveredHostDTO[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  // Unaffected by the current search/status filter — always the whole
  // inventory's counts, for the page's summary cards.
  total_hosts: number;
  unrecognized_count: number;
};

const emptyPage = (page: number, pageSize: number): DiscoveredHostsPageDTO => ({
  data: [], page, page_size: pageSize, total: 0, total_pages: 1, total_hosts: 0, unrecognized_count: 0,
});

export const ListDiscoveredHosts = async (params: ListDiscoveredHostsParams = {}): Promise<DiscoveredHostsPageDTO> => {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  try {
    const res = await baseApi.get("/discovery/hosts", {
      params: {
        page,
        page_size: pageSize,
        search: params.search?.trim() || undefined,
        status: params.status || undefined,
      },
    });
    const body = res.data ?? {};
    return {
      data: Array.isArray(body.data) ? (body.data as DiscoveredHostDTO[]) : [],
      page: body.page ?? page,
      page_size: body.page_size ?? pageSize,
      total: body.total ?? 0,
      total_pages: body.total_pages ?? 1,
      total_hosts: body.total_hosts ?? 0,
      unrecognized_count: body.unrecognized_count ?? 0,
    };
  } catch (e) {
    console.error("ListDiscoveredHosts error:", e);
    return emptyPage(page, pageSize);
  }
};

export const GetDiscoveryScanStatus = async (): Promise<DiscoveryScanStatusDTO | null> => {
  try {
    const res = await baseApi.get("/discovery/status");
    return res.data as DiscoveryScanStatusDTO;
  } catch (e) {
    console.error("GetDiscoveryScanStatus error:", e);
    return null;
  }
};

// Left to throw (no try/catch) so the caller can surface the backend's real
// error message (e.g. 409 "a discovery scan is already running", or a
// missing DISCOVERY_SUBNET configuration error surfaced via status polling).
export const TriggerDiscoveryScan = async (): Promise<void> => {
  await baseApi.post("/discovery/trigger");
};

export const AcknowledgeDiscoveredHost = async (id: number): Promise<DiscoveredHostDTO> => {
  const res = await baseApi.patch(`/discovery/hosts/${id}/acknowledge`);
  return (res.data?.data ?? res.data) as DiscoveredHostDTO;
};
