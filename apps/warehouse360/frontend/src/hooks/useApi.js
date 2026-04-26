import { useState, useEffect } from 'react';

/**
 * Fetches a backend API endpoint and returns reactive { data, loading, error }.
 * Auth is handled by the Databricks Apps proxy (x-forwarded-access-token injected
 * server-side), so no token handling is needed in the browser.
 *
 * @param {string} path - Relative API path, e.g. '/api/kpis'
 * @param {Array}  deps - Extra useEffect dependencies (re-fetch when these change)
 */
export function useApi(path, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(path)
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
  }, [path, ...deps]);

  return { data, loading, error };
}
