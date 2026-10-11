# Framework v5 — Decisions and Implementation Reference

**Project:** A Service-Specific Multi-Dimensional Quality Framework for User-Defined Personalized Selection of Beauty Service Businesses in Sri Lanka
**Researcher:** Asini Perera
**Last updated:** 11 October 2026
**Status:** Framework FROZEN on 11 October 2026.

This file is the single reference for anyone (human or coding agent) working on the codebase. It records what was decided, why, and how the system must behave. The full specification with coding rules is `salon_quality_framework_v5.md`. If this file and the code disagree, raise it; do not silently change either.

---

## 1. Rules for working on this codebase

1. **The framework is frozen.** Do not add, remove, rename or move categories or sub-points. New ideas go under "Limitations" or "Future work" in the thesis.
2. **Show diffs and wait for approval** before editing any file.
3. **Database changes go in a numbered migration file** under `backend/salon_db/`. The researcher runs it herself in the Supabase SQL Editor, one step at a time. Do not connect to the database from the agent.
4. **Do not run the scoring script.** The researcher runs it.
5. **Change only what was asked.** State what you did not change.
6. **No paid APIs.** There is no API budget.
7. In thesis text, write "beauty service business", not "salon". Code and table names may keep "salon" and "provider".

---

## 2. The frozen framework: 7 categories, 25 sub-points

| Code | Customer question |
|---|---|
| **1** | **Quality of the Result** |
| 1.1 | Is the quality of the work good? |
| 1.2 | Does the result match what I asked for? |
| 1.3 | Does the result last? |
| **2** | **Consultation, Care & Aftercare** |
| 2.1 | Do they assess my needs and relevant risks first? |
| 2.2 | Are they honest about what is possible? |
| 2.3 | Do they explain how to care for the result? |
| **3** | **Management Responsiveness & Continuous Improvement** |
| 3.1 | Does management respond to customer complaints? |
| 3.2 | Does management address the specific concern raised? |
| 3.3 | Does management take ownership of the concern? |
| 3.4 | Does management follow through on improvement commitments? |
| 3.5 | If something goes wrong, do they put it right? |
| **4** | **Customer Trust & Recommendation** |
| 4.1 | Would customers recommend the business? |
| 4.2 | Do customers want to return? |
| **5** | **Staff & Customer Service** |
| 5.1 | Are the staff friendly and respectful? |
| 5.2 | Is the treatment comfortable and appropriately handled? |
| 5.3 | Do staff explain things clearly? |
| 5.4 | Is my appointment handled professionally? |
| **6** | **Value & Price Honesty** |
| 6.1 | Is it worth the money? |
| 6.2 | Will I pay the price I was quoted? |
| 6.3 | Will they push me to buy extras? |
| **7** | **Safety, Hygiene & Facilities** |
| 7.1 | Is the premises clean? |
| 7.2 | Are tools and staff hygiene practices appropriate? |
| 7.3 | Are there reports of harm or unsafe practices? |
| 7.4 | Are products appropriate and in good condition? |
| 7.5 | Are the facilities comfortable and suitable? |

Sub-point counts per category: 3, 3, 5, 2, 4, 3, 5.

**Source of evidence**

| Sub-points | Read from |
|---|---|
| 3.1, 3.2, 3.3, 3.4 | Owner replies (`raw.owner_reply`, `extract.reply_assessment`). Business-wide |
| 3.5 and all others | Customer reviews (`extract.evidence_item`) |

**Overall Verdict ("category 8").** General statements that name no quality aspect. Stored and scored in `score.category_score`, but it has no weight, is not one of the 7 categories or 25 sub-points, never enters the ranking, and is not shown in the frontend.

**Service taxonomy:** `service_taxonomy_v9.md`: 5 categories, 17 services, 51 sub-services. Terminology is category → service → sub-service.

---

## 3. Database layout (Supabase / PostgreSQL)

