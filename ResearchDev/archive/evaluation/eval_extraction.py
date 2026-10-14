"""DSR Step 5 — validate extraction against hand-labelled gold set.
Gates: F1 ≥ 0.75, Cohen's κ ≥ 0.70

Run: python evaluation/eval_extraction.py
"""

import pandas as pd
from sklearn.metrics import f1_score, cohen_kappa_score
from pathlib import Path
from core.taxonomy import REVIEW_PARAMS

GOLD_CSV = Path("evaluation/gold_set.csv")
OUT_CSV  = Path("data/processed/extraction_output.csv")


def binarise(df: pd.DataFrame, params: list[str], id_col: str) -> pd.DataFrame:
    """Pivot to one-hot: rows=review_id, cols=parameters."""
    df = df.copy()
    df["present"] = 1
    wide = df.pivot_table(index=id_col, columns="parameter", values="present", fill_value=0)
    for p in params:
        if p not in wide.columns:
            wide[p] = 0
    return wide[params]


def run():
    gold = pd.read_csv(GOLD_CSV, dtype=str)
    pred = pd.read_csv(OUT_CSV,  dtype=str)

    common_ids = set(gold["review_id"]) & set(pred["review_id"])
    if not common_ids:
        print("No common review_ids between gold set and extraction output.")
        return
    print(f"Evaluating on {len(common_ids)} reviews")

    g = binarise(gold[gold["review_id"].isin(common_ids)], REVIEW_PARAMS, "review_id")
    p = binarise(pred[pred["review_id"].isin(common_ids)], REVIEW_PARAMS, "review_id")
    g, p = g.align(p, join="inner")

    y_true = g.values.flatten()
    y_pred = p.values.flatten()

    f1    = f1_score(y_true, y_pred, average="micro", zero_division=0)
    kappa = cohen_kappa_score(y_true, y_pred)

    print(f"\nF1  (micro): {f1:.3f}   gate ≥ 0.75  {'PASS' if f1 >= 0.75 else 'FAIL'}")
    print(f"κ  (Cohen):  {kappa:.3f}  gate ≥ 0.70  {'PASS' if kappa >= 0.70 else 'FAIL'}")


if __name__ == "__main__":
    run()
