const STEPS = [
  {
    title: "We read the reviews, not the stars",
    body: "Every review is passed through a language model that extracts individual opinions — each tied to one of 19 named parameters such as result quality, cleanliness, wait time or pricing transparency, with a sentiment and a confidence. A star rating tells you a number; a review tells you why.",
  },
  {
    title: "Opinions roll up into six categories",
    body: "Parameters are grouped into Service Excellence, Staff & Service, Ambiance, Value, Convenience and Reputation. The weight of each parameter within its category is fixed by expert judgement, derived through pairwise comparison — not guessed, and not tuned to flatter any salon.",
  },
  {
    title: "Evidence decides how far we trust a score",
    body: "A salon with three glowing reviews has not earned the same confidence as one with two hundred consistent ones. Each category carries a reliability value built from how many opinions exist and how much they agree. Low reliability pulls a score toward the category average rather than letting thin evidence shout.",
  },
  {
    title: "You set the priorities",
    body: "Your weights decide what the ranking optimises for. A bride and a walk-in haircut are not looking for the same salon, and one ranked list cannot serve both. Move the sliders and the order genuinely changes.",
  },
  {
    title: "Filters are honest about what they do",
    body: "Hard filters — service, client focus, distance, availability — decide who is eligible, and we filter before we rank. Soft filters, like a specific service or a price tier, only lift matching salons and label them. They never quietly remove an option you might have wanted.",
  },
];

export function HowItWorks() {
  return (
    <article className="editorial">
      <p className="editorial-eyebrow">The Method</p>
      <h1>How the ranking works</h1>
      <p className="editorial-lede">
        Most salon listings rank by an average star rating and hope you don't ask what it
        means. We rank on what reviewers actually said, weighted by what you care about,
        and discounted by how much evidence there really is.
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

      <h2>The ranking formula</h2>
      <p>
        This is the heart of the method — an evidence-modulated ranking that is
        personalised, evidence-honest, and fair to the unknown at once. A salon's final
        score sums, across the six categories, your weight for each category times a score
        that reliability tempers toward the average:
      </p>

      <div className="formula formula--feature">
        F(s) = ∑<sub>c</sub> W<sub>c,user</sub> · [ R<sub>c</sub><sup>t</sup> · C<sub>c</sub> + ( 1 − R<sub>c</sub><sup>t</sup> ) · μ<sub>c</sub> ]
      </div>

      <p>
        The reliability of each category grows with how many reviews back it and shrinks as
        those reviews disagree:
      </p>

      <div className="formula">
        R<sub>c</sub> = ( n<sub>c</sub> / ( n<sub>c</sub> + k ) ) · ( 1 − σ<sub>c</sub> )
      </div>

      <h3>What each symbol means</h3>
      <div className="table-scroll">
        <table className="formula-table">
          <tbody>
            <tr><td>F(s)</td><td>Final personalised score for salon s — higher ranks higher</td></tr>
            <tr><td>c</td><td>A category; the sum runs over the six categories</td></tr>
            <tr><td>W<sub>c,user</sub></td><td>The <strong>user's</strong> weight for category c (their points ÷ 100)</td></tr>
            <tr><td>C<sub>c</sub></td><td>The salon's <strong>score</strong> in category c, from reviews, expert-weighted</td></tr>
            <tr><td>R<sub>c</sub></td><td>The <strong>reliability</strong> of the evidence in category c (0–1)</td></tr>
            <tr><td>μ<sub>c</sub></td><td>The <strong>prior</strong> — average category score across all salons</td></tr>
            <tr><td>t</td><td>The explore / proven exponent (t = 1 default, t &gt; 1 proven, t &lt; 1 explore)</td></tr>
            <tr><td>n<sub>c</sub></td><td>Number of reviews contributing to category c</td></tr>
            <tr><td>k</td><td>Smoothing constant — how fast reliability grows with reviews</td></tr>
            <tr><td>σ<sub>c</sub></td><td>Disagreement among reviews (0 = all agree, 1 = maximal)</td></tr>
          </tbody>
        </table>
      </div>

      <h3>What it does, in words</h3>
      <p>
        For each category, the salon's score is a <em>blend</em> of its own score (C) and
        the average (μ), mixed according to reliability (R):
      </p>
      <ul className="principle-list">
        <li>
          <strong>High R</strong> — many reviews that agree — leans the term toward
          <strong> C</strong>: trust the salon's own score.
        </li>
        <li>
          <strong>Low R</strong> — few or conflicting reviews — leans it toward
          <strong> μ</strong>: revert to the average rather than let thin evidence shout.
        </li>
      </ul>
      <p>
        Each category is then weighted by your priority (W) and summed into the
        personalised ranking.
      </p>

      <h3>How the scores are built</h3>
      <p>
        The category score is a sum of parameter scores, each weighted by expert judgement
        (from AHP, summing to 1 within the category):
      </p>
      <div className="formula">
        C<sub>c</sub> = ∑<sub>p ∈ c</sub> w<sub>p</sub><sup>expert</sup> · s<sub>p</sub>
      </div>
      <p>
        And each parameter score applies Bayesian shrinkage, pulling thin-evidence scores
        toward the prior — where <span className="nowrap">m̄<sub>p</sub></span> is the
        recency-weighted average sentiment and μ<sub>p</sub> the parameter's prior:
      </p>
      <div className="formula">
        s<sub>p</sub> = ( n · m̄<sub>p</sub> + k · μ<sub>p</sub> ) / ( n + k )
      </div>

      <h3>The full chain</h3>
      <div className="formula-chain">
        <span>sentiment</span>
        <span aria-hidden="true">→</span>
        <span>s<sub>p</sub> · parameter</span>
        <span aria-hidden="true">→</span>
        <span>C<sub>c</sub> · category</span>
        <span aria-hidden="true">→</span>
        <span>R<sub>c</sub><sup>t</sup> C<sub>c</sub> + (1−R<sub>c</sub><sup>t</sup>)μ<sub>c</sub> · evidence-modulated</span>
        <span aria-hidden="true">→</span>
        <span>F(s) · personalised</span>
      </div>

      <h2>What we refuse to do</h2>
      <ul className="principle-list">
        <li>
          A missing score is never a zero. Silence is not a complaint — an absent category
          reverts to the average, so a salon is never punished for what nobody wrote about.
        </li>
        <li>
          Review volume and consistency only ever affect reliability. They are never scored
          as a virtue in their own right, so a busy salon cannot buy its way up the list.
        </li>
        <li>
          The Google star rating is a benchmark we check ourselves against — never an input.
          The percentage on each card is how well that salon fits <em>your</em> priorities.
        </li>
        <li>
          Salons with no reviews are listed separately, never blended into the ranked
          results with an invented score.
        </li>
        <li>
          One formula, one dial. There is no second ranking function running quietly
          underneath, and no sponsored placement.
        </li>
      </ul>
    </article>
  );
}
