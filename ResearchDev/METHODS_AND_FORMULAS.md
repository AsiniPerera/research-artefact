# System Design and Formulas — Reference for the Thesis

**Compiled:** 19 October 2026
**Basis:** read directly from the source files and confirmed against the live database (scoring run 12). Every formula below cites the file and line that implements it.

**How to use this document.** It describes the system **as implemented**, not as the earlier design documents describe it. Where `docs/project.md`, `docs/methodology.md` or the framework specification disagree with the code, the code is reported here and the disagreement is flagged. Use this as the source for thesis Chapters 3 and 4.

---

## 1. What the system does

A visitor chooses a beauty service, sets how much each quality dimension matters to them, and receives a ranked list of businesses. Each score is built from statements extracted from customer reviews, not from the star average. The system also reports how precise each score is and refuses to rank a business whose evidence is too thin for the risk involved.

Three design commitments separate it from a star average:

1. **Service-specific.** A business is scored separately for each sub-service, so a salon good at manicures is not credited for that when ranking haircuts.
2. **Evidence-aware.** Every statement is weighted by how specific, how recent and how confident it is. A dimension with no evidence is left out of the score rather than guessed at.
3. **Precision-gated.** A business is listed as *ranked* only when the credible interval around its score is narrow enough for the irreversibility of that service.

---

## 2. Data and structures

### 2.1 Corpus (live database, run 12)

| Item | Count |
|---|---|
| Businesses | 549 |
| Reviews | 27,122 |
| Owner replies | 6,847 |
| Reviews with an assessment | 18,908 |
| Coded evidence statements | 44,594 |
| Review dates | 12 Aug 2013 – 17 Sep 2026 |

### 2.2 Service taxonomy (v9)

Three levels: **service category → service → sub-service**, holding 5 / 17 / 51 members. Scores are produced at the sub-service level (`ref.sub_service`).

### 2.3 Quality framework

Nine categories holding 27 sub-points. Six carry weight in the ranking.

| № | Category | Weight | Source of its score |
|---|---|---|---|
| 1 | Quality of the Result | 0.14286 | review text |
| 2 | Consultation, Care & Aftercare | 0.14286 | review text |
| 3 | Management Responsiveness | **0** reported only | owner replies (3.1–3.4) + review text (3.5) |
| 4 | Customer Trust & Recommendation | 0.14286 | review text |
| 5 | Staff & Customer Service | 0.14286 | review text |
| 6 | Value & Price Honesty | 0.14286 | review text |
| 7 | Safety, Hygiene & Facilities | 0.14286 | review text |
| 8 | Overall Verdict | **0** reported only | review text |
| 9 | Service Expertise & Consistency | **0** reported only | computed by rule |

Categories 8 and 9 are excluded from the score deliberately: 8 summarises the other categories and would double-count, and 9 is a display figure. Category 3 is reported but never ranked.

> **Note for writing up.** `ref.framework_category` stores each weighted category at 0.14286 (1/7), a leftover from when seven categories carried weight. The scorer and the ranking read the column only as `weight > 0`, so the stored value never multiplies anything, and the effective weight is **1/6 each**. Do not quote 1/7 as a design value.

---

## 3. Per-statement weighting

Each coded statement carries three multiplicative weights. Reference implementation: `backend/api/scoring_core.py`; applied in vectorised form at `06_run_scoring.py:426–428`.

### 3.1 Confidence

$$c = \begin{cases} 1.0 & \text{high} \\ 0.7 & \text{medium} \\ 0.3 & \text{low} \end{cases}$$

### 3.2 Recency — exponential decay, 24-month half-life

$$\rho(a) = 0.5^{\max(a,\,0)/24}$$

where $a$ is the statement's age in months, measured from the newest review in the corpus. A statement 24 months old counts half; at 48 months, a quarter. Negative ages are clamped to full weight.

### 3.3 Specificity — the evidence ladder

How far the evidence sits from the sub-service being scored (`06_run_scoring.py:487–490`):

| Rung | Weight $\sigma$ | Meaning |
|---|---|---|
| `same_sub_service` | 1.00 | the statement names this very sub-service |
| `same_service` | 0.75 | names the parent service |
| `provider_level` | 0.50 | about the business, no service named |
| `other_service_provider_trait` | 0.25 | about another service, but a salon-wide trait |
| `other_service_outcome` | 0.00 | another service's outcome — excluded |

The 0.25 rung applies only to categories **3, 4, 5, 6, 7** (`provider_trait_categories`). The reasoning: a dirty salon is dirty whichever service you booked, but the *result* of a haircut says nothing about a manicure. Categories 1 and 2 therefore score 0 off other services.

