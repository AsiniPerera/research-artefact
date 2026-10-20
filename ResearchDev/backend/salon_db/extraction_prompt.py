"""
LLM extraction prompt for the salon quality framework (v5) -- RO2.

WHAT THIS IS. The prompt and the output contract for the ABSA extraction step
described in docs/methodology.md ("LLM ABSA extraction -- free Gemini, temp 0,
resume"). This module holds the prompt only. It calls no model, opens no
network connection and writes nothing: importing it has no side effects, so it
can be reviewed, diffed and cited on its own.

WHY A MODULE AND NOT A TEXT FILE. Every list the prompt recites -- the 26
sub-points, the four polarities, the five seriousness tiers -- also exists as a
CHECK constraint in backend/salon_db/01_schema_and_reference_data.sql. Holding
them as Python constants lets validate_extraction() reject a reply the database
would reject anyway, before a row is ever written, and lets a test assert that
the prompt and the schema still agree.

WHAT IT PRODUCES. One JSON object per unit of text, shaped to the extract
tables:

    extract.evidence_item      one row per coded statement
    extract.review_assessment  one row per customer review
    extract.reply_assessment   one row per owner reply

TWO PROMPTS, NOT ONE. Framework rule A10 splits the work by source: sub-points
3.1 to 3.4 are read only from owner replies, and 3.5 and every other sub-point
only from customer reviews. Sending one text with the whole sub-point list
invites the model to code an owner's apology as 3.3 when it appears inside a
customer's review, which the framework calls 3.5. build_review_prompt() and
build_reply_prompt() therefore offer the model only the codes its source may
produce.

WHAT THE MODEL IS NOT ASKED FOR. Four fields are computed, never extracted:

    latency_days          owner_reply.published_at minus review.published_at
    3.1 (reply coverage)  is_computed = true in ref.sub_point; a ratio over
                          complaints, not a judgement about one reply
    overall_score         derived in scoring, not read from the text
    recency and weights   scoring (06_run_scoring.py), not extraction

Asking a model for a date subtraction it cannot verify is how a reproducible
figure becomes an invented one.

VERSIONS. FRAMEWORK_VERSION and TAXONOMY_VERSION are written to
extract.extraction_run so a set of rows can always be traced to the rules that
produced them. Raise them when the framework or the taxonomy changes.

USAGE SKETCH (the runner is a separate script; this module stays inert):

    from extraction_prompt import (
        SYSTEM_PROMPT_REVIEW, build_review_prompt,
        SYSTEM_PROMPT_REPLY,  build_reply_prompt,
        RESPONSE_SCHEMA_REVIEW, validate_extraction,
    )

    taxonomy = load_taxonomy_from_db()            # ref.service_category/service/sub_service
    prompt   = build_review_prompt(review, taxonomy)
    raw      = model.generate(SYSTEM_PROMPT_REVIEW, prompt, temperature=0)
    ok, errs = validate_extraction(json.loads(raw), kind="review")
"""

from __future__ import annotations

# --------------------------------------------------------------------------
# Versions, recorded on every extraction run
# --------------------------------------------------------------------------

FRAMEWORK_VERSION = "v5"
TAXONOMY_VERSION = "v9"

# Pinned for reproducibility; the thesis must name both.
MODEL_NAME = "gemini-1.5-flash"
TEMPERATURE = 0.0


# --------------------------------------------------------------------------
# Closed vocabularies. These mirror the CHECK constraints on
# extract.evidence_item / review_assessment / reply_assessment exactly.
# --------------------------------------------------------------------------

POLARITIES = ("positive", "negative", "mixed", "mention")
SEVERITIES = ("ineffective", "cosmetic", "needs correction", "irreversible", "damage")
TIME_SINCE_VISIT = ("same day", "later", "not stated")
CONFIDENCES = ("high", "medium", "low")
OVERALL_SENTIMENTS = ("positive", "negative", "neutral")
REPLY_SPECIFICITY = ("generic", "partly specific", "specific")
REPLY_STANCE = (
    "accepts / apologises",
    "disputes the report",
    "accepts and disputes (mixed)",
    "neither accepts nor disputes",
)

