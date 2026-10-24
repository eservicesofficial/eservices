#!/bin/bash
cd /home/z/my-project
rm -rf .next
> dev.log

# Start server
NODE_OPTIONS="--max-old-space-size=1536" node node_modules/.bin/next dev --webpack -p 3000 -H 0.0.0.0 >> dev.log 2>&1 &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"

# Wait for server
for i in $(seq 1 20); do
  sleep 3
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null)
  if [ "$STATUS" = "200" ]; then
    echo "SERVER_READY"
    break
  fi
done

# Test API endpoints
echo "=== Testing APIs ==="
echo -n "/api/auth: "; curl -s -X POST http://localhost:3000/api/auth -H "Content-Type: application/json" -d '{"clientId":"7496","userId":"admin","password":"admin"}' | head -c 200
echo ""

echo -n "/api/dashboard: "; curl -s http://localhost:3000/api/dashboard -H "Authorization: Bearer test" -o /dev/null -w "%{http_code}"
echo ""

echo -n "/api/items: "; curl -s http://localhost:3000/api/items -H "Authorization: Bearer test" -o /dev/null -w "%{http_code}"
echo ""

echo -n "/api/features: "; curl -s http://localhost:3000/api/features -H "Authorization: Bearer test" -o /dev/null -w "%{http_code}"
echo ""

echo -n "/api/tables: "; curl -s http://localhost:3000/api/tables -H "Authorization: Bearer test" -o /dev/null -w "%{http_code}"
echo ""

echo -n "/api/settings: "; curl -s http://localhost:3000/api/settings -H "Authorization: Bearer test" -o /dev/null -w "%{http_code}"
echo ""

echo -n "/api/invoices: "; curl -s http://localhost:3000/api/invoices -H "Authorization: Bearer test" -o /dev/null -w "%{http_code}"
echo ""

echo -n "/api/khata/profiles: "; curl -s http://localhost:3000/api/khata/profiles -H "Authorization: Bearer test" -o /dev/null -w "%{http_code}"
echo ""

echo -n "/api/petty-cash: "; curl -s http://localhost:3000/api/petty-cash -H "Authorization: Bearer test" -o /dev/null -w "%{http_code}"
echo ""

echo -n "/api/reports: "; curl -s http://localhost:3000/api/reports -H "Authorization: Bearer test" -o /dev/null -w "%{http_code}"
echo ""

# Login and get token
echo "=== Login Test ==="
TOKEN_RESP=$(curl -s -X POST http://localhost:3000/api/auth -H "Content-Type: application/json" -d '{"clientId":"7496","userId":"admin","password":"admin"}')
echo "Auth response: $TOKEN_RESP" | head -c 300
echo ""

# Extract token
TOKEN=$(echo "$TOKEN_RESP" | node -e "const d=[];process.stdin.on('data',c=>d.push(c));process.stdin.on('end',()=>{try{const j=JSON.parse(Buffer.concat(d));console.log(j.token||j.error||'NO_TOKEN')}catch(e){console.log('PARSE_ERROR')}})" 2>/dev/null)
echo "Token: ${TOKEN:0:30}..."

# Test dashboard with real token
if [ "$TOKEN" != "NO_TOKEN" ] && [ "$TOKEN" != "PARSE_ERROR" ] && [ ${#TOKEN} -gt 10 ]; then
  echo "=== Dashboard with token ==="
  curl -s http://localhost:3000/api/dashboard -H "Authorization: Bearer $TOKEN" | head -c 300
  echo ""
  echo "=== Items with token ==="
  curl -s http://localhost:3000/api/items -H "Authorization: Bearer $TOKEN" | head -c 300
  echo ""
fi

# Keep alive
echo "=== Server alive check ==="
kill -0 $SERVER_PID 2>/dev/null && echo "Server process running" || echo "Server process DEAD"
echo "=== Final log ==="
tail -5 dev.log

# Keep the shell alive
sleep 600
