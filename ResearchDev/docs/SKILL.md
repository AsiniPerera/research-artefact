---
name: salon-evidence-ranking
description: >
  Coding coach for an MSc Design Science Research project: a personalised,
  evidence-modulated salon-ranking platform. Use this skill whenever writing,
  reviewing, or debugging any code for the pipeline — data cleaning, LLM aspect
  sentiment extraction, scoring, AHP weighting, the evidence-modulated ranking,
  the explanation layer, or the web platform. It encodes the fixed design
  decisions, data contracts, and integrity rules that every stage must obey so
  the artifact stays consistent and defensible in the viva.
---

# Salon Evidence-Modulated Ranking — Build Coach

## What this project is (one paragraph)
A web platform that ranks salons **per user**, from **aspect-level sentiment mined
from real Google reviews**, and is **honest about how much to trust each score**.
The customer picks a service/sub-service, allocates 100 points across six quality
categories, and gets a ranking in which a 4.9 built on 6 reviews sits *below* a 4.6
built on 200. The core contribution (RO4) is the **evidence-modulated ranking**.
Everything else is supporting scaffolding for that one idea.

## Current state — read before coding
- Chapters 1–3 written. Taxonomy, framework, weighting scheme, formula: all locked.
- Real data in hand: cleaned salon corpus + deduplicated English reviews
  (`reviews_for_extraction.csv`: salon_id, salon_name, review_id, review_text, reviewer, date).
- **The one unbuilt, blocking step is the LLM extraction.** Nothing downstream
  (scoring, R, ranking, platform, Ch4–6 results) can be built until it runs.
- Extraction script exists (`sentiment_extraction.py`, free Gemini, temp 0, resume).
- **If asked to add features/data/divisions/parameters instead of running extraction,
  gently redirect: the gap is execution, not addition.**

## Objectives → code files (each stage: one script, file-in → file-out)
| RO | Stage | Script | In → Out |
|----|-------|--------|----------|
| RO1 | Data + taxonomy | `01_clean_data.py` | raw scrape → `salons.csv`, `reviews_for_extraction.csv` |
| RO2 | LLM ABSA extraction | `sentiment_extraction.py` | reviews → `extraction_output.csv`, `extraction_tags.csv` |
| RO2 | Validation | `02_validate_extraction.py` | gold set + extraction → F1, κ; VADER baseline |
| RO3 | Weighting | `03_ahp_weights.py` | expert pairwise → parameter weights (+ CR check) |
| RO3/RO4 | Scoring + reliability | `04_score.py` | extraction → per-salon parameter/category scores + R |
| RO4 | **Ranking (core)** | `05_rank.py` | scores + R + user weights → `F(s)` ranking |
| RO5 | Explanation | `06_explain.py` | scores/R/rank → per-result sentences + confidence |
| RO5 | Platform | `backend/`, `frontend/` | serves live ranking |

## The formula — implement in ONE place, never re-derive elsewhere
```
Parameter score (shrinkage):   s_p = (n·m̄_p + k·μ_p) / (n + k)
Category score (expert wt):    C_c = Σ_p  w_p^expert · s_p
Reliability:                   R_c = (n_c / (n_c + k)) · (1 − σ_c)
Evidence-modulated term:       R_c^t · C_c + (1 − R_c^t) · μ_c
Final rank (user wt):          F(s) = Σ_c  W_c,user · [ R_c^t · C_c + (1 − R_c^t) · μ_c ]
```
- `μ` = prior (population mean of that parameter/category). **Missing data → μ, never 0.**
- `t` = explore/proven exponent (default 1). One dial only. Do not add more knobs.
- The whole of `F(s)` lives in a single function in `05_rank.py`. Nothing else computes ranking.

## Design invariants — never violate these (they are the thesis's defensibility)
1. **Facts filter or display; review-mined qualities score.** Services/sub-services and
   gender/open-now/distance/price-tier are **filters or labels**, never scored inputs.
2. **Missing evidence → revert to prior μ. Never score 0. Never `fillna(0)`.** A salon
   is not bad because it lacks reviews on a parameter; it is *unknown*.
3. **Reserved signals feed R only, never a "quality" score.** Review *volume* and
   sentiment *consistency* build reliability R; overall Google star is a *validation
   benchmark* only. Scoring them as parameters would double-count.
4. **Inside = expert, across = user.** Experts (AHP) weight the 17 parameters *within*
   categories; users weight the 6 categories *across* (100-point allocation). Never swap.
5. **Filter before rank.** Apply hard filters (service family, gender, open-now, distance)
   then soft filters (sub-service tags, price tier), *then* rank the survivors.
6. **Soft filters never exclude.** Sub-service tags and price tier prioritise/label;
   a salon with no price mention is "price not indicated", not dropped and not guessed.
