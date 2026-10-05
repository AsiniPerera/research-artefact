"""FastAPI backend — /filter and /rank endpoints.
The backend reads precomputed scores from PostgreSQL and computes
distance live. It NEVER calls the LLM.
"""

import json
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from asyncpg import Pool

from backend.db import get_pool, close_pool
from backend.schemas import RankingRequest, RankingResponse, RankedSalon
from core.ranking import rank as apply_ranking, SalonCandidate, haversine
from core.explain import build_card
from core.taxonomy import CATEGORIES

# SQL queries
_CANDIDATES = """
    SELECT s.id, s.name, s.service_family, s.gender_served, s.lat, s.lng, s.hours,
           json_object_agg(cs.category, cs.category_score) AS category_scores,
           json_object_agg(cs.category, cs.reliability_r)  AS reliability,
           max(cs.n_reviews)                                AS n_reviews,
           max(cs.price_tier)                               AS price_tier,
           max(cs.service_tags)                             AS service_tags
    FROM salons s
    JOIN salon_category_scores cs ON s.id = cs.salon_id
    WHERE s.service_family = $1
    GROUP BY s.id, s.name, s.service_family, s.gender_served, s.lat, s.lng, s.hours
"""

_GLOBAL_MEANS = """
    SELECT category, AVG(category_score) AS mean
    FROM salon_category_scores
    GROUP BY category
"""

_SALON_DETAIL = """
    SELECT s.*,
           json_object_agg(cs.category, cs.category_score) AS category_scores,
           json_object_agg(cs.category, cs.reliability_r)  AS reliability,
           json_object_agg(ps.parameter, ps.score)         AS parameter_scores
    FROM salons s
    LEFT JOIN salon_category_scores cs   ON s.id = cs.salon_id
    LEFT JOIN salon_parameter_scores ps  ON s.id = ps.salon_id
    WHERE s.id = $1
    GROUP BY s.id
"""

_SEARCH = """
    SELECT id, name, division, service_family, rating, review_count, address
    FROM salons
    WHERE name ILIKE $1
    ORDER BY name LIMIT 100
"""


@asynccontextmanager
async def lifespan(app: FastAPI):
    await get_pool()
    yield
    await close_pool()


app = FastAPI(title="SalonSure API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/rank", response_model=RankingResponse)
async def rank_salons(req: RankingRequest, pool: Pool = Depends(get_pool)):
    async with pool.acquire() as conn:
        rows  = await conn.fetch(_CANDIDATES, req.service_family)
        means = await conn.fetch(_GLOBAL_MEANS)

    global_means = {r["category"]: float(r["mean"]) for r in means}

    # Filter by gender + distance (with radius fallback)
    from backend.services.filter_service import widen_radius, apply_soft_priority
    salons_raw = [dict(r) for r in rows]
    candidates_raw, effective_r = widen_radius(
        salons_raw, req.max_distance_km, req.gender,
        req.open_now, req.open_at, req.user_lat, req.user_lng, req.min_results,
    )
    # A group selection arrives as every leaf it holds; a single service as one.
    wanted = req.sub_services or ([req.sub_service] if req.sub_service else None)
    candidates_raw = apply_soft_priority(candidates_raw, wanted, req.price_tier)

    reviewed  = [s for s in candidates_raw if (s.get("n_reviews") or 0) > 0]
    no_review = [s for s in candidates_raw if (s.get("n_reviews") or 0) == 0]

    salon_objs = [
        SalonCandidate(
            salon_id=s["id"], name=s["name"],
            category_scores=json.loads(s["category_scores"] or "{}"),
            reliability=json.loads(s["reliability"] or "{}"),
            distance_km=s["distance_km"],
            review_count=s.get("n_reviews") or 0,
            price_tier=s.get("price_tier"),
            service_tags=(s.get("service_tags") or "").split(",") if s.get("service_tags") else [],
        )
        for s in reviewed
    ]

    ranked  = apply_ranking(salon_objs, req.user_weights, global_means)
    top_cat = ranked[0][0].category_scores if ranked else {}
    meta    = {s["id"]: s for s in reviewed}

    # Soft-filter promotion
    if wanted or req.price_tier:
        ranked = sorted(ranked, key=lambda x: (
            int(meta.get(x[0].salon_id, {}).get("matched_sub_service", False)),
            int(meta.get(x[0].salon_id, {}).get("price_tier_match", False)),
            x[1],
        ), reverse=True)

    results = []
    for pos, (salon, f_score) in enumerate(ranked, 1):
        m   = meta[salon.salon_id]
        exp = build_card(
            rank=pos, salon_id=salon.salon_id,
            category_scores=salon.category_scores,
            reliability=salon.reliability,
            review_counts={c: salon.review_count for c in CATEGORIES},
            user_weights=req.user_weights,
            top_scores=top_cat,
        )
        results.append(RankedSalon(
            rank=pos, salon_id=salon.salon_id, name=salon.name,
            distance_km=round(salon.distance_km, 2), F_score=f_score,
            category_scores=salon.category_scores, reliability=salon.reliability,
            matched_sub_service=m.get("matched_sub_service", False),
            price_tier=salon.price_tier, service_tags=salon.service_tags,
            **{k: exp[k] for k in ("why_ranked","confidence","weak_spot","why_not_higher")},
        ))

    return RankingResponse(
        results=results,
        no_review_salons=[{"id": s["id"], "name": s["name"]} for s in no_review],
        total_candidates=len(candidates_raw),
        radius_widened=effective_r > req.max_distance_km,
        effective_radius_km=effective_r,
    )


@app.get("/salons/{salon_id}")
async def get_salon(salon_id: str, pool: Pool = Depends(get_pool)):
    async with pool.acquire() as conn:
        row = await conn.fetchrow(_SALON_DETAIL, salon_id)
    if not row:
        raise HTTPException(status_code=404, detail="Salon not found")
    return dict(row)


@app.get("/salons")
async def search_salons(name: str = "", pool: Pool = Depends(get_pool)):
    async with pool.acquire() as conn:
        rows = await conn.fetch(_SEARCH, f"%{name}%")
    return [dict(r) for r in rows]
