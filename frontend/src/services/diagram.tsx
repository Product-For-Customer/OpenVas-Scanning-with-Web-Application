import axios from "axios";
import { apiUrl, installMaintenanceInterceptor } from "./api";

// =======================
// Axios instance for cookie-based auth
// =======================
const diagramApi = axios.create({
  baseURL: apiUrl,
  withCredentials: true,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
  },
});

installMaintenanceInterceptor(diagramApi);

// =======================
// Types: Diagram
// =======================
export type DiagramResponse = {
  id: number;
  name: string;
  description: string;
  image_base64: string;
  app_user_id: number;
  created_at?: string;
  updated_at?: string;
  message?: string;
  error?: string;
};

export type CreateDiagramInput = {
  name: string;
  description?: string;
  image_base64: string;
};

export type UpdateDiagramInput = {
  name?: string;
  description?: string;
  image_base64?: string;
};

export type DeleteDiagramResponse = {
  message: string;
};

// =======================
// Types: AppDiagramNode
// =======================
type DiagramInfo = {
  id: number;
  name: string;
  description: string;
  image_base64: string;
  app_user_id: number;
  created_at?: string;
  updated_at?: string;
};

type AppLocationResponse = {
  id: number;
  location: string;
  building: string;
  floor: number;
  latitude: number;
  longtitude: number;
  app_diagram_node_id: number;
  created_at?: string;
  updated_at?: string;
};

export type AppDiagramNodeResponse = {
  id: number;
  diagram_id: number;
  diagram?: DiagramInfo | null;
  app_user_id: number;
  task_id: string;
  label: string;
  description: string;
  icon: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z_index: number;
  app_locations?: AppLocationResponse[];
  created_at?: string;
  updated_at?: string;
  message?: string;
  error?: string;
};

export type CreateAppDiagramNodeInput = {
  diagram_id: number;
  task_id?: string;
  label: string;
  description?: string;
  icon?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  z_index?: number;
};

export type UpdateAppDiagramNodeInput = {
  diagram_id?: number;
  task_id?: string;
  label?: string;
  description?: string;
  icon?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  z_index?: number;
};

export type DeleteAppDiagramNodeResponse = {
  message: string;
};

// =======================
// Helpers
// =======================
const normalizeDiagram = (item: any): DiagramResponse => {
  return {
    id: Number(item?.id ?? item?.ID ?? 0),
    name: String(item?.name ?? item?.Name ?? ""),
    description: String(item?.description ?? item?.Description ?? ""),
    image_base64: String(item?.image_base64 ?? item?.ImageBase64 ?? ""),
    app_user_id: Number(item?.app_user_id ?? item?.AppUserID ?? 0),
    created_at: item?.created_at ?? item?.CreatedAt ?? undefined,
    updated_at: item?.updated_at ?? item?.UpdatedAt ?? undefined,
    message: item?.message,
    error: item?.error,
  };
};

const normalizeDiagramInfo = (item: any): DiagramInfo | null => {
  if (!item || typeof item !== "object") {
    return null;
  }

  return {
    id: Number(item?.id ?? item?.ID ?? 0),
    name: String(item?.name ?? item?.Name ?? ""),
    description: String(item?.description ?? item?.Description ?? ""),
    image_base64: String(item?.image_base64 ?? item?.ImageBase64 ?? ""),
    app_user_id: Number(item?.app_user_id ?? item?.AppUserID ?? 0),
    created_at: item?.created_at ?? item?.CreatedAt ?? undefined,
    updated_at: item?.updated_at ?? item?.UpdatedAt ?? undefined,
  };
};

const normalizeAppLocation = (item: any): AppLocationResponse => {
  return {
    id: Number(item?.id ?? item?.ID ?? 0),
    location: String(item?.location ?? item?.Location ?? ""),
    building: String(item?.building ?? item?.Building ?? ""),
    floor: Number(item?.floor ?? item?.Floor ?? 0),
    latitude: Number(item?.latitude ?? item?.Latitude ?? 0),
    longtitude: Number(item?.longtitude ?? item?.Longtitude ?? 0),
    app_diagram_node_id: Number(
      item?.app_diagram_node_id ?? item?.AppDiagramNodeID ?? 0
    ),
    created_at: item?.created_at ?? item?.CreatedAt ?? undefined,
    updated_at: item?.updated_at ?? item?.UpdatedAt ?? undefined,
  };
};

