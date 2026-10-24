#!/bin/bash
cd /home/z/my-project
while true; do
  echo "=== Starting dev server at $(date) ===" >> /home/z/my-project/dev.log
  NODE_OPTIONS="--max-old-space-size=1024" npx next dev --webpack -p 3000 -H 0.0.0.0 >> /home/z/my-project/dev.log 2>&1
  echo "=== Server crashed at $(date), restarting in 3s ===" >> /home/z/my-project/dev.log
  sleep 3
done
