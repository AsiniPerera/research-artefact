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
        <h3>Reviews by language</h3>
        <p className="language-note">
          Too few reviews have a detected language to compare.
        </p>
      </section>
    );
  }

  const single = languages.length === 0;

  return (
    <section className="language-mix">
      <h3>Reviews by language</h3>
      <p className="language-note">Share of reviews written in each language.</p>
      {/* The bar is the whole point visually and says nothing to a screen
          reader on its own, so it carries the same split as a label. */}
      <div
        className="language-bar"
        role="img"
        aria-label={rows
          .map((l) => `${l.label} ${Math.round(l.share * 100)}%`)
          .join(", ")}
      >
        {rows.map((l) => (
          <span
            key={l.code}
            className={`lang-${l.code.replace(/_/g, "-")}`}
            style={{ flex: l.n }}
            title={`${l.label}: ${l.n} reviews`}
          />
        ))}
      </div>
      <ul className="language-list">
        {rows.map((l) => (
          <li key={l.code}>
            <strong>{l.label}</strong>
            <span>{l.n} reviews ({Math.round(l.share * 100)}%)</span>
          </li>
        ))}
      </ul>
      {single && (
        <p className="language-note language-note--foot">
          Every review here with a detected language is in {rows[0].label}, so
          there is no mix to compare.
        </p>
      )}
    </section>
  );
}
