import axios from "axios";
import { apiUrl } from "./api";

// =======================
// Axios instance for cookie-based auth
// =======================
const userApi = axios.create({
  baseURL: apiUrl,
  withCredentials: true, // ✅ สำคัญมาก
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
  },
});

// =======================
// Types
// =======================
export type UserResponse = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  profile: string;
  phone_number: string;
  location: string;
  position: string;
  role: string;
  message?: string;
  error?: string;
};

export type CreateUserInput = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  profile?: string;
  phone_number?: string;
  location?: string;
  position?: string;
  app_role_id?: number; // 0 = default "User" role (handled by backend)
};

export type UpdateUserInput = {
  email?: string;
  password?: string;
  first_name?: string;
  last_name?: string;
  profile?: string;
  phone_number?: string;
  location?: string;
  position?: string;
  app_role_id?: number;
};

export type DeleteUserResponse = {
  message: string;
};

// =======================
// API: GET /users
// =======================
export const ListUser = async (): Promise<UserResponse[] | null> => {
  try {
    const response = await userApi.get("/users");

    if (Array.isArray(response.data)) {
      return response.data as UserResponse[];
    }

    const data = response.data?.data ?? response.data;

    if (Array.isArray(data)) {
      return data as UserResponse[];
    }

    console.error("Expected array but got:", response.data);
    return null;
  } catch (error) {
    console.error("ListUser error:", error);
    return null;
  }
};

// =======================
// API: GET /users/:id
// =======================
export const ListUserByID = async (id: number | string): Promise<UserResponse | null> => {
  try {
    const response = await userApi.get(`/users/${id}`);

    if (response.data && typeof response.data === "object") {
      return response.data as UserResponse;
    }

    console.error("Unexpected ListUserByID response:", response.data);
    return null;
  } catch (error) {
    console.error("ListUserByID error:", error);
    return null;
  }
};

// =======================
// API: POST /users
// =======================
export const CreateUser = async (
  payload: CreateUserInput
): Promise<UserResponse | null> => {
  try {
    const response = await userApi.post("/create-users", payload);

    if (response.data && typeof response.data === "object") {
      return response.data as UserResponse;
    }

    console.error("Unexpected CreateUser response:", response.data);
    return null;
  } catch (error) {
    console.error("CreateUser error:", error);
    return null;
  }
};

// =======================
// API: PATCH /update-users/:id
// =======================
export const UpdateUserByID = async (
  id: number | string,
  payload: UpdateUserInput
): Promise<UserResponse | null> => {
  try {
    const response = await userApi.patch(`/update-users/${id}`, payload);

    if (response.data && typeof response.data === "object") {
      return response.data as UserResponse;
    }

    console.error("Unexpected UpdateUserByID response:", response.data);
    return null;
  } catch (error) {
    console.error("UpdateUserByID error:", error);
    return null;
  }
};

// =======================
// API: DELETE /delete-users/:id
// =======================
export const DeleteUserByID = async (
  id: number | string
): Promise<DeleteUserResponse | null> => {
  try {
    const response = await userApi.delete(`/delete-users/${id}`);

    if (response.data && response.data.message) {
      return response.data as DeleteUserResponse;
    }

    console.error("Unexpected DeleteUserByID response:", response.data);
    return null;
  } catch (error) {
    console.error("DeleteUserByID error:", error);
    return null;
  }
};

export type RoleResponse = {
  id: number;
  role: string;
  is_built_in?: boolean;
  user_count?: number;
};

// No password field — an admin editing someone else's account never resets
// their password from this endpoint (backend no longer accepts one either).
export type UpdateUserByAdminPayload = {
  email?: string;
  first_name?: string;
  last_name?: string;
  profile?: string;
  phone_number?: string;
  location?: string;
  position?: string;
  app_role_id?: number;
};

export type UpdateUserByAdminResponse = {
  message?: string;
  data?: UserResponse;
  error?: string;
};

// =======================
// API: GET /roles
// =======================
export const ListRoles = async (): Promise<RoleResponse[] | null> => {
  try {
    const response = await userApi.get("/roles");

    if (Array.isArray(response.data)) {
      return response.data as RoleResponse[];
    }

    const data = response.data?.data ?? response.data;

    if (Array.isArray(data)) {
      return data as RoleResponse[];
    }

    console.error("Expected role array but got:", response.data);
    return null;
  } catch (error) {
    console.error("ListRoles error:", error);
    return null;
  }
};

// =======================
// API: PATCH /admin/users/:id
// =======================
export const UpdateUserIDByAdmin = async (
  id: number,
  payload: UpdateUserByAdminPayload
): Promise<UpdateUserByAdminResponse> => {
  try {
    const response = await userApi.patch(`/admin/users/${id}`, payload);

    return response.data as UpdateUserByAdminResponse;
  } catch (error: any) {
    console.error("UpdateUserIDByAdmin error:", error);

    return (
      error?.response?.data || {
        error: "Update user by admin failed",
      }
    );
  }
};

export interface SendEmailResponse {
  id: number;
  email: string;
  pass_app: string;
  app_user_id: number;
}

