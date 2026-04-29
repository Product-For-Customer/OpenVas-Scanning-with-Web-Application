import axios from "axios";

const envBackendUrl = import.meta.env.VITE_BACKEND_URL;
const envOpenVasUrl = import.meta.env.VITE_OPENVAS_URL;

export const apiUrl: string = envBackendUrl || "http://localhost:9000";

export const pathOpenVas: string =
  envOpenVasUrl || "http://localhost:9392";

export const defaultHeaders = {
  "Content-Type": "application/json",
  "ngrok-skip-browser-warning": "true",
};

console.groupCollapsed("API CONFIG DEBUG");
console.log("MODE:", import.meta.env.MODE);
console.log("DEV:", import.meta.env.DEV);
console.log("PROD:", import.meta.env.PROD);
console.log("VITE_BACKEND_URL from env:", envBackendUrl);
console.log("VITE_OPENVAS_URL from env:", envOpenVasUrl);
console.log("Final apiUrl:", apiUrl);
console.log("Final pathOpenVas:", pathOpenVas);
console.log("All import.meta.env:", import.meta.env);
console.groupEnd();

export const baseApi = axios.create({
  baseURL: apiUrl,
  withCredentials: true,
  timeout: 15000,
  headers: defaultHeaders,
});