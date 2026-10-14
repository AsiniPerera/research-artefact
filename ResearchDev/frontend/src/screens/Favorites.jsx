/* Reached from the heart icon in the nav (App.jsx). */
import { useFavorites } from "../hooks/useFavorites";
import { removeFavorite } from "../lib/favorites";
import { IconHeart, IconArrow } from "../components/Icons";

/**
 * Saved salons — a page of its own, reached from the heart in the nav.
 * The list lives in this browser, so it survives a refresh but not a
 * different device; there is no account to attach it to yet.
 */
export function Favorites({ onSelectSalon, onExplore }) {
  const favorites = useFavorites();

  return (
    <div className="page-body">
      <header className="page-head page-head--bar">
        <div>
          <p className="eyebrow">Saved</p>
          <h1 className="page-head-title page-head-title--small">
            Your <em>favorites.</em>
          </h1>
        </div>

        {favorites.length > 0 && (
          <p className="page-head-note">
            {favorites.length} salon{favorites.length === 1 ? "" : "s"} saved in this
            browser.
          </p>
        )}
      </header>

      {favorites.length === 0 ? (
        <div className="empty-state dash-empty">
          <span className="dash-empty-icon" aria-hidden="true">
            <IconHeart size={22} />
          </span>
          <p className="empty-title">Nothing saved yet</p>
          <p>
            Tap the heart on any ranked salon to keep it here. Saved salons stay in this
            browser, so they survive a refresh.
          </p>
          <button className="btn-primary" onClick={() => onExplore?.()}>
            Find a salon
          </button>
        </div>
      ) : (
        <ul className="fav-list">
          {favorites.map((f) => (
            <li key={f.salon_id} className="fav-item">
              <button className="fav-open" onClick={() => onSelectSalon?.(f.salon_id)}>
                <span className="fav-monogram" aria-hidden="true">
                  {(f.name?.trim()?.[0] ?? "·").toUpperCase()}
                </span>
                <span className="fav-name">{f.name}</span>
                <IconArrow size={13} />
              </button>
              <button
                className="fav-remove"
                onClick={() => removeFavorite(f.salon_id)}
                aria-label={`Remove ${f.name} from favorites`}
              >
                <IconHeart size={15} filled />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
