# decisions.md — the trail of why (append one entry per real decision)
_Format per entry: WHAT decided · OPTIONS weighed · WHY this one · WHAT given up._
_This is the file examiners mine: "why did you do it that way?" Keep it honest._

## D1 · Research paradigm = Design Science Research
- Decided: frame the whole project as DSR (Hevner 2004; Peffers 2007), six activities.
- Options: empirical/survey study; pure software engineering project; DSR.
- Why: the output is a purposeful artefact that solves an identified problem, which
  is exactly what DSR governs; it gives a defensible structure and evaluation logic.
- Gave up: the simplicity of a hypothesis-testing survey narrative.

## D2 · Core contribution = evidence-modulated ranking (RO4), framed as exaptation
- Decided: the contribution is the INTEGRATION + salon-domain application +
  evidence-reliability modulation with user-facing confidence — not new mathematics.
- Options: claim the formula itself as novel; claim only the application; claim integration.
- Why: literature search confirmed the components (Bayesian shrinkage, confidence-
  weighted ranking, AHP, ABSA) pre-exist; claiming invention would fail in the viva.
  Exaptation (Gregor & Hevner 2013) is a legitimate, defensible contribution type.
- Gave up: the stronger-sounding but false claim of inventing the formula.

## D3 · Two-tier weighting: experts weight parameters within, users weight categories across
- Decided: AHP expert weights for the 17 parameters inside each category; user
  100-point allocation across the 6 categories. "Inside = expert, across = user."
- Options: users weight all 19 parameters; single conflated weight set; per-family sets;
  Low/Med/High or 1–5 rating scales for users.
- Why: unconstrained scales collapse personalisation (users mark everything important);
  a fixed 100-point budget forces real trade-offs. Parameter importance is domain
  expertise (AHP); category priority is personal (user).
- Gave up: finer user control over individual parameters (too burdensome, non-discriminating).

## D4 · Missing evidence reverts to the prior μ, never scores 0
- Decided: where a salon lacks evidence on a parameter/category, revert toward the
  population prior; never fillna(0).
- Options: score 0 for missing; drop the salon; revert to prior.
- Why: a salon is not BAD on a dimension it simply has no reviews about; it is UNKNOWN.
  Scoring 0 would punish thin-evidence salons unfairly and corrupt the ranking.
- Gave up: nothing of value — this is a correctness decision.

## D5 · Facts filter or display; only review-mined qualities score
- Decided: services/sub-services, gender-served, open-now, distance, and price-tier are
  filters or labels; only the 17 review-mined quality parameters feed the score.
- Options: score service availability; score price as its own factor separately.
- Why: filtering narrows the candidate set; scoring orders it — different jobs. Scoring
  facts would double-count (e.g. price already scores inside Value).
- Gave up: nothing — keeps the model clean and non-circular.

## D6 · Reserved signals feed reliability R only
- Decided: review volume + sentiment consistency build R; overall Google star is a
  validation benchmark only. Neither is scored as a "reputation" quality.
- Options: add a Reputation-from-rating parameter; use star as a score.
- Why: those signals already inform R; scoring them too would double-count and
  reintroduce the very rating-bias the research critiques.
- Gave up: an easy extra "parameter" that would have weakened defensibility.

## D7 · Extraction LLM = free Gemini (gemini-1.5-flash), temperature 0, applied not trained
- Decided: use the free Gemini API with a closed taxonomy prompt, temp 0, strict JSON, resume.
- Options: Claude API (no free bulk tier); local Ollama models (weaker, hardware cost);
  fine-tuned supervised model (no labelled data exists); GPT (no free API).
- Why: zero budget; no labelled corpus for a custom 17-parameter taxonomy → zero-shot LLM
  prompting is the fit; temp 0 + closed taxonomy = reproducibility; free tier covers ~4k reviews via resume.
- Gave up: marginal accuracy of a proprietary model — recovered by gold-set validation.

