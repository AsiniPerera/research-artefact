"""Overall salon score for the profile: the whole salon, every category, and
the Overall Verdict (category 8) together.

Display only. It is computed here, read-only, from the same extraction rows the
scorer reads; it is not stored and does not touch the ranking. In the ranking
category 8 is reported-only (weight 0) and the score is per service; this is a
separate, whole-salon figure for the profile, and framework v5 records the
difference.

What it is
    A weighted average of whole-salon category scores:

        categories 1, 2, 4, 5, 6, 7    weighted by the visitor's priorities
        category   8 (Overall Verdict) a fixed Medium weight (VERDICT_WEIGHT)
        category   3                   not included: it is read from owner
                                       replies, is reported-only, and most
                                       salons have none on record

    Each category score is a Beta(1, 1) posterior over ALL of the salon's
    statements in that category, across every service. A category with no
    statements stays at 0.5 and remains in the average (the framework's 10 Oct
    decision), so one silent category cannot be dropped to flatter a salon.

The per-statement maths is scoring_core's (the tested reference of
06_run_scoring.py), not a second copy:

    w   = confidence_weight x 0.5 ** (age_months / 24)      specificity = 1.0
    pos = positive 1.0 | mixed 0.5 | negative 0.0
    neg = (1 - pos) x 2 when severity is "damage"

Specificity is 1.0 for every statement because the question is "this salon",
not "this service": every statement counts in full, whichever service it names
or whether it names none.
"""
import os

import scoring_core as sc

WEIGHTED = (1, 2, 4, 5, 6, 7)      # follow the visitor's priorities
VERDICT = 8                        # Overall Verdict
CATEGORIES = WEIGHTED + (VERDICT,)
VERDICT_WEIGHT = 2.0               # Medium; the ranking gives it none
DEFAULT_WEIGHT = 2.0               # what an unset priority means: Medium

# The names the app shows (frontend/src/constants/categories.js); category 4 is
# "Trust & Recommendation", not the framework table's longer form.
NAMES = {
    1: "Quality of the Result",
    2: "Consultation & Aftercare",
    4: "Trust & Recommendation",
    5: "Staff & Customer Service",
    6: "Value & Price Honesty",
    7: "Safety, Hygiene & Facilities",
    8: "Overall Verdict",
}
DAYS_PER_MONTH = 30.44             # the scorer's age_m divisor
WINDOW_MONTHS = {"6m": 6, "1y": 12, "3y": 36, "all": None}


def months_back(today, months):
    """`today` minus whole calendar months, day clamped to the month's end."""
    y, m = divmod(today.year * 12 + (today.month - 1) - months, 12)
    m += 1
    for d in (today.day, 30, 29, 28):
        try:
            return today.replace(year=y, month=m, day=d)
        except ValueError:
            continue
    return today.replace(year=y, month=m, day=28)


def category_weight(category_no, weights):
    """The weight a category carries in the overall score.

    `weights` is the seven-number vector the ranking takes (category 1..7), or
    None for "no preference". Category 8 is fixed; anything unset is Medium."""
    if category_no == VERDICT:
        return VERDICT_WEIGHT
    if not weights:
        return DEFAULT_WEIGHT
    return float(weights[category_no - 1])


def overall_figure(rows, ref_date, weights=None, window="all", today=None):
    """
    rows      iterable of dicts: category_no, confidence, polarity, severity,
              published (a date). Already limited to the salon's usable
              statements (not reviewer-fault, not flagged for manual check).
    ref_date  the newest review date in the data: recency is measured from it,
              as the scorer does.
    weights   the visitor's seven priorities, or None for Medium throughout.
    window    "6m" | "1y" | "3y" | "all". A bounded window keeps only reviews
              published within it, counted back from `today`, and drops a
              statement with no date (membership cannot be decided).

    Returns {
      score:      0..1, or None when the salon has no statements at all
      statements: usable statements across the categories
      categories: [{category_no, name, score, statements, weight}]
    }
    """
    months = WINDOW_MONTHS[window]
    cutoff = months_back(today, months) if (months is not None and today) else None

    mass = {c: [0.0, 0.0, 0] for c in CATEGORIES}     # positive, negative, count
    for r in rows:
        cat = r["category_no"]
        if cat not in mass or r["polarity"] not in ("positive", "negative", "mixed"):
            continue
        d = r.get("published")
        if cutoff is not None:
            if d is None or d < cutoff or (today and d > today):
                continue
        age_m = ((ref_date - d).days / DAYS_PER_MONTH) if d is not None else 0.0
        pos, neg = sc.evidence_contribution(
            r["confidence"], age_m, "same_sub_service", r["polarity"], r.get("severity") or "normal")
        mass[cat][0] += pos
        mass[cat][1] += neg
        mass[cat][2] += 1

    categories, num, den = [], 0.0, 0.0
    for c in CATEGORIES:
        pos, neg, n = mass[c]
        score = sc.category_score(pos, neg)           # 0.5 with no evidence
        w = category_weight(c, weights)
        categories.append({"category_no": c, "name": NAMES[c],
                           "score": round(score, 4), "statements": n, "weight": w})
        num += w * score
        den += w

    total = sum(v[2] for v in mass.values())
    return {
        "score": round(num / den, 4) if (total and den) else None,
        "statements": total,
        "categories": categories,
    }
