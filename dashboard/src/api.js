const PAT_KEY = 'opsmate.zeropsPat';
const PROJECT_ID_KEY = 'opsmate.projectId';
const PROJECT_NAME_KEY = 'opsmate.projectName';

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

/** Persist PAT in sessionStorage so cross-origin API calls still auth after cookie loss. */
export function setAuthPat(token) {
  try {
    if (token) sessionStorage.setItem(PAT_KEY, String(token));
    else sessionStorage.removeItem(PAT_KEY);
  } catch { /* private mode */ }
}

export function getAuthPat() {
  try {
    return sessionStorage.getItem(PAT_KEY) || '';
  } catch {
    return '';
  }
}

export function setAuthProject(projectId, projectName) {
  try {
    if (projectId) {
      sessionStorage.setItem(PROJECT_ID_KEY, String(projectId));
      if (projectName) sessionStorage.setItem(PROJECT_NAME_KEY, String(projectName));
      else sessionStorage.removeItem(PROJECT_NAME_KEY);
    } else {
      sessionStorage.removeItem(PROJECT_ID_KEY);
      sessionStorage.removeItem(PROJECT_NAME_KEY);
    }
  } catch { /* ignore */ }
}

export function getAuthProject() {
  try {
    return {
      projectId: sessionStorage.getItem(PROJECT_ID_KEY) || null,
      projectName: sessionStorage.getItem(PROJECT_NAME_KEY) || null,
    };
  } catch {
    return { projectId: null, projectName: null };
  }
}

export function clearAuth() {
  setAuthPat('');
  setAuthProject(null);
}

export async function apiFetch(path, options = {}) {
  await loadConfig();
  const base = getApiBase();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const pat = getAuthPat();
  if (pat && !headers.Authorization && !headers.authorization) {
    headers.Authorization = `Bearer ${pat}`;
  }

  const { projectId, projectName } = getAuthProject();
  if (projectId && !headers['X-OpsMate-Project-Id']) {
    headers['X-OpsMate-Project-Id'] = projectId;
    if (projectName) headers['X-OpsMate-Project-Name'] = projectName;
  }

  // Don't force Content-Type on body-less GETs if caller cleared it
  const { headers: _drop, ...rest } = options;
  const res = await fetch(`${base}${path}`, {
    credentials: 'include',
    ...rest,
    headers,
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