# Sub-points readable from a CUSTOMER REVIEW (framework rule A10).
# 3.1-3.4 are absent on purpose: they belong to owner replies.
REVIEW_SUB_POINTS = {
    "1.1": "Is the quality of the work good? (technical execution; overall verdict on a named service)",
    "1.2": "Does the result match what I asked for? (request-outcome match)",
    "1.3": "Does the result last? (longevity against expectation; early fading or chipping)",
    "2.1": "Do they assess my needs and relevant risks first? (consultation; patch or strand test)",
    "2.2": "Are they honest about what is possible? (feasibility, risk disclosure, honest refusal or referral)",
    "2.3": "Do they explain how to care for the result? (aftercare instruction)",
    "3.5": "If something goes wrong, do they put it right? (service recovery BY THIS BUSINESS, and who bore the cost)",
    "4.1": "Would customers recommend the business? (explicit recommendation, referral)",
    "4.2": "Do customers want to return? (return intent, self-declared repeat visits)",
    "5.1": "Are the staff friendly and respectful? (courtesy, respect, attentiveness)",
    "5.2": "Is the treatment comfortable and appropriately handled? (physical comfort during the service)",
    "5.3": "Do staff explain things clearly? (explanation during service; language accommodation)",
    "5.4": "Is my appointment handled professionally? (booking, punctuality, waiting, appointment handling)",
    "6.1": "Is it worth the money? (value judgement)",
    "6.2": "Will I pay the price I was quoted? (price differs from what was agreed; charged without asking)",
    "6.3": "Will they push me to buy extras? (upselling the customer could have refused)",
    "7.1": "Is the premises clean? (the room: floor, mirror, furniture, washroom)",
    "7.2": "Are tools and staff hygiene practices appropriate? (what touches the customer; sterilisation)",
    "7.3": "Are there reports of harm or unsafe practices? (the customer was left worse off)",
    "7.4": "Are products appropriate and in good condition? (the product itself is judged)",
    "7.5": "Are the facilities comfortable and suitable? (space, atmosphere, amenities)",
    "overall": "A generic verdict on the salon with no specific topic ('best salon', 'never going back')",
}

# Sub-points readable from an OWNER REPLY. 3.1 is computed, not extracted.
REPLY_SUB_POINTS = {
    "3.2": "Does the reply address the specific concern this reviewer raised? (a template reply is negative)",
    "3.3": "Does management take ownership of the concern? (responsibility stance, remedy offered)",
    "3.4": "Does management commit to an improvement for future customers? (corrective commitment)",
}

SAFETY_SUB_POINTS = ("7.1", "7.2", "7.3")


# --------------------------------------------------------------------------
# The coding manual. Lifted from salon_quality_framework_v5.md sections 4-5 so
# the model is given the same rules a human annotator is given for the gold set
# -- the F1 and kappa figures in the evaluation only mean something if both
# sides were told the same thing.
# --------------------------------------------------------------------------

_RULES_EVERY_SENTENCE = """\
A1  Code what the sentence is ABOUT, not the words in it. "Lasted 3.5 hours" is
    about waiting (5.4), not durability.
A2  A fault counts only if THIS business caused it. "Damaged at another salon"
    is not a fault here.
A3  The reason for the visit is not evidence. "I had hair fall, so I came for a
    treatment" gets no code.
A4  If the reviewer says it was their own fault, set reviewer_fault = true.
A5  The more specific sub-point wins. "Exactly the cut I asked for" is 1.2, not 1.1.
A6  Two codes only when the sentence says two things. "Friendly staff and a
    perfect cut" is 5.1 and 1.1.
A7  Not mentioned is never negative. No patch test mentioned means no code.
A8  Figures of speech are not evidence. "To add insult to injury"; "the prices
    burned a hole in my pocket".
A9  Advice, wishes and plans get no code. "Call before you go".
A10 From a CUSTOMER REVIEW never emit 3.1-3.4. A customer writing "the owner
    apologised and redid it" is 3.5.
A11 Attach each code to the service named in that sentence. If none is named and
    the review is about one service, attach it to that service. If the review
    covers several services or none, attach it to the business as a whole (leave
    all three service fields null).
A12 The star rating NEVER decides a code or its polarity.
A13 The same rules apply in Sinhala, Tamil and Singlish.
A14 Evidence counts only for the business whose listing the review is on.
    "Salon X ruined my hair, and this salon fixed it" is evidence for this
    business only."""

