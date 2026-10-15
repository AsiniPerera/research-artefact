"""Shared test setup.

Puts the backend packages on the import path so the suite can import the real
code under test:
  * ``backend``        -> scoring_core
  * ``backend/api``    -> main (FastAPI app), survey (pydantic models)

Nothing here opens a database connection. The API's pool is built lazily on
the first ``cursor()`` call, so importing ``main`` is free; the validation
tests never reach a cursor, and anything that would is mocked in its own test.
"""
import os
import sys

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for _p in (os.path.join(_ROOT, "backend"), os.path.join(_ROOT, "backend", "api")):
    if _p not in sys.path:
        sys.path.insert(0, _p)

# A dummy URL so any accidental pool build fails loudly as a connection error
# rather than a confusing "DATABASE_URL not set". No test should reach it.
os.environ.setdefault("DATABASE_URL", "postgresql://unused:unused@127.0.0.1:1/unused")
