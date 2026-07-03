import axios from "axios";
import { apiUrl } from "./api";
import type { CategoryPerm } from "./auth";

// =======================
// Axios instance for cookie-based auth
// =======================
const roleApi = axios.create({
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
export type PermissionCategory = {
  key: string;
  label: string;
  supports_manage: boolean;
};

export type PermissionInput = {
  category: string;
  can_view: boolean;
  can_manage: boolean;
};

export type RoleDetail = {
  id: number;
  role: string;
  is_built_in: boolean;
  user_count: number;
  permissions: Record<string, CategoryPerm>;
};

export type RoleErrorResponse = {
  error?: string;
};

// =======================
// API: GET /permission-categories
// =======================
export const ListPermissionCategories = async (): Promise<PermissionCategory[] | null> => {
  try {
    const response = await roleApi.get("/permission-categories");
    return Array.isArray(response.data) ? (response.data as PermissionCategory[]) : null;
  } catch (error) {
    console.error("ListPermissionCategories error:", error);
    return null;
  }
};

// =======================
// API: GET /roles/:id
// =======================
export const GetRole = async (id: number): Promise<RoleDetail | RoleErrorResponse> => {
  try {
    const response = await roleApi.get(`/roles/${id}`);
    return response.data as RoleDetail;
  } catch (error: any) {
    return error?.response?.data || { error: "Failed to load role" };
  }
};

// =======================
// API: POST /roles
// =======================
export const CreateRole = async (
  role: string,
  permissions: PermissionInput[]
): Promise<RoleDetail | RoleErrorResponse> => {
  try {
    const response = await roleApi.post("/roles", { role, permissions });
    return response.data as RoleDetail;
  } catch (error: any) {
    return error?.response?.data || { error: "Failed to create role" };
  }
};

// =======================
// API: PATCH /roles/:id
// =======================
export const UpdateRole = async (
  id: number,
  payload: { role?: string; permissions?: PermissionInput[] }
): Promise<RoleDetail | RoleErrorResponse> => {
  try {
    const response = await roleApi.patch(`/roles/${id}`, payload);
    return response.data as RoleDetail;
  } catch (error: any) {
    return error?.response?.data || { error: "Failed to update role" };
  }
};

// =======================
// API: DELETE /roles/:id
// =======================
export const DeleteRole = async (id: number): Promise<{ message?: string; error?: string }> => {
  try {
    const response = await roleApi.delete(`/roles/${id}`);
    return response.data;
  } catch (error: any) {
    return error?.response?.data || { error: "Failed to delete role" };
  }
};
