import axios from "axios";
import { apiUrl } from "./api";

// =======================
// Axios instance for cookie-based auth
// =======================
const authApi = axios.create({
  baseURL: apiUrl,
  withCredentials: true, // ✅ สำคัญมากสำหรับ cookie auth
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

export type LoginUser = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
};

export type LoginResponse = {
  message: string;
  user: LoginUser;
  require_totp?: boolean;
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

// =======================
// Types
// =======================
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
// API: POST /auth/login
// =======================
export const Login = async (
  payload: LoginInput
): Promise<LoginResponse | null> => {
  try {
    const response = await authApi.post("/auth/login", payload);

    if (response.data && response.data.user) {
      return response.data as LoginResponse;
    }

    console.error("Unexpected login response:", response.data);
    return null;
  } catch (error) {
    console.error("Login error:", error);
    return null;
  }
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

    console.error("Unexpected GetMe response:", response.data);
    return null;
  } catch (error) {
    console.error("GetMe error:", error);
    return null;
  }
};

// =======================
// API: POST /auth/logout
// =======================
export const Logout = async (): Promise<LogoutResponse | null> => {
  try {
    const response = await authApi.post("/auth/logout");

    if (response.data && response.data.message) {
      return response.data as LogoutResponse;
    }

    console.error("Unexpected logout response:", response.data);
    return null;
  } catch (error) {
    console.error("Logout error:", error);
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

    console.error("Unexpected CheckUserEmail response:", response.data);
    return null;
  } catch (error: any) {
    console.error("CheckUserEmail error:", error);

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

    console.error("Unexpected SendOTP response:", response.data);
    return null;
  } catch (error: any) {
    console.error("SendOTP error:", error);

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

    console.error("Unexpected VerifyOTP response:", response.data);
    return null;
  } catch (error: any) {
    console.error("VerifyOTP error:", error);

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

// ใช้อันนี้แทน SignUp เดิมใน flow สมัครสมาชิก
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

    console.error("Unexpected SendOTPForSignUp response:", response.data);
    return null;
  } catch (error: any) {
    console.error("SendOTPForSignUp error:", error);

    if (error?.response?.data) {
      return error.response.data as SendOTPForSignUpResponse;
    }

    return null;
  }
};

// =======================
// Types: Email + PhoneNumber
// =======================
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

    console.error("Expected email-phone-number array but got:", response.data);
    return null;
  } catch (error) {
    console.error("ListEmailAndPhoneNumber error:", error);
    return null;
  }
};