"""Stage 4 — scoring: shrinkage, recency weighting, category scores, R.
Reads:  data/processed/extraction_output.csv
        data/processed/extraction_tags.csv
        data/raw/salons_complete_filled.csv   (for hours_coverage, proximity keys)
        pipeline/s5_ahp.py output (expert_weights.json) if available
Writes: data/processed/parameter_scores.csv   (salon_id, parameter, score, n_opinions)
        data/processed/category_scores.csv    (salon_id, category, score, reliability_R, n_reviews)

Run: python pipeline/s4_score.py
"""

import json
import pandas as pd
import numpy as np
from pathlib import Path
from collections import defaultdict

from core.taxonomy import CATEGORIES, COMPUTED_PARAMS, REVIEW_PARAMS, PRICE_PARAMS
from core.scoring import compute_R, aggregate_opinions, recency_weight
from backend.services.filter_service import classify_price_tier

PROCESSED  = Path("data/processed")
RAW        = Path("data/raw")
WEIGHTS_F  = Path("pipeline") / "expert_weights.json"

OPINIONS_CSV  = PROCESSED / "extraction_output.csv"
TAGS_CSV      = PROCESSED / "extraction_tags.csv"
SALONS_CSV    = RAW / "salons_complete_filled.csv"
OUT_PARAMS    = PROCESSED / "parameter_scores.csv"
OUT_CATS      = PROCESSED / "category_scores.csv"


def load_expert_weights() -> dict[str, dict[str, float]]:
    if WEIGHTS_F.exists():
        return json.loads(WEIGHTS_F.read_text(encoding="utf-8"))
    # Equal weights fallback — replace with real AHP data
    print("WARNING: expert_weights.json not found — using equal weights (illustrative only)")
    weights = {}
    for cat_key, cat in CATEGORIES.items():
        params = [p for p in cat["parameters"] if p not in COMPUTED_PARAMS]
        w = 1.0 / len(params) if params else 0.0
        weights[cat_key] = {p: w for p in params}
    return weights


def run():
    opinions_df = pd.read_csv(OPINIONS_CSV, dtype={"salon_id": str, "review_id": str})
    tags_df     = pd.read_csv(TAGS_CSV,     dtype={"salon_id": str, "review_id": str})
    salons_df   = pd.read_csv(SALONS_CSV,   dtype=str)
    expert_w    = load_expert_weights()

    # days_ago from date if present (fallback: 0)
    if "date" in opinions_df.columns:
        opinions_df["date"] = pd.to_datetime(opinions_df["date"], errors="coerce")
        today = pd.Timestamp.now()
        opinions_df["days_ago"] = (today - opinions_df["date"]).dt.days.fillna(0)
    else:
        opinions_df["days_ago"] = 0

    # Group opinions: salon → parameter → [(sentiment, confidence, days_ago)]
    salon_opinions: dict[str, dict[str, list]] = defaultdict(lambda: defaultdict(list))
    for _, row in opinions_df.iterrows():
        salon_opinions[row["salon_id"]][row["parameter"]].append(
            (float(row["sentiment"]), float(row["confidence"]), float(row["days_ago"]))
        )

    # Global means per parameter
    all_sentiments: dict[str, list[float]] = defaultdict(list)
    for ops in salon_opinions.values():
        for param, opinions in ops.items():
            all_sentiments[param].extend((s + 1) / 2 for s, _, _ in opinions)
    global_means = {p: float(np.mean(v)) if v else 0.5 for p, v in all_sentiments.items()}

    # Service tags per salon
    salon_tags: dict[str, set] = defaultdict(set)
    for _, row in tags_df.iterrows():
        salon_tags[row["salon_id"]].add(row["service_tag"])

    param_rows, cat_rows = [], []

    for sid in salons_df["salon_id"].astype(str).unique():
        ops = salon_opinions.get(sid, {})

        # --- Parameter scores ---
        param_scores: dict[str, float] = {}
        for param in REVIEW_PARAMS:
            opinions = ops.get(param, [])
            score = aggregate_opinions(opinions, global_means.get(param, 0.5))
            param_scores[param] = score
            param_rows.append({
                "salon_id":   sid,
                "parameter":  param,
                "score":      score,
                "n_opinions": len(opinions),
            })

        # --- Category scores and R ---
        n_reviews = opinions_df[opinions_df["salon_id"] == sid]["review_id"].nunique()

        for cat_key, cat in CATEGORIES.items():
            params    = [p for p in cat["parameters"] if p not in COMPUTED_PARAMS]
            w         = expert_w.get(cat_key, {})
            total_w   = sum(w.get(p, 0.0) for p in params)
            if total_w > 0:
                cat_score = sum(param_scores.get(p, 0.5) * w.get(p, 0.0) for p in params) / total_w
            else:
                cat_score = 0.5

            sentiments_flat = [s for p in params for s, _, _ in ops.get(p, [])]
            R = compute_R(sentiments_flat)

            # Price tier (value category)
            price_tier = None
            if cat_key == "value":
                price_ops = [s for p in PRICE_PARAMS for s, _, _ in ops.get(p, [])]
                avg_sent  = float(np.mean(price_ops)) if price_ops else 0.0
                price_tier = classify_price_tier(avg_sent, len(price_ops))

            cat_rows.append({
                "salon_id":      sid,
                "category":      cat_key,
                "category_score": round(cat_score, 4),
                "reliability_R": R,
                "n_reviews":     n_reviews,
                "price_tier":    price_tier,
                "service_tags":  ",".join(sorted(salon_tags.get(sid, []))),
            })

    pd.DataFrame(param_rows).to_csv(OUT_PARAMS, index=False)
    pd.DataFrame(cat_rows).to_csv(OUT_CATS,   index=False)
    print(f"Parameter scores → {OUT_PARAMS} ({len(param_rows)} rows)")
    print(f"Category scores  → {OUT_CATS}   ({len(cat_rows)} rows)")


if __name__ == "__main__":
    run()
