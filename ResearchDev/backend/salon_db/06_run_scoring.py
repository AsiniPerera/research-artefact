"""Step 6: scoring. Reads the evidence from the database, calculates the scores, writes the score tables.

Framework v4: SEVEN weighted categories plus Overall Verdict.

  1 Quality of the Result                              from review evidence
  2 Consultation, Care & Aftercare                     from review evidence
  3 Management Responsiveness & Continuous Improvement owner replies (3.1-3.4) + customer evidence (3.5)
  4 Customer Trust & Recommendation                    from review evidence
  5 Staff & Customer Service                           from review evidence
  6 Value & Price Honesty                              from review evidence
  7 Safety, Hygiene & Facilities                       from review evidence
  8 Overall Verdict                                    REPORTED ONLY

base_score is the equal-weight mean of categories 1-7. Category 8 is scored and
stored so the app can show it, but it is excluded from the mean and from the
user's weights, which are seven numbers: `overall` summarises the other seven
and would double-count if it sat beside them.

Nothing about the framework is hard-coded here. The weighted categories, which
sub-points are computed, which are safety, and which are gates or vetoes are all
read from ref.framework_category and ref.sub_point, so a change made in
02_reference_data.sql flows through without touching this file.

Run 05_tiers_and_scoring_schema.sql in the Supabase SQL Editor first. Then, in this folder:
    python 06_run_scoring.py
It asks for the database password (typing is hidden). Safe to re-run: each run is stored as a new scoring run
and the ranking view always shows the latest one.

Needs: psycopg2-binary, pandas, numpy, scipy  (all included with Anaconda except psycopg2-binary).
"""
import os, sys, json, getpass, re
from collections import defaultdict
import numpy as np
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
from scipy.stats import beta

# ---------------- connection (same details as the loader) ----------------
HOST = 'aws-0-ap-southeast-1.pooler.supabase.com'
PORT = 5432
USER = 'postgres.wxmyoommtwxsdashxzki'
DBNAME = 'postgres'

# ---------------- parameters: every number the scoring uses is here ----------------
P = {
    'window_months': 24,                 # gate / veto / safety evidence window and expiry
    'min_days_apart': 7,                 # independence of two reports
    'gate_penalty': 0.15,
    # Gates only bite where the service calls for them. Framework v4 marks no
    # sub-point as a gate, so this is empty and no penalty is ever applied; a
    # gate added to ref.sub_point but not listed here defaults to tier 1, i.e.
    # it applies everywhere.
    'gate_min_tier': {},
    'range_level': 0.80,
    'max_range_width_by_tier': {1: 0.50, 2: 0.45, 3: 0.40, 4: 0.35, 5: 0.30},
    'confidence_weight': {'high': 1.0, 'medium': 0.7, 'low': 0.3},
    'damage_multiplier': 2.0,            # "damage counts double"
    'recency_half_life_months': 24,      # an item this old counts half
    'specificity_weight': {'same_sub_service': 1.0, 'same_service': 0.75, 'provider_level': 0.5, 'other_service_provider_trait': 0.25, 'other_service_outcome': 0.0},
    # Categories that describe the SALON rather than one service, so evidence
    # from another service still says something about them. Framework v4:
    # 3 management responsiveness, 4 customer trust, 5 staff & customer service,
    # 6 value & price honesty, 7 safety, hygiene & facilities. Categories 1
    # (quality of work) and 2 (consultation, care & aftercare) are service
    # outcomes and do not travel.
    'provider_trait_categories': [3, 4, 5, 6, 7],
    'prior': [1.0, 1.0],                 # Beta(1,1): no evidence = neutral 0.5
    'category3_method': 'v5',
    'promise_window_months': 12,
    'min_before_reviews_for_promise': 10,
    'min_after_reviews_for_promise': 10,
    'stance_score': {'accepts / apologises': 1.0, 'accepts and disputes (mixed)': 0.75, 'disputes the report': 0.5, 'neither accepts nor disputes': 0.25},
    # Filled from ref.sub_point.is_safety below, so the framework decides this
    # rather than a list that has to be kept in step with it. Stored in
    # score.scoring_run.parameters, which score.v_provider_caution reads back.
    'safety_sub_points': [],
}
A0, B0 = P['prior']


