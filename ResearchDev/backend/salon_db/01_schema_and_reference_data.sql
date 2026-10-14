-- 01_schema_and_reference_data.sql
-- Merged from the original 01_schema.sql + 02_reference_data.sql (two files
-- that only ever ran back to back, on an empty database, and never
-- separately). Both sections are kept verbatim below, in their original run
-- order; nothing in either was reworded or reordered by merging them.
--
-- PostgreSQL 15+ (Supabase). Creates the schemas and tables, then the
-- taxonomy and the original 7-category framework's categories and
-- sub-points. No evidence yet -- that is 03_load_data.py, which must run
-- before 04_checks.sql, since several of its checks count loaded rows.
-- Layout: ref (dimensions) -> raw (source data) -> extract (fact tables) -> score (rebuilt summaries)

-- ============================================================
-- Section 1 -- schema (originally 01_schema.sql)
-- ============================================================
-- No category or sub-point rows yet -- section 2 below inserts those, and
-- later migrations change their count; check ref.framework_category and
-- ref.sub_point directly for what the live framework currently holds.

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


-- ============================================================
-- Section 2 -- taxonomy and framework data (originally 02_reference_data.sql)
-- ============================================================

-- Reference data: taxonomy v9 (5 / 17 / 51) and framework v5 (7 + Overall / 25 + overall)
begin;
insert into ref.service_category (code, name, sort_order) values ('HR', 'Hair', 1);
insert into ref.service (code, category_code, name, sort_order) values ('HR.CUT', 'HR', 'Haircuts', 1);
insert into ref.sub_service (code, service_code, name, sort_order) values ('HR.CUT.01', 'HR.CUT', 'Haircut & Trim', 1);
insert into ref.sub_service (code, service_code, name, sort_order) values ('HR.CUT.02', 'HR.CUT', 'Style Cut & Restyling', 2);
insert into ref.service (code, category_code, name, sort_order) values ('HR.COL', 'HR', 'Hair Colour', 2);
insert into ref.sub_service (code, service_code, name, sort_order) values ('HR.COL.01', 'HR.COL', 'Global Colour & Root Touch-up', 1);
insert into ref.sub_service (code, service_code, name, sort_order) values ('HR.COL.02', 'HR.COL', 'Highlights, Balayage & Ombre', 2);
insert into ref.sub_service (code, service_code, name, sort_order) values ('HR.COL.03', 'HR.COL', 'Bleach & Fashion Colour', 3);
insert into ref.service (code, category_code, name, sort_order) values ('HR.CHEM', 'HR', 'Chemical Hair Treatments', 3);
insert into ref.sub_service (code, service_code, name, sort_order) values ('HR.CHEM.01', 'HR.CHEM', 'Rebonding', 1);
insert into ref.sub_service (code, service_code, name, sort_order) values ('HR.CHEM.02', 'HR.CHEM', 'Keratin & Smoothening', 2);
insert into ref.sub_service (code, service_code, name, sort_order) values ('HR.CHEM.03', 'HR.CHEM', 'Perming & Texturizing', 3);
insert into ref.service (code, category_code, name, sort_order) values ('HR.TRT', 'HR', 'Hair & Scalp Treatments', 4);
insert into ref.sub_service (code, service_code, name, sort_order) values ('HR.TRT.01', 'HR.TRT', 'Hair Spa & Deep Conditioning', 1);
insert into ref.sub_service (code, service_code, name, sort_order) values ('HR.TRT.02', 'HR.TRT', 'Scalp Care (Dandruff & Hair Fall)', 2);
insert into ref.sub_service (code, service_code, name, sort_order) values ('HR.TRT.03', 'HR.TRT', 'Protein, Botox & Oil Treatments', 3);
insert into ref.service (code, category_code, name, sort_order) values ('HR.STY', 'HR', 'Hair Styling', 5);
insert into ref.sub_service (code, service_code, name, sort_order) values ('HR.STY.01', 'HR.STY', 'Wash & Blow Dry', 1);
insert into ref.sub_service (code, service_code, name, sort_order) values ('HR.STY.02', 'HR.STY', 'Temporary Straightening / Curling', 2);
insert into ref.sub_service (code, service_code, name, sort_order) values ('HR.STY.03', 'HR.STY', 'Event & Party Hairstyle', 3);
insert into ref.sub_service (code, service_code, name, sort_order) values ('HR.STY.04', 'HR.STY', 'Hair Extensions, Wigs & Systems', 4);
insert into ref.service_category (code, name, sort_order) values ('SK', 'Skin & Beauty', 2);
insert into ref.service (code, category_code, name, sort_order) values ('SK.FAC', 'SK', 'Facials', 1);
insert into ref.sub_service (code, service_code, name, sort_order) values ('SK.FAC.01', 'SK.FAC', 'Basic Clean-up & Express Facial', 1);
insert into ref.sub_service (code, service_code, name, sort_order) values ('SK.FAC.02', 'SK.FAC', 'Deep Cleansing & Anti-Aging Facial', 2);
insert into ref.sub_service (code, service_code, name, sort_order) values ('SK.FAC.03', 'SK.FAC', 'Brightening & De-Tan Facial', 3);
insert into ref.sub_service (code, service_code, name, sort_order) values ('SK.FAC.04', 'SK.FAC', 'Advanced Hydra & Oxygen Facial', 4);
insert into ref.service (code, category_code, name, sort_order) values ('SK.TRT', 'SK', 'Skin Treatments', 2);
insert into ref.sub_service (code, service_code, name, sort_order) values ('SK.TRT.01', 'SK.TRT', 'Targeted Acne & Pigmentation Care', 1);
insert into ref.sub_service (code, service_code, name, sort_order) values ('SK.TRT.02', 'SK.TRT', 'De-Tan Body & Face Care', 2);
insert into ref.sub_service (code, service_code, name, sort_order) values ('SK.TRT.03', 'SK.TRT', 'Chemical Peels', 3);
insert into ref.service (code, category_code, name, sort_order) values ('SK.BL', 'SK', 'Brows & Lashes', 3);
insert into ref.sub_service (code, service_code, name, sort_order) values ('SK.BL.01', 'SK.BL', 'Eyebrow Threading, Lamination & Tint', 1);
insert into ref.sub_service (code, service_code, name, sort_order) values ('SK.BL.02', 'SK.BL', 'Eyelash Extensions & Lash Lift', 2);
insert into ref.sub_service (code, service_code, name, sort_order) values ('SK.BL.03', 'SK.BL', 'Microblading & Micro-pigmentation', 3);
insert into ref.service (code, category_code, name, sort_order) values ('SK.HX', 'SK', 'Hair Removal & Lightening', 4);
insert into ref.sub_service (code, service_code, name, sort_order) values ('SK.HX.01', 'SK.HX', 'Facial Threading & Waxing', 1);
insert into ref.sub_service (code, service_code, name, sort_order) values ('SK.HX.02', 'SK.HX', 'Arms, Legs & Underarm Waxing', 2);
insert into ref.sub_service (code, service_code, name, sort_order) values ('SK.HX.03', 'SK.HX', 'Full Body Waxing & Bikini Care', 3);
insert into ref.sub_service (code, service_code, name, sort_order) values ('SK.HX.04', 'SK.HX', 'Face & Body Bleaching', 4);
insert into ref.service_category (code, name, sort_order) values ('NL', 'Nail Care', 3);
insert into ref.service (code, category_code, name, sort_order) values ('NL.CARE', 'NL', 'Nail Care', 1);
insert into ref.sub_service (code, service_code, name, sort_order) values ('NL.CARE.01', 'NL.CARE', 'Manicure & Pedicure', 1);
insert into ref.sub_service (code, service_code, name, sort_order) values ('NL.CARE.02', 'NL.CARE', 'Foot Spa & Intensive Heel Care', 2);
insert into ref.service (code, category_code, name, sort_order) values ('NL.POL', 'NL', 'Nail Polish', 2);
insert into ref.sub_service (code, service_code, name, sort_order) values ('NL.POL.01', 'NL.POL', 'Classic & Gel Nail Polish Application', 1);
insert into ref.sub_service (code, service_code, name, sort_order) values ('NL.POL.02', 'NL.POL', 'Gel / Acrylic Polish Removal', 2);
insert into ref.service (code, category_code, name, sort_order) values ('NL.EXT', 'NL', 'Extensions & Nail Art', 3);
insert into ref.sub_service (code, service_code, name, sort_order) values ('NL.EXT.01', 'NL.EXT', 'Acrylic & Gel Nail Extensions', 1);
insert into ref.sub_service (code, service_code, name, sort_order) values ('NL.EXT.02', 'NL.EXT', 'Extension Refill & Custom Nail Art', 2);
insert into ref.service_category (code, name, sort_order) values ('BO', 'Wedding, Events & Occasions', 4);
insert into ref.service (code, category_code, name, sort_order) values ('BO.BRIDAL', 'BO', 'Bridal Services', 1);
insert into ref.sub_service (code, service_code, name, sort_order) values ('BO.BRIDAL.01', 'BO.BRIDAL', 'Bridal Trial & Consultation', 1);
insert into ref.sub_service (code, service_code, name, sort_order) values ('BO.BRIDAL.02', 'BO.BRIDAL', 'Wedding Day Bridal Makeup & Hair', 2);
insert into ref.sub_service (code, service_code, name, sort_order) values ('BO.BRIDAL.03', 'BO.BRIDAL', 'Homecoming & Engagement Makeup', 3);
insert into ref.sub_service (code, service_code, name, sort_order) values ('BO.BRIDAL.04', 'BO.BRIDAL', 'Bridal Party & Photoshoot Makeup', 4);
insert into ref.service (code, category_code, name, sort_order) values ('BO.GROOM', 'BO', 'Groom Services', 2);
insert into ref.sub_service (code, service_code, name, sort_order) values ('BO.GROOM.01', 'BO.GROOM', 'Wedding Day Groom Dressing & Hair', 1);
insert into ref.sub_service (code, service_code, name, sort_order) values ('BO.GROOM.02', 'BO.GROOM', 'Nilame & Traditional Kandyan Dressing', 2);
insert into ref.sub_service (code, service_code, name, sort_order) values ('BO.GROOM.03', 'BO.GROOM', 'Homecoming Groom Styling', 3);
insert into ref.service (code, category_code, name, sort_order) values ('BO.DRAPE', 'BO', 'Draping & Dressing', 3);
insert into ref.sub_service (code, service_code, name, sort_order) values ('BO.DRAPE.01', 'BO.DRAPE', 'Saree & Kandyan Osariya Draping', 1);
insert into ref.sub_service (code, service_code, name, sort_order) values ('BO.DRAPE.02', 'BO.DRAPE', 'Jewellery & Ornament Setting', 2);
insert into ref.service (code, category_code, name, sort_order) values ('BO.OCC', 'BO', 'Events & Occasion Services', 4);
insert into ref.sub_service (code, service_code, name, sort_order) values ('BO.OCC.01', 'BO.OCC', 'Party, Birthday & Event Makeup', 1);
insert into ref.sub_service (code, service_code, name, sort_order) values ('BO.OCC.02', 'BO.OCC', 'HD & Commercial Photoshoot Makeup', 2);
insert into ref.sub_service (code, service_code, name, sort_order) values ('BO.OCC.03', 'BO.OCC', 'Mehendi / Henna Application', 3);
insert into ref.service_category (code, name, sort_order) values ('MG', 'Gents'' Grooming', 5);
insert into ref.service (code, category_code, name, sort_order) values ('MG.BEARD', 'MG', 'Beard & Shave', 1);
insert into ref.sub_service (code, service_code, name, sort_order) values ('MG.BEARD.01', 'MG.BEARD', 'Beard Trim & Line Up', 1);
insert into ref.sub_service (code, service_code, name, sort_order) values ('MG.BEARD.02', 'MG.BEARD', 'Clean Shave', 2);
insert into ref.sub_service (code, service_code, name, sort_order) values ('MG.BEARD.03', 'MG.BEARD', 'Hot Towel Shave', 3);
insert into ref.sub_service (code, service_code, name, sort_order) values ('MG.BEARD.04', 'MG.BEARD', 'Beard Colouring', 4);
-- ---------- Framework v5: 7 weighted categories + Overall Verdict ----------
-- 25 sub-points plus `overall`. Replaces the retired ten-category / 38-sub-point
-- framework.
--
-- Category 8 (Overall Verdict) is REPORTED ONLY: weight 0, is_score false. It is
-- excluded from the weighted mean and from the user's weights vector, which is
-- therefore SEVEN numbers, not eight. It is still stored and shown, because a
-- generic verdict on a salon is the commonest thing a review says - but it
-- summarises the other seven and would double-count if scored beside them.
--
-- v5 has no gates and no vetoes. The machinery stays in the schema and in
-- 06_run_scoring.py and is driven entirely off is_gate / is_veto, so marking a
-- sub-point here is all it takes to bring it back. Safety is carried by is_safety
-- on 7.1-7.3, and 3.1 is the only computed sub-point (it comes from owner replies,
-- not from review text).

