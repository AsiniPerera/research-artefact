/* Rendered by Results.jsx (one per row in the ranking grid) and by
   SalonDetail's nearby-salons list. `salon` is one row of the API's
   ranked/available_but_not_ranked arrays, already carrying category_scores. */
import { IconHeart, IconAlert, IconPin } from "./Icons";
import { useFavorites } from "../hooks/useFavorites";
import { toggleFavorite } from "../lib/favorites";
import { splitBadges } from "../api/client";
import { CATEGORY_INFO, isShownCategory } from "../constants/categories";
import { AUDIENCE } from "../constants/audience";

const isCardCategory = (no) => isShownCategory(no) && Number(no) !== 3;
const CARD_ORDER = [1, 7, 2, 5, 6, 4];

/** 0–1 score → 0–100 for display. */
const pct = (x) => Math.round(Number(x ?? 0) * 100);

/* A qualitative band word under each number, so a score reads as a standing,
   not just a figure. */
function bandWord(v) {
  if (v >= 90) return "Excellent";
  if (v >= 80) return "Very Good";
  if (v >= 70) return "Good";
  if (v >= 60) return "Average";
  if (v >= 50) return "Below Average";
  return "Needs Improvement";
}

/* A band key that drives the colour, so word + number share one hue. */
function bandKey(v) {
  if (v >= 90) return "excellent";
  if (v >= 80) return "verygood";
  if (v >= 70) return "good";
  if (v >= 60) return "average";
  if (v >= 50) return "below";
  return "poor";
}

/**
 * One ranked salon, laid out as a "dossier" strip: identity and score on top,
 * the category breakdown across the middle, and any advisory underneath.
 *
 * ratedFor names the service the score belongs to, passed only when broader
 * than what the user asked for.
 */
export function SalonCard({ salon, onSelect, ratedFor, position, provisional = false }) {
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
      className="salon-card sc2"
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
          <div className="sc2-score" title={`Range ${pct(salon.range_low)}–${pct(salon.range_high)}`}>
            <div className="sc2-ring" style={{ "--p": score }}>
              <span>{score}</span>
            </div>
            <p className="sc2-band">{bandWord(score)}</p>
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
            <li key={no} data-band={bandKey(v)} title={`${CATEGORY_INFO[no].name}: ${v} of 100`}>
              <span className="sc2-bar-label">{CATEGORY_INFO[no].short}</span>
              <span className="sc2-bar"><i style={{ width: `${v}%` }} /></span>
              <span className="sc2-bar-num">{v}</span>
            </li>
          ))}
        </ul>
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
