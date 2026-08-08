'use strict';

const {
  getToken,
  getSelectedProject,
  getSelectedProjectName,
} = require('./reqAuth');

/**
 * Resolve which project scope the current request operates in.
 * - Bearer/session PAT + selected project → that project_id
 * - PAT, no project → sandbox
 * - No PAT → env project if any, else sandbox
 */
function getProjectScope(req) {
  const sessionToken = getToken(req);
  const sessionId = getSelectedProject(req);
  const sessionName = getSelectedProjectName(req);

  if (sessionToken) {
    if (sessionId && sessionId !== 'sandbox') {
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
