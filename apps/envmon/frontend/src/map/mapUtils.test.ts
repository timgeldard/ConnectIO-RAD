import { describe, it, expect } from 'vitest';
import {
  hasValidCoordinates,
  plantsToFeatureCollection,
  computeBounds,
  STATUS_COLORS,
} from './mapUtils';
import type { PlantInfo } from '~/types';

function makePlant(overrides: Partial<PlantInfo> = {}): PlantInfo {
  return {
    plant_id: 'P1',
    plant_name: 'Test Plant',
    plant_code: 'TP',
    country: 'IE',
    region: 'EMEA',
    city: 'Dublin',
    product: 'Dairy',
    employees: 100,
    lat: 53.3,
    lon: -6.2,
    floors: 1,
    kpis: {
      total_locs: 10,
      active_fails: 0,
      warnings: 0,
      pending: 0,
      pass_rate: 100,
      lots_tested: 5,
      lots_planned: 5,
      risk_index: 5,
      pathogen_hits: 0,
    },
    ...overrides,
  };
}

describe('plantsToFeatureCollection — status model', () => {
  it('assigns critical status and red color when active_fails > 0', () => {
    const plant = makePlant({ kpis: { ...makePlant().kpis, active_fails: 3 } });
    const fc = plantsToFeatureCollection([plant]);
    expect(fc.features[0].properties.status).toBe('critical');
    expect(fc.features[0].properties.color).toBe(STATUS_COLORS.critical);
    expect(fc.features[0].properties.isNeglected).toBe(false);
  });

  it('assigns neglected status and grey color when lots_tested=0 and lots_planned>0', () => {
    const plant = makePlant({ kpis: { ...makePlant().kpis, lots_tested: 0, lots_planned: 5 } });
    const fc = plantsToFeatureCollection([plant]);
    expect(fc.features[0].properties.status).toBe('neglected');
    expect(fc.features[0].properties.color).toBe(STATUS_COLORS.neglected);
    expect(fc.features[0].properties.isNeglected).toBe(true);
  });

  it('critical takes precedence over neglected', () => {
    const plant = makePlant({
      kpis: { ...makePlant().kpis, active_fails: 2, lots_tested: 0, lots_planned: 5 },
    });
    const fc = plantsToFeatureCollection([plant]);
    expect(fc.features[0].properties.status).toBe('critical');
  });

  it('assigns safe status and jade color when no fails and lots are tested', () => {
    const plant = makePlant();
    const fc = plantsToFeatureCollection([plant]);
    expect(fc.features[0].properties.status).toBe('safe');
    expect(fc.features[0].properties.color).toBe(STATUS_COLORS.safe);
    expect(fc.features[0].properties.isNeglected).toBe(false);
  });

  it('assigns safe status when lots_planned is 0 (no plan to neglect)', () => {
    const plant = makePlant({ kpis: { ...makePlant().kpis, lots_tested: 0, lots_planned: 0 } });
    const fc = plantsToFeatureCollection([plant]);
    expect(fc.features[0].properties.status).toBe('safe');
  });

  it('populates lotsTested and lotsPlanned on each feature', () => {
    const plant = makePlant({ kpis: { ...makePlant().kpis, lots_tested: 3, lots_planned: 8 } });
    const fc = plantsToFeatureCollection([plant]);
    expect(fc.features[0].properties.lotsTested).toBe(3);
    expect(fc.features[0].properties.lotsPlanned).toBe(8);
  });
});

describe('plantsToFeatureCollection — geometry and filtering', () => {
  it('excludes plants with both lat and lon equal to zero', () => {
    const plant = makePlant({ lat: 0, lon: 0 });
    const fc = plantsToFeatureCollection([plant]);
    expect(fc.features).toHaveLength(0);
  });

  it('includes plants where only one coordinate is zero', () => {
    const plant = makePlant({ lat: 51.5, lon: 0 });
    const fc = plantsToFeatureCollection([plant]);
    expect(fc.features).toHaveLength(1);
  });

  it('excludes plants outside valid WGS-84 coordinate ranges', () => {
    expect(hasValidCoordinates(makePlant({ lat: 95, lon: -6.2 }))).toBe(false);
    expect(hasValidCoordinates(makePlant({ lat: 53.3, lon: -181 }))).toBe(false);
    expect(plantsToFeatureCollection([
      makePlant({ plant_id: 'P1', lat: 95, lon: -6.2 }),
      makePlant({ plant_id: 'P2', lat: 53.3, lon: -181 }),
    ]).features).toHaveLength(0);
  });

  it('stores coordinates as [lon, lat] (GeoJSON order)', () => {
    const plant = makePlant({ lat: 53.3, lon: -6.2 });
    const fc = plantsToFeatureCollection([plant]);
    expect(fc.features[0].geometry.coordinates).toEqual([-6.2, 53.3]);
  });
});

describe('computeBounds', () => {
  it('returns null for an empty array', () => {
    expect(computeBounds([])).toBeNull();
  });

  it('returns null when all plants have lat=0 and lon=0', () => {
    expect(computeBounds([makePlant({ lat: 0, lon: 0 })])).toBeNull();
  });

  it('returns tight bounds around a single plant', () => {
    const bounds = computeBounds([makePlant({ lat: 53.3, lon: -6.2 })]);
    expect(bounds).toEqual([[-6.2, 53.3], [-6.2, 53.3]]);
  });

  it('returns the correct bounding box for multiple plants', () => {
    const plants = [
      makePlant({ plant_id: 'P1', lat: 53.3, lon: -6.2 }),
      makePlant({ plant_id: 'P2', lat: 48.8, lon: 2.3 }),
      makePlant({ plant_id: 'P3', lat: 51.5, lon: -0.1 }),
    ];
    const bounds = computeBounds(plants);
    expect(bounds).toEqual([[-6.2, 48.8], [2.3, 53.3]]);
  });
});
