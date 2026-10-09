# Beauty Service Ranking — Research Artefact

Thesis artefact (Design Science Research). It ranks beauty service providers in Colombo District, Sri Lanka, per service, from Google review evidence instead of star ratings. A user picks a service, sets how much each of seven quality categories matters to them, and gets a ranked list with the reasons.

## The framework (v4)

Seven weighted categories plus a reported-only verdict. 25 sub-points plus `overall`.

| Cat | Category | Sub-points | Source |
|---|---|---|---|
| 1 | Quality of Work | 1.1 – 1.3 | review evidence |
| 2 | Consultation, Care & Aftercare | 2.1 – 2.3 | review evidence |
| 3 | Management Responsiveness & Continuous Improvement | 3.1 – 3.4 | review evidence + owner replies (3.1 is computed) |
| 4 | Customer Trust & Recommendation | 4.1 – 4.2 | review evidence |
| 5 | Staff & Customer Service | 5.1 – 5.5 | review evidence |
| 6 | Value & Price Honesty | 6.1 – 6.3 | review evidence |
| 7 | Safety, Hygiene & Facilities | 7.1 – 7.5 | review evidence (7.1–7.3 are safety) |
| 8 | **Overall Verdict** | `overall` | review evidence — **reported only** |

Category 8 carries `weight = 0` and `is_score = false`. It is scored and stored
so the app can show it, but it is **excluded from `base_score` and from the
user's weights**, which are therefore seven numbers. `overall` summarises the
other seven — weighting it would count the same opinion twice. It is also
excluded from the precision range, so it cannot lend confidence to a score it
does not contribute to.

Nothing about the framework is hard-coded in the scoring, the API or the front
end's weighting control: all of it is read from `ref.framework_category.weight`
and the `ref.sub_point` flags.

## Hard rules

- **The framework and taxonomy are frozen.** Do not add, rename, merge or remove quality categories, sub-points, services, sub-services, roles, gates, vetoes, thresholds or weights. If a task seems to need that, stop and ask.
- **Never edit data by hand** in `ref`, `raw`, `extract` or `score`. `score` is rebuilt only by `backend/salon_db/06_run_scoring.py`.
- **Ranking logic lives in the database** (`score.rank_providers`, and `score.rank_providers_group` one level up). The front end and API must not re-implement or re-order rankings, and must never show a provider with a safety concern as ranked.
- **Secrets:** the database password is only in `backend/api/.env`. Never print it, commit it, or put it in front-end code. The front end talks to the API only, never to Supabase directly.
- **Ask before** changing the database schema, adding a dependency, or deleting files.
- Before the first change in a session, list the existing folders and read what is already there. Do not overwrite existing work without asking.

## Stack

- Database: PostgreSQL on Supabase (session pooler, port 5432)
- Backend: Python, FastAPI, psycopg2 — `backend/api/main.py`
- Front end: React + TypeScript (Vite)
- Data scripts: Python (pandas, scipy) — `backend/salon_db/`

## Layout

```
ResearchDev/
  CLAUDE.md
  backend/
    api/            FastAPI app: main.py, requirements.txt, .env (secret), .env.example
    salon_db/       01_schema.sql, 02_reference_data.sql, 03_load_data.py, 04_checks.sql,
                    05_tiers_and_scoring_schema.sql, 06_run_scoring.py,
                    07_group_level_ranking.sql, data/*.csv
  frontend/         React app (create with Vite if it does not exist; check first)
```

## Commands

```
# database (once, in the Supabase SQL Editor) — only if rebuilding from scratch
#   01 … 06 as before, then:
#   07_group_level_ranking.sql       adds score.rank_providers_group (additive, re-runnable)

# backend (from backend/api)
pip install -r requirements.txt
uvicorn main:app --reload            # http://127.0.0.1:8000  — interactive docs at /docs

# front end (from frontend)
npm install
npm run dev                          # http://localhost:5173
```

## Database (already built and loaded — read only for the app)

Snowflake schema. Fact table `extract.evidence_item`; dimensions branch out.

| Schema | Tables | Purpose |
|---|---|---|
| `ref` | `service_category` → `service` → `sub_service` (with `tier` 1–5); `framework_category` → `sub_point` | Taxonomy v9 (5 / 17 / 51) and framework v4 (8 / 26) |
| `raw` | `provider` (PK `place_id`), `review` (PK `review_id`), `owner_reply` | Source data: 549 providers, 27,122 reviews |
| `extract` | `extraction_run`, `evidence_item`, `review_assessment`, `reply_assessment`, `gold_label` | Sentiment evidence: 61,133 rows |
| `score` | `scoring_run`, `category_score`, `trust_score`, `gate_veto_status`, `provider_safety`, `commitment_outcome` | Calculated scores |

