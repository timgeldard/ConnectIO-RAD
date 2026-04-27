import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { fmtN, fmtInt } from "../ui";

const POSITRON_MAP_STYLE = "https://tiles.openfreemap.org/styles/positron";
const FALLBACK_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#edf2ef" } },
  ],
};

export interface CustomerMapMarker {
  /** Stable key per location (used as React key & marker id). */
  key: string;
  destination: string;
  country: string;
  /** Distinct customers receiving deliveries at this location. */
  customers: string[];
  /** Total qty delivered to this location, across all customers. */
  qty: number;
  /** Number of separate deliveries to this location. */
  deliveryCount: number;
  /** Unit of measure for qty (kg, t, etc.). */
  uom: string;
  lat: number;
  lon: number;
}

interface Props {
  markers: CustomerMapMarker[];
  /** True while geocoding is still in flight. Drives the badge overlay. */
  geocoding?: boolean;
  geocodingMessage?: string;
  emptyMessage?: string;
}

/**
 * MapLibre map showing customer delivery locations on top of OpenFreeMap
 * Positron tiles. Same basemap and Kerry palette as envmon's GlobalMap.
 *
 * Markers scale with delivery qty (radius 6–14px). Camera fits to the union
 * of all markers; if there's only one, it flies to it at zoom 6.
 */
export function CustomerMap({
  markers,
  geocoding = false,
  geocodingMessage = "Locating customer addresses…",
  emptyMessage = "No customer locations to plot.",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerObjsRef = useRef<maplibregl.Marker[]>([]);

  // Mount / destroy map
  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: POSITRON_MAP_STYLE,
      center: [10, 30],
      zoom: 1.5,
      maxZoom: 8,
      bearing: 0,
      pitch: 0,
      pitchWithRotate: false,
      attributionControl: false,
    });

    map.dragRotate?.disable?.();
    map.touchZoomRotate?.disableRotation?.();

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "bottom-right",
    );

    let fallbackApplied = false;
    map.on("error", () => {
      if (fallbackApplied) return;
      fallbackApplied = true;
      map.setStyle(FALLBACK_STYLE);
    });

    mapRef.current = map;
    return () => {
      markerObjsRef.current.forEach((m) => m.remove());
      markerObjsRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Sync markers + camera
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markerObjsRef.current.forEach((m) => m.remove());
    markerObjsRef.current = [];

    if (markers.length === 0) return;

    const maxQty = Math.max(...markers.map((m) => m.qty), 1);

    for (const m of markers) {
      const radius = 6 + (m.qty / maxQty) * 8; // 6..14px

      const dot = document.createElement("div");
      dot.style.cssText = `
        width: ${radius * 2}px;
        height: ${radius * 2}px;
        border-radius: 50%;
        background: #005776;
        border: 2px solid #ffffff;
        box-shadow: 0 0 0 1px rgba(0,87,118,0.35), 0 1px 2px rgba(20,55,0,0.15);
        cursor: pointer;
      `;

      const popup = new maplibregl.Popup({
        offset: radius + 6,
        closeButton: false,
        maxWidth: "260px",
      }).setDOMContent(buildPopupContent(m));

      const marker = new maplibregl.Marker({ element: dot, anchor: "center" })
        .setLngLat([m.lon, m.lat])
        .setPopup(popup)
        .addTo(map);

      markerObjsRef.current.push(marker);
    }

    // Frame the camera around the markers
    const moveCam = () => {
      if (markers.length === 1) {
        map.flyTo({ center: [markers[0].lon, markers[0].lat], zoom: 6, duration: 800 });
        return;
      }
      const bounds = new maplibregl.LngLatBounds(
        [markers[0].lon, markers[0].lat],
        [markers[0].lon, markers[0].lat],
      );
      for (const m of markers) bounds.extend([m.lon, m.lat]);
      map.fitBounds(bounds, { padding: 56, maxZoom: 6, duration: 800 });
    };

    if (map.isStyleLoaded()) moveCam();
    else map.once("load", moveCam);
  }, [markers]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      {geocoding && (
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            background: "rgba(0,87,118,0.92)",
            color: "#ffffff",
            padding: "6px 12px",
            borderRadius: 6,
            fontSize: 11,
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            pointerEvents: "none",
            boxShadow: "0 1px 2px rgba(20,55,0,0.15)",
          }}
        >
          {geocodingMessage}
        </div>
      )}
      {!geocoding && markers.length === 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--ink-3)",
            fontSize: 13,
            fontFamily: "var(--font-sans)",
            pointerEvents: "none",
          }}
        >
          {emptyMessage}
        </div>
      )}
    </div>
  );
}

function buildPopupContent(m: CustomerMapMarker): HTMLDivElement {
  const root = document.createElement("div");
  root.style.cssText = "font-family: var(--font-sans); color: var(--ink-1); min-width: 180px;";

  const header = document.createElement("div");
  header.style.cssText =
    "font-size: 13px; font-weight: 600; color: var(--forest); margin-bottom: 2px;";
  header.textContent = m.destination || m.country;
  root.appendChild(header);

  if (m.country) {
    const country = document.createElement("div");
    country.style.cssText =
      "font-size: 10.5px; font-family: var(--font-mono); color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px;";
    country.textContent = m.country;
    root.appendChild(country);
  }

  const stats = document.createElement("div");
  stats.style.cssText =
    "font-size: 11px; font-family: var(--font-mono); color: var(--ink-2); display: flex; gap: 12px; margin-bottom: 8px;";
  const qtySpan = document.createElement("span");
  qtySpan.innerHTML = `<strong style="color: var(--brand);">${escapeHtml(fmtN(m.qty))} ${escapeHtml(m.uom)}</strong>`;
  const dlSpan = document.createElement("span");
  dlSpan.textContent = `${fmtInt(m.deliveryCount)} ${m.deliveryCount === 1 ? "delivery" : "deliveries"}`;
  stats.appendChild(qtySpan);
  stats.appendChild(dlSpan);
  root.appendChild(stats);

  if (m.customers.length > 0) {
    const list = document.createElement("ul");
    list.style.cssText = "list-style: none; padding: 0; margin: 0; font-size: 11px; color: var(--ink-2);";
    for (const name of m.customers.slice(0, 6)) {
      const li = document.createElement("li");
      li.style.cssText = "padding: 2px 0;";
      li.textContent = name;
      list.appendChild(li);
    }
    if (m.customers.length > 6) {
      const more = document.createElement("li");
      more.style.cssText = "padding: 2px 0; color: var(--ink-3); font-style: italic;";
      more.textContent = `+${m.customers.length - 6} more`;
      list.appendChild(more);
    }
    root.appendChild(list);
  }

  return root;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}
