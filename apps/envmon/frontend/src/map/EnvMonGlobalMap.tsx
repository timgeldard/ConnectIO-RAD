import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import type { FeatureCollection, Point as GeoPoint } from 'geojson';
import type { PlantFeatureProps } from './mapUtils';
import { computeBounds, hasValidCoordinates } from './mapUtils';
import type { PlantInfo } from '~/types';

const SOURCE_ID = 'plants';

const KERRY_MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    maplibre: {
      type: 'vector',
      url: 'https://demotiles.maplibre.org/tiles/tiles.json',
    },
  },
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  layers: [
    { id: 'background', type: 'background',
      paint: { 'background-color': '#eaeae2' } },
    { id: 'coastline', type: 'line', source: 'maplibre', 'source-layer': 'countries',
      paint: { 'line-color': '#c8cfc8', 'line-width': 0.5 } },
    { id: 'countries-fill', type: 'fill', source: 'maplibre', 'source-layer': 'countries',
      paint: { 'fill-color': '#f0f0e8', 'fill-opacity': 1 } },
    { id: 'countries-boundary', type: 'line', source: 'maplibre', 'source-layer': 'countries',
      paint: { 'line-color': '#005776', 'line-opacity': 0.18, 'line-width': 0.6 } },
    { id: 'countries-label', type: 'symbol', source: 'maplibre', 'source-layer': 'centroids',
      layout: {
        'text-field': ['get', 'ADMIN'],
        'text-font': ['Open Sans Semibold'],
        'text-size': 10,
        'text-max-width': 8,
      },
      paint: {
        'text-color': '#143700',
        'text-opacity': 0.35,
        'text-halo-color': '#f0f0e8',
        'text-halo-width': 1,
      },
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
}

/**
 * Props for the Global Environment Monitoring Map.
 */
interface Props {
  /** GeoJSON FeatureCollection containing plant locations and risk metrics. */
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
 * Visualizes global plant health and risk clusters.
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
      style: KERRY_MAP_STYLE,
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
      });

      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: SOURCE_ID,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#005776',
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
          'text-font': ['Open Sans Semibold', 'Arial Unicode MS Regular'],
          'text-size': 12,
        },
        paint: { 'text-color': '#ffffff' },
      });

      // White background disc + Valentia slate outline — grows at low zoom so plants are
      // visible as distinct pins even on a world-scale view.
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
        map.flyTo({ center: [valid[0].lon, valid[0].lat], zoom: 5, duration: 800 });
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
        </div>
      )}
    </div>
  );
}