**Combined statement weight:**

$$w = c \cdot \rho(a) \cdot \sigma$$

Only statements with $w > 0$ are counted.

### 3.4 Polarity and severity

$$p = \begin{cases} 1.0 & \text{positive} \\ 0.5 & \text{mixed} \\ 0.0 & \text{negative} \end{cases}
\qquad
n = (1-p) \cdot \begin{cases} 2.0 & \text{severity} = \text{damage} \\ 1.0 & \text{otherwise} \end{cases}$$

A statement contributes $w \cdot p$ to its category's positive mass and $w \cdot n$ to its negative mass. Physical damage counts double.

> **Limitation to declare.** `severity = damage` appears on only **3 of 44,594** statements, and `reviewer_fault` on **0**. Both rules are defended in the framework but had almost no effect on the results.

---

## 4. Category score — Beta posterior

For category $k$, summing over its qualifying statements (`06_run_scoring.py:507`):

$$S_k = \frac{\alpha_0 + \sum_i w_i p_i}{\alpha_0 + \beta_0 + \sum_i w_i p_i + \sum_i w_i n_i}, \qquad \alpha_0 = \beta_0 = 1$$

This is the mean of a $\text{Beta}(1,1)$ posterior — a uniform prior updated by weighted evidence. Shrinkage toward 0.5 is automatic and strongest when evidence is thin, which is the behaviour a thin-evidence business should get.

**With no evidence, $S_k = 1/2 = 0.5$.** This is a storage placeholder, not a score (see §5).

---

## 5. The no-data rule (decided 19 Oct 2026)

**A weighted category with no evidence is left out of the score. Its weight leaves the denominator too.**

Implemented at `29_no_data_dimensions.sql` (live in the database, verified) via `evidence_count > 0`. A business with no data in *any* weighted category receives no score and is not listed.

Why neither alternative works:
- **Counting it 0** punishes silence. A business whose customers never mentioned hygiene would be marked down as if reviewed badly for it.
- **Counting it 0.5** awards a neutral mark for something nobody wrote about, which measures review coverage rather than quality.

This matters because empty dimensions are common. Share of business × sub-service pairs with **no** evidence, run 12:

| Category | Empty |
|---|---|
| 2 Consultation & Aftercare | **93.3%** |
| 6 Value & Price Honesty | 35.7% |
| 7 Safety, Hygiene & Facilities | 30.7% |
| 1 Quality of the Result | 13.8% |
| 5 Staff & Customer Service | 6.4% |
| 4 Customer Trust | 5.6% |

Across all stored rows, 69,308 of 196,353 (35.3%) carry no evidence.

> **Correction needed.** `docs/decisions.md` (D4) still says missing evidence "reverts to the prior μ". That describes the superseded design. The current rule is *left out*. Test A-02 confirms it empirically: for one pair the score is 0.7271 when the empty dimension is left out, 0.6892 if counted as 0.5, and 0.6059 if counted as 0.

---

## 6. Category 3 — Management Responsiveness

Scored from owner replies, not review text, and reported only. Category 3 is the mean of whichever of its five parts have evidence (`06_run_scoring.py:256–267, 512–516`).

A **complaint** is a review with text whose overall sentiment is not positive, weighted by the same recency decay $\rho$.

**3.1 Complaints answered**

$$S_{3.1} = \frac{1 + \sum_{\text{replied}} w_r}{2 + \sum_{\text{all complaints}} w_r}$$

**3.2 Reply specificity**, where $v \in \{\text{specific}: 1.0,\ \text{partly}: 0.5,\ \text{generic}: 0.0\}$

$$S_{3.2} = \frac{1 + \sum w_r v_r}{2 + \sum w_r}$$

**3.3 Stance and remedy**, where stance scores accepts/apologises 1.0, mixed 0.75, disputes 0.5, neither 0.25, and $m_r \in \{0,1\}$ indicates a remedy offered:

$$S_{3.3} = \frac{1 + \sum w_r \cdot \frac{1}{2}(\text{stance}_r + m_r)}{2 + \sum w_r}$$

**3.4 Promises kept**, over promises classified as kept ($K$) or broken ($B$):

$$S_{3.4} = \frac{1 + K}{2 + K + B}$$

A promise is testable only when its reply names a mappable issue and at least 10 reviews exist on each side of a 12-month window. The share of negative reviews on that issue is compared before and after: a fall means *kept*; no fall with at least two later complaints means *broken*; otherwise *no clear change*.

