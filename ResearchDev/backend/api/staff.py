"""Staff named in a business's reviews, with how each is spoken about.

Helper for main.py, which calls staff_card_for once per ranking response and
staff_for when building a provider profile. Display only: it reads existing
extraction output and changes no score, no rank and no stored data.

ATTRIBUTION IS REVIEW-LEVEL. A name is attached to the review that
mentions it, not to the individual statement, so a review reading
"Nimal was lovely but the colour was patchy" counts its negative outcome
against Nimal. The UI says so rather than implying a precision the
extraction does not have.
"""

STAFF_MIN_REVIEWS = 3

# "Who serves you matters": at least this many staff at the threshold, whose
# best and worst positive rates differ by at least this much.
#
# READ THE GAP WITH CARE. At STAFF_MIN_REVIEWS = 3 the gap is usually set by
# one person at the floor with a single non-positive review: 2/3 against a
# colleague's 1.0 is a gap of 0.333 before any pattern exists. Raising the
# floor to 4 reviews halves the businesses that qualify, and 6 removes them
# all, so this flag reports a difference in what has been said, not a
# measured difference in the people. Section 15 records the sensitivity.
STAFF_DEPENDENT_MIN_STAFF = 2
STAFF_DEPENDENT_GAP = 0.25

# staging.staff_names.evidence_id keys into staging.evidence_item (ids
# 1-9999), NOT extract.evidence_item, whose ids occupy the same range and
# would silently join to unrelated rows. staging is the bridge to a
# review_id, and the outcome polarities are read from extract against that.
_SQL = """
with named as (
    select distinct se.place_id, se.review_id, sn.staff_name
    from staging.staff_names sn
    join staging.evidence_item se
      on se.evidence_id::text = sn.evidence_id::text
    where sn.staff_name is not null and sn.staff_name <> ''
),
any_outcome as (
    -- One row per review: its worst outcome across every category, so a
    -- review counts once however many statements it makes. Someone
    -- choosing a stylist wants the whole picture, not quality alone.
    select e.place_id, e.review_id,
           max(case when e.polarity = 'negative' then 2
                    when e.polarity = 'mixed'    then 1
                    else 0 end) as worst
    from extract.evidence_item e
    where e.place_id = any(%(ids)s)
      and e.polarity in ('positive', 'negative', 'mixed')
      and not e.reviewer_fault
    group by e.place_id, e.review_id
)
select c.place_id, n.staff_name,
       count(*)                            as reviews,
       count(*) filter (where c.worst = 0) as positive,
       count(*) filter (where c.worst = 1) as mixed,
       count(*) filter (where c.worst = 2) as negative
from any_outcome c
join named n on n.place_id = c.place_id and n.review_id = c.review_id
group by c.place_id, n.staff_name
having count(*) >= %(min)s
order by c.place_id, reviews desc, n.staff_name
"""


# The same shape as the list query, carried only as far as a rate per staff
# member. The place filter sits in the two scans rather than after the
# grouping: applied at the end it would build a rate for every staff member at
# all 549 businesses before discarding all but the page being ranked.
_FLAG_SQL = """
with named as (
    select distinct se.place_id, se.review_id, sn.staff_name
    from staging.staff_names sn
    join staging.evidence_item se
      on se.evidence_id::text = sn.evidence_id::text
    where sn.staff_name is not null and sn.staff_name <> ''
      and se.place_id = any(%(ids)s)
),
any_outcome as (
    select e.place_id, e.review_id,
           max(case when e.polarity = 'negative' then 2
                    when e.polarity = 'mixed'    then 1
                    else 0 end) as worst
    from extract.evidence_item e
    where e.place_id = any(%(ids)s)
      and e.polarity in ('positive', 'negative', 'mixed')
      and not e.reviewer_fault
    group by e.place_id, e.review_id
),
per_staff as (
    select n.place_id, n.staff_name,
           1.0 * count(*) filter (where c.worst = 0) / count(*) as pos_rate
    from any_outcome c
    join named n on n.place_id = c.place_id and n.review_id = c.review_id
    group by n.place_id, n.staff_name
    having count(*) >= %(min)s
)
select p.place_id,
       max(p.pos_rate) - min(p.pos_rate) as gap,
       count(*) as n_staff
from per_staff p
group by p.place_id
"""


