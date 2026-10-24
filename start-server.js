// Simple crash-proof server starter
const { spawn } = require('child_process');
const PORT = process.env.PORT || '3000';
const HOST = process.env.HOST || '0.0.0.0';

process.on('unhandledRejection', () => {});
process.on('uncaughtException', () => {});

function start() {
  const child = spawn('npx', ['next', 'start', '-p', PORT, '-H', HOST], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env },
  });
  child.stdout.on('data', (d) => process.stdout.write(d));
  child.stderr.on('data', (d) => process.stderr.write(d));
  child.on('exit', (code) => {
    console.log(`Server exited with code ${code}, restarting in 2s...`);
    setTimeout(start, 2000);
  });
}
start();