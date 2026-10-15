/** Which languages this business's reviews are written in. Display only.
 *
 *  A single-language salon still gets the bar, filled end to end in that
 *  language's colour. It carries no comparison, but it shows WHICH language
 *  at a glance and keeps the card looking the same shape on every profile —
 *  a sentence where every other salon has a chart reads as something
 *  missing rather than as a fact.
 */
export function LanguageMix({ data }) {
  const languages = data?.languages ?? [];
  const only = data?.only_language;

  /* The gated list when there is a mix; the single language rebuilt as a
     one-entry list when there is not, so both render through one path. */
  const rows = languages.length > 0
    ? languages
    : (only ? [{ ...only, share: 1 }] : []);

  if (rows.length === 0) {
    return (
      <section className="language-mix">
        <h3>Feedbacks by language</h3>
        <p className="language-note">
          Too few feedbacks have a detected language to compare.
        </p>
      </section>
    );
  }

  const single = languages.length === 0;

  return (
    <section className="language-mix">
      <h3>Feedbacks by language</h3>
      <p className="language-note">Share of feedbacks written in each language.</p>
      <ul className="language-list">
        {rows.map((l) => (
          <li key={l.code}>
            <strong>{l.label}</strong>
            <span>{l.n} feedbacks ({Math.round(l.share * 100)}%)</span>
          </li>
        ))}
      </ul>
      {single && (
        <p className="language-note language-note--foot">
          Every feedback here with a detected language is in {rows[0].label}, so
          there is no mix to compare.
        </p>
      )}
    </section>
  );
}
