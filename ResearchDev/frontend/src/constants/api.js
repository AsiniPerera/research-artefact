// In dev, "/api" is proxied to the FastAPI server and the prefix is stripped
// (see vite.config.js). The backend itself mounts routes at the root: /rank, /salons.
export const API = import.meta.env.VITE_API_URL ?? "/api";
