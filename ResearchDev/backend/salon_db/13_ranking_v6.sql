-- 13_ranking_v6.sql
-- Framework v6: ranking functions with Category 9 (from category9_window)
-- and without Category 3 or 8 (weight 0 in ref.framework_category).
--
-- Weighted categories: 1, 2, 4, 5, 6, 7, 9 — seven in total.
-- Categories 1-7 from score.category_score; 9 from score.category9_window.
-- Category 9 fixed at weight 2 (Medium). Missing/short user weights
-- default to 2 (Medium), so all-defaults = seven equal shares of 1/7.
--
-- p_window ('6m','1y','3y','all') selects the Category 9 time window.
-- Two-argument calls still work (p_weights defaults to null, p_window
-- defaults to '1y').
--
-- Order: ranked first, then safety (clear → caution → concern),
-- then score descending, then evidence weight descending.
--
-- Prerequisite: 12_framework_v6_category9.sql applied.
-- Safe to re-run (DROP IF EXISTS + CREATE OR REPLACE).

begin;

-- Drop the old two-argument overloads from 08_ so no ambiguous call remains.
drop function if exists score.rank_providers(text, numeric[]);
drop function if exists score.rank_providers_group(text, text, numeric[]);


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
    -- Weighted categories only (f.weight > 0, the real column on
    -- ref.framework_category): 1,2,4,5,6,7 from the table, plus 9. Category 3
    -- and 8 have weight 0. user_weight is a different number: the reader's
    -- own importance level for each category (1-7 default to 2, Medium;
    -- Category 9 fixed at 2) and is what the ranking actually multiplies by.
    select f.category_no,
           case when f.category_no <= 7
                then coalesce(p_weights[f.category_no], 2)::numeric
                else 2 end as user_weight
    from ref.framework_category f
    where f.weight > 0
  ),
  run as (select max(scoring_run_id) as id from score.scoring_run),
  cat17 as (
    select c.place_id, c.category_no, c.score
    from score.category_score c
    join w on w.category_no = c.category_no, run
    where c.scoring_run_id = run.id
      and c.sub_service_code = p_sub_service
      and c.category_no <= 7
  ),
  cat9 as (
    select cw.place_id, 9 as category_no, cw.score
    from score.category9_window cw, run
    where cw.scoring_run_id = run.id
      and cw.sub_service_code = p_sub_service
      and cw.window_code = p_window
  ),
  allcats as (
    select * from cat17
    union all
    select * from cat9
  ),
  s as (
    select a.place_id, sum(a.score * w.user_weight) / nullif(sum(w.user_weight), 0) as base
    from allcats a join w using (category_no)
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
    join raw.provider p on p.place_id = s.place_id, run
    where t.scoring_run_id = run.id
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
    -- user_weight: the reader's own importance level, not f.weight (the
    -- structural flag below that only decides which categories take part).
    select f.category_no,
           case when f.category_no <= 7
                then coalesce(p_weights[f.category_no], 2)::numeric
                else 2 end as user_weight
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
    select c.place_id, c.category_no,
           case when sum(c.evidence_weight) > 0
                then sum(c.score * c.evidence_weight) / sum(c.evidence_weight)
                else avg(c.score) end as score
    from score.category_score c
    join members m on m.sub_service_code = c.sub_service_code
    join w on w.category_no = c.category_no, run
    where c.scoring_run_id = run.id
      and c.category_no <= 7
    group by c.place_id, c.category_no
  ),
  cat9 as (
    select cw.place_id, 9 as category_no, avg(cw.score) as score
    from score.category9_window cw
    join members m on m.sub_service_code = cw.sub_service_code, run
    where cw.scoring_run_id = run.id
      and cw.window_code = p_window
    group by cw.place_id
  ),
  allcats as (
    select * from cat17
    union all
    select * from cat9
  ),
  s as (
    select a.place_id, sum(a.score * w.user_weight) / nullif(sum(w.user_weight), 0) as base
    from allcats a join w using (category_no)
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
           min(t.safety_status) as safety_status
    from score.trust_score t
    join members m on m.sub_service_code = t.sub_service_code, run
    where t.scoring_run_id = run.id
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
    join score.trust_score t on t.place_id = s.place_id
    join members m on m.sub_service_code = t.sub_service_code
    join raw.provider p on p.place_id = s.place_id, run
    where t.scoring_run_id = run.id
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
