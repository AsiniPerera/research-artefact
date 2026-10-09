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
function EvidenceRows({ rows }) {
  return (
    <ul className="evidence-list">
      {rows.map((e, i) => (
        <li key={e.evidence_id ?? i} className={`evidence-item evidence-item--${e.polarity}`}>
          {/* The polarity badge sits top right of the card, clear of the
              quote. It led the meta row before. */}
          <span className={`polarity-pill polarity-pill--${e.polarity} evidence-polarity`}>
            {e.polarity}
          </span>
          {/* Who the review names, when extraction caught one. Sits beside
              the polarity badge rather than buried in the meta line, since
              "who did the work" is the thing a reader scans for first in a
              review about staff. */}
          {e.staff_name && (
            <span className="evidence-staff" title={`Names ${e.staff_name}`}>
              {e.staff_name}
            </span>
          )}
          <EvidenceQuote text={e.review_text ?? e.evidence_text} />
          {/* What this review was read for, in the framework's own words.
 
              "4.1" alone is an internal code: it tells a reader nothing about
              why the quote is here. The question it stands for — "Do people
              recommend it?" — is the thing that makes the quote legible, so
              it leads and the code follows it quietly for anyone tracing a
              row back to the framework. */}
          <p className="evidence-meta">
            {/* The short label, with what the check looks for on hover. The
                framework's own question is the fallback, so a sub-point this
                map has not been told about still says something. */}
            {(SUB_POINTS[e.sub_point_code]?.label ?? e.customer_question) && (
              <span className="evidence-check" title={SUB_POINTS[e.sub_point_code]?.blurb ?? e.customer_question}>
                {SUB_POINTS[e.sub_point_code]?.label ?? e.customer_question}
              </span>
            )}
            <span className="evidence-meta-rest">
              {[
                e.sub_point_code,
                e.sub_service_code ? LEAF_BY_CODE[e.sub_service_code]?.label ?? e.sub_service_code : null,
                e.severity,
                e.published_at ? String(e.published_at).slice(0, 10) : null,
              ].filter(Boolean).join(" · ")}
            </span>
          </p>

          {/* The owner's answer, attached to the review it answers.
 
              Category 3 asks how an owner handles complaints, so a row that
              showed the complaint and withheld the response was telling half
              the story — and every one of those rows has a reply. Indented
              and marked, so it reads as the salon speaking rather than more
              of the customer. */}
          {e.reply_text && (
            <div className="evidence-reply">
              <p className="evidence-reply-who">
                Salon replied
                {e.reply_date ? ` · ${String(e.reply_date).slice(0, 10)}` : ""}
              </p>
              <EvidenceQuote text={e.reply_text} />
            </div>
          )}
        </li>
      ))}
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
        <linearGradient id="sent-positive" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#b7a0e2" />
          <stop offset="55%" stopColor="#9579cc" />
          <stop offset="100%" stopColor="#6f55a3" />
        </linearGradient>
        <linearGradient id="sent-negative" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#dcb765" />
          <stop offset="55%" stopColor="#b98e33" />
          <stop offset="100%" stopColor="#8d6b22" />
        </linearGradient>
        <linearGradient id="sent-other" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#8b8189" />
          <stop offset="100%" stopColor="#5b5259" />
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
  1: "Quality of Work",
  2: "Consultation & Aftercare",
  3: "Owner Response to Reviews",
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
  3: "How the owner answers complaints",
  4: "Customers recommend it and come back",
  5: "How the staff treat you, including when something goes wrong",
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

/* Rows under their category heading — Hair, Nails, Gents' Grooming — in the
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
              <span className="cat-check-label">{c.label}</span>
              <span className="cat-check-blurb">{c.blurb}</span>
            </div>
            {total > 0 ? (
              <span className="cat-check-proof" title={`${pos} positive, ${neg} negative`}>
                <span className="cat-check-meter" aria-hidden="true">
                  <span style={{ width: `${(pos / total) * 100}%` }} />
                </span>
                <span className="cat-check-n">{total} review{total === 1 ? "" : "s"}</span>
              </span>
            ) : (
              <span className="cat-check-proof cat-check-proof--none">No reviews read for this yet</span>
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

  if (loading) return <div className="cat-drawer"><p className="cat-drawer-head">Loading reviews for {label}</p></div>;
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
        <p className="cat-drawer-head">No reviews carry {label} for this salon yet.</p>
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

const BLANK_FILTERS = { category: "", service_code: "", status: "", category_no: "", polarity: "", sort: "" };

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
              title={o.disabled ? `No ${o.label.toLowerCase()} reviews for this salon` : o.title}
              onClick={() => onChange(on && o.value ? "" : o.value)}
            >
              {o.label}
              {o.n != null && <span className="chip-n">{o.n}</span>}
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
  const sentimentChips = [
    { value: "", label: "All" },
    ...POLARITIES.slice(1).map((o) => {
      const n = sentimentTotals?.[o.value] ?? 0;
      return { ...o, n, disabled: n === 0 };
    }),
  ];

  return (
    <div className="chip-filters">
      <ChipRow caption="Service area" value={filters.category}
               options={categoryChips} onChange={set("category")} />
      <ChipRow caption="What the review is about" hint="pick a topic"
               value={filters.category_no} options={topicChips} onChange={set("category_no")} />
      <ChipRow caption="Said how" value={filters.polarity}
               options={sentimentChips} onChange={set("polarity")} />
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
            {d.complaints_replied} of {d.complaints} negative or neutral reviews
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
              ? "every check in this category has real reviews behind it"
              : <>no reviews yet for{" "}
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
              ? `Named in reviews — ${staff.length} staff member${staff.length === 1 ? "" : "s"}`
              : "No staff member is named in this salon's reviews yet. Extraction catches names for about 1 salon in 5 — this may simply be one it has not reached."}
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
              <div className="score-axis" aria-hidden="true">
                <span />
                <span className="score-axis-scale">
                  <span>0</span><span>50</span><span>100</span>
                </span>
                <span />
              </div>
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


function ServiceScores({ service, categoryName, categoryTrait, sentimentBy, subPointBy, displayName, members, placeId, filters }) {
  const [openCat, setOpenCat] = useState(null);
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
        <RangeBar score={service.trust_score} low={service.range_low} high={service.range_high} />
        {/* "82 ±13" rather than "82" over "67–93".
 
            Across one salon's services the score barely moves — a spread of a
            single point here — while the margin swings from ±13 to ±30. The
            number everyone reads was the one that does not distinguish them.
            The margin is half the 80% range; the range itself is on hover. */}
        <span className="detail-service-score">
          <span className="detail-service-num">{pct(service.trust_score)}</span>
          <span
            className="detail-service-range"
            title={`80% range ${pct(service.range_low)}–${pct(service.range_high)} — a wider margin means less evidence behind the score`}
          >
            ±{Math.round((pct(service.range_high) - pct(service.range_low)) / 2)}
          </span>
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
      <div className="score-list">
        {rows.map((r) => (
          <ScoreRow
            key={r.category_no}
            label={CATEGORY_DISPLAY[r.category_no] ?? r.name ?? categoryName[r.category_no]
                   ?? `Category ${r.category_no}`}
            blurb={CATEGORY_BLURB[r.category_no]}
            short={CATEGORY_SHORT[r.category_no]}
            score={r.score}
            count={r.evidence_count}
            counts={catSentiment[r.category_no]}
            /* Picking a topic above used to change nothing on this tab, which
               made the chip look broken. The chosen one now holds its colour
               and the rest recede — emphasis rather than removal, so the
               reader keeps the comparison they were looking at. */
            dimmed={topic != null && topic !== r.category_no}
            open={openCat === r.category_no}
            onToggle={() => setOpenCat(openCat === r.category_no ? null : r.category_no)}
          />
        ))}
      </div>

      {/* One drawer under the whole grid rather than one per tile: the grid is
          three columns wide, and a panel opening inside a column would be a
          slot of text with the other columns jumping around it. */}
      {openCat !== null && (
        <CategoryEvidence
          placeId={placeId}
          serviceCode={service.service_code}
          categoryCode={service.category_code}
          categoryNo={openCat}
          label={rows.find((r) => r.category_no === openCat)?.name
                 ?? categoryName[openCat] ?? `Category ${openCat}`}
          serviceLabel={displayName ?? serviceName(service)}
          isTrait={!!categoryTrait?.[openCat]}
          subPointBy={subPointBy}
        />
      )}
    </details>
  );
}

