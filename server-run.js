// Enhanced server runner with full debug logging
const path = require('path');

// Log ALL signals
['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGUSR1', 'SIGUSR2'].forEach(sig => {
  process.on(sig, (code) => {
    console.error(`[SIGNAL] Received ${sig}`);
  });
});

// Log unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error(`[REJECT] Unhandled rejection:`, reason);
});

// Log uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error(`[EXCEPTION] Uncaught exception:`, err);
});

// Log warnings
process.on('warning', (warning) => {
  console.error(`[WARNING]`, warning);
});

// Patch process.exit to log before exiting
const origExit = process.exit;
process.exit = function(code) {
  console.error(`[EXIT] process.exit(${code}) called`);
  console.error(`[EXIT] Stack:`, new Error().stack);
  origExit.call(process, code);
};

// Set env before requiring anything
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:/home/z/my-project/db/custom.db';

const dir = path.join(__dirname, '.next', 'standalone');

// Load the standalone server
process.chdir(dir);
process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = require(path.join(dir, '.next/required-server-files.json')).config;

require('next');
const { startServer } = require('next/dist/server/lib/start-server');

const currentPort = parseInt(process.env.PORT, 10) || 3000;
const hostname = process.env.HOSTNAME || '0.0.0.0';

console.log(`[RUNNER] Starting server on ${hostname}:${currentPort}...`);

startServer({
  dir,
  isDev: false,
  config: process.env.__NEXT_PRIVATE_STANDALONE_CONFIG,
  hostname,
  port: currentPort,
  allowRetry: false,
}).then(() => {
  console.log(`[RUNNER] Server started successfully`);
}).catch((err) => {
  console.error(`[RUNNER] startServer failed:`, err);
  process.exit(1);
});