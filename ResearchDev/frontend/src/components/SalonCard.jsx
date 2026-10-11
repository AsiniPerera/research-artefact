import { IconHeart, IconAlert } from "./Icons";
import { useFavorites } from "../hooks/useFavorites";
import { toggleFavorite } from "../lib/favorites";
import { splitBadges } from "../api/client";

/** 0–1 score → 0–100 for display. */
const pct = (x) => Math.round(Number(x ?? 0) * 100);

/* The seven weighted categories in short. Category 8 (Overall Verdict) is
   reported-only and left off — the overall score already stands for it. */
const CAT_SHORT = {
  1: "Quality", 2: "Care", 3: "Replies", 4: "Trust",
  5: "Staff", 6: "Value", 7: "Safety",
};

/* A qualitative band word under each number, so a score reads as a standing,
   not just a figure. Safety is special: a salon carrying any caution reads
   "monitored" whatever its number. */
function bandWord(categoryNo, v, hasCaution) {
  if (v >= 90) return "Excellent";
  if (v >= 80) return "Very Good";
  if (v >= 70) return "Good";
  if (v >= 60) return "Average";
  if (v >= 50) return "Below Average";
  return "Needs Improvement";
}

/* A band key that drives the colour, so word + number share one hue. */
function bandKey(categoryNo, v, hasCaution) {
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
  const score = pct(salon.personal_score);
  const open = () => onSelect?.(salon.place_id);
  const favorites = useFavorites();
  const saved = favorites.some((f) => f.salon_id === salon.place_id);
  const badges = splitBadges(salon.badges);
  const gateBadges = badges.filter((b) => b.startsWith("gate"));
  const catScores = (salon.category_scores ?? [])
    .filter((c) => c.category_no >= 1 && c.category_no <= 7)
    .sort((a, b) => a.category_no - b.category_no);
  const closed = salon.permanently_closed || salon.temporarily_closed;
  const hasSafetyCaution = salon.safety_status !== "clear" && !!salon.safety_reason;

  return (
    <article
      className="salon-card salon-card--row salon-card--dossier"
      data-tier={rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : undefined}
    >
      {/* ── Top row: identity (left) · score + actions (right) ── */}
      <div className="scd-top">
        <div className="scd-id">
          <span className="sr-only">Rank {rank}</span>
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
            const band = bandKey(c.category_no, v, hasSafetyCaution);
            return (
              <li key={c.category_no} className="scd-chip" data-band={band}
                  title={`${CAT_SHORT[c.category_no]}: ${v} of 100`}>
                <span className="scd-chip-label">{CAT_SHORT[c.category_no]}</span>
                <span className="scd-chip-num">{v}<span className="scd-chip-pct">%</span></span>
                <span className="scd-chip-tier">{bandWord(c.category_no, v, hasSafetyCaution)}</span>
              </li>
            );
          })}
        </ul>
      )}

      {/* ── Advisory notice: only exceptions are shown ── */}
      {(closed || hasSafetyCaution || gateBadges.length > 0) && (
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
