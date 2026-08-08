'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Architecture review for:
 *  1. Repo zerops.yaml  (zerops: - setup: …)
 *  2. Project import/export YAML  (project: … services: - hostname: …)
 *  3. Honest live-inventory reconstruction as #2 (import-shaped), not fake npm pipelines
 */

function detectYamlKind(text) {
  const t = String(text || '');
  if (/^\s*zerops\s*:/m.test(t) && /setup\s*:/m.test(t)) return 'pipeline'; // zerops.yaml
  if (/services\s*:/m.test(t) && /hostname\s*:/m.test(t)) return 'import';
  if (/^\s*project\s*:/m.test(t)) return 'import';
  return 'unknown';
}

function reviewArchitectureYaml(yamlText) {
  const kind = detectYamlKind(yamlText);
  if (kind === 'import') return reviewImportYaml(yamlText);
  if (kind === 'pipeline') return reviewZeropsYaml(yamlText);
  // Try both parsers
  const asImport = reviewImportYaml(yamlText);
  if ((asImport.services || []).length) return asImport;
  return reviewZeropsYaml(yamlText);
}

/**
 * Deterministic zerops.yaml (pipeline) architecture review.
 */
function reviewZeropsYaml(yamlText) {
  const findings = [];
  let doc = null;
  const text = String(yamlText || '');

  try {
    doc = parseLooseYamlSetupBlocks(text);
  } catch (err) {
    return {
      score: 15,
      kind: 'pipeline',
      summary: 'Could not parse zerops.yaml.',
      findings: [
        {
          level: 'critical',
          title: 'Invalid / unreadable YAML',
          detail: err.message,
          fix: 'Fix YAML syntax, keep a top-level zerops: list of setup blocks.',
        },
      ],
      setupCount: 0,
      services: [],
      counts: { critical: 1, warn: 0, info: 0 },
      setups: [],
    };
  }

  const setups = doc;
  if (!setups.length) {
    findings.push({
      level: 'critical',
      title: 'No services defined',
      detail: 'Expected a zerops: list of setup blocks (api, dashboard, demo, …).',
      fix: 'Add at least one `- setup: hostname` block matching a Zerops service.',
    });
  }

  const names = setups.map((s) => s.name);
  pushSharedShapeFindings(findings, names, text);

  for (const s of setups) {
    const name = s.name || 'unnamed';
    const block = s.raw || '';
    const isDashOnly =
      /dash|web|front|ui|static/i.test(name) && !/api|demo|worker|ingest/i.test(name);

    if (
      /port:\s*\d+/i.test(block) &&
      !/httpSupport:\s*true/i.test(block) &&
      /dash|web|front|ui|api|demo|app/i.test(name)
    ) {
      findings.push({
        level: 'warn',
        title: `${name}: missing httpSupport`,
        detail: 'Public services need at least one port with httpSupport: true for Zerops L7 + SSL.',
        fix: `Under run.ports for ${name}, set httpSupport: true on the browser-facing port.`,
      });
    }

    if (
      /nodejs|python|go|bun|deno|rust|java|php/i.test(block) &&
      !/ZEROPS_PROMETHEUS_PORT/i.test(block) &&
      !isManagedHostname(name) &&
      !isManagedType(block)
    ) {
      findings.push({
        level: isDashOnly ? 'info' : 'warn',
        title: `${name}: no ZEROPS_PROMETHEUS_PORT`,
        detail: isDashOnly
          ? 'Frontend UIs often skip custom metrics; add only if you expose /metrics.'
          : 'Expose /metrics and set ZEROPS_PROMETHEUS_PORT so Zerops can scrape custom metrics.',
        fix: isDashOnly
          ? 'Optional — leave as-is unless the UI emits Prometheus metrics.'
          : `In ${name}.run.envVariables add ZEROPS_PROMETHEUS_PORT: "9090", open that port, serve /metrics.`,
      });
    }

    if (
      !isManagedHostname(name) &&
      !isManagedType(block) &&
      !/start:\s*\S+/i.test(block) &&
      !/startCommands/i.test(block) &&
      !/static@/i.test(block)
    ) {
      findings.push({
        level: 'warn',
        title: `${name}: missing start command`,
        detail: 'run.start (or startCommands) is required for runtime services in zerops.yaml.',
        fix: `Set run.start under setup ${name}.`,
      });
    }

    if (/demo/i.test(name) && !/API_INGEST_URL/i.test(block)) {
      findings.push({
        level: 'info',
        title: `${name}: no API_INGEST_URL`,
        detail: 'Patient/demo services should push logs to OpsMate api for live diagnosis.',
        fix: 'Set API_INGEST_URL: http://api:8080/ingest on the demo service.',
      });
    }
  }

  return finalizeReview({
    findings,
    names,
    kind: 'pipeline',
    setups: setups.map((s) => ({
      name: s.name,
      type: 'pipeline-setup',
      hasHttp: /httpSupport:\s*true/i.test(s.raw || ''),
      hasMetrics: /ZEROPS_PROMETHEUS_PORT/i.test(s.raw || ''),
      hasStart: /start:\s*\S+/i.test(s.raw || '') || /startCommands/i.test(s.raw || ''),
      managed: isManagedHostname(s.name),
    })),
  });
}

