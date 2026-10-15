/* Rendered by Results.jsx (one per row in the ranking grid) and by
   SalonDetail's nearby-salons list. `salon` is one row of the API's
   ranked/available_but_not_ranked arrays, already carrying category_scores. */
import { useState } from "react";
import { IconHeart, IconAlert, IconPin } from "./Icons";
import { useFavorites } from "../hooks/useFavorites";
import { toggleFavorite } from "../lib/favorites";
import { splitBadges } from "../api/client";
import { CATEGORY_INFO, isShownCategory } from "../constants/categories";
import { AUDIENCE } from "../constants/audience";
import { getScoreStyle } from "../lib/scoreScale";

const isCardCategory = (no) => isShownCategory(no) && Number(no) !== 3;
const CARD_ORDER = [1, 7, 2, 5, 6, 4];

/** 0–1 score → 0–100 for display. */
const pct = (x) => Math.round(Number(x ?? 0) * 100);

/* The ring, the bars and the numbers all take their colour from the site-wide
   score scale (lib/scoreScale.js); the CSS reads --tone and --tone-ink. */
const toneStyle = (v) => {
  const s = getScoreStyle(v);
  return { "--tone": s.color, "--tone-ink": s.ink };
};

/* Hover text for one category bar: the full name, the score, its band and
   what the category covers. The card shows the short name; this is the long one. */
const barTip = (no, v) =>
  `${CATEGORY_INFO[no].name} — ${v} out of 100, ${getScoreStyle(v).label}. (${CATEGORY_INFO[no].description}.)`;

