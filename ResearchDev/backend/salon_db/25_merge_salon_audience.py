"""Step 25: one final Ladies / Gents / Unisex list for all salons.

Order of authority, per salon:
  1. YOUR_DECISION typed in data/salon_audience_check.csv   (a person checked it)
  2. the reviewer rule in data/salon_audience_check_new.csv (both kinds of reviewer
     -> unisex, only women -> ladies, only men -> gents)
  3. the earlier label (salon name / category / review wording)
  4. a cue in the salon's name (wedding / bridal -> ladies, barber / line up -> gents,
     family -> unisex), marked "name cue"
  5. "unisex" as a default, marked "DEFAULT GUESS": there is no evidence at all
     for these salons (1-5 reviews, none by a reviewer with a classifiable name),
     so the label is a placeholder for a person to confirm on the map

Writes data/salon_audience_final.csv, blanks first. Re-run it after saving more
decisions: your typed decisions are read fresh each time and never overwritten.
Reads and writes CSVs only; never touches the database.

    python 25_merge_salon_audience.py
"""
import csv, pathlib, re
from collections import Counter

DATA = pathlib.Path(__file__).parent / "data"
KEY = "YOUR_DECISION (ladies / gents / unisex)"
VALID = {"ladies", "gents", "unisex"}


# Salons that are out of scope for the study (not a beauty salon in the five service
# families), kept out of every audience list.
EXCLUDE = {"ChIJ7xITLwBR4joRWPLdpEsOa-8"}   # phoenix salon dreads & tattoos, Hokandara


def rd(name):
    with open(DATA / name, encoding="utf-8-sig", errors="replace", newline="") as f:
        return list(csv.DictReader(f))


def main():
    latest = rd("salon_audience_check_new.csv")          # newest rule output
    # Decisions are read from BOTH check sheets: Excel may have one open, in which case
    # the rebuild writes beside it as salon_audience_check_new.csv. A decision typed in
    # either counts; if the two disagree the _new sheet (the one being worked on) wins.
    mine = {}
    for name in ("salon_audience_check.csv", "salon_audience_check_new.csv"):
        try:
            for r in rd(name):
                v = (r.get(KEY) or "").strip().lower()
                if r.get("place_id") and v:
                    mine[r["place_id"]] = v
        except OSError:
            pass
    out = []
    for r in latest:
        pid = r["place_id"]
        if pid in EXCLUDE:
            continue
        d = mine.get(pid, "")
        if d in VALID:
            final, by = d, "you"
        elif d:                                          # typed something that is not a valid label
            final, by = "", f"CHECK: '{d}' is not ladies / gents / unisex"
        elif r["reviewers_suggest"]:
            final, by = r["reviewers_suggest"], "reviewer rule: " + r["suggest_note"]
        elif r["audience_now"]:
            final, by = r["audience_now"], "earlier label: " + r["basis_now"]
        else:
            n = r["salon"]
            if re.search(r"wedding|bridal|bride|ladies", n, re.I):
                final, by = "ladies", "name cue: wedding / bridal / ladies in the name (no reviewer evidence)"
            elif re.search(r"barber|gents|line ?up", n, re.I):
                final, by = "gents", "name cue: barber / gents / line up in the name (no reviewer evidence)"
            elif re.search(r"family", n, re.I):
                final, by = "unisex", "name cue: 'family' in the name (no reviewer evidence)"
            else:
                final, by = "unisex", "DEFAULT GUESS: no evidence at all (1-5 reviews, none by a classifiable reviewer), please confirm on the map"
        out.append({"salon": r["salon"], "city": r["city"], "google_maps_url": r["google_maps_url"],
                    "final_audience": final, "filled_by": by,
                    "women_reviewers": r["women_reviewers"], "men_reviewers": r["men_reviewers"],
                    "reviews_held": r["reviews_held"], "place_id": pid})
    out.sort(key=lambda r: (r["final_audience"] != "", r["salon"].lower()))
    target = DATA / "salon_audience_final.csv"
    try:
        f = open(target, "w", encoding="utf-8-sig", newline="")
    except PermissionError:
        target = target.with_name("salon_audience_final_new.csv")
        f = open(target, "w", encoding="utf-8-sig", newline="")
    with f:
        w = csv.DictWriter(f, fieldnames=list(out[0]))
        w.writeheader()
        w.writerows(out)
    print("written:", target.name)
    print(f"{len(out)} salons | filled {sum(1 for r in out if r['final_audience'])}, blank {sum(1 for r in out if not r['final_audience'])}")
    print("final:", dict(Counter(r["final_audience"] or "(blank)" for r in out)))
    print("by source:", dict(Counter(r["filled_by"].split(":")[0] for r in out)))


if __name__ == "__main__":
    main()
