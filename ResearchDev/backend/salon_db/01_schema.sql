-- Beauty service quality framework: database schema
-- PostgreSQL 15+ (Supabase). Framework: final, 10 categories / 38 sub-points. Taxonomy: v9.
-- Layout: ref (dimensions) -> raw (source data) -> extract (fact tables) -> score (rebuilt summaries)

create schema if not exists ref;
create schema if not exists raw;
create schema if not exists extract;
create schema if not exists score;

-- ============ ref: service dimension (snowflake: category -> service -> sub-service) ============
create table ref.service_category (
  code        text primary key,               -- HR, SK, NL, BO, MG
  name        text not null unique,
  sort_order  int  not null
);
create table ref.service (
  code           text primary key,            -- e.g. HR.COL
  category_code  text not null references ref.service_category(code),
  name           text not null,
  sort_order     int  not null,
  unique (category_code, name)
);
create table ref.sub_service (
  code          text primary key,             -- e.g. HR.COL.01
  service_code  text not null references ref.service(code),
  name          text not null unique,
  sort_order    int  not null,
  tier          smallint check (tier between 1 and 5)   -- irreversibility tier; filled in once assigned
);

-- ============ ref: quality dimension (category -> sub-point) ============
create table ref.framework_category (
  category_no  smallint primary key check (category_no between 1 and 8),
  name         text not null unique,
  weight       numeric(6,5) not null default 0.14286   -- 1/7; Overall Verdict carries 0
);
create table ref.sub_point (
  code               text primary key,        -- '1.1' ... '7.5', plus 'overall'
  category_no        smallint not null references ref.framework_category(category_no),
  sort_order         int  not null,
  customer_question  text not null,
  research_meaning   text not null,
  is_score           boolean not null,
  is_gate            boolean not null,
  is_veto            boolean not null,
  is_safety          boolean not null,
  is_reported_only   boolean not null,
  is_computed        boolean not null          -- calculated at scoring time, not read from a review
);

-- ============ raw: source data exactly as collected ============
create table raw.provider (
  place_id             text primary key,       -- Google place ID = provider ID
  name                 text not null,
  google_category      text,
  address              text,
  city                 text,
  lat                  double precision,
  lng                  double precision,
  google_rating        numeric(2,1),
  google_review_count  int,
  permanently_closed   boolean not null default false,
  temporarily_closed   boolean not null default false,
  place_url            text
);
create table raw.review (
  review_id        text primary key,
  place_id         text not null references raw.provider(place_id),
  stars            smallint not null check (stars between 1 and 5),
  review_text      text,                        -- null = star-only review
  published_at     timestamptz not null,
  source_language  text,
  likes_count      int not null default 0,
  review_url       text
);
create index review_place_date_idx on raw.review (place_id, published_at);
create table raw.owner_reply (
  review_id   text primary key references raw.review(review_id),
  reply_text  text not null,
  reply_date  timestamptz
);

-- ============ extract: what was read from the reviews ============
create table extract.extraction_run (
  run_id             serial primary key,
  method             text not null check (method in ('rule_based', 'llm', 'manual')),
  model              text,
  framework_version  text not null,
  taxonomy_version   text not null,
  run_at             timestamptz not null default now(),
  notes              text
);
-- Fact table: one row per run x review x service level x sub-point
create table extract.evidence_item (
  evidence_id            bigserial primary key,
  run_id                 int  not null references extract.extraction_run(run_id),
  review_id              text not null references raw.review(review_id),
  place_id               text not null references raw.provider(place_id),
  service_category_code  text references ref.service_category(code),   -- the three service columns hold the most
  service_code           text references ref.service(code),            -- specific level the review names;
  sub_service_code       text references ref.sub_service(code),        -- all null = about the provider as a whole
  sub_point_code         text not null references ref.sub_point(code),
  polarity               text not null check (polarity in ('positive', 'negative', 'mixed', 'mention')),
  severity               text check (severity in ('ineffective', 'cosmetic', 'needs correction', 'irreversible', 'damage')),
  time_since_visit       text check (time_since_visit in ('same day', 'later', 'not stated')),
  confidence             text not null check (confidence in ('high', 'medium', 'low')),
  reviewer_fault         boolean not null default false,   -- reviewer says they caused it (fault rule, 10.5 / 10.6)
  needs_manual_check     boolean not null default false,
  evidence_text          text
);
create unique index evidence_item_grain_uq on extract.evidence_item
  (run_id, review_id, coalesce(service_category_code, ''), coalesce(service_code, ''), coalesce(sub_service_code, ''), sub_point_code);
create index evidence_item_place_idx   on extract.evidence_item (place_id, sub_service_code, sub_point_code);
create index evidence_item_review_idx  on extract.evidence_item (review_id);
create index evidence_item_subpt_idx   on extract.evidence_item (sub_point_code, polarity);

