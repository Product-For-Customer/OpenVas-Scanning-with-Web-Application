import { VITE_BACKEND_URL, VITE_OPENVAS_URL } from "../config/runtimeConfig";

export const apiUrl: string = VITE_BACKEND_URL || "http://localhost:9000";

export const pathOpenVas: string =
  VITE_OPENVAS_URL || "http://localhost:9392";

export const defaultHeaders = {
  "Content-Type": "application/json",
  "ngrok-skip-browser-warning": "true",
};
