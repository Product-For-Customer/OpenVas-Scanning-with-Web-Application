type AppConfig = {
  VITE_BACKEND_URL: string;
  VITE_OPENVAS_URL: string;
};

declare global {
  interface Window {
    __APP_CONFIG__?: Partial<AppConfig>;
  }
}

const config = window.__APP_CONFIG__ ?? {};

export const VITE_BACKEND_URL =
  config.VITE_BACKEND_URL || "http://localhost:9000";

export const VITE_OPENVAS_URL =
  config.VITE_OPENVAS_URL || "http://localhost:9392";