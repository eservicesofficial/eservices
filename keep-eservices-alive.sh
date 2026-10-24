#!/bin/bash
cd /home/z/my-project
while true; do
  if ! ss -tlnp 2>/dev/null | grep -q ":3000 "; then
    echo "[$(date)] Dev server not running. Starting..." >> dev.log
    NODE_OPTIONS="--max-old-space-size=1536" npx next dev --webpack -p 3000 -H 0.0.0.0 >> dev.log 2>&1 &
    sleep 15
  fi
  sleep 5
done
