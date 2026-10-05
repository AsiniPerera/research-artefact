"""DSR Step 5 — ablation: naive weighted sum vs evidence-modulated ranking.
Proves RO4: salons that change rank are the low-evidence ones.

Run: python evaluation/ablation.py
"""

import pandas as pd
import numpy as np
from pathlib import Path
from core.ranking import rank, SalonCandidate

CAT_CSV = Path("data/processed/category_scores.csv")

BALANCED_WEIGHTS = {
    "service_excellence":        60,
    "staff_experience":          50,
    "ambiance_facilities":       40,
    "value":                     40,
    "convenience_accessibility": 40,
    "reputation_reliability":    30,
}


def load_candidates(df: pd.DataFrame) -> list[SalonCandidate]:
    candidates = []
    for sid, grp in df.groupby("salon_id"):
        cat_scores = dict(zip(grp["category"], grp["category_score"].astype(float)))
        reliability = dict(zip(grp["category"], grp["reliability_R"].astype(float)))
        n_reviews = int(grp["n_reviews"].astype(float).max())
        candidates.append(SalonCandidate(
            salon_id=str(sid), name=str(sid),
            category_scores=cat_scores, reliability=reliability,
            distance_km=0.0, review_count=n_reviews,
        ))
    return candidates


def naive_rank(candidates, user_weights):
    total_w = sum(user_weights.values())
    scored = [
        (s, round(sum((w / total_w) * s.category_scores.get(c, 0.5)
                      for c, w in user_weights.items()), 6))
        for s in candidates
    ]
    return sorted(scored, key=lambda x: x[1], reverse=True)


def run():
    df = pd.read_csv(CAT_CSV, dtype={"salon_id": str})
    candidates = load_candidates(df)

    global_means = {
        cat: float(df[df["category"] == cat]["category_score"].astype(float).mean())
        for cat in BALANCED_WEIGHTS
    }

    naive   = naive_rank(candidates, BALANCED_WEIGHTS)
    modulated = rank(candidates, BALANCED_WEIGHTS, global_means)

    naive_order = [s.salon_id for s, _ in naive]
    mod_order   = [s.salon_id for s, _ in modulated]

    changed   = [sid for i, sid in enumerate(mod_order) if naive_order.index(sid) != i]
    unchanged = [sid for sid in mod_order if sid not in set(changed)]

    salon_map = {s.salon_id: s for s in candidates}

    def avg_R(ids):
        vals = [
            np.mean(list(salon_map[sid].reliability.values()))
            for sid in ids if sid in salon_map
        ]
        return float(np.mean(vals)) if vals else 0.0

    print(f"Total salons:       {len(candidates)}")
    print(f"Rank changes:       {len(changed)}")
    print(f"Avg R (changed):    {avg_R(changed):.3f}  ← should be lower")
    print(f"Avg R (unchanged):  {avg_R(unchanged):.3f}")
    print("PASS: changed salons have lower R" if avg_R(changed) < avg_R(unchanged) else "FAIL")


if __name__ == "__main__":
    run()
