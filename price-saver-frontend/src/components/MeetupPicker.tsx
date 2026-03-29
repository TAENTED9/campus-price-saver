"use client";

/**
 * MeetupPicker — Leaflet map for buyers/sellers to pick a meetup spot.
 * Dynamically imported (no SSR) to avoid window-not-defined errors.
 *
 * Usage:
 *   import dynamic from "next/dynamic";
 *   const MeetupPicker = dynamic(() => import("@/components/MeetupPicker"), { ssr: false });
 *   <MeetupPicker onSelect={(spot) => console.log(spot)} />
 */

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";

// ── UNILAG meetup hotspots ────────────────────────────────────────────────

export type MeetupSpot = {
  id: string;
  name: string;
  description: string;
  lat: number;
  lng: number;
};

const UNILAG_SPOTS: MeetupSpot[] = [
  {
    id: "ssc",
    name: "Student Services Centre (SSC)",
    description: "Main lobby — busy, safe, central",
    lat: 6.5158,
    lng: 3.3899,
  },
  {
    id: "library",
    name: "Main Library Entrance",
    description: "Quiet, identifiable landmark",
    lat: 6.5172,
    lng: 3.3908,
  },
  {
    id: "independence",
    name: "Independence Hall Gate",
    description: "Popular handoff spot for hall residents",
    lat: 6.5148,
    lng: 3.3885,
  },
  {
    id: "faculty-social",
    name: "Faculty of Social Sciences",
    description: "Central, near lecture halls",
    lat: 6.5165,
    lng: 3.3915,
  },
  {
    id: "senate",
    name: "Senate Building Front",
    description: "Open space, easy to find",
    lat: 6.5182,
    lng: 3.3920,
  },
  {
    id: "ecobank",
    name: "Ecobank ATM Area",
    description: "Near campus bank — high foot traffic",
    lat: 6.5140,
    lng: 3.3875,
  },
  {
    id: "jaja",
    name: "Jaja Hall Main Gate",
    description: "Good for female hall residents",
    lat: 6.5155,
    lng: 3.3862,
  },
  {
    id: "cafeteria",
    name: "Main Cafeteria (Buka)",
    description: "Always crowded — great safety spot",
    lat: 6.5162,
    lng: 3.3930,
  },
];

// ── Component ─────────────────────────────────────────────────────────────

interface Props {
  onSelect?: (spot: MeetupSpot | null) => void;
  initialSpotId?: string;
  className?: string;
}

export default function MeetupPicker({ onSelect, initialSpotId, className = "" }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [selected, setSelected] = useState<MeetupSpot | null>(
    initialSpotId ? (UNILAG_SPOTS.find((s) => s.id === initialSpotId) ?? null) : null
  );
  const [mapReady, setMapReady] = useState(false);

  // Dynamically load leaflet CSS and initialize map
  useEffect(() => {
    if (leafletMap.current || !mapRef.current) return;

    // Inject Leaflet CSS
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    import("leaflet").then((L) => {
      if (leafletMap.current || !mapRef.current) return;

      // Fix default icon paths broken by webpack
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(mapRef.current!, {
        center: [6.5162, 3.3899],
        zoom: 16,
        zoomControl: true,
        scrollWheelZoom: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      // Add markers for each spot
      UNILAG_SPOTS.forEach((spot) => {
        const marker = L.marker([spot.lat, spot.lng])
          .addTo(map)
          .bindPopup(
            `<strong>${spot.name}</strong><br/><span style="font-size:12px;color:#6b7280">${spot.description}</span>`
          );

        marker.on("click", () => {
          setSelected(spot);
          onSelect?.(spot);
        });

        markersRef.current.push({ spot, marker });
      });

      leafletMap.current = map;
      setMapReady(true);
    });

    return () => {
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pan to selected spot when it changes
  useEffect(() => {
    if (!mapReady || !selected || !leafletMap.current) return;
    leafletMap.current.setView([selected.lat, selected.lng], 17, { animate: true });
    const found = markersRef.current.find((m) => m.spot.id === selected.id);
    if (found) found.marker.openPopup();
  }, [selected, mapReady]);

  function handleSpotClick(spot: MeetupSpot) {
    setSelected(spot);
    onSelect?.(spot);
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Map */}
      <div
        ref={mapRef}
        className="w-full h-64 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-100 dark:bg-gray-800"
        style={{ zIndex: 0 }}
      />

      {/* Spot list */}
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        Choose a meetup spot
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {UNILAG_SPOTS.map((spot) => {
          const isActive = selected?.id === spot.id;
          return (
            <button
              key={spot.id}
              type="button"
              onClick={() => handleSpotClick(spot)}
              className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition-colors ${
                isActive
                  ? "border-brand-400 bg-brand-50 dark:bg-brand-900/20 dark:border-brand-500/50"
                  : "border-gray-200 dark:border-gray-700 bg-white dark:bg-white/[0.03] hover:border-brand-300 dark:hover:border-brand-500/30"
              }`}
            >
              <MapPin
                size={15}
                className={`mt-0.5 flex-shrink-0 ${isActive ? "text-brand-500" : "text-gray-400"}`}
              />
              <div>
                <p className={`text-sm font-semibold leading-tight ${isActive ? "text-brand-700 dark:text-brand-300" : "text-gray-800 dark:text-white"}`}>
                  {spot.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
                  {spot.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-500/30">
          <MapPin size={14} className="text-green-600 dark:text-green-400 flex-shrink-0" />
          <p className="text-sm text-green-700 dark:text-green-400">
            <strong>Selected:</strong> {selected.name}
          </p>
        </div>
      )}
    </div>
  );
}

export { UNILAG_SPOTS };
