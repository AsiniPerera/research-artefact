"""API input validation for the ranking endpoint (FastAPI).

Covers the evaluation plan's "API Validation" group. Weights are a
comma-separated query string of seven numbers in category order 1..7
(category 3 is reported-only and is forced to 0 server-side; categories 8 and
9 are handled automatically). All of these checks happen before any database
cursor is opened, so no database or mocking is needed.

Two layers are tested:
  * ``_parse_weights`` / ``_window`` directly — the pure validators.
  * the ``GET /rankings/{code}`` route via TestClient — that a bad request is
    rejected with 422 end to end, before the DB is touched.
"""
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

import main

client = TestClient(main.app)
RANK = "/rankings/HR.CUT.01"  # any code; validation fails before it is looked up


# ── _parse_weights (unit) ────────────────────────────────────────────────────
def test_f16_seven_valid_weights_parse_and_force_category3_to_zero():
    # category 3 (index 2) is reported-only: whatever is sent, it becomes 0
    assert main._parse_weights("1,2,4,8,2,1,2") == [1, 2, 0, 8, 2, 1, 2]


def test_f17_no_weights_returns_none_meaning_equal_default():
    assert main._parse_weights(None) is None
    assert main._parse_weights("") is None


def test_f18_non_numeric_weight_is_422():
    with pytest.raises(HTTPException) as e:
        main._parse_weights("1,2,four,8,2,1,2")
    assert e.value.status_code == 422


@pytest.mark.parametrize("weights", ["1,1,1,1,1,1", "1,1,1,1,1,1,1,1"])
def test_f19_wrong_count_is_422(weights):
    with pytest.raises(HTTPException) as e:
        main._parse_weights(weights)
    assert e.value.status_code == 422


def test_f20_negative_weight_is_422():
    with pytest.raises(HTTPException) as e:
        main._parse_weights("1,2,4,-8,2,1,2")
    assert e.value.status_code == 422


def test_f21_all_zero_weights_is_422():
    with pytest.raises(HTTPException) as e:
        main._parse_weights("0,0,0,0,0,0,0")
    assert e.value.status_code == 422


def test_f21b_only_category3_weighted_collapses_to_all_zero_and_is_422():
    # category 3 is forced to 0, so "weight only category 3" has no effect
    with pytest.raises(HTTPException) as e:
        main._parse_weights("0,0,5,0,0,0,0")
    assert e.value.status_code == 422


def test_f22_arbitrary_weight_value_is_accepted_not_restricted_to_powers():
    # the scale is relative; 3 is as valid as 1/2/4/8
    assert main._parse_weights("3,1,1,1,1,1,1") == [3, 1, 0, 1, 1, 1, 1]


# ── _window (unit) ───────────────────────────────────────────────────────────
@pytest.mark.parametrize("value", ["6m", "1y", "3y", "all"])
def test_f23_known_window_codes_pass_through(value):
    assert main._window(value) == value


def test_f24_anytime_is_normalised_to_all():
    assert main._window("anytime") == "all"


def test_f25_unknown_window_is_422():
    with pytest.raises(HTTPException) as e:
        main._window("last-week")
    assert e.value.status_code == 422


# ── route level (TestClient) — rejection happens before any DB cursor ────────
def test_f18_route_non_numeric_weight_returns_422():
    assert client.get(RANK, params={"weights": "1,2,four,8,2,1,2"}).status_code == 422


def test_f19_route_wrong_count_returns_422():
    assert client.get(RANK, params={"weights": "1,1,1,1,1"}).status_code == 422


def test_f21_route_all_zero_returns_422():
    assert client.get(RANK, params={"weights": "0,0,0,0,0,0,0"}).status_code == 422


def test_f25_route_bad_window_returns_422():
    assert client.get(RANK, params={"consistency_window": "yesterday"}).status_code == 422


def test_f26_route_bad_status_returns_422():
    # status is validated by FastAPI's own regex pattern on the query param
    assert client.get(RANK, params={"status": "maybe"}).status_code == 422
