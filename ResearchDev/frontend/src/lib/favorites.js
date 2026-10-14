/**
 * Saved salons, kept in localStorage.
 *
 * One module-level store rather than per-component state: the heart on a card
 * and the count in the nav have to agree, and they never share a parent close
 * enough to hold that state between them.
 *
 * The salon's name is stored alongside its id so the saved list can render
 * without re-running a ranking — there is no endpoint that fetches a salon by
 * id on its own.
 */

const KEY = "amore.favorites";

function read() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Private-mode denial or hand-edited junk — start clean rather than throw.
    return [];
  }
}

let cache = read();
const listeners = new Set();

function commit(next) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked: the in-memory list still works for this session.
  }
  listeners.forEach((fn) => fn());
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** useSyncExternalStore requires a stable reference when nothing changed. */
export function getSnapshot() {
  return cache;
}

function isFavorite(salonId) {
  return cache.some((f) => f.salon_id === salonId);
}

export function toggleFavorite(salon) {
  commit(
    isFavorite(salon.salon_id)
      ? cache.filter((f) => f.salon_id !== salon.salon_id)
      : [...cache, { salon_id: salon.salon_id, name: salon.name, saved_at: Date.now() }]
  );
}

export function removeFavorite(salonId) {
  commit(cache.filter((f) => f.salon_id !== salonId));
}
