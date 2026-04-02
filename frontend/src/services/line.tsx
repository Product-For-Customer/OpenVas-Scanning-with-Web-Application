import axios from "axios";
import { apiUrl } from "./api";

// =======================
// Axios instance for cookie-based auth
// =======================
const historyNotifyApi = axios.create({
  baseURL: apiUrl,
  withCredentials: true, // ✅ สำคัญมาก
  timeout: 60000,
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

    console.log("ListHistoryNotify raw response:", response.data);

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

    console.log("DeleteHistoryNotifyByIDs raw response:", response.data);

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

// =======================
// API: GET /app-notifications
// =======================
export const ListAppNotification = async (): Promise<AppNotificationResponse[] | null> => {
  try {
    const response = await historyNotifyApi.get("/app-notifications");

    console.log("ListAppNotification raw response:", response.data);

    if (Array.isArray(response.data)) {
      return response.data as AppNotificationResponse[];
    }

    const data = response.data?.data ?? response.data;

    if (Array.isArray(data)) {
      return data as AppNotificationResponse[];
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
// =======================
export const CreateAppNotification = async (
  payload: CreateAppNotificationInput
): Promise<CreateAppNotificationResponse | null> => {
  try {
    const response = await historyNotifyApi.post("/create-app-notifications", payload);

    console.log("CreateAppNotification raw response:", response.data);

    if (
      response.data &&
      typeof response.data === "object" &&
      "message" in response.data &&
      "data" in response.data
    ) {
      return response.data as CreateAppNotificationResponse;
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

    console.log("UpdateAppNotificationByID raw response:", response.data);

    if (
      response.data &&
      typeof response.data === "object" &&
      "message" in response.data &&
      "data" in response.data
    ) {
      return response.data as UpdateAppNotificationResponse;
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

    console.log("DeleteAppNotificationByID raw response:", response.data);

    if (
      response.data &&
      typeof response.data === "object" &&
      "message" in response.data
    ) {
      return response.data as DeleteAppNotificationResponse;
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
  token: string;
};

export type CreateAppLineMasterInput = {
  name: string;
  token: string;
};

export type CreateAppLineMasterResponse = {
  message: string;
  data: AppLineMasterResponse;
};

export type UpdateAppLineMasterInput = {
  name?: string;
  token?: string;
};

export type UpdateAppLineMasterResponse = {
  message: string;
  data: AppLineMasterResponse;
};

export type DeleteAppLineMasterResponse = {
  message: string;
};

// =======================
// API: GET /app-line-masters
// =======================
export const ListAppLineMaster = async (): Promise<AppLineMasterResponse[] | null> => {
  try {
    const response = await historyNotifyApi.get("/app-line-masters");

    console.log("ListAppLineMaster raw response:", response.data);

    if (Array.isArray(response.data)) {
      return response.data as AppLineMasterResponse[];
    }

    const data = response.data?.data ?? response.data;

    if (Array.isArray(data)) {
      return data as AppLineMasterResponse[];
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
// =======================
export const CreateAppLineMaster = async (
  payload: CreateAppLineMasterInput
): Promise<CreateAppLineMasterResponse | null> => {
  try {
    const response = await historyNotifyApi.post("/create-app-line-masters", payload);

    console.log("CreateAppLineMaster raw response:", response.data);

    if (
      response.data &&
      typeof response.data === "object" &&
      "message" in response.data &&
      "data" in response.data
    ) {
      return response.data as CreateAppLineMasterResponse;
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

    console.log("UpdateAppLineMasterByID raw response:", response.data);

    if (
      response.data &&
      typeof response.data === "object" &&
      "message" in response.data &&
      "data" in response.data
    ) {
      return response.data as UpdateAppLineMasterResponse;
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
    const response = await historyNotifyApi.delete(`/delete-app-line-masters/${id}`);

    console.log("DeleteAppLineMasterByID raw response:", response.data);

    if (
      response.data &&
      typeof response.data === "object" &&
      "message" in response.data
    ) {
      return response.data as DeleteAppLineMasterResponse;
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

    console.log("TestLineNotifyByAppNotificationID raw response:", response.data);

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

export default historyNotifyApi;



