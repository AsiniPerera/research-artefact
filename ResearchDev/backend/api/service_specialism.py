"""Which one service a business is most reviewed for, among the services it offers.

Helper for main.py, which calls specialism_for when building a provider
profile. Display only: it reads score.category9_window (9.2, "service
specialism") and changes no score and no rank. 9.2 is computed per business
x service x window in 06_run_scoring.py and no longer feeds Category 9's
ranked score -- this is where that number is actually used.

The share is the Laplace-smoothed (1+n)/(2+total) already written by the
scorer, not recomputed here: category9_window is already at the right
grain, so this reads it back rather than re-scanning evidence_item the way
popular_services_for does for its own, differently-shaped question.
"""

SPECIALISM_MIN_REVIEWS = 5                # matches cat9_min_service_reviews;
                                           # scores below this are already NULL
SPECIALISM_BADGE_THRESHOLD = 0.75         # share needed to call it a specialism
SPECIALISM_TOP_N = 3

_SQL = """
select cw.place_id, d.sub_service as name, cw.score_9_2 as share
from score.category9_window cw
join ref.dim_service d on d.sub_service_code = cw.sub_service_code
where cw.scoring_run_id = (select max(scoring_run_id) from score.scoring_run)
  and cw.place_id = any(%(ids)s)
  and cw.window_code = %(window)s
  and cw.score_9_2 is not null
order by cw.place_id, cw.score_9_2 desc
"""


def specialism_for(cur, place_ids, window):
    """{place_id: {"badge": str | None, "top": [{"name", "share"}, ...]}}"""
    ids = list({p for p in place_ids if p})
    if not ids:
        return {}
    cur.execute(_SQL, {"ids": ids, "window": window})
    rows = {}
    for r in cur.fetchall():
        rows.setdefault(r["place_id"], []).append(r)

    out = {}
    for pid in ids:
        services = rows.get(pid, [])
        top = [{"name": s["name"], "share": round(float(s["share"]), 2)}
               for s in services[:SPECIALISM_TOP_N]]
        badge = None
        if services and float(services[0]["share"]) >= SPECIALISM_BADGE_THRESHOLD:
            badge = f"Specialist in {services[0]['name']}"
        out[pid] = {"badge": badge, "top": top}
    return out