/**
 * Review Zerops *import/export* YAML (project + services hostnames).
 */
function reviewImportYaml(yamlText) {
  const findings = [];
  const text = String(yamlText || '');
  const services = parseImportServices(text);
  const names = services.map((s) => s.hostname);

  if (!services.length) {
    findings.push({
      level: 'critical',
      title: 'No services in import YAML',
      detail: 'Expected project: + services: with hostname entries (GUI export format).',
      fix: 'In Zerops GUI: project ⋮ → Export project as yaml, then paste here.',
    });
  }

  findings.push({
    level: 'info',
    title: 'Import / project export format',
    detail:
      'This is Zerops project import YAML (not repo zerops.yaml). REST cannot fetch the GUI export — paste updates source of truth.',
    fix: 'Keep a copy of GUI export in git for exact rebuilds; use zerops.yaml in app repos for pipelines.',
  });

  pushSharedShapeFindings(findings, names, text);

  for (const s of services) {
    const name = s.hostname;
    const type = s.type || '';
    const block = s.raw || '';
    const managed = isManagedType(type) || isManagedHostname(name);

    if (!type || /unknown|service$/i.test(type)) {
      findings.push({
        level: 'warn',
        title: `${name}: missing or vague type`,
        detail: 'Import YAML should set type (e.g. alpine/bun@1.2.2, postgresql:single@17).',
        fix: 'Use full type string from Zerops docs or GUI export.',
      });
    }

    if (managed) {
      if (/npm |nodejs@|start: npm/i.test(block)) {
        findings.push({
          level: 'warn',
          title: `${name}: managed service looks like an app runtime`,
          detail: `${name} appears managed (${type}) but the YAML contains app/npm fields that do not apply.`,
          fix: 'Keep only managed fields (type, mode/profile, size). Runtime build/start belongs in app zerops.yaml.',
        });
      }
      continue;
    }

    // Runtime / user code services
    if (!/buildFromGit|zeropsYaml|buildFromGit:/i.test(block) && !/RECONSTRUCTED/i.test(text)) {
      findings.push({
        level: 'info',
        title: `${name}: no buildFromGit in this document`,
        detail:
          'Live/exported runtimes often pin a git repo. If this is a reconstructed sketch, paste the GUI export.',
        fix: 'Add buildFromGit or deploy via zcli / Git-connected service.',
      });
    }

    if (/app|web|front|dash|api/i.test(name) && !/enableSubdomainAccess:\s*true/i.test(block)) {
      findings.push({
        level: 'info',
        title: `${name}: public subdomain not set in YAML`,
        detail: 'Public HTTP apps usually set enableSubdomainAccess: true on import.',
        fix: `Add enableSubdomainAccess: true under ${name} if it should be reachable on *.zerops.app.`,
      });
    }

    if (/worker|queue-consumer|cron/i.test(name) && /enableSubdomainAccess:\s*true/i.test(block)) {
      findings.push({
        level: 'info',
        title: `${name}: worker with public subdomain`,
        detail: 'Background workers rarely need public HTTP access.',
        fix: 'Disable subdomain access unless the worker intentionally serves HTTP.',
      });
    }
  }

  const reconstructed = /RECONSTRUCTED|from live inventory/i.test(text);
  if (reconstructed) {
    findings.push({
      level: 'warn',
      title: 'Reconstructed from live inventory — incomplete',
      detail:
        'buildFromGit, envSecrets, profiles, and autoscaling are not returned by Zerops public REST. This file is honest but lossy.',
      fix: 'Paste GUI Export project as yaml for judge-accurate architecture review.',
    });
  }

  return finalizeReview({
    findings,
    names,
    kind: 'import',
    setups: services.map((s) => ({
      name: s.hostname,
      type: s.type || 'unknown',
      hasHttp: /enableSubdomainAccess:\s*true/i.test(s.raw || ''),
      hasMetrics: false,
      hasStart: !isManagedType(s.type),
      managed: isManagedType(s.type) || isManagedHostname(s.hostname),
      status: (s.raw.match(/liveStatus:\s*(\S+)/) || [])[1] || null,
    })),
  });
}

