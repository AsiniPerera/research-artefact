// In dev, "/api" is proxied to the FastAPI server in backend/api and the
// prefix is stripped (see vite.config.js). In a production build, FastAPI
// serves this same built frontend directly (backend/api/main.py's static
// mount) and its routes are not under an /api prefix, so the built app
// calls bare paths ("/rankings/…") against its own origin instead. Set
// VITE_API_URL to override either case, e.g. VITE_API_URL=http://127.0.0.1:8000
export const API = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "/api" : "");
