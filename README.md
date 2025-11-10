# 🧩 QueueCTL

Lightweight job queue with CLI, worker processes, and a live dashboard backed by SQLite.

[![Watch Demo](https://img.shields.io/badge/▶%20Watch-Demo-blue)](https://drive.google.com/file/d/1WllnUqcElOoOg79ZZX1TXn8p0AyCN6W6/view?usp=sharing)

---

## 🎥 Demo Video  
▶ *Watch the 15-minute full demo here:*  
[🎬 QueueCTL Demo Video (Google Drive)](https://drive.google.com/file/d/1WllnUqcElOoOg79ZZX1TXn8p0AyCN6W6/view?usp=sharing)

---
## 🚀 Features
- Enqueue shell commands as jobs  
- Worker processes handle job execution  
- Live dashboard for job tracking  
- Retry logic, backoff, and Dead Letter Queue  
- Local SQLite database — minimal infrastructure

...
# QueueCTL - Distributed Job Queue System

![QueueCTL](https://img.shields.io/badge/QueueCTL-v1.0.0-blue)
![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A514-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

A lightweight, persistent job queue system with SQLite backend for executing shell commands asynchronously with automatic retries and monitoring.

## 🚀 Quick Start

```bash
git clone https://github.com/nkbiradar/queuectl.git
cd queuectl
npm install
node src/index.js

## Enqueue Jobs
$job = @{ command = 'echo Hello from PowerShell' }
$job | ConvertTo-Json | Out-File -Encoding UTF8 job.json
npx queuectl enqueue --file job.json
Remove-Item job.json

npx queuectl enqueue '{"command":"echo Hello from bash"}'

## Manage Workers

# Start workers
npx queuectl worker:start --count 2

# Stop workers  
npx queuectl worker:stop

# List jobs
npx queuectl list

## REST API

# List jobs
curl http://localhost:3000/api/jobs | jq .

# View dead letter queue
curl http://localhost:3000/api/dlq | jq .

# Retry failed job
curl -X POST http://localhost:3000/api/dlq/retry/<job-id>

## 🏗 Architecture
Database: SQLite with better-sqlite3

CLI: Commander.js

API: Express.js

Workers: Node.js child processes

## Job Lifecycle
Insert → pending → claim → processing → completed/failed → retry/pending → dead

## ⚙ Configuration

Setting	Default	Description
Server Port	3000	HTTP API port
Worker Count	1	Default workers
Max Retries	3	Maximum retry attempts

##  Troubleshooting
rm data/queue.db
node src/index.js

## PowerShell JSON Issues:

# Use file method instead of inline JSON
$job | ConvertTo-Json | Out-File -Encoding UTF8 job.json
npx queuectl enqueue --file job.json

##📄 License

MIT License - see LICENSE file for details.

## 👨‍💻 Author
Nayan Kumar Biradar
📍 IIIT Dharwad, Karnataka