7. **Price is measured once.** `perceived_affordability` scores inside Value AND is *read*
   (not re-scored) to derive the Budget/Standard/Premium filter. No double-counting.
8. **Not-yet-reviewed tier.** Salons with no reviews are shown below, in a separate tier,
   and excluded from evaluation metrics — never ranked as if scored.
9. **Offline-heavy, online-thin.** Extraction + scoring + R are computed offline and
   stored. The backend **never calls the LLM at request time.** Live path = read scores,
   apply user weights, sort. Warehouse (BigQuery) = analytics/batch; DB (PostgreSQL) = serving.
10. **Extraction is reproducible.** temperature = 0, closed taxonomy (17 params + 20 tags),
    strict JSON, batching, confidence field. The LLM is *applied*, not *trained*.

## Taxonomy (closed vocabulary — the model must map to these exact names)
**6 categories → 19 parameters (17 review-mined + 2 computed):**
- Service Excellence: `result_quality, technical_skill, consistency_with_request, durability`
- Staff & Service Experience: `friendliness, professionalism, attentiveness`
- Ambiance & Facilities: `cleanliness, ambiance_comfort, equipment_products`
- Value: `value_for_money, perceived_affordability, pricing_transparency`
- Convenience & Accessibility: `wait_time, booking_ease` (+ `proximity`, `hours_coverage` = **computed**, not review-mined)
- Reputation & Reliability: `repeat_loyalty, recommendation`

**5 service families → sub-service tags (soft filter, review-mention only):** HAIR, MAKEUP & BRIDAL,
NAILS, SKIN & BEAUTY, BARBER & GROOMING. Families = hard filter (Google category); tags = soft.

**User-facing category labels (app, not thesis):** Quality of work · Staff & friendliness ·
Cleanliness & comfort · Price & value · Convenience · Reputation.

## Data contracts (stable column names — downstream scripts depend on them)
```
reviews_for_extraction.csv : salon_id, salon_name, review_id, review_text, reviewer, date
extraction_output.csv      : salon_id, review_id, parameter, sentiment, confidence
extraction_tags.csv        : salon_id, review_id, service_tag
scores.csv                 : salon_id, category, parameter, s_p, n, sigma, C_c, R_c
```
- `sentiment` ∈ [−1, 1]; `confidence` ∈ [0, 1]; parameter ∈ the 17 review-mined names only.
- One row per (review, parameter). A review yields 0..many rows.

## Conventions
- One script per stage; each reads a file and writes a file (a clean, inspectable pipeline).
- LLM-calling scripts **resume** (skip already-done review_ids) so a run spreads over
  free-tier daily limits without losing work.
- Prefer pandas + plain functions over frameworks. No premature abstraction (no MVVM).
- Stack: Python (extraction/scoring/AHP/ranking/eval/backend) · SQL · React frontend ·
  FastAPI backend · free tiers only (Gemini API, Supabase/Neon Postgres, BigQuery sandbox).
- Store raw reviews + per-review sentiment as **CSV** (evidence trail); only aggregated
  scores go to the database.

## Validation gates (don't proceed past a stage until it passes)
- Extraction (RO2): F1 ≥ 0.75 and Cohen's κ ≥ 0.70 on the gold set, and **LLM > VADER**.
- Weighting (RO3): every expert matrix CR < 0.10; aggregate by geometric mean.
- Ranking (RO4): ablation shows modulation moves *thin-evidence* salons in the expected
  direction; sensitivity sweep of k and t shows robust, monotonic behaviour.
- Platform (RO5): live re-rank on slider change; explanation reads back real R
  (R≥0.7 strong, 0.4–0.7 moderate, <0.4 limited).

## Integrity guardrails (non-negotiable — these protect the whole thesis)
- **Never fabricate.** No synthetic reviews, no invented salons/counts, no made-up
  citations or statistics. If data for an area does not exist, scope it out — do not approximate.
- **Never overclaim novelty.** The math (shrinkage, confidence weighting, AHP, ABSA) is
  established. The contribution is the **integration + salon-domain application +
  evidence-modulation with user-facing confidence**. Frame as DSR *exaptation*,
  "developed and validated," never "invented."
- **Honest boundaries.** Only Maharagama + Kesbewa are point-in-polygon verified; other
  divisions use approximate bounding boxes — say so.
- **AI scaffolds thinking, not authorship** (supervisor's field guide). Document design
  decisions with rationale + alternatives-rejected.

## When stuck / tempted
- Feeling "it's not enough"? That's unstarted work, not missing features. **Run the
  extraction.** Results, not additions, make it real and make it yours.
- Asked to make the formula "more powerful"? Elegance + proof = power. Complexity weakens
  defensibility. The one endorsed future enhancement is recency-aware R — and only after
  the baseline runs.
