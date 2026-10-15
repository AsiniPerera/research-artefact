import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: { sourcemap: false },
  // Vitest reads this same config. jsdom gives the component tests a DOM;
  // CSS imports are stubbed (left unprocessed) so a component can import its
  // stylesheet without the test needing to parse it.
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.js",
    include: ["src/**/*.test.{js,jsx}"],
  },
  server: {
    // Pinned. Without strictPort, a dev server left running from an earlier
    // session makes Vite silently pick 5174 instead, and the app then loads
    // from an address that is not the one being worked on. Failing to start
    // is the useful behaviour here: it says the port is taken.
    port: 5173,
    strictPort: true,
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
