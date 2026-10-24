#!/bin/bash
# Dev server watchdog - auto-restarts when server dies
cd /home/z/my-project
export NODE_OPTIONS='--max-old-space-size=4096'

while true; do
  echo "[$(date '+%H:%M:%S')] Starting dev server..."
  node ./node_modules/.bin/next dev --webpack -p 3000 -H 0.0.0.0 >> dev.log 2>&1
  EXIT_CODE=$?
  echo "[$(date '+%H:%M:%S')] Server exited with code $EXIT_CODE, restarting in 3s..."
  sleep 3
done