insert into ref.framework_category (category_no, name, weight) values (1, 'Quality of the Result', 0.14286);
insert into ref.sub_point (code, category_no, sort_order, customer_question, research_meaning, is_score, is_gate, is_veto, is_safety, is_reported_only, is_computed) values ('1.1', 1, 1, 'Is the quality of the work good?', 'Overall verdict on a named service; technical execution quality', true, false, false, false, false, false);
insert into ref.sub_point (code, category_no, sort_order, customer_question, research_meaning, is_score, is_gate, is_veto, is_safety, is_reported_only, is_computed) values ('1.2', 1, 2, 'Does the result match what I asked for?', 'Request-outcome match', true, false, false, false, false, false);
insert into ref.sub_point (code, category_no, sort_order, customer_question, research_meaning, is_score, is_gate, is_veto, is_safety, is_reported_only, is_computed) values ('1.3', 1, 3, 'Does the result last?', 'Longevity against expectation; early fading or chipping', true, false, false, false, false, false);

insert into ref.framework_category (category_no, name, weight) values (2, 'Consultation, Care & Aftercare', 0.14286);
insert into ref.sub_point (code, category_no, sort_order, customer_question, research_meaning, is_score, is_gate, is_veto, is_safety, is_reported_only, is_computed) values ('2.1', 2, 4, 'Do they assess my needs and relevant risks first?', 'Pre-service consultation; patch or strand test', true, false, false, false, false, false);
insert into ref.sub_point (code, category_no, sort_order, customer_question, research_meaning, is_score, is_gate, is_veto, is_safety, is_reported_only, is_computed) values ('2.2', 2, 5, 'Are they honest about what is possible?', 'Feasibility setting, risk disclosure, refusal and honest referral', true, false, false, false, false, false);
insert into ref.sub_point (code, category_no, sort_order, customer_question, research_meaning, is_score, is_gate, is_veto, is_safety, is_reported_only, is_computed) values ('2.3', 2, 6, 'Do they explain how to care for the result?', 'Aftercare instruction', true, false, false, false, false, false);

