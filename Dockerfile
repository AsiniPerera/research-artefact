# Builds and serves the whole Amore Beauty app as one service: the FastAPI
# backend (backend/api) serves its own JSON routes AND the built React
# frontend (frontend/dist), so the browser talks to a single origin and no
# cross-service rewrite/proxy is needed. See backend/api/main.py's static
# mount at the bottom of the file.
#
# Two stages because Render's native "python" runtime has no Node/npm, and
# its native "node" runtime has no Python -- so the frontend is built with
# Node in a throwaway stage, and only its build output (frontend/dist) is
# copied into the final Python stage that actually runs.

FROM node:20-alpine AS frontend-build
WORKDIR /src/frontend
COPY ResearchDev/frontend/package.json ResearchDev/frontend/package-lock.json ./
RUN npm ci
COPY ResearchDev/frontend/ ./
RUN npm run build

FROM python:3.12-slim
WORKDIR /app/backend/api
COPY ResearchDev/backend/api/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY ResearchDev/backend/api/ ./
# Lands at /app/frontend/dist -- three levels above this file's own
# directory (/app/backend/api), which is the same relative layout main.py
# expects locally (backend/api/../../frontend/dist).
COPY --from=frontend-build /src/frontend/dist /app/frontend/dist

# Render sets $PORT; a plain default lets the image also run with
# `docker run -p 8000:8000 ...` outside Render.
ENV PORT=8000
EXPOSE 8000
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
