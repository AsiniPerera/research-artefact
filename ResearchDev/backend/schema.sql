-- SalonSure — PostgreSQL schema
-- Run once: psql $DB_URL -f backend/schema.sql

-- Enable PostGIS for spatial index (optional — remove if not available on your host)
-- CREATE EXTENSION IF NOT EXISTS postgis;

-- ---------------------------------------------------------------------------
-- Salons (from salons_complete_filled.csv via s8_load_db.py)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS salons (
    id                  TEXT PRIMARY KEY,
    name                TEXT NOT NULL,
    division            TEXT NOT NULL,
    service_family      TEXT NOT NULL,
    gender_served       TEXT NOT NULL DEFAULT 'unisex',
    gender_confidence   TEXT DEFAULT 'inferred',
    rating              NUMERIC(3, 1),
    review_count        INTEGER DEFAULT 0,
    hours               JSONB,
    address             TEXT,
    lat                 NUMERIC(10, 7) NOT NULL,
    lng                 NUMERIC(10, 7) NOT NULL,
    maps_url            TEXT
);

CREATE INDEX IF NOT EXISTS idx_salons_family  ON salons (service_family);
CREATE INDEX IF NOT EXISTS idx_salons_gender  ON salons (gender_served);
CREATE INDEX IF NOT EXISTS idx_salons_division ON salons (division);

-- ---------------------------------------------------------------------------
-- Category scores — one row per salon per category (long format)
-- Written by s8_load_db.py, read by backend at request time
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS salon_category_scores (
    salon_id        TEXT NOT NULL REFERENCES salons (id),
    category        TEXT NOT NULL,
    category_score  NUMERIC(6, 4) NOT NULL,
    reliability_r   NUMERIC(6, 4) NOT NULL,
    n_reviews       INTEGER DEFAULT 0,
    price_tier      TEXT CHECK (price_tier IN ('budget', 'standard', 'premium')),
    service_tags    TEXT,           -- comma-separated tag keys
    PRIMARY KEY (salon_id, category)
);

CREATE INDEX IF NOT EXISTS idx_cat_scores_salon ON salon_category_scores (salon_id);

-- ---------------------------------------------------------------------------
-- Parameter scores — one row per salon per parameter
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS salon_parameter_scores (
    salon_id    TEXT NOT NULL REFERENCES salons (id),
    parameter   TEXT NOT NULL,
    score       NUMERIC(6, 4) NOT NULL,
    n_opinions  INTEGER DEFAULT 0,
    PRIMARY KEY (salon_id, parameter)
);

-- ---------------------------------------------------------------------------
-- Expert weights (from s5_ahp.py)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS expert_weights (
    category_key        TEXT PRIMARY KEY,
    weights_json        JSONB NOT NULL,     -- {param: weight}
    consistency_ratio   NUMERIC(6, 4)
);
