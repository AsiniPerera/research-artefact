-- 18_subpoint_9_1_removed.sql
-- Removes sub-point 9.1 (consistency) from ref.sub_point.
--
-- 9.1's calculation (the period-comparison, shrinkage-weighted consistency
-- score) was deleted from 06_run_scoring.py once duration filtering became
-- universal: every category now answers "is quality holding up" via the
-- reader's chosen window, which makes a dedicated consistency sub-point
-- redundant. 9.2 (specialism) is unaffected -- it is still computed and
-- still written to score.category9_window per window, keyed at the
-- sub-service grain, unrelated to this change.
--
-- score.category9_window is NOT touched here. It stays as 9.2's only
-- record: score_9_1 is already always null going forward (06_run_scoring.py
-- stopped writing to it), and the column itself is left in place rather
-- than dropped, since dropping it would be a separate, larger change than
-- removing one reference row.
--
-- No foreign key currently points at sub_point '9.1': checked
-- extract.evidence_item, extract.gold_label and score.gate_veto_status
-- (the three tables with an FK to ref.sub_point) and all three have zero
-- rows with sub_point_code = '9.1'. The delete below is safe as a result;
-- it would fail loudly (FK violation) rather than silently if that ever
-- stopped being true.
--
-- Safe to re-run: the delete is a no-op once the row is gone.

begin;

delete from ref.sub_point
 where code = '9.1';

-- Expect: 0 rows -- 9.1 no longer exists.
select code, category_no, customer_question
  from ref.sub_point
 where code = '9.1';

-- Expect: 1 row -- 9.2 ('Does the business specialise in this service?'),
-- category_no 9, untouched.
select code, category_no, customer_question
  from ref.sub_point
 where category_no = 9;

commit;