def connect():
    url = os.environ.get('DATABASE_URL')
    if url:
        return psycopg2.connect(url)
    pw = getpass.getpass('Supabase database password (typing is hidden): ').strip()
    try:
        return psycopg2.connect(host=HOST, port=PORT, user=USER, password=pw, dbname=DBNAME, sslmode='require')
    except psycopg2.OperationalError as e:
        if 'password authentication failed' in str(e):
            sys.exit('Supabase rejected the password.')
        sys.exit('Could not connect:\n' + str(e))


conn = connect()
with conn.cursor() as cur:
    cur.execute("SET statement_timeout = '300s'")
conn.commit()
print('Statement timeout set to 300 s.')
q = lambda sql: pd.read_sql_query(sql, conn)
import warnings; warnings.filterwarnings('ignore', message='pandas only supports SQLAlchemy')

ev = q("""
  select e.review_id, e.place_id, e.service_category_code as cat, e.service_code as svc, e.sub_service_code as sub,
         e.sub_point_code as sp, e.polarity, e.severity, e.confidence, e.reviewer_fault, e.needs_manual_check,
         r.published_at::date as d, left(lower(regexp_replace(coalesce(r.review_text, ''), '\\s+', ' ', 'g')), 200) as txt,
         p.category_no, p.is_score, p.is_gate, p.is_veto, p.is_safety, p.is_computed, p.is_reported_only
  from extract.evidence_item e
  join raw.review r using (review_id)
  join ref.sub_point p on p.code = e.sub_point_code""")
# ---------------- the framework decides the shape of the scoring ----------------
fc = q("select category_no, name, weight from ref.framework_category order by category_no")
spx = q("select code, category_no, is_score, is_reported_only, is_computed, is_safety from ref.sub_point order by category_no, sort_order")
WEIGHTED = [int(c) for c in fc.loc[fc['weight'] > 0, 'category_no']]        # 1 .. 7
REPORTED = [int(c) for c in fc.loc[fc['weight'] <= 0, 'category_no']]       # 8, Overall Verdict
ALL_CATS = WEIGHTED + REPORTED
# The category whose sub-points are computed from owner replies rather than from
# review text, and the sub-points inside it that are. Framework v4: 3.1 only.
COMPUTED_SP = list(spx.loc[spx['is_computed'], 'code'])
REPLY_CATS = sorted({int(c) for c in spx.loc[spx['is_computed'], 'category_no']})
P['safety_sub_points'] = list(spx.loc[spx['is_safety'], 'code'])
print(f"Framework: {len(WEIGHTED)} weighted categories {WEIGHTED}, reported only {REPORTED}")
print(f"Safety sub-points: {P['safety_sub_points']}   computed: {COMPUTED_SP or 'none'}")

dim = q("select sub_service_code, service_code, category_code, tier from ref.dim_service")
if dim['tier'].isna().any():
    sys.exit('Tiers are missing. Run 05_tiers_and_scoring_schema.sql first.')
rep = q("""
  select distinct on (o.review_id) o.review_id, r.place_id, o.reply_date::date as reply_date,
         a.specificity, a.stance, a.remedy_offered, a.commitment_made, a.commitment_issue
  from raw.owner_reply o join raw.review r using (review_id)
  left join extract.reply_assessment a using (review_id)
  order by o.review_id, a.run_id desc nulls last""")
rep['reply_date'] = pd.to_datetime(rep['reply_date'])
revs = q("""
  select distinct on (r.review_id) r.review_id, r.place_id, r.published_at::date as d,
         coalesce(trim(r.review_text), '') <> '' as has_text, ra.overall_sentiment as sentiment
  from raw.review r left join extract.review_assessment ra using (review_id)
  order by r.review_id, ra.run_id desc nulls last""")
revs['d'] = pd.to_datetime(revs['d'])
ref_date = pd.Timestamp(q("select max(published_at)::date as d from raw.review")['d'][0])
print(f'Evidence items: {len(ev):,}   Reference date: {ref_date.date()}')