| Schema | Holds | Key objects |
|---|---|---|
| `raw` | Collected Google data | `provider`, `review`, `owner_reply`, `removed_duplicate_review`, `v_review_full` |
| `ref` | Framework and taxonomy | `framework_category`, `sub_point`, `service_category`, `service`, `sub_service`, `provider_city`, `dim_service`, `dim_sub_point` |
| `extract` | Final coded evidence | `evidence_item`, `review_assessment`, `reply_assessment`, `extraction_run`, `gold_label`, `v_evidence` |
| `score` | Calculated scores | `category_score`, `trust_score`, `scoring_run`, `provider_safety`, `commitment_outcome`, `gate_veto_status`, `v_ranking`, `v_provider_caution`, functions `rank_providers`, `rank_providers_group` |
| `staging` | Raw landing area for loads | `evidence_item`, `review_assessment`, `reply_assessment`, `staff_names` |
| `public` | Website login and contact form | `app_users`, `contact_inquiries` |
| `backup_v3` | Old framework backup | Do not use |

**Key files**

| File | Role |
|---|---|
| `backend/salon_db/06_run_scoring.py` | The only code that fills `score.category_score` and `score.trust_score` |
| `backend/salon_db/07_framework_v5_migration.sql` | Moves 5.5 to 3.5, renames category 1 |
| `backend/api/main.py` | `GET /rankings/{sub_service_code}`; calls the ranking functions; weight validation; fallback |
| `frontend/src/components/WeightLevels.jsx` | Priority buttons |
| `frontend/src/constants/presets.js` | Presets |
| `frontend/src/components/SalonCard.jsx` | Business card |
| `frontend/src/components/FallbackNotice.jsx` | Fallback message |
| `frontend/src/constants/subPoints.js` | Sub-point labels |

**Snapshot before the v5 re-score (scoring run 4):** 549 businesses, about 27,100 reviews, 6,847 owner replies, 44,594 evidence items, 7,561 business × sub-service pairs, 283 ranked.

---

## 4. Scoring rules

### 4.1 Statement weight

`weight = confidence × recency × specificity`

| Factor | Values |
|---|---|
| Confidence | high 1.0, medium 0.7, low 0.3 |
| Recency | `0.5 ^ (age_months / 24)` |
| Specificity | same sub-service 1.00; same service, no sub-service 0.75; business in general 0.50; another service on a business-wide trait (categories 3–7) 0.25; another service on work outcome (categories 1–2) 0 |
| Damage | a negative statement with severity `damage` counts double |

### 4.2 Category score (categories 1, 2, 4, 5, 6, 7)

All statements in the category are pooled. Sub-points are not scored separately.

`score = (1 + P) / (2 + P + N)` where P and N are the summed positive and negative weights.

- The prior `[1, 1]` means every score starts at 0.5.
- No evidence gives exactly 0.5, and that 0.5 **stays in** the overall score.

### 4.3 Category 3 (v5)

A **complaint** is a review with text whose `overall_sentiment` is not positive. A **complaint reply** is an owner reply to a complaint. Each complaint carries the recency weight. Every part uses the same prior. There is no minimum number of replies.

| Part | Formula |
|---|---|
| 3.1 | `(1 + Σw complaints with a reply) / (2 + Σw all complaints)` |
| 3.2 | over complaint replies, value 1.0 specific / 0.5 partly specific / 0.0 generic: `(1 + Σ w·value) / (2 + Σ w)` |
| 3.3 | over complaint replies, value = mean(stance score, remedy offered 1/0): same formula. Stance: accepts / apologises 1.0; accepts and disputes 0.75; disputes the report 0.5; neither 0.25 |
| 3.4 | `(1 + kept) / (2 + kept + broken)`; see 4.4 |
| 3.5 | customer statements coded 3.5, normal statement weights, per (business, sub-service): `(1 + P) / (2 + P + N)` |
| Category 3 | mean of the parts that have evidence. None: 0.5 with zero evidence weight and count |

- Replies to positive reviews are not counted anywhere.
- `latency_days` is not used.
- Rows in `extract.evidence_item` coded 3.1–3.4 are copies of owner replies. They must **not** contribute to any score, and must be excluded from the range / rank-status calculation. Rows coded 3.5 are customer statements and do count.

### 4.4 Promise testing for 3.4 (Rule B)

For each reply with `commitment_made`:

