/* Rendered by Results.jsx above the ranked list, driven by the `fallback`
   object Results derives from the API response's level_used/shown/requested. */
import { IconInfo } from "./Icons";

/**
 * Said plainly when the ranking on screen is not for the service the user
 * asked for. The API answers a sub-service request at the broadest level it
 * can rank, and reports which level that was; this says so in the user's own
 * words — the service names from the response, never "leaf" or "sub-service".
 *
 * It informs only. Scores and rank order are the API's and are untouched.
 *
 *   fallback  { level, requested: { code, name }, shown: { code, name } }
 *             level is "service", "category" or "none"; a "sub_service"
 *             answer needs no notice and this component is not rendered.
 *   city      the city filter in force, if any — widening the area may find
 *             the exact service, so the notice offers that.
 */
export function FallbackNotice({ fallback, city, onSearchAllCities }) {
  const { level, requested, shown } = fallback;
  /* The database still tags beard and shave work with the retired "Gents'
     Grooming" category, which the taxonomy folds under Hair. */
  const plain = (name) => (name && /gents|grooming/i.test(name) ? "Hair" : name);
  const asked = plain(requested?.name);
  const showing = plain(shown?.name);

  /* Nothing to say without the names, and a notice that names no service
     would be worse than none. */
  if (!showing) return null;

  const message =
    level === "none" ? (
      <>No rated salons found for <strong>{showing}</strong> yet. {city ? "Try another service or search all cities." : "Try another service."}</>
    ) : level === "category" ? (
      <>No rated salons for <strong>{asked}</strong>, or for its service, yet. Showing the best in the <strong>{showing}</strong> category instead.</>
    ) : (
      <>No rated salons for <strong>{asked}</strong> yet. Showing the best in the <strong>{showing}</strong> service instead, which includes it.</>
    );

  return (
    /* role="status" so a screen reader announces the change of service
       alongside the new list, rather than leaving it to be discovered. */
    <div
      className={`fallback-notice ${level === "none" ? "fallback-notice--empty" : ""}`}
      role="status"
    >
      <span className="fallback-notice-icon" aria-hidden="true">
        <IconInfo size={16} />
      </span>

      <div className="fallback-notice-body">
        <p className="fallback-notice-msg">{message}</p>

        {/* Only worth asking when there is a list to book from. */}
        {level !== "none" && asked && (
          <p className="fallback-notice-tip">
            Ask the salon if they offer {asked} before you book.
          </p>
        )}

        {city && onSearchAllCities && (
          <button type="button" className="btn-text" onClick={onSearchAllCities}>
            Search all cities
          </button>
        )}
      </div>
    </div>
  );
}