ev['d'] = pd.to_datetime(ev['d'])
ev['age_m'] = (ref_date - ev['d']).dt.days / 30.44
sub2svc = dict(zip(dim.sub_service_code, dim.service_code)); sub2cat = dict(zip(dim.sub_service_code, dim.category_code))
svc2cat = dict(zip(dim.service_code, dim.category_code)); tier = dict(zip(dim.sub_service_code, dim.tier.astype(int)))
ev['svc'] = ev['svc'].where(ev['sub'].isna(), ev['sub'].map(sub2svc))        # most specific level known
ev['cat'] = ev['cat'].where(ev['svc'].isna(), ev['svc'].map(svc2cat))
in_window = ev['age_m'] <= P['window_months']
negish = ev['polarity'].isin(['negative', 'mixed'])

# ================= 1. Gates and vetoes (provider-wide) =================
disputed = set(rep.loc[rep['stance'] == 'disputes the report', 'review_id'])
qual = ev[in_window & negish & ~ev['reviewer_fault'] & ~ev['needs_manual_check']]


def independent_reports(g):
    """Different reviews, not near-copies; returns (count, first, last, days span)."""
    g = g.drop_duplicates('review_id').drop_duplicates('txt')
    return g


gv_rows = []; gates_applied = defaultdict(list); veto_applied = set(); veto_caution = set()
for (pid, sp), g in qual[qual['is_gate'] | qual['is_veto']].groupby(['place_id', 'sp']):
    g = independent_reports(g)
    n = len(g); first, last = g['d'].min(), g['d'].max()
    kind = 'veto' if bool(g['is_veto'].iloc[0]) else 'gate'
    met = n >= 2 and (last - first).days >= P['min_days_apart']
    status = (f'{kind} applied') if met else ('caution' if kind == 'veto' else 'badge')
    gv_rows.append((pid, sp, kind, status, n, int(g['review_id'].isin(disputed).sum()), first.date(), last.date(),
                    (last + pd.DateOffset(months=P['window_months'])).date()))
    if status == 'gate applied': gates_applied[pid].append(sp)
    if status == 'veto applied': veto_applied.add(pid)
    if status == 'caution': veto_caution.add(pid)

# ================= 2. Safety line (provider-wide) =================
saf = qual[qual['sp'].isin(P['safety_sub_points']) | (qual['severity'] == 'damage')]
safety = {}
for pid in ev['place_id'].unique():
    safety[pid] = ('clear', 0, 0, None)
for pid, g in saf.groupby('place_id'):
    g2 = independent_reports(g)
    n = len(g2); dmg = int((g2['severity'] == 'damage').sum())
    spread = (g2['d'].max() - g2['d'].min()).days >= P['min_days_apart']
    safety[pid] = ('caution' if (n >= 2 and spread) else 'clear', n, dmg,
                   f'{n} independent safety or damage reports in {P["window_months"]} months' if (n >= 2 and spread) else None)
for pid in veto_caution:
    s = safety.get(pid, ('clear', 0, 0, None))
    safety[pid] = ('caution', s[1], s[2], (s[3] + '; ' if s[3] else '') + 'single veto-type report')
for pid in veto_applied:
    s = safety.get(pid, ('clear', 0, 0, None))
    safety[pid] = ('safety concern', s[1], s[2], 'veto applied: 2 or more independent reports')

# ================= 3. Category 3, parts 3.1-3.4 (provider-wide, framework v5) =================
# A complaint is a review with text whose overall_sentiment is not positive,
# weighted 0.5 ** (age_months / 24). Part 3.5 is customer evidence, scored per
# sub-service in section 4.
REPLY_SP = ['3.1', '3.2', '3.3', '3.4']
SPEC_VALUE = {'specific': 1.0, 'partly specific': 0.5, 'generic': 0.0}

revs['w'] = np.power(0.5, ((ref_date - revs['d']).dt.days / 30.44).clip(lower=0) / P['recency_half_life_months'])
comp = revs[revs['has_text'] & revs['sentiment'].notna() & (revs['sentiment'] != 'positive')]
comp = comp.merge(rep.drop(columns='place_id'), on='review_id', how='left', indicator=True)
comp['replied'] = comp['_merge'] == 'both'

