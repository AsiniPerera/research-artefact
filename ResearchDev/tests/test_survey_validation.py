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
