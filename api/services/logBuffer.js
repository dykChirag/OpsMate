'use strict';

/**
 * logBuffer — in-memory circular buffer of the last N log lines received.
 *
 * Keeps only the most recent `maxSize` entries so memory stays bounded.
 * Thread-safe for Node.js single-threaded model (no locks needed).
 */

const DEFAULT_MAX_SIZE = 200;

class LogBuffer {
  constructor(maxSize = DEFAULT_MAX_SIZE) {
    this.maxSize = maxSize;
    /** @type {Array<Object>} */
    this._buf = [];
  }

  /**
   * Add a parsed log entry to the buffer.
   * @param {Object} entry  Structured log object (from /ingest or syslog)
   */
  push(entry) {
    this._buf.push({ ...entry, _receivedAt: Date.now() });
    if (this._buf.length > this.maxSize) {
      this._buf.shift();   // drop oldest
    }
  }

  /**
   * Return the last `n` entries (newest last), optionally filtered.
   * @param {number} [n=50]
   * @param {{ level?: string, service?: string }} [filter]
   * @returns {Object[]}
   */
  recent(n = 50, filter = {}) {
    let items = this._buf;
    if (filter.level)   items = items.filter((e) => e.level === filter.level);
    if (filter.service) items = items.filter((e) => e.service === filter.service);
    return items.slice(-n);
  }

  /** How many entries are currently buffered. */
  get size() { return this._buf.length; }

  /** Most recent entry or null. */
  get latest() { return this._buf[this._buf.length - 1] ?? null; }
}

// Singleton shared across the process
const logBuffer = new LogBuffer();

module.exports = logBuffer;