reply_parts = {}   # pid -> [part scores, complaint weight, complaint count]
for pid, c in comp.groupby('place_id'):
    parts, W = [], float(c['w'].sum())
    if W > 0:                                                                   # 3.1 complaints answered
        parts.append((A0 + c.loc[c['replied'], 'w'].sum()) / (A0 + B0 + W))
    r = c[c['replied']]
    s = r[r['specificity'].isin(SPEC_VALUE.keys())]
    if s['w'].sum() > 0:                                                        # 3.2 specificity
        parts.append((A0 + (s['w'] * s['specificity'].map(SPEC_VALUE)).sum()) / (A0 + B0 + s['w'].sum()))
    s = r[r['stance'].isin(P['stance_score'].keys())]
    if s['w'].sum() > 0:                                                        # 3.3 stance + remedy
        v = (s['stance'].map(P['stance_score'])
             + s['remedy_offered'].fillna(False).infer_objects(copy=False).astype(float)) / 2
        parts.append((A0 + (s['w'] * v).sum()) / (A0 + B0 + s['w'].sum()))
    reply_parts[pid] = [parts, W, len(c)]

# 3.4 promises: did complaints on the promised issue fall after the reply?
text_rev = revs[revs['has_text']]
neg_rev = ev.loc[ev['polarity'] == 'negative', ['place_id', 'review_id', 'sp']]
win = pd.DateOffset(months=P['promise_window_months'])
ISSUE_TAGS = [
    ('waiting',         ['5.4']),
    ('staff',           ['5.1']),
    ('service outcome', [c for c in spx['code'] if c.startswith('1.')]),
    ('price',           [c for c in spx['code'] if c.startswith('6.')]),
    ('hygiene',         ['7.1', '7.2', '7.3']),
]


def promise_points(issue):
    """Union of sub-points named by the ';'-separated tags; empty if none map."""
    pts = set()
    for tag in str(issue or '').lower().split(';'):
        for key, sps in ISSUE_TAGS:
            if key in tag:
                pts.update(sps)
    return pts


def promise_outcome(pid, reply_date, issue):
    pts = promise_points(issue)
    if pd.isna(reply_date) or not pts:
        return 'not testable'
    t = text_rev[text_rev['place_id'] == pid]
    before = t[(t['d'] >= reply_date - win) & (t['d'] < reply_date)]
    after = t[(t['d'] > reply_date) & (t['d'] <= reply_date + win)]
    if len(before) < P['min_before_reviews_for_promise'] or len(after) < P['min_after_reviews_for_promise']:
        return 'not testable'
    nv = neg_rev[(neg_rev['place_id'] == pid) & neg_rev['sp'].isin(pts)]
    n_before = nv.loc[nv['review_id'].isin(before['review_id']), 'review_id'].nunique()
    n_after = nv.loc[nv['review_id'].isin(after['review_id']), 'review_id'].nunique()
    share_before, share_after = n_before / len(before), n_after / len(after)
    if share_after < share_before:
        return 'kept'
    if n_after >= 2:
        return 'broken'
    return 'no clear change'


commitment_rows = []
kept_broken = defaultdict(lambda: [0, 0])
for row in rep[rep['commitment_made'].fillna(False).infer_objects(copy=False).astype(bool)].itertuples():
    out = promise_outcome(row.place_id, row.reply_date, row.commitment_issue)
    commitment_rows.append((row.review_id, row.commitment_issue or 'not identified', out))
    if out == 'kept': kept_broken[row.place_id][0] += 1
    elif out == 'broken': kept_broken[row.place_id][1] += 1
for pid, (k, b) in kept_broken.items():
    if k + b:
        reply_parts.setdefault(pid, [[], 0.0, 0])[0].append((A0 + k) / (A0 + B0 + k + b))

# ================= 4. Category and trust scores per provider x sub-service =================
# Reported-only sub-points are included: `overall` carries 10,296 of the 44,526
# evidence rows, and category 8 is meant to be shown even though it is never
# weighted. Computed sub-points are excluded because they are not read from
# review text at all.
sc = ev[(ev['is_score'] | ev['is_reported_only']) & ~ev['is_computed'] & ~ev['sp'].isin(REPLY_SP)
        & ev['polarity'].isin(['positive', 'negative', 'mixed'])].copy()
