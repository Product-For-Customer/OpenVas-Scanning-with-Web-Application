import axios from "axios";
import { apiUrl } from "./api";

const deltaApi = axios.create({
  baseURL: apiUrl,
  withCredentials: true,
  timeout: 30000,
  headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
});

export const GetVulnerabilityDelta = async () => {
  try {
    const r = await deltaApi.get("/vulnerabilities/delta/enhanced");
    return r.data?.data ?? null;
  } catch (e) {
    return null;
  }
};
