/* Rendered by Results.jsx above the ranked list, driven by the `fallback`
   object Results derives from the API response's level_used/shown/requested
   (api/client.js rankingFallback). */
import { IconInfo } from "./Icons";

/* The database still tags beard and shave work with the retired "Gents'
   Grooming" category, which the taxonomy folds under Hair. */
const plain = (name) => (name && /gents|grooming/i.test(name) ? "Hair" : name);

/**
 * One line, said plainly, when the ranking on screen is not for the level the
 * reader picked. The API tries what was picked -- a sub-service, a service or
 * a whole category -- then each broader level in turn, and answers at the
 * first one where at least one salon has enough reviews to be ranked. This
 * names every level it tried and the one the list is ranked at, in the
 * reader's own words: the service names from the response, never "leaf" or
 * "sub-service".
 *
 * It informs only. Scores and rank order are the API's and are untouched.
 *
 *   fallback  { level, requestedLevel, requested: { code, name },
 *               shown: { code, name }, path }
 *             level is "service", "category" or "none"; an answer at the
 *             level the reader picked needs no notice and this is not rendered.
 *   city      the city filter in force, if any -- widening the area may find
 *             the exact service, so the notice offers that.
 */
export function FallbackNotice({ fallback, city, onSearchAllCities }) {
  const { level, requested, shown, path = [] } = fallback;
  const asked = plain(requested?.name);
  const showing = plain(shown?.name);

  /* Nothing to say without the names, and a notice that names no service
     would be worse than none. */
  if (!showing) return null;

  /* The levels tried between the reader's pick and the answer, e.g. the
     service when a sub-service fell all the way to its category. */
  const ORDER = ["sub_service", "service", "category"];
  const stop = level === "none" ? ORDER.length : ORDER.indexOf(level);
  const middle = path
    .slice(1)
    .filter((s) => ORDER.indexOf(s.level) < stop && plain(s.name) !== showing)
    .map((s) => plain(s.name));
  const alsoTried = middle.map((name) => (
    <span key={name}>, or about <strong>{name}</strong></span>
  ));

  const message =
    level === "none" ? (
      <>Not enough reviews yet to rank any salon for <strong>{asked}</strong>
        {alsoTried}, or for <strong>{showing}</strong> as a whole.{" "}
        {city ? "Try another service, or search all cities." : "Try another service."}</>
    ) : level === "category" ? (
      <>Not enough reviews yet about <strong>{asked}</strong>{alsoTried} to rank any salon
        {city ? " here" : ""} &mdash; so this list is ranked for <strong>{showing}</strong> as a whole.
        Ask the salon about {asked} before you book.</>
    ) : (
      <>Not enough reviews yet about <strong>{asked}</strong> to rank any salon
        {city ? " here" : ""} &mdash; so this list is ranked for <strong>{showing}</strong>, which includes it.
        Ask the salon about {asked} before you book.</>
    );

  return (
    /* role="status" so a screen reader announces the change of service
       alongside the new list, rather than leaving it to be discovered. */
    <p
      className={`fallback-notice ${level === "none" ? "fallback-notice--empty" : ""}`}
      role="status"
    >
      <span className="fallback-notice-icon" aria-hidden="true">
        <IconInfo size={15} />
      </span>
      <span className="fallback-notice-msg">{message}</span>
      {city && onSearchAllCities && (
        <button type="button" className="btn-text" onClick={onSearchAllCities}>
          Search all cities
        </button>
      )}
    </p>
  );
}
