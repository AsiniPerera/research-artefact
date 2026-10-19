# Thesis Claims Check — Sections 4.6.2 to 4.9

**Checked:** 20 October 2026, against the source files and the live database (run 12, read-only).

**Result:** 48 claims checked. **23 done** · **14 partly** · **8 not as written** · **3 cannot verify**.

Key: DONE = the code and data do what the text says. PARTLY = true, but incomplete or with a gap. NOT AS WRITTEN = the text says something the code or data contradict. CANNOT VERIFY = no evidence in the repository either way.

## Note A — the extraction method (read this first)

Section 4.6.2 and Table 4.12 say extraction used Gemini through its API. The database records something different:

| Run | Method | Model field | Note in the database |
|---|---|---|---|
| 1 | rule_based | keyword patterns + VADER lexicon | spot-check precision about 85% on 60 rows; recall not measured |
| 2 | manual | read and labelled directly by Claude in chat | the 157 Sinhala / Singlish / mixed / Tamil reviews |
| 3 | rule_based | keyword auto-coding; 150 rows labelled by Claude | auto-coded rows not yet re-read; pending full recode |
| 4 | rule_based | None | auto-coded by Python keyword engine |

All 44,594 evidence rows carry run 4. No run is recorded as Gemini.

An examiner who opens the database sees this. Two honest ways forward: (1) if Gemini really was used, supply the scripts, logs and API-usage records and load them into the repository; (2) otherwise rewrite 4.6.2, Table 4.12 and 4.9.2 to describe the rule-based engine, the manual labelling and the checks actually done. Labelling by Claude in chat is AI assistance, so it also belongs in your AI-use declaration.

## Claim-by-claim table

