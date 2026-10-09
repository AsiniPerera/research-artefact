-- Step 8: rank every salon, and say why a caution is there.
-- Run once in the Supabase SQL Editor (safe to re-run).
--
-- WHAT CHANGES, AND WHY
-- Until now a provider whose reviews triggered the safety veto was removed
-- from the ranking entirely and listed under "not ranked: safety concern".
-- Hiding them from the list meant the one thing a customer most needs to know
-- was the one thing the list would not tell them: the salon simply was not
-- there, with no reason given.
--
-- Framework v4 has no vetoes, so nothing reaches "safety concern" through that
-- route today and the caution comes from the safety evidence instead. The
-- precedence rule below is what matters either way, and is unchanged.
--
-- So every salon with enough evidence is now ranked, and the caution travels
-- with it as a sentence a customer can act on:
--
--     "3 customers reported a reaction or burn, latest July 2026"
--
-- Safety still decides ORDER. A clear record ranks above a caution, and a
-- caution above a safety concern, whatever the score — exactly as before.
-- What has gone is the removal, not the precedence.
--
-- THE SCORES DO NOT MOVE. score.category_score and score.trust_score are
-- untouched and no re-scoring run is needed. This file changes which rows the
-- ranking functions return and adds a view that explains them.
--
-- WHAT IS STILL EXCLUDED. "available but not ranked" is unchanged: those
-- providers lack the review evidence their service's tier demands, which is a
-- precision problem, not a safety one. Ranking them would be guessing.

-- ---------- 1. Why a provider carries a caution ----------
-- The sentence has to be built from the evidence that CAUSED the status, not
-- from a single counter, or it misreports. score.provider_safety.safety_reports
-- counts only the safety sub-points and damage-level failures, so a status
-- raised any other way leaves that counter at zero and reads
-- "0 customers reported…" if the counter is trusted. So two sources are used:
--
--   vetoes    score.gate_veto_status, which stores the report count and the
--             first and last report date per sub-point. Framework v4 marks no
--             sub-point as a veto, so this source is currently empty; it is
--             kept because the rule is still implemented and driven off
--             is_veto.
--   cautions  the safety evidence itself, re-counted here on the same rules
--             the scoring used (24-month window, independent reviews, reviewer
--             fault and manual-check rows dropped). The window and the safety
--             sub-point list are both read from the scoring run's own
--             parameters, so this view cannot drift from the scoring.
--
-- The safety sub-points in framework v4 are 7.1, 7.2 and 7.3; the scoring reads
-- them from ref.sub_point.is_safety rather than from a hard-coded list, so
-- changing that flag is enough to change both.

create or replace view score.v_provider_caution as
with run as (select max(scoring_run_id) as id from score.scoring_run),
params as (
  select (parameters ->> 'window_months')::int as window_months,
         array(select jsonb_array_elements_text(parameters -> 'safety_sub_points')) as safety_points
  from score.scoring_run, run where scoring_run_id = run.id
),
ref_date as (select max(published_at)::date as d from raw.review),

-- How each sub-point is said to a customer. Kept here rather than in the app
-- so the wording cannot drift between the API, the card and a report.
-- Framework v4 sub-point codes. Any safety sub-point missing from here falls
-- back to 'damage', so adding one is safe but leaves a vaguer sentence.
phrase(code, words) as (values
  ('7.1', 'an unclean salon'),
  ('7.2', 'tools or staff that were not hygienic'),
  ('7.3', 'being hurt — a reaction, a burn or unsafe methods'),
  ('5.5', 'work the salon did not put right')
),

-- A veto: the report count and dates are already stored per sub-point.
veto_reasons as (
  select g.place_id, g.sub_point_code, g.report_count as reports,
         g.last_report_date as last_report, 2 as priority
  from score.gate_veto_status g, run
  where g.scoring_run_id = run.id and g.kind = 'veto' and g.status = 'veto applied'
),

