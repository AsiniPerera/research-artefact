-- 29_no_data_dimensions.sql
-- A weighted category with no evidence is left out of the score entirely:
-- it has no score, and its weight drops from the average too.
--
-- Until now a weighted category with no qualifying statement kept the Beta(1,1)
-- prior, 0.5, and was averaged in with the reader's weight like any other.
-- That handed a business a neutral mark for a dimension nobody wrote about.
-- Category 2 (Consultation, Care & Aftercare) has no statement at all for about
-- 93% of business x sub-service pairs, categories 6 and 7 for roughly a
-- quarter, and on average 1.6 of the six weighted categories are empty for any
-- one pair.
--
-- The rule now (researcher's decision, 19 Oct, reversing the 18 Oct "count as
-- 0" entry):
--   * a category with at least one qualifying statement is scored as before;
--   * a weighted category with none (category_score.evidence_count = 0) is
--     dropped from the weighted mean -- its weight leaves the denominator too,
--     so the remaining categories share the score in the reader's proportions,
--     and silence neither helps nor hurts;
--   * a business with no data in ANY weighted category has no score and is
--     not listed for that sub-service or group.
--
-- Why not 0, and why not 0.5. Counting an empty dimension as 0.5 gives a
-- business a neutral mark for something nobody mentioned, which measures review
-- coverage rather than quality. Counting it as 0 penalises silence: a comment
-- like "the staff were lovely" is real evidence about staff, but a business
-- whose customers simply never mentioned hygiene would be marked down on
-- hygiene as if reviewed badly. Leaving the dimension out judges a business
-- only on what was actually written about it.
--
-- No schema change. 06_run_scoring.py already writes evidence_count, and 0 is
-- exactly "no qualifying statement" (a statement is counted only when its
-- weight for the sub-service is above zero). The 0.5 still stored in such rows
-- is a NOT NULL placeholder, never read as a score.
--
-- Effect without a re-score: personal_score is computed here at request time
-- from category_score, so the live ranking follows the new rule as soon as
-- this file is applied. base_score / trust_score and the range they centre
-- are written by 06_run_scoring.py, which applies the same rule from its
-- next run; until then those stored columns still reflect the old average.
--
-- Rank status is unchanged by design: "ranked" depends on the width of the
-- 80% range, which is built from own-service evidence and never read the 0.5.
--
-- Supersedes the function bodies in 13_ranking_v6.sql (which remain the record
-- of the previous rule). Built from 13_'s bodies -- including the window
-- filter on both score tables -- NOT from 14_ranking_safety_fix.sql's, which
-- predates window scoping.
--
-- Prerequisite: 13_ranking_v6.sql, 16_category9_weight_zero.sql and
-- 17_window_scoped_scores.sql applied.
-- Safe to re-run (CREATE OR REPLACE, same signatures).

begin;

-- ---------- 1. Sub-service level ----------
create or replace function score.rank_providers(
  p_sub_service text,
  p_weights numeric[] default null,
  p_window  text      default '1y'
)
returns table (rank_no bigint, place_id text, provider_name text, city text, personal_score numeric,
               range_low numeric, range_high numeric, safety_status text, rank_status text, badges text, evidence_reviews int)
language plpgsql stable as $$
begin
  if p_window not in ('6m','1y','3y','all') then
    raise exception 'p_window must be 6m, 1y, 3y or all';
  end if;

  return query
  with w as (
    -- Weighted categories only (f.weight > 0): 1,2,4,5,6,7 today. user_weight
    -- is the reader's own importance level, defaulting to 2 (Medium).
    select f.category_no,
           coalesce(p_weights[f.category_no], 2)::numeric as user_weight
    from ref.framework_category f
    where f.weight > 0
  ),
  run as (select max(scoring_run_id) as id from score.scoring_run),
  cat17 as (
    -- Only categories WITH data: no evidence is left out, not read as 0.5 or 0.
    select c.place_id, c.category_no, c.score
    from score.category_score c
    join w on w.category_no = c.category_no, run
    where c.scoring_run_id = run.id
      and c.sub_service_code = p_sub_service
      and c.window_code = p_window
      and c.evidence_count > 0
  ),
  s as (
    -- A missing category's weight leaves the denominator as well as the
    -- numerator; base is null only when no weighted category has any data.
    select a.place_id, sum(a.score * w.user_weight) / nullif(sum(w.user_weight), 0) as base
    from cat17 a join w using (category_no)
    group by a.place_id
  ),
  rows as (
    select p.place_id, p.name as provider_name, p.city,
           round(greatest(s.base - t.gate_penalty, 0), 4) as personal_score,
           t.range_low, t.range_high, t.safety_status, t.badges, t.evidence_weight, t.evidence_reviews,
           case when t.rank_status = 'available but not ranked'
                then 'available but not ranked' else 'ranked' end as rank_status,
           case t.safety_status when 'clear' then 0 when 'caution' then 1 else 2 end as safety_order
    from s
    join score.trust_score t on t.place_id = s.place_id and t.sub_service_code = p_sub_service
                              and t.window_code = p_window
    join raw.provider p on p.place_id = s.place_id, run
    where t.scoring_run_id = run.id
      and s.base is not null                -- no data in any weighted category: no score, not listed
  )
  select case when r.rank_status = 'ranked'
              then row_number() over (partition by (r.rank_status = 'ranked')
                                      order by r.safety_order, r.personal_score desc, r.evidence_weight desc)
         end as rank_no,
         r.place_id, r.provider_name, r.city, r.personal_score,
         r.range_low, r.range_high, r.safety_status, r.rank_status, r.badges, r.evidence_reviews
  from rows r
  order by (r.rank_status = 'ranked') desc, r.safety_order, r.personal_score desc, r.evidence_weight desc;
end;
$$;


-- ---------- 2. Group level (service / category) ----------
create or replace function score.rank_providers_group(
  p_level   text,
  p_code    text,
  p_weights numeric[] default null,
  p_window  text      default '1y'
)
returns table (rank_no bigint, place_id text, provider_name text, city text, personal_score numeric,
               range_low numeric, range_high numeric, safety_status text, rank_status text, badges text,
               evidence_reviews int)
language plpgsql stable as $$
begin
  if p_window not in ('6m','1y','3y','all') then
    raise exception 'p_window must be 6m, 1y, 3y or all';
  end if;

  return query
  with w as (
    select f.category_no,
           coalesce(p_weights[f.category_no], 2)::numeric as user_weight
    from ref.framework_category f
    where f.weight > 0
  ),
  run as (select max(scoring_run_id) as id from score.scoring_run),
  members as (
    select sub_service_code, service_code, category_code
    from ref.dim_service
    where case p_level when 'service'  then service_code
                       when 'category' then category_code end = p_code
  ),
  cat17 as (
    -- Pooled across the group, weighted by evidence, over the sub-services
    -- that HAVE data for this category. A category with data nowhere in the
    -- group is no data for the group and is dropped by the HAVING.
    select c.place_id, c.category_no,
           case when sum(c.evidence_weight) filter (where c.evidence_count > 0) > 0
                then sum(c.score * c.evidence_weight) filter (where c.evidence_count > 0)
                     / sum(c.evidence_weight) filter (where c.evidence_count > 0)
                else avg(c.score) filter (where c.evidence_count > 0) end as score
    from score.category_score c
    join members m on m.sub_service_code = c.sub_service_code
    join w on w.category_no = c.category_no, run
    where c.scoring_run_id = run.id
      and c.window_code = p_window
    group by c.place_id, c.category_no
    having sum(c.evidence_count) > 0
  ),
  s as (
    select a.place_id, sum(a.score * w.user_weight) / nullif(sum(w.user_weight), 0) as base
    from cat17 a join w using (category_no)
    group by a.place_id
  ),
  g as (
    select t.place_id,
           max(t.gate_penalty) as gate_penalty,
           case when sum(t.evidence_weight) > 0
                then sum(t.range_low  * t.evidence_weight) / sum(t.evidence_weight)
                else avg(t.range_low)  end as range_low,
           case when sum(t.evidence_weight) > 0
                then sum(t.range_high * t.evidence_weight) / sum(t.evidence_weight)
                else avg(t.range_high) end as range_high,
           sum(t.evidence_weight) as evidence_weight,
           bool_or(t.rank_status = 'ranked') as any_ranked,
           -- Worst-wins: ranked on severity, not spelling, so a concern on
           -- one sub-service carries to the whole group.
           case max(case t.safety_status
                      when 'clear'   then 0
                      when 'caution' then 1
                      else 2 end)
             when 0 then 'clear'
             when 1 then 'caution'
             else 'safety concern'
           end as safety_status
    from score.trust_score t
    join members m on m.sub_service_code = t.sub_service_code, run
    where t.scoring_run_id = run.id
      and t.window_code = p_window
    group by t.place_id
  ),
  rows as (
    select p.place_id, p.name as provider_name, p.city,
           round(greatest(s.base - g.gate_penalty, 0), 4) as personal_score,
           g.range_low, g.range_high, g.safety_status, g.evidence_weight,
           sum(t.evidence_reviews) as evidence_reviews,
           string_agg(distinct t.badges, ', ') filter (where t.badges is not null) as badges,
           case when not g.any_ranked then 'available but not ranked' else 'ranked' end as rank_status,
           case g.safety_status when 'clear' then 0 when 'caution' then 1 else 2 end as safety_order
    from s
    join g on g.place_id = s.place_id
    join score.trust_score t on t.place_id = s.place_id and t.window_code = p_window
    join members m on m.sub_service_code = t.sub_service_code
    join raw.provider p on p.place_id = s.place_id, run
    where t.scoring_run_id = run.id
      and s.base is not null
    group by p.place_id, p.name, p.city, s.base, g.gate_penalty, g.range_low,
             g.range_high, g.safety_status, g.evidence_weight, g.any_ranked
  )
  select case when r.rank_status = 'ranked'
              then row_number() over (partition by (r.rank_status = 'ranked')
                                      order by r.safety_order, r.personal_score desc, r.evidence_weight desc)
         end as rank_no,
         r.place_id, r.provider_name, r.city, r.personal_score,
         r.range_low, r.range_high, r.safety_status, r.rank_status, r.badges, r.evidence_reviews::int
  from rows r
  order by (r.rank_status = 'ranked') desc, r.safety_order, r.personal_score desc, r.evidence_weight desc;
end;
$$;

commit;

-- Expect: both functions replaced, same signatures as 13_.
select p.proname, pg_get_function_identity_arguments(p.oid) as args
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'score' and p.proname in ('rank_providers', 'rank_providers_group')
 order by 1;
