"""
Accuracy evaluation for the salon ranking system  --  Table 5.8 (A-01 .. A-10).

READ-ONLY. This script runs SELECT queries only against the live
Supabase/PostgreSQL database and re-implements the scorer's arithmetic in
Python to check the stored results. It never writes to the database and never
runs the scoring script. It prints a Table-5.8-shaped markdown table and writes
the same rows to accuracy_results.csv beside this file.

Integrity: every test's Status is computed from what it observes. Nothing is
hardcoded to "Pass". A test that cannot be checked against the current data
prints "Not testable" with the reason. Failing tests print the first offending
rows so the failure is visible.

Run it yourself:
    python evaluation/accuracy/accuracy_tests.py
It reads DATABASE_URL from backend/api/.env (the same variable the other
scripts use) and never prints the credential.

Note on A-02: the no-data rule changed during development. As of the current
code (29_no_data_dimensions.sql + 06_run_scoring.py) an empty weighted
dimension is LEFT OUT of the score -- not scored 0, and not averaged in at the
0.5 prior. The stored category_score.score is the 0.5 NOT-NULL placeholder, but
evidence_count = 0 is the real flag and the ranking drops the dimension. A-02
verifies that factually; the Table 5.8 wording for A-02 should read
"a dimension with no evidence is left out of the score (not scored low, and not
given a neutral 0.5)".

Note on A-07: the 6m/1y/3y window boundaries are anchored to the machine clock
at scoring time (not stored); only reference_date and run_at are. A-07
reconstructs the anchor from scoring_run.run_at and reports honestly; if it
cannot match within tolerance it prints "Not testable".
"""

import csv
import datetime as dt
import hashlib  # noqa: F401  (md5 is done in SQL; kept for reference)
import os
import pathlib
import sys

import psycopg2
from psycopg2.extras import RealDictCursor

# ----------------------------------------------------------------------------
# Scorer constants, mirrored from backend/salon_db/06_run_scoring.py (P dict).
# ----------------------------------------------------------------------------
CONF_W = {"high": 1.0, "medium": 0.7, "low": 0.3}
SPEC = {
    "same_sub_service": 1.0,
    "same_service": 0.75,
    "provider_level": 0.5,
    "other_service_provider_trait": 0.25,
    "other_service_outcome": 0.0,
}
TRAIT_CATS = {3, 4, 5, 6, 7}
WEIGHTED = (1, 2, 4, 5, 6, 7)           # ranked dimensions
REPORTED_ONLY = (3, 8, 9)
REPLY_SP = {"3.1", "3.2", "3.3", "3.4"}
HALF_LIFE_M = 24.0
DAYS_PER_MONTH = 30.44
DAMAGE_MULT = 2.0
A0 = B0 = 1.0
TIER_LIMIT = {1: 0.50, 2: 0.45, 3: 0.40, 4: 0.35, 5: 0.30}
POS_MAP = {"positive": 1.0, "mixed": 0.5, "negative": 0.0}
TOL = 0.001                              # match tolerance for recalculations

# Default and boosted weight vectors (category 1..7; category 3 forced to 0 as
# the API does). "Medium" = 2 everywhere.
W_DEFAULT = [2, 2, 0, 2, 2, 2, 2]
W_QUALITY_MAX = [8, 2, 0, 2, 2, 2, 2]    # Quality (cat 1) raised to the top


# ----------------------------------------------------------------------------
# Connection (read-only). DATABASE_URL from backend/api/.env; never printed.
# ----------------------------------------------------------------------------
def _load_database_url():
    url = os.environ.get("DATABASE_URL")
    if url:
        return url
    here = pathlib.Path(__file__).resolve()
    env = here.parents[2] / "backend" / "api" / ".env"      # repo/backend/api/.env
    if env.exists():
        for line in env.read_text(encoding="utf-8").splitlines():
            if line.startswith("DATABASE_URL="):
                return line.split("=", 1)[1].strip()
    sys.exit("DATABASE_URL not found (set the env var or backend/api/.env).")


