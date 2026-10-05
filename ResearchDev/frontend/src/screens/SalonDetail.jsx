import { useEffect, useState } from "react";
import { API } from "../constants/api";

const CATEGORY_LABELS = {
  service_excellence: "Service Excellence",
  staff_experience: "Staff & Friendliness",
  ambiance_facilities: "Ambiance & Facilities",
  value: "Value",
  convenience_accessibility: "Convenience",
  reputation_reliability: "Reputation",
};

function evidence(R) {
  if (R >= 0.7) return { label: "Strong evidence", tone: "ok" };
  if (R >= 0.4) return { label: "Moderate evidence", tone: "mid" };
  return { label: "Limited evidence", tone: "low" };
}

function ScoreRow({ label, score, R }) {
  // A missing score reverts to the prior, never to zero.
  const pct = Math.round((score ?? 0.5) * 100);
  const { label: evLabel, tone } = evidence(R ?? 0);

  return (
    <div className="score-row">
      <div className="score-row-head">
        <span className="score-label">{label}</span>
        <span className="score-value">{pct}</span>
      </div>
      <div className="score-track">
        <div className="score-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className={`score-evidence score-evidence--${tone}`}>{evLabel}</span>
    </div>
  );
}

export function SalonDetail({ salonId, onBack }) {
  const [salon, setSalon] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API}/salons/${salonId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Salon not found");
        return r.json();
      })
      .then(setSalon)
      .catch((e) => setError(e.message));
  }, [salonId]);

  if (error) return <p className="error">{error}</p>;
  if (!salon) return <p className="loading-text">Loading</p>;

  const catScores = JSON.parse(salon.category_scores || "{}");
  const reliability = JSON.parse(salon.reliability || "{}");

  return (
    <article className="salon-detail">
      <button className="btn-text back-link" onClick={onBack}>
        ← Back to results
      </button>

      <header className="detail-head">
        <p className="eyebrow">Salon Profile</p>
        <h1 className="detail-name">{salon.name}</h1>
        <p className="detail-meta">
          {salon.address}
          {salon.division ? ` · ${salon.division}` : ""}
        </p>
      </header>

      <h2 className="detail-section">Quality Scores</h2>
      <div className="score-list">
        {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
          <ScoreRow key={key} label={label} score={catScores[key]} R={reliability[key] ?? 0} />
        ))}
      </div>

      <footer className="detail-foot">
        <p className="detail-benchmark">
          ★ {salon.rating} from {salon.review_count} reviews — Google's own rating, shown
          for reference. It is never an input to how this salon is ranked.
        </p>

        {salon.maps_url && (
          <a
            href={salon.maps_url}
            target="_blank"
            rel="noopener noreferrer"
            className="maps-link"
          >
            View on Google Maps →
          </a>
        )}
      </footer>
    </article>
  );
}
