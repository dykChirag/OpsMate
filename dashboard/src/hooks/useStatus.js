import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api.js';

/**
 * Polls GET /status every `intervalMs` ms.
 * Returns { data, loading, error, refresh }
 */
export function useStatus(intervalMs = 5000) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const fetch_ = useCallback(async () => {
    try {
      const res = await apiFetch('/status');
      setData(res);
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

  return { data, loading, error, refresh: fetch_ };
}
