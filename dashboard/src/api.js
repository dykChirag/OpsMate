let runtimeConfig = null;

export async function loadConfig() {
  if (runtimeConfig) return runtimeConfig;
  try {
    const r = await fetch('/config.json', { cache: 'no-store' });
    if (r.ok) {
      runtimeConfig = await r.json();
      return runtimeConfig;
    }
  } catch { /* local vite */ }
  runtimeConfig = {
    apiUrl:
      (typeof __API_URL__ !== 'undefined' && __API_URL__) || '',
    demoUrl:
      (typeof __DEMO_API_URL__ !== 'undefined' && __DEMO_API_URL__) ||
      'http://localhost:3001',
  };
  return runtimeConfig;
}

export function getApiBase() {
  return (runtimeConfig?.apiUrl || '').replace(/\/$/, '');
}

export function getDemoBase() {
  return (
    (runtimeConfig?.demoUrl || '').replace(/\/$/, '') ||
    'http://localhost:3001'
  );
}

export async function apiFetch(path, options = {}) {
  await loadConfig();
  const base = getApiBase();
  const res = await fetch(`${base}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(data.error || data.detail || `API ${path} → ${res.status}`);
  }
  return data;
}
