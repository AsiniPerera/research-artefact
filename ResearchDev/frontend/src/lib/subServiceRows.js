/* What the profile's "Scores by Service" tab lists: one row per sub-service
   that HAS feedbacks about it, and nothing for the ones that don't.

   Scores are stored for every sub-service a salon could offer, but most of
   them have no evidence of their own: they inherit the salon's general
   reputation (a number like 80 with a 40-100 band, meaning "unknown"). The
   tab used to list them all, and used to fold identical siblings into one
   row named after the service, which hid that. Now a sub-service appears only
   when something in the feedbacks is about it.

   `evidence_reviews` is the count of reviews about the sub-service itself,
   or about its service where the review names no more precise sub-service.
   0 means nothing in the feedbacks is about this service. */

/** True unless the API says there are no feedbacks about this service. An
 *  absent count is treated as "has feedbacks": better to show the row than
 *  to hide one because the field simply was not sent. */
export const hasFeedbacks = (s) => s.evidence_reviews !== 0;

const width = (s) => Number(s.range_high ?? 1) - Number(s.range_low ?? 0);

const matchesChips = (s, { category, service_code: service, status } = {}) =>
  (!category || s.category === category) &&
  (!service || s.service_code === service) &&
  (!status || (status === "ranked" ? s.rank_status === "ranked" : s.rank_status !== "ranked"));

/**
 * @param services  every sub-service row for the salon
 * @param chips     the active filters { category, service_code, status }
 * @returns {
 *   state: "ok" | "no-match" | "no-feedbacks",
 *   rows:  [{ key, service }]  surest first (narrowest band), then higher score,
 *   shown, total               counts of rows with feedbacks, for "Showing x of y"
 * }
 * "no-match" is a filter that selects nothing; "no-feedbacks" is a filter that
 * selects only sub-services nobody has written about.
 */
export function subServiceView(services, chips = {}) {
  const total = services.filter(hasFeedbacks).length;
  const matched = services.filter((s) => matchesChips(s, chips));
  if (matched.length === 0) return { state: "no-match", rows: [], shown: 0, total };

  const withFeedbacks = matched.filter(hasFeedbacks);
  if (withFeedbacks.length === 0) return { state: "no-feedbacks", rows: [], shown: 0, total };

  const rows = [...withFeedbacks]
    .sort((a, b) => width(a) - width(b) || Number(b.trust_score) - Number(a.trust_score))
    .map((s) => ({ key: s.sub_service_code, service: s }));
  return { state: "ok", rows, shown: rows.length, total };
}
