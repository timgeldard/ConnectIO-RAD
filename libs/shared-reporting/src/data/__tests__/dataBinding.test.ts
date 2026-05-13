import { describe, it, expect } from 'vitest';
import { resolvePath } from '../path';
import { mapResponseToWidgetProps } from '../mapping';

describe('resolvePath', () => {
  const payload = {
    nested: {
      value: 123,
      list: [
        { id: 'a', val: 10 },
        { id: 'b', val: 20 },
      ],
    },
    top: 'hello',
  };

  it('resolves simple top-level paths', () => {
    expect(resolvePath(payload, 'top')).toBe('hello');
  });

  it('resolves nested paths', () => {
    expect(resolvePath(payload, 'nested.value')).toBe(123);
  });

  it('resolves array indexes', () => {
    expect(resolvePath(payload, 'nested.list.0.val')).toBe(10);
    expect(resolvePath(payload, 'nested.list.1.id')).toBe('b');
  });

  it('returns undefined for invalid paths', () => {
    expect(resolvePath(payload, 'nonexistent')).toBeUndefined();
    expect(resolvePath(payload, 'nested.missing')).toBeUndefined();
    expect(resolvePath(payload, 'nested.list.5')).toBeUndefined();
    expect(resolvePath(payload, 'nested.list.not-a-number')).toBeUndefined();
  });

  it('handles null/undefined payload gracefully', () => {
    expect(resolvePath(null, 'any')).toBeUndefined();
    expect(resolvePath(undefined, 'any')).toBeUndefined();
  });
});

describe('mapResponseToWidgetProps', () => {
  const payload = {
    metric: 0.8567,
    label: 'Efficiency',
    history: [10, 20, 30],
  };

  it('maps simple string paths', () => {
    const mapping = {
      value: 'metric',
      subtext: 'label',
    };
    const result = mapResponseToWidgetProps(payload, mapping);
    expect(result).toEqual({
      value: 0.8567,
      subtext: 'Efficiency',
    });
  });

  it('applies transforms', () => {
    const mapping = {
      value: { path: 'metric', transform: 'percentage' as const },
      count: { path: 'metric', transform: 'number' as const },
      msg: { path: 'metric', transform: 'string' as const },
    };
    const result = mapResponseToWidgetProps(payload, mapping);
    expect(result).toEqual({
      value: '85.67%',
      count: 0.8567,
      msg: '0.8567',
    });
  });

  it('skips undefined values', () => {
    const mapping = {
      value: 'metric',
      missing: 'missing_field',
    };
    const result = mapResponseToWidgetProps(payload, mapping);
    expect(result).toEqual({
      value: 0.8567,
    });
  });

  it('transforms timeseries points with custom keys', () => {
    const complexPayload = {
      data: [
        { timestamp: '2023-01-01', val: 100 },
        { timestamp: '2023-01-02', val: 110 },
      ]
    };
    const mapping = {
      points: {
        path: 'data',
        transform: 'timeseriesPoints' as const,
        config: { labelKey: 'timestamp', valueKey: 'val' }
      }
    };
    const result = mapResponseToWidgetProps(complexPayload, mapping);
    expect(result.points).toEqual([
      { label: '2023-01-01', value: 100 },
      { label: '2023-01-02', value: 110 },
    ]);
  });

  it('transforms bar series', () => {
    const complexPayload = {
      seriesData: [
        { name: 'OEE', data: [80, 85, 90], color: '#f00' },
        { name: 'Target', data: [85, 85, 85] },
      ]
    };
    const mapping = {
      series: {
        path: 'seriesData',
        transform: 'barSeries' as const
      }
    };
    const result = mapResponseToWidgetProps(complexPayload, mapping);
    expect(result.series).toEqual([
      { name: 'OEE', data: [80, 85, 90], color: '#f00' },
      { name: 'Target', data: [85, 85, 85], color: undefined },
    ]);
  });

  it('transforms SPC points and limits', () => {
    const payload = {
      spc: {
        raw: [
          { ts: '10:00', val: 5.1, alert: true },
          { ts: '10:05', val: 5.0, alert: false },
        ],
        stats: { UCL: 5.5, CL: 5.0, LCL: 4.5 }
      }
    };
    const mapping = {
      points: {
        path: 'spc.raw',
        transform: 'spcPoints' as const,
        config: { labelKey: 'ts', valueKey: 'val', signalKey: 'alert' }
      },
      limits: {
        path: 'spc.stats',
        transform: 'spcLimits' as const
      }
    };
    const result = mapResponseToWidgetProps(payload, mapping);
    expect(result.points).toEqual([
      { label: '10:00', value: 5.1, signal: true, excluded: false },
      { label: '10:05', value: 5.0, signal: false, excluded: false },
    ]);
    expect(result.limits).toEqual({ ucl: 5.5, cl: 5.0, lcl: 4.5 });
  });
});
