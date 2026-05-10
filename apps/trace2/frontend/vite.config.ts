import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? "/",
  plugins: [react()],
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "src"),
      "@connectio/shared-ui": path.resolve(__dirname, "../../../libs/shared-ui"),
      "@connectio/shared-reporting": path.resolve(__dirname, "../../../libs/shared-reporting"),
      "@connectio/shared-app-context": path.resolve(__dirname, "../../../libs/shared-app-context"),
      "@connectio/shared-frontend-i18n": path.resolve(__dirname, "../../../libs/shared-frontend-i18n"),
      "@connectio/shared-frontend-api": path.resolve(__dirname, "../../../libs/shared-frontend-api"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api/t2": { target: "http://localhost:8000", changeOrigin: true },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
