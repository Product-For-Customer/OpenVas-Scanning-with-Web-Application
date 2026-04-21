import axios from "axios";
// test api : http://192.168.0.134:9000 , http://10.10.20.169:9000 
export const apiUrl = "https://bayleigh-fendered-uncaustically.ngrok-free.dev"; // เปลี่ยนเป็น URL ของ API ของคุณ http://localhost:9000 and https://bayleigh-fendered-uncaustically.ngrok-free.dev
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