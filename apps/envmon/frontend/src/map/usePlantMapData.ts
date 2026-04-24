import { useMemo } from 'react';
import type { PlantInfo } from '~/types';
import { plantsToFeatureCollection } from './mapUtils';

export type SortBy = 'risk' | 'fails' | 'rate' | 'name';

interface PlantMapData {
  featureCollection: ReturnType<typeof plantsToFeatureCollection>;
  sortedPlants: PlantInfo[];
  scopedPlants: PlantInfo[];
}

export function usePlantMapData(
  plants: PlantInfo[],
  region: string,
  sortBy: SortBy,
): PlantMapData {
  const scopedPlants = useMemo(
    () => (region === 'ALL' ? plants : plants.filter((p) => p.region === region)),
    [plants, region],
  );

  const sortedPlants = useMemo(() => {
    return [...scopedPlants].sort((a, b) => {
      if (sortBy === 'risk') return b.kpis.risk_index - a.kpis.risk_index;
      if (sortBy === 'fails') return b.kpis.active_fails - a.kpis.active_fails;
      if (sortBy === 'rate') return a.kpis.pass_rate - b.kpis.pass_rate;
      return a.plant_name.localeCompare(b.plant_name);
    });
  }, [scopedPlants, sortBy]);

  const featureCollection = useMemo(
    () => plantsToFeatureCollection(scopedPlants),
    [scopedPlants],
  );

  return { featureCollection, sortedPlants, scopedPlants };
}