const joinNames = (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/* A plain sentence on why this salon sits where it does: its strongest scores
   once the reader's priorities are applied, what the reader weighted up, and its
   weakest score if that is low. `priorities` is the seven weights in category
   order, the same list the ranking was asked for. */
function whyText({ position, provisional, scored, priorities }) {
  if (provisional) {
    return "Listed after the ranked salons: it has feedbacks about this service, but too few or too mixed to be sure of its score, so its position could change.";
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
 * One ranked salon, laid out as a "dossier" strip: identity and score on top,
 * the category breakdown across the middle, and any advisory underneath.
 *
 * ratedFor names the service the score belongs to, passed only when broader
 * than what the user asked for.
 */
export function SalonCard({ salon, onSelect, ratedFor, position, provisional = false, priorities }) {
  const [whyOpen, setWhyOpen] = useState(false);
  const rank = salon.rank_no;
  /* A salon reaches this card either ranked or merely listed. Only a ranked one
     has a rank_no, so the two must be told apart on the card itself: the score
     and its range are shown for both, and without the chip below an unranked
     salon reads as though it had earned its position. */
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

  const scored = catScores.map((c) => ({ no: c.category_no, v: pct(c.score) }));
  const feedbacks = salon.reviews_total ?? 0;
  const written = salon.total_feedbacks ?? 0;
  const about = salon.evidence_reviews ?? 0;

  return (
    <article
      className="salon-card sc2 is-clickable"
      data-id={salon.place_id}
      /* The whole card opens the salon; controls inside it keep their own job. */
      onClick={(e) => { if (!e.target.closest("button, a, input, label, [data-tip], .sc2-why-text")) open(); }}
      data-tier={!ranked ? undefined : (position ?? rank) === 1 ? "gold" : (position ?? rank) === 2 ? "silver" : (position ?? rank) === 3 ? "bronze" : undefined}
    >
      <div className="sc2-top">
        <div className="sc2-id">
          {/* rank_no is null for an unranked salon, which would otherwise read
              as "Rank " with nothing after it. */}
          <span className="sr-only">
            {position != null ? `Position ${position}${provisional ? ", less certain" : ""}` : rank != null ? `Rank ${rank}` : "Available but not ranked"}
          </span>
          <div className="sc2-namerow">
            {(position ?? (ranked ? rank : null)) != null && (
              <span className="sc2-rank" aria-hidden="true">{position ?? rank}</span>
            )}
            <button type="button" className="sc2-name" onClick={open}>{salon.provider_name}</button>
            {provisional && (
              <span className="sc2-prov"
                    title="We have feedbacks about this service, but too few or too mixed to be sure of this score, so this position could change.">
                Less certain
              </span>
            )}
          </div>

          <p className="sc2-meta">
            <IconPin size={13} />
            <span>{salon.city || "Colombo District"}</span>
            {salon.audience && <span className="sc2-meta-dot sc2-aud" title={AUDIENCE[salon.audience]?.hint}>{AUDIENCE[salon.audience]?.label}</span>}
            {ratedFor && <span className="sc2-meta-dot">Rated for {ratedFor}</span>}
            {feedbacks > 0 && <span className="sc2-meta-dot">{feedbacks} feedbacks</span>}
            {written > 0 && <span className="sc2-meta-dot">{written} with comments</span>}
            <span className="sc2-meta-dot">{about > 0 ? `${about} about this service` : "none about this service"}</span>
          </p>
        </div>

        <div className="sc2-side">
          <div className="sc2-score" data-tone={getScoreStyle(score).cls} style={toneStyle(score)} title={`Range ${pct(salon.range_low)}–${pct(salon.range_high)}`}>
            <div className="sc2-ring" style={{ "--p": score }}>
              <span>{score}</span>
            </div>
            <p className="sc2-band">{getScoreStyle(score).label}</p>
            <p className="sc2-range">{pct(salon.range_low)}–{pct(salon.range_high)}</p>
          </div>
          <div className="sc2-actions">
            <button type="button" className="sc2-view" onClick={open}>View salon</button>
            <button
              type="button"
              className={`sc2-fav ${saved ? "is-on" : ""}`}
              onClick={() => toggleFavorite({ salon_id: salon.place_id, name: salon.provider_name })}
              aria-pressed={saved}
              aria-label={saved ? `Remove ${salon.provider_name} from favorites` : `Save ${salon.provider_name} to favorites`}
              title={saved ? "Saved" : "Save to favorites"}
            >
              <IconHeart size={16} filled={saved} />
            </button>
          </div>
        </div>
      </div>

      {scored.length > 0 && (
        <ul className="sc2-bars" aria-label="Category scores">
          {scored.map(({ no, v }) => (
            <li key={no} data-tone={getScoreStyle(v).cls} style={toneStyle(v)} data-tip={barTip(no, v)} tabIndex={0}>
              <span className="sc2-bar-label">{CATEGORY_INFO[no].short}</span>
              <span className="sc2-bar"><i style={{ width: `${v}%` }} /></span>
              <span className="sc2-bar-num">{v}</span>
            </li>
          ))}
        </ul>
      )}

      {priorities && scored.length > 0 && (position ?? rank) != null && (
        <div className="sc2-why">
          <button type="button" className="sc2-why-link" aria-expanded={whyOpen} onClick={() => setWhyOpen((v) => !v)}>
            Why #{position ?? rank}? <span aria-hidden="true">{whyOpen ? "−" : "+"}</span>
          </button>
          {whyOpen && <p className="sc2-why-text">{whyText({ position: position ?? rank, provisional, scored, priorities })}</p>}
        </div>
      )}

      {(closed || gateBadges.length > 0) && (
        <div className="scd-advisory">
          {closed && (
            <p className={`scd-advisory-line ${salon.permanently_closed ? "is-grave" : ""}`}>
              <span className="scd-advisory-tag">[Advisory Notice]</span>
              <span className="scd-advisory-icon" aria-hidden="true"><IconAlert size={13} /></span>
              {salon.permanently_closed ? "Permanently closed" : "Temporarily closed"} on Google.
            </p>
          )}
          {gateBadges.map((b) => (
            <p key={b} className="scd-advisory-line" title="Gate applied: −0.15 to the score">
              <span className="scd-advisory-tag">[Advisory Notice]</span>
              <span className="scd-advisory-icon" aria-hidden="true"><IconAlert size={13} /></span>
              {b}
            </p>
          ))}
        </div>
      )}
    </article>
  );
}
