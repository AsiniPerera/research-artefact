"""THE ranking formula — one function, imported everywhere, never duplicated.

F(s) = Σ_c  W_c · [ R_c^t · C_c + (1 − R_c^t) · μ_c ]

W_c  = normalised user weight for category c  (raw weights / total)
R_c  = reliability of evidence for category c  ∈ [0, 1]
C_c  = salon's category score                  ∈ [0, 1]
μ_c  = prior (mean score across all salons)    ∈ [0, 1]
t    = explore/proven exponent (fixed at 1.0 — no UI toggle)
"""

from __future__ import annotations
from dataclasses import dataclass, field
from math import radians, cos, sin, asin, sqrt


@dataclass
class SalonCandidate:
    salon_id: str
    name: str
    category_scores: dict[str, float]
    reliability: dict[str, float]
    distance_km: float
    review_count: int
    price_tier: str | None = None
    service_tags: list[str] = field(default_factory=list)


def rank(
    candidates: list[SalonCandidate],
    user_weights: dict[str, int | float],
    global_means: dict[str, float],
    t: float = 1.0,
) -> list[tuple[SalonCandidate, float]]:
    """
    Score every candidate with F(s) and return sorted list (highest first).
    user_weights: raw values (any positive scale) — normalised here.
    """
    total_w = sum(user_weights.values())
    if total_w == 0:
        raise ValueError("At least one category weight must be > 0")

    scored = []
    for salon in candidates:
        f = 0.0
        for cat, w in user_weights.items():
            C  = salon.category_scores.get(cat, 0.5)
            R  = salon.reliability.get(cat, 0.0)
            mu = global_means.get(cat, 0.5)
            R_t = R ** t
            f  += (w / total_w) * (R_t * C + (1 - R_t) * mu)
        scored.append((salon, round(f, 6)))

    return sorted(scored, key=lambda x: x[1], reverse=True)


# ---------------------------------------------------------------------------
# Distance (Haversine) — live computation at request time
# ---------------------------------------------------------------------------

def haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    return 2 * R * asin(sqrt(a))