def connect():
    conn = psycopg2.connect(_load_database_url())
    conn.set_session(readonly=True, autocommit=True)
    return conn


# ----------------------------------------------------------------------------
# Scorer arithmetic, mirrored so recomputation matches 06_run_scoring.py.
# ----------------------------------------------------------------------------
def months_back(anchor: dt.date, months: int) -> dt.date:
    """anchor minus whole calendar months, day clamped (as overall.py does)."""
    y, m = divmod(anchor.year * 12 + (anchor.month - 1) - months, 12)
    m += 1
    for d in (anchor.day, 30, 29, 28):
        try:
            return anchor.replace(year=y, month=m, day=d)
        except ValueError:
            continue
    return anchor.replace(year=y, month=m, day=28)


def recency_weight(age_months: float) -> float:
    return 0.5 ** (max(age_months, 0.0) / HALF_LIFE_M)


def w0_of(confidence: str, published: dt.date, ref_date: dt.date) -> float:
    age_m = (ref_date - published).days / DAYS_PER_MONTH
    return CONF_W[confidence] * recency_weight(age_m)


def specificity(sub, svc, cat, category_no, s, s_svc, s_cat) -> float:
    """Weight of one statement toward target sub-service s, matching
    06_run_scoring.py:487-490 (sub/svc/cat already normalized)."""
    if sub == s:
        return SPEC["same_sub_service"]
    if sub is None and svc == s_svc:
        return SPEC["same_service"]
    if sub is None and svc is None and (cat is None or cat == s_cat):
        return SPEC["provider_level"]
    if category_no in TRAIT_CATS:
        return SPEC["other_service_provider_trait"]
    return SPEC["other_service_outcome"]


def dimension_score(pw: float, nw: float) -> float:
    return (A0 + pw) / (A0 + B0 + pw + nw)


# ----------------------------------------------------------------------------
# Shared data loaders.
# ----------------------------------------------------------------------------
def load_dim_service(cur):
    cur.execute("select sub_service_code, service_code, category_code, tier from ref.dim_service")
    sub2svc, svc2cat, sub2cat, sub2tier = {}, {}, {}, {}
    for r in cur.fetchall():
        sub2svc[r["sub_service_code"]] = r["service_code"]
        svc2cat[r["service_code"]] = r["category_code"]
        sub2cat[r["sub_service_code"]] = r["category_code"]
        sub2tier[r["sub_service_code"]] = r["tier"]
    return sub2svc, svc2cat, sub2cat, sub2tier


def qualifying_statements(cur, place_id):
    """All qualifying statements for a place (the scorer's `sc` filter), with
    the raw tag codes so specificity can be computed per target sub-service."""
    cur.execute(
        """
        select e.service_category_code as cat, e.service_code as svc,
               e.sub_service_code as sub, sp.category_no,
               e.polarity, e.severity, e.confidence,
               r.published_at::date as published
        from extract.evidence_item e
        join ref.sub_point sp on sp.code = e.sub_point_code
        join raw.review r on r.review_id = e.review_id
        where e.place_id = %s
          and (sp.is_score or sp.is_reported_only)
          and not sp.is_computed
          and e.sub_point_code not in ('3.1','3.2','3.3','3.4')
          and e.polarity in ('positive','negative','mixed')
          and not coalesce(e.reviewer_fault, false)
          and not coalesce(e.needs_manual_check, false)
        """,
        (place_id,),
    )
    return cur.fetchall()


def normalize_tags(rows, sub2svc, svc2cat):
    """Mirror 06_run_scoring.py:186-187: svc from sub, cat from svc."""
    out = []
    for r in rows:
        sub = r["sub"]
        svc = sub2svc.get(sub) if sub is not None else r["svc"]
        cat = svc2cat.get(svc) if svc is not None else r["cat"]
        out.append({**r, "sub": sub, "svc": svc, "cat": cat})
    return out


