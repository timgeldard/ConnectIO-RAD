import { useEffect, useRef, useState } from "react";

/**
 * Geocodes free-text place names to lat/lon via the public OpenStreetMap
 * Nominatim service.
 *
 * Behaviour:
 *   - Results (and explicit failures) are cached in localStorage forever —
 *     city/country pairs are stable, so we only ever pay the network cost once
 *     per unique place per browser.
 *   - Requests are issued sequentially with a 1.1s gap to respect Nominatim's
 *     1 req/s usage policy (https://operations.osmfoundation.org/policies/nominatim/).
 *   - Cancellable: if the input list changes mid-flight the in-progress queue
 *     is abandoned without surfacing partial state.
 */

const CACHE_KEY = "trace2:nominatim:cache:v1";
const REQUEST_GAP_MS = 1100;

export interface LngLat {
  lat: number;
  lon: number;
}

export interface GeocodeQuery {
  /** Stable key for de-duplication and caching, e.g. `"Chicago, IL|US"`. */
  key: string;
  /** Free-text place to search, e.g. `"Chicago, IL"`. */
  destination: string;
  /** ISO-3166-1 alpha-2 country code used to bias the search (`"US"`). */
  country: string;
}

type CachedEntry = LngLat | null;

function readCache(): Record<string, CachedEntry> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, CachedEntry>) : {};
  } catch {
    return {};
  }
}

function writeCache(cache: Record<string, CachedEntry>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Quota or privacy modes — geocoding still works in-memory for the session.
  }
}

async function geocodeOne(q: GeocodeQuery, signal: AbortSignal): Promise<CachedEntry> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", q.destination);
  if (q.country) url.searchParams.set("countrycodes", q.country.toLowerCase());
  url.searchParams.set("limit", "1");

  try {
    const res = await fetch(url.toString(), {
      headers: { "Accept-Language": "en" },
      signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!Array.isArray(data) || data.length === 0) return null;
    const lat = parseFloat(data[0].lat);
    const lon = parseFloat(data[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
  } catch {
    return null;
  }
}

export interface UseGeocodeResult {
  /** Resolved coordinates keyed by query.key. Failed lookups are absent. */
  locations: Map<string, LngLat>;
  /** True while at least one query is still in flight or pending. */
  loading: boolean;
}

export function useGeocode(queries: GeocodeQuery[]): UseGeocodeResult {
  const [locations, setLocations] = useState<Map<string, LngLat>>(new Map());
  const [loading, setLoading] = useState<boolean>(false);
  const queryKey = queries.map((q) => q.key).sort().join("|");
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    const abort = new AbortController();

    const cache = readCache();
    const seeded = new Map<string, LngLat>();
    const todo: GeocodeQuery[] = [];

    for (const q of queries) {
      const cached = cache[q.key];
      if (cached) {
        seeded.set(q.key, cached);
      } else if (cached === null) {
        // Previously failed — don't retry this session.
      } else {
        todo.push(q);
      }
    }

    setLocations(seeded);
    setLoading(todo.length > 0);

    if (todo.length === 0) {
      return () => {
        cancelledRef.current = true;
        abort.abort();
      };
    }

    (async () => {
      for (let i = 0; i < todo.length; i++) {
        if (cancelledRef.current) return;
        const q = todo[i];
        const result = await geocodeOne(q, abort.signal);
        if (cancelledRef.current) return;

        cache[q.key] = result;
        writeCache(cache);

        if (result) {
          setLocations((prev) => {
            const next = new Map(prev);
            next.set(q.key, result);
            return next;
          });
        }

        if (i < todo.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, REQUEST_GAP_MS));
        }
      }
      if (!cancelledRef.current) setLoading(false);
    })();

    return () => {
      cancelledRef.current = true;
      abort.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey]);

  return { locations, loading };
}
