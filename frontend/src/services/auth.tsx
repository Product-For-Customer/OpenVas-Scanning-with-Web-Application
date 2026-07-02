import axios from "axios";
import { apiUrl } from "./api";

// =======================
// Axios instance for cookie-based auth
// =======================
const authApi = axios.create({
  baseURL: apiUrl,
  withCredentials: true,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
  },
});

// =======================
// Types
// =======================
export type LoginInput = {
  email: string;
  password: string;
};

type LoginUser = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
};

export type LoginResponse = {
  message?: string;
  user?: LoginUser;
  require_totp?: boolean;
  require_email_otp?: boolean;
  masked_email?: string;
};

export type MeResponse = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  profile: string;
  phone_number: string;
  location: string;
  position: string;
  role: string;
};

export type LogoutResponse = {
  message: string;
};

export type CheckUserEmailInput = {
  email: string;
};

export type CheckUserEmailResponse = {
  exists: boolean;
  message?: string;
  error?: string;
};

export type SendOTPInput = {
  email: string;
};

export type SendOTPResponse = {
  message: string;
  error?: string;
};

export type VerifyOTPInput = {
  email: string;
  otp: string;
  new_password: string;
};

export type VerifyOTPResponse = {
  message: string;
  error?: string;
};

// =======================
// Service settings from backend (public endpoint)
// =======================
export type ServiceSettings = {
  login_otp: boolean;
  register_otp: boolean;
  reset_otp: boolean;
  totp_enabled?: boolean;
};

export const GetServiceSettings = async (): Promise<ServiceSettings> => {
  try {
    const res = await authApi.get("/auth/service-settings");
    return res.data as ServiceSettings;
  } catch {
    return { login_otp: false, register_otp: false, reset_otp: false, totp_enabled: false };
  }
};

// =======================
// API: POST /auth/login
// Throws on HTTP error so the caller can show the right message.
// Returns LoginResponse on HTTP 200 — including {require_totp: true} or
// {require_email_otp: true, masked_email: "..."}.
// =======================
export const Login = async (payload: LoginInput): Promise<LoginResponse> => {
  const response = await authApi.post("/auth/login", payload);
  return response.data as LoginResponse;
};

// =======================
// API: POST /auth/verify-email-otp — verify login email OTP
// =======================
export const VerifyLoginEmailOTP = async (code: string): Promise<void> => {
  await authApi.post("/auth/verify-email-otp", { code });
};

// =======================
// API: POST /auth/direct-signup — register without OTP
// =======================
export type DirectSignUpInput = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  location: string;
  position: string;
};

export const DirectSignUp = async (payload: DirectSignUpInput): Promise<void> => {
  await authApi.post("/auth/direct-signup", payload);
};

// =======================
// API: POST /auth/direct-reset-password — reset without OTP
// =======================
export const DirectResetPassword = async (email: string, newPassword: string): Promise<void> => {
  await authApi.post("/auth/direct-reset-password", { email, new_password: newPassword });
};

// =======================
// API: GET /auth/me
// =======================
export const GetMe = async (): Promise<MeResponse | null> => {
  try {
    const response = await authApi.get("/auth/me");
    if (response.data && typeof response.data === "object") {
      return response.data as MeResponse;
    }
    return null;
  } catch {
    return null;
  }
};

// =======================
// API: POST /auth/logout
// =======================
export const Logout = async (): Promise<LogoutResponse | null> => {
  try {
    const response = await authApi.post("/auth/logout");
    if (response.data?.message) {
      return response.data as LogoutResponse;
    }
    return null;
  } catch {
    return null;
  }
};

// =======================
// API: POST /check-user-email
// =======================
export const CheckUserEmail = async (
  payload: CheckUserEmailInput
): Promise<CheckUserEmailResponse | null> => {
  try {
    const response = await authApi.post("/check-user-email", payload);
    if (response.data && typeof response.data === "object") {
      return response.data as CheckUserEmailResponse;
    }
    return null;
  } catch (error: any) {
    if (error?.response?.data) {
      return error.response.data as CheckUserEmailResponse;
    }
    return null;
  }
};

// =======================
// API: POST /send-otp
// =======================
export const SendOTP = async (
  payload: SendOTPInput
): Promise<SendOTPResponse | null> => {
  try {
    const response = await authApi.post("/send-otp", payload);
    if (response.data && typeof response.data === "object") {
      return response.data as SendOTPResponse;
    }
    return null;
  } catch (error: any) {
    if (error?.response?.data) {
      return error.response.data as SendOTPResponse;
    }
    return null;
  }
};

// =======================
// API: POST /verify-otp-password
// =======================
export const VerifyOTPAddUpdatePassword = async (
  payload: VerifyOTPInput
): Promise<VerifyOTPResponse | null> => {
  try {
    const response = await authApi.post("/verify-otp-password", payload);
    if (response.data && typeof response.data === "object") {
      return response.data as VerifyOTPResponse;
    }
    return null;
  } catch (error: any) {
    if (error?.response?.data) {
      return error.response.data as VerifyOTPResponse;
    }
    return null;
  }
};

export interface VerifyOTPSignUpPayload {
  email: string;
  otp: string;
  password: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  location: string;
  position: string;
}

export const VerifyOTPSignUp = async (payload: VerifyOTPSignUpPayload) => {
  try {
    const res = await axios.post(`${apiUrl}/verify-otp-signup`, payload, {
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
      },
    });
    return res.data;
  } catch (error: any) {
    return error?.response?.data || { error: "Verify OTP SignUp failed" };
  }
};

export interface SendOTPForSignUpInput {
  email: string;
}

export interface SendOTPForSignUpResponse {
  message?: string;
  error?: string;
}

// =======================
// API: POST /send-otp-signup
// =======================
export const SendOTPForSignUp = async (
  payload: SendOTPForSignUpInput
): Promise<SendOTPForSignUpResponse | null> => {
  try {
    const response = await authApi.post("/send-otp-signup", payload);
    if (response.data && typeof response.data === "object") {
      return response.data as SendOTPForSignUpResponse;
    }
    return null;
  } catch (error: any) {
    if (error?.response?.data) {
      return error.response.data as SendOTPForSignUpResponse;
    }
    return null;
  }
};

export type EmailAndPhoneNumberResponse = {
  id: number;
  email: string;
  phone_number: string;
};

// =======================
// API: GET /email-phone-numbers
// =======================
export const ListEmailAndPhoneNumber = async (): Promise<
  EmailAndPhoneNumberResponse[] | null
> => {
  try {
    const response = await authApi.get("/email-phone-numbers");
    if (Array.isArray(response.data)) {
      return response.data as EmailAndPhoneNumberResponse[];
    }
    const data = response.data?.data ?? response.data;
    if (Array.isArray(data)) {
      return data as EmailAndPhoneNumberResponse[];
    }
    return null;
  } catch {
    return null;
  }
};