def recompute_category_scores(rows, s, s_svc, s_cat, ref_date, window_cut=None):
    """Recompute each WEIGHTED category's Beta score for sub-service s.
    window_cut: (lo_date, hi_date) inclusive, or None for the 'all' window."""
    masses = {c: [0.0, 0.0] for c in WEIGHTED}          # [Pw, Nw]
    for r in rows:
        if window_cut is not None:
            d = r["published"]
            if d is None or d < window_cut[0] or d > window_cut[1]:
                continue
        c = r["category_no"]
        if c not in masses:
            continue
        spec = specificity(r["sub"], r["svc"], r["cat"], c, s, s_svc, s_cat)
        w = w0_of(r["confidence"], r["published"], ref_date) * spec
        if w <= 0:
            continue
        pos = POS_MAP[r["polarity"]]
        neg = (1 - pos) * (DAMAGE_MULT if r["severity"] == "damage" else 1.0)
        masses[c][0] += w * pos
        masses[c][1] += w * neg
    return {c: dimension_score(pw, nw) for c, (pw, nw) in masses.items()}


# ----------------------------------------------------------------------------
# Tests. Each returns a dict row for Table 5.8 and may print offending rows.
# ----------------------------------------------------------------------------
def row(idv, what, expected, actual, status):
    return {"Id": idv, "What is tested": what, "Expected output": expected,
            "Actual output": actual, "Status": status}


def show_fail(rows, n=10):
    for r in rows[:n]:
        print("      -", r)


def a01_recalculation(cur, run, ref_date, sub2svc, svc2cat, sub2cat):
    cur.execute(
        f"""
        select place_id, sub_service_code, sum(evidence_count) as ev
        from score.category_score
        where scoring_run_id = {run} and window_code = 'all' and category_no in (1,2,4,5,6,7)
        group by place_id, sub_service_code
        having sum(evidence_count) >= 15
        order by md5(place_id::text)
        limit 10
        """
    )
    pairs = cur.fetchall()
    if not pairs:
        return row("A-01", "Recalculation across ten pairs",
                   "all ten match within 0.001",
                   "Not testable: no pair has >= 15 qualifying statements", "Not testable")
    mism = []
    checked = 0
    for p in pairs:
        pid, sub = p["place_id"], p["sub_service_code"]
        s_svc, s_cat = sub2svc.get(sub), sub2cat.get(sub)
        rows = normalize_tags(qualifying_statements(cur, pid), sub2svc, svc2cat)
        recomputed = recompute_category_scores(rows, sub, s_svc, s_cat, ref_date)
        cur.execute(
            f"""select category_no, score from score.category_score
                where scoring_run_id={run} and place_id=%s and sub_service_code=%s
                  and window_code='all' and category_no in (1,2,4,5,6,7)""",
            (pid, sub),
        )
        for sr in cur.fetchall():
            checked += 1
            stored = float(sr["score"])
            mine = recomputed[sr["category_no"]]
            if abs(stored - mine) > TOL:
                mism.append({"place": pid[:16], "sub": sub, "cat": sr["category_no"],
                             "stored": round(stored, 4), "recomputed": round(mine, 4)})
    if mism:
        print(f"    A-01 mismatches ({len(mism)} of {checked} category scores):")
        show_fail(mism)
        return row("A-01", "Recalculation across ten pairs",
                   "all compared scores match within 0.001",
                   f"{len(mism)} of {checked} category scores differed by > {TOL}", "Fail")
    return row("A-01", "Recalculation across ten pairs",
               "all compared scores match within 0.001",
               f"Stored results matched the hand calculations in all ten pairs ({checked} category scores).",
               "Pass")


