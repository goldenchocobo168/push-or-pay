// Handler-level E2E (v3) against an in-memory store (the __PP_STORE__ seam).
// create -> get -> session -> partner invitation/accept -> lazy-tax raise +
// owner notification + ack -> cheer -> share -> stats. Run: node test/api.test.mjs
import assert from "node:assert";

function memStore() {
  const m = new Map();
  return { async setJSON(k, v) { m.set(k, JSON.stringify(v)); }, async get(k) { const s = m.get(k); return s == null ? null : JSON.parse(s); }, async list() { return { blobs: [...m.keys()].map((key) => ({ key })) }; } };
}
globalThis.__PP_STORE__ = memStore();
process.env.PP_ADMIN_KEY = "testkey123";
const { default: handler } = await import("../netlify/functions/api.js");

let pass = 0;
const ok = (c, n) => { assert.ok(c, n); console.log("  ✓", n); pass++; };
const eq = (a, b, n) => { assert.strictEqual(a, b, `${n} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`); console.log("  ✓", n); pass++; };
const call = async (action, params = {}, body) => {
  const qs = new URLSearchParams({ action, ...params }).toString();
  const res = await handler(new Request("http://x/api?" + qs, { method: body ? "POST" : "GET", headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined }));
  return { status: res.status, data: await res.json() };
};
const tokenOf = (link) => new URL("http://x" + link).searchParams.get("t");

console.log("create (IDR default)");
const c = await call("create", {}, { owner_name: "Sam", partner_name: "Wife", daily_target: 10, penalty_amount: 10000, currency: "Rp", created_via: "self" });
eq(c.status, 200, "create 200");
const id = c.data.id, ownerT = tokenOf(c.data.owner_link), partnerT = tokenOf(c.data.invite_link);
ok(ownerT !== partnerT, "distinct tokens");

console.log("owner get");
const og = await call("get", { id, t: ownerT });
eq(og.data.role, "owner", "role owner");
eq(og.data.penalty_display, "Rp 10,000", "Lazy Tax shows Rp 10,000");
eq(og.data.penalty_usd_hint, "US$0.64", "…≈ US$0.64 hint");
eq(og.data.accepted, false, "watcher not yet accepted");
ok(!("prank_alert" in og.data), "no prank alert in v3");
ok(!("owner_token" in og.data) && !("partner_token" in og.data), "raw tokens hidden");

console.log("session (streak)");
const s1 = await call("session", { id, t: ownerT }, { reps: 12, duration_seconds: 44, started_at: Date.now() });
eq(s1.data.streak, 1, "streak 1 after 12/10");
ok(s1.data.sessions[s1.data.today] && s1.data.sessions[s1.data.today].reps === 12, "session detail exposed for heatmap");

console.log("watcher invitation -> accept");
const pg = await call("get", { id, t: partnerT });
eq(pg.data.role, "partner", "role partner");
eq(pg.data.accepted, false, "invitation state (not accepted)");
ok(!pg.data.invite_link, "partner never sees invite link");
const acc = await call("accept", { id, t: partnerT }, {});
eq(acc.data.accepted, true, "accept sets accepted=true");
// owner cannot accept
eq((await call("accept", { id, t: ownerT }, {})).status, 403, "owner can't accept");

console.log("watcher raises Lazy Tax -> owner gets notified -> ack");
eq((await call("penalty", { id, t: ownerT }, { amount: 50000 })).status, 403, "owner can't raise own tax");
const raise = await call("penalty", { id, t: partnerT }, { amount: 50000 });
eq(raise.data.penalty_amount, 50000, "tax raised to 50000");
const og2 = await call("get", { id, t: ownerT });
ok(og2.data.lazy_tax_update && og2.data.lazy_tax_update.to === "Rp 50,000", "owner sees lazy_tax_update banner (Rp 10,000 -> Rp 50,000)");
eq(og2.data.lazy_tax_update.from, "Rp 10,000", "banner shows previous amount");
const ack = await call("lazy_tax_ack", { id, t: ownerT }, {});
ok(!ack.data.lazy_tax_update, "ack clears the banner");
ok(!(await call("get", { id, t: ownerT })).data.lazy_tax_update, "banner stays cleared");

console.log("cheer + share");
const ch = await call("cheer", { id, t: partnerT }, { emoji: "🔥" });
ok(ch.data.cheers[ch.data.today].length === 1, "cheer recorded");
eq((await call("share", { id, t: ownerT })).data.shares, 1, "share counted");

console.log("stats");
eq((await call("stats", {})).status, 401, "stats needs key");
const st = await call("stats", { key: "testkey123" });
eq(st.data.totals.signups, 1, "1 signup");
eq(st.data.totals.total_sessions, 1, "1 session");
ok(st.data.totals.partners_joined >= 1, "watcher activation counted");

console.log("guards");
eq((await call("get", { id, t: "bad" })).status, 403, "bad token 403");
eq((await call("get", { id: "deadbeef", t: ownerT })).status, 404, "missing 404");

console.log(`\nAll ${pass} handler assertions passed ✅`);
