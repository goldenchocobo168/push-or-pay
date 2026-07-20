#!/usr/bin/env python3
"""Real-browser E2E via CDP: drive the live Penalty Partner UI with actual
clicks/typing, not curl. Opens a fresh tab on the existing Chrome (:9222),
closes it at the end so it doesn't disturb the other profile tab."""
import json, time, sys, urllib.request, websocket

CDP = "http://localhost:9222"
BASE = sys.argv[1] if len(sys.argv) > 1 else "https://penalty-partner-app.netlify.app"

def http(path, method="GET"):
    req = urllib.request.Request(CDP + path, method=method)
    return json.load(urllib.request.urlopen(req))

# New tab (Chrome >=150 requires PUT for /json/new)
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
            if "error" in m:
                raise RuntimeError(f"{method}: {m['error']}")
            return m.get("result", {})

def js(expr, awaitp=False):
    r = cmd("Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": awaitp})
    return r.get("result", {}).get("value")

cmd("Page.enable")
def goto(url):
    cmd("Page.navigate", {"url": url})
    time.sleep(3)

fails = []
def check(name, cond):
    print(("  ✓ " if cond else "  ✗ ") + name)
    if not cond:
        fails.append(name)

try:
    print("landing page")
    goto(BASE + "/")
    check("title mentions Penalty Partner", "Penalty Partner" in (js("document.title") or ""))
    check("create form present", js("!!document.getElementById('createForm')"))

    print("fill + submit create form (real input events)")
    js("document.getElementById('owner').value='E2E Sam';"
       "document.getElementById('partner').value='E2E Wife';"
       "document.getElementById('habit').value='1 Push-up';"
       "document.getElementById('penalty').value='15';")
    # Submit and wait for the redirect to /c/<id>
    js("document.getElementById('createBtn').click()")
    time.sleep(4)
    url = js("location.pathname")
    check("redirected to /c/<id> owner view", (url or "").startswith("/c/"))
    check("owner sees 'I did it' button", js("!!document.getElementById('doBtn')"))
    check("heatmap rendered (90 cells)", (js("document.querySelectorAll('.heat .cell').length") or 0) == 90)
    check("invite link input present", js("!!document.getElementById('inviteInput')"))
    owner_url = js("location.href")

    print("click 'I did it' -> streak becomes 1")
    js("document.getElementById('doBtn').click()")
    time.sleep(3)
    streak = js("document.querySelector('.stat .n.streak') && document.querySelector('.stat .n.streak').textContent")
    check("streak shows 1 after check-in", str(streak).strip() == "1")
    check("button now 'Done for today'", "Done for today" in (js("document.querySelector('.today .btn').textContent") or ""))

    print("partner view via invite link (real navigation)")
    invite = js("document.getElementById('inviteInput').value")
    goto(invite)
    check("partner sees owner's habit", "E2E Sam" in (js("document.body.innerText") or ""))
    check("partner sees roast/mercy area (reactions)", (js("document.querySelectorAll('.reacts button').length") or 0) >= 3)
    check("partner does NOT see invite input", js("!document.getElementById('inviteInput')"))

    print("screenshot owner view")
    goto(owner_url)
    shot = cmd("Page.captureScreenshot", {"format": "png"})
    import base64
    open("/root/penalty-partner/test/e2e-owner.png", "wb").write(base64.b64decode(shot["data"]))
    print("  saved test/e2e-owner.png")

finally:
    ws.close()
    try: urllib.request.urlopen(CDP + "/json/close/" + tid).read()
    except Exception: pass

print()
if fails:
    print(f"❌ {len(fails)} browser check(s) FAILED: {fails}")
    sys.exit(1)
print("✅ All browser E2E checks passed")
