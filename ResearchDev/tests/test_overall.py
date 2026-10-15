"""Overall salon score for the profile (backend/api/overall.py): every category
plus the Overall Verdict (8), over all of a salon's feedbacks, weighted by the
visitor's priorities.

The per-statement maths is scoring_core's and is tested in test_scoring_core.
These tests pin what is specific here: whole-salon scoring (no specificity
discount), the weighted average, category 8 at a fixed Medium weight, category
3 excluded, an empty category staying at 0.5 inside the average, a window
filtering by date, and an empty salon having no score rather than a neutral one.
"""
import datetime as dt

import pytest

import overall as ov

REF = dt.date(2026, 9, 17)      # newest review in the data
TODAY = dt.date(2026, 10, 14)
MEDIUM = [2, 2, 2, 2, 2, 2, 2]


def stmt(cat=1, polarity="positive", confidence="high", severity="normal", published=REF):
    return {"category_no": cat, "polarity": polarity, "confidence": confidence,
            "severity": severity, "published": published}


def by_cat(out):
    return {c["category_no"]: c for c in out["categories"]}


def test_ov01_no_statements_means_no_score_not_a_neutral_one():
    out = ov.overall_figure([], REF)
    assert out["score"] is None and out["statements"] == 0


def test_ov02_covers_the_six_weighted_categories_and_the_verdict_not_three():
    nos = [c["category_no"] for c in ov.overall_figure([stmt(1)], REF)["categories"]]
    assert nos == [1, 2, 4, 5, 6, 7, 8]


def test_ov03_each_category_is_a_whole_salon_beta_posterior():
    out = ov.overall_figure([stmt(1)] * 10, REF)
    assert by_cat(out)[1]["score"] == pytest.approx((1 + 10) / (2 + 10), abs=1e-4)
    assert by_cat(out)[1]["statements"] == 10


def test_ov04_an_empty_category_stays_at_half_and_stays_in_the_average():
    # only category 1 has evidence; the other six sit at 0.5 and are averaged in
    out = ov.overall_figure([stmt(1)] * 10, REF, weights=MEDIUM)
    s1 = (1 + 10) / (2 + 10)
    expected = (s1 + 0.5 * 6) / 7           # six at Medium + the verdict at Medium
    assert out["score"] == pytest.approx(expected, abs=1e-4)
    assert by_cat(out)[5]["score"] == 0.5 and by_cat(out)[5]["statements"] == 0


def test_ov05_the_visitors_priorities_move_the_score():
    rows = [stmt(1)] * 20 + [stmt(6, "negative")] * 20      # good quality, poor value
    quality_first = ov.overall_figure(rows, REF, weights=[8, 1, 0, 1, 1, 1, 1])["score"]
    value_first = ov.overall_figure(rows, REF, weights=[1, 1, 0, 1, 1, 8, 1])["score"]
    assert quality_first > value_first


def test_ov06_no_weights_means_medium_for_every_category():
    rows = [stmt(1)] * 5 + [stmt(7, "negative")] * 5
    assert ov.overall_figure(rows, REF)["score"] == ov.overall_figure(rows, REF, weights=MEDIUM)["score"]


def test_ov07_scaling_all_six_priorities_barely_moves_it():
    rows = [stmt(1)] * 7 + [stmt(5, "negative")] * 3
    a = ov.overall_figure(rows, REF, weights=[2, 2, 0, 2, 2, 2, 2])["score"]
    b = ov.overall_figure(rows, REF, weights=[1, 1, 0, 1, 1, 1, 1])["score"]
    # Not exactly equal: category 8 is fixed at Medium, so halving the six
    # priorities does raise the verdict's share a little.
    assert abs(a - b) < 0.05


def test_ov08_the_verdict_is_fixed_at_medium_whatever_the_priorities():
    cats = by_cat(ov.overall_figure([stmt(8)], REF, weights=[8, 8, 0, 8, 8, 8, 8]))
    assert cats[8]["weight"] == ov.VERDICT_WEIGHT == 2.0


def test_ov09_the_verdict_counts_toward_the_score():
    without = ov.overall_figure([stmt(1)] * 10, REF, weights=MEDIUM)["score"]
    with_neg_verdict = ov.overall_figure([stmt(1)] * 10 + [stmt(8, "negative")] * 10, REF, weights=MEDIUM)["score"]
    assert with_neg_verdict < without


def test_ov10_management_responsiveness_is_not_part_of_it():
    out = ov.overall_figure([stmt(3, "negative")] * 20, REF)
    assert out["statements"] == 0 and out["score"] is None


def test_ov11_damage_counts_double():
    plain = by_cat(ov.overall_figure([stmt(8, "negative")], REF))[8]["score"]
    damage = by_cat(ov.overall_figure([stmt(8, "negative", severity="damage")], REF))[8]["score"]
    assert damage < plain
    assert damage == pytest.approx(1 / (2 + 2.0), abs=1e-4)


def test_ov12_old_statements_count_less():
    fresh = by_cat(ov.overall_figure([stmt(4, "negative", published=REF)], REF))[4]["score"]
    old = by_cat(ov.overall_figure([stmt(4, "negative", published=dt.date(2024, 9, 17))], REF))[4]["score"]
    assert old > fresh


def test_ov13_mentions_are_ignored():
    assert ov.overall_figure([stmt(1, "mention")], REF)["statements"] == 0


def test_ov14_a_bounded_window_drops_older_reviews_and_undated_ones():
    rows = [
        stmt(1, published=dt.date(2026, 8, 1)),     # inside 6 months
        stmt(1, published=dt.date(2025, 1, 1)),     # outside
        stmt(1, published=None),                    # undated: cannot be placed
    ]
    assert ov.overall_figure(rows, REF, window="6m", today=TODAY)["statements"] == 1
    assert ov.overall_figure(rows, REF, window="all", today=TODAY)["statements"] == 3


def test_ov15_months_back_clamps_the_day():
    assert ov.months_back(dt.date(2026, 3, 31), 1) == dt.date(2026, 2, 28)
    assert ov.months_back(dt.date(2026, 10, 14), 12) == dt.date(2025, 10, 14)
    assert ov.months_back(dt.date(2026, 1, 15), 3) == dt.date(2025, 10, 15)
