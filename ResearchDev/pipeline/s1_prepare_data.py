"""Stage 1 — prepare data.
Reads:  data/raw/salons_complete_filled.csv
        data/raw/structured_data.xlsx   (review text)
Writes: data/interim/reviews_for_extraction.csv

Run: python pipeline/s1_prepare_data.py
"""

import pandas as pd
from pathlib import Path
from langdetect import detect, LangDetectException

RAW      = Path("data/raw")
INTERIM  = Path("data/interim")
INTERIM.mkdir(parents=True, exist_ok=True)

SALONS_CSV  = RAW / "salons_complete_filled.csv"
REVIEWS_XLS = RAW / "structured_data.xlsx"
OUT_CSV     = INTERIM / "reviews_for_extraction.csv"


def is_english(text: str) -> bool:
    try:
        return detect(str(text)) == "en"
    except LangDetectException:
        return False


def run():
    salons  = pd.read_csv(SALONS_CSV, dtype=str)
    reviews = pd.read_excel(REVIEWS_XLS, dtype=str)

    print(f"Salons loaded:  {len(salons)}")
    print(f"Reviews loaded: {len(reviews)}")

    # Expect columns: salon_id (or join key), review_id, review_text, reviewer, date
    # Adjust column names below to match your actual xlsx headers
    reviews = reviews.rename(columns={
        "Salon ID":    "salon_id",
        "Review ID":   "review_id",
        "Review Text": "review_text",
        "Reviewer":    "reviewer",
        "Date":        "date",
    })

    # Drop rows with missing text
    reviews = reviews.dropna(subset=["review_text"])
    reviews = reviews[reviews["review_text"].str.strip() != ""]

    # Deduplicate
    before = len(reviews)
    reviews = reviews.drop_duplicates(subset=["review_id"])
    print(f"Removed {before - len(reviews)} duplicate reviews")

    # English only
    print("Detecting language …")
    reviews["is_english"] = reviews["review_text"].apply(is_english)
    dropped = (~reviews["is_english"]).sum()
    reviews = reviews[reviews["is_english"]].drop(columns=["is_english"])
    print(f"Dropped {dropped} non-English reviews")

    # Merge salon name for context
    if "salon_name" not in reviews.columns and "name" in salons.columns:
        reviews = reviews.merge(
            salons[["salon_id", "name"]].rename(columns={"name": "salon_name"}),
            on="salon_id", how="left",
        )

    reviews = reviews[["salon_id", "salon_name", "review_id", "review_text", "reviewer", "date"]]
    reviews.to_csv(OUT_CSV, index=False, encoding="utf-8")
    print(f"\nWritten {len(reviews)} reviews → {OUT_CSV}")


if __name__ == "__main__":
    run()