insert into ref.framework_category (category_no, name, weight) values (3, 'Management Responsiveness & Continuous Improvement', 0.14286);
insert into ref.sub_point (code, category_no, sort_order, customer_question, research_meaning, is_score, is_gate, is_veto, is_safety, is_reported_only, is_computed) values ('3.1', 3, 7, 'Does management respond to customer complaints?', 'Reply coverage on complaints', true, false, false, false, false, true);
insert into ref.sub_point (code, category_no, sort_order, customer_question, research_meaning, is_score, is_gate, is_veto, is_safety, is_reported_only, is_computed) values ('3.2', 3, 8, 'Does management address the specific concern raised?', 'Reply specificity', true, false, false, false, false, false);
insert into ref.sub_point (code, category_no, sort_order, customer_question, research_meaning, is_score, is_gate, is_veto, is_safety, is_reported_only, is_computed) values ('3.3', 3, 9, 'Does management take ownership of the concern?', 'Responsibility stance and remedy', true, false, false, false, false, false);
insert into ref.sub_point (code, category_no, sort_order, customer_question, research_meaning, is_score, is_gate, is_veto, is_safety, is_reported_only, is_computed) values ('3.4', 3, 10, 'Does management follow through on improvement commitments?', 'Corrective commitment, tagged with the issue, and its fulfilment', true, false, false, false, false, false);
insert into ref.sub_point (code, category_no, sort_order, customer_question, research_meaning, is_score, is_gate, is_veto, is_safety, is_reported_only, is_computed) values ('3.5', 3, 11, 'If something goes wrong, do they put it right?', 'Service recovery by the business, and who bore the cost', true, false, false, false, false, false);

