'use strict';

const axios = require('axios');

/**
 * Zerops public REST (PRG1).
 * Working shape (from official public API + zerops-go patterns):
 *   GET  /user/info
 *   GET  /client/{clientId}/project
 *   GET  /project/{projectId}/service-stack
 *   PUT  /service-stack/{id}/start
 *
 * Never log the bearer token.
 */
const ZEROPS_API_BASE = (
  process.env.ZEROPS_API_BASE ||
  'https://api.app-prg1.zerops.io/api/rest/public'
).replace(/\/$/, '');

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

async function zeropsGet(token, path) {
  const url = path.startsWith('http') ? path : `${ZEROPS_API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  try {
    const r = await axios.get(url, {
      headers: authHeaders(token),
      timeout: 15_000,
      validateStatus: () => true,
    });
    if (r.status === 401 || r.status === 403) {
      return { ok: false, status: r.status, authFailed: true, url };
    }
    if (r.status < 200 || r.status >= 300) {
      return { ok: false, status: r.status, url, body: r.data };
    }
    return { ok: true, status: r.status, data: r.data, url };
  } catch (err) {
    return { ok: false, status: 0, error: err.message, url };
  }
}

async function zeropsWrite(token, method, path, body) {
  const url = path.startsWith('http') ? path : `${ZEROPS_API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  try {
    const r = await axios({
      method,
      url,
      headers: authHeaders(token),
      data: body ?? {},
      timeout: 20_000,
      validateStatus: () => true,
    });
    if (r.status >= 200 && r.status < 300) {
      return { ok: true, status: r.status, data: r.data, url };
    }
    return { ok: false, status: r.status, body: r.data, url };
  } catch (err) {
    return { ok: false, status: 0, error: err.message, url };
  }
}

/** Flatten common Zerops list envelopes */
function pickList(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  // Some responses wrap again
  const root = data.data !== undefined ? data.data : data;
  if (Array.isArray(root)) return root;
  if (Array.isArray(root?.list)) return root.list;
  if (Array.isArray(root?.items)) return root.items;
  if (Array.isArray(root?.projects)) return root.projects;
  if (Array.isArray(root?.serviceStacks)) return root.serviceStacks;
  if (Array.isArray(root?.serviceStackList)) return root.serviceStackList;
  if (Array.isArray(data.list)) return data.list;
  if (Array.isArray(data.items)) return data.items;
  return [];
}

function extractUser(data) {
  const d = data?.data ?? data ?? {};
  const email = d.email || d.Email || '';
  const fullName = d.fullName || d.FullName || d.firstName || '';
  return {
    email: email || 'connected',
    fullName: fullName || email || 'Zerops user',
    id: d.id || d.userId || null,
  };
}

/** client ids from /user/info */
function extractClientIds(data) {
  const d = data?.data ?? data ?? {};
  const clientList = d.clientUserList || d.ClientUserList || d.clients || [];
  const ids = [];
  for (const cu of Array.isArray(clientList) ? clientList : []) {
    const id =
      cu.clientId ||
      cu.ClientId ||
      cu.client?.id ||
      cu.client?.Id ||
      (typeof cu.client === 'string' ? cu.client : null);
    if (id) ids.push(String(id));
  }
  // Some payloads put client on user root
  if (!ids.length && (d.clientId || d.client?.id)) {
    ids.push(String(d.clientId || d.client.id));
  }
  return [...new Set(ids)];
}

function mapService(s) {
  const typeInfo = s.serviceStackTypeInfo || s.serviceStackTypeId || {};
  const typeName =
    (typeof typeInfo === 'object' &&
      (typeInfo.name || typeInfo.serviceStackTypeName || typeInfo.id)) ||
    s.serviceStackTypeId ||
    s.base ||
    s.type ||
    'service';
  return {
    id: String(s.id || s.serviceStackId || s.name || ''),
    name: String(s.name || s.serviceName || s.hostname || 'unnamed'),
    status: String(s.status || s.serviceStatus || 'unknown'),
    type: String(typeName),
    isSystem: Boolean(s.isSystem),
    raw: s,
  };
}

function mapProject(p, services) {
  return {
    id: String(p.id || p.projectId || ''),
    name: String(p.name || p.projectName || 'unnamed'),
    description: p.description || null,
    status: String(p.status || 'unknown'),
    services: (services || []).map(mapService),
  };
}

/**
 * Validate PAT via /user/info (same path that returns email).
 */
async function validateToken(token) {
  const paths = ['/user/info', '/user'];
  let last = null;
  for (const p of paths) {
    const r = await zeropsGet(token, p);
    last = r;
    if (r.ok) {
      return {
        ok: true,
        user: extractUser(r.data),
        clientIds: extractClientIds(r.data),
        source: r.url,
      };
    }
    if (r.authFailed) {
      return { ok: false, error: { status: r.status, message: 'Invalid token' } };
    }
  }
  return { ok: false, error: last };
}

async function listProjectsForClient(token, clientId) {
  const paths = [
    `/client/${clientId}/project?limit=100`,
    `/client/${clientId}/project`,
  ];
  for (const p of paths) {
    const r = await zeropsGet(token, p);
    if (r.authFailed) return { authFailed: true, projects: [], detail: r };
    if (r.ok) {
      return { authFailed: false, projects: pickList(r.data), url: r.url };
    }
  }
  return { authFailed: false, projects: [] };
}

async function listServicesForProject(token, projectId) {
  const paths = [
    `/project/${projectId}/service-stack?limit=100`,
    `/project/${projectId}/service-stack`,
    `/service-stack?projectId=${projectId}`,
  ];
  for (const p of paths) {
    const r = await zeropsGet(token, p);
    if (r.authFailed) return { authFailed: true, services: [] };
    if (r.ok) return { authFailed: false, services: pickList(r.data), url: r.url };
  }
  return { authFailed: false, services: [] };
}

/**
 * Full project list for session PAT.
 * Uses client id(s) from /user/info → /client/{id}/project
 */
async function listProjects(token, clientIdsOpt = []) {
  let clientIds = [...(clientIdsOpt || [])];

  if (!clientIds.length) {
    const info = await validateToken(token);
    if (!info.ok) {
      return { ok: false, error: info.error, projects: [] };
    }
    clientIds = info.clientIds || [];
  }

  // Direct /project fallbacks if client list empty
  if (!clientIds.length) {
    for (const p of ['/project?limit=100', '/project']) {
      const r = await zeropsGet(token, p);
      if (r.ok) {
        const raw = pickList(r.data);
        const projects = [];
        for (const proj of raw) {
          const id = proj.id || proj.projectId;
          if (!id) continue;
          const svcs = await listServicesForProject(token, id);
          projects.push(mapProject(proj, svcs.services));
        }
        return {
          ok: true,
          projects,
          source: r.url,
          note: clientIds.length ? null : 'listed via /project fallback',
        };
      }
    }
    return {
      ok: false,
      projects: [],
      error: {
        message:
          'Token valid but no client/org found to list projects. Check token scopes.',
      },
    };
  }

  const projects = [];
  const debug = { clients: clientIds, errors: [] };

  for (const clientId of clientIds) {
    const { authFailed, projects: plist, url, detail } = await listProjectsForClient(
      token,
      clientId
    );
    if (authFailed) {
      return { ok: false, authFailed: true, projects: [], error: detail };
    }
    if (!plist.length) {
      debug.errors.push({ clientId, note: 'empty project list', url });
    }
    for (const p of plist) {
      const projectId = p.id || p.projectId;
      if (!projectId) continue;
      const svcs = await listServicesForProject(token, projectId);
      if (svcs.authFailed) {
        return { ok: false, authFailed: true, projects: [] };
      }
      projects.push(mapProject(p, svcs.services));
    }
  }

  // Deduplicate by id
  const byId = new Map();
  for (const p of projects) {
    if (p.id) byId.set(p.id, p);
  }
  const unique = [...byId.values()];

  return {
    ok: true,
    projects: unique,
    debug: process.env.NODE_ENV === 'development' ? debug : undefined,
    source: 'client/{id}/project',
  };
}

async function listProjectServices(token, projectId) {
  if (!projectId) return { ok: false, error: 'projectId required' };

  const r = await listServicesForProject(token, projectId);
  if (r.authFailed) return { ok: false, error: 'auth failed' };
  if (!r.services.length) {
    // Still ok — empty project
    return { ok: true, services: [], source: r.url };
  }
  return {
    ok: true,
    services: r.services.map(mapService),
    source: r.url,
  };
}

async function restartService(token, serviceStackId) {
  for (const path of [
    `/service-stack/${serviceStackId}/start`,
    `/service-stack/${serviceStackId}/restart`,
  ]) {
    for (const method of ['PUT', 'POST']) {
      const r = await zeropsWrite(token, method, path, {});
      if (r.ok) return r;
    }
  }
  return {
    ok: false,
    error: 'Could not restart service via REST — check service id & token scope',
  };
}

/**
 * Best-effort: some stack/version payloads embed last pipeline zerops/zerops yaml.
 * Usually unavailable — caller should fall back to inventory reconstruction.
 */
async function tryFetchProjectYaml(token, services = []) {
  const list = (Array.isArray(services) ? services : []).slice(0, 8);
  for (const s of list) {
    if (!s?.id || s.isSystem) continue;
    const paths = [
      `/service-stack/${s.id}`,
      `/service-stack/${s.id}/app-version?limit=5`,
      `/app-version?serviceStackId=${s.id}&limit=5`,
    ];
    for (const p of paths) {
      const r = await zeropsGet(token, p);
      if (!r.ok) continue;
      const found = deepFindYaml(r.data);
      if (found) {
        return { ok: true, yaml: found, serviceId: s.id, source: r.url };
      }
    }
  }
  return { ok: false, yaml: null };
}

function deepFindYaml(node, depth = 0) {
  if (depth > 8 || node == null) return null;
  if (typeof node === 'string') {
    const t = node.trim();
    if (t.length > 40 && /^\s*zerops\s*:/m.test(t) && /setup\s*:/m.test(t)) return t;
    return null;
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      const f = deepFindYaml(item, depth + 1);
      if (f) return f;
    }
    return null;
  }
  if (typeof node === 'object') {
    const prefer = [
      'zeropsYaml',
      'zerops_yaml',
      'yaml',
      'zeropsYAML',
      'configYaml',
      'pipelineYaml',
    ];
    for (const k of prefer) {
      if (node[k]) {
        const f = deepFindYaml(node[k], depth + 1);
        if (f) return f;
      }
    }
    for (const v of Object.values(node)) {
      const f = deepFindYaml(v, depth + 1);
      if (f) return f;
    }
  }
  return null;
}

module.exports = {
  validateToken,
  listProjects,
  listProjectServices,
  restartService,
  tryFetchProjectYaml,
  ZEROPS_API_BASE,
};
