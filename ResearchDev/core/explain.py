"""Turn stored scores + R values into plain-language explanation sentences."""

from core.taxonomy import CATEGORIES


def confidence_label(R: float) -> str:
    if R >= 0.7:  return "strong"
    if R >= 0.4:  return "moderate"
    return "limited"


def confidence_sentence(cat_label: str, R: float, n_reviews: int) -> str:
    level = confidence_label(R)
    if level == "strong":
        return f"Strong on {cat_label} — {n_reviews} reviews agree."
    if level == "moderate":
        return f"Moderate evidence on {cat_label} ({n_reviews} reviews)."
    return f"Looks good on {cat_label}, but only {n_reviews} reviews mention it."


def why_ranked(rank: int, user_weights: dict, category_scores: dict, top_n: int = 2) -> str:
    top_cats = sorted(user_weights, key=user_weights.get, reverse=True)[:top_n]
    labels   = [CATEGORIES[c]["label"] for c in top_cats]
    strong   = all(category_scores.get(c, 0) >= 0.6 for c in top_cats)
    prefix   = "Top result for you" if rank == 1 else f"Ranked #{rank} for you"
    if strong:
        return f"{prefix} because you prioritised {' and '.join(labels)} — this salon scores well on both."
    return f"{prefix} given your priorities ({' and '.join(labels)}), though scores are mixed."


def why_not_higher(
    scores: dict, reliability: dict, user_weights: dict, top_scores: dict
) -> str:
    top_cat   = max(user_weights, key=user_weights.get)
    label     = CATEGORIES[top_cat]["label"]
    this_score = scores.get(top_cat, 0.5)
    best_score = top_scores.get(top_cat, 0.5)
    R          = reliability.get(top_cat, 0.0)

    if R < 0.4:
        return (f"You weighted {label} most, but the evidence here is thin — "
                "the score may not reflect reality yet.")
    if this_score < best_score - 0.1:
        return (f"The top result scores higher on {label}, "
                "which you weighted most.")
    return "Close to the top — strong across your priorities."


def weak_spot(category_scores: dict) -> str | None:
    weakest = min(category_scores, key=category_scores.get)
    if category_scores[weakest] < 0.45:
        return f"Reviews mention weaker performance on {CATEGORIES[weakest]['label']}."
    return None


def build_card(
    rank: int,
    salon_id: str,
    category_scores: dict,
    reliability: dict,
    review_counts: dict,     # {cat: n_reviews}
    user_weights: dict,
    top_scores: dict,
) -> dict:
    return {
        "salon_id":      salon_id,
        "rank":          rank,
        "why_ranked":    why_ranked(rank, user_weights, category_scores),
        "confidence":    {
            cat: confidence_sentence(
                CATEGORIES[cat]["label"],
                reliability.get(cat, 0.0),
                review_counts.get(cat, 0),
            )
            for cat in CATEGORIES
        },
        "weak_spot":     weak_spot(category_scores),
        "why_not_higher": why_not_higher(category_scores, reliability, user_weights, top_scores),
    }
