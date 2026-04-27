import axios from "axios";
import { VITE_BACKEND_URL, VITE_OPENVAS_URL } from "../config/runtimeConfig";

export const apiUrl: string = VITE_BACKEND_URL || "http://localhost:9000";

export const pathOpenVas: string =
  VITE_OPENVAS_URL || "http://localhost:9392";

export const defaultHeaders = {
  "Content-Type": "application/json",
  "ngrok-skip-browser-warning": "true",
};

console.groupCollapsed("API CONFIG DEBUG");
console.log("Runtime VITE_BACKEND_URL:", VITE_BACKEND_URL);
console.log("Runtime VITE_OPENVAS_URL:", VITE_OPENVAS_URL);
console.log("Final apiUrl:", apiUrl);
console.log("Final pathOpenVas:", pathOpenVas);
console.groupEnd();

export const baseApi = axios.create({
  baseURL: apiUrl,
  withCredentials: true,
  timeout: 15000,
  headers: defaultHeaders,
});