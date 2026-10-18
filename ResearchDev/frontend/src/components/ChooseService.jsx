/* The page before a service is picked. It used to be one sentence in a box;
   now it is the way in: the services with the most ranked salons as one-click
   shortcuts, each category as a tile that ranks the whole of it, and the three
   steps that follow, so the first click is easy and the page says what comes
   next.

   Everything clickable here only reports a choice (onStartWith for a
   sub-service, onStartCategory for a whole category); the page decides what
   that does. `popular` is [{ code, name, ranked, value }] from /services,
   already limited to services that have at least one ranked salon. */
import { DOMAINS } from "../constants/taxonomy";
import { IconArrow } from "./Icons";

/* One line on what each category covers, from the taxonomy itself (Beard &
   Shave sits under Hair). */
const COVERS = {
  HR: "Cuts, colour, chemical treatments, styling and beard care",
  SK: "Facials, skin treatments, brows & lashes, waxing",
  NL: "Manicure, polish, extensions and nail art",
  BO: "Bridal, groom, draping and occasion looks",
};

const STEPS = [
  { n: "1", title: "Pick a service", text: "Or a whole category, if you are still deciding." },
  { n: "2", title: "Say what matters", text: "Quality, staff, price, hygiene — set how much each counts." },
  { n: "3", title: "See who earns it", text: "Ranked from what clients wrote, not a star average." },
];

export function ChooseService({ popular = [], onStartWith, onStartCategory }) {
  return (
    <section className="choose" aria-label="Choose what to rank">
      <header className="choose-head">
        <h2 className="choose-title">What are you looking for?</h2>
        <p className="choose-lede">
          Pick a service and the ranking appears on its own, re-ordering whenever
          you change what matters to you.
        </p>
      </header>

      {popular.length > 0 && (
        <div className="choose-block">
          <p className="choose-label">Start with a favourite</p>
          <ul className="choose-chips">
            {popular.map((p) => (
              <li key={p.code}>
                <button type="button" className="choose-chip" onClick={() => onStartWith?.(p)}>
                  <span className="choose-chip-name">{p.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="choose-block">
        <p className="choose-label">Or browse a whole category</p>
        <ul className="choose-tiles">
          {DOMAINS.map((d) => (
            <li key={d.id}>
              <button type="button" className="choose-tile" onClick={() => onStartCategory?.(d)}>
                <span className="choose-tile-name">{d.label}</span>
                <span className="choose-tile-cover">{COVERS[d.id]}</span>
                <span className="choose-tile-go">
                  Rank all of {d.label}
                  <IconArrow size={14} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <ol className="choose-steps">
        {STEPS.map((s) => (
          <li key={s.n}>
            <span className="choose-step-no" aria-hidden="true">{s.n}</span>
            <span className="choose-step-body">
              <strong>{s.title}</strong>
              <span>{s.text}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
