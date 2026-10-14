/* The explainer screen, reached from the footer. Walks through how a review
   becomes a score: read, sorted into categories, weighted by the reader. */
import { CATEGORY_INFO } from "../constants/categories";

/* The six categories a reader weights. Category 3 (Management Response) is
   deliberately left out of this list -- it is scored and shown, but never
   ranked, and is explained separately below rather than mixed in with the
   six the reader actually controls. */
const WEIGHTED_NOS = [1, 2, 4, 5, 6, 7];

const STEPS = [
  {
    title: "We read what customers wrote",
    body: "Every review is read for what it says about the salon — the result, the care, the staff, the price, the cleanliness — and coded as positive, negative or mixed. Owner replies to complaints are read too. The star rating is never used to decide what a review means.",
  },
  {
    title: "Six categories, each with its own score",
    body: "What reviews say is sorted into six categories, listed below. Each salon gets a score in each one, so you can see what it does well and where it falls short. A seventh, Management Response, is scored too, but shown for information rather than ranked — see below.",
  },
  {
    title: "You choose how far back to look",
    body: "The \"Reviews from\" filter above the results lets you pick how far back to look: 6 months, 1 year, 3 years, or all time. Only reviews published in that period count toward every score. A shorter period shows how a salon is doing right now, but rests on fewer reviews; a longer period draws on more evidence, but includes older experiences along with recent ones.",
  },
  {
    title: "You choose what matters",
    body: "For each of the six categories you choose how important it is to you: Low, Medium, High or Very high. Very high counts eight times as much as Low. Your choices decide the order, so a bride and someone booking a quick haircut can see different lists.",
  },
  {
    title: "Only salons with enough evidence are ranked",
    body: "A salon is ranked only when there is enough review evidence about the service you chose, in the period you picked. Salons that offer the service but have too little evidence are listed as \"Available but Not Ranked\" rather than given a score they have not earned.",
  },
  {
    title: "Wider results when nothing is ranked",
    body: "If no salon can be ranked for the exact service you chose, we show results for the broader service, or its whole category, and tell you plainly that we have done so.",
  },
];

export function HowItWorks() {
  return (
    <article className="editorial">
      <p className="editorial-eyebrow">The Method</p>
      <h1>How the ranking works</h1>
      <p className="editorial-lede">
        Most salon listings rank by an average star rating. We rank on what customers
        actually wrote, weighted by what you care about.
      </p>

      <hr className="editorial-rule" />

      <div className="step-list">
        {STEPS.map(({ title, body }, i) => (
          <div className="step" key={title}>
            <span className="step-num" aria-hidden="true">{i + 1}</span>
            <div>
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
          </div>
        ))}
      </div>

      <h2>The six categories you weight</h2>
      <ul className="principle-list">
        {WEIGHTED_NOS.map((no) => (
          <li key={no}>
            <strong>{CATEGORY_INFO[no].name}</strong> — {CATEGORY_INFO[no].description}
          </li>
        ))}
      </ul>
      <p>
        <strong>Management Response</strong> — {CATEGORY_INFO[3].description}. This one is
        shown on each salon's profile for information, because it describes how the
        business behaves after things go wrong rather than the service itself. It does not
        affect the ranking.
      </p>

      <h2>How a score is built</h2>
      <ul className="principle-list">
        <li>
          <strong>Every score starts at 50%.</strong> With no reviews about a category, a
          salon sits in the middle. Each positive or negative comment moves the score up or
          down, so one glowing review cannot make a salon look perfect — and a salon with
          very few reviews stays close to the middle until more evidence arrives.
        </li>
        <li>
          <strong>Recent reviews count more.</strong> A review from two years ago counts
          half as much as one written today, on top of whatever period you've chosen above.
        </li>
        <li>
          <strong>A review about the exact service counts most.</strong> A review of your
          chosen service counts in full. A review about the salon in general, or about
          another service, counts for less.
        </li>
        <li>
          <strong>Your overall score</strong> combines the six weighted category scores,
          each weighted by how important you said it is.
        </li>
        <li>
          <strong>The specialism badge is informational.</strong> On a salon's profile it
          shows what share of its reviews are about the service you're looking at. It helps
          you see what the salon is known for, but it is not part of the score and never
          changes the ranking.
        </li>
        <li>
          <strong>Safety comes first in the order.</strong> Salons with two or more
          independent reports of harm or poor hygiene in the last two years are listed
          after the others, whatever their score.
        </li>
      </ul>

      <h2>What we refuse to do</h2>
      <ul className="principle-list">
        <li>
          Silence is not a complaint. A category nobody wrote about stays at 50%, so a
          salon is never marked down for what nobody said.
        </li>
        <li>
          The Google star rating is shown for reference only. It is never part of the
          score.
        </li>
        <li>
          Salons without enough evidence are listed separately, never given an invented
          score.
        </li>
        <li>
          No sponsored placement. The order comes only from reviews and your choices.
        </li>
      </ul>
    </article>
  );
}
