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
  const asked = requested?.name;
  const showing = shown?.name;

  /* Nothing to say without the names, and a notice that names no service
     would be worse than none. */
  if (!showing) return null;

  const message =
    level === "none"
      ? `No rated salons found for ${showing} services yet. Try another service or search all cities.`
      : level === "category"
        ? `We couldn't find rated salons for ${asked} yet. Showing the best salons for ${showing} services instead.`
        : `We couldn't find rated salons for ${asked} yet. Showing the best salons for ${showing} instead, which includes it.`;

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
