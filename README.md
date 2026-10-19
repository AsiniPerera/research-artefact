# Amore Beauty — A Service-Specific Multi-Layered Quality Framework for Personalised Selection of Beauty Service Providers Using Customer Feedback in Sri Lanka


An Undergraduate research artefact: a salon ranking platform that scores salons on
per-aspect evidence extracted from customer reviews, rather than a single
star average. Customers allocate 100 points across six SERVQUAL-grounded
quality categories; the ranking rearranges itself around that, with each
category's score modulated by how much (and how reliable) the review
evidence behind it actually is.

Core formula:

```
F(s) = Σ_c W_c,user · [ R_c^t · C_c + (1 − R_c^t) · μ_c ]
R_c  = (n_c / (n_c + k)) · (1 − σ_c)
```


## Stack

- **Frontend** — React 18 + Vite, plain CSS (no framework), Leaflet for maps
- **Backend** — FastAPI (Python), served with Uvicorn
- **Database** — PostgreSQL (Supabase)
- **LLM extraction pipeline** — Google Gemini (free tier), offline, feeds the scoring pipeline that the platform reads from
- **Deployment** — single Docker image on Render: Node builds the frontend, FastAPI serves both the API and the built static files

## Project structure

```
ResearchDev/
├── backend/api/        # FastAPI app, scoring/ranking endpoints, auth
├── frontend/            # React app (Vite)
│   └── src/
│       ├── screens/     # Landing, Rankings, SalonDetail, About, etc.
│       ├── components/  # Shared UI (badges, drawers, icons)
│       ├── api/          # Fetch wrappers to the backend
│       └── theme.css     # Light-theme override layer on top of index.css
├── data/                # raw / interim / processed review + salon data
├── evaluation/           # accuracy test harness (thesis Table 5.8)
├── docs/                 # project scope, methodology, decisions log
├── Dockerfile            # combined frontend+backend build for Render
└── render.yaml           # Render Blueprint (single Docker web service)
```

## Running locally

**Backend**

```bash
cd backend/api
pip install -r requirements.txt
# create backend/api/.env with:
#   DATABASE_URL=postgresql://...
#   JWT_SECRET=some-dev-secret
uvicorn main:app --reload --port 8000
```

**Frontend**

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server proxies `/api/*` to the backend on port 8000.

## Testing

```bash
cd frontend && npm test          # Vitest, component/unit tests
pytest                            # from repo root, backend/pipeline tests
```

## Deployment

Pushing to `main` triggers a Render rebuild of the single Docker service
defined in `render.yaml`. The Dockerfile builds the frontend first, then
copies the static output into the FastAPI image, which serves the SPA at
`/` and the API at the same origin (no `/api` prefix needed in production —
see `frontend/src/constants/api.js`).

Required Render environment variables: `DATABASE_URL`, `JWT_SECRET`, `RENDER=1`.

## Evaluation

`evaluation/accuracy/accuracy_tests.py` runs the accuracy test suite behind

