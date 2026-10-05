import { useSyncExternalStore } from "react";
import { subscribe, getSnapshot } from "../lib/favorites";

/** The saved list, re-rendering every subscriber whenever it changes. */
export function useFavorites() {
  return useSyncExternalStore(subscribe, getSnapshot);
}
