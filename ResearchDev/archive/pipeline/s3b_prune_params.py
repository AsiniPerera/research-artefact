"""Stage 3b — frequency check: drop parameters that appear too rarely.
Reads:  data/processed/extraction_output.csv
Prints: frequency table + parameters below threshold
Writes: nothing — you review the output and manually update core/taxonomy.py if needed.

Run: python pipeline/s3b_prune_params.py
"""

import pandas as pd
from pathlib import Path
from core.taxonomy import REVIEW_PARAMS

PROCESSED   = Path("data/processed")
OPINIONS_CSV = PROCESSED / "extraction_output.csv"

# A parameter found in fewer than this % of reviewed salons is a candidate to drop
FREQ_THRESHOLD = 0.05


def run():
    df = pd.read_csv(OPINIONS_CSV, dtype=str)
    total_salons = df["salon_id"].nunique()

    freq = (
        df.groupby("parameter")["salon_id"]
        .nunique()
        .rename("n_salons")
        .reset_index()
    )
    freq["pct_salons"] = freq["n_salons"] / total_salons

    freq = freq.sort_values("pct_salons", ascending=False)
    print(f"\nParameter frequency (across {total_salons} salons)\n")
    print(freq.to_string(index=False))

    rare = freq[freq["pct_salons"] < FREQ_THRESHOLD]["parameter"].tolist()
    if rare:
        print(f"\nParameters below {FREQ_THRESHOLD:.0%} threshold — consider dropping:")
        for p in rare:
            print(f"  {p}")
    else:
        print(f"\nAll parameters appear in ≥ {FREQ_THRESHOLD:.0%} of salons. No pruning needed.")


if __name__ == "__main__":
    run()
