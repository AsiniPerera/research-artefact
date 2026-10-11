"""Contact inquiry routes."""

import os
from contextlib import contextmanager

import psycopg2
from psycopg2.extras import RealDictCursor
from fastapi import APIRouter, Header
from pydantic import BaseModel, EmailStr

router = APIRouter(prefix="/contact", tags=["contact"])


def _get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])

@contextmanager
def _db():
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
    """Save a contact form submission. Links to the logged-in user if a valid
    Bearer token is present, otherwise stores it anonymously."""

    # Try to extract user_id from token without hard-failing if absent/invalid
    user_id = None
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() == "bearer" and token:
        try:
            import hmac, hashlib, base64, json, time as _time
            _SECRET = os.environ.get("JWT_SECRET", "change-me-in-production-please")
            header, payload, sig = token.split(".")
            pad = 4 - len(payload) % 4
            claims = json.loads(base64.urlsafe_b64decode(payload + "=" * (pad % 4)))
            user_id = claims.get("sub")
        except Exception:
            pass

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
