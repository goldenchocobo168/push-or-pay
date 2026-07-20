#!/bin/bash
# Watch-the-watcher: alert if the DRI heartbeat is stale (a cron/timer "fired"
# is NOT proof it worked — verify by output freshness). Meant to run ~hourly,
# offset from the RSI loop, via its own systemd timer.
set -uo pipefail
HEARTBEAT="/root/.pp-diag/rsi-logs/heartbeat.log"
MAX_AGE_MIN="${PP_WATCHDOG_MAX_AGE_MIN:-150}"   # ~2.5h: two missed hourly fires

now=$(date +%s)
if [ ! -f "$HEARTBEAT" ]; then
  echo "$(date -Is) WATCHDOG: no heartbeat file yet"
  exit 0
fi
mtime=$(stat -c %Y "$HEARTBEAT")
age_min=$(( (now - mtime) / 60 ))
if [ "$age_min" -gt "$MAX_AGE_MIN" ]; then
  MSG="⚠️ Penalty Partner DRI heartbeat stale: ${age_min}m old (> ${MAX_AGE_MIN}m). Loop may be stuck."
  echo "$(date -Is) $MSG"
  # Best-effort Telegram via the fleet's notifier if present; never hard-fail.
  if [ -x /root/.openclaw/shared/scripts/notify-sam.sh ]; then
    /root/.openclaw/shared/scripts/notify-sam.sh "$MSG" 2>/dev/null || true
  fi
else
  echo "$(date -Is) WATCHDOG ok: heartbeat ${age_min}m old"
fi
