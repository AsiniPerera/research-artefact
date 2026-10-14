-- 16_category9_weight_zero.sql
-- ref.framework_category row 9: weight only, no rename.
--
-- Category 9 held two measurements: 9.1 (consistency, ranked) and 9.2
-- (specialism, never ranked). 9.1 is removed from 06_run_scoring.py -- the
-- new duration filter (6m/1y/3y/anytime, applied to every category) answers
-- "is quality holding up" more directly than a dedicated computed category
-- did. With 9.1 gone and 9.2 already display-only, Category 9 has nothing
-- left to rank on, so it drops to weight 0: reported-only, the same
-- treatment as Categories 3 and 8. The weighted/ranked set returns to
-- exactly {1,2,4,5,6,7}.
--
-- Name stays as it is -- this is not the rename this file's number was
-- originally going to carry. Category 8 keeps a full descriptive name at
-- weight 0 too; Category 9 does the same.
--
-- Safe to re-run.

begin;

update ref.framework_category
   set weight = 0.00000
 where category_no = 9;

-- Expect: category_no 9, weight 0.00000, name unchanged.
select category_no, name, weight
  from ref.framework_category
 order by category_no;

commit;
