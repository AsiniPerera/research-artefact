"""Stage 5 — AHP: expert pairwise matrices → category weights + CR check.
Writes: pipeline/expert_weights.json   (read by s4_score.py)

Run: python pipeline/s5_ahp.py
"""

import json
import numpy as np
from pathlib import Path
from core.taxonomy import CATEGORIES, COMPUTED_PARAMS

OUT = Path("pipeline") / "expert_weights.json"

# Random Index (Saaty, 1987) for n = 1..10
RI = {1: 0.0, 2: 0.0, 3: 0.58, 4: 0.90, 5: 1.12,
      6: 1.24, 7: 1.32, 8: 1.41, 9: 1.45, 10: 1.49}


def ahp(matrix: list[list[float]]) -> tuple[list[float], float]:
    """Returns (priority_vector, consistency_ratio)."""
    m = np.array(matrix, dtype=float)
    n = m.shape[0]
    col_sums  = m.sum(axis=0)
    normalised = m / col_sums
    weights   = normalised.mean(axis=1)
    lambda_max = (m @ weights / weights).mean()
    ci = (lambda_max - n) / (n - 1) if n > 1 else 0.0
    cr = ci / RI[n] if RI.get(n, 0) > 0 else 0.0
    return weights.tolist(), round(cr, 4)


# ---------------------------------------------------------------------------
# Fill in your expert comparison matrices below after AHP sessions.
# Each matrix[i][j] = importance of param_i relative to param_j (1–9 scale).
# The matrices below are ILLUSTRATIVE — replace with real expert data.
# ---------------------------------------------------------------------------

# ILLUSTRATIVE — replace with real AHP data
MATRICES = {
    "service_excellence": [
        # result_quality  technical_skill  consistency_with_request  durability
        [1,   2,   3,   2],
        [1/2, 1,   2,   1],
        [1/3, 1/2, 1,   1/2],
        [1/2, 1,   2,   1],
    ],
    "staff_experience": [
        # friendliness  professionalism  attentiveness
        [1,   2,   3],
        [1/2, 1,   2],
        [1/3, 1/2, 1],
    ],
    "ambiance_facilities": [
        # cleanliness  ambiance_comfort  equipment_products
        [1,   3,   2],
        [1/3, 1,   1/2],
        [1/2, 2,   1],
    ],
    "value": [
        # value_for_money  perceived_affordability  pricing_transparency
        [1,   2,   3],
        [1/2, 1,   2],
        [1/3, 1/2, 1],
    ],
    "convenience_accessibility": [
        # wait_time  booking_ease
        [1,   2],
        [1/2, 1],
    ],
    "reputation_reliability": [
        # repeat_loyalty  recommendation
        [1,   1],
        [1,   1],
    ],
}


def run():
    result = {}
    all_pass = True

    for cat_key, cat in CATEGORIES.items():
        params = [p for p in cat["parameters"] if p not in COMPUTED_PARAMS]
        matrix = MATRICES.get(cat_key)
        if not matrix:
            print(f"  SKIP {cat_key} — no matrix provided")
            continue

        weights, cr = ahp(matrix)
        passed = cr < 0.10
        if not passed:
            all_pass = False

        result[cat_key] = {
            "params":   params,
            "weights":  {p: round(w, 4) for p, w in zip(params, weights)},
            "cr":       cr,
            "passed":   passed,
        }
        status = "PASS" if passed else f"FAIL (CR={cr})"
        print(f"  {cat_key:30s}  CR={cr:.4f}  [{status}]")

    OUT.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(f"\nWeights saved → {OUT}")
    if not all_pass:
        print("WARNING: one or more categories failed CR < 0.10 — revise expert comparisons")


if __name__ == "__main__":
    run()
