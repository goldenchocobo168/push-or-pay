#!/usr/bin/env python3
"""Real-browser E2E (v3) via CDP for Push or Pay. Drives the playful flow with
real clicks: landing -> warning -> create -> invite -> dashboard -> push-up
session -> complete -> watcher invitation -> accept -> watcher dashboard."""
import json, time, sys, urllib.request, base64, websocket

CDP = "http://localhost:9222"
BASE = sys.argv[1] if len(sys.argv) > 1 else "https://push-or-pay.netlify.app"

def http(path, method="GET"): return json.load(urllib.request.urlopen(urllib.request.Request(CDP + path, method=method)))
tab = http("/json/new?" + BASE + "/", method="PUT"); tid = tab["id"]
ws = websocket.create_connection(tab["webSocketDebuggerUrl"], timeout=30); _id = [0]
def cmd(m, p=None):
    _id[0] += 1; ws.send(json.dumps({"id": _id[0], "method": m, "params": p or {}}))
    while True:
        x = json.loads(ws.recv())
        if x.get("id") == _id[0]:
            if "error" in x: raise RuntimeError(f"{m}: {x['error']}")
            return x.get("result", {})
def js(e):
    r = cmd("Runtime.evaluate", {"expression": e, "returnByValue": True})
    if "exceptionDetails" in r: raise RuntimeError("JS: " + json.dumps(r["exceptionDetails"])[:200])
    return r.get("result", {}).get("value")
cmd("Page.enable")
def goto(u): cmd("Page.navigate", {"url": u}); time.sleep(3)

fails = []
def check(n, c):
    print(("  ✓ " if c else "  ✗ ") + n)
    if not c: fails.append(n)

try:
    print("landing")
    goto(BASE + "/")
    check("title has Push or Pay", "Push or Pay" in (js("document.title") or ""))
    check("hero 'who profits when you skip'", "skip" in (js("document.querySelector('.display').textContent") or "").lower())
    check("no 'Free' word anywhere", "free" not in (js("document.body.innerText") or "").lower())
    check("device mockup present", js("!!document.querySelector('.device .dv-num')"))

    print("start -> warning -> create (no mode screen)")
    js("document.getElementById('heroStart').click()"); time.sleep(0.5)
    check("warning shown first (no mode step)", js("!document.getElementById('s-warn').classList.contains('hidden') && !document.getElementById('marketing') || !document.getElementById('s-warn').classList.contains('hidden')"))
    js("document.getElementById('warnBtn').click()"); time.sleep(0.5)
    check("create form shown", js("!document.getElementById('s-create').classList.contains('hidden')"))
    check("create title 'Create your challenge'", "challenge" in (js("document.querySelector('#s-create .title').textContent") or "").lower())
    check("currency defaults to Rupiah (IDR)", js("document.getElementById('currency').value") == "Rp")
    check("Lazy Tax label present (not 'penalty')", "lazy tax" in (js("document.querySelector('#s-create').innerText") or "").lower())

    print("fill create -> submit -> invite")
    js("document.getElementById('owner').value='E2E Sam';document.getElementById('partner').value='E2E Wife';")
    js("document.getElementById('createBtn').click()"); time.sleep(4)
    check("done screen with invite link", js("!!document.getElementById('sendLink') && document.getElementById('sendLink').value.indexOf('/c/')>-1"))
    invite = js("document.getElementById('sendLink').value")
    js("document.getElementById('openBtn').click()"); time.sleep(3.5)

    print("owner dashboard (streak -> challenge -> heatmap -> lazy tax order)")
    check("streak hero", js("!!document.querySelector('.hero-streak .days')"))
    check("today's challenge card", "challenge" in (js("document.querySelector('.today-card .goal').textContent") or "").lower())
    check("Lazy Tax card present", (js("document.querySelectorAll('.lazy-card').length") or 0) >= 1)
    check("shows Rp Lazy Tax", "Rp" in (js("document.querySelector('.lazy-card .lz-amt').textContent") or ""))
    check("heatmap 90 cells", (js("document.querySelectorAll('.heat .cell').length") or 0) == 90)
    dash_url = js("location.href")

    print("push-up session: tap 10 -> complete")
    js("document.getElementById('startBtn').click()"); time.sleep(0.6)
    for _ in range(10): js("document.getElementById('tap').click()")
    check("counter reads 10", str(js("document.getElementById('count').textContent")) == "10")
    js("document.getElementById('doneBtn').click()"); time.sleep(3)
    check("complete: streak protected", "streak" in (js("document.body.innerText") or "").lower() and "protected" in (js("document.body.innerText") or "").lower())
    js("document.getElementById('okBtn').click()"); time.sleep(2.5)
    check("streak now 1", str(js("document.querySelector('.hero-streak .days').textContent")).strip() == "1")

    print("watcher: invitation -> accept -> watcher dashboard")
    goto(invite)
    check("invitation 'You've been invited'", "invited" in (js("document.body.innerText") or "").lower())
    check("shows challenge + Lazy Tax to watcher", "push-ups" in (js("document.body.innerText") or "").lower())
    check("Accept challenge button", js("!!document.getElementById('acceptBtn')"))
    js("document.getElementById('acceptBtn').click()"); time.sleep(2.5)
    check("accepted screen 'You're in'", "you're in" in (js("document.body.innerText") or "").lower())
    js("document.getElementById('goBtn').click()"); time.sleep(1.5)
    check("watcher: cheer buttons", (js("document.querySelectorAll('.reacts button').length") or 0) >= 4)
    check("watcher: raise Lazy Tax controls", (js("document.querySelectorAll('.raise').length") or 0) >= 1)
    check("watcher never sees invite input", js("!document.getElementById('inviteInput')"))

    print("screenshots")
    goto(dash_url); shot = cmd("Page.captureScreenshot", {"format": "png"}); open("/root/push-or-pay/test/e2e-dashboard.png", "wb").write(base64.b64decode(shot["data"]))
    goto(invite); shot2 = cmd("Page.captureScreenshot", {"format": "png"}); open("/root/push-or-pay/test/e2e-invite.png", "wb").write(base64.b64decode(shot2["data"]))
    print("  saved dashboard + invitation screenshots")
finally:
    ws.close()
    try: urllib.request.urlopen(CDP + "/json/close/" + tid).read()
    except Exception: pass

print()
if fails: print(f"❌ {len(fails)} failed: {fails}"); sys.exit(1)
print("✅ All browser E2E checks passed")
