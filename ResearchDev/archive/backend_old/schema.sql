-- SalonSure v2 — PostgreSQL schema (7-category framework + 25 sub-points)
-- Run once: psql $DB_URL -f backend/schema.sql

-- ---------------------------------------------------------------------------
-- Framework categories (7 quality dimensions + overall)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS framework_categories (
    category_no     INTEGER PRIMARY KEY CHECK (category_no >= 1 AND category_no <= 10),
    name            TEXT NOT NULL,
    weight          NUMERIC(6, 5) NOT NULL DEFAULT 0.14286
);

INSERT INTO framework_categories (category_no, name, weight) VALUES
    (1, 'Quality of Work',         0.14286),
    (2, 'Safety & Hygiene',        0.14286),
    (3, 'Customer Handling',       0.14286),
    (4, 'Transparency & Ethics',   0.14286),
    (5, 'Staff & Service Delivery',0.14286),
    (6, 'Environment & Facilities',0.14286),
    (7, 'Value & Accessibility',   0.14286),
    (8, 'Overall Verdict',         0.00000)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Sub-points (25 quality sub-dimensions + overall)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sub_points (
    code            TEXT PRIMARY KEY,
    category_no     INTEGER NOT NULL REFERENCES framework_categories (category_no),
    customer_question TEXT,
    research_meaning  TEXT,
    is_score        BOOLEAN DEFAULT false,
    is_gate         BOOLEAN DEFAULT false,
    is_veto         BOOLEAN DEFAULT false,
    is_safety       BOOLEAN DEFAULT false
);

INSERT INTO sub_points (code, category_no, customer_question) VALUES
    -- 1. Quality of Work
    ('1.1', 1, 'Is the work good?'),
    ('1.2', 1, 'Does it last?'),
    ('1.3', 1, 'Do they fix mistakes?'),
    ('1.4', 1, 'Do they use good products?'),
    -- 2. Safety & Hygiene
    ('2.1', 2, 'Is the salon clean?'),
    ('2.2', 2, 'Are tools sterilised?'),
    ('2.3', 2, 'Do they do a patch test?'),
    ('2.4', 2, 'Did anything go wrong health-wise?'),
    -- 3. Customer Handling
    ('3.1', 3, 'Do they listen to what I want?'),
    ('3.2', 3, 'Are they polite and professional?'),
    ('3.3', 3, 'Do they handle complaints well?'),
    -- 4. Transparency & Ethics
    ('4.1', 4, 'Are prices clear upfront?'),
    ('4.2', 4, 'Do they push unnecessary extras?'),
    ('4.3', 4, 'Is advertising honest?'),
    -- 5. Staff & Service Delivery
    ('5.1', 5, 'Is the staff friendly?'),
    ('5.2', 5, 'Are they skilled / trained?'),
    ('5.3', 5, 'Is the service on time?'),
    ('5.4', 5, 'Is the team consistent?'),
    -- 6. Environment & Facilities
    ('6.1', 6, 'Is the salon comfortable?'),
    ('6.2', 6, 'Is parking / access easy?'),
    ('6.3', 6, 'Are facilities well-maintained?'),
    -- 7. Value & Accessibility
    ('7.1', 7, 'Is it value for money?'),
    ('7.2', 7, 'Is booking easy?'),
    ('7.3', 7, 'Is the location convenient?'),
    ('7.4', 7, 'Are opening hours suitable?'),
    -- Overall
    ('overall', 8, 'Generic verdict on the salon')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Salons
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

CREATE INDEX IF NOT EXISTS idx_salons_family   ON salons (service_family);
CREATE INDEX IF NOT EXISTS idx_salons_gender   ON salons (gender_served);
CREATE INDEX IF NOT EXISTS idx_salons_division ON salons (division);

-- ---------------------------------------------------------------------------
-- Category scores — one row per salon per category (7 categories)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS salon_category_scores (
    salon_id        TEXT NOT NULL REFERENCES salons (id),
    category_no     INTEGER NOT NULL REFERENCES framework_categories (category_no),
    category        TEXT NOT NULL,
    category_score  NUMERIC(6, 4) NOT NULL,
    reliability_r   NUMERIC(6, 4) NOT NULL,
    n_reviews       INTEGER DEFAULT 0,
    price_tier      TEXT CHECK (price_tier IN ('budget', 'standard', 'premium')),
    service_tags    TEXT,
    PRIMARY KEY (salon_id, category_no)
);

CREATE INDEX IF NOT EXISTS idx_cat_scores_salon ON salon_category_scores (salon_id);

-- ---------------------------------------------------------------------------
-- Sub-point scores — one row per salon per sub-point (25 sub-points)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS salon_subpoint_scores (
    salon_id        TEXT NOT NULL REFERENCES salons (id),
    sub_point_code  TEXT NOT NULL REFERENCES sub_points (code),
    score           NUMERIC(6, 4) NOT NULL,
    n_opinions      INTEGER DEFAULT 0,
    positive_count  INTEGER DEFAULT 0,
    negative_count  INTEGER DEFAULT 0,
    PRIMARY KEY (salon_id, sub_point_code)
);

CREATE INDEX IF NOT EXISTS idx_subpoint_salon ON salon_subpoint_scores (salon_id);

-- ---------------------------------------------------------------------------
-- Expert weights (from AHP)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS expert_weights (
    category_no         INTEGER PRIMARY KEY REFERENCES framework_categories (category_no),
    weights_json        JSONB NOT NULL,
    consistency_ratio   NUMERIC(6, 4)
);
