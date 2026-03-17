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
  profile: string;
  phone_number: string;
  location: string;
  position: string;
  app_role_id: number;
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

    console.log("ListUser raw response:", response.data);

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

    console.log("ListUserByID raw response:", response.data);

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

    console.log("CreateUser raw response:", response.data);

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

    console.log("UpdateUserByID raw response:", response.data);

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

    console.log("DeleteUserByID raw response:", response.data);

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

export default userApi;


export type RoleResponse = {
  id: number;
  role: string;
};

export type UpdateUserByAdminPayload = {
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

    console.log("ListRoles raw response:", response.data);

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

    console.log("UpdateUserIDByAdmin raw response:", response.data);

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

    console.log("ListSendEmails raw response:", response.data);

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
// =======================
export const UpdateSendEmailByID = async (
  id: number,
  payload: UpdateSendEmailPayload
): Promise<SendEmailResponse | null> => {
  try {
    const response = await userApi.put(`/send-email/${id}`, payload);

    console.log("UpdateSendEmailByID raw response:", response.data);

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
// Types: AppTarget
// =======================
export type AppTargetResponse = {
  id: number;
  name: string;
  ip_host: string;
  mac_address: string;
  created_at?: string;
  updated_at?: string;
  message?: string;
  error?: string;
};

export type CreateAppTargetInput = {
  name: string;
  ip_host: string;
  mac_address?: string;
};

export type UpdateAppTargetInput = {
  name?: string;
  ip_host?: string;
  mac_address?: string;
};

export type DeleteAppTargetResponse = {
  message: string;
};

// =======================
// Types: Location
// =======================
export type TargetMiniResponse = {
  id: number;
  name: string;
  ip_host: string;
  mac_address: string;
};

export type LocationResponse = {
  id: number;
  location: string;
  building: string;
  floor: number;
  latitude: number;
  longtitude: number;
  app_target_id: number;
  app_target: TargetMiniResponse;
  created_at?: string;
  updated_at?: string;
  message?: string;
  error?: string;
};

export type CreateLocationInput = {
  location: string;
  building: string;
  floor: number;
  latitude: number;
  longtitude: number;
  app_target_id: number;
};

export type UpdateLocationInput = {
  location?: string;
  building?: string;
  floor?: number;
  latitude?: number;
  longtitude?: number;
  app_target_id?: number;
};

export type DeleteLocationResponse = {
  message: string;
};

// =======================
// AppTarget APIs
// =======================

// GET /app-targets
export const ListAppTarget = async (): Promise<AppTargetResponse[] | null> => {
  try {
    const response = await userApi.get("/app-targets");

    console.log("ListAppTarget raw response:", response.data);

    const data = response.data?.data ?? response.data;

    if (Array.isArray(data)) {
      return data as AppTargetResponse[];
    }

    console.error("Expected array but got:", response.data);
    return null;
  } catch (error) {
    console.error("ListAppTarget error:", error);
    return null;
  }
};

// GET /app-targets/:id
export const ListAppTargetByID = async (
  id: number | string
): Promise<AppTargetResponse | null> => {
  try {
    const response = await userApi.get(`/app-targets/${id}`);

    console.log("ListAppTargetByID raw response:", response.data);

    const data = response.data?.data ?? response.data;

    if (data && typeof data === "object") {
      return data as AppTargetResponse;
    }

    console.error("Unexpected ListAppTargetByID response:", response.data);
    return null;
  } catch (error) {
    console.error("ListAppTargetByID error:", error);
    return null;
  }
};

// POST /create-app-targets
export const CreateAppTarget = async (
  payload: CreateAppTargetInput
): Promise<AppTargetResponse | null> => {
  try {
    const response = await userApi.post("/create-app-targets", payload);

    console.log("CreateAppTarget raw response:", response.data);

    const data = response.data?.data ?? response.data;

    if (data && typeof data === "object") {
      return data as AppTargetResponse;
    }

    console.error("Unexpected CreateAppTarget response:", response.data);
    return null;
  } catch (error) {
    console.error("CreateAppTarget error:", error);
    return null;
  }
};

// PATCH /update-app-targets/:id
export const UpdateTargetByID = async (
  id: number | string,
  payload: UpdateAppTargetInput
): Promise<AppTargetResponse | null> => {
  try {
    const response = await userApi.patch(`/update-app-targets/${id}`, payload);

    console.log("UpdateTargetByID raw response:", response.data);

    const data = response.data?.data ?? response.data;

    if (data && typeof data === "object") {
      return data as AppTargetResponse;
    }

    console.error("Unexpected UpdateTargetByID response:", response.data);
    return null;
  } catch (error) {
    console.error("UpdateTargetByID error:", error);
    return null;
  }
};

// DELETE /delete-app-targets/:id
export const DeleteTargetByID = async (
  id: number | string
): Promise<DeleteAppTargetResponse | null> => {
  try {
    const response = await userApi.delete(`/delete-app-targets/${id}`);

    console.log("DeleteTargetByID raw response:", response.data);

    if (response.data && response.data.message) {
      return response.data as DeleteAppTargetResponse;
    }

    console.error("Unexpected DeleteTargetByID response:", response.data);
    return null;
  } catch (error) {
    console.error("DeleteTargetByID error:", error);
    return null;
  }
};

// =======================
// Location APIs
// =======================

// GET /locations
export const ListLocation = async (): Promise<LocationResponse[] | null> => {
  try {
    const response = await userApi.get("/locations");

    console.log("ListLocation raw response:", response.data);

    const data = response.data?.data ?? response.data;

    if (Array.isArray(data)) {
      return data as LocationResponse[];
    }

    console.error("Expected array but got:", response.data);
    return null;
  } catch (error) {
    console.error("ListLocation error:", error);
    return null;
  }
};

// GET /locations/:id
export const ListLocationByID = async (
  id: number | string
): Promise<LocationResponse | null> => {
  try {
    const response = await userApi.get(`/locations/${id}`);

    console.log("ListLocationByID raw response:", response.data);

    const data = response.data?.data ?? response.data;

    if (data && typeof data === "object") {
      return data as LocationResponse;
    }

    console.error("Unexpected ListLocationByID response:", response.data);
    return null;
  } catch (error) {
    console.error("ListLocationByID error:", error);
    return null;
  }
};

// POST /create-locations
export const CreateLocation = async (
  payload: CreateLocationInput
): Promise<LocationResponse | null> => {
  try {
    const response = await userApi.post("/create-locations", payload);

    console.log("CreateLocation raw response:", response.data);

    const data = response.data?.data ?? response.data;

    if (data && typeof data === "object") {
      return data as LocationResponse;
    }

    console.error("Unexpected CreateLocation response:", response.data);
    return null;
  } catch (error) {
    console.error("CreateLocation error:", error);
    return null;
  }
};

// PATCH /update-locations/:id
export const UpdateLocationByID = async (
  id: number | string,
  payload: UpdateLocationInput
): Promise<LocationResponse | null> => {
  try {
    const response = await userApi.patch(`/update-locations/${id}`, payload);

    console.log("UpdateLocationByID raw response:", response.data);

    const data = response.data?.data ?? response.data;

    if (data && typeof data === "object") {
      return data as LocationResponse;
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

    console.log("DeleteLocationByID raw response:", response.data);

    if (response.data && response.data.message) {
      return response.data as DeleteLocationResponse;
    }

    console.error("Unexpected DeleteLocationByID response:", response.data);
    return null;
  } catch (error) {
    console.error("DeleteLocationByID error:", error);
    return null;
  }
};