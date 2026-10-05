# SalonSure — Run Guide

Run each stage **in order**. Each script has a file in and a file out.
Do not run stage N+1 before stage N's output file exists.

## Setup

```bash
pip install -r requirements.txt
cp .env.example .env          # fill in GEMINI_API_KEY and DB_URL
```

## Stage 1 — Prepare data

```bash
python pipeline/s1_prepare_data.py
```
Reads `data/raw/salons_complete_filled.csv` and `data/raw/structured_data.xlsx`.
Writes `data/interim/reviews_for_extraction.csv`.

## Stage 3 — LLM extraction

```bash
# Test on 20 rows first — always
python pipeline/s3_extract.py --test

# Full run (resume-safe — re-run if interrupted)
python pipeline/s3_extract.py
```
Writes `data/processed/extraction_output.csv` and `data/processed/extraction_tags.csv`.

## Stage 3b — Prune parameters

```bash
python pipeline/s3b_prune_params.py
```
Prints frequency table. If any parameter appears in < 5% of salons, review whether to remove it from `core/taxonomy.py`.

## Stage 5 — AHP weights

```bash
python pipeline/s5_ahp.py
```
Fill in your expert comparison matrices in `pipeline/s5_ahp.py` first.
Writes `pipeline/expert_weights.json`. All Consistency Ratios must be < 0.10.

## Stage 4 — Score

```bash
python pipeline/s4_score.py
```
Writes `data/processed/parameter_scores.csv` and `data/processed/category_scores.csv`.

## Evaluation

```bash
python evaluation/eval_extraction.py   # F1 ≥ 0.75, κ ≥ 0.70
python evaluation/baseline_vader.py    # LLM must beat this
python evaluation/ablation.py          # proves RO4
python evaluation/sensitivity.py       # weight stability
```

## Stage 8 — Load database

```bash
python pipeline/s8_load_db.py
```
Pushes scores to PostgreSQL. Run once after stage 4 and whenever scores are recomputed.

## Backend

```bash
uvicorn backend.main:app --reload
```
API runs on `http://localhost:8000`. Docs at `/docs`.

## Frontend

```bash
cd frontend
npm install
npm run dev
```
UI runs on `http://localhost:5173`.
