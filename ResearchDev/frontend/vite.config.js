import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: { sourcemap: false },
  server: {
    proxy: {
      // backend/api mounts routes at the root (/rankings, /providers …), so
      // strip the prefix. 127.0.0.1, not localhost: on Windows localhost can
      // resolve to ::1, which uvicorn does not listen on by default.
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
