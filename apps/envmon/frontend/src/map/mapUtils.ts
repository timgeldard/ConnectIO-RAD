import type { Feature, FeatureCollection, Point } from 'geojson';
import type { PlantInfo } from '~/types';

export const RISK_HIGH_THRESHOLD = 30;
export const RISK_MED_THRESHOLD = 15;

export const RISK_COLORS = {
  high: '#F24A00', // --sunset
  med:  '#F9C20A', // --sunrise
  low:  '#44CF93', // --jade
} as const;

export type RiskTier = 'high' | 'med' | 'low';

export interface PlantFeatureProps {
  plantId: string;
  plantName: string;
  plantCode: string;
  city: string;
  country: string;
  activeFails: number;
  passRate: number;
  riskIndex: number;
  riskTier: RiskTier;
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

export function riskTier(riskIndex: number): RiskTier {
  if (riskIndex > RISK_HIGH_THRESHOLD) return 'high';
  if (riskIndex > RISK_MED_THRESHOLD) return 'med';
  return 'low';
}

export function plantsToFeatureCollection(
  plants: PlantInfo[],
): FeatureCollection<Point, PlantFeatureProps> {
  const features: Feature<Point, PlantFeatureProps>[] = plants
    .filter(hasValidCoordinates)
    .map((p) => {
      const tier = riskTier(p.kpis.risk_index);
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
          riskTier: tier,
          color: RISK_COLORS[tier],
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
