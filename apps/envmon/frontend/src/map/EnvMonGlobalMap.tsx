import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import type { FeatureCollection, Point as GeoPoint } from 'geojson';
import type { PlantFeatureProps } from './mapUtils';
import { computeBounds } from './mapUtils';
import type { PlantInfo } from '~/types';

const SOURCE_ID = 'plants';
const MAP_STYLE: string =
  (import.meta.env.VITE_MAP_STYLE_URL as string | undefined) ??
  'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

interface TooltipState {
  x: number;
  y: number;
  plantCode: string;
  plantName: string;
  city: string;
  activeFails: number;
  passRate: number;
}

interface Props {
  featureCollection: FeatureCollection<GeoPoint, PlantFeatureProps>;
  plants: PlantInfo[];
  selectedPlantId: string | null;
  onOpenPlant: (plantId: string) => void;
}

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
      attributionControl: false,
    });

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      'bottom-right',
    );

    map.on('load', () => {
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: fcRef.current,
        cluster: true,
        clusterMaxZoom: 10,
        clusterRadius: 40,
      });

      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: SOURCE_ID,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#3B6B4E',
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
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size': 12,
        },
        paint: { 'text-color': '#ffffff' },
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
          'circle-radius': ['+', ['get', 'radius'], 6],
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

      // Plant click: navigate
      map.on('click', 'unclustered-point', (e) => {
        const plantId = e.features?.[0]?.properties?.plantId as string | undefined;
        if (plantId) onOpenPlantRef.current(plantId);
      });

      map.on('mouseenter', 'clusters', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'clusters', () => { map.getCanvas().style.cursor = ''; });

      map.on('mouseenter', 'unclustered-point', (e) => {
        map.getCanvas().style.cursor = 'pointer';
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
        if (!e.originalEvent) return;
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
    const valid = plants.filter((p) => p.lat !== 0 || p.lon !== 0);
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

  const hasLocations = plants.some((p) => p.lat !== 0 || p.lon !== 0);

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
