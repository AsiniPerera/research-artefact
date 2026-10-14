"""Stage 8 — push final scores into PostgreSQL (run once after stage 4).
Reads:  data/raw/salons_complete_filled.csv
        data/processed/category_scores.csv
        data/processed/parameter_scores.csv
        pipeline/expert_weights.json

Run: python pipeline/s8_load_db.py
"""

import os, json
import pandas as pd
import psycopg
from pathlib import Path

RAW       = Path("data/raw")
PROCESSED = Path("data/processed")

SALONS_CSV = RAW       / "salons_complete_filled.csv"
CAT_CSV    = PROCESSED / "category_scores.csv"
PARAM_CSV  = PROCESSED / "parameter_scores.csv"
WEIGHTS_F  = Path("pipeline") / "expert_weights.json"


def get_conn():
    db_url = os.environ.get("DB_URL")
    if not db_url:
        raise EnvironmentError("DB_URL not set in environment")
    return psycopg.connect(db_url)


def run():
    salons  = pd.read_csv(SALONS_CSV,  dtype=str)
    cat_df  = pd.read_csv(CAT_CSV,     dtype=str)
    param_df = pd.read_csv(PARAM_CSV,  dtype=str)
    weights = json.loads(WEIGHTS_F.read_text(encoding="utf-8")) if WEIGHTS_F.exists() else {}

    conn = get_conn()
    cur  = conn.cursor()

    # Salons
    for _, s in salons.iterrows():
        cur.execute("""
            INSERT INTO salons
              (id, name, division, service_family, gender_served, gender_confidence,
               rating, review_count, hours, address, lat, lng, maps_url)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (id) DO UPDATE SET
              rating = EXCLUDED.rating, review_count = EXCLUDED.review_count
        """, (
            s.get("salon_id"), s.get("name"), s.get("division"),
            s.get("service_family"), s.get("gender_served","unisex"),
            s.get("gender_confidence","inferred"),
            float(s["rating"]) if s.get("rating") else None,
            int(s["review_count"]) if s.get("review_count") else 0,
            s.get("hours"), s.get("address"),
            float(s["lat"]), float(s["lng"]), s.get("maps_url"),
        ))
    print(f"Upserted {len(salons)} salons")

    # Category scores (one row per salon per category)
    for _, row in cat_df.iterrows():
        tags = row.get("service_tags","")
        cur.execute("""
            INSERT INTO salon_category_scores
              (salon_id, category, category_score, reliability_r, n_reviews, price_tier, service_tags)
            VALUES (%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (salon_id, category) DO UPDATE SET
              category_score=EXCLUDED.category_score,
              reliability_r=EXCLUDED.reliability_r,
              n_reviews=EXCLUDED.n_reviews,
              price_tier=EXCLUDED.price_tier,
              service_tags=EXCLUDED.service_tags
        """, (
            row["salon_id"], row["category"],
            float(row["category_score"]), float(row["reliability_R"]),
            int(row["n_reviews"]) if row.get("n_reviews") else 0,
            row.get("price_tier") or None,
            tags if tags else None,
        ))
    print(f"Upserted {len(cat_df)} category score rows")

    # Parameter scores
    for _, row in param_df.iterrows():
        cur.execute("""
            INSERT INTO salon_parameter_scores (salon_id, parameter, score, n_opinions)
            VALUES (%s,%s,%s,%s)
            ON CONFLICT (salon_id, parameter) DO UPDATE SET
              score=EXCLUDED.score, n_opinions=EXCLUDED.n_opinions
        """, (
            row["salon_id"], row["parameter"],
            float(row["score"]), int(row["n_opinions"]),
        ))
    print(f"Upserted {len(param_df)} parameter score rows")

    # Expert weights
    for cat_key, data in weights.items():
        cur.execute("""
            INSERT INTO expert_weights (category_key, weights_json, consistency_ratio)
            VALUES (%s,%s,%s)
            ON CONFLICT (category_key) DO UPDATE SET
              weights_json=EXCLUDED.weights_json,
              consistency_ratio=EXCLUDED.consistency_ratio
        """, (cat_key, json.dumps(data.get("weights",{})), data.get("cr")))
    print(f"Upserted {len(weights)} expert weight rows")

    conn.commit()
    cur.close()
    conn.close()
    print("Done.")


if __name__ == "__main__":
    run()
