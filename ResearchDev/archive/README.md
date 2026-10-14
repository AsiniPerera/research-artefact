# Archive

Code the live system does not use. Kept for the project's history, not for
anything currently running. The live system is `backend/api/` (the FastAPI
service), `backend/salon_db/` (the scoring script and SQL migrations) and
`frontend/src/`.

## pipeline/

An earlier, offline scoring pipeline — AHP expert weights, a fixed ranking
formula, VADER baseline, ablation and sensitivity studies. Superseded by
`backend/salon_db/06_run_scoring.py` and the live SQL ranking functions.
Not imported by anything in `backend/api/`, `backend/salon_db/` or
`frontend/src/`.

- `s1_prepare_data.py` — stage 1, builds the input CSVs from the raw salon
  and review files.
- `s3_extract.py` — stage 3, LLM extraction (Gemini) into one opinion per row.
- `s3b_prune_params.py` — stage 3b, drops extraction parameters below a
  frequency threshold.
- `s4_score.py` — stage 4, the old scoring pass: shrinkage, recency
  weighting, category scores. Replaced by `06_run_scoring.py`.
- `s5_ahp.py` — stage 5, AHP pairwise comparison → category weights. The
  live system takes weights from the reader (`WeightLevels.jsx`) instead.
- `s8_load_db.py` — stage 8, pushed the old pipeline's scores into Postgres.
  Replaced by `06_run_scoring.py` writing directly to `score.*`.

## core/

The shared library the pipeline above was built on: one taxonomy, one
ranking formula, one set of scoring helpers, each meant to be imported
everywhere rather than duplicated. Superseded by `ref.*` tables in the
database and the SQL in `13_ranking_v6.sql`. Not imported by the live system.

- `taxonomy.py` — the old taxonomy source. Replaced by `ref.service_category`
  / `ref.service` / `ref.sub_service` in the database, mirrored for the
  frontend in `frontend/src/constants/taxonomy.js`.
- `ranking.py` — the old ranking formula, `F(s) = Σ_c W_c · [...]`. Replaced
  by `score.rank_providers` / `score.rank_providers_group`.
- `scoring.py` — shrinkage, recency weighting and R-value helpers for the old
  pipeline's `s4_score.py`.
- `explain.py` — turned a stored score and its R value into a plain-language
  sentence. No live equivalent; the current frontend reads scores and
  evidence directly rather than a generated explanation.
- `prompt.py` — the old extraction prompt, used by `pipeline/s3_extract.py`.

## evaluation/

Validation studies for the old pipeline: extraction accuracy against a
hand-labelled gold set, a VADER baseline comparison, an ablation study and a
weight-sensitivity sweep. These validated `core/` and `pipeline/`
specifically; they do not describe the live scoring in
`06_run_scoring.py`. Not imported by the live system.

- `eval_extraction.py` — F1 and Cohen's κ against the gold set.
- `baseline_vader.py` — compares the old LLM extraction against a VADER
  polarity baseline.
- `ablation.py` — naive weighted sum vs. evidence-modulated ranking.
- `sensitivity.py` — sweeps the prior strength and weight perturbations.
- `gold_set.csv` — the hand-labelled rows the two eval scripts above read.

## research-artefact/

Not moved here — it was found empty. It contained only an uninitialised,
history-less `.git` folder (hooks and config, no `HEAD`, no commits, no
objects), which has been removed. No content was found; whatever this was
meant to hold is not present on disk. The empty directory
`ResearchDev/research-artefact/` is left in place as a placeholder; git does
not track it either way, since it has never held a tracked file.

## backend_old/

Files from `backend/` (the top level, not `backend/api/` or
`backend/salon_db/`) that have zero imports from the live API — confirmed by
running `backend/api/main.py` after moving every file below out from under
it.

- `main.py`, `db.py`, `schemas.py`, `__init__.py` — an earlier FastAPI
  service. Replaced by `backend/api/main.py`, which has its own connection
  pooling (`db.py`'s single bare connection), its own Pydantic models
  (`schemas.py`) and needs no package `__init__.py`.
- `services/filter_service.py` — `apply_soft_priority`, a soft-priority
  filter over `salons.service_tags` using v4 taxonomy slugs. The live
  ranking filters and orders entirely in SQL
  (`score.rank_providers`/`_group`); this is not called anywhere live.
  **Note:** `frontend/src/constants/taxonomy.js` still names this file by
  path in a comment explaining why taxonomy aliases exist — that comment is
  now describing a file that has moved here.
- `schema.sql` — **the SalonSure v2 schema**: `framework_categories`,
  `sub_points`, `salons`, `salon_category_scores`, `salon_subpoint_scores`,
  `expert_weights`. **None of its six tables exist in the live database.**
  It is a different, earlier design (7 categories named differently: Quality
  of Work, Safety & Hygiene, Customer Handling, Transparency & Ethics, Staff
  & Service Delivery, Environment & Facilities, Value & Accessibility) and
  does not match `backend/salon_db/01_schema.sql` or the live `ref.*` /
  `score.*` tables, which is what the running system actually uses.