| Step | Rule |
|---|---|
| Map the issue tags | `waiting` → 5.4; `staff` → 5.1; `service outcome` → any 1.x; `price` → any 6.x; `hygiene` → 7.1, 7.2, 7.3 |
| Windows | before = `[reply_date − 12 months, reply_date)`; after = `(reply_date, reply_date + 12 months]` |
| Count in each window | (i) the business's reviews that have text; (ii) distinct reviews with a negative statement on a mapped sub-point. Share = (ii) ÷ (i) |
| Not testable | no `reply_date`, no issue tag that maps (null, empty or `not identified`), or fewer than 10 text reviews in either the before or the after window |
| Kept | share after < share before |
| Broken | 2 or more complaining reviews after **and** share after ≥ share before |
| No clear change | anything else |
| Output | one row per promise in `score.commitment_outcome` |

### 4.5 Overall score and ranking

| Rule | Behaviour |
|---|---|
| Weights | Seven values, one per category 1–7. Each divided by their total |
| Overall score | Weighted mean of the seven category scores (`score.rank_providers`) |
| Stored `base_score` | Equal-weight mean of categories 1–7 |
| Range | 80% interval from customer statements about the business's own service (specificity ≥ 0.75), per review |
| Ranked | Range width below the tier limit: tier 1 < 0.50, tier 2 < 0.45, tier 3 < 0.40, tier 4 < 0.35, tier 5 < 0.30. Otherwise "available but not ranked" |
| Order | Safety status first (clear, then caution, then concern), then score descending, then evidence weight descending |
| Gate penalty | None applied. The parameter exists; no row has a deduction |

### 4.6 Safety status

| Status | Condition |
|---|---|
| clear | default |
| caution | 2 or more independent negative reports under 7.1–7.3 within 24 months, at least 7 days apart, duplicates and near-copies removed |

It affects list order only. No notice is shown to the customer.

---

## 5. API behaviour

| Topic | Behaviour |
|---|---|
| Endpoint | `GET /rankings/{sub_service_code}` |
| Functions | `score.rank_providers` (sub-service level), `score.rank_providers_group` (service or category level). `score.v_ranking` is not used by the API |
| Order | Taken from the database unchanged. The API does not re-sort or re-score |
| Weights | Exactly 7 values; non-numeric, negative, wrong count or all-zero → HTTP 422. Any non-negative number is accepted, not only 1, 2, 4, 8 |
| Missing weights | Database defaults each to 1 (equal weights) |
| Fallback | Sub-service → service → category, moving up when no business is ranked at that level for the chosen city. Response carries `level_used`, `requested`, `shown`. Required by the supervisor |

---

## 6. Frontend decisions

| Item | Decision |
|---|---|
| Priority buttons | Low = 1, Medium = 2 (default), High = 4, Very high = 8. Heading: "How important is each to you?" |
| Presets (Q1–Q7) | balanced 2,2,2,2,2,2,2 · quality 8,4,1,2,2,1,2 · budget 4,1,1,1,2,8,2 · hygiene 2,2,2,2,4,1,8 · bridal 8,4,2,4,2,1,2 |
| Safety advisory notice on the card | Removed |
| "Monitored" band word for Category 7 | Removed; Category 7 shows its normal band |
| Overall Verdict | Not shown |
| Google rating | Shown as "reference only"; never part of the score |
| Fallback | `FallbackNotice` shows what was requested and what is shown |
| Category 1 label | "Quality of the Result" |
| 3.5 | Listed under Category 3, not Category 5 |

---

## 7. Decision log

