# backend/salon_db — what's here and why there are so many files

This is the historical record of every change made to the live database,
in the order each one actually ran. **The files are kept in order on
purpose and are not meant to be combined further than they already are**
— each one is proof of what the database looked like at a point in time,
which matters for a research artefact's methodology as much as for
day-to-day use. If you're setting up a fresh database, run them in numeric
order; a database that already has a later migration applied does not need
to re-run anything earlier than the file you're adding.

Two groups of files that only ever ran back to back, on the same database,
and never separately, have been merged into one file each — this cuts the
file count without losing any step, since each merged file keeps every
original section intact, in order, as its own clearly labelled part.
Nothing inside either was reworded by merging; only the surrounding file
headers changed to say what moved where.

## Setup, run once in order

| File | What it does |
|---|---|
| `01_schema_and_reference_data.sql` | Creates the schemas and tables, then the taxonomy and the original 7-category framework's categories and sub-points. (Merged from the original `01_schema.sql` + `02_reference_data.sql`.) |
| `03_load_data.py` | Loads the six CSVs in `data/` into the tables section 1 above created. **Must run before `04_checks.sql`** — several of its checks count rows this script loads. |
| `04_checks.sql` | Read-only sanity queries — each one's comment states the figure it should return. |
| `05_tiers_and_scoring_schema.sql` | Sets irreversibility tiers and builds the four score tables the scorer writes to. |

## The framework's evolution

| File | What it does |
|---|---|
| `07_group_level_ranking.sql` | Adds ranking one level up (service or category), for when a sub-service has nothing ranked yet. |
| `08_safety_notes_and_ranking.sql` | Adds safety status and the per-sub-service ranking function. |
| `09_framework_v5.sql` | Moves sub-point 5.5 to 3.5, renames category 1, then sets the final customer-question wording and research-meaning text for category 3. Three steps, one after another. (Merged from the original `09_framework_v5_migration.sql` + `10_framework_v5_questions.sql` + `11_framework_v5_meanings.sql`.) |
| `12_framework_v6_category9.sql` | Appends Category 9 (Service Expertise & Consistency) and sets Category 3's weight to 0. |
| `13_ranking_v6.sql` | The ranking functions, now rewritten twice more since 12_: see below. |
| `14_ranking_safety_fix.sql` | Fixes group-level safety reporting (`min()` → worst-wins). Folded into 13_'s latest body; kept as the historical record of the bug and the fix. |
| `15_subpoint_is_computed_fix.sql` | Marks 3.2, 3.3 and 3.4 `is_computed`, matching 3.1 — they're all owner-reply parts. |
| `16_category9_weight_zero.sql` | Drops Category 9's weight to 0: its ranked part (9.1, consistency) was removed once duration filtering became universal (17_), and its other part (9.2, specialism) was never ranked. |
| `17_window_scoped_scores.sql` | Widens `category_score` and `trust_score` with `window_code`, so every category and the final ranking are scoped to the reader's chosen duration (6m/1y/3y/anytime) — not just a Category-9-only display, which is all this used to do. |
| `28_usability_task_completion.sql` | Adds `task1_completed`..`task5_completed` to the usability survey, so the evaluation reports task completion from the data. |
| `29_no_data_dimensions.sql` | A weighted category with no evidence is left out of the score entirely — no score, and its weight leaves the average — instead of counting as 0.5 or 0. **Supersedes the function bodies in `13_ranking_v6.sql`.** Takes effect on the live ranking as soon as it is applied; `06_run_scoring.py` applies the same rule to the stored scores on its next run. |

**`13_ranking_v6.sql`'s body has been replaced twice since its own migration
ran**: once by `14_`'s safety fix (applied directly, not by re-running this
file), and again by the duration-filtering work in `16_`/`17_`, which folded
`14_`'s fix in and added the window-scoping `17_` needs. The file on disk
always reflects the live function; `14_` stays as the record of the bug
`13_`'s original text had.

## Not a migration

- `06_run_scoring.py` — not a one-time migration. Re-run this any time the
  underlying evidence changes or the scoring logic itself changes; it always
  writes a new scoring run (never edits an old one) and reads the framework
  shape from `ref.framework_category` / `ref.sub_point`, not from anything
  hardcoded here.
- `data/` — the six CSVs `03_load_data.py` loads: `provider.csv`,
  `review.csv`, `owner_reply.csv`, `review_assessment.csv`,
  `evidence_item.csv`, `reply_assessment.csv`. This is the reproducible seed
  dataset, kept so the database can be rebuilt from scratch; it is not
  itself a script.
