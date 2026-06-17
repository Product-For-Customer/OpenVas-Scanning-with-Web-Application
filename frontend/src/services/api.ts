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


export const baseApi = axios.create({
  baseURL: apiUrl,
  withCredentials: true,
  timeout: 15000,
  headers: defaultHeaders,
});