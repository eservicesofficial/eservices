// Simple wrapper that logs signals and exit
const signals = ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGUSR1', 'SIGUSR2'];
signals.forEach(sig => {
  process.on(sig, () => console.error(`[SIGNAL] ${sig}`));
});
process.on('unhandledRejection', (r) => console.error('[REJECT]', r));
process.on('uncaughtException', (e) => console.error('[EXCEPTION]', e));

const origExit = process.exit;
process.exit = (code) => {
  console.error(`[EXIT] code=${code}\n`, new Error().stack);
  origExit(code);
};

// Just require the standalone server
require('./.next/standalone/server.js');