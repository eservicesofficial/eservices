import { spawn } from 'child_process';
const server = spawn('npx', ['next', 'dev', '--webpack', '-p', '3000', '-H', '0.0.0.0'], {
  cwd: '/home/z/my-project',
  env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=1024' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
server.stdout?.on('data', d => process.stdout.write(d));
server.stderr?.on('data', d => process.stderr.write(d));
server.on('exit', code => {
  console.log(`Server exited with code ${code}, restarting in 3s...`);
  setTimeout(() => process.exit(1), 3000);
});
