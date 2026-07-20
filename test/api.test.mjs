// Handler-level E2E against an in-memory store (the __PP_STORE__ test seam).
// Drives the real function: create (self + prank) → get → session → penalty
// raise → cheer → share → stats. Run: node test/api.test.mjs
import assert from "node:assert";

function memStore() {
  const m = new Map();
  return {
    async setJSON(k, v) { m.set(k, JSON.stringify(v)); },
    async get(k) { const s = m.get(k); return s == null ? null : JSON.parse(s); },
    async list() { return { blobs: [...m.keys()].map((key) => ({ key })) }; },
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
const tokenOf = (link) => new URL("http://x" + link).searchParams.get("t");

console.log("create (self mode)");
const c = await call("create", {}, { owner_name: "Sam", partner_name: "Wife", daily_target: 10, penalty_amount: 10, currency: "$", created_via: "self" });
eq(c.status, 200, "create 200");
eq(c.data.created_via, "self", "self mode");
ok(c.data.keep === c.data.owner_link, "self: creator keeps owner(doer) link");
ok(c.data.send === c.data.invite_link, "self: sends invite(profiteer) link");
const id = c.data.id, ownerT = tokenOf(c.data.owner_link), partnerT = tokenOf(c.data.invite_link);
ok(ownerT !== partnerT, "distinct tokens");

console.log("owner get (doer) — streak hero, no token leak");
const og = await call("get", { id, t: ownerT });
eq(og.data.role, "owner", "role owner");
eq(og.data.streak, 0, "streak 0");
eq(og.data.today_done, false, "not done");
ok(og.data.invite_link && !("owner_token" in og.data) && !("partner_token" in og.data), "invite link present, raw tokens hidden");
eq(og.data.prank_alert, false, "self mode has no prank alert");

console.log("bad token 403");
eq((await call("get", { id, t: "nope" })).status, 403, "invalid token 403");

console.log("session (doer does push-ups)");
const s1 = await call("session", { id, t: ownerT }, { reps: 12, duration_seconds: 45, started_at: Date.now() });
eq(s1.data.today_done, true, "12/10 = done");
eq(s1.data.streak, 1, "streak 1");
eq(s1.data.today_reps, 12, "reps recorded");
// partner cannot do the session
eq((await call("session", { id, t: partnerT }, { reps: 5 })).status, 403, "partner can't do push-ups");

console.log("partner get (profiteer) — no invite leak, gets doer_link");
const pg = await call("get", { id, t: partnerT });
eq(pg.data.role, "partner", "role partner");
ok(!pg.data.invite_link, "partner does not see invite link");
ok(pg.data.doer_link, "partner gets doer_link (for prank re-send)");

console.log("partner raises the penalty; owner can't");
eq((await call("penalty", { id, t: ownerT }, { amount: 50 })).status, 403, "owner cannot raise penalty");
const pr = await call("penalty", { id, t: partnerT }, { amount: 50 });
eq(pr.status, 200, "partner raise 200");
eq(pr.data.penalty_amount, 50, "penalty now 50");
ok(pr.data.penalty_events.length >= 2, "penalty event logged");

console.log("cheer + share");
const ch = await call("cheer", { id, t: partnerT }, { emoji: "🔥" });
ok(ch.data.cheers[ch.data.today].length === 1, "cheer recorded");
eq((await call("share", { id, t: ownerT })).data.shares, 1, "share counted");

console.log("create (prank mode) — the reverse flow + IDR");
const p = await call("create", {}, { owner_name: "Husband", partner_name: "Wife", daily_target: 10, penalty_amount: 10000, currency: "Rp", created_via: "prank" });
eq(p.data.created_via, "prank", "prank mode");
ok(p.data.keep === p.data.invite_link, "prank: creator keeps profiteer link");
ok(p.data.send === p.data.owner_link, "prank: sends doer(victim) the owner link");
const pid = p.data.id, pOwnerT = tokenOf(p.data.owner_link);
const pdoer = await call("get", { id: pid, t: pOwnerT });
eq(pdoer.data.prank_alert, true, "victim sees the prank alert on first open");
eq(pdoer.data.penalty_display, "Rp 10,000", "scary IDR display");
eq(pdoer.data.penalty_usd_hint, "US$0.64", "…that deflates to US$0.64 (the joke)");
// alert is consumed after first view
eq((await call("get", { id: pid, t: pOwnerT })).data.prank_alert, false, "prank alert only shows once");

console.log("stats admin gate + prank counter");
eq((await call("stats", {})).status, 401, "stats no key 401");
const st = await call("stats", { key: "testkey123" });
eq(st.status, 200, "stats 200");
eq(st.data.totals.signups, 2, "2 signups");
eq(st.data.totals.pranks, 1, "1 prank");
eq(st.data.totals.total_sessions, 1, "1 session");
eq(st.data.totals.shares, 1, "1 share");
ok(st.data.totals.partners_joined >= 1, "partner activation counted");

console.log("404 for missing challenge");
eq((await call("get", { id: "deadbeef", t: ownerT })).status, 404, "missing 404");

console.log(`\nAll ${pass} handler assertions passed ✅`);