-- A caution from the safety line: re-counted from the evidence, one review
-- counted once however many points it makes.
safety_evidence as (
  select e.place_id,
         case when e.sub_point_code = any(p.safety_points) then e.sub_point_code else null end as sub_point_code,
         e.review_id, r.published_at::date as d
  from extract.evidence_item e
  join raw.review r using (review_id), params p, ref_date
  where e.polarity in ('negative', 'mixed')
    and not e.reviewer_fault and not e.needs_manual_check
    and r.published_at::date >= ref_date.d - (p.window_months || ' months')::interval
    and (e.sub_point_code = any(p.safety_points) or e.severity = 'damage')
),
caution_reasons as (
  select s.place_id, s.sub_point_code,
         count(distinct s.review_id)::int as reports,
         max(s.d) as last_report, 1 as priority
  from safety_evidence s
  group by s.place_id, s.sub_point_code
),

-- A caution raised by ONE veto-type report. The scoring records this as
-- "single veto-type report" with both safety counters left at zero, so it is
-- invisible to either source above: five providers carry a caution with no
-- other evidence behind it, and would otherwise show a badge with no reason.
single_veto_reasons as (
  select g.place_id, g.sub_point_code, g.report_count as reports,
         g.last_report_date as last_report, 1 as priority
  from score.gate_veto_status g, run
  where g.scoring_run_id = run.id and g.kind = 'veto' and g.status = 'caution'
),

all_reasons as (
  select * from veto_reasons
  union all
  select * from caution_reasons
  union all
  select * from single_veto_reasons
),
-- One sentence per provider: the gravest reason, then the most reported,
-- then the most recent. A card has room for one line, and the worst thing
-- said about a salon is the line that belongs there.
ranked_reasons as (
  select r.*, row_number() over (
           partition by r.place_id
           order by r.priority desc, r.reports desc, r.last_report desc
         ) as pick
  from all_reasons r
)
select ps.place_id,
       ps.safety_status,
       r.reports        as report_count,
       r.last_report    as last_report_date,
       r.sub_point_code,
       coalesce(ph.words, 'damage') as reported_issue,
       -- "3 customers reported a reaction or burn, latest July 2026"
       r.reports || ' customer' || case when r.reports = 1 then '' else 's' end
         || ' reported ' || coalesce(ph.words, 'damage')
         || ', latest ' || to_char(r.last_report, 'FMMonth YYYY') as reason
-- `run` is cross joined explicitly: written as a comma it would bind the
-- LEFT JOINs below to `run` rather than to `ps`.
from score.provider_safety ps
left join ranked_reasons r on r.place_id = ps.place_id and r.pick = 1
left join phrase ph on ph.code = r.sub_point_code
cross join run
where ps.scoring_run_id = run.id
  and ps.safety_status <> 'clear'
  and r.reports is not null;

comment on view score.v_provider_caution is
  'One plain sentence per provider carrying a caution or a safety concern, built '
  'from the evidence that caused the status. Display only: it changes no score '
  'and no rank.';


-- ---------- 2. Rank everyone, safety last ----------
-- Only the body changes; the returned columns are the same, so every existing
-- caller keeps working.
create or replace function score.rank_providers(p_sub_service text, p_weights numeric[] default null)
returns table (rank_no bigint, place_id text, provider_name text, city text, personal_score numeric,
               range_low numeric, range_high numeric, safety_status text, rank_status text, badges text, evidence_reviews int)