function EvidenceList({ placeId, filters }) {
  const [rows, setRows] = useState([]);
  const [offset, setOffset] = useState(0);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /* Only the four the evidence endpoint knows. The shared bar also carries
     Category and Status, which narrow the services above and mean nothing
     here — sending them would put unread params on the request and, worse,
     reload this list every time the Status select moved. */
  const { service_code, category_no, polarity, sort } = filters;
  const query = useMemo(
    () => ({ service_code, category_no, polarity, sort }),
    [service_code, category_no, polarity, sort],
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
      <EvidenceRows rows={rows} />

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
  // Salon-wide positive/negative per sub-point -- the receipts behind the
  // short claims ("Friendly and caring") shown once per category.
  const [subPointProof, setSubPointProof] = useState([]);
  // One filter set for the page; the bar and the merged section below share it.
  const [filters, setFilters] = useState(BLANK_FILTERS);
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
    return () => ctrl.abort();
  }, [salonId]);

  if (error) return <p className="error">{error}</p>;
  if (!provider) return <p className="loading-text">Loading</p>;

  const p = provider.provider ?? provider;
  const name = p.name ?? p.provider_name;
  const safety = provider.safety ?? {};
  const gates = provider.gates_and_vetoes ?? [];
  const services = provider.services ?? [];
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

        <aside className="detail-hero-side">
          {p.google_rating != null && (
            <p className="detail-rating">
              <span className="detail-rating-num">★ {p.google_rating}</span>
              <span>{p.google_review_count} Google reviews</span>
              <small>For reference only — never an input to the ranking.</small>
            </p>
          )}
          {p.place_url && (
            <a href={p.place_url} target="_blank" rel="noopener noreferrer" className="maps-link">
              View on Google Maps →
            </a>
          )}
        </aside>
      </header>

      {(safety.reason || gates.length > 0) && (
        <section className="detail-panel">
          <h2 className="detail-section">Safety, gates and vetoes</h2>
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
        </section>
      )}

      {/* One section, not two tabs. Scores and the reviews they are built
          from used to be a click apart; now they are one continuous read,
          and the proof panel between them answers for both halves at once
          instead of being locked inside whichever tab happened to be open. */}
      <DonutDefs />

      <section className="detail-panel">
        <h2 className="detail-section">Scores &amp; reviews</h2>
        <p className="detail-note">
          0–100, where 50 is neutral and about 75 is strong. The bar shows the range the
          evidence supports — wider means less certain.
        </p>

        {/* How to read a ring, said once for the whole page instead of
            repeating under every service that gets opened — the explanation
            does not change from one service to the next, only the numbers
            inside it do. */}
        <ul className="donut-legend donut-legend--page">
          <li>
            <span className="donut-legend-swatch donut-legend-swatch--positive" aria-hidden="true" />
            Outer ring: score out of 100
          </li>
          <li>
            <span className="donut-legend-swatch donut-legend-swatch--negative" aria-hidden="true" />
            Inner ring: share of reviews that were negative
          </li>
        </ul>

        <DetailFilters
          services={services}
          categories={categories}
          sentimentTotals={provider.sentiment_totals ?? {}}
          filters={filters}
          onChange={setFilters}
        />

        {/* The summary for whatever is currently filtered, shared by the
            scores below it and the reviews further down -- not gated behind
            a "Reviews" tab any more, because it is proof for both. */}
        {filters.category_no && (
          String(filters.category_no) === "3" ? (
            <ReplyAnalysis placeId={salonId} />
          ) : (
            <CategoryAnalysis
              categoryNo={Number(filters.category_no)}
              categoryLabel={CATEGORY_DISPLAY[Number(filters.category_no)]
                ?? categoryName[Number(filters.category_no)] ?? `Category ${filters.category_no}`}
              subPointBy={subPointBy}
              placeId={salonId}
            />
          )
        )}

        <h3 className="detail-subsection">Scores by service</h3>
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

        <h3 className="detail-subsection detail-subsection--reviews">Reviews</h3>
        <SelectionSummary filters={filters} categories={categories} services={services} />
        <EvidenceList placeId={salonId} filters={filters} />
      </section>

    </article>
  );
}
