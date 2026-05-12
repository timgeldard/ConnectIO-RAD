import { resolvePath } from './path';
import type { MappingValue, MappingTransform } from './types';

/**
 * Applies a controlled transform to a raw value.
 */
function applyTransform(value: any, transform?: MappingTransform, config?: Record<string, any>): any {
  if (value === undefined || value === null) return value;

  switch (transform) {
    case 'number':
      return Number(value);
    case 'string':
      return String(value);
    case 'percentage': {
      const num = Number(value);
      // If value is small (e.g. 0.85), assume 0-1 scale. 
      // If >= 1, assume already 0-100 scale.
      const pct = num < 1 && num > 0 ? num * 100 : num;
      return `${Math.round(pct * 100) / 100}%`;
    }
    case 'timeseriesPoints': {
      if (!Array.isArray(value)) return [];
      const labelKey = config?.labelKey ?? 'label';
      const valueKey = config?.valueKey ?? 'value';
      return value.map((item: any) => ({
        label: String(item[labelKey] ?? ''),
        value: Number(item[valueKey] ?? 0),
      }));
    }
    case 'paretoItems': {
      if (!Array.isArray(value)) return [];
      const labelKey = config?.labelKey ?? 'label';
      const valueKey = config?.valueKey ?? 'value';
      return value.map((item: any) => ({
        label: String(item[labelKey] ?? ''),
        value: Number(item[valueKey] ?? 0),
      }));
    }
    case 'barSeries': {
      if (!Array.isArray(value)) return [];
      // Expects array of { name: string, data: number[] } or similar
      return value.map((item: any) => ({
        name: String(item.name ?? 'Series'),
        data: Array.isArray(item.data) ? item.data.map(Number) : [],
        color: item.color,
      }));
    }
    case 'tableRows': {
      if (!Array.isArray(value)) return [];
      return value; // Identity for table rows as they are already records
    }
    case 'spcPoints': {
      if (!Array.isArray(value)) return [];
      const labelKey = config?.labelKey ?? 'label';
      const valueKey = config?.valueKey ?? 'value';
      const signalKey = config?.signalKey ?? 'signal';
      return value.map((item: any) => ({
        label: String(item[labelKey] ?? ''),
        value: Number(item[valueKey] ?? 0),
        signal: Boolean(item[signalKey] ?? false),
        excluded: Boolean(item.excluded ?? false),
      }));
    }
    case 'spcLimits': {
      if (typeof value !== 'object' || value === null) return {};
      return {
        ucl: Number(value.ucl ?? value.UCL ?? 0),
        cl: Number(value.cl ?? value.CL ?? value.mean ?? 0),
        lcl: Number(value.lcl ?? value.LCL ?? 0),
      };
    }
    case 'identity':
    default:
      return value;
  }
}

/**
 * Maps a response payload to a partial widget props object based on a mapping configuration.
 * 
 * @param payload - The raw response from the query endpoint
 * @param mapping - Configuration mapping prop names to dot-paths or transforms
 * @returns A record of resolved widget props
 */
export function mapResponseToWidgetProps(
  payload: any,
  mapping: Record<string, MappingValue>
): Record<string, any> {
  const result: Record<string, any> = {};

  for (const [propKey, mappingValue] of Object.entries(mapping)) {
    let path: string;
    let transform: MappingTransform | undefined;
    let config: Record<string, any> | undefined;

    if (typeof mappingValue === 'string') {
      path = mappingValue;
    } else {
      path = mappingValue.path;
      transform = mappingValue.transform;
      config = mappingValue.config;
    }

    const rawValue = resolvePath(payload, path);
    const transformedValue = applyTransform(rawValue, transform, config);

    if (transformedValue !== undefined) {
      result[propKey] = transformedValue;
    }
  }

  return result;
}