**3.5 Service recovery** comes from review text through the ordinary pipeline of §3–4.

> **Two cautions.** (a) 5,414 evidence rows coded to 3.1–3.4 are excluded from scoring (`REPLY_SP`) because they duplicate the reply table, yet are still shown on profiles — the screen and the score draw on different populations. (b) The browser recomputes Category 3 for display without Laplace smoothing or recency weighting (`frontend/src/lib/responsiveness.js`), so the profile figure and the stored score can differ.

---

## 7. Composite score

### 7.1 Stored base score (`06_run_scoring.py:546–563`)

Over weighted categories **with data**, $\mathcal{P} = \{k \in W : \text{count}_k > 0\}$:

$$\text{base} = \frac{1}{|\mathcal{P}|}\sum_{k \in \mathcal{P}} S_k
\qquad
\text{trust} = \max(0,\ \text{base} - 0.15\,g)$$

$g$ is the number of gates triggered. **No sub-point is marked as a gate in the current framework, so $g = 0$ always and trust = base on every row.** The machinery is retained so a gate added to reference data would work without code change. Report it as designed-but-inert.

### 7.2 Personalised score at request time (`29_no_data_dimensions.sql`)

This is the number the visitor sees. It is computed per request in PostgreSQL, which is why re-weighting never requires re-scoring:

$$\text{personal} = \frac{\sum_{k \in \mathcal{P}} u_k S_k}{\sum_{k \in \mathcal{P}} u_k}$$

where $u_k$ is the visitor's importance for category $k$.

### 7.3 The importance scale — four doubling levels

`frontend/src/components/WeightLevels.jsx:75–80`:

| Level | $u$ |
|---|---|
| Low | 1 |
| Medium (default) | 2 |
| High | 4 |
| Very high | 8 |

Doubling makes the scale meaningful: each step is worth exactly two of the one below, so *Very high* counts as eight *Low*. The slider moves on the index (0–3) so the stops sit evenly while the weights behind them double.

The visitor sets six categories (1, 2, 4, 5, 6, 7) in panel order 1, 7, 2, 5, 6, 4. The API accepts seven numbers and **forces position 3 to zero** (`main.py:_parse_weights`), because Category 3 is reported only. An unset category defaults to Medium in all three layers — panel, API and SQL — which must agree or the ranking would use numbers the visitor never saw.

> **Important for the thesis.** This is **not** the AHP expert-weighting plus 100-point allocation described in `docs/methodology.md`. There is no AHP in the system. Within-category parameter weights do not exist; sub-points contribute through their evidence mass alone.

### 7.4 Group-level ranking

When the visitor picks a service or category rather than a single sub-service, category scores are pooled across member sub-services, weighted by evidence and restricted to those with data:

$$S_k^{\text{group}} = \frac{\sum_j S_{k,j}\,e_{k,j}}{\sum_j e_{k,j}} \quad\text{over } j \text{ with } \text{count}_{k,j} > 0$$

### 7.5 Whole-salon score on the profile

A second, parallel figure (`backend/api/overall.py`), display only. It uses specificity 1.0 for every statement (the question is "this salon", not "this service"), pools across all services, includes Category 8 at a fixed weight of 2.0, and excludes Category 3. It applies the same no-data rule. It does not affect ranking.

---

## 8. Precision and the decision to rank

### 8.1 Review-level regrouping

Precision rests only on evidence about *this* service ($\sigma \ge 0.75$) in weighted categories. One review is one unit of evidence however many points it makes (`06_run_scoring.py:566–572`). For each review $r$:

$$\text{share}_r = \frac{P_r}{P_r + N_r}, \qquad \omega_r = \max_i w_i$$

$$P_t = \sum_r \omega_r\,\text{share}_r, \qquad N_t = \sum_r \omega_r (1 - \text{share}_r)$$

### 8.2 The 80% interval

With $a = 1 + P_t$ and $b = 1 + N_t$, and $F^{-1}$ the Beta quantile function:

$$q_{\text{lo}} = F^{-1}(0.10;\,a,b), \quad q_{\text{hi}} = F^{-1}(0.90;\,a,b), \quad \mu = \frac{a}{a+b}$$

$$\text{width} = q_{\text{hi}} - q_{\text{lo}}$$

$$\text{low} = \max(0,\ \text{trust} - (\mu - q_{\text{lo}})), \qquad \text{high} = \min(1,\ \text{trust} + (q_{\text{hi}} - \mu))$$