_CONFUSABLE_PAIRS = """\
1.1 / 1.2   Mentions what the customer asked for? Yes 1.2, no 1.1.
1.1 / 1.3   Judged at the visit, or after time passed? At the visit 1.1, later 1.3.
1.1 / 5.1   Describes the work or skill, or the person's manner? Work 1.1, manner 5.1.
1.1 / 4.1   Says "recommend" or mentions referring someone? Yes 4.1, no 1.1.
1.1 / 6.1   Mentions money, price or value? Yes 6.1, no 1.1.
1.3 / 7.3   Back where they started, or worse off than before? Started 1.3, worse 7.3.
            Both stated: both codes.
1.3 / 5.4   Is "lasted" about the result or the appointment? Result 1.3, appointment 5.4.
1.3 / 7.4   Is the product blamed directly ("old polish")? Yes 7.4 (plus 1.3 if it
            did not last). No: 1.3 only.
2.1 / 2.2   Found out about the hair or skin (look, test, ask) 2.1; told the
            customer what is possible or risky 2.2.
2.1 / 5.1   Assessed the hair or skin 2.1; simply listened 5.1.
2.2 / 5.3   Explanation about risk or what is achievable 2.2; otherwise 5.3.
2.3 / 5.3   About care at home after the visit? Yes 2.3, no 5.3.
2.2 / 6.3   Suggestion in the customer's interest 2.2; to sell more 6.3.
3.5 / 1.1   This business corrected its own mistake 3.5; corrected elsewhere
            1.1 negative.
3.5 / 5.1   General manner 5.1; how a mistake by the business was handled 3.5.
4.1 / 4.2   Recommending to others 4.1; returning themselves 4.2.
5.1 / 5.2   Attitude 5.1; physical comfort during treatment 5.2.
5.1 / 5.3   How they treated the customer 5.1; what they explained 5.3.
5.2 / 7.3   Pain ended with the service, or review does not say 5.2; left a mark,
            injury or reaction 7.3.
5.4 / 7.5   Is "crowded" about waiting 5.4, or lack of space 7.5?
6.1 / 6.2   A judgement of value 6.1; a price different from what was agreed 6.2.
6.2 / 6.3   Could the customer have refused the extra? Yes (even if they gave in)
            6.3; no, added or charged without asking 6.2.
7.1 / 7.2   Part of the room (floor, mirror, furniture, washroom) 7.1; used on the
            customer (tools, towels, capes, linen) or staff practice 7.2.
7.1 / 7.3   Dirty premises caused actual harm? 7.3, plus 7.1 if dirty premises are
            stated as the cause. Otherwise 7.1.
7.1 / 7.5   Cleanliness 7.1; atmosphere and comfort 7.5.
7.2 / 7.3   Was someone actually harmed? Yes 7.3, plus 7.2 if poor hygiene is
            stated as the cause. No: 7.2.
7.3 / 7.4   The product is judged 7.4; only its effect 7.3.

Deciding 1.3 against 7.3. Timing does not decide: 7.3 covers harm on the day or
later. If the reviewer does not blame the service for the worse condition, code
1.3. When unsure, ask whether doing the service again would solve it -- if yes
1.3, if the customer needs recovery 7.3.
  colour      faded, brassy -> 1.3   |  scalp burned, hair breaking -> 7.3
  rebonding   waves returned -> 1.3  |  hair falling out -> 7.3
  gel nails   chipped in 3 days -> 1.3 | natural nail thin or infected -> 7.3
  lashes      fell out in a week -> 1.3 | natural lashes pulled out -> 7.3
  waxing      hair grew back fast -> 1.3 | skin burned or torn -> 7.3
  facial      glow gone next day -> 1.3 | breakout, pigmentation, burn -> 7.3
"My hair felt dry again once the keratin wore off" is 1.3 (returned to its
earlier state). "My hair has been dry and rough ever since the colouring" is 7.3
at seriousness "cosmetic" (worse than before, and the service is blamed)."""

