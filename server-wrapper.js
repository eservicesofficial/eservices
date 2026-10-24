// Crash-proof server wrapper with auto-restart
// This prevents unhandled promise rejections from killing the server process

const { spawn } = require('child_process');
const path = require('path');

const SERVER_PATH = path.join(__dirname, '.next', 'standalone', 'server.js');
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

// Global unhandled rejection handler — prevents FK constraint errors from crashing the process
process.on('unhandledRejection', (reason, promise) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  console.error(`[CRASH GUARD] Unhandled rejection prevented: ${msg}`);
  // Don't exit — just log it
});

// Global uncaught exception handler
process.on('uncaughtException', (err) => {
  console.error(`[CRASH GUARD] Uncaught exception prevented: ${err.message || err}`);
  // Don't exit — just log it
});

function startServer() {
  const child = spawn('node', [SERVER_PATH, '-p', String(PORT), '-H', HOST], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env },
  });

  child.stdout.on('data', (data) => process.stdout.write(data));
  child.stderr.on('data', (data) => process.stderr.write(data));

  child.on('exit', (code, signal) => {
    if (code !== 0 && code !== null) {
      console.error(`[CRASH GUARD] Server crashed with code ${code || signal}, restarting in 3s...`);
      setTimeout(startServer, 3000);
    } else {
      console.log('[CRASH GUARD] Server stopped cleanly');
    }
  });

  child.on('error', (err) => {
    console.error(`[CRASH GUARD] Server error: ${err.message}`);
  });
}

console.log(`[CRASH GUARD] Starting server wrapper (port ${PORT})...`);
startServer();
