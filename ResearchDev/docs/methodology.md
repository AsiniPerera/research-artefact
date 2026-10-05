# methodology.md — the chapter that writes itself
_How each DSR activity is carried out + the full evaluation plan. Results land here as they arrive._
_By write-up time this file IS most of the methodology + results chapters._

## Paradigm
Design Science Research (Hevner 2004; Peffers 2007). Six activities: problem →
objectives → design & development → demonstration → evaluation → communication.
Contribution type: exaptation (Gregor & Hevner 2013).

## Activity 1–2 · Problem & objectives
- Problem: generic + opaque + evidence-blind + non-service-specific salon ranking (7 sub-problems, Ch1).
- Objectives: RO1 data+taxonomy · RO2 extraction · RO3 two-tier weighting · RO4 (core)
  evidence-modulated ranking · RO5 platform+explanation+evaluation.

## Activity 3 · Design & development (8-stage pipeline, file-in/file-out)
1. Data foundation — scrape+clean → salons.csv, reviews_for_extraction.csv. [DONE]
2. Taxonomy — 6 categories, 19 params (17 review-mined + 2 computed), 5 families, sub-tags. [LOCKED]
3. **LLM ABSA extraction — sentiment_extraction.py (free Gemini, temp 0, resume). [NOT RUN — BLOCKER]**
4. Scoring + reliability — parameter scores (shrinkage) → category scores; compute R.
5. Two-tier weighting — AHP expert weights (within) + user 100-pt (across).
6. Evidence-modulated ranking (CORE) — F(s) in one function.
7. Explanation + confidence — read back R into sentences (R≥0.7 strong / 0.4–0.7 moderate / <0.4 limited).
8. Platform — React + FastAPI + PostgreSQL; offline-heavy, online-thin.

## Conceptual framework
4-level hierarchy: service/sub-service → 6 categories → parameters → per-parameter
sentiment. Parameter→category via expert weights (tier 1); category→salon via user
weights (tier 2); each category modulated by R; results + confidence explained to user.

## Operationalisation (concept → measurable variable)
- Service quality → 19 params (17 review-mined via ABSA + 2 computed: proximity, hours).
- Parameter score → shrinkage-stabilised aggregated sentiment, ∈[−1,1].
- Reliability R → (volume via n/(n+k)) × (consistency 1−σ), ∈[0,1].
- Expert importance → AHP weight (within category, sums to 1).
- User priority → 100-point allocation across 6 categories (normalised).
- Extraction accuracy → F1 vs gold set. Weight consistency → CR. Effectiveness → user preference/agreement.

## Activity 4 · Demonstration (≠ evaluation)
End-to-end run on real data + persona sanity checks: budget-seeker, quality-seeker,
convenience-seeker must surface DIFFERENT rankings. Honest demo, no cherry-picking.

## Activity 5 · Evaluation plan (FEDS) — metrics · baselines · thresholds · results
- Extraction (RO2): 2-annotator gold set (200–300 sentences) → F1, Cohen's κ.
  Baseline = VADER. GATE: F1 ≥ 0.75, κ ≥ 0.70, LLM > VADER. [results: FILL]
- Weighting (RO3): CR < 0.10 for every expert matrix; geometric-mean aggregation;
  sensitivity of weights. [results: FILL]
- Scores: face validity + convergent validity vs overall star rating. [results: FILL]
- Ranking (RO4, core): ablation modulated-vs-naive (thin-evidence salons must move
  in the expected direction) + sensitivity sweep of k, t, weights. [results: FILL]
- Explanation (RO5): comprehension questions. [results: FILL]
- Whole ranking (RO5): user study 15–30, blind + counterbalanced vs frozen Google list,
  Wilcoxon signed-rank + ranking-agreement + effect sizes. [results: FILL]
- ADVERSARIAL PASS on this plan: [NOT YET RUN — say "attack it"]

## Declared threats to validity
Feasibility sample; self-selection/novelty bias; LLM reproducibility (mitigated temp 0 +
gold set); perceived-price + inferred-gender proxies; snapshot corpus; single
city/platform/English only; 2-division boundary verification only (others approximate).

## Activity 6 · Communication
Thesis (Ch1–6), exaptation framing, AI-use declaration (see below), viva.

## AI-use declaration (draft — per field guide §7.2)
The reasoning model was used for problem refinement, design-space exploration, draft
review, and adversarial critique. All decisions, verifications, and the contribution
are the author's. No model-supplied fact, citation, or statistic was used without
checking against the primary source (see sources.md). No results were invented.

## Results log (append as they arrive)
- [DATE] Extraction test (LIMIT=20): [paste sample rows, accuracy impression] …
- [DATE] Full extraction: [n reviews processed, rows produced] …
- [DATE] Gold-set: F1 = … , κ = … , VADER F1 = … …
- [DATE] AHP: CRs = … , weights = … …
- [DATE] Ablation: [what moved] … Sensitivity: [k,t behaviour] …
- [DATE] User study: n = … , Wilcoxon p = … , effect size = … …
