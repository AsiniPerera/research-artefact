/* Rendered by Results.jsx (one per row in the ranking list) and by
   SalonDetail's nearby-salons list. `salon` is one row of the API's
   ranked/available_but_not_ranked arrays, already carrying category_scores. */
import { useState } from "react";
import { IconHeart, IconAlert, IconChevron } from "./Icons";
import { useFavorites } from "../hooks/useFavorites";
import { toggleFavorite } from "../lib/favorites";
import { splitBadges } from "../api/client";
import { CATEGORY_INFO, isShownCategory } from "../constants/categories";
import { AUDIENCE } from "../constants/audience";
import { getScoreStyle } from "../lib/scoreScale";

const isCardCategory = (no) => isShownCategory(no) && Number(no) !== 3;
/* Read across, then down: Quality Staff Trust / Value Safety Care. */
const CARD_ORDER = [1, 5, 4, 6, 7, 2];

/** 0–1 score → 0–100 for display. */
const pct = (x) => Math.round(Number(x ?? 0) * 100);

/* The numbers and the range bar take their colour from the site-wide score
   scale (lib/scoreScale.js); the CSS reads --tone and --tone-ink. */
const toneStyle = (v) => {
  const s = getScoreStyle(v);
  return { "--tone": s.color, "--tone-ink": s.ink };
};

/* Hover text for one category: the full name, the score, its band and what the
   category covers. The row shows the short name; this is the long one. */
const barTip = (no, v) =>
  `${CATEGORY_INFO[no].name} — ${v} out of 100, ${getScoreStyle(v).label}. (${CATEGORY_INFO[no].description}.)`;

