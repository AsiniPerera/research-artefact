# project.md — Personalised, Evidence-Modulated Salon-Ranking Platform
_Last updated: [FILL DATE] — update at the end of every session_

## Identity
- Student: [name / ID]
- Module: [code] · Supervisor: [name]
- Degree: MSc Computing — Design Science Research project (5-month timeline)

## Problem statement (current version)
Online salon-ranking platforms present a single, generic ranking driven by an
average star rating and proximity. This ranking conceals aspect-level quality,
ignores that different customers prioritise different things, is not
service-specific, and treats a score built on a few reviews as equal to one built
on hundreds. As a result, customers making a consequential, hard-to-reverse choice
are guided by an unreliable, one-size-for-all signal that leaves the rich quality
information in review text unused.

## Solution objectives (v1 — five ROs)
1. (must-have) Construct and validate a structured salon dataset and a
   SERVQUAL-grounded service-quality taxonomy (categories, parameters, sub-services). [RO1]
2. (must-have) Develop and validate an LLM-based aspect sentiment extraction method
   over the taxonomy, converting review text into per-aspect evidence. [RO2]
3. (must-have) Formulate a two-tier weighting scheme: expert AHP weights for
   parameters within categories; user 100-point weights for categories across. [RO3]
4. (must-have, CORE) Design and validate an evidence-modulated ranking model that
   weights category scores by the reliability of their review evidence, reverting to
   a prior when evidence is sparse or conflicting. [RO4]
5. (must-have) Develop, deploy, and evaluate an integrated platform with an
   explanation-and-confidence feature, against a generic baseline. [RO5]

## The artefact
- What it is: a web platform (React + FastAPI + PostgreSQL) plus the offline
  extraction/scoring/ranking pipeline behind it.
- What it does: customer picks a service/sub-service, allocates 100 points across
  six quality categories, and receives a personalised ranking in which each salon's
  scores are modulated by how much review evidence supports them, with per-category
  confidence shown.
- Core formula: F(s) = Σ_c W_c,user · [ R_c^t · C_c + (1 − R_c^t) · μ_c ],
  with R_c = (n_c/(n_c+k))·(1 − σ_c).
- Hard constraints: no API budget (free Gemini, free Supabase/BigQuery tiers);
  solo project; 5 months; real public Google review data only.

## Scope
- In: 9 Divisional Secretariat divisions, Western Province, Sri Lanka
  (Maharagama, Kesbewa, Kaduwela; Gampaha, Wattala, Negombo; Panadura, Kalutara,
  Matugama). Public Google profile metadata + English review text. Method validation.
- Out: booking/transactions; multimedia (image/video) reviews; non-English reviews;
  actual price lists (price is perceived, from sentiment); salons outside the divisions.
- Honest caveat: only Maharagama + Kesbewa are point-in-polygon verified; other
  divisions use approximate bounding boxes (indicative, not verified).

## Where I am right now
- Current step: 3 (design & build) — design fully complete and documented.
- Chapters 1–3 written with verified post-2023 citations. Taxonomy, framework,
  weighting, formula: locked. SKILL.md coach + four project files: in place.
- Real data in hand: cleaned salons + deduplicated English reviews
  (reviews_for_extraction.csv). Free Gemini extraction script built (sentiment_extraction.py).
- **Next action: RUN THE LLM EXTRACTION.** This is the single blocking step —
  scoring, R, ranking, platform, and Chapters 4–6 all wait on its output.
  (get free key → pip install google-generativeai → set key → run LIMIT=20 → verify → LIMIT=None)

## Open questions
- Product name: keep "SalonSure" or switch to Verity/Vouch? (deprioritised)
- Name the formula "Evidence-Modulated Ranking (EMR)"? (endorsed; decide)
- Keep 9-division bounding-box dataset (with caveat) or revert to verified 3? (advisor: 3 is cleaner to defend)
- Add recency-aware R? (only AFTER baseline runs)
- Confirm true corpus size vs any larger review-text files.
