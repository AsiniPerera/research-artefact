"""Reference implementation of the per-statement scoring math.

This is the scalar, dependency-free form of the formulas that
``backend/salon_db/06_run_scoring.py`` applies in vectorised (pandas/numpy)
form inside its per-place loop. The scorer cannot be imported directly — it
opens a database connection at module load — so these pure functions exist so
the maths can be unit-tested, documented and reasoned about on its own.

The constants below are copied from the scorer's ``P`` dict. They are NOT
allowed to drift: ``tests/test_scoring_core.py`` parses ``06_run_scoring.py``
and asserts that every constant here still equals the one in ``P``. Change a
number in the scorer and the test fails until it is changed here too.

The maths (one evidence statement about one category):

    w0  = confidence_weight[confidence] * 0.5 ** (max(age_months, 0) / 24)
    w   = w0 * specificity_weight[rung]          # distance from the service asked for
    pos = {positive: 1.0, mixed: 0.5, negative: 0.0}[polarity]
    neg = (1 - pos) * (2.0 if severity == "damage" else 1.0)   # damage counts double
    this statement contributes (w * pos) to the category's positive mass
    and (w * neg) to its negative mass.

A category's score is the mean of a Beta(1, 1) posterior over all the
statements attached to it:

    score = (1 + sum of positive mass) / (2 + sum of positive mass + sum of negative mass)

With no evidence that is 1 / 2 = 0.5 — neutral, not bad.
"""

# ── Constants, mirrored from 06_run_scoring.py's P dict (anti-drift tested) ──
CONFIDENCE_WEIGHT = {"high": 1.0, "medium": 0.7, "low": 0.3}
DAMAGE_MULTIPLIER = 2.0
RECENCY_HALF_LIFE_MONTHS = 24
SPECIFICITY_WEIGHT = {
    "same_sub_service": 1.0,
    "same_service": 0.75,
    "provider_level": 0.5,
    "other_service_provider_trait": 0.25,
    "other_service_outcome": 0.0,
}
PRIOR = (1.0, 1.0)  # Beta(1, 1): no evidence -> 0.5

_POLARITY_POS = {"positive": 1.0, "mixed": 0.5, "negative": 0.0}


def confidence_weight(level: str) -> float:
    """1.0 / 0.7 / 0.3 for high / medium / low confidence."""
    return CONFIDENCE_WEIGHT[level]


def recency_weight(age_months: float, half_life: float = RECENCY_HALF_LIFE_MONTHS) -> float:
    """Exponential decay, halving every ``half_life`` months. A statement
    newer than "now" (negative age) is clamped to full weight, never above."""
    return 0.5 ** (max(age_months, 0.0) / half_life)


def specificity_weight(rung: str) -> float:
    """How far the evidence is from the service being scored: 1.0 for the same
    sub-service down to 0.0 for another service's outcome."""
    return SPECIFICITY_WEIGHT[rung]


def polarity_pos(polarity: str) -> float:
    """Positive fraction of a statement: 1.0 positive, 0.5 mixed, 0.0 negative."""
    return _POLARITY_POS[polarity]


def negative_mass(polarity: str, severity: str = "normal") -> float:
    """The negative fraction of a statement, doubled when it reports damage."""
    base = 1.0 - polarity_pos(polarity)
    return base * (DAMAGE_MULTIPLIER if severity == "damage" else 1.0)


def evidence_weight(confidence: str, age_months: float, rung: str) -> float:
    """w = confidence x recency x specificity for one statement."""
    return confidence_weight(confidence) * recency_weight(age_months) * specificity_weight(rung)


def evidence_contribution(confidence, age_months, rung, polarity, severity="normal"):
    """One statement -> (positive mass, negative mass) it adds to its category."""
    w = evidence_weight(confidence, age_months, rung)
    return w * polarity_pos(polarity), w * negative_mass(polarity, severity)


def category_score(positive_mass, negative_mass, prior=PRIOR) -> float:
    """Beta-posterior mean for a category from its accumulated evidence mass.

    ``positive_mass`` / ``negative_mass`` may each be a single number or an
    iterable of per-statement contributions (which are summed)."""
    a0, b0 = prior
    pw = sum(positive_mass) if hasattr(positive_mass, "__iter__") else positive_mass
    nw = sum(negative_mass) if hasattr(negative_mass, "__iter__") else negative_mass
    return (a0 + pw) / (a0 + b0 + pw + nw)
