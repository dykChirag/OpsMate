'use strict';

require('dotenv').config();

const express        = require('express');
const cors           = require('cors');
const session        = require('express-session');
const db             = require('./db');
const logBuffer      = require('./services/logBuffer');
const metricPoller   = require('./services/metricPoller');
const syslogListener = require('./services/syslogListener');
const { diagnose }   = require('./services/diagnosisEngine');

// ─── Routes ──────────────────────────────────────────────────────────────────
const ingestRoute    = require('./routes/ingest');
const incidentsRoute = require('./routes/incidents');
const statusRoute    = require('./routes/status');
const chatRoute      = require('./routes/chat');
const zeropsRoute    = require('./routes/zerops');
const sandboxRoute   = require('./routes/sandbox');

const PORT = parseInt(process.env.PORT || '8080', 10);

// ─── App setup ────────────────────────────────────────────────────────────────
const app = express();

app.use(cors({
  origin:      true,     // reflect the request origin — tighten in prod if needed
  credentials: true,
}));

// Parse both JSON and plain-text bodies (for raw syslog-like POSTs)
app.use(express.json());
app.use(express.text({ type: 'text/plain' }));

app.set('trust proxy', 1);

// Session — memory store; Zerops PAT never written to disk or Postgres
app.use(session({
  secret:            process.env.SESSION_SECRET || 'opsmate-dev-secret-change-me',
  resave:            false,
  saveUninitialized: false,
  name:              'opsmate.sid',
  cookie: {
    httpOnly: true,
    // sameSite none needed when dashboard & api are different public hosts on HTTPS
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure:   process.env.NODE_ENV === 'production',
    maxAge:   8 * 60 * 60 * 1000,
  },
}));

// ─── Request logging middleware ───────────────────────────────────────────────
app.use((req, _res, next) => {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    service:   'api',
    level:     'info',
    message:   `${req.method} ${req.path}`,
    ip:        req.ip,
  }));
  next();
});

// ─── Mount routes ─────────────────────────────────────────────────────────────
app.use('/ingest',    ingestRoute);
app.use('/incidents', incidentsRoute);
app.use('/status',    statusRoute);
app.use('/chat',      chatRoute);
app.use('/zerops',    zeropsRoute);    // POST /zerops/connect, GET /zerops/projects, etc.
app.use('/sandbox',   sandboxRoute);   // POST /sandbox/chaos (local demo only)

// ─── Health probe ─────────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({
    service: 'opsmate-api',
    status:  'ok',
    version: '2.0.0',
    ts:      new Date().toISOString(),
  });
});

// ─── Global error handler ─────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(), service: 'api', level: 'error',
    message: 'Unhandled error', error: err.message,
  }));
  res.status(500).json({ ok: false, error: 'Internal server error' });
});

// ─── Bootstrap ───────────────────────────────────────────────────────────────
async function start() {
  // 1. Run DB migrations
  try {
    await db.runMigrations();
  } catch (err) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(), service: 'api', level: 'error',
      message: 'Database migration failed — check DATABASE_URL', error: err.message,
    }));
    process.exit(1);
  }

  // 2. Start syslog listener (non-fatal if it fails)
  syslogListener.start((entry) => {
    // Syslog entries flow into the buffer (already done inside syslogListener)
    // Trigger diagnosis for error-level syslog lines
    if (['error', 'critical', 'emergency', 'alert'].includes(entry.level)) {
      setImmediate(async () => {
        try {
          await diagnose({
            serviceName: entry.service || 'unknown',
            logLines:    logBuffer.recent(30, { service: entry.service }),
            metrics:     metricPoller.getLatest(),
            triggerLog:  { ...entry, source: 'syslog' },
            source:      'syslog',
          });
        } catch (e) {
          console.error(JSON.stringify({
            timestamp: new Date().toISOString(), service: 'api', level: 'error',
            message: 'Syslog-triggered diagnosis failed', error: e.message,
          }));
        }
      });
    }
  });

  // 3. Start metric poller
  metricPoller.start(async ({ anomaly, snapshot }) => {
    // Metric anomaly → create an incident from metrics context
    const demoName = process.env.DEMO_SERVICE_NAME || 'demo';
    const syntheticLog = {
      timestamp: new Date().toISOString(),
      service:   demoName,
      level:     'warn',
      message:   anomaly.message,
      type:      anomaly.type,
      kind:      anomaly.kind || anomaly.type,
      value:     anomaly.value,
      source:    'metric',
    };
    logBuffer.push(syntheticLog);
    try {
      await diagnose({
        serviceName: demoName,
        logLines:    logBuffer.recent(30, { service: demoName }),
        metrics:     snapshot,
        triggerLog:  syntheticLog,
        source:      'metric',
      });
    } catch (e) {
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(), service: 'api', level: 'error',
        message: 'Metric anomaly diagnosis failed', error: e.message,
      }));
    }
  });

  // 4. Start HTTP server
  app.listen(PORT, '0.0.0.0', () => {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(), service: 'api', level: 'info',
      message:   'OpsMate API started',
      port:      PORT,
      model:     process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free',
      demoApiUrl: process.env.DEMO_API_URL || 'http://demo:3001',
    }));
  });
}

start().catch((err) => {
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(), service: 'api', level: 'error',
    message: 'Fatal startup error', error: err.message, stack: err.stack,
  }));
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), service: 'api', level: 'info', message: 'Shutting down (SIGTERM)' }));
  metricPoller.stop();
  await db.pool.end();
  process.exit(0);
});
