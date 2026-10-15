"""Staff reputation: how a review is counted for the person it names.

The rule is review-level sentiment (extract.review_assessment), with the old
"worst statement anywhere in the review" kept only as a fallback. It used to
be the other way round, which counted five-star reviews of a stylist against
them whenever the extractor had tagged a stray negative statement elsewhere in
the same review (Salon Zero / Surith: six "negatives", all positive overall).

The queries need a database, so these tests guard the pieces that don't:
  * every query that produces an outcome uses the SAME shared rule, so the
    list, the staff-dependent flag, the ranking-card pass and the per-person
    drawer cannot disagree again;
  * the Python that shapes the rows.
"""
import staff

OUTCOME_QUERIES = ["_SQL", "_FLAG_SQL", "_REVIEWS_SQL", "_CARD_SQL"]


def test_st01_every_outcome_query_uses_the_review_level_rule():
    for name in OUTCOME_QUERIES:
        sql = getattr(staff, name)
        assert "overall_sentiment" in sql, f"{name} ignores review-level sentiment"
        assert "left join extract.review_assessment" in sql, f"{name} does not join it"


def test_st02_no_query_still_holds_an_unsubstituted_placeholder():
    for name in OUTCOME_QUERIES + ["_SUMMARY_SQL"]:
        assert "__REVIEW_OUTCOME__" not in getattr(staff, name), name


def test_st03_all_four_queries_embed_the_identical_rule_text():
    # one definition, substituted four times: if someone edits a query in place
    # instead of the shared constant, this fails
    for name in OUTCOME_QUERIES:
        assert staff._REVIEW_OUTCOME in getattr(staff, name), name


def test_st04_review_level_rule_wins_and_old_rule_is_only_the_fallback():
    rule = staff._REVIEW_OUTCOME
    assert rule.index("overall_sentiment") < rule.index("e.polarity")
    assert rule.strip().startswith("coalesce(")


def test_st05_neutral_and_mixed_reviews_share_the_middle_bucket():
    assert "when 'neutral'  then 1" in staff._REVIEW_OUTCOME
    assert "when 'mixed'    then 1" in staff._REVIEW_OUTCOME


def test_st06_outcome_words_for_the_drawer_are_unchanged():
    assert staff._OUTCOME == {0: "positive", 1: "mixed", 2: "negative"}


class _Cur:
    def __init__(self, rows):
        self._rows = rows
        self.executed = None

    def execute(self, sql, params):
        self.executed = (sql, params)

    def fetchall(self):
        return self._rows


def test_st07_staff_for_shapes_rows_and_rate():
    cur = _Cur([{"place_id": "P", "staff_name": "Surith", "reviews": 27,
                 "positive": 27, "mixed": 0, "negative": 0}])
    out = staff.staff_for(cur, ["P"])
    assert out["P"]["staff"] == [{
        "name": "Surith", "reviews": 27, "positive": 27, "mixed": 0,
        "negative": 0, "positive_rate": 1.0,
    }]
    assert cur.executed[1]["min"] == staff.STAFF_MIN_REVIEWS


def test_st08_a_business_with_no_named_staff_still_gets_an_empty_list():
    assert staff.staff_for(_Cur([]), ["P"]) == {"P": {"staff": []}}


def test_st09_staff_dependent_needs_two_people_and_a_real_gap():
    one = [{"positive": 9, "reviews": 10}]
    assert staff.staff_dependent_flag(one) is False
    wide = [{"positive": 10, "reviews": 10}, {"positive": 5, "reviews": 10}]   # gap 0.5
    assert staff.staff_dependent_flag(wide) is True
    narrow = [{"positive": 10, "reviews": 10}, {"positive": 9, "reviews": 10}]  # gap 0.1
    assert staff.staff_dependent_flag(narrow) is False
