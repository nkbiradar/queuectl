// src/worker.js
const { spawn } = require('child_process');
const { markCompleted, markFailed } = require('./jobModel');
const { sleep } = require('./utils');

const IS_WINDOWS = process.platform === 'win32';
const MAX_LOG_CHARS = 20000;

class Worker {
  constructor(id) {
    this.id = id;
    this.running = false;
    this.current = null;
    this.claimFn = null;
  }

  attachClaimFn(fn) {
    this.claimFn = fn;
  }

  async start() {
    this.running = true;
    console.log(`👷 Worker ${this.id} started`);
    while (this.running) {
      // Support async or sync claim functions by awaiting
      const job = this.claimFn ? await this.claimFn(this.id) : null;
      if (!job) {
        await sleep(1000);
        continue;
      }

      // debug: show claimed job id & command (limited length)
      console.log(`Worker ${this.id} claimed job: id=${job.id} command=${String(job.command).slice(0, 120)}`);

      this.current = job;
      try {
        await this.execute(job);
      } catch (e) {
        console.error('Worker execution error:', e);
      } finally {
        this.current = null;
      }
    }
  }

  async stop() {
    this.running = false;
    while (this.current) await sleep(200);
    console.log(`🛑 Worker ${this.id} stopped`);
  }

  async execute(job) {
    return new Promise((resolve) => {
      const startTime = Date.now();

      // Validate job and command
      if (!job || !job.command || typeof job.command !== 'string' || job.command.trim() === '') {
        console.error(`Worker ${this.id}: job ${job && job.id} missing command — marking failed.`);
        const attempts = (job && job.attempts ? Number(job.attempts) : 0) + 1;

        try {
          const res = markFailed(
            job ? job.id : null,
            attempts,
            job ? job.max_retries : undefined,
            job ? job.base_backoff : undefined,
            'missing command'
          );
          if (res && typeof res.then === 'function') {
            res.catch((err) => console.error('markFailed error (missing command):', err)).finally(() => resolve());
          } else {
            resolve();
          }
        } catch (err) {
          console.error('markFailed thrown error (missing command):', err);
          resolve();
        }
        return;
      }

      // Build command and args safely. Support quoted args minimally.
      let cmd, args;
      try {
        if (IS_WINDOWS && !/^cmd\s+\/c/i.test(job.command)) {
          cmd = 'cmd';
          args = ['/c', job.command];
        } else {
          // simple quoted-aware split
          const parts = job.command.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
          const cleaned = parts.map(p => p.replace(/^"|"$/g, ''));
          cmd = cleaned[0];
          args = cleaned.slice(1);
        }
      } catch (err) {
        console.error(`Worker ${this.id}: error parsing command for job ${job.id}:`, err);
        const attempts = (job.attempts || 0) + 1;
        try {
          const res = markFailed(job.id, attempts, job.max_retries, job.base_backoff, `command parse error: ${err.message}`);
          if (res && typeof res.then === 'function') {
            res.catch(e => console.error('markFailed error (parse):', e)).finally(() => resolve());
          } else {
            resolve();
          }
        } catch (e) {
          console.error('markFailed thrown error (parse):', e);
          resolve();
        }
        return;
      }

      console.log(`Worker ${this.id}: spawning job ${job.id} =>`, cmd, args);

      // optional per-job timeout (milliseconds). 0 = disabled.
      const JOB_TIMEOUT_MS = Number.isFinite(Number(job.timeout_ms)) ? Number(job.timeout_ms) : 0;
      let timeoutHandle = null;

      let child;
      try {
        child = spawn(cmd, args, { shell: false });
      } catch (err) {
        console.error(`Worker ${this.id}: spawn failed for job ${job.id}:`, err);
        const attempts = (job.attempts || 0) + 1;
        try {
          const res = markFailed(job.id, attempts, job.max_retries, job.base_backoff, `spawn error: ${err.message}`);
          if (res && typeof res.then === 'function') {
            res.catch(e => console.error('markFailed error (spawn):', e)).finally(() => resolve());
          } else {
            resolve();
          }
        } catch (e) {
          console.error('markFailed thrown error (spawn):', e);
          resolve();
        }
        return;
      }

      // start timeout if configured
      if (JOB_TIMEOUT_MS > 0) {
        timeoutHandle = setTimeout(() => {
          try {
            child.kill();
          } catch (e) { /* ignore */ }
        }, JOB_TIMEOUT_MS);
      }

      let stdout = '';
      let stderr = '';

      if (child.stdout) {
        child.stdout.on('data', (data) => {
          const chunk = data.toString();
          stdout += chunk;
          process.stdout.write(`[${job.id}] ${chunk}`);
          if (stdout.length > MAX_LOG_CHARS) stdout = stdout.slice(-MAX_LOG_CHARS);
        });
      }

      if (child.stderr) {
        child.stderr.on('data', (data) => {
          const chunk = data.toString();
          stderr += chunk;
          process.stderr.write(`[${job.id}][err] ${chunk}`);
          if (stderr.length > MAX_LOG_CHARS) stderr = stderr.slice(-MAX_LOG_CHARS);
        });
      }

      // helper: create a short, friendly error from stderr or exit code
      function friendlyErrorFrom(stderrText, exitCode) {
        if (stderrText) {
          const s = stderrText.toString();
          if (/is not recognized as an internal or external command/i.test(s)) {
            const m = s.match(/'([^']+)' is not recognized/i);
            return m ? `command not found: ${m[1]}` : 'command not found';
          }
          if (/:\s+\d+:\s+.+: not found/i.test(s) || /: not found/i.test(s) || /command not found/i.test(s)) {
            const m = s.match(/([^:\s]+): not found/);
            return m ? `command not found: ${m[1]}` : 'command not found';
          }
          const firstLine = s.split(/\r?\n/)[0].slice(0, 400);
          return firstLine;
        }
        if (exitCode != null) return `exit:${exitCode}`;
        return 'unknown error';
      }

      // exit handler
      child.on('exit', (code/*, signal*/) => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        const durationMs = Date.now() - startTime;

        // get truncated raw logs
        const rawStdout = stdout == null ? null : String(stdout).slice(-MAX_LOG_CHARS);
        const rawStderr = stderr == null ? null : String(stderr).slice(-MAX_LOG_CHARS);

        try {
          if (code === 0) {
            markCompleted(job.id, rawStdout, rawStderr, code, durationMs);
            return resolve();
          }

          // failure: create friendly message
          const friendly = friendlyErrorFrom(rawStderr, code);

          console.warn(`Worker ${this.id}: job ${job.id} failed (${friendly}), attempts=${(job.attempts||0)+1}`);

          const attempts = (job.attempts || 0) + 1;
          const res = markFailed(job.id, attempts, job.max_retries, job.base_backoff, friendly, rawStdout, rawStderr, code, durationMs);
          if (res && typeof res.then === 'function') {
            res.catch(e => console.error('markFailed error (exit):', e)).finally(() => resolve());
          } else {
            resolve();
          }
        } catch (err) {
          console.error('Error in exit handler while marking job state:', err);
          resolve();
        }
      });

      // spawn error event
      child.on('error', (err) => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        const durationMs = Date.now() - startTime;
        console.error(`Worker ${this.id}: child process error for job ${job.id}:`, err);
        try {
          const attempts = (job.attempts || 0) + 1;
          const res = markFailed(job.id, attempts, job.max_retries, job.base_backoff, `spawn error: ${String(err).slice(0,200)}`, stdout, stderr, -1, durationMs);
          if (res && typeof res.then === 'function') {
            res.catch(e => console.error('markFailed error (child error):', e)).finally(() => resolve());
          } else {
            resolve();
          }
        } catch (e) {
          console.error('markFailed thrown error (child error):', e);
          resolve();
        }
      });
    });
  }
}

module.exports = Worker;