insert into ref.framework_category (category_no, name, weight) values (4, 'Customer Trust & Recommendation', 0.14286);
insert into ref.sub_point (code, category_no, sort_order, customer_question, research_meaning, is_score, is_gate, is_veto, is_safety, is_reported_only, is_computed) values ('4.1', 4, 12, 'Would customers recommend the business?', 'Explicit recommendation and referral behaviour', true, false, false, false, false, false);
insert into ref.sub_point (code, category_no, sort_order, customer_question, research_meaning, is_score, is_gate, is_veto, is_safety, is_reported_only, is_computed) values ('4.2', 4, 13, 'Do customers want to return?', 'Return intent and self-declared repeat visits', true, false, false, false, false, false);

insert into ref.framework_category (category_no, name, weight) values (5, 'Staff & Customer Service', 0.14286);
insert into ref.sub_point (code, category_no, sort_order, customer_question, research_meaning, is_score, is_gate, is_veto, is_safety, is_reported_only, is_computed) values ('5.1', 5, 14, 'Are the staff friendly and respectful?', 'Courtesy, respect and attentiveness', true, false, false, false, false, false);
insert into ref.sub_point (code, category_no, sort_order, customer_question, research_meaning, is_score, is_gate, is_veto, is_safety, is_reported_only, is_computed) values ('5.2', 5, 15, 'Is the treatment comfortable and appropriately handled?', 'Pain and comfort during a treatment', true, false, false, false, false, false);
insert into ref.sub_point (code, category_no, sort_order, customer_question, research_meaning, is_score, is_gate, is_veto, is_safety, is_reported_only, is_computed) values ('5.3', 5, 16, 'Do staff explain things clearly?', 'Explanation during service and language accommodation', true, false, false, false, false, false);
insert into ref.sub_point (code, category_no, sort_order, customer_question, research_meaning, is_score, is_gate, is_veto, is_safety, is_reported_only, is_computed) values ('5.4', 5, 17, 'Is my appointment handled professionally?', 'Appointment reliability and unannounced substitution', true, false, false, false, false, false);

