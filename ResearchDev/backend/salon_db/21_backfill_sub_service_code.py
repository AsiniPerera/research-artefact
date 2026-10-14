"""Step 21: backfill extract.evidence_item.sub_service_code from a re-run LLM
extraction pass (data/sub_service_codes.csv), which tags each REVIEW with
1-7 sub-service codes rather than tagging individual evidence rows.

extract.evidence_item.sub_service_code was 0% populated before this (see
06_run_scoring.py's specificity ladder: the "same_sub_service" rung, weight
1.0, was structurally unreachable). This does not try to tag every row --
only where the existing, already-correct per-row service_code resolves the
review-level tags down to exactly one sub-service, or (for the narrow case
where two tagged codes share one service_code, e.g. HR.CUT.01 vs HR.CUT.02)
a hand-built keyword match against evidence_text finds a clear winner.
Everything else -- trait-type rows service_code already left NULL, rows
whose review isn't in this CSV, rows where the old service_code disagrees
with every new tag, and genuinely ambiguous same-service rows with no
textual cue -- is left untouched rather than guessed.

Run:
    set DATABASE_URL=...
    python 21_backfill_sub_service_code.py
"""
import os, csv, pathlib, psycopg2
from psycopg2.extras import execute_values

CSV_PATH = pathlib.Path(__file__).parent / "data" / "sub_service_codes.csv"

# Keyword sets for disambiguating SIBLINGS that share one service_code only
# (e.g. HR.CUT.01 vs HR.CUT.02, both under HR.CUT). Built from ref.dim_service's
# own names plus the words a reviewer is likely to actually use -- "Style Cut
# & Restyling" is never typed verbatim in a review.
KEYWORDS = {
    "HR.CUT.01": ["trim", "usual cut", "regular cut", "same style", "split end", "quick cut"],
    "HR.CUT.02": ["restyle", "re-style", "new look", "new style", "makeover", "transform", "totally different", "change my hair"],
    "SK.BL.01": ["thread", "threading", "lamination", "laminate", "tint", "eyebrow shape"],
    "SK.BL.02": ["lash", "eyelash", "lash lift", "lash extension"],
    "SK.BL.03": ["microblad", "micro-blad", "micropigment", "micro-pigment", "brow tattoo"],
    "BO.BRIDAL.02": ["wedding day", "bridal day", "my wedding", "big day", "bride"],
    "BO.BRIDAL.03": ["homecoming", "engagement", "poruwa"],
    "BO.BRIDAL.04": ["photoshoot", "photo shoot", "bridal party", "bridesmaid"],
    "HR.CHEM.01": ["rebond", "re-bond"],
    "HR.CHEM.02": ["keratin", "smooth", "smoothening", "smoothing"],
    "NL.EXT.01": ["new set", "full set", "acrylic nail", "gel extension", "extension done"],
    "NL.EXT.02": ["refill", "fill in", "nail art", "nail design"],
    "HR.COL.01": ["root touch", "root touch-up", "global colour", "global color", "all over colour", "all over color"],
    "HR.COL.02": ["highlight", "balayage", "ombre"],
    "HR.COL.03": ["bleach", "fashion colour", "fashion color", "vivid", "pastel colour", "pastel color"],
    "HR.TRT.01": ["hair spa", "deep condition"],
    "HR.TRT.02": ["scalp", "dandruff", "hair fall", "hairfall"],
    "HR.TRT.03": ["protein treatment", "botox treatment", "oil treatment"],
    "MG.BEARD.01": ["trim", "line up", "line-up", "lineup"],
    "MG.BEARD.02": ["clean shave"],
    "MG.BEARD.03": ["hot towel"],
    "SK.FAC.01": ["basic facial", "clean-up", "cleanup", "express facial"],
    "SK.FAC.02": ["deep cleans", "anti-aging", "anti aging"],
    "NL.POL.01": ["polish", "gel polish", "apply"],
    "NL.POL.02": ["removal", "remove polish", "take off"],
    "HR.STY.01": ["blow dry", "blowdry", "wash and blow", "wash & blow"],
    "HR.STY.02": ["straighten", "curl", "curls", "curling"],
    "HR.STY.03": ["event", "party hairstyle", "updo", "occasion"],
    "NL.CARE.01": ["manicure", "pedicure", "mani", "pedi"],
    "NL.CARE.02": ["foot spa", "heel care", "heel", "cracked heel"],
}


def build_plan(cur):
    cur.execute("select sub_service_code, service_code from ref.dim_service")
    code_to_service = dict(cur.fetchall())

    csv_tags = {}
    with open(CSV_PATH, encoding="utf-8", errors="replace", newline="") as f:
        r = csv.DictReader(f)
        for row in r:
            codes = [row.get(c, "").strip() for c in r.fieldnames if c.startswith("sub_service_code")]
            codes = [c for c in codes if c]
            if codes:
                csv_tags[row["review_id"]] = codes

    cur.execute("select review_id, evidence_id, service_code, evidence_text from extract.evidence_item")
    all_rows = cur.fetchall()

    counts = {"no_tag": 0, "trait_null": 0, "direct": 0, "conflict": 0,
              "text_matched": 0, "unmatched": 0}
    updates = []  # (sub_service_code, evidence_id)

    for review_id, eid, svc, etext in all_rows:
        tags = csv_tags.get(review_id)
        if tags is None:
            counts["no_tag"] += 1
            continue
        if svc is None:
            counts["trait_null"] += 1
            continue
        candidates = [c for c in tags if code_to_service.get(c) == svc]
        if not candidates:
            counts["conflict"] += 1
            continue
        if len(candidates) == 1:
            counts["direct"] += 1
            updates.append((candidates[0], eid))
            continue
        text = (etext or "").lower()
        scores = {c: sum(1 for kw in KEYWORDS.get(c, []) if kw in text) for c in candidates}
        best = max(scores.values()) if scores else 0
        winners = [c for c, s in scores.items() if s == best and best > 0]
        if len(winners) == 1:
            counts["text_matched"] += 1
            updates.append((winners[0], eid))
        else:
            counts["unmatched"] += 1

    return updates, counts, len(all_rows)


def main():
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()

    print("Before:")
    cur.execute("select count(*) from extract.evidence_item where sub_service_code is not null")
    print(f"  rows with sub_service_code set: {cur.fetchone()[0]}")

    updates, counts, total = build_plan(cur)
    print("\nPlan:")
    for k, v in counts.items():
        print(f"  {k}: {v}")
    print(f"  total evidence rows: {total}")
    print(f"  rows to be updated: {len(updates)}")

    execute_values(
        cur,
        "update extract.evidence_item as e set sub_service_code = v.code "
        "from (values %s) as v(code, evidence_id) "
        "where e.evidence_id = v.evidence_id",
        updates,
        page_size=5000,
    )
    conn.commit()

    print("\nAfter:")
    cur.execute("select count(*) from extract.evidence_item where sub_service_code is not null")
    print(f"  rows with sub_service_code set: {cur.fetchone()[0]}")
    cur.execute("select count(distinct sub_service_code) from extract.evidence_item where sub_service_code is not null")
    print(f"  distinct codes in use: {cur.fetchone()[0]}")

    conn.close()
    print("\nDone.")


if __name__ == "__main__":
    main()
