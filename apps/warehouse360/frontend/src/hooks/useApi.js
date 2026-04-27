import { useState, useEffect } from 'react';
import { usePlantSelection } from '../context/PlantContext.jsx';

const withPlantId = (path, plantId) => {
  if (!plantId || !path.startsWith('/api/') || path.startsWith('/api/plants')) return path;
  const url = new URL(path, window.location.origin);
  if (!url.searchParams.has('plant_id')) url.searchParams.set('plant_id', plantId);
  return `${url.pathname}${url.search}`;
};

/**
 * Fetches a backend API endpoint and returns reactive { data, loading, error }.
 * Auth is handled by the Databricks Apps proxy (x-forwarded-access-token injected
 * server-side), so no token handling is needed in the browser.
 *
 * @param {string} path - Relative API path, e.g. '/api/kpis'
 * @param {Array}  deps - Extra useEffect dependencies (re-fetch when these change)
 */
export function useApi(path, deps = []) {
  const { selectedPlantId } = usePlantSelection();
  const requestPath = withPlantId(path, selectedPlantId);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(requestPath)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
      })
      .then((json) => {
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestPath, ...deps]);

  return { data, loading, error };
}