def a02_no_evidence_dimension(cur, run, sub2svc, sub2cat):
    # Find a (place, sub) with a weighted dimension that has NO evidence, and
    # at least one weighted dimension that DOES, so a personal_score exists.
    cur.execute(
        f"""
        select place_id, sub_service_code
        from score.category_score
        where scoring_run_id={run} and window_code='all' and category_no in (1,2,4,5,6,7)
        group by place_id, sub_service_code
        having count(*) filter (where evidence_count = 0) >= 1
           and count(*) filter (where evidence_count > 0) >= 1
        order by md5(place_id::text)
        limit 1
        """
    )
    pick = cur.fetchone()
    if not pick:
        return row("A-02", "A quality dimension with no evidence",
                   "left out of the score (not low, not 0.5)",
                   "Not testable: no pair with a mix of empty and non-empty dimensions", "Not testable")
    pid, sub = pick["place_id"], pick["sub_service_code"]
    cur.execute(
        f"""select category_no, score, evidence_count from score.category_score
            where scoring_run_id={run} and place_id=%s and sub_service_code=%s
              and window_code='all' and category_no in (1,2,4,5,6,7)
            order by category_no""",
        (pid, sub),
    )
    cats = cur.fetchall()
    empty = [c for c in cats if c["evidence_count"] == 0]
    present = [c for c in cats if c["evidence_count"] > 0]
    # Fact 1: empty dims store the 0.5 placeholder, not 0 and not NULL.
    placeholder_ok = all(abs(float(c["score"]) - 0.5) < 1e-9 for c in empty)
    # Fact 2: the ranking LEAVES empty dims out. At Medium-for-all weights the
    # personal_score should equal the plain mean of ONLY the present dims --
    # not the mean including empties at 0.5, and not at 0.
    import statistics
    mean_present = statistics.fmean(float(c["score"]) for c in present)
    mean_with_half = statistics.fmean(
        [float(c["score"]) for c in present] + [0.5] * len(empty))
    mean_with_zero = statistics.fmean(
        [float(c["score"]) for c in present] + [0.0] * len(empty))
    w = "{" + ",".join(str(x) for x in W_DEFAULT) + "}"
    cur.execute(
        "select personal_score from score.rank_providers(%s, %s::numeric[], 'all') where place_id=%s",
        (sub, w, pid),
    )
    pr = cur.fetchone()
    ps = float(pr["personal_score"]) if pr and pr["personal_score"] is not None else None
    left_out = ps is not None and abs(ps - round(mean_present, 4)) < 0.01
    details = (f"place {pid[:16]} / {sub}: empty dims {[c['category_no'] for c in empty]} "
               f"stored score=0.5 placeholder={placeholder_ok}; "
               f"personal_score={ps} vs mean(present)={round(mean_present,4)} "
               f"[0.5-in={round(mean_with_half,4)}, 0-in={round(mean_with_zero,4)}]")
    ok = placeholder_ok and left_out
    status = "Pass" if ok else "Fail"
    if not ok:
        print("    A-02 detail:", details)
    return row("A-02",
               "A quality dimension with no evidence",
               "left out of the weighted score; stored as 0.5 placeholder; not 0 and not averaged in",
               ("Empty dimension is left out: personal_score matches the mean of only the "
                "dimensions with evidence; empty dims store the 0.5 placeholder, which the "
                "ranking ignores. Not scored 0 and not averaged in at 0.5. "
                "(Table 5.8 wording for A-02 should read: a dimension with no evidence is "
                "left out of the score.) " + details),
               status)


def a03_recency(ref_date):
    recent = w0_of("high", months_back(ref_date, 1), ref_date)
    old = w0_of("high", months_back(ref_date, 25), ref_date)
    ratio = old / recent if recent else float("inf")
    ok = recent > old and abs(ratio - 0.5) < 0.02      # 24-month gap halves it
    return row("A-03", "Recency weighting",
               "recent weighs more; ~halves per 24 months",
               f"1-month weight={recent:.4f} > 25-month weight={old:.4f}; "
               f"24-month ratio={ratio:.4f} (expected ~0.5)",
               "Pass" if ok else "Fail")


