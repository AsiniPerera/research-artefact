import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { SelectMenu } from "../components/SelectMenu";
import { IconChevron } from "../components/Icons";
import {
  getProvider, getFramework, getEvidence, getSentiment, getReplyQuality, getSubPointProof, getStaffMentions,
  splitBadges, categoryScoreRows,
} from "../api/client";
import { LEAF_BY_CODE } from "../constants/taxonomy";
import { SUB_POINTS, subPointsOf } from "../constants/subPoints";

const EVIDENCE_PAGE = 20;

/* One quoted review. Shared by the browser at the foot of the page and by the
   drawer that opens under a category score, so a review looks the same
   wherever it is read. */
/* One review can be read for several sub-points, so the raw rows carry the
   same review text many times. Group by review so each review shows ONCE, with
   its sub-points listed underneath — no duplicated quotes. Order of first
   appearance is kept, so the backend's sort still holds. */
function groupByReview(rows) {
  const groups = [];
  const byId = new Map();
  for (const e of rows) {
    const key = e.review_id ?? e.review_text ?? e.evidence_id;
    let g = byId.get(key);
    if (!g) {
      g = {
        key,
        review_text: e.review_text ?? e.evidence_text,
        overall_sentiment: e.overall_sentiment,
        reply_text: e.reply_text,
        reply_date: e.reply_date,
        published_at: e.published_at,
        stars: e.stars,
        points: [],
      };
      byId.set(key, g);
      groups.push(g);
    }
    g.points.push(e);
  }
  return groups;
}

/* The card's accent: the shared polarity if every sub-point agrees, else
   "mixed". */
function reviewPolarity(points) {
  const set = new Set(points.map((p) => p.polarity));
  return set.size === 1 ? [...set][0] : "mixed";
}

/* A staff name is only worth showing when it is genuinely in the review: it
   must appear there as a whole word, and must not be part of the salon's own
   name (so "Boss" from "Saloon Boss" is not read as a person). Returns the
   distinct valid names found in this review. */
