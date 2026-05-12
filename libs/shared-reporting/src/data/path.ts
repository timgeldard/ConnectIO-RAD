/**
 * Safely resolves a dot-path (e.g. "lines.0.avg_oee_pct") against a payload.
 * Supports array indexes and nested objects. Returns undefined if the path is invalid.
 * 
 * This implementation is deliberately restrictive: no eval, no expressions.
 * 
 * @param payload - The source object to query
 * @param path - Dot-separated path string
 * @returns The resolved value, or undefined if not found
 */
export function resolvePath(payload: any, path: string): any {
  if (!payload || !path) return undefined;

  const parts = path.split('.');
  let current = payload;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;

    // Handle array indexes if the part is numeric
    if (/^\d+$/.test(part)) {
      if (Array.isArray(current)) {
        current = current[Number(part)];
      } else {
        return undefined;
      }
    } else {
      current = current[part];
    }
  }

  return current;
}
