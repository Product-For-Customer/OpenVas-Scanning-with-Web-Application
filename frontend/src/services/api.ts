import axios from "axios";

export const apiUrl = "http://localhost:9000"; // เปลี่ยนเป็น URL ของ API ของคุณ http://localhost:9000 and https://4917-49-0-82-165.ngrok-free.app

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