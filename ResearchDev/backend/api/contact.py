"""Contact form submissions.

Mounted on the API in main.py alongside the auth router. This is the only
route in the service that WRITES, so it opens its own connection: the shared
pool in main.py sets every session read-only.
"""

import os
from contextlib import contextmanager

import psycopg2
from psycopg2.extras import RealDictCursor
from fastapi import APIRouter, Header
from pydantic import BaseModel, EmailStr

from auth import _verify_token

router = APIRouter(prefix="/contact", tags=["contact"])


def _get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])

@contextmanager
def _db():
    """A write connection that commits on a clean exit and rolls back on any
    exception, so a failed insert leaves no partial row."""
    conn = _get_conn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            yield conn, cur
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


class ContactBody(BaseModel):
    name: str
    email: EmailStr
    phone: str | None = None
    reason: str
    message: str | None = None


@router.post("/inquiries")
def submit_inquiry(body: ContactBody, authorization: str = Header(default="")):
    """Save a contact form submission, attributed to the signed-in user if there
    is one.

    Signing in is optional here, so no token means an anonymous inquiry. A token
    that IS present must carry a valid signature: `sub` decides which account the
    inquiry is filed against, so an unverified claim would let any caller
    attribute an inquiry to someone else. A bad token is rejected rather than
    quietly downgraded to anonymous, which would hide a forged one.
    """
    user_id = None
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() == "bearer" and token:
        # auth._verify_token checks the HMAC with compare_digest and raises 401.
        # Imported rather than reimplemented: the copy that lived here decoded
        # the payload without ever checking the signature.
        claims = _verify_token(token)
        user_id = claims.get("sub")

    with _db() as (_, cur):
        cur.execute(
            """INSERT INTO contact_inquiries (name, email, phone, reason, message, user_id)
               VALUES (%s, %s, %s, %s, %s, %s)
               RETURNING id, created_at""",
            (body.name.strip(), body.email.lower(), body.phone or None,
             body.reason, body.message or None, user_id),
        )
        row = cur.fetchone()

    return {"ok": True, "id": row["id"]}
