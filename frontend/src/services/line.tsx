import axios from "axios";
import { apiUrl } from "./api";

// =======================
// Axios instance for cookie-based auth
// =======================
const historyNotifyApi = axios.create({
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
export type HistoryNotifyResponse = {
  id: number;
  subject: string;
  datetime: string;
  description: string;
  status: string;
  status_id: number | null;
  created_at: string;
  updated_at: string;
};

export type DeleteHistoryNotifyByIDsInput = {
  ids: number[];
};

export type DeleteHistoryNotifyByIDsResponse = {
  message: string;
  deleted_count: number;
  requested_ids: number[];
};

// =======================
// API: GET /history-notifies
// =======================
export const ListHistoryNotify = async (): Promise<HistoryNotifyResponse[] | null> => {
  try {
    const response = await historyNotifyApi.get("/history-notifies");

    if (Array.isArray(response.data)) {
      return response.data as HistoryNotifyResponse[];
    }

    const data = response.data?.data ?? response.data;

    if (Array.isArray(data)) {
      return data as HistoryNotifyResponse[];
    }

    console.error("Expected array but got:", response.data);
    return null;
  } catch (error) {
    console.error("ListHistoryNotify error:", error);
    return null;
  }
};

// =======================
// API: DELETE /delete-history-notifies
// body: { ids: [1,2,3] }
// =======================
export const DeleteHistoryNotifyByIDs = async (
  payload: DeleteHistoryNotifyByIDsInput
): Promise<DeleteHistoryNotifyByIDsResponse | null> => {
  try {
    const response = await historyNotifyApi.delete("/delete-history-notifies", {
      data: payload,
    });

    if (
      response.data &&
      typeof response.data === "object" &&
      "message" in response.data
    ) {
      return response.data as DeleteHistoryNotifyByIDsResponse;
    }

    console.error("Unexpected DeleteHistoryNotifyByIDs response:", response.data);
    return null;
  } catch (error) {
    console.error("DeleteHistoryNotifyByIDs error:", error);
    return null;
  }
};

// =======================
// Types
// =======================
export type AppNotificationResponse = {
  id: number;
  name: string;
  send_id: string;
  alert: boolean;
  is_group: boolean;
  app_line_master_id: number;
  app_user_id: number;
};

export type CreateAppNotificationInput = {
  name: string;
  send_id: string;
  alert: boolean;
  is_group: boolean;
  app_line_master_id: number;
};

export type CreateAppNotificationResponse = {
  message: string;
  data: AppNotificationResponse;
};

export type UpdateAppNotificationInput = {
  name?: string;
  send_id?: string;
  alert?: boolean;
  is_group?: boolean;
  app_line_master_id?: number;
};

export type UpdateAppNotificationResponse = {
  message: string;
  data: AppNotificationResponse;
};

export type DeleteAppNotificationResponse = {
  message: string;
};

const normalizeAppNotification = (item: any): AppNotificationResponse => {
  return {
    id: Number(item?.id ?? item?.ID ?? 0),
    name: String(item?.name ?? item?.Name ?? ""),
    send_id: String(item?.send_id ?? item?.SendID ?? ""),
    alert: Boolean(item?.alert ?? item?.Alert ?? false),
    is_group: Boolean(item?.is_group ?? item?.IsGroup ?? false),
    app_line_master_id: Number(
      item?.app_line_master_id ?? item?.AppLineMasterID ?? 0
    ),
    app_user_id: Number(item?.app_user_id ?? item?.AppUserID ?? 0),
  };
};

// =======================
// API: GET /app-notifications
// =======================
export const ListAppNotification = async (): Promise<
  AppNotificationResponse[] | null
> => {
  try {
    const response = await historyNotifyApi.get("/app-notifications");

    if (Array.isArray(response.data)) {
      return response.data.map((item) => normalizeAppNotification(item));
    }

    const data = response.data?.data ?? response.data;

    if (Array.isArray(data)) {
      return data.map((item) => normalizeAppNotification(item));
    }

    console.error("Expected array but got:", response.data);
    return null;
  } catch (error) {
    console.error("ListAppNotification error:", error);
    return null;
  }
};

// =======================
// API: POST /create-app-notifications
// app_user_id ไม่ต้องส่งจาก frontend
// backend จะใช้ user_id จากคนที่ login อยู่
// =======================
export const CreateAppNotification = async (
  payload: CreateAppNotificationInput
): Promise<CreateAppNotificationResponse | null> => {
  try {
    const response = await historyNotifyApi.post(
      "/create-app-notifications",
      payload
    );

    if (
      response.data &&
      typeof response.data === "object" &&
      "message" in response.data &&
      "data" in response.data
    ) {
      return {
        message: String(response.data.message),
        data: normalizeAppNotification(response.data.data),
      };
    }

    console.error("Unexpected CreateAppNotification response:", response.data);
    return null;
  } catch (error) {
    console.error("CreateAppNotification error:", error);
    return null;
  }
};

// =======================
// API: PATCH /update-app-notifications/:id
// app_user_id ไม่ต้องส่งจาก frontend
// backend จะใช้ user_id จากคนที่ login อยู่
// =======================
export const UpdateAppNotificationByID = async (
  id: number,
  payload: UpdateAppNotificationInput
): Promise<UpdateAppNotificationResponse | null> => {
  try {
    const response = await historyNotifyApi.patch(
      `/update-app-notifications/${id}`,
      payload
    );

    if (
      response.data &&
      typeof response.data === "object" &&
      "message" in response.data &&
      "data" in response.data
    ) {
      return {
        message: String(response.data.message),
        data: normalizeAppNotification(response.data.data),
      };
    }

    console.error("Unexpected UpdateAppNotificationByID response:", response.data);
    return null;
  } catch (error) {
    console.error("UpdateAppNotificationByID error:", error);
    return null;
  }
};

// =======================
// API: DELETE /delete-app-notifications/:id
// =======================
export const DeleteAppNotificationByID = async (
  id: number
): Promise<DeleteAppNotificationResponse | null> => {
  try {
    const response = await historyNotifyApi.delete(
      `/delete-app-notifications/${id}`
    );

    if (
      response.data &&
      typeof response.data === "object" &&
      "message" in response.data
    ) {
      return {
        message: String(response.data.message),
      };
    }

    console.error("Unexpected DeleteAppNotificationByID response:", response.data);
    return null;
  } catch (error) {
    console.error("DeleteAppNotificationByID error:", error);
    return null;
  }
};

// =======================
// Types
// =======================
export type AppLineMasterResponse = {
  id: number;
  name: string;
  description: string;
  token: string;
  app_user_id: number;
};

export type CreateAppLineMasterInput = {
  name: string;
  description: string;
  token: string;
};

export type CreateAppLineMasterResponse = {
  message: string;
  data: AppLineMasterResponse;
};

export type UpdateAppLineMasterInput = {
  name?: string;
  description?: string;
  token?: string;
};

export type UpdateAppLineMasterResponse = {
  message: string;
  data: AppLineMasterResponse;
};

export type DeleteAppLineMasterResponse = {
  message: string;
};

const normalizeAppLineMaster = (item: any): AppLineMasterResponse => {
  return {
    id: Number(item?.id ?? item?.ID ?? 0),
    name: String(item?.name ?? item?.Name ?? ""),
    description: String(item?.description ?? item?.Description ?? ""),
    token: String(item?.token ?? item?.Token ?? ""),
    app_user_id: Number(item?.app_user_id ?? item?.AppUserID ?? 0),
  };
};

// =======================
// API: GET /app-line-masters
// =======================
export const ListAppLineMaster = async (): Promise<
  AppLineMasterResponse[] | null
> => {
  try {
    const response = await historyNotifyApi.get("/app-line-masters");

    if (Array.isArray(response.data)) {
      return response.data.map((item) => normalizeAppLineMaster(item));
    }

    const data = response.data?.data ?? response.data;

    if (Array.isArray(data)) {
      return data.map((item) => normalizeAppLineMaster(item));
    }

    console.error("Expected array but got:", response.data);
    return null;
  } catch (error) {
    console.error("ListAppLineMaster error:", error);
    return null;
  }
};

// =======================
// API: POST /create-app-line-masters
// app_user_id ไม่ต้องส่งจาก frontend
// backend จะใช้ user_id จากคนที่ login อยู่
// =======================
export const CreateAppLineMaster = async (
  payload: CreateAppLineMasterInput
): Promise<CreateAppLineMasterResponse | null> => {
  try {
    const response = await historyNotifyApi.post(
      "/create-app-line-masters",
      payload
    );

    if (
      response.data &&
      typeof response.data === "object" &&
      "message" in response.data &&
      "data" in response.data
    ) {
      return {
        message: String(response.data.message),
        data: normalizeAppLineMaster(response.data.data),
      };
    }

    console.error("Unexpected CreateAppLineMaster response:", response.data);
    return null;
  } catch (error) {
    console.error("CreateAppLineMaster error:", error);
    return null;
  }
};

// =======================
// API: PATCH /update-app-line-masters/:id
// app_user_id ไม่ต้องส่งจาก frontend
// backend จะใช้ user_id จากคนที่ login อยู่
// =======================
export const UpdateAppLineMasterByID = async (
  id: number,
  payload: UpdateAppLineMasterInput
): Promise<UpdateAppLineMasterResponse | null> => {
  try {
    const response = await historyNotifyApi.patch(
      `/update-app-line-masters/${id}`,
      payload
    );

    if (
      response.data &&
      typeof response.data === "object" &&
      "message" in response.data &&
      "data" in response.data
    ) {
      return {
        message: String(response.data.message),
        data: normalizeAppLineMaster(response.data.data),
      };
    }

    console.error("Unexpected UpdateAppLineMasterByID response:", response.data);
    return null;
  } catch (error) {
    console.error("UpdateAppLineMasterByID error:", error);
    return null;
  }
};

// =======================
// API: DELETE /delete-app-line-masters/:id
// =======================
export const DeleteAppLineMasterByID = async (
  id: number
): Promise<DeleteAppLineMasterResponse | null> => {
  try {
    const response = await historyNotifyApi.delete(
      `/delete-app-line-masters/${id}`
    );

    if (
      response.data &&
      typeof response.data === "object" &&
      "message" in response.data
    ) {
      return {
        message: String(response.data.message),
      };
    }

    console.error("Unexpected DeleteAppLineMasterByID response:", response.data);
    return null;
  } catch (error) {
    console.error("DeleteAppLineMasterByID error:", error);
    return null;
  }
};

//

// =======================
// Types
// =======================
export type TestLineNotifyByAppNotificationIDInput = {
  app_notification_id: number;
  message: string;
};

export type TestLineNotifyByAppNotificationIDResponse = {
  success: boolean;
  message: string;
  data?: {
    app_notification_id: number;
    name: string;
    send_id: string;
    alert: boolean;
    app_line_master_id: number;
    line_master_name: string;
    text: string;
  };
  error?: string;
};

// =======================
// API: POST /line/test-notify
// body: { app_notification_id, message }
// =======================
export const TestLineNotifyByAppNotificationID = async (
  payload: TestLineNotifyByAppNotificationIDInput
): Promise<TestLineNotifyByAppNotificationIDResponse | null> => {
  try {
    const response = await historyNotifyApi.post("/line/test-notify", payload);

    if (
      response.data &&
      typeof response.data === "object" &&
      "success" in response.data
    ) {
      return response.data as TestLineNotifyByAppNotificationIDResponse;
    }

    console.error(
      "Unexpected TestLineNotifyByAppNotificationID response:",
      response.data
    );
    return null;
  } catch (error) {
    console.error("TestLineNotifyByAppNotificationID error:", error);
    return null;
  }
};

// =======================
// Types
// =======================
export type TriggerCleanupResponse = {
  message: string;
  deleted_count: number;
  cutoff: string;
};

// =======================
// API: POST /history-notifies/cleanup
// Manually trigger the 6-month auto-delete cleanup
// =======================
export const TriggerHistoryNotifyCleanup = async (): Promise<TriggerCleanupResponse | null> => {
  try {
    const response = await historyNotifyApi.post("/history-notifies/cleanup");
    if (
      response.data &&
      typeof response.data === "object" &&
      "message" in response.data
    ) {
      return response.data as TriggerCleanupResponse;
    }
    console.error("Unexpected TriggerHistoryNotifyCleanup response:", response.data);
    return null;
  } catch (error) {
    console.error("TriggerHistoryNotifyCleanup error:", error);
    return null;
  }
};