-- 27_usability_survey.sql
-- Stores responses to the in-app usability evaluation (the chat survey at
-- #/survey), one row per completed survey. It replaces a Google Form with the
-- same 21 questions, so the evaluation data lives next to the system it
-- evaluates.
--
-- Anonymous by design: no email, no user id, no IP. A participant may submit
-- more than once (matching the form setting "Limit to 1 response: OFF").
--
-- q4..q13 are the System Usability Scale items, q14..q18 the task-specific
-- items, all 1-5 (1 = Strongly disagree, 5 = Strongly agree).
-- sus_score is computed here, from the standard SUS rule, so it can never
-- disagree with the raw answers:
--   odd items  (q4, q6, q8, q10, q12): score - 1
--   even items (q5, q7, q9, q11, q13): 5 - score
--   sum x 2.5  -> 0..100
--
-- Run once. Re-running fails on "already exists", which is intended.

begin;

create table public.usability_responses (
  id            bigserial primary key,
  created_at    timestamptz not null default now(),

  -- Section 1: participant
  age_range     text not null check (age_range in ('18–24', '25–34', '35–44', '45+')),
  gender        text not null check (gender in ('Male', 'Female', 'Prefer not to say')),
  review_use    text not null check (review_use in (
                  'Never', 'Rarely (a few times a year)', 'Sometimes (monthly)', 'Often (weekly or more)')),

  -- Section 2: SUS
  q4  smallint not null check (q4  between 1 and 5),
  q5  smallint not null check (q5  between 1 and 5),
  q6  smallint not null check (q6  between 1 and 5),
  q7  smallint not null check (q7  between 1 and 5),
  q8  smallint not null check (q8  between 1 and 5),
  q9  smallint not null check (q9  between 1 and 5),
  q10 smallint not null check (q10 between 1 and 5),
  q11 smallint not null check (q11 between 1 and 5),
  q12 smallint not null check (q12 between 1 and 5),
  q13 smallint not null check (q13 between 1 and 5),

  -- Section 3: task-specific
  q14 smallint not null check (q14 between 1 and 5),
  q15 smallint not null check (q15 between 1 and 5),
  q16 smallint not null check (q16 between 1 and 5),
  q17 smallint not null check (q17 between 1 and 5),
  q18 smallint not null check (q18 between 1 and 5),

  -- Section 4: open feedback (optional)
  most_useful   text check (char_length(most_useful)   <= 2000),
  most_confusing text check (char_length(most_confusing) <= 2000),
  other_comments text check (char_length(other_comments) <= 2000),

  sus_score numeric(5, 1) generated always as (
    ((q4 - 1) + (5 - q5) + (q6 - 1) + (5 - q7) + (q8 - 1)
     + (5 - q9) + (q10 - 1) + (5 - q11) + (q12 - 1) + (5 - q13)) * 2.5
  ) stored
);

-- Expect: the table exists with 0 rows; the generated column is present.
select count(*) as rows from public.usability_responses;
select column_name, is_generated
  from information_schema.columns
 where table_schema = 'public' and table_name = 'usability_responses' and column_name = 'sus_score';

commit;

-- For Section 5.4.3, after responses are collected:
--   select count(*) as participants, round(avg(sus_score), 1) as mean_sus,
--          round(stddev_samp(sus_score), 1) as sd_sus
--     from public.usability_responses;
