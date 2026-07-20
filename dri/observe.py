#!/usr/bin/env python3
"""Deterministic OBSERVE + CALIBRATE for the Push or Pay DRI.

Pulls REAL metrics from the live /api?action=stats endpoint, computes the North
Star, appends one record per run to calibration.jsonl, and prints a compact
summary the agentic RSI cycle reads at the top of its prompt. No LLM, no side
effects beyond the append-only ledger.

North Star (from the spec): "Create funny, memorable moments between partners."
The most important proxy the spec names is "Would someone send this screenshot
to their spouse?" — i.e. SHARES. We track two:
  - SHARED       : total share actions (the virality / "would-send" signal)
  - ACTIVE-PAIRS : partner joined via invite AND the doer logged >=3 sessions
"""
import json, os, sys, time, urllib.parse, urllib.request, pathlib

BASE = os.environ.get("PP_BASE", "https://push-or-pay.netlify.app")
HERE = pathlib.Path(__file__).resolve().parent
KEYFILE = HERE / ".admin-key.txt"
CALIB = HERE / "journal" / "calibration.jsonl"

def admin_key():
    return (os.environ.get("PP_ADMIN_KEY") or (KEYFILE.read_text().strip() if KEYFILE.exists() else "")).strip()

def fetch_stats():
    url = f"{BASE}/api?action=stats&key={urllib.parse.quote(admin_key())}"
    with urllib.request.urlopen(urllib.request.Request(url, headers={"accept": "application/json"}), timeout=25) as r:
        return json.load(r)

def observe():
    s = fetch_stats()
    t = s.get("totals", {})
    recent = s.get("recent", [])
    active_pairs = sum(1 for c in recent if c.get("partner_joined") and c.get("sessions", 0) >= 3)
    by_via = {}
    for c in recent:
        by_via.setdefault(c.get("via", "self"), []).append(c.get("sessions", 0))
    via_signal = {k: round(sum(v) / len(v), 2) for k, v in by_via.items() if v}
    return {
        "ts": int(time.time()),
        "shared": t.get("shares", 0),
        "active_pairs": active_pairs,
        "signups": t.get("signups", 0),
        "pranks": t.get("pranks", 0),
        "partners_joined": t.get("partners_joined", 0),
        "partner_join_rate": t.get("partner_join_rate", 0),
        "total_sessions": t.get("total_sessions", 0),
        "retention_2d": t.get("retention_2d", 0),
        "retention_7d": t.get("retention_7d", 0),
        "activation_rate": t.get("activation_rate", 0),
        "active_last_7d": t.get("active_last_7d", 0),
        "sessions_by_via": via_signal,
    }

def calibrate(obs):
    CALIB.parent.mkdir(parents=True, exist_ok=True)
    with open(CALIB, "a") as f:
        f.write(json.dumps(obs) + "\n")
    try:
        lines = CALIB.read_text().strip().splitlines()
        return json.loads(lines[-2]) if len(lines) >= 2 else None
    except Exception:
        return None

def main():
    try:
        obs = observe()
    except Exception as e:
        print(f"OBSERVE FAILED: {e}", file=sys.stderr)
        print("METRICS: UNAVAILABLE (stats endpoint failed) — SELF-HEAL is this cycle's priority.")
        sys.exit(0)
    prev = calibrate(obs)
    d = lambda k: (obs[k] - prev[k]) if prev and k in prev else 0
    print("=== LIVE METRICS (deterministic, this cycle) ===")
    print(f"NORTH STAR — SHARED (would-send-to-spouse) = {obs['shared']} [Δ {d('shared'):+d}] · "
          f"ACTIVE-PAIRS = {obs['active_pairs']} [Δ {d('active_pairs'):+d}]")
    print(f"signups {obs['signups']} ({obs['pranks']} pranks) · partners_joined {obs['partners_joined']} "
          f"({obs['partner_join_rate']}%) · sessions {obs['total_sessions']}")
    print(f"activation {obs['activation_rate']}% · retention2d {obs['retention_2d']}% · "
          f"retention7d {obs['retention_7d']}% · active7d {obs['active_last_7d']}")
    print(f"sessions by creation mode (calibration: does prank convert?): {obs['sessions_by_via']}")
    print("=== END METRICS ===")

if __name__ == "__main__":
    main()
