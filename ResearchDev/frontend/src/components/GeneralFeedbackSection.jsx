/* Salons whose feedback is about the quality categories (the work, the staff,
   the price, the cleanliness) but names no service.

   A ranking is built per service, so a salon whose statements carry no
   service or category tag has nowhere to attach and is in no list. Its
   feedback is real, so it is shown here instead, under a heading that says
   what it is: scored by the reader's own priorities, never ranked for a
   service. Collapsed until asked for, because it is a different kind of
   answer from the list above it and would otherwise sit among it unexplained.

   Order is the API's: highest score first. Display only. */
import { useEffect, useState } from "react";
import { SalonCard } from "./SalonCard";
import { getGeneralFeedback } from "../api/client";

const SHOWN_AT_FIRST = 6;
const RATED_FOR = "all its feedback — it names no service";

export function GeneralFeedbackSection({
  priorities, city, availability, consistencyWindow, audience = "", onSelectSalon,
}) {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState(false);
  const key = priorities ? priorities.join(",") : "";

  useEffect(() => {
    const ctrl = new AbortController();
    /* Debounced like the ranking: dragging a slider across three stops sends
       one request, not three. */
    const t = setTimeout(() => {
      getGeneralFeedback(priorities, city, availability, consistencyWindow, { signal: ctrl.signal })
        .then(setData)
        .catch((e) => { if (e.name !== "AbortError") setData(null); });
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [key, city, availability, consistencyWindow]); // eslint-disable-line react-hooks/exhaustive-deps

  /* The audience filter hides salons here as it does in the list above. */
  const salons = (data?.salons ?? []).filter((s) => !audience || s.audience === audience);
  /* Nothing to say is nothing shown: a section that only reports its own
     absence is noise under a list the reader came for. */
  if (salons.length === 0) return null;

  const listed = all ? salons : salons.slice(0, SHOWN_AT_FIRST);
  const n = salons.length;

  return (
    <section className="nearby-section nearby-section--open" aria-label="Feedback that no services found">
      <div className="nearby-head">
        <h4>Feedback that no services found</h4>
        <p>
          {n} {n === 1 ? "salon has" : "salons have"} feedback about the quality, staff, value or
          safety, but none of it says which service. {n === 1 ? "It" : "They"} can&rsquo;t be ranked
          for a service, so {n === 1 ? "it is" : "they are"} scored here on your priorities instead.
        </p>
      </div>

      {!open ? (
        <button type="button" className="btn-text" aria-expanded="false" onClick={() => setOpen(true)}>
          Show {n === 1 ? "this salon" : `these ${n} salons`}
        </button>
      ) : (
        <>
          <div className="salon-grid">
            {listed.map((row) => (
              <SalonCard
                key={row.place_id}
                salon={row}
                provisional
                ratedFor={RATED_FOR}
                onSelect={onSelectSalon}
              />
            ))}
          </div>
          {n > SHOWN_AT_FIRST && (
            <button type="button" className="btn-text" aria-expanded={all} onClick={() => setAll((v) => !v)}>
              {all ? "Show fewer" : `Show all ${n}`}
            </button>
          )}
        </>
      )}
    </section>
  );
}