function namedStaffIn(points, reviewText, salonName) {
  const text = reviewText ?? "";
  const salonWords = new Set(
    (salonName ?? "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean),
  );
  const out = [];
  const seen = new Set();
  for (const p of points) {
    const name = (p.staff_name ?? "").trim();
    if (!name || name.length < 3) continue;
    const lower = name.toLowerCase();
    if (seen.has(lower)) continue;
    // Skip names that are just a word of the salon's own name.
    if (lower.split(/\s+/).some((w) => salonWords.has(w))) continue;
    // Whole-word match in the review text.
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${esc}\\b`, "i").test(text)) {
      seen.add(lower);
      out.push(name);
    }
  }
  return out;
}

function EvidenceRows({ rows, salonName }) {
  const groups = groupByReview(rows);
  return (
    <ul className="evidence-list">
      {groups.map((g, i) => {
        // The review-level sentiment is the correct badge; fall back to the
        // sub-point polarities only when it's missing.
        const polarity = g.overall_sentiment ?? reviewPolarity(g.points);
        // staff_name is now resolved through staging.evidence_item, so the
        // mapping is exact — every name genuinely appears in its review.
        const staff = [...new Set(
          g.points.flatMap((p) => (p.staff_name ?? "").split(",").map((s) => s.trim()).filter(Boolean)),
        )];
        return (
          <li key={g.key ?? i} className={`evidence-item evidence-item--${polarity}`}>
            {/* Polarity badge top-right. */}
            <span className={`polarity-pill polarity-pill--${polarity} evidence-polarity`}>
              {polarity}
            </span>
            <EvidenceQuote text={g.review_text} />

            {/* Every sub-point this review was read for, on one ash line,
                separated by a bar — so the one review can say several things
                without being printed twice. */}
            <p className="evidence-points">
              {g.points
                .map((e) => SUB_POINTS[e.sub_point_code]?.label ?? e.customer_question)
                .filter(Boolean)
                .join("  |  ")}
            </p>

            {g.published_at && (
              <p className="evidence-date">{String(g.published_at).slice(0, 10)}</p>
            )}

            {/* The owner's answer, shown once per review. */}
            {g.reply_text && (
              <div className="evidence-reply">
                <p className="evidence-reply-who">
                  Salon replied
                  {g.reply_date ? ` · ${String(g.reply_date).slice(0, 10)}` : ""}
                </p>
                <EvidenceQuote text={g.reply_text} />
              </div>
            )}

            {/* Named staff, one line, bottom-right. */}
            {staff.length > 0 && (
              <p className="evidence-staff-line" title={`This review names ${staff.join(", ")}`}>
                <span className="evidence-staff-line-tag">Mentioned staff:</span>{" "}
                <span className="evidence-staff-line-name">{staff.join(", ")}</span>
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

const POLARITIES = [
  { value: "", label: "Any" },
  { value: "positive", label: "Positive" },
  { value: "negative", label: "Negative" },
  { value: "mixed", label: "Mixed" },
  { value: "mention", label: "Mention" },
];

// "" is the API's own default (recent), and the client drops empty params, so
// the default order is unchanged and sends no sort at all.
const SORTS = [
  { value: "", label: "Newest first" },
  { value: "longest", label: "Longest review first" },
];

/* A review runs to ten or more lines, and a page of them is unreadable. Each
   quote is clamped (see .evidence-quote) and opens on its own.

   Whether a quote overflows is measured after layout rather than guessed from
   its length: the clamp is four LINES, and how many characters fill four
   lines depends on the column width. A character-count guess would put "See
   more" on quotes that already fit on a wide screen, and miss ones that
   overflow on a phone. */
function EvidenceQuote({ text }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    // Only measurable while clamped: once open, scrollHeight equals
    // clientHeight and the button would vanish mid-read. The last value
    // measured stays put until it collapses again.
    if (!el || open) return;
    const measure = () => setOverflows(el.scrollHeight > el.clientHeight + 1);
    measure();
    const ro = new ResizeObserver(measure);   // reflows on resize and font load
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, open]);

  return (
    <>
      <blockquote ref={ref} className={`evidence-quote${open ? " evidence-quote--open" : ""}`}>
        {text}
      </blockquote>
      {overflows && (
        <button
          type="button"
          className="evidence-more"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "See less" : "See more"}
          <span className="evidence-more-arrow" aria-hidden="true"><IconChevron size={12} /></span>
        </button>
      )}
    </>
  );
}

const pct = (x) => Math.round(Number(x ?? 0.5) * 100);
const serviceName = (s) => s.sub_service ?? s.sub_service_name ?? LEAF_BY_CODE[s.sub_service_code]?.label ?? s.sub_service_code;

/** /framework may be a list or { categories: [...] }. */
const frameworkRows = (fw) => (Array.isArray(fw) ? fw : fw?.categories ?? []);

/* Sentiment slots, in fixed order so a colour always means the same thing.
 
   Champagne and purple, not green and red. Checked rather than assumed: the
   pair separates at ΔE 22.8 for normal vision and 22.5 under colour-vision
   deficiency, where the green/red it replaces sat at 7.2 CVD — low enough to
   be legal only with a written label beside it. The house colours are the
   more accessible choice here, not a compromise for the sake of looks.
 
   Mixed and Mention fold into one neutral. Together they are 0.25% of all
   evidence (104 and 7 rows), so at this ring size they are a fraction of a
   pixel; giving them two colours of their own would mean two neutrals that
   no one can tell apart. The legend names what is inside. */
const SENTIMENT = [
  { key: "positive", label: "Positive", color: "url(#sent-positive)" },
  { key: "negative", label: "Negative", color: "url(#sent-negative)" },
  { key: "other",    label: "Mixed / mention", color: "url(#sent-other)" },
];

/* The gradients the rings are stroked with, defined once for the page rather
   than repeated inside every svg. A flat stroke on a circle reads as a
   printed band; a gradient running across it catches the curve and gives the
   ring the sheen the rest of this theme has. */
function DonutDefs() {
  return (
    <svg className="donut-defs" aria-hidden="true" focusable="false">
      <defs>
        {/* Main arc: brand violet → deep purple */}
        <linearGradient id="sent-positive" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#C9A86C" />
          <stop offset="55%"  stopColor="#9B4FA0" />
          <stop offset="100%" stopColor="#7B337E" />
        </linearGradient>
        {/* Inner negative arc: gold accent */}
        <linearGradient id="sent-negative" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#E8D4A8" />
          <stop offset="55%"  stopColor="#C9A86C" />
          <stop offset="100%" stopColor="#A07840" />
        </linearGradient>
        {/* Mixed/mention: muted violet */}
        <linearGradient id="sent-other" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#9B7EA8" />
          <stop offset="100%" stopColor="#6B5278" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/** Raw polarity counts -> the three slots the ring draws. */
const toSlots = (counts) => ({
  positive: counts?.positive ?? 0,
  negative: counts?.negative ?? 0,
  other: (counts?.mixed ?? 0) + (counts?.mention ?? 0),
});

/* Short names so eight tiles fit one row. The full name stays on the tile as
   its title and in the ring's aria-label, so nothing is lost to the
   abbreviation. */
/* Two names per category: the chip label and the fuller one a reader meets
   on a tile. The framework's own names are written for the framework —
   "Management Responsiveness & Continuous Improvement" is accurate and tells
   a customer nothing. These are the customer-facing wordings. */
const CATEGORY_SHORT = {
  1: "Quality", 2: "Care", 3: "Owner replies", 4: "Trust",
  5: "Staff", 6: "Value", 7: "Safety", 8: "Overall",
};

const CATEGORY_DISPLAY = {
  1: "Quality of the Result",
  2: "Consultation & Aftercare",
  3: "Owner Response to Customer Feedbacks",
  4: "Trust & Recommendation",
  5: "Staff & Customer Service",
  6: "Value & Price Honesty",
  7: "Safety, Hygiene & Facilities",
  8: "Overall Verdict",
};

/** What the category means, in the words shown to a customer. */
const CATEGORY_BLURB = {
  1: "Good results that match what you asked for and last",
  2: "They look after you before and after",
  3: "How the owner answers complaints and puts things right",
  4: "Customers recommend it and come back",
  5: "How the staff treat you",
  6: "Fair price, as agreed",
  7: "A clean, safe, comfortable place",
};

const DONUT = { size: 60, stroke: 7, inner: 3 };

/* A score meter with the sentiment inside it.
 
   The outer arc is the SCORE, not the sentiment split. Across these eight
   categories the score runs 60 to 97 while the sentiment is ~94% positive in
   every one — so a ring drawn from sentiment made all eight look alike and
   left the number in the hole to carry the only thing that varies. Drawn
   from the score, Care at 60 is visibly two-thirds of Trust at 97 before the
   numbers are read at all.
 
   The sentiment is still there, as a thin gold arc on an inner track: a
   different radius, so it is read as a second measure rather than a slice of
   the first. It appears only when there is something negative to show. */
function Donut({ counts, score, label }) {
  const { size, stroke, inner } = DONUT;
  const r = (size - stroke) / 2;
  const rInner = r - stroke / 2 - inner;
  const c = 2 * Math.PI * r;
  const cInner = 2 * Math.PI * rInner;

  const slots = toSlots(counts);
  const total = SENTIMENT.reduce((a, x) => a + (slots[x.key] ?? 0), 0);
  const negShare = total ? (slots.negative + slots.other) / total : 0;

  const value = pct(score);
  const arc = (value / 100) * c;
  const negArc = negShare * cInner;

  const reading = total
    ? `${label}: ${value}. ${slots.positive} positive, ${slots.negative} negative`
    : `${label}: no evidence, ${value} is the neutral default`;

  return (
    <svg className={`donut ${total ? "" : "donut--empty"}`} width={size} height={size}
         viewBox={`0 0 ${size} ${size}`} role="img" aria-label={reading}>
      <title>{reading}</title>
      <circle className="donut-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {total > 0 && (
          <circle
            className="donut-arc"
            cx={size / 2} cy={size / 2} r={r}
            stroke="url(#sent-positive)"
            strokeWidth={stroke}
            strokeDasharray={`${arc} ${c - arc}`}
          />
        )}
        {negArc > 0.5 && (
          <circle
            className="donut-arc donut-arc--neg"
            cx={size / 2} cy={size / 2} r={rInner}
            stroke="url(#sent-negative)"
            strokeWidth={inner}
            strokeDasharray={`${negArc} ${cInner - negArc}`}
          />
        )}
      </g>
      <text className="donut-score" x="50%" y="50%" dominantBaseline="central" textAnchor="middle">
        {value}
      </text>
    </svg>
  );
}

/* One legend per service, not per ring: the same four slots repeat across
   eight donuts, and eight legends would be noise. Counts are shown here
   rather than on the arcs — a number on every segment is unreadable, and
   these segments are often slivers. */
function ScoreRow({ label, short, blurb, score, count, counts, open, onToggle, dimmed }) {
  const hasEvidence = count > 0;
  return (
    /* The dimmed tile is a real tile, not a gap: the category is still part
       of the framework and still scored at the neutral 0.5, and leaving a
       hole where it should be is what makes a reader think something broke.
       It is visibly inert instead — no hover, no pointer, nothing to click —
       so "there is nothing here" is read before it is clicked. */
    /* The tile itself is the control now. A row of bare numbers under eight
       rings read as a second set of scores competing with the ones in the
       holes; the count still reaches a screen reader through the label. */
    hasEvidence ? (
      <button
        type="button"
        className={`score-row score-row--btn ${open ? "is-open" : ""} ${dimmed ? "is-dimmed" : ""}`}
        title={`${label}${blurb ? ` — ${blurb}` : ""}. ${count} evidence ${count === 1 ? "item" : "items"}.`}
        aria-expanded={open}
        aria-label={`${label}, ${count} evidence ${count === 1 ? "item" : "items"}. Show the reviews behind this score.`}
        onClick={onToggle}
      >
        <Donut counts={counts} score={score} label={label} />
        <span className="score-label">{short ?? label}</span>
      </button>
    ) : (
      <div className={`score-row score-row--empty ${dimmed ? "is-dimmed" : ""}`}
           title={`${label}${blurb ? ` — ${blurb}` : ""}. No evidence.`}>
        <Donut counts={counts} score={score} label={label} />
        <span className="score-label">{short ?? label}</span>
      </div>
    )
  );
}

/** A 0–100 track with the 80% range shaded and the score marked on it. */
/* One row of a range plot: the track is the whole 0–100 scale, the bar is the
   range the evidence supports, the dot is the score.
 
   Every row shares that scale, so a narrow bar high on the track and a wide
   one spanning half of it can be compared at a glance — which is the point,
   since the width is how much the number can be trusted. The hairline at 50
   is the neutral the scoring starts from, and gives the eye something to
   measure against. */
function RangeBar({ score, low, high }) {
  return (
    <span className="range-bar" aria-hidden="true">
      <span className="range-bar-ref" />
      <span className="range-bar-band" style={{ left: `${pct(low)}%`, width: `${pct(high) - pct(low)}%` }} />
      <span className="range-bar-mark" style={{ left: `${pct(score)}%` }} />
    </span>
  );
}

/* Scoring runs at service level, so the sub-services under one service
   usually carry the SAME number, band and category breakdown — "Haircut &
   Trim" and "Style Cut & Restyling" are one score printed twice. Those rows
   collapse into one named after the service.

   A group only collapses when everything the panel shows is identical:
   score, band, status, badges and the whole category breakdown. Fold on the
   headline number alone and a differing breakdown would vanish silently.

   Rank is the deliberate exception. It is per sub-service — the pool of
   competitors differs, so Haircut & Trim can be #27 while Style Cut is #20
   on the same score — and collapsing those to a single "Ranked #20" would
   overstate the salon. A group whose ranks differ still collapses, but shows
   the span and names its members, so no rank is claimed that isn't held. */
function scoreSignature(s) {
  const cats = categoryScoreRows(s.category_scores)
    .slice()
    .sort((a, b) => a.category_no - b.category_no)
    .map((c) => `${c.category_no}:${c.score}:${c.evidence_count}`)
    .join(",");
  return [s.trust_score, s.range_low, s.range_high, s.rank_status, s.badges ?? "", cats].join("|");
}

/* Surest first. The API's order is by code, which carries no meaning for a
   reader, and the scores are too close together to order by. Band width is
   the one thing that genuinely separates these rows, so the service whose
   score rests on the most evidence leads. Grouping by category still wins —
   this only orders within a group. */
function sortByCertainty(groups) {
  return [...groups].sort((a, b) => {
    const width = (g) => Number(g.service.range_high ?? 1) - Number(g.service.range_low ?? 0);
    return width(a) - width(b) || Number(b.service.trust_score) - Number(a.service.trust_score);
  });
}

/* Rows under their category heading — Hair, Nails, Skin & Beauty — in the
   order the API sent them. Grouping only; nothing is re-sorted, so the
   service order on screen stays the one the backend chose. */
function byCategory(groups) {
  const out = new Map();
  for (const g of groups) {
    const cat = g.service.category ?? "Other";
    if (!out.has(cat)) out.set(cat, []);
    out.get(cat).push(g);
  }
  return [...out];
}

/* The second fold, one level up: when every service row in a category is the
   same score, band, status and breakdown, the category becomes one row named
   after itself — "Nail Care" rather than three rows that all read 79.
 
   It applies the SAME test as the service fold, for the same reason. Folding
   on the headline number alone would be wrong here in a way that is easy to
   miss: within a category the scores often round to one number while the
   bands do not. Salon Zero's Nail Care is 79 at 61-93 and ranked #8, beside
   two services at 79 but 39-100 and not ranked at all. One row reading
   "Nail Care 79, ranked #8" would lend the ranked service's standing and its
   much narrower band to two services that have neither. */
function collapseCategory(cat, groups) {
  if (groups.length < 2) return null;
  const first = scoreSignature(groups[0].service);
  if (!groups.every((g) => scoreSignature(g.service) === first)) return null;
  return {
    key: `category:${cat}`,
    service: groups[0].service,
    displayName: cat,
    // Every underlying sub-service, so the rank span and the Covers line
    // still name real leaves rather than the service rows above them.
    members: groups.flatMap((g) => g.members ?? [g.service]),
  };
}

function groupServices(rows) {
  const byService = new Map();     // Map keeps the API's order
  for (const r of rows) {
    const k = r.service ?? r.sub_service_code;
    if (!byService.has(k)) byService.set(k, []);
    byService.get(k).push(r);
  }
  const out = [];
  for (const [name, members] of byService) {
    const buckets = new Map();
    for (const m of members) {
      const k = scoreSignature(m);
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(m);
    }
    for (const bucket of buckets.values()) {
      out.push(
        bucket.length > 1
          ? { key: `group:${name}:${bucket[0].sub_service_code}`, service: bucket[0],
              displayName: name, members: bucket }
          : { key: bucket[0].sub_service_code, service: bucket[0] },
      );
    }
  }
  return out;
}

const DRAWER_PAGE = 6;

/* The reviews behind one category score, opened in place under the score.
 
   Three slices, because the number beside a score is three populations added
   together. The scorer pools evidence by how closely it relates to the
   service:
 
     filed to this service        full weight
     filed to no service at all   half weight  -- it describes the salon
     filed to ANOTHER service     quarter weight, but only for a trait
                                  category; zero for an outcome one
 
   That last line is the subtle one. A trait -- cleanliness, staff, price
   honesty -- carries across services, because a dirty salon is dirty whoever
   cut your hair. An outcome -- quality of work, aftercare -- does not. So
   LANA's Chemical Hair Treatments reads "5 evidence items" for Safety: none
   of its own, 3 salon-wide, and 2 from other services that count because
   Safety is a trait. Showing only the first two slices is what made 5 print
   above a list of 3.
 
   `isTrait` comes from the framework endpoint, which reads it from the
   scoring run, so the app cannot disagree with the scores it is drawing. */
/* The proof list: one row per sub-point, each with the real count behind it
   and a meter for its positive share. Shared by the drawer under a single
   score and by the category-wide summary below, so "89 for Quality of Work"
   and "Quality of Work, salon-wide" are backed by the same receipts drawn
   the same way. */
function SubPointProofList({ categoryNo, subPointBy }) {
  const checks = subPointsOf(categoryNo);
  if (checks.length === 0) return null;
  return (
    <ul className="cat-checks">
      {checks.map((c) => {
        const counts = subPointBy?.[c.code];
        const pos = counts?.positive ?? 0;
        const neg = (counts?.negative ?? 0) + (counts?.mixed ?? 0);
        const total = pos + neg;
        return (
          <li key={c.code} className={total ? "" : "cat-check--empty"}>
            <div className="cat-check-text">
              <span className="cat-check-label">{c.question ?? c.label}</span>
              <span className="cat-check-blurb">{c.blurb}</span>
            </div>
            {total > 0 ? (
              <span className="cat-check-proof" title={`${pos} positive, ${neg} negative`}>
                <span className="cat-check-meter" aria-hidden="true">
                  <span style={{ width: `${(pos / total) * 100}%` }} />
                </span>
                <span className="cat-check-n">{total} feedback{total === 1 ? "" : "s"}</span>
              </span>
            ) : (
              <span className="cat-check-proof cat-check-proof--none">No customer feedbacks read for this yet</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function CategoryEvidence({ placeId, serviceCode, categoryCode, categoryNo, label, serviceLabel, isTrait, subPointBy }) {
  const [own, setOwn] = useState([]);
  const [wide, setWide] = useState([]);
  const [other, setOther] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const ctrl = new AbortController();
    const opts = { signal: ctrl.signal };
    setLoading(true);
    setError(null);
    Promise.all([
      serviceCode
        ? getEvidence(placeId, { service_code: serviceCode, category_no: categoryNo, limit: DRAWER_PAGE }, opts)
        : Promise.resolve([]),
      getEvidence(placeId, {
        unassigned: true,
        service_category_code: categoryCode,
        category_no: categoryNo,
        limit: DRAWER_PAGE,
      }, opts),
      // Only a trait category gives these any weight, so only then are they
      // part of the count and worth fetching.
      isTrait && serviceCode
        ? getEvidence(placeId, { exclude_service_code: serviceCode, category_no: categoryNo, limit: DRAWER_PAGE }, opts)
        : Promise.resolve([]),
    ])
      .then(([a, b, cc]) => {
        setOwn(Array.isArray(a) ? a : []);
        setWide(Array.isArray(b) ? b : []);
        setOther(Array.isArray(cc) ? cc : []);
        setLoading(false);
      })
      .catch((e) => {
        if (e.name === "AbortError") return;
        setError(e.message);
        setLoading(false);
      });
    return () => ctrl.abort();
  }, [placeId, serviceCode, categoryCode, categoryNo, isTrait]);

  if (loading) return <div className="cat-drawer"><p className="cat-drawer-head">Loading customer feedbacks for {label}</p></div>;
  if (error) return <div className="cat-drawer"><p className="cat-drawer-head">{error}</p></div>;

  const extras = wide.length + other.length;

  /* Strict by default: picking a service and a category means "show me those
     reviews", so those are what the list holds.

     The pooled evidence is still reachable, because the score above was not
     built from this list alone -- but it is an answer to a second question
     ("why is this number what it is?") and it waits to be asked. The one
     exception is a service with no reviews of its own, where strict would
     leave a bare "none" under a score of 74; there the fallback IS the
     answer, so it opens with it. */
  if (!own.length && !extras) {
    return (
      <div className="cat-drawer">
        <p className="cat-drawer-head">No customer feedbacks carry {label} for this salon yet.</p>
      </div>
    );
  }

  const pooled = [
    wide.length && {
      key: "wide",
      head: "About the salon, no service named — counted at half",
      rows: wide,
    },
    other.length && {
      key: "other",
      head: `About other services — counted at a quarter, because ${label.toLowerCase()} describes the salon itself`,
      rows: other,
    },
  ].filter(Boolean);

  return (
    <div className="cat-drawer">
      {/* Proof, not just a definition. "89 for Quality of Work" means little
          until you can see it is built from three separate checks, and that
          each one has real reviews behind it rather than being asserted. */}
      <SubPointProofList categoryNo={categoryNo} subPointBy={subPointBy} />

      {own.length > 0 ? (
        <>
          <p className="cat-drawer-head">
            <strong>{serviceLabel}</strong> · {label}
            {own.length === DRAWER_PAGE && <span className="cat-drawer-more"> first {DRAWER_PAGE} shown</span>}
          </p>
          <EvidenceRows rows={own} />
        </>
      ) : (
        <p className="cat-drawer-head">
          No review names <strong>{serviceLabel}</strong> for {label}. The score comes from
          these instead:
        </p>
      )}

      {extras > 0 && (
        own.length > 0 ? (
          <details className="cat-pool">
            {/* No number here: these lists are capped at a page, so any count
                taken from them would undersell the pool -- the salon-wide
                slice behind "6 shown" can be 25. */}
            <summary className="cat-pool-summary">
              The score also counts reviews that name no service, or another service
            </summary>
            {pooled.map((g) => (
              <Fragment key={g.key}>
                <p className="cat-drawer-head cat-drawer-head--second">
                  {g.head}
                  {g.rows.length === DRAWER_PAGE && <span className="cat-drawer-more"> first {DRAWER_PAGE} shown</span>}
                </p>
                <EvidenceRows rows={g.rows} />
              </Fragment>
            ))}
          </details>
        ) : (
          pooled.map((g, i) => (
            <Fragment key={g.key}>
              <p className={`cat-drawer-head ${i ? "cat-drawer-head--second" : ""}`}>
                {g.head}
                {g.rows.length === DRAWER_PAGE && <span className="cat-drawer-more"> first {DRAWER_PAGE} shown</span>}
              </p>
              <EvidenceRows rows={g.rows} />
            </Fragment>
          ))
        )
      )}
    </div>
  );
}

const BLANK_FILTERS = { category: "", service_code: "", status: "", category_no: "", polarity: "", named: false, sort: "" };

/* A row of chips instead of a select.
 
   Six dropdowns asked the reader to open each one to learn what was in it,
   and to hold the whole set in their head. Chips show every choice at once
   and show which is on, so the page can be read rather than explored. */
function ChipRow({ caption, hint, value, options, onChange }) {
  return (
    <div className="chip-row" role="group" aria-label={caption}>
      <span className="chip-row-cap">
        {caption}
        {hint && <span className="chip-row-hint"> {hint}</span>}
      </span>
      <div className="chip-row-items">
        {options.map((o) => {
          const on = value === o.value;
          return (
            <button
              key={o.value || "all"}
              type="button"
              className={`chip ${on ? "is-on" : ""} ${o.disabled ? "is-empty" : ""}`}
              aria-pressed={on}
              /* disabled, not hidden: it keeps its place in the row and
                 still reads its count of zero to a screen reader. */
              disabled={o.disabled}
              title={o.disabled ? `No ${o.label.toLowerCase()} customer feedbacks for this salon` : o.title}
              onClick={() => onChange(on && o.value ? "" : o.value)}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* The three questions the page answers, in the order a reader asks them:
   which part of the salon, what about it, and said how. Everything else that
   used to be a control is gone — the service itself is chosen by opening it
   in the list below, which is one less thing to explain. */
function DetailFilters({ services, categories, sentimentTotals, filters, onChange }) {
  const set = (k) => (v) => onChange({ ...filters, [k]: v });

  const categoryChips = useMemo(() => {
    // Count SERVICES, not sub-services: the list below collapses to one row
    // per service, and a chip reading "Hair 15" above five rows is a
    // contradiction the reader has to resolve.
    const byCat = {};
    for (const s of services) {
      if (!s.category) continue;
      (byCat[s.category] ??= new Set()).add(s.service_code ?? s.service);
    }
    return [{ value: "", label: "All" },
            ...Object.keys(byCat).sort().map((c) => ({ value: c, label: c, n: byCat[c].size }))];
  }, [services]);

  const topicChips = [
    { value: "", label: "All" },
    ...categories.map((c) => ({
      value: String(c.category_no),
      label: CATEGORY_SHORT[c.category_no] ?? c.name,
      title: CATEGORY_BLURB[c.category_no],
    })),
  ];

  /* All four sentiments, always, with the empty ones shown dimmed and
     unclickable rather than dropped. Hiding a chip raises the question of
     whether it exists at all; showing it at zero answers it. Same reasoning
     as the dimmed rings — "there is nothing here" is information. */
  /* Polarity is single-select. The sentiment values come straight from the
     DB (sentiment_totals, keyed by extract.review_assessment.overall_sentiment)
     rather than a hard-coded list, so whatever sentiments the data holds are
     the chips shown. A fixed order keeps the row stable. Mention is a SEPARATE
     toggle — "names a staff member" — and combines with any polarity. */
  const SENTIMENT_ORDER = { positive: 0, negative: 1, neutral: 2, mixed: 3 };
  const polarityChips = [
    { value: "", label: "All" },
    ...Object.keys(sentimentTotals ?? {})
      .sort((a, b) => (SENTIMENT_ORDER[a] ?? 99) - (SENTIMENT_ORDER[b] ?? 99))
      .map((v) => {
        const n = sentimentTotals[v] ?? 0;
        return { value: v, label: v[0].toUpperCase() + v.slice(1), n, disabled: n === 0 };
      }),
  ];

  return (
    <div className="chip-filters">
      <ChipRow caption="Service area" value={filters.category}
               options={categoryChips} onChange={set("category")} />
      <ChipRow caption="What the review is about" hint="pick a topic"
               value={filters.category_no} options={topicChips} onChange={set("category_no")} />

      <div className="chip-row" role="group" aria-label="Said how">
        <span className="chip-row-cap">Said how</span>
        <div className="chip-row-items">
          {polarityChips.map((o) => {
            const on = filters.polarity === o.value;
            return (
              <button key={o.value || "all"} type="button"
                className={`chip ${on ? "is-on" : ""} ${o.disabled ? "is-empty" : ""}`}
                aria-pressed={on} disabled={o.disabled}
                onClick={() => set("polarity")(on && o.value ? "" : o.value)}>
                {o.label}
              </button>
            );
          })}
          {/* Independent toggle, offset by a divider. */}
          <span className="chip-row-sep" aria-hidden="true" />
          <button type="button"
            className={`chip chip--toggle ${filters.named ? "is-on" : ""}`}
            aria-pressed={filters.named}
            title="Only customer feedbacks that name a staff member"
            onClick={() => set("named")(!filters.named)}>
            Mention
          </button>
        </div>
      </div>
    </div>
  );
}

/* How this owner handles reviews — the four measures of category 3, each in
   the form its own question asks for.
 
   They do not share a denominator, and that is the point. Coverage and speed
   are measured on COMPLAINTS only, because a reply under a five-star review
   says nothing about how a complaint is handled. Specificity is measured on
   every reply. Stance and commitments exist only where there was a complaint
   to take a stance on — thin for most salons by design, so the panel says
   when there is nothing rather than drawing an empty chart. */
function ReplyAnalysis({ placeId }) {
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setD(null);
    setError(null);
    getReplyQuality(placeId, { signal: ctrl.signal })
      .then(setD)
      .catch((e) => e.name !== "AbortError" && setError(e.message));
    return () => ctrl.abort();
  }, [placeId]);

  if (error) return null;
  if (!d) return <p className="loading-text">Loading reply analysis</p>;

  const pctOf = (n, of) => (of ? Math.round((n / of) * 100) : 0);
  const spec = d.specificity;
  const coverage = pctOf(d.complaints_replied, d.complaints);
  const specTotal = spec.specific + spec.partly + spec.generic;
  const personalShare = pctOf(spec.specific + spec.partly, specTotal);
  const stance = d.stance;
  const stanceTotal = Object.values(stance).reduce((a, b) => a + b, 0);

  /* Labelled bars, not stacked segments.
 
     A stacked bar would need four colours telling four ordered classes apart,
     and in this theme they cannot be: purple and gold are the poles, and any
     neutral between them lands within ΔE 13 of one or the other — below the
     floor where a full-colour reader can separate them. The rule for that is
     to cut classes or facet, not to lean on the legend. Faceted into rows,
     identity comes from the label and magnitude from the length, so one hue
     does the whole job. */
  const Bars = ({ cap, note, rows }) => {
    const max = Math.max(...rows.map((r) => r.n), 1);
    return (
      <div className="reply-chart">
        <p className="reply-chart-cap">{cap}<span className="reply-chart-sub">{note}</span></p>
        <ul className="reply-bars">
          {rows.map((r) => (
            <li key={r.label}>
              <span className="reply-bar-label">{r.label}</span>
              <span className="reply-bar-track">
                <span className={`reply-bar-fill ${r.accent ? `reply-bar-fill--${r.accent}` : ""}`}
                      style={{ width: `${(r.n / max) * 100}%` }} />
              </span>
              <span className="reply-bar-n">{r.n}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div className="reply-analysis">
      <div className="reply-kpis">
        <div className="reply-kpi">
          <span className="reply-kpi-cap">Answers complaints</span>
          <span className="reply-kpi-value">{pctOf(d.complaints_replied, d.complaints)}%</span>
          <span className="reply-meter" aria-hidden="true">
            <span style={{ width: `${pctOf(d.complaints_replied, d.complaints)}%` }} />
          </span>
          <span className="reply-kpi-note">
            {d.complaints_replied} of {d.complaints} negative or neutral customer feedbacks
          </span>
        </div>

        <div className="reply-kpi">
          <span className="reply-kpi-cap">Usual reply time</span>
          <span className="reply-kpi-value">
            {d.median_days == null ? "—"
              : d.median_days < 1 ? "same day"
              : `${Math.round(d.median_days)} day${Math.round(d.median_days) === 1 ? "" : "s"}`}
          </span>
          <span className="reply-kpi-note">median across {d.replied} replies</span>
        </div>
      </div>

      {/* The four answers in one line each, before the charts that evidence
          them. A reader who wants the verdict gets it here; the bars below
          are for anyone who wants to check it. */}
      <ul className="reply-verdicts">
        <li>
          <span className="reply-verdict-q">Answers complaints</span>
          <span className={`reply-verdict-a ${coverage >= 60 ? "is-good" : "is-poor"}`}>
            {coverage >= 80 ? "Nearly always" : coverage >= 60 ? "Usually" : coverage > 0 ? "Sometimes" : "No"}
          </span>
        </li>
        <li>
          <span className="reply-verdict-q">Personal replies</span>
          <span className={`reply-verdict-a ${personalShare >= 50 ? "is-good" : "is-poor"}`}>
            {personalShare >= 50 ? "Mostly personal" : "Mostly template"}
          </span>
        </li>
        <li>
          <span className="reply-verdict-q">Offers to put it right</span>
          <span className={`reply-verdict-a ${d.remedy > 0 ? "is-good" : "is-poor"}`}>
            {d.remedy > 0 ? `Yes · ${d.remedy}` : "Not seen"}
          </span>
        </li>
        <li>
          <span className="reply-verdict-q">Keeps promises</span>
          {/* Measured now, not "not yet tested": complaints about what they
              promised to fix, in the 90 days before each promise vs after.
              Fewer after means the promise held; more means it did not. A
              trend from real reviews, shown as a direction because the counts
              are small. */}
          {d.commitment_trend ? (() => {
            const t = d.commitment_trend;
            const better = t.after < t.before;
            const same = t.after === t.before;
            return (
              <span
                className={`reply-verdict-a ${same ? "is-unknown" : better ? "is-good" : "is-poor"}`}
                title={`Complaints about what they promised to fix: ${t.before} in the 90 days before each promise, ${t.after} after`}
              >
                {same ? "No change" : better ? "↓ Fewer complaints after" : "↑ More complaints after"}
                {" "}<span className="reply-verdict-sub">{t.before} → {t.after}</span>
              </span>
            );
          })() : (
            <span className="reply-verdict-a is-unknown">
              {d.commitment > 0 ? `${d.commitment} promised · too few to track` : "No promises made"}
            </span>
          )}
        </li>
      </ul>

      <Bars
        cap="Is the reply personal, not copy-paste?"
        note={`${specTotal} replies read`}
        rows={[
          { label: "Specific", n: spec.specific },
          { label: "Partly", n: spec.partly },
          { label: "Generic", n: spec.generic, accent: "muted" },
        ]}
      />

      {/* What those labels look like in practice. One of each, so "mostly
          template" can be judged rather than believed. */}
      {(d.examples?.specific || d.examples?.generic) && (
        <div className="reply-examples">
          {d.examples.specific && (
            <figure>
              <figcaption>A personal one</figcaption>
              <blockquote>{d.examples.specific}</blockquote>
            </figure>
          )}
          {d.examples.generic && (
            <figure>
              <figcaption>A template one</figcaption>
              <blockquote>{d.examples.generic}</blockquote>
            </figure>
          )}
        </div>
      )}

      {d.has_complaints ? (
        <>
          <Bars
            cap="When someone complains"
            note={`${stanceTotal} replies to complaints`}
            rows={[
              { label: "Takes responsibility", n: stance.accepts },
              { label: "Accepts and disputes", n: stance.mixed },
              { label: "Neither", n: stance.neither, accent: "muted" },
              { label: "Disputes it", n: stance.disputes, accent: "warn" },
            ]}
          />
          <p className="reply-foot">
            Offered to put it right <strong>{d.remedy}</strong> · promised a change{" "}
            <strong>{d.commitment}</strong>
          </p>
        </>
      ) : (
        <div className="reply-chart reply-chart--empty">
          <p className="reply-chart-cap">When someone complains</p>
          <p className="reply-foot">
            No complaint here has drawn a reply worth judging yet, so there is nothing to
            show. Most salons are in the same position — only 78 of 549 have any.
          </p>
        </div>
      )}
    </div>
  );
}

/* The same receipts panel as owner replies, generalised to the other six
   scored categories (and Overall). Category 3 keeps ReplyAnalysis, because
   extract.reply_assessment gives it four real measures — coverage, speed,
   specificity, stance — that no other category has. For the rest, the proof
   that exists is the same one the drawer already shows: how many reviews
   back each sub-point, and which way they lean. This surfaces it once per
   category, salon-wide, instead of making a reader open every service's
   score to find it. */
function CategoryAnalysis({ categoryNo, categoryLabel, subPointBy, placeId }) {
  const checks = subPointsOf(categoryNo);

  // Staff & Customer Service only: who the reviews actually name, not just
  // how the category scores. A salon the user already picked earlier found
  // mentioned no staff by name here -- staging.staff_names covers 121 of 549
  // salons, so this is real but genuinely patchy, which the panel says.
  const [staff, setStaff] = useState(null);
  useEffect(() => {
    if (categoryNo !== 5) { setStaff(null); return; }
    const ctrl = new AbortController();
    setStaff(null);
    getStaffMentions(placeId, { signal: ctrl.signal })
      .then(setStaff)
      .catch((e) => e.name !== "AbortError" && setStaff([]));
    return () => ctrl.abort();
  }, [placeId, categoryNo]);

  if (checks.length === 0) return null;

  let pos = 0, neg = 0;
  for (const c of checks) {
    const counts = subPointBy?.[c.code];
    pos += counts?.positive ?? 0;
    neg += (counts?.negative ?? 0) + (counts?.mixed ?? 0);
  }
  const total = pos + neg;
  const pctOf = (n, of) => (of ? Math.round((n / of) * 100) : 0);
  const withEvidence = [];
  const withoutEvidence = [];
  for (const c of checks) {
    const counts = subPointBy?.[c.code];
    const n = (counts?.positive ?? 0) + (counts?.negative ?? 0) + (counts?.mixed ?? 0);
    (n > 0 ? withEvidence : withoutEvidence).push(c);
  }

  return (
    <div className="reply-analysis">
      {/* What this category actually checks, named up front — not a number
          summarising them, the checks themselves. A reader should not have
          to scroll the list below to learn there are five of them, or which
          one just said "no reviews yet". */}
      <p className="cat-analysis-intro">
        {categoryLabel} is built from {checks.length} check{checks.length === 1 ? "" : "s"}:{" "}
        {checks.map((c, i) => (
          <span key={c.code}>
            {i > 0 && (i === checks.length - 1 ? " and " : ", ")}
            <span title={c.blurb}>{c.label}</span>
          </span>
        ))}
        .
      </p>

      <div className="reply-kpis">
        <div className="reply-kpi">
          <span className="reply-kpi-cap">Positive share</span>
          <span className="reply-kpi-value">{total ? `${pctOf(pos, total)}%` : "—"}</span>
          <span className="reply-meter" aria-hidden="true">
            <span style={{ width: `${pctOf(pos, total)}%` }} />
          </span>
          <span className="reply-kpi-note">
            {total} review{total === 1 ? "" : "s"} read for {categoryLabel}
          </span>
        </div>

        <div className="reply-kpi">
          <span className="reply-kpi-cap">Checks with evidence</span>
          <span className="reply-kpi-value">{withEvidence.length} / {checks.length}</span>
          {/* Named, not counted. "1 check has no reviews yet" makes the
              reader go looking for which one; this says it here. */}
          <span className="reply-kpi-note">
            {withoutEvidence.length === 0
              ? "every check in this category has real customer feedbacks behind it"
              : <>no customer feedbacks yet for{" "}
                  {withoutEvidence.map((c, i) => (
                    <span key={c.code}>
                      {i > 0 && (i === withoutEvidence.length - 1 ? " or " : ", ")}
                      <strong>{c.label}</strong>
                    </span>
                  ))}
                </>}
          </span>
        </div>
      </div>

      {/* The receipts, one row per sub-point: what each check means, how many
          reviews back it, and which way they lean. The same list a single
          score's drawer shows, surfaced once for the whole category. */}
      <SubPointProofList categoryNo={categoryNo} subPointBy={subPointBy} />

      {/* Who the reviews actually name. Only for Staff & Customer Service --
          the one category where "which person" is the natural next question
          after "how good is the staff". Coverage is real but patchy (121 of
          549 salons), so an empty result says that plainly rather than
          looking like a missing feature. */}
      {categoryNo === 5 && staff !== null && (
        <div className="staff-mentions">
          <p className="cat-drawer-head">
            {staff.length > 0
              ? `Named in customer feedbacks — ${staff.length} staff member${staff.length === 1 ? "" : "s"}`
              : "No staff member is named in this salon's customer feedbacks yet. Extraction catches names for about 1 salon in 5 — this may simply be one it has not reached."}
          </p>
          {staff.length > 0 && (
            <ul className="staff-mentions-list">
              {staff.slice(0, 8).map((s) => {
                const total = s.mentions;
                const posShare = total ? Math.round((s.positive / total) * 100) : 0;
                return (
                  <li key={s.staff_name}
                    title={`${s.staff_name}: ${s.positive} positive, ${s.negative} negative mentions`}>
                    <span className="staff-name">{s.staff_name}</span>
                    <span className="staff-meter" aria-hidden="true">
                      <span style={{ width: `${posShare}%` }} />
                    </span>
                    <span className="staff-n">{total}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/* A sentence saying what is currently on screen.
 
   The chips above already show what is selected, but reading three rows of
   chips to work out "negative reviews about Safety at this salon" is work.
   This says it once, in words, so a reader who arrived mid-scroll is not
   left guessing why the list is short. */
function SelectionSummary({ filters, categories, services }) {
  const topic = categories.find((c) => String(c.category_no) === String(filters.category_no));
  const service = services.find((x) => x.service_code === filters.service_code);
  const bits = [];
  if (filters.polarity) bits.push(filters.polarity);
  bits.push("reviews");
  if (topic) bits.push(`about ${CATEGORY_DISPLAY[topic.category_no] ?? topic.name}`);
  if (service) bits.push(`for ${service.service}`);
  else if (filters.category) bits.push(`for ${filters.category}`);

  const narrowed = filters.polarity || filters.category_no || filters.service_code || filters.category;
  if (!narrowed) {
    return <p className="detail-note">Every review behind this salon's scores. Use the chips above to narrow them.</p>;
  }
  return <p className="detail-note selection-summary">Showing {bits.join(" ")}.</p>;
}

// Below this many services the list is short enough to read whole, and the
// filter row would be more furniture than help.
const SERVICE_FILTER_MIN = 6;

const SERVICE_STATUSES = [
  { value: "", label: "Any status" },
  { value: "ranked", label: "Ranked only" },
  { value: "unranked", label: "Not ranked" },
];

/* A salon can carry fifty-odd sub-services, which turns this panel into a
   page of its own. These three filters narrow it.

   Every option is built from THIS salon's rows, not from the taxonomy: a
   salon with only Hair evidence should not be offered Nails and handed an
   empty list. */
function ServiceScoreList({ services, categoryName, categoryTrait, sentimentBy, subPointBy, placeId, filters }) {
  const { category, service_code: service, status } = filters;

  const shown = services.filter((s) =>
    (!category || s.category === category) &&
    (!service || s.service_code === service) &&
    (!status || (status === "ranked" ? s.rank_status === "ranked" : s.rank_status !== "ranked")));

  const filtered = shown.length !== services.length;
  // Headings earn their place only when there is more than one category to
  // tell apart.
  const showCategoryHeads = new Set(shown.map((r) => r.category)).size > 1;
  const clear = () => { setCategory(""); setService(""); setStatus(""); };

  return (
    <>
      {filtered && (
        <p className="detail-note service-filter-count">
          Showing {shown.length} of {services.length} services
        </p>
      )}

      {shown.length === 0 ? (
        <p className="subtle">No service matches these filters.</p>
      ) : (
        byCategory(sortByCertainty(groupServices(shown))).map(([cat, items]) => {
          const folded = collapseCategory(cat, items);
          // A folded category IS its heading, so printing both would say the
          // same word twice.
          const rows = folded ? [folded] : items;
          return (
            <section key={cat} className="service-group">
              {showCategoryHeads && !folded && (
                <h3 className="service-group-head">
                  {cat}
                  <span className="service-group-count">
                    {items.length} {items.length === 1 ? "service" : "services"}
                  </span>
                </h3>
              )}

              {/* The scale, stated once per group.
 
                  Without it the track is an unlabelled line, so a band ending
                  at the right edge looks clipped rather than "as high as 100"
                  — and 46% of scores do top out at 100, which made the column
                  read as ragged on the left and flush on the right. Naming
                  the ends turns that into what it is: a lot of upper bounds
                  at the ceiling. */}
              {rows.map((g) => (
                <ServiceScores
                  key={g.key}
                  service={g.service}
                  displayName={g.displayName}
                  members={g.members}
                  categoryName={categoryName}
                  categoryTrait={categoryTrait}
                  sentimentBy={sentimentBy}
                  subPointBy={subPointBy}
                  placeId={placeId}
                  filters={filters}
                />
              ))}
            </section>
          );
        })
      )}
    </>
  );
}


/* ── Vertical bar chart for category scores ────────────────────────────── */
function BarChart({ rows }) {
  if (!rows.length) return null;
  const W = 320, H = 180;
  const PAD = { top: 24, right: 8, bottom: 38, left: 8 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const n = rows.length;
  const gap = 6;
  const barW = (chartW - gap * (n - 1)) / n;

  // scores from DB are 0–1 floats
  const scores = rows.map((r) => Math.max(0, Math.min(1, r.score ?? 0)));
  const gridLines = [0, 25, 50, 75, 100];

  return (
    <svg className="bar-chart" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <defs>
        <linearGradient id="bar-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#C9A86C" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#7B337E" stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id="bar-grad-sel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E8D4A8" stopOpacity="1" />
          <stop offset="100%" stopColor="#9B4FAE" stopOpacity="0.9" />
        </linearGradient>
      </defs>

      {/* horizontal grid lines */}
      {gridLines.map((g) => {
        const y = PAD.top + chartH - (g / 100) * chartH;
        return (
          <g key={g}>
            <line
              x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
              stroke="rgba(201,168,108,0.12)" strokeWidth="1"
              strokeDasharray={g === 0 ? "none" : "3,3"}
            />
            <text x={PAD.left - 2} y={y + 3} textAnchor="end" fontSize="6.5"
              fill="rgba(201,168,108,0.35)" fontFamily="Poppins,sans-serif">
              {g}
            </text>
          </g>
        );
      })}

      {/* bars */}
      {rows.map((r, i) => {
        const x = PAD.left + i * (barW + gap);
        const barH = scores[i] * chartH;
        const y = PAD.top + chartH - barH;
        const label = CATEGORY_SHORT[r.category_no] ?? r.name ?? "";
        const scoreVal = Math.round(scores[i] * 100);

        return (
          <g key={r.category_no}>
            {/* bar */}
            <rect
              x={x} y={y} width={barW} height={Math.max(barH, 2)}
              rx="3" ry="3"
              fill="url(#bar-grad)"
              opacity={0.82}
            />
            {/* score on top of bar */}
            <text
              x={x + barW / 2} y={y - 4}
              textAnchor="middle" fontSize="8"
              fill="rgba(201,168,108,0.85)"
              fontFamily="Poppins,sans-serif"
            >
              {scoreVal}
            </text>
            {/* label below */}
            <text
              x={x + barW / 2} y={PAD.top + chartH + 12}
              textAnchor="middle" fontSize="7.5"
              fill="rgba(247,239,234,0.6)"
              fontFamily="Poppins,sans-serif"
            >
              {label.length > 7 ? label.slice(0, 6) + "…" : label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function ServiceScores({ service, categoryName, categoryTrait, sentimentBy, subPointBy, displayName, members, placeId, filters }) {
  const rows = categoryScoreRows(service.category_scores)
    .slice()
    .sort((a, b) => a.category_no - b.category_no);
  const badges = splitBadges(service.badges);
  const topic = filters?.category_no ? Number(filters.category_no) : null;
  const catSentiment = sentimentBy?.[service.service_code] ?? {};

  return (
    <details className="detail-service">
      <summary>
        {/* No rank here. A rank is "#1 of the salons offering this service in
            this search" -- it only means something inside a ranking, and
            this page is one salon's profile. Printing "#1" beside a service
            with no list around it invites the reader to fill in the missing
            half themselves. The ranking pages still carry it. */}
        <span className="detail-service-name">
          {displayName ?? serviceName(service)}
        </span>
      </summary>
      {members && members.length > 1 && (
        <p className="detail-service-covers">
          Covers {members.map((m) => serviceName(m)).join(", ")}
        </p>
      )}
      {badges.length > 0 && (
        <div className="badge-row">
          {badges.map((b) => <span key={b} className="badge badge--muted">{b}</span>)}
        </div>
      )}
      <ul className="cat-score-list">
        {rows.map((r) => {
          const s = Math.round((r.score ?? 0) * 100);
          const band = s >= 85 ? "Excellent" : s >= 75 ? "Very Good" : s >= 65 ? "Good" : s >= 55 ? "Average" : "Needs Improvement";
          const bandCls = s >= 85 ? "excellent" : s >= 75 ? "verygood" : s >= 65 ? "good" : s >= 55 ? "average" : "poor";
          return (
            <li key={r.category_no} className="csl-row">
              <div className="csl-top">
                <span className="csl-no">{String(r.category_no).padStart(2,"0")}</span>
                <span className="csl-name">{CATEGORY_DISPLAY[r.category_no] ?? r.name}</span>
                <span className={`csl-band csl-band--${bandCls}`}>{band}</span>
                <span className="csl-score">{s}</span>
              </div>
              <div className="csl-bar">
                <span className="csl-bar-fill" style={{ width: `${s}%` }} />
              </div>
              <span className="csl-blurb">{CATEGORY_BLURB[r.category_no]}</span>
            </li>
          );
        })}
      </ul>

      {/* One drawer under the whole grid rather than one per tile: the grid is
          three columns wide, and a panel opening inside a column would be a
          slot of text with the other columns jumping around it. */}
    </details>
  );
}

function EvidenceList({ placeId, filters, salonName }) {
  const [rows, setRows] = useState([]);
  const [offset, setOffset] = useState(0);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /* Only the four the evidence endpoint knows. The shared bar also carries
     Category and Status, which narrow the services above and mean nothing
     here — sending them would put unread params on the request and, worse,
     reload this list every time the Status select moved. */
  const { service_code, category_no, polarity, named, sort } = filters;
  const query = useMemo(
    // polarity (single-select) and `named` (names a staff member) are
    // independent, so both can be active. Neutral mention-polarity rows stay
    // hidden unless the reader is after named reviews.
    () => ({
      service_code, category_no, polarity, sort,
      only_named: named || undefined,
      hide_mention: named ? undefined : true,
    }),
    [service_code, category_no, polarity, named, sort],
  );

  // A filter change starts the list over.
  useEffect(() => { setRows([]); setOffset(0); }, [query]);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    getEvidence(placeId, { ...query, limit: EVIDENCE_PAGE, offset }, { signal: ctrl.signal })
      .then((data) => {
        const page = Array.isArray(data) ? data : data.evidence ?? data.items ?? [];
        setRows((prev) => (offset === 0 ? page : [...prev, ...page]));
        setMore(page.length === EVIDENCE_PAGE);
        setLoading(false);
      })
      .catch((e) => {
        if (e.name === "AbortError") return;
        setError(e.message);
        setLoading(false);
      });
    return () => ctrl.abort();
  }, [placeId, query, offset]);

  return (
    <>
      {error && <p className="error">{error}</p>}
      {!loading && !error && rows.length === 0 && (
        <p className="subtle">No evidence matches these filters.</p>
      )}

      {/* Real customer review text: quoted as written, never rewritten and
          never shortened.

          review_text FIRST, evidence_text only as a fallback. That order
          matters: evidence_text is the extraction's justification span and
          run 4 capped it at 100 characters, so it arrives cut mid-word
          ("...my all time trusted beau"). Quoting it was showing visitors a
          truncated sentence and calling it a customer's words. The full
          review is in raw.review and the API now returns it, so the quote is
          whole. */}
      <EvidenceRows rows={rows} salonName={salonName} />

      {loading && <p className="loading-text">Loading evidence</p>}
      {more && !loading && (
        <button type="button" className="btn-text" onClick={() => setOffset((o) => o + EVIDENCE_PAGE)}>
          Show more evidence
        </button>
      )}
    </>
  );
}

export function SalonDetail({ salonId, onBack }) {
  const [provider, setProvider] = useState(null);
  const [categories, setCategories] = useState([]);
  const [sentiment, setSentiment] = useState([]);
  const [subPointProof, setSubPointProof] = useState([]);
  const [replyQuality, setReplyQuality] = useState(null);
  const [filters, setFilters] = useState(BLANK_FILTERS);
  const [tab, setTab] = useState("summary");
  const [error, setError] = useState(null);
  useEffect(() => {
    const ctrl = new AbortController();
    setProvider(null);
    setError(null);
    getProvider(salonId, { signal: ctrl.signal })
      .then(setProvider)
      .catch((e) => e.name !== "AbortError" && setError(e.message));
    getFramework({ signal: ctrl.signal })
      .then((fw) => setCategories(frameworkRows(fw)))
      .catch(() => { /* names fall back to the category number */ });
    /* The rings degrade to the dimmed state if this fails, which is the same
       thing they show for a category with no evidence — so a failure here
       never blocks the scores. */
    getSentiment(salonId, { signal: ctrl.signal })
      .then(setSentiment)
      .catch(() => { /* rings fall back to no-data */ });
    /* Degrades to "no reviews have been read for this yet" per sub-point if
       it fails -- never blocks the category list itself. */
    getSubPointProof(salonId, { signal: ctrl.signal })
      .then(setSubPointProof)
      .catch(() => { /* proofs fall back to empty */ });
    getReplyQuality(salonId, { signal: ctrl.signal })
      .then(setReplyQuality)
      .catch(() => { /* degrades gracefully */ });
    return () => ctrl.abort();
  }, [salonId]);

  if (error) return <p className="error">{error}</p>;
  if (!provider) return <p className="loading-text">Loading</p>;

  const p = provider.provider ?? provider;
  const name = p.name ?? p.provider_name;
  const safety = provider.safety ?? {};
  const gates = provider.gates_and_vetoes ?? [];
  /* Taxonomy v9 folded Beard & Shave into Hair and dropped the standalone
     "Gents' Grooming" category, but the database still tags those services
     under the old category. Remap on read so the detail filters match the
     rest of the app — no "Gents' Grooming" chip. */
  const services = (provider.services ?? []).map((s) =>
    /gents|grooming|barber/i.test(s.category ?? "")
      ? { ...s, category: "Hair" }
      : s
  );
  // The sub-services the evidence is actually filed under. Empty on a backend
  // that does not send it, which simply drops the Service filter.
  const evidenceServices = provider.evidence_services ?? [];

  /* Flat rows -> sentimentBy[service_code][category_no] = { positive: n, ... }.
     Pivoted here, once, rather than filtered inside every tile. */
  const sentimentBy = {};
  for (const r of sentiment) {
    const byCat = (sentimentBy[r.service_code] ??= {});
    (byCat[r.category_no] ??= {})[r.polarity] = r.n;
  }
  /* Flat rows -> subPointBy[code] = { positive: n, negative: n, mixed: n }. */
  const subPointBy = {};
  for (const r of subPointProof) {
    (subPointBy[r.sub_point_code] ??= {})[r.polarity] = r.n;
  }
  const categoryName = Object.fromEntries(categories.map((c) => [c.category_no, c.name]));
  // Trait categories describe the salon, so their evidence carries between
  // services; the drawer needs to know which is which. See /framework.
  const categoryTrait = Object.fromEntries(categories.map((c) => [c.category_no, !!c.provider_trait]));

  const closed = p.permanently_closed || p.temporarily_closed;
  /* Only a concern is worth a chip. "Safety: clear" is the state of almost
     every salon, so it told the reader nothing and spent the most prominent
     row on the page saying it — and a badge that is nearly always present
     stops being read, which is exactly when you need the alerting one to
     stand out. Absence now means clear; the Safety panel below still carries
     the detail when there is any. */
  const safetyConcern = safety.safety_status && safety.safety_status !== "clear";

  return (
    <article className="salon-detail">
      <button type="button" className="btn-text back-link" onClick={onBack}>
        ← Back
      </button>

      <header className="detail-hero">
        <div className="detail-hero-main">
          <p className="eyebrow">Salon Profile</p>
          <h1 className="detail-name">{name}</h1>
          <p className="detail-meta">
            {p.address}
            {p.city && !String(p.address ?? "").includes(p.city) ? ` · ${p.city}` : ""}
          </p>
          <div className="detail-chips">
            {safetyConcern && (
              <span className="detail-chip detail-chip--alert">
                Safety: {safety.safety_status}
              </span>
            )}
            {closed && (
              <span className="detail-chip detail-chip--alert">
                {p.permanently_closed ? "Permanently closed" : "Temporarily closed"}
              </span>
            )}
          </div>
        </div>

      </header>

      <DonutDefs />

      {/* ── Tab bar ─────────────────────────────────────────────── */}
      <nav className="detail-tabs" aria-label="Salon sections">
        {[
          { id: "summary", label: "Summary" },
          { id: "scores",  label: "Scores by Service" },
          { id: "reviews", label: "Customer Feedbacks" },
          { id: "info",    label: "Salon Info" },
        ].map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={`detail-tab${tab === id ? " detail-tab--active" : ""}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* ── Scores tab ──────────────────────────────────────────── */}
      {tab === "scores" && (
        <section className="detail-panel">
          <ul className="donut-legend donut-legend--page">
            <li>
              <span className="donut-legend-swatch donut-legend-swatch--positive" aria-hidden="true" />
              Outer ring: score out of 100
            </li>
            <li>
              <span className="donut-legend-swatch donut-legend-swatch--negative" aria-hidden="true" />
              Inner ring: share of negative reviews
            </li>
          </ul>
          {services.length === 0 ? (
            <p className="subtle">No service has review evidence for this salon yet.</p>
          ) : (
            <ServiceScoreList
              services={services}
              categoryName={categoryName}
              categoryTrait={categoryTrait}
              sentimentBy={sentimentBy}
              subPointBy={subPointBy}
              placeId={salonId}
              filters={filters}
            />
          )}
        </section>
      )}

      {/* ── Summary tab ─────────────────────────────────────────── */}
      {tab === "summary" && (
        <section className="detail-panel">
          {/* Overall review sentiment totals */}
          {provider.sentiment_totals && Object.keys(provider.sentiment_totals).length > 0 && (
            <div className="summary-sentiments">
              {Object.entries(provider.sentiment_totals).map(([pol, n]) => (
                <div key={pol} className={`summary-sent-chip summary-sent-chip--${pol}`}>
                  <span className="summary-sent-count">{n}</span>
                  <span className="summary-sent-label">{pol} feedbacks</span>
                </div>
              ))}
            </div>
          )}

          {/* Smart category cards: what we check, findings, verdict */}
          <div className="summary-cats">
            {[1,2,3,4,5,6,7].map((no) => {
              const label = CATEGORY_DISPLAY[no] ?? categoryName[no] ?? `Category ${no}`;
              const checks = subPointsOf(no);
              // aggregate pos/neg across all sub-points of this category
              let totalPos = 0, totalNeg = 0;
              for (const c of checks) {
                const cnt = subPointBy?.[c.code];
                totalPos += cnt?.positive ?? 0;
                totalNeg += (cnt?.negative ?? 0) + (cnt?.mixed ?? 0);
              }
              const total = totalPos + totalNeg;
              const posShare = total ? Math.round((totalPos / total) * 100) : null;
              const verdict = posShare == null ? null
                : posShare >= 85 ? { word: "Excellent", cls: "excellent" }
                : posShare >= 70 ? { word: "Good", cls: "good" }
                : posShare >= 55 ? { word: "Mixed", cls: "average" }
                : { word: "Needs attention", cls: "poor" };

              return (
                <div key={no} className="sum-card">
                  {/* header */}
                  <div className="sum-card-head">
                    <span className="sum-card-no">{String(no).padStart(2,"0")}</span>
                    <div className="sum-card-title">
                      <strong>{label}</strong>
                      <span className="sum-card-sub">{CATEGORY_BLURB[no]}</span>
                    </div>
                    {verdict && (
                      <span className={`sum-verdict sum-verdict--${verdict.cls}`}>{verdict.word}</span>
                    )}
                  </div>

                  {/* overall finding bar — category 3 uses reply rate, others use pos% */}
                  {no === 3 && replyQuality ? (() => {
                    const rq = replyQuality;
                    const replyRate = rq.reviews > 0 ? Math.round((rq.replied / rq.reviews) * 100) : null;
                    if (replyRate == null) return null;
                    return (
                      <div className="sum-finding">
                        <div className="sum-finding-bar">
                          <span className="sum-finding-fill" style={{ width: `${replyRate}%` }} />
                        </div>
                        <span className="sum-finding-stat">
                          Owner replied to <b>{replyRate}%</b> of customer feedbacks — {rq.replied} of {rq.reviews} total
                        </span>
                      </div>
                    );
                  })() : total > 0 && (
                    <div className="sum-finding">
                      <div className="sum-finding-bar">
                        <span className="sum-finding-fill" style={{ width: `${posShare}%` }} />
                      </div>
                      <span className="sum-finding-stat">
                        <b>{posShare}%</b> positive across {total} feedback{total !== 1 ? "s" : ""}
                      </span>
                    </div>
                  )}

                  {/* sub-point breakdown */}
                  <ul className="sum-checks">
                    {checks.map((c) => {
                      // 3.1: reply speed & coverage
                      if (c.code === "3.1" && replyQuality) {
                        const rq = replyQuality;
                        const hasComplaints = rq.complaints > 0;
                        const coverage = hasComplaints
                          ? Math.round((rq.complaints_replied / rq.complaints) * 100)
                          : rq.replied > 0 ? Math.round((rq.replied / rq.reviews) * 100) : null;
                        const speedDays = rq.median_days == null ? null : Math.round(rq.median_days);
                        const speedLabel = rq.median_days == null ? null
                          : rq.median_days < 1 ? "same day"
                          : speedDays === 1 ? "within 1 day" : `within ${speedDays} days`;
                        const icon31 = coverage == null ? "—" : coverage >= 75 ? "✓" : coverage >= 50 ? "~" : "✗";
                        const cls31 = coverage == null ? "neutral" : coverage >= 75 ? "pos" : coverage >= 50 ? "mix" : "neg";
                        let summary31;
                        if (coverage == null) {
                          summary31 = <span className="sum-check-none">No owner replies recorded yet</span>;
                        } else if (hasComplaints) {
                          summary31 = <>
                            Owner replied to <b>{coverage}%</b> of complaints
                            {speedLabel && <> · usually <b>{speedLabel}</b></>}
                            <br /><span className="sum-check-n">{rq.complaints_replied} of {rq.complaints} complaint{rq.complaints !== 1 ? "s" : ""} got a reply</span>
                          </>;
                        } else {
                          summary31 = <>
                            Owner replies to <b>{coverage}%</b> of all feedbacks
                            {speedLabel && <> · usually <b>{speedLabel}</b></>}
                            <br /><span className="sum-check-n">No negative feedbacks found — based on {rq.replied} of {rq.reviews} total</span>
                          </>;
                        }
                        return (
                          <li key={c.code} className="sum-check">
                            <span className={`sum-check-icon sum-check-icon--${cls31}`}>{icon31}</span>
                            <span className="sum-check-body">
                              <span className="sum-check-label">{c.question ?? c.label}</span>
                              <span className="sum-check-blurb">{c.blurb}</span>
                            </span>
                            <span className="sum-check-right">{summary31}</span>
                          </li>
                        );
                      }

                      // 3.2: personal vs copy-paste
                      if (c.code === "3.2" && replyQuality) {
                        const sp = replyQuality.specificity ?? {};
                        const total32 = (sp.specific ?? 0) + (sp.partly ?? 0) + (sp.generic ?? 0);
                        if (total32 === 0) {
                          return (
                            <li key={c.code} className="sum-check">
                              <span className="sum-check-icon sum-check-icon--neutral">—</span>
                              <span className="sum-check-body">
                                <span className="sum-check-label">{c.question ?? c.label}</span>
                                <span className="sum-check-blurb">{c.blurb}</span>
                              </span>
                              <span className="sum-check-right"><span className="sum-check-none">No owner replies to analyse yet</span></span>
                            </li>
                          );
                        }
                        const personal = (sp.specific ?? 0) + (sp.partly ?? 0);
                        const pct32 = Math.round((personal / total32) * 100);
                        const generic = sp.generic ?? 0;
                        const icon32 = pct32 >= 75 ? "✓" : pct32 >= 50 ? "~" : "✗";
                        const cls32 = pct32 >= 75 ? "pos" : pct32 >= 50 ? "mix" : "neg";
                        const personalVerdict = pct32 >= 75 ? "Most replies are personal and specific"
                          : pct32 >= 50 ? "Replies are a mix of personal and copy-paste"
                          : "Most replies appear to be copy-paste templates";
                        return (
                          <li key={c.code} className="sum-check">
                            <span className={`sum-check-icon sum-check-icon--${cls32}`}>{icon32}</span>
                            <span className="sum-check-body">
                              <span className="sum-check-label">{c.question ?? c.label}</span>
                              <span className="sum-check-blurb">{c.blurb}</span>
                            </span>
                            <span className="sum-check-right">
                              {personalVerdict}<br />
                              <span className="sum-check-n">{sp.specific ?? 0} fully personal · {sp.partly ?? 0} partly · {generic} copy-paste (out of {total32})</span>
                            </span>
                          </li>
                        );
                      }

                      // 3.3: takes responsibility
                      if (c.code === "3.3" && replyQuality) {
                        const rq = replyQuality;
                        const st = rq.stance ?? {};
                        const total33 = Object.values(st).reduce((a, b) => a + b, 0);
                        const remedy = rq.remedy ?? 0;
                        if (total33 === 0) {
                          const hasReplies = rq.replied > 0;
                          return (
                            <li key={c.code} className="sum-check">
                              <span className={`sum-check-icon sum-check-icon--${hasReplies ? "mix" : "neutral"}`}>{hasReplies ? "~" : "—"}</span>
                              <span className="sum-check-body">
                                <span className="sum-check-label">{c.question ?? c.label}</span>
                                <span className="sum-check-blurb">{c.blurb}</span>
                              </span>
                              <span className="sum-check-right">
                                {hasReplies ? (
                                  <>
                                    Owner has replied to <b>{rq.replied}</b> feedback{rq.replied !== 1 ? "s" : ""}
                                    {remedy > 0 && <> · offered a fix in <b>{remedy}</b> case{remedy !== 1 ? "s" : ""}</>}
                                    <br /><span className="sum-check-n">No complaints found — stance could not be assessed</span>
                                  </>
                                ) : (
                                  <span className="sum-check-none">No owner replies recorded yet</span>
                                )}
                              </span>
                            </li>
                          );
                        }
                        const accepts = st.accepts ?? 0;
                        const disputes = st.disputes ?? 0;
                        const pct33 = Math.round((accepts / total33) * 100);
                        const icon33 = pct33 >= 75 ? "✓" : pct33 >= 50 ? "~" : "✗";
                        const cls33 = pct33 >= 75 ? "pos" : pct33 >= 50 ? "mix" : "neg";
                        const stanceVerdict = pct33 >= 75 ? "Owner usually accepts responsibility"
                          : pct33 >= 50 ? "Owner sometimes accepts, sometimes disputes"
                          : "Owner tends to dispute or deflect complaints";
                        return (
                          <li key={c.code} className="sum-check">
                            <span className={`sum-check-icon sum-check-icon--${cls33}`}>{icon33}</span>
                            <span className="sum-check-body">
                              <span className="sum-check-label">{c.question ?? c.label}</span>
                              <span className="sum-check-blurb">{c.blurb}</span>
                            </span>
                            <span className="sum-check-right">
                              {stanceVerdict}
                              {remedy > 0 && <> · offered a fix in <b>{remedy}</b> case{remedy !== 1 ? "s" : ""}</>}
                              <br /><span className="sum-check-n">{accepts} accepted · {disputes} disputed · {total33} complaint{total33 !== 1 ? "s" : ""} assessed</span>
                            </span>
                          </li>
                        );
                      }

                      // 3.4: promise tracking
                      if (c.code === "3.4" && replyQuality) {
                        const rq = replyQuality;
                        const made = rq.commitment ?? 0;
                        const trend = rq.commitment_trend;
                        let icon34 = "—", cls34 = "neutral", right34;
                        if (made === 0) {
                          right34 = <span className="sum-check-none">No specific promises found in replies yet</span>;
                        } else if (!trend) {
                          right34 = <>Owner made <b>{made}</b> promise{made !== 1 ? "s" : ""} to improve<br /><span className="sum-check-n">Not enough later feedbacks to check if they kept it</span></>;
                          icon34 = "~"; cls34 = "mix";
                        } else {
                          const improved = trend.after < trend.before;
                          const same = trend.after === trend.before;
                          icon34 = improved ? "✓" : same ? "~" : "✗";
                          cls34 = improved ? "pos" : same ? "mix" : "neg";
                          const trendVerdict = improved
                            ? "Complaints dropped after the promise — looks like they followed through"
                            : same ? "Complaint rate stayed the same after the promise"
                            : "Complaints actually increased after the promise";
                          right34 = (
                            <>
                              {trendVerdict}<br />
                              <span className="sum-check-n">
                                {trend.promises} promise{trend.promises !== 1 ? "s" : ""} made · complaints before: {trend.before} → after: {trend.after}
                              </span>
                            </>
                          );
                        }
                        return (
                          <li key={c.code} className="sum-check">
                            <span className={`sum-check-icon sum-check-icon--${cls34}`}>{icon34}</span>
                            <span className="sum-check-body">
                              <span className="sum-check-label">{c.question ?? c.label}</span>
                              <span className="sum-check-blurb">{c.blurb}</span>
                            </span>
                            <span className="sum-check-right">{right34}</span>
                          </li>
                        );
                      }

                      const cnt = subPointBy?.[c.code];
                      const pos = cnt?.positive ?? 0;
                      const neg = (cnt?.negative ?? 0) + (cnt?.mixed ?? 0);
                      const n = pos + neg;
                      const pShare = n ? Math.round((pos / n) * 100) : null;
                      const icon = pShare == null ? "—" : pShare >= 75 ? "✓" : pShare >= 50 ? "~" : "✗";
                      const iconCls = pShare == null ? "neutral" : pShare >= 75 ? "pos" : pShare >= 50 ? "mix" : "neg";
                      return (
                        <li key={c.code} className="sum-check">
                          <span className={`sum-check-icon sum-check-icon--${iconCls}`}>{icon}</span>
                          <span className="sum-check-body">
                            <span className="sum-check-label">{c.question ?? c.label}</span>
                            <span className="sum-check-blurb">{c.blurb}</span>
                          </span>
                          <span className="sum-check-right">
                            {pShare != null
                              ? <><b>{pShare}%</b> <span className="sum-check-n">({n})</span></>
                              : <span className="sum-check-none">No customer feedbacks yet</span>
                            }
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Reviews tab ─────────────────────────────────────────── */}
      {tab === "reviews" && (
        <section className="detail-panel">
          <DetailFilters
            services={services}
            categories={categories}
            sentimentTotals={provider.sentiment_totals ?? {}}
            filters={filters}
            onChange={setFilters}
          />
          <SelectionSummary filters={filters} categories={categories} services={services} />
          <EvidenceList placeId={salonId} filters={filters} salonName={name} />
        </section>
      )}

      {/* ── Info tab ────────────────────────────────────────────── */}
      {tab === "info" && (
        <section className="detail-panel">
          {p.google_rating != null && (
            <div className="info-block">
              <p className="info-label">Google rating</p>
              <p className="info-value">★ {p.google_rating} <span className="info-sub">({p.google_review_count} customer feedbacks — reference only)</span></p>
            </div>
          )}
          {p.address && (
            <div className="info-block">
              <p className="info-label">Address</p>
              <p className="info-value">{p.address}{p.city && !String(p.address).includes(p.city) ? `, ${p.city}` : ""}</p>
            </div>
          )}
          {p.place_url && (
            <div className="info-block">
              <a href={p.place_url} target="_blank" rel="noopener noreferrer" className="maps-link">
                View on Google Maps →
              </a>
            </div>
          )}
          {(safety.reason || gates.length > 0) && (
            <div className="info-block">
              <p className="info-label">Safety &amp; notices</p>
              {safety.reason && <p className="detail-reason">{safety.reason}</p>}
              {gates.length > 0 && (
                <ul className="gate-list">
                  {gates.map((g) => (
                    <li key={`${g.sub_point_code}-${g.kind}`} className={`gate gate--${g.kind}`}>
                      <strong>{g.kind} {g.sub_point_code}</strong>
                      <span>{g.customer_question}</span>
                      <small>
                        {g.status}
                        {g.report_count !== undefined ? ` · ${g.report_count} reports` : ""}
                        {g.disputed_reports ? ` (${g.disputed_reports} disputed by the owner)` : ""}
                        {g.expires_on ? ` · expires ${String(g.expires_on).slice(0, 10)}` : ""}
                      </small>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {!safety.reason && gates.length === 0 && !p.google_rating && !p.address && (
            <p className="subtle">No additional information available.</p>
          )}
        </section>
      )}

    </article>
  );
}
