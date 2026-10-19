/* The salon profile screen, opened from a SalonCard in Results or from
   search. Shows every scored category (including Category 3, reported-only,
   which the ranking card hides), the evidence behind each one, owner-reply
   quality, staff reputation and the gates/safety record — everything the
   card summarises into one number and a handful of chips. */
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { SelectMenu } from "../components/SelectMenu";
import { IconChevron, IconPin } from "../components/Icons";
import {
  getProvider, getFramework, getEvidence, getSentiment, getReplyQuality, getSubPointProof,
  splitBadges, categoryScoreRows,
} from "../api/client";
import { LEAF_BY_CODE } from "../constants/taxonomy";
import { SUB_POINTS, subPointsOf } from "../constants/subPoints";
import { CATEGORY_INFO, isShownCategory } from "../constants/categories";
import { StaffReputation } from "../components/StaffReputation";
import { ResponsivenessRing } from "../components/ResponsivenessRing";
import { OverallSalonScore } from "../components/OverallSalonScore";
import { FeedbackTotals } from "../components/FeedbackTotals";
import { responsivenessFigure, verdictFor } from "../lib/responsiveness";
import { getScoreStyle, verdictInk } from "../lib/scoreScale";
import { subServiceView } from "../lib/subServiceRows";
import { PopularServicesBadge } from "../components/PopularServicesBadge";
import { SpecialismBadge } from "../components/SpecialismBadge";

const EVIDENCE_PAGE = 20;

/* One quoted review. Shared by the browser at the foot of the page and by the
   drawer that opens under a category score, so a feedback looks the same
   wherever it is read. */
/* One review can be read for several sub-points, so the raw rows carry the
   same feedback text many times. Group by feedback so each feedback shows ONCE, with
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
        reviewer_name: e.reviewer_name,
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
   distinct valid names found in this feedback. */
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

/** The evidence list itself: one card per review (after groupByReview), each
    with its polarity badge, quote and the staff names found in it. */
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
                separated by a bar — so the one feedback can say several things
                without being printed twice. */}
            <p className="evidence-points">
              {g.points
                .filter((e) => e.sub_point_code !== "overall")
                .map((e) => SUB_POINTS[e.sub_point_code]?.label ?? e.customer_question)
                .filter(Boolean)
                .join("  |  ")}
            </p>

            {(g.reviewer_name || g.published_at) && (
              <p className="evidence-date">
                {g.reviewer_name && <span className="evidence-who">{g.reviewer_name}</span>}
                {g.reviewer_name && g.published_at && <span aria-hidden="true"> · </span>}
                {g.published_at && String(g.published_at).slice(0, 10)}
              </p>
            )}

            {/* The owner's answer, shown once per review. */}
            {g.reply_text && <EvidenceReply text={g.reply_text} date={g.reply_date} />}

            {/* Named staff, one line, bottom-right. */}
            {staff.length > 0 && (
              <p className="evidence-staff-line" title={`This feedback names ${staff.join(", ")}`}>
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

/* The owner's answer, folded: one line saying there is a reply and when, the
   reply itself on click. A page of reviews read as a page of replies before. */
function EvidenceReply({ text, date }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`evidence-reply ${open ? "is-open" : ""}`}>
      <button type="button" className="evidence-reply-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        Salon replied{date ? ` · ${String(date).slice(0, 10)}` : ""} <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      {open && <EvidenceQuote text={text} />}
    </div>
  );
}

/* The categories the profile summarises from customer feedback. Category 3
   (Management Responsiveness) is scored from the owner's replies instead, and
   has its own panel, so it is not one of these. */
const SUMMARY_CATEGORIES = [1, 2, 4, 5, 6, 7];

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
  { value: "longest", label: "Longest feedback first" },
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
        {/* Outer arc: the score, in bronze */}
        <linearGradient id="sent-positive" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   style={{ stopColor: "var(--c-accent-light)" }} />
          <stop offset="100%" style={{ stopColor: "var(--c-accent-strong)" }} />
        </linearGradient>
        {/* Inner arc: share of negative reviews, in sand */}
        <linearGradient id="sent-negative" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#e3d2b8" />
          <stop offset="100%" stopColor="#bfa27a" />
        </linearGradient>
        {/* Mixed / mention: neutral grey */}
        <linearGradient id="sent-other" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#9ca3af" />
          <stop offset="100%" stopColor="#6b7280" />
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

