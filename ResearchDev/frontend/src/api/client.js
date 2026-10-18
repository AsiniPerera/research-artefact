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

/** Taxonomy tree: categories → services → sub-services, with tier and
    ranked_providers / providers_with_evidence per sub-service. */
export const getServices = (opts) => get("/services", null, opts);

/** The nine framework categories with default_weight, `weighted` and their
    customer questions. Seven are weighted; Category 3 (Management
    Responsiveness) and Category 8 (Overall Verdict) are reported only and
    come back with default_weight 0 and weighted false. */
export const getFramework = (opts) => get("/framework", null, opts);

/**
 * Ranking for one sub-service.
 *   code     sub-service code, e.g. "HR.CHEM.02"
 *   weights  seven non-negative numbers in category_no order (1 … 7). Category
 *            8, Overall Verdict, is reported only and takes no weight.
 *   city     optional city filter
 *   status   "open" | "closed" | "any" — Google business status, not opening hours
 * Returns { sub_service, weights, ranked[], available_but_not_ranked[] }. The API also
 * returns safety_concern[], which collects a veto-based status no sub-point in
 * the current framework can produce, so it is always empty and is not read here.
 *
 * When nothing can be ranked at the sub-service asked for, the API may answer
 * at a broader level and say so with requested / level_used / shown — read
 * those through rankingFallback below.
 */
export const getRankings = (code, weights, city, status, consistencyWindow, opts) =>
  get(`/rankings/${encodeURIComponent(code)}`, {
    weights: weights?.join(","),
    city,
    status,
    consistency_window: consistencyWindow,
  }, opts);

/**
 * Salons just outside the chosen city, nearest first, ranked for the same
 * service. Lazy: only fetched when the reader asks to see nearby salons.
 * Returns { requested, city, level_used, shown, nearby[] } where each nearby
 * row is a ranked row plus `distance_km`.
 */
export const getNearbyRankings = (code, weights, city, status, consistencyWindow, opts) =>
  get(`/rankings/${encodeURIComponent(code)}/nearby`, {
    weights: weights?.join(","),
    city,
    status,
    consistency_window: consistencyWindow,
  }, opts);

/**
 * Salons with feedback about the quality categories that names no service,
 * scored by the reader's own priorities (the same arithmetic as the profile's
 * overall score). They are in no ranking, so they get a section of their own.
 * Returns { count, salons[], window }; each salon is shaped like a ranking row
 * so the same card draws it.
 */
export const getGeneralFeedback = (weights, city, status, consistencyWindow, opts) =>
  get("/general-feedback", {
    weights: weights?.join(","),
    city,
    status,
    consistency_window: consistencyWindow,
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
  /* The reader can rank a sub-service, a service or a whole category. A
     notice is only needed when the answer came from a broader level than the
     one picked; older responses carry no requested_level and were always a
     sub-service request. */
  const requestedLevel = data?.requested_level ?? "sub_service";
  if (!level || level === requestedLevel) return null;
  if (level !== "service" && level !== "category" && level !== "none") return null;
  /* The levels from the reader's pick upward, named from the response echo
     (which carries the service and category names), so the notice can name
     every level it tried and not only the one it landed on. */
  const sub = data.sub_service ?? {};
  const order = ["sub_service", "service", "category"];
  const names = { sub_service: sub.name ?? data.requested?.name, service: sub.service, category: sub.category };
  if (requestedLevel === "service") names.service = sub.name ?? names.service;
  const path = order.slice(order.indexOf(requestedLevel))
    .map((lvl) => ({ level: lvl, name: names[lvl] }))
    .filter((step) => step.name);
  return {
    level,
    requestedLevel,
    requested: data.requested ?? data.sub_service ?? null,
    shown: data.shown ?? null,
    path,
  };
}

/** Provider search by name. */
export const searchProviders = (q, opts) => get("/providers", { q }, opts);

/** Provider details: safety, gates_and_vetoes[], services[] with category_scores. */
export const getProvider = (placeId, opts, consistencyWindow) =>
  get(`/providers/${encodeURIComponent(placeId)}`, { consistency_window: consistencyWindow }, opts);

/** Sentiment split per service x category, over the same evidence each score
    used. Flat rows: { service_code, category_no, polarity, n }. */
/** The reviews naming one staff member at one business, newest first. */
export const getStaffReviews = (placeId, staffName, opts) =>
  get(`/providers/${encodeURIComponent(placeId)}/staff/`
    + `${encodeURIComponent(staffName)}/reviews`, null, opts);

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

/** Evidence rows for a provider. Filters: sub_service_code, category_no, polarity, limit, offset. */
export const getEvidence = (placeId, filters = {}, opts) =>
  get(`/providers/${encodeURIComponent(placeId)}/evidence`, filters, opts);

/** The salon's overall score: every category plus the Overall Verdict, all
 *  feedbacks, all services, weighted by the visitor's priorities (the same
 *  seven numbers /rankings takes; omitted means Medium). Display only. */
export const getOverall = (placeId, { weights, window = "anytime" } = {}, opts) =>
  get(
    `/providers/${encodeURIComponent(placeId)}/overall`,
    { consistency_window: window, ...(weights ? { weights: weights.join(",") } : {}) },
    opts,
  );

/** "gate 3.1; badge 9.2" → ["gate 3.1", "badge 9.2"]. */
export const splitBadges = (badges) =>
  (badges ?? "").split(";").map((b) => b.trim()).filter(Boolean);

// ── Auth helpers ──────────────────────────────────────────────────────────────

const TIMEOUT_MS = 8000;

function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(id));
}

async function post(path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  let res;
  try {
    res = await fetchWithTimeout(`${API}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
  } catch (e) {
    if (e.name === "AbortError") throw new Error("Request timed out — is the backend running?");
    throw new Error("Cannot reach the API. Is the backend running on port 8000?");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `API error ${res.status}`);
  return data;
}

async function put(path, body, token) {
  let res;
  try {
    res = await fetchWithTimeout(`${API}${path}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  } catch (e) {
    if (e.name === "AbortError") throw new Error("Request timed out — is the backend running?");
    throw new Error("Cannot reach the API. Is the backend running on port 8000?");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `API error ${res.status}`);
  return data;
}

/** Sign up a new user. Returns { token, user }. */
export const signUp = (name, email, password) =>
  post("/auth/signup", { full_name: name, email, password });

/** Sign in. Returns { token, user }. */
export const signIn = (email, password) =>
  post("/auth/signin", { email, password });

/** Get the current user's profile (requires token). */
export async function getMe(token) {
  const res = await fetch(`${API}/auth/me`, {
    headers: { "Authorization": `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `API error ${res.status}`);
  return data;
}

/** Update profile fields. */
export const updateMe = (token, fields) => put("/auth/me", fields, token);

/** Submit a contact inquiry. */
export const submitInquiry = (form, token) =>
  post("/contact/inquiries", form, token);

/** One completed usability survey; anonymous, so no token. */
export const submitSurvey = (answers) => post("/survey/responses", answers);

/** A category_scores value may come back as a list of rows or as a
    { category_no: score } object; read both as [{ category_no, score, … }]. */
export function categoryScoreRows(scores) {
  if (!scores) return [];
  if (Array.isArray(scores)) return scores;
  return Object.entries(scores).map(([no, v]) =>
    typeof v === "object" ? { category_no: Number(no), ...v } : { category_no: Number(no), score: v }
  );
}
