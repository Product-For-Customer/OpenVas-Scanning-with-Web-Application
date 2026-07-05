import axios from "axios";
import { apiUrl, installMaintenanceInterceptor } from "./api";

const totpApi = axios.create({
  baseURL: apiUrl,
  withCredentials: true,
  timeout: 15000,
  headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
});

installMaintenanceInterceptor(totpApi);

// ── Types ──────────────────────────────────────────────────────────────────

export type TOTPStatus = {
  is_enabled: boolean;
  is_configured: boolean;
};

export type TOTPInitResponse = {
  secret: string;
  otp_uri: string;
  issuer: string;
  account: string;
};

// ── API ─────────────────────────────────────────────────────────────────────

export const GetTOTPStatus = async (): Promise<TOTPStatus> => {
  const res = await totpApi.get("/auth/totp/status");
  return res.data as TOTPStatus;
};

export const InitTOTPSetup = async (): Promise<TOTPInitResponse> => {
  const res = await totpApi.post("/auth/totp/init");
  return res.data as TOTPInitResponse;
};

export const VerifyTOTPSetup = async (code: string): Promise<void> => {
  await totpApi.post("/auth/totp/verify", { code });
};

export const DisableTOTP = async (verification: { password?: string; code?: string }): Promise<void> => {
  await totpApi.delete("/auth/totp", { data: verification });
};

// Used after Login returns require_totp: true — verifies code and finalises session
export const VerifyTOTPLogin = async (code: string): Promise<void> => {
  await totpApi.post("/auth/totp/verify-login", { code });
};
