"""Scoring helpers — shrinkage, recency weighting, R computation.
Imported by pipeline/s4_score.py and evaluation scripts.
"""

import math
import numpy as np


# ---------------------------------------------------------------------------
# Reliability R
# R = (n / (n + k)) · (1 − σ)
# n = number of opinions, k = prior-strength constant, σ = std-dev of sentiments
# ---------------------------------------------------------------------------

K_PRIOR = 10   # prior strength — tune if needed, document the value used

def compute_R(sentiments: list[float], k: int = K_PRIOR) -> float:
    """
    R combines evidence volume and agreement.
    - Volume: n / (n + k)  saturates toward 1 as n grows.
    - Agreement: 1 − σ     is 1 when all opinions agree, lower when they diverge.
    sentiments: list of raw sentiment values in [−1, +1].
    Returns R in [0, 1].
    """
    n = len(sentiments)
    if n == 0:
        return 0.0
    volume    = n / (n + k)
    sigma     = float(np.std(sentiments)) if n > 1 else 0.0
    agreement = max(0.0, 1.0 - sigma)   # σ can exceed 1 for wide spreads; floor at 0
    return round(volume * agreement, 4)


# ---------------------------------------------------------------------------
# Recency weighting
# ---------------------------------------------------------------------------

HALFLIFE_DAYS = 365

def recency_weight(days_ago: float) -> float:
    return math.exp(-math.log(2) * max(days_ago, 0) / HALFLIFE_DAYS)


# ---------------------------------------------------------------------------
# Bayesian shrinkage
# Pulls a score toward the global mean when n is small.
# ---------------------------------------------------------------------------

SHRINK_K = 10   # prior strength for shrinkage (separate from R's k)

def shrink(score: float, n: int, global_mean: float, k: int = SHRINK_K) -> float:
    """(n·score + k·μ) / (n + k)"""
    return (n * score + k * global_mean) / (n + k)


# ---------------------------------------------------------------------------
# Aggregate raw opinions → one parameter score
# ---------------------------------------------------------------------------

def aggregate_opinions(
    opinions: list[tuple[float, float, float]],   # (sentiment, confidence, days_ago)
    global_mean: float,
) -> float:
    """
    Combines opinions into a single 0–1 score with recency weighting and shrinkage.
    Returns global_mean if no opinions.
    """
    if not opinions:
        return global_mean

    weights = [conf * recency_weight(days) for _, conf, days in opinions]
    total_w = sum(weights)
    if total_w == 0:
        return global_mean

    weighted_sentiment = sum(
        sent * w for (sent, _, _), w in zip(opinions, weights)
    ) / total_w

    raw_score = (weighted_sentiment + 1) / 2   # map [−1,+1] → [0,1]
    n = len(opinions)
    return round(shrink(raw_score, n, global_mean), 4)
