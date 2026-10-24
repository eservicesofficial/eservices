module.exports = {
  apps: [{
    name: 'eservices-app',
    script: 'server-wrapper.js',
    cwd: '/home/z/my-project',
    env: {
      NODE_ENV: 'production',
      DATABASE_URL: 'file:/home/z/my-project/db/custom.db'
    },
    args: ['-p', '3000', '-H', '0.0.0.0'],
    watch: false,
    autorestart: true,
    max_memory_restart: '256M',
    max_restarts: 10,
    restart_delay: 3000,
  }]
}
