-- 14_ranking_safety_fix.sql
-- Group-level safety aggregation in score.rank_providers_group.
--
-- The group ranking rolls a business's sub-service rows up into one row per
-- business, and safety has to roll up with them. It was aggregated with
-- min(t.safety_status), which sorts the three values alphabetically:
--
--     'caution' < 'clear' < 'safety concern'
--
-- so 'clear' beat 'safety concern' and a business carrying a concern on one
-- sub-service was reported as clear for the whole service or category. Safety
-- decides ORDER in this ranking, so the row also sorted among the clear ones.
--
-- Worst-wins is the rule the framework intends, so the status is ranked on an
-- explicit severity scale and mapped back to text:
--
--     clear 0  <  caution 1  <  safety concern 2
--
-- Only `g.safety_status` changes. Everything else is the function as 13_ left
-- it, repeated in full because CREATE OR REPLACE FUNCTION takes a whole body.
--
-- Today no sub-point acts as a veto, so score.provider_safety holds only
-- 'clear' and 'caution' and this changes no current output. It is the
-- veto-applied case that was wrong, and that is the case where being wrong
-- matters most.
--
-- Prerequisite: 13_ranking_v6.sql applied.
-- Safe to re-run.

begin;

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
           case when f.category_no <= 7
                then coalesce(p_weights[f.category_no], 2)::numeric
                else 2 end as weight
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
    select a.place_id, sum(a.score * w.weight) / nullif(sum(w.weight), 0) as base
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
           -- Worst-wins. Ranked on severity, not spelling, so a concern on one
           -- sub-service carries to the whole group.
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
