// src/jobModel.js
// Simple job model using better-sqlite3 for persistence.
// Exports: insertJob, listJobs, claimPendingJob, markCompleted, markFailed, getJob, retryDeadJob

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { now } = require('./utils'); // make sure utils.js exists and exports `now()`

// Ensure data dir exists (same pattern your project uses)
const DB_DIR = path.resolve(process.cwd(), 'data');
fs.mkdirSync(DB_DIR, { recursive: true });
const DB_FILE = path.join(DB_DIR, 'queue.db');

// open DB
const db = new Database(DB_FILE);

// Ensure migrations table & jobs table exist (lightweight init)
const initSql = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  command TEXT,
  state TEXT,
  attempts INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  base_backoff REAL DEFAULT 2,
  created_at TEXT,
  updated_at TEXT,
  next_run_at TEXT,
  last_error TEXT,
  locked_by TEXT,
  locked_at TEXT,
  stdout TEXT,
  stderr TEXT,
  exit_code INTEGER
);
`;
db.exec(initSql);

// Utility to run a transaction (better-sqlite3)
function transaction(fn) {
  const t = db.transaction(fn);
  return (...args) => t(...args);
}

// Insert a job
function insertJob(job) {
  const stmt = db.prepare(
    `INSERT INTO jobs (id, command, state, attempts, max_retries, base_backoff, created_at, updated_at, next_run_at, last_error)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  return stmt.run(
    job.id,
    job.command,
    job.state || 'pending',
    job.attempts != null ? job.attempts : 0,
    job.max_retries != null ? job.max_retries : 3,
    job.base_backoff != null ? job.base_backoff : 2,
    job.created_at || now(),
    job.updated_at || now(),
    job.next_run_at || null,
    job.last_error || null
  );
}

// List jobs, optional state
function listJobs(state) {
  if (state) {
    return db.prepare(`SELECT * FROM jobs WHERE state = ? ORDER BY created_at DESC`).all(state);
  }
  return db.prepare(`SELECT * FROM jobs ORDER BY created_at DESC`).all();
}

// Atomically claim one pending job ready to run (set processing + lock fields)
function claimPendingJob(workerId) {
  const tx = db.transaction(() => {
    // find one pending job that's ready (no next_run_at or next_run_at <= now)
    const row = db.prepare(
      `SELECT * FROM jobs WHERE state='pending' AND (next_run_at IS NULL OR next_run_at <= ?) ORDER BY created_at LIMIT 1`
    ).get(now());
    if (!row) return null;

    const updated = db.prepare(
      `UPDATE jobs SET state='processing', locked_by=?, locked_at=?, updated_at=? WHERE id=? AND state='pending'`
    ).run(workerId, now(), now(), row.id);

    if (updated.changes === 1) {
      // return fresh row
      return db.prepare(`SELECT * FROM jobs WHERE id=?`).get(row.id);
    }
    return null;
  });

  return tx();
}

// Mark completed: set state + store optional logs
function markCompleted(id, stdout = null, stderr = null, exitCode = 0, durationMs = null) {
  const stmt = db.prepare(
    `UPDATE jobs SET state='completed', stdout=?, stderr=?, exit_code=?, updated_at=? WHERE id=?`
  );
  return stmt.run(stdout, stderr, exitCode, now(), id);
}

// Mark failed: either move to dead if attempts >= max_retries, else schedule retry with exponential backoff
function markFailed(id, attempts, max_retries, base_backoff, lastError) {
  if (attempts >= (max_retries != null ? max_retries : 3)) {
    return db.prepare(`UPDATE jobs SET state='dead', attempts=?, last_error=?, updated_at=? WHERE id=?`)
      .run(attempts, lastError, now(), id);
  } else {
    const delaySeconds = Math.pow(base_backoff != null ? base_backoff : 2, attempts);
    const nextRun = new Date(Date.now() + delaySeconds * 1000).toISOString();
    return db.prepare(
      `UPDATE jobs SET state='pending', attempts=?, next_run_at=?, last_error=?, updated_at=? WHERE id=?`
    ).run(attempts, nextRun, lastError, now(), id);
  }
}

// Get single job
function getJob(id) {
  return db.prepare(`SELECT * FROM jobs WHERE id=?`).get(id);
}

// Retry dead job (move from dead -> pending)
function retryDeadJob(id) {
  const j = getJob(id);
  if (!j) throw new Error('job not found');
  if (j.state !== 'dead') throw new Error('job not in DLQ');
  return db.prepare(
    `UPDATE jobs SET state='pending', attempts=0, next_run_at=NULL, last_error=NULL, updated_at=? WHERE id=?`
  ).run(now(), id);
}

module.exports = {
  insertJob,
  listJobs,
  claimPendingJob,
  markCompleted,
  markFailed,
  getJob,
  retryDeadJob,
  // expose db for debugging if needed
  __db: db,
};
