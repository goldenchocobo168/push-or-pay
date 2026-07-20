#!/usr/bin/env python3
"""Deterministic OBSERVE + CALIBRATE for the Penalty Partner DRI.

Pulls REAL metrics from the live /api?action=stats endpoint, computes the North
Star (ACTIVATED-PAIRS: partner joined AND owner has >=3 check-ins), appends one
record per run to calibration.jsonl, and prints a compact summary the agentic
RSI cycle reads at the top of its prompt. No LLM, no side effects beyond the
append-only ledger. Mirrors the shape of sage_dri_loop.py's observe()/calibrate().
"""
import json, os, sys, time, urllib.request, pathlib

BASE = os.environ.get("PP_BASE", "https://penalty-partner-app.netlify.app")
HERE = pathlib.Path(__file__).resolve().parent
KEYFILE = HERE / ".admin-key.txt"
CALIB = HERE / "journal" / "calibration.jsonl"

def admin_key():
    k = os.environ.get("PP_ADMIN_KEY")
    if k:
        return k.strip()
    if KEYFILE.exists():
        return KEYFILE.read_text().strip()
    return ""

def fetch_stats():
    key = admin_key()
    url = f"{BASE}/api?action=stats&key={urllib.parse.quote(key)}"
    req = urllib.request.Request(url, headers={"accept": "application/json"})
    with urllib.request.urlopen(req, timeout=25) as r:
        return json.load(r)

import urllib.parse

def observe():
    s = fetch_stats()
    t = s.get("totals", {})
    recent = s.get("recent", [])
    # North Star: partner joined AND owner has >=3 check-ins.
    activated_pairs = sum(1 for c in recent if c.get("partner_joined") and c.get("checkins", 0) >= 3)
    # Which penalty band is associated with the most check-ins (a calibration signal)?
    by_pen = {}
    for c in recent:
        band = "1-9" if c.get("penalty", 0) < 10 else "10-49" if c.get("penalty", 0) < 50 else "50+"
        by_pen.setdefault(band, []).append(c.get("checkins", 0))
    pen_signal = {k: round(sum(v) / len(v), 2) for k, v in by_pen.items() if v}
    return {
        "ts": int(time.time()),
        "activated_pairs": activated_pairs,
        "signups": t.get("signups", 0),
        "partners_joined": t.get("partners_joined", 0),
        "partner_join_rate": t.get("partner_join_rate", 0),
        "total_checkins": t.get("total_checkins", 0),
        "retention_2d": t.get("retention_2d", 0),
        "retention_7d": t.get("retention_7d", 0),
        "activation_rate": t.get("activation_rate", 0),
        "active_last_7d": t.get("active_last_7d", 0),
        "shares": t.get("shares", 0),
        "checkins_by_penalty_band": pen_signal,
    }

def calibrate(obs):
    CALIB.parent.mkdir(parents=True, exist_ok=True)
    with open(CALIB, "a") as f:
        f.write(json.dumps(obs) + "\n")
    # Trend vs previous record.
    prev = None
    try:
        lines = CALIB.read_text().strip().splitlines()
        if len(lines) >= 2:
            prev = json.loads(lines[-2])
    except Exception:
        pass
    return prev

def main():
    try:
        obs = observe()
    except Exception as e:
        print(f"OBSERVE FAILED: {e}", file=sys.stderr)
        # Emit a minimal summary so the cycle still knows self-heal is priority.
        print("METRICS: UNAVAILABLE (stats endpoint failed) — SELF-HEAL is this cycle's priority.")
        sys.exit(0)
    prev = calibrate(obs)
    d = lambda k: (obs[k] - prev[k]) if prev and k in prev else 0
    print("=== LIVE METRICS (deterministic, this cycle) ===")
    print(f"NORTH STAR activated_pairs = {obs['activated_pairs']} (target 10) [Δ {d('activated_pairs'):+d}]")
    print(f"signups {obs['signups']} · partners_joined {obs['partners_joined']} "
          f"({obs['partner_join_rate']}%) · check-ins {obs['total_checkins']}")
    print(f"activation {obs['activation_rate']}% · retention2d {obs['retention_2d']}% · "
          f"retention7d {obs['retention_7d']}% · active7d {obs['active_last_7d']} · shares {obs['shares']}")
    print(f"check-ins by penalty band (calibration signal): {obs['checkins_by_penalty_band']}")
    print("=== END METRICS ===")

if __name__ == "__main__":
    main()
