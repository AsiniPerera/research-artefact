-- Run after loading. Each query should return the figure in the comment.

-- 1. Reference data: 5 / 17 / 51 / 8 / 26
--    Taxonomy v9 is 5 / 17 / 51. Framework v4 is 7 weighted categories plus
--    Overall Verdict (8 rows), and 25 sub-points plus `overall` (26 rows).
select (select count(*) from ref.service_category) as categories,
       (select count(*) from ref.service)          as services,
       (select count(*) from ref.sub_service)      as sub_services,
       (select count(*) from ref.framework_category) as framework_categories,
       (select count(*) from ref.sub_point)        as sub_points;

-- 2. Loaded data: 549 / 27122 / 6847 / 44594
select (select count(*) from raw.provider)          as providers,
       (select count(*) from raw.review)            as reviews,
       (select count(*) from raw.owner_reply)       as owner_replies,
       (select count(*) from extract.evidence_item) as evidence_items;

-- 3. Every evidence row traces to a review of the same provider: 0
select count(*) as mismatched_provider
from extract.evidence_item e join raw.review r using (review_id)
where e.place_id <> r.place_id;

-- 4. Evidence by framework category and polarity
select category_no, polarity, count(*) from extract.v_evidence group by 1, 2 order by 1, 2;

-- 5. Preview of the gate / veto rule: providers with 2 or more qualifying reports in the last 24 months,
--    at least 7 days apart. Near-copy checks are not applied yet.
--    Framework v4 marks NO sub-point as a gate or a veto, so this returns no rows.
--    It is kept because the rule is still implemented and driven off is_gate /
--    is_veto: mark a sub-point in 02_reference_data.sql and this answers again.
with q as (
  select e.place_id, e.sub_point_code, r.published_at::date as d
  from extract.evidence_item e
  join raw.review r using (review_id)
  join ref.sub_point sp on sp.code = e.sub_point_code
  where (sp.is_gate or sp.is_veto)
    and e.polarity in ('negative', 'mixed')
    and not e.reviewer_fault and not e.needs_manual_check
    and r.published_at >= now() - interval '24 months'
)
select sub_point_code, count(*) as providers_meeting_rule
from (select place_id, sub_point_code from q group by 1, 2 having count(*) >= 2 and max(d) - min(d) >= 7) t
group by 1 order by 1;

-- 6. Rows per extraction run: all 44,594 live rows belong to run 4 (framework v4).
--    Runs 1-3 are kept for the audit trail and hold no rows.
select run_id, count(*) as evidence_items, count(distinct review_id) as reviews from extract.evidence_item group by 1 order by 1;

-- 7. Safety sub-points, which the scoring reads from is_safety rather than a
--    hard-coded list: 7.1, 7.2, 7.3
select code, customer_question from ref.sub_point where is_safety order by code;

-- 8. Overall Verdict is reported only and must never enter the weighted mean:
--    one row, category 8, is_score false, is_reported_only true, weight 0.
select sp.code, sp.category_no, sp.is_score, sp.is_reported_only, fc.weight
from ref.sub_point sp join ref.framework_category fc using (category_no)
where sp.is_reported_only;

-- 9. The seven weighted categories each carry 1/7 and sum to 1: 0.99998 to 1.00002
select round(sum(weight), 5) as total_weight, count(*) as weighted_categories
from ref.framework_category where weight > 0;