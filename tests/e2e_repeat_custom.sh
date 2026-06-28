#!/usr/bin/env bash
# End-to-end test for repeat_custom on production deployment
# Usage: bash tests/e2e_repeat_custom.sh

set -uo pipefail

BASE="https://your-app.workers.dev"
API_KEY="cfk_your_key_here"
WEB_PW="your_web_password"

pass=0; fail=0
created_ids=()

# ---------- helpers ----------
req() {
  # $1 method, $2 path, $3 data (optional), $4 auth (apikey|cookie|none)
  local m=$1 p=$2 d=$3 auth=$4
  local hdrs=()
  if [ "$auth" = "apikey" ]; then hdrs+=(-H "X-API-Key: $API_KEY"); fi
  if [ -n "${COOKIE:-}" ] && [ "$auth" = "cookie" ]; then hdrs+=(-H "Cookie: $COOKIE"); fi
  if [ -n "$d" ]; then
    curl -sS -m 20 -o /tmp/resp.json -w "%{http_code}" -X "$m" "$BASE$p" \
      "${hdrs[@]}" -H "Content-Type: application/json" -d "$d"
  else
    curl -sS -m 20 -o /tmp/resp.json -w "%{http_code}" -X "$m" "$BASE$p" \
      "${hdrs[@]}"
  fi
}

jq_field() { node -e "const r=JSON.parse(require('fs').readFileSync('/tmp/resp.json','utf8'));console.log($1||'')"; }

ok() { pass=$((pass+1)); echo "  ✓ $1"; }
ko() { fail=$((fail+1)); echo "  ✗ $1"; cat /tmp/resp.json 2>/dev/null | head -c 300; echo; }

cleanup_id() {
  [ -z "$1" ] && return
  req DELETE "/api/v1/todos/$1?scope=all" "" apikey >/dev/null
}

# ---------- 1. V1 POST valid repeat_custom (WEEKLY MWF) ----------
echo "[1] V1 POST valid repeat_custom (FREQ=WEEKLY;BYDAY=MO,WE,FR)"
TODAY=$(date -u +%Y-%m-%d)
# find next Monday as anchor
DOW=$(date -u +%w)  # 0=Sun..6=Sat
DAYS_TO_MON=$(( (8 - DOW) % 7 ))
[ $DAYS_TO_MON -eq 0 ] && DAYS_TO_MON=0
ANCHOR=$(date -u -d "+${DAYS_TO_MON} days" +%Y-%m-%d)
echo "  anchor (next Monday): $ANCHOR"

CODE=$(req POST /api/v1/todos \
  "{\"date\":\"$ANCHOR\",\"text\":\"e2e-mwf-test\",\"repeat_type\":\"weekly\",\"repeat_custom\":\"FREQ=WEEKLY;BYDAY=MO,WE,FR\",\"repeat_interval\":1}" \
  apikey)
if [ "$CODE" = "201" ]; then
  ID=$(jq_field "r.data.id")
  RC=$(jq_field "r.data.repeat_custom")
  if [ "$RC" = "FREQ=WEEKLY;BYDAY=MO,WE,FR" ] && [ -n "$ID" ]; then
    ok "POST 201, id=$ID, repeat_custom returned correctly"
    created_ids+=("$ID")
  else
    ko "POST 201 but repeat_custom mismatch: got '$RC'"
  fi
else
  ko "POST expected 201, got $CODE"
fi

# ---------- 2. V1 POST invalid repeat_custom (SECONDLY) → 400 ----------
echo "[2] V1 POST invalid repeat_custom (FREQ=SECONDLY)"
CODE=$(req POST /api/v1/todos \
  "{\"date\":\"$TODAY\",\"text\":\"e2e-bad\",\"repeat_type\":\"daily\",\"repeat_custom\":\"FREQ=SECONDLY\"}" \
  apikey)
if [ "$CODE" = "400" ]; then
  ok "POST 400 for SECONDLY (DoS prevention)"
else
  ko "expected 400 for SECONDLY, got $CODE"
fi

# ---------- 3. V1 POST invalid repeat_custom (CRLF injection) ----------
echo "[3] V1 POST repeat_custom with CRLF injection attempt"
CODE=$(req POST /api/v1/todos \
  "{\"date\":\"$TODAY\",\"text\":\"e2e-crlf\",\"repeat_type\":\"daily\",\"repeat_custom\":\"FREQ=DAILY\\nX-INJECT:evil\"}" \
  apikey)
if [ "$CODE" = "400" ]; then
  ok "POST 400 for CRLF injection"
else
  ko "expected 400 for CRLF, got $CODE"
fi