_POLARITY_RULES = """\
C1  Take polarity from the sentence, not the rest of the review. "Started
    peeling within a day" is negative even in a warm review.
C2  Negation flips it. "Not rushed", "no hidden charges" are positive.
C3  "But" and "however" split the sentence; code each side. "Good cut but very
    late" is 1.1 positive and 5.4 negative.
C4  A neutral fact is neither positive nor negative. "Air conditioned" is
    positive for 7.5 only when presented as a plus; otherwise polarity "mention".
C5  Praise given despite a problem is praise only. "Did not rush even though it
    was crowded" is 5.1 positive; the crowding gets no negative.
C6  Use "mixed" only when ONE sentence gives both views on the SAME sub-point.
    "Sometimes neat, sometimes careless".
C7  severity is recorded for negatives only, and "damage" only for physical harm."""

_TRAP_WORDS = """\
last / lasted / until the end  What lasted: the result 1.3, the visit 5.4, or a
                               date ("last Tuesday") no code?
original / fake / genuine      A product 7.4; a price or offer 6.2; a photo or
                               request 1.2; otherwise no code.
damage / damaged               This business 7.3; another business no code,
                               unless this business repaired it (1.1).
injury / burn / kill / die     Lasting injury 7.3; a feeling that ended with the
                               service ("it burned") 5.2; figure of speech no code.
lost hair / hair fall          A result of the service 7.3; the reason for the
                               visit no code.
professional / experienced     Describes the work 1.1; the person's manner 5.1.
calm / relaxing                The place 7.5; the staff 5.1; the treatment 5.2.
conditioning                   Air conditioning 7.5; a hair treatment -> the
                               service name, 1.1 only if a verdict is given.
clean                          The premises 7.1; a "clean cut" or "clean finish" 1.1.
maintained                     The business 7.1 or 7.5; the customer's hair or
                               skin usually 2.3.
crowded / busy                 A waiting problem 5.4; lack of space 7.5; stated
                               only as a fact, no code.
cut                            A haircut 1.1; a price reduction 6.1; a wound 7.3.
reaction                       A skin reaction 7.3; a staff response in a review
                               5.1; an owner's response in a reply 3.3.
free                           A free fix of a mistake 3.5; an offer as value 6.1;
                               an advertised free item not given 6.2;
                               "feel free", "hassle-free" no code."""

_FIELD_DEFINITIONS = """\
polarity    positive | negative | mixed | mention
            "mention" means the topic was raised without a judgement. It does
            not move the score, but it is still recorded.
severity    Negatives only; null otherwise. One of:
              ineffective       the service did nothing
              cosmetic          a visible flaw, no correction needed
              needs correction  must be redone to be acceptable
              irreversible      cannot be undone by redoing it
              damage            PHYSICAL HARM to the person. Counts double in
                                scoring, so use it only for harm to the body --
                                burns, breakage, infection, injury. A ruined
                                result is not "damage".
time_since_visit  same day | later | not stated. Say "not stated" unless the
                  review makes the timing clear.
confidence  high    the sentence states it plainly and one reading is possible
            medium  clear enough, but wording or translation leaves some doubt
            low     a guess from an oblique or very short sentence
            Scoring multiplies by 1.0 / 0.7 / 0.3, so an honest "low" costs
            little and a wrong "high" costs a lot. Prefer the lower grade.
reviewer_fault      true only when the reviewer says they caused it.
needs_manual_check  true when you had to guess, the text is ambiguous, or the
                    language defeated you. A flagged row is reviewed, not
                    discarded -- flagging is cheap, a wrong confident code is not.
evidence_text       the exact substring of the source text the code came from.
                    Quote it; never paraphrase. It is shown to users as the
                    supporting evidence for a score.
staff_name          a staff member's name when the sentence names one, else null.
service_category_code / service_code / sub_service_code
            The MOST SPECIFIC level the sentence names, and only that level.
            Naming a sub-service implies its parents, so fill the parents too.
            If the sentence names no service, leave all three null (rule A11)."""

