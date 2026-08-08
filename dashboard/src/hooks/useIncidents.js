import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api.js';

/**
 * Polls GET /incidents every `intervalMs` ms.
 * Returns { incidents, loading, error, refresh }
 */
export function useIncidents(intervalMs = 4000) {
  const [incidents, setIncidents] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  const fetch_ = useCallback(async () => {
    try {
      const res = await apiFetch('/incidents?limit=50');
      setIncidents(res.incidents ?? []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch_();
    const id = setInterval(fetch_, intervalMs);
    return () => clearInterval(id);
  }, [fetch_, intervalMs]);

  return { incidents, loading, error, refresh: fetch_ };
}
