"""Beauty service ranking API (FastAPI + psycopg2, read-only).

The last step in the pipeline. backend/salon_db builds the database and
06_run_scoring.py writes the score tables; this serves them to the frontend
and computes nothing of its own.

Ranking order comes from score.rank_providers and score.rank_providers_group
and is passed through untouched — the SQL applies the reader's weights and
decides the order, so a score shown beside a salon is the score the database
produced. Nothing here re-scores or re-sorts.

Every session is read-only and every query is parameterised. The two routers
that write, auth and contact, open their own connections for that reason.

Run from backend/api:
    uvicorn main:app --reload        # http://127.0.0.1:8000, docs at /docs
"""

import os
import queue
import re
import math
import threading
import time
from contextlib import asynccontextmanager, contextmanager

import psycopg2
from psycopg2.extensions import TRANSACTION_STATUS_UNKNOWN
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))


def _reason(exc: Exception) -> str:
    """The first line of a driver error, with any connection URL scrubbed:
    the URL carries the database password."""
    text = re.sub(r"postgres(?:ql)?://\S+", "<connection url>", str(exc)).strip()
    return (text.splitlines() or ["unknown error"])[0][:200]


class _Pool:
    """Up to `size` connections, kept open and reused, and self-healing.

    Opening a connection to Supabase is the slow, failure-prone step, so a
    connection is only closed when it is broken. A request that finds every
    connection busy waits for one instead of failing (psycopg2's own pool
    raises "pool exhausted" and closes every returned connection beyond
    minconn).

    A pooled connection can look open while its socket is dead — after the
    network drops, the machine sleeps, or Supabase closes an idle session —
    and psycopg2 only finds out when it next tries to use it. So a connection
    that has been idle longer than `probe_after` is made to answer `select 1`
    before it is handed out; one that cannot is dropped and another is taken
    or opened. That is what lets the API recover on its own instead of
    returning "Database connection failed" until it is restarted.
    """

    def __init__(self, url: str, size: int = 10, wait: float = 30, probe_after: float = 10):
        self.url, self.wait, self.probe_after = url, wait, probe_after
        self.slots = threading.BoundedSemaphore(size)
        self.idle: queue.LifoQueue = queue.LifoQueue()

    attempts = 4      # see _connect
    backoff = 0.5     # seconds before the second attempt, doubled after each failure

    def _connect(self):
        """Open a connection, riding out the transient failures.

        The pooler intermittently drops a connection during the TLS handshake
        ("SSL error: unexpected eof while reading"), and now and then a
        connect times out. Both arrive in short bursts and clear on their own,
        so spaced retries turn a failed request into a slightly slow one. The
        backoff is the point: retrying instantly inside a burst just spends
        the attempts without waiting for it to pass."""
        delay = self.backoff
        for attempt in range(1, self.attempts + 1):
            try:
                return psycopg2.connect(
                    self.url, connect_timeout=10,
                    keepalives=1, keepalives_idle=30, keepalives_interval=10, keepalives_count=3,
                )
            except psycopg2.OperationalError:
                if attempt == self.attempts:
                    raise
                time.sleep(delay)
                delay *= 2

    @staticmethod
    def _drop(conn) -> None:
        try:
            conn.close()
        except Exception:      # already dead; nothing to salvage
            pass

    @staticmethod
    def _prepare(conn, probe: bool):
        """Set the read-only session, and prove the connection still answers.

        The rollback clears an aborted transaction as well as proving the
        socket: a connection left mid-error would otherwise reject every
        later query with "current transaction is aborted"."""
        conn.set_session(readonly=True, autocommit=True)
        if probe:
            conn.rollback()
            with conn.cursor() as cur:
                cur.execute("select 1")
                cur.fetchone()
        return conn

    def get(self, max_tries: int = 4):
        """A connection that is known to be alive, with its session set.

        One network event usually kills several pooled connections at once, so
        the next one taken may be dead too — hence the loop. It is capped so a
        database that is genuinely down fails fast instead of spinning."""
        if not self.slots.acquire(timeout=self.wait):
            raise HTTPException(503, "Database busy — too many requests at once")
        try:
            for _ in range(max_tries):
                try:
                    conn, idle_since = self.idle.get_nowait()
                except queue.Empty:
                    # Freshly opened, so the socket is known good and the
                    # probe would only cost a round trip.
                    return self._prepare(self._connect(), probe=False)
                if conn.closed or conn.info.transaction_status == TRANSACTION_STATUS_UNKNOWN:
                    self._drop(conn)
                    continue
                try:
                    return self._prepare(conn, probe=time.monotonic() - idle_since > self.probe_after)
                except psycopg2.Error:
                    self._drop(conn)      # stale socket: discard it and try the next one
            return self._prepare(self._connect(), probe=False)
        except psycopg2.Error as exc:
            self.slots.release()
            raise HTTPException(503, f"Database connection failed: {_reason(exc)}")

    def put(self, conn, broken: bool = False):
        """Return a connection to the pool, or drop it if it is broken.

        The slot is released either way, so a dropped connection frees capacity
        for a new one rather than shrinking the pool for the life of the
        process. The idle time is stamped here, which is what `get` later reads
        to decide whether the socket needs proving.
        """
        if broken or conn.closed:
            self._drop(conn)
        else:
            self.idle.put((conn, time.monotonic()))
        self.slots.release()

    def close(self):
        while not self.idle.empty():
            self._drop(self.idle.get_nowait()[0])


_pool: _Pool | None = None


def _get_pool() -> _Pool:
    """The process-wide pool, built on first use.

    Built lazily so the app can start without a database and answer /health
    with a reason, rather than failing at import and leaving nothing to ask.
    """
    global _pool
    if _pool is None:
        url = os.environ.get("DATABASE_URL")
        if not url:
            raise HTTPException(503, "DATABASE_URL is not set in backend/api/.env")
        _pool = _Pool(url)
    return _pool