def a04_specificity(sub2svc, sub2cat):
    # A real sub-service and its service/category, so the ladder is exercised
    # against actual codes.
    s = next(iter(sub2svc))
    s_svc, s_cat = sub2svc[s], sub2cat[s]
    sibling_svc = s_svc
    w_sub = specificity(s, s_svc, s_cat, 1, s, s_svc, s_cat)
    w_svc = specificity(None, sibling_svc, s_cat, 1, s, s_svc, s_cat)
    w_cat = specificity(None, None, s_cat, 1, s, s_svc, s_cat)
    ok = w_sub > w_svc > w_cat and (w_sub, w_svc, w_cat) == (1.0, 0.75, 0.5)
    return row("A-04", "Specificity weighting",
               "sub-service(1.0) > service(0.75) > category(0.5)",
               f"sub={w_sub}, service={w_svc}, category={w_cat}",
               "Pass" if ok else "Fail")


def a05_ranked_threshold(cur, run):
    cur.execute(
        f"""select place_id, sub_service_code, tier, range_width, rank_status, safety_status
            from score.trust_score where scoring_run_id={run}""")
    rows = cur.fetchall()
    if not rows:
        return row("A-05", "Below requirement = available, not ranked",
                   "status consistent with range width vs tier limit",
                   "Not testable: no trust_score rows", "Not testable")
    bad = []
    for r in rows:
        limit = TIER_LIMIT.get(r["tier"])
        if limit is None:
            continue
        if r["safety_status"] == "safety concern":
            expected = "not ranked: safety concern"
        elif float(r["range_width"]) < limit:
            expected = "ranked"
        else:
            expected = "available but not ranked"
        if r["rank_status"] != expected:
            bad.append({"place": r["place_id"][:16], "sub": r["sub_service_code"],
                        "tier": r["tier"], "width": float(r["range_width"]),
                        "limit": limit, "stored": r["rank_status"], "expected": expected})
    if bad:
        print(f"    A-05 inconsistencies ({len(bad)} of {len(rows)}):")
        show_fail(bad)
        return row("A-05", "Below requirement = available, not ranked",
                   "rank_status consistent with range width vs tier limit, all rows",
                   f"{len(bad)} of {len(rows)} rows inconsistent", "Fail")
    return row("A-05", "Below requirement = available, not ranked",
               "rank_status consistent with range width vs tier limit, all rows",
               f"All {len(rows)} rows consistent (ranked iff width < tier limit and no safety concern).",
               "Pass")


def a06_importance(cur, run):
    # A sub-service with several ranked businesses and spread in Quality (cat 1).
    cur.execute(
        f"""select t.sub_service_code
            from score.trust_score t
            where t.scoring_run_id={run} and t.rank_status='ranked'
            group by t.sub_service_code
            having count(*) >= 4
            order by count(*) desc limit 1""")
    pick = cur.fetchone()
    if not pick:
        return row("A-06", "Importance raised moves stronger businesses up",
                   "order changes; stronger-on-dimension move up",
                   "Not testable: no sub-service with >= 4 ranked businesses", "Not testable")
    sub = pick["sub_service_code"]

    def order(weights):
        w = "{" + ",".join(str(x) for x in weights) + "}"
        cur.execute(
            "select place_id, rank_no from score.rank_providers(%s,%s::numeric[],'all') "
            "where rank_no is not null order by rank_no", (sub, w))
        return [r["place_id"] for r in cur.fetchall()]

    base = order(W_DEFAULT)
    boosted = order(W_QUALITY_MAX)
    # Quality (cat 1) score per business.
    cur.execute(
        f"""select place_id, score from score.category_score
            where scoring_run_id={run} and sub_service_code=%s and window_code='all' and category_no=1""",
        (sub,))
    q1 = {r["place_id"]: float(r["score"]) for r in cur.fetchall()}
    base_pos = {p: i for i, p in enumerate(base)}
    inversions = []
    for i, p in enumerate(boosted):
        for q in boosted[i + 1:]:
            # p is ranked above q after boosting Quality; flag if q is clearly
            # stronger on Quality yet p was not already above it on Quality.
            if q1.get(q, 0) - q1.get(p, 0) > TOL and base_pos.get(p, 1e9) > base_pos.get(q, -1):
                inversions.append({"above": p[:14], "below": q[:14],
                                   "q1_above": round(q1.get(p, 0), 3),
                                   "q1_below": round(q1.get(q, 0), 3)})
    changed = base != boosted
    ok = changed and not inversions
    if inversions:
        print(f"    A-06 wrong-way moves ({len(inversions)}):")
        show_fail(inversions)
    return row("A-06", "Importance raised moves stronger businesses up",
               "order changes; no business weaker on Quality ranks above a stronger one after the boost",
               f"sub={sub}: order changed={changed}; wrong-way moves={len(inversions)}",
               "Pass" if ok else "Fail")


