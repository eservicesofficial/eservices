#!/bin/bash
cd /home/z/my-project/.next/standalone
while true; do
  echo "[$(date)] Starting server..."
  node server.js
  echo "[$(date)] Server exited with code $?. Restarting in 2s..."
  sleep 2
done