Views: `ref.dim_service`, `ref.dim_sub_point`, `extract.v_evidence`, `score.v_ranking`.
Functions:
- `score.rank_providers(sub_service_code text, weights numeric[7] default null)` — the per-sub-service ranking.
- `score.rank_providers_group(level text, code text, weights numeric[7] default null)` — the same ranking one level up, for `level` `'service'` or `'category'`. It does not re-score: it pools the scoring run's own category scores across the sub-services in the group, weighted by `evidence_weight`. See `backend/salon_db/07_group_level_ranking.sql` for the rules.

### Widening the search

Scores exist per sub-service, and 14 of the 51 have no provider precise enough to rank. `GET /rankings/{sub_service_code}` therefore tries the sub-service, then its service, then its category, and stops at the first level that can rank anyone. The response says which level answered:

| field | meaning |
|---|---|
| `requested` | `{code, name}` — the sub-service the user picked |
| `level_used` | `"sub_service"` \| `"service"` \| `"category"` \| `"none"` |
| `shown` | `{code, name}` — the level the results are actually for |

Widening is decided on the *filtered* list, so a city with nothing ranked widens within that city. `"none"` means no level could rank anyone; the lists then describe the category. The app shows a notice whenever `level_used` is not `"sub_service"` and labels every card "Rated for: {shown.name}" — it never silently presents a broader score as the exact one.

Codes: category `HR`, service `HR.CHEM`, sub-service `HR.CHEM.02`. Sub-points `'1.1'` … `'7.5'`, plus `'overall'`.

## Domain rules the UI must respect

- A score exists per **provider × sub-service**. `trust_score` is 0–1; 0.5 is neutral. Scores are relative: about 0.75 is strong.
- `rank_status` is one of: `ranked`, `available but not ranked` (too little evidence for the service's tier), `not ranked: safety concern` (veto).
- `safety_status` is `clear`, `caution` or `safety concern`. **Clear providers always rank above caution providers**, whatever the score. The API already returns them in that order; keep it.
- Show the 80% range (`range_low`–`range_high`) with every score.
- Gates and vetoes: **framework v4 defines none.** The machinery is still implemented and is driven entirely off `ref.sub_point.is_gate` / `is_veto`, so marking a sub-point in `02_reference_data.sql` brings it back without touching code. Gate penalty stays −0.15 per applied gate.
- Safety is carried by `ref.sub_point.is_safety`: 7.1 premises cleanliness, 7.2 tool and staff hygiene, 7.3 could I get hurt. The scoring reads that flag rather than a hard-coded list.
- User weights: **seven** non-negative numbers, one per weighted category, default all equal. Weights change the order of ranked providers only. They never change gates, vetoes, the safety line or rank status.
- Evidence text is real customer review text. Show it as quoted evidence; do not rewrite it.

## API (backend/api/main.py — already written and tested)

| Endpoint | Returns |
|---|---|
| `GET /health` | API and database status |
| `GET /services` | Taxonomy tree: categories → services → sub-services, with `tier`, `ranked_providers`, `providers_with_evidence` |
| `GET /framework` | Eight categories with `default_weight`, `weighted` and their customer questions |
| `GET /rankings/{sub_service_code}?weights=1,1,1,1,1,1,1&city=` | `{ sub_service, weights, ranked[], available_but_not_ranked[], safety_concern[] }` |
| `GET /providers?q=` | Provider search by name |
| `GET /providers/{place_id}` | Details, `safety`, `gates_and_vetoes[]`, `services[]` each with eight `category_scores` |
| `GET /providers/{place_id}/evidence?sub_service_code=&category_no=&polarity=&limit=&offset=` | Evidence rows |

A ranking row: `rank_no, place_id, provider_name, city, personal_score, range_low, range_high, safety_status, rank_status, badges, evidence_reviews`.

## Front end to build

1. **Choose a service** — category → service → sub-service, from `/services`. Show how many providers are ranked for each.
2. **Set what matters** — seven sliders from `/framework`, one per category where `weighted` is true, labelled with the category name and its customer questions. A reset-to-equal control. Overall Verdict has no slider.
3. **Ranking** — from `/rankings/{code}`. Three sections in this order: ranked (with position, score, range, safety status, badges, number of reviews), available but not ranked, safety concern. Optional city filter. Changing a slider re-fetches.
4. **Provider profile** — from `/providers/{place_id}`: safety status and reason, gates and vetoes, a score per service with the eight category scores, and the evidence list from `/providers/{place_id}/evidence` with filters for category and polarity.

Wording: on screen, the customer questions use "salon"; that is fine. In code comments and documentation use "provider".

## Code conventions

- TypeScript strict mode; type every API response in `frontend/src/api/types.ts`; one API client module, no fetch calls scattered in components.
- API base URL from `VITE_API_URL` (default `http://127.0.0.1:8000`).
- Python: keep SQL parameterised (`%s`), never build SQL from user input by string joining.
- Small, reviewable changes. After each change, say how to run and check it.

