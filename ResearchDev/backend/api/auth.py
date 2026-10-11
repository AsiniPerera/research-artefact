"""Auth routes: sign-up, sign-in, sign-out, profile get/update.

JWT is stored client-side (localStorage). Tokens never expire by default;
add exp to the payload and check it in _require_user if you want sessions
to time out.
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
    header  = _b64url(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    payload = _b64url(json.dumps({"sub": user_id, "email": email, "iat": int(time.time())}).encode())
    sig     = _b64url(hmac.new(_SECRET.encode(), f"{header}.{payload}".encode(), hashlib.sha256).digest())
    return f"{header}.{payload}.{sig}"

def _verify_token(token: str) -> dict:
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
