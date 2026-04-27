import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import type { FeatureCollection, Point as GeoPoint } from 'geojson';
import type { PlantFeatureProps } from './mapUtils';
import { computeBounds, hasValidCoordinates } from './mapUtils';
import type { PlantInfo } from '~/types';

const SOURCE_ID = 'plants';
const POSITRON_MAP_STYLE = 'https://tiles.openfreemap.org/styles/positron';
const PERSISTENT_TOOLTIP_MIN_ZOOM = 5;

function buildPersistentTooltipElement(props: PlantFeatureProps): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'tooltip envmon-persistent-tooltip';
  el.style.pointerEvents = 'none';
  el.style.maxWidth = '210px';

  const code = document.createElement('div');
  code.className = 'mono';
  code.style.fontSize = '10.5px';
  code.style.opacity = '0.75';
  code.textContent = props.plantCode;
  el.appendChild(code);

  const name = document.createElement('div');
  name.style.fontWeight = '600';
  name.textContent = props.plantName;
  el.appendChild(name);

  if (props.city) {
    const city = document.createElement('div');
    city.style.fontSize = '11px';
    city.style.color = 'rgba(255,255,255,0.7)';
    city.textContent = props.city;
    el.appendChild(city);
  }

  const failsRow = document.createElement('div');
  failsRow.style.cssText = 'font-size:11px;margin-top:4px;font-family:var(--font-mono)';
  const failSpan = document.createElement('span');
  failSpan.style.cssText = 'color:var(--sunset);margin-right:8px';
  failSpan.textContent = `${props.activeFails} FAIL`;
  failsRow.appendChild(failSpan);
  const passSpan = document.createElement('span');
  passSpan.textContent = `${props.passRate.toFixed(1)}% pass`;
  failsRow.appendChild(passSpan);
  el.appendChild(failsRow);

  const lotsRow = document.createElement('div');
  lotsRow.style.cssText = 'font-size:11px;margin-top:2px;font-family:var(--font-mono)';
  const lotsSpan = document.createElement('span');
  if (props.complianceStatus === 'neglected') {
    lotsSpan.style.color = 'var(--sunset)';
    lotsSpan.textContent = 'No tests in window — NEGLECTED';
  } else {
    lotsSpan.style.color = 'rgba(255,255,255,0.6)';
    const word = props.lotsTested === 1 ? 'test' : 'tests';
    lotsSpan.textContent = `${props.lotsTested} ${word} in window`;
  }
  lotsRow.appendChild(lotsSpan);
  el.appendChild(lotsRow);

  return el;
}
const FALLBACK_MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': '#edf2ef' },
    },
  ],
};

interface TooltipState {
  x: number;
  y: number;
  plantCode: string;
  plantName: string;
  city: string;
  activeFails: number;
  passRate: number;
  lotsTested: number;
  lotsPlanned: number;
  complianceStatus: PlantFeatureProps['complianceStatus'];
}

/**
 * Props for the Global Environment Monitoring Map.
 */
interface Props {
  /** GeoJSON FeatureCollection containing plant locations and status. */
  featureCollection: FeatureCollection<GeoPoint, PlantFeatureProps>;
  /** Raw plant data for filtering and camera movement. */
  plants: PlantInfo[];
  /** ID of the currently focused plant to highlight. */
  selectedPlantId: string | null;
  /** Callback triggered when a plant marker is clicked. */
  onOpenPlant: (plantId: string) => void;
}

/**
 * Interactive world map component using MapLibre GL JS.
 * Visualizes global plant health with Critical / Neglected / Safe status states.
 */
