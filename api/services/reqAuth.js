'use strict';

/**
 * Resolve Zerops PAT + selected project from:
 * 1) Authorization: Bearer <pat>  (reliable cross-origin)
 * 2) Session cookie                (local same-origin)
 * 3) Env ZEROPS_*                  (optional headless)
 *
 * Cross-subdomain dashboard→api often cannot keep opsmate.sid cookies;
 * the SPA stores the PAT in sessionStorage and sends it each request.
 */

function getBearerToken(req) {
  const h = req.headers.authorization || req.headers.Authorization || '';
  const m = /^Bearer\s+(\S+)/i.exec(String(h));
  return m ? m[1].trim() : null;
}

function getHeader(req, name) {
  const key = name.toLowerCase();
  for (const [k, v] of Object.entries(req.headers || {})) {
    if (String(k).toLowerCase() === key && v != null && String(v).trim() !== '') {
      return String(Array.isArray(v) ? v[0] : v).trim();
    }
  }
  return null;
}

function getToken(req) {
  return (
    getBearerToken(req) ||
    req.session?.zeropsToken ||
    process.env.ZEROPS_API_TOKEN ||
    null
  );
}

/**
 * Project id only when a live token is present (except env defaults).
 */
function getSelectedProject(req) {
  const bearer = getBearerToken(req);
  const sessionToken = req.session?.zeropsToken;
  const hasClientPat = Boolean(bearer || sessionToken);

  const headerProject = getHeader(req, 'x-opsmate-project-id');
  if (hasClientPat && headerProject) return headerProject;

  if (sessionToken) {
    return req.session.zeropsProjectId ? String(req.session.zeropsProjectId) : null;
  }

  // Bearer-only client may still store project only on server session for this request
  if (bearer && req.session?.zeropsProjectId) {
    return String(req.session.zeropsProjectId);
  }

  if (!hasClientPat && process.env.ZEROPS_PROJECT_ID) {
    return process.env.ZEROPS_PROJECT_ID;
  }

  return null;
}

function getSelectedProjectName(req) {
  const n =
    getHeader(req, 'x-opsmate-project-name') ||
    req.session?.zeropsProjectName ||
    process.env.ZEROPS_PROJECT_NAME ||
    null;
  return n ? String(n) : null;
}

/**
 * After a credentialed request with Bearer, mirror into session so legacy
 * session-only code paths keep working for the remainder of this request.
 * Cookies may still not stick cross-origin — client must resend headers.
 */
function hydrateSessionFromRequest(req) {
  const bearer = getBearerToken(req);
  if (bearer) {
    if (!req.session) req.session = {};
    req.session.zeropsToken = bearer;
  }
  const pid = getHeader(req, 'x-opsmate-project-id');
  if (pid && (bearer || req.session?.zeropsToken)) {
    req.session.zeropsProjectId = pid;
    const pname = getHeader(req, 'x-opsmate-project-name');
    if (pname) req.session.zeropsProjectName = pname;
  }
}

module.exports = {
  getBearerToken,
  getToken,
  getSelectedProject,
  getSelectedProjectName,
  hydrateSessionFromRequest,
};
