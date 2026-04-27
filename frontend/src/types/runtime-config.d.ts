export {};

declare global {
  interface Window {
    __APP_CONFIG__?: {
      VITE_BACKEND_URL?: string;
      VITE_OPENVAS_URL?: string;
    };
  }
}