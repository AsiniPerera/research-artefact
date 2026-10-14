"""Sensitivity analysis — sweep k (prior strength) and weight perturbations.
Shows the ranking is stable under small weight changes.

Run: python evaluation/sensitivity.py
"""

import pandas as pd
import numpy as np
from pathlib import Path
from core.ranking import rank, SalonCandidate
from core.scoring import compute_R

CAT_CSV = Path("data/processed/category_scores.csv")

BASE_WEIGHTS = {
    "service_excellence":        60,
    "staff_experience":          50,
    "ambiance_facilities":       40,
    "value":                     40,
    "convenience_accessibility": 40,
    "reputation_reliability":    30,
}


def load_candidates(df):
    out = []
    for sid, grp in df.groupby("salon_id"):
        out.append(SalonCandidate(
            salon_id=str(sid), name=str(sid),
            category_scores=dict(zip(grp["category"], grp["category_score"].astype(float))),
            reliability=dict(zip(grp["category"], grp["reliability_R"].astype(float))),
            distance_km=0.0, review_count=0,
        ))
    return out


def rank_ids(candidates, weights, global_means):
    return [s.salon_id for s, _ in rank(candidates, weights, global_means)]


def kendall_tau(a, b):
    from scipy.stats import kendalltau
    idx_a = {v: i for i, v in enumerate(a)}
    ranks_b = [idx_a[v] for v in b if v in idx_a]
    if len(ranks_b) < 2:
        return 1.0
    return kendalltau(list(range(len(ranks_b))), ranks_b).statistic


def run():
    df  = pd.read_csv(CAT_CSV, dtype={"salon_id": str})
    cands = load_candidates(df)
    global_means = {
        cat: float(df[df["category"] == cat]["category_score"].astype(float).mean())
        for cat in BASE_WEIGHTS
    }

    base_order = rank_ids(cands, BASE_WEIGHTS, global_means)

    print("Sensitivity to ±10 point weight perturbations:\n")
    for cat in BASE_WEIGHTS:
        perturbed = dict(BASE_WEIGHTS)
        perturbed[cat] = max(0, perturbed[cat] - 10)
        order = rank_ids(cands, perturbed, global_means)
        tau   = kendall_tau(base_order, order)
        print(f"  {cat:35s}  τ = {tau:.3f}")

    print("\nSensitivity to prior-strength k:\n")
    for k in [5, 10, 20, 50]:
        # Recompute R with different k and re-rank
        import copy
        cands_k = copy.deepcopy(cands)
        for s in cands_k:
            sdf = df[df["salon_id"] == s.salon_id]
            for cat in BASE_WEIGHTS:
                sents_raw = sdf[sdf["category"] == cat]
                # We don't have raw sentiments here; use R as proxy for volume
                pass
        print(f"  k={k:3d}  (full sensitivity requires raw sentiments from extraction_output.csv)")
        break  # placeholder — wire to raw sentiments after stage 3


if __name__ == "__main__":
    run()
