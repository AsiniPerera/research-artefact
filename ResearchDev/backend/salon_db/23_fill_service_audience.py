"""Step 23: fill the Ladies / Gents / Unisex column of data/service_audience.csv
from who actually reviews each sub-service.

For every review that the sub-service tagging (data/sub_service_codes.csv) links
to a sub-service, the reviewer's first name (data/review_reviewer.csv, personal
data, git-ignored) is classified male / female / unknown. A sub-service's
audience follows the mix of reviewers writing about it:

    mostly women           -> ladies
    mostly men             -> gents
    a real mix of both     -> unisex
    too few classified     -> the parent service's mix is used when that is large
                              enough (marked "service-level"), else left blank

Every filled row says which evidence it rests on in `confidence`:
    evidence               clear-cut from this sub-service's own reviewers
    evidence-borderline    close to a cut-off between two labels: check it
    service-level          too few reviewers of its own; inherits the parent service
    name-based             no reviewer evidence at all; judged from the service name
    high / medium          filled by a person from the service name, kept as is

A first name is only a proxy for gender, so this is evidence, not a fact, and the
sheet records the counts behind every label. Rows the sheet already had filled
by hand are kept as they were and marked when the evidence disagrees.

Reads CSVs only; never touches the database.

    python 23_fill_service_audience.py
"""
import csv, pathlib, re
from collections import defaultdict

import gender_guesser.detector as gd

HERE = pathlib.Path(__file__).parent
DATA = HERE / "data"

# ── first-name lists ────────────────────────────────────────────────
# The common Sri Lankan first names in this data, which the general-purpose
# library does not know. Ambiguous names (Shamila, Nadeera, Kavishka ...) are
# deliberately absent: leaving a reviewer unknown is better than guessing.
MALE = set("""
kasun tharindu lahiru isuru gayan pasindu dilshan supun sameera thilina udara nuwan buddhika sahan dhanushka kavindu
chathura sandun tharaka rasika ravindu chamila asanka hasitha shehan ashan eranga indika tharanga charith chamika
gihan heshan ishan chamara pasan janith ruwan nimesh sanjaya rajitha thushara sampath avishka kanishka chathuranga
sumudu sanjeewa chanaka lakshan sachith nadun chamod ruchira kalana sajith chanuka pathum malith sachintha dinuka
pradeep muditha chamath niluka lakshitha hiran damith pubudu dasun shanaka vihanga yasiru janaka kavinda dimuthu
chaminda sandaru nipun naveen viraj navoda kushan kumudu nisal thusitha nalin danushka nilanka dileepa ashen thisara
yohan hashan praveen chamindu lasitha yasas duminda uditha priyantha saman janitha vimukthi prageeth asitha rukshan
indunil asela udesh charuka randima prabath thiwanka imesh ayesh upul samith dushan buddika rangana harshana kosala
dineth nishantha lakmal adithya dilanka akalanka dharshana sanka waruna suresh chinthaka ajith kelum jagath kaveen
osanda sandeepa devinda dulan dilum dananjaya sanath nipuna harsha sachithra shan thilanka dinesh mahesh ruwantha
chathuranga sudesh sudeepa anuradha_m gimhan nuwanthika_m rohan rohana lakshman mohamed mohammed muhammad ahamed
ahmed ali rizwan ashraf nazeer faizal fazil rifan kumar ravi arun vijay kannan rajan prabhu hasan hussain ibrahim
imran irfan nimal sunil kamal sisira ranjith lalith jayantha nandana wasantha rukman tilan tilak
amila dilan akila aruna manjula nirmal roshan manoj prasad pramod
""".split())
FEMALE = set("""
sanduni thilini sachini dilini nethmi tharushi hiruni nadeesha gayani iresha nipuni piyumi bhagya piumi chathurika
hashini nimesha achini kaveesha hansi dinusha kasuni dinithi harshani shehani hasini janani gayathri sandali wathsala
chathuri hansani pavithra jayani isuri shashini ishani shashika malsha erandi nisansala amali chamodi sewwandi chalani
thanuja anusha upeksha imasha gimhani hansika nadeeka dilki ruwani ruvini malki nayomi kavindi lakshika vindya nadee
nirosha ashani kavindya sajani ishini dilshani madusha kaushi madushani harshi navodya dilani maneesha tharu naduni
dulani senuri heshani lakshani imesha tharusha aruni ridmi supuni umesha udari anjalee rashini nishadi kalpani dilhani
waruni himasha dilmi thamali kalani thushari chamari buddhini oshani pavani nilusha fathima lakmali inoka deshani
dilrukshi uthpala lihini madushika menaka gihani maheshi dinushi maheshika amasha manori yashodha lakshi harini
tharushika shashikala roshini lakmini chamali chami chamathka oshadi nimasha shalika poornima sashini madushi nethmini
nilmini sashika taniya eshani vishmi ruwanthi dasuni dewmini roshani nirmani hirushi hansini nadeeshani kushani malithi
kithmini dewmi apsara oshadhi sandani chamini ushani poorni pabasara sewmini nilakshi malshi nishani sajini minoli
udeshika vinuri sakuni upeka hasara ashini tharindi amandi thisuri jeewanthi sathsarani savindi danushi saduni sujani
rashmika himali ayodya sithara anoma jeewani mihiri purnima imashi dilsha hashi chathumini ruwini chamudi oshini sasini
prasadi sithumini anuththara dilshi parami tharani sulochana poorna krishanthi uththara shalani kamani sammani varuni
methma nethma siluni darshi anushika githmi himashi shehara kushani nuwanthi hiranya amaya sandya nadeesha sewwandi
priya divya kavitha nisha farzana shafna aisha ayesha nusrath rizna mariam sumaiya fazna shaheena rukshana
janaki kaushalya shanika anushka sonali sayuri
""".split())
FEMALE_END = ("ani", "ini", "uni", "shi", "nthi", "anthi", "mali", "kshi", "mini", "wini", "ushi", "ndi", "madi", "ika")
MALE_END = ("indu", "anga", "anka", "itha", "ith", "han", "sun", "uka", "eth", "ndra", "nuka")

