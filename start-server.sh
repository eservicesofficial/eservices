#!/bin/bash
cd /home/z/my-project
export DATABASE_URL=file:/home/z/my-project/db/custom.db
export NODE_ENV=production
while true; do
  node .next/standalone/server.js -p 3000 -H 0.0.0.0 2>&1
  echo "Server crashed, restarting in 2s..."
  sleep 2
done