@contextmanager
def cursor():
    """A read-only dict cursor. A broken connection is dropped from the pool."""
    pool = _get_pool()
    conn = pool.get()
    broken = False
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            yield cur
    except (psycopg2.OperationalError, psycopg2.InterfaceError) as exc:
        broken = True
        raise HTTPException(503, f"Database connection failed: {_reason(exc)}")
    finally:
        pool.put(conn, broken)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Close the pooled connections on shutdown so Supabase does not hold
    sessions open for a process that has gone."""
    yield
    if _pool is not None:
        _pool.close()


app = FastAPI(title="Beauty Service Ranking API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["GET", "POST", "PUT"],
    allow_headers=["*"],
)

from auth import router as auth_router
from contact import router as contact_router
_VALID_WINDOWS = {"6m", "1y", "3y", "anytime", "all"}
from staff import (staff_for, staff_dependent_flag, staff_dependent_for,
                   reviews_for_staff, named_staff_summary_for, staff_card_for)
from popular_services import popular_services_for
from languages import languages_for
app.include_router(auth_router)
app.include_router(contact_router)

_LATEST_RUN = "(select max(scoring_run_id) from score.scoring_run)"


def _sub_service_or_404(cur, code: str) -> dict:
    """The ref.dim_service row for `code`, or 404.

    Every ranking route starts here, so an unknown code fails once with a clear
    message instead of returning an empty ranking that reads as "no salons
    offer this".
    """
    cur.execute(
        "select sub_service_code as code, sub_service as name, tier, service_code, service,"
        " category_code, category from ref.dim_service where sub_service_code = %s",
        (code,),
    )
    row = cur.fetchone()
    if not row:
        raise HTTPException(404, f"Unknown sub-service code: {code}")
    return row


# The framework holds nine categories; the client sends SEVEN numbers, one per
# category from 1 to 7, in category_no order. Postgres arrays are 1-indexed, so
# position i of that list is category i and rank_providers reads
# p_weights[category_no] straight off it.
#
# Three categories are not the client's to set. Category 3 is reported only and
# forced to 0 below. Category 8, Overall Verdict, carries weight 0 in
# ref.framework_category and never enters a ranking. Category 9 is computed
# from review counts rather than chosen, so the ranking functions hold it at 2
# (Medium) whatever arrives here.
#
# Which categories actually count is read from ref.framework_category at query
# time, not fixed here, so the length of this contract is the only thing the
# API has to know.
WEIGHTED_CATEGORIES = 7


def _parse_weights(weights: str | None) -> list[float] | None:
    """'1,1,…' → seven non-negative numbers in category_no order, or None.

    None means "no preference", which the ranking functions read as Medium for
    every category. Returning None rather than a list of equal numbers keeps
    the default in one place: the SQL.

    Category 3 is forced to 0 whatever the client sends, because it is reported
    only. That also means a request weighting nothing but Category 3 ends up
    all-zero and is rejected below, which is the honest answer: there is no
    ranking that request could produce.

    422 on a wrong count, a non-number, a negative, or all zeroes. A count that
    is merely wrong is worth an error rather than padding — a client sending six
    numbers has a different idea of the contract, and silently filling the
    seventh would rank on a weight nobody chose.
    """
    if not weights:
        return None
    try:
        values = [float(w) for w in weights.split(",")]
    except ValueError:
        raise HTTPException(422, f"weights must be {WEIGHTED_CATEGORIES} comma-separated numbers")
    if len(values) != WEIGHTED_CATEGORIES:
        raise HTTPException(
            422,
            f"weights must have exactly {WEIGHTED_CATEGORIES} values, one per weighted "
            "category (1 to 7). Category 8 and 9 are handled automatically.",
        )
    if any(v < 0 for v in values):
        raise HTTPException(422, "weights cannot be negative")
    # Category 3 is reported only — force to 0 so it never affects ranking
    values[2] = 0
    if all(v == 0 for v in values):
        raise HTTPException(422, "at least one weight must be above zero")
    return values


def _window(value: str) -> str:
    """A consistency window name → the code score.category9_window stores.

    "anytime" is the name the app shows and "all" is the name the database
    uses. Both are accepted: a caller reading the stored value back, or a test
    written against the database, should not have to translate it first.
    """
    if value not in _VALID_WINDOWS:
        raise HTTPException(
            422, "consistency_window must be 6m, 1y, 3y, anytime or all")
    return "all" if value == "anytime" else value


@app.get("/health")
def health():
    """Whether the API is up and whether it can reach the database.

    Always 200 when the process is running, with `database` carrying the real
    answer and `detail` the reason it cannot connect. A 503 here would be
    indistinguishable from the API itself being down, which is the one thing
    this endpoint exists to tell apart. `scoring_run_id` names the run every
    other response is read from.
    """
    try:
        with cursor() as cur:
            cur.execute(f"select {_LATEST_RUN} as scoring_run_id")
            run = cur.fetchone()["scoring_run_id"]
    except HTTPException as e:
        # 200 with a reason: the API itself is up, and the browser can read why.
        return {"status": "ok", "database": "unavailable", "detail": e.detail}
    return {"status": "ok", "database": "ok", "scoring_run_id": run}


@app.get("/services")
def services():
    """Taxonomy tree with ranked / evidenced provider counts per sub-service."""
    with cursor() as cur:
        cur.execute(
            f"""
            select d.category_code, d.category, d.service_code, d.service,
                   d.sub_service_code, d.sub_service, d.tier,
                   count(t.place_id) filter (where t.rank_status = 'ranked') as ranked_providers,
                   count(t.place_id) as providers_with_evidence
            from ref.dim_service d
            join ref.service_category c on c.code = d.category_code
            join ref.service s on s.code = d.service_code
            join ref.sub_service ss on ss.code = d.sub_service_code
            left join score.trust_score t
                   on t.sub_service_code = d.sub_service_code and t.scoring_run_id = {_LATEST_RUN}
            group by d.category_code, d.category, d.service_code, d.service,
                     d.sub_service_code, d.sub_service, d.tier,
                     c.sort_order, s.sort_order, ss.sort_order
            order by c.sort_order, s.sort_order, ss.sort_order
            """
        )
        rows = cur.fetchall()

    tree: list[dict] = []
    for r in rows:
        if not tree or tree[-1]["code"] != r["category_code"]:
            tree.append({"code": r["category_code"], "name": r["category"], "services": []})
        svcs = tree[-1]["services"]
        if not svcs or svcs[-1]["code"] != r["service_code"]:
            svcs.append({"code": r["service_code"], "name": r["service"], "sub_services": []})
        svcs[-1]["sub_services"].append({
            "code": r["sub_service_code"],
            "name": r["sub_service"],
            "tier": r["tier"],
            "ranked_providers": r["ranked_providers"],
            "providers_with_evidence": r["providers_with_evidence"],
        })
    return tree


@app.get("/framework")
def framework():
    """The eight categories with default weight and their customer questions.

    Seven carry a weight. The eighth, Overall Verdict, is reported only:
    `default_weight` is 0 and `weighted` is false. A client builds its weights
    vector from the categories where `weighted` is true, in `category_no` order
    — never from the length of this list.
    """
    with cursor() as cur:
        cur.execute(
            """
            select f.category_no, f.name, f.weight as default_weight,
                   (f.weight > 0) as weighted,
                   sp.code, sp.customer_question, sp.is_gate, sp.is_veto,
                   sp.is_safety, sp.is_computed, sp.is_reported_only
            from ref.framework_category f
            join ref.sub_point sp on sp.category_no = f.category_no
            order by f.category_no, sp.sort_order
            """
        )
        rows = cur.fetchall()

        # Which categories describe the SALON rather than the work: cleanliness,
        # staff, price honesty. The scorer lets a trait carry across services
        # at quarter weight -- a dirty salon is dirty whichever service you
        # booked -- while an outcome category (quality, aftercare) does not.
        # It is read from the scoring run rather than hardcoded here, so the
        # app cannot disagree with the scores it is displaying.
        cur.execute(
            f"select parameters -> 'provider_trait_categories' as traits "
            f"from score.scoring_run where scoring_run_id = {_LATEST_RUN}"
        )
        row = cur.fetchone()
        traits = set(row["traits"] or []) if row else set()

    out: list[dict] = []
    for r in rows:
        if not out or out[-1]["category_no"] != r["category_no"]:
            out.append({
                "category_no": r["category_no"],
                "name": r["name"],
                "default_weight": r["default_weight"],
                "weighted": r["weighted"],
                "provider_trait": r["category_no"] in traits,
                "questions": [],
            })
        out[-1]["questions"].append({
            "code": r["code"],
            "customer_question": r["customer_question"],
            "is_gate": r["is_gate"],
            "is_veto": r["is_veto"],
            "is_safety": r["is_safety"],
            "is_computed": r["is_computed"],
            "is_reported_only": r["is_reported_only"],
        })
    return out


# The order the app widens its search in: the exact service the user picked,
# then the service above it, then the whole category. Each step is a real
# level of ref.dim_service, never an invented grouping.
_FALLBACK_LEVELS = (
    ("sub_service", "code", "name"),
    ("service", "service_code", "service"),
    ("category", "category_code", "category"),
)

# The filter is the same at every level, so it is written once. rank_no is the
# provider's position across the whole district; city and status narrow the
# list without renumbering it.
_RANK_FILTER = """
    join raw.provider p using (place_id)
    -- Every salon with enough evidence is ranked, including those carrying a
    -- safety concern; this is the sentence shown beside them. Left join: a
    -- clear record has no row here and the fields come back null.
    left join score.v_provider_caution sc using (place_id)
    where (%s = '' or lower(trim(r.city)) = lower(%s))
      and (%s = 'any'
           or (%s = 'open'   and not (p.permanently_closed or p.temporarily_closed))
           or (%s = 'closed' and (p.permanently_closed or p.temporarily_closed)))
    order by r.ordinality   -- the function's own order, untouched
