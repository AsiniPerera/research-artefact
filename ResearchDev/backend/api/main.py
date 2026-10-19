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

import json
import os
import pathlib
import queue
import re
import datetime
import math
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager, contextmanager

import psycopg2
from psycopg2.extensions import TRANSACTION_STATUS_UNKNOWN
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

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


# The services most often opened first, asked the way the app asks by default
# (equal weights, open salons, all time). Done once in the background at start-up
# so the first real click is a cache hit instead of a cold database round.
_WARM_SERVICES = ("HR.CUT.01", "HR.COL.01", "SK.FAC.01", "NL.CARE.01", "BO.BRIDAL.02")


def _warm_rankings() -> None:
    for code in _WARM_SERVICES:
        try:
            rankings(sub_service_code=code, weights="2,2,2,2,2,2,2", city=None,
                     status="open", consistency_window="anytime")
        except Exception:
            return       # warming is a nicety; never let it disturb start-up


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Close the pooled connections on shutdown so Supabase does not hold
    sessions open for a process that has gone.

    Warmup is skipped on Render: free-plan processes recycle on idle and the
    Supabase pooler already handles the first real request without a stall."""
    if not os.environ.get("RENDER"):
        threading.Thread(target=_warm_rankings, daemon=True).start()
    yield
    if _pool is not None:
        _pool.close()


# Comma-separated origins, read from the environment so a deployed frontend can
# be added without a code change. Defaults cover the Vite dev server.
ALLOWED_ORIGINS = [o.strip() for o in os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
).split(",") if o.strip()]

app = FastAPI(title="Beauty Service Ranking API", lifespan=lifespan)
# JSON of salon rows is highly repetitive: a 200 KB ranking compresses to ~25 KB.
app.add_middleware(GZipMiddleware, minimum_size=1024)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "PUT"],
    allow_headers=["*"],
)

from auth import router as auth_router
from contact import router as contact_router
from survey import router as survey_router
from overall import overall_figure, WINDOW_MONTHS
_VALID_WINDOWS = {"6m", "1y", "3y", "anytime", "all"}
from staff import (staff_for, staff_dependent_flag, staff_dependent_for,
                   reviews_for_staff, named_staff_summary_for, staff_card_for)
from popular_services import popular_services_for
from service_specialism import specialism_for
from languages import languages_for
app.include_router(auth_router)
app.include_router(contact_router)
app.include_router(survey_router)

_LATEST_RUN = "(select max(scoring_run_id) from score.scoring_run)"

# Ranking answers are the same until a new scoring run is loaded, and the same
# search is asked again and again (the Rank button, paging back, reopening a
# service). A short in-memory cache keyed on the full query skips the dozen
# database round trips behind each answer. Five minutes bounds how long an old
# answer can outlive a new scoring run; restarting the API clears it at once.
_RANK_CACHE: dict = {}
_RANK_CACHE_TTL = 300.0
_RANK_CACHE_MAX = 400


def _target_or_404(cur, code: str) -> dict:
    """What `code` names -- a sub-service (HR.CUT.01), a service (HR.CUT) or a
    whole category (HR) -- with the names of every level above it, or 404.

    A reader can rank any of the three. `level` says which one was asked for,
    and the fallback ladder starts there: a sub-service can widen to its
    service and then its category, a service only to its category, a category
    nowhere. `tier` is the sub-service's irreversibility tier and is None for a
    service or category, which mixes tiers.

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
    if row:
        return {**row, "level": "sub_service"}
    cur.execute(
        "select service_code, service, category_code, category from ref.dim_service"
        " where service_code = %s limit 1",
        (code,),
    )
    row = cur.fetchone()
    if row:
        return {"code": code, "name": row["service"], "tier": None,
                "service_code": code, "service": row["service"],
                "category_code": row["category_code"], "category": row["category"],
                "level": "service"}
    cur.execute(
        "select category_code, category from ref.dim_service where category_code = %s limit 1",
        (code,),
    )
    row = cur.fetchone()
    if row:
        return {"code": code, "name": row["category"], "tier": None,
                "service_code": None, "service": None,
                "category_code": code, "category": row["category"],
                "level": "category"}
    raise HTTPException(404, f"Unknown service code: {code}")


