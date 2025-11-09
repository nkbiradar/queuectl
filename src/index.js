// src/index.js
const express = require('express');
const cors = require('cors'); // ✅ Allow frontend (http://localhost:5173) to access backend
const { startWorkers, activeCount } = require('./workerManager');
const { listJobs, retryDeadJob } = require('./jobModel');

// API Routers
const jobsRouter = require('./api/jobs');
const dlqRouter = require('./api/dlq');

const app = express();

// ✅ Enable CORS globally (you can restrict later for prod)
app.use(cors({
  origin: 'http://localhost:5173', // allow your dashboard frontend
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware
app.use(express.json());

// ✅ Health check endpoint
app.get('/', (req, res) => {
  res.send('QueueCTL API running ✅');
});

// ✅ Mount API routers
app.use('/api/jobs', jobsRouter);  // handles listing & creating jobs
app.use('/api/dlq', dlqRouter);    // handles dead-letter queue operations

// ✅ Legacy endpoints (optional fallback)
app.get('/jobs', (req, res) => {
  const state = req.query.state;
  res.json(listJobs(state));
});

app.get('/dlq', (req, res) => {
  res.json(listJobs('dead'));
});

app.post('/dlq/retry/:id', (req, res) => {
  try {
    retryDeadJob(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

// ✅ Start Server and Worker(s)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  startWorkers(1); // starts one worker automatically
  console.log(`👷 Workers started: ${activeCount()}`);
});