def staff_dependent_flag(staff):
    """The flag for one business, from a list staff_for has already built.

    Shared so the profile does not run a second query to answer what the
    list it is already returning can answer, and so both routes cannot
    drift to two different rules.
    """
    # From the raw counts, not the rounded positive_rate the UI shows: a
    # rate rounded to 2dp can cross the threshold the SQL path would not,
    # and the two routes must answer the same question the same way.
    rates = [s["positive"] / s["reviews"] for s in staff]
    if len(rates) < STAFF_DEPENDENT_MIN_STAFF:
        return False
    return (max(rates) - min(rates)) >= STAFF_DEPENDENT_GAP


def staff_dependent_for(cur, place_ids):
    """{place_id: bool} for every id, in one query.

    For rank rows, which carry the flag but not the staff list behind it.
    """
    ids = list({p for p in place_ids if p})
    if not ids:
        return {}
    cur.execute(_FLAG_SQL, {"ids": ids, "min": STAFF_MIN_REVIEWS})
    out = {pid: False for pid in ids}
    for r in cur.fetchall():
        out[r["place_id"]] = (
            r["n_staff"] >= STAFF_DEPENDENT_MIN_STAFF
            and (r["gap"] or 0) >= STAFF_DEPENDENT_GAP
        )
    return out


def staff_for(cur, place_ids):
    """{place_id: {"staff": [...]}} for every id, in one query.

    The list is empty for a business whose reviews name nobody often
    enough — which is most of them: name extraction caught a name on
    186 of 549 businesses, and 67 have someone at the threshold.
    """
    ids = list({p for p in place_ids if p})
    if not ids:
        return {}
    cur.execute(_SQL, {"ids": ids, "min": STAFF_MIN_REVIEWS})
    out = {pid: {"staff": []} for pid in ids}
    for r in cur.fetchall():
        out[r["place_id"]]["staff"].append({
            "name": r["staff_name"],
            "reviews": r["reviews"],
            "positive": r["positive"],
            "mixed": r["mixed"],
            "negative": r["negative"],
            "positive_rate": round(r["positive"] / r["reviews"], 2),
        })
    return out


# One staff member's reviews at one business. The `named` CTE is not filtered
# by place: a name can occur at several salons, and the place is pinned by
# any_outcome and by raw.review below, so the join cannot leak another
# business's reviews in.
_REVIEWS_SQL = """
with named as (
    select distinct se.review_id
    from staging.staff_names sn
    join staging.evidence_item se
      on se.evidence_id::text = sn.evidence_id::text
    where sn.staff_name = %(staff)s
),
any_outcome as (
    select e.review_id,
           max(case when e.polarity = 'negative' then 2
                    when e.polarity = 'mixed'    then 1
                    else 0 end) as worst
    from extract.evidence_item e
    where e.place_id = %(place_id)s
      and e.polarity in ('positive', 'negative', 'mixed')
      and not e.reviewer_fault
    group by e.review_id
)
select r.review_id, r.stars, r.published_at,
       r.source_language, r.review_text, a.worst
from any_outcome a
join named n using (review_id)
join raw.review r on r.review_id = a.review_id
where r.place_id = %(place_id)s
order by r.published_at desc nulls last, r.review_id
limit 50
"""

_OUTCOME = {0: "positive", 1: "mixed", 2: "negative"}


def reviews_for_staff(cur, place_id, staff_name):
    """Up to 50 reviews naming this staff member at this business, newest
    first.

    [] when the name is unknown here — which is also what an unrecognised
    name gives, deliberately: the caller gets an empty list rather than an
    error to tell apart.
    """
    cur.execute(_REVIEWS_SQL, {"place_id": place_id, "staff": staff_name})
    return [{
        "review_id": r["review_id"],
        "stars": r["stars"],
        "published_at": r["published_at"].isoformat() if r["published_at"] else None,
        "language": r["source_language"],
        "text": r["review_text"],
        "outcome": _OUTCOME[r["worst"]],
    } for r in cur.fetchall()]