> **Statistical caution — address this in the thesis.** The interval is a Beta posterior centred at $\mu$ whose endpoints are then *translated* onto a different point estimate, $\text{trust}$. The two differ because $\mu$ comes from review-level regrouping while trust comes from the category mean. The interface says "We are 80% sure the true score is between X and Y", which is a coverage claim this construction does not support. Either reword it as a typical range, or centre the interval on the estimate it belongs to. This is the only statistical claim shown to a user, and it is untested.

### 8.3 Irreversibility tiers and the precision gate

Each sub-service carries a tier reflecting how far a bad outcome can be reversed. The maximum interval width $\theta$ tightens as irreversibility rises (`06_run_scoring.py:77`):

| Tier | Reversibility | Examples | $\theta$ | Sub-services |
|---|---|---|---|---|
| 1 | Gone within a day | blow-dry, event makeup | 0.50 | 16 |
| 2 | Days | mehendi, basic facial | 0.45 | 11 |
| 3 | Weeks | nail polish, lash extensions, waxing | 0.40 | 13 |
| 4 | Months | colour, keratin, extensions | 0.35 | 5 |
| 5 | Permanent, or a real risk of damage | rebonding, perming, bleach, chemical peel, microblading | 0.30 | 6 |

**Rank status** (`06_run_scoring.py:578–580`):

$$\text{status} = \begin{cases}
\text{not ranked: safety concern} & \text{if safety status is a concern} \\
\textbf{ranked} & \text{if width} < \theta_{\text{tier}} \\
\text{available but not ranked} & \text{otherwise}
\end{cases}$$

Note the strict inequality: a width of exactly $\theta$ is **not** ranked. Phrase the table as "width must be below $\theta$", not "maximum width".

The tiers were assigned by the researcher using the written rule above, with no expert panel. Do not claim external validation. Be ready for one viva question: *Wedding Day Bridal Makeup* is tier 1 because it washes off, yet a failure on a wedding day cannot be undone. The tiers measure physical reversibility, not the consequences of failure.

### 8.4 Sort order

Ranked before unranked; then safety (clear 0 < caution 1 < concern 2); then personal score descending; then evidence weight descending.

> **Known deviation.** `frontend/src/screens/Results.jsx` re-sorts on `personal_score` alone, discarding the safety ordering the database applied. The safety precedence the framework specifies therefore has no visible effect.

---

## 9. Duration windows

Every score exists in four versions: **6m, 1y, 3y, all**. The window is a hard inclusion rule, not a weight: it decides which reviews exist at all, anchored to today's date rather than the newest review in the corpus (`06_run_scoring.py:386–404`). Recency decay then operates *within* the chosen window. The two mechanisms answer different questions — the window decides in or out, the decay decides how much an included statement counts.

A statement with no date is excluded from bounded windows and included in `all`.

Not re-filtered per window: gates, vetoes, safety status, and Category 3's reply-based parts.

> **Inconsistency to fix.** The UI defaults to `anytime` → `all`, but both SQL functions default to `'1y'`. A direct SQL call and an API call with no window return different scores.

---

## 10. Category 9 — Service Expertise (9.2)

Display only, computed by rule rather than read from review text, so it carries no confidence, recency or specificity weight. For a business with $n$ service-attributed reviews naming service $s$, out of $N$ attributed reviews overall (`06_run_scoring.py:442–445`):

$$S_{9.2} = \frac{1 + n}{2 + N}, \qquad n \ge 5$$

The denominator counts *attributed* reviews, not all reviews: only 29% of evidence names a service, so dividing by every review would measure tagging coverage rather than specialisation.

> **Sub-point 9.1 (consistency over time) was removed** (`18_subpoint_9_1_removed.sql`) and its formula survives nowhere in the repository. `docs/decisions.md` calls it "the most methodologically distinctive element of v3". **Do not claim consistency measurement as a contribution** — there is no artefact behind it.

---

## 11. Worked example

Numbers from test A-02 (`evaluation/accuracy/accuracy_results.csv`), business `ChIJdwG-zWRR4joR`, sub-service `HR.CHEM.01`.

Take a high-confidence positive statement, 12 months old, naming this sub-service:

- $c = 1.0$, $\rho = 0.5^{12/24} = 0.7071$, $\sigma = 1.0$ → $w = 0.7071$
- Positive, so $p = 1.0$, $n = 0$ → adds 0.7071 positive mass, 0 negative

If that category accumulated 3.2 positive and 0.8 negative mass:

$$S_k = \frac{1 + 3.2}{2 + 3.2 + 0.8} = \frac{4.2}{6.0} = 0.70$$