sc['w0'] = sc['confidence'].map(P['confidence_weight']) * np.power(0.5, sc['age_m'].clip(lower=0) / P['recency_half_life_months'])
sc['pos'] = sc['polarity'].map({'positive': 1.0, 'mixed': 0.5, 'negative': 0.0})
sc['neg'] = (1 - sc['pos']) * np.where(sc['severity'] == 'damage', P['damage_multiplier'], 1.0)
SW = P['specificity_weight']; TRAIT = set(P['provider_trait_categories'])
lo_q, hi_q = (1 - P['range_level']) / 2, 1 - (1 - P['range_level']) / 2
cat_rows = []; trust_rows = []

for pid, g in sc.groupby('place_id'):
    pe = ev.loc[ev['place_id'] == pid]
    targets = sorted(x for x in pe['sub'].dropna().unique())
    # If no sub_service_code in evidence, infer target sub-services from
    # service_code and service_category_code that ARE present.
    if not targets:
        svcs_present = set(pe['svc'].dropna().unique())
        cats_present = set(pe['cat'].dropna().unique())
        inferred = set()
        for ss, sv in sub2svc.items():
            if sv in svcs_present:
                inferred.add(ss)
            elif sub2cat.get(ss) in cats_present:
                inferred.add(ss)
        targets = sorted(inferred)
    if not targets:
        continue
    sub = g['sub'].to_numpy(dtype=object); svc = g['svc'].to_numpy(dtype=object); cat = g['cat'].to_numpy(dtype=object)
    cno = g['category_no'].to_numpy(); w0 = g['w0'].to_numpy(); pos = g['pos'].to_numpy(); neg = g['neg'].to_numpy()
    rid = g['review_id'].to_numpy()
    trait = np.isin(cno, list(TRAIT))
    # Reported-only categories are scored and stored, but they are not part of
    # base_score, so they must not lend it precision either.
    weighted = np.isin(cno, WEIGHTED)
    sub_none = pd.isna(sub); svc_none = pd.isna(svc); cat_none = pd.isna(cat)
    for s in targets:
        s_svc, s_cat = sub2svc[s], sub2cat[s]
        spec = np.where(sub == s, SW['same_sub_service'],
               np.where(sub_none & (svc == s_svc), SW['same_service'],
               np.where(sub_none & svc_none & (cat_none | (cat == s_cat)), SW['provider_level'],
               np.where(trait, SW['other_service_provider_trait'], SW['other_service_outcome']))))
        w = w0 * spec
        use = w > 0
        Pw, Nw = w * pos, w * neg
        # Every category, weighted and reported alike, scored from its own
        # evidence as a Beta posterior. No evidence leaves the Beta(1,1) prior,
        # which is 0.5 — neutral, not bad.
        scores = {}
        for c in ALL_CATS:
            m = use & (cno == c)
            pc, nc = Pw[m].sum(), Nw[m].sum()
            scores[c] = ((A0 + pc) / (A0 + B0 + pc + nc), pc + nc, int(m.sum()))

        # Category 3 = mean of the parts that have evidence: 3.1-3.4 from owner
        # replies (provider-wide) and 3.5, which scores[c] now holds alone.
        for c in REPLY_CATS:
            parts, r_w, r_n = reply_parts.get(pid, ([], 0.0, 0))
            ev_sc, ev_w, ev_n = scores[c]
            got = parts + ([ev_sc] if ev_w > 0 else [])
            scores[c] = (float(np.mean(got)), float(r_w + ev_w), int(r_n + ev_n)) if got else (0.5, 0.0, 0)

        for c in ALL_CATS:
            cat_rows.append((pid, s, c, round(float(scores[c][0]), 4), round(float(scores[c][1]), 3), int(scores[c][2])))

        # Equal weights over the WEIGHTED categories only, 1/7 each. Category 8
        # (Overall Verdict) is stored above but never enters the mean.
        base = float(np.mean([scores[c][0] for c in WEIGHTED]))
        t = tier[s]
        # A gate not named in gate_min_tier applies from tier 1 up.
        g_applied = [x for x in gates_applied.get(pid, []) if t >= P['gate_min_tier'].get(x, 1)]
        pen = P['gate_penalty'] * len(g_applied)
        trust = max(0.0, base - pen)
        # Precision rests on evidence about this service itself, and only on the
        # categories the score is actually built from.
        own = use & weighted & (spec >= SW['same_service'])
        if own.any():                                                         # one review = one unit of evidence, however many points it makes
            od = pd.DataFrame({'rid': rid[own], 'P': Pw[own], 'N': w[own] * (1 - pos[own]), 'w': w[own]}).groupby('rid').agg(P=('P', 'sum'), N=('N', 'sum'), w=('w', 'max'))
            share = od['P'] / (od['P'] + od['N'])
            Pt, Nt = float((od['w'] * share).sum()), float((od['w'] * (1 - share)).sum())
        else:
            Pt, Nt = 0.0, 0.0
        a, b = A0 + Pt, B0 + Nt
        ql, qh = beta.ppf(lo_q, a, b), beta.ppf(hi_q, a, b); mu = a / (a + b)
        width = float(qh - ql)
        low, high = max(0.0, trust - (mu - ql)), min(1.0, trust + (qh - mu))
        st = safety.get(pid, ('clear',))[0]
        if st == 'safety concern': rank_status = 'not ranked: safety concern'
        elif width < P['max_range_width_by_tier'][t]: rank_status = 'ranked'
        else: rank_status = 'available but not ranked'
        badges = '; '.join([f'gate {x}' for x in g_applied] +
                           [f'badge {r[1]}' for r in gv_rows if r[0] == pid and r[3] == 'badge' and t >= P['gate_min_tier'].get(r[1], 1)]) or None
        trust_rows.append([pid, s, t, round(base, 4), round(pen, 2), round(trust, 4), round(low, 4), round(high, 4), round(width, 4),
                           round(float(Pt + Nt), 3), int(len(set(rid[own]))), badges, st, rank_status, None])