# The staff list reduced to a count and the two most-named, for a card that
# has room for a line rather than a list. Same threshold as the full list, so
# a card and the profile behind it can never disagree about who counts.
_SUMMARY_SQL = """
with named as (
    select distinct se.place_id, se.review_id, sn.staff_name
    from staging.staff_names sn
    join staging.evidence_item se
      on se.evidence_id::text = sn.evidence_id::text
    where sn.staff_name is not null and sn.staff_name <> ''
      and se.place_id = any(%(ids)s)
),
any_outcome as (
    select e.place_id, e.review_id,
           max(case when e.polarity = 'negative' then 2
                    when e.polarity = 'mixed'    then 1
                    else 0 end) as worst
    from extract.evidence_item e
    where e.place_id = any(%(ids)s)
      and e.polarity in ('positive', 'negative', 'mixed')
      and not e.reviewer_fault
    group by e.place_id, e.review_id
),
per_staff as (
    select n.place_id, n.staff_name, count(*) as reviews
    from any_outcome c
    join named n on n.place_id = c.place_id and n.review_id = c.review_id
    group by n.place_id, n.staff_name
    having count(*) >= %(min)s
)
select place_id,
       count(*) as total,
       (array_agg(staff_name order by reviews desc, staff_name))[1:2] as top
from per_staff
group by place_id
"""


def named_staff_summary_for(cur, place_ids):
    """{place_id: {"count": int, "top": [name, ...]}} for every id."""
    ids = list({p for p in place_ids if p})
    if not ids:
        return {}
    cur.execute(_SUMMARY_SQL, {"ids": ids, "min": STAFF_MIN_REVIEWS})
    out = {pid: {"count": 0, "top": []} for pid in ids}
    for r in cur.fetchall():
        out[r["place_id"]] = {"count": r["total"], "top": r["top"] or []}
    return out


# Everything a ranking row needs about staff, in ONE pass.
#
# The flag and the summary are the same scan asked two questions: both walk
# every outcome-bearing statement for every business on the page to build a
# rate per staff member. Run separately they cost a ranking about two and a
# half seconds; asked together, one of those scans disappears.
_CARD_SQL = """
with named as (
    select distinct se.place_id, se.review_id, sn.staff_name
    from staging.staff_names sn
    join staging.evidence_item se
      on se.evidence_id::text = sn.evidence_id::text
    where sn.staff_name is not null and sn.staff_name <> ''
      and se.place_id = any(%(ids)s)
),
any_outcome as (
    select e.place_id, e.review_id,
           max(case when e.polarity = 'negative' then 2
                    when e.polarity = 'mixed'    then 1
                    else 0 end) as worst
    from extract.evidence_item e
    where e.place_id = any(%(ids)s)
      and e.polarity in ('positive', 'negative', 'mixed')
      and not e.reviewer_fault
    group by e.place_id, e.review_id
),
per_staff as (
    select n.place_id, n.staff_name,
           count(*) as reviews,
           1.0 * count(*) filter (where c.worst = 0) / count(*) as pos_rate
    from any_outcome c
    join named n on n.place_id = c.place_id and n.review_id = c.review_id
    group by n.place_id, n.staff_name
    having count(*) >= %(min)s
)
select place_id,
       count(*) as n_staff,
       max(pos_rate) - min(pos_rate) as gap,
       (array_agg(staff_name order by reviews desc, staff_name))[1:2] as top
from per_staff
group by place_id
"""


def staff_card_for(cur, place_ids):
    """{place_id: {"staff_dependent": bool,
                   "named_staff": {"count": int, "top": [name, ...]}}}

    What a ranking row needs, in one query. Same thresholds and the same
    rules as staff_dependent_for and named_staff_summary_for, which answer
    the two halves separately for callers that want only one.
    """
    ids = list({p for p in place_ids if p})
    if not ids:
        return {}
    cur.execute(_CARD_SQL, {"ids": ids, "min": STAFF_MIN_REVIEWS})
    out = {pid: {"staff_dependent": False, "named_staff": {"count": 0, "top": []}}
           for pid in ids}
    for r in cur.fetchall():
        out[r["place_id"]] = {
            "staff_dependent": (r["n_staff"] >= STAFF_DEPENDENT_MIN_STAFF
                                and (r["gap"] or 0) >= STAFF_DEPENDENT_GAP),
            "named_staff": {"count": r["n_staff"], "top": r["top"] or []},
        }
    return out
