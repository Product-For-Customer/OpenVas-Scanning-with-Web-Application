/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
  build: {
    // Every route in this app is already lazy-loaded (see routes/mainroutes.tsx's
    // Loadable(lazy(...)) pattern), so the large chunks the default build warns
    // about (maplibre-gl, three/@react-three, recharts, apexcharts) are only
    // ever fetched when a user actually navigates to a page that needs them —
    // they don't affect first load. Explicit manualChunks grouping was tried
    // here and reverted: naming a shared dependency's chunk changed Vite's
    // preload analysis and caused it to eagerly <link rel="modulepreload"> a
    // couple of those libraries from index.html — a real regression, worse
    // than the warning it was meant to silence. Raising the warning threshold
    // instead of fighting the bundler is the safe fix for what is otherwise
    // a false alarm.
    chunkSizeWarningLimit: 1200,
  },
});