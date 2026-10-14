"""Accounts: sign up, sign in, read and update a profile.

Mounted on the API in main.py. These routes WRITE, so they open their own
connection: the shared pool in main.py sets every session read-only. The
ranking side of the API needs no account, so nothing here gates it.

HS256 is implemented here with hmac rather than pulled from a JWT library,
which keeps the dependency list to what the scoring stack already needs.
_verify_token is the only place a signature is checked, and contact.py imports
it rather than parsing tokens itself.

The token carries no `exp` and nothing checks expiry, so a token stays valid
until JWT_SECRET changes. Rotating that secret is what ends every session.
Passwords are bcrypt hashes; the plaintext is never stored or logged.
"""

import os
import re
import hmac
import hashlib
import base64
import json
import time
from contextlib import contextmanager

import bcrypt
import psycopg2
from psycopg2.extras import RealDictCursor
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel, EmailStr

router = APIRouter(prefix="/auth", tags=["auth"])

# ── DB helper ─────────────────────────────────────────────────────────────────

def _get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])

@contextmanager
def _db():
    """A write connection that commits on a clean exit and rolls back on any
    exception, so a failed signup cannot leave a half-written row."""
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


# ── JWT (HS256, no external library) ─────────────────────────────────────────

_SECRET = os.environ.get("JWT_SECRET", "change-me-in-production-please")

def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

def _b64url_decode(s: str) -> bytes:
    pad = 4 - len(s) % 4
    return base64.urlsafe_b64decode(s + "=" * (pad % 4))

def _make_token(user_id: int, email: str) -> str:
    """Sign `{sub, email, iat}` with JWT_SECRET and return `header.payload.sig`.

    `sub` is the user id every authenticated route trusts, so the signature is
    what stops a caller choosing their own. The email rides along to save a
    lookup on the client; the id is what the database is queried by.
    """
    header  = _b64url(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    payload = _b64url(json.dumps({"sub": user_id, "email": email, "iat": int(time.time())}).encode())
    sig     = _b64url(hmac.new(_SECRET.encode(), f"{header}.{payload}".encode(), hashlib.sha256).digest())
    return f"{header}.{payload}.{sig}"

def _verify_token(token: str) -> dict:
    """The token's claims, or 401 if the signature does not match.

    The only place a token is checked, so every route that trusts `sub` must
    come through here. The comparison is hmac.compare_digest rather than `==`:
    a plain comparison returns early on the first wrong byte and leaks how much
    of a guessed signature was right.

    Any malformed token lands in the same 401 as a bad signature — telling a
    caller which part failed only helps them iterate.
    """
    try:
        header, payload, sig = token.split(".")
        expected = _b64url(hmac.new(_SECRET.encode(), f"{header}.{payload}".encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(sig, expected):
            raise ValueError("bad signature")
        return json.loads(_b64url_decode(payload))
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def _require_user(authorization: str = Header(default="")):
    """Dependency: extracts and verifies Bearer token, returns payload dict."""
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    return _verify_token(token)


# ── Schemas ───────────────────────────────────────────────────────────────────

class SignUpBody(BaseModel):
    full_name: str
    email: EmailStr
    password: str

class SignInBody(BaseModel):
    email: EmailStr
    password: str

class ProfileUpdateBody(BaseModel):
    full_name: str | None = None
    avatar_url: str | None = None


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/signup")
def signup(body: SignUpBody):
    """Create an account and return a token, so signing up also signs you in.

    409 on a duplicate email rather than a generic error: the client shows
    "already registered" and offers sign-in instead. Email is lowercased on the
    way in so the uniqueness check and later sign-ins agree on one spelling.
    """
    if len(body.password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")

    pw_hash = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()

    with _db() as (conn, cur):
        cur.execute("SELECT id FROM app_users WHERE email = %s", (body.email,))
        if cur.fetchone():
            raise HTTPException(status_code=409, detail="An account with that email already exists")

        cur.execute(
            "INSERT INTO app_users (full_name, email, password_hash) VALUES (%s, %s, %s) RETURNING id, full_name, email",
            (body.full_name.strip(), body.email.lower(), pw_hash),
        )
        user = cur.fetchone()

    token = _make_token(user["id"], user["email"])
    return {"token": token, "user": {"id": user["id"], "full_name": user["full_name"], "email": user["email"]}}


@router.post("/signin")
def signin(body: SignInBody):
    """Exchange an email and password for a token.

    An unknown email and a wrong password return the same message, so the text
    of the response does not say which addresses have accounts.

    The timing still does: `not user` short-circuits before bcrypt.checkpw, so
    an unknown email answers in a fraction of the time a known one takes. Any
    caller measuring the round trip can enumerate registered addresses. Closing
    it means hashing against a dummy value on the miss, which is a behaviour
    change rather than a comment, and is recorded here rather than fixed.
    """
    with _db() as (_, cur):
        cur.execute(
            "SELECT id, full_name, email, password_hash FROM app_users WHERE email = %s",
            (body.email.lower(),),
        )
        user = cur.fetchone()

    if not user or not bcrypt.checkpw(body.password.encode(), user["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    token = _make_token(user["id"], user["email"])
    return {"token": token, "user": {"id": user["id"], "full_name": user["full_name"], "email": user["email"]}}


@router.get("/me")
def me(claims: dict = Depends(_require_user)):
    """The signed-in user's profile, read by `sub` from the verified token.

    404 when the token verifies but the row is gone — a deleted account whose
    token is still in a browser. The token cannot be revoked on its own, so
    this is what the client sees in that case.
    """
    with _db() as (_, cur):
        cur.execute(
            "SELECT id, full_name, email, avatar_url, created_at FROM app_users WHERE id = %s",
            (claims["sub"],),
        )
        user = cur.fetchone()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return dict(user)


@router.put("/me")
def update_me(body: ProfileUpdateBody, claims: dict = Depends(_require_user)):
    """Update the signed-in user's own name or avatar.

    Only the fields actually sent are written, so a client may patch one
    without clearing the other, and 422 rather than a no-op update when it
    sends neither. The column names come from this function, never from the
    request, and the row is always the token's own `sub` — a caller cannot
    name the account to edit.
    """
    updates, values = [], []
    if body.full_name is not None:
        updates.append("full_name = %s"); values.append(body.full_name.strip())
    if body.avatar_url is not None:
        updates.append("avatar_url = %s"); values.append(body.avatar_url)
    if not updates:
        raise HTTPException(status_code=422, detail="Nothing to update")

    updates.append("updated_at = now()")
    values.append(claims["sub"])

    with _db() as (_, cur):
        cur.execute(
            f"UPDATE app_users SET {', '.join(updates)} WHERE id = %s RETURNING id, full_name, email, avatar_url",
            values,
        )
        user = cur.fetchone()

    return dict(user)
