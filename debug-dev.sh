#!/bin/bash
cd /home/z/my-project

# Trap all signals and log them
trap 'echo "[SIGNAL] Received SIGTERM at $(date)"; exit 1' SIGTERM
trap 'echo "[SIGNAL] Received SIGINT at $(date)"; exit 1' SIGINT
trap 'echo "[SIGNAL] Received SIGHUP at $(date)"; exit 1' SIGHUP

echo "[START] Starting at $(date)"
NODE_OPTIONS='--max-old-space-size=2048' npx next dev -p 3000 -H 0.0.0.0 2>&1
EXIT_CODE=$?
echo "[EXIT] Process exited with code $EXIT_CODE at $(date)"

# Auto-restart
echo "[RESTART] Restarting in 2s..."
sleep 2
exec "$0"
