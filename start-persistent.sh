#!/bin/bash
cd /home/z/my-project
while true; do
  if ! ss -tlnp | grep -q ":3000 "; then
    echo "[$(date)] Server not running, starting..." >> dev.log
    DATABASE_URL=file:/home/z/my-project/db/custom.db NODE_ENV=production node .next/standalone/server.js -p 3000 -H 0.0.0.0 >> dev.log 2>&1
    echo "[$(date)] Server exited, restarting in 3s..." >> dev.log
  fi
  sleep 3
done