const normalizeAppDiagramNode = (item: any): AppDiagramNodeResponse => {
  const appLocations = item?.app_locations ?? item?.AppLocations;

  return {
    id: Number(item?.id ?? item?.ID ?? 0),
    diagram_id: Number(item?.diagram_id ?? item?.DiagramID ?? 0),
    diagram: normalizeDiagramInfo(item?.diagram ?? item?.Diagram),
    app_user_id: Number(item?.app_user_id ?? item?.AppUserID ?? 0),
    task_id: String(item?.task_id ?? item?.TaskID ?? ""),
    label: String(item?.label ?? item?.Label ?? ""),
    description: String(item?.description ?? item?.Description ?? ""),
    icon: String(item?.icon ?? item?.Icon ?? ""),
    x: Number(item?.x ?? item?.X ?? 0),
    y: Number(item?.y ?? item?.Y ?? 0),
    width: Number(item?.width ?? item?.Width ?? 0),
    height: Number(item?.height ?? item?.Height ?? 0),
    z_index: Number(item?.z_index ?? item?.ZIndex ?? 1),
    app_locations: Array.isArray(appLocations)
      ? appLocations.map((location) => normalizeAppLocation(location))
      : [],
    created_at: item?.created_at ?? item?.CreatedAt ?? undefined,
    updated_at: item?.updated_at ?? item?.UpdatedAt ?? undefined,
    message: item?.message,
    error: item?.error,
  };
};

// =======================
// Diagram APIs
// =======================

// GET /diagrams
export const ListDiagrams = async (): Promise<DiagramResponse[] | null> => {
  try {
    const response = await diagramApi.get("/diagrams");

    const data = response.data?.data ?? response.data;

    if (Array.isArray(data)) {
      return data.map((item) => normalizeDiagram(item));
    }

    console.error("Expected diagram array but got:", response.data);
    return null;
  } catch (error) {
    console.error("ListDiagrams error:", error);
    return null;
  }
};

// GET /diagrams/:id
export const ListDiagramByID = async (
  id: number | string
): Promise<DiagramResponse | null> => {
  try {
    const response = await diagramApi.get(`/diagrams/${id}`);

    const data = response.data?.data ?? response.data;

    if (data && typeof data === "object") {
      return normalizeDiagram(data);
    }

    console.error("Unexpected ListDiagramByID response:", response.data);
    return null;
  } catch (error) {
    console.error("ListDiagramByID error:", error);
    return null;
  }
};

// POST /create-diagrams
// app_user_id ไม่ต้องส่งจาก frontend
// backend จะใช้ user_id จากคนที่ login อยู่
export const CreateDiagram = async (
  payload: CreateDiagramInput
): Promise<DiagramResponse | null> => {
  try {
    const response = await diagramApi.post("/create-diagrams", payload);

    const data = response.data?.data ?? response.data;

    if (data && typeof data === "object") {
      return normalizeDiagram(data);
    }

    console.error("Unexpected CreateDiagram response:", response.data);
    return null;
  } catch (error) {
    console.error("CreateDiagram error:", error);
    return null;
  }
};

// PATCH /update-diagrams/:id
// app_user_id ไม่ต้องส่งจาก frontend
// backend จะใช้ user_id จากคนที่ login อยู่
export const UpdateDiagramByID = async (
  id: number | string,
  payload: UpdateDiagramInput
): Promise<DiagramResponse | null> => {
  try {
    const response = await diagramApi.patch(`/update-diagrams/${id}`, payload);

    const data = response.data?.data ?? response.data;

    if (data && typeof data === "object") {
      return normalizeDiagram(data);
    }

    console.error("Unexpected UpdateDiagramByID response:", response.data);
    return null;
  } catch (error) {
    console.error("UpdateDiagramByID error:", error);
    return null;
  }
};

