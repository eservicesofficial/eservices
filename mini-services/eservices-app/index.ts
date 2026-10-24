// Eservices POS & Billing System - Mini Service Entry Point
// This starts the pre-built Next.js standalone server
import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverPath = join(__dirname, 'server.js');

const server = spawn('node', [serverPath], {
  stdio: 'inherit',
  env: { ...process.env, PORT: '3000', HOSTNAME: '0.0.0.0' }
});

server.on('exit', (code) => {
  console.log(`Server exited (${code}). Restarting in 1s...`);
  setTimeout(() => {
    import('./index.ts').catch(() => {});
  }, 1000);
});

// Handle signals
process.on('SIGTERM', () => server.kill('SIGTERM'));
process.on('SIGINT', () => server.kill('SIGINT'));
