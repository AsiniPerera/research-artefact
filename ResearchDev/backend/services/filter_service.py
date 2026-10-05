"""All filter logic: hard filters (service, gender, open-now, distance) and
soft filters (sub-service prioritisation, price tier labelling)."""

import json
from datetime import datetime, time
from ranking.ranker import haversine

# Day index used by Google Places API: 0=Sunday … 6=Saturday
_WEEKDAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
_WEEKDAY_INDEX = {name: i for i, name in enumerate(_WEEKDAY_NAMES)}


# ---------------------------------------------------------------------------
# Open-now / open-at
# ---------------------------------------------------------------------------

def _parse_hhmm(t: str) -> int:
    """Convert 'HHMM' or 'HH:MM' to minutes-since-midnight."""
    t = t.replace(":", "").strip()
    return int(t[:2]) * 60 + int(t[2:])


def is_open(hours: dict | None, check_dt: datetime | None = None) -> bool:
    """
    Return True if the salon is open at check_dt (defaults to now).

    Expected hours format (Google Places API):
    {
      "periods": [
        {"open": {"day": 1, "time": "0900"}, "close": {"day": 1, "time": "2000"}},
        ...
      ]
    }
    Fallback format (simple dict keyed by day name):
    {"monday": ["09:00", "20:00"], "tuesday": [...], ...}
    """
    if not hours:
        return True  # no hours data → don't exclude

    dt = check_dt or datetime.now()
    # isoweekday(): Monday=1…Sunday=7; Google: Sunday=0…Saturday=6
    google_day = dt.isoweekday() % 7
    current_minutes = dt.hour * 60 + dt.minute

    # Google Places format
    periods = hours.get("periods")
    if periods:
        for period in periods:
            o = period.get("open", {})
            c = period.get("close", {})
            if o.get("day") != google_day:
                continue
            open_min  = _parse_hhmm(str(o.get("time", "0000")))
            close_min = _parse_hhmm(str(c.get("time", "2359")))
            if close_min < open_min:            # crosses midnight
                if current_minutes >= open_min or current_minutes < close_min:
                    return True
            else:
                if open_min <= current_minutes < close_min:
                    return True
        return False

    # Simple dict fallback: {"monday": ["09:00", "21:00"]}
    day_name = _WEEKDAY_NAMES[google_day]
    slot = hours.get(day_name)
    if not slot or len(slot) < 2:
        return True
    open_min  = _parse_hhmm(slot[0])
    close_min = _parse_hhmm(slot[1])
    return open_min <= current_minutes < close_min


def parse_open_at(open_at: str) -> datetime | None:
    """
    Parse 'monday 14:30' into a datetime set to the next matching weekday.
    Returns None if unparseable (→ filter is skipped).
    """
    try:
        parts = open_at.strip().lower().split()
        if len(parts) != 2:
            return None
        day_name, time_str = parts
        day_idx = _WEEKDAY_INDEX.get(day_name)
        if day_idx is None:
            return None
        h, m = map(int, time_str.split(":"))
        now = datetime.now()
        google_today = now.isoweekday() % 7
        days_ahead = (day_idx - google_today) % 7
        target = now.replace(
            hour=h, minute=m, second=0, microsecond=0
        )
        from datetime import timedelta
        target += timedelta(days=days_ahead)
        return target
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Hard filter pipeline
# ---------------------------------------------------------------------------

def apply_hard_filters(
    salons: list[dict],
    gender: str,
    open_now: bool,
    open_at: str | None,
    max_distance_km: float,
    user_lat: float,
    user_lng: float,
) -> list[dict]:
    """
    Filter by gender, open-status, and distance.
    Service family is already pre-filtered by the SQL query.
    Returns salons with 'distance_km' attached.
    """
    check_dt: datetime | None = None
    check_open = open_now

    if open_at:
        check_dt = parse_open_at(open_at)
        if check_dt:
            check_open = True

    out = []
    for s in salons:
        # Gender
        sg = s.get("gender_served", "unisex")
        if gender != "unisex" and sg != "unisex" and sg != gender:
            continue

        # Open-now / open-at
        if check_open:
            hours_raw = s.get("hours")
            hours = json.loads(hours_raw) if isinstance(hours_raw, str) else hours_raw
            if not is_open(hours, check_dt):
                continue

        # Distance
        dist = haversine(user_lat, user_lng, float(s["lat"]), float(s["lng"]))
        if dist > max_distance_km:
            continue

        s["distance_km"] = dist
        out.append(s)

    return out


def widen_radius(
    salons_all: list[dict],
    current_radius: float,
    gender: str,
    open_now: bool,
    open_at: str | None,
    user_lat: float,
    user_lng: float,
    min_results: int,
    max_radius: float = 20.0,
) -> tuple[list[dict], float]:
    """
    If fewer than min_results reviewed salons pass the hard filters,
    progressively widen the radius (×1.5 steps) until min_results are found
    or max_radius is reached.
    Returns (filtered_salons, effective_radius).
    """
    radius = current_radius
    result = apply_hard_filters(salons_all, gender, open_now, open_at, radius, user_lat, user_lng)
    reviewed = [s for s in result if (s.get("review_count") or 0) > 0]

    while len(reviewed) < min_results and radius < max_radius:
        radius = min(radius * 1.5, max_radius)
        result = apply_hard_filters(salons_all, gender, open_now, open_at, radius, user_lat, user_lng)
        reviewed = [s for s in result if (s.get("review_count") or 0) > 0]

    return result, radius


# ---------------------------------------------------------------------------
# Soft filter helpers (never exclude — only prioritise + label)
# ---------------------------------------------------------------------------

PRICE_SENTIMENT_PARAMS = {
    "value_for_money",
    "perceived_affordability",
    "pricing_transparency",
}

# Sentiment thresholds mapped to tiers
_BUDGET_THRESHOLD  =  0.25   # customers say it's affordable
_PREMIUM_THRESHOLD = -0.25   # customers say it's expensive
_MIN_PRICE_OPINIONS = 5      # below this: "price not indicated"


def classify_price_tier(avg_price_sentiment: float, opinion_count: int) -> str | None:
    """
    Classify a salon's price tier from aggregated review sentiment on price params.
    Returns 'budget', 'standard', 'premium', or None ('price not indicated').
    """
    if opinion_count < _MIN_PRICE_OPINIONS:
        return None
    if avg_price_sentiment >= _BUDGET_THRESHOLD:
        return "budget"
    if avg_price_sentiment <= _PREMIUM_THRESHOLD:
        return "premium"
    return "standard"


def apply_soft_priority(
    salons: list[dict],
    sub_services: list[str] | None,
    price_tier: str | None,
) -> list[dict]:
    """
    Attach soft-filter metadata to each salon dict.
    Does NOT exclude any salon — only sets:
      - matched_sub_service: bool — the reviews mention ANY of the requested
        services. One leaf arrives as a single-item list; a whole taxonomy
        group arrives as every leaf it contains.
      - price_tier_match: bool
    The ranking service uses these to sort sub-service matches to the top
    within each tier of ranked results.
    """
    for s in salons:
        tags = json.loads(s.get("service_tags") or "[]")

        s["matched_sub_service"] = bool(
            sub_services and any(t in tags for t in sub_services)
        )
        s["price_tier_match"] = (
            price_tier is not None and s.get("price_tier") == price_tier
        )
        s["service_tags"] = tags

    return salons
