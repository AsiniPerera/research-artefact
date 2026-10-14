-- 17_window_scoped_scores.sql
-- Widen score.category_score and score.trust_score to carry window_code,
-- the same pattern score.category9_window already proved out for one
-- category -- now every category, every service-specific score and the
-- final ranking are scoped to the reader's chosen duration (6m/1y/3y/
-- anytime), not just Category 9's old display.
--
-- Existing rows (run 6, scored before this migration) are backfilled as
-- '1y': that was already the implicit default a caller got when it asked
-- for nothing in particular, so this keeps that data meaningful rather than
-- discarding it. A fresh run of 06_run_scoring.py after this migration
-- writes real, distinct rows for all four windows.
--
-- Prerequisite: 16_category9_weight_zero.sql applied first (not required
-- by this migration's SQL, but 06_run_scoring.py's matching code change
-- assumes Category 9 is already weight 0).
-- Safe to re-run: the ADD COLUMN / ADD CONSTRAINT guards below make a
-- second run a no-op rather than an error.

begin;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'score' and table_name = 'category_score' and column_name = 'window_code'
  ) then
    alter table score.category_score add column window_code text;
    update score.category_score set window_code = '1y';
    alter table score.category_score alter column window_code set not null;
    alter table score.category_score add constraint category_score_window_code_check
      check (window_code in ('6m', '1y', '3y', 'all'));
    alter table score.category_score drop constraint category_score_pkey;
    alter table score.category_score add primary key
      (scoring_run_id, place_id, sub_service_code, category_no, window_code);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'score' and table_name = 'trust_score' and column_name = 'window_code'
  ) then
    alter table score.trust_score add column window_code text;
    update score.trust_score set window_code = '1y';
    alter table score.trust_score alter column window_code set not null;
    alter table score.trust_score add constraint trust_score_window_code_check
      check (window_code in ('6m', '1y', '3y', 'all'));
    alter table score.trust_score drop constraint trust_score_pkey;
    alter table score.trust_score add primary key
      (scoring_run_id, place_id, sub_service_code, window_code);
  end if;
end $$;

-- Expect window_code on both tables, all existing (run 6) rows at '1y'.
select 'category_score' as t, window_code, count(*) from score.category_score group by 1, 2
union all
select 'trust_score', window_code, count(*) from score.trust_score group by 1, 2
order by 1, 2;

commit;
