const { spawn } = require('child_process');
const server = spawn('node', ['server.js'], {
  cwd: '/home/z/my-project/.next/standalone',
  stdio: ['inherit', 'inherit', 'inherit']
});
server.on('exit', (code) => {
  console.log(`Server exited with code ${code}. Restarting...`);
  setTimeout(() => process.exit(1), 1000);
});
// Keep process alive with periodic output
setInterval(() => {
  if (server.pid && server.exitCode === null) {
    // Server still running
  }
}, 5000);
