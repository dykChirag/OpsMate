'use strict';

const net       = require('net');
const dgram     = require('dgram');
const logBuffer = require('./logBuffer');

// ─── Config ──────────────────────────────────────────────────────────────────
const SYSLOG_PORT = parseInt(process.env.SYSLOG_PORT || '5514', 10);

// ─── Syslog parser (RFC 3164 / BSD syslog, which syslog-ng emits) ────────────
function parseSyslogLine(raw) {
  // Try to extract structured fields from Zerops forwarded syslog line
  // Format: <priority>timestamp hostname service[pid]: message
  const match = raw.match(
    /^<(\d+)>(\w{3}\s+\d+\s[\d:]+)\s+(\S+)\s+(\S+?)(?:\[(\d+)\])?:\s(.*)$/
  );
  if (match) {
    const priority = parseInt(match[1], 10);
    const severity  = priority & 0x07;   // lower 3 bits
    const levelMap  = ['emergency','alert','critical','error','warn','notice','info','debug'];
    return {
      timestamp: new Date().toISOString(),
      service:   match[4] || match[3],
      level:     levelMap[severity] ?? 'info',
      message:   match[6],
      pid:       match[5] ?? null,
      raw,
    };
  }
  // Fallback: store as raw info entry
  return { timestamp: new Date().toISOString(), service: 'unknown', level: 'info', message: raw.trim(), raw };
}

// ─── TCP listener ─────────────────────────────────────────────────────────────
function startTcpListener(onLine) {
  const server = net.createServer((socket) => {
    let remainder = '';
    socket.on('data', (chunk) => {
      const text = remainder + chunk.toString('utf8');
      const lines = text.split('\n');
      remainder = lines.pop();         // save incomplete last fragment
      for (const line of lines) {
        if (line.trim()) onLine(line);
      }
    });
    socket.on('end', () => { if (remainder.trim()) onLine(remainder); remainder = ''; });
    socket.on('error', () => {}); // individual socket errors are non-fatal
  });

  server.on('error', (err) => {
    console.warn(JSON.stringify({
      timestamp: new Date().toISOString(), service: 'api', level: 'warn',
      message: `Syslog TCP listener error (non-fatal — using /ingest fallback)`,
      error: err.message,
    }));
  });

  server.listen(SYSLOG_PORT, '0.0.0.0', () => {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(), service: 'api', level: 'info',
      message: `Syslog TCP listener started on port ${SYSLOG_PORT}`,
    }));
  });

  return server;
}

// ─── UDP listener ─────────────────────────────────────────────────────────────
function startUdpListener(onLine) {
  const sock = dgram.createSocket('udp4');

  sock.on('message', (msg) => onLine(msg.toString('utf8')));
  sock.on('error', (err) => {
    console.warn(JSON.stringify({
      timestamp: new Date().toISOString(), service: 'api', level: 'warn',
      message: `Syslog UDP listener error (non-fatal)`, error: err.message,
    }));
    sock.close();
  });

  sock.bind(SYSLOG_PORT, '0.0.0.0', () => {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(), service: 'api', level: 'info',
      message: `Syslog UDP listener started on port ${SYSLOG_PORT}`,
    }));
  });

  return sock;
}

// ─── Start (non-blocking — failures are caught and logged, never thrown) ──────
/**
 * @param {function(Object): void} onEntry  Called for each parsed syslog entry
 * @returns {{ tcp: net.Server|null, udp: dgram.Socket|null }}
 */
function start(onEntry) {
  const handleLine = (raw) => {
    const entry = parseSyslogLine(raw);
    logBuffer.push(entry);
    if (typeof onEntry === 'function') onEntry(entry);
  };

  let tcp = null;
  let udp = null;

  try { tcp = startTcpListener(handleLine); } catch (e) {
    console.warn(JSON.stringify({
      timestamp: new Date().toISOString(), service: 'api', level: 'warn',
      message: 'Could not start syslog TCP listener', error: e.message,
    }));
  }

  try { udp = startUdpListener(handleLine); } catch (e) {
    console.warn(JSON.stringify({
      timestamp: new Date().toISOString(), service: 'api', level: 'warn',
      message: 'Could not start syslog UDP listener', error: e.message,
    }));
  }

  return { tcp, udp };
}

module.exports = { start };