// DELETE /delete-diagrams/:id
export const DeleteDiagramByID = async (
  id: number | string
): Promise<DeleteDiagramResponse | null> => {
  try {
    const response = await diagramApi.delete(`/delete-diagrams/${id}`);

    if (response.data && response.data.message) {
      return {
        message: String(response.data.message),
      };
    }

    console.error("Unexpected DeleteDiagramByID response:", response.data);
    return null;
  } catch (error) {
    console.error("DeleteDiagramByID error:", error);
    return null;
  }
};

// =======================
// AppDiagramNode APIs
// =======================

// GET /diagram-nodes
export const ListAppDiagramNodes = async (): Promise<
  AppDiagramNodeResponse[] | null
> => {
  try {
    const response = await diagramApi.get("/diagram-nodes");

    const data = response.data?.data ?? response.data;

    if (Array.isArray(data)) {
      return data.map((item) => normalizeAppDiagramNode(item));
    }

    console.error("Expected app diagram node array but got:", response.data);
    return null;
  } catch (error) {
    console.error("ListAppDiagramNodes error:", error);
    return null;
  }
};

// GET /diagram-nodes/:id
export const ListAppDiagramNodeByID = async (
  id: number | string
): Promise<AppDiagramNodeResponse | null> => {
  try {
    const response = await diagramApi.get(`/diagram-nodes/${id}`);

    const data = response.data?.data ?? response.data;

    if (data && typeof data === "object") {
      return normalizeAppDiagramNode(data);
    }

    console.error("Unexpected ListAppDiagramNodeByID response:", response.data);
    return null;
  } catch (error) {
    console.error("ListAppDiagramNodeByID error:", error);
    return null;
  }
};

// POST /create-diagram-nodes
// app_user_id ไม่ต้องส่งจาก frontend
// backend จะใช้ user_id จากคนที่ login อยู่
export const CreateAppDiagramNode = async (
  payload: CreateAppDiagramNodeInput
): Promise<AppDiagramNodeResponse | null> => {
  try {
    const response = await diagramApi.post("/create-diagram-nodes", payload);

    const data = response.data?.data ?? response.data;

    if (data && typeof data === "object") {
      return normalizeAppDiagramNode(data);
    }

    console.error("Unexpected CreateAppDiagramNode response:", response.data);
    return null;
  } catch (error) {
    console.error("CreateAppDiagramNode error:", error);
    return null;
  }
};

// PATCH /update-diagram-nodes/:id
// app_user_id ไม่ต้องส่งจาก frontend
// backend จะใช้ user_id จากคนที่ login อยู่
export const UpdateAppDiagramNodeByID = async (
  id: number | string,
  payload: UpdateAppDiagramNodeInput
): Promise<AppDiagramNodeResponse | null> => {
  try {
    const response = await diagramApi.patch(`/update-diagram-nodes/${id}`, payload);

    const data = response.data?.data ?? response.data;

    if (data && typeof data === "object") {
      return normalizeAppDiagramNode(data);
    }

    console.error("Unexpected UpdateAppDiagramNodeByID response:", response.data);
    return null;
  } catch (error) {
    console.error("UpdateAppDiagramNodeByID error:", error);
    return null;
  }
};

// DELETE /delete-diagram-nodes/:id
export const DeleteAppDiagramNodeByID = async (
  id: number | string
): Promise<DeleteAppDiagramNodeResponse | null> => {
  try {
    const response = await diagramApi.delete(`/delete-diagram-nodes/${id}`);

    if (response.data && response.data.message) {
      return {
        message: String(response.data.message),
      };
    }

    console.error("Unexpected DeleteAppDiagramNodeByID response:", response.data);
    return null;
  } catch (error) {
    console.error("DeleteAppDiagramNodeByID error:", error);
    return null;
  }
};