create table extract.review_assessment (
  run_id                    int  not null references extract.extraction_run(run_id),
  review_id                 text not null references raw.review(review_id),
  overall_sentiment         text not null check (overall_sentiment in ('positive', 'negative', 'neutral')),
  overall_score             numeric(4,3),
  star_text_mismatch        text,
  review_manipulation_flag  boolean not null default false,
  primary key (run_id, review_id)
);
create table extract.reply_assessment (                     -- Category 6 inputs
  run_id            int  not null references extract.extraction_run(run_id),
  review_id         text not null references raw.owner_reply(review_id),
  latency_days      int,                                    -- 6.1 (negative = review edited after the reply)
  specificity       text check (specificity in ('generic', 'partly specific', 'specific')),              -- 6.2
  stance            text check (stance in ('accepts / apologises', 'disputes the report', 'accepts and disputes (mixed)', 'neither accepts nor disputes')),  -- 6.3
  remedy_offered    boolean,                                -- 6.3
  commitment_made   boolean,                                -- 6.4
  commitment_issue  text,                                   -- 6.4
  primary key (run_id, review_id)
);
create table extract.gold_label (                           -- hand labels for validating a run
  gold_id           bigserial primary key,
  review_id         text not null references raw.review(review_id),
  annotator         text not null,
  sub_service_code  text references ref.sub_service(code),
  sub_point_code    text not null references ref.sub_point(code),
  polarity          text not null check (polarity in ('positive', 'negative', 'mixed', 'mention', 'absent')),
  severity          text,
  labelled_at       timestamptz not null default now()
);

-- ============ score: rebuilt from extract, never edited by hand ============
create table score.gate_veto_status (
  run_id            int  not null references extract.extraction_run(run_id),
  place_id          text not null references raw.provider(place_id),
  sub_service_code  text references ref.sub_service(code),
  sub_point_code    text not null references ref.sub_point(code),
  status            text not null check (status in ('badge', 'caution', 'gate applied', 'veto applied')),
  report_count      int  not null,
  last_report_date  date not null,
  expires_on        date not null
);
create table score.category_score (
  run_id            int  not null references extract.extraction_run(run_id),
  place_id          text not null references raw.provider(place_id),
  sub_service_code  text references ref.sub_service(code),
  category_no       smallint not null references ref.framework_category(category_no),
  score             numeric(5,4),
  evidence_count    int not null
);
create table score.trust_score (
  run_id            int  not null references extract.extraction_run(run_id),
  place_id          text not null references raw.provider(place_id),
  sub_service_code  text references ref.sub_service(code),
  trust_score       numeric(5,4),
  range_low         numeric(5,4),
  range_high        numeric(5,4),
  safety_status     text check (safety_status in ('clear', 'caution', 'safety concern')),
  rank_status       text check (rank_status in ('ranked', 'available but not ranked', 'not ranked: safety concern'))
);
create table score.commitment_outcome (                     -- 6.5
  run_id      int  not null references extract.extraction_run(run_id),
  review_id   text not null references raw.owner_reply(review_id),
  issue       text not null,
  outcome     text not null check (outcome in ('kept', 'broken', 'not testable'))
);

-- ============ views: flat dimensions so queries see a plain star ============
create view ref.dim_service as
select ss.code as sub_service_code, ss.name as sub_service, ss.tier,
       s.code as service_code, s.name as service,
       c.code as category_code, c.name as category
from ref.sub_service ss
join ref.service s on s.code = ss.service_code
join ref.service_category c on c.code = s.category_code;

create view ref.dim_sub_point as
select sp.code as sub_point_code, sp.customer_question, sp.research_meaning,
       fc.category_no, fc.name as category, fc.weight,
       sp.is_score, sp.is_gate, sp.is_veto, sp.is_safety, sp.is_reported_only, sp.is_computed
from ref.sub_point sp
join ref.framework_category fc on fc.category_no = sp.category_no;

create view extract.v_evidence as
select e.evidence_id, e.run_id, e.review_id, e.place_id, p.name as provider_name,
       r.stars, r.published_at,
       coalesce(c.name, c2.name, c3.name) as service_category,
       coalesce(s.name, s2.name)          as service,
       ss.name                            as sub_service,
       sp.category_no, e.sub_point_code, sp.customer_question,
       e.polarity, e.severity, e.time_since_visit, e.confidence,
       e.reviewer_fault, e.needs_manual_check, e.evidence_text
from extract.evidence_item e
join raw.review r   on r.review_id = e.review_id
join raw.provider p on p.place_id  = e.place_id
join ref.sub_point sp on sp.code = e.sub_point_code
left join ref.sub_service ss      on ss.code = e.sub_service_code
left join ref.service s           on s.code  = e.service_code
left join ref.service s2          on s2.code = ss.service_code
left join ref.service_category c  on c.code  = e.service_category_code
left join ref.service_category c2 on c2.code = s.category_code
left join ref.service_category c3 on c3.code = s2.category_code;
