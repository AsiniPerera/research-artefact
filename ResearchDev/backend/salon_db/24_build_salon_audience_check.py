"""Step 24: data/salon_audience_check.csv, one row per salon, to check by hand.

Each row has the salon's Google Maps link (open it to see what the salon offers),
the audience label the app uses now and why, what the reviewers' mix suggests,
the women / men reviewer counts behind that, and an empty YOUR_DECISION column.
Unlabelled salons come first. Reads CSVs only; never touches the database.

    python 24_build_salon_audience_check.py
"""
import csv, importlib.util, json, pathlib, re
from collections import Counter, defaultdict

HERE = pathlib.Path(__file__).parent
spec = importlib.util.spec_from_file_location("fill23", HERE / "23_fill_service_audience.py")
fill23 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fill23)


# Salons that are out of scope for the study (not a beauty salon in the five service
# families), kept out of every audience list.
EXCLUDE = {"ChIJ7xITLwBR4joRWPLdpEsOa-8"}   # phoenix salon dreads & tattoos, Hokandara


def rd(name):
    with open(HERE / "data" / name, encoding="utf-8-sig", errors="replace", newline="") as f:
        return list(csv.DictReader(f))


def suggest(w, m):
    """The rule: reviewers of both kinds -> unisex; only women -> ladies; only men -> gents."""
    if w and m:
        return "unisex", f"{w} women and {m} men reviewers"
    if w:
        return "ladies", f"only women reviewers ({w})"
    if m:
        return "gents", f"only men reviewers ({m})"
    return "", "no reviewer with a classifiable name"


def main():
    names = {r["review_id"]: re.sub(r"[^A-Za-z]", "", (r["reviewer_name"].split() or [""])[0]).lower()
             for r in rd("review_reviewer.csv")}
    cur = json.load(open(HERE.parent / "api" / "provider_audience.json", encoding="utf-8"))
    W, M, N = defaultdict(int), defaultdict(int), defaultdict(int)
    for r in rd("review.csv"):
        N[r["place_id"]] += 1
        g = fill23.gender_of(names.get(r["review_id"], ""))
        if g == "f":
            W[r["place_id"]] += 1
        elif g == "m":
            M[r["place_id"]] += 1
    # Decisions already typed into the sheet are carried over, never reset: this
    # script is safe to re-run while the check is in progress.
    KEY = "YOUR_DECISION (ladies / gents / unisex)"
    typed = {}
    try:
        for name in ("salon_audience_check.csv", "salon_audience_check_new.csv"):
            try:
                for r in rd(name):
                    if r.get("place_id") and (r.get(KEY) or "").strip():
                        typed[r["place_id"]] = r[KEY]
            except OSError:
                pass
    except (OSError, KeyError):
        pass
    out = []
    for p in rd("provider.csv"):
        if p["place_id"] in EXCLUDE:
            continue
        pid = p["place_id"]
        c = cur.get(pid, {})
        sg, why = suggest(W[pid], M[pid])
        out.append({
            "salon": p["name"], "city": p["city"], "google_maps_url": p["place_url"],
            "audience_now": c.get("audience", ""), "basis_now": c.get("basis", ""),
            "reviewers_suggest": sg, "suggest_note": why,
            "women_reviewers": W[pid], "men_reviewers": M[pid], "reviews_held": N[pid],
            "google_rating": p["google_rating"],
            "YOUR_DECISION (ladies / gents / unisex)": typed.get(pid, ""), "place_id": pid,
        })
    out.sort(key=lambda r: (r["audience_now"] != "", r["salon"].lower()))
    target = HERE / "data" / "salon_audience_check.csv"
    try:
        f = open(target, "w", encoding="utf-8-sig", newline="")
    except PermissionError:          # the sheet is open in Excel: don't fail, write beside it
        target = target.with_name("salon_audience_check_new.csv")
        f = open(target, "w", encoding="utf-8-sig", newline="")
    with f:
        w = csv.DictWriter(f, fieldnames=list(out[0]))
        w.writeheader()
        w.writerows(out)
    print("written:", target.name)
    both = [r for r in out if r["audience_now"] and r["reviewers_suggest"]]
    print(f"{len(out)} salons | now: {dict(Counter(r['audience_now'] or '(blank)' for r in out))}")
    print(f"reviewers suggest a label for {sum(1 for r in out if r['reviewers_suggest'])} salons "
          f"({sum(1 for r in out if not r['audience_now'] and r['reviewers_suggest'])} of them unlabelled now)")
    print("where both exist:", dict(Counter("agree" if r["audience_now"] == r["reviewers_suggest"] else "differ" for r in both)))


if __name__ == "__main__":
    main()
