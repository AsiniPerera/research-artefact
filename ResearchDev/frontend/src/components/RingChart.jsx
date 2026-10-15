/* A ring chart for the salon profile's two descriptive sections (staff
   mentioned, feedbacks by language). Display only: nothing here feeds a score.

   `segments` is a list of { value, color, label }. Values are shares of the
   whole (they need not sum to 1; they are normalised). One segment is the
   "percent" case, a single arc over a track; several is the "mix" case.
   Plain strokes rather than gradient defs, so it renders wherever it is used
   without depending on markup elsewhere on the page. */

const TRACK = "#ebe6df";

export function RingChart({ segments, size = 64, stroke = 8, center, label }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = segments.reduce((a, s) => a + Math.max(0, s.value), 0);

  let offset = 0;
  const arcs = total > 0
    ? segments
        .filter((s) => s.value > 0)
        .map((s) => {
          const len = (s.value / total) * c;
          const arc = { ...s, len, offset };
          offset += len;
          return arc;
        })
    : [];

  return (
    <svg className="ring-chart" width={size} height={size} viewBox={`0 0 ${size} ${size}`}
         role="img" aria-label={label}>
      <title>{label}</title>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={TRACK} strokeWidth={stroke} />
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {arcs.map((a) => (
          <circle key={a.label ?? a.color} cx={size / 2} cy={size / 2} r={r} fill="none"
                  stroke={a.color} strokeWidth={stroke}
                  strokeDasharray={`${a.len} ${c - a.len}`} strokeDashoffset={-a.offset} />
        ))}
      </g>
      {center != null && (
        <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle"
              className="ring-chart-center" fontSize={size >= 90 ? 20 : 14} fontWeight="600" fill="#1c1814">
          {center}
        </text>
      )}
    </svg>
  );
}