export default function EnvMonGlobalMap({
  featureCollection,
  plants,
  selectedPlantId,
  onOpenPlant,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const onOpenPlantRef = useRef(onOpenPlant);
  const fcRef = useRef(featureCollection);
  const selectedPlantIdRef = useRef(selectedPlantId);
  const persistentMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  // Keep refs current to avoid stale closures in map event handlers
  useEffect(() => { onOpenPlantRef.current = onOpenPlant; }, [onOpenPlant]);
  useEffect(() => { fcRef.current = featureCollection; }, [featureCollection]);
  useEffect(() => { selectedPlantIdRef.current = selectedPlantId; }, [selectedPlantId]);

  // Mount / destroy
  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: POSITRON_MAP_STYLE,
      center: [10, 20],
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
      'bottom-right',
    );

    let fallbackApplied = false;
    let layersRegistered = false;

    const syncPersistentTooltips = () => {
      if (!map.isStyleLoaded() || !map.getLayer('unclustered-point')) return;
      const markers = persistentMarkersRef.current;

      if (map.getZoom() < PERSISTENT_TOOLTIP_MIN_ZOOM) {
        markers.forEach((m) => m.remove());
        markers.clear();
        return;
      }

      const features = map.queryRenderedFeatures({ layers: ['unclustered-point'] });
      const visibleIds = new Set<string>();

      for (const f of features) {
        const props = f.properties as PlantFeatureProps | undefined;
        if (!props || visibleIds.has(props.plantId)) continue;
        visibleIds.add(props.plantId);

        const coords = (f.geometry as GeoPoint).coordinates as [number, number];
        const existing = markers.get(props.plantId);
        if (existing) {
          existing.setLngLat(coords);
        } else {
          const el = buildPersistentTooltipElement(props);
          const marker = new maplibregl.Marker({
            element: el,
            anchor: 'top-left',
            offset: [12, -8],
          })
            .setLngLat(coords)
            .addTo(map);
          markers.set(props.plantId, marker);
        }
      }

      // Remove markers no longer visible
      markers.forEach((marker, id) => {
        if (!visibleIds.has(id)) {
          marker.remove();
          markers.delete(id);
        }
      });
    };

    const registerPlantLayers = () => {
      if (layersRegistered || !map.isStyleLoaded()) return;
      layersRegistered = true;

      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: fcRef.current,
      });

      // Red glow beacon for critical plants (static blur — GL layers cannot animate)
      map.addLayer({
        id: 'risk-beacon',
        type: 'circle',
        source: SOURCE_ID,
        filter: ['==', ['get', 'riskTier'], 'high'],
        paint: {
          'circle-color': '#F24A00',
          'circle-blur': 0.8,
          'circle-opacity': ['interpolate', ['linear'], ['zoom'], 1, 0.35, 5, 0.28, 8, 0.22],
          'circle-radius': ['+', ['get', 'radius'],
            ['interpolate', ['exponential', 1.6], ['zoom'], 1, 20, 4, 34, 7, 62, 8, 78],
          ],
        },
      });

      // Hollow grey ring for neglected plants (no lots tested in window)
      map.addLayer({
        id: 'neglect-ring',
        type: 'circle',
        source: SOURCE_ID,
        filter: ['==', ['get', 'isNeglected'], true],
        paint: {
          'circle-color': 'rgba(0,0,0,0)',
          'circle-radius': ['+', ['get', 'radius'],
            ['interpolate', ['exponential', 1.4], ['zoom'], 1, 12, 4, 17, 7, 24, 8, 30],
          ],
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 1, 1.2, 8, 2.2],
          'circle-stroke-color': '#718096',
          'circle-stroke-opacity': 0.7,
        },
      });

      // White background disc + Valentia slate outline
      map.addLayer({
        id: 'plant-halo',
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-color': '#ffffff',
          'circle-stroke-color': '#005776',
          'circle-stroke-width': 1.5,
          'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], 1, 0.5, 5, 0.4, 8, 0.3],
          'circle-radius': ['+', ['get', 'radius'],
            ['interpolate', ['linear'], ['zoom'], 1, 7, 4, 5, 6, 3, 8, 2],
          ],
          'circle-opacity': ['interpolate', ['linear'], ['zoom'], 1, 0.9, 5, 0.8, 8, 0.65],
        },
      });

      map.addLayer({
        id: 'unclustered-point',
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': ['get', 'radius'],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.92,
        },
      });

      // Highlight ring for the selected plant
      map.addLayer({
        id: 'selected-ring',
        type: 'circle',
        source: SOURCE_ID,
        filter: selectedPlantIdRef.current
          ? ['==', ['get', 'plantId'], selectedPlantIdRef.current]
          : ['==', ['get', 'plantId'], ''],
        paint: {
          'circle-color': 'rgba(0,0,0,0)',
          'circle-radius': ['+', ['get', 'radius'],
            ['interpolate', ['linear'], ['zoom'], 1, 10, 4, 8, 6, 6, 8, 5],
          ],
          'circle-stroke-width': 3,
          'circle-stroke-color': '#1E3A5F',
          'circle-stroke-opacity': 0.95,
        },
      });

      // Plant click: navigate (both halo ring and status dot are clickable)
      map.on('click', 'plant-halo', (e) => {
        const plantId = e.features?.[0]?.properties?.plantId as string | undefined;
        if (plantId) onOpenPlantRef.current(plantId);
      });
      map.on('click', 'unclustered-point', (e) => {
        const plantId = e.features?.[0]?.properties?.plantId as string | undefined;
        if (plantId) onOpenPlantRef.current(plantId);
      });

      map.on('mouseenter', 'plant-halo', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'plant-halo', () => { map.getCanvas().style.cursor = ''; });

      const HOVER_TOOLTIP_MIN_ZOOM = 3;

      map.on('mouseenter', 'unclustered-point', (e) => {
        map.getCanvas().style.cursor = 'pointer';
        if (map.getZoom() >= PERSISTENT_TOOLTIP_MIN_ZOOM) return;
        if (map.getZoom() < HOVER_TOOLTIP_MIN_ZOOM) return;
        const props = e.features?.[0]?.properties as PlantFeatureProps | undefined;
        if (!props || !e.originalEvent) return;
        setTooltip({
          x: e.originalEvent.clientX,
          y: e.originalEvent.clientY,
          plantCode: props.plantCode,
          plantName: props.plantName,
          city: props.city,
          activeFails: props.activeFails,
          passRate: props.passRate,
          lotsTested: props.lotsTested,
          lotsPlanned: props.lotsPlanned,
          complianceStatus: props.complianceStatus,
        });
      });

      map.on('mousemove', 'unclustered-point', (e) => {
        if (!e.originalEvent || map.getZoom() >= PERSISTENT_TOOLTIP_MIN_ZOOM) return;
        if (map.getZoom() < HOVER_TOOLTIP_MIN_ZOOM) return;
        setTooltip((t) =>
          t ? { ...t, x: e.originalEvent.clientX, y: e.originalEvent.clientY } : null,
        );
      });

      map.on('mouseleave', 'unclustered-point', () => {
        map.getCanvas().style.cursor = '';
        setTooltip(null);
      });

      map.on('moveend', syncPersistentTooltips);
      map.on('zoomend', syncPersistentTooltips);
      map.on('sourcedata', (e) => {
        if (e.sourceId === SOURCE_ID && e.isSourceLoaded) {
          // Underlying data may have changed (filter/window) — rebuild tooltip HTML
          persistentMarkersRef.current.forEach((m) => m.remove());
          persistentMarkersRef.current.clear();
          syncPersistentTooltips();
        }
      });
    };

    map.on('load', registerPlantLayers);
    map.on('styledata', registerPlantLayers);
    map.on('error', () => {
      if (layersRegistered || fallbackApplied) return;
      fallbackApplied = true;
      map.setStyle(FALLBACK_MAP_STYLE);
    });

    mapRef.current = map;
    return () => {
      persistentMarkersRef.current.forEach((m) => m.remove());
      persistentMarkersRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update GeoJSON source when featureCollection changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    (map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined)?.setData(featureCollection);
  }, [featureCollection]);

  // Camera: fit to visible plants
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const valid = plants.filter(hasValidCoordinates);
    if (valid.length === 0) return;

    const moveCam = () => {
      if (valid.length === 1) {
        map.flyTo({ center: [valid[0].lon, valid[0].lat], zoom: 7, duration: 800 });
      } else {
        const bounds = computeBounds(valid);
        if (bounds) map.fitBounds(bounds, { padding: 48, maxZoom: 6, duration: 800 });
      }
    };

    if (map.isStyleLoaded()) moveCam();
    else map.once('load', moveCam);
  }, [plants]);

  // Selected ring filter
  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded() || !map.getLayer('selected-ring')) return;
    map.setFilter(
      'selected-ring',
      selectedPlantId
        ? ['==', ['get', 'plantId'], selectedPlantId]
        : ['==', ['get', 'plantId'], ''],
    );
  }, [selectedPlantId]);

  const hasLocations = plants.some(hasValidCoordinates);

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <div ref={containerRef} className="envmon-map-container" />
      {!hasLocations && plants.length > 0 && (
        <div className="envmon-map-badge">No GPS coordinates on record</div>
      )}
      {tooltip && (
        <div
          className="tooltip"
          style={{
            position: 'fixed',
            left: tooltip.x + 14,
            top: tooltip.y + 14,
            zIndex: 1000,
            pointerEvents: 'none',
          }}
        >
          <div className="mono" style={{ fontSize: 10.5, opacity: 0.75 }}>
            {tooltip.plantCode}
          </div>
          <div style={{ fontWeight: 600 }}>{tooltip.plantName}</div>
          {tooltip.city && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>{tooltip.city}</div>
          )}
          <div style={{ fontSize: 11, marginTop: 4, fontFamily: 'var(--font-mono)' }}>
            <span style={{ color: 'var(--sunset)', marginRight: 8 }}>
              {tooltip.activeFails} FAIL
            </span>
            <span>{tooltip.passRate.toFixed(1)}% pass</span>
          </div>
          <div style={{ fontSize: 11, marginTop: 2, fontFamily: 'var(--font-mono)' }}>
            {tooltip.complianceStatus === 'neglected' ? (
              <span style={{ color: 'var(--sunset)' }}>
                No tests in window — NEGLECTED
              </span>
            ) : (
              <span style={{ color: 'rgba(255,255,255,0.6)' }}>
                {tooltip.lotsTested} {tooltip.lotsTested === 1 ? 'test' : 'tests'} in window
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