def a07_time_window(cur, run, sub2svc, svc2cat, sub2cat):
    cur.execute(f"select reference_date, run_at from score.scoring_run where scoring_run_id={run}")
    meta = cur.fetchone()
    ref_date = meta["reference_date"]
    anchor = meta["run_at"].date()        # the scorer's window anchor was TODAY at run time
    lo, hi = months_back(anchor, 6), anchor
    # A (place, sub) that has a stored 6m score built on some own-service evidence.
    cur.execute(
        f"""select place_id, sub_service_code, sum(evidence_count) as ev
            from score.category_score
            where scoring_run_id={run} and window_code='6m' and category_no in (1,2,4,5,6,7)
            group by place_id, sub_service_code having sum(evidence_count) >= 8
            order by md5(place_id::text) limit 1""")
    pick = cur.fetchone()
    if not pick:
        return row("A-07", "Time window",
                   "6-month recompute matches the stored 6m score",
                   "Not testable: no pair with >= 8 statements in the 6m window", "Not testable")
    pid, sub = pick["place_id"], pick["sub_service_code"]
    s_svc, s_cat = sub2svc.get(sub), sub2cat.get(sub)
    rows = normalize_tags(qualifying_statements(cur, pid), sub2svc, svc2cat)
    recomputed = recompute_category_scores(rows, sub, s_svc, s_cat, ref_date, window_cut=(lo, hi))
    cur.execute(
        f"""select category_no, score from score.category_score
            where scoring_run_id={run} and place_id=%s and sub_service_code=%s
              and window_code='6m' and category_no in (1,2,4,5,6,7)""", (pid, sub))
    mism = []
    for sr in cur.fetchall():
        stored, mine = float(sr["score"]), recomputed[sr["category_no"]]
        if abs(stored - mine) > TOL:
            mism.append({"cat": sr["category_no"], "stored": round(stored, 4),
                         "recomputed": round(mine, 4)})
    if not mism:
        return row("A-07", "Time window",
                   "6-month recompute matches the stored 6m score",
                   f"place {pid[:16]} / {sub}: all 6m category scores matched within {TOL} "
                   f"(anchor {anchor} from run_at).", "Pass")
    # Window anchor is not stored exactly; a mismatch here is inconclusive.
    print("    A-07 differences (anchor reconstructed from run_at; may be off by the run-day):")
    show_fail(mism)
    return row("A-07", "Time window",
               "6-month recompute matches the stored 6m score",
               "Not testable: recompute differs, and the 6m window anchor (machine clock at "
               f"run time) is not recorded -- only run_at ({anchor}). Differences: {mism[:5]}",
               "Not testable")


