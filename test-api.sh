#!/bin/bash
# Test di base delle API del backend GROW
# Presuppone che il server sia in esecuzione su http://localhost:3001

BASE="http://localhost:3001"
PASS=0
FAIL=0

green() { echo -e "\033[32m$1\033[0m"; }
red() { echo -e "\033[31m$1\033[0m"; }

assert_ok() {
  if [ "$1" -eq 0 ]; then
    green "  ✓ $2"
    PASS=$((PASS+1))
  else
    red "  ✗ $2"
    FAIL=$((FAIL+1))
  fi
}

# 1. Health check
echo "--- Health Check ---"
RESP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/health")
assert_ok $([ "$RESP" = "200" ] && echo 0 || echo 1) "Health check -> $RESP"

# 2. Register
echo "--- Register ---"
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@grow.app","password":"test123","nickname":"Test"}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -n -1)
assert_ok $([ "$CODE" = "201" ] && echo 0 || echo 1) "Register -> $CODE"
TOKEN=$(echo "$BODY" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
assert_ok $([ -n "$TOKEN" ] && echo 0 || echo 1) "Token ricevuto"

# 3. Login
echo "--- Login ---"
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@grow.app","password":"test123"}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -n -1)
assert_ok $([ "$CODE" = "200" ] && echo 0 || echo 1) "Login -> $CODE"
TOKEN=$(echo "$BODY" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# 4. Get Me
echo "--- Get Me ---"
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/auth/me" -H "Authorization: Bearer $TOKEN")
assert_ok $([ "$CODE" = "200" ] && echo 0 || echo 1) "Get Me -> $CODE"

# 5. Subscription
echo "--- Subscription ---"
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/subscription" -H "Authorization: Bearer $TOKEN")
assert_ok $([ "$CODE" = "200" ] && echo 0 || echo 1) "Subscription check -> $CODE"

# 6. Sync upload
echo "--- Sync Upload ---"
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$BASE/api/sync" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"data":{"profile":{"name":"Test","age":25}}}')
assert_ok $([ "$CODE" = "200" ] && echo 0 || echo 1) "Sync upload -> $CODE"

# 7. Sync download
echo "--- Sync Download ---"
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/sync" -H "Authorization: Bearer $TOKEN")
assert_ok $([ "$CODE" = "200" ] && echo 0 || echo 1) "Sync download -> $CODE"

echo ""
echo "=== RESULTS ==="
green "Passati: $PASS"
if [ "$FAIL" -gt 0 ]; then
  red "Falliti: $FAIL"
  exit 1
else
  echo "Tutti i test superati!"
fi
