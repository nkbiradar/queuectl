const Worker = require('./worker');
const { claimPendingJob } = require('./jobModel');

let workers = [];

function startWorkers(count = 1) {
  for (let i = 0; i < count; i++) {
    const w = new Worker(`worker-${Date.now()}-${i}`);
    w.attachClaimFn(async (id) => claimPendingJob(id));
    w.start();
    workers.push(w);
  }
}

async function stopWorkers() {
  await Promise.all(workers.map((w) => w.stop()));
  workers = [];
}

function activeCount() {
  return workers.length;
}

module.exports = { startWorkers, stopWorkers, activeCount };