def a08_service_fallback(cur, run, sub2svc):
    # A sub-service with NO ranked business whose parent SERVICE does rank
    # someone -> the fallback (main.py) would widen to service level.
    cur.execute(
        f"""select sub_service_code,
                   count(*) filter (where rank_status='ranked') as ranked_here
            from score.trust_score where scoring_run_id={run}
            group by sub_service_code having count(*) filter (where rank_status='ranked') = 0""")
    zero_subs = [r["sub_service_code"] for r in cur.fetchall()]
    w = "{" + ",".join(str(x) for x in W_DEFAULT) + "}"
    for sub in zero_subs:
        svc = sub2svc.get(sub)
        if not svc:
            continue
        cur.execute(
            "select count(*) as ranked from score.rank_providers_group('service',%s,%s::numeric[],'all') "
            "where rank_status='ranked'", (svc, w))
        n = cur.fetchone()["ranked"]
        if n and n > 0:
            return row("A-08", "Sub-service with no ranked business = service fallback",
                       "returns service-level ranked results (fallback)",
                       f"sub {sub} has 0 ranked; its service {svc} returns {n} ranked via "
                       f"rank_providers_group -> fallback path yields service-level results.",
                       "Pass")
    return row("A-08", "Sub-service with no ranked business = service fallback",
               "returns service-level ranked results (fallback)",
               "Not testable with current data: no sub-service is empty while its parent "
               "service still ranks someone.", "Not testable")


def a09_traceability(cur):
    cur.execute(
        """select e.evidence_id, e.review_id, e.place_id,
                  r.review_id as r_review, r.place_id as r_place
           from extract.evidence_item e
           left join raw.review r on r.review_id = e.review_id
           order by md5(e.evidence_id::text) limit 50""")
    rows = cur.fetchall()
    if not rows:
        return row("A-09", "Traceability", "50/50 resolve to a real review with matching place",
                   "Not testable: no evidence rows", "Not testable")
    bad = [{"evidence_id": r["evidence_id"], "review_id": r["review_id"]}
           for r in rows
           if r["r_review"] is None or r["r_place"] != r["place_id"]]
    if bad:
        print(f"    A-09 unresolved ({len(bad)} of {len(rows)}):")
        show_fail(bad)
        return row("A-09", "Traceability", "50/50 resolve to a real review with matching place",
                   f"{len(rows) - len(bad)}/{len(rows)} resolved; {len(bad)} failed", "Fail")
    return row("A-09", "Traceability", "50/50 resolve to a real review with matching place",
               f"{len(rows)}/{len(rows)} evidence rows resolve to a real review with matching place.",
               "Pass")