For the pair above, category 2 had no evidence. The three possible treatments give materially different answers:

| Treatment | Score |
|---|---|
| **Left out (implemented)** | **0.7271** |
| Counted as 0.5 | 0.6892 |
| Counted as 0 | 0.6059 |

The stored value equals the mean over only the dimensions with evidence, confirming the rule operates as specified.

---

## 12. Parameters in full

Every constant, from `P` in `06_run_scoring.py:62–109`, stored with each run in `score.scoring_run.parameters`:

| Parameter | Value |
|---|---|
| Prior | Beta(1, 1) |
| Confidence weights | high 1.0, medium 0.7, low 0.3 |
| Recency half-life | 24 months |
| Specificity ladder | 1.0 / 0.75 / 0.5 / 0.25 / 0.0 |
| Provider-trait categories | 3, 4, 5, 6, 7 |
| Damage multiplier | 2.0 |
| Interval level | 0.80 |
| Max width by tier | 0.50 / 0.45 / 0.40 / 0.35 / 0.30 |
| Gate penalty | 0.15 (inert) |
| Evidence window | 24 months |
| Independence | 7 days apart |
| Promise window | 12 months, min 10 reviews each side |
| Stance scores | 1.0 / 0.75 / 0.5 / 0.25 |
| Category 9 minimum | 5 service reviews |
| Duration windows | 6m, 1y, 3y, all |
| User importance | 1, 2, 4, 8 (default 2) |

---

## 13. Results of the current run

Scoring run 12, from the live database:

| Measure | Value |
|---|---|
| Score rows (business × sub-service × window) | 21,437 |
| **Ranked** | 540 (2.5%) |
| Available but not ranked | 20,897 |
| Businesses with any score | 314 of 549 (57%) |
| Businesses ranked in any window | **77 of 549 (14%)** |
| By window (ranked / scored businesses) | all 76/314 · 3y 73/281 · 1y 51/214 · 6m 31/164 |

State this openly as a finding about evidence sparsity. The precision gate is doing exactly what it was designed to do: most businesses lack enough service-specific evidence to be ranked at the required precision, and the system declines to rank rather than publishing a number it cannot support. That is a defensible result, and arguably the system's central empirical finding — but it must be presented, not discovered by a reader.

---

## 14. Validation status

| Evidence | Result |
|---|---|
| Accuracy tests (A-01 to A-10) | 10 / 10 pass on run 12 |
| Backend unit tests | 82 pass |
| Frontend tests | 74 pass |
| Usability (SUS, n = 27) | mean 98.7 — needs a limitations paragraph |
| **Extraction accuracy (precision / recall / F1 / κ)** | **none — `extract.gold_label` has 0 rows** |
| Comparison against a star-average baseline | none in the repository |

The accuracy suite verifies that the **scoring** behaves as designed. It does not verify that the **coding of review text** is correct. These are different claims and the thesis must keep them apart.

**The coding step is not in the repository.** The database credits run 4 to a "Python keyword engine" that does not exist on disk; the only extraction code present is an archived Gemini pass declared unused. The 44,594 statements are therefore an unverifiable input. Either restore and document that step, or declare it plainly as a limitation — but do not describe an extraction method the artefact cannot demonstrate.

---

## 15. Points to carry into the write-up

1. The composite is a **Beta posterior with evidence-weighted mass**, not the $F(s) = \sum W[R^t C + (1-R^t)\mu]$ formula in `docs/project.md`. That formula exists only in `archive/`, which is dead code.
2. **No AHP, no 100-point allocation.** Weighting is a four-level doubling scale over six categories.
3. **Effective category weight is 1/6**, despite 1/7 being stored.
4. **Empty dimensions are left out**, not scored 0 and not averaged at 0.5.
5. **Gates, vetoes and the damage multiplier are effectively inert** — report them as designed, with their observed effect.
6. **Sub-point 9.1 was removed**; do not claim consistency measurement.
7. **The "80% sure" sentence overstates** what the construction supports.
8. **Only 14% of businesses are ranked.** Present it as the headline finding about evidence sparsity.
9. **Extraction has no validation.** This is the single largest gap.

---

*Sources: `backend/salon_db/06_run_scoring.py`, `backend/api/scoring_core.py`, `backend/salon_db/29_no_data_dimensions.sql` (live), `13_ranking_v6.sql`, `backend/api/overall.py`, `backend/api/main.py`, `frontend/src/components/WeightLevels.jsx`, and read-only queries against scoring run 12.*