_OUTPUT_CONTRACT_REVIEW = """\
Return ONE JSON object and nothing else. No markdown fence, no commentary.

{
  "review_assessment": {
    "overall_sentiment": "positive | negative | neutral",
    "star_text_mismatch": "<short note, or null>",
    "review_manipulation_flag": false
  },
  "evidence": [
    {
      "sub_point_code": "1.1",
      "polarity": "positive",
      "severity": null,
      "time_since_visit": "not stated",
      "confidence": "high",
      "reviewer_fault": false,
      "needs_manual_check": false,
      "evidence_text": "<exact quote from the review>",
      "service_category_code": "HR",
      "service_code": "HR.CUT",
      "sub_service_code": "HR.CUT.01",
      "staff_name": null
    }
  ]
}

overall_sentiment is the reviewer's overall feeling from the TEXT alone (A12).
star_text_mismatch: a short note when the stars and the text disagree
  ("5 stars but the text describes a burn"), else null.
review_manipulation_flag: true only on clear signs of a planted review --
  marketing copy, a competitor attack, contact details, copy-paste text.
  Suspicion is not a sign.
An empty "evidence" list is a valid and expected answer: many reviews
("Good", "ok") carry no codeable statement. Never invent one."""

_OUTPUT_CONTRACT_REPLY = """\
Return ONE JSON object and nothing else. No markdown fence, no commentary.

{
  "reply_assessment": {
    "specificity": "generic | partly specific | specific",
    "stance": "accepts / apologises | disputes the report | accepts and disputes (mixed) | neither accepts nor disputes",
    "remedy_offered": true,
    "commitment_made": false,
    "commitment_issue": null
  },
  "evidence": [
    {
      "sub_point_code": "3.2",
      "polarity": "positive",
      "severity": null,
      "time_since_visit": "not stated",
      "confidence": "high",
      "reviewer_fault": false,
      "needs_manual_check": false,
      "evidence_text": "<exact quote from the reply>",
      "service_category_code": null,
      "service_code": null,
      "sub_service_code": null,
      "staff_name": null
    }
  ]
}

specificity   generic         a template that would fit any review
              partly specific names the topic but not what this reviewer said
              specific        addresses what THIS reviewer actually said
stance        the owner's position on the complaint.
remedy_offered   does the reply offer this customer something (redo, refund,
                 "come back and we will fix it")?
commitment_made  does the reply promise a change for FUTURE customers
                 (retraining, a new procedure)? A remedy for one customer is
                 3.3, not 3.4.
commitment_issue a short tag for what the promise is about ("staff training",
                 "booking system"), else null.

Only 3.2, 3.3 and 3.4 may appear. Never 3.1 (computed elsewhere) and never 3.5
(read from customer reviews). A thank-you under a positive review is not a
reply to a complaint: return an empty "evidence" list and specificity "generic".
Do not report latency: it is computed from the two dates."""


def _shared_manual() -> str:
    return f"""\
FIELDS ON EVERY EVIDENCE ITEM
{_FIELD_DEFINITIONS}

RULES FOR EVERY SENTENCE
{_RULES_EVERY_SENTENCE}

DECIDING BETWEEN PAIRS THAT ARE EASILY CONFUSED
{_CONFUSABLE_PAIRS}

POLARITY
{_POLARITY_RULES}

TRAP WORDS -- read the sentence before coding
{_TRAP_WORDS}"""


SYSTEM_PROMPT_REVIEW = f"""\
You are an annotator applying a fixed coding framework (version {FRAMEWORK_VERSION})
to customer reviews of hair and beauty salons in Sri Lanka. Reviews may be in
English, Sinhala, Tamil or a mix of English and Sinhala written in Latin script
("Singlish"). Apply the same rules whatever the language, and quote evidence in
the language it was written in.

You are not writing an opinion. You are deciding which of a fixed list of
sub-points each sentence speaks to, and whether it speaks well or badly of the
business. Follow the rules below exactly. Where a rule and your intuition
disagree, the rule wins.

Code ONLY these sub-points:
{chr(10).join(f"  {code:8} {text}" for code, text in REVIEW_SUB_POINTS.items())}

{_shared_manual()}

WORKED EXAMPLES
  "They looked at my hair, said bleaching would break it, and explained each step"
      -> 2.1 positive, 2.2 positive, 5.3 positive   (examined; warned of a risk; explained)
  "She asked about my allergies and my last colour before starting"
      -> 2.1 positive
  "They added a Rs. 3,000 treatment without asking, totally not worth it"
      -> 6.2 negative, 6.1 negative
  "She kept pushing the hair spa until I said yes"
      -> 6.3 negative                               (the customer could have refused)
  "It burned during the waxing"
      -> 5.2 negative                               (nothing says a mark remained)
  "The wax burned my skin and left a mark"
      -> 7.3 negative, severity "damage"
  "Dirty towel, and the floor was full of hair"
      -> 7.2 negative, 7.1 negative                 (towel on the customer; floor is the room)
  "The colour went wrong but they redid it free the next day"
      -> 1.1 negative, 3.5 positive
  "The gel lifted in three days and peeled a layer off my nail"
      -> 1.3 negative, 7.3 negative                 (both are stated)
  "Best salon in Piliyandala"
      -> overall positive                           (a verdict with no topic)
  "I had hair fall, so I came for a treatment"
      -> no codes                                   (the reason for the visit, A3)

OUTPUT
{_OUTPUT_CONTRACT_REVIEW}"""