function pushSharedShapeFindings(findings, names, text) {
  const hasApi = names.some((n) => /api|backend|server|app/i.test(n));
  const hasFe = names.some((n) => /dash|web|front|ui|static/i.test(n));
  const hasDemo = names.some((n) => /demo|patient/i.test(n));
  const hasDb = names.some((n) => /^(db|postgres)$/i.test(n)) || /postgresql|mysql/i.test(text);
  const hyphen = names.filter((n) => String(n).includes('-'));

  if (hyphen.length) {
    findings.push({
      level: 'critical',
      title: 'Hyphen in service hostname',
      detail: `Zerops hostnames cannot contain "-". Offenders: ${hyphen.join(', ')}.`,
      fix: 'Rename to alphanumeric hostnames (demo not demo-api).',
    });
  }

  if (hasApi && !hasFe && !names.some((n) => /^app$/i.test(n))) {
    findings.push({
      level: 'info',
      title: 'API-style stack without a clear UI service',
      detail: 'Optional public dashboard/static helps operators and demos.',
      fix: 'Add a frontend service with enableSubdomainAccess if you want a GUI.',
    });
  }

  if (hasDemo && !hasApi) {
    findings.push({
      level: 'warn',
      title: 'Demo patient without api brain',
      detail: 'Patient apps need an ingest target (OpsMate api).',
      fix: 'Add api and set API_INGEST_URL=http://api:8080/ingest.',
    });
  }

  if (hasApi && !hasDb) {
    findings.push({
      level: 'info',
      title: 'No database service spotted',
      detail: 'If the app needs persistence, add managed Postgres (or confirm external DB).',
      fix: 'Import postgresql service (hostname db) and link env into the runtime.',
    });
  }

  if (names.length >= 3) {
    findings.push({
      level: 'info',
      title: 'Multi-service project',
      detail: `${names.length} services — strong fit for Zerops private networking.`,
      fix: 'Use private hostnames between services; avoid public URLs for backend-to-backend.',
    });
  }
}

function finalizeReview({ findings, names, kind, setups }) {
  let score = 100;
  for (const f of findings) {
    if (f.level === 'critical') score -= 25;
    else if (f.level === 'warn') score -= 12;
    else score -= 4;
  }
  score = Math.max(5, Math.min(100, score));

  const critical = findings.filter((f) => f.level === 'critical').length;
  const warns = findings.filter((f) => f.level === 'warn').length;
  const infos = findings.filter((f) => f.level === 'info').length;

  const kindLabel = kind === 'import' ? 'import/export YAML' : 'zerops.yaml pipeline';
  const summary = findings.length
    ? `${kindLabel} score ${score}/100 · ${critical} critical, ${warns} warn, ${infos} info.`
    : `${kindLabel} score ${score}/100 — solid structure.`;

  return {
    score,
    kind,
    findings,
    summary,
    serviceCount: names.length,
    services: names,
    counts: { critical, warn: warns, info: infos },
    setups,
  };
}

function parseLooseYamlSetupBlocks(text) {
  const setups = [];
  let current = null;
  let collecting = false;

  for (const line of String(text || '').split(/\r?\n/)) {
    const m = line.match(/^\s*-\s*setup:\s*([a-zA-Z0-9_-]+)\s*$/);
    if (m) {
      if (current) setups.push(current);
      current = { name: m[1], raw: line + '\n' };
      collecting = true;
      continue;
    }
    if (collecting && current) current.raw += line + '\n';
  }
  if (current) setups.push(current);

  if (!setups.length) {
    const re = /setup:\s*([a-zA-Z0-9_-]+)/g;
    let match;
    while ((match = re.exec(text || ''))) {
      setups.push({ name: match[1], raw: text });
    }
  }
  return setups;
}

