-- 15_subpoint_is_computed_fix.sql
-- ref.sub_point.is_computed on Category 3 parts 3.2, 3.3 and 3.4.
--
-- `is_computed` marks a sub-point that the scorer calculates by rule rather
-- than reading from review text. Category 3 parts 3.1 to 3.4 are all computed
-- from owner replies, but only 3.1 carried the flag, so the same four parts
-- described themselves two different ways.
--
-- Nothing reads the flag for Category 3 today: 06_run_scoring.py excludes
-- those parts through REPLY_SP, a list of the four codes, so the scoring is
-- already correct. The flag is what /framework reports to the app, so this is
-- about the framework describing itself honestly.
--
-- 3.5 is deliberately left alone: it is customer evidence read from review
-- text, not an owner-reply part, and is scored like any other sub-point.
--
-- Safe to re-run.

begin;

update ref.sub_point
   set is_computed = true
 where code in ('3.2', '3.3', '3.4');

-- Expect all of 3.1-3.4 true, 3.5 false, 9.1 and 9.2 true.
select code, category_no, is_computed
  from ref.sub_point
 where code like '3.%' or category_no = 9
 order by code;

commit;