SYSTEM_PROMPT_REPLY = f"""\
You are an annotator applying a fixed coding framework (version {FRAMEWORK_VERSION})
to OWNER REPLIES left beneath customer reviews of hair and beauty salons in Sri
Lanka. Replies may be in English, Sinhala, Tamil or Singlish.

You are judging the reply, not the review. The review is given only so you can
decide whether the reply answers what that reviewer actually said.

Code ONLY these sub-points:
{chr(10).join(f"  {code:8} {text}" for code, text in REPLY_SUB_POINTS.items())}

{_shared_manual()}

WORKED EXAMPLES
  review:  "My colour turned orange and they would not fix it"
  reply:   "Thank you for your feedback. We value all our customers."
      -> specificity "generic", stance "neither accepts nor disputes",
         3.2 negative                               (a template; answers nothing)

  review:  "The stylist cut it far shorter than I asked"
  reply:   "We are sorry about the length. Please come in this week and
            Nishi will correct it free of charge."
      -> specificity "specific", stance "accepts / apologises",
         remedy_offered true, 3.2 positive, 3.3 positive

  review:  "Waited over an hour past my appointment"
  reply:   "You arrived late, which is why you waited."
      -> specificity "specific", stance "disputes the report",
         3.2 positive, 3.3 negative                 (addressed, but no ownership)

  review:  "Three of us waited over an hour"
  reply:   "We are sorry. We have changed how we space appointments so this
            does not happen again."
      -> commitment_made true, commitment_issue "booking system",
         3.3 positive, 3.4 positive

OUTPUT
{_OUTPUT_CONTRACT_REPLY}"""


# --------------------------------------------------------------------------
# User-message builders
# --------------------------------------------------------------------------

def _taxonomy_block(taxonomy: dict) -> str:
    """Render the service codes the model may choose from.

    `taxonomy` comes from ref.service_category / ref.service / ref.sub_service
    so the prompt can never drift from the database:

        {"categories":   [("HR", "Hair"), ...],
         "services":     [("HR.CUT", "HR", "Haircuts"), ...],
         "sub_services": [("HR.CUT.01", "HR.CUT", "Haircut & Trim"), ...]}
    """
    lines = ["CATEGORY CODES"]
    lines += [f"  {code:4} {name}" for code, name in taxonomy["categories"]]
    lines.append("")
    lines.append("SERVICE CODES  (code | parent category | name)")
    lines += [f"  {code:10} {parent:4} {name}" for code, parent, name in taxonomy["services"]]
    lines.append("")
    lines.append("SUB-SERVICE CODES  (code | parent service | name)")
    lines += [f"  {code:12} {parent:10} {name}" for code, parent, name in taxonomy["sub_services"]]
    return "\n".join(lines)


def build_review_prompt(review: dict, taxonomy: dict) -> str:
    """User message for one customer review.

    `review` needs: review_id, text. stars, published_at and salon_name are
    included when present -- stars only so the model can report a mismatch in
    star_text_mismatch; rule A12 forbids it from influencing any code.
    """
    stars = review.get("stars")
    published = review.get("published_at")
    salon = review.get("salon_name")
    header = [f"review_id: {review['review_id']}"]
    if salon:
        header.append(f"salon: {salon}")
    if stars is not None:
        header.append(f"stars: {stars}   (for star_text_mismatch only -- never let it decide a code)")
    if published:
        header.append(f"published: {published}")

    return f"""\
{_taxonomy_block(taxonomy)}

------------------------------------------------------------------
{chr(10).join(header)}

REVIEW TEXT
\"\"\"
{review.get('text') or ''}
\"\"\"
------------------------------------------------------------------

Code this review now. Return only the JSON object."""


