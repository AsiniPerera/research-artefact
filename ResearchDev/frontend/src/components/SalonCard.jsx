import { PRICE_TIERS, SUB_SERVICES } from "../constants/taxonomy";
import { ConfidenceBar } from "./ConfidenceBar";
import { IconArrow, IconHeart } from "./Icons";
import { useFavorites } from "../hooks/useFavorites";
import { toggleFavorite } from "../lib/favorites";

const PRICE_LABEL = Object.fromEntries(
  PRICE_TIERS.map(({ value, label }) => [value, label])
);

const ALL_SUB_LABELS = Object.fromEntries(
  Object.values(SUB_SERVICES).flatMap((arr) => arr.map(({ value, label }) => [value, label]))
);

/** First letter of the salon name — stands in for a photo we don't hold. */
function monogram(name) {
  return (name?.trim()?.[0] ?? "·").toUpperCase();
}

export function SalonCard({ salon, rank, onSelect }) {
  const fit = Math.round((salon.F_score ?? 0) * 100);
  const open = () => onSelect?.(salon.salon_id);
  const favorites = useFavorites();
  const saved = favorites.some((f) => f.salon_id === salon.salon_id);

  return (
    <article className="salon-card">
      {/* Identity + the headline research output: how well it fits you. */}
      <div className="sc-head">
        <button
          className="sc-id"
          onClick={open}
          aria-label={`View full profile for ${salon.name}`}
        >
          <span className={`rank-badge ${rank <= 3 ? "rank-badge--top" : ""}`}>
            #{rank}
          </span>
          <span className="sc-monogram" aria-hidden="true">{monogram(salon.name)}</span>
        </button>

        <div className="sc-head-right">
          {/* Saving is a per-salon action, so it sits with the salon's own
              identity rather than down in the card's navigation footer. */}
          <button
            className={`sc-fav ${saved ? "sc-fav--on" : ""}`}
            onClick={() => toggleFavorite(salon)}
            aria-pressed={saved}
            aria-label={saved ? `Remove ${salon.name} from favorites` : `Save ${salon.name} to favorites`}
            title={saved ? "Saved" : "Save to favorites"}
          >
            <IconHeart size={16} filled={saved} />
          </button>

          <div className="fit" title="How well this salon fits your priorities">
            <div
              className="fit-ring"
              style={{ "--pct": fit }}
              role="img"
              aria-label={`Fit score: ${fit} percent`}
            >
              <span className="fit-ring-num">{fit}<small>%</small></span>
            </div>
            <span className="fit-cap">Match</span>
          </div>
        </div>
      </div>

      <div className="salon-body">
        <h3>
          <button className="salon-name" onClick={open}>{salon.name}</button>
        </h3>

        <p className="salon-meta">
          <span className="pin" aria-hidden="true">◉</span>
          {salon.distance_km} km away
        </p>

        <div className="badge-row">
          {salon.matched_sub_service && (
            <span className="badge badge--service">Mentioned in reviews</span>
          )}
          {salon.price_tier ? (
            <span className="badge badge--tag">{PRICE_LABEL[salon.price_tier]} · perceived</span>
          ) : (
            <span className="badge badge--muted">Price not indicated</span>
          )}
          {salon.service_tags.slice(0, 2).map((tag) => (
            <span key={tag} className="badge badge--tag">
              {ALL_SUB_LABELS[tag] ?? tag}
            </span>
          ))}
        </div>

        <p className="salon-why">{salon.why_ranked}</p>

        <div className="confidence-bars">
          {Object.entries(salon.confidence).map(([cat, sentence]) => (
            <ConfidenceBar key={cat} sentence={sentence} />
          ))}
        </div>

        {salon.weak_spot && <p className="weak-spot">{salon.weak_spot}</p>}

        <div className="sc-foot">
          <button className="sc-view" onClick={open}>
            View profile
            <IconArrow size={13} />
          </button>

          <details className="sc-why-not">
            <summary>Why not higher?</summary>
            <p>{salon.why_not_higher}</p>
          </details>
        </div>
      </div>
    </article>
  );
}
