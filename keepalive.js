const { spawn } = require('child_process');
function start() {
  const child = spawn('node', ['.next/standalone/server.js'], { stdio: 'inherit' });
  child.on('exit', (code) => {
    console.log(`\nServer exited (${code}). Restarting in 1s...`);
    setTimeout(start, 1000);
  });
}
start();
