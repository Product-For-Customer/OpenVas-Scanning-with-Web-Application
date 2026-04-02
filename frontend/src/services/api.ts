import axios from "axios";

export const apiUrl = "https://c21f-58-8-174-156.ngrok-free.app"; // เปลี่ยนเป็น URL ของ API ของคุณ http://localhost:9000 and https://321a-49-0-82-165.ngrok-free.app

export const defaultHeaders = {
  "Content-Type": "application/json",
  "ngrok-skip-browser-warning": "true",
};

export const baseApi = axios.create({
  baseURL: apiUrl,
  withCredentials: true,
  timeout: 240000,
  headers: defaultHeaders,
});