"""

_RANK_COLUMNS = """
    select r.rank_no, r.place_id, r.provider_name, r.city, r.personal_score, r.range_low,
           r.range_high, r.safety_status, r.rank_status, r.badges, r.evidence_reviews,
           p.permanently_closed, p.temporarily_closed, p.lat, p.lng,
           sc.reason           as safety_reason,
           sc.report_count     as safety_reports,
           sc.last_report_date as safety_last_report
"""


def _rank_rows(cur, level: str, code: str, w, city: str, status: str,
               window: str = "1y") -> list[dict]:
    """One level of the ranking, filtered. Nothing here re-orders the rows."""
    if level == "sub_service":
        source = "from score.rank_providers(%s, %s::numeric[], %s) with ordinality r"
        args = (code, w, window)
    else:
        source = "from score.rank_providers_group(%s, %s, %s::numeric[], %s) with ordinality r"
        args = (level, code, w, window)
    cur.execute(
        _RANK_COLUMNS + source + _RANK_FILTER,
        args + (city, city, status, status, status),
    )
    return cur.fetchall()


# Which ref.dim_service column names the level, so the per-category block can
# average over exactly the sub-services that rolled up into the ranked level.
_LEVEL_COL = {"sub_service": "sub_service_code",
              "service": "service_code", "category": "category_code"}


def _attach_category_scores(cur, rows, level_used, shown, window="1y"):
    """Add `category_scores` to each row, in place.

    Keyed at whatever level ranked: the category scores of the sub-service at
    sub-service level (one row, exact), or the mean across the group's
    sub-services at a broader one. Scores here do not depend on the user's
    weights -- weights blend the categories into the overall, they do not
    change a category's own score -- so this is stable across re-weights.

    Category 9 is replaced with the chosen window's value from
    score.category9_window, with score_9_1 and score_9_2 included.
    """
    if not (rows and level_used in _LEVEL_COL and shown):
        return
    place_ids = [r["place_id"] for r in rows]
    cur.execute(
        f"""
        select c.place_id, c.category_no,
               round(avg(c.score), 4) as score,
               sum(c.evidence_count)  as evidence_count
        from score.category_score c
        join ref.dim_service d using (sub_service_code)
        where c.scoring_run_id = {_LATEST_RUN}
          and c.place_id = any(%s)
          and d.{_LEVEL_COL[level_used]} = %s
        group by c.place_id, c.category_no
        """,
        (place_ids, shown["code"]),
    )
    by_place: dict[str, list] = {}
    for cs in cur.fetchall():
        by_place.setdefault(cs["place_id"], []).append({
            "category_no": cs["category_no"],
            "score": float(cs["score"]),
            "evidence_count": cs["evidence_count"],
        })
    cat9 = _cat9_window_scores(cur, place_ids, level_used, shown["code"], window)
    for pid, c9 in cat9.items():
        cats = by_place.get(pid, [])
        cats = [c for c in cats if c["category_no"] != 9]
        cats.append(c9)
        by_place[pid] = cats
    for r in rows:
        r["category_scores"] = sorted(
            by_place.get(r["place_id"], []), key=lambda x: x["category_no"])


def _cat9_window_scores(cur, place_ids, level_used, code, window):
    """Category 9 scores from category9_window for the chosen window."""
    cur.execute(
        f"""
        select cw.place_id,
               round(avg(cw.score)::numeric, 4) as score,
               round(avg(cw.score_9_1)::numeric, 4) as score_9_1,
               round(avg(cw.score_9_2)::numeric, 4) as score_9_2
        from score.category9_window cw
        join ref.dim_service d using (sub_service_code)
        where cw.scoring_run_id = {_LATEST_RUN}
          and cw.place_id = any(%s)
          and d.{_LEVEL_COL[level_used]} = %s
          and cw.window_code = %s
        group by cw.place_id
        """,
        (place_ids, code, window),
    )
    out = {}
    for r in cur.fetchall():
        out[r["place_id"]] = {
            "category_no": 9,
            "score": float(r["score"]) if r["score"] is not None else 0.5,
            "score_9_1": float(r["score_9_1"]) if r["score_9_1"] is not None else None,
            "score_9_2": float(r["score_9_2"]) if r["score_9_2"] is not None else None,
            "evidence_count": 0,
        }
    return out


def _haversine_km(lat1, lng1, lat2, lng2) -> float:
    """Great-circle distance in km between two lat/lng points."""
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


# Distances come from the data: across the district every city centre has a
# neighbour within ~6 km (most within 1-3.5 km; the most isolated, Piliyandala,
# at 5.9 km). 7 km from the chosen city's centroid therefore reaches the next
# suburb or two for every city without spilling into the far side of the
# district. The floor drops rows sitting on the centroid -- a salon < 0.3 km
# away is the same place under a different spelling the city filter already
# excluded, not a nearby alternative.
NEARBY_RADIUS_KM = 7.0
NEARBY_MIN_KM = 0.3
NEARBY_LIMIT = 20


@app.get("/rankings/{sub_service_code}/nearby")
def rankings_nearby(
    sub_service_code: str,
    city: str = Query(..., description="The chosen city. Nearby salons are those just "
                                       "outside it, ranked for the same service."),
    weights: str | None = Query(None, description="Seven comma-separated weights, category 1 to 7."),
    status: str = Query("any", pattern="^(open|closed|any)$"),
    radius_km: float = Query(NEARBY_RADIUS_KM, gt=0, le=30),
    limit: int = Query(NEARBY_LIMIT, ge=1, le=50),
    consistency_window: str = Query("1y", description="6m, 1y, 3y or anytime"),
):
    """Ranked salons just OUTSIDE the chosen city, nearest first.

    The main ranking filters to one city exactly, so a strong salon one street
    over in the next suburb is invisible. This answers the follow-up a reader
    then has -- "and what is near here?" -- without widening the main list: the
    same service, the same scoring, the same fallback widening, but drawn from
    the whole district and then kept to those within `radius_km` of the chosen
    city's centroid, in a different city, sorted by distance.

    The centroid is the mean lat/lng of the chosen city's own salons, so no
    city coordinates are hard-coded. `distance_km` is each salon's distance
    from that centroid. Rows carry the same shape as the main `ranked` list,
    including `category_scores`, so the same card renders them.
    """
    w = _parse_weights(weights)
    cw = _window(consistency_window)
    city = (city or "").strip()
    if not city:
        raise HTTPException(400, "A city is required to find nearby salons.")

    with cursor() as cur:
        sub = _sub_service_or_404(cur, sub_service_code)

        cur.execute(
            """
            select avg(lat) as lat, avg(lng) as lng
            from raw.provider
            where lower(trim(city)) = lower(%s) and lat is not null and lng is not null
            """,
            (city,),
        )
        centre = cur.fetchone()
        if not centre or centre["lat"] is None:
            return {"requested": {"code": sub["code"], "name": sub["name"]},
                    "city": city, "level_used": "none", "shown": None,
                    "weights": w or [1] * WEIGHTED_CATEGORIES, "nearby": []}
        clat, clng = float(centre["lat"]), float(centre["lng"])

        # District-wide (no city filter), then kept to nearby other cities.
        level_used, shown, rows = "none", None, []
        for level, code_key, name_key in _FALLBACK_LEVELS:
            code, name = sub[code_key], sub[name_key]
            found = _rank_rows(cur, level, code, w, "", status, window=cw)
            shown, rows = {"code": code, "name": name}, found
            if any(r["rank_status"] == "ranked" for r in found):
                level_used = level
                break

        target = city.lower().strip()
        nearby = []
        for r in rows:
            if r["rank_status"] != "ranked" or r["lat"] is None or r["lng"] is None:
                continue
            if (r["city"] or "").lower().strip() == target:
                continue
            d = _haversine_km(clat, clng, float(r["lat"]), float(r["lng"]))
            if d < NEARBY_MIN_KM or d > radius_km:
                continue
            r["distance_km"] = round(d, 1)
            nearby.append(r)

        nearby.sort(key=lambda x: x["distance_km"])
        nearby = nearby[:limit]
        _attach_category_scores(cur, nearby, level_used, shown, window=cw)
        staff_card = staff_card_for(cur, [r["place_id"] for r in nearby])
        pop = popular_services_for(cur, [r["place_id"] for r in nearby])
        for r in nearby:
            card = staff_card.get(r["place_id"], {})
            r["staff_dependent"] = card.get("staff_dependent", False)
            r["popular_services"] = pop.get(r["place_id"])
            r["named_staff"] = card.get("named_staff", {"count": 0, "top": []})

    return {
        "requested": {"code": sub["code"], "name": sub["name"]},
        "city": city,
        "level_used": level_used,
        "shown": shown,
        "weights": w or [1] * WEIGHTED_CATEGORIES,
        "status": status,
        "radius_km": radius_km,
        "nearby": nearby,
    }


@app.get("/rankings/{sub_service_code}")
def rankings(
    sub_service_code: str,
    weights: str | None = Query(None, description="Seven comma-separated weights, category 1 to 7. "
                                                 "Category 8, Overall Verdict, is reported only "
                                                 "and takes no weight."),
    city: str | None = Query(None, description="Optional city filter (case-insensitive)"),
    status: str = Query("any", pattern="^(open|closed|any)$",
                        description="open = operating; closed = Google lists it as permanently "
                                    "or temporarily closed. No opening hours are held, so this is "
                                    "business status, not time of day."),
    consistency_window: str = Query("1y", description="6m, 1y, 3y or anytime"),
):
    """Ranked, available-but-not-ranked and safety-concern providers, in database order.

    Every provider with enough review evidence is ranked, including those
    carrying a safety mark: safety decides ORDER (clear, then caution, then
    concern, whatever the score) rather than removal. No safety notice is shown
    to the customer; safety is presented through the Category 7 score.
    `safety_status` and `safety_reason` stay in each row for reference only.
    `safety_concern` is always empty: it collects the rank_status that only a
    veto produces, and no sub-point in the framework is marked as a veto. The
    key stays in the response so a client reading it finds a list rather than
    nothing.

    Scores are held per sub-service, and for some sub-services no provider has
    enough review evidence to be ranked at all. Rather than answer "no salons",
    the search widens a step at a time — the sub-service, then the service above
    it, then the category — and stops at the first level that can rank anyone.
    `level_used` names the level that answered and `shown` names the thing it
    ranked, so the app can say so plainly; `requested` is always what the
    reader asked for.

    Widening is decided on the filtered list, because that is what the user sees:
    if nothing is ranked in their city, the broader service is tried in their
    city too. `level_used` is "none" when no level can rank anyone, and the
    lists then describe the category — the widest honest answer available.

    rank_no is the provider's position across the whole district; the city and
    status filters narrow the list without renumbering it.
    """
    w = _parse_weights(weights)
    cw = _window(consistency_window)
    city = (city or "").strip()
    with cursor() as cur:
        sub = _sub_service_or_404(cur, sub_service_code)

        level_used, shown, rows = "none", None, []
        for level, code_key, name_key in _FALLBACK_LEVELS:
            code, name = sub[code_key], sub[name_key]
            found = _rank_rows(cur, level, code, w, city, status, window=cw)
            shown, rows = {"code": code, "name": name}, found
            if any(r["rank_status"] == "ranked" for r in found):
                level_used = level
                break

        _attach_category_scores(cur, rows, level_used, shown, window=cw)
        staff_card = staff_card_for(cur, [r["place_id"] for r in rows])
        pop = popular_services_for(cur, [r["place_id"] for r in rows])
        for r in rows:
            card = staff_card.get(r["place_id"], {})
            r["staff_dependent"] = card.get("staff_dependent", False)
            r["popular_services"] = pop.get(r["place_id"])
            r["named_staff"] = card.get("named_staff", {"count": 0, "top": []})

    return {
        # The full sub-service row, which every client reads for its name and
        # tier. `requested` repeats the code and name for the fallback notice.
        "sub_service": sub,
        "requested": {"code": sub["code"], "name": sub["name"]},
        "level_used": level_used,
        "shown": shown,
        "weights": w or [1] * WEIGHTED_CATEGORIES,
        "city": city or None,
        "status": status,
        "ranked": [r for r in rows if r["rank_status"] == "ranked"],
        "available_but_not_ranked": [r for r in rows if r["rank_status"] == "available but not ranked"],
        "safety_concern": [r for r in rows if r["rank_status"] == "not ranked: safety concern"],
    }


@app.get("/providers")
def search_providers(q: str = "", limit: int = Query(50, ge=1, le=200)):
    """Provider search by name (case-insensitive substring)."""
    pattern = "%" + q.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
    with cursor() as cur:
        cur.execute(
            """
            select place_id, name, city, google_rating, google_review_count
            from raw.provider
            where name ilike %s
            order by name
            limit %s
            """,
            (pattern, limit),
        )
        return cur.fetchall()


@app.get("/providers/{place_id}")
def provider(place_id: str, consistency_window: str = Query("1y", description="6m, 1y, 3y or anytime")):
    """Details, safety, gates and vetoes, and a score per service with category scores.

    Seven weighted categories plus Overall Verdict (reported only) and
    Category 9 (from category9_window for the chosen window, with 9.1/9.2).
    """
    cw = _window(consistency_window)
    with cursor() as cur:
        cur.execute(
            """
            select place_id, name, google_category, address, city, lat, lng, google_rating,
                   google_review_count, permanently_closed, temporarily_closed, place_url
            from raw.provider where place_id = %s
            """,
            (place_id,),
        )
        details = cur.fetchone()
        if not details:
            raise HTTPException(404, "Provider not found")

        cur.execute(
            f"""
            select safety_status, safety_reports, damage_level_reports, reason
            from score.provider_safety
            where place_id = %s and scoring_run_id = {_LATEST_RUN}
            """,
            (place_id,),
        )
        safety = cur.fetchone() or {
            "safety_status": None, "safety_reports": 0, "damage_level_reports": 0, "reason": None,
        }

        cur.execute(
            f"""
            select g.sub_point_code, sp.customer_question, g.kind, g.status, g.report_count,
                   g.disputed_reports, g.first_report_date, g.last_report_date, g.expires_on
            from score.gate_veto_status g
            join ref.sub_point sp on sp.code = g.sub_point_code
            where g.place_id = %s and g.scoring_run_id = {_LATEST_RUN}
            order by g.kind desc, g.sub_point_code
            """,
            (place_id,),
        )
        gates = cur.fetchall()

        cur.execute(
            f"""
            select t.sub_service_code, d.sub_service, d.service, d.category,
                   d.service_code, d.category_code, t.tier,
                   t.trust_score, t.range_low, t.range_high, t.base_score, t.gate_penalty,
                   t.evidence_reviews, t.badges, t.safety_status, t.rank_status, t.rank_in_service
            from score.trust_score t
            join ref.dim_service d using (sub_service_code)
            where t.place_id = %s and t.scoring_run_id = {_LATEST_RUN}
            order by t.sub_service_code
            """,
            (place_id,),
        )
        services_ = cur.fetchall()

        cur.execute(
            f"""
            select c.sub_service_code, c.category_no, f.name, c.score, c.evidence_count
            from score.category_score c
            join ref.framework_category f using (category_no)
            where c.place_id = %s and c.scoring_run_id = {_LATEST_RUN}
            order by c.sub_service_code, c.category_no
            """,
            (place_id,),
        )
        by_service: dict[str, list] = {}
        for r in cur.fetchall():
            by_service.setdefault(r.pop("sub_service_code"), []).append(r)

        cur.execute(
            f"""
            select cw.sub_service_code, cw.score, cw.score_9_1, cw.score_9_2
            from score.category9_window cw
            where cw.place_id = %s and cw.scoring_run_id = {_LATEST_RUN}
              and cw.window_code = %s
            """,
            (place_id, cw),
        )
        for r in cur.fetchall():
            ssc = r.pop("sub_service_code")
            cats = by_service.get(ssc, [])
            cats = [c for c in cats if c["category_no"] != 9]
            cats.append({
                "category_no": 9, "name": "Service Expertise & Consistency",
                "score": r["score"], "evidence_count": 0,
                "score_9_1": float(r["score_9_1"]) if r["score_9_1"] is not None else None,
                "score_9_2": float(r["score_9_2"]) if r["score_9_2"] is not None else None,
            })
            by_service[ssc] = cats

        # The services this provider's EVIDENCE is actually filed under.
        #
        # Not the same thing as `services` above. A sub-service is scored from
        # the evidence of the service above it, so `evidence_reviews` there
        # counts reviews behind the SCORE, not reviews filed against that
        # sub-service. Filtering the second by the first is what produced a
        # Service menu whose every choice answered "No evidence matches these
        # filters".
        #
        # Extraction fills these three columns at different rates: of 44,594
        # rows, service_category_code is set on 39%, service_code on 29% and
        # sub_service_code on none at all. So the filter works at the service
        # level -- Haircuts, Hair Colour -- which is the finest level the
        # evidence actually carries. Each row counts the evidence behind it,
        # so the menu can say how much is there.
        cur.execute(
            """
            select e.service_code, d.service, d.category, count(*) as evidence_items
            from extract.evidence_item e
            left join (select distinct service_code, service, category from ref.dim_service) d
                   on d.service_code = e.service_code
            where e.place_id = %s and e.service_code is not null
            group by e.service_code, d.service, d.category
            order by d.category, d.service
            """,
            (place_id,),
        )
        evidence_services = cur.fetchall()

        # Sentiment across this salon's evidence, counted once per row. Not
        # the sum of the per-service figures: those deliberately overlap,
        # because one salon-wide review counts toward every service.
        # Counted per REVIEW at review level (overall_sentiment), so the
        # "Said how" chips match the badge each review card shows.
        cur.execute(
            """
            select ra.overall_sentiment as polarity, count(distinct ra.review_id) as n
            from extract.review_assessment ra
            join (select distinct place_id, review_id from extract.evidence_item) e
              using (review_id)
            where e.place_id = %s and ra.overall_sentiment is not null
            group by ra.overall_sentiment
            """,
            (place_id,),
        )
        sentiment_totals = {r["polarity"]: r["n"] for r in cur.fetchall()}
        staff_reputation = staff_for(cur, [place_id])[place_id]
        # From the list just fetched, not a second query.
        staff_reputation["staff_dependent"] = staff_dependent_flag(staff_reputation["staff"])
        popular_services = popular_services_for(cur, [place_id])[place_id]
        languages = languages_for(cur, [place_id])[place_id]

    for s in services_:
        s["category_scores"] = by_service.get(s["sub_service_code"], [])

    return {**details, "safety": safety, "gates_and_vetoes": gates, "services": services_,
            "evidence_services": evidence_services, "sentiment_totals": sentiment_totals,
            "staff_reputation": staff_reputation,
            "popular_services": popular_services, "languages": languages}


# Evidence ordering. The key is validated by the Query pattern below and the
# value is a fixed fragment from this dict, so nothing from the request text
# reaches the SQL.
_EVIDENCE_ORDER = {
    "recent": "r.published_at desc, e.evidence_id",
    # Longest first. The app quotes review_text, so that is what gets measured
    # -- not evidence_text, which is capped at 100 characters and would make
    # almost every row tie. A row with no review text has nothing to quote, so
    # it sorts last rather than counting as length 0 among the shortest.
    "longest": ("length(coalesce(r.review_text, '')) desc, "
                "r.published_at desc, e.evidence_id"),
}


@app.get("/providers/{place_id}/sentiment")
def sentiment(place_id: str):
    """Sentiment split per service x category, over the evidence each score used.

    The population is the scorer's, not a simpler one: evidence filed to the
    service, evidence filed to no service at all (which counts for every
    service of that category), and -- for a trait category only -- evidence
    filed to another service. Counting anything else would put a chart beside
    a number that disagrees with it, which is the whole reason this exists.

    One row per service_code x category_no x polarity. The app pivots it; the
    API keeps it flat so a service with no evidence in a category simply has
    no rows, which is what the dimmed state is drawn from.
    """
    with cursor() as cur:
        cur.execute(
            f"select parameters -> 'provider_trait_categories' as traits "
            f"from score.scoring_run where scoring_run_id = {_LATEST_RUN}"
        )
        row = cur.fetchone()
        traits = list(row["traits"] or []) if row else []

        cur.execute(
            f"""
            with svc as (
                select distinct d.service_code, d.category_code
                from score.trust_score t
                join ref.dim_service d using (sub_service_code)
                where t.place_id = %s and t.scoring_run_id = {_LATEST_RUN}
            )
            select s.service_code, sp.category_no, e.polarity, count(*) as n
            from svc s
            join extract.evidence_item e on e.place_id = %s
            join ref.sub_point sp on sp.code = e.sub_point_code
            where e.polarity is not null
              and (
                    e.service_code = s.service_code
                 or (e.sub_service_code is null and e.service_code is null
                     and (e.service_category_code is null
                          or e.service_category_code = s.category_code))
                 or (sp.category_no = any(%s::int[])
                     and e.service_code is not null
                     and e.service_code <> s.service_code)
              )
            group by s.service_code, sp.category_no, e.polarity
            order by s.service_code, sp.category_no, e.polarity
            """,
            (place_id, place_id, traits),
        )
        return cur.fetchall()


@app.get("/providers/{place_id}/staff/{staff_name}/reviews")
def staff_reviews(place_id: str, staff_name: str):
    """The reviews naming one staff member at one business, newest first.

    An unknown name returns an empty list rather than a 404: the name comes
    from a list this same API produced, so "no reviews" is the useful answer
    and a 404 would only invite the caller to treat a typo differently from
    a genuinely quiet week.
    """
    with cursor() as cur:
        return {"reviews": reviews_for_staff(cur, place_id, staff_name)}


@app.get("/providers/{place_id}/sub-point-proof")
def sub_point_proof(place_id: str):
    """Salon-wide positive/negative counts per sub-point -- the receipts
    behind each short claim ("Friendly and caring", "Salon is clean").

    Unscoped to any one service: this is the evidence for the category labels
    shown once per salon, not for a service's own score (that is `/sentiment`,
    pooled the way the scorer pools it). A sub-point with zero rows here is a
    claim with nothing behind it yet, and the client is expected to say so
    rather than invent a number.
    """
    with cursor() as cur:
        cur.execute(
            """
            select e.sub_point_code, e.polarity, count(*) as n
            from extract.evidence_item e
            where e.place_id = %s
              and e.sub_point_code is not null
              and e.polarity in ('positive', 'negative', 'mixed')
            group by e.sub_point_code, e.polarity
            order by e.sub_point_code
            """,
            (place_id,),
        )
        return cur.fetchall()


@app.get("/providers/{place_id}/reply-quality")
def reply_quality(place_id: str):
    """The counts behind Category 3 parts 3.1 to 3.4, as the scorer reads them.

    A complaint is a review with text whose latest overall_sentiment is not
    positive. 3.1-3.3 count replies to complaints only; replies to positive
    reviews are not counted anywhere. 3.4 reads the promise outcomes the
    latest scoring run wrote to score.commitment_outcome.
    """
    # Latest assessment run per review, as 06_run_scoring.py takes it, so no
    # review is counted twice.
    complaints_cte = """
            with c as (
                select r.review_id, o.review_id is not null as replied, o.reply_text,
                       rp.specificity, rp.stance, rp.remedy_offered
                from raw.review r
                join lateral (
                    select x.overall_sentiment from extract.review_assessment x
                    where x.review_id = r.review_id order by x.run_id desc limit 1
                ) ra on true
                left join raw.owner_reply o using (review_id)
                left join lateral (
                    select y.specificity, y.stance, y.remedy_offered from extract.reply_assessment y
                    where y.review_id = r.review_id order by y.run_id desc limit 1
                ) rp on true
                where r.place_id = %s
                  and coalesce(trim(r.review_text), '') <> ''
                  and ra.overall_sentiment <> 'positive'
            )
    """
    with cursor() as cur:
        cur.execute(
            complaints_cte + """
            select
              count(*)                                                            as complaints,
              count(*) filter (where replied)                                     as complaints_replied,
              count(*) filter (where replied and specificity = 'specific')        as spec_specific,
              count(*) filter (where replied and specificity = 'partly specific') as spec_partly,
              count(*) filter (where replied and specificity = 'generic')         as spec_generic,
              count(*) filter (where replied and stance = 'accepts / apologises') as st_accepts,
              count(*) filter (where replied and stance = 'accepts and disputes (mixed)') as st_mixed,
              count(*) filter (where replied and stance = 'neither accepts nor disputes') as st_neither,
              count(*) filter (where replied and stance = 'disputes the report')  as st_disputes,
              count(*) filter (where replied and remedy_offered)                  as remedy
            from c
            """,
            (place_id,),
        )
        r = cur.fetchone()

        # One real reply to a complaint of each kind, shortest first.
        cur.execute(
            complaints_cte + """
            select distinct on (specificity) specificity, reply_text
            from c
            where replied
              and specificity in ('specific', 'generic')
              and length(reply_text) between 40 and 400
            order by specificity, length(reply_text)
            """,
            (place_id,),
        )
        examples = {x["specificity"]: x["reply_text"] for x in cur.fetchall()}

        cur.execute(
            """
            select co.outcome, count(*) as n
            from score.commitment_outcome co
            join raw.review rv using (review_id)
            where rv.place_id = %s
              and co.scoring_run_id = (select max(scoring_run_id) from score.scoring_run)
            group by co.outcome
            """,
            (place_id,),
        )
        outcomes = {x["outcome"]: x["n"] for x in cur.fetchall()}

    return {
        "complaints": r["complaints"],
        "complaints_replied": r["complaints_replied"],
        "specificity": {"specific": r["spec_specific"], "partly": r["spec_partly"],
                        "generic": r["spec_generic"]},
        "stance": {"accepts": r["st_accepts"], "mixed": r["st_mixed"],
                   "neither": r["st_neither"], "disputes": r["st_disputes"]},
        "remedy": r["remedy"],
        "promises": {"kept": outcomes.get("kept", 0), "broken": outcomes.get("broken", 0),
                     "no_clear_change": outcomes.get("no clear change", 0),
                     "not_testable": outcomes.get("not testable", 0)},
        "examples": examples,
    }


@app.get("/providers/{place_id}/evidence")
def evidence(
    place_id: str,
    service_code: str | None = None,
    # Inert: extract.evidence_item.sub_service_code is null on every row, so
    # this filter matches nothing. Kept because the column and the filter are
    # both correct -- the attribution is what is missing -- and the service
    # level above is the finest the evidence actually carries today.
    sub_service_code: str | None = None,
    # Evidence filed against no service at all -- what a score rests on when
    # nothing service-specific exists, and not otherwise listable.
    #
    # With `service_category_code` this reproduces the scorer's provider_level
    # test exactly: sub and service both null, and the evidence's own category
    # either absent or the same as the service being looked at. Without the
    # category it would over-report, since a row tagged to another category
    # carries no provider_level weight and did not go into the score. For
    # House of Aura's Quality of Work that is the difference between 25 rows
    # and the 18 the score panel prints.
    unassigned: bool = False,
    service_category_code: str | None = None,
    # Evidence filed against some OTHER service. A trait category counts these
    # at quarter weight, so for those they are part of the score and have to be
    # listable; an outcome category gives them weight 0 and the app does not
    # ask for them.
    exclude_service_code: str | None = None,
    category_no: int | None = Query(None, ge=1, le=9),
    # Any review-level sentiment the data holds (extract.review_assessment
    # .overall_sentiment). Kept as a word so a new value is accepted, not a
    # fixed allow-list; the query simply matches it, and an unknown value finds
    # nothing rather than erroring.
    polarity: str | None = Query(None, pattern="^[a-z]+$", max_length=20),
    # Neutral namecheck rows ("mention") are noise in the general list, so the
    # review list asks to hide them unless the reader has chosen the Mention
    # filter. Off by default so other callers (the score drawer) are unchanged.
    hide_mention: bool = False,
    # Only reviews that name a staff member (have a staff_name). Combines with
    # any polarity, so "positive + named" is positive reviews that name staff.
    only_named: bool = False,
    # One of the three detected languages. Narrows to reviews written in it;
    # omitted, nothing is hidden — 'other' and undetected reviews still show
    # under All, because the filter is for finding, not for quietly dropping.
    language: str | None = Query(None, pattern="^(english|sinhala|english_sinhala_mix)$"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    sort: str = Query("recent", pattern="^(recent|longest)$"),
):
    """Evidence rows, newest review first, or longest review first with
    sort=longest.

    Two texts come back for each row, and they are not the same thing:

      evidence_text  the span the extraction stored as its justification for
                     this sub-point, capped at 100 characters, so it is usually
                     cut mid-word and is not quotable on its own.
      review_text    the customer's review in full, from raw.review. This is
                     what the app quotes.

    Both are returned rather than one: the snippet says WHY the row exists and
    is what a reader checks the label against, while the full review is the
    evidence itself. Neither is rewritten or shortened here.
    """
    with cursor() as cur:
        cur.execute(
            """
            select e.evidence_id, e.review_id, e.run_id, x.method, e.sub_service_code,
                   ss.name as sub_service, sp.category_no, e.sub_point_code, sp.customer_question,
                   e.polarity, e.severity, e.time_since_visit, e.confidence,
                   e.evidence_text, r.review_text, r.stars, r.published_at,
                   -- The review-level sentiment, the correct one for the card's
                   -- badge; per-sub-point polarity can disagree with it.
                   ra.overall_sentiment,
                   -- The owner's answer, carried beside the review it answers.
                   -- Category 3 is about how an owner handles complaints, so a
                   -- row there without the reply shows the accusation and hides
                   -- the response: every one of those 5,414 rows has one.
                   o.reply_text, o.reply_date,
                   -- Who the review names. staging.staff_names.evidence_id keys
                   -- into staging.evidence_item (ids 1-9999), NOT
                   -- extract.evidence_item, so it is resolved to a review_id
                   -- through staging and attached per review (all names for the
                   -- review, comma-joined). This mapping is exact: every name
                   -- genuinely appears in its review text.
                   sn.staff_name, r.source_language
            from extract.evidence_item e
            join raw.review r on r.review_id = e.review_id
            left join extract.review_assessment ra on ra.review_id = e.review_id
            left join raw.owner_reply o on o.review_id = e.review_id
            left join (
                select se.review_id, string_agg(distinct s.staff_name, ', ') as staff_name
                from staging.staff_names s
                join staging.evidence_item se on se.evidence_id::text = s.evidence_id::text
                group by se.review_id
            ) sn on sn.review_id = e.review_id
            join ref.sub_point sp on sp.code = e.sub_point_code
            join extract.extraction_run x on x.run_id = e.run_id
            left join ref.sub_service ss on ss.code = e.sub_service_code
            where e.place_id = %s
              and (not %s or (e.sub_service_code is null and e.service_code is null
                              and (%s::text is null
                                   or e.service_category_code is null
                                   or e.service_category_code = %s)))
              and (%s::text is null or e.service_code = %s)
              and (%s::text is null
                   or (e.service_code is not null and e.service_code <> %s))
              and (%s::text is null or e.sub_service_code = %s)
              and (%s::smallint is null or sp.category_no = %s)
              -- Sentiment filter matches the REVIEW-level sentiment (the badge),
              -- not the per-sub-point polarity.
              and (%s::text is null or ra.overall_sentiment = %s)
              and (not %s or e.polarity <> 'mention')
              -- Named-staff filter, independent of sentiment.
              and (not %s or sn.staff_name is not null)
              -- Language filter, independent of every other one.
              and (%s::text is null or r.source_language = %s)
            order by {order}
            limit %s offset %s
            """.format(order=_EVIDENCE_ORDER[sort]),
            (place_id, unassigned, service_category_code or None, service_category_code or None,
             service_code or None, service_code or None,
             exclude_service_code or None, exclude_service_code or None,
             sub_service_code or None, sub_service_code or None,
             category_no, category_no,
             polarity, polarity, hide_mention, only_named, language, language,
             limit, offset),
        )
        return cur.fetchall()
