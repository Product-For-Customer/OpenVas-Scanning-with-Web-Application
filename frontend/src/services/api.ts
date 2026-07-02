import axios, { type AxiosInstance } from "axios";

const envBackendUrl = import.meta.env.VITE_BACKEND_URL;
const envOpenVasUrl = import.meta.env.VITE_OPENVAS_URL;

export const apiUrl: string = envBackendUrl || "http://localhost:9000";

export const pathOpenVas: string =
  envOpenVasUrl || "http://localhost:9392";

const defaultHeaders = {
  "Content-Type": "application/json",
  "ngrok-skip-browser-warning": "true",
};


export const baseApi = axios.create({
  baseURL: apiUrl,
  withCredentials: true,
  timeout: 15000,
  headers: defaultHeaders,
});

// A 503 with this error body means maintenance mode is blocking the request
// (see backend middleware/authorization.go). Fire a global event so
// AuthContext / MaintenanceCountdown can react without every caller having
// to know about maintenance mode. /auth/login is excluded — that 503 is
// handled directly in the login form.
export const installMaintenanceInterceptor = (instance: AxiosInstance) => {
  instance.interceptors.response.use(
    (res) => res,
    (error) => {
      const status = error?.response?.status;
      const url: string = error?.config?.url || "";
      const isLoginEndpoint = url.includes("/auth/login");
      if (
        status === 503 &&
        error?.response?.data?.error === "system is under maintenance" &&
        !isLoginEndpoint
      ) {
        window.dispatchEvent(new CustomEvent("session:maintenance"));
      }
      return Promise.reject(error);
    }
  );
};

installMaintenanceInterceptor(baseApi);