| # | Section | Claim in the thesis | Verdict | Evidence | Fix |
|---|---|---|---|---|---|
| 1 | 4.6.2 | Extraction uses Google's Gemini model through its API | **NOT AS WRITTEN** | All 44,594 evidence rows belong to run 4: method `rule_based`, model `None`, note "Auto-coded by Python keyword engine". Runs 1-3 are keyword patterns + VADER and "read and labelled directly by Claude in chat". No Gemini run is recorded. The only Gemini code is `archive/pipeline/s3_extract.py`, declared unused. | Describe what the database records, or produce the Gemini scripts, logs and API-usage records that show it ran. See note A. |
| 2 | 4.6.2 | Four tasks performed: aspect sentiment, structured extraction, implicit sentiment, statement-level sentiment | **NOT AS WRITTEN** | A keyword/lexicon engine does not perform contextual or implicit sentiment analysis. Only the first two outputs (dimension + polarity, structured fields) exist as data. | Rewrite the paragraph around the rule-based method actually used. |
| 3 | 4.6.2 | One multilingual model handles all three language forms | **NOT AS WRITTEN** | The 157 Sinhala / Singlish / mixed / Tamil reviews were labelled by hand (run 2), not by one model. 8,214 of 27,122 reviews (30.3%) have no detected language. | State that non-English reviews were labelled manually, and how many. |
| 4 | 4.6.2 | Written coding rules separate confusable checkpoints | **PARTLY** | The rules are written in `salon_quality_framework_v5.md` (codebook). The program that applies them is not in the repository. | Cite the codebook; add the engine, or declare it missing. |
| 5 | 4.6.2 | Check 1: every statement carries its supporting text | **DONE** | 0 of 44,594 rows have empty `evidence_text`. | None. |
| 6 | 4.6.2 | Check 2: unclear service attaches at the coarsest level the text supports | **DONE** | Attachment level in the data: 10,524 sub-service, 2,372 service only, 4,476 category only, 27,222 business-wide. | None. |
| 7 | 4.6.2 | Check 3: faults the reviewer attributes to themselves or another business are not counted | **PARTLY** | The filter exists in the scorer, but `reviewer_fault` is true on 0 of 44,594 rows, so it never removed anything. There is no field for "another business". | Say the rule exists but no statement was flagged; drop "another business" or add the field. |
| 8 | Table 4.8 | Fields: service level, checkpoint, polarity, confidence, supporting span | **DONE** | All present on `extract.evidence_item`. Polarity: positive 41,909, negative 2,574, mixed 104, mention 7. | None. |
| 9 | Table 4.8 | Seriousness: ineffective, cosmetic, needs correction, irreversible, damage | **PARTLY** | Data holds cosmetic 121, ineffective 99, needs correction 93, damage 3. `irreversible` is on 0 rows. Only `damage` changes a score. | Report the observed counts and that only damage is scored. |
| 10 | Table 4.8 | Reviewer fault; staff name | **PARTLY** | `reviewer_fault`: 0 true rows. `evidence_item.staff_name`: 0 filled. Staff names live in a separate `staging.staff_names` table (4,585 rows, 529 names) whose creation is not in the repository. | Describe staff names as a separate extraction output. |
| 11 | Eq 4.1 | w = confidence x 0.5^(age/H) x specificity | **DONE** | `scoring_core.py` and `06_run_scoring.py:426-490`; a test parses the scorer to stop the two drifting. | None. |
| 12 | Table 4.9 | Confidence 1.0/0.7/0.3; half-life 24 months; specificity 1.0/0.75/0.5/0.25/0 | **DONE** | Matches `P` in `06_run_scoring.py:62-109`. The 0.25 rung applies to categories 3-7; categories 1-2 get 0 from other services. | None. |
| 13 | 4.6.3 | "Severity is handled at the business level by the safety rule rather than being mixed into the weight" | **NOT AS WRITTEN** | A `damage` statement counts its negative mass double (`06_run_scoring.py:428`, `damage_multiplier = 2.0`). That changes the dimension score directly. A separate business-level caution rule also exists. Only 3 statements are affected. | Say damage counts double in the negative total, in addition to the business-level rule. |
| 14 | Table 4.9 | Prior alpha0 = beta0 = 1; importance Low 1, Medium 2, High 4, Very high 8 | **DONE** | `prior [1,1]`; `LEVELS` in `WeightLevels.jsx:75-80`; default 2 in panel, API and SQL. | None. |
| 15 | Eq 4.2 | S_d = (a0 + P_d) / (a0 + b0 + P_d + N_d) | **DONE** | `06_run_scoring.py:507`. Test A-01 recalculated 60 category scores by hand: all match. | None. |
| 16 | 4.6.3 | "One statement moves the score to about 0.67 or 0.33" | **PARTLY** | True only for a statement of weight 1.0. A typical weighted statement moves it less (weight 0.7 gives 0.62). | Add "at full weight". |
| 17 | 4.6.3 | A dimension with no evidence is left out of the overall score | **DONE** | `29_no_data_dimensions.sql` is live in the database (verified). Test A-02 passes. | None. |
| 18 | Table 4.10 | Worked example: weights 0.944, 0.530, 0.294; result 0.657 | **DONE** | Arithmetic re-computed: 0.5^(2/24)=0.944; 0.707x0.75=0.530; 0.7x0.841x0.5=0.294; 2.474/3.768=0.657. | Label it illustrative (it is). |
| 19 | Eq 4.3 | Ranked if and only if the 80% interval width is below theta for the tier | **DONE** | `06_run_scoring.py:579`: `width < max_range_width_by_tier[tier]`. | None. |
| 20 | Table 4.11 | Tier table, theta 0.50 / 0.45 / 0.40 / 0.35 / 0.30 | **PARTLY** | Values, examples and counts match the code and database. The header "Maximum" is wrong because the test is strictly below. | Header: "Width must be below theta". Add "80% interval". |
| 21 | 4.6.4 | Width comes from the Beta posterior of statements about the requested service | **PARTLY** | True for the ranking decision. It uses review-level regrouping (one review = one unit, weight = max), only statements at specificity 0.75 or higher in weighted categories. The displayed range is then shifted onto the score, so it is not a true credible interval for that score. | Describe the regrouping; reword the on-screen "80% sure" sentence. |
| 22 | 4.6.4 | Businesses failing the test remain visible as available but unranked | **PARTLY** | True in the API. On screen, `Results.jsx:119-130` shows them only if they have at least 1 review about the service, mixed into one list sorted by score and marked "Less certain". | Describe the screen: one list with a "less certain" mark. |
| 23 | 4.6.4 | Taxonomy fallback: sub-service, then service, then category; customer told the level | **DONE** | `_FALLBACK_LEVELS` and `level_used` in `main.py`; test A-08 passes. | None. |
| 24 | 4.6.4 | Business cannot be ranked on evidence about something it does not do | **PARTLY** | Specificity discounts mismatched evidence. But at group level a business counts as ranked if any one of its sub-services is ranked (`bool_or`). | Mention the group-level rule. |
| 25 | Eq 4.4 | R_b = sum(v_d S_bd) / sum(v_d) over dimensions with evidence | **DONE** | `29_no_data_dimensions.sql`, live. Normalisation means all-Medium and all-High give the same order. | None. |
| 26 | 4.6.5 | Weighted-sum MCDM, cited to Saaty (1980) | **CANNOT VERIFY** | Not a code question. Saaty (1980) is the AHP source, and the text says pairwise comparison was not used. | Check the citation; a weighted-sum source may fit better. |
| 27 | 4.6.5 | Windows (6m, 1y, 3y) prepared in advance; no language-model call at request time | **DONE** | Scores are stored per window; ranking is a SQL function. A fourth window, `all`, also exists. | Mention `all`. |
| 28 | 4.6.5 | Safety concern = 2+ independent reports in 24 months, placed after others regardless of score | **NOT AS WRITTEN** | The rule exists, but the status is named `caution` (21 businesses; the "safety concern" status never fires). The database sorts safety before score, but the screen re-sorts by score only (`Results.jsx:125-130`, "deliberately not used for display"). A visitor does not see this ordering. | Either apply the safety order on screen, or say the screen orders by score and shows a caution mark. |
| 29 | 4.6.5 | Within each group ordered by R_b, ties broken by amount of evidence | **DONE** | SQL `order by safety_order, personal_score desc, evidence_weight desc`. | None. |
| 30 | 4.6.6 | Complaint = entry whose overall sentiment is not positive | **DONE** | `06_run_scoring.py:249`. | None. |
| 31 | 4.6.6 | Five parts, each starting neutral; average of parts with evidence | **DONE** | `06_run_scoring.py:256-267, 512-516`. | None. |
| 32 | Eq 4.5 | Kept if complaint share falls; broken if 2+ later complaints and no fall; untestable under 10 entries per window | **DONE** | `promise_outcome`, `06_run_scoring.py:292-320`. | None. |
| 33 | 4.6.6 | The profile shows that average | **PARTLY** | The browser recomputes Category 3 in `responsiveness.js` without smoothing or recency weighting, so the profile figure can differ from the stored one. | Make the browser read the stored score. |
| 34 | 4.6.7 | Names grouped after normalising spelling variants and honorifics | **CANNOT VERIFY** | No normalisation code exists in the repository. `staging.staff_names` is built outside it. | Add the script, or describe the step as done manually. |
| 35 | 4.6.7 | Share positive for staff with 3+ entries; flag when 2+ staff differ by 0.25; not in ranking | **DONE** | `STAFF_MIN_REVIEWS = 3`, `STAFF_DEPENDENT_MIN_STAFF = 2`, `STAFF_DEPENDENT_GAP = 0.25` in `staff.py`. | None. |
| 36 | 4.7.1 | Business record fields; displayed rating and count never used in scoring | **PARTLY** | Fields present and never referenced by the scorer or ranking (verified). There is no "division" column, only `city`. | Drop "division" or add it. |
| 37 | 4.7.2 | Feedback holds text, stars, date, detected language, staff name | **PARTLY** | Text, stars, date, language exist. Language is empty for 8,214 reviews (30.3%). Staff name is not on the review. | Report the 30.3% and its exclusion. |
| 38 | 4.7.2 | Management responses stored with text and date | **DONE** | `raw.owner_reply`: 6,847 rows. | None. |
| 39 | 4.7.3 | Out-of-scope businesses and duplicates removed; rating-only entries retained | **DONE** | Migration 26; `raw.removed_duplicate_review`; `has_text` filter. | None. |
| 40 | 4.7.4 | Google AI summaries informed the vocabulary and serve as a comparison | **CANNOT VERIFY** | No such data or code in the repository. | Add the source, or remove the section. |
| 41 | 4.7.5 | Limitations handled by weighting, treating absence as unknown, withholding ranks | **DONE** | Matches the no-data rule and the precision gate. | None. |
| 42 | Table 4.12 | React, FastAPI, PostgreSQL/Supabase, Python/JS/SQL, pandas/NumPy/SciPy, Render | **DONE** | All present. pandas, numpy and scipy are missing from `requirements.txt`. | Add them there. |
| 43 | Table 4.12 | pytest; browser-based functional testing | **PARTLY** | pytest: 82 pass. Vitest (74 pass) is not mentioned. No record of functional test cases in the repository. | Add Vitest; attach the functional test log. |
| 44 | Table 4.12 | LLM provider: Google Gemini via API | **NOT AS WRITTEN** | See the first row. | See note A. |
| 45 | 4.9.2 | Python extraction program calls the Gemini API | **NOT AS WRITTEN** | No such program in the repository outside `archive/`. | See note A. |
| 46 | 4.9.2 | Extracted records were reviewed against the coding rules and corrected before loading | **NOT AS WRITTEN** | Run 1: spot-check about 85% on 60 rows. Run 3 note: "Auto-coded rows not yet re-read; pending full recode". `extract.gold_label` has 0 rows. No full review is recorded. | Report the actual checks (60 rows, 150 rows) and that a full review was not done. |
| 47 | 4.9.3 | Scoring program stores results together with response and staff summaries | **PARTLY** | Dimension scores and Category 3 are stored. Staff summaries are computed at request time from `staging`, not stored. | Say staff summaries are computed on request. |
| 48 | 4.9.3 | Ranking is a database function | **DONE** | `score.rank_providers`, `score.rank_providers_group`. | None. The text is cut off after the colon. |

## Numbering errors in the pasted text

| Text says | Caption actually is |
|---|---|
| "Table 4.11 works through Equations 4.1 and 4.2" | Table 4.10 |
| "using the parameters in Table 4.10" | Table 4.9 |
| "Table 4.12 gives the tiers" | Table 4.11 |
| "Table 4.13 records the technologies" | Table 4.12 |
| "Figure 4.9 ... Algorithm 1" | Figure 4.10 |
| "Figure 4.10 ... Algorithm 2" | Figure 4.11 |
| "Figure 4.11 ... Algorithm 3" | Figure 4.12 |

Also "Table 4. 8" and "Table 4. 9" have a stray space.
