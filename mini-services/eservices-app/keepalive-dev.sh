#!/bin/bash
cd /home/z/my-project
while true; do
  echo "[$(date)] === Starting dev server ===" >> /home/z/my-project/dev.log
  NODE_OPTIONS='--max-old-space-size=2048' npx next dev -p 3000 -H 0.0.0.0 >> /home/z/my-project/dev.log 2>&1
  echo "[$(date)] === Server exited code=$?, restarting in 3s ===" >> /home/z/my-project/dev.log
  sleep 3
done