# ---------- 4. V1 POST repeat_custom with fragment → forced empty ----------
echo "[4] V1 POST repeat_custom with repeat_type=fragment"
CODE=$(req POST /api/v1/todos \
  "{\"date\":\"\",\"text\":\"e2e-frag-custom\",\"repeat_type\":\"fragment\",\"repeat_custom\":\"FREQ=DAILY\"}" \
  apikey)
if [ "$CODE" = "201" ]; then
  FRAG_ID=$(jq_field "r.data.id")
  FRAG_RC=$(jq_field "r.data.repeat_custom")
  if [ "$FRAG_RC" = "" ]; then
    ok "fragment: repeat_custom silently cleared"
  else
    ko "fragment: repeat_custom should be empty, got '$FRAG_RC'"
  fi
  [ -n "$FRAG_ID" ] && created_ids+=("$FRAG_ID")
else
  ko "fragment POST expected 201, got $CODE"
fi

# ---------- 5. V1 expand=true: server-side MWF expansion ----------
echo "[5] V1 expand=true: verify server expands MWF on a Monday"
if [ -n "${ID:-}" ]; then
  CODE=$(req GET "/api/v1/todos?date=$ANCHOR&expand=true" "" apikey)
  if [ "$CODE" = "200" ]; then
    # check if our test todo appears in the result for the anchor date
    FOUND=$(jq_field "(r.data.find(t=>t.id==='$ID')||{}).id || ''")
    if [ "$FOUND" = "$ID" ]; then
      ok "expand=true: MWF template generated instance on Monday"
    else
      ko "expand=true: instance not found on Monday"
    fi
  else
    ko "expand=true GET failed: $CODE"
  fi
fi

# ---------- 6. V1 expand=false: templates carry non-empty repeat_custom ----------
echo "[6] V1 expand=false: templates carry non-empty repeat_custom"
if [ -n "${ID:-}" ]; then
  CODE=$(req GET "/api/v1/todos?date=$ANCHOR&expand=false" "" apikey)
  if [ "$CODE" = "200" ]; then
    # find template with parent_id == our ID
    TPL_RC=$(jq_field "(r.templates.find(t=>t.parent_id==='$ID')||{}).repeat_custom || 'NOT_FOUND'")
    if [ "$TPL_RC" = "FREQ=WEEKLY;BYDAY=MO,WE,FR" ]; then
      ok "expand=false: template.repeat_custom carries custom RRULE"
    else
      ko "expand=false: template repeat_custom mismatch: '$TPL_RC'"
    fi
  else
    ko "expand=false GET failed: $CODE"
  fi
fi

# ---------- 7. V1 PUT PATCH semantics: undefined → preserve ----------
echo "[7] V1 PUT PATCH semantics: omit repeat_custom → preserve existing"
if [ -n "${ID:-}" ]; then
  CODE=$(req PUT "/api/v1/todos/$ID" \
    "{\"scope\":\"all\",\"text\":\"e2e-mwf-renamed\"}" \
    apikey)
  if [ "$CODE" = "200" ]; then
    AFTER_RC=$(jq_field "r.data.repeat_custom")
    AFTER_TEXT=$(jq_field "r.data.text")
    if [ "$AFTER_RC" = "FREQ=WEEKLY;BYDAY=MO,WE,FR" ] && [ "$AFTER_TEXT" = "e2e-mwf-renamed" ]; then
      ok "PATCH: text updated, repeat_custom preserved"
    else
      ko "PATCH: text='$AFTER_TEXT' rc='$AFTER_RC' (expected preserved)"
    fi
  else
    ko "PUT expected 200, got $CODE"
  fi
fi

# ---------- 8. V1 PUT: change repeat_custom ----------
echo "[8] V1 PUT: change repeat_custom to FREQ=WEEKLY;BYDAY=TU,TH"
if [ -n "${ID:-}" ]; then
  CODE=$(req PUT "/api/v1/todos/$ID" \
    "{\"scope\":\"all\",\"repeat_custom\":\"FREQ=WEEKLY;BYDAY=TU,TH\"}" \
    apikey)
  if [ "$CODE" = "200" ]; then
    AFTER_RC=$(jq_field "r.data.repeat_custom")
    if [ "$AFTER_RC" = "FREQ=WEEKLY;BYDAY=TU,TH" ]; then
      ok "PUT: repeat_custom updated"
    else
      ko "PUT: repeat_custom update failed: '$AFTER_RC'"
    fi
  else
    ko "PUT expected 200, got $CODE"
  fi
fi