language sql stable as $$
  with w as (
    -- Seven weights, one per WEIGHTED category. Framework v4's category 8
    -- (Overall Verdict) is reported only and carries no user weight, so
    -- generate_series stops at 7 and the join below drops its score rows
    -- from the mean. A shorter array is padded with 1 by the coalesce.
    select g as category_no, coalesce(p_weights[g], 1)::numeric as weight from generate_series(1, 7) g
  ), run as (select max(scoring_run_id) as id from score.scoring_run),
  s as (
    select c.place_id, sum(c.score * w.weight) / nullif(sum(w.weight), 0) as base
    from score.category_score c join w using (category_no), run
    where c.scoring_run_id = run.id and c.sub_service_code = p_sub_service
    group by c.place_id
  ),
  rows as (
    select p.place_id, p.name as provider_name, p.city,
           round(greatest(s.base - t.gate_penalty, 0), 4) as personal_score,
           t.range_low, t.range_high, t.safety_status, t.badges, t.evidence_weight, t.evidence_reviews,
           -- A safety concern is ranked now; only thin evidence is held back.
           case when t.rank_status = 'available but not ranked'
                then 'available but not ranked' else 'ranked' end as rank_status,
           -- Safety still sets precedence: clear, then caution, then concern.
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
$$;

comment on function score.rank_providers(text, numeric[]) is
  'Personalised ranking for one sub-service. Every provider with enough evidence '
  'is ranked, including those carrying a safety concern; safety sets precedence '
  '(clear, then caution, then concern) before the score. score.v_provider_caution '
  'supplies the reason to show beside them.';


-- ---------- 3. The same change one level up ----------
create or replace function score.rank_providers_group(
  p_level text, p_code text, p_weights numeric[] default null
)
returns table (rank_no bigint, place_id text, provider_name text, city text, personal_score numeric,
               range_low numeric, range_high numeric, safety_status text, rank_status text, badges text,
               evidence_reviews int)
language sql stable as $$
  with w as (
    -- Seven weights, one per WEIGHTED category. Framework v4's category 8
    -- (Overall Verdict) is reported only and carries no user weight, so
    -- generate_series stops at 7 and the join below drops its score rows
    -- from the mean. A shorter array is padded with 1 by the coalesce.
    select g as category_no, coalesce(p_weights[g], 1)::numeric as weight from generate_series(1, 7) g
  ),
  run as (select max(scoring_run_id) as id from score.scoring_run),
  members as (
    select sub_service_code, service_code, category_code
    from ref.dim_service
    where case p_level when 'service'  then service_code
                       when 'category' then category_code end = p_code
  ),
  cg as (
    select c.place_id, c.category_no,
           case when sum(c.evidence_weight) > 0
                then sum(c.score * c.evidence_weight) / sum(c.evidence_weight)
                else avg(c.score) end as score
    from score.category_score c
    join members m on m.sub_service_code = c.sub_service_code, run
    where c.scoring_run_id = run.id
    group by c.place_id, c.category_no
  ),
  s as (
    select cg.place_id, sum(cg.score * w.weight) / nullif(sum(w.weight), 0) as base
    from cg join w using (category_no)
    group by cg.place_id
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
  bg as (
    select t.place_id, string_agg(distinct b.badge, '; ') as badges
    from score.trust_score t
    join members m on m.sub_service_code = t.sub_service_code, run
    cross join lateral unnest(string_to_array(t.badges, '; ')) as b(badge)
    where t.scoring_run_id = run.id and t.badges is not null and b.badge <> ''
    group by t.place_id
  ),
  ev as (
    select e.place_id, count(distinct e.review_id)::int as evidence_reviews
    from extract.evidence_item e
    where e.sub_service_code in (select sub_service_code from members)
       or (e.sub_service_code is null
           and e.service_code in (select distinct service_code from members))
       or (p_level = 'category'
           and e.sub_service_code is null and e.service_code is null
           and e.service_category_code = p_code)
    group by e.place_id
  ),
  final as (
    select p.place_id, p.name as provider_name, p.city,
           round(greatest(s.base - g.gate_penalty, 0), 4) as personal_score,
           round(g.range_low, 4) as range_low, round(g.range_high, 4) as range_high,
           g.safety_status, bg.badges, g.evidence_weight,
           coalesce(ev.evidence_reviews, 0) as evidence_reviews,
           case when g.any_ranked then 'ranked' else 'available but not ranked' end as rank_status,
           case g.safety_status when 'clear' then 0 when 'caution' then 1 else 2 end as safety_order
    from s
    join g on g.place_id = s.place_id
    join raw.provider p on p.place_id = s.place_id
    left join bg on bg.place_id = s.place_id
    left join ev on ev.place_id = s.place_id
  )
  select case when f.rank_status = 'ranked'
              then row_number() over (partition by (f.rank_status = 'ranked')
                                      order by f.safety_order, f.personal_score desc, f.evidence_weight desc)
         end as rank_no,
         f.place_id, f.provider_name, f.city, f.personal_score,
         f.range_low, f.range_high, f.safety_status, f.rank_status, f.badges, f.evidence_reviews
  from final f
  order by (f.rank_status = 'ranked') desc, f.safety_order, f.personal_score desc, f.evidence_weight desc;
$$;
