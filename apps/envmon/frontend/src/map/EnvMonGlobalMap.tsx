import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import type { FeatureCollection, Point as GeoPoint } from 'geojson';
import type { PlantFeatureProps } from './mapUtils';
import { computeBounds, hasValidCoordinates } from './mapUtils';
import type { PlantInfo } from '~/types';

const SOURCE_ID = 'plants';
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/positron';

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
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  // Keep refs current to avoid stale closures in map event handlers
  useEffect(() => { onOpenPlantRef.current = onOpenPlant; }, [onOpenPlant]);
  useEffect(() => { fcRef.current = featureCollection; }, [featureCollection]);

  // Mount / destroy
  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [10, 20],
      zoom: 1.5,
      maxZoom: 8,
      bearing: 0,
      pitch: 0,
      pitchWithRotate: false,
      attributionControl: false,
    });

    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      'bottom-right',
    );

    map.on('load', () => {
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: fcRef.current,
        cluster: true,
        clusterMaxZoom: 6,
        clusterRadius: 40,
        clusterProperties: {
          // Aggregate worst-case status across cluster members
          max_fails:     ['max', ['get', 'activeFails']],
          neglect_count: ['+', ['case', ['==', ['get', 'isNeglected'], true], 1, 0]],
        },
      });

      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: SOURCE_ID,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'case',
            ['>', ['get', 'max_fails'], 0],     '#F24A00', // any critical → red
            ['>', ['get', 'neglect_count'], 0],  '#718096', // any neglected → grey
            '#005776',                                      // all safe → Valentia Slate
          ],
          'circle-radius': ['step', ['get', 'point_count'], 18, 5, 22, 10, 28],
          'circle-opacity': 0.85,
        },
      });

      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: SOURCE_ID,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-font': ['Noto Sans Bold', 'Noto Sans Regular'],
          'text-size': 12,
        },
        paint: { 'text-color': '#ffffff' },
      });

      // Red glow beacon for critical plants (static blur — GL layers cannot animate)
      map.addLayer({
        id: 'risk-beacon',
        type: 'circle',
        source: SOURCE_ID,
        filter: ['all', ['!', ['has', 'point_count']], ['>', ['get', 'activeFails'], 0]],
        paint: {
          'circle-color': '#F24A00',
          'circle-blur': 0.7,
          'circle-opacity': 0.25,
          'circle-radius': ['+', ['get', 'radius'],
            ['interpolate', ['linear'], ['zoom'], 1, 14, 4, 12, 6, 10, 8, 8],
          ],
        },
      });

      // Hollow grey ring for neglected plants (no lots tested despite plan)
      map.addLayer({
        id: 'neglect-ring',
        type: 'circle',
        source: SOURCE_ID,
        filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'isNeglected'], true]],
        paint: {
          'circle-color': 'rgba(0,0,0,0)',
          'circle-radius': ['+', ['get', 'radius'],
            ['interpolate', ['linear'], ['zoom'], 1, 8, 4, 6, 6, 5, 8, 4],
          ],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#718096',
          'circle-stroke-opacity': 0.7,
        },
      });

      // White background disc + Valentia slate outline
      map.addLayer({
        id: 'plant-halo',
        type: 'circle',
        source: SOURCE_ID,
        filter: ['!', ['has', 'point_count']],
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
        filter: ['!', ['has', 'point_count']],
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
        filter: ['==', ['get', 'plantId'], ''],
        paint: {
          'circle-color': 'rgba(0,0,0,0)',
          'circle-radius': ['+', ['get', 'radius'],
            ['interpolate', ['linear'], ['zoom'], 1, 10, 4, 8, 6, 6, 8, 5],
          ],
          'circle-stroke-width': 2.5,
          'circle-stroke-color': '#1E3A5F',
        },
      });

      // Cluster click: expand
      map.on('click', 'clusters', (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
        if (!features.length) return;
        const clusterId = features[0].properties?.cluster_id as number;
        const src = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource;
        src.getClusterExpansionZoom(clusterId).then((zoom) => {
          if (zoom == null) return;
          const geom = features[0].geometry as GeoPoint;
          map.easeTo({ center: geom.coordinates as [number, number], zoom });
        });
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

      map.on('mouseenter', 'clusters', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'clusters', () => { map.getCanvas().style.cursor = ''; });
      map.on('mouseenter', 'plant-halo', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'plant-halo', () => { map.getCanvas().style.cursor = ''; });

      const TOOLTIP_MIN_ZOOM = 5;

      map.on('mouseenter', 'unclustered-point', (e) => {
        map.getCanvas().style.cursor = 'pointer';
        if (map.getZoom() < TOOLTIP_MIN_ZOOM) return;
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
        });
      });

      map.on('mousemove', 'unclustered-point', (e) => {
        if (!e.originalEvent || map.getZoom() < TOOLTIP_MIN_ZOOM) return;
        setTooltip((t) =>
          t ? { ...t, x: e.originalEvent.clientX, y: e.originalEvent.clientY } : null,
        );
      });

      map.on('mouseleave', 'unclustered-point', () => {
        map.getCanvas().style.cursor = '';
        setTooltip(null);
      });
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update GeoJSON source when featureCollection changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    (map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined)?.setData(
      featureCollection,
    );
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
          {tooltip.lotsPlanned > 0 && (
            <div style={{ fontSize: 11, marginTop: 2, fontFamily: 'var(--font-mono)' }}>
              <span style={{ color: 'rgba(255,255,255,0.6)' }}>
                {tooltip.lotsTested}/{tooltip.lotsPlanned} lots
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
