'use strict';

/**
 * Resolve which project scope the current request operates in.
 * - Session PAT + selected project → that project_id (never fall through to env project)
 * - Session PAT, no project → sandbox
 * - No session → env project if any, else sandbox
 */
function getProjectScope(req) {
  const sessionToken = req.session?.zeropsToken || null;
  const sessionId = req.session?.zeropsProjectId || null;
  const sessionName = req.session?.zeropsProjectName || null;

  if (sessionToken) {
    if (sessionId) {
      return {
        projectId: String(sessionId),
        projectName: sessionName ? String(sessionName) : null,
        mode: 'live',
      };
    }
    return {
      projectId: 'sandbox',
      projectName: 'Local sandbox',
      mode: 'connected-no-project',
    };
  }

  const envId = process.env.ZEROPS_PROJECT_ID || null;
  if (envId) {
    return {
      projectId: String(envId),
      projectName: process.env.ZEROPS_PROJECT_NAME || null,
      mode: 'live',
    };
  }

  return {
    projectId: 'sandbox',
    projectName: 'Local sandbox',
    mode: 'sandbox',
  };
}

function projectFilter(alias = '') {
  const col = alias ? `${alias}.project_id` : 'project_id';
  return `${col} IS NOT DISTINCT FROM $PROJECT`;
}

module.exports = { getProjectScope, projectFilter, SANDBOX_PROJECT_ID: 'sandbox' };
