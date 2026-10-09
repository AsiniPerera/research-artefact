/* The one place the front end talks to the backend (backend/api). Every
   screen goes through these functions — no fetch calls in components.

   The front end never talks to Supabase directly: the API holds the database
   connection, and ranking order comes from score.rank_providers via the API.
   Nothing here re-orders or re-scores what the API returns. */

import { API } from "../constants/api";

/** GET a JSON endpoint. FastAPI errors carry a `detail`; surface it. */
async function get(path, params, { signal } = {}) {
  const qs = params
    ? new URLSearchParams(
        Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")
      ).toString()
    : "";
  let res;
  try {
    res = await fetch(`${API}${path}${qs ? `?${qs}` : ""}`, { signal });
  } catch (e) {
    if (e.name === "AbortError") throw e;
    throw new Error("Cannot reach the API. Is it running on http://127.0.0.1:8000?");
  }
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = typeof body.detail === "string" ? body.detail : "";
    } catch { /* not JSON */ }
    throw new Error(detail || `API error ${res.status}`);
  }
  return res.json();
}

/** API and database status. */
export const getHealth = (opts) => get("/health", null, opts);

/** Taxonomy tree: categories → services → sub-services, with tier and
    ranked_providers / providers_with_evidence per sub-service. */
export const getServices = (opts) => get("/services", null, opts);

/** The eight framework categories with default_weight, `weighted` and their
    customer questions. Seven are weighted; the eighth, Overall Verdict, is
    reported only and comes back with default_weight 0 and weighted false. */
export const getFramework = (opts) => get("/framework", null, opts);

/**
 * Ranking for one sub-service.
 *   code     sub-service code, e.g. "HR.CHEM.02"
 *   weights  seven non-negative numbers in category_no order (1 … 7). Category
 *            8, Overall Verdict, is reported only and takes no weight.
 *   city     optional city filter
 *   status   "open" | "closed" | "any" — Google business status, not opening hours
 * Returns { sub_service, weights, ranked[], available_but_not_ranked[], safety_concern[] }.
 *
 * When nothing can be ranked at the sub-service asked for, the API may answer
 * at a broader level and say so with requested / level_used / shown — read
 * those through rankingFallback below.
 */
export const getRankings = (code, weights, city, status, opts) =>
  get(`/rankings/${encodeURIComponent(code)}`, {
    weights: weights?.join(","),
    city,
    status,
  }, opts);

/**
 * Salons just outside the chosen city, nearest first, ranked for the same
 * service. Lazy: only fetched when the reader asks to see nearby salons.
 * Returns { requested, city, level_used, shown, nearby[] } where each nearby
 * row is a ranked row plus `distance_km`.
 */
export const getNearbyRankings = (code, weights, city, status, opts) =>
  get(`/rankings/${encodeURIComponent(code)}/nearby`, {
    weights: weights?.join(","),
    city,
    status,
  }, opts);

/**
 * What level a ranking was actually answered at.
 *
 * A request for a sub-service may be answered at the service or the category
 * above it when nothing is ranked at the sub-service itself, and the API
 * reports that as requested / level_used / shown. Returns null when the
 * results are for the service asked for — and also for a response that
 * carries no level_used at all, so a backend without the fallback keeps
 * working and shows no notice.
 *
 *   { level: "service" | "category" | "none",
 *     requested: { code, name },        what the user picked
 *     shown:     { code, name } }       what the results are for
 */
export function rankingFallback(data) {
  const level = data?.level_used;
  if (!level || level === "sub_service") return null;
  if (level !== "service" && level !== "category" && level !== "none") return null;
  /* `sub_service` is the request echo every response has carried; keep it as
     the fallback for `requested` so the notice can still name the service. */
  return {
    level,
    requested: data.requested ?? data.sub_service ?? null,
    shown: data.shown ?? null,
  };
}

/** Provider search by name. */
export const searchProviders = (q, opts) => get("/providers", { q }, opts);

/** Provider details: safety, gates_and_vetoes[], services[] with category_scores. */
export const getProvider = (placeId, opts) =>
  get(`/providers/${encodeURIComponent(placeId)}`, null, opts);

/** Sentiment split per service x category, over the same evidence each score
    used. Flat rows: { service_code, category_no, polarity, n }. */
export const getSentiment = (placeId, opts) =>
  get(`/providers/${encodeURIComponent(placeId)}/sentiment`, null, opts);

/** The four owner-response measures behind category 3: reply coverage and
    speed on complaints, reply specificity, stance and remedy, commitments. */
export const getReplyQuality = (placeId, opts) =>
  get(`/providers/${encodeURIComponent(placeId)}/reply-quality`, null, opts);

/** Salon-wide positive/negative counts per sub-point -- the receipts behind
    each short claim ("Friendly and caring"). Flat rows: { sub_point_code,
    polarity, n }. */
export const getSubPointProof = (placeId, opts) =>
  get(`/providers/${encodeURIComponent(placeId)}/sub-point-proof`, null, opts);

/** Staff members named in this salon's reviews, with mention count and
    sentiment split. Coverage is real but patchy -- an empty list means
    extraction caught no name here, not that none were mentioned. */
export const getStaffMentions = (placeId, opts) =>
  get(`/providers/${encodeURIComponent(placeId)}/staff-mentions`, null, opts);

/** Evidence rows for a provider. Filters: sub_service_code, category_no, polarity, limit, offset. */
export const getEvidence = (placeId, filters = {}, opts) =>
  get(`/providers/${encodeURIComponent(placeId)}/evidence`, filters, opts);

/** "gate 3.1; badge 9.2" → ["gate 3.1", "badge 9.2"]. */
export const splitBadges = (badges) =>
  (badges ?? "").split(";").map((b) => b.trim()).filter(Boolean);

/** A category_scores value may come back as a list of rows or as a
    { category_no: score } object; read both as [{ category_no, score, … }]. */
export function categoryScoreRows(scores) {
  if (!scores) return [];
  if (Array.isArray(scores)) return scores;
  return Object.entries(scores).map(([no, v]) =>
    typeof v === "object" ? { category_no: Number(no), ...v } : { category_no: Number(no), score: v }
  );
}
