#!/bin/bash
# Push or Pay — autonomous DRI (Tibo) RSI loop wrapper.
# One full RSI cycle per fire, then exit. Scheduled by the systemd timer
# push-or-pay-rsi.timer (NEVER raw crontab — see the 2026-07-08 crontab-wipe).
#
# Mirrors psh-tibo-rsi.sh: single-flight lock, deterministic MODE injection by
# UTC hour, deterministic OBSERVE prepended, then the agentic `claude -p` brain.
#
# Env knobs:
#   PP_DRI_SHIP=1   graduate from SHADOW (observe+decide+report only) to full
#                   autonomous ship (merge+deploy). Defaults to 0 (shadow-first).
#   TIBO_POST_HOURS space-separated UTC hours that run a FULL cycle (default "01 09 17")
#   TIBO_MODEL      claude model (default claude-sonnet-5)
#   PP_DRI_DRYRUN=1 assemble + print the prompt/command but do NOT invoke claude.
set -uo pipefail

PROJ="/root/push-or-pay"
PROMPT_FILE="$PROJ/dri/prompt.md"
LOGDIR="/root/.pop-diag/rsi-logs"
HEARTBEAT="$LOGDIR/heartbeat.log"
LOCK="/tmp/push-or-pay-rsi.lock"
CLAUDE="/root/.hermes/node/bin/claude"
MODEL="${TIBO_MODEL:-claude-sonnet-5}"
POST_HOURS="${TIBO_POST_HOURS:-01 09 17}"
SHIP="${PP_DRI_SHIP:-0}"
mkdir -p "$LOGDIR"

# Single-flight: never overlap cycles.
exec 9>"$LOCK"
flock -n 9 || { echo "$(date -Is) another cycle running, skip"; exit 0; }

TS="$(date -u +%Y%m%dT%H%M%SZ)"
HOUR="$(date -u +%H)"
if echo "$POST_HOURS" | grep -qw "$HOUR"; then MODE="FULL"; else MODE="MONITOR"; fi

export GH_TOKEN="$(grep -oE 'ghp_[A-Za-z0-9]+' /root/.config/last30days/.env 2>/dev/null | head -1)"
unset GITHUB_TOKEN
export PP_ADMIN_KEY="$(cat "$PROJ/dri/.admin-key.txt" 2>/dev/null)"

# --- OBSERVE (deterministic) -------------------------------------------------
METRICS="$(python3 "$PROJ/dri/observe.py" 2>&1)"

# --- Assemble the runtime directive ------------------------------------------
read -r -d '' DIRECTIVE <<EOF || true
# RUNTIME MODE: $MODE   ·   SHIP: $SHIP   ·   cycle $TS

$METRICS

MODE rules:
- FULL  : run the complete 6-step RSI cycle including a growth/content move.
- MONITOR: metrics + self-heal + calibration only; do NOT ship a feature this cycle.
SHIP rules:
- SHIP=0 (SHADOW): decide and write the EXACT plan/diff you WOULD ship to the journal, but do
  NOT merge or deploy. Prove the brain; leave side effects off until graduated.
- SHIP=1: you may run the full PR→merge→deploy path (deploy ONLY via dri/deploy.sh).

Now execute exactly ONE RSI cycle per dri/prompt.md, then stop.
EOF

if [ "${PP_DRI_DRYRUN:-0}" = "1" ]; then
  echo "===== DRYRUN: assembled directive ====="
  echo "$DIRECTIVE"
  echo "===== would invoke: $CLAUDE -p <directive+prompt> --dangerously-skip-permissions --model $MODEL ====="
  echo "$(date -Is) DRYRUN cycle $TS mode=$MODE ship=$SHIP" >> "$HEARTBEAT"
  exit 0
fi

# --- Agentic brain -----------------------------------------------------------
cd "$PROJ"
timeout 2400 "$CLAUDE" -p "$DIRECTIVE"$'\n\n'"$(cat "$PROMPT_FILE")" \
  --dangerously-skip-permissions --model "$MODEL" 2>&1

echo "$(date -Is) cycle $TS mode=$MODE ship=$SHIP done" >> "$HEARTBEAT"
