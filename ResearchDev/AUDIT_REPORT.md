# Research Audit Report — Amore Beauty

**Audit date:** 19 October 2026
**Project:** *A Service-Specific Multi-Layered Quality Framework for Personalised Selection of Beauty Service Providers Using Customer Feedback in Sri Lanka*
**Scope:** the code, the live database (read-only SELECT queries only), the tests, the git history, the documents, and the deployment.

---

## 1. Summary

You built a working web platform that ranks beauty salons in Sri Lanka from what customers wrote in their Google reviews, instead of from the star average. A visitor chooses a service, says how much each quality matters to them, and gets a ranking that changes with those priorities and shows how sure the system is about each score.

The build is strong. The risk is in how the work is **evidenced and described**. Four problems matter most:

1. **The step that turns review text into coded evidence is not in the repository and was never validated.** The `extract.gold_label` table has 0 rows.
2. **Your documents describe an older design, not the system you built.** `docs/` still describes a different formula, an expert-weighting method (AHP) and a Gemini extraction step that is no longer used.
3. **The usability result is at the ceiling** (mean SUS 98.7). An examiner will question it unless you explain it.
4. **Only 77 of 549 businesses are "ranked"** in the current scoring run. This is by design, but you must state it plainly.

Section 8 gives a prioritised fix list.

---

## 2. What you did in this research

| Phase | What you did | State |
|---|---|---|
| **Problem and method** | Framed the work as Design Science Research. Wrote 11 logged design decisions (`docs/decisions.md`): evidence-modulated ranking, missing evidence never scores 0, facts filter but only review-mined qualities score, framework cut from ten categories to seven, later extended to nine with Category 9. | Done |
| **Taxonomy** | Built the service taxonomy v9: 5 service categories, 17 services, 51 sub-services. | Done |
| **Quality framework** | Defined 9 quality categories with 27 sub-points. Six carry a weight (1/6 each). Management Response, Overall Verdict and Service Expertise are reported but not weighted. | Done |
| **Data** | Collected public Google Maps data: **549 businesses, 27,122 reviews, 6,847 owner replies**, dated 12 Aug 2013 to 17 Sep 2026. | Done |
| **Evidence coding** | Turned review text into **44,594 coded evidence rows** across 18,908 reviews. | The method is not in the repo (see 4.1) |
| **Scoring** | Built a Bayesian scorer: each category is a Beta posterior. Statements are weighted by how specific they are, how recent, and how clear. Empty dimensions are **left out**, not scored 0. It produces an 80% credible range and a rank status. Four time windows (6m, 1y, 3y, all). **11 scoring runs; the latest is run 12.** | Done |
| **Platform** | FastAPI backend plus React/Vite frontend with 12 screens (Landing, Rankings, Results, Salon Detail, Lookup, Dashboard, How It Works, About, Contact, Sign in, Profile, Favorites), plus a chat assistant and an in-app survey. | Done |
| **Deployment** | One Docker service on Render serves both the API and the website. | Live |
| **Evaluation** | Accuracy test suite (10 cases), automated unit tests, usability survey (n = 27). | Partly done (see section 5) |

**Timeline from git:** 62 commits between 5 and 19 October 2026 on 10 separate days. The two heaviest days were 14 October (18 commits) and 19 October (18 commits). Most-edited files: `SalonDetail.jsx` (19 changes), `index.css`, `main.py` (17 each).

---

## 3. The system in numbers (read from the live database today)

| Item | Value |
|---|---|
| Businesses / reviews / owner replies | 549 / 27,122 / 6,847 |
| Reviews that count (your rule: English, Sinhala, English-Sinhala mix) | 18,819 (69.4%) |
| Excluded: no language detected | 8,214 (30.3%) |
| Excluded: language "other" | 89 |
| Score rows in run 12 (business × sub-service × window) | 21,437 |
| Rank status | 540 **ranked** (2.5%) · 20,897 **available but not ranked** |
| Businesses with at least one score | 314 of 549 (57%) |
| Businesses **ranked** in at least one window | **77** of 549 (14%) |
| Ranked businesses by window | all: 76/314 · 3y: 73/281 · 1y: 51/214 · 6m: 31/164 |
| Real users of the app | 1 registered user, 2 contact messages, 27 survey responses |

Code size: about 4,200 lines of Python, 2,400 lines of SQL, 66 frontend files (8,800 lines), and **19,000 lines of CSS** (see 4.9).

---

## 4. Findings

Each finding is marked **[verified today]** (I checked it against the repo or database in this audit) or **[from REPORT.md]** (found by the earlier code audit and not re-checked line by line).

### 4.1 The evidence-coding step cannot be inspected or reproduced — HIGH [verified today]
- No file in the repository writes to `extract.evidence_item`. The database records the coder as a "Python keyword engine" that does not exist on disk.
- The only extraction code is an archived Gemini script writing a different schema (`archive/pipeline/s3_extract.py`), declared unused.
- `extract.gold_label` has **0 rows** and `archive/evaluation/gold_set.csv` is a single header line. There is no precision, recall, F1 or kappa for the coding anywhere.
- **Why it matters:** your second research objective (extraction) has nothing to point at, and everything downstream depends on these 44,594 rows.