## D8 · Storage = two layers: BigQuery (analytics/batch) + PostgreSQL (live serving)
- Decided: warehouse for offline aggregation/scoring; relational DB for millisecond
  live re-ranking. Raw reviews + per-review sentiment stay as CSV (evidence trail).
- Options: DB only; warehouse only; MongoDB.
- Why: analytical batch vs low-latency serving are different workloads; a warehouse
  can't serve live sliders fast enough, a DB isn't for big batch analytics. Data is
  relational (not document). Both free tiers, permanently free at this scale.
- Gave up: single-store simplicity — but the two-layer pattern is the defensible answer.
- Viva line: "at this scale a DB alone suffices; I chose the two-layer pattern to reflect
  correct workload-matched architecture that remains valid as the corpus grows."

## D9 · Service hierarchy: Service → Sub-service, Category → Parameter, sentiment at parameter level
- Decided: model the salon decision as a 4-level hierarchy (service → 6 categories →
  parameters → per-parameter sentiment), unlike flat-aspect systems.
- Options: flat single aspect set (as in restaurant/e-commerce ABSA).
- Why: salon decisions are service-specific — attributes decisive for bridal makeup
  differ from men's grooming; a flat set can't be service-specific or fine-grained.
- Gave up: simplicity — justified by the service-hierarchy research gap.

## D10 · Scope: keep the 9-division dataset WITH honest verification caveat [PROVISIONAL]
- Decided (provisional): write the 9-division scope into the thesis, declaring that only
  Maharagama + Kesbewa are point-in-polygon verified; others use approximate boxes.
- Options: revert to the fully-verified 3 divisions (advisor's recommendation).
- Why: student chose the larger scope; honesty caveat converts the weakness into a
  declared limitation rather than a hidden claim.
- Gave up: the cleaner, caveat-free defence of the 3-division version. [REVISIT before submission]

## D11 · Framework v4: ten categories collapsed to seven, plus a reported-only verdict
- Decided: replace the ten-category / 38-sub-point framework with seven weighted
  categories and 25 sub-points, plus an eighth category, Overall Verdict, holding the
  single sub-point `overall`. Overall Verdict carries `weight = 0` and `is_score =
  false`: it is scored, stored and shown, but excluded from `base_score`, from the
  user's weights, and from the precision range.
- Options: (a) keep ten; (b) seven weighted plus Overall Verdict weighted as an eighth;
  (c) seven weighted plus Overall Verdict reported only; (d) seven, discarding the
  generic-verdict evidence altogether.
- Why: ten categories asked too much of the reviews. Four of them — Consistency &
  Performance Trend, Service Durability, Recovery & Repair, and the split between
  Staff Experience and Customer Trust — were each carried by a handful of evidence
  rows (5.1/5.2/5.3 together held 29 of 61,133), so they contributed a 0.5 prior
  dressed up as a measurement, and ten sliders asked a visitor to express preferences
  the data could not honour. Seven categories each have real evidence behind them.
  Overall Verdict had to exist because a generic "great salon" verdict is the commonest
  thing a review says — 10,296 of 44,526 rows — and discarding it (option d) would
  throw away a quarter of the evidence. But it summarises the other seven, so
  weighting it (option b) counts the same opinion twice and lets a visitor
  unknowingly re-weight everything at once. Reported only is the honest placement:
  visible, never double-counted.
- Gave up: Consistency & Performance Trend as a named category, and with it the
  review-level dispersion and tail-risk computation that fed it — the one part of the
  scoring that measured *variance* rather than level. It was the most methodologically
  distinctive element of v3 and nothing in v4 replaces it. Also gave up the gate and
  veto rules: v4 marks no sub-point as either, so no provider is penalised −0.15 and
  none is removed from the ranking on evidence alone. The machinery is retained and
  driven off `is_gate` / `is_veto`, so reinstating a gate is a reference-data change,
  not a code change. [REVISIT: whether consistency should return as a sub-point of
  Quality of Work before submission]

## [Dn] · [next decision]
- Decided: …
- Options: …
- Why: …
- Gave up: …
