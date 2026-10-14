-- 19_run7_rows_removed.sql
-- Deletes stale scoring runs 7 and 8's rows from the five score tables.
--
-- Run 7 was the first execution after duration filtering went live, but it
-- was run with score.category9_window writes skipped on request -- the
-- specialism badge then had no data for the current run, so run 9 was
-- produced immediately after to fix that (06_run_scoring.py restored the
-- category9_window insert first). Run 7's rows elsewhere are now simply an
-- earlier, superseded snapshot: every reader (the API, rank_providers,
-- rank_providers_group) already reads only the latest scoring_run_id, so
-- run 7's rows are inert, not reachable by anything live -- this migration
-- removes dead rows, it does not change any answer the system gives today.
--
-- Run 8 never persisted: it was rolled back in full when the
-- category9_window insert hit a NOT NULL violation (confirmed separately --
-- zero rows under scoring_run_id = 8 in any table, before and after). It is
-- included in the WHERE clause for completeness and so this migration stays
-- correct if that ever changes; it deletes nothing extra today.
--
-- score.scoring_run itself is untouched: both header rows stay, as the
-- historical record that these runs happened, consistent with treating
-- scoring_run_id as an append-only log.
--
-- Safe to re-run: each delete is a no-op once its rows are gone.

begin;

delete from score.category_score     where scoring_run_id in (7, 8);
delete from score.trust_score        where scoring_run_id in (7, 8);
delete from score.provider_safety    where scoring_run_id in (7, 8);
delete from score.commitment_outcome where scoring_run_id in (7, 8);
delete from score.category9_window   where scoring_run_id in (7, 8);

-- Expect: all five rows show 0 for scoring_run_id in (7, 8).
select 'category_score' t, count(*) from score.category_score where scoring_run_id in (7, 8)
union all
select 'trust_score', count(*) from score.trust_score where scoring_run_id in (7, 8)
union all
select 'provider_safety', count(*) from score.provider_safety where scoring_run_id in (7, 8)
union all
select 'commitment_outcome', count(*) from score.commitment_outcome where scoring_run_id in (7, 8)
union all
select 'category9_window', count(*) from score.category9_window where scoring_run_id in (7, 8);

-- Expect: runs 7 and 8 still listed here (headers kept), run 9 is still the
-- latest run with data.
select scoring_run_id, reference_date, run_at
  from score.scoring_run
 order by scoring_run_id;

commit;
