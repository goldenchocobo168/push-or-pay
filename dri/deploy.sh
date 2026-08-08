#!/bin/bash
# Reliable production deploy for Push or Pay, via Vercel (moved off Netlify
# 2026-08-08 -- Netlify's credit-based pricing bills 15 credits per production
# deploy account-wide and caused a real outage; see issue #97).
# Usage: dri/deploy.sh   (run from anywhere; it cd's into the project)
set -euo pipefail
PROJ="/root/push-or-pay"
cd "$PROJ"
VERCEL_TOKEN="$(cat /root/.config/vercel-tofu/token)"
LIVE_URL="https://push-or-pay.vercel.app"

# node/npm/netlify only resolve via ~/.hermes/node/bin, which .profile adds to
# PATH for interactive shells. The systemd oneshot service that invokes this
# script (via the claude agent) never sources .profile, so without this the
# npm test gate below fails with "command not found" and false-aborts every
# deploy. See issue #27.
export PATH="/root/.hermes/node/bin:$PATH"

# `origin/deploy` tracks whatever tree was last actually pushed live (see #63):
# deploy.sh deploys whatever's checked out locally, so a cycle that branches a
# new fix off a stale `origin/main` (which never receives shipped-but-unmerged
# PRs, since merges are Sam-gated) can silently REVERT prior live fixes. Guard
# against that class of regression before deploying, and advance the marker
# after a successful deploy so the next cycle can diff/branch against it.
: "${GH_TOKEN:=$(grep -oE 'ghp_[A-Za-z0-9]+' /root/.config/last30days/.env 2>/dev/null | head -1)}"
REMOTE_URL="https://x-access-token:${GH_TOKEN}@github.com/goldenchocobo168/push-or-pay.git"
if git fetch "$REMOTE_URL" deploy >/dev/null 2>&1; then
  if ! git merge-base --is-ancestor FETCH_HEAD HEAD; then
    echo "[deploy] WARNING: HEAD is missing commits from origin/deploy (last live tree)."
    echo "[deploy] Deploying now may silently revert previously-shipped fixes. Files that differ:"
    git diff FETCH_HEAD...HEAD --stat -- public netlify
    if [ "${DEPLOY_FORCE:-0}" != "1" ]; then
      echo "[deploy] Aborting — rebase/merge origin/deploy into this branch first, or set DEPLOY_FORCE=1 if this is an intentional revert."
      exit 1
    fi
    echo "[deploy] DEPLOY_FORCE=1 set — proceeding despite missing commits."
  fi
fi

echo "[deploy] npm test gate…"
npm test >/dev/null 2>&1 || { echo "[deploy] TESTS FAILED — aborting deploy"; exit 1; }

echo "[deploy] deploying to Vercel production…"
vercel deploy --prod --token="$VERCEL_TOKEN" --yes >/tmp/pp-vercel-deploy.log 2>&1 \
  || { echo "[deploy] vercel deploy FAILED"; tail -20 /tmp/pp-vercel-deploy.log; exit 1; }
echo "[deploy] deployed. verifying live…"
sleep 3
CODE="$(curl -s -o /dev/null -w '%{http_code}' "$LIVE_URL/")"
echo "[deploy] live landing HTTP $CODE"
[ "$CODE" = "200" ] || { echo "[deploy] verify FAILED"; exit 1; }

echo "[deploy] advancing origin/deploy marker to $(git rev-parse --short HEAD)…"
git push "$REMOTE_URL" "HEAD:refs/heads/deploy" >/dev/null 2>&1 \
  && echo "[deploy] origin/deploy updated." \
  || echo "[deploy] WARNING: could not update origin/deploy marker (non-fatal; deploy already live)."

echo "[deploy] ✅ done: $LIVE_URL"
