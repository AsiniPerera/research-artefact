/* How much evidence the profile rests on, and what shape it is in: the number
   of feedbacks read, split positive / neutral / negative, with the language
   mix as a closing sentence.

   It replaces two separate cards. The language of a feedback is a fact about
   the same set of feedbacks counted above it, not a finding of its own, so a
   sentence under the totals says more than a card beside them.

   Display only; nothing here is scored. */

/* The polarities the bar shows, best first. `mixed` and `mention` are folded
   into neutral: they are neither praise nor complaint, and three slivers of
   grey say less than one. */
const POSITIVE = ["positive"];
const NEGATIVE = ["negative"];

const fmt = (n) => n.toLocaleString("en-US");

/** Reviews the site counts a language for. Anything else — "other", or no
 *  detected language — is excluded everywhere, so it is excluded here too. */
const LANGUAGE_LABEL = {
  english: "English",
  sinhala: "Sinhala",
  english_sinhala_mix: "both languages",
};

export function FeedbackTotals({ totals, languages }) {
  const entries = Object.entries(totals ?? {});
  const all = entries.reduce((sum, [, n]) => sum + n, 0);
  if (all === 0) return null;

  const sumOf = (keys) => entries.reduce((s, [k, n]) => s + (keys.includes(k) ? n : 0), 0);
  const positive = sumOf(POSITIVE);
  const negative = sumOf(NEGATIVE);
  const neutral = all - positive - negative;

  const bands = [
    { key: "positive", label: "Positive", n: positive },
    { key: "neutral", label: "Neutral", n: neutral },
    { key: "negative", label: "Negative", n: negative },
  ].filter((b) => b.n > 0);

  /* "Written in English, except N in Sinhala or both languages." The majority
     language leads; the rest is one count, because the exact split between two
     minority languages is not what a reader is weighing here. */
  const rows = (languages?.languages ?? []).filter((l) => LANGUAGE_LABEL[l.code]);
  const only = languages?.only_language;
  let languageNote = null;
  if (rows.length > 0) {
    const sorted = [...rows].sort((a, b) => b.n - a.n);
    const [lead, ...rest] = sorted;
    const others = rest.reduce((s, l) => s + l.n, 0);
    languageNote = others > 0
      ? `Written in ${LANGUAGE_LABEL[lead.code]}, except ${fmt(others)} feedback${others === 1 ? "" : "s"} in ${rest.map((l) => LANGUAGE_LABEL[l.code]).join(" or ")}.`
      : `Written in ${LANGUAGE_LABEL[lead.code]}.`;
  } else if (only && LANGUAGE_LABEL[only.code]) {
    languageNote = `Written in ${LANGUAGE_LABEL[only.code]}.`;
  }

  return (
    <div className="evsum-feedback">
      <p className="evsum-figure evsum-figure--count">
        <span className="evsum-num">{fmt(all)}</span>
        <span className="evsum-count-label">feedbacks read</span>
      </p>

      <span className="evsum-stack" role="img"
            aria-label={bands.map((b) => `${b.label} ${fmt(b.n)}`).join(", ")}>
        {bands.map((b) => (
          <span key={b.key} className={`evsum-seg evsum-seg--${b.key}`}
                style={{ width: `${(b.n / all) * 100}%` }} />
        ))}
      </span>

      <ul className="evsum-legend">
        {bands.map((b) => (
          <li key={b.key}>
            <span className={`evsum-dot evsum-dot--${b.key}`} aria-hidden="true" />
            <span className="evsum-legend-label">{b.label}</span>
            <span className="evsum-legend-n">
              <b>{fmt(b.n)}</b> · {((b.n / all) * 100).toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>

      {languageNote && <p className="evsum-note">{languageNote}</p>}
    </div>
  );
}
