'use strict';

const { Pool } = require('pg');
const fs       = require('fs');
const path     = require('path');

// ─── Connection pool ────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Zerops managed PG uses SSL in production
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    service:   'api',
    level:     'error',
    message:   'Unexpected pg pool error',
    error:     err.message,
  }));
});

// ─── Query helper ───────────────────────────────────────────────────────────
/**
 * @param {string} sql
 * @param {any[]} [params]
 * @returns {Promise<import('pg').QueryResult>}
 */
async function query(sql, params = []) {
  const client = await pool.connect();
  try {
    return await client.query(sql, params);
  } finally {
    client.release();
  }
}

// ─── Migration runner ───────────────────────────────────────────────────────
/**
 * Reads and executes every .sql file in /migrations in filename order.
 * Idempotent — all DDL uses IF NOT EXISTS.
 */
async function runMigrations() {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      service:   'api',
      level:     'info',
      message:   `Running migration: ${file}`,
    }));
    await query(sql);
  }

  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    service:   'api',
    level:     'info',
    message:   `Migrations complete (${files.length} file(s))`,
  }));
}

module.exports = { query, pool, runMigrations };
