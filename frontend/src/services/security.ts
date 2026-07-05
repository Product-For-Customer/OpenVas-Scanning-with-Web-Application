import axios from "axios";
import { apiUrl, installMaintenanceInterceptor } from "./api";

const deltaApi = axios.create({
  baseURL: apiUrl,
  withCredentials: true,
  timeout: 30000,
  headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
});

installMaintenanceInterceptor(deltaApi);

export const GetVulnerabilityDelta = async () => {
  try {
    const r = await deltaApi.get("/vulnerabilities/delta/enhanced");
    return r.data?.data ?? null;
  } catch (e) {
    return null;
  }
};