### 4.2 The documents describe a different system — HIGH [verified today]
- `docs/project.md` names the "core formula" F(s) = Σ W·[R·C + (1−R)·μ]. That formula exists only in `archive/`, which is dead code. The live system uses the Beta posterior.
- `docs/methodology.md` describes 6 categories, 19 parameters, AHP expert weights and a 100-point user allocation. The live system has 9 categories and 27 sub-points, no AHP, and a four-level importance scale.
- Both files still say "Next action: run the LLM extraction — the single blocking step". Every evaluation result in `methodology.md` reads `[results: FILL]`. `project.md` still has `[FILL DATE]`.
- The degree level is inconsistent: `project.md` says **MSc Computing**; the root `README.md` says **undergraduate**.
- The framework document itself lists the thesis chapters 2–3 as written for the old design (open item O8).
- **Why it matters:** these are the files an examiner reads as the method. If the thesis quotes them, it describes a system that does not exist.

### 4.3 The usability result is at the ceiling — HIGH [verified today]
Anonymous in-app survey, collected 5–18 Oct 2026, n = 27.

| Measure | Result |
|---|---|
| SUS mean / median / SD / range | **98.7** / 100 / 1.4 / 95–100 |
| Perfect 100 scores | **14 of 27** |
| Industry average SUS | about 68 |
| Task completion unaided | T1 25 · T2 27 · T3 23 · T4 24 · **T5 21** of 27 |
| Completed all five tasks | 17 of 27 (63%) |
| Task Likert means (q14–q18) | 4.11 to 4.67 |
| Sample | 18–24: 7, 25–34: 11, 35–44: 5, 45+: 4 · 18 female, 8 male, 1 undisclosed · 13 use reviews weekly+ |

Things an examiner will notice:
- **10 participants did not finish all five tasks unaided, yet every one of them scored SUS ≥ 95.** Feeling and behaviour disagree.
- The survey is anonymous and allows repeat submissions, so independence cannot be shown. I found no byte-identical rows, which is reassuring but not proof.
- A near-ceiling score with an SD of 1.4 usually points to a friendly convenience sample or social-desirability bias.
- I am **not** saying the data is false. I am saying it needs a limitations paragraph. Report task completion beside SUS, and present SUS as "perceived usability in a small convenience sample".

### 4.4 Most salons are not ranked — MEDIUM (thesis framing) [verified today]
Only 77 of 549 businesses (14%) pass the precision gate in any window. The other results appear as "available but not ranked". This is the designed behaviour of the evidence gate, and your test A-05 confirms the status is consistent on all 21,437 rows. But it means the headline ranking covers a small part of the corpus. State it openly as a finding about evidence sparsity, not as a hidden weakness. I did not re-trace why 235 businesses have no score at all; REPORT.md §8.4 lists the filters that drop them.

### 4.5 The database cannot be rebuilt from the repository — MEDIUM [partly verified today]
- **Verified:** the `staging` schema (4,585 staff names, 28,267 evidence rows) is used by six live queries but no file in the repo creates it. `22_derive_provider_audience.py`, named in two source files, does not exist. `scoring_core.py` exists twice (identical copies). `requirements.txt` lacks pandas, numpy, scipy (the scorer needs them) and pins no versions.
- **From REPORT.md:** `09_` fails on a fresh build; `13_` and `14_` define the same function differently; `26_` cannot run after `20_`; two checks in `04_checks.sql` can no longer pass.
- **Why it matters:** the live system works because it was built by hand over time. A marker who tries to rebuild it will hit errors.

### 4.6 One statistical claim is not supported by its construction — MEDIUM [from REPORT.md, gap 26]
The salon card says "We are 80% sure the true score is between X and Y". The interval is a Beta quantile range shifted onto a different point estimate, so it is not a true credible interval for that score. This is the single statistical claim a reader sees. Either reword it ("typical range") or change the construction.

### 4.7 Untested core logic — MEDIUM [from REPORT.md, gap 25, partly closed]
Unit tests cover the per-statement arithmetic. The accuracy suite you now have (A-01 to A-10) covers recalculation, no-data rule, recency, specificity, rank-status consistency, time windows, fallback and traceability, and **all 10 pass**. That closes much of this gap. The 80% range construction itself is still not independently tested.

### 4.8 Other inherited items worth knowing [from REPORT.md]
- Four different framework version names (v4, v5, v6) across data and docs (gap 2).
- The browser recomputes Category 3 differently from the database (gap 20).
- The frontend re-sorts results and drops the database's safety ordering (gap 21).
- The scope says "English only" but the system counts Sinhala and mixed reviews (gap 23).
- `reviewer_fault` is true on 0 of 44,594 rows, and the "damage" severity on only 3 rows, so two coding rules had almost no effect (gaps 31–32).
- Sub-point 9.1 (consistency over time), described in your decisions log as the most distinctive part of v3, was deleted and its formula survives nowhere (gap 29). Do not claim it as a contribution.

