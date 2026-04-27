import type { Feature, FeatureCollection, Point } from 'geojson';
import type { PlantInfo } from '~/types';

export type StatusTier = 'critical' | 'neglected' | 'safe';

export const STATUS_COLORS: Record<StatusTier, string> = {
  critical:  '#F24A00', // Kerry sunset
  neglected: '#718096', // Cool grey
  safe:      '#44CF93', // Kerry jade
};

export interface PlantFeatureProps {
  plantId: string;
  plantName: string;
  plantCode: string;
  city: string;
  country: string;
  activeFails: number;
  passRate: number;
  riskIndex: number;
  status: StatusTier;
  isNeglected: boolean;
  lotsTested: number;
  lotsPlanned: number;
  color: string;
  radius: number;
}

export function hasValidCoordinates(plant: PlantInfo): boolean {
  return (
    Number.isFinite(plant.lat) &&
    Number.isFinite(plant.lon) &&
    plant.lat >= -90 &&
    plant.lat <= 90 &&
    plant.lon >= -180 &&
    plant.lon <= 180 &&
    (plant.lat !== 0 || plant.lon !== 0)
  );
}

function plantStatus(plant: PlantInfo): StatusTier {
  if (plant.kpis.active_fails > 0) return 'critical';
  if (plant.kpis.lots_tested === 0 && (plant.kpis.lots_planned ?? 0) > 0) return 'neglected';
  return 'safe';
}

export function plantsToFeatureCollection(
  plants: PlantInfo[],
): FeatureCollection<Point, PlantFeatureProps> {
  const features: Feature<Point, PlantFeatureProps>[] = plants
    .filter(hasValidCoordinates)
    .map((p) => {
      const status = plantStatus(p);
      const isNeglected = status === 'neglected';
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
        properties: {
          plantId: p.plant_id,
          plantName: p.plant_name,
          plantCode: p.plant_code,
          city: p.city ?? '',
          country: p.country,
          activeFails: p.kpis.active_fails,
          passRate: p.kpis.pass_rate,
          riskIndex: p.kpis.risk_index,
          status,
          isNeglected,
          lotsTested: p.kpis.lots_tested,
          lotsPlanned: p.kpis.lots_planned ?? 0,
          color: STATUS_COLORS[status],
          radius: 5 + Math.min(7, p.kpis.active_fails * 0.6),
        },
      };
    });

  return { type: 'FeatureCollection', features };
}

export function computeBounds(
  plants: PlantInfo[],
): [[number, number], [number, number]] | null {
  const valid = plants.filter(hasValidCoordinates);
  if (valid.length === 0) return null;
  const lons = valid.map((p) => p.lon);
  const lats = valid.map((p) => p.lat);
  return [
    [Math.min(...lons), Math.min(...lats)],
    [Math.max(...lons), Math.max(...lats)],
  ];
}
