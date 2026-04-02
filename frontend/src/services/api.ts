import axios from "axios";

export const apiUrl = "https://postdiphtherial-unperishable-carolyn.ngrok-free.dev"; // เปลี่ยนเป็น URL ของ API ของคุณ http://localhost:9000 and https://321a-49-0-82-165.ngrok-free.app

export const defaultHeaders = {
  "Content-Type": "application/json",
  "ngrok-skip-browser-warning": "true",
};

export const baseApi = axios.create({
  baseURL: apiUrl,
  withCredentials: true,
  timeout: 60000,
  headers: defaultHeaders,
});