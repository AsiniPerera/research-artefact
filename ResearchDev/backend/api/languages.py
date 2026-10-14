"""The languages a business's reviews are written in.

Helper for main.py, which calls languages_for when building a provider
profile. Display only: it counts reviews and changes no score and no rank.

Only the three languages the detector reports reliably are counted. Reviews
marked 'other' (89 across 64 businesses) and those with no detected language
(8,214 across 500) are left out entirely: folding them in would put a band
reading "Unknown" at the top of 138 businesses, which reports the coverage of
the detector rather than anything about the business.
"""

LANGUAGE_MIN_REVIEWS = 5        # counted reviews needed before showing anything
LANGUAGE_MIN_LANGS = 2          # one language is not a mix

ALLOWED_LANGUAGES = ("english", "sinhala", "english_sinhala_mix")

LANGUAGE_LABELS = {
    "english": "English",
    "sinhala": "Sinhala",
    "english_sinhala_mix": "English and Sinhala",
}

# = any(array) rather than `in (tuple)`: it keeps working if ALLOWED_LANGUAGES
# is ever cut to a single value, where the tuple form becomes invalid SQL.
_SQL = """
select place_id, source_language as lang, count(*) as n
from raw.review
where place_id = any(%(ids)s)
  and source_language = any(%(allowed)s)
group by place_id, source_language
"""


def languages_for(cur, place_ids):
    """{place_id: {"languages": [...], "detected": int, "n_languages": int}}

    `languages` is empty for a business whose reviews are all one language,
    or too few to compare. `detected` and `n_languages` are returned either
    way, so the screen can say WHICH of those it is rather than leaving a
    reader to guess whether the section is missing or broken.
    """
    ids = list({p for p in place_ids if p})
    if not ids:
        return {}
    cur.execute(_SQL, {"ids": ids, "allowed": list(ALLOWED_LANGUAGES)})
    found = {}
    for r in cur.fetchall():
        found.setdefault(r["place_id"], []).append(r)

    out = {}
    for pid in ids:
        langs = sorted(found.get(pid, []), key=lambda r: (-r["n"], r["lang"]))
        total = sum(r["n"] for r in langs)
        base = {"detected": total, "n_languages": len(langs)}
        # The one language, when there is only one. Kept out of `languages`,
        # which stays the gated list the bar and the review filter read: a
        # filter offering a single choice is not a filter. This is here so the
        # screen can name the language instead of saying only that there is
        # one of them.
        if len(langs) == 1:
            base["only_language"] = {
                "code": langs[0]["lang"],
                "label": LANGUAGE_LABELS[langs[0]["lang"]],
                "n": langs[0]["n"],
            }
        if total < LANGUAGE_MIN_REVIEWS or len(langs) < LANGUAGE_MIN_LANGS:
            out[pid] = {"languages": [], **base}
            continue
        out[pid] = {"languages": [{
            "code": r["lang"],
            "label": LANGUAGE_LABELS[r["lang"]],
            "n": r["n"],
            "share": round(r["n"] / total, 2),
        } for r in langs], **base}
    return out