insert into ref.framework_category (category_no, name, weight) values (6, 'Value & Price Honesty', 0.14286);
insert into ref.sub_point (code, category_no, sort_order, customer_question, research_meaning, is_score, is_gate, is_veto, is_safety, is_reported_only, is_computed) values ('6.1', 6, 18, 'Is it worth the money?', 'Value judgement', true, false, false, false, false, false);
insert into ref.sub_point (code, category_no, sort_order, customer_question, research_meaning, is_score, is_gate, is_veto, is_safety, is_reported_only, is_computed) values ('6.2', 6, 19, 'Will I pay the price I was quoted?', 'Quote accuracy and undisclosed charges', true, false, false, false, false, false);
insert into ref.sub_point (code, category_no, sort_order, customer_question, research_meaning, is_score, is_gate, is_veto, is_safety, is_reported_only, is_computed) values ('6.3', 6, 20, 'Will they push me to buy extras?', 'Sales pressure', true, false, false, false, false, false);

insert into ref.framework_category (category_no, name, weight) values (7, 'Safety, Hygiene & Facilities', 0.14286);
insert into ref.sub_point (code, category_no, sort_order, customer_question, research_meaning, is_score, is_gate, is_veto, is_safety, is_reported_only, is_computed) values ('7.1', 7, 21, 'Is the premises clean?', 'Premises cleanliness', true, false, false, true, false, false);
insert into ref.sub_point (code, category_no, sort_order, customer_question, research_meaning, is_score, is_gate, is_veto, is_safety, is_reported_only, is_computed) values ('7.2', 7, 22, 'Are tools and staff hygiene practices appropriate?', 'Tool hygiene, sterilisation practice and staff hygiene', true, false, false, true, false, false);
insert into ref.sub_point (code, category_no, sort_order, customer_question, research_meaning, is_score, is_gate, is_veto, is_safety, is_reported_only, is_computed) values ('7.3', 7, 23, 'Are there reports of harm or unsafe practices?', 'Adverse reaction, injury, delayed-onset damage, unsafe practice', true, false, false, true, false, false);
insert into ref.sub_point (code, category_no, sort_order, customer_question, research_meaning, is_score, is_gate, is_veto, is_safety, is_reported_only, is_computed) values ('7.4', 7, 24, 'Are products appropriate and in good condition?', 'Product authenticity and quality', true, false, false, false, false, false);
insert into ref.sub_point (code, category_no, sort_order, customer_question, research_meaning, is_score, is_gate, is_veto, is_safety, is_reported_only, is_computed) values ('7.5', 7, 25, 'Are the facilities comfortable and suitable?', 'Ambience and facilities', true, false, false, false, false, false);

