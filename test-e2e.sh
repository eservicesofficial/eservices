#!/bin/bash
# E2E Test Script - Everything in one process
cd /home/z/my-project

# Kill existing
pkill -f "next dev" 2>/dev/null
pkill -f "chromium" 2>/dev/null
sleep 2
rm -rf .next
truncate -s 0 dev.log

# Start server
echo "[1] Starting dev server..."
NODE_OPTIONS="--max-old-space-size=4096" bun run dev > dev.log 2>&1 &
SERVER_PID=$!

# Wait for ready
for i in $(seq 1 60); do
  if curl -s --max-time 2 http://localhost:3000/ > /dev/null 2>&1; then
    echo "[2] Server ready after ${i}s"
    break
  fi
  if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo "[FAIL] Server died during startup"
    exit 1
  fi
  sleep 2
done

# Init database
echo "[3] Calling /api/init..."
INIT_RESP=$(curl -s --max-time 30 http://localhost:3000/api/init)
echo "Init: $INIT_RESP"

# Login via API
echo "[4] Login via API..."
LOGIN_RESP=$(curl -s --max-time 30 -X POST http://localhost:3000/api/super-admin/auth \
  -H "Content-Type: application/json" \
  -d '{"email":"jiotechnologist@gmail.com","password":"741504"}')
echo "Login: $LOGIN_RESP"

# Extract token
TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
if [ -z "$TOKEN" ]; then
  echo "[FAIL] No token received"
  tail -20 dev.log
  exit 1
fi
echo "[5] Token received (${#TOKEN} chars)"

# Verify token with session endpoint
echo "[6] Verifying session..."
SESSION_RESP=$(curl -s --max-time 15 http://localhost:3000/api/auth/session -H "Authorization: Bearer $TOKEN")
echo "Session: $SESSION_RESP"

# Open browser
echo "[7] Opening browser..."
agent-browser open http://localhost:3000 2>&1
sleep 6

# Set session in localStorage
echo "[8] Setting session in localStorage..."
USER_ID=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['user']['id'])" 2>/dev/null)
agent-browser eval "localStorage.setItem('eservices_session', JSON.stringify({
  token: '$TOKEN',
  user: {
    unitCode: 'SUPER',
    unitName: 'System',
    userId: '$USER_ID',
    loginId: 'jiotechnologist@gmail.com',
    name: 'Sarkar',
    role: 'SuperAdmin',
    permissions: {},
    isSuperAdmin: true
  },
  loginTime: new Date().toISOString()
})); 'Session set in localStorage';" 2>&1

# Also set via sessionStorage to avoid init re-triggering
agent-browser eval "sessionStorage.setItem('eservices_init_done', '1');" 2>&1

# Reload to pick up session
echo "[9] Reloading page..."
agent-browser reload 2>&1
sleep 10

# Check state
echo "[10] Page state after reload:"
agent-browser get url 2>&1
agent-browser get title 2>&1
echo "--- SNAPSHOT (compact) ---"
agent-browser snapshot -c 2>&1 | head -80
echo "--- INTERACTIVE ---"
agent-browser snapshot -i 2>&1 | head -40

# Console errors
echo "--- CONSOLE ERRORS ---"
agent-browser errors 2>&1 | head -20

# Dev log
echo "--- DEV LOG (last 30) ---"
tail -30 dev.log

echo ""
echo "=== TEST COMPLETE ==="
