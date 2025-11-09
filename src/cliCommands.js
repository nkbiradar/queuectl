const { Command } = require('commander');
const { insertJob, listJobs } = require('./jobModel');
const { startWorkers, stopWorkers, activeCount } = require('./workerManager');

const program = new Command();

// ✅ Updated enqueue command (flag-based)
program
  .command('enqueue [jsonOrDash]')
  .description('Add a new job. Provide JSON string, use --file <path>, or pipe JSON and pass "-"')
  .option('--file <path>', 'read JSON from file')
  .action(async (jsonOrDash, opts) => {
    try {
      let raw = null;

      if (opts.file) {
        // read from file
        const fs = require('fs');
        raw = fs.readFileSync(opts.file, { encoding: 'utf8' });
        // Remove BOM if present
        raw = raw.replace(/^\uFEFF/, '');
      } else if (jsonOrDash === '-' || (!jsonOrDash && !process.stdin.isTTY)) {
        // read from stdin (piped)
        raw = await new Promise((res, rej) => {
          let data = '';
          process.stdin.setEncoding('utf8');
          process.stdin.on('data', chunk => data += chunk);
          process.stdin.on('end', () => res(data));
          process.stdin.on('error', err => rej(err));
        });
      } else if (jsonOrDash) {
        raw = jsonOrDash;
      } else {
        throw new Error('No job JSON provided. Use JSON string, --file, or pipe JSON and pass "-"');
      }

      // Trim & validate
      raw = raw.trim();
      if (!raw) throw new Error(`Empty JSON input. In PowerShell:

  # Create and enqueue a job (recommended approach)
  $job = @{
    command = 'echo hello'        # The command to run
    max_retries = 3              # Optional: max retry attempts
    base_backoff = 2            # Optional: backoff multiplier
  }
  
  # Save to temp file and enqueue
  $job | ConvertTo-Json | Out-File -Encoding UTF8 job.json
  queuectl enqueue --file job.json
  Remove-Item job.json

  # For bash/cmd:
  queuectl enqueue '{"command":"echo hello"}'
`);

      let data;
      try {
        data = JSON.parse(raw);
      } catch (e1) {
        console.log('Debug: direct parse failed:', e1.message);
        console.log('Debug: trying with manual quote handling...');
        
        // Try various common CLI argument formats:
        const attempts = [
          raw,                              // As-is
          raw.slice(1, -1),                // Remove outer quotes
          raw.replace(/\\"/g, '"'),        // Unescape quotes
          raw.slice(1, -1).replace(/\\"/g, '"'), // Both
        ];

        for (const attempt of attempts) {
          try {
            console.log('Debug: trying:', JSON.stringify(attempt));
            data = JSON.parse(attempt);
            console.log('Debug: success!');
            break;
          } catch (e) {
            console.log('Debug: failed:', e.message);
          }
        }

        if (!data) {
          throw new Error(`Invalid JSON. Examples:\n  queuectl enqueue '{"command":"echo hello"}'\n  queuectl enqueue "{\"command\":\"echo hello\"}"`)
        }
      }
      const cfg = require('../src/config').loadConfig ? require('../src/config').loadConfig() : { max_retries: 3, base_backoff: 2 };
      const { v4: uuidv4 } = require('uuid');

      const job = {
        id: data.id || uuidv4(),
        command: data.command,
        state: 'pending',
        attempts: 0,
        max_retries: data.max_retries || cfg.max_retries,
        base_backoff: data.base_backoff || cfg.base_backoff,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { insertJob } = require('../src/jobModel');
      insertJob(job);
      console.log(`✅ Job enqueued: ${job.id}`);
    } catch (e) {
      console.error('❌ Failed to enqueue job:', e.message);
      process.exitCode = 2;
    }
  });


// Worker commands (unchanged)
program
  .command('worker:start')
  .option('--count <n>', 'number of workers', '1')
  .action((opts) => {
    startWorkers(parseInt(opts.count, 10));
    console.log('🚀 started', opts.count, 'worker(s)');
  });

program
  .command('worker:stop')
  .action(async () => {
    await stopWorkers();
    console.log('🛑 workers stopped');
  });

// List command (unchanged)
program
  .command('list')
  .option('--state <state>', 'filter by state')
  .action((opts) => {
    const rows = listJobs(opts.state);
    console.table(
      rows.map((r) => ({
        id: r.id,
        state: r.state,
        attempts: r.attempts,
        cmd: r.command,
        updated_at: r.updated_at,
      }))
    );
  });

  // ✅ Status command — summary of queue & workers
program
  .command('status')
  .description('Show summary of job states and active workers')
  .action(() => {
    const rows = listJobs();
    const total = rows.length;
    const counts = {
      pending: rows.filter(r => r.state === 'pending').length,
      processing: rows.filter(r => r.state === 'processing').length,
      completed: rows.filter(r => r.state === 'completed').length,
      dead: rows.filter(r => r.state === 'dead').length,
    };

    const { activeCount } = require('./workerManager');

    console.log('\n📊 QueueCTL Status');
    console.log('------------------------------');
    console.log(`Total Jobs:     ${total}`);
    console.log(`Pending:        ${counts.pending}`);
    console.log(`Processing:     ${counts.processing}`);
    console.log(`Completed:      ${counts.completed}`);
    console.log(`Dead (DLQ):     ${counts.dead}`);
    console.log(`Active Workers: ${activeCount()}`);
    console.log('------------------------------\n');
  });

  // ✅ DLQ commands
program
  .command('dlq:list')
  .description('List all jobs in the Dead Letter Queue')
  .action(() => {
    const rows = listJobs('dead');
    if (rows.length === 0) {
      console.log('🎉 DLQ is empty');
      return;
    }
    console.table(
      rows.map((r) => ({
        id: r.id,
        cmd: r.command,
        attempts: r.attempts,
        last_error: r.last_error,
        updated_at: r.updated_at,
      }))
    );
  });

// ✅ Retry all jobs in the Dead Letter Queue
program
  .command('dlq:retry-all')
  .description('Move all dead jobs back to pending')
  .action(() => {
    const { listJobs, retryDeadJob } = require('./jobModel');
    const deadJobs = listJobs('dead');
    if (deadJobs.length === 0) {
      console.log('🎉 DLQ is empty, nothing to retry.');
      return;
    }

    deadJobs.forEach((job) => {
      try {
        retryDeadJob(job.id);
        console.log(`🔁 Job ${job.id} moved back to pending`);
      } catch (err) {
        console.error(`❌ Could not retry ${job.id}:`, err.message);
      }
    });

    console.log(`\n✅ ${deadJobs.length} job(s) requeued successfully.`);
  });

// ✅ Logs command
program
  .command('logs')
  .requiredOption('--id <id>', 'Job ID')
  .description('Show stdout/stderr/exit code for a job')
  .action((opts) => {
    const { getJob } = require('./jobModel');
    const j = getJob(opts.id);
    if (!j) {
      console.error('❌ Job not found:', opts.id);
      process.exit(1);
    }

    console.log(`\n📝 Logs for job ${opts.id}`);
    console.log('State: ', j.state);
    console.log('Exit code:', j.exit_code);
    console.log('Run duration (ms):', j.run_duration_ms);
    console.log('\n--- STDOUT ---\n', j.stdout || '(none)');
    console.log('\n--- STDERR ---\n', j.stderr || '(none)');
    console.log('\n--- last_error ---\n', j.last_error || '(none)');
  });


module.exports = program;
