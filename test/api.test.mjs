// Handler-level E2E against an in-memory store (the __PP_STORE__ test seam).
// Drives the real function: create → get(owner/partner) → checkin → forgive
// → settle → share → stats. Run: node test/api.test.mjs
import assert from "node:assert";

// In-memory Blobs-compatible store.
function memStore() {
  const m = new Map();
  return {
    async setJSON(k, v) { m.set(k, JSON.stringify(v)); },
    async get(k) { const s = m.get(k); return s == null ? null : JSON.parse(s); },
    async list() { return { blobs: [...m.keys()].map((key) => ({ key })) }; },
    _map: m,
  };
}
globalThis.__PP_STORE__ = memStore();
process.env.PP_ADMIN_KEY = "testkey123";

const { default: handler } = await import("../netlify/functions/api.js");

let pass = 0;
const ok = (c, n) => { assert.ok(c, n); console.log("  ✓", n); pass++; };
const eq = (a, b, n) => { assert.strictEqual(a, b, `${n} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`); console.log("  ✓", n); pass++; };

const call = async (action, params = {}, body) => {
  const qs = new URLSearchParams({ action, ...params }).toString();
  const req = new Request("http://x/api?" + qs, {
    method: body ? "POST" : "GET",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const res = await handler(req);
  return { status: res.status, data: await res.json() };
};

console.log("create");
const c = await call("create", {}, { owner_name: "Sam", partner_name: "Wife", habit: "1 Push-up", penalty: 10 });
eq(c.status, 200, "create 200");
ok(c.data.id && c.data.owner_link && c.data.invite_link, "returns id + both links");
const id = c.data.id;
const ownerT = new URL("http://x" + c.data.owner_link).searchParams.get("t");
const partnerT = new URL("http://x" + c.data.invite_link).searchParams.get("t");
ok(ownerT && partnerT && ownerT !== partnerT, "distinct owner/partner tokens");

console.log("owner get");
const og = await call("get", { id, t: ownerT });
eq(og.status, 200, "owner get 200");
eq(og.data.role, "owner", "role owner");
eq(og.data.debt, 0, "debt 0 on day 0");
ok(og.data.invite_link, "owner sees invite link");
ok(!("owner_token" in og.data) && !("partner_token" in og.data), "raw tokens never leaked");

console.log("bad token rejected");
const bad = await call("get", { id, t: "nope" });
eq(bad.status, 403, "invalid token 403");

console.log("partner get (activation)");
const pg = await call("get", { id, t: partnerT });
eq(pg.data.role, "partner", "role partner");
ok(!pg.data.invite_link, "partner does NOT see invite link");
ok(pg.data.roast, "partner gets a roast line");

console.log("owner-only actions guarded");
const pForbidCheckin = await call("checkin", { id, t: partnerT }, {});
eq(pForbidCheckin.status, 403, "partner cannot check in");

console.log("checkin");
const ci = await call("checkin", { id, t: ownerT }, {});
eq(ci.data.today_done, true, "today done after checkin");
eq(ci.data.streak, 1, "streak 1");

console.log("forgive is partner-only");
const oForbidForgive = await call("forgive", { id, t: ownerT }, { date: ci.data.today });
eq(oForbidForgive.status, 403, "owner cannot forgive");
const fg = await call("forgive", { id, t: partnerT }, { date: ci.data.today });
eq(fg.status, 200, "partner forgive 200");

console.log("share + settle");
const sh = await call("share", { id, t: ownerT });
eq(sh.data.shares, 1, "share counted");
const st = await call("settle", { id, t: ownerT }, {});
eq(st.data.debt, 0, "debt 0 after settle");

console.log("stats admin gate");
const noKey = await call("stats", {});
eq(noKey.status, 401, "stats without key 401");
const stats = await call("stats", { key: "testkey123" });
eq(stats.status, 200, "stats with key 200");
eq(stats.data.totals.signups, 1, "1 signup");
eq(stats.data.totals.partners_joined, 1, "partner joined counted");
eq(stats.data.totals.total_checkins, 1, "1 checkin");
eq(stats.data.totals.shares, 1, "1 share");
ok(stats.data.totals.activation_rate === 100, "activation 100%");
eq(stats.data.signups_by_day.length, 30, "30-day series");
ok(stats.data.recent.length === 1, "1 recent challenge");

console.log("404 for missing challenge");
const nf = await call("get", { id: "deadbeef", t: ownerT });
eq(nf.status, 404, "missing challenge 404");

console.log(`\nAll ${pass} handler assertions passed ✅`);
