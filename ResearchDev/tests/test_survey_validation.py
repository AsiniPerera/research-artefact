"""Usability-survey submission validation (the chat survey at #/survey).

Covers the SurveyBody pydantic model that guards POST /survey/responses:
the Likert items must be 1-5 and the demographic fields must be one of the
fixed options. This is pure model validation, no database.

The SUS score itself is computed by the database (a generated column in
27_usability_survey.sql), so it is not re-implemented here; what Python owns
is rejecting a malformed submission before it ever reaches the table.
"""
import pytest
from pydantic import ValidationError

from survey import SurveyBody


def _valid(**over):
    base = dict(
        age_range="25–34",
        gender="Female",
        review_use="Sometimes (monthly)",
        **{f"q{i}": 4 for i in range(4, 19)},
        most_useful="Clear scores",
        most_confusing=None,
        other_comments="",
    )
    base.update(over)
    return base


def test_u01_a_complete_valid_submission_is_accepted():
    body = SurveyBody(**_valid())
    assert body.age_range == "25–34"
    assert body.q4 == 4


@pytest.mark.parametrize("bad", [0, 6, -1])
def test_u02_likert_outside_1_to_5_is_rejected(bad):
    with pytest.raises(ValidationError):
        SurveyBody(**_valid(q7=bad))


def test_u03_unknown_gender_is_rejected():
    with pytest.raises(ValidationError):
        SurveyBody(**_valid(gender="Other"))


def test_u04_unknown_age_range_is_rejected():
    # en dash is required; a hyphen is a different string and not an option
    with pytest.raises(ValidationError):
        SurveyBody(**_valid(age_range="25-34"))


def test_u05_open_feedback_is_optional():
    body = SurveyBody(**_valid(most_useful=None, most_confusing=None, other_comments=None))
    assert body.most_useful is None


def test_u06_missing_a_required_likert_item_is_rejected():
    data = _valid()
    del data["q10"]
    with pytest.raises(ValidationError):
        SurveyBody(**data)


# ── Task completion (28_usability_task_completion.sql) ──────────────────────
# The five scenario checkboxes are what Table 5.6's "completed all five tasks
# unaided" figure is read from, so what matters is that they survive the model
# unchanged and that null keeps its meaning: "not asked", never "failed".

def test_u07_task_flags_are_optional_and_default_to_unanswered():
    body = SurveyBody(**_valid())
    assert body.task1_completed is None
    assert body.task5_completed is None


def test_u08_task_flags_round_trip_as_booleans():
    body = SurveyBody(**_valid(
        task1_completed=True, task2_completed=True, task3_completed=False,
        task4_completed=True, task5_completed=False))
    assert [body.task1_completed, body.task2_completed, body.task3_completed,
            body.task4_completed, body.task5_completed] == [True, True, False, True, False]


def test_u09_every_task_column_reaches_the_insert():
    from survey import _COLS
    for i in range(1, 6):
        assert f"task{i}_completed" in _COLS
    # the INSERT pairs _COLS with one placeholder each, so a drift here would
    # silently shift every value by one column
    assert len(_COLS) == len(set(_COLS))


def test_u10_a_non_boolean_task_value_is_rejected():
    with pytest.raises(ValidationError):
        SurveyBody(**_valid(task3_completed="maybe"))


def test_u11_a_missing_task_column_names_the_migration_rather_than_500ing():
    """Until 28_ is applied the column does not exist. The participant should
    be told which file to run, not shown a server error."""
    import contextlib
    import psycopg2
    import survey as mod
    from fastapi import HTTPException

    @contextlib.contextmanager
    def _boom():
        raise psycopg2.errors.UndefinedColumn('column "task1_completed" does not exist')
        yield  # pragma: no cover

    original = mod._db
    mod._db = _boom
    try:
        with pytest.raises(HTTPException) as err:
            mod.submit_response(SurveyBody(**_valid()))
    finally:
        mod._db = original

    assert err.value.status_code == 503
    assert "28_usability_task_completion.sql" in err.value.detail