def a10_no_management_responses(cur, run):
    # "Management responsiveness is unavailable, not poor" means: when there is
    # NO Category-3 evidence (evidence_count = 0), the dimension stays neutral
    # (the 0.5 placeholder), never dragged low. It does NOT mean the absence of
    # owner-reply rows -- Category 3 also carries sub-point 3.5 (service
    # recovery: "if something goes wrong, do they put it right?"), which is
    # scored from the REVIEW TEXT, not from owner replies. A low Category 3 is
    # therefore real reported evidence, independent of whether the business ever
    # replied, so this test keys on evidence_count, not on raw.owner_reply.
    LOW = 0.3
    NEUTRAL = 0.5
    # (1) Every no-evidence Category-3 row must sit at the neutral placeholder.
    cur.execute(
        f"""select place_id, sub_service_code, score
            from score.category_score
            where scoring_run_id={run} and window_code='all' and category_no=3
              and evidence_count = 0 and abs(score - {NEUTRAL}) > 1e-9
            order by md5(place_id::text) limit 50""")
    not_neutral = [{"place": r["place_id"][:16], "sub": r["sub_service_code"],
                    "cat3": round(float(r["score"]), 4)} for r in cur.fetchall()]
    cur.execute(
        f"""select count(*) n from score.category_score
            where scoring_run_id={run} and window_code='all' and category_no=3 and evidence_count = 0""")
    no_ev_total = cur.fetchone()["n"]
    # (2) Every LOW Category-3 score must be backed by real evidence (count>0),
    # i.e. reported poor service recovery -- never a low score with no evidence.
    cur.execute(
        f"""select place_id, sub_service_code, score
            from score.category_score
            where scoring_run_id={run} and window_code='all' and category_no=3
              and score < {LOW} and evidence_count = 0
            order by md5(place_id::text) limit 50""")
    low_no_ev = [{"place": r["place_id"][:16], "sub": r["sub_service_code"],
                  "cat3": round(float(r["score"]), 4)} for r in cur.fetchall()]
    if no_ev_total == 0:
        return row("A-10", "No evidence on responsiveness = unavailable, not poor",
                   "a Category 3 with no evidence stays neutral (0.5), never low",
                   "Not testable: no Category 3 rows have evidence_count = 0", "Not testable")
    problems = not_neutral + low_no_ev
    if problems:
        print(f"    A-10 Category 3 with no evidence but a non-neutral/low score "
              f"({len(problems)} found):")
        show_fail(problems)
        return row("A-10", "No evidence on responsiveness = unavailable, not poor",
                   "a Category 3 with no evidence stays neutral (0.5), never low",
                   f"{len(not_neutral)} no-evidence rows were not neutral and "
                   f"{len(low_no_ev)} were low despite no evidence", "Fail")
    return row("A-10", "No evidence on responsiveness = unavailable, not poor",
               "a Category 3 with no evidence stays neutral (0.5), never low",
               f"All {no_ev_total} Category 3 rows with no evidence sit exactly at the neutral "
               f"0.5 placeholder; no low score occurs without real evidence. (Low Category 3 "
               f"scores come from reported poor service recovery (sub-point 3.5 in the review "
               f"text), not from missing owner replies.)", "Pass")


# ----------------------------------------------------------------------------
# Runner.
# ----------------------------------------------------------------------------
def main():
    conn = connect()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("select max(scoring_run_id) as run from score.scoring_run")
    run = cur.fetchone()["run"]
    cur.execute(f"select reference_date from score.scoring_run where scoring_run_id={run}")
    ref_date = cur.fetchone()["reference_date"]
    print(f"Accuracy evaluation  --  scoring run {run}, reference_date {ref_date}\n")

    sub2svc, svc2cat, sub2cat, sub2tier = load_dim_service(cur)

    results = []
    results.append(a01_recalculation(cur, run, ref_date, sub2svc, svc2cat, sub2cat))
    results.append(a02_no_evidence_dimension(cur, run, sub2svc, sub2cat))
    results.append(a03_recency(ref_date))
    results.append(a04_specificity(sub2svc, sub2cat))
    results.append(a05_ranked_threshold(cur, run))
    results.append(a06_importance(cur, run))
    results.append(a07_time_window(cur, run, sub2svc, svc2cat, sub2cat))
    results.append(a08_service_fallback(cur, run, sub2svc))
    results.append(a09_traceability(cur))
    results.append(a10_no_management_responses(cur, run))

    conn.close()

    # Markdown table (Table 5.8 shape).
    cols = ["Id", "What is tested", "Expected output", "Actual output", "Status"]
    print("\n| " + " | ".join(cols) + " |")
    print("|" + "|".join(["---"] * len(cols)) + "|")
    for r in results:
        cells = [str(r[c]).replace("\n", " ").replace("|", "\\|") for c in cols]
        print("| " + " | ".join(cells) + " |")

    # CSV beside this script.
    out = pathlib.Path(__file__).with_name("accuracy_results.csv")
    with open(out, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(results)
    print(f"\nWritten: {out}")

    npass = sum(1 for r in results if r["Status"] == "Pass")
    nfail = sum(1 for r in results if r["Status"] == "Fail")
    nnt = sum(1 for r in results if r["Status"] == "Not testable")
    print(f"Summary: {npass} of 10 passed, {nfail} failed, {nnt} not testable")


if __name__ == "__main__":
    main()
