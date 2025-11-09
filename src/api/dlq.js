// src/api/dlq.js

const express = require('express');
const router = express.Router();
const db = require('../db');
const { now } = require('../utils');

/**
 * GET /dlq
 * List all dead jobs (DLQ)
 */
router.get('/', (req, res) => {
  try {
    const rows = db.prepare(`SELECT * FROM jobs WHERE state = 'dead' ORDER BY updated_at DESC`).all();
    res.json(rows);
  } catch (err) {
    console.error('Error fetching DLQ:', err);
    res.status(500).json({ error: 'Failed to fetch DLQ jobs' });
  }
});

/**
 * POST /dlq/retry/:id
 * Retry a DLQ job by moving it back to pending
 */
router.post('/retry/:id', (req, res) => {
  try {
    const id = req.params.id;
    const stmt = db.prepare(`
      UPDATE jobs
      SET state='pending', attempts=0, last_error=NULL, next_run_at=NULL, updated_at=?
      WHERE id=? AND state='dead'
    `);
    const result = stmt.run(now(), id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Job not found or not in DLQ' });
    }

    res.json({ message: `♻️ Job ${id} moved back to pending.` });
  } catch (err) {
    console.error('Error retrying DLQ job:', err);
    res.status(500).json({ error: 'Failed to retry job' });
  }
});

module.exports = router;
