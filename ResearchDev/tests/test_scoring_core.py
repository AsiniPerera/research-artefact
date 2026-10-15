"""Scoring & ranking maths — pure formula tests against scoring_core, the
reference implementation of backend/salon_db/06_run_scoring.py.

Covers the evaluation plan's "Scoring & Ranking Logic" group:
  S-01 category score formula          S-05 damage negatives counted twice
  S-02 confidence multiplier           S-06 end-to-end worked example
  S-03 recency decay                   S-07 ranked order (API preserves it)
  S-04 specificity weights             S-08 anti-drift: constants match scorer
"""
import ast
import math
import os

import pytest

import scoring_core as sc

_SCORER = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "backend", "salon_db", "06_run_scoring.py",
)


def _scorer_P():
    """The P dict from 06_run_scoring.py, read without running the script."""
    tree = ast.parse(open(_SCORER, encoding="utf-8").read())
    for node in tree.body:
        if isinstance(node, ast.Assign) and any(
            isinstance(t, ast.Name) and t.id == "P" for t in node.targets
        ):
            return ast.literal_eval(node.value)
    raise AssertionError("P dict not found in 06_run_scoring.py")


# ── S-01: category score formula = (1 + posW) / (2 + posW + negW) ────────────
def test_s01_category_score_no_evidence_is_neutral_half():
    assert sc.category_score(0, 0) == 0.5


def test_s01_category_score_all_positive_trends_up():
    # three unit-weight positive statements, no negatives
    assert sc.category_score(3.0, 0.0) == pytest.approx((1 + 3) / (2 + 3 + 0))


def test_s01_category_score_all_negative_trends_down():
    assert sc.category_score(0.0, 3.0) == pytest.approx((1 + 0) / (2 + 0 + 3))


def test_s01_category_score_accepts_iterable_of_contributions():
    assert sc.category_score([1.0, 0.5, 0.5], [0.0, 0.0, 1.0]) == pytest.approx(
        (1 + 2.0) / (2 + 2.0 + 1.0)
    )


# ── S-02: confidence multiplier high=1.0 / medium=0.7 / low=0.3 ──────────────
@pytest.mark.parametrize("level,expected", [("high", 1.0), ("medium", 0.7), ("low", 0.3)])
def test_s02_confidence_multiplier(level, expected):
    assert sc.confidence_weight(level) == expected


# ── S-03: recency decay 0.5 ** (age / 24) ────────────────────────────────────
def test_s03_recency_now_is_full_weight():
    assert sc.recency_weight(0) == 1.0


def test_s03_recency_one_half_life_is_half():
    assert sc.recency_weight(24) == pytest.approx(0.5)


def test_s03_recency_two_half_lives_is_quarter():
    assert sc.recency_weight(48) == pytest.approx(0.25)


def test_s03_recency_future_dates_clamped_to_full_not_above():
    assert sc.recency_weight(-10) == 1.0


# ── S-04: specificity ladder 1.0 / 0.75 / 0.5 / 0.25 / 0 ─────────────────────
@pytest.mark.parametrize("rung,expected", [
    ("same_sub_service", 1.0),
    ("same_service", 0.75),
    ("provider_level", 0.5),
    ("other_service_provider_trait", 0.25),
    ("other_service_outcome", 0.0),
])
def test_s04_specificity_weight(rung, expected):
    assert sc.specificity_weight(rung) == expected


def test_s04_other_service_outcome_contributes_nothing():
    # cat 1-2 evidence from another service: weight 0, so no contribution
    pos, neg = sc.evidence_contribution("high", 0, "other_service_outcome", "positive")
    assert pos == 0.0 and neg == 0.0


# ── S-05: damage negatives count twice ───────────────────────────────────────
def test_s05_damage_negative_is_double_a_normal_negative():
    normal = sc.negative_mass("negative", "normal")
    damage = sc.negative_mass("negative", "damage")
    assert damage == pytest.approx(2 * normal)


def test_s05_positive_statement_has_no_negative_mass_even_if_damage_flagged():
    assert sc.negative_mass("positive", "damage") == 0.0


def test_s05_mixed_statement_is_half_positive_half_negative():
    assert sc.polarity_pos("mixed") == 0.5
    assert sc.negative_mass("mixed", "normal") == pytest.approx(0.5)


# ── S-06: end-to-end worked example (matches the scorer's per-statement math) ─
def test_s06_worked_example_one_statement():
    # medium confidence, 24 months old, same service, positive.
    # w = 0.7 * 0.5 * 0.75 = 0.2625 ; pos mass = 0.2625, neg mass = 0
    pos, neg = sc.evidence_contribution("medium", 24, "same_service", "positive")
    assert pos == pytest.approx(0.7 * 0.5 * 0.75)
    assert neg == 0.0
    assert sc.category_score(pos, neg) == pytest.approx((1 + pos) / (2 + pos))


def test_s06_worked_example_damage_review_pulls_score_below_half():
    # one high-confidence, fresh, same-sub-service damage complaint
    pos, neg = sc.evidence_contribution("high", 0, "same_sub_service", "negative", "damage")
    assert neg == pytest.approx(2.0)          # 1.0 weight * 1.0 neg * 2x damage
    assert sc.category_score(pos, neg) < 0.5


# ── S-08: anti-drift — scoring_core constants still match the scorer's P ──────
def test_s08_constants_match_scorer_P_dict():
    P = _scorer_P()
    assert sc.CONFIDENCE_WEIGHT == P["confidence_weight"]
    assert sc.DAMAGE_MULTIPLIER == P["damage_multiplier"]
    assert sc.RECENCY_HALF_LIFE_MONTHS == P["recency_half_life_months"]
    assert sc.SPECIFICITY_WEIGHT == P["specificity_weight"]
    assert list(sc.PRIOR) == P["prior"]
