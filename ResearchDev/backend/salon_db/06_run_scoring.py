"""Step 6: scoring. Reads the evidence, calculates the scores, writes the score tables.

The one place a score is produced. The API only serves what this writes, so a
number shown beside a salon comes from a run of this file and nothing else.

NINE categories, seven of which carry weight:

  1 Quality of the Result                              from review evidence
  2 Consultation, Care & Aftercare                     from review evidence
  3 Management Responsiveness & Continuous Improvement owner replies (3.1-3.4)
                                                       + customer evidence (3.5)
                                                       REPORTED ONLY, weight 0
  4 Customer Trust & Recommendation                    from review evidence
  5 Staff & Customer Service                           from review evidence
  6 Value & Price Honesty                              from review evidence
  7 Safety, Hygiene & Facilities                       from review evidence
  8 Overall Verdict                                    REPORTED ONLY, weight 0
  9 Service Expertise & Consistency                    computed by rule, not
                                                       read from review text

base_score is the equal-weight mean over whichever categories carry weight, so
it is the mean of 1, 2, 4, 5, 6, 7 and 9. Categories 3 and 8 are scored and
stored so the app can show them, and excluded from the mean: 8 summarises the
others and would double-count, and 3 is reported only.

The reader's own weights are NOT applied here. This writes one score per
category and the ranking functions in 13_ranking_v6.sql combine them per
request, which is why re-weighting never needs a re-score.

Nothing about the framework is hard-coded. Which categories carry weight, which
sub-points are computed or safety, and which are gates or vetoes are all read
from ref.framework_category and ref.sub_point, so a change made in
01_schema_and_reference_data.sql flows through without touching this file.
The one exception is REPLY_SP below, which names the four owner-reply parts
directly.

Run 05_tiers_and_scoring_schema.sql in the Supabase SQL Editor first. Then, in
this folder:
    python 06_run_scoring.py
It asks for the database password unless DATABASE_URL is set; typing is hidden.
Safe to re-run: every run is stored as a new scoring run and the ranking always
reads the latest, so a bad run is undone by running it again rather than by
repairing rows.

Needs: psycopg2-binary, pandas, numpy, scipy (all with Anaconda except psycopg2-binary).
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
    # The tier a gate starts applying from, per sub-point code. A gate only
    # bites where the service is irreversible enough for it to matter.
    #
    # INERT: no sub-point in ref.sub_point is marked is_gate, so no gate is
    # ever detected, gates_applied is always empty and gate_penalty is always
    # 0. The machinery is kept because it is part of the framework and a gate
    # added to ref.sub_point starts working with no change here — such a gate
    # is not listed in this dict, so it defaults to tier 1 and applies
    # everywhere, which is the safe direction.
    'gate_min_tier': {},
    'range_level': 0.80,
    'max_range_width_by_tier': {1: 0.50, 2: 0.45, 3: 0.40, 4: 0.35, 5: 0.30},
    'confidence_weight': {'high': 1.0, 'medium': 0.7, 'low': 0.3},
    'damage_multiplier': 2.0,            # "damage counts double"
    'recency_half_life_months': 24,      # an item this old counts half
    'specificity_weight': {'same_sub_service': 1.0, 'same_service': 0.75, 'provider_level': 0.5, 'other_service_provider_trait': 0.25, 'other_service_outcome': 0.0},
    # Categories that describe the SALON rather than one service, so evidence
    # from another service still says something about them at quarter weight:
    # 3 management responsiveness, 4 customer trust, 5 staff & customer
    # service, 6 value & price honesty, 7 safety, hygiene & facilities. A dirty
    # salon is dirty whichever service you booked.
    #
    # Categories 1 (quality of the result) and 2 (consultation, care &
    # aftercare) are outcomes of one service and do not travel. Category 9 is
    # absent because it never passes through the specificity ladder at all: it
    # is computed from review counts further down, not weighted per statement.
    'provider_trait_categories': [3, 4, 5, 6, 7],
    'prior': [1.0, 1.0],                 # Beta(1,1): no evidence = neutral 0.5
    'category3_method': 'v5',
    'promise_window_months': 12,
    'min_before_reviews_for_promise': 10,
    'min_after_reviews_for_promise': 10,
    'stance_score': {'accepts / apologises': 1.0, 'accepts and disputes (mixed)': 0.75, 'disputes the report': 0.5, 'neither accepts nor disputes': 0.25},
    # Category 9's remaining part, 9.2 service specialism (9.1 consistency is
    # removed -- see section 3b). Computed by rule, not read from review
    # text, so it carries no confidence, recency weight or specificity
    # weight. The duration windows it uses are DURATION_WINDOWS, further
    # down, the same ones every category now uses.
    'cat9_min_service_reviews': 5,        # below this, no evidence
    # Filled from ref.sub_point.is_safety below, so the framework decides this
    # rather than a list that has to be kept in step with it. Stored in
    # score.scoring_run.parameters, which score.v_provider_caution reads back.
    'safety_sub_points': [],
}
A0, B0 = P['prior']


def connect():
    # DATABASE_URL first (set by backend/api/set_db_password.py, or exported
    # directly); the password prompt below is the fallback for a machine that
    # has never been set up.
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
WEIGHTED = [int(c) for c in fc.loc[fc['weight'] > 0, 'category_no']]        # 1,2,4,5,6,7,9 today
REPORTED = [int(c) for c in fc.loc[fc['weight'] <= 0, 'category_no']]       # 3,8 today
ALL_CATS = WEIGHTED + REPORTED
# The category whose sub-points are computed from owner replies rather than from
# review text, and the sub-points inside it that are. REPLY_SP must be defined
# before REPLY_CATS because REPLY_CATS is derived from it. Category 9 sub-points
# are also is_computed but are NOT owner-reply parts; deriving from REPLY_SP
# instead of is_computed keeps them out.
REPLY_SP = ['3.1', '3.2', '3.3', '3.4']
COMPUTED_SP = list(spx.loc[spx['is_computed'], 'code'])
REPLY_CATS = sorted({int(spx.loc[spx['code'] == sp, 'category_no'].iloc[0]) for sp in REPLY_SP})
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


# INERT under the current framework: no sub-point in ref.sub_point is marked
# is_gate or is_veto, so this loop's input is always empty, gates_applied and
# veto_applied are never populated, and neither the 'safety concern' status
# below nor the gate penalty further down ever fires. Kept because the
# framework still defines gates and vetoes as a possibility, and a sub-point
# marked either way in ref.sub_point starts working with no change here.
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
# INERT: veto_applied is always empty (see the comment above the gv_rows
# loop), so this branch never runs and no business ever carries the
# 'safety concern' status under the current framework.
for pid in veto_applied:
    s = safety.get(pid, ('clear', 0, 0, None))
    safety[pid] = ('safety concern', s[1], s[2], 'veto applied: 2 or more independent reports')

# ================= 3. Category 3, parts 3.1-3.4 (provider-wide) =================
# A complaint is a review with text whose overall_sentiment is not positive,
# weighted 0.5 ** (age_months / 24). Part 3.5 is customer evidence, scored per
# sub-service in section 4.
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
    """Did complaints about the promised issue fall after the reply? One of
    'kept', 'broken', 'no clear change' or 'not testable'.

    'not testable' when the reply named no issue this maps to, or when there
    are fewer than the minimum reviews on either side of the reply to compare
    a share against — a change seen in three reviews is not a trend.
    Otherwise: the share of reviews on that issue drops after the reply ->
    kept; it does not drop and at least two negative reviews land in the
    after-window -> broken; anything else -> no clear change. A single
    after-window complaint is not enough to call a promise broken.
    """
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

# ================= 3b. Category 9's remaining part: service specialism (9.2) =====
# 9.1 (consistency) is removed. Filtering reviews by duration answers "is
# quality holding up" more directly than a dedicated computed category did,
# and duration filtering is now universal (section 4 below) rather than
# something only Category 9 did. Category 9's weight is 0
# (16_category9_weight_zero.sql) -- reported-only, the same treatment as
# Categories 3 and 8 -- and nothing is coded to 9.1 or 9.2 in review text
# (both are is_computed), so the generic per-category loop in section 4
# leaves it at the neutral prior, 0.5, on every row, same as any
# reported-only category with nothing coded to it.
#
# 9.2 (specialism) survives as a display-only figure: how much of a
# business's service-attributed evidence, within the reader's chosen
# window, concerns one particular service. Read back by
# backend/api/service_specialism.py the same way popular_services reads its
# own badge -- no weight, no ranking effect. Computed fresh inside the
# per-window loop below, from that window's filtered evidence, so the
# specialism tag reflects whichever duration the reader selected too.
CAT9 = 9
HAS_CAT9 = CAT9 in set(ALL_CATS)        # false only if ref.framework_category has no row 9 at all

# Reused by `sc` below. Both columns are NOT NULL in the schema, so these are
# plain bool today; fillna makes the guard survive a nullable column.
NOFAULT = ev['reviewer_fault'].fillna(False).astype(bool)
NOCHECK = ev['needs_manual_check'].fillna(False).astype(bool)

cat9_rows = []                          # -> score.category9_window

# ================= 4. Category and trust scores, per duration window =================
# The reader's chosen duration (6m / 1y / 3y / anytime) decides which
# reviews exist at all for every category below, the service-specific
# scores and the final ranking -- a hard inclusion rule, not a recency
# weight on top of the full history. Anchored to TODAY, today's real
# calendar date, not ref_date (the latest review IN THE DATA, which can lag
# behind it -- 2026-09-17 against an actual today of 2026-10-14 as this
# comment is written): the requirement is reviews from the last 6 months as
# of today, not as of whenever this corpus was last updated.
#
# ref_date and the smooth recency half-life decay above are untouched and
# still apply WITHIN whichever window is selected -- a review from month 5
# of a 6-month window still counts less than one from last week. The two
# mechanisms answer different questions: this section decides IN or OUT,
# recency decay decides how much a statement that got IN still counts.
#
# Gates, vetoes and safety status are NOT re-filtered per window (sections 1
# and 2 above, computed once already): a different business rule -- report
# independence and a fixed 24-month staleness period -- not the reader's
# display preference, and inert regardless today (0 gates or vetoes ever
# fire). Category 3's reply-based scoring (reply_parts, commitment_rows,
# above) is likewise computed once, unwindowed: it is reported-only, never
# ranked, and an owner's reply answers a complaint that can predate the
# reader's chosen window by its very nature.
TODAY = pd.Timestamp(pd.Timestamp.now().date())
DURATION_WINDOWS = {'6m': 6, '1y': 12, '3y': 36, 'all': None}

n_missing_date = int(ev['d'].isna().sum())
if n_missing_date:
    print(f"{n_missing_date:,} evidence rows have no publication date: "
          f"excluded from 6m/1y/3y, included in 'all' if otherwise eligible.")


def duration_mask(d, months):
    """Which rows of date column `d` fall in the last `months` months,
    anchored to TODAY. months=None (the 'all' window) admits every row,
    including a missing date; a bounded window excludes a missing date,
    since membership in it cannot be determined."""
    if months is None:
        return pd.Series(True, index=d.index)
    return d.notna() & (d >= TODAY - pd.DateOffset(months=months)) & (d <= TODAY)


cat_rows = []
trust_frames = []
dropped_no_targets = defaultdict(list)   # window_code -> [place_id, ...]

for window_code, months in DURATION_WINDOWS.items():
    evw = ev[duration_mask(ev['d'], months)]

    # Reported-only sub-points are included: `overall` carries 10,296 of the
    # 44,526 evidence rows, and category 8 is meant to be shown even though
    # it is never weighted. Computed sub-points are excluded because they
    # are not read from review text at all.
    sc = evw[(evw['is_score'] | evw['is_reported_only']) & ~evw['is_computed'] & ~evw['sp'].isin(REPLY_SP)
             & evw['polarity'].isin(['positive', 'negative', 'mixed'])
             # Rule A4 and the manual-check flag, applied here as well as on
             # the safety line. Both columns are NOT NULL today (0 fault
             # rows, 655 manual-check, 1.5%); fillna keeps this correct if
             # that ever changes.
             & ~NOFAULT.loc[evw.index] & ~NOCHECK.loc[evw.index]].copy()
    sc['w0'] = sc['confidence'].map(P['confidence_weight']) * np.power(0.5, sc['age_m'].clip(lower=0) / P['recency_half_life_months'])
    sc['pos'] = sc['polarity'].map({'positive': 1.0, 'mixed': 0.5, 'negative': 0.0})
    sc['neg'] = (1 - sc['pos']) * np.where(sc['severity'] == 'damage', P['damage_multiplier'], 1.0)
    SW = P['specificity_weight']; TRAIT = set(P['provider_trait_categories'])
    lo_q, hi_q = (1 - P['range_level']) / 2, 1 - (1 - P['range_level']) / 2

    # 9.2 for this window: share of the business's SERVICE-ATTRIBUTED
    # evidence, within this window, that concerns one service. Attributed,
    # not all text reviews: only 29% of evidence names a service, so
    # dividing by every review reads 0.075 for the median salon and measures
    # tagging coverage rather than specialisation.
    attr9 = evw[evw['polarity'].isin(['positive', 'negative', 'mixed'])
                & ~NOFAULT.loc[evw.index] & ~NOCHECK.loc[evw.index] & evw['svc'].notna()]
    biz_n9 = attr9.groupby('place_id')['review_id'].nunique()
    svc_n9 = attr9.groupby(['place_id', 'svc'])['review_id'].nunique()
    cat9_expertise = {}             # (place_id, service) -> (score, n), this window only
    for (pid, sv), n in svc_n9.items():
        if n < P['cat9_min_service_reviews']:
            continue
        cat9_expertise[(pid, sv)] = ((1.0 + n) / (2.0 + int(biz_n9[pid])), int(n))

    trust_rows = []
    for pid, g in sc.groupby('place_id'):
        pe = evw.loc[evw['place_id'] == pid]
        # Sub-services named in the evidence, UNION those implied by the
        # service_code and service_category_code present. The union, not the
        # named set alone: a business with one named sub-service still
        # offers the rest, and preferring `named` would stop scoring those
        # others entirely.
        #
        # A named sub-service therefore only ADDS precision: it is what lets
        # a statement reach the 1.00 specificity rung for its own sub-service.
        named = set(pe['sub'].dropna())
        svcs_present = set(pe['svc'].dropna().unique())
        cats_present = set(pe['cat'].dropna().unique())
        inferred = set()
        for ss, sv in sub2svc.items():
            if sv in svcs_present:
                inferred.add(ss)
            elif sub2cat.get(ss) in cats_present:
                inferred.add(ss)
        targets = sorted(inferred | named)
        if not targets:
            # Evidence exists for this business in this window but names no
            # service, no service category and no sub-service, so there is
            # nothing to attach a score to. A business can also land here
            # simply because none of its evidence falls inside a short
            # window -- that is the duration filter doing its job, not a
            # defect, and is why this is tracked per window rather than once.
            dropped_no_targets[window_code].append(pid)
            continue
        sub = g['sub'].to_numpy(dtype=object); svc = g['svc'].to_numpy(dtype=object); cat = g['cat'].to_numpy(dtype=object)
        cno = g['category_no'].to_numpy(); w0 = g['w0'].to_numpy(); pos = g['pos'].to_numpy(); neg = g['neg'].to_numpy()
        rid = g['review_id'].to_numpy()
        trait = np.isin(cno, list(TRAIT))
        # Reported-only categories are scored and stored, but they are not
        # part of base_score, so they must not lend it precision either.
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
            # Every category, weighted and reported alike, scored from its
            # own evidence as a Beta posterior. No evidence leaves the
            # Beta(1,1) prior, which is 0.5 — neutral, not bad. Category 9
            # always lands here, since 9.1/9.2 are never coded in `sc`.
            scores = {}
            for c in ALL_CATS:
                m = use & (cno == c)
                pc, nc = Pw[m].sum(), Nw[m].sum()
                scores[c] = ((A0 + pc) / (A0 + B0 + pc + nc), pc + nc, int(m.sum()))

            # Category 3 = mean of the parts that have evidence: 3.1-3.4 from
            # owner replies (provider-wide, unwindowed) and 3.5, which
            # scores[c] now holds alone.
            for c in REPLY_CATS:
                parts, r_w, r_n = reply_parts.get(pid, ([], 0.0, 0))
                ev_sc, ev_w, ev_n = scores[c]
                got = parts + ([ev_sc] if ev_w > 0 else [])
                scores[c] = (float(np.mean(got)), float(r_w + ev_w), int(r_n + ev_n)) if got else (0.5, 0.0, 0)

            # 9.2's figure for this service, written under every sub-service
            # of it (it is computed at the service grain, category9_window is
            # keyed at the sub-service grain). score_9_1 is always null now;
            # `score` mirrors score_9_2 so a reader of this column directly
            # sees the same figure rather than a stale blend.
            if HAS_CAT9:
                e9 = cat9_expertise.get((pid, s_svc))
                cat9_rows.append((pid, s, window_code,
                                  None,
                                  round(e9[0], 4) if e9 else None,
                                  round(e9[0], 4) if e9 else None))

            for c in ALL_CATS:
                cat_rows.append((pid, s, c, round(float(scores[c][0]), 4), round(float(scores[c][1]), 3), int(scores[c][2]), window_code))

            # Equal weights over the WEIGHTED categories only, 1/7 each.
            # Category 8 (Overall Verdict) is stored above but never enters
            # the mean; Category 9 is weight 0 so it is not in WEIGHTED at all.
            base = float(np.mean([scores[c][0] for c in WEIGHTED]))
            t = tier[s]
            # A gate not named in gate_min_tier applies from tier 1 up.
            #
            # INERT: gates_applied is always empty under the current
            # framework (see the comment above the gv_rows loop), so
            # g_applied is always [] and pen is always 0. trust below equals
            # base on every row today.
            g_applied = [x for x in gates_applied.get(pid, []) if t >= P['gate_min_tier'].get(x, 1)]
            pen = P['gate_penalty'] * len(g_applied)
            trust = max(0.0, base - pen)
            # Precision rests on evidence about this service itself, and
            # only on the categories the score is actually built from.
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
                               round(float(Pt + Nt), 3), int(len(set(rid[own]))), badges, st, rank_status, None, window_code])

    # rank inside each sub-service, for this window only: clear above caution, then by trust score
    tr_w = pd.DataFrame(trust_rows, columns=['place_id', 'sub', 'tier', 'base', 'pen', 'trust', 'low', 'high', 'width', 'ew', 'nrev', 'badges', 'safety', 'status', 'rank', 'window_code'])
    rk = tr_w[tr_w['status'] == 'ranked'].copy()
    rk['clear'] = (rk['safety'] == 'clear')
    rk = rk.sort_values(['sub', 'clear', 'trust', 'ew'], ascending=[True, False, False, False])
    rk['rank'] = rk.groupby('sub').cumcount() + 1
    tr_w.loc[rk.index, 'rank'] = rk['rank']
    trust_frames.append(tr_w)
    print(f"[{window_code}] provider x sub-service rows: {len(tr_w):,}  "
          f"({tr_w['status'].value_counts().to_dict()})")

for window_code, pids in dropped_no_targets.items():
    if pids:
        print(f'[{window_code}] businesses with evidence but no scorable service in this window: {len(pids)}')

tr = pd.concat(trust_frames, ignore_index=True)

# ================= 5. Write =================
with conn, conn.cursor() as cur:
    cur.execute("insert into score.scoring_run (reference_date, parameters) values (%s, %s) returning scoring_run_id", (ref_date.date(), json.dumps(P)))
    run = cur.fetchone()[0]
    execute_values(cur, "insert into score.gate_veto_status values %s", [(run, r[0], r[1], r[2], r[3], int(r[4]), int(r[5]), r[6], r[7], r[8]) for r in gv_rows], page_size=2000)
    execute_values(cur, "insert into score.provider_safety values %s", [(run, pid, v[0], int(v[1]), int(v[2]), v[3]) for pid, v in safety.items()], page_size=2000)
    # Explicit column lists on these two: 17_window_scoped_scores.sql appends
    # window_code with ALTER TABLE, and relying on whatever order that leaves
    # the columns in would be fragile. Named here instead.
    execute_values(cur,
                   "insert into score.category_score "
                   "(scoring_run_id, place_id, sub_service_code, category_no, "
                   " score, evidence_weight, evidence_count, window_code) values %s",
                   [(run,) + r for r in cat_rows], page_size=5000)
    execute_values(cur,
                   "insert into score.trust_score "
                   "(scoring_run_id, place_id, sub_service_code, tier, base_score, gate_penalty, "
                   " trust_score, range_low, range_high, range_width, evidence_weight, evidence_reviews, "
                   " badges, safety_status, rank_status, rank_in_service, window_code) values %s",
                   [(run, r['place_id'], r['sub'], int(r['tier']), float(r['base']), float(r['pen']), float(r['trust']), float(r['low']), float(r['high']),
                     float(r['width']), float(r['ew']), int(r['nrev']), (None if pd.isna(r['badges']) else r['badges']), r['safety'], r['status'],
                     (None if pd.isna(r['rank']) else int(r['rank'])), r['window_code']) for r in tr.to_dict('records')], page_size=5000)
    execute_values(cur, "insert into score.commitment_outcome values %s", [(run,) + r for r in commitment_rows], page_size=2000)
    if HAS_CAT9:
        execute_values(cur,
                       "insert into score.category9_window "
                       "(scoring_run_id, place_id, sub_service_code, window_code, "
                       " score_9_1, score_9_2, score) values %s",
                       [(run,) + r for r in cat9_rows], page_size=5000)
conn.close()

print(f'Scoring run {run} saved.')
print(f'Provider x sub-service scores: {len(tr):,}')
print(tr['status'].value_counts().to_string())
print('Providers by safety status:'); print(pd.Series([v[0] for v in safety.values()]).value_counts().to_string())
print('Gate / veto status rows:'); print(pd.DataFrame(gv_rows)[3].value_counts().to_string() if gv_rows else 'none')