det = gd.Detector(case_sensitive=False)
_cache = {}


def gender_of(first):
    """'m', 'f' or None, by: the lists above, then the library, then name endings."""
    if first in _cache:
        return _cache[first]
    g = None
    if len(first) >= 2:
        if first in MALE:
            g = "m"
        elif first in FEMALE:
            g = "f"
        else:
            lib = det.get_gender(first.capitalize())
            if lib in ("male", "mostly_male"):
                g = "m"
            elif lib in ("female", "mostly_female"):
                g = "f"
            elif len(first) >= 5:
                if first.endswith(MALE_END):
                    g = "m"
                elif first.endswith(FEMALE_END):
                    g = "f"
    _cache[first] = g
    return g


def read(name):
    with open(DATA / name, encoding="utf-8-sig", errors="replace", newline="") as f:
        return list(csv.DictReader(f))


LADIES_MAX, GENTS_MIN, MIN_REVIEWERS = 0.14, 0.60, 20

# Sub-services with no usable reviewer evidence at all, filled from what the
# service is. Marked "name-based", the weakest basis in the sheet: please check.
FROM_NAME = {
    "BO.OCC.01": ("ladies", "party, birthday and event makeup: mostly women, no reviewer evidence"),
    "BO.OCC.02": ("ladies", "HD and photoshoot makeup: mostly women, no reviewer evidence"),
    "BO.OCC.03": ("ladies", "mehendi / henna application: mostly women, no reviewer evidence"),
}