export interface UpdateSendEmailPayload {
  email: string;
  pass_app: string;
}

// =======================
// API: GET /send-emails
// =======================
export const ListSendEmails = async (): Promise<SendEmailResponse[] | null> => {
  try {
    const response = await userApi.get("/send-emails");

    if (Array.isArray(response.data)) {
      return response.data as SendEmailResponse[];
    }

    const data = response.data?.data ?? response.data;

    if (Array.isArray(data)) {
      return data as SendEmailResponse[];
    }

    console.error("Expected send email array but got:", response.data);
    return null;
  } catch (error) {
    console.error("ListSendEmails error:", error);
    return null;
  }
};

// =======================
// API: PUT /send-email/:id
// app_user_id ไม่ต้องส่งจาก frontend
// backend จะใช้ user_id จากคนที่ login อยู่
// =======================
export const UpdateSendEmailByID = async (
  id: number,
  payload: UpdateSendEmailPayload
): Promise<SendEmailResponse | null> => {
  try {
    const response = await userApi.put(`/send-email/${id}`, payload);

    if (response.data?.data) {
      return response.data.data as SendEmailResponse;
    }

    if (response.data?.id) {
      return response.data as SendEmailResponse;
    }

    console.error("Expected updated send email object but got:", response.data);
    return null;
  } catch (error) {
    console.error("UpdateSendEmailByID error:", error);
    return null;
  }
};

// =======================
// Types: Location
// =======================
export type LocationResponse = {
  id: number;
  location: string;
  latitude: number;
  longtitude: number;
  task_id: string;
  app_user_id: number;
  created_at?: string;
  updated_at?: string;
  message?: string;
  error?: string;
};

export type CreateLocationInput = {
  location: string;
  latitude: number;
  longtitude: number;
  task_id: string;
};

export type UpdateLocationInput = {
  location?: string;
  latitude?: number;
  longtitude?: number;
  task_id?: string;
};

export type DeleteLocationResponse = {
  message: string;
};

// =======================
// Helpers
// =======================
const normalizeLocation = (raw: any): LocationResponse => {
  return {
    id: Number(raw?.id ?? raw?.ID ?? 0),
    location: String(raw?.location ?? raw?.Location ?? ""),
    latitude: Number(raw?.latitude ?? raw?.Latitude ?? 0),
    longtitude: Number(raw?.longtitude ?? raw?.Longtitude ?? 0),
    task_id: String(raw?.task_id ?? raw?.TaskID ?? ""),
    app_user_id: Number(raw?.app_user_id ?? raw?.AppUserID ?? 0),
    created_at: raw?.created_at ?? raw?.CreatedAt ?? undefined,
    updated_at: raw?.updated_at ?? raw?.UpdatedAt ?? undefined,
    message: raw?.message ? String(raw.message) : undefined,
    error: raw?.error ? String(raw.error) : undefined,
  };
};

// =======================
// Location APIs
// =======================

// GET /locations
export const ListLocation = async (): Promise<LocationResponse[] | null> => {
  try {
    const response = await userApi.get("/locations");
    const data = response.data?.data ?? response.data;

    if (Array.isArray(data)) {
      return data.map((item) => normalizeLocation(item));
    }

    console.error("Expected array but got:", response.data);
    return null;
  } catch (error) {
    console.error("ListLocation error:", error);
    return null;
  }
};

// POST /create-locations
// app_user_id ไม่ต้องส่งจาก frontend
// backend จะใช้ user_id จากคนที่ login อยู่
export const CreateLocation = async (
  payload: CreateLocationInput
): Promise<LocationResponse | null> => {
  try {
    const response = await userApi.post("/create-locations", payload);
    const data = response.data?.data ?? response.data;

    if (data && typeof data === "object") {
      return normalizeLocation(data);
    }

    console.error("Unexpected CreateLocation response:", response.data);
    return null;
  } catch (error) {
    console.error("CreateLocation error:", error);
    return null;
  }
};

// PATCH /update-locations/:id
// app_user_id ไม่ต้องส่งจาก frontend
// backend จะใช้ user_id จากคนที่ login อยู่
export const UpdateLocationByID = async (
  id: number | string,
  payload: UpdateLocationInput
): Promise<LocationResponse | null> => {
  try {
    const response = await userApi.patch(`/update-locations/${id}`, payload);
    const data = response.data?.data ?? response.data;

    if (data && typeof data === "object") {
      return normalizeLocation(data);
    }

    console.error("Unexpected UpdateLocationByID response:", response.data);
    return null;
  } catch (error) {
    console.error("UpdateLocationByID error:", error);
    return null;
  }
};

// DELETE /delete-locations/:id
export const DeleteLocationByID = async (
  id: number | string
): Promise<DeleteLocationResponse | null> => {
  try {
    const response = await userApi.delete(`/delete-locations/${id}`);

    if (response.data && response.data.message) {
      return {
        message: String(response.data.message),
      };
    }

    console.error("Unexpected DeleteLocationByID response:", response.data);
    return null;
  } catch (error) {
    console.error("DeleteLocationByID error:", error);
    return null;
  }
};