# rank inside each sub-service: clear above caution, then by trust score
tr = pd.DataFrame(trust_rows, columns=['place_id', 'sub', 'tier', 'base', 'pen', 'trust', 'low', 'high', 'width', 'ew', 'nrev', 'badges', 'safety', 'status', 'rank'])
rk = tr[tr['status'] == 'ranked'].copy()
rk['clear'] = (rk['safety'] == 'clear')
rk = rk.sort_values(['sub', 'clear', 'trust', 'ew'], ascending=[True, False, False, False])
rk['rank'] = rk.groupby('sub').cumcount() + 1
tr.loc[rk.index, 'rank'] = rk['rank']

# ================= 5. Write =================
with conn, conn.cursor() as cur:
    cur.execute("insert into score.scoring_run (reference_date, parameters) values (%s, %s) returning scoring_run_id", (ref_date.date(), json.dumps(P)))
    run = cur.fetchone()[0]
    execute_values(cur, "insert into score.gate_veto_status values %s", [(run, r[0], r[1], r[2], r[3], int(r[4]), int(r[5]), r[6], r[7], r[8]) for r in gv_rows], page_size=2000)
    execute_values(cur, "insert into score.provider_safety values %s", [(run, pid, v[0], int(v[1]), int(v[2]), v[3]) for pid, v in safety.items()], page_size=2000)
    execute_values(cur, "insert into score.category_score values %s", [(run,) + r for r in cat_rows], page_size=5000)
    execute_values(cur, "insert into score.trust_score values %s",
                   [(run, r['place_id'], r['sub'], int(r['tier']), float(r['base']), float(r['pen']), float(r['trust']), float(r['low']), float(r['high']),
                     float(r['width']), float(r['ew']), int(r['nrev']), (None if pd.isna(r['badges']) else r['badges']), r['safety'], r['status'],
                     None if pd.isna(r['rank']) else int(r['rank'])) for r in tr.to_dict('records')], page_size=5000)
    execute_values(cur, "insert into score.commitment_outcome values %s", [(run,) + r for r in commitment_rows], page_size=2000)
conn.close()

print(f'Scoring run {run} saved.')
print(f'Provider x sub-service scores: {len(tr):,}')
print(tr['status'].value_counts().to_string())
print('Providers by safety status:'); print(pd.Series([v[0] for v in safety.values()]).value_counts().to_string())
print('Gate / veto status rows:'); print(pd.DataFrame(gv_rows)[3].value_counts().to_string() if gv_rows else 'none')