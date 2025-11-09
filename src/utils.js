const { spawn } = require('child_process');

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
const now = () => new Date().toISOString();

function runCommand(command, onStdout, onStderr) {
  const parts = command.split(' ').filter(Boolean);
  const cmd = parts[0];
  const args = parts.slice(1);
  const cp = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  cp.stdout.on('data', (d) => onStdout && onStdout(d.toString()));
  cp.stderr.on('data', (d) => onStderr && onStderr(d.toString()));
  return cp;
}

module.exports = { sleep, now, runCommand };