def _ladder(target: dict):
    """The fallback levels from the one the reader picked upward."""
    start = [lvl for lvl, _, _ in _FALLBACK_LEVELS].index(target["level"])
    return _FALLBACK_LEVELS[start:]


# The framework holds nine categories; the client sends SEVEN numbers, one per
# category from 1 to 7, in category_no order. Postgres arrays are 1-indexed, so
# position i of that list is category i and rank_providers reads
# p_weights[category_no] straight off it.
#
# Three categories are not the client's to set, and none of the three reads
# its position in this array. Category 3 is reported only and forced to 0
# below. Categories 8 and 9 both carry weight 0 in ref.framework_category and
# never enter a ranking at all -- 9.1 (consistency) was removed once every
# category became duration-filtered, and 9.2 (specialism) was never ranked,
# only ever displayed.
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
def services(consistency_window: str = Query("anytime", description="6m, 1y, 3y or anytime")):
    """Taxonomy tree with ranked / evidenced provider counts per sub-service.

    trust_score carries one row per place x sub-service x window now, so the
    join below must pick one window -- left unfiltered, ranked_providers and
    providers_with_evidence would sum across all four and over-count by
    roughly 4x.
    """
    cw = _window(consistency_window)
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
                  and t.window_code = %s
            group by d.category_code, d.category, d.service_code, d.service,
                     d.sub_service_code, d.sub_service, d.tier,
                     c.sort_order, s.sort_order, ss.sort_order
            order by c.sort_order, s.sort_order, ss.sort_order
            """,
            (cw,),
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
               window: str = "all") -> list[dict]:
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


def _attach_category_scores(cur, rows, level_used, shown, window="all"):
    """Add `category_scores` to each row, in place.

    Keyed at whatever level ranked: the category scores of the sub-service at
    sub-service level (one row, exact), or the mean across the group's
    sub-services at a broader one. Scores here do not depend on the user's
    weights -- weights blend the categories into the overall, they do not
    change a category's own score -- so this is stable across re-weights.

    `window` now scopes every category, not just Category 9: 06_run_scoring.py
    writes a separate row per duration window for every category, and this
    reads back whichever one the reader chose. Category 9 always comes back
    at the neutral 0.5 (weight 0, nothing coded to it -- see
    06_run_scoring.py section 3b); the frontend does not render a tile for
    it, the same treatment Categories 3 and 8 already get.
    """
    # "none" means no level could rank anyone. The rows are then the widest
    # level the search reached -- the category -- so their breakdown is read at
    # that level too. Without it a salon listed for lack of anything better had
    # no category scores, no arrow and nothing to open.
    if level_used == "none":
        level_used = "category"
    if not (rows and level_used in _LEVEL_COL and shown):
        return
    place_ids = [r["place_id"] for r in rows]
    cur.execute(
        f"""
        -- Pooled the way the ranking pools it (29_no_data_dimensions.sql):
        -- weighted by evidence, over the sub-services that HAVE data for the
        -- category. No data anywhere comes back as score null, evidence_count
        -- 0, never as the 0.5 placeholder the table stores; the caller then
        -- turns that into the 0 a weighted category scores.
        select c.place_id, c.category_no,
               round(case when sum(c.evidence_weight) filter (where c.evidence_count > 0) > 0
                          then sum(c.score * c.evidence_weight) filter (where c.evidence_count > 0)
                               / sum(c.evidence_weight) filter (where c.evidence_count > 0)
                          else avg(c.score) filter (where c.evidence_count > 0) end, 4) as score,
               sum(c.evidence_count)  as evidence_count
        from score.category_score c
        join ref.dim_service d using (sub_service_code)
        where c.scoring_run_id = {_LATEST_RUN}
          and c.place_id = any(%s)
          and d.{_LEVEL_COL[level_used]} = %s
          and c.window_code = %s
        group by c.place_id, c.category_no
        """,
        (place_ids, shown["code"], window),
    )
    by_place: dict[str, list] = {}
    for cs in cur.fetchall():
        by_place.setdefault(cs["place_id"], []).append({
            "category_no": cs["category_no"],
            # No data (evidence_count 0) comes back as null, never the stored
            # 0.5 placeholder: the ranking leaves such a category out of the
            # score (29_no_data_dimensions.sql), and the screen shows a dash.
            "score": None if cs["score"] is None else float(cs["score"]),
            "evidence_count": cs["evidence_count"],
        })
    for r in rows:
        r["category_scores"] = sorted(
            by_place.get(r["place_id"], []), key=lambda x: x["category_no"])


def _load_audience() -> dict[str, str]:
    """place_id -> "ladies" | "gents" | "unisex", from provider_audience.json.

    The database has no audience field. salon_db/22_derive_provider_audience.py
    writes this file from the loaded CSVs and labels only the salons it is sure
    of; a salon not in the file simply has no label. A missing or unreadable
    file means no salon is labelled, not an error.
    """
    path = pathlib.Path(__file__).with_name("provider_audience.json")
    try:
        return {pid: v["audience"] for pid, v in json.loads(path.read_text(encoding="utf-8")).items()}
    except (OSError, ValueError, KeyError, TypeError):
        return {}


_AUDIENCE = _load_audience()


def _display_name(full: str) -> str:
    """"Thisarani Warusavithana" -> "Thisarani W.". A first name and a last
    initial: enough to read the review as a person's, without printing a full
    identifiable name beside what they wrote."""
    parts = full.split()
    if len(parts) < 2:
        return parts[0] if parts else ""
    return f"{parts[0]} {parts[-1][0]}." if parts[-1][0].isalpha() else parts[0]


def _load_reviewer_names() -> dict[str, str]:
    """review_id -> display name, from salon_db/data/review_reviewer.csv.

    That file is personal data and is git-ignored, so on a machine without it
    there are simply no names and the app shows none. Read once at start-up."""
    import csv
    path = pathlib.Path(__file__).resolve().parents[1] / "salon_db" / "data" / "review_reviewer.csv"
    try:
        with open(path, encoding="utf-8-sig", newline="") as f:
            return {r["review_id"]: _display_name(r["reviewer_name"].strip())
                    for r in csv.DictReader(f) if r.get("reviewer_name", "").strip()}
    except (OSError, KeyError, ValueError):
        return {}


_REVIEWER = _load_reviewer_names()


def _review_counts(cur, place_ids) -> dict[str, dict[str, int]]:
    """Two counts per salon, both across ALL its services.

    reviews  every review collected for the salon, star-only ones included. This is
             the figure a reader compares with the salon's Google page.
    written  those with a comment, which is all the scorer can read (a star-only
             review has no text to assess). Same count the salon profile shows as
             its sentiment total.

    A ranking row's own `evidence_reviews` is narrower again: only the reviews
    that are about the service asked for. All three are shown so a salon with 219
    reviews and 11 about haircuts does not look like a salon with 11 reviews.
    """
    if not place_ids:
        return {}
    cur.execute(
        """
        select r.place_id,
               count(distinct r.review_id)  as reviews,
               count(distinct ra.review_id) as written
        from raw.review r
        left join extract.review_assessment ra
               on ra.review_id = r.review_id and ra.overall_sentiment is not null
        where r.place_id = any(%s)
        group by r.place_id
        """,
        (list(place_ids),),
    )
    return {r["place_id"]: {"reviews": r["reviews"], "written": r["written"]} for r in cur.fetchall()}


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
    consistency_window: str = Query("anytime", description="6m, 1y, 3y or anytime"),
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
        sub = _target_or_404(cur, sub_service_code)

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
        for level, code_key, name_key in _ladder(sub):
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
        counts = _review_counts(cur, [r["place_id"] for r in nearby])
        for r in nearby:
            c = counts.get(r["place_id"], {})
            r["reviews_total"] = c.get("reviews", 0)
            r["total_feedbacks"] = c.get("written", 0)
            r["audience"] = _AUDIENCE.get(r["place_id"])
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
    consistency_window: str = Query("anytime", description="6m, 1y, 3y or anytime"),
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
    cache_key = (sub_service_code, tuple(w or ()), cw, city, status)
    hit = _RANK_CACHE.get(cache_key)
    if hit and time.monotonic() - hit[0] < _RANK_CACHE_TTL:
        return hit[1]
    with cursor() as cur:
        sub = _target_or_404(cur, sub_service_code)

        level_used, shown, rows = "none", None, []
        for level, code_key, name_key in _ladder(sub):
            code, name = sub[code_key], sub[name_key]
            found = _rank_rows(cur, level, code, w, city, status, window=cw)
            shown, rows = {"code": code, "name": name}, found
            if any(r["rank_status"] == "ranked" for r in found):
                level_used = level
                break

        # A salon with no review about this service has nothing to show and no
        # score to attach, and the app never lists it. Dropping it before the
        # per-salon lookups below cuts about a third of the database work.
        rows = [r for r in rows if r["rank_status"] != "available but not ranked"
                or (r.get("evidence_reviews") or 0) >= 1]
        ids = [r["place_id"] for r in rows]

        def _on_own_cursor(fn, *args):
            with cursor() as c:
                return fn(c, *args)

        # Four independent read-only lookups. Each is a database round trip, so
        # running them side by side takes about as long as the slowest one
        # instead of the sum. The category scores are attached from this thread.
        with ThreadPoolExecutor(max_workers=3) as ex:
            f_staff = ex.submit(_on_own_cursor, staff_card_for, ids)
            f_pop = ex.submit(_on_own_cursor, popular_services_for, ids)
            f_counts = ex.submit(_on_own_cursor, _review_counts, ids)
            _attach_category_scores(cur, rows, level_used, shown, window=cw)
            staff_card, pop, counts = f_staff.result(), f_pop.result(), f_counts.result()
        for r in rows:
            c = counts.get(r["place_id"], {})
            r["reviews_total"] = c.get("reviews", 0)
            r["total_feedbacks"] = c.get("written", 0)
            r["audience"] = _AUDIENCE.get(r["place_id"])
            card = staff_card.get(r["place_id"], {})
            r["staff_dependent"] = card.get("staff_dependent", False)
            r["popular_services"] = pop.get(r["place_id"])
            r["named_staff"] = card.get("named_staff", {"count": 0, "top": []})

    result = {
        # The full sub-service row, which every client reads for its name and
        # tier. `requested` repeats the code and name for the fallback notice.
        "sub_service": sub,
        "requested": {"code": sub["code"], "name": sub["name"]},
        "requested_level": sub["level"],
        "level_used": level_used,
        "shown": shown,
        "weights": w or [1] * WEIGHTED_CATEGORIES,
        "city": city or None,
        "status": status,
        "ranked": [r for r in rows if r["rank_status"] == "ranked"],
        "available_but_not_ranked": [r for r in rows if r["rank_status"] == "available but not ranked"],
        "safety_concern": [r for r in rows if r["rank_status"] == "not ranked: safety concern"],
    }
    if len(_RANK_CACHE) >= _RANK_CACHE_MAX:
        _RANK_CACHE.clear()
    _RANK_CACHE[cache_key] = (time.monotonic(), result)
    return result


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
def provider(place_id: str, consistency_window: str = Query("anytime", description="6m, 1y, 3y or anytime")):
    """Details, safety, gates and vetoes, and a score per service with category scores.

    consistency_window now scopes every category and every score here, not
    just Category 9's old display: 06_run_scoring.py writes a separate row
    per duration window for everything. `specialism` is the one field still
    read from score.category9_window directly -- the old 9.2, now a
    display-only tag with no ranking weight (backend/api/service_specialism.py).
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
              and t.window_code = %s
            order by t.sub_service_code
            """,
            (place_id, cw),
        )
        services_ = cur.fetchall()

        # window_code scopes every category here now, not just Category 9 --
        # see 06_run_scoring.py section 4. Category 9 always comes back at
        # the neutral 0.5 (weight 0, nothing coded to it); the frontend does
        # not render a tile for it, the same as Categories 3 and 8. The
        # specialism figure (the old 9.2) is a separate, display-only field
        # below (`specialism_for`), not part of this category list.
        cur.execute(
            f"""
            select c.sub_service_code, c.category_no, f.name, c.score, c.evidence_count
            from score.category_score c
            join ref.framework_category f using (category_no)
            where c.place_id = %s and c.scoring_run_id = {_LATEST_RUN}
              and c.window_code = %s
            order by c.sub_service_code, c.category_no
            """,
            (place_id, cw),
        )
        by_service: dict[str, list] = {}
        for r in cur.fetchall():
            # evidence_count 0 = no data: the stored 0.5 is a placeholder
            # (29_no_data_dimensions.sql), so it is sent as null, not a score.
            # The ranking leaves such a category out, and the screen shows a dash.
            if not r["evidence_count"]:
                r["score"] = None
            by_service.setdefault(r.pop("sub_service_code"), []).append(r)

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
        # Display-only, from Category 9's 9.2: the one service this business is
        # most reviewed for, among the services it offers. Not part of any
        # score -- see 06_run_scoring.py's Category 9 block.
        specialism = specialism_for(cur, [place_id], cw)[place_id]
        languages = languages_for(cur, [place_id])[place_id]
        review_counts = _review_counts(cur, [place_id]).get(place_id, {"reviews": 0, "written": 0})

    for s in services_:
        s["category_scores"] = by_service.get(s["sub_service_code"], [])

    return {**details, "safety": safety, "gates_and_vetoes": gates, "services": services_,
            "evidence_services": evidence_services, "sentiment_totals": sentiment_totals,
            "staff_reputation": staff_reputation,
            "popular_services": popular_services, "specialism": specialism, "languages": languages,
            "review_counts": review_counts, "audience": _AUDIENCE.get(place_id)}


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


@app.get("/providers/{place_id}/overall")
def provider_overall(
    place_id: str,
    weights: str | None = Query(None, description="Seven comma-separated priorities, "
                                                  "category 1 to 7, as /rankings takes them."),
    consistency_window: str = Query("anytime", description="6m, 1y, 3y or anytime"),
):
    """The salon's overall score: every category plus the Overall Verdict, over
    all of the salon's feedbacks across all services, weighted by the visitor's
    priorities.

    Computed here from the extraction rows with the scorer's per-statement
    maths (see overall.py); read-only and display-only. It is not stored and
    does not enter the ranking, where category 8 is reported only. Category 3
    is not part of it (owner replies, reported-only).
    """
    w = _parse_weights(weights)
    cw = _window(consistency_window)
    with cursor() as cur:
        cur.execute("select max(published_at)::date as d from raw.review")
        ref = cur.fetchone()["d"]
        cur.execute(
            """
            select sp.category_no, e.confidence, e.polarity, e.severity,
                   r.published_at::date as published
            from extract.evidence_item e
            join ref.sub_point sp on sp.code = e.sub_point_code
            join raw.review r on r.review_id = e.review_id
            where e.place_id = %s
              and sp.category_no in (1, 2, 4, 5, 6, 7, 8)
              and e.polarity in ('positive', 'negative', 'mixed')
              and not coalesce(e.reviewer_fault, false)
              and not coalesce(e.needs_manual_check, false)
            """,
            (place_id,),
        )
        rows = cur.fetchall()
    if ref is None:
        return {"score": None, "statements": 0, "categories": [], "window": cw}
    out = overall_figure(rows, ref, weights=w, window=cw, today=datetime.date.today())
    out["window"] = cw
    return out


@app.get("/general-feedback")
def general_feedback(
    weights: str | None = Query(None, description="Seven comma-separated priorities, "
                                                  "category 1 to 7, as /rankings takes them."),
    city: str | None = Query(None, description="Optional city filter (case-insensitive)"),
    status: str = Query("any", pattern="^(open|closed|any)$"),
    consistency_window: str = Query("anytime", description="6m, 1y, 3y or anytime"),
):
    """Salons that have feedback about the quality categories but name no
    service, scored by the reader's own priorities.

    Rankings are built per service, so a salon whose statements carry no
    service or category tag has nowhere to attach and gets no row in
    score.trust_score: it is in no ranking at all. Its feedback is still real
    -- about the work, the staff, the price, the cleanliness -- so it is
    listed here instead, under a section of its own.

    The score is the profile's overall salon score (overall.py), not a ranking
    score: the same per-statement arithmetic over ALL of the salon's feedback,
    weighted by the reader's priorities, with a category nobody wrote about
    left out rather than counted as 0.5 (29_no_data_dimensions.sql). The
    Overall Verdict is left out, as in the ranking, so these scores are read on
    the same footing as the list above them. Display only: nothing here is
    stored or ranked, and it names no service, so it is never offered as a
    ranking for one.
    """
    w = _parse_weights(weights)
    cw = _window(consistency_window)
    city = (city or "").strip()
    with cursor() as cur:
        cur.execute("select max(published_at)::date as d from raw.review")
        ref = cur.fetchone()["d"]
        if ref is None:
            return {"count": 0, "salons": [], "window": cw}
        cur.execute(
            f"""
            select e.place_id, p.name as provider_name, p.city,
                   p.permanently_closed, p.temporarily_closed,
                   sp.category_no, e.confidence, e.polarity, e.severity,
                   r.published_at::date as published
            from extract.evidence_item e
            join ref.sub_point sp on sp.code = e.sub_point_code
            join raw.review r on r.review_id = e.review_id
            join raw.provider p on p.place_id = e.place_id
            where sp.category_no in (1, 2, 4, 5, 6, 7)
              and e.polarity in ('positive', 'negative', 'mixed')
              and not coalesce(e.reviewer_fault, false)
              and not coalesce(e.needs_manual_check, false)
              and not exists (
                    select 1 from score.trust_score t
                    where t.place_id = e.place_id
                      and t.scoring_run_id = {_LATEST_RUN}
                      and t.window_code = %s)
              and (%s = '' or lower(trim(p.city)) = lower(%s))
              and (%s = 'any'
                   or (%s = 'open'   and not (p.permanently_closed or p.temporarily_closed))
                   or (%s = 'closed' and (p.permanently_closed or p.temporarily_closed)))
            """,
            (cw, city, city, status, status, status),
        )
        by_place: dict[str, dict] = {}
        for r in cur.fetchall():
            by_place.setdefault(r["place_id"], {"meta": r, "rows": []})["rows"].append(r)

        today = datetime.date.today()
        scored = []
        for pid, g in by_place.items():
            out = overall_figure(g["rows"], ref, weights=w, window=cw, today=today)
            if out["score"] is None:
                continue
            scored.append((pid, g["meta"], out))
        counts = _review_counts(cur, [pid for pid, _, _ in scored])

    salons = []
    for pid, m, out in sorted(scored, key=lambda t: -t[2]["score"]):
        c = counts.get(pid, {})
        salons.append({
            "place_id": pid,
            "provider_name": m["provider_name"],
            "city": m["city"],
            "personal_score": out["score"],
            "rank_no": None,
            "rank_status": "available but not ranked",
            "evidence_reviews": 0,
            "badges": None,
            "permanently_closed": m["permanently_closed"],
            "temporarily_closed": m["temporarily_closed"],
            "reviews_total": c.get("reviews", 0),
            "total_feedbacks": c.get("written", 0),
            "audience": _AUDIENCE.get(pid),
            "statements": out["statements"],
            "category_scores": [
                {"category_no": cat["category_no"], "score": cat["score"],
                 "evidence_count": cat["statements"]}
                for cat in out["categories"] if cat["category_no"] != 8
            ],
        })
    return {"count": len(salons), "salons": salons, "window": cw}


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
    # Exactly this sub-service. About a quarter of the evidence carries one
    # (21_backfill_sub_service_code.py); the rest is filed at service level or
    # not at all, so this alone under-counts what is "about" a sub-service --
    # see `about_sub_service` below.
    sub_service_code: str | None = None,
    # Everything the feedbacks say about this sub-service: evidence filed to
    # it, plus evidence filed to its service with no more precise sub-service
    # named. That second group is why a sub-service with no tagged evidence of
    # its own can still have feedbacks about it, and it is exactly what the
    # "N feedbacks about this service" count on a profile is made of. Evidence
    # filed to a SIBLING sub-service is not included.
    about_sub_service: str | None = Query(None, pattern="^[A-Z0-9.]+$", max_length=24),
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
              and (%s::text is null
                   or e.sub_service_code = %s
                   or (e.sub_service_code is null
                       and e.service_code = (select d.service_code from ref.dim_service d
                                             where d.sub_service_code = %s)))
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
             about_sub_service or None, about_sub_service or None, about_sub_service or None,
             category_no, category_no,
             polarity, polarity, hide_mention, only_named, language, language,
             limit, offset),
        )
        rows = cur.fetchall()
    for r in rows:
        r["reviewer_name"] = _REVIEWER.get(r["review_id"])
    return rows


# ---------------------------------------------------------------------------
# Serve the built frontend (frontend/dist) from this same service, so the
# browser talks to one origin and no /api rewrite or cross-origin proxy is
# needed. Mounted last and at "/" so it never shadows an API route above:
# FastAPI tries routes in registration order first, and only falls through to
# this mount for a path none of them claimed. The frontend has no
# client-side router (no deep links), so a plain static mount is enough --
# no SPA catch-all fallback to index.html is needed for unmatched paths.
#
# The directory is three levels above this file (backend/api/main.py ->
# backend/api -> backend -> <project root>) plus frontend/dist, which is
# exactly how the Docker image (see Dockerfile) and a local frontend build
# both lay it out. Mounting is skipped (not a hard failure) when the
# directory does not exist, e.g. during local backend-only development
# before `npm run build` has been run.
_FRONTEND_DIST = pathlib.Path(__file__).resolve().parents[2] / "frontend" / "dist"
if _FRONTEND_DIST.is_dir():
    # index.html explicitly, with Cache-Control: no-cache, registered before
    # the mount below so it wins for the exact "/" path. StaticFiles leaves
    # no-store/no-cache headers off by default, and a browser's heuristic
    # cache can then keep serving an old shell -- one that still points at a
    # JS/CSS bundle from a previous deploy -- for a while after a fresh
    # release, which is exactly the "I still see the old version" reports
    # a few redeploys produced here. no-cache (not no-store) still lets the
    # browser revalidate with an ETag, so a repeat visit is cheap when
    # nothing changed. Hashed files under /assets/* are unaffected by this
    # and keep their default caching, which is safe: their filename changes
    # whenever their content does, so an old cached copy is simply never
    # requested again once index.html points at a new one.
    @app.get("/", include_in_schema=False)
    def _frontend_index():
        return FileResponse(_FRONTEND_DIST / "index.html", headers={"Cache-Control": "no-cache"})

    app.mount("/", StaticFiles(directory=str(_FRONTEND_DIST), html=True), name="frontend")
