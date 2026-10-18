"""Usability evaluation responses (the chat survey at #/survey).

A write route, so like contact.py it opens its own connection: the shared
pool in main.py is read-only. Anonymous: the request carries no user id and
none is stored. The table and its SUS calculation are in
backend/salon_db/27_usability_survey.sql; the five task-completion columns
are added by backend/salon_db/28_usability_task_completion.sql.
"""

from typing import Literal

import psycopg2
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from contact import _db

router = APIRouter(prefix="/survey", tags=["survey"])

Likert = Field(ge=1, le=5)
Text = Field(default=None, max_length=2000)

# Whether the participant finished each scenario unaided. Optional so a client
# that predates 28_ still submits cleanly, and so the stored null keeps its
# meaning: "not asked", never "failed".
Task = Field(default=None)


class SurveyBody(BaseModel):
    age_range: Literal["18–24", "25–34", "35–44", "45+"]
    gender: Literal["Male", "Female", "Prefer not to say"]
    review_use: Literal["Never", "Rarely (a few times a year)", "Sometimes (monthly)", "Often (weekly or more)"]
    task1_completed: bool | None = Task
    task2_completed: bool | None = Task
    task3_completed: bool | None = Task
    task4_completed: bool | None = Task
    task5_completed: bool | None = Task
    q4: int = Likert
    q5: int = Likert
    q6: int = Likert
    q7: int = Likert
    q8: int = Likert
    q9: int = Likert
    q10: int = Likert
    q11: int = Likert
    q12: int = Likert
    q13: int = Likert
    q14: int = Likert
    q15: int = Likert
    q16: int = Likert
    q17: int = Likert
    q18: int = Likert
    most_useful: str | None = Text
    most_confusing: str | None = Text
    other_comments: str | None = Text


_COLS = list(SurveyBody.model_fields)


@router.post("/responses")
def submit_response(body: SurveyBody):
    """Save one completed survey and return its id and computed SUS score."""
    data = body.model_dump()
    for k in ("most_useful", "most_confusing", "other_comments"):
        data[k] = (data[k] or "").strip() or None
    try:
        with _db() as (_, cur):
            cur.execute(
                f"INSERT INTO public.usability_responses ({', '.join(_COLS)}) "
                f"VALUES ({', '.join(['%s'] * len(_COLS))}) RETURNING id, sus_score",
                [data[c] for c in _COLS],
            )
            row = cur.fetchone()
    except psycopg2.errors.UndefinedColumn as exc:
        # The same shape of message 06_run_scoring.py uses for a missing step:
        # name the migration rather than let a 500 reach the participant.
        raise HTTPException(
            503,
            "The survey table is missing a column this response needs. Run "
            "backend/salon_db/28_usability_task_completion.sql in the Supabase "
            f"SQL Editor, then submit again. ({str(exc).splitlines()[0]})",
        ) from exc
    return {"ok": True, "id": row["id"], "sus_score": float(row["sus_score"])}
