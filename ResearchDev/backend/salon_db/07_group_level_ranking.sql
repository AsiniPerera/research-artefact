-- Step 7: ranking one level up — a service, or a whole category.
-- Run once in the Supabase SQL Editor (safe to re-run). Additive: it creates
-- one function and changes nothing that already exists.
--
-- WHY
-- Scores are calculated per sub-service, and 14 of the 51 sub-services have no
-- provider precise enough to rank (Clean Shave, Chemical Peels, Perming …).
-- Asking for one of those returns an empty list, which reads as "no good salons"
-- when the truth is "not enough reviews name this exact service yet". The app
-- answers instead with the service above it, and then the category above that,
-- and says plainly which level it fell back to.
--
-- WHAT THIS IS NOT
-- This is not a re-score. score.category_score and score.trust_score are
-- untouched, and score.rank_providers — the published per-sub-service ranking —
-- still answers exactly as before and is what the app uses whenever the
-- sub-service itself can be ranked. This function only *combines* numbers that
-- the scoring run already wrote, for the case where the exact service cannot.
--
-- HOW A GROUP SCORE IS FORMED  (group = the sub-services under one service, or
-- under one category)
--   category score  evidence-weighted mean, across the group, of the provider's
--                   score for that framework category. Weighting by
--                   evidence_weight is what stops a sub-service the provider has
--                   one passing mention of from counting as loudly as one with
--                   thirty reviews behind it. With no evidence anywhere in the
--                   group every score is the 0.5 prior, so a plain mean is used
--                   and the answer is still 0.5.
--   personal score  those seven category scores under the user's own weights,
--                   then the gate penalty, exactly as score.rank_providers does.
--                   Category 8, Overall Verdict, is reported only and is not
--                   among them.
--   gate penalty    the largest that applies anywhere in the group. A gate is
--                   applied by tier, and a group mixes tiers; taking the
--                   largest keeps a consultation or patch-test failure from
--                   being averaged away by gentler services beside it.
--   range           the 80% range, evidence-weighted across the group on the
--                   same weights as the score, so the interval travels with the
--                   number it belongs to.
--   ranked?         a provider is ranked for the group when it is ranked for at
--                   least one sub-service in it — that is, it has already met
--                   the precision bar its tier demands somewhere in this group.
--                   The group never manufactures precision that no single
--                   service earned.
--   safety          provider-wide and untouched: a safety concern is never
--                   ranked, at any level, whatever the score.
--   evidence        reviews whose evidence falls inside the group, counted once
--                   each. Summing the per-sub-service counts would count one
--                   review many times over.

create or replace function score.rank_providers_group(
  p_level   text,                        -- 'service' or 'category'
  p_code    text,                        -- 'HR.CUT' for a service, 'HR' for a category
  p_weights numeric[] default null       -- the user's seven weights, category 1 to 7
)
returns table (rank_no bigint, place_id text, provider_name text, city text, personal_score numeric,
               range_low numeric, range_high numeric, safety_status text, rank_status text, badges text,
               evidence_reviews int)
language sql stable as $fn$
  with w as (
    -- Seven weights, one per WEIGHTED category. Framework v5's category 8
    -- (Overall Verdict) is reported only and carries no user weight, so
    -- generate_series stops at 7 and the join below drops its score rows
    -- from the mean. A shorter array is padded with 1 by the coalesce.
    select g as category_no, coalesce(p_weights[g], 1)::numeric as weight from generate_series(1, 7) g
  ),
  run as (select max(scoring_run_id) as id from score.scoring_run),

  -- The sub-services this request covers.
  members as (
    select sub_service_code, service_code, category_code
    from ref.dim_service
    where case p_level when 'service'  then service_code
                       when 'category' then category_code end = p_code
  ),

  -- One score per provider per framework category, pooled across the group.
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

  -- Everything else the group inherits from its sub-service rows.
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
           min(t.safety_status) as safety_status     -- provider-wide, identical on every row
    from score.trust_score t
    join members m on m.sub_service_code = t.sub_service_code, run
    where t.scoring_run_id = run.id
    group by t.place_id
  ),

  -- The badges earned anywhere in the group, each named once.
  bg as (
    select t.place_id, string_agg(distinct b.badge, '; ') as badges
    from score.trust_score t
    join members m on m.sub_service_code = t.sub_service_code, run
    cross join lateral unnest(string_to_array(t.badges, '; ')) as b(badge)
    where t.scoring_run_id = run.id and t.badges is not null and b.badge <> ''
    group by t.place_id
  ),

  -- Reviews that speak about this group, counted once each.
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
           case when g.safety_status = 'safety concern' then 'not ranked: safety concern'
                when g.any_ranked                       then 'ranked'
                else 'available but not ranked' end as rank_status
    from s
    join g on g.place_id = s.place_id
    join raw.provider p on p.place_id = s.place_id
    left join bg on bg.place_id = s.place_id
    left join ev on ev.place_id = s.place_id
  )
  select case when f.rank_status = 'ranked'
              then row_number() over (partition by (f.rank_status = 'ranked')
                                      order by (f.safety_status = 'clear') desc,
                                               f.personal_score desc, f.evidence_weight desc)
         end as rank_no,
         f.place_id, f.provider_name, f.city, f.personal_score,
         f.range_low, f.range_high, f.safety_status, f.rank_status, f.badges, f.evidence_reviews
  from final f
  order by (f.rank_status = 'ranked') desc, (f.safety_status = 'clear') desc,
           f.personal_score desc, f.evidence_weight desc;
$fn$;

comment on function score.rank_providers_group(text, text, numeric[]) is
  'Ranking one level up: the sub-services under a service or a category, pooled by '
  'evidence weight. Used only when score.rank_providers finds nothing to rank for '
  'the sub-service itself. Does not re-score: it combines the scoring run''s own numbers.';
