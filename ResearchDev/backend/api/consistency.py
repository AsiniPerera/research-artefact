"""Service Expertise Consistency: how reliably a business delivers good results.

A display badge only. It reads existing Category 1 evidence and changes no
score, no rank and no stored data. The window is counted back from the
current scoring run's reference_date, so the badge matches the scores beside it.
"""
from enum import Enum


class ConsistencyWindow(str, Enum):
    SIX_MONTHS = "6m"
    ONE_YEAR = "1y"
    THREE_YEARS = "3y"
    ANYTIME = "anytime"


class ConsistencyBadge(str, Enum):
    CONSISTENT = "consistent_results"
    MOSTLY_CONSISTENT = "mostly_consistent"
    VARIABLE = "variable_results"
    INSUFFICIENT = "not_enough_evidence"


MIN_REVIEWS = 5
SERIOUS_SHARE_THRESHOLD = 0.10
NOT_POSITIVE_SHARE_THRESHOLD = 0.30
SERIOUS_SEVERITIES = ["needs correction", "irreversible", "damage"]

WINDOW_MONTHS = {
    ConsistencyWindow.SIX_MONTHS: 6,
    ConsistencyWindow.ONE_YEAR: 12,
    ConsistencyWindow.THREE_YEARS: 36,
    ConsistencyWindow.ANYTIME: None,
}
WINDOW_LABELS = {
    ConsistencyWindow.SIX_MONTHS: "within 6 months",
    ConsistencyWindow.ONE_YEAR: "within 1 year",
    ConsistencyWindow.THREE_YEARS: "within 3 years",
    ConsistencyWindow.ANYTIME: "anytime",
}

# One row per (business, review): the worst Category 1 statement in that review,
# over all its statements and over those about the requested service only.
# 3 = serious negative, 2 = negative, 1 = mixed, 0 = positive.
_SQL = """
with ref as (
    select coalesce(
        (select reference_date from score.scoring_run order by scoring_run_id desc limit 1),
        (select max(published_at)::date from raw.review)
    ) as d
),
rated as (
    select e.place_id, e.review_id, e.service_code,
           case when e.polarity = 'negative' and e.severity = any(%(serious)s) then 3
                when e.polarity = 'negative' then 2
                when e.polarity = 'mixed' then 1
                else 0 end as w
    from extract.evidence_item e
    join raw.review r using (review_id)
    cross join ref
    where e.place_id = any(%(ids)s)
      and e.sub_point_code like '1.%%'
      and e.polarity in ('positive', 'negative', 'mixed')
      and not e.reviewer_fault
      and (%(months)s::int is null
           or r.published_at::date >= ref.d - make_interval(months => %(months)s::int))
)
select place_id, review_id,
       max(w) as worst_all,
       max(w) filter (where service_code = %(svc)s) as worst_svc
from rated
group by place_id, review_id
"""


def _badge(worst):
    n = len(worst)
    if n < MIN_REVIEWS:
        return ConsistencyBadge.INSUFFICIENT
    serious = sum(1 for w in worst if w == 3) / n
    non_pos = sum(1 for w in worst if w >= 1) / n
    if serious >= SERIOUS_SHARE_THRESHOLD or non_pos >= NOT_POSITIVE_SHARE_THRESHOLD:
        return ConsistencyBadge.VARIABLE
    if non_pos > 0:
        return ConsistencyBadge.MOSTLY_CONSISTENT
    return ConsistencyBadge.CONSISTENT


def consistency_for(cur, place_ids, window=ConsistencyWindow.ONE_YEAR, service_code=None):
    """{place_id: consistency dict} for every id, in one query.

    Uses the requested service's reviews when it has at least MIN_REVIEWS,
    otherwise all the business's Category 1 reviews.
    """
    ids = list({p for p in place_ids if p})
    if not ids:
        return {}
    cur.execute(_SQL, {"ids": ids, "months": WINDOW_MONTHS[window],
                       "serious": SERIOUS_SEVERITIES, "svc": service_code})
    all_w, svc_w = {}, {}
    for r in cur.fetchall():
        all_w.setdefault(r["place_id"], []).append(r["worst_all"])
        if r["worst_svc"] is not None:
            svc_w.setdefault(r["place_id"], []).append(r["worst_svc"])

    out = {}
    for pid in ids:
        s = svc_w.get(pid, [])
        if service_code and len(s) >= MIN_REVIEWS:
            worst, level = s, "service"
        else:
            worst, level = all_w.get(pid, []), "business"
        out[pid] = {"badge": _badge(worst).value, "level": level, "review_count": len(worst),
                    "window": window.value, "window_label": WINDOW_LABELS[window]}
    return out
