/* Rendered by Results.jsx (one per row in the ranking grid) and by
   SalonDetail's nearby-salons list. `salon` is one row of the API's
   ranked/available_but_not_ranked arrays, already carrying category_scores. */
import { IconHeart, IconAlert } from "./Icons";
import { useFavorites } from "../hooks/useFavorites";
import { toggleFavorite } from "../lib/favorites";
import { splitBadges } from "../api/client";
import { CATEGORY_INFO, isShownCategory } from "../constants/categories";

const isCardCategory = (no) => isShownCategory(no) && Number(no) !== 3;
const CARD_ORDER = [1, 9, 7, 2, 5, 6, 4];

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
export function SalonCard({ salon, onSelect, ratedFor }) {
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
  return (
    <article
      className="salon-card salon-card--row salon-card--dossier"
      data-tier={rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : undefined}
    >
      {/* ── Top row: identity (left) · score + actions (right) ── */}
      <div className="scd-top">
        <div className="scd-id">
          {/* rank_no is null for an unranked salon, which would otherwise read
              as "Rank " with nothing after it. */}
          <span className="sr-only">
            {rank != null ? `Rank ${rank}` : "Available but not ranked"}
          </span>
          <button type="button" className="salon-name" onClick={open}>
            {salon.provider_name}
          </button>
          <p className="scd-meta">
            <span className="scd-meta-city">{salon.city || "Colombo District"}</span>
            {ratedFor && (
              <>
                <span className="scd-meta-sep" aria-hidden="true">/</span>
                <span className="scd-meta-kind">Rated for {ratedFor}</span>
              </>
            )}
          </p>
          {!ranked && (
            <span className="scd-unranked"
                  title="This salon offers the service, but there is not enough review evidence about it to place it in the ranking.">
              Available but Not Ranked
            </span>
          )}
        </div>

        <div className="scd-side">
          <div className="scd-score">
            <p className="scd-score-main">{score}<span className="scd-score-pct">%</span></p>
            <p className="scd-score-bench">
              [{pct(salon.range_low)}–{pct(salon.range_high)} benchmark]
            </p>
          </div>

          <span className="scd-divider" aria-hidden="true" />

          <div className="scd-actions">
            <button type="button" className="scd-view" onClick={open}>
              View salon
            </button>
            <button
              type="button"
              className={`scd-fav ${saved ? "scd-fav--on" : ""}`}
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

      {/* ── Category breakdown ── */}
      {catScores.length > 0 && (
        <ul className="scd-cats" aria-label="Category scores">
          {catScores.map((c) => {
            const v = pct(c.score);
            const band = bandKey(v);
            return (
              <li key={c.category_no} className="scd-chip" data-band={band}
                  title={`${CATEGORY_INFO[c.category_no].name}: ${v} of 100`}>
                <span className="scd-chip-label">{CATEGORY_INFO[c.category_no].short}</span>
                <span className="scd-chip-num">{v}<span className="scd-chip-pct">%</span></span>
                <span className="scd-chip-tier">{bandWord(v)}</span>
              </li>
            );
          })}
        </ul>
      )}

      {/* ── Advisory notice: only exceptions are shown ── */}
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