def classify(m, f):
    """(label, confidence, note) from weighted male / female reviewer counts."""
    n = m + f
    if n < MIN_REVIEWERS:
        return "", "", "too few reviewers with a classifiable name"
    share = m / n
    label = "ladies" if share <= LADIES_MAX else "gents" if share >= GENTS_MIN else "unisex"
    near = abs(share - LADIES_MAX) <= 0.04 or abs(share - GENTS_MIN) <= 0.08
    note = f"{share:.0%} of reviewers are men, {1 - share:.0%} women"
    return label, "evidence-borderline" if near else "evidence", note


def main():
    names = {}
    for r in read("review_reviewer.csv"):
        t = re.sub(r"[^A-Za-z]", "", (r["reviewer_name"].split() or [""])[0]).lower()
        names[r["review_id"]] = t

    # reviewer classification coverage, for the record
    cls = [gender_of(t) for t in names.values()]
    known = sum(1 for g in cls if g)
    print(f"reviewers with a classifiable first name: {known:,} of {len(cls):,} ({known / len(cls):.0%})")

    m = defaultdict(float)
    f_ = defaultdict(float)
    n_rev = defaultdict(int)
    for r in read("sub_service_codes.csv"):
        codes = [r.get(c, "").strip() for c in r if c.startswith("sub_service_code")]
        codes = [c for c in codes if c]
        g = gender_of(names.get(r["review_id"], ""))
        if not codes:
            continue
        for c in codes:
            n_rev[c] += 1
            if g == "m":
                m[c] += 1 / len(codes)
            elif g == "f":
                f_[c] += 1 / len(codes)

    # the same counts pooled over the parent service (HR.CUT, SK.FAC ...)
    svc_m, svc_f = defaultdict(float), defaultdict(float)
    for c in set(list(m) + list(f_)):
        svc_m[c.rsplit(".", 1)[0]] += m[c]
        svc_f[c.rsplit(".", 1)[0]] += f_[c]

    rows = read("service_audience.csv")
    for r in rows:
        c = r["sub_service_code"]
        svc = c.rsplit(".", 1)[0]
        label, conf, why = classify(m[c], f_[c])
        basis = f"{f_[c]:.0f} women, {m[c]:.0f} men reviewing this sub-service"
        if not label:
            label, conf, why = classify(svc_m[svc], svc_f[svc])
            if label:
                conf = "service-level"
                basis = f"{svc_f[svc]:.0f} women, {svc_m[svc]:.0f} men reviewing {svc}, its parent service"
        r["reviews_tagged"] = n_rev[c]
        r["reviewers_women"] = round(f_[c], 1)
        r["reviewers_men"] = round(m[c], 1)
        r["evidence_audience"] = label
        r["evidence_note"] = why if label else "too few reviewers, and so few at service level too"
        hand = r["audience"]
        if not hand and label:
            r["audience"], r["confidence"] = label, conf
            r["why_filled"] = f"reviewer mix: {why} ({basis})"
        elif not hand and not label and c in FROM_NAME:
            r["audience"], r["confidence"] = FROM_NAME[c][0], "name-based"
            r["why_filled"] = FROM_NAME[c][1]
        elif hand and label and hand != label:
            r["notes"] = (r.get("notes", "") + f" | CHECK: filled {hand} by name, reviewers say {label}").strip(" |")

    cols = list(rows[0].keys())
    with open(DATA / "service_audience.csv", "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(rows)

    filled = [r for r in rows if r["audience"]]
    print(f"{len(filled)} of {len(rows)} sub-services filled; {len(rows) - len(filled)} blank")
    print(f"{'code':13s} {'sub-service':34s} {'audience':7s} {'basis':20s} women   men")
    for r in rows:
        print(f"{r['sub_service_code']:13s} {r['sub_service'][:34]:34s} {r['audience']:7s} {r['confidence']:20s} "
              f"{r['reviewers_women']:>6} {r['reviewers_men']:>5}  {'<- CHECK' if 'CHECK' in r['notes'] else ''}")


if __name__ == "__main__":
    main()
