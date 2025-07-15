import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay()
  ],
  resolve: {
    alias: {
      "@": path.resolve(".", "client", "src"),
      "@shared": path.resolve(".", "shared"),
      "@assets": path.resolve(".", "attached_assets"),
    },
  },
  root: path.resolve(".", "client"),
  build: {
    outDir: path.resolve(".", "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
