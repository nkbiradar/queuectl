// src/api/jobs.js

const express = require('express');
const router = express.Router();
const db = require('../db');
const { now } = require('../utils');
const { v4: uuidv4 } = require('uuid');

/**
 * GET /jobs
 * List all jobs, optionally filtered by state
 * Example: /jobs?state=pending
 */
router.get('/', (req, res) => {
  try {
    const { state } = req.query;
    let rows;
    if (state) {
      rows = db
        .prepare(`SELECT * FROM jobs WHERE state = ? ORDER BY created_at DESC`)
        .all(state);
    } else {
      rows = db.prepare(`SELECT * FROM jobs ORDER BY created_at DESC`).all();
    }
    res.json(rows);
  } catch (err) {
    console.error('Error fetching jobs:', err);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

/**
 * POST /jobs
 * Enqueue a new job
 * Body: { "command": "echo Hello World", "max_retries": 3, "base_backoff": 2 }
 */
router.post('/', (req, res) => {
  try {
    const { command, max_retries = 3, base_backoff = 2 } = req.body;
    if (!command || typeof command !== 'string' || !command.trim()) {
      return res.status(400).json({ error: 'Invalid or missing command' });
    }

    const id = uuidv4();
    db.prepare(
      `INSERT INTO jobs (id, command, state, attempts, max_retries, base_backoff, created_at, updated_at)
       VALUES (?, ?, 'pending', 0, ?, ?, ?, ?)`
    ).run(id, command, max_retries, base_backoff, now(), now());

    res.status(201).json({ message: '✅ Job enqueued successfully', id });
  } catch (err) {
    console.error('Error creating job:', err);
    res.status(500).json({ error: 'Failed to enqueue job' });
  }
});

/**
 * GET /jobs/:id
 * Fetch single job details
 */
router.get('/:id', (req, res) => {
  try {
    const id = req.params.id;
    const job = db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
  } catch (err) {
    console.error('Error fetching job:', err);
    res.status(500).json({ error: 'Failed to fetch job' });
  }
});

/**
 * DELETE /jobs/:id
 * Delete a job permanently (e.g. from DLQ)
 */
router.delete('/:id', (req, res) => {
  try {
    const id = req.params.id;
    const result = db.prepare(`DELETE FROM jobs WHERE id = ?`).run(id);
    if (result.changes === 0)
      return res.status(404).json({ error: 'Job not found' });
    res.json({ message: `🗑️ Job ${id} deleted successfully` });
  } catch (err) {
    console.error('Error deleting job:', err);
    res.status(500).json({ error: 'Failed to delete job' });
  }
});

module.exports = router;
