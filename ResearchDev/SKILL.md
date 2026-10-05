# SalonSure — Build Coach File

Read this before writing any code for the project.

## What this project is

A web platform that ranks salons **per user**, from evidence mined from public review text,
and is **honest about how much its own results can be trusted**.

**The contribution is the ranking method, not the app.**

## Core formula (RO4)

```
F(s) = Σ_c  W_c · [ R_c^t · C_c + (1 − R_c^t) · μ_c ]

R = (n / (n + k)) · (1 − σ)
```

- `C` = salon's category score  
- `R` = reliability of evidence for that category  
- `μ` = prior (mean across all salons)  
- `W` = normalised user weight  
- `t` = exponent fixed at 1.0 (no UI toggle)

## Build state

| Stage | Status |
|---|---|
| 1. Data foundation | Done |
| 2. Taxonomy | Done — locked |
| 3. LLM extraction | **NOT RUN — everything below is blocked** |
| 4. Scoring + R | Not built |
| 5. AHP weighting | Design done |
| 6. Ranking | Not built |
| 7. Explanation | Not built |
| 8. Platform | Not built |

## Stack

- **Python** — pipeline, core logic, FastAPI backend  
- **Gemini** (free-tier, temperature 0) — extraction only, never at request time  
- **PostgreSQL** — aggregated scores only (stage 8)  
- **React + Leaflet** — frontend  
- **CSV files** — all pipeline I/O (not JSON)

## Parameter vocabulary (closed — 17 review-mined + 2 computed)

```
result_quality, technical_skill, consistency_with_request, durability
friendliness, professionalism, attentiveness
cleanliness, ambiance_comfort, equipment_products
value_for_money, perceived_affordability, pricing_transparency
wait_time, booking_ease
repeat_loyalty, recommendation
proximity (computed), hours_coverage (computed)
```

The LLM maps **only** to these names. Unknown names are logged and skipped.

## Data contracts

`reviews_for_extraction.csv` → `salon_id, salon_name, review_id, review_text, reviewer, date`  
`extraction_output.csv` → `salon_id, review_id, parameter, sentiment, confidence`  
`extraction_tags.csv` → `salon_id, review_id, service_tag`  
`parameter_scores.csv` → `salon_id, parameter, score, n_opinions`  
`category_scores.csv` → `salon_id, category, category_score, reliability_R, n_reviews`

## Design invariants — breaking these is wrong

1. Missing data → prior (μ), **never zero**. No `fillna(0)` on scores.  
2. Volume + consistency feed **R only** — never a scored parameter.  
3. Google star rating = benchmark only, never an input.  
4. Expert weights: parameters → category. User weights: categories → ranking.  
5. Filter before rank. Hard filters build candidate set; rank orders it.  
6. Soft filters (sub-service, price tier) **never exclude**.  
7. Zero-review salons → separate tier, never mixed with ranked results.  
8. One formula, one place (`core/ranking.py`), no duplicates.  
9. LLM never called at request time.  
10. Every pipeline stage: one script, one file in, one file out.  
11. Extraction must be resume-capable (skip processed `review_id`s).  
12. Always test on 20 rows before a full run (`--test` flag).

## Evaluation gates

| Check | Gate |
|---|---|
| Extraction F1 | ≥ 0.75 |
| Cohen's κ | ≥ 0.70 |
| AHP Consistency Ratio | < 0.10 per category |
| Ablation | Changed salons have lower avg R than unchanged |
