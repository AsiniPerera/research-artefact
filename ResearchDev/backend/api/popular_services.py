"""What a business is actually reviewed for.

Display only: read from existing evidence, changes no score and no rank.

The share is of CATEGORY MENTIONS, not of reviews. A review that talks about
both a haircut and a facial counts under each, so the denominator is the sum
of the per-category counts rather than the review count.
"""

POPULAR_SERVICES_MIN_REVIEWS = 5
POPULAR_SERVICES_SINGLE_SHARE = 0.60     # one dominant category
POPULAR_SERVICES_PAIR_SHARE = 0.80       # top two combined
POPULAR_SERVICES_TOP_N = 3

# The `case` below merges MG into HR. Taxonomy v9 folded Beard & Shave into
# Hair and dropped the standalone "Gents' Grooming" category, but the evidence
# is still tagged MG, and ref.service_category still carries the name. Without
# the merge this badge would be the one place in the app still naming a
# category v9 removed. SalonDetail does the same remap on read; the counts are
# merged rather than dropped because the reviews are real Hair work.
_SQL = """
with r as (
    select e.place_id, e.review_id,
           case when e.service_category_code = 'MG' then 'HR'
                else e.service_category_code end as service_category_code
    from extract.evidence_item e
    where e.place_id = any(%(ids)s)
      and e.service_category_code is not null
      and e.polarity in ('positive', 'negative', 'mixed')
    group by e.place_id, e.review_id, 3
),
per_cat as (
    select place_id, service_category_code, count(distinct review_id) as n
    from r group by place_id, service_category_code
),
with_total as (
    select p.*, sum(n) over (partition by p.place_id) as total,
           sc.name as category_name
    from per_cat p
    join ref.service_category sc on sc.code = p.service_category_code
)
select place_id, category_name, n, total, (n * 1.0 / total) as share
from with_total
order by place_id, n desc, category_name
"""


def popular_services_for(cur, place_ids):
    """{place_id: {"badge": str | None, "top": [{"name", "share"}, ...]}}"""
    ids = list({p for p in place_ids if p})
    if not ids:
        return {}
    cur.execute(_SQL, {"ids": ids})
    rows = {}
    for r in cur.fetchall():
        rows.setdefault(r["place_id"], []).append(r)

    out = {}
    for pid in ids:
        cats = rows.get(pid, [])
        top = [{"name": c["category_name"], "share": round(float(c["share"]), 2)}
               for c in cats[:POPULAR_SERVICES_TOP_N]]
        badge = None
        if cats and cats[0]["total"] >= POPULAR_SERVICES_MIN_REVIEWS:
            first = float(cats[0]["share"])
            if first >= POPULAR_SERVICES_SINGLE_SHARE:
                badge = f"Mostly {cats[0]['category_name']}"
            elif len(cats) > 1 and first + float(cats[1]["share"]) >= POPULAR_SERVICES_PAIR_SHARE:
                badge = f"Mostly {cats[0]['category_name']} and {cats[1]['category_name']}"
        out[pid] = {"badge": badge, "top": top}
    return out
