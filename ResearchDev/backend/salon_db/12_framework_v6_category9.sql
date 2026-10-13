-- 12_framework_v6_category9.sql
-- Framework v6: append Category 9 (Service Expertise & Consistency), set
-- Category 3 weight to 0 (reported-only, still shown on profiles).
-- Weighted categories after this: 1, 2, 4, 5, 6, 7, 9 (seven at 1/7).
--
-- Prerequisites: 01_schema, 02_reference_data, 05_tiers_and_scoring_schema,
--                09/10/11 (v5 migrations) all applied.
-- Run ONCE. Do NOT run inside a scoring run.
--
-- NOTE: The live database check constraint on ref.framework_category is
-- CHECK (category_no >= 1 AND category_no <= 10) (from backend/schema.sql),
-- which already allows category 9. 01_schema.sql says "between 1 and 8" but
-- that was never applied to the live database. No constraint change needed.

-- ===================================================================
-- STEP 0  —  Back up the tables that will change.
--            Run separately (auto-commit) so the backup exists even if
--            the main transaction is rolled back.
--            Table names: backup_v5.<schema>_<table> to avoid clashes.
-- ===================================================================
-- Backup was run manually before this migration:
--   CREATE SCHEMA IF NOT EXISTS backup_v5;
--   CREATE TABLE backup_v5.ref_framework_category AS SELECT * FROM ref.framework_category;   -- 8 rows
--   CREATE TABLE backup_v5.ref_sub_point          AS SELECT * FROM ref.sub_point;             -- 26 rows
--   CREATE TABLE backup_v5.score_category_score   AS SELECT * FROM score.category_score;      -- 120,976 rows
--   CREATE TABLE backup_v5.score_commitment_outcome AS SELECT * FROM score.commitment_outcome; -- 149 rows
--   CREATE TABLE backup_v5.score_gate_veto_status AS SELECT * FROM score.gate_veto_status;    -- 0 rows
--   CREATE TABLE backup_v5.score_provider_safety  AS SELECT * FROM score.provider_safety;     -- 1,820 rows
--   CREATE TABLE backup_v5.score_scoring_run      AS SELECT * FROM score.scoring_run;         -- 5 rows
--   CREATE TABLE backup_v5.score_trust_score      AS SELECT * FROM score.trust_score;         -- 15,122 rows
-- All row counts verified OK.


-- ===================================================================
-- STEPS 1-4  —  Schema changes, wrapped in one transaction.
-- ===================================================================
begin;

-- -------------------------------------------------------------------
-- Step 1: Insert Category 9 into ref.framework_category.
--
-- Columns in ref.framework_category (verified from live DB):
--   category_no  smallint  — primary key
--   name         text      — full display name
--   weight       numeric(6,5)
-- That's all three. There is NO short_name or description column.
-- -------------------------------------------------------------------
insert into ref.framework_category (category_no, name, weight)
values (9, 'Service Expertise & Consistency', 0.14286);

-- -------------------------------------------------------------------
-- Step 2: Set Category 3 weight to 0 (reported-only, not ranked).
-- -------------------------------------------------------------------
update ref.framework_category
   set weight = 0
 where category_no = 3;

-- -------------------------------------------------------------------
-- Step 3: Insert the two sub-points for Category 9.
--
-- Columns in ref.sub_point (all 11, verified from live DB):
--   code               text     — PK, e.g. '9.1'
--   category_no        smallint — FK → ref.framework_category
--   sort_order         int      — display order
--   customer_question  text     — the plain-language question
--   research_meaning   text     — the academic definition
--   is_score           boolean  — contributes to the category score
--   is_gate            boolean  — gate sub-point (blocks ranking)
--   is_veto            boolean  — veto sub-point (zero-out score)
--   is_safety          boolean  — safety-related flag
--   is_reported_only   boolean  — shown but not scored
--   is_computed        boolean  — calculated at scoring time
--
-- Values match the existing computed sub-point 3.1:
--   is_score=true, is_gate=false, is_veto=false, is_safety=false,
--   is_reported_only=false, is_computed=true.
-- -------------------------------------------------------------------
insert into ref.sub_point
  (code, category_no, sort_order, customer_question, research_meaning,
   is_score, is_gate, is_veto, is_safety, is_reported_only, is_computed)
values
  ('9.1', 9, 1,
   'Is the quality consistent over time?',
   'Temporal stability of service outcomes across review periods',
   true, false, false, false, false, true),

  ('9.2', 9, 2,
   'Does the business specialise in this service?',
   'Service specialisation',
   true, false, false, false, false, true);

-- -------------------------------------------------------------------
-- Step 4: Create score.category9_window — the per-window detail table
--         for Category 9, with the same FK pattern as
--         score.category_score.
-- -------------------------------------------------------------------
create table score.category9_window (
  scoring_run_id    int      not null
                    references score.scoring_run on delete cascade,
  place_id          text     not null
                    references raw.provider(place_id),
  sub_service_code  text     not null
                    references ref.sub_service(code),
  window_code       text     not null
                    check (window_code in ('6m', '1y', '3y', 'all')),
  score_9_1         numeric(5,4),              -- nullable: no evidence
  score_9_2         numeric(5,4),              -- nullable: no evidence
  score             numeric(5,4) not null,     -- mean of parts, 0.5 fallback

  primary key (scoring_run_id, place_id, sub_service_code, window_code)
);

commit;


-- ===================================================================
-- CHECK QUERIES  —  Run these after the migration to verify.
-- ===================================================================

-- 1. The new category row
select * from ref.framework_category where category_no = 9;

-- 2. The two new sub-points
select code, category_no, sort_order, customer_question, research_meaning,
       is_score, is_gate, is_veto, is_safety, is_reported_only, is_computed
  from ref.sub_point
 where category_no = 9
 order by code;

-- 3. Category 3 weight is now 0
select category_no, name, weight
  from ref.framework_category
 where category_no = 3;

-- 4. The new table exists and is empty
select count(*) as rows from score.category9_window;
