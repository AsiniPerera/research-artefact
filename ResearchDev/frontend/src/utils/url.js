/* Where you are, kept in the address bar.
 *
 * The app holds its position in React state, which a refresh throws away:
 * every reload landed back on the home page, whatever you were reading.
 * Writing that position to the URL fixes the refresh, and gives the browser's
 * Back button and a copied link the same meaning for free.
 *
 * Hash rather than path: a static host serves "/#/services" without needing a
 * rewrite rule, where "/services" would 404 on everything but the dev server.
 *
 * A salon is a parameter rather than a route of its own because the app treats
 * it as an overlay — the ranking page stays mounted underneath it — so keeping
 * the route alongside is what lets Back return to the list you came from.
 */

const ROUTES = new Set([
  "home", "ourservices", "services", "offers", "about", "contact",
  "auth", "profile", "favorites", "account", "search", "how",
]);

/** The current URL as app state. Unknown or absent routes fall back to home. */
export function readUrl() {
  const raw = window.location.hash.replace(/^#\/?/, "");
  const [path, qs] = raw.split("?");
  const p = new URLSearchParams(qs ?? "");
  return {
    route: ROUTES.has(path) ? path : "home",
    family: p.get("family"),
    sub: p.get("sub"),
    salon: p.get("salon"),
    cw: p.get("cw"),
    q: p.get("q") ?? "",
    authMode: p.get("mode") === "signup" ? "signup" : "signin",
  };
}

/** App state as a hash, including the leading "#". */
export function buildUrl({ route, family, sub, salon, cw, q, authMode }) {
  const p = new URLSearchParams();
  /* Only what is needed to rebuild the screen. A null is left out rather than
     written as "null", which would come back as the string on the next read. */
  if (family) p.set("family", family);
  if (sub) p.set("sub", sub);
  if (salon) p.set("salon", salon);
  if (salon && cw) p.set("cw", cw);
  if (route === "search" && q) p.set("q", q);
  if (route === "auth" && authMode === "signup") p.set("mode", "signup");
  const qs = p.toString();
  return `#/${route}${qs ? `?${qs}` : ""}`;
}
