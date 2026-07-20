// Handler-level E2E (v3) against an in-memory store (the __PP_STORE__ seam).
// create -> get -> session -> partner invitation/accept -> lazy-tax raise +
// owner notification + ack -> cheer -> share -> stats. Run: node test/api.test.mjs
import assert from "node:assert";

function memStore() {
  const m = new Map();
  return { async setJSON(k, v) { m.set(k, JSON.stringify(v)); }, async get(k) { const s = m.get(k); return s == null ? null : JSON.parse(s); }, async list() { return { blobs: [...m.keys()].map((key) => ({ key })) }; } };
}
const STORE = memStore();
globalThis.__PP_STORE__ = STORE;
process.env.PP_ADMIN_KEY = "testkey123";
const { default: handler } = await import("../netlify/functions/api.js");
const { addDays, todaySGT } = await import("../lib/penalty.mjs");

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

console.log("Secret Mode — 30-day cap, Day-19 reveal, unlock, hardcore");
{
  // seed a fresh challenge with 20 consecutive done days ending today
  const sc = await call("create", {}, { owner_name: "Streaker", partner_name: "W", daily_target: 5, penalty_amount: 10, currency: "$", created_via: "self" });
  const sid = sc.data.id, sTok = tokenOf(sc.data.owner_link);
  const obj = await STORE.get(sid);
  obj.sessions = {}; let d0 = todaySGT(); obj.start_date = addDays(d0, -25);
  for (let i = 0; i < 20; i++) { obj.sessions[addDays(d0, -i)] = { reps: 6, target: 5 }; }
  await STORE.setJSON(sid, obj);
  const g = await call("get", { id: sid, t: sTok });
  eq(g.data.display_streak, 20, "streak 20");
  eq(g.data.secret_reveal, true, "Day-19 reveal fires at streak>=19");
  // burn it (one-time)
  await call("secret_seen", { id: sid, t: sTok }, {});
  eq((await call("get", { id: sid, t: sTok })).data.secret_reveal, false, "reveal is one-time (burned)");
  // unlock
  const u = await call("unlock_secret", { id: sid, t: sTok }, {});
  eq(u.data.secret_unlocked, true, "secret unlocked");
  ok(u.data.hardcore_tier && u.data.hardcore_tier.name === "Iron", "Iron tier <100");

  // cap: a non-unlocked 35-day streak displays 30 + challenge_complete
  const cc = await call("create", {}, { owner_name: "Capped", partner_name: "W", daily_target: 5, penalty_amount: 10, currency: "$", created_via: "self" });
  const cid = cc.data.id, cTok = tokenOf(cc.data.owner_link);
  const cobj = await STORE.get(cid); cobj.sessions = {}; cobj.start_date = addDays(d0, -40);
  for (let i = 0; i < 35; i++) cobj.sessions[addDays(d0, -i)] = { reps: 6, target: 5 };
  await STORE.setJSON(cid, cobj);
  const cg = await call("get", { id: cid, t: cTok });
  eq(cg.data.display_streak, 30, "free streak caps at 30");
  eq(cg.data.challenge_complete, true, "30-day challenge complete");
}

console.log("reverse-invite (prank mode) still supported");
{
  const p = await call("create", {}, { owner_name: "Victim", partner_name: "Prankster", daily_target: 10, penalty_amount: 10000, currency: "Rp", created_via: "prank" });
  eq(p.data.created_via, "prank", "prank mode create");
  ok(p.data.owner_link && p.data.invite_link, "both links returned (creator sends owner_link to the doer)");
}

console.log("guards");
eq((await call("get", { id, t: "bad" })).status, 403, "bad token 403");
eq((await call("get", { id: "deadbeef", t: ownerT })).status, 404, "missing 404");

console.log(`\nAll ${pass} handler assertions passed ✅`);
