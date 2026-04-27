import { describe, it, expect } from 'vitest';
import {
  riskTier,
  hasValidCoordinates,
  plantsToFeatureCollection,
  computeBounds,
  RISK_COLORS,
  RISK_HIGH_THRESHOLD,
  RISK_MED_THRESHOLD,
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

describe('riskTier', () => {
  it('returns high when riskIndex is above RISK_HIGH_THRESHOLD', () => {
    expect(riskTier(RISK_HIGH_THRESHOLD + 1)).toBe('high');
  });

  it('returns med when riskIndex equals RISK_HIGH_THRESHOLD (not strictly greater)', () => {
    expect(riskTier(RISK_HIGH_THRESHOLD)).toBe('med');
  });

  it('returns med when riskIndex is between thresholds', () => {
    expect(riskTier(20)).toBe('med');
  });

  it('returns low when riskIndex equals RISK_MED_THRESHOLD (not strictly greater)', () => {
    expect(riskTier(RISK_MED_THRESHOLD)).toBe('low');
  });

  it('returns low when riskIndex is below RISK_MED_THRESHOLD', () => {
    expect(riskTier(5)).toBe('low');
  });
});

describe('plantsToFeatureCollection', () => {
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

  it('assigns the high risk color for high-risk plants', () => {
    const plant = makePlant({ kpis: { ...makePlant().kpis, risk_index: 35 } });
    const fc = plantsToFeatureCollection([plant]);
    expect(fc.features[0].properties.color).toBe(RISK_COLORS.high);
    expect(fc.features[0].properties.riskTier).toBe('high');
  });

  it('assigns the med risk color for medium-risk plants', () => {
    const plant = makePlant({ kpis: { ...makePlant().kpis, risk_index: 20 } });
    const fc = plantsToFeatureCollection([plant]);
    expect(fc.features[0].properties.color).toBe(RISK_COLORS.med);
    expect(fc.features[0].properties.riskTier).toBe('med');
  });

  it('assigns the low risk color for low-risk plants', () => {
    const plant = makePlant({ kpis: { ...makePlant().kpis, risk_index: 5 } });
    const fc = plantsToFeatureCollection([plant]);
    expect(fc.features[0].properties.color).toBe(RISK_COLORS.low);
    expect(fc.features[0].properties.riskTier).toBe('low');
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
