#!/bin/bash
cd /home/z/my-project
while true; do
  echo "[$(date)] Starting dev server..."
  NODE_OPTIONS='--max-old-space-size=2048' npx next dev -p 3000 -H 0.0.0.0 2>&1
  echo "[$(date)] Server exited with code $?. Restarting in 3s..."
  sleep 3
done
