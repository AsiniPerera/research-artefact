export function ConfidenceBar({ sentence }) {
  const colour =
    sentence.startsWith("Strong")   ? "var(--ok)"   :
    sentence.startsWith("Moderate") ? "var(--gold)" : "var(--bad)";

  return (
    <div className="confidence-row">
      <span className="confidence-dot" style={{ background: colour }} />
      <span>{sentence}</span>
    </div>
  );
}