# ---------- 9. V1 PUT: clear repeat_custom ----------
echo "[9] V1 PUT: clear repeat_custom (set to empty string)"
if [ -n "${ID:-}" ]; then
  CODE=$(req PUT "/api/v1/todos/$ID" \
    "{\"scope\":\"all\",\"repeat_custom\":\"\"}" \
    apikey)
  if [ "$CODE" = "200" ]; then
    AFTER_RC=$(jq_field "r.data.repeat_custom")
    if [ "$AFTER_RC" = "" ]; then
      ok "PUT: repeat_custom cleared"
    else
      ko "PUT: repeat_custom should be empty, got '$AFTER_RC'"
    fi
  else
    ko "PUT expected 200, got $CODE"
  fi
fi

# ---------- 10. V0 web auth + CREATE with repeat_custom ----------
echo "[10] V0 web auth + CREATE with repeat_custom"
# login first
curl -sS -m 10 -c /tmp/cookies.txt -o /tmp/login.json -w "%{http_code}" \
  -X POST "$BASE/api/login" -H "Content-Type: application/json" \
  -d "{\"password\":\"$WEB_PW\"}" >/tmp/login_code.txt
LOGIN_CODE=$(cat /tmp/login_code.txt)
if [ "$LOGIN_CODE" = "200" ]; then
  # Netscape cookie jar format: domain  FALSE  path  TRUE  expires  name  value
  AUTH_TOKEN=$(awk '$6=="auth_token"{print $7}' /tmp/cookies.txt)
  AUTH_SIG=$(awk '$6=="auth_sig"{print $7}' /tmp/cookies.txt)
  COOKIE="auth_token=$AUTH_TOKEN; auth_sig=$AUTH_SIG"
  if [ -n "$AUTH_TOKEN" ] && [ -n "$AUTH_SIG" ]; then
    ok "V0 web login OK, cookie acquired"
    # V0 CREATE — endpoint is /api/todo-action with action=CREATE
    V0_ID="e2ev0$(date +%s)001"
    CODE=$(req POST /api/todo-action \
      "{\"action\":\"CREATE\",\"date\":\"$ANCHOR\",\"task\":{\"id\":\"$V0_ID\",\"text\":\"e2e-v0-custom\",\"repeat_type\":\"weekly\",\"repeat_custom\":\"FREQ=WEEKLY;BYDAY=FR\",\"repeat_interval\":1}}" \
      cookie)
    if [ "$CODE" = "200" ]; then
      ok "V0 CREATE with repeat_custom: $CODE"
      created_ids+=("$V0_ID")
      # verify via V1 GET
      CODE=$(req GET "/api/v1/todos/$V0_ID" "" apikey)
      if [ "$CODE" = "200" ]; then
        V0_RC=$(jq_field "r.data.repeat_custom")
        if [ "$V0_RC" = "FREQ=WEEKLY;BYDAY=FR" ]; then
          ok "V0 CREATE: repeat_custom persisted to DB"
        else
          ko "V0 CREATE: DB readback mismatch: '$V0_RC'"
        fi
      fi
    else
      ko "V0 CREATE failed: $CODE"
    fi
  else
    ko "V0 login: no cookie returned"
  fi
else
  ko "V0 login failed: $LOGIN_CODE"
fi

# ---------- 11. V0 UPDATE: change repeat_custom ----------
echo "[11] V0 UPDATE: change repeat_custom"
if [ -n "${V0_ID:-}" ]; then
  CODE=$(req POST /api/todo-action \
    "{\"action\":\"UPDATE\",\"date\":\"$ANCHOR\",\"scope\":\"all\",\"task\":{\"id\":\"$V0_ID\",\"text\":\"e2e-v0-updated\",\"repeat_type\":\"weekly\",\"repeat_custom\":\"FREQ=WEEKLY;BYDAY=MO,FR\",\"repeat_interval\":1}}" \
    cookie)
  if [ "$CODE" = "200" ]; then
    # verify
    CODE=$(req GET "/api/v1/todos/$V0_ID" "" apikey)
    if [ "$CODE" = "200" ]; then
      V0_RC2=$(jq_field "r.data.repeat_custom")
      if [ "$V0_RC2" = "FREQ=WEEKLY;BYDAY=MO,FR" ]; then
        ok "V0 UPDATE: repeat_custom updated"
      else
        ko "V0 UPDATE: readback mismatch: '$V0_RC2'"
      fi
    fi
  else
    ko "V0 UPDATE failed: $CODE"
  fi
fi

# ---------- Cleanup ----------
echo ""
echo "[cleanup] deleting ${#created_ids[@]} test todos"
for cid in "${created_ids[@]}"; do
  cleanup_id "$cid"
done

echo ""
echo "========================================"
echo "  PASS: $pass  FAIL: $fail"
echo "========================================"
[ $fail -eq 0 ] && exit 0 || exit 1
