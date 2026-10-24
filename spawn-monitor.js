const { spawn } = require('child_process');
const fs = require('fs');

const logFile = '/tmp/spawn-monitor.log';
const log = (msg) => {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(logFile, line);
  process.stdout.write(line);
};

// Clear log
fs.writeFileSync(logFile, '');

const child = spawn('node', ['server-debug.js'], {
  cwd: '/home/z/my-project',
  env: {
    ...process.env,
    DATABASE_URL: 'file:/home/z/my-project/db/custom.db',
    NODE_ENV: 'production',
    PORT: '3003',
    HOSTNAME: '0.0.0.0',
  },
  stdio: ['pipe', 'pipe', 'pipe'],
  detached: false,
});

child.stdout.on('data', (d) => log(`STDOUT: ${d}`));
child.stderr.on('data', (d) => log(`STDERR: ${d}`));
child.on('exit', (code, signal) => {
  log(`EXIT: code=${code} signal=${signal}`);
  // Restart
  setTimeout(() => {
    log('RESTARTING...');
    startServer();
  }, 2000);
});

child.on('error', (err) => log(`ERROR: ${err.message}`));

log(`Spawned child PID: ${child.pid}`);

function startServer() {
  const child2 = spawn('node', ['server-debug.js'], {
    cwd: '/home/z/my-project',
    env: {
      ...process.env,
      DATABASE_URL: 'file:/home/z/my-project/db/custom.db',
      NODE_ENV: 'production',
      PORT: '3003',
      HOSTNAME: '0.0.0.0',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  child2.stdout.on('data', (d) => log(`STDOUT: ${d}`));
  child2.stderr.on('data', (d) => log(`STDERR: ${d}`));
  child2.on('exit', (code, signal) => {
    log(`EXIT: code=${code} signal=${signal}`);
    // Don't restart again, just stop
  });
  child2.on('error', (err) => log(`ERROR: ${err.message}`));
  log(`Spawned child2 PID: ${child2.pid}`);
}

// Keep the monitor alive
setInterval(() => {
  try {
    process.kill(child.pid, 0);
    log('HEARTBEAT: child alive');
  } catch {
    log('HEARTBEAT: child dead');
  }
}, 10000);