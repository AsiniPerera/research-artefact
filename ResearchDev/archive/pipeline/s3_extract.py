"""Stage 3 — LLM extraction (Gemini, resume-capable).
Reads:  data/interim/reviews_for_extraction.csv
Writes: data/processed/extraction_output.csv   (one row per opinion)
        data/processed/extraction_tags.csv      (one row per service tag)

Run full:  python pipeline/s3_extract.py
Run test:  python pipeline/s3_extract.py --test   (first 20 rows only)
"""

import argparse
import json
import os
import time
import pandas as pd
from pathlib import Path
import google.generativeai as genai

from core.prompt import SYSTEM_PROMPT, build_user_prompt
from core.taxonomy import REVIEW_PARAMS, ALL_TAGS

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
MODEL_NAME   = "gemini-1.5-flash"        # pin the model — document in thesis
TEMPERATURE  = 0.0                        # reproducibility requirement
DELAY_SEC    = 1.0                        # rate-limit buffer between calls
TEST_ROWS    = 20

INTERIM   = Path("data/interim")
PROCESSED = Path("data/processed")
PROCESSED.mkdir(parents=True, exist_ok=True)

IN_CSV       = INTERIM  / "reviews_for_extraction.csv"
OUT_OPINIONS = PROCESSED / "extraction_output.csv"
OUT_TAGS     = PROCESSED / "extraction_tags.csv"


# ---------------------------------------------------------------------------
# LLM call
# ---------------------------------------------------------------------------

def call_gemini(model, review_text: str) -> dict:
    full_prompt = SYSTEM_PROMPT + "\n\n" + build_user_prompt(review_text)
    response = model.generate_content(full_prompt)
    raw = response.text.strip()
    # Strip markdown code fence if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw)


# ---------------------------------------------------------------------------
# Resume: load already-processed review_ids
# ---------------------------------------------------------------------------

def load_processed_ids() -> set:
    if OUT_OPINIONS.exists():
        done = pd.read_csv(OUT_OPINIONS, usecols=["review_id"])
        return set(done["review_id"].astype(str))
    return set()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def run(test_mode: bool = False):
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise EnvironmentError("GEMINI_API_KEY not set in environment")
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(
        model_name=MODEL_NAME,
        generation_config=genai.GenerationConfig(temperature=TEMPERATURE),
    )

    reviews = pd.read_csv(IN_CSV, dtype=str).fillna("")
    if test_mode:
        reviews = reviews.head(TEST_ROWS)
        print(f"[TEST MODE] Running on first {TEST_ROWS} rows only")

    done_ids = load_processed_ids()
    pending  = reviews[~reviews["review_id"].isin(done_ids)]
    print(f"Total reviews: {len(reviews)} | Already done: {len(done_ids)} | Pending: {len(pending)}")

    opinion_rows = []
    tag_rows     = []
    errors       = 0

    for i, row in pending.iterrows():
        rid = str(row["review_id"])
        sid = str(row["salon_id"])
        try:
            result = call_gemini(model, row["review_text"])

            for op in result.get("opinions", []):
                param = op.get("parameter", "")
                if param not in REVIEW_PARAMS:
                    # Closed vocabulary — skip and log unknown names
                    print(f"  SKIP unknown param '{param}' in review {rid}")
                    continue
                opinion_rows.append({
                    "salon_id":   sid,
                    "review_id":  rid,
                    "parameter":  param,
                    "sentiment":  float(op.get("sentiment", 0)),
                    "confidence": float(op.get("confidence", 0)),
                })

            for tag in result.get("service_tags", []):
                if tag not in ALL_TAGS:
                    print(f"  SKIP unknown tag '{tag}' in review {rid}")
                    continue
                tag_rows.append({
                    "salon_id":  sid,
                    "review_id": rid,
                    "service_tag": tag,
                })

        except (json.JSONDecodeError, KeyError, Exception) as e:
            print(f"  ERROR review {rid}: {e}")
            errors += 1
            continue

        # Append to CSV every row (resume safety)
        if opinion_rows:
            pd.DataFrame(opinion_rows).to_csv(
                OUT_OPINIONS,
                mode="a",
                header=not OUT_OPINIONS.exists() or OUT_OPINIONS.stat().st_size == 0,
                index=False,
            )
            opinion_rows = []

        if tag_rows:
            pd.DataFrame(tag_rows).to_csv(
                OUT_TAGS,
                mode="a",
                header=not OUT_TAGS.exists() or OUT_TAGS.stat().st_size == 0,
                index=False,
            )
            tag_rows = []

        if (i + 1) % 50 == 0:
            print(f"  {i + 1} / {len(pending)} processed …")

        time.sleep(DELAY_SEC)

    print(f"\nDone. Errors: {errors}")
    print(f"Opinions → {OUT_OPINIONS}")
    print(f"Tags     → {OUT_TAGS}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--test", action="store_true", help="Run on first 20 rows only")
    args = parser.parse_args()
    run(test_mode=args.test)