/** Parse import YAML service entries (hostname + type best-effort). */
function parseImportServices(text) {
  const lines = String(text || '').split(/\r?\n/);
  const services = [];
  let current = null;
  let inServices = false;

  for (const line of lines) {
    if (/^\s*services\s*:/.test(line)) {
      inServices = true;
      continue;
    }
    if (inServices && /^\S/.test(line) && !/^\s*#/.test(line) && /:\s*$/.test(line) && !/^\s*-/.test(line)) {
      // left top-level key after services block
      if (!/^\s/.test(line)) {
        inServices = false;
      }
    }

    const host = line.match(/^\s*-\s*hostname:\s*([a-zA-Z0-9_-]+)\s*$/);
    if (host) {
      if (current) services.push(current);
      current = { hostname: host[1], type: null, raw: line + '\n' };
      continue;
    }
    if (current) {
      current.raw += line + '\n';
      const t = line.match(/^\s*type:\s*(.+?)\s*$/);
      if (t) current.type = t[1].replace(/^["']|["']$/g, '');
      // stop collection on next service-ish sibling handled by host match
      if (/^\s*-\s*hostname:/.test(line) === false && /^\s*-\s+\w+:/.test(line) && !/^\s{2,}/.test(line)) {
        /* keep */
      }
    }
  }
  if (current) services.push(current);
  return services;
}

function isManagedHostname(name) {
  return /^(db|postgres|mysql|redis|valkey|mongo|queue|nats|storage|objectstorage|meili|elastic|rabbit)$/i.test(
    String(name || '')
  );
}

function isManagedType(typeStr) {
  const t = String(typeStr || '');
  return /postgresql|mysql|mariadb|mongodb|mongo|redis|valkey|nats|kafka|pulsar|rabbit|amqp|elastic|keydb|object.?storage|ceph|meilisearch|minio|broker/i.test(
    t
  );
}

function isManagedService(s) {
  return isManagedType(s.type) || isManagedHostname(s.name);
}

/** Map live inventory type label → import-style type string (best-effort). */
function mapLiveTypeToImport(s) {
  const t = String(s.type || '').toLowerCase();
  const name = String(s.name || '').toLowerCase();
  const raw = s.raw || {};
  const catalog =
    raw.serviceStackTypeInfo?.name ||
    raw.serviceStackTypeInfo?.serviceStackTypeName ||
    raw.serviceStackTypeId ||
    '';

  const blob = `${t} ${catalog} ${name}`;

  if (/object.?storage|storage/i.test(blob) && /storage|object/i.test(name)) {
    return { type: 'object-storage', managed: true };
  }
  if (/valkey|redis/i.test(blob)) return { type: 'valkey:single@7.2', managed: true };
  if (/postgresql|postgres/i.test(blob) || name === 'db') {
    return { type: 'postgresql:single@17', managed: true };
  }
  if (/nats|queue/i.test(blob) || name === 'queue') return { type: 'nats:single@2.12', managed: true };
  if (/mysql|mariadb/i.test(blob)) return { type: 'mariadb:single@11', managed: true };
  if (/mongo/i.test(blob)) return { type: 'mongodb:single@7', managed: true };

  if (/python/i.test(blob)) return { type: 'alpine/python@3.12', managed: false };
  if (/bun/i.test(blob)) return { type: 'alpine/bun@1.2.2', managed: false };
  if (/node/i.test(blob)) return { type: 'nodejs@22', managed: false };
  if (/go|golang/i.test(blob)) return { type: 'go@1.22', managed: false };
  if (/php/i.test(blob)) return { type: 'php-nginx@8.3', managed: false };
  if (/static|nginx/i.test(blob) && !/object/i.test(blob)) return { type: 'static@latest', managed: false };
  if (/rust/i.test(blob)) return { type: 'rust@1', managed: false };
  if (/java/i.test(blob)) return { type: 'java@21', managed: false };

  // Heuristic by hostname when type string is generic "runtime"
  if (name === 'worker') return { type: 'alpine/python@3.12', managed: false };
  if (name === 'app') return { type: 'alpine/bun@1.2.2', managed: false };

  return { type: t || 'unknown', managed: isManagedHostname(name) };
}

/**
 * Build honest *import-shaped* YAML from live inventory.
 * Does NOT invent npm pipelines, buildFromGit, or env secrets (unknown via REST).
 */
function generateYamlFromInventory(services = [], projectName = null) {
  const user = (Array.isArray(services) ? services : []).filter(
    (s) => !s.isSystem && String(s.name || '').toLowerCase() !== 'core'
  );

  const lines = [
    `# RECONSTRUCTED from live Zerops inventory · ${new Date().toISOString()}`,
    `# Project: ${projectName || 'selected'}`,
    '#',
    '# Public REST does NOT return GUI "Export project as yaml".',
    '# This file is import-shaped (project + services) with fields we can observe:',
    '# hostname, coarse type, live status. Missing: buildFromGit, envSecrets, profiles, autoscaling.',
    '# For judge demos: paste GUI Export (project ⋮ → Export project as yaml).',
    '#',
    'project:',
    `  name: ${yamlQuote(projectName || 'selected')}`,
    'services:',
  ];

  if (!user.length) {
    lines.push('  # No user services found in inventory');
    return `${lines.join('\n')}\n`;
  }

  for (const s of user) {
    const mapped = mapLiveTypeToImport(s);
    lines.push(`  - hostname: ${s.name}`);
    lines.push(`    type: ${mapped.type}`);
    lines.push(`    # liveStatus: ${s.status || 'unknown'}`);
    if (mapped.managed) {
      lines.push('    # managed service — no app build/start in import YAML');
    } else {
      lines.push('    # runtime — add buildFromGit / enableSubdomainAccess via GUI export when known');
      if (/app|web|front|dash|api|demo/i.test(s.name)) {
        lines.push('    # enableSubdomainAccess: true   # uncomment if public HTTP');
      }
    }
    lines.push('');
  }

  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n')}\n`;
}

function yamlQuote(s) {
  const v = String(s || '');
  if (/[:#"'\n]/.test(v) || /\s/.test(v)) return JSON.stringify(v);
  return v;
}

function looksLikeOpsmate(services = []) {
  const n = new Set(services.map((s) => String(s.name || '').toLowerCase()));
  return n.has('api') && n.has('dashboard') && (n.has('demo') || n.has('db'));
}

function loadLocalOpsmateYaml() {
  const candidates = [
    path.join(__dirname, '..', '..', 'zerops.yaml'),
    path.join(__dirname, '..', '..', '..', 'zerops.yaml'),
    path.join(process.cwd(), 'zerops.yaml'),
    path.join(process.cwd(), '..', 'zerops.yaml'),
  ];
  for (const file of candidates) {
    try {
      if (!fs.existsSync(file)) continue;
      const yaml = fs.readFileSync(file, 'utf8');
      if (!/^\s*zerops\s*:/m.test(yaml)) continue;
      return { yaml, source: 'local-repo', path: file };
    } catch {
      /* next */
    }
  }
  return null;
}

/**
 * Resolve best YAML for Architecture editor.
 * Priority: remote API → local OpsMate pipeline yaml (only for OpsMate fleet) → import reconstruct.
 */
function resolveProjectYaml({
  services = [],
  projectName = null,
  remoteYaml = null,
} = {}) {
  if (remoteYaml && String(remoteYaml).trim()) {
    return {
      yaml: `${String(remoteYaml).trim()}\n`,
      source: 'zerops-api',
      note: 'Fetched from Zerops API',
      kind: detectYamlKind(remoteYaml),
    };
  }

  if (looksLikeOpsmate(services)) {
    const local = loadLocalOpsmateYaml();
    if (local) {
      const body = local.yaml.replace(/^\uFEFF/, '');
      const yaml = body.startsWith('#')
        ? body
        : `# Project: ${projectName || 'OpsMate'}\n# Source: local zerops.yaml pipeline for this stack\n\n${body}`;
      return {
        yaml: yaml.endsWith('\n') ? yaml : `${yaml}\n`,
        source: 'local-repo',
        note: `Repo zerops.yaml for ${projectName || 'OpsMate'} (pipeline format)`,
        path: local.path,
        kind: 'pipeline',
      };
    }
  }

  const yaml = generateYamlFromInventory(services, projectName);
  return {
    yaml,
    source: 'live-inventory',
    note:
      'Import-shaped reconstruction from live inventory — incomplete. Paste GUI Export for full fidelity.',
    kind: 'import',
  };
}

module.exports = {
  reviewZeropsYaml,
  reviewImportYaml,
  reviewArchitectureYaml,
  resolveProjectYaml,
  generateYamlFromInventory,
  detectYamlKind,
  looksLikeOpsmate,
  parseImportServices,
  isManagedService,
  isManagedHostname,
  isManagedType,
};