def build_reply_prompt(review: dict, reply: dict) -> str:
    """User message for one owner reply.

    The review text is context for judging specificity, not something to code.
    No taxonomy block: replies are coded against the business, not a service.
    """
    return f"""\
------------------------------------------------------------------
review_id: {review['review_id']}

THE CUSTOMER WROTE  (context only -- do not code this text)
\"\"\"
{review.get('text') or ''}
\"\"\"

THE OWNER REPLIED  (code this)
\"\"\"
{reply.get('owner_reply_text') or ''}
\"\"\"
------------------------------------------------------------------

Judge this reply now. Return only the JSON object."""


# --------------------------------------------------------------------------
# Structured-output schemas, for models that accept one
# --------------------------------------------------------------------------

_EVIDENCE_ITEM_SCHEMA = {
    "type": "object",
    "properties": {
        "sub_point_code": {"type": "string"},
        "polarity": {"type": "string", "enum": list(POLARITIES)},
        "severity": {"type": ["string", "null"], "enum": list(SEVERITIES) + [None]},
        "time_since_visit": {"type": "string", "enum": list(TIME_SINCE_VISIT)},
        "confidence": {"type": "string", "enum": list(CONFIDENCES)},
        "reviewer_fault": {"type": "boolean"},
        "needs_manual_check": {"type": "boolean"},
        "evidence_text": {"type": "string"},
        "service_category_code": {"type": ["string", "null"]},
        "service_code": {"type": ["string", "null"]},
        "sub_service_code": {"type": ["string", "null"]},
        "staff_name": {"type": ["string", "null"]},
    },
    "required": [
        "sub_point_code", "polarity", "time_since_visit", "confidence",
        "reviewer_fault", "needs_manual_check", "evidence_text",
    ],
}

RESPONSE_SCHEMA_REVIEW = {
    "type": "object",
    "properties": {
        "review_assessment": {
            "type": "object",
            "properties": {
                "overall_sentiment": {"type": "string", "enum": list(OVERALL_SENTIMENTS)},
                "star_text_mismatch": {"type": ["string", "null"]},
                "review_manipulation_flag": {"type": "boolean"},
            },
            "required": ["overall_sentiment", "review_manipulation_flag"],
        },
        "evidence": {"type": "array", "items": _EVIDENCE_ITEM_SCHEMA},
    },
    "required": ["review_assessment", "evidence"],
}

RESPONSE_SCHEMA_REPLY = {
    "type": "object",
    "properties": {
        "reply_assessment": {
            "type": "object",
            "properties": {
                "specificity": {"type": ["string", "null"], "enum": list(REPLY_SPECIFICITY) + [None]},
                "stance": {"type": ["string", "null"], "enum": list(REPLY_STANCE) + [None]},
                "remedy_offered": {"type": ["boolean", "null"]},
                "commitment_made": {"type": ["boolean", "null"]},
                "commitment_issue": {"type": ["string", "null"]},
            },
        },
        "evidence": {"type": "array", "items": _EVIDENCE_ITEM_SCHEMA},
    },
    "required": ["reply_assessment", "evidence"],
}


# --------------------------------------------------------------------------
# Validation
# --------------------------------------------------------------------------

