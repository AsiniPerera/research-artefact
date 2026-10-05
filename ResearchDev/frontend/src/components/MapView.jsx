import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import L from "leaflet";

// Fix default icon paths broken by Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const rankIcon = (rank) =>
  L.divIcon({
    className: "",
    html: `<div style="background:#16150f;color:#fff;border-radius:50%;width:26px;height:26px;
            display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;
            font-family:Geist,system-ui,sans-serif;
            border:2px solid #96692f;box-shadow:0 1px 4px rgba(22,21,15,0.35)">${rank}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });

export function MapView({ salons, userLat, userLng, maxDistanceKm }) {
  if (!userLat || !userLng) return null;

  return (
    <div className="map-container">
      <MapContainer center={[userLat, userLng]} zoom={14} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* User location radius */}
        <Circle
          center={[userLat, userLng]}
          radius={maxDistanceKm * 1000}
          pathOptions={{ color: "#96692f", weight: 1, fillOpacity: 0.05 }}
        />

        {/* Ranked salons */}
        {salons.map((salon) => (
          <Marker
            key={salon.salon_id}
            position={[salon.lat, salon.lng]}
            icon={rankIcon(salon.rank)}
          >
            <Popup>
              <strong>#{salon.rank} {salon.name}</strong>
              <br />
              {salon.distance_km} km away
              <br />
              <small>{salon.why_ranked}</small>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
