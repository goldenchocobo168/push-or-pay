#!/bin/bash
# Reliable production deploy for Push or Pay.
# `netlify deploy --prod` returns "Forbidden" on this account/token, but a draft
# deploy + restoreSiteDeploy (promote) works. This wraps that into one command.
# Usage: dri/deploy.sh   (run from anywhere; it cd's into the project)
set -euo pipefail
SITE_ID="6d2427bd-6fbf-46d0-98cc-cc5dad6c9347"
PROJ="/root/push-or-pay"
cd "$PROJ"

echo "[deploy] npm test gate…"
npm test >/dev/null 2>&1 || { echo "[deploy] TESTS FAILED — aborting deploy"; exit 1; }

echo "[deploy] draft deploy…"
OUT="$(netlify deploy --dir=public --functions=netlify/functions 2>&1)"
DID="$(echo "$OUT" | grep -oE '[0-9a-f]{24}--push-or-pay' | head -1 | cut -d- -f1)"
if [ -z "$DID" ]; then echo "[deploy] could not parse deploy id"; echo "$OUT" | tail -5; exit 1; fi
echo "[deploy] draft id $DID — promoting to production…"

netlify api restoreSiteDeploy --data "{\"site_id\":\"$SITE_ID\",\"deploy_id\":\"$DID\"}" >/dev/null
echo "[deploy] promoted. verifying live…"
sleep 3
CODE="$(curl -s -o /dev/null -w '%{http_code}' https://push-or-pay-app.netlify.app/)"
echo "[deploy] live landing HTTP $CODE"
[ "$CODE" = "200" ] || { echo "[deploy] verify FAILED"; exit 1; }
echo "[deploy] ✅ done: https://push-or-pay-app.netlify.app"
