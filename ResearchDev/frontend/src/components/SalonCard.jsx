import { IconArrow, IconHeart, IconAlert } from "./Icons";
import { useFavorites } from "../hooks/useFavorites";
import { toggleFavorite } from "../lib/favorites";
import { splitBadges } from "../api/client";

/** 0–1 score → 0–100 for display. */
const pct = (x) => Math.round(Number(x ?? 0) * 100);

/* The seven weighted categories in short, so the breakdown fits one row.
   Category 8 (Overall Verdict) is reported-only and left off — the overall
   ring already stands for "the whole picture". */
const CAT_SHORT = {
  1: "Quality", 2: "Care", 3: "Replies", 4: "Trust",
  5: "Staff", 6: "Value", 7: "Safety",
};

/**
 * One ranked row from /rankings, laid out as a horizontal strip so a column
 * of them can be scanned and compared without opening any.
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
  // Weighted categories only (1–7); Overall (8) is reported-only.
  const catScores = (salon.category_scores ?? [])
    .filter((c) => c.category_no >= 1 && c.category_no <= 7)
    .sort((a, b) => a.category_no - b.category_no);
  const closed = salon.permanently_closed || salon.temporarily_closed;

  return (
    <article
      className="salon-card salon-card--row"
      data-tier={rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : undefined}
    >
      {/* Identity: name, where and how much evidence. No rank mark — the
          list position already is the rank, and the medal dots were one
          more thing on the card competing with the category bars, which are
          what this card is actually for. Still announced to a screen reader,
          since position alone says nothing to someone who can't see the
          order on the page. */}
      <div className="sc-id-block">
        <span className="sr-only">Rank {rank}</span>
        <div className="sc-id-text">
          <button type="button" className="salon-name" onClick={open}>{salon.provider_name}</button>
          {ratedFor && (
            <p className="sc-rated-for" title="The score on this card is for this service">
              Rated for: {ratedFor}
            </p>
          )}
          <p className="salon-meta">
            <span className="pin" aria-hidden="true">◉</span>
            {salon.city || "Colombo District"}
            {salon.distance_km != null && (
              <span className="sc-distance" title="Distance from the city you chose">
                {" "}· {salon.distance_km} km away
              </span>
            )}
            {" "}· {salon.evidence_reviews}{" "}
            {salon.evidence_reviews === 1 ? "review" : "reviews"} as evidence
          </p>
        </div>
      </div>

      {/* Category breakdown as stat chips — typographic, not a chart shape.
          Bars, then rings, both asked the eye to read a shape before it
          reached the number; a chip puts the number first, large, and lets
          one thin tier-coloured rule underneath carry "how good" without a
          second thing to decode. */}
      {catScores.length > 0 && (
        <ul className="sc-cats-row" aria-label="Category scores">
          {catScores.map((c) => {
            const v = pct(c.score);
            // Three plain bands rather than a continuous gradient: a chip is
            // read as "fine" or "not", not interpolated like a dial.
            const tier = v >= 80 ? "strong" : v >= 60 ? "mid" : "weak";
            return (
              <li key={c.category_no}
                className={`sc-chip sc-chip--${tier}`}
                title={`${CAT_SHORT[c.category_no]}: ${v} of 100`}
              >
                <span className="sc-chip-label">{CAT_SHORT[c.category_no]}</span>
                <span className="sc-chip-num">{v}</span>
              </li>
            );
          })}
        </ul>
      )}

      {/* Saving is a per-salon decision, not part of reading the score, so it
          sits pinned to the card's own corner rather than inside the score
          cluster it used to share space with. */}
      <button type="button"
        className={`sc-fav sc-fav--corner ${saved ? "sc-fav--on" : ""}`}
        onClick={() => toggleFavorite({ salon_id: salon.place_id, name: salon.provider_name })}
        aria-pressed={saved}
        aria-label={saved ? `Remove ${salon.provider_name} from favorites` : `Save ${salon.provider_name} to favorites`}
        title={saved ? "Saved" : "Save to favorites"}>
        <IconHeart size={16} filled={saved} />
      </button>

      {/* Overall score + actions on the right. */}
      <div className="sc-side">
        <div className="fit" title="Score for your priorities. 50 is neutral; about 75 is strong.">
          <div className="fit-ring" style={{ "--pct": score }} role="img"
            aria-label={`Score ${score} of 100, 80% range ${pct(salon.range_low)} to ${pct(salon.range_high)}`}>
            <span className="fit-ring-num">{score}</span>
          </div>
          <span className="fit-cap">{pct(salon.range_low)}–{pct(salon.range_high)}</span>
        </div>
        <button type="button" className="sc-view" onClick={open}>
          View<IconArrow size={13} />
        </button>
      </div>

      {/* Cautions span the full width underneath. Only exceptions are shown —
          a clear record says nothing. */}
      {(closed || (salon.safety_status !== "clear" && salon.safety_reason) || gateBadges.length > 0) && (
        <div className="sc-cautions">
          {closed && (
            <p className="sc-caution">
              <span className="sc-caution-icon" aria-hidden="true"><IconAlert size={14} /></span>
              <span>{salon.permanently_closed ? "Permanently closed" : "Temporarily closed"} on Google</span>
            </p>
          )}
          {salon.safety_status !== "clear" && salon.safety_reason && (
            <p className={`sc-caution ${salon.safety_status === "safety concern" ? "sc-caution--grave" : ""}`}
              title="Ranked below every salon with a clear safety record, whatever the score">
              <span className="sc-caution-icon" aria-hidden="true"><IconAlert size={14} /></span>
              <span>{salon.safety_reason}</span>
            </p>
          )}
          {gateBadges.map((b) => (
            <p key={b} className="sc-caution" title="Gate applied: −0.15 to the score">
              <span className="sc-caution-icon" aria-hidden="true"><IconAlert size={14} /></span>
              <span>{b}</span>
            </p>
          ))}
        </div>
      )}
    </article>
  );
}