| Date | Decision | Reason |
|---|---|---|
| 10 Oct 2026 | 7-category, 25-sub-point framework confirmed as approved | Stated by the researcher |
| 10 Oct | A category with no evidence stays at 0.5 and remains in the score | Already in the code; neutral; avoids one glowing review dominating. Using 0 would punish silence |
| 10 Oct | Statements are pooled per category, not scored per sub-point | Already in the code; more stable with few statements. Document corrected to match |
| 10 Oct | Specificity weights kept and documented | In the code but previously unwritten |
| 10 Oct | The 0.5 starting point (prior 1, 1) kept | Stops a single review giving 100%; gives empty categories a value |
| 10 Oct | Overall Verdict is not added to the score | It is the same kind of general signal as the star rating |
| 10 Oct | Safety advisory notice removed from the card | Safety is already a scored category |
| 10 Oct | Safety ordering in the database functions left unchanged | Researcher's decision. The thesis must describe the order as it is |
| 10 Oct | No gates or penalties | Cautions were replaced by the Category 7 score |
| 10 Oct | Priority labels changed to Low / Medium / High / Very high | The buttons set importance, not quality |
| 10 Oct | Accuracy is evaluated on a checked sample of 300 reviews, not a blind hand-coded set | Researcher's decision; recorded as a limitation |
| 11 Oct | Category 3 scored from replies to complaints only | 90% of replies were thank-yous to 5-star reviews; the category is about complaint handling |
| 11 Oct | Evidence-table copies of owner replies (3.1–3.4) removed from all scoring and from the ranking threshold | They double-counted replies and contradicted the reply table |
| 11 Oct | Minimum of 5 replies removed | The 0.5 starting point already handles thin evidence |
| 11 Oct | Sub-point 5.5 moved to Category 3 as 3.5 | Putting a mistake right is management responsiveness; it also gives Category 3 more evidence |
| 11 Oct | 3.4 tested against later reviews using Rule B (share of reviews) | Rule A (2 or more later complaints) marked improving large businesses as broken |
| 11 Oct | A promise is testable only with 10 or more text reviews in both the before and the after window | A share taken from one or two reviews is unreliable and could mark a promise "kept" by accident |
| 11 Oct | Promise issue tags are split on ";" and matched by substring; the test uses the union of the mapped sub-points | Most promises carry several tags |
| 11 Oct | Category 1 renamed "Quality of the Result"; all 25 questions reworded | Researcher's wording |
| 11 Oct | **Framework frozen** | No further structural changes |

---

## 8. Open items

| # | Item | Owner |
|---|---|---|
| O1 | Run `07_framework_v5_migration.sql`, then re-run scoring, then check pair and ranked counts against run 4 (7,561 pairs, 283 ranked) | Researcher |
| O2 | Update the 25 `customer_question` values in `ref.sub_point` and the frontend labels to the wording in Section 2 | Researcher |
| O3 | Show `salon_quality_framework_v5.md` to the supervisor (3.5 move, rewording) | Researcher |
| O4 | Taxonomy: Gents' Grooming (Beard & Shave) has no ranked businesses. Keep 5 categories, or move Beard & Shave under Hair (4 categories)? Not decided | Researcher |
| O5 | Check whether barber-shop listings were collected, and whether beard reviews were coded elsewhere | Researcher |
| O6 | Confirm whether a "hide salons with safety cautions" filter or any practice-caution display still exists in the frontend; remove if so | Coding agent to report |
| O7 | Sub-services within one service show identical ranked counts; check whether scores really differ between sub-services | To investigate |
| O8 | Thesis Chapters 2 and 3 were written for an older design (ten categories, expert panel); update to v5 | Researcher |
| O9 | Evaluation not started: functional tests, accuracy (300-review check, score recalculation, ranking vs star rating), performance, usability (20–30 participants), comparison table | Researcher |

---

## 9. Known limitations (for the thesis)

1. Statements are pooled per category, so rare complaints on one sub-point can be outweighed by frequent praise on another.
2. A category with no evidence stays at 0.5, so priority on a thinly evidenced category changes the order little.
3. Category 4 leans high, because customers seldom write "I do not recommend".
4. Few owners reply to complaints (197 of 866), so 3.1–3.4 rest on little evidence for most businesses.
5. Many promises carry several issue tags, which makes the 3.4 test broad.
6. Weights and thresholds were set by the researcher and not tuned against data.
7. Only a small share of business × sub-service pairs have enough evidence to be ranked.
8. The customer group a business serves (gents, ladies, unisex) was not verified.
9. Coding accuracy rests on a checked sample by one researcher.
10. The safety mark lowers a business in the list without a visible notice.