const joinNames = (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/* A plain sentence on why this salon sits where it does: its strongest scores
   once the reader's priorities are applied, what the reader weighted up, and its
   weakest score if that is low. `priorities` is the seven weights in category
   order, the same list the ranking was asked for. */
function whyText({ position, provisional, scored, priorities }) {
  if (provisional) {
    return "Less certain: it has feedbacks about this service, but too few or too mixed to be sure of its score, so its position could change.";
  }
  if (scored.length === 0) return "There are no category scores to explain this position yet.";
  const w = (no) => priorities?.[no - 1] ?? 2;
  const strongest = [...scored].sort((a, b) => w(b.no) * b.v - w(a.no) * a.v).slice(0, 2);
  const name = (s) => `${CATEGORY_INFO[s.no].short} (${s.v})`;
  const lead = position === 1 ? "Ranked first" : `Ranked #${position}`;
  const weights = scored.map((s) => w(s.no));
  const equal = weights.every((x) => x === weights[0]);
  const up = scored.filter((s) => w(s.no) >= 4 && w(s.no) === Math.max(...weights)).map((s) => CATEGORY_INFO[s.no].short);
  const prio = equal
    ? "your priorities weight every category equally"
    : up.length ? `you gave extra weight to ${joinNames(up)}` : "of the priorities you set";
  const weakest = [...scored].sort((a, b) => a.v - b.v)[0];
  const weak = weakest && weakest.v < 60 ? ` Its lowest score is ${name(weakest)}.` : "";
  return `${lead} because ${joinNames(strongest.map(name))} ${strongest.length > 1 ? "are" : "is"} among its strongest scores, and ${prio}.${weak}`;
}

/**
 * One ranked salon as a list row: rank, name and the facts behind it on the
 * left, the score with its band and 80% range on the right. The six category
 * scores, and the sentence explaining the position, open on the arrow — a page
 * of salons reads as names and verdicts until the detail is asked for.
 *
 * ratedFor names the service the score belongs to, passed only when broader
 * than what the user asked for.
 */
export function SalonCard({ salon, onSelect, ratedFor, position, provisional = false, priorities }) {
  const [detailOpen, setDetailOpen] = useState(false);
  const rank = salon.rank_no;
  /* A salon reaches this row either ranked or merely listed. Only a ranked one
     has a rank_no, so the two must be told apart: the score and its range are
     shown for both, and without the note below an unranked salon reads as
     though it had earned its position. */
  const ranked = salon.rank_status === "ranked";
  const score = pct(salon.personal_score);
  const open = () => onSelect?.(salon.place_id);
  const favorites = useFavorites();
  const saved = favorites.some((f) => f.salon_id === salon.place_id);
  const badges = splitBadges(salon.badges);
  const gateBadges = badges.filter((b) => b.startsWith("gate"));
  const catScores = (salon.category_scores ?? [])
    .filter((c) => isCardCategory(c.category_no))
    .sort((a, b) => CARD_ORDER.indexOf(a.category_no) - CARD_ORDER.indexOf(b.category_no));
  const closed = salon.permanently_closed || salon.temporarily_closed;

  /* A category nobody wrote about has no data: the API sends score null and
     the ranking leaves it out of the score (29_no_data_dimensions.sql). It is
     drawn as a dash, not a number -- pct(null) would print 0, which would read
     as a measured zero. A fixture or older response with no evidence_count is
     treated as having data. */
  const scored = catScores.map((c) => ({
    no: c.category_no,
    v: c.score == null || (c.evidence_count != null && Number(c.evidence_count) === 0)
      ? null : pct(c.score),
  }));
  const withData = scored.filter((c) => c.v != null);
  const feedbacks = salon.reviews_total ?? 0;
  const written = salon.total_feedbacks ?? 0;
  const about = salon.evidence_reviews ?? 0;

  const n = position ?? (ranked ? rank : null);
  const band = getScoreStyle(score);

  const fmt = (x) => Number(x).toLocaleString("en-US");
  const reviewsLine =
    about > 0 && feedbacks >= about
      ? `${fmt(about)} of ${fmt(feedbacks)} reviews ${about === 1 ? "is" : "are"} about this service`
      : about > 0
        ? `${fmt(about)} ${about === 1 ? "review" : "reviews"} about this service`
        : feedbacks > 0
          ? `${fmt(feedbacks)} ${feedbacks === 1 ? "review" : "reviews"} in all`
          : null;

  const meta = [
    salon.city || "Colombo District",
    salon.audience ? AUDIENCE[salon.audience]?.label : null,
    /* One plain sentence on how much the score rests on: how many of the
       salon's reviews are about this service. A salon with 4,545 reviews and
       44 about haircuts should not read as a salon with 44, so both numbers
       sit together on the row face, where the reader weighs the score. */
    reviewsLine,
    ratedFor ? `Rated for ${ratedFor}` : null,
  ].filter(Boolean).join("  ·  ");

  return (
    <article className="slr" data-id={salon.place_id} style={toneStyle(score)}>
      {/* rank_no is null for an unranked salon, which would otherwise read
          as "Rank " with nothing after it. */}
      <span className="sr-only">
        {position != null ? `Position ${position}${provisional ? ", less certain" : ""}` : rank != null ? `Rank ${rank}` : "Available but not ranked"}
      </span>
      <span className="slr-rank" aria-hidden="true">{n ?? "–"}</span>

      <div className="slr-id">
        <button type="button" className="slr-name" onClick={open}>{salon.provider_name}</button>
        <p className="slr-meta">{meta}</p>
      </div>

      <div className="slr-score"
           title={`Score ${score} out of 100, ${band.label}.`}>
        <span className="slr-score-num">{score}</span>
        <span className="slr-score-band">{band.label}</span>
      </div>

      {scored.length > 0 ? (
        <button
          type="button"
          className="slr-toggle"
          aria-expanded={detailOpen}
          aria-controls={`detail-${salon.place_id}`}
          aria-label={`${detailOpen ? "Hide" : "Show"} category scores for ${salon.provider_name}`}
          onClick={() => setDetailOpen((v) => !v)}
        >
          <IconChevron size={14} />
        </button>
      ) : <span className="slr-toggle slr-toggle--none" aria-hidden="true" />}

      <button
        type="button"
        className={`slr-fav ${saved ? "is-on" : ""}`}
        onClick={() => toggleFavorite({ salon_id: salon.place_id, name: salon.provider_name })}
        aria-pressed={saved}
        aria-label={saved ? `Remove ${salon.provider_name} from favorites` : `Save ${salon.provider_name} to favorites`}
        title={saved ? "Saved" : "Save to favorites"}
      >
        <IconHeart size={17} filled={saved} />
      </button>

      {detailOpen && (
        <div className="slr-detail" id={`detail-${salon.place_id}`}>
          {priorities && n != null && (
            <p className="slr-why">{whyText({ position: n, provisional, scored: withData, priorities })}</p>
          )}
          <ul className="slr-cats" aria-label="Every category score">
            {scored.map(({ no, v }) => (v == null ? (
              <li key={no} className="slr-cat--nodata" tabIndex={0}
                  data-tip={`${CATEGORY_INFO[no].name} — no feedbacks about this yet, so it is left out of the score.`}>
                <span className="slr-cat-label">{CATEGORY_INFO[no].short}</span>
                <span className="slr-cat-num" aria-label="no data">–</span>
              </li>
            ) : (
              <li key={no} style={toneStyle(v)} data-tip={barTip(no, v)} tabIndex={0}>
                <span className="slr-cat-label">{CATEGORY_INFO[no].short}</span>
                <span className="slr-cat-num">{v}</span>
              </li>
            )))}
          </ul>
          <p className="slr-counts">
            <b>{about > 0 ? fmt(about) : "No"}</b> review{about === 1 ? "" : "s"} about this service
            {feedbacks > 0 && <> &middot; {fmt(feedbacks)} review{feedbacks === 1 ? "" : "s"} in all</>}
            {written > 0 && <> &middot; {fmt(written)} with written comments</>}
          </p>
        </div>
      )}

      {(closed || gateBadges.length > 0) && (
        <div className="slr-notes">
          {closed && (
            <p className={`slr-note ${salon.permanently_closed ? "is-grave" : ""}`}>
              <IconAlert size={13} />
              {salon.permanently_closed ? "Permanently closed" : "Temporarily closed"} on Google.
            </p>
          )}
          {gateBadges.map((b) => (
            <p key={b} className="slr-note" title="Gate applied: −0.15 to the score">
              <IconAlert size={13} />
              {b}
            </p>
          ))}
        </div>
      )}
    </article>
  );
}