def validate_extraction(obj, kind="review", taxonomy=None):
    """Check one parsed reply against the framework and the DB constraints.

    Returns (ok, errors). Every rule here is one the database would enforce on
    insert, or one the framework states; failing early keeps a malformed reply
    out of extract.* instead of aborting a long run on a constraint violation.

    `taxonomy` is optional. When given as the dict build_review_prompt() takes,
    service codes are checked against it as well.
    """
    errors = []

    def bad(msg):
        errors.append(msg)

    if not isinstance(obj, dict):
        return False, ["top level is not a JSON object"]

    allowed = REVIEW_SUB_POINTS if kind == "review" else REPLY_SUB_POINTS

    if kind == "review":
        ra = obj.get("review_assessment")
        if not isinstance(ra, dict):
            bad("review_assessment missing")
        else:
            if ra.get("overall_sentiment") not in OVERALL_SENTIMENTS:
                bad(f"overall_sentiment {ra.get('overall_sentiment')!r} not allowed")
            if not isinstance(ra.get("review_manipulation_flag"), bool):
                bad("review_manipulation_flag must be a boolean")
    else:
        pa = obj.get("reply_assessment")
        if not isinstance(pa, dict):
            bad("reply_assessment missing")
        else:
            if pa.get("specificity") is not None and pa["specificity"] not in REPLY_SPECIFICITY:
                bad(f"specificity {pa.get('specificity')!r} not allowed")
            if pa.get("stance") is not None and pa["stance"] not in REPLY_STANCE:
                bad(f"stance {pa.get('stance')!r} not allowed")
            if "latency_days" in pa:
                bad("latency_days must not be extracted; it is computed from the two dates")

    items = obj.get("evidence")
    if not isinstance(items, list):
        return False, errors + ["evidence must be a list (an empty list is valid)"]

    cats = {c for c, _ in (taxonomy or {}).get("categories", [])} or None
    svcs = {c for c, _, _ in (taxonomy or {}).get("services", [])} or None
    subs = {c for c, _, _ in (taxonomy or {}).get("sub_services", [])} or None

    for i, it in enumerate(items):
        at = f"evidence[{i}]"
        if not isinstance(it, dict):
            bad(f"{at} is not an object")
            continue

        code = it.get("sub_point_code")
        if code not in allowed:
            bad(f"{at} sub_point_code {code!r} is not codeable from a {kind}")

        if it.get("polarity") not in POLARITIES:
            bad(f"{at} polarity {it.get('polarity')!r} not allowed")
        if it.get("time_since_visit") not in TIME_SINCE_VISIT:
            bad(f"{at} time_since_visit {it.get('time_since_visit')!r} not allowed")
        if it.get("confidence") not in CONFIDENCES:
            bad(f"{at} confidence {it.get('confidence')!r} not allowed")

        sev = it.get("severity")
        if sev is not None and sev not in SEVERITIES:
            bad(f"{at} severity {sev!r} not allowed")
        # Framework rule C7.
        if sev is not None and it.get("polarity") != "negative":
            bad(f"{at} severity is recorded for negatives only (rule C7)")

        for field in ("reviewer_fault", "needs_manual_check"):
            if not isinstance(it.get(field), bool):
                bad(f"{at} {field} must be a boolean")

        if not (it.get("evidence_text") or "").strip():
            bad(f"{at} evidence_text is empty; it must quote the source")

        # Naming a child implies its parents (rule A11).
        cat, svc, sub = (it.get("service_category_code"), it.get("service_code"),
                         it.get("sub_service_code"))
        if sub and not svc:
            bad(f"{at} sub_service_code without its service_code")
        if svc and not cat:
            bad(f"{at} service_code without its service_category_code")
        if svc and cat and not svc.startswith(cat + "."):
            bad(f"{at} service_code {svc!r} is not under category {cat!r}")
        if sub and svc and not sub.startswith(svc + "."):
            bad(f"{at} sub_service_code {sub!r} is not under service {svc!r}")
        if cats is not None and cat and cat not in cats:
            bad(f"{at} unknown service_category_code {cat!r}")
        if svcs is not None and svc and svc not in svcs:
            bad(f"{at} unknown service_code {svc!r}")
        if subs is not None and sub and sub not in subs:
            bad(f"{at} unknown sub_service_code {sub!r}")

    return (not errors), errors


__all__ = [
    "FRAMEWORK_VERSION", "TAXONOMY_VERSION", "MODEL_NAME", "TEMPERATURE",
    "POLARITIES", "SEVERITIES", "TIME_SINCE_VISIT", "CONFIDENCES",
    "OVERALL_SENTIMENTS", "REPLY_SPECIFICITY", "REPLY_STANCE",
    "REVIEW_SUB_POINTS", "REPLY_SUB_POINTS", "SAFETY_SUB_POINTS",
    "SYSTEM_PROMPT_REVIEW", "SYSTEM_PROMPT_REPLY",
    "build_review_prompt", "build_reply_prompt",
    "RESPONSE_SCHEMA_REVIEW", "RESPONSE_SCHEMA_REPLY",
    "validate_extraction",
]