### 4.9 Maintainability — LOW [verified today]
`index.css` (14,221 lines) plus `theme.css` (4,815 lines) is more than double all the JavaScript. `theme.css` fights `index.css` with `!important`, and you have just spent a session debugging exactly that (chip sizes, the 46px `min-height` that kept the Maps chip tall). It works, but each visual change risks a specificity fight.

### 4.10 Security — GOOD, two small notes [verified today]
- **No credentials in any of the 62 commits.** I scanned the full history for database URLs and API keys. The only passwords are placeholders (`YOUR_PASSWORD`). The `.env` file is ignored and not tracked.
- Passwords are hashed with bcrypt. CORS defaults to the local dev server only.
- **Note 1:** `auth.py` falls back to the secret `"change-me-in-production-please"` if `JWT_SECRET` is not set. On Render this is safe because `render.yaml` generates a real secret. Make the app refuse to start without one, so a mistake cannot silently allow forged logins.
- **Note 2:** `.env.example` contains your real Supabase project reference in the host name. It is not a secret, but it identifies your database server.

---

## 5. Evidence of quality — what you can cite

| Evidence | Result |
|---|---|
| Accuracy tests (`evaluation/accuracy`), run 12 | **10 of 10 pass** |
| Backend tests (pytest) | **82 pass** |
| Frontend tests (Vitest) | **74 pass** in 9 files |
| Usability survey | n = 27, SUS 98.7 (see caveats in 4.3) |
| Extraction accuracy | **none exists** |
| Comparison against a baseline (e.g. Google star ranking) | none found in the repo |
| Hand check of a review sample (framework item O9: 300 reviews) | not started |

Note: the accuracy tests check that the **scoring** behaves as designed. They do not measure whether the **coding** of review text is correct. These are different claims.

---

## 6. Repository and history status

- 62 commits. History was rewritten earlier today to remove automated co-author trailers; all trailers are gone from GitHub and the file contents are byte-identical to before. `.claude/` is no longer tracked and is gitignored.
- **`evaluation/` is untracked.** Your accuracy tests and results are only on your machine. An examiner viewing GitHub will not see them.
- Three local backup references still exist: `backup-full-history`, `backup-before-rewrite`, tag `pre-claude-cleanup`. They hold the pre-rewrite history. Delete them when you are satisfied with GitHub.
- Three author emails appear in history. Five commits by `kavindiasini7@gmail.com` show a grey avatar. Adding that address under GitHub → Settings → Emails fixes it without rewriting anything.
- An empty tracked file `ResearchDev/README.md` exists beside your real root `README.md`.
- Anyone who saved a link to a specific commit now has a dead hash; check your drafts for cited commit links.

---

## 7. What this audit did not do

- I did **not** re-read all 63 source files. Gaps marked **[from REPORT.md]** come from the earlier line-by-line audit and I have not re-confirmed them against today's code.
- I **cannot** verify the evidence coding, because its method is not in the repo.
- I did not judge the thesis chapters. No thesis text exists in the repository (`ResearchAssets/Dissertation_Drafts` holds only placeholders), so I have not checked the written work against the system.
- I did not test the live site's behaviour under real load.
- Survey observations are statistical, not accusations about any participant.

---

## 8. Recommended actions, in priority order

1. **Resolve the extraction gap.** Either add the coding method (script, prompt, rules) to the repo, or state clearly in the thesis that coding was done by an external process and document it as a limitation. Then label a sample by hand (framework item O9 suggests 300 reviews), fill `extract.gold_label`, and report precision and agreement. This is the single most valuable fix.
2. **Update `docs/` and thesis chapters 2–3 to the system you actually built** (Beta posterior, 9 categories, 27 sub-points, four-level importance). Fix the MSc/undergraduate inconsistency. Finalise the AI-use declaration in `methodology.md` (it is still a draft) and check what your institution requires you to declare.
3. **Add a limitations paragraph for the survey** and report task completion beside SUS. Consider a small second sample from people you do not know.
4. **Reword or fix the "80% sure" sentence** on the salon card.
5. **State the ranking coverage openly** (77 of 549 businesses, 14%) and explain the evidence gate as the cause.
6. **Commit `evaluation/accuracy/`** so the examiner can see the test evidence.
7. **Make the build honest.** Either add the missing DDL (`staging` schema) and pin dependencies (`pandas`, `numpy`, `scipy`, versions), or document that the database was built incrementally and list what is missing.
8. **Make `JWT_SECRET` mandatory** at startup.
9. **Tidy:** delete the backup refs once GitHub looks right, delete the empty `ResearchDev/README.md`, and link the second email to your GitHub account.

---

*Method: live database queried with SELECT only (credentials never printed); tests executed; full git history scanned for secrets; findings cross-checked against `REPORT.md` (4,405 lines, written earlier) and the project documents.*
