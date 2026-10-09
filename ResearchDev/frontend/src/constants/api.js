// In dev, "/api" is proxied to the FastAPI server in backend/api and the
// prefix is stripped (see vite.config.js). Set VITE_API_URL to call the API
// directly instead, e.g. VITE_API_URL=http://127.0.0.1:8000
export const API = import.meta.env.VITE_API_URL ?? "/api";
