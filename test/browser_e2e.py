#!/usr/bin/env python3
"""Real-browser E2E via CDP for Push or Pay. Drives the actual multi-step UI
with real clicks/taps (landing -> mode -> warning -> create -> dashboard ->
push-up session -> complete -> partner view -> prank alert). Opens a fresh tab
on the running Chrome (:9222) and closes it at the end."""
import json, time, sys, urllib.request, base64, websocket

CDP = "http://localhost:9222"
BASE = sys.argv[1] if len(sys.argv) > 1 else "https://push-or-pay.netlify.app"

def http(path, method="GET"):
    return json.load(urllib.request.urlopen(urllib.request.Request(CDP + path, method=method)))

tab = http("/json/new?" + BASE + "/", method="PUT")
tid = tab["id"]
ws = websocket.create_connection(tab["webSocketDebuggerUrl"], timeout=30)
_id = [0]
def cmd(method, params=None):
    _id[0] += 1
    ws.send(json.dumps({"id": _id[0], "method": method, "params": params or {}}))
    while True:
        m = json.loads(ws.recv())
        if m.get("id") == _id[0]:
            if "error" in m: raise RuntimeError(f"{method}: {m['error']}")
            return m.get("result", {})
def js(expr):
    r = cmd("Runtime.evaluate", {"expression": expr, "returnByValue": True})
    if "exceptionDetails" in r: raise RuntimeError("JS: " + json.dumps(r["exceptionDetails"])[:200])
    return r.get("result", {}).get("value")
cmd("Page.enable")
def goto(url): cmd("Page.navigate", {"url": url}); time.sleep(3)

fails = []
def check(name, cond):
    print(("  ✓ " if cond else "  ✗ ") + name)
    if not cond: fails.append(name)

try:
    print("landing")
    goto(BASE + "/")
    check("title has Push or Pay", "Push or Pay" in (js("document.title") or ""))
    check("hook 'Who profits when you fail'", "profits" in (js("document.querySelector('.hook').textContent") or "").lower())
    check("Start button visible", js("!document.getElementById('s-landing').classList.contains('hidden')"))

    print("start -> mode -> next -> warning -> create")
    js("document.getElementById('startBtn').click()"); time.sleep(0.4)
    check("mode screen shown", js("!document.getElementById('s-mode').classList.contains('hidden')"))
    js("document.getElementById('modeNext').click()"); time.sleep(0.4)
    check("warning screen shown", js("!document.getElementById('s-warn').classList.contains('hidden')"))
    check("warning copy present", len(js("document.getElementById('warnLine').textContent") or "") > 10)
    js("document.getElementById('warnBtn').click()"); time.sleep(0.4)
    check("create form shown", js("!document.getElementById('s-create').classList.contains('hidden')"))

    print("fill create -> submit")
    js("document.getElementById('owner').value='E2E Sam';document.getElementById('partner').value='E2E Wife';document.getElementById('target').value='10';document.getElementById('penalty').value='10';")
    js("document.getElementById('createBtn').click()"); time.sleep(4)
    check("done screen with send link", js("!!document.getElementById('sendLink') && document.getElementById('sendLink').value.indexOf('/c/')>-1"))
    owner_url = js("(function(){var b=document.getElementById('openBtn').onclick;return null})();'x'")
    # open my dashboard
    js("document.getElementById('openBtn').click()"); time.sleep(3.5)
    check("owner dashboard: streak hero", js("!!document.querySelector('.hero-streak .days')"))
    check("owner: Start push-ups button", "push-ups" in (js("(document.getElementById('startBtn')||{}).textContent||''") or "").lower())
    check("heatmap 90 cells", (js("document.querySelectorAll('.heat .cell').length") or 0) == 90)
    check("invite input present", js("!!document.getElementById('inviteInput')"))
    invite = js("document.getElementById('inviteInput').value")
    dash_url = js("location.href")

    print("push-up session: tap 10 -> complete")
    js("document.getElementById('startBtn').click()"); time.sleep(0.6)
    check("session counter present", js("!!document.getElementById('count')"))
    for _ in range(10):
        js("document.getElementById('tap').click()")
    time.sleep(0.3)
    check("counter reads 10 after 10 taps", str(js("document.getElementById('count').textContent")) == "10")
    js("document.getElementById('doneBtn').click()"); time.sleep(3)
    check("complete screen celebrates", "🎉" in (js("document.querySelector('.hero-streak .flame').textContent") or ""))
    js("document.getElementById('okBtn').click()"); time.sleep(2.5)
    check("streak now 1 on dashboard", str(js("document.querySelector('.hero-streak .days').textContent")).strip() == "1")

    print("partner view (profiteer)")
    goto(invite)
    check("partner sees owner's streak label", "E2E Sam" in (js("document.body.innerText") or ""))
    check("partner has cheer buttons", (js("document.querySelectorAll('.reacts button').length") or 0) >= 4)
    check("partner has raise-penalty controls", (js("document.querySelectorAll('.raise').length") or 0) >= 1)
    check("partner does NOT see invite input", js("!document.getElementById('inviteInput')"))

    print("prank alert + IDR reveal (fresh prank challenge)")
    # create a prank IDR challenge via API, open the victim link
    create = js("""(async()=>{const r=await fetch('/api?action=create',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({owner_name:'Victim',partner_name:'Prankster',daily_target:10,penalty_amount:10000,currency:'Rp',created_via:'prank'})});const d=await r.json();window.__pv=location.origin+d.send;return window.__pv})()""")
    time.sleep(1.2)
    victim = js("window.__pv")
    check("got prank victim link", bool(victim) and "/c/" in str(victim))
    goto(victim)
    check("prank alert shows challenger", "challenged you" in (js("document.body.innerText") or "").lower())
    check("scary big number Rp 10,000", "10,000" in (js("(document.getElementById('bignum')||{}).textContent||''") or ""))
    time.sleep(2)  # wait for the reveal gag
    check("reveal deflates to US$ (the joke)", "US$" in (js("(document.getElementById('reveal')||{}).innerText||''") or ""))

    print("screenshots")
    goto(dash_url)
    shot = cmd("Page.captureScreenshot", {"format": "png"})
    open("/root/push-or-pay/test/e2e-dashboard.png", "wb").write(base64.b64decode(shot["data"]))
    goto(victim)
    shot2 = cmd("Page.captureScreenshot", {"format": "png"})
    open("/root/push-or-pay/test/e2e-prank.png", "wb").write(base64.b64decode(shot2["data"]))
    print("  saved dashboard + prank screenshots")
finally:
    ws.close()
    try: urllib.request.urlopen(CDP + "/json/close/" + tid).read()
    except Exception: pass

print()
if fails:
    print(f"❌ {len(fails)} browser check(s) FAILED: {fails}"); sys.exit(1)
print("✅ All browser E2E checks passed")
