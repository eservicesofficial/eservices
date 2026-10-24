#!/bin/bash
while true; do
  cd /home/z/my-project/.next/standalone
  HOSTNAME=0.0.0.0 PORT=3000 DATABASE_URL=file:/home/z/my-project/db/custom.db NODE_ENV=production node server.js 2>&1
  echo "Server died, restarting in 2s..."
  sleep 2
done