insert into ref.framework_category (category_no, name, weight) values (8, 'Overall Verdict', 0.00000);
insert into ref.sub_point (code, category_no, sort_order, customer_question, research_meaning, is_score, is_gate, is_veto, is_safety, is_reported_only, is_computed) values ('overall', 8, 0, 'Generic verdict on the salon', 'Overall sentiment without specific quality dimension', false, false, false, false, true, false);

-- ---------- Extraction runs ----------
-- Runs 1-3 are kept for the audit trail. All of their rows were replaced by run 4,
-- so every one of the 44,526 live evidence rows belongs to run 4.
insert into extract.extraction_run (run_id, method, model, framework_version, taxonomy_version, notes) values (1, 'rule_based', 'keyword patterns + VADER lexicon (extended)', 'final-38 (frozen 2026-10-04)', 'v9', 'Baseline first pass against the retired ten-category framework. Spot-check precision about 85% on 60 rows; recall not measured. Superseded by run 4; no rows remain.');
insert into extract.extraction_run (run_id, method, model, framework_version, taxonomy_version, notes) values (2, 'manual', 'read and labelled directly by Claude in chat', 'final-38 (frozen 2026-10-04)', 'v9', 'Covered the 157 reviews written in Sinhala, Singlish, mixed Sinhala-English or Tamil, against the retired ten-category framework. Superseded by run 4; no rows remain.');
insert into extract.extraction_run (run_id, method, model, framework_version, taxonomy_version, notes) values (3, 'rule_based', 'keyword auto-coding; 150 rows read and labelled by Claude (batch_001)', 'v4 draft (7 categories, 25 sub-points, 2026-10-08)', 'v9', 'First pass on the v4 framework, loaded from evidence_cleaned. Auto-coded rows not re-read. Superseded by run 4; no rows remain.');
insert into extract.extraction_run (run_id, method, model, framework_version, taxonomy_version, notes) values (4, 'rule_based', null, 'v4', 'v9', 'Auto-coded by Python keyword engine - 44,526 evidence items from 18,881 reviews across 454 salons. The live run.');
select setval(pg_get_serial_sequence('extract.extraction_run','run_id'), 4);
commit;