/* Category wording comes from constants/categories.js (spec section 2). */
const pick = (field) => Object.fromEntries(Object.entries(CATEGORY_INFO).map(([no, c]) => [no, c[field]]));
const CATEGORY_SHORT = pick("short");
const CATEGORY_DISPLAY = pick("name");
const CATEGORY_BLURB = pick("description");

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

/* The salon's own details, at the top of the profile's first tab. This used to
   be a separate "Salon Info" tab. The Google figure is a reference fact about
   the business; it is not used in any score. Renders nothing when there is
   nothing to show, rather than an empty box. */
function SalonInformation({ gates }) {
  /* The rating and the address used to sit here too, repeating the header.
     They live in the header now; this block shows only the notices. */
  if (gates.length === 0) return null;

  return (
    <section className="profile-info">
      <h3 className="profile-info-head">Notices</h3>
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
    </section>
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
        aria-label={`${label}, ${count} evidence ${count === 1 ? "item" : "items"}. Show the feedbacks behind this score.`}
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


const DRAWER_PAGE = 6;
const PANEL_LOAD = 60;   // statements fetched when a panel opens

/* "Show the feedbacks behind this", one component for both tabs.

   Profile information passes a whole-salon query ({ category_no }) and shows
   every feedback in that category. Scores by Service passes
   { about_sub_service, category_no }, which the API resolves to feedbacks
   filed to that sub-service plus feedbacks that name its service but no more
   precise sub-service (what the "N feedbacks about this service" count is
   made of), and never a sibling's. Filtering is server-side so a small
   sub-service is not crowded out of a fixed-size page by a large sibling.

   Loaded on first open, the PANEL_LOAD most recent, six at a time. */
function EvidencePanel({ placeId, query, salonName, label, emptyText }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(null);      // null = not loaded yet
  const [error, setError] = useState(null);
  const [visible, setVisible] = useState(DRAWER_PAGE);

  useEffect(() => {
    if (!open || rows !== null) return undefined;
    const ctrl = new AbortController();
    getEvidence(placeId, { ...query, hide_mention: true, limit: PANEL_LOAD }, { signal: ctrl.signal })
      .then((r) => setRows(Array.isArray(r) ? r : []))
      .catch((e) => { if (e.name !== "AbortError") setError(e.message); });
    return () => ctrl.abort();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="evidence-panel">
      <button type="button" className="btn-text evidence-toggle" aria-expanded={open}
              onClick={() => setOpen((o) => !o)}>
        {open ? "Hide feedbacks" : label}
      </button>
      {open && (
        error ? <p className="subtle">{error}</p>
        : rows === null ? <p className="subtle">Loading feedbacks…</p>
        : rows.length === 0 ? <p className="subtle">{emptyText}</p>
        : (
          <>
            <EvidenceRows rows={rows.slice(0, visible)} salonName={salonName} />
            {rows.length > visible && (
              <button type="button" className="btn-text evidence-panel-more"
                      onClick={() => setVisible((v) => v + DRAWER_PAGE)}>
                Show more ({rows.length - visible} more)
              </button>
            )}
          </>
        )
      )}
    </div>
  );
}

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

/** The evidence drawer opened under one category score: own-service rows
    always, plus provider-level ("wide") and other-service rows only when
    isTrait says the category is a salon-wide trait the specificity ladder
    lets travel (see 06_run_scoring.py's provider_trait_categories). */
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
     feedbacks", so those are what the list holds.

     The pooled evidence is still reachable, because the score above was not
     built from this list alone -- but it is an answer to a second question
     ("why is this number what it is?") and it waits to be asked. The one
     exception is a service with no feedbacks of its own, where strict would
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
          each one has real feedbacks behind it rather than being asserted. */}
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
          No feedback names <strong>{serviceLabel}</strong> for {label}. The score comes from
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
              The score also counts feedbacks that name no service, or another service
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

const BLANK_FILTERS = { category: "", service_code: "", status: "", category_no: "", polarity: "", named: false, language: "", sort: "" };


/* The three questions the page answers, in the order a reader asks them:
   which part of the salon, what about it, and said how. Everything else that
   used to be a control is gone — the service itself is chosen by opening it
   in the list below, which is one less thing to explain. */
function DetailFilters({ services, categories, sentimentTotals, languages, filters, onChange }) {
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

  /* Category 3 is left out of this row. It is scored almost entirely from
     the owner's replies (3.1-3.4), not from what customers write, so
     "feedbacks about Management" would return the handful of 3.5 statements
     and read as though the salon were barely answered for. The category is
     still shown everywhere it is scored — this row is about what a REVIEW
     is about. */
  const topicChips = [
    { value: "", label: "All" },
    ...categories
      .filter((c) => Number(c.category_no) !== 3)
      .map((c) => ({
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

  /* Built from provider.languages, which is already gated at 5+ reviews across
     2+ languages — so a single-language salon shows no row rather than a
     filter whose only options are "All" and "everything". "All" keeps showing
     'other' and undetected feedbacks: this narrows, it never quietly drops. */
  const languageChips = [
    { value: "", label: "All" },
    ...(languages ?? []).map((l) => ({ value: l.code, label: l.label, n: l.n })),
  ];

  /* One row of dropdowns instead of four rows of chips. Each option keeps its
     count in its label, so nothing the chips said is lost. */
  const withCount = (opts) => opts.map((o) => ({ value: o.value, label: o.n != null ? `${o.label} (${o.n})` : o.label }));
  return (
    <div className="fb-filters">
      <SelectMenu label="Service area" value={filters.category} options={withCount(categoryChips)} onChange={set("category")} />
      <SelectMenu label="Topic" value={filters.category_no} options={withCount(topicChips)} onChange={set("category_no")} />
      <SelectMenu label="Said how" value={filters.polarity} options={withCount(polarityChips)} onChange={set("polarity")} />
      {languageChips.length > 1 && (
        <SelectMenu label="Language" value={filters.language} options={withCount(languageChips)} onChange={set("language")} />
      )}
      <button
        type="button"
        className={`fb-toggle ${filters.named ? "is-on" : ""}`}
        aria-pressed={filters.named}
        title="Only customer feedbacks that name a staff member"
        onClick={() => set("named")(!filters.named)}
      >
        Names a staff member
      </button>
    </div>
  );
}

/* A sentence saying what is currently on screen.
 
   The chips above already show what is selected, but reading three rows of
   chips to work out "negative feedbacks about Safety at this salon" is work.
   This says it once, in words, so a reader who arrived mid-scroll is not
   left guessing why the list is short. */
function SelectionSummary({ filters, categories, services }) {
  const topic = categories.find((c) => String(c.category_no) === String(filters.category_no));
  const service = services.find((x) => x.service_code === filters.service_code);
  const bits = [];
  if (filters.polarity) bits.push(filters.polarity);
  bits.push("feedbacks");
  if (topic) bits.push(`about ${CATEGORY_DISPLAY[topic.category_no] ?? topic.name}`);
  if (service) bits.push(`for ${service.service}`);
  else if (filters.category) bits.push(`for ${filters.category}`);

  const narrowed = filters.polarity || filters.category_no || filters.service_code || filters.category;
  if (!narrowed) {
    return <p className="detail-note">Every feedback behind this salon's scores. Use the filters above to narrow them.</p>;
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
function ServiceScoreList({ services, categoryName, categoryTrait, sentimentBy, subPointBy, placeId, filters, salonName }) {
  // Only sub-services that have feedbacks about them are listed; see
  // lib/subServiceRows.js. A filter that lands on one with none says so.
  const view = subServiceView(services, filters);
  const filtered = view.shown !== view.total;
  // Headings earn their place only when there is more than one category to
  // tell apart.
  const showCategoryHeads = new Set(view.rows.map((r) => r.service.category)).size > 1;

  return (
    <>
      {filtered && view.state === "ok" && (
        <p className="detail-note service-filter-count">
          Showing {view.shown} of {view.total} services
        </p>
      )}

      {view.state === "no-match" ? (
        <p className="subtle">No service matches these filters.</p>
      ) : view.state === "no-feedbacks" ? (
        <p className="subtle">No feedbacks about this service yet.</p>
      ) : (
        byCategory(view.rows).map(([cat, items]) => {
          const rows = items;
          return (
            <section key={cat} className="service-group">
              {showCategoryHeads && (
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
                  categoryName={categoryName}
                  categoryTrait={categoryTrait}
                  sentimentBy={sentimentBy}
                  subPointBy={subPointBy}
                  placeId={placeId}
                  filters={filters}
                  salonName={salonName}
                />
              ))}
            </section>
          );
        })
      )}
    </>
  );
}


/** One service's row in the detail list: its score tiles (ServiceScoreList's
    children), opened to show CategoryEvidence for whichever score the reader
    clicks. `members` carries the sibling services collapsed into this row by
    groupServices, so the summary can name all of them. */
function ServiceScores({ service, categoryName, categoryTrait, sentimentBy, subPointBy, displayName, members, placeId, filters, salonName }) {
  /* Category 3 (Management Responsiveness) is scored from the owner's replies,
     not from customer feedback about this service, and has its own panel, so
     it is not a row here. */
  const rows = categoryScoreRows(service.category_scores)
    .filter((r) => isShownCategory(r.category_no) && Number(r.category_no) !== 3)
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
        {service.evidence_reviews > 0 && (
          <span className="detail-service-count">
            {service.evidence_reviews} {service.evidence_reviews === 1 ? "feedback" : "feedbacks"} about this service
          </span>
        )}
      </summary>
      {members && members.length > 1 && (
        <p className="detail-service-covers">
          Covers {members.map((m) => serviceName(m)).join(", ")}
        </p>
      )}
      {badges.length > 0 && (
        <div className="badge-row">
          {badges.map((b) => <span key={b} className="badge badge--c-muted">{b}</span>)}
        </div>
      )}
      <ul className="cat-score-list">
        {rows.map((r, i) => {
          /* No data: nobody wrote about this category for this service. It is
             left out of this service's ranking, so it shows a dash and a
             "No data" label rather than a number. */
          const noData = r.score == null || Number(r.evidence_count) === 0;
          const s = noData ? null : Math.round(r.score * 100);
          const st = noData ? null : getScoreStyle(s);
          return (
            <li key={r.category_no} className={`csl-row ${noData ? "csl-row--nodata" : ""}`}>
              <div className="csl-top">
                <span className="csl-no">{String(i + 1).padStart(2,"0")}</span>
                <span className="csl-name">{CATEGORY_DISPLAY[r.category_no] ?? r.name}</span>
                {noData ? (
                  <span className="csl-band csl-band--nodata">No data</span>
                ) : (
                  <span className={`csl-band csl-band--${st.cls}`} style={verdictInk(st)}>{st.label}</span>
                )}
                <span className="csl-score">{noData ? "–" : s}</span>
              </div>
              <div className="csl-bar">
                <span className="csl-bar-fill" style={{ width: noData ? 0 : `${s}%` }} />
              </div>
              <span className="csl-blurb">
                {noData
                  ? "No feedbacks about this yet, so it is left out of this service's score."
                  : CATEGORY_BLURB[r.category_no]}
              </span>
              <EvidencePanel
                placeId={placeId}
                salonName={salonName}
                query={{ about_sub_service: service.sub_service_code, category_no: r.category_no }}
                label="Show feedbacks about this service"
                emptyText="No feedbacks about this service carry this yet."
              />
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

/** The paged "browse all reviews" list, filtered by DetailFilters' chips.
    Independent of the per-category drawers above it: this is every feedback
    matching the filters, not the evidence behind one score. */
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
  const { service_code, category_no, polarity, named, language, sort } = filters;
  const query = useMemo(
    // polarity (single-select) and `named` (names a staff member) are
    // independent, so both can be active. Neutral mention-polarity rows stay
    // hidden unless the reader is after named reviews.
    () => ({
      service_code, category_no, polarity, sort,
      only_named: named || undefined,
      hide_mention: named ? undefined : true,
      language: language || undefined,
    }),
    [service_code, category_no, polarity, named, language, sort],
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
          matters: evidence_text is the extraction's justification span,
          capped at 100 characters, so it arrives cut mid-word ("...my all
          time trusted beau") and would read as a truncated sentence quoted
          as the customer's own words. review_text, from raw.review, is the
          whole feedback and is what gets quoted whenever it is present. */}
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

/** The salon profile page. Loads getProvider and getFramework once, then
    renders identity, gates/safety, every service's score tiles
    (ServiceScores) and the filtered feedback browser (EvidenceList).
    consistencyWindow carries the 6m/1y/3y/anytime choice from wherever the
    reader opened the profile from, so every category score and the
    specialism badge match what they were looking at. */
export function SalonDetail({ salonId, onBack, consistencyWindow = "anytime", weights = null }) {
  const [provider, setProvider] = useState(null);
  const [categories, setCategories] = useState([]);
  const [sentiment, setSentiment] = useState([]);
  const [subPointProof, setSubPointProof] = useState([]);
  const [replyQuality, setReplyQuality] = useState(null);
  const [filters, setFilters] = useState(BLANK_FILTERS);
  const [tab, setTab] = useState("summary");
  /* Which category summaries are open on the Profile tab: none at first, so
     the seven verdicts read as one short list. */
  const [openCats, setOpenCats] = useState(() => new Set());
  const toggleCat = (no) => setOpenCats((prev) => {
    const next = new Set(prev);
    if (next.has(no)) next.delete(no); else next.add(no);
    return next;
  });
  const [error, setError] = useState(null);
  useEffect(() => {
    const ctrl = new AbortController();
    setProvider(null);
    setError(null);
    getProvider(salonId, { signal: ctrl.signal }, consistencyWindow)
      .then(setProvider)
      .catch((e) => e.name !== "AbortError" && setError(e.message));
    getFramework({ signal: ctrl.signal })
      .then((fw) => setCategories(frameworkRows(fw).filter((c) => isShownCategory(c.category_no))))
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
  }, [salonId, consistencyWindow]);

  if (error) return <p className="error">{error}</p>;
  if (!provider) return <p className="loading-text">Loading</p>;

  const p = provider.provider ?? provider;
  const name = p.name ?? p.provider_name;
  const gates = provider.gates_and_vetoes ?? [];
  /* The taxonomy folds Beard & Shave under Hair and has no standalone
     "Gents' Grooming" category, but evidence rows still carry that category
     tag. Remapped on read so the detail filters match the rest of the app —
     no "Gents' Grooming" chip. */
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

  return (
    <article className="salon-detail">
      <button type="button" className="btn-text back-link" onClick={onBack}>
        ← Back
      </button>

      <header className="detail-hero">
        <div className="detail-hero-main">
          <h1 className="detail-name">{name}</h1>
          <p className="detail-meta">
            {p.address}
            {p.city && !String(p.address ?? "").includes(p.city) ? ` · ${p.city}` : ""}
          </p>
          {p.google_rating != null && (
            <p className="detail-rating-line">
              <b>★ {p.google_rating}</b> on Google
              {p.google_review_count ? <span> · {p.google_review_count} reviews, shown for reference only</span> : null}
            </p>
          )}
          <div className="detail-chips">
            <PopularServicesBadge data={provider.popular_services} />
            <SpecialismBadge data={provider.specialism} />
            {closed && (
              <span className="detail-chip detail-chip--alert">
                {p.permanently_closed ? "Permanently closed" : "Temporarily closed"}
              </span>
            )}
            {/* The map link lives beside the other chips, not in a side column:
                where the salon is, is part of who it is, and it should not
                need a tab change -- and it should not jump above the name on
                a phone either, which a separate side column used to do. */}
            {p.place_url && (
              <a href={p.place_url} target="_blank" rel="noopener noreferrer" className="maps-link">
                <IconPin size={12} />
                View on Google Maps
              </a>
            )}
          </div>
        </div>
      </header>

      <DonutDefs />

      {/* ── Tab bar ─────────────────────────────────────────────── */}
      <nav className="detail-tabs" aria-label="Salon sections">
        {[
          { id: "summary", label: "Profile information" },
          { id: "feedbacks", label: "Customer Feedbacks" },
          { id: "scores",  label: "Scores by Service" },
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
              Inner ring: share of negative feedbacks
            </li>
          </ul>
          {services.length === 0 ? (
            <p className="subtle">No service has feedback evidence for this salon yet.</p>
          ) : (
            <ServiceScoreList
              services={services}
              categoryName={categoryName}
              categoryTrait={categoryTrait}
              sentimentBy={sentimentBy}
              subPointBy={subPointBy}
              placeId={salonId}
              filters={filters}
              salonName={name}
            />
          )}
        </section>
      )}

      {/* ── Summary tab ─────────────────────────────────────────── */}
      {tab === "summary" && (
        <section className="detail-panel">
          <SalonInformation gates={gates} />

          {/* The evidence this profile rests on, before any finding: the
              overall score beside how many feedbacks were read and how they
              split, then who is named and what happens after a complaint. */}
          <div className="evsum">
            <div className="evsum-top">
              <OverallSalonScore placeId={salonId} window={consistencyWindow} weights={weights} />
              <FeedbackTotals totals={provider.sentiment_totals} languages={provider.languages} />
            </div>
            <div className="evsum-cards">
              <StaffReputation data={provider.staff_reputation} placeId={salonId} />
              <ResponsivenessRing
                replyQuality={replyQuality}
                subPointBy={subPointBy}
                checks={subPointsOf(3)}
              />
            </div>
          </div>

          {/* Category findings: one summary row each; open one for its checks. */}
          {/* Category 3 is left out: it is scored from the owner's replies
              rather than from what customers wrote, so it does not belong
              under this heading. The Responsiveness panel above still
              reports it in full. */}
          <div className="summary-cats-head">
            <h2 className="summary-cats-title">What customers say, by category</h2>
            <button type="button" className="btn-text summary-cats-all" onClick={() => setOpenCats(openCats.size === SUMMARY_CATEGORIES.length ? new Set() : new Set(SUMMARY_CATEGORIES))}>
              {openCats.size === SUMMARY_CATEGORIES.length ? "Close all" : "Open all"}
            </button>
          </div>
          <div className="summary-cats">
            {SUMMARY_CATEGORIES.map((no, i) => {
              const label = CATEGORY_DISPLAY[no] ?? categoryName[no] ?? `Category ${no}`;
              const checks = subPointsOf(no);
              // aggregate across all sub-points; a mixed comment counts half positive, half negative
              let totalPos = 0, totalNeg = 0;
              for (const c of checks) {
                if (no === 3 && c.code !== "3.5") continue;   // 3.1-3.4 come from owner replies, not statements
                const cnt = subPointBy?.[c.code];
                totalPos += (cnt?.positive ?? 0) + 0.5 * (cnt?.mixed ?? 0);
                totalNeg += (cnt?.negative ?? 0) + 0.5 * (cnt?.mixed ?? 0);
              }
              const total = Math.round(totalPos + totalNeg);
              const posShare = total ? Math.round((totalPos / (totalPos + totalNeg)) * 100) : null;

              // Category 3 is the average of its parts that have evidence, as in the score.
              // One shared helper, so this verdict and the ring beside the
              // staff section can never disagree.
              const share = no === 3
                ? responsivenessFigure(replyQuality, totalPos, totalNeg).share
                : posShare;
              const verdict = verdictFor(share);

              return (
                <div key={no} className={`sum-card ${openCats.has(no) ? "is-open" : ""}`}>
                  {/* The whole summary is one button: verdict, share and count
                      stay visible; the checks and the feedbacks open under it. */}
                  <button
                    type="button"
                    className="sum-card-toggle"
                    aria-expanded={openCats.has(no)}
                    aria-controls={`cat-body-${no}`}
                    onClick={() => toggleCat(no)}
                  >
                    <span className="sum-card-no">{String(i + 1).padStart(2,"0")}</span>
                    <span className="sum-card-title">
                      <strong>{label}</strong>
                      <span className="sum-card-sub">{CATEGORY_BLURB[no]}</span>
                    </span>
                    {no === 3 && replyQuality?.complaints > 0 ? (() => {
                      const rq = replyQuality;
                      const replyRate = Math.round((rq.complaints_replied / rq.complaints) * 100);
                      return (
                        <span className="sum-finding">
                          <span className="sum-finding-bar"><span className="sum-finding-fill" style={{ width: `${replyRate}%` }} /></span>
                          <span className="sum-finding-stat">Owner replied to <b>{replyRate}%</b> of complaints — {rq.complaints_replied} of {rq.complaints}</span>
                        </span>
                      );
                    })() : total > 0 ? (
                      <span className="sum-finding">
                        <span className="sum-finding-bar"><span className="sum-finding-fill" style={{ width: `${posShare}%` }} /></span>
                        <span className="sum-finding-stat"><b>{posShare}%</b> positive across {total} feedback{total !== 1 ? "s" : ""}</span>
                      </span>
                    ) : <span className="sum-finding sum-finding--none">No feedbacks yet</span>}
                    {verdict
                      ? <span className={`sum-verdict sum-verdict--${verdict.cls}`} style={verdictInk(verdict)}>{verdict.word}</span>
                      : <span />}
                    <span className="sum-card-chev" aria-hidden="true">{openCats.has(no) ? "−" : "+"}</span>
                  </button>

                  {openCats.has(no) && (
                  <div id={`cat-body-${no}`} className="sum-card-body">
                  {/* sub-point breakdown */}
                  <ul className="sum-checks">
                    {checks.map((c) => {
                      // 3.1: complaints answered
                      if (c.code === "3.1" && replyQuality) {
                        const rq = replyQuality;
                        const coverage = rq.complaints > 0 ? Math.round((rq.complaints_replied / rq.complaints) * 100) : null;
                        const icon31 = coverage == null ? "—" : coverage >= 75 ? "✓" : coverage >= 50 ? "~" : "✗";
                        const cls31 = coverage == null ? "neutral" : coverage >= 75 ? "pos" : coverage >= 50 ? "mix" : "neg";
                        const summary31 = coverage == null
                          ? <span className="sum-check-none">No complaints received</span>
                          : <>
                              Owner replied to <b>{coverage}%</b> of complaints
                              <br /><span className="sum-check-n">{rq.complaints_replied} of {rq.complaints} complaint{rq.complaints !== 1 ? "s" : ""} got a reply</span>
                            </>;
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
                              <span className="sum-check-right"><span className="sum-check-none">No replies to complaints yet</span></span>
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
                              <span className="sum-check-n">{sp.specific ?? 0} specific · {sp.partly ?? 0} partly · {generic} generic (out of {total32} replies to complaints)</span>
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
                          return (
                            <li key={c.code} className="sum-check">
                              <span className="sum-check-icon sum-check-icon--neutral">—</span>
                              <span className="sum-check-body">
                                <span className="sum-check-label">{c.question ?? c.label}</span>
                                <span className="sum-check-blurb">{c.blurb}</span>
                              </span>
                              <span className="sum-check-right">
                                <span className="sum-check-none">No replies to complaints yet</span>
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
                              <br /><span className="sum-check-n">{accepts} accepted · {disputes} disputed · {total33} repl{total33 !== 1 ? "ies" : "y"} to complaints</span>
                            </span>
                          </li>
                        );
                      }

                      // 3.4: promise tracking
                      if (c.code === "3.4" && replyQuality) {
                        const pr = replyQuality.promises ?? {};
                        const kept = pr.kept ?? 0, broken = pr.broken ?? 0;
                        const noChange = pr.no_clear_change ?? 0, untestable = pr.not_testable ?? 0;
                        const made = kept + broken + noChange + untestable;
                        const tested = kept + broken;
                        const icon34 = tested === 0 ? (made ? "~" : "—") : kept > broken ? "✓" : kept === broken ? "~" : "✗";
                        const cls34 = tested === 0 ? (made ? "mix" : "neutral") : kept > broken ? "pos" : kept === broken ? "mix" : "neg";
                        const verdict34 = tested === 0 ? "No promise could be tested against later feedbacks yet"
                          : kept > broken ? "More promises kept than broken"
                          : kept === broken ? "As many promises kept as broken"
                          : "More promises broken than kept";
                        const right34 = made === 0
                          ? <span className="sum-check-none">No promises to improve found in replies</span>
                          : <>
                              {verdict34}<br />
                              <span className="sum-check-n">{kept} kept · {broken} broken · {noChange} no clear change · {untestable} not testable</span>
                            </>;
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
                      const mixed = cnt?.mixed ?? 0;
                      const pos = (cnt?.positive ?? 0) + 0.5 * mixed;
                      const n = (cnt?.positive ?? 0) + (cnt?.negative ?? 0) + mixed;
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

                  {/* Whole salon: every feedback in this category, whatever
                      service it is about. The per-service view is on the
                      Scores by Service tab. */}
                  <EvidencePanel
                    placeId={salonId}
                    salonName={name}
                    query={{ category_no: no }}
                    label="Show feedbacks across the salon"
                    emptyText="No feedbacks carry this for the salon yet."
                  />
                  </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Reviews tab ─────────────────────────────────────────── */}
      {tab === "feedbacks" && (
        <section className="detail-panel">
          <DetailFilters
            services={services}
            categories={categories}
            sentimentTotals={provider.sentiment_totals ?? {}}
            languages={provider.languages?.languages ?? []}
            filters={filters}
            onChange={setFilters}
          />
          <SelectionSummary filters={filters} categories={categories} services={services} />
          <EvidenceList placeId={salonId} filters={filters} salonName={name} />
        </section>
      )}


    </article>
